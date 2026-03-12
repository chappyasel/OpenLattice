import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  apiKeyProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import {
  signals,
  topics,
  resources,
  claims,
  bounties,
  activity,
  VALID_SIGNAL_COMBOS,
} from "@/server/db/schema";
import { activityId, generateUniqueId } from "@/lib/utils";
import { recordKarma } from "@/lib/karma";

const signalTypeValues = [
  "outdated",
  "inaccurate",
  "dead_link",
  "needs_depth",
  "duplicate",
  "misplaced",
] as const;

const signalTargetTypeValues = ["topic", "resource", "claim"] as const;

const submitInput = z.object({
  targetType: z.enum(signalTargetTypeValues),
  targetId: z.string().min(1),
  signalType: z.enum(signalTypeValues),
  evidence: z.string().max(2000).optional(),
  suggestedFix: z.string().max(2000).optional(),
});

async function submitSignal(
  db: any,
  contributorId: string,
  input: z.infer<typeof submitInput>,
) {
  // Validate signal type + target type combo
  const validTargets = VALID_SIGNAL_COMBOS[input.signalType];
  if (validTargets && !validTargets.includes(input.targetType)) {
    throw new Error(
      `Signal type "${input.signalType}" is only valid for: ${validTargets.join(", ")}. Got "${input.targetType}".`,
    );
  }

  // Validate target exists
  if (input.targetType === "topic") {
    const topic = await db.query.topics.findFirst({
      where: eq(topics.id, input.targetId),
      columns: { id: true, title: true },
    });
    if (!topic) throw new Error(`Topic "${input.targetId}" not found`);
  } else if (input.targetType === "resource") {
    const resource = await db.query.resources.findFirst({
      where: eq(resources.id, input.targetId),
      columns: { id: true, name: true },
    });
    if (!resource) throw new Error(`Resource "${input.targetId}" not found`);
  } else if (input.targetType === "claim") {
    const claim = await db.query.claims.findFirst({
      where: eq(claims.id, input.targetId),
      columns: { id: true },
    });
    if (!claim) throw new Error(`Claim "${input.targetId}" not found`);
  }

  // Insert signal (unique constraint prevents duplicates)
  const id = await generateUniqueId(
    db,
    signals,
    signals.id,
    `signal-${input.signalType}-${input.targetId}`,
  );

  try {
    await db.insert(signals).values({
      id,
      targetType: input.targetType,
      targetId: input.targetId,
      signalType: input.signalType,
      status: "open",
      contributorId,
      evidence: input.evidence,
      suggestedFix: input.suggestedFix,
    });
  } catch (err: any) {
    if (err.code === "23505") {
      // unique_violation
      throw new Error(
        `You have already flagged this ${input.targetType} as "${input.signalType}".`,
      );
    }
    throw err;
  }

  // Log activity
  await db.insert(activity).values({
    id: activityId("signal", contributorId, input.targetId),
    type: "signal_submitted",
    contributorId,
    topicId:
      input.targetType === "topic" ? input.targetId : null,
    description: `Flagged ${input.targetType} as ${input.signalType.replace("_", " ")}`,
    data: {
      signalId: id,
      targetType: input.targetType,
      targetId: input.targetId,
      signalType: input.signalType,
    },
  });

  // Auto-bounty: check if 3+ open signals on same target+type
  const [signalCount] = await db
    .select({ count: count() })
    .from(signals)
    .where(
      and(
        eq(signals.targetType, input.targetType),
        eq(signals.targetId, input.targetId),
        eq(signals.signalType, input.signalType),
        eq(signals.status, "open"),
      ),
    );

  let autoBountyCreated = false;

  if (signalCount && signalCount.count >= 3) {
    // Check if these signals already have a bounty
    const existingWithBounty = await db.query.signals.findFirst({
      where: and(
        eq(signals.targetType, input.targetType),
        eq(signals.targetId, input.targetId),
        eq(signals.signalType, input.signalType),
        eq(signals.status, "open"),
        sql`${signals.bountyId} IS NOT NULL`,
      ),
      columns: { bountyId: true },
    });

    if (!existingWithBounty) {
      // Resolve target display name for bounty title
      let targetName = input.targetId;
      let topicId: string | null = null;

      if (input.targetType === "topic") {
        const topic = await db.query.topics.findFirst({
          where: eq(topics.id, input.targetId),
          columns: { title: true },
        });
        targetName = topic?.title ?? input.targetId;
        topicId = input.targetId;
      } else if (input.targetType === "resource") {
        const resource = await db.query.resources.findFirst({
          where: eq(resources.id, input.targetId),
          columns: { name: true },
        });
        targetName = resource?.name ?? input.targetId;
      } else if (input.targetType === "claim") {
        const claim = await db.query.claims.findFirst({
          where: eq(claims.id, input.targetId),
          columns: { body: true, topicId: true },
        });
        targetName = claim?.body?.slice(0, 60) ?? input.targetId;
        topicId = claim?.topicId ?? null;
      }

      const signalLabel = input.signalType.replace("_", " ");
      const bountyTitle = `Fix: ${signalLabel} ${input.targetType} — ${targetName}`;
      const bountyId = await generateUniqueId(
        db,
        bounties,
        bounties.id,
        bountyTitle,
      );

      // Collect evidence from all signals for bounty description
      const allSignals = await db.query.signals.findMany({
        where: and(
          eq(signals.targetType, input.targetType),
          eq(signals.targetId, input.targetId),
          eq(signals.signalType, input.signalType),
          eq(signals.status, "open"),
        ),
        columns: { evidence: true, suggestedFix: true },
      });

      const evidenceLines = allSignals
        .filter((s: any) => s.evidence)
        .map((s: any) => `- ${s.evidence}`)
        .join("\n");
      const fixLines = allSignals
        .filter((s: any) => s.suggestedFix)
        .map((s: any) => `- ${s.suggestedFix}`)
        .join("\n");

      let description = `Multiple agents flagged this ${input.targetType} as ${signalLabel}.`;
      if (evidenceLines) description += `\n\n**Evidence:**\n${evidenceLines}`;
      if (fixLines) description += `\n\n**Suggested fixes:**\n${fixLines}`;

      await db.insert(bounties).values({
        id: bountyId,
        title: bountyTitle.slice(0, 200),
        description,
        type: "edit",
        status: "open",
        topicId,
        karmaReward: 10,
      });

      // Link all matching signals to this bounty
      await db
        .update(signals)
        .set({ bountyId })
        .where(
          and(
            eq(signals.targetType, input.targetType),
            eq(signals.targetId, input.targetId),
            eq(signals.signalType, input.signalType),
            eq(signals.status, "open"),
          ),
        );

      autoBountyCreated = true;
    }
  }

  // For dead_link on resources, auto-verify the URL
  let urlVerification: { alive: boolean; statusCode?: number } | null = null;
  if (input.signalType === "dead_link" && input.targetType === "resource") {
    const resource = await db.query.resources.findFirst({
      where: eq(resources.id, input.targetId),
      columns: { url: true },
    });

    if (resource?.url) {
      try {
        const res = await fetch(resource.url, {
          method: "HEAD",
          signal: AbortSignal.timeout(5000),
        });
        urlVerification = { alive: res.ok, statusCode: res.status };
      } catch {
        urlVerification = { alive: false };
      }

      // If confirmed dead and this is the first signal, auto-create bounty immediately
      if (!urlVerification.alive && signalCount && signalCount.count < 3 && !autoBountyCreated) {
        const resource = await db.query.resources.findFirst({
          where: eq(resources.id, input.targetId),
          columns: { name: true },
        });

        const bountyTitle = `Fix: dead link — ${resource?.name ?? input.targetId}`;
        const bountyId = await generateUniqueId(
          db,
          bounties,
          bounties.id,
          bountyTitle,
        );

        await db.insert(bounties).values({
          id: bountyId,
          title: bountyTitle.slice(0, 200),
          description: `URL confirmed dead (${urlVerification.statusCode ?? "unreachable"}). Resource needs a valid replacement URL.`,
          type: "edit",
          status: "open",
          karmaReward: 5,
        });

        await db
          .update(signals)
          .set({ bountyId })
          .where(
            and(
              eq(signals.targetType, input.targetType),
              eq(signals.targetId, input.targetId),
              eq(signals.signalType, "dead_link"),
              eq(signals.status, "open"),
            ),
          );

        autoBountyCreated = true;
      }
    }
  }

  return { signalId: id, autoBountyCreated, urlVerification };
}

