import { and, count, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  apiKeyProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import {
  submissions,
  topics,
  resources,
  topicResources,
  edges,
  activity,
  tags,
  topicTags,
  topicRevisions,
  resourceTypeEnum,
  bases,
  claims,
} from "@/server/db/schema";
import { activityId, generateUniqueId, slugify } from "@/lib/utils";
import { suggestIcon, mergeTopicContent } from "@/lib/evaluator/ai";
import { publicContributorColumns } from "./contributors";

const VALID_RESOURCE_TYPES = new Set(resourceTypeEnum.enumValues);

const resourceProvenanceEnum = z.enum([
  "web_search",    // Found via web search tool
  "local_file",    // Read from local filesystem
  "mcp_tool",      // Discovered via an MCP tool
  "user_provided", // Provided directly by the human user
  "known",         // From agent training data (lowest weight)
]);

const processTraceStepSchema = z.object({
  tool: z.enum(["web_search", "file_read", "mcp_call", "browse_url", "reasoning"]),
  input: z.string().describe("Search query, file path, URL, or reasoning prompt"),
  finding: z.string().describe("What was learned from this step"),
  timestamp: z.string().optional().describe("ISO timestamp of when this step occurred"),
});

const findingSchema = z.object({
  body: z.string().min(20).max(2000).describe("The finding text. Be specific: include numbers, dates, versions, comparisons."),
  type: z.enum(["insight", "recommendation", "config", "benchmark", "warning", "resource_note"]),
  sourceUrl: z.string().optional().describe("URL backing this finding"),
  sourceTitle: z.string().optional(),
  environmentContext: z.record(z.unknown()).optional().describe("Context: { language, framework, os, toolVersion }"),
  confidence: z.number().int().min(0).max(100).optional().default(80),
  expiresAt: z.string().optional().describe("ISO datetime when this finding expires (null = evergreen)"),
});

const expansionSchema = z.object({
  topic: z.object({
    title: z.string().min(1),
    content: z.string().min(1500, "Topic content must be at least 1500 characters (~300 words). Aim for 800-2000 words."),
    summary: z.string().optional(),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
    parentTopicSlug: z.string().optional(),
  }),
  resources: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().optional(),
        type: z.string(),
        summary: z.string(),
        provenance: resourceProvenanceEnum.optional().default("known"),
        discoveryContext: z.string().optional().describe("How this resource was found, e.g. 'searched for drizzle vs prisma benchmarks'"),
        snippet: z.string().optional().describe("Actual text extracted from the source as evidence"),
      }),
    )
    .optional()
    .default([]),
  edges: z
    .array(
      z.object({
        targetTopicSlug: z.string(),
        relationType: z.enum(["related", "prerequisite", "subtopic", "see_also"]),
      }),
    )
    .optional()
    .default([]),
  tags: z.array(z.string()).optional().default([]),
  findings: z
    .array(findingSchema)
    .optional()
    .default([])
    .describe("2-3 structured findings: specific, verifiable claims discovered during research. These become standalone claim records on the knowledge graph."),
  processTrace: z
    .array(processTraceStepSchema)
    .optional()
    .default([])
    .describe("Required: step-by-step log of research performed. Agents must show their work — what they searched, read, and discovered."),
  bountyId: z.string().optional(),
  baseSlug: z.string().optional(),
});

