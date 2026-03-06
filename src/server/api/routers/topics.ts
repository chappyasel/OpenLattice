import { and, eq, inArray, isNull, sql, count } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import { edges, topicTags, topicResources, topics } from "@/server/db/schema";
import { generateUniqueId, slugify } from "@/lib/utils";
import { publicContributorColumns } from "./contributors";

export const topicsRouter = createTRPCRouter({
  listTree: publicProcedure
    .input(
      z
        .object({ parentTopicId: z.string().nullable() })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(topics.status, "published")];
      if (input?.parentTopicId === null || !input) {
        conditions.push(isNull(topics.parentTopicId));
      } else if (input?.parentTopicId) {
        conditions.push(eq(topics.parentTopicId, input.parentTopicId));
      }

      return ctx.db
        .select({
          id: topics.id,
          title: topics.title,
          parentTopicId: topics.parentTopicId,
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

  list: publicProcedure
    .input(
      z
        .object({
          status: z.enum(["draft", "published", "archived"]).optional(),
          difficulty: z
            .enum(["beginner", "intermediate", "advanced"])
            .optional(),
          parentTopicId: z.string().optional().nullable(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
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

      return ctx.db.query.topics.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          topicTags: {
            with: { tag: true },
          },
          topicResources: true,
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
        iconHue: topics.iconHue,
        updatedAt: topics.updatedAt,
        resourceCount: count(topicResources.id),
      })
      .from(topics)
      .leftJoin(topicResources, eq(topicResources.topicId, topics.id))
      .where(eq(topics.status, "published"))
      .groupBy(topics.id)
      .orderBy(
        sql`(
          ${count(topicResources.id)} * 2
          + EXTRACT(EPOCH FROM ${topics.updatedAt}) / 86400
          + random() * 5
        ) DESC`,
      )
      .limit(3);

    return results;
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const topic = await ctx.db.query.topics.findFirst({
        where: eq(topics.id, input.slug),
        with: {
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
