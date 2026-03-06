import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import { resourceTags, tags, topicTags } from "@/server/db/schema";
import { iconSchema } from "@/lib/phosphor-icons";
import { slugify } from "@/lib/utils";

export const tagsRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.tags.findMany({
      orderBy: (t, { asc }) => [asc(t.name)],
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.tags.findFirst({
        where: eq(tags.id, input.id),
        with: {
          topicTags: { with: { topic: true } },
          resourceTags: { with: { resource: true } },
        },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        iconHue: z.number().int().min(0).max(360).optional().nullable(),
        icon: iconSchema.optional().nullable(),
        description: z.string().default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = slugify(input.name);
      const [tag] = await ctx.db.insert(tags).values({ ...input, id }).returning();
      return tag!;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        iconHue: z.number().int().min(0).max(360).optional().nullable(),
        icon: iconSchema.optional().nullable(),
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
        .values({ ...input, id: `${input.topicId}--${input.tagId}` })
        .onConflictDoNothing()
        .returning();
      return row;
    }),

  assignToResource: adminProcedure
    .input(z.object({ resourceId: z.string(), tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(resourceTags)
        .values({ ...input, id: `${input.resourceId}--${input.tagId}` })
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
