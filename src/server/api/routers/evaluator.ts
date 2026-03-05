import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  evaluatorProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import {
  submissions,
  resources,
  claims,
  claimPositions,
  contributors,
  bounties,
  activity,
  topics,
} from "@/server/db/schema";

export const evaluatorRouter = createTRPCRouter({
  // ─── Queries (for evaluator script) ───────────────────────────────────

  listPendingSubmissions: evaluatorProcedure
    .input(z.object({ type: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(submissions.status, "pending")];
      if (input?.type) {
        conditions.push(eq(submissions.type, input.type as any));
      }
      return ctx.db.query.submissions.findMany({
        where: and(...conditions),
        with: { contributor: true },
        orderBy: (s, { asc }) => [asc(s.createdAt)],
        limit: 20,
      });
    }),

  listUnscoredResources: evaluatorProcedure.query(async ({ ctx }) => {
    return ctx.db.query.resources.findMany({
      where: and(
        eq(resources.visibility, "public"),
        eq(resources.score, 0),
      ),
      limit: 20,
    });
  }),

  listContestedClaims: evaluatorProcedure
    .input(
      z.object({ minPositions: z.number().int().default(2) }).optional(),
    )
    .query(async ({ ctx }) => {
      return ctx.db.query.claims.findMany({
        where: eq(claims.status, "contested"),
        with: {
          positions: {
            with: { contributor: true },
          },
        },
        limit: 10,
      });
    }),

  // ─── Mutations (called by evaluator script) ───────────────────────────

  reviewSubmission: evaluatorProcedure
    .input(
      z.object({
        submissionId: z.string(),
        approved: z.boolean(),
        reasoning: z.string(),
        reputationDelta: z.number().int().optional(),
        evaluationTrace: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(submissions)
        .set({
          status: input.approved ? "approved" : "rejected",
          reviewReasoning: input.reasoning,
          reviewedByContributorId: ctx.contributor.id,
          reputationDelta: input.reputationDelta,
          reviewedAt: new Date(),
        })
        .where(eq(submissions.id, input.submissionId))
        .returning();

      if (updated?.contributorId) {
        const field = input.approved
          ? contributors.acceptedContributions
          : contributors.rejectedContributions;
        await ctx.db
          .update(contributors)
          .set({
            totalContributions: sql`${contributors.totalContributions} + 1`,
            [input.approved
              ? "acceptedContributions"
              : "rejectedContributions"]: sql`${field} + 1`,
          })
          .where(eq(contributors.id, updated.contributorId));

        if (input.reputationDelta) {
          await ctx.db
            .update(contributors)
            .set({
              karma: sql`${contributors.karma} + ${input.reputationDelta}`,
            })
            .where(eq(contributors.id, updated.contributorId));
        }
      }

      // Log activity with full evaluation trace
      await ctx.db.insert(activity).values({
        type: "submission_reviewed",
        contributorId: ctx.contributor.id,
        submissionId: input.submissionId,
        description: `Submission ${input.approved ? "approved" : "rejected"}: ${input.reasoning.slice(0, 100)}`,
        data: input.evaluationTrace
          ? (input.evaluationTrace as Record<string, unknown>)
          : undefined,
      });

      return updated!;
    }),

  scoreResource: evaluatorProcedure
    .input(
      z.object({
        resourceId: z.string(),
        score: z.number().int().min(0).max(100),
        evaluationTrace: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(resources)
        .set({ score: input.score })
        .where(eq(resources.id, input.resourceId))
        .returning();

      // Log activity with trace
      if (input.evaluationTrace) {
        await ctx.db.insert(activity).values({
          type: "submission_reviewed",
          contributorId: ctx.contributor.id,
          resourceId: input.resourceId,
          description: `Resource scored ${input.score}/100: ${(input.evaluationTrace as any).resourceName ?? updated?.name ?? "unknown"}`,
          data: input.evaluationTrace as Record<string, unknown>,
        });
      }

      return updated!;
    }),

  resolveClaim: evaluatorProcedure
    .input(
      z.object({
        claimId: z.string(),
        resolution: z.enum(["resolved_true", "resolved_false"]),
        resolutionNote: z.string(),
        evaluationTrace: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.db.query.claims.findFirst({
        where: eq(claims.id, input.claimId),
        with: { positions: true },
      });

      if (!claim) throw new Error("Claim not found");

      const [updated] = await ctx.db
        .update(claims)
        .set({
          status: input.resolution,
          resolvedAt: new Date(),
          resolutionNote: input.resolutionNote,
          confidence: input.resolution === "resolved_true" ? 1.0 : 0.0,
        })
        .where(eq(claims.id, input.claimId))
        .returning();

      const winningPosition =
        input.resolution === "resolved_true" ? "support" : "oppose";

      for (const pos of claim.positions) {
        const won = pos.position === winningPosition;
        const delta = won ? pos.stakeAmount : -pos.stakeAmount;

        await ctx.db
          .update(claimPositions)
          .set({
            outcome: won ? "won" : "lost",
            reputationDelta: delta,
          })
          .where(eq(claimPositions.id, pos.id));

        await ctx.db
          .update(contributors)
          .set({
            karma: sql`${contributors.karma} + ${delta}`,
          })
          .where(eq(contributors.id, pos.contributorId));
      }

      // Log activity with evaluation trace
      await ctx.db.insert(activity).values({
        type: "claim_resolved",
        contributorId: ctx.contributor.id,
        claimId: input.claimId,
        description: `Claim resolved as ${input.resolution === "resolved_true" ? "TRUE" : "FALSE"}: "${claim.title}"`,
        data: input.evaluationTrace
          ? (input.evaluationTrace as Record<string, unknown>)
          : undefined,
      });

      return updated!;
    }),

  postBounty: evaluatorProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        type: z.enum(["topic", "resource", "edit"]),
        topicSlug: z.string().optional(),
        karmaReward: z.number().int().min(1).default(15),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let topicId: string | undefined;
      if (input.topicSlug) {
        const topic = await ctx.db.query.topics.findFirst({
          where: eq(topics.slug, input.topicSlug),
        });
        topicId = topic?.id;
      }

      const [bounty] = await ctx.db
        .insert(bounties)
        .values({
          title: input.title,
          description: input.description,
          type: input.type,
          topicId,
          karmaReward: input.karmaReward,
          status: "open",
        })
        .returning();

      return bounty!;
    }),

  recalculateReputation: evaluatorProcedure.mutation(async ({ ctx }) => {
    const allContributors = await ctx.db.query.contributors.findMany({
      with: { submissions: true },
    });

    for (const contrib of allContributors) {
      const accepted = contrib.submissions.filter(
        (s) => s.status === "approved",
      ).length;
      const rejected = contrib.submissions.filter(
        (s) => s.status === "rejected",
      ).length;

      await ctx.db
        .update(contributors)
        .set({
          totalContributions: accepted + rejected,
          acceptedContributions: accepted,
          rejectedContributions: rejected,
        })
        .where(eq(contributors.id, contrib.id));
    }

    return { recalculated: allContributors.length };
  }),

  // ─── Dashboard Queries (public, for /evaluator page) ──────────────────

  getEvaluationFeed: publicProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(30),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      // Get all activity entries that have evaluation trace data
      return ctx.db.query.activity.findMany({
        where: sql`${activity.data} IS NOT NULL AND ${activity.data}->>'type' IS NOT NULL`,
        with: {
          contributor: true,
          topic: true,
          claim: true,
          resource: true,
          submission: true,
        },
        orderBy: [desc(activity.createdAt)],
        limit: input?.limit ?? 30,
      });
    }),

  getEvaluationStats: publicProcedure.query(async ({ ctx }) => {
    // Count evaluations by type from activity data
    const allEvals = await ctx.db.query.activity.findMany({
      where: sql`${activity.data} IS NOT NULL AND ${activity.data}->>'type' IS NOT NULL`,
      orderBy: [desc(activity.createdAt)],
    });

    const stats = {
      total: allEvals.length,
      expansionReviews: 0,
      resourceScores: 0,
      claimResolutions: 0,
      approvals: 0,
      rejections: 0,
      avgResourceScore: 0,
      avgDurationMs: 0,
      totalDurationMs: 0,
    };

    let resourceScoreSum = 0;
    let resourceScoreCount = 0;

    for (const e of allEvals) {
      const data = e.data as Record<string, unknown> | null;
      if (!data) continue;

      const durationMs = (data.durationMs as number) ?? 0;
      stats.totalDurationMs += durationMs;

      switch (data.type) {
        case "expansion_review":
          stats.expansionReviews++;
          if (data.verdict === "approve") stats.approvals++;
          else stats.rejections++;
          break;
        case "resource_score":
          stats.resourceScores++;
          resourceScoreSum += (data.score as number) ?? 0;
          resourceScoreCount++;
          break;
        case "claim_resolution":
          stats.claimResolutions++;
          break;
      }
    }

    stats.avgResourceScore =
      resourceScoreCount > 0
        ? Math.round(resourceScoreSum / resourceScoreCount)
        : 0;
    stats.avgDurationMs =
      stats.total > 0 ? Math.round(stats.totalDurationMs / stats.total) : 0;

    return stats;
  }),
});