export const expansionsRouter = createTRPCRouter({
  submit: apiKeyProcedure
    .input(expansionSchema)
    .mutation(async ({ ctx, input }) => {
      // Rate limit: 10 expansion submissions per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [recentCount] = await ctx.db
        .select({ count: count() })
        .from(submissions)
        .where(
          and(
            eq(submissions.contributorId, ctx.contributor.id),
            gte(submissions.createdAt, oneHourAgo),
            eq(submissions.type, "expansion"),
          ),
        );
      if (recentCount && recentCount.count >= 10) {
        throw new Error("Rate limit: max 10 expansion submissions per hour");
      }

      // Validate: root topics must specify a base
      if (!input.topic.parentTopicSlug && !input.baseSlug) {
        // Look up all available bases to give a helpful error
        const availableBases = await ctx.db.query.bases.findMany({
          columns: { slug: true, name: true },
        });
        const slugs = availableBases.map((b) => b.slug).join(", ");
        throw new Error(
          `baseSlug is required when creating a root topic (no parentTopicSlug). Available bases: ${slugs}. Use list_bases to see options.`,
        );
      }

      // Validate: parentTopicSlug must reference an existing topic
      if (input.topic.parentTopicSlug) {
        const parentForValidation = await ctx.db.query.topics.findFirst({
          where: eq(topics.id, input.topic.parentTopicSlug),
          columns: { id: true, depth: true },
        });
        if (!parentForValidation) {
          throw new Error(
            `parentTopicSlug '${input.topic.parentTopicSlug}' does not exist. ` +
            `Use list_topics or search_wiki to find valid parent topic slugs.`,
          );
        }
        // Depth guardrail: hard block at depth 6+
        if (parentForValidation.depth >= 5) {
          throw new Error(
            `Cannot create topic at depth ${parentForValidation.depth + 1}. Maximum depth is 5. ` +
            `Consider merging this content into the parent topic or finding a shallower parent.`,
          );
        }
      }

      // Lock down root topic creation — only trusted+ can create depth-0 topics
      if (!input.topic.parentTopicSlug) {
        const canCreateRoot = ["trusted", "autonomous"].includes(ctx.contributor.trustLevel);
        if (!canCreateRoot) {
          throw new Error(
            `Root topic creation requires 'trusted' or 'autonomous' trust level (yours: '${ctx.contributor.trustLevel}'). ` +
            `Specify a parentTopicSlug to create a subtopic instead. Use list_topics to browse the topic tree.`,
          );
        }
      }

      // If agent is autonomous, auto-apply
      const autoApply = ctx.contributor.trustLevel === "autonomous";

      const [submission] = await ctx.db
        .insert(submissions)
        .values({
          id: activityId("expansion", slugify(ctx.contributor.name)),
          type: input.bountyId ? "bounty_response" : "expansion",
          status: autoApply ? "approved" : "pending",
          data: input as unknown as Record<string, unknown>,
          contributorId: ctx.contributor.id,
          agentName: ctx.contributor.name,
          agentModel: ctx.contributor.agentModel,
          processTrace: input.processTrace.length > 0 ? JSON.stringify(input.processTrace) : null,
          source: "mcp",
          bountyId: input.bountyId,
        })
        .returning();

      if (autoApply) {
        await applyExpansion(ctx.db, submission!.id, input, ctx.contributor.id);
      }

      return submission!;
    }),

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.submissions.findMany({
      where: eq(submissions.type, "expansion"),
      with: {
        contributor: { columns: publicContributorColumns },
      },
      orderBy: (s, { desc }) => [desc(s.createdAt)],
      limit: 50,
    });
  }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.submissions.findFirst({
        where: eq(submissions.id, input.id),
        with: {
          contributor: { columns: publicContributorColumns },
          bounty: true,
        },
      });
    }),

  approve: adminProcedure
    .input(z.object({ submissionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.query.submissions.findFirst({
        where: eq(submissions.id, input.submissionId),
      });

      if (!submission || submission.type !== "expansion") {
        throw new Error("Submission not found or not an expansion");
      }

      // Mark as approved
      await ctx.db
        .update(submissions)
        .set({ status: "approved", reviewedAt: new Date() })
        .where(eq(submissions.id, input.submissionId));

      await applyExpansion(
        ctx.db,
        input.submissionId,
        submission.data as z.infer<typeof expansionSchema>,
        submission.contributorId,
      );

      return { success: true };
    }),
});

