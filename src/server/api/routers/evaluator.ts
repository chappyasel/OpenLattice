import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { iconSchema } from "@/lib/phosphor-icons";
import {
  createTRPCRouter,
  apiKeyProcedure,
  evaluatorProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import {
  submissions,
  resources,
  topicResources,
  contributors,
  bounties,
  activity,
  topics,
  tags,
} from "@/server/db/schema";
import { activityId, generateUniqueId } from "@/lib/utils";
import { applyExpansion } from "./expansions";
import { publicContributorColumns } from "./contributors";

// Shared helper: complete bounty for an approved submission
async function completeBountyForSubmission(db: any, updated: any) {
  if (!updated.bountyId || !updated.contributorId) return;

  const bounty = await db.query.bounties.findFirst({
    where: and(
      eq(bounties.id, updated.bountyId),
      inArray(bounties.status, ["open", "claimed"]),
    ),
  });

  if (!bounty) return;

  await db
    .update(bounties)
    .set({
      status: "completed",
      completedById: updated.contributorId,
    })
    .where(
      and(eq(bounties.id, bounty.id), inArray(bounties.status, ["open", "claimed"])),
    );

  await db
    .update(contributors)
    .set({
      karma: sql`${contributors.karma} + ${bounty.karmaReward}`,
    })
    .where(eq(contributors.id, updated.contributorId));

  await db.insert(activity).values({
    id: activityId("bounty-completed", updated.contributorId),
    type: "bounty_completed",
    contributorId: updated.contributorId,
    description: `Bounty completed: "${bounty.title}" (+${bounty.karmaReward} karma)`,
  });
}

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
        limit: 50,
      });
    }),

  listUnscoredResources: evaluatorProcedure.query(async ({ ctx }) => {
    return ctx.db.query.resources.findMany({
      where: and(
        eq(resources.visibility, "public"),
        eq(resources.score, 0),
      ),
      limit: 50,
    });
  }),

  // ─── Mutations (called by evaluator script) ───────────────────────────

  reviewSubmission: evaluatorProcedure
    .input(
      z.object({
        submissionId: z.string(),
        verdict: z.enum(["approved", "rejected", "revision_requested"]),
        reasoning: z.string(),
        reputationDelta: z.number().int().optional(),
        evaluationTrace: z.record(z.unknown()).optional(),
        resolvedTags: z.array(z.string()).optional(),
        resolvedEdges: z.array(z.object({
          targetTopicSlug: z.string(),
          relationType: z.enum(["related", "prerequisite", "subtopic", "see_also"]),
        })).optional(),
        icon: z.string().optional(),
        iconHue: z.number().int().min(0).max(360).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Only update if still pending (prevents double-review race condition)
      const [updated] = await ctx.db
        .update(submissions)
        .set({
          status: input.verdict,
          reviewReasoning: input.reasoning,
          reviewedByContributorId: ctx.contributor.id,
          reputationDelta: input.reputationDelta,
          reviewedAt: new Date(),
        })
        .where(and(eq(submissions.id, input.submissionId), eq(submissions.status, "pending")))
        .returning();

      if (!updated) return null; // Already reviewed by another evaluator cycle

      if (updated?.contributorId) {
        // Only increment contribution counters for final verdicts (not revision requests)
        if (input.verdict !== "revision_requested") {
          const field = input.verdict === "approved"
            ? contributors.acceptedContributions
            : contributors.rejectedContributions;
          await ctx.db
            .update(contributors)
            .set({
              totalContributions: sql`${contributors.totalContributions} + 1`,
              [input.verdict === "approved"
                ? "acceptedContributions"
                : "rejectedContributions"]: sql`${field} + 1`,
            })
            .where(eq(contributors.id, updated.contributorId));
        }

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
      const verdictLabel = input.verdict === "revision_requested" ? "revision requested" : input.verdict;
      await ctx.db.insert(activity).values({
        id: activityId("submission-reviewed", ctx.contributor.id),
        type: "submission_reviewed",
        contributorId: ctx.contributor.id,
        submissionId: input.submissionId,
        description: `Submission ${verdictLabel}: ${input.reasoning.slice(0, 100)}`,
        data: input.evaluationTrace
          ? (input.evaluationTrace as Record<string, unknown>)
          : null,
      });

      // Materialize expansion into graph if approved
      let createdTopicId: string | null = null;
      if (input.verdict === "approved" && (updated?.type === "expansion" || updated?.type === "bounty_response")) {
        const expansionData = updated.data as any;
        if (expansionData?.topic?.title && expansionData?.topic?.content) {
          try {
            const expansionResult = await applyExpansion(ctx.db, updated.id, expansionData, updated.contributorId, input.resolvedTags, input.resolvedEdges, input.icon && input.iconHue != null ? { icon: input.icon, iconHue: input.iconHue } : undefined);
            createdTopicId = expansionResult?.topicId ?? null;
          } catch (applyError: any) {
            // Mark as rejected so it doesn't get re-evaluated in an infinite loop
            await ctx.db
              .update(submissions)
              .set({
                status: "rejected",
                reviewReasoning: `Approved but failed to apply: ${applyError.message?.slice(0, 200)}`,
                reviewedByContributorId: ctx.contributor.id,
                reviewedAt: new Date(),
              })
              .where(eq(submissions.id, input.submissionId));

            await ctx.db.insert(activity).values({
              id: activityId("apply-expansion-failed", input.submissionId),
              type: "submission_reviewed",
              contributorId: ctx.contributor.id,
              submissionId: input.submissionId,
              description: `applyExpansion failed, rejected: ${applyError.message?.slice(0, 150)}`,
            });

            return { submission: { ...updated, status: "rejected" }, topicId: null };
          }

          // If this expansion was responding to a bounty, complete it
          await completeBountyForSubmission(ctx.db, updated);
        }
      }

      // Materialize resource submission into graph if approved
      if (input.verdict === "approved" && updated?.type === "resource") {
        const resData = updated.data as any;
        if (resData?.name && resData?.type) {
          const resId = await generateUniqueId(
            ctx.db,
            resources,
            resources.id,
            resData.name,
          );
          const [resource] = await ctx.db
            .insert(resources)
            .values({
              id: resId,
              name: resData.name,
              url: resData.url ?? null,
              type: resData.type,
              summary: resData.summary ?? "",
              visibility: "public",
              submittedById: updated.contributorId,
            })
            .returning();

          if (resource) {
            // Link to topic if specified
            if (resData.topicSlug) {
              const topic = await ctx.db.query.topics.findFirst({
                where: eq(topics.id, resData.topicSlug),
              });
              if (topic) {
                await ctx.db
                  .insert(topicResources)
                  .values({
                    id: `${topic.id}--${resource.id}`,
                    topicId: topic.id,
                    resourceId: resource.id,
                    addedById: updated.contributorId,
                  })
                  .onConflictDoNothing();
              }
            }

            await ctx.db.insert(activity).values({
              id: activityId("resource-submitted", resId),
              type: "resource_submitted",
              contributorId: updated.contributorId,
              resourceId: resource.id,
              description: `Resource created: "${resData.name}"`,
            });
          }

          // Complete bounty if this resource submission was responding to one
          await completeBountyForSubmission(ctx.db, updated);
        }
      }

      return { submission: updated, topicId: createdTopicId };
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
      // Build reviewNotes from evaluation trace if available
      const trace = input.evaluationTrace as Record<string, unknown> | undefined;
      const reviewNotes = trace?.reasoning
        ? String(trace.reasoning)
        : undefined;

      const [updated] = await ctx.db
        .update(resources)
        .set({
          score: input.score,
          ...(reviewNotes ? { reviewNotes } : {}),
        })
        .where(eq(resources.id, input.resourceId))
        .returning();

      // Log activity with trace
      if (input.evaluationTrace) {
        await ctx.db.insert(activity).values({
          id: activityId("resource-scored", input.resourceId),
          type: "submission_reviewed",
          contributorId: ctx.contributor.id,
          resourceId: input.resourceId,
          description: `Resource scored ${input.score}/100: ${(input.evaluationTrace as any).resourceName ?? updated?.name ?? "unknown"}`,
          data: input.evaluationTrace as Record<string, unknown>,
        });
      }

      return updated!;
    }),

  resubmitRevision: apiKeyProcedure
    .input(
      z.object({
        submissionId: z.string(),
        data: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Only allow resubmission of revision_requested submissions
      const submission = await ctx.db.query.submissions.findFirst({
        where: and(
          eq(submissions.id, input.submissionId),
          eq(submissions.status, "revision_requested"),
        ),
      });

      if (!submission) {
        throw new Error("Submission not found or not in revision_requested status");
      }

      // Verify the contributor owns this submission
      if (submission.contributorId !== ctx.contributor.id) {
        throw new Error("You can only resubmit your own submissions");
      }

      // Update the submission with revised data and reset to pending
      const [updated] = await ctx.db
        .update(submissions)
        .set({
          data: input.data as Record<string, unknown>,
          status: "pending",
          revisionCount: sql`${submissions.revisionCount} + 1`,
          originalSubmissionId: submission.originalSubmissionId ?? submission.id,
          reviewReasoning: null,
          reviewedByContributorId: null,
          reputationDelta: null,
          reviewedAt: null,
        })
        .where(
          and(
            eq(submissions.id, input.submissionId),
            eq(submissions.status, "revision_requested"),
          ),
        )
        .returning();

      if (!updated) return null;

      // Log activity
      await ctx.db.insert(activity).values({
        id: activityId("revision-submitted", ctx.contributor.id),
        type: "submission_reviewed",
        contributorId: ctx.contributor.id,
        submissionId: input.submissionId,
        description: `Revision submitted for "${(input.data as any)?.topic?.title ?? "submission"}" (revision #${updated.revisionCount})`,
      });

      return updated;
    }),

  listRevisionRequested: apiKeyProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.query.submissions.findMany({
        where: and(
          eq(submissions.contributorId, ctx.contributor.id),
          eq(submissions.status, "revision_requested"),
        ),
        orderBy: (s, { desc }) => [desc(s.reviewedAt)],
        limit: input?.limit ?? 20,
      });
    }),

  listMySubmissions: apiKeyProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.query.submissions.findMany({
        where: eq(submissions.contributorId, ctx.contributor.id),
        orderBy: (s, { desc: d }) => [d(s.createdAt)],
        limit: input?.limit ?? 20,
      });
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
          where: eq(topics.id, input.topicSlug),
        });
        topicId = topic?.id;
      }

      // Dedup: check for existing open/claimed bounty with same topicId + type
      if (topicId) {
        const existing = await ctx.db.query.bounties.findFirst({
          where: and(
            eq(bounties.topicId, topicId),
            eq(bounties.type, input.type),
            inArray(bounties.status, ["open", "claimed"]),
          ),
        });
        if (existing) return existing;
      }

      // Dedup: for "topic" bounties, check if a topic with this title already exists
      if (input.type === "topic") {
        // Strip common bounty title prefixes to get the actual topic name
        const topicName = input.title
          .replace(/^Create (root topic|subtopic): /i, "")
          .replace(/^Expand: /i, "")
          .trim();
        const existingTopic = await ctx.db.query.topics.findFirst({
          where: sql`LOWER(${topics.title}) = ${topicName.toLowerCase()}`,
        });
        if (existingTopic) return null; // Topic already exists, skip
      }

      // Dedup: check for existing open/claimed bounty with similar title
      const existingByTitle = await ctx.db.query.bounties.findFirst({
        where: and(
          sql`LOWER(${bounties.title}) = ${input.title.toLowerCase()}`,
          inArray(bounties.status, ["open", "claimed"]),
        ),
      });
      if (existingByTitle) return existingByTitle;

      const id = await generateUniqueId(ctx.db, bounties, bounties.id, input.title);
      const [bounty] = await ctx.db
        .insert(bounties)
        .values({
          id,
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

  completeBounty: evaluatorProcedure
    .input(
      z.object({
        bountyId: z.string(),
        contributorId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Only complete if bounty is still open (handles race conditions)
      const bounty = await ctx.db.query.bounties.findFirst({
        where: and(
          eq(bounties.id, input.bountyId),
          eq(bounties.status, "open"),
        ),
      });

      if (!bounty) return null;

      const [updated] = await ctx.db
        .update(bounties)
        .set({
          status: "completed",
          completedById: input.contributorId,
        })
        .where(
          and(eq(bounties.id, input.bountyId), eq(bounties.status, "open")),
        )
        .returning();

      if (updated) {
        // Award karma to the contributor
        await ctx.db
          .update(contributors)
          .set({
            karma: sql`${contributors.karma} + ${bounty.karmaReward}`,
          })
          .where(eq(contributors.id, input.contributorId));

        await ctx.db.insert(activity).values({
          id: activityId("bounty-completed", input.contributorId),
          type: "bounty_completed",
          contributorId: input.contributorId,
          description: `Bounty completed: "${bounty.title}" (+${bounty.karmaReward} karma)`,
        });
      }

      return updated ?? null;
    }),

  setTopicIcon: evaluatorProcedure
    .input(
      z.object({
        topicId: z.string(),
        icon: iconSchema.nullable(),
        iconHue: z.number().int().min(0).max(360).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(topics)
        .set({ icon: input.icon ?? undefined, iconHue: input.iconHue ?? undefined })
        .where(eq(topics.id, input.topicId))
        .returning();
      return updated!;
    }),

  setTagIcon: evaluatorProcedure
    .input(
      z.object({
        tagId: z.string(),
        icon: iconSchema.nullable(),
        iconHue: z.number().int().min(0).max(360).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tags)
        .set({ icon: input.icon ?? undefined, iconHue: input.iconHue ?? undefined })
        .where(eq(tags.id, input.tagId))
        .returning();
      return updated!;
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
          contributor: { columns: publicContributorColumns },
          topic: true,
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
      approvals: 0,
      rejections: 0,
      revisionRequests: 0,
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
          else if (data.verdict === "revise") stats.revisionRequests++;
          else stats.rejections++;
          break;
        case "resource_score":
          stats.resourceScores++;
          resourceScoreSum += (data.score as number) ?? 0;
          resourceScoreCount++;
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
