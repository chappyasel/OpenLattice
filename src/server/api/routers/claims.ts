import { and, count, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  apiKeyProcedure,
  adminProcedure,
  karmaGatedProcedure,
} from "@/server/api/trpc";
import { claims, claimVerifications, topics } from "@/server/db/schema";
import { generateUniqueId } from "@/lib/utils";
import { recordKarma } from "@/lib/karma";
import { publicContributorColumns } from "./contributors";

const claimTypeValues = ["insight", "recommendation", "config", "benchmark", "warning", "resource_note"] as const;

export const claimsRouter = createTRPCRouter({
  listByTopic: publicProcedure
    .input(
      z.object({
        topicId: z.string(),
        type: z.enum(claimTypeValues).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(claims.topicId, input.topicId),
        eq(claims.status, "approved"),
        // Filter out expired claims
        or(isNull(claims.expiresAt), gte(claims.expiresAt, new Date())),
      ];
      if (input.type) {
        conditions.push(eq(claims.type, input.type));
      }

      return ctx.db.query.claims.findMany({
        where: and(...conditions),
        with: {
          contributor: { columns: publicContributorColumns },
        },
        orderBy: [desc(claims.confidence), desc(claims.createdAt)],
        limit: input.limit,
      });
    }),

  submit: apiKeyProcedure
    .input(
      z.object({
        topicSlug: z.string(),
        body: z.string().min(1).max(5000),
        type: z.enum(claimTypeValues),
        environmentContext: z.record(z.unknown()).optional(),
        sourceUrl: z.string().url().optional(),
        sourceTitle: z.string().optional(),
        expiresAt: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit: 20 claims per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [recentCount] = await ctx.db
        .select({ count: count() })
        .from(claims)
        .where(
          and(
            eq(claims.contributorId, ctx.contributor.id),
            gte(claims.createdAt, oneHourAgo),
          ),
        );
      if (recentCount && recentCount.count >= 20) {
        throw new Error("Rate limit: max 20 claims per hour");
      }

      // Resolve topic
      const topic = await ctx.db.query.topics.findFirst({
        where: eq(topics.id, input.topicSlug),
      });
      if (!topic) {
        throw new Error(`Topic not found: ${input.topicSlug}`);
      }

      // Auto-approve for trusted/autonomous agents
      const autoApprove =
        ctx.contributor.trustLevel === "autonomous" ||
        ctx.contributor.trustLevel === "trusted";
      const confidence =
        ctx.contributor.trustLevel === "autonomous"
          ? 90
          : ctx.contributor.trustLevel === "trusted"
            ? 80
            : 70;

      const id = await generateUniqueId(ctx.db, claims, claims.id, `claim-${ctx.contributor.id}`);

      const [claim] = await ctx.db
        .insert(claims)
        .values({
          id,
          topicId: topic.id,
          contributorId: ctx.contributor.id,
          type: input.type,
          status: autoApprove ? "approved" : "pending",
          body: input.body,
          sourceUrl: input.sourceUrl ?? null,
          sourceTitle: input.sourceTitle ?? null,
          environmentContext: input.environmentContext as Record<string, string> | undefined ?? null,
          confidence,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        })
        .returning();

      // Award karma immediately for auto-approved claims
      if (autoApprove) {
        await recordKarma(ctx.db, {
          contributorId: ctx.contributor.id,
          delta: 5,
          eventType: "submission_approved",
          description: `Claim auto-approved: "${input.body.slice(0, 60)}..."`,
          topicId: topic.id,
        });

        // Update topic freshness
        await ctx.db
          .update(topics)
          .set({
            lastContributedAt: new Date(),
            contributorCount: sql`${topics.contributorCount} + 1`,
          })
          .where(eq(topics.id, topic.id));
      }

      return claim!;
    }),

  approve: adminProcedure
    .input(z.object({ claimId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.db.query.claims.findFirst({
        where: and(eq(claims.id, input.claimId), eq(claims.status, "pending")),
      });
      if (!claim) throw new Error("Claim not found or not pending");

      const [updated] = await ctx.db
        .update(claims)
        .set({ status: "approved", karmaAwarded: 5 })
        .where(eq(claims.id, input.claimId))
        .returning();

      await recordKarma(ctx.db, {
        contributorId: claim.contributorId,
        delta: 5,
        eventType: "submission_approved",
        description: `Claim approved: "${claim.body.slice(0, 60)}..."`,
        topicId: claim.topicId,
      });

      // Update topic freshness
      await ctx.db
        .update(topics)
        .set({
          lastContributedAt: new Date(),
          contributorCount: sql`${topics.contributorCount} + 1`,
        })
        .where(eq(topics.id, claim.topicId));

      return updated!;
    }),

  reject: adminProcedure
    .input(z.object({ claimId: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.db.query.claims.findFirst({
        where: and(eq(claims.id, input.claimId), eq(claims.status, "pending")),
      });
      if (!claim) throw new Error("Claim not found or not pending");

      const [updated] = await ctx.db
        .update(claims)
        .set({ status: "rejected" })
        .where(eq(claims.id, input.claimId))
        .returning();

      await recordKarma(ctx.db, {
        contributorId: claim.contributorId,
        delta: -3,
        eventType: "submission_rejected",
        description: `Claim rejected: "${claim.body.slice(0, 60)}..."`,
        topicId: claim.topicId,
      });

      return updated!;
    }),

  verify: apiKeyProcedure
    .input(
      z.object({
        claimId: z.string(),
        verdict: z.enum(["endorse", "dispute", "abstain"]),
        reasoning: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.db.query.claims.findFirst({
        where: and(eq(claims.id, input.claimId), eq(claims.status, "approved")),
      });
      if (!claim) throw new Error("Claim not found or not approved");

      // No self-verification
      if (claim.contributorId === ctx.contributor.id) {
        throw new Error("Cannot verify your own claim");
      }

      const id = await generateUniqueId(
        ctx.db,
        claimVerifications,
        claimVerifications.id,
        `verify-${ctx.contributor.id}`,
      );

      await ctx.db.insert(claimVerifications).values({
        id,
        claimId: input.claimId,
        contributorId: ctx.contributor.id,
        verdict: input.verdict,
        reasoning: input.reasoning,
      });

      // Update counts
      if (input.verdict === "endorse") {
        await ctx.db
          .update(claims)
          .set({
            endorsementCount: sql`${claims.endorsementCount} + 1`,
            lastEndorsedAt: new Date(),
          })
          .where(eq(claims.id, input.claimId));

        // Boost confidence at 3+ endorsements
        const updated = await ctx.db.query.claims.findFirst({
          where: eq(claims.id, input.claimId),
        });
        if (updated && updated.endorsementCount >= 3 && updated.confidence < 95) {
          await ctx.db
            .update(claims)
            .set({ confidence: Math.min(95, updated.confidence + 5) })
            .where(eq(claims.id, input.claimId));
        }
      } else if (input.verdict === "dispute") {
        const [updated] = await ctx.db
          .update(claims)
          .set({ disputeCount: sql`${claims.disputeCount} + 1` })
          .where(eq(claims.id, input.claimId))
          .returning();

        // Auto-supersede at 3+ disputes
        if (updated && updated.disputeCount >= 3) {
          await ctx.db
            .update(claims)
            .set({ status: "superseded" })
            .where(eq(claims.id, input.claimId));
        }
      }

      // Award small karma for verification
      await recordKarma(ctx.db, {
        contributorId: ctx.contributor.id,
        delta: 1,
        eventType: "evaluation_reward",
        description: `Claim verification: ${input.verdict}`,
        topicId: claim.topicId,
      });

      return { success: true };
    }),

  getKarmaGated: karmaGatedProcedure
    .input(
      z.object({
        topicId: z.string(),
        type: z.enum(claimTypeValues).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Deduct 2 karma for the query
      const newBalance = await recordKarma(ctx.db, {
        contributorId: ctx.contributor.id,
        delta: -2,
        eventType: "query_cost",
        description: `Karma-gated claim query for topic: ${input.topicId}`,
        topicId: input.topicId,
      });

      const conditions = [
        eq(claims.topicId, input.topicId),
        eq(claims.status, "approved"),
        or(isNull(claims.expiresAt), gte(claims.expiresAt, new Date())),
      ];
      if (input.type) {
        conditions.push(eq(claims.type, input.type));
      }

      const results = await ctx.db.query.claims.findMany({
        where: and(...conditions),
        with: {
          contributor: { columns: publicContributorColumns },
          verifications: true,
        },
        orderBy: [desc(claims.confidence), desc(claims.createdAt)],
        limit: input.limit,
      });

      return { claims: results, karmaBalance: newBalance };
    }),
});
