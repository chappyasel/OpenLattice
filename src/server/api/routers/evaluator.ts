import { and, eq, sql, ne } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  evaluatorProcedure,
} from "@/server/api/trpc";
import {
  submissions,
  resources,
  claims,
  claimPositions,
  contributors,
  bounties,
  activity,
  contributorReputation,
  topics,
} from "@/server/db/schema";

export const evaluatorRouter = createTRPCRouter({
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
    .input(z.object({ minPositions: z.number().int().default(2) }).optional())
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

  reviewSubmission: evaluatorProcedure
    .input(
      z.object({
        submissionId: z.string(),
        approved: z.boolean(),
        reasoning: z.string(),
        reputationDelta: z.number().int().optional(),
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
        // Update contributor stats
        const field = input.approved
          ? contributors.acceptedContributions
          : contributors.rejectedContributions;
        await ctx.db
          .update(contributors)
          .set({
            totalContributions: sql`${contributors.totalContributions} + 1`,
            [input.approved ? "acceptedContributions" : "rejectedContributions"]:
              sql`${field} + 1`,
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

      // Log activity
      await ctx.db.insert(activity).values({
        type: "submission_reviewed",
        contributorId: ctx.contributor.id,
        submissionId: input.submissionId,
        description: `Submission ${input.approved ? "approved" : "rejected"}: ${input.reasoning.slice(0, 100)}`,
      });

      return updated!;
    }),

  scoreResource: evaluatorProcedure
    .input(
      z.object({
        resourceId: z.string(),
        score: z.number().int().min(0).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(resources)
        .set({ score: input.score })
        .where(eq(resources.id, input.resourceId))
        .returning();
      return updated!;
    }),

  resolveClaim: evaluatorProcedure
    .input(
      z.object({
        claimId: z.string(),
        resolution: z.enum(["resolved_true", "resolved_false"]),
        resolutionNote: z.string(),
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

      await ctx.db.insert(activity).values({
        type: "claim_resolved",
        contributorId: ctx.contributor.id,
        claimId: input.claimId,
        description: `Claim resolved as ${input.resolution === "resolved_true" ? "TRUE" : "FALSE"}: "${claim.title}"`,
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
    // Get all contributors with submissions
    const allContributors = await ctx.db.query.contributors.findMany({
      with: {
        submissions: true,
      },
    });

    for (const contrib of allContributors) {
      const accepted = contrib.submissions.filter(
        (s) => s.status === "approved",
      ).length;
      const rejected = contrib.submissions.filter(
        (s) => s.status === "rejected",
      ).length;
      const total = accepted + rejected;

      await ctx.db
        .update(contributors)
        .set({
          totalContributions: total,
          acceptedContributions: accepted,
          rejectedContributions: rejected,
        })
        .where(eq(contributors.id, contrib.id));
    }

    return { recalculated: allContributors.length };
  }),
});
