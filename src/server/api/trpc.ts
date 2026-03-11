import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import { ZodError } from "zod";
import crypto from "crypto";

import { auth, isAdmin } from "@/lib/auth";
import { generateUniqueId, slugify } from "@/lib/utils";
import { db } from "@/server/db";
import { contributors } from "@/server/db/schema";

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

/** Public (unauthenticated) procedure */
export const publicProcedure = t.procedure;

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

/** API key procedure for MCP/agent access */
export const apiKeyProcedure = t.procedure.use(async ({ next, ctx }) => {
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

  return next({
    ctx: {
      contributor,
    },
  });
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
