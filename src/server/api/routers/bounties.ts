import { and, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { formatTimestamp, generateUniqueId, slugify } from "@/lib/utils";
import { iconSchema } from "@/lib/phosphor-icons";
import { resolveBaseId } from "@/lib/resolve-base";
import { recordKarma } from "@/lib/karma";
import {
  adminProcedure,
  apiKeyProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { bounties, contributors, signals, submissions } from "@/server/db/schema";
import { publicContributorColumns } from "./contributors";

export const bountiesRouter = createTRPCRouter({
  listOpen: publicProcedure
    .input(
      z.object({ baseSlug: z.string().optional() }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const baseId = await resolveBaseId(ctx.db, input?.baseSlug);

      // Lazy expiration: reset stale claims back to open
      await ctx.db
        .update(bounties)
        .set({
          status: "open",
          claimedById: null,
          claimedAt: null,
          claimExpiresAt: null,
        })
        .where(
          and(
            eq(bounties.status, "claimed"),
            lt(bounties.claimExpiresAt, new Date()),
          ),
        );

      const conditions = [inArray(bounties.status, ["open", "claimed"])];
      if (baseId) {
        conditions.push(eq(bounties.baseId, baseId));
      }

      return ctx.db.query.bounties.findMany({
        where: and(...conditions),
        with: {
          topic: true,
          claimedBy: { columns: publicContributorColumns },
        },
        orderBy: (b, { desc }) => [desc(b.karmaReward), desc(b.createdAt)],
      });
    }),

  list: publicProcedure
    .input(
      z
        .object({
          status: z.enum(["open", "claimed", "completed", "cancelled"]).optional(),
          baseSlug: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const baseId = await resolveBaseId(ctx.db, input?.baseSlug);

      // Lazy expiration: reset stale claims back to open (same as listOpen)
      await ctx.db
        .update(bounties)
        .set({
          status: "open",
          claimedById: null,
          claimedAt: null,
          claimExpiresAt: null,
        })
        .where(
          and(
            eq(bounties.status, "claimed"),
            lt(bounties.claimExpiresAt, new Date()),
          ),
        );

      const conditions = [];
      if (input?.status) conditions.push(eq(bounties.status, input.status));
      if (baseId) conditions.push(eq(bounties.baseId, baseId));

      return ctx.db.query.bounties.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          topic: true,
          claimedBy: { columns: publicContributorColumns },
          completedBy: { columns: publicContributorColumns },
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
          claimedBy: { columns: publicContributorColumns },
          completedBy: { columns: publicContributorColumns },
          submissions: {
            with: { contributor: { columns: publicContributorColumns } },
          },
        },
      });
      return bounty ?? null;
    }),

  respond: protectedProcedure
    .input(
      z.object({
        bountyId: z.string(),
        data: z.record(z.unknown()).refine(
          (d) => {
            const topic = d.topic as Record<string, unknown> | undefined;
            return topic && typeof topic.title === "string" && typeof topic.content === "string";
          },
          { message: "Bounty response data must include topic.title and topic.content (same shape as an expansion)" },
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [submission] = await ctx.db
        .insert(submissions)
        .values({
          id: `bounty-response--${slugify(ctx.contributor.name)}--${formatTimestamp()}`,
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
        data: z.record(z.unknown()).refine(
          (d) => {
            const topic = d.topic as Record<string, unknown> | undefined;
            return topic && typeof topic.title === "string" && typeof topic.content === "string";
          },
          { message: "Bounty response data must include topic.title and topic.content (same shape as an expansion)" },
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [submission] = await ctx.db
        .insert(submissions)
        .values({
          id: `bounty-response--${slugify(ctx.contributor.name)}--${formatTimestamp()}`,
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

  claim: apiKeyProcedure
    .input(z.object({ bountyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bounty = await ctx.db.query.bounties.findFirst({
        where: eq(bounties.id, input.bountyId),
      });

      if (!bounty) {
        throw new Error("Bounty not found");
      }

      if (bounty.status === "completed" || bounty.status === "cancelled") {
        throw new Error(`Bounty is already ${bounty.status}`);
      }

      // If claimed by someone else and not expired
      if (
        bounty.status === "claimed" &&
        bounty.claimExpiresAt &&
        bounty.claimExpiresAt > new Date() &&
        bounty.claimedById !== ctx.contributor.id
      ) {
        throw new Error(
          `Bounty is claimed by another contributor until ${bounty.claimExpiresAt.toISOString()}`,
        );
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

      const [updated] = await ctx.db
        .update(bounties)
        .set({
          status: "claimed",
          claimedById: ctx.contributor.id,
          claimedAt: now,
          claimExpiresAt: expiresAt,
        })
        .where(eq(bounties.id, input.bountyId))
        .returning();

      // Check if bounty already has approved submissions
      const approvedSubs = await ctx.db.query.submissions.findMany({
        where: and(
          eq(submissions.bountyId, input.bountyId),
          eq(submissions.status, "approved"),
        ),
        limit: 1,
      });
      const hasExistingContent = approvedSubs.length > 0;

      return { ...updated!, hasExistingContent };
    }),

  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        type: z.enum(["topic", "resource", "edit"]),
        topicId: z.string().optional(),
        karmaReward: z.number().int().min(0).default(10),
        icon: iconSchema.optional(),
        iconHue: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = await generateUniqueId(ctx.db, bounties, bounties.id, input.title);
      const [bounty] = await ctx.db
        .insert(bounties)
        .values({ ...input, id, status: "open" })
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

        // Reward signalers who triggered this bounty (+1 karma each)
        const linkedSignals = await ctx.db.query.signals.findMany({
          where: and(
            eq(signals.bountyId, input.id),
            eq(signals.status, "open"),
          ),
          columns: { id: true, contributorId: true },
        });

        const rewardedContributors = new Set<string>();
        for (const sig of linkedSignals) {
          if (rewardedContributors.has(sig.contributorId)) continue;
          rewardedContributors.add(sig.contributorId);
          await recordKarma(ctx.db, {
            contributorId: sig.contributorId,
            delta: 1,
            eventType: "signal_reward",
            description: "Signal led to bounty completion",
            bountyId: input.id,
          });
        }

        // Resolve all linked signals
        if (linkedSignals.length > 0) {
          await ctx.db
            .update(signals)
            .set({ status: "resolved" })
            .where(
              and(
                eq(signals.bountyId, input.id),
                eq(signals.status, "open"),
              ),
            );
        }
      }

      return updated!;
    }),
});
