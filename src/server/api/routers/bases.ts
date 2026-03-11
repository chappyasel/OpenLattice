import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "@/server/api/trpc";
import { bases, topics } from "@/server/db/schema";

export const basesRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.bases.findMany({
      where: eq(bases.isPublic, true),
      orderBy: [bases.sortOrder, bases.name],
    });
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.db.query.bases.findFirst({
        where: eq(bases.slug, input.slug),
      });
      return base ?? null;
    }),

  getTree: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.db.query.bases.findFirst({
        where: eq(bases.slug, input.slug),
      });
      if (!base) return null;

      const baseTopics = await ctx.db.query.topics.findMany({
        where: eq(topics.baseId, base.id),
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

      return { base, topics: baseTopics };
    }),

  getStats: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.db.query.bases.findFirst({
        where: eq(bases.slug, input.slug),
      });
      if (!base) return null;

      const [topicCount] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(topics)
        .where(eq(topics.baseId, base.id));

      return {
        base,
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
        .insert(bases)
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
        .update(bases)
        .set(data)
        .where(eq(bases.id, id))
        .returning();
      return updated!;
    }),
});
