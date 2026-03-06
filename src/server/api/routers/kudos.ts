import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";

import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { kudos, contributors, activity } from "@/server/db/schema";
import { activityId } from "@/lib/utils";
import { publicContributorColumns } from "./contributors";

export const kudosRouter = createTRPCRouter({
  listForContributor: publicProcedure
    .input(z.object({ contributorId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.kudos.findMany({
        where: eq(kudos.toContributorId, input.contributorId),
        with: { from: { columns: publicContributorColumns } },
        orderBy: [desc(kudos.createdAt)],
      });
    }),

  give: protectedProcedure
    .input(
      z.object({
        toContributorId: z.string(),
        message: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.contributor.id === input.toContributorId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot give kudos to yourself",
        });
      }

      const recipient = await ctx.db.query.contributors.findFirst({
        where: eq(contributors.id, input.toContributorId),
      });
      if (!recipient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recipient not found",
        });
      }

      const id = crypto.randomUUID();

      const [created] = await ctx.db
        .insert(kudos)
        .values({
          id,
          fromContributorId: ctx.contributor.id,
          toContributorId: input.toContributorId,
          message: input.message ?? null,
        })
        .returning();

      await ctx.db
        .update(contributors)
        .set({ kudosReceived: sql`${contributors.kudosReceived} + 1` })
        .where(eq(contributors.id, input.toContributorId));

      await ctx.db.insert(activity).values({
        id: activityId("kudos", ctx.contributor.id, input.toContributorId),
        type: "kudos_given",
        contributorId: ctx.contributor.id,
        description: `Gave kudos to ${recipient.name}`,
      });

      return created!;
    }),

  remove: protectedProcedure
    .input(z.object({ toContributorId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.kudos.findFirst({
        where: and(
          eq(kudos.fromContributorId, ctx.contributor.id),
          eq(kudos.toContributorId, input.toContributorId),
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Kudos not found",
        });
      }

      await ctx.db
        .delete(kudos)
        .where(
          and(
            eq(kudos.fromContributorId, ctx.contributor.id),
            eq(kudos.toContributorId, input.toContributorId),
          ),
        );

      await ctx.db
        .update(contributors)
        .set({ kudosReceived: sql`${contributors.kudosReceived} - 1` })
        .where(eq(contributors.id, input.toContributorId));

      return { success: true };
    }),
});
