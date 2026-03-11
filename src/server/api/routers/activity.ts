import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { activity } from "@/server/db/schema";
import { resolveBaseId } from "@/lib/resolve-base";
import { publicContributorColumns } from "./contributors";

export const activityRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          type: z
            .enum([
              "topic_created",
              "resource_submitted",
              "edge_created",
              "bounty_completed",
              "submission_reviewed",
              "reputation_changed",
              "kudos_given",
              "evaluation_submitted",
              "consensus_reached",
              "trust_level_changed",
            ])
            .optional(),
          contributorId: z.string().optional(),
          topicId: z.string().optional(),
          baseSlug: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          cursor: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const baseId = await resolveBaseId(ctx.db, input?.baseSlug);

      const conditions = [];
      if (input?.type) conditions.push(eq(activity.type, input.type));
      if (input?.contributorId)
        conditions.push(eq(activity.contributorId, input.contributorId));
      if (input?.topicId)
        conditions.push(eq(activity.topicId, input.topicId));
      if (baseId)
        conditions.push(eq(activity.baseId, baseId));

      const items = await ctx.db.query.activity.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          contributor: { columns: publicContributorColumns },
          topic: true,
          bounty: true,
        },
        orderBy: [desc(activity.createdAt)],
        limit: (input?.limit ?? 50) + 1,
      });

      let nextCursor: string | undefined;
      if (items.length > (input?.limit ?? 50)) {
        const last = items.pop()!;
        nextCursor = last.id;
      }

      return { items, nextCursor };
    }),

  getRecent: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(10),
        baseSlug: z.string().optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const baseId = await resolveBaseId(ctx.db, input?.baseSlug);

      return ctx.db.query.activity.findMany({
        where: baseId ? eq(activity.baseId, baseId) : undefined,
        with: {
          contributor: { columns: publicContributorColumns },
          topic: true,
        },
        orderBy: [desc(activity.createdAt)],
        limit: input?.limit ?? 10,
      });
    }),
});
