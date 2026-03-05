import crypto from "crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { contributors, contributorReputation } from "@/server/db/schema";

export const contributorsRouter = createTRPCRouter({
  leaderboard: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.contributors.findMany({
      orderBy: [desc(contributors.karma)],
      limit: 50,
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const contributor = await ctx.db.query.contributors.findFirst({
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
        with: { topic: true },
        orderBy: (r, { desc }) => [desc(r.score)],
      });
    }),

  listByTrustLevel: publicProcedure
    .input(z.object({ trustLevel: z.enum(["new", "verified", "trusted", "autonomous"]) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.contributors.findMany({
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
    const plainKey = crypto.randomBytes(32).toString("hex");
    const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");

    await ctx.db
      .update(contributors)
      .set({ apiKey: keyHash })
      .where(eq(contributors.id, ctx.contributor.id));

    return { apiKey: plainKey };
  }),
});
