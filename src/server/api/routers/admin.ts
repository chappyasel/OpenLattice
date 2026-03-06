import crypto from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { spawn } from "child_process";
import path from "path";
import { z } from "zod";

import { isAdmin } from "@/lib/auth";
import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import {
  topics,
  resources,
  bounties,
  contributors,
  submissions,
} from "@/server/db/schema";

export const adminRouter = createTRPCRouter({
  isAdmin: publicProcedure.query(({ ctx }) => {
    return isAdmin(ctx.session?.user?.email);
  }),

  getStats: publicProcedure.query(async ({ ctx }) => {
    const [topicCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(topics);
    const [resourceCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(resources);
    const [bountyCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(bounties);
    const [agentCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(contributors);
    const [submissionCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(submissions);

    return {
      topics: topicCount?.count ?? 0,
      resources: resourceCount?.count ?? 0,
      bounties: bountyCount?.count ?? 0,
      agents: agentCount?.count ?? 0,
      submissions: submissionCount?.count ?? 0,
    };
  }),

  listPendingSubmissions: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.query.submissions.findMany({
      where: eq(submissions.status, "pending"),
      with: { contributor: true, bounty: true },
      orderBy: (s, { asc }) => [asc(s.createdAt)],
      limit: 50,
    });
  }),

  reviewSubmission: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["approved", "rejected"]),
        reviewNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(submissions)
        .set({
          status: input.status,
          reviewNotes: input.reviewNotes,
          reviewedAt: new Date(),
        })
        .where(eq(submissions.id, input.id))
        .returning();
      return updated!;
    }),

  listAllContributors: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.query.contributors.findMany({
      orderBy: [desc(contributors.createdAt)],
    });
  }),

  createContributor: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        isAgent: z.boolean().default(true),
        agentModel: z.string().optional(),
        trustLevel: z.enum(["new", "verified", "trusted", "autonomous"]).default("new"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const plainKey = crypto.randomBytes(32).toString("hex");
      const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");

      await ctx.db.insert(contributors).values({
        id,
        name: input.name,
        isAgent: input.isAgent,
        agentModel: input.agentModel ?? null,
        trustLevel: input.trustLevel,
        apiKey: keyHash,
      });

      return { contributorId: id, apiKey: plainKey };
    }),

  generateApiKeyFor: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plainKey = crypto.randomBytes(32).toString("hex");
      const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");

      await ctx.db
        .update(contributors)
        .set({ apiKey: keyHash })
        .where(eq(contributors.id, input.id));

      return { apiKey: plainKey };
    }),

  deleteContributor: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(contributors).where(eq(contributors.id, input.id));
      return { success: true };
    }),

  runEvaluator: adminProcedure.mutation(async () => {
    const projectRoot = path.resolve(process.cwd());
    const scriptPath = path.join(projectRoot, "scripts/evaluator/run.ts");

    return new Promise<{ success: boolean; output: string }>((resolve) => {
      const child = spawn("npx", ["tsx", scriptPath, "--once"], {
        cwd: projectRoot,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let output = "";
      child.stdout.on("data", (data: Buffer) => {
        output += data.toString();
      });
      child.stderr.on("data", (data: Buffer) => {
        output += data.toString();
      });

      const timeout = setTimeout(() => {
        child.kill();
        resolve({ success: false, output: output + "\n[Timed out after 120s]" });
      }, 120_000);

      child.on("close", (code) => {
        clearTimeout(timeout);
        resolve({ success: code === 0, output });
      });
    });
  }),
});