export const signalsRouter = createTRPCRouter({
  submit: apiKeyProcedure.input(submitInput).mutation(async ({ ctx, input }) => {
    return submitSignal(ctx.db, ctx.contributor.id, input);
  }),

  submitWeb: protectedProcedure.input(submitInput).mutation(async ({ ctx, input }) => {
    return submitSignal(ctx.db, ctx.contributor.id, input);
  }),

  listByTarget: publicProcedure
    .input(
      z.object({
        targetType: z.enum(signalTargetTypeValues),
        targetId: z.string(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.query.signals.findMany({
        where: and(
          eq(signals.targetType, input.targetType),
          eq(signals.targetId, input.targetId),
          eq(signals.status, "open"),
        ),
        with: {
          contributor: {
            columns: { id: true, name: true, image: true },
          },
        },
        orderBy: (s, { desc }) => [desc(s.createdAt)],
        limit: input.limit,
      });
    }),

  countByTarget: publicProcedure
    .input(
      z.object({
        targetType: z.enum(signalTargetTypeValues),
        targetId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          signalType: signals.signalType,
          count: count(),
        })
        .from(signals)
        .where(
          and(
            eq(signals.targetType, input.targetType),
            eq(signals.targetId, input.targetId),
            eq(signals.status, "open"),
          ),
        )
        .groupBy(signals.signalType);

      const counts: Record<string, number> = {};
      for (const row of rows) {
        counts[row.signalType] = row.count;
      }
      return counts;
    }),

  resolve: adminProcedure
    .input(
      z.object({
        signalId: z.string(),
        status: z.enum(["resolved", "dismissed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(signals)
        .set({ status: input.status })
        .where(eq(signals.id, input.signalId))
        .returning();
      return updated!;
    }),

  listAll: adminProcedure
    .input(
      z
        .object({
          status: z.enum(["open", "resolved", "dismissed"]).optional(),
          targetType: z.enum(signalTargetTypeValues).optional(),
          signalType: z.enum(signalTypeValues).optional(),
          limit: z.number().int().min(1).max(200).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input?.status) conditions.push(eq(signals.status, input.status));
      if (input?.targetType)
        conditions.push(eq(signals.targetType, input.targetType));
      if (input?.signalType)
        conditions.push(eq(signals.signalType, input.signalType));

      return ctx.db.query.signals.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          contributor: {
            columns: { id: true, name: true, image: true },
          },
        },
        orderBy: (s, { desc }) => [desc(s.createdAt)],
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      });
    }),
});
