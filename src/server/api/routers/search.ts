import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { resources, topics } from "@/server/db/schema";

export const searchRouter = createTRPCRouter({
  query: publicProcedure
    .input(
      z.object({
        q: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { q, limit } = input;
      const pattern = `%${q}%`;

      const [matchedTopics, matchedResources] =
        await Promise.all([
          ctx.db.query.topics.findMany({
            where: and(
              eq(topics.status, "published"),
              or(
                ilike(topics.title, pattern),
                ilike(topics.content, pattern),
              ),
            ),
            with: {
              topicTags: { with: { tag: true } },
            },
            limit,
          }),
          ctx.db.query.resources.findMany({
            where: and(
              eq(resources.visibility, "public"),
              or(
                ilike(resources.name, pattern),
                ilike(resources.summary, pattern),
              ),
            ),
            limit,
          }),
        ]);

      return {
        topics: matchedTopics,
        resources: matchedResources,
      };
    }),
});
