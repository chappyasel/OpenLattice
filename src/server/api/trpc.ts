import { initTRPC, TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import superjson from "superjson";
import { ZodError } from "zod";
import crypto from "crypto";

import { auth, isAdmin } from "@/lib/auth";
import { activityId, generateUniqueId, slugify } from "@/lib/utils";
import { db } from "@/server/db";
import { contributors, researchSessions, sessionEvents } from "@/server/db/schema";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();
  return {
    db,
    session,
    ...opts,
  };
};

const t = initTRPC
  .context<typeof createTRPCContext>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError:
            error.cause instanceof ZodError ? error.cause.flatten() : null,
        },
      };
    },
  });

export const { createCallerFactory } = t;
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure — with optional session event logging.
 * If both Authorization and X-Session-Id headers are present (i.e. an MCP agent
 * calling a read-only endpoint during a research session), the middleware
 * validates the session and logs the tool call as a session event.
 * No auth is required — the middleware is purely additive.
 */
export const publicProcedure = t.procedure.use(async ({ next, ctx, path, getRawInput }) => {
  const start = Date.now();
  const result = await next({ ctx });

  // Fire-and-forget: log session event if agent headers are present
  const authHeader = ctx.headers.get("authorization");
  const sessionId = ctx.headers.get("x-session-id");

  if (authHeader && sessionId && !path.startsWith("sessions.")) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme === "Bearer" && token) {
      const keyHash = crypto.createHash("sha256").update(token).digest("hex");
      // Validate contributor + session in parallel, then insert event
      Promise.all([
        ctx.db.query.contributors.findFirst({
          where: eq(contributors.apiKey, keyHash),
        }),
      ])
        .then(async ([contributor]) => {
          if (!contributor) return;
          const session = await ctx.db.query.researchSessions.findFirst({
            where: and(
              eq(researchSessions.id, sessionId),
              eq(researchSessions.contributorId, contributor.id),
              eq(researchSessions.status, "active"),
            ),
          });
          if (!session) return;
          const ageMs = Date.now() - new Date(session.createdAt).getTime();
          if (ageMs >= 24 * 60 * 60 * 1000) return;

          const rawInput = await getRawInput();
          await ctx.db.insert(sessionEvents).values({
            id: activityId("evt", sessionId),
            sessionId,
            procedure: path,
            input: sanitizeInput(rawInput),
            durationMs: Date.now() - start,
          });
        })
        .catch(() => {
          // Silently ignore — session logging is best-effort
        });
    }
  }

  return result;
});

/** Protected: requires NextAuth session */
export const protectedProcedure = t.procedure.use(async ({ next, ctx }) => {
  if (!ctx.session?.user?.email) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in" });
  }

  let contributor = await ctx.db.query.contributors.findFirst({
    where: eq(contributors.email, ctx.session.user.email.toLowerCase()),
  });

  if (!contributor) {
    const name = ctx.session.user.name ?? ctx.session.user.email.split("@")[0]!;
    const id = await generateUniqueId(ctx.db, contributors, contributors.id, name);
    const [created] = await ctx.db
      .insert(contributors)
      .values({
        id,
        name,
        email: ctx.session.user.email.toLowerCase(),
        image: ctx.session.user.image ?? undefined,
      })
      .returning();
    contributor = created!;
  }

  return next({
    ctx: {
      session: ctx.session,
      contributor,
    },
  });
});

/** Admin: requires admin email */
export const adminProcedure = protectedProcedure.use(async ({ next, ctx }) => {
  if (!isAdmin(ctx.session.user.email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Must be an admin",
    });
  }
  return next({ ctx });
});

/** Sanitize raw input for session event logging — truncate long strings, strip content */
function sanitizeInput(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key === "content") continue; // too large
    if (typeof value === "string" && value.length > 1000) {
      result[key] = value.slice(0, 1000) + "...(truncated)";
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** API key procedure for MCP/agent access — also logs session events if X-Session-Id is present */
export const apiKeyProcedure = t.procedure.use(async ({ next, ctx, path, getRawInput }) => {
  const authHeader = ctx.headers.get("authorization");
  if (!authHeader) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing Authorization header",
    });
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid Authorization header format. Expected: Bearer <token>",
    });
  }

  const keyHash = crypto.createHash("sha256").update(token).digest("hex");
  const contributor = await ctx.db.query.contributors.findFirst({
    where: eq(contributors.apiKey, keyHash),
  });

  if (!contributor) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid API key",
    });
  }

  // Read session ID from header
  const sessionId = ctx.headers.get("x-session-id");
  let validSessionId: string | null = null;

  if (sessionId) {
    // Validate session: exists, belongs to contributor, is active, <24h old
    const session = await ctx.db.query.researchSessions.findFirst({
      where: and(
        eq(researchSessions.id, sessionId),
        eq(researchSessions.contributorId, contributor.id),
        eq(researchSessions.status, "active"),
      ),
    });

    if (session) {
      const ageMs = Date.now() - new Date(session.createdAt).getTime();
      if (ageMs < 24 * 60 * 60 * 1000) {
        validSessionId = sessionId;
      }
    }
  }

  const start = Date.now();
  const result = await next({
    ctx: {
      contributor,
      sessionId: validSessionId,
    },
  });

  // Fire-and-forget: log session event if session is active
  // Skip logging session router calls to avoid recursive logging
  if (validSessionId && !path.startsWith("sessions.")) {
    const durationMs = Date.now() - start;
    getRawInput()
      .then((rawInput) =>
        ctx.db
          .insert(sessionEvents)
          .values({
            id: activityId("evt", validSessionId),
            sessionId: validSessionId,
            procedure: path,
            input: sanitizeInput(rawInput),
            durationMs,
          }),
      )
      .catch(() => {
        // Silently ignore event logging failures
      });
  }

  return result;
});

/** Karma-gated procedure: requires API key + positive karma balance */
export const karmaGatedProcedure = apiKeyProcedure.use(async ({ next, ctx }) => {
  if (ctx.contributor.karma <= 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Insufficient karma. Contribute to earn karma before querying.",
    });
  }
  return next({ ctx });
});

/** Evaluator procedure: requires API key + autonomous trust level */
export const evaluatorProcedure = apiKeyProcedure.use(async ({ next, ctx }) => {
  if (ctx.contributor.trustLevel !== "autonomous") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Evaluator actions require autonomous trust level",
    });
  }
  return next({ ctx });
});

/** Evaluator agent: requires API key + trusted or autonomous trust level */
export const evaluatorAgentProcedure = apiKeyProcedure.use(async ({ next, ctx }) => {
  if (ctx.contributor.trustLevel !== "trusted" && ctx.contributor.trustLevel !== "autonomous") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Evaluation requires trusted or autonomous trust level",
    });
  }
  return next({ ctx });
});
