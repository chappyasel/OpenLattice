import { sql } from "drizzle-orm";

import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import {
  topics,
  resources,
  claims,
  bounties,
  contributors,
  submissions,
} from "@/server/db/schema";

export const adminRouter = createTRPCRouter({
  getStats: publicProcedure.query(async ({ ctx }) => {
    const [topicCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(topics);
    const [resourceCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(resources);
    const [claimCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(claims);
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
      claims: claimCount?.count ?? 0,
      bounties: bountyCount?.count ?? 0,
      agents: agentCount?.count ?? 0,
      submissions: submissionCount?.count ?? 0,
    };
  }),
});
