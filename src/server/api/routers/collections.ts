import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "@/server/api/trpc";
import { collections, topics } from "@/server/db/schema";

export const collectionsRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.collections.findMany({
      where: eq(collections.isPublic, true),
      orderBy: [collections.sortOrder, collections.name],
    });
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const collection = await ctx.db.query.collections.findFirst({
        where: eq(collections.slug, input.slug),
      });
      return collection ?? null;
    }),

  getTree: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const collection = await ctx.db.query.collections.findFirst({
        where: eq(collections.slug, input.slug),
      });
      if (!collection) return null;

      const collectionTopics = await ctx.db.query.topics.findMany({
        where: eq(topics.collectionId, collection.id),
        columns: {
          id: true,
          title: true,
          parentTopicId: true,
          materializedPath: true,
          depth: true,
          icon: true,
          iconHue: true,
          status: true,
          freshnessScore: true,
          contributorCount: true,
          sourceCount: true,
          sortOrder: true,
        },
        orderBy: [topics.sortOrder, topics.title],
      });

      return { collection, topics: collectionTopics };
    }),

  getStats: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const collection = await ctx.db.query.collections.findFirst({
        where: eq(collections.slug, input.slug),
      });
      if (!collection) return null;

      const [topicCount] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(topics)
        .where(eq(topics.collectionId, collection.id));

      return {
        collection,
        topicCount: topicCount?.count ?? 0,
      };
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().optional(),
        icon: z.string().optional(),
        iconHue: z.number().int().min(0).max(360).optional(),
        isPublic: z.boolean().default(true),
        sortOrder: z.number().int().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = input.slug;
      const [created] = await ctx.db
        .insert(collections)
        .values({ id, ...input })
        .returning();
      return created!;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        icon: z.string().optional().nullable(),
        iconHue: z.number().int().min(0).max(360).optional().nullable(),
        isPublic: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(collections)
        .set(data)
        .where(eq(collections.id, id))
        .returning();
      return updated!;
    }),
});
