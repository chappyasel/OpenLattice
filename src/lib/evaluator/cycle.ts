/**
 * Core evaluator cycle logic.
 *
 * Importable by both the Vercel cron route and the CLI script.
 * All console output goes through the `log` callback for streaming.
 */

import {
  reviewExpansion,
  suggestEdges,
  suggestTags,
  suggestIcon,
  scoreResource,
  analyzeGaps,
} from "./ai";

// ─── Config & Types ──────────────────────────────────────────────────────

export interface EvaluatorConfig {
  baseUrl: string;
  apiKey: string;
  /** Max submissions to process per cycle (default: unlimited) */
  maxSubmissions?: number;
  /** Run gap analysis this cycle? */
  runGapAnalysis?: boolean;
}

export type Logger = (message: string) => void;

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

export interface CycleResult {
  reviewed: number;
  resourcesReviewed: number;
  scored: number;
  bountiesPosted: number;
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

// ─── Evaluation Passes ───────────────────────────────────────────────────

async function reviewPendingSubmissions(
  trpc: ReturnType<typeof createTrpcClient>,
  log: Logger,
  maxSubmissions?: number,
): Promise<number> {
  let reviewed = 0;

  const expansions = await trpc.query<Submission[]>(
    "evaluator.listPendingSubmissions",
    { type: "expansion" },
  );
  const bountyResponses = await trpc.query<Submission[]>(
    "evaluator.listPendingSubmissions",
    { type: "bounty_response" },
  );
  let submissions = [...(expansions ?? []), ...(bountyResponses ?? [])];

  if (!submissions.length) return 0;

  if (maxSubmissions) {
    submissions = submissions.slice(0, maxSubmissions);
  }

  const allTopics = await trpc.query<
    Array<{ id: string; title: string; summary: string | null }>
  >("topics.list", { status: "published" });
  const existingTopicIds = allTopics?.map((t) => t.id) ?? [];

  const allTags = await trpc.query<Array<{ name: string }>>("tags.list", {});
  const existingTagNames = allTags?.map((t) => t.name) ?? [];

  for (const submission of submissions) {
    try {
      const expansion = submission.data as any;
      if (!expansion?.topic?.title || !expansion?.topic?.content) {
        log(
          `  [review] Skipping ${submission.id.slice(0, 8)}... — invalid expansion data`,
        );
        continue;
      }

      const contributor = submission.contributor;
      const acceptanceRate =
        contributor && contributor.totalContributions > 0
          ? contributor.acceptedContributions / contributor.totalContributions
          : undefined;

      log(
        `  [review] Evaluating "${expansion.topic.title}" from ${contributor?.name ?? "unknown"}...`,
      );

      // 1. Content review
      const { result, durationMs, model } = await reviewExpansion(expansion, {
        existingTopicIds,
        contributorName: contributor?.name ?? "unknown",
        contributorTrustLevel: contributor?.trustLevel ?? "new",
        contributorAcceptanceRate: acceptanceRate,
      });

      // 1b. Hard guardrails — override AI verdict when minimum standards aren't met
      const wordCount = expansion.topic.content.trim().split(/\s+/).length;
      const resourceCount = (expansion.resources ?? []).length;

      if (result.verdict === "approve" && wordCount < 800) {
        result.verdict = "revise";
        result.reasoning = `Content is only ~${wordCount} words. Minimum is 800 words for a substantive encyclopedia-style article. ${result.reasoning}`;
        result.improvementSuggestions = [
          `Expand content from ~${wordCount} to at least 800 words with more depth, examples, and practical detail.`,
          ...result.improvementSuggestions,
        ];
        log(`  [review] Override: approve→revise (${wordCount} words < 800 minimum)`);
      }

      if (result.verdict === "approve" && resourceCount < 3) {
        result.verdict = "revise";
        result.reasoning = `Only ${resourceCount} resource(s) provided. Minimum is 3 high-quality resources from web research. ${result.reasoning}`;
        result.improvementSuggestions = [
          `Add at least ${3 - resourceCount} more resources with real URLs from web research.`,
          ...result.improvementSuggestions,
        ];
        log(`  [review] Override: approve→revise (${resourceCount} resources < 3 minimum)`);
      }

      if (result.verdict === "approve" && result.overallScore < 70) {
        result.verdict = "revise";
        result.reasoning = `Score ${result.overallScore}/100 is below the 70-point approval threshold. ${result.reasoning}`;
        result.improvementSuggestions = [
          "Improve overall quality to meet the 70/100 approval threshold.",
          ...result.improvementSuggestions,
        ];
        log(`  [review] Override: approve→revise (score ${result.overallScore} < 70 threshold)`);
      }

      // 2. Edge suggestion + diff
      let edgeDiff: {
        submittedEdges: Array<{
          targetTopicSlug: string;
          relationType: string;
        }>;
        evaluatorEdges: Array<{
          targetTopicSlug: string;
          relationType: string;
          reasoning: string;
        }>;
        matchedTargets: number;
        matchedExact: number;
        missingEdges: number;
        extraEdges: number;
        accuracy: number;
        karmaDelta: number;
      } | null = null;

      if (allTopics?.length && allTopics.length > 0) {
        try {
          const { result: edgeResult, durationMs: edgeDurationMs } =
            await suggestEdges(
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

          const submittedEdges: Array<{
            targetTopicSlug: string;
            relationType: string;
          }> = expansion.edges ?? [];
          const evaluatorEdges = edgeResult.suggestedEdges;

          const evaluatorTargets = new Set(
            evaluatorEdges.map((e) => e.targetTopicSlug),
          );
          const submittedTargets = new Set(
            submittedEdges.map((e) => e.targetTopicSlug),
          );

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

          let extraEdges = 0;
          for (const slug of submittedTargets) {
            if (!evaluatorTargets.has(slug)) extraEdges++;
          }

          const missingEdges = evaluatorEdges.length - matchedTargets;
          const totalUnique = new Set([
            ...evaluatorTargets,
            ...submittedTargets,
          ]).size;
          const accuracy =
            totalUnique > 0 ? matchedExact / totalUnique : 1;

          let karmaDelta = 0;
          if (totalUnique === 0) {
            karmaDelta = 0;
          } else if (accuracy >= 0.8) {
            karmaDelta = 5;
          } else if (accuracy >= 0.5) {
            karmaDelta = 2;
          } else if (accuracy >= 0.2) {
            karmaDelta = -2;
          } else {
            karmaDelta = -5;
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

          log(
            `  [review] Edge diff: ${matchedExact}/${totalUnique} exact match (accuracy: ${(accuracy * 100).toFixed(0)}%, karma: ${karmaDelta > 0 ? "+" : ""}${karmaDelta}) [${edgeDurationMs}ms]`,
          );
        } catch (err: any) {
          log(`  [review] Edge suggestion failed: ${err.message}`);
        }
      }

      // 3. Tag suggestion
      let tagResult: {
        submittedTags: string[];
        evaluatorTags: string[];
        resolvedTags: string[];
      } | null = null;

      try {
        const submittedTags: string[] = expansion.tags ?? [];
        const { result: tagSuggestion, durationMs: tagDurationMs } =
          await suggestTags(
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

        log(
          `  [review] Tags: evaluator=[${tagSuggestion.suggestedTags.join(", ")}] submitted=[${submittedTags.join(", ")}] [${tagDurationMs}ms]`,
        );
      } catch (err: any) {
        log(`  [review] Tag suggestion failed: ${err.message}`);
      }

      // 4. Icon suggestion (only if approving)
      let iconResult: { icon: string; iconHue: number } | null = null;
      if (result.verdict === "approve") {
        try {
          const { result: iconSuggestion, durationMs: iconDurationMs } =
            await suggestIcon({
              title: expansion.topic.title,
              summary: expansion.topic.summary,
            });
          iconResult = iconSuggestion;
          log(
            `  [review] Icon: ${iconSuggestion.icon} (hue: ${iconSuggestion.iconHue}) [${iconDurationMs}ms]`,
          );
        } catch (err: any) {
          log(`  [review] Icon suggestion failed: ${err.message}`);
        }
      }

      // Map verdict
      const verdictToStatus = {
        approve: "approved",
        reject: "rejected",
        revise: "revision_requested",
      } as const;
      const submissionVerdict = verdictToStatus[result.verdict];

      const baseKarma =
        result.verdict === "revise"
          ? Math.min(result.suggestedReputationDelta, -1)
          : result.suggestedReputationDelta;
      const totalReputationDelta =
        baseKarma +
        (result.verdict !== "revise" ? (edgeDiff?.karmaDelta ?? 0) : 0);

      const reviewResult = await trpc.mutation<{
        submission: any;
        topicId: string | null;
      }>("evaluator.reviewSubmission", {
        submissionId: submission.id,
        verdict: submissionVerdict,
        reasoning: result.reasoning,
        reputationDelta: totalReputationDelta,
        resolvedTags: tagResult?.resolvedTags,
        resolvedEdges: edgeDiff?.evaluatorEdges.map((e) => ({
          targetTopicSlug: e.targetTopicSlug,
          relationType: e.relationType,
        })),
        icon: iconResult?.icon,
        iconHue: iconResult?.iconHue,
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

      reviewed++;
      const statusIcon =
        result.verdict === "approve"
          ? "+"
          : result.verdict === "revise"
            ? "~"
            : "-";
      log(
        `  [review] ${statusIcon} ${result.verdict.toUpperCase()} (${result.overallScore}/100, karma: ${totalReputationDelta > 0 ? "+" : ""}${totalReputationDelta}, ${durationMs}ms) — ${result.reasoning.slice(0, 80)}`,
      );
    } catch (err: any) {
      log(`  [review] Failed on ${submission.id}: ${err.message}`);
    }
  }

  return reviewed;
}

async function reviewPendingResources(
  trpc: ReturnType<typeof createTrpcClient>,
  log: Logger,
  maxSubmissions?: number,
): Promise<number> {
  let reviewed = 0;

  const subs = await trpc.query<Submission[]>(
    "evaluator.listPendingSubmissions",
    { type: "resource" },
  );

  let submissions = subs ?? [];
  if (!submissions.length) return 0;
  if (maxSubmissions) submissions = submissions.slice(0, maxSubmissions);

  for (const submission of submissions) {
    try {
      const resData = submission.data as any;
      if (!resData?.name || !resData?.type) {
        log(
          `  [resource-review] Skipping ${submission.id.slice(0, 8)}... — invalid resource data`,
        );
        continue;
      }

      const contributor = submission.contributor;
      log(
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

      await trpc.mutation("evaluator.reviewSubmission", {
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
      log(
        `  [resource-review] ${icon} ${approved ? "APPROVED" : "REJECTED"} (${result.score}/100, ${durationMs}ms) — ${result.reasoning.slice(0, 80)}`,
      );
    } catch (err: any) {
      log(
        `  [resource-review] Failed on ${submission.id}: ${err.message}`,
      );
    }
  }

  return reviewed;
}

async function scoreUnscoredResources(
  trpc: ReturnType<typeof createTrpcClient>,
  log: Logger,
): Promise<number> {
  let scored = 0;

  const resources = await trpc.query<UnscoredResource[]>(
    "evaluator.listUnscoredResources",
    {},
  );

  if (!resources?.length) return 0;

  for (const resource of resources) {
    try {
      log(`  [score] Scoring "${resource.name.slice(0, 50)}"...`);

      const { result, durationMs, model } = await scoreResource({
        name: resource.name,
        url: resource.url,
        type: resource.type,
        summary: resource.summary,
        content: resource.content,
      });

      await trpc.mutation("evaluator.scoreResource", {
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
      log(
        `  [score] ${resource.name.slice(0, 40)} -> ${result.score}/100 (${durationMs}ms)`,
      );
    } catch (err: any) {
      log(`  [score] Failed on ${resource.id}: ${err.message}`);
    }
  }

  return scored;
}

async function doGapAnalysis(
  trpc: ReturnType<typeof createTrpcClient>,
  log: Logger,
): Promise<number> {
  const MIN_OPEN_BOUNTIES = 20;
  const MAX_BOUNTIES_PER_CYCLE = 10;

  try {
    const topics = await trpc.query<
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

    const openBounties = await trpc.query<Bounty[]>("bounties.list", {
      status: "open",
    });
    const openCount = openBounties?.length ?? 0;
    const existingBounties = (openBounties ?? []).map((b) => ({
      title: b.title,
      topicSlug: b.topic?.id,
    }));

    if (openCount >= MIN_OPEN_BOUNTIES) {
      log(
        `  [gaps] ${openCount} open bounties >= ${MIN_OPEN_BOUNTIES} minimum, skipping gap analysis`,
      );
      return 0;
    }

    const targetBountyCount = Math.min(
      MIN_OPEN_BOUNTIES - openCount,
      MAX_BOUNTIES_PER_CYCLE,
    );

    log(
      `  [gaps] Analyzing ${topicStats.length} topics for gaps (${openCount} open bounties, targeting ${targetBountyCount} new)...`,
    );

    const { result, durationMs } = await analyzeGaps(
      topicStats,
      existingBounties,
      targetBountyCount,
    );

    let posted = 0;
    for (const gap of result.gaps) {
      try {
        await trpc.mutation("evaluator.postBounty", {
          title: gap.suggestedBounty.title,
          description: gap.suggestedBounty.description,
          type: gap.suggestedBounty.type,
          topicSlug: gap.topicSlug,
          karmaReward: gap.suggestedBounty.karmaReward,
        });
        posted++;
        log(
          `  [gaps] Posted bounty: "${gap.suggestedBounty.title}" (${gap.gapType}, ${gap.suggestedBounty.karmaReward} karma)`,
        );
      } catch (err: any) {
        log(`  [gaps] Failed to post bounty: ${err.message}`);
      }
    }

    log(
      `  [gaps] Analysis complete (${durationMs}ms), posted ${posted} bounties`,
    );
    return posted;
  } catch (err: any) {
    log(`  [gaps] Gap analysis failed: ${err.message}`);
    return 0;
  }
}

async function recalculateReputation(
  trpc: ReturnType<typeof createTrpcClient>,
  log: Logger,
): Promise<void> {
  try {
    await trpc.mutation("evaluator.recalculateReputation", {});
    log("  [reputation] Recalculated reputation scores");
  } catch (err: any) {
    log(`  [reputation] Failed: ${err.message}`);
  }
}

// ─── Main Cycle ──────────────────────────────────────────────────────────

export async function runEvaluationCycle(
  config: EvaluatorConfig,
  log: Logger = console.log,
): Promise<CycleResult> {
  const start = Date.now();
  const trpc = createTrpcClient(config.baseUrl, config.apiKey, log);

  log(
    `\n${"=".repeat(60)}\n[Arbiter] Cycle — ${new Date().toISOString()}\n${"=".repeat(60)}`,
  );

  let reviewed = 0,
    resourcesReviewed = 0,
    scored = 0,
    bountiesPosted = 0;

  try {
    reviewed = await reviewPendingSubmissions(
      trpc,
      log,
      config.maxSubmissions,
    );
  } catch (err: any) {
    log(`[Arbiter] reviewPendingSubmissions failed: ${err.message}`);
  }

  try {
    resourcesReviewed = await reviewPendingResources(
      trpc,
      log,
      config.maxSubmissions,
    );
  } catch (err: any) {
    log(`[Arbiter] reviewPendingResources failed: ${err.message}`);
  }

  try {
    scored = await scoreUnscoredResources(trpc, log);
  } catch (err: any) {
    log(`[Arbiter] scoreUnscoredResources failed: ${err.message}`);
  }

  if (config.runGapAnalysis) {
    try {
      bountiesPosted = await doGapAnalysis(trpc, log);
    } catch (err: any) {
      log(`[Arbiter] runGapAnalysis failed: ${err.message}`);
    }
  }

  try {
    await recalculateReputation(trpc, log);
  } catch (err: any) {
    log(`[Arbiter] recalculateReputation failed: ${err.message}`);
  }

  const durationMs = Date.now() - start;
  const elapsed = (durationMs / 1000).toFixed(1);
  log(
    `\n[Arbiter] Cycle complete in ${elapsed}s` +
      ` — expansions: ${reviewed}, resources: ${resourcesReviewed}, scored: ${scored}` +
      (bountiesPosted > 0 ? `, bounties: ${bountiesPosted}` : ""),
  );

  return { reviewed, resourcesReviewed, scored, bountiesPosted, durationMs };
}
