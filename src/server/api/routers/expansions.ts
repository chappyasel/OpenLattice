import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  apiKeyProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import {
  submissions,
  topics,
  resources,
  topicResources,
  edges,
  claims,
  claimPositions,
  activity,
} from "@/server/db/schema";
import { slugify } from "@/lib/utils";

const expansionSchema = z.object({
  topic: z.object({
    title: z.string().min(1),
    content: z.string().min(100),
    summary: z.string().optional(),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
    parentTopicSlug: z.string().optional(),
  }),
  resources: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().optional(),
        type: z.string(),
        summary: z.string(),
      }),
    )
    .optional()
    .default([]),
  edges: z
    .array(
      z.object({
        targetTopicSlug: z.string(),
        relationType: z.enum(["related", "prerequisite", "subtopic", "see_also"]),
      }),
    )
    .optional()
    .default([]),
  claims: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        stakeAmount: z.number().int().min(1).max(50).default(10),
        evidence: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  bountyId: z.string().optional(),
});

export const expansionsRouter = createTRPCRouter({
  submit: apiKeyProcedure
    .input(expansionSchema)
    .mutation(async ({ ctx, input }) => {
      // If agent is autonomous, auto-apply
      const autoApply = ctx.contributor.trustLevel === "autonomous";

      const [submission] = await ctx.db
        .insert(submissions)
        .values({
          type: "expansion",
          status: autoApply ? "approved" : "pending",
          data: input as unknown as Record<string, unknown>,
          contributorId: ctx.contributor.id,
          agentName: ctx.contributor.name,
          agentModel: ctx.contributor.agentModel,
          source: "mcp",
          bountyId: input.bountyId,
        })
        .returning();

      if (autoApply) {
        await applyExpansion(ctx.db, submission!.id, input, ctx.contributor.id);
      }

      return submission!;
    }),

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.submissions.findMany({
      where: eq(submissions.type, "expansion"),
      with: {
        contributor: true,
      },
      orderBy: (s, { desc }) => [desc(s.createdAt)],
      limit: 50,
    });
  }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.submissions.findFirst({
        where: eq(submissions.id, input.id),
        with: {
          contributor: true,
          bounty: true,
        },
      });
    }),

  approve: adminProcedure
    .input(z.object({ submissionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.query.submissions.findFirst({
        where: eq(submissions.id, input.submissionId),
      });

      if (!submission || submission.type !== "expansion") {
        throw new Error("Submission not found or not an expansion");
      }

      // Mark as approved
      await ctx.db
        .update(submissions)
        .set({ status: "approved", reviewedAt: new Date() })
        .where(eq(submissions.id, input.submissionId));

      await applyExpansion(
        ctx.db,
        input.submissionId,
        submission.data as z.infer<typeof expansionSchema>,
        submission.contributorId,
      );

      return { success: true };
    }),
});

async function applyExpansion(
  db: any,
  submissionId: string,
  data: z.infer<typeof expansionSchema>,
  contributorId: string | null,
) {
  // 1. Find parent topic if specified
  let parentTopicId: string | undefined;
  if (data.topic.parentTopicSlug) {
    const parent = await db.query.topics.findFirst({
      where: eq(topics.slug, data.topic.parentTopicSlug),
    });
    parentTopicId = parent?.id;
  }

  // 2. Create topic
  const topicSlug = slugify(data.topic.title);
  const [topic] = await db
    .insert(topics)
    .values({
      title: data.topic.title,
      slug: topicSlug,
      content: data.topic.content,
      summary: data.topic.summary,
      difficulty: data.topic.difficulty,
      status: "published",
      parentTopicId,
    })
    .onConflictDoNothing()
    .returning();

  if (!topic) return; // Topic already exists

  // Log topic creation
  await db.insert(activity).values({
    type: "topic_created",
    contributorId,
    topicId: topic.id,
    submissionId,
    description: `Topic created: "${data.topic.title}"`,
  });

  // 3. Create resources and link them
  for (const res of data.resources) {
    const resSlug = slugify(res.name);
    const [resource] = await db
      .insert(resources)
      .values({
        name: res.name,
        slug: resSlug,
        url: res.url,
        type: res.type as any,
        summary: res.summary,
        visibility: "public",
        submittedById: contributorId,
      })
      .onConflictDoNothing()
      .returning();

    if (resource) {
      await db
        .insert(topicResources)
        .values({
          topicId: topic.id,
          resourceId: resource.id,
          addedById: contributorId,
        })
        .onConflictDoNothing();

      await db.insert(activity).values({
        type: "resource_submitted",
        contributorId,
        topicId: topic.id,
        resourceId: resource.id,
        description: `Resource added: "${res.name}"`,
      });
    }
  }

  // 4. Create edges
  for (const edge of data.edges) {
    const target = await db.query.topics.findFirst({
      where: eq(topics.slug, edge.targetTopicSlug),
    });
    if (target) {
      await db
        .insert(edges)
        .values({
          sourceTopicId: topic.id,
          targetTopicId: target.id,
          relationType: edge.relationType,
        })
        .onConflictDoNothing();

      await db.insert(activity).values({
        type: "edge_created",
        contributorId,
        topicId: topic.id,
        description: `Edge created: ${topic.title} → ${target.title} (${edge.relationType})`,
      });
    }
  }

  // 5. Create claims
  for (const claimData of data.claims) {
    const claimSlug = slugify(claimData.title);
    const [claim] = await db
      .insert(claims)
      .values({
        title: claimData.title,
        slug: claimSlug,
        description: claimData.description,
        topicId: topic.id,
        stakeAmount: claimData.stakeAmount,
        createdById: contributorId,
      })
      .onConflictDoNothing()
      .returning();

    if (claim && contributorId) {
      await db.insert(claimPositions).values({
        claimId: claim.id,
        contributorId,
        position: "support",
        stakeAmount: claimData.stakeAmount,
        evidence: claimData.evidence,
      });

      await db.insert(activity).values({
        type: "claim_made",
        contributorId,
        claimId: claim.id,
        topicId: topic.id,
        description: `Claim made: "${claimData.title}"`,
      });
    }
  }
}
