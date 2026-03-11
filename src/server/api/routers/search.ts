import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { resources, tags, topics, topicResources, topicTags } from "@/server/db/schema";
import { resolveBaseId } from "@/lib/resolve-base";

export const searchRouter = createTRPCRouter({
  query: publicProcedure
    .input(
      z.object({
        q: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(20),
        baseSlug: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { q, limit } = input;
      const pattern = `%${q}%`;
      const baseId = await resolveBaseId(ctx.db, input.baseSlug);

      try {
        // pg_trgm fuzzy search with similarity scoring
        const titleSimilarity =
          sql<number>`similarity(${topics.title}, ${q})`.as(
            "title_similarity",
          );
        const nameSimilarity =
          sql<number>`similarity(${resources.name}, ${q})`.as(
            "name_similarity",
          );

        // Build topic conditions
        const topicConditions = [
          eq(topics.status, "published"),
          or(
            sql`similarity(${topics.title}, ${q}) > 0.1`,
            ilike(topics.content, pattern),
          ),
        ];
        if (baseId) {
          topicConditions.push(eq(topics.baseId, baseId));
        }

        // Build resource conditions
        const resourceConditions = [
          eq(resources.visibility, "public"),
          or(
            sql`similarity(${resources.name}, ${q}) > 0.1`,
            ilike(resources.summary, pattern),
          ),
        ];
        // Filter resources by base via topicResources → topics
        if (baseId) {
          resourceConditions.push(
            inArray(
              resources.id,
              ctx.db
                .select({ id: topicResources.resourceId })
                .from(topicResources)
                .innerJoin(topics, eq(topicResources.topicId, topics.id))
                .where(eq(topics.baseId, baseId)),
            ),
          );
        }

        const [matchedTopicRows, matchedResources] = await Promise.all([
          ctx.db
            .select({
              id: topics.id,
              title: topics.title,
              content: topics.content,
              summary: topics.summary,
              difficulty: topics.difficulty,
              status: topics.status,
              parentTopicId: topics.parentTopicId,
              baseId: topics.baseId,
              materializedPath: topics.materializedPath,
              depth: topics.depth,
              freshnessScore: topics.freshnessScore,
              lastContributedAt: topics.lastContributedAt,
              contributorCount: topics.contributorCount,
              sourceCount: topics.sourceCount,
              isFeatured: topics.isFeatured,
              icon: topics.icon,
              iconHue: topics.iconHue,
              sortOrder: topics.sortOrder,
              createdById: topics.createdById,
              createdAt: topics.createdAt,
              updatedAt: topics.updatedAt,
              titleSimilarity,
            })
            .from(topics)
            .where(and(...topicConditions))
            .orderBy(desc(titleSimilarity))
            .limit(limit),
          ctx.db
            .select({
              id: resources.id,
              name: resources.name,
              url: resources.url,
              type: resources.type,
              summary: resources.summary,
              content: resources.content,
              imageUrls: resources.imageUrls,
              score: resources.score,
              visibility: resources.visibility,
              data: resources.data,
              submittedById: resources.submittedById,
              reviewedAt: resources.reviewedAt,
              reviewNotes: resources.reviewNotes,
              createdAt: resources.createdAt,
              updatedAt: resources.updatedAt,
              nameSimilarity,
            })
            .from(resources)
            .where(and(...resourceConditions))
            .orderBy(desc(nameSimilarity))
            .limit(limit),
        ]);

        // Fetch topicTags for matched topics to preserve the original response shape
        const topicIds = matchedTopicRows.map((t) => t.id);
        const topicTagRows =
          topicIds.length > 0
            ? await ctx.db
                .select({
                  topicTagId: topicTags.id,
                  topicId: topicTags.topicId,
                  tagId: topicTags.tagId,
                  topicTagCreatedAt: topicTags.createdAt,
                  tagId2: tags.id,
                  tagName: tags.name,
                  tagIconHue: tags.iconHue,
                  tagIcon: tags.icon,
                  tagDescription: tags.description,
                  tagCreatedAt: tags.createdAt,
                  tagUpdatedAt: tags.updatedAt,
                })
                .from(topicTags)
                .innerJoin(tags, eq(topicTags.tagId, tags.id))
                .where(
                  sql`${topicTags.topicId} IN ${topicIds}`,
                )
            : [];

        // Group tags by topic ID
        const tagsByTopicId = new Map<
          string,
          Array<{
            id: string;
            topicId: string;
            tagId: string;
            createdAt: Date;
            tag: {
              id: string;
              name: string;
              iconHue: number;
              icon: string;
              description: string;
              createdAt: Date;
              updatedAt: Date;
            };
          }>
        >();
        for (const row of topicTagRows) {
          const arr = tagsByTopicId.get(row.topicId) ?? [];
          arr.push({
            id: row.topicTagId,
            topicId: row.topicId,
            tagId: row.tagId,
            createdAt: row.topicTagCreatedAt,
            tag: {
              id: row.tagId2,
              name: row.tagName,
              iconHue: row.tagIconHue,
              icon: row.tagIcon,
              description: row.tagDescription,
              createdAt: row.tagCreatedAt,
              updatedAt: row.tagUpdatedAt,
            },
          });
          tagsByTopicId.set(row.topicId, arr);
        }

        const matchedTopics = matchedTopicRows.map(
          ({ titleSimilarity: _sim, ...topic }) => ({
            ...topic,
            topicTags: tagsByTopicId.get(topic.id) ?? [],
          }),
        );

        const matchedResourcesClean = matchedResources.map(
          ({ nameSimilarity: _sim, ...resource }) => resource,
        );

        return {
          topics: matchedTopics,
          resources: matchedResourcesClean,
        };
      } catch {
        // Fallback to ILIKE-only search if pg_trgm is not installed
        const fallbackTopicConditions = [
          eq(topics.status, "published"),
          or(
            ilike(topics.title, pattern),
            ilike(topics.content, pattern),
          ),
        ];
        if (baseId) {
          fallbackTopicConditions.push(eq(topics.baseId, baseId));
        }

        const fallbackResourceConditions = [
          eq(resources.visibility, "public"),
          or(
            ilike(resources.name, pattern),
            ilike(resources.summary, pattern),
          ),
        ];
        if (baseId) {
          fallbackResourceConditions.push(
            inArray(
              resources.id,
              ctx.db
                .select({ id: topicResources.resourceId })
                .from(topicResources)
                .innerJoin(topics, eq(topicResources.topicId, topics.id))
                .where(eq(topics.baseId, baseId)),
            ),
          );
        }

        const [matchedTopics, matchedResources] = await Promise.all([
          ctx.db.query.topics.findMany({
            where: and(...fallbackTopicConditions),
            with: {
              topicTags: { with: { tag: true } },
            },
            limit,
          }),
          ctx.db.query.resources.findMany({
            where: and(...fallbackResourceConditions),
            limit,
          }),
        ]);

        return {
          topics: matchedTopics,
          resources: matchedResources,
        };
      }
    }),
});
