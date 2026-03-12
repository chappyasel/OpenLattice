import { and, eq, inArray, isNull, sql, count } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import { edges, tags, topicTags, topicResources, topics } from "@/server/db/schema";
import { generateUniqueId, slugify } from "@/lib/utils";
import { resolveBaseId } from "@/lib/resolve-base";
import { publicContributorColumns } from "./contributors";

export const topicsRouter = createTRPCRouter({
  listTree: publicProcedure
    .input(
      z
        .object({
          parentTopicId: z.string().nullable().optional(),
          baseSlug: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const baseId = await resolveBaseId(ctx.db, input?.baseSlug);

      const conditions = [eq(topics.status, "published")];
      if (input?.parentTopicId === null || !input?.parentTopicId) {
        conditions.push(isNull(topics.parentTopicId));
      } else {
        conditions.push(eq(topics.parentTopicId, input.parentTopicId));
      }
      if (baseId) {
        conditions.push(eq(topics.baseId, baseId));
      }

      return ctx.db
        .select({
          id: topics.id,
          title: topics.title,
          parentTopicId: topics.parentTopicId,
          baseId: topics.baseId,
          icon: topics.icon,
          iconHue: topics.iconHue,
          childCount: sql<number>`(SELECT count(*)::integer FROM topics c WHERE c.parent_topic_id = "topics"."id" AND c.status = 'published')`,
        })
        .from(topics)
        .where(and(...conditions))
        .orderBy(topics.sortOrder, topics.title);
    }),

  listBreadcrumbs: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: topics.id,
        title: topics.title,
        parentTopicId: topics.parentTopicId,
      })
      .from(topics)
      .where(eq(topics.status, "published"));
  }),

  // Lightweight summary for evaluator — no content, no relations
  listSummary: publicProcedure
    .input(
      z
        .object({
          status: z.enum(["draft", "published", "archived"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input?.status) {
        conditions.push(eq(topics.status, input.status));
      }

      return ctx.db
        .select({
          id: topics.id,
          title: topics.title,
          summary: topics.summary,
          parentTopicId: topics.parentTopicId,
          baseId: topics.baseId,
          depth: topics.depth,
          iconHue: topics.iconHue,
          contentLength: sql<number>`length(${topics.content})`,
          resourceCount: sql<number>`(SELECT count(*)::integer FROM topic_resources tr WHERE tr.topic_id = "topics"."id")`,
          childCount: sql<number>`(SELECT count(*)::integer FROM topics c WHERE c.parent_topic_id = "topics"."id" AND c.status = 'published')`,
        })
        .from(topics)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(topics.sortOrder, topics.title);
    }),

  list: publicProcedure
    .input(
      z
        .object({
          status: z.enum(["draft", "published", "archived"]).optional(),
          difficulty: z
            .enum(["beginner", "intermediate", "advanced"])
            .optional(),
          parentTopicId: z.string().optional().nullable(),
          baseSlug: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const baseId = await resolveBaseId(ctx.db, input?.baseSlug);

      const conditions = [];
      if (input?.status) {
        conditions.push(eq(topics.status, input.status));
      }
      if (input?.difficulty) {
        conditions.push(eq(topics.difficulty, input.difficulty));
      }
      if (input?.parentTopicId !== undefined) {
        if (input.parentTopicId === null) {
          conditions.push(isNull(topics.parentTopicId));
        } else {
          conditions.push(eq(topics.parentTopicId, input.parentTopicId));
        }
      }
      if (baseId) {
        conditions.push(eq(topics.baseId, baseId));
      }

      return ctx.db.query.topics.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          topicTags: {
            with: { tag: true },
          },
          topicResources: {
            with: { resource: { columns: { type: true } } },
          },
          childTopics: true,
        },
        orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.title)],
      });
    }),

  suggested: publicProcedure.query(async ({ ctx }) => {
    // Score topics by a mix of content richness, recency, and randomness
    const results = await ctx.db
      .select({
        id: topics.id,
        title: topics.title,
        summary: topics.summary,
        icon: topics.icon,
        iconHue: topics.iconHue,
        updatedAt: topics.updatedAt,
        resourceCount: count(topicResources.id),
      })
      .from(topics)
      .leftJoin(topicResources, eq(topicResources.topicId, topics.id))
      .where(and(
        eq(topics.status, "published"),
        sql`${topics.content} != ''`,
        sql`${topics.summary} IS NOT NULL AND ${topics.summary} != ''`,
      ))
      .groupBy(topics.id)
      .orderBy(
        sql`(
          ${count(topicResources.id)} * 2
          + EXTRACT(EPOCH FROM ${topics.updatedAt}) / 86400
          + random() * 5
        ) DESC`,
      )
      .limit(12);

    if (results.length === 0) return [];

    // Fetch tags for the suggested topics
    const topicIds = results.map((r) => r.id);
    const tagRows = await ctx.db
      .select({
        topicId: topicTags.topicId,
        tagName: tags.name,
        tagIcon: tags.icon,
        tagIconHue: tags.iconHue,
      })
      .from(topicTags)
      .innerJoin(tags, eq(topicTags.tagId, tags.id))
      .where(inArray(topicTags.topicId, topicIds));

    const tagsByTopic = new Map<string, Array<{ name: string; icon: string; iconHue: number }>>();
    for (const row of tagRows) {
      const existing = tagsByTopic.get(row.topicId) ?? [];
      existing.push({ name: row.tagName, icon: row.tagIcon, iconHue: row.tagIconHue });
      tagsByTopic.set(row.topicId, existing);
    }

    return results.map((r) => ({
      ...r,
      tags: tagsByTopic.get(r.id) ?? [],
    }));
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const topic = await ctx.db.query.topics.findFirst({
        where: eq(topics.id, input.slug),
        with: {
          base: true,
          parentTopic: true,
          createdBy: { columns: publicContributorColumns },
          topicTags: {
            with: { tag: true },
          },
          topicResources: {
            with: {
              resource: {
                with: { submittedBy: { columns: publicContributorColumns } },
              },
              addedBy: { columns: publicContributorColumns },
            },
            orderBy: (tr, { desc }) => [desc(tr.relevanceScore)],
          },
          childTopics: true,
          revisions: {
            with: { contributor: { columns: publicContributorColumns } },
            orderBy: (tr, { desc }) => [desc(tr.revisionNumber)],
          },
        },
      });
      return topic ?? null;
    }),

  getNeighbors: publicProcedure
    .input(z.object({ topicId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sourceEdges = await ctx.db.query.edges.findMany({
        where: eq(edges.sourceTopicId, input.topicId),
        with: { targetTopic: { columns: { id: true, title: true } } },
      });
      const targetEdges = await ctx.db.query.edges.findMany({
        where: eq(edges.targetTopicId, input.topicId),
        with: { sourceTopic: { columns: { id: true, title: true } } },
      });
      return { sourceEdges, targetEdges };
    }),

  getHierarchyContext: publicProcedure
    .input(z.object({ parentSlug: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      if (!input.parentSlug) {
        // Root topic — return existing root topics as "siblings" for context
        const roots = await ctx.db.query.topics.findMany({
          where: and(isNull(topics.parentTopicId), eq(topics.status, "published")),
          columns: { id: true, title: true, summary: true },
          limit: 30,
        });
        return { parent: null, siblings: roots, grandparent: null, targetDepth: 0 };
      }

      const parent = await ctx.db.query.topics.findFirst({
        where: eq(topics.id, input.parentSlug),
        columns: { id: true, title: true, summary: true, depth: true, parentTopicId: true },
      });
      if (!parent) return { parent: null, siblings: [], grandparent: null, targetDepth: 0 };

      const siblings = await ctx.db.query.topics.findMany({
        where: and(eq(topics.parentTopicId, parent.id), eq(topics.status, "published")),
        columns: { id: true, title: true, summary: true },
        limit: 30,
      });

      let grandparent: { id: string; title: string } | null = null;
      if (parent.parentTopicId) {
        const gp = await ctx.db.query.topics.findFirst({
          where: eq(topics.id, parent.parentTopicId),
          columns: { id: true, title: true },
        });
        grandparent = gp ?? null;
      }

      return {
        parent: { id: parent.id, title: parent.title, summary: parent.summary, depth: parent.depth },
        siblings,
        grandparent,
        targetDepth: parent.depth + 1,
      };
    }),

  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        content: z.string().default(""),
        summary: z.string().optional(),
        difficulty: z
          .enum(["beginner", "intermediate", "advanced"])
          .default("beginner"),
        status: z
          .enum(["draft", "published", "archived"])
          .default("draft"),
        parentTopicId: z.string().optional(),
        sortOrder: z.number().int().default(0),
        icon: z.string().optional(),
        iconHue: z.number().int().min(0).max(360).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = await generateUniqueId(ctx.db, topics, topics.id, input.title);
      const [topic] = await ctx.db
        .insert(topics)
        .values({ ...input, id })
        .returning();
      return topic!;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        content: z.string().optional(),
        summary: z.string().optional().nullable(),
        difficulty: z
          .enum(["beginner", "intermediate", "advanced"])
          .optional(),
        status: z
          .enum(["draft", "published", "archived"])
          .optional(),
        parentTopicId: z.string().optional().nullable(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const values: Record<string, unknown> = { ...rest };
      const [updated] = await ctx.db
        .update(topics)
        .set(values)
        .where(eq(topics.id, id))
        .returning();
      return updated!;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(topicTags).where(eq(topicTags.topicId, input.id));
      await ctx.db
        .delete(topicResources)
        .where(eq(topicResources.topicId, input.id));
      const [deleted] = await ctx.db
        .delete(topics)
        .where(eq(topics.id, input.id))
        .returning();
      return deleted!;
    }),
});
