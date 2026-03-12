import crypto from "crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { env } from "@/env";
import { isAdmin } from "@/lib/auth";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import {
  topics,
  resources,
  bounties,
  contributors,
  submissions,
  edges,
  topicResources,
  topicTags,
  activity,
} from "@/server/db/schema";

export const adminRouter = createTRPCRouter({
  isAdmin: publicProcedure.query(({ ctx }) => {
    return isAdmin(ctx.session?.user?.email);
  }),

  getStats: publicProcedure.query(async ({ ctx }) => {
    const [topicCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(topics);
    const [resourceCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(resources);
    const [bountyCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(bounties);
    const [agentCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(contributors);
    const [submissionCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(submissions);

    return {
      topics: topicCount?.count ?? 0,
      resources: resourceCount?.count ?? 0,
      bounties: bountyCount?.count ?? 0,
      agents: agentCount?.count ?? 0,
      submissions: submissionCount?.count ?? 0,
    };
  }),

  listPendingSubmissions: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.query.submissions.findMany({
      where: inArray(submissions.status, ["pending", "revision_requested"]),
      with: { contributor: true, bounty: true },
      orderBy: (s, { asc }) => [asc(s.createdAt)],
      limit: 50,
    });
  }),

  reviewSubmission: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["approved", "rejected", "revision_requested"]),
        reviewNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(submissions)
        .set({
          status: input.status,
          reviewNotes: input.reviewNotes,
          reviewedAt: new Date(),
        })
        .where(eq(submissions.id, input.id))
        .returning();
      return updated!;
    }),

  listAllContributors: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.query.contributors.findMany({
      orderBy: [desc(contributors.createdAt)],
    });
  }),

  createContributor: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        isAgent: z.boolean().default(true),
        agentModel: z.string().optional(),
        trustLevel: z.enum(["new", "verified", "trusted", "autonomous"]).default("new"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const plainKey = crypto.randomBytes(32).toString("hex");
      const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");

      await ctx.db.insert(contributors).values({
        id,
        name: input.name,
        isAgent: input.isAgent,
        agentModel: input.agentModel ?? null,
        trustLevel: input.trustLevel,
        apiKey: keyHash,
      });

      return { contributorId: id, apiKey: plainKey };
    }),

  generateApiKeyFor: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plainKey = crypto.randomBytes(32).toString("hex");
      const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");

      await ctx.db
        .update(contributors)
        .set({ apiKey: keyHash })
        .where(eq(contributors.id, input.id));

      return { apiKey: plainKey };
    }),

  deleteContributor: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(contributors).where(eq(contributors.id, input.id));
      return { success: true };
    }),

  deleteTopic: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Delete related records first (no cascade on these FKs)
      await ctx.db.delete(topicResources).where(eq(topicResources.topicId, input.id));
      await ctx.db.delete(topicTags).where(eq(topicTags.topicId, input.id));
      await ctx.db.delete(edges).where(eq(edges.sourceTopicId, input.id));
      await ctx.db.delete(edges).where(eq(edges.targetTopicId, input.id));
      await ctx.db.delete(activity).where(eq(activity.topicId, input.id));
      await ctx.db.delete(topics).where(eq(topics.id, input.id));
      return { success: true };
    }),

  deduplicateTopics: adminProcedure.mutation(async ({ ctx }) => {
    const allTopics = await ctx.db.query.topics.findMany({
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });

    // Group by title — duplicates have same title but suffixed IDs
    const byTitle = new Map<string, typeof allTopics>();
    for (const t of allTopics) {
      const group = byTitle.get(t.title) ?? [];
      group.push(t);
      byTitle.set(t.title, group);
    }

    const removed: string[] = [];
    for (const [, group] of byTitle) {
      if (group.length <= 1) continue;
      // Keep the first (oldest), remove the rest
      for (const dup of group.slice(1)) {
        await ctx.db.delete(topicResources).where(eq(topicResources.topicId, dup.id));
        await ctx.db.delete(topicTags).where(eq(topicTags.topicId, dup.id));
        await ctx.db.delete(edges).where(eq(edges.sourceTopicId, dup.id));
        await ctx.db.delete(edges).where(eq(edges.targetTopicId, dup.id));
        await ctx.db.delete(activity).where(eq(activity.topicId, dup.id));
        await ctx.db.delete(topics).where(eq(topics.id, dup.id));
        removed.push(dup.id);
      }
    }

    return { removed, count: removed.length };
  }),

  launchScoutBatch: adminProcedure
    .input(
      z.object({
        count: z.number().min(1).max(50).default(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!env.SCOUT_WORKER_URL || !env.SCOUT_WORKER_SECRET) {
        throw new Error("SCOUT_WORKER_URL and SCOUT_WORKER_SECRET must be configured");
      }

      const baseUrl = env.NEXT_PUBLIC_URL;
      const scouts: Array<{ id: string; apiKey: string; baseUrl: string }> = [];

      for (let i = 1; i <= input.count; i++) {
        const scoutId = `scout-${i}`;
        const scoutName = `Scout ${i}`;

        // Upsert scout contributor
        const existing = await ctx.db.query.contributors.findFirst({
          where: eq(contributors.id, scoutId),
        });

        const plainKey = `ol_scout_${crypto.randomBytes(24).toString("hex")}`;
        const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");

        if (existing) {
          await ctx.db
            .update(contributors)
            .set({
              name: scoutName,
              isAgent: true,
              trustLevel: "verified",
              agentModel: "claude-sonnet-4-6",
              apiKey: keyHash,
            })
            .where(eq(contributors.id, scoutId));
        } else {
          await ctx.db.insert(contributors).values({
            id: scoutId,
            name: scoutName,
            isAgent: true,
            trustLevel: "verified",
            agentModel: "claude-sonnet-4-6",
            apiKey: keyHash,
          });
        }

        scouts.push({ id: scoutId, apiKey: plainKey, baseUrl });
      }

      const batchId = `batch-${Date.now()}`;

      // Call the scout worker
      const res = await fetch(`${env.SCOUT_WORKER_URL}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.SCOUT_WORKER_SECRET}`,
        },
        body: JSON.stringify({ batchId, scouts }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Scout worker returned ${res.status}: ${text}`);
      }

      return { batchId, count: input.count };
    }),
});
