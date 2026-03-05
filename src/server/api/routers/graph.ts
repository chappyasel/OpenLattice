import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  apiKeyProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import { edges, topics, claims } from "@/server/db/schema";

export const graphRouter = createTRPCRouter({
  getFullGraph: publicProcedure.query(async ({ ctx }) => {
    const nodes = await ctx.db.query.topics.findMany({
      where: eq(topics.status, "published"),
    });

    const allEdges = await ctx.db.query.edges.findMany();

    const publishedIds = new Set(nodes.map((n) => n.id));
    const filteredEdges = allEdges.filter(
      (e) =>
        publishedIds.has(e.sourceTopicId) && publishedIds.has(e.targetTopicId),
    );

    // Also fetch claims for the graph
    const allClaims = await ctx.db.query.claims.findMany({
      with: { createdBy: true },
    });

    return { nodes, edges: filteredEdges, claims: allClaims };
  }),

  getSubgraph: publicProcedure
    .input(z.object({ topicId: z.string() }))
    .query(async ({ ctx, input }) => {
      const centerTopic = await ctx.db.query.topics.findFirst({
        where: eq(topics.id, input.topicId),
      });

      const sourceEdges = await ctx.db.query.edges.findMany({
        where: eq(edges.sourceTopicId, input.topicId),
        with: { targetTopic: true },
      });
      const targetEdges = await ctx.db.query.edges.findMany({
        where: eq(edges.targetTopicId, input.topicId),
        with: { sourceTopic: true },
      });

      const allEdges = [...sourceEdges, ...targetEdges];
      const neighborTopics = [
        ...sourceEdges.map((e) => e.targetTopic),
        ...targetEdges.map((e) => e.sourceTopic),
      ];

      const nodes = centerTopic
        ? [centerTopic, ...neighborTopics]
        : neighborTopics;

      return { nodes, edges: allEdges };
    }),

  createEdge: adminProcedure
    .input(
      z.object({
        sourceTopicId: z.string(),
        targetTopicId: z.string(),
        relationType: z
          .enum(["related", "prerequisite", "subtopic", "see_also"])
          .default("related"),
        weight: z.number().int().default(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [edge] = await ctx.db.insert(edges).values(input).returning();
      return edge!;
    }),

  createEdgeWithApiKey: apiKeyProcedure
    .input(
      z.object({
        sourceTopicSlug: z.string(),
        targetTopicSlug: z.string(),
        relationType: z
          .enum(["related", "prerequisite", "subtopic", "see_also"])
          .default("related"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.db.query.topics.findFirst({
        where: eq(topics.slug, input.sourceTopicSlug),
      });
      const target = await ctx.db.query.topics.findFirst({
        where: eq(topics.slug, input.targetTopicSlug),
      });

      if (!source || !target) {
        throw new Error("Source or target topic not found");
      }

      const [edge] = await ctx.db
        .insert(edges)
        .values({
          sourceTopicId: source.id,
          targetTopicId: target.id,
          relationType: input.relationType,
        })
        .onConflictDoNothing()
        .returning();
      return edge;
    }),

  deleteEdge: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(edges)
        .where(eq(edges.id, input.id))
        .returning();
      return deleted!;
    }),
});
