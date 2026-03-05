import { eq, sql, and, ne } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  apiKeyProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import {
  claims,
  claimPositions,
  contributors,
  activity,
} from "@/server/db/schema";
import { slugify } from "@/lib/utils";

export const claimsRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          status: z
            .enum([
              "open",
              "contested",
              "resolved_true",
              "resolved_false",
              "expired",
            ])
            .optional(),
          topicId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input?.status) conditions.push(eq(claims.status, input.status));
      if (input?.topicId) conditions.push(eq(claims.topicId, input.topicId));

      return ctx.db.query.claims.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          createdBy: true,
          topic: true,
          positions: {
            with: { contributor: true },
          },
        },
        orderBy: (c, { desc }) => [desc(c.createdAt)],
      });
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const claim = await ctx.db.query.claims.findFirst({
        where: eq(claims.slug, input.slug),
        with: {
          createdBy: true,
          topic: true,
          positions: {
            with: { contributor: true, resource: true },
          },
        },
      });
      return claim ?? null;
    }),

  getByTopic: publicProcedure
    .input(z.object({ topicId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.claims.findMany({
        where: eq(claims.topicId, input.topicId),
        with: {
          createdBy: true,
          positions: {
            with: { contributor: true },
          },
        },
        orderBy: (c, { desc }) => [desc(c.confidence)],
      });
    }),

  create: apiKeyProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        topicSlug: z.string(),
        stakeAmount: z.number().int().min(1).max(100).default(10),
        position: z.enum(["support", "oppose"]).default("support"),
        evidence: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const topic = await ctx.db.query.topics.findFirst({
        where: eq(
          (await import("@/server/db/schema")).topics.slug,
          input.topicSlug,
        ),
      });

      const slug = slugify(input.title);
      const [claim] = await ctx.db
        .insert(claims)
        .values({
          title: input.title,
          description: input.description,
          slug,
          topicId: topic?.id,
          stakeAmount: input.stakeAmount,
          createdById: ctx.contributor.id,
        })
        .returning();

      // Creator automatically takes a position
      await ctx.db.insert(claimPositions).values({
        claimId: claim!.id,
        contributorId: ctx.contributor.id,
        position: input.position,
        stakeAmount: input.stakeAmount,
        evidence: input.evidence,
      });

      // Log activity
      await ctx.db.insert(activity).values({
        type: "claim_made",
        contributorId: ctx.contributor.id,
        claimId: claim!.id,
        topicId: topic?.id,
        description: `${ctx.contributor.name} made a claim: "${input.title}"`,
      });

      return claim!;
    }),

  takePosition: apiKeyProcedure
    .input(
      z.object({
        claimId: z.string(),
        position: z.enum(["support", "oppose"]),
        stakeAmount: z.number().int().min(1).max(100).default(10),
        evidence: z.string().optional(),
        resourceId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [pos] = await ctx.db
        .insert(claimPositions)
        .values({
          claimId: input.claimId,
          contributorId: ctx.contributor.id,
          position: input.position,
          stakeAmount: input.stakeAmount,
          evidence: input.evidence,
          resourceId: input.resourceId,
        })
        .returning();

      // Update claim status to contested if there are opposing positions
      const claim = await ctx.db.query.claims.findFirst({
        where: eq(claims.id, input.claimId),
        with: { positions: true },
      });

      if (claim) {
        const hasSupport = claim.positions.some((p) => p.position === "support");
        const hasOppose = claim.positions.some((p) => p.position === "oppose");
        if (hasSupport && hasOppose && claim.status === "open") {
          await ctx.db
            .update(claims)
            .set({ status: "contested" })
            .where(eq(claims.id, input.claimId));
        }

        // Recalculate confidence
        const supportStake = claim.positions
          .filter((p) => p.position === "support")
          .reduce((sum, p) => sum + p.stakeAmount, 0);
        const totalStake = claim.positions.reduce(
          (sum, p) => sum + p.stakeAmount,
          0,
        );
        if (totalStake > 0) {
          await ctx.db
            .update(claims)
            .set({ confidence: supportStake / totalStake })
            .where(eq(claims.id, input.claimId));
        }
      }

      // Log activity
      await ctx.db.insert(activity).values({
        type: "claim_challenged",
        contributorId: ctx.contributor.id,
        claimId: input.claimId,
        description: `${ctx.contributor.name} ${input.position === "support" ? "supported" : "opposed"} a claim`,
      });

      return pos!;
    }),

  resolve: adminProcedure
    .input(
      z.object({
        id: z.string(),
        resolution: z.enum(["resolved_true", "resolved_false"]),
        resolutionNote: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.db.query.claims.findFirst({
        where: eq(claims.id, input.id),
        with: { positions: true },
      });

      if (!claim) throw new Error("Claim not found");

      // Update claim
      const [updated] = await ctx.db
        .update(claims)
        .set({
          status: input.resolution,
          resolvedAt: new Date(),
          resolutionNote: input.resolutionNote,
          confidence: input.resolution === "resolved_true" ? 1.0 : 0.0,
        })
        .where(eq(claims.id, input.id))
        .returning();

      // Determine winners/losers
      const winningPosition =
        input.resolution === "resolved_true" ? "support" : "oppose";

      for (const pos of claim.positions) {
        const won = pos.position === winningPosition;
        const delta = won ? pos.stakeAmount : -pos.stakeAmount;

        await ctx.db
          .update(claimPositions)
          .set({
            outcome: won ? "won" : "lost",
            reputationDelta: delta,
          })
          .where(eq(claimPositions.id, pos.id));

        // Update contributor karma
        await ctx.db
          .update(contributors)
          .set({
            karma: sql`${contributors.karma} + ${delta}`,
          })
          .where(eq(contributors.id, pos.contributorId));
      }

      // Log activity
      await ctx.db.insert(activity).values({
        type: "claim_resolved",
        claimId: input.id,
        description: `Claim resolved as ${input.resolution === "resolved_true" ? "TRUE" : "FALSE"}: "${claim.title}"`,
      });

      return updated!;
    }),
});
