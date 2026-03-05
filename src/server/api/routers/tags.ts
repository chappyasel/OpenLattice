import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import { resourceTags, tags, topicTags } from "@/server/db/schema";

export const tagsRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.tags.findMany({
      orderBy: (t, { asc }) => [asc(t.name)],
    });
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        hue: z.number().int().min(0).max(360).default(0),
        emoji: z.string().optional(),
        description: z.string().default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [tag] = await ctx.db.insert(tags).values(input).returning();
      return tag!;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        hue: z.number().int().min(0).max(360).optional(),
        emoji: z.string().optional().nullable(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const [updated] = await ctx.db
        .update(tags)
        .set(rest)
        .where(eq(tags.id, id))
        .returning();
      return updated!;
    }),

  assignToTopic: adminProcedure
    .input(z.object({ topicId: z.string(), tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(topicTags)
        .values(input)
        .onConflictDoNothing()
        .returning();
      return row;
    }),

  assignToResource: adminProcedure
    .input(z.object({ resourceId: z.string(), tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(resourceTags)
        .values(input)
        .onConflictDoNothing()
        .returning();
      return row;
    }),

  removeFromTopic: adminProcedure
    .input(z.object({ topicId: z.string(), tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(topicTags)
        .where(
          and(
            eq(topicTags.topicId, input.topicId),
            eq(topicTags.tagId, input.tagId),
          ),
        )
        .returning();
      return deleted;
    }),

  removeFromResource: adminProcedure
    .input(z.object({ resourceId: z.string(), tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(resourceTags)
        .where(
          and(
            eq(resourceTags.resourceId, input.resourceId),
            eq(resourceTags.tagId, input.tagId),
          ),
        )
        .returning();
      return deleted;
    }),
});
