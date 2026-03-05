import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { submissions } from "@/server/db/schema";

export const submissionsRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          status: z
            .enum(["pending", "approved", "rejected"])
            .optional(),
          type: z
            .enum(["resource", "topic_edit", "topic_new", "bounty_response", "expansion"])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input?.status) {
        conditions.push(eq(submissions.status, input.status));
      }
      if (input?.type) {
        conditions.push(eq(submissions.type, input.type));
      }

      return ctx.db.query.submissions.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          contributor: true,
          bounty: true,
        },
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      });
    }),

  review: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["approved", "rejected"]),
        reviewNotes: z.string().optional(),
        reputationDelta: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(submissions)
        .set({
          status: input.status,
          reviewNotes: input.reviewNotes,
          reputationDelta: input.reputationDelta,
          reviewedAt: new Date(),
        })
        .where(eq(submissions.id, input.id))
        .returning();
      return updated!;
    }),
});
