/**
 * Core contributor cycle logic.
 *
 * Demonstrates the full contributor loop:
 *   1. List open bounties
 *   2. Claim the first available bounty
 *   3. Research the topic via AI
 *   4. Submit an expansion
 *
 * Importable by both a CLI script and potential cron/API routes.
 */

import { z } from "zod";
import { generateObject } from "ai";
import { createGateway } from "@ai-sdk/gateway";

// ─── Config & Types ──────────────────────────────────────────────────────

export interface ContributorConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Signal to abort the cycle early */
  signal?: AbortSignal;
}

export type Logger = (message: string) => void;

interface Bounty {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  topicId: string | null;
  karmaReward: number;
  topic?: { id: string; title: string } | null;
  claimedBy?: { id: string } | null;
}

export interface CycleResult {
  bountyId: string | null;
  submissionId: string | null;
  durationMs: number;
}

// ─── tRPC HTTP Client ────────────────────────────────────────────────────

const RETRY_DELAYS = [5000, 15000];

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  log: Logger,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt]!;
        log(
          `  [retry] ${label} failed (attempt ${attempt + 1}/${RETRY_DELAYS.length + 1}), retrying in ${delay / 1000}s: ${err.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

function createTrpcClient(baseUrl: string, apiKey: string, log: Logger) {
  async function query<T>(
    path: string,
    input: Record<string, unknown> = {},
  ): Promise<T> {
    return withRetry(
      async () => {
        const url = new URL(`/api/trpc/${path}`, baseUrl);
        url.searchParams.set("input", JSON.stringify({ json: input }));

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`tRPC query ${path} failed: ${res.status} ${text}`);
        }

        const body = (await res.json()) as any;
        if (body.error)
          throw new Error(`tRPC error: ${JSON.stringify(body.error)}`);
        return body.result?.data?.json as T;
      },
      `query:${path}`,
      log,
    );
  }

  async function mutation<T>(
    path: string,
    input: Record<string, unknown> = {},
  ): Promise<T> {
    return withRetry(
      async () => {
        const url = new URL(`/api/trpc/${path}`, baseUrl);

        const res = await fetch(url.toString(), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ json: input }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `tRPC mutation ${path} failed: ${res.status} ${text}`,
          );
        }

        const body = (await res.json()) as any;
        if (body.error)
          throw new Error(`tRPC error: ${JSON.stringify(body.error)}`);
        return body.result?.data?.json as T;
      },
      `mutation:${path}`,
      log,
    );
  }

  return { query, mutation };
}

// ─── AI Research ─────────────────────────────────────────────────────────

const researchOutputSchema = z.object({
  topic: z.object({
    title: z.string().describe("The topic title, matching or refining the bounty title"),
    content: z
      .string()
      .min(1500)
      .describe(
        "Encyclopedia-style article content in Markdown. Must be at least 1500 characters (~300 words). Aim for 800-2000 words with depth, examples, and practical detail.",
      ),
    summary: z
      .string()
      .describe("A 1-2 sentence summary of the topic for previews"),
  }),
  resources: z
    .array(
      z.object({
        name: z.string().describe("Resource title"),
        url: z.string().url().describe("Real, verifiable URL"),
        type: z
          .enum([
            "article",
            "paper",
            "video",
            "course",
            "tool",
            "book",
            "podcast",
            "repository",
          ])
          .describe("Resource type"),
        summary: z
          .string()
          .min(80)
          .describe(
            "Detailed summary (80+ chars): what it covers, key findings, why it is authoritative",
          ),
      }),
    )
    .min(5)
    .describe("At least 5 high-quality resources with real, verifiable URLs"),
  edges: z
    .array(
      z.object({
        targetTopicSlug: z
          .string()
          .describe("Slug of an existing topic to link to"),
        relationType: z
          .enum(["related", "prerequisite", "subtopic", "see_also"])
          .describe("How this topic relates to the target"),
      }),
    )
    .describe("Edges to existing topics in the knowledge graph"),
  tags: z
    .array(z.string())
    .describe("3-8 descriptive tags for the topic"),
});

async function researchTopic(
  bounty: Bounty,
  existingTopics: Array<{ id: string; title: string }>,
  config: ContributorConfig,
  log: Logger,
): Promise<z.infer<typeof researchOutputSchema>> {
  const gateway = createGateway({
    baseURL: "https://ai.anthropic.com/v1",
    apiKey: process.env.AI_GATEWAY_API_KEY,
  });

  const topicList = existingTopics
    .slice(0, 100) // Limit context size
    .map((t) => `- ${t.title} (slug: ${t.id})`)
    .join("\n");

  const prompt = `You are a knowledgeable researcher contributing to OpenLattice, a collaborative knowledge graph.

A bounty has been posted requesting content on the following topic:

**Bounty Title:** ${bounty.title}
**Bounty Description:** ${bounty.description}
**Bounty Type:** ${bounty.type}
${bounty.topic ? `**Parent Topic:** ${bounty.topic.title} (slug: ${bounty.topic.id})` : ""}

Write a comprehensive, encyclopedia-style article about this topic. Your article should:
- Be well-structured with clear sections using Markdown headings (##, ###)
- Include practical examples, real-world applications, and concrete details
- Be factual and authoritative — cite specific names, dates, and findings where relevant
- Be at least 800 words (aim for 1000-2000 words)
- Use an informative, neutral tone suitable for a knowledge base

Find at least 5 real, verifiable resources (articles, papers, tools, courses, etc.) that support the content. Each resource MUST:
- Have a real URL that exists on the internet (do NOT fabricate URLs)
- Include a detailed summary (80+ characters) explaining what it covers and why it is valuable
- Be from an authoritative source

Suggest edges (links) to existing topics in the knowledge graph where relevant. Here are the existing topics:
${topicList || "(No existing topics yet)"}

Also suggest 3-8 descriptive tags for categorization.`;

  log(`  [research] Generating content for "${bounty.title}"...`);
  const startMs = Date.now();

  const { object } = await generateObject({
    model: gateway(config.model),
    schema: researchOutputSchema,
    prompt,
  });

  const durationMs = Date.now() - startMs;
  log(
    `  [research] Generated ${object.topic.content.length} chars, ${object.resources.length} resources, ${object.edges.length} edges (${durationMs}ms)`,
  );

  return object;
}

// ─── Main Cycle ──────────────────────────────────────────────────────────

export async function runContributorCycle(
  config: ContributorConfig,
  log: Logger = console.log,
): Promise<CycleResult> {
  const start = Date.now();
  const trpc = createTrpcClient(config.baseUrl, config.apiKey, log);

  log(
    `\n${"=".repeat(60)}\n[Contributor] Cycle — ${new Date().toISOString()}\n${"=".repeat(60)}`,
  );

  // 1. List open bounties
  log("  [bounties] Fetching open bounties...");
  const allBounties = await trpc.query<Bounty[]>("bounties.listOpen", {});

  if (!allBounties?.length) {
    log("  [bounties] No open bounties found. Nothing to do.");
    return { bountyId: null, submissionId: null, durationMs: Date.now() - start };
  }

  // 2. Pick first bounty that is truly open (not claimed by someone else)
  const bounty = allBounties.find(
    (b) => b.status === "open" || (b.status === "claimed" && !b.claimedBy),
  );

  if (!bounty) {
    log(
      `  [bounties] ${allBounties.length} bounties found but all are claimed. Waiting.`,
    );
    return { bountyId: null, submissionId: null, durationMs: Date.now() - start };
  }

  log(
    `  [bounties] Selected: "${bounty.title}" (${bounty.karmaReward} karma, type: ${bounty.type})`,
  );

  // 3. Claim the bounty
  log(`  [claim] Claiming bounty ${bounty.id}...`);
  try {
    const claimResult = await trpc.mutation<{ id: string; hasExistingContent: boolean }>(
      "bounties.claim",
      { bountyId: bounty.id },
    );
    log(
      `  [claim] Claimed successfully${claimResult.hasExistingContent ? " (has existing content — will merge)" : ""}`,
    );
  } catch (err: any) {
    log(`  [claim] Failed to claim bounty: ${err.message}`);
    return { bountyId: bounty.id, submissionId: null, durationMs: Date.now() - start };
  }

  // 4. Fetch existing topics for edge suggestions
  const existingTopics = await trpc.query<Array<{ id: string; title: string }>>(
    "topics.list",
    { status: "published" },
  );

  // 5. Research the topic via AI
  let research: z.infer<typeof researchOutputSchema>;
  try {
    research = await researchTopic(
      bounty,
      existingTopics ?? [],
      config,
      log,
    );
  } catch (err: any) {
    log(`  [research] AI research failed: ${err.message}`);
    return { bountyId: bounty.id, submissionId: null, durationMs: Date.now() - start };
  }

  // 6. Submit the expansion
  log("  [submit] Submitting expansion...");
  try {
    const submission = await trpc.mutation<{ id: string; status: string }>(
      "expansions.submit",
      {
        topic: {
          title: research.topic.title,
          content: research.topic.content,
          summary: research.topic.summary,
          parentTopicSlug: bounty.topic?.id,
        },
        resources: research.resources,
        edges: research.edges,
        tags: research.tags,
        bountyId: bounty.id,
      },
    );

    const durationMs = Date.now() - start;
    const elapsed = (durationMs / 1000).toFixed(1);
    log(
      `\n[Contributor] Cycle complete in ${elapsed}s — submitted "${research.topic.title}" (${submission.id}, status: ${submission.status})`,
    );

    return { bountyId: bounty.id, submissionId: submission.id, durationMs };
  } catch (err: any) {
    log(`  [submit] Submission failed: ${err.message}`);
    return { bountyId: bounty.id, submissionId: null, durationMs: Date.now() - start };
  }
}
