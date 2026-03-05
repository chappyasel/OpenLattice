import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  apiKeyProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { bounties, contributors, submissions } from "@/server/db/schema";

export const bountiesRouter = createTRPCRouter({
  listOpen: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.bounties.findMany({
      where: eq(bounties.status, "open"),
      with: {
        topic: true,
      },
      orderBy: (b, { desc }) => [desc(b.karmaReward), desc(b.createdAt)],
    });
  }),

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.bounties.findMany({
      with: {
        topic: true,
        completedBy: true,
      },
      orderBy: (b, { desc }) => [desc(b.createdAt)],
    });
  }),

  getById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const bounty = await ctx.db.query.bounties.findFirst({
        where: eq(bounties.id, input),
        with: {
          topic: true,
          completedBy: true,
          submissions: {
            with: { contributor: true },
          },
        },
      });
      return bounty ?? null;
    }),

  respond: protectedProcedure
    .input(
      z.object({
        bountyId: z.string(),
        data: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [submission] = await ctx.db
        .insert(submissions)
        .values({
          type: "bounty_response",
          status: "pending",
          data: input.data,
          contributorId: ctx.contributor.id,
          bountyId: input.bountyId,
          source: "web",
        })
        .returning();
      return submission!;
    }),

  respondWithApiKey: apiKeyProcedure
    .input(
      z.object({
        bountyId: z.string(),
        data: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [submission] = await ctx.db
        .insert(submissions)
        .values({
          type: "bounty_response",
          status: "pending",
          data: input.data,
          contributorId: ctx.contributor.id,
          bountyId: input.bountyId,
          source: "mcp",
        })
        .returning();
      return submission!;
    }),

  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        type: z.enum(["topic", "resource", "edit"]),
        topicId: z.string().optional(),
        karmaReward: z.number().int().min(0).default(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [bounty] = await ctx.db
        .insert(bounties)
        .values({ ...input, status: "open" })
        .returning();
      return bounty!;
    }),

  complete: adminProcedure
    .input(
      z.object({
        id: z.string(),
        completedById: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bounty = await ctx.db.query.bounties.findFirst({
        where: eq(bounties.id, input.id),
      });

      const [updated] = await ctx.db
        .update(bounties)
        .set({
          status: "completed",
          completedById: input.completedById,
        })
        .where(eq(bounties.id, input.id))
        .returning();

      if (bounty) {
        await ctx.db
          .update(contributors)
          .set({
            karma: sql`${contributors.karma} + ${bounty.karmaReward}`,
          })
          .where(eq(contributors.id, input.completedById));
      }

      return updated!;
    }),
});
