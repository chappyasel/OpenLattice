/**
 * Evaluator Agent — Arbiter
 *
 * Runs on a polling loop to evaluate contributions using real AI.
 * Every evaluation produces a rich trace stored in the activity feed
 * for demo visibility on the /evaluator dashboard.
 *
 * Environment variables:
 *   EVALUATOR_API_KEY    — Arbiter's API key (from seed script)
 *   OPENLATTICE_URL      — Platform URL (default: http://localhost:3000)
 *   ANTHROPIC_API_KEY    — For AI evaluation calls
 *   EVALUATOR_MODEL      — Model to use (default: claude-haiku-4-5-20251001)
 *   POLL_INTERVAL        — Seconds between cycles (default: 300)
 *
 * Run with: npx tsx scripts/evaluator/run.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import {
  reviewExpansion,
  scoreResource,
  resolveClaim,
  analyzeGaps,
} from "./ai.js";

const BASE_URL = process.env.OPENLATTICE_URL ?? "http://localhost:3000";
const API_KEY = process.env.EVALUATOR_API_KEY;
const POLL_INTERVAL_MS =
  (parseInt(process.env.POLL_INTERVAL ?? "300") || 300) * 1000;

if (!API_KEY) {
  console.error("Missing EVALUATOR_API_KEY. Run the seed script first.");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY. Needed for AI evaluation.");
  process.exit(1);
}

// ─── tRPC Client ──────────────────────────────────────────────────────────

async function trpcQuery<T>(
  path: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  const url = new URL(`/api/trpc/${path}`, BASE_URL);
  url.searchParams.set("input", JSON.stringify({ json: input }));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`tRPC query ${path} failed: ${res.status} ${text}`);
  }

  const body = (await res.json()) as any;
  if (body.error) throw new Error(`tRPC error: ${JSON.stringify(body.error)}`);
  return body.result?.data?.json as T;
}

async function trpcMutation<T>(
  path: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  const url = new URL(`/api/trpc/${path}`, BASE_URL);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ json: input }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`tRPC mutation ${path} failed: ${res.status} ${text}`);
  }

  const body = (await res.json()) as any;
  if (body.error) throw new Error(`tRPC error: ${JSON.stringify(body.error)}`);
  return body.result?.data?.json as T;
}

// ─── Types ────────────────────────────────────────────────────────────────

interface Submission {
  id: string;
  type: string;
  data: Record<string, unknown>;
  contributorId: string | null;
  contributor?: {
    id: string;
    name: string;
    trustLevel: string;
    acceptedContributions: number;
    totalContributions: number;
  };
}

interface UnscoredResource {
  id: string;
  name: string;
  url: string | null;
  type: string;
  summary: string;
  content: string | null;
}

interface ContestedClaim {
  id: string;
  title: string;
  description: string | null;
  topicId: string | null;
  positions: Array<{
    position: "support" | "oppose";
    stakeAmount: number;
    evidence: string | null;
    contributor: { name: string };
  }>;
}

// ─── Evaluation Passes ────────────────────────────────────────────────────

async function reviewPendingSubmissions(): Promise<number> {
  let reviewed = 0;

  const submissions = await trpcQuery<Submission[]>(
    "evaluator.listPendingSubmissions",
    { type: "expansion" },
  );

  if (!submissions?.length) return 0;

  // Get existing topic slugs for context
  const allTopics = await trpcQuery<Array<{ slug: string }>>(
    "topics.list",
    { status: "published" },
  );
  const existingTopicSlugs = allTopics?.map((t) => t.slug) ?? [];

  for (const submission of submissions) {
    try {
      const expansion = submission.data as any;
      if (!expansion?.topic?.title || !expansion?.topic?.content) {
        console.log(
          `  [review] Skipping ${submission.id.slice(0, 8)}... — invalid expansion data`,
        );
        continue;
      }

      const contributor = submission.contributor;
      const acceptanceRate =
        contributor && contributor.totalContributions > 0
          ? contributor.acceptedContributions / contributor.totalContributions
          : undefined;

      console.log(
        `  [review] Evaluating "${expansion.topic.title}" from ${contributor?.name ?? "unknown"}...`,
      );

      const { result, durationMs, model } = await reviewExpansion(
        expansion,
        {
          existingTopicSlugs,
          contributorName: contributor?.name ?? "unknown",
          contributorTrustLevel: contributor?.trustLevel ?? "new",
          contributorAcceptanceRate: acceptanceRate,
        },
      );

      await trpcMutation("evaluator.reviewSubmission", {
        submissionId: submission.id,
        approved: result.verdict === "approve",
        reasoning: result.reasoning,
        reputationDelta: result.suggestedReputationDelta,
        evaluationTrace: {
          type: "expansion_review",
          model,
          durationMs,
          overallScore: result.overallScore,
          contentAssessment: result.contentAssessment,
          resourceAssessment: result.resourceAssessment,
          edgeAssessment: result.edgeAssessment,
          improvementSuggestions: result.improvementSuggestions,
          verdict: result.verdict,
          topicTitle: expansion.topic.title,
          contributorName: contributor?.name,
        },
      });

      reviewed++;
      const icon = result.verdict === "approve" ? "+" : "-";
      console.log(
        `  [review] ${icon} ${result.verdict.toUpperCase()} (${result.overallScore}/100, ${durationMs}ms) — ${result.reasoning.slice(0, 80)}`,
      );
    } catch (err: any) {
      console.error(`  [review] Failed on ${submission.id}:`, err.message);
    }
  }

  return reviewed;
}

async function scoreUnscoredResources(): Promise<number> {
  let scored = 0;

  const resources = await trpcQuery<UnscoredResource[]>(
    "evaluator.listUnscoredResources",
    {},
  );

  if (!resources?.length) return 0;

  for (const resource of resources) {
    try {
      console.log(`  [score] Scoring "${resource.name.slice(0, 50)}"...`);

      const { result, durationMs, model } = await scoreResource({
        name: resource.name,
        url: resource.url,
        type: resource.type,
        summary: resource.summary,
        content: resource.content,
      });

      await trpcMutation("evaluator.scoreResource", {
        resourceId: resource.id,
        score: result.score,
        evaluationTrace: {
          type: "resource_score",
          model,
          durationMs,
          relevance: result.relevance,
          authority: result.authority,
          practicalValue: result.practicalValue,
          reasoning: result.reasoning,
          resourceName: resource.name,
        },
      });

      scored++;
      console.log(
        `  [score] ${resource.name.slice(0, 40)} -> ${result.score}/100 (${durationMs}ms)`,
      );
    } catch (err: any) {
      console.error(`  [score] Failed on ${resource.id}:`, err.message);
    }
  }

  return scored;
}

async function resolveContestedClaims(): Promise<number> {
  let resolved = 0;

  const claims = await trpcQuery<ContestedClaim[]>(
    "evaluator.listContestedClaims",
    { minPositions: 2 },
  );

  if (!claims?.length) return 0;

  for (const claim of claims) {
    if (claim.positions.length < 2) continue;

    try {
      console.log(`  [resolve] Evaluating "${claim.title.slice(0, 50)}"...`);

      const { result, durationMs, model } = await resolveClaim(
        {
          title: claim.title,
          description: claim.description,
        },
        claim.positions.map((p) => ({
          position: p.position,
          stakeAmount: p.stakeAmount,
          evidence: p.evidence,
          contributorName: p.contributor.name,
        })),
      );

      await trpcMutation("evaluator.resolveClaim", {
        claimId: claim.id,
        resolution: result.resolution,
        resolutionNote: result.reasoning,
        evaluationTrace: {
          type: "claim_resolution",
          model,
          durationMs,
          confidence: result.confidence,
          evidenceAnalysis: result.evidenceAnalysis,
          reasoning: result.reasoning,
          claimTitle: claim.title,
        },
      });

      resolved++;
      const label = result.resolution === "resolved_true" ? "TRUE" : "FALSE";
      console.log(
        `  [resolve] ${label} (confidence: ${(result.confidence * 100).toFixed(0)}%, ${durationMs}ms) — ${result.reasoning.slice(0, 80)}`,
      );
    } catch (err: any) {
      console.error(`  [resolve] Failed on ${claim.id}:`, err.message);
    }
  }

  return resolved;
}

async function runGapAnalysis(): Promise<number> {
  try {
    const topics = await trpcQuery<
      Array<{
        id: string;
        slug: string;
        title: string;
        content: string;
        topicResources: Array<unknown>;
        childTopics: Array<unknown>;
      }>
    >("topics.list", { status: "published" });

    if (!topics?.length || topics.length < 5) return 0;

    const allClaims = await trpcQuery<Array<{ topicId: string | null }>>(
      "claims.list",
      {},
    );
    const claimsByTopic = new Map<string, number>();
    for (const c of allClaims ?? []) {
      if (c.topicId) {
        claimsByTopic.set(c.topicId, (claimsByTopic.get(c.topicId) ?? 0) + 1);
      }
    }

    const topicStats = topics.map((t) => ({
      slug: t.slug,
      title: t.title,
      resourceCount: t.topicResources?.length ?? 0,
      claimCount: claimsByTopic.get(t.id) ?? 0,
      hasSubtopics: (t.childTopics?.length ?? 0) > 0,
      contentLength: t.content?.length ?? 0,
    }));

    console.log(
      `  [gaps] Analyzing ${topicStats.length} topics for gaps...`,
    );

    const { result, durationMs } = await analyzeGaps(topicStats);

    let posted = 0;
    for (const gap of result.gaps) {
      try {
        await trpcMutation("evaluator.postBounty", {
          title: gap.suggestedBounty.title,
          description: gap.suggestedBounty.description,
          type: gap.suggestedBounty.type,
          topicSlug: gap.topicSlug,
          karmaReward: gap.suggestedBounty.karmaReward,
        });
        posted++;
        console.log(
          `  [gaps] Posted bounty: "${gap.suggestedBounty.title}" (${gap.gapType}, ${gap.suggestedBounty.karmaReward} karma)`,
        );
      } catch (err: any) {
        console.error(`  [gaps] Failed to post bounty:`, err.message);
      }
    }

    console.log(
      `  [gaps] Analysis complete (${durationMs}ms), posted ${posted} bounties`,
    );
    return posted;
  } catch (err: any) {
    console.error("  [gaps] Gap analysis failed:", err.message);
    return 0;
  }
}

async function recalculateReputation(): Promise<void> {
  try {
    await trpcMutation("evaluator.recalculateReputation", {});
    console.log("  [reputation] Recalculated reputation scores");
  } catch (err: any) {
    console.error("  [reputation] Failed:", err.message);
  }
}

// ─── Main Loop ────────────────────────────────────────────────────────────

let cycleCount = 0;

async function runEvaluationCycle(): Promise<void> {
  cycleCount++;
  const start = Date.now();
  console.log(
    `\n${"=".repeat(60)}\n[Arbiter] Cycle #${cycleCount} — ${new Date().toISOString()}\n${"=".repeat(60)}`,
  );

  const reviewed = await reviewPendingSubmissions();
  const scored = await scoreUnscoredResources();
  const resolved = await resolveContestedClaims();

  // Gap analysis every 3rd cycle
  let bountiesPosted = 0;
  if (cycleCount % 3 === 0) {
    bountiesPosted = await runGapAnalysis();
  }

  await recalculateReputation();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `\n[Arbiter] Cycle #${cycleCount} complete in ${elapsed}s` +
      ` — reviewed: ${reviewed}, scored: ${scored}, resolved: ${resolved}` +
      (bountiesPosted > 0 ? `, bounties: ${bountiesPosted}` : ""),
  );
}

async function main(): Promise<void> {
  console.log(`
====================================================
  Arbiter — OpenLattice Evaluator Agent
====================================================
  URL:      ${BASE_URL}
  Model:    ${process.env.EVALUATOR_MODEL ?? "claude-haiku-4-5-20251001"}
  Interval: ${POLL_INTERVAL_MS / 1000}s
====================================================
`);

  await runEvaluationCycle();

  setInterval(() => {
    runEvaluationCycle().catch((err) => {
      console.error("[Arbiter] Unhandled cycle error:", err);
    });
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("[Arbiter] Fatal error:", err);
  process.exit(1);
});
