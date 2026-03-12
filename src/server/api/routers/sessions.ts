import { and, count, eq } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  apiKeyProcedure,
  evaluatorProcedure,
} from "@/server/api/trpc";
import { researchSessions, sessionEvents, submissions } from "@/server/db/schema";
import { activityId } from "@/lib/utils";

export const sessionsRouter = createTRPCRouter({
  start: apiKeyProcedure
    .input(
      z
        .object({
          targetTopic: z.string().optional(),
          bountyId: z.string().optional(),
          description: z.string().optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      // Validate max 5 active sessions per contributor
      const [activeCount] = await ctx.db
        .select({ count: count() })
        .from(researchSessions)
        .where(
          and(
            eq(researchSessions.contributorId, ctx.contributor.id),
            eq(researchSessions.status, "active"),
          ),
        );
      if (activeCount && activeCount.count >= 5) {
        throw new Error("Max 5 active sessions allowed");
      }

      const sessionId = activityId("session", ctx.contributor.id);

      await ctx.db.insert(researchSessions).values({
        id: sessionId,
        contributorId: ctx.contributor.id,
        metadata: input
          ? {
              targetTopic: input.targetTopic,
              bountyId: input.bountyId,
              description: input.description,
            }
          : undefined,
      });

      return { sessionId };
    }),

  close: apiKeyProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.query.researchSessions.findFirst({
        where: and(
          eq(researchSessions.id, input.sessionId),
          eq(researchSessions.contributorId, ctx.contributor.id),
          eq(researchSessions.status, "active"),
        ),
      });
      if (!session) {
        throw new Error("Session not found, not yours, or not active");
      }

      const now = new Date();

      await ctx.db
        .update(researchSessions)
        .set({ status: "closed", closedAt: now })
        .where(eq(researchSessions.id, input.sessionId));

      const [eventCount] = await ctx.db
        .select({ count: count() })
        .from(sessionEvents)
        .where(eq(sessionEvents.sessionId, input.sessionId));

      const durationMs = now.getTime() - session.createdAt.getTime();

      return {
        eventCount: eventCount?.count ?? 0,
        durationMs,
      };
    }),

  get: apiKeyProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.query.researchSessions.findFirst({
        where: and(
          eq(researchSessions.id, input.sessionId),
          eq(researchSessions.contributorId, ctx.contributor.id),
        ),
        with: {
          events: {
            orderBy: (events, { asc }) => [asc(events.createdAt)],
          },
        },
      });
      if (!session) {
        throw new Error("Session not found or not yours");
      }

      return session;
    }),

  getForSubmission: evaluatorProcedure
    .input(z.object({ submissionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const submission = await ctx.db.query.submissions.findFirst({
        where: eq(submissions.id, input.submissionId),
      });
      if (!submission?.sessionId) {
        return null;
      }

      const session = await ctx.db.query.researchSessions.findFirst({
        where: eq(researchSessions.id, submission.sessionId),
        with: {
          events: {
            orderBy: (events, { asc }) => [asc(events.createdAt)],
          },
        },
      });

      return session ?? null;
    }),
});