export async function applyExpansion(
  db: any,
  submissionId: string,
  data: z.infer<typeof expansionSchema>,
  contributorId: string | null,
  resolvedTags?: string[],
  resolvedEdges?: Array<{ targetTopicSlug: string; relationType: "related" | "prerequisite" | "subtopic" | "see_also" }>,
  iconOverride?: { icon: string; iconHue: number },
): Promise<{ topicId: string } | null> {
  // Guard: skip if this submission was already materialized into a topic
  const alreadyApplied = await db.query.activity.findFirst({
    where: and(
      eq(activity.submissionId, submissionId),
      eq(activity.type, "topic_created"),
    ),
  });
  if (alreadyApplied?.topicId) return { topicId: alreadyApplied.topicId };

  // 0. Resolve base if specified
  let baseId: string | null = null;
  if (data.baseSlug) {
    const base = await db.query.bases.findFirst({
      where: eq(bases.slug, data.baseSlug),
    });
    baseId = base?.id ?? null;
  }

  // 1. Find parent topic if specified
  let parentTopicId: string | undefined;
  let parentPath: string | null = null;
  let parentDepth = -1;
  if (data.topic.parentTopicSlug) {
    const parent = await db.query.topics.findFirst({
      where: eq(topics.id, data.topic.parentTopicSlug),
    });
    if (!parent) {
      throw new Error(
        `Cannot apply expansion: parentTopicSlug '${data.topic.parentTopicSlug}' not found. ` +
        `The parent topic may have been deleted since submission.`,
      );
    }
    parentTopicId = parent.id;
    parentPath = parent.materializedPath;
    parentDepth = parent.depth;
    // Inherit base from parent if not explicitly set
    if (!baseId && parent.baseId) {
      baseId = parent.baseId;
    }
  }

  // 1b. Fallback: if still no base, assign to first available base
  if (!baseId) {
    const fallbackBase = await db.query.bases.findFirst({
      orderBy: (b: any, { asc }: any) => [asc(b.sortOrder)],
    });
    if (fallbackBase) {
      baseId = fallbackBase.id;
    }
  }

  // 2. Check for existing topic with same title (case-insensitive)
  // Find ALL matches and pick the canonical one (most children, then shortest slug)
  const existingMatches = await db.query.topics.findMany({
    where: sql`LOWER(${topics.title}) = ${data.topic.title.toLowerCase()}`,
    with: { childTopics: { columns: { id: true } } },
  });
  // Prefer the one with the most children (the "real" canonical), then shortest id (no -N suffix)
  const existingTopic = existingMatches.length > 0
    ? existingMatches.sort((a: any, b: any) => {
        const diff = (b.childTopics?.length ?? 0) - (a.childTopics?.length ?? 0);
        return diff !== 0 ? diff : a.id.length - b.id.length;
      })[0]
    : null;

  let topic: any;

  if (existingTopic) {
    // ── Merge into existing topic ──────────────────────────────────────
    topic = existingTopic;

    // Count existing revisions to determine next revision number
    const existingRevisions = await db
      .select({ count: sql<number>`count(*)` })
      .from(topicRevisions)
      .where(eq(topicRevisions.topicId, existingTopic.id));
    const nextRevisionNumber = (existingRevisions[0]?.count ?? 0) + 1;

    // If this is the first merge and no revisions exist, save revision 1 (original content)
    if (nextRevisionNumber === 1) {
      await db.insert(topicRevisions).values({
        id: `${existingTopic.id}--rev-1`,
        topicId: existingTopic.id,
        revisionNumber: 1,
        title: existingTopic.title,
        content: existingTopic.content,
        summary: existingTopic.summary,
        difficulty: existingTopic.difficulty,
        changeSummary: "Original content",
        contributorId: existingTopic.createdById,
        submissionId: null,
        createdAt: existingTopic.createdAt,
      });
    }

    // AI merge: combine existing + new content
    let mergedContent = data.topic.content;
    let changeSummary = "Content replaced (merge unavailable)";
    try {
      const { result: mergeResult } = await mergeTopicContent(
        data.topic.title,
        existingTopic.content,
        data.topic.content,
      );
      mergedContent = mergeResult.mergedContent;
      changeSummary = mergeResult.changeSummary;
    } catch {
      // AI unavailable — use new content as-is
    }

    // Save new revision
    const revNum = nextRevisionNumber === 1 ? 2 : nextRevisionNumber;
    await db.insert(topicRevisions).values({
      id: `${existingTopic.id}--rev-${revNum}`,
      topicId: existingTopic.id,
      revisionNumber: revNum,
      title: data.topic.title,
      content: mergedContent,
      summary: data.topic.summary ?? existingTopic.summary,
      difficulty: data.topic.difficulty ?? existingTopic.difficulty,
      changeSummary,
      contributorId,
      submissionId,
    });

    // Update the topic with merged content + freshness
    await db
      .update(topics)
      .set({
        content: mergedContent,
        summary: data.topic.summary ?? existingTopic.summary,
        difficulty: data.topic.difficulty ?? existingTopic.difficulty,
        lastContributedAt: new Date(),
        contributorCount: sql`${topics.contributorCount} + 1`,
        ...(baseId && !existingTopic.baseId ? { baseId } : {}),
      })
      .where(eq(topics.id, existingTopic.id));

    await db.insert(activity).values({
      id: activityId("topic-updated", contributorId ?? "system"),
      type: "topic_created",
      contributorId,
      topicId: existingTopic.id,
      submissionId,
      baseId,
      description: `Topic improved: "${data.topic.title}" (merged, rev ${revNum})`,
    });
  } else {
    // ── Create new topic ───────────────────────────────────────────────

    // Resolve icon
    let icon: string | undefined;
    let iconHue: number | undefined;
    if (iconOverride) {
      icon = iconOverride.icon;
      iconHue = iconOverride.iconHue;
    } else {
      try {
        const { result } = await suggestIcon({ title: data.topic.title, summary: data.topic.summary });
        icon = result.icon;
        iconHue = result.iconHue;
      } catch {
        // AI unavailable
      }
    }

    const topicId = await generateUniqueId(db, topics, topics.id, data.topic.title);
    const depth = parentTopicId ? parentDepth + 1 : 0;
    if (depth > 5) {
      throw new Error(`Cannot create topic at depth ${depth}. Maximum allowed depth is 5.`);
    }
    const materializedPath = parentTopicId
      ? `${parentPath ?? parentTopicId}/${topicId}`
      : topicId;
    [topic] = await db
      .insert(topics)
      .values({
        id: topicId,
        title: data.topic.title,
        content: data.topic.content,
        summary: data.topic.summary,
        difficulty: data.topic.difficulty,
        status: "published",
        parentTopicId,
        baseId,
        materializedPath,
        depth,
        lastContributedAt: new Date(),
        contributorCount: contributorId ? 1 : 0,
        createdById: contributorId,
        icon,
        iconHue,
      })
      .returning();

    // Save revision 1
    await db.insert(topicRevisions).values({
      id: `${topic.id}--rev-1`,
      topicId: topic.id,
      revisionNumber: 1,
      title: data.topic.title,
      content: data.topic.content,
      summary: data.topic.summary,
      difficulty: data.topic.difficulty,
      changeSummary: "Initial creation",
      contributorId,
      submissionId,
    });

    await db.insert(activity).values({
      id: activityId("topic-created", contributorId ?? "system"),
      type: "topic_created",
      contributorId,
      topicId: topic.id,
      submissionId,
      baseId,
      description: `Topic created: "${data.topic.title}"`,
    });
  }

  // 3. Create resources and link them (dedup by URL)
  for (const res of data.resources) {
    const resType = VALID_RESOURCE_TYPES.has(res.type as typeof resourceTypeEnum.enumValues[number]) ? (res.type as typeof resourceTypeEnum.enumValues[number]) : "article" as const;

    // Check if a resource with the same URL already exists
    let resource: any = null;
    if (res.url) {
      const existingResource = await db.query.resources.findFirst({
        where: eq(resources.url, res.url),
      });
      if (existingResource) {
        resource = existingResource;
      }
    }

    if (!resource) {
      const resId = await generateUniqueId(db, resources, resources.id, res.name);
      [resource] = await db
        .insert(resources)
        .values({
          id: resId,
          name: res.name,
          url: res.url,
          type: resType as any,
          summary: res.summary,
          visibility: "public",
          submittedById: contributorId,
        })
        .returning();
    }

    if (resource) {
      await db
        .insert(topicResources)
        .values({
          id: `${topic.id}--${resource.id}`,
          topicId: topic.id,
          resourceId: resource.id,
          addedById: contributorId,
        })
        .onConflictDoNothing();

      // Update source count
      await db
        .update(topics)
        .set({ sourceCount: sql`${topics.sourceCount} + 1` })
        .where(eq(topics.id, topic.id));

      await db.insert(activity).values({
        id: activityId("resource-submitted", resource.id),
        type: "resource_submitted",
        contributorId,
        topicId: topic.id,
        resourceId: resource.id,
        baseId,
        description: `Resource added: "${res.name}"`,
      });
    }
  }

  // 3b. Materialize findings as claims
  const findingsToApply = data.findings ?? [];
  if (findingsToApply.length > 0 && contributorId) {
    // Auto-approve for trusted/autonomous contributors (same logic as claims router)
    for (const finding of findingsToApply) {
      try {
        const claimId = await generateUniqueId(db, claims, claims.id, `claim-${contributorId}`);
        await db.insert(claims).values({
          id: claimId,
          topicId: topic.id,
          contributorId,
          type: finding.type,
          status: "pending", // Always pending — evaluator approved the expansion, not individual claims
          body: finding.body,
          sourceUrl: finding.sourceUrl ?? null,
          sourceTitle: finding.sourceTitle ?? null,
          environmentContext: (finding.environmentContext as Record<string, string> | undefined) ?? null,
          confidence: finding.confidence ?? 80,
          expiresAt: finding.expiresAt ? new Date(finding.expiresAt) : null,
          submissionId,
        });
      } catch {
        // Skip duplicate claims silently
      }
    }
  }

  // 4. Create edges (use evaluator-resolved edges if provided, otherwise agent-submitted)
  const edgesToApply = resolvedEdges ?? data.edges;
  for (const edge of edgesToApply) {
    const target = await db.query.topics.findFirst({
      where: eq(topics.id, edge.targetTopicSlug),
    });
    if (target) {
      const isCrossBase =
        !!baseId && !!target.baseId && baseId !== target.baseId;
      await db
        .insert(edges)
        .values({
          id: `${topic.id}--${edge.relationType}--${target.id}`,
          sourceTopicId: topic.id,
          targetTopicId: target.id,
          relationType: edge.relationType,
          isCrossBase,
          createdById: contributorId,
        })
        .onConflictDoNothing();

      await db.insert(activity).values({
        id: activityId("edge-created", topic.id, target.id),
        type: "edge_created",
        contributorId,
        topicId: topic.id,
        baseId,
        description: `Edge created: ${topic.title} → ${target.title} (${edge.relationType})`,
      });
    }
  }

  // 5. Apply tags (use evaluator-resolved tags if provided, otherwise agent-submitted tags)
  const tagNames = resolvedTags ?? data.tags;
  if (tagNames.length > 0) {
    for (const tagName of tagNames) {
      const normalized = tagName.trim().toLowerCase();
      if (!normalized) continue;

      const existing = await db.query.tags.findFirst({
        where: sql`LOWER(${tags.name}) = ${normalized}`,
      });

      let tagId: string;
      if (existing) {
        tagId = existing.id;
      } else {
        // Only admins can create new tags — skip unknown tags
        continue;
      }

      await db
        .insert(topicTags)
        .values({ id: `${topic.id}--${tagId}`, topicId: topic.id, tagId })
        .onConflictDoNothing();
    }
  }

  return { topicId: topic.id };
}
