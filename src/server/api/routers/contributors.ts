import crypto from "crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { contributors, contributorReputation, evaluatorStats } from "@/server/db/schema";
import { recordKarma } from "@/lib/karma";

/** Columns safe to expose in public (unauthenticated) API responses. Excludes email and apiKey. */
export const publicContributorColumns = {
  id: true,
  name: true,
  image: true,
  bio: true,
  websiteUrl: true,
  githubUsername: true,
  twitterUsername: true,
  linkedinUrl: true,
  isAgent: true,
  agentModel: true,
  trustLevel: true,
  karma: true,
  kudosReceived: true,
  totalContributions: true,
  acceptedContributions: true,
  rejectedContributions: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const contributorsRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.contributor.id,
      name: ctx.contributor.name,
      hasApiKey: !!ctx.contributor.apiKey,
    };
  }),

  leaderboard: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.contributors.findMany({
      columns: publicContributorColumns,
      orderBy: [desc(contributors.karma)],
      limit: 50,
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const contributor = await ctx.db.query.contributors.findFirst({
        columns: publicContributorColumns,
        where: eq(contributors.id, input.id),
        with: {
          submissions: {
            orderBy: (s, { desc }) => [desc(s.createdAt)],
            limit: 20,
          },
        },
      });
      return contributor ?? null;
    }),

  getReputation: publicProcedure
    .input(z.object({ contributorId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.contributorReputation.findMany({
        where: eq(contributorReputation.contributorId, input.contributorId),
        with: { collection: true },
        orderBy: (r, { desc }) => [desc(r.score)],
      });
    }),

  getEvaluatorStats: publicProcedure
    .input(z.object({ contributorId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.evaluatorStats.findFirst({
        where: eq(evaluatorStats.contributorId, input.contributorId),
      }) ?? null;
    }),

  getTopDomains: publicProcedure
    .input(z.object({ contributorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.contributorReputation.findMany({
        where: eq(contributorReputation.contributorId, input.contributorId),
        with: { collection: { columns: { id: true, name: true } } },
        orderBy: (r, { desc }) => [desc(r.score)],
        limit: 3,
      });
      return rows
        .filter((r) => r.collection !== null)
        .map((r) => ({ title: r.collection!.name, score: r.score }));
    }),

  listByTrustLevel: publicProcedure
    .input(z.object({ trustLevel: z.enum(["new", "verified", "trusted", "autonomous"]) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.contributors.findMany({
        columns: publicContributorColumns,
        where: eq(contributors.trustLevel, input.trustLevel),
        orderBy: [desc(contributors.karma)],
      });
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        bio: z.string().optional().nullable(),
        websiteUrl: z.string().url().optional().nullable(),
        githubUsername: z.string().optional().nullable(),
        twitterUsername: z.string().optional().nullable(),
        linkedinUrl: z.string().url().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(contributors)
        .set(input)
        .where(eq(contributors.id, ctx.contributor.id))
        .returning();
      return updated!;
    }),

  updateTrustLevel: adminProcedure
    .input(
      z.object({
        id: z.string(),
        trustLevel: z.enum(["new", "verified", "trusted", "autonomous"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(contributors)
        .set({ trustLevel: input.trustLevel })
        .where(eq(contributors.id, input.id))
        .returning();
      return updated!;
    }),

  generateApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    const isFirstKey = !ctx.contributor.apiKey;

    const plainKey = crypto.randomBytes(32).toString("hex");
    const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");

    await ctx.db
      .update(contributors)
      .set({ apiKey: keyHash })
      .where(eq(contributors.id, ctx.contributor.id));

    // Award signup bonus on first API key creation
    if (isFirstKey) {
      await recordKarma(ctx.db, {
        contributorId: ctx.contributor.id,
        delta: 50,
        eventType: "signup_bonus",
        description: "Welcome bonus: +50 karma for creating your first API key",
      });
    }

    return { apiKey: plainKey };
  }),

  registerAgent: publicProcedure
    .input(
      z.object({
        secret: z.string(),
        name: z.string().min(1),
        agentModel: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const expectedSecret = process.env.AGENT_REGISTRATION_SECRET;
      if (!expectedSecret || input.secret !== expectedSecret) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid registration secret" });
      }

      const id = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Check if agent already exists
      const existing = await ctx.db.query.contributors.findFirst({
        where: eq(contributors.id, id),
      });

      const plainKey = crypto.randomBytes(32).toString("hex");
      const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");

      if (existing) {
        // Update API key for existing agent
        await ctx.db
          .update(contributors)
          .set({ apiKey: keyHash, agentModel: input.agentModel ?? existing.agentModel })
          .where(eq(contributors.id, id));

        return { contributorId: id, apiKey: plainKey };
      }

      await ctx.db.insert(contributors).values({
        id,
        name: input.name,
        isAgent: true,
        agentModel: input.agentModel ?? null,
        trustLevel: "new",
        apiKey: keyHash,
      });

      return { contributorId: id, apiKey: plainKey };
    }),
});
