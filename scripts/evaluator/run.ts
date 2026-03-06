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
  suggestEdges,
  suggestTags,
  suggestIcon,
  scoreResource,
  analyzeGaps,
} from "./ai.js";

/** Local slugify — mirrors src/lib/utils.ts#slugify */
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const BASE_URL = process.env.OPENLATTICE_URL ?? "http://localhost:3000";
const API_KEY = process.env.EVALUATOR_API_KEY;
const POLL_INTERVAL_MS =
  (parseInt(process.env.POLL_INTERVAL ?? "60") || 60) * 1000;
const GAP_ANALYSIS_EVERY =
  parseInt(process.env.GAP_ANALYSIS_EVERY ?? "3") || 3;

if (!API_KEY) {
  console.error("Missing EVALUATOR_API_KEY. Run the seed script first.");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY. Needed for AI evaluation.");
  process.exit(1);
}

// ─── tRPC Client with Retry ───────────────────────────────────────────────

const RETRY_DELAYS = [5000, 15000]; // 5s, 15s backoff

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt]!;
        console.warn(`  [retry] ${label} failed (attempt ${attempt + 1}/${RETRY_DELAYS.length + 1}), retrying in ${delay / 1000}s: ${err.message}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function trpcQuery<T>(
  path: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  return withRetry(async () => {
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
  }, `query:${path}`);
}

async function trpcMutation<T>(
  path: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  return withRetry(async () => {
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
  }, `mutation:${path}`);
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

interface Bounty {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  topicId: string | null;
  karmaReward: number;
  topic?: { id: string } | null;
}

// ─── Evaluation Passes ────────────────────────────────────────────────────

async function reviewPendingSubmissions(): Promise<number> {
  let reviewed = 0;

  const expansions = await trpcQuery<Submission[]>(
    "evaluator.listPendingSubmissions",
    { type: "expansion" },
  );
  const bountyResponses = await trpcQuery<Submission[]>(
    "evaluator.listPendingSubmissions",
    { type: "bounty_response" },
  );
  const submissions = [
    ...(expansions ?? []),
    ...(bountyResponses ?? []),
  ];

  if (!submissions.length) return 0;

  // Get existing topics for context (edges need title+summary for AI suggestion)
  const allTopics = await trpcQuery<Array<{ id: string; title: string; summary: string | null }>>(
    "topics.list",
    { status: "published" },
  );
  const existingTopicIds = allTopics?.map((t) => t.id) ?? [];

  // Get existing tags for tag suggestion context
  const allTags = await trpcQuery<Array<{ name: string }>>("tags.list", {});
  const existingTagNames = allTags?.map((t) => t.name) ?? [];

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

      // 1. Content review
      const { result, durationMs, model } = await reviewExpansion(
        expansion,
        {
          existingTopicIds,
          contributorName: contributor?.name ?? "unknown",
          contributorTrustLevel: contributor?.trustLevel ?? "new",
          contributorAcceptanceRate: acceptanceRate,
        },
      );

      // 2. Independent edge suggestion + diff
      let edgeDiff: {
        submittedEdges: Array<{ targetTopicSlug: string; relationType: string }>;
        evaluatorEdges: Array<{ targetTopicSlug: string; relationType: string; reasoning: string }>;
        matchedTargets: number;
        matchedExact: number;
        missingEdges: number;
        extraEdges: number;
        accuracy: number;
        karmaDelta: number;
      } | null = null;

      if (allTopics?.length && allTopics.length > 0) {
        try {
          const { result: edgeResult, durationMs: edgeDurationMs } = await suggestEdges(
            {
              title: expansion.topic.title,
              content: expansion.topic.content,
              summary: expansion.topic.summary,
            },
            (allTopics ?? []).map((t) => ({
              id: t.id,
              title: t.title,
              summary: t.summary ?? undefined,
            })),
          );

          const submittedEdges: Array<{ targetTopicSlug: string; relationType: string }> =
            expansion.edges ?? [];
          const evaluatorEdges = edgeResult.suggestedEdges;

          // Diff: how many of the evaluator's edges did the submitter also propose?
          const evaluatorTargets = new Set(evaluatorEdges.map((e) => e.targetTopicSlug));
          const submittedTargets = new Set(submittedEdges.map((e) => e.targetTopicSlug));

          let matchedTargets = 0;
          let matchedExact = 0;
          for (const evalEdge of evaluatorEdges) {
            if (submittedTargets.has(evalEdge.targetTopicSlug)) {
              matchedTargets++;
              const submittedMatch = submittedEdges.find(
                (e) => e.targetTopicSlug === evalEdge.targetTopicSlug,
              );
              if (submittedMatch?.relationType === evalEdge.relationType) {
                matchedExact++;
              }
            }
          }

          // Edges the submitter proposed that the evaluator didn't
          let extraEdges = 0;
          for (const slug of submittedTargets) {
            if (!evaluatorTargets.has(slug)) extraEdges++;
          }

          // Edges the evaluator suggests that the submitter missed
          const missingEdges = evaluatorEdges.length - matchedTargets;

          // Accuracy: ratio of correct edges over the union of both sets
          const totalUnique = new Set([...evaluatorTargets, ...submittedTargets]).size;
          const accuracy = totalUnique > 0 ? matchedExact / totalUnique : 1; // both empty = perfect

          // Karma adjustment: -5 (bad) to +5 (perfect)
          let karmaDelta = 0;
          if (totalUnique === 0) {
            karmaDelta = 0; // both agree: no edges needed
          } else if (accuracy >= 0.8) {
            karmaDelta = 5; // excellent edge work
          } else if (accuracy >= 0.5) {
            karmaDelta = 2; // decent
          } else if (accuracy >= 0.2) {
            karmaDelta = -2; // poor
          } else {
            karmaDelta = -5; // completely wrong
          }

          edgeDiff = {
            submittedEdges,
            evaluatorEdges,
            matchedTargets,
            matchedExact,
            missingEdges,
            extraEdges,
            accuracy,
            karmaDelta,
          };

          console.log(
            `  [review] Edge diff: ${matchedExact}/${totalUnique} exact match (accuracy: ${(accuracy * 100).toFixed(0)}%, karma: ${karmaDelta > 0 ? "+" : ""}${karmaDelta}) [${edgeDurationMs}ms]`,
          );
        } catch (err: any) {
          console.error(`  [review] Edge suggestion failed:`, err.message);
        }
      }

      // 3. Independent tag suggestion
      let tagResult: {
        submittedTags: string[];
        evaluatorTags: string[];
        resolvedTags: string[];
      } | null = null;

      try {
        const submittedTags: string[] = expansion.tags ?? [];
        const { result: tagSuggestion, durationMs: tagDurationMs } = await suggestTags(
          {
            title: expansion.topic.title,
            content: expansion.topic.content,
            summary: expansion.topic.summary,
          },
          existingTagNames,
          submittedTags,
        );

        tagResult = {
          submittedTags,
          evaluatorTags: tagSuggestion.suggestedTags,
          resolvedTags: tagSuggestion.suggestedTags,
        };

        console.log(
          `  [review] Tags: evaluator=[${tagSuggestion.suggestedTags.join(", ")}] submitted=[${submittedTags.join(", ")}] [${tagDurationMs}ms]`,
        );
      } catch (err: any) {
        console.error(`  [review] Tag suggestion failed:`, err.message);
      }

      // 4. Icon suggestion (only if approving)
      let iconResult: { icon: string; iconHue: number } | null = null;
      if (result.verdict === "approve") {
        try {
          const { result: iconSuggestion, durationMs: iconDurationMs } = await suggestIcon({
            title: expansion.topic.title,
            summary: expansion.topic.summary,
          });
          iconResult = iconSuggestion;
          console.log(
            `  [review] Icon: ${iconSuggestion.icon} (hue: ${iconSuggestion.iconHue}) [${iconDurationMs}ms]`,
          );
        } catch (err: any) {
          console.error(`  [review] Icon suggestion failed:`, err.message);
        }
      }

      // Map AI verdict to submission status
      const verdictToStatus = {
        approve: "approved",
        reject: "rejected",
        revise: "revision_requested",
      } as const;
      const submissionVerdict = verdictToStatus[result.verdict];

      // Combine karma: content review + edge accuracy bonus/penalty
      // For revisions, apply a mild penalty (0 or -1) instead of full negative delta
      const baseKarma = result.verdict === "revise"
        ? Math.min(result.suggestedReputationDelta, -1)
        : result.suggestedReputationDelta;
      const totalReputationDelta =
        baseKarma + (result.verdict !== "revise" ? (edgeDiff?.karmaDelta ?? 0) : 0);

      const reviewResult = await trpcMutation<{ submission: any; topicId: string | null }>("evaluator.reviewSubmission", {
        submissionId: submission.id,
        verdict: submissionVerdict,
        reasoning: result.reasoning,
        reputationDelta: totalReputationDelta,
        resolvedTags: tagResult?.resolvedTags,
        resolvedEdges: edgeDiff?.evaluatorEdges.map((e) => ({
          targetTopicSlug: e.targetTopicSlug,
          relationType: e.relationType,
        })),
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
          edgeDiff: edgeDiff
            ? {
                submittedEdges: edgeDiff.submittedEdges,
                evaluatorEdges: edgeDiff.evaluatorEdges,
                matchedTargets: edgeDiff.matchedTargets,
                matchedExact: edgeDiff.matchedExact,
                missingEdges: edgeDiff.missingEdges,
                extraEdges: edgeDiff.extraEdges,
                accuracy: edgeDiff.accuracy,
                karmaDelta: edgeDiff.karmaDelta,
              }
            : null,
          tagDiff: tagResult
            ? {
                submittedTags: tagResult.submittedTags,
                evaluatorTags: tagResult.evaluatorTags,
                resolvedTags: tagResult.resolvedTags,
              }
            : null,
        },
      });

      // Apply icon to the newly created topic (post-materialization — only on approve)
      if (result.verdict === "approve" && iconResult && reviewResult?.topicId) {
        try {
          await trpcMutation("evaluator.setTopicIcon", {
            topicId: reviewResult.topicId,
            icon: iconResult.icon,
            iconHue: iconResult.iconHue,
          });
        } catch (err: any) {
          // May fail if topic wasn't created (slug conflict) — that's OK
          console.error(`  [review] Icon application failed:`, err.message);
        }
      }

      reviewed++;
      const statusIcon = result.verdict === "approve" ? "+" : result.verdict === "revise" ? "~" : "-";
      console.log(
        `  [review] ${statusIcon} ${result.verdict.toUpperCase()} (${result.overallScore}/100, karma: ${totalReputationDelta > 0 ? "+" : ""}${totalReputationDelta}, ${durationMs}ms) — ${result.reasoning.slice(0, 80)}`,
      );
    } catch (err: any) {
      console.error(`  [review] Failed on ${submission.id}:`, err.message);
    }
  }

  return reviewed;
}

async function reviewPendingResources(): Promise<number> {
  let reviewed = 0;

  const submissions = await trpcQuery<Submission[]>(
    "evaluator.listPendingSubmissions",
    { type: "resource" },
  );

  if (!submissions?.length) return 0;

  for (const submission of submissions) {
    try {
      const resData = submission.data as any;
      if (!resData?.name || !resData?.type) {
        console.log(
          `  [resource-review] Skipping ${submission.id.slice(0, 8)}... — invalid resource data`,
        );
        continue;
      }

      const contributor = submission.contributor;
      console.log(
        `  [resource-review] Evaluating "${resData.name}" from ${contributor?.name ?? "unknown"}...`,
      );

      const { result, durationMs, model } = await scoreResource({
        name: resData.name,
        url: resData.url,
        type: resData.type,
        summary: resData.summary,
      });

      const approved = result.score >= 50;
      const reputationDelta = approved ? 5 : -2;

      await trpcMutation("evaluator.reviewSubmission", {
        submissionId: submission.id,
        verdict: approved ? "approved" : "rejected",
        reasoning: result.reasoning,
        reputationDelta,
        evaluationTrace: {
          type: "resource_submission_review",
          model,
          durationMs,
          score: result.score,
          relevance: result.relevance,
          authority: result.authority,
          practicalValue: result.practicalValue,
          verdict: approved ? "approve" : "reject",
          resourceName: resData.name,
          contributorName: contributor?.name,
        },
      });

      reviewed++;
      const icon = approved ? "+" : "-";
      console.log(
        `  [resource-review] ${icon} ${approved ? "APPROVED" : "REJECTED"} (${result.score}/100, ${durationMs}ms) — ${result.reasoning.slice(0, 80)}`,
      );
    } catch (err: any) {
      console.error(`  [resource-review] Failed on ${submission.id}:`, err.message);
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

async function runGapAnalysis(): Promise<number> {
  try {
    const topics = await trpcQuery<
      Array<{
        id: string;
        title: string;
        content: string;
        topicResources: Array<unknown>;
        childTopics: Array<unknown>;
      }>
    >("topics.list", { status: "published" });

    if (!topics?.length || topics.length < 5) return 0;

    const topicStats = topics.map((t) => ({
      id: t.id,
      title: t.title,
      resourceCount: t.topicResources?.length ?? 0,
      hasSubtopics: (t.childTopics?.length ?? 0) > 0,
      contentLength: t.content?.length ?? 0,
    }));

    // Fetch existing open bounties to avoid duplicates
    const openBounties = await trpcQuery<Bounty[]>(
      "bounties.list",
      { status: "open" },
    );
    const existingBounties = (openBounties ?? []).map((b) => ({
      title: b.title,
      topicSlug: b.topic?.id,
    }));

    console.log(
      `  [gaps] Analyzing ${topicStats.length} topics for gaps (${existingBounties.length} existing bounties)...`,
    );

    const { result, durationMs } = await analyzeGaps(topicStats, existingBounties);

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

  let reviewed = 0, resourcesReviewed = 0, scored = 0, bountiesPosted = 0;

  try { reviewed = await reviewPendingSubmissions(); }
  catch (err: any) { console.error("[Arbiter] reviewPendingSubmissions failed:", err.message); }

  try { resourcesReviewed = await reviewPendingResources(); }
  catch (err: any) { console.error("[Arbiter] reviewPendingResources failed:", err.message); }

  try { scored = await scoreUnscoredResources(); }
  catch (err: any) { console.error("[Arbiter] scoreUnscoredResources failed:", err.message); }

  // Gap analysis every N cycles (configurable via GAP_ANALYSIS_EVERY)
  if (cycleCount % GAP_ANALYSIS_EVERY === 0) {
    try { bountiesPosted = await runGapAnalysis(); }
    catch (err: any) { console.error("[Arbiter] runGapAnalysis failed:", err.message); }
  }

  try { await recalculateReputation(); }
  catch (err: any) { console.error("[Arbiter] recalculateReputation failed:", err.message); }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `\n[Arbiter] Cycle #${cycleCount} complete in ${elapsed}s` +
      ` — expansions: ${reviewed}, resources: ${resourcesReviewed}, scored: ${scored}` +
      (bountiesPosted > 0 ? `, bounties: ${bountiesPosted}` : ""),
  );
}

const ONCE = process.argv.includes("--once");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log(`
====================================================
  Arbiter — OpenLattice Evaluator Agent
====================================================
  URL:      ${BASE_URL}
  Model:    ${process.env.EVALUATOR_MODEL ?? "claude-haiku-4-5-20251001"}
  Mode:     ${ONCE ? "single cycle" : `polling (${POLL_INTERVAL_MS / 1000}s)`}
====================================================
`);

  await runEvaluationCycle();

  if (ONCE) {
    console.log("[Arbiter] Single cycle complete, exiting.");
    process.exit(0);
  }

  // Sequential loop prevents overlapping cycles (unlike setInterval)
  while (true) {
    await sleep(POLL_INTERVAL_MS);
    try {
      await runEvaluationCycle();
    } catch (err) {
      console.error("[Arbiter] Unhandled cycle error:", err);
    }
  }
}

main().catch((err) => {
  console.error("[Arbiter] Fatal error:", err);
  process.exit(1);
});
