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
  suggestRestructuring,
} from "./ai";
import { verifyUrls, type UrlVerificationResult } from "./url-verify";

// ─── Config & Types ──────────────────────────────────────────────────────

export interface EvaluatorConfig {
  baseUrl: string;
  apiKey: string;
  /** Max submissions to process per cycle (default: unlimited) */
  maxSubmissions?: number;
  /** Run gap analysis this cycle? */
  runGapAnalysis?: boolean;
  /** Run graph restructuring analysis this cycle? */
  runRestructuring?: boolean;
  /** Signal to abort the cycle early */
  signal?: AbortSignal;
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
  restructuringBounties: number;
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
  consensusMode: "single" | "multi" = "single",
): Promise<number> {
  let reviewed = 0;

  let submissions: Submission[];
  if (consensusMode === "multi") {
    // In multi mode, query all submissions this evaluator hasn't reviewed yet
    const evaluatable = await trpc.query<Submission[]>(
      "evaluator.listEvaluatableSubmissions",
      { limit: maxSubmissions ?? 50 },
    );
    submissions = evaluatable ?? [];
  } else {
    const expansions = await trpc.query<Submission[]>(
      "evaluator.listPendingSubmissions",
      { type: "expansion" },
    );
    const bountyResponses = await trpc.query<Submission[]>(
      "evaluator.listPendingSubmissions",
      { type: "bounty_response" },
    );
    submissions = [...(expansions ?? []), ...(bountyResponses ?? [])];
  }

  if (!submissions.length) return 0;

  if (maxSubmissions) {
    submissions = submissions.slice(0, maxSubmissions);
  }

  const allTopics = await trpc.query<
    Array<{ id: string; title: string; summary: string | null; iconHue: number | null }>
  >("topics.list", { status: "published" });
  const existingTopics = (allTopics ?? []).map((t) => ({ id: t.id, title: t.title, summary: t.summary }));
  const topicHues = (allTopics ?? []).map((t) => t.iconHue).filter((h): h is number => h != null);

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

      // 0. Verify resource URLs (before AI evaluation so results feed into the prompt)
      let urlVerification: UrlVerificationResult[] | null = null;
      const resourceUrls = (expansion.resources ?? [])
        .map((r: any) => r.url)
        .filter((u: string | undefined): u is string => !!u);

      if (resourceUrls.length > 0) {
        try {
          urlVerification = await verifyUrls(resourceUrls, {
            timeoutMs: 5000,
            maxConcurrent: 5,
            totalTimeoutMs: 15000,
          });
          const live = urlVerification.filter((r) => r.status === "live").length;
          const dead = urlVerification.filter((r) => r.status === "dead").length;
          const plausible = urlVerification.filter((r) => r.status === "plausible").length;
          log(
            `  [review] URL check: ${live} live, ${plausible} plausible, ${dead} dead (${urlVerification.length} total)`,
          );
        } catch (err: any) {
          log(`  [review] URL verification failed: ${err.message}`);
        }
      }

      // 0b. Fetch hierarchy context for topic placement assessment
      let parentTopic: { id: string; title: string; summary: string | null; depth: number } | null = null;
      let siblings: Array<{ id: string; title: string; summary: string | null }> = [];
      let grandparent: { id: string; title: string } | null = null;
      let targetDepth = 0;

      try {
        const hierarchyContext = await trpc.query<{
          parent: { id: string; title: string; summary: string | null; depth: number } | null;
          siblings: Array<{ id: string; title: string; summary: string | null }>;
          grandparent: { id: string; title: string } | null;
          targetDepth: number;
        }>("topics.getHierarchyContext", {
          parentSlug: expansion.topic.parentTopicSlug,
        });
        if (hierarchyContext) {
          parentTopic = hierarchyContext.parent;
          siblings = hierarchyContext.siblings;
          grandparent = hierarchyContext.grandparent;
          targetDepth = hierarchyContext.targetDepth;
        }
      } catch (err: any) {
        log(`  [review] Hierarchy context fetch failed: ${err.message}`);
      }

      // 1. Content review
      const { result, durationMs, model } = await reviewExpansion(expansion, {
        existingTopics,
        contributorName: contributor?.name ?? "unknown",
        contributorTrustLevel: contributor?.trustLevel ?? "new",
        contributorAcceptanceRate: acceptanceRate,
        urlVerification: urlVerification ?? undefined,
        parentTopic,
        siblings,
        grandparent,
        targetDepth,
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

      if (result.verdict === "approve" && resourceCount < 5) {
        result.verdict = "revise";
        result.reasoning = `Only ${resourceCount} resource(s) provided. Minimum is 5 high-quality resources from web research. ${result.reasoning}`;
        result.improvementSuggestions = [
          `Add at least ${5 - resourceCount} more resources with real URLs from web research.`,
          ...result.improvementSuggestions,
        ];
        log(`  [review] Override: approve→revise (${resourceCount} resources < 5 minimum)`);
      }

      if (result.verdict === "approve" && result.overallScore < 75) {
        result.verdict = "revise";
        result.reasoning = `Score ${result.overallScore}/100 is below the 75-point approval threshold. ${result.reasoning}`;
        result.improvementSuggestions = [
          "Improve overall quality to meet the 75/100 approval threshold.",
          ...result.improvementSuggestions,
        ];
        log(`  [review] Override: approve→revise (score ${result.overallScore} < 75 threshold)`);
      }

      // 1c. Research evidence hard gate
      if (result.verdict === "approve" && result.resourceAssessment.researchEvidence < 6) {
        result.verdict = "revise";
        result.reasoning = `Research evidence score ${result.resourceAssessment.researchEvidence}/10 is too low — resources may be fabricated or lack verifiable details. ${result.reasoning}`;
        result.improvementSuggestions = [
          "Replace suspected fabricated resources with real, verifiable URLs from authoritative sources. Include specific details (author names, publication dates, unique findings) in resource summaries.",
          ...result.improvementSuggestions,
        ];
        log(`  [review] Override: approve→revise (researchEvidence ${result.resourceAssessment.researchEvidence} < 6 minimum)`);
      }

      // 1c2. Groundedness hard gate
      if (result.verdict === "approve" && result.groundedness.score < 6) {
        result.verdict = "revise";
        result.reasoning = `Groundedness score ${result.groundedness.score}/10 is too low — submission lacks evidence of real research (process trace, resource provenance, local context). ${result.reasoning}`;
        result.improvementSuggestions = [
          "Include a processTrace showing your research steps (web searches performed, files read, MCP tools called). Mark resource provenance accurately (web_search, local_file, mcp_tool, not just 'known'). Include snippets of actual content extracted from sources.",
          ...result.improvementSuggestions,
        ];
        log(`  [review] Override: approve→revise (groundedness ${result.groundedness.score} < 6 minimum)`);
      }

      // 1c3. Process trace check — flag submissions with no trace
      const processTrace = (expansion as any).processTrace ?? [];
      if (result.verdict === "approve" && processTrace.length === 0) {
        result.verdict = "revise";
        result.reasoning = `No process trace provided — cannot verify that real research was performed. ${result.reasoning}`;
        result.improvementSuggestions = [
          "Include a processTrace array documenting your research steps: what you searched for, what files you read, what MCP tools you called, and what you found at each step.",
          ...result.improvementSuggestions,
        ];
        log(`  [review] Override: approve→revise (no process trace)`);
      }

      // 1f. Findings requirement — at least 2 structured findings
      const findings = (expansion as any).findings ?? [];
      if (result.verdict === "approve" && findings.length < 2) {
        result.verdict = "revise";
        result.reasoning = `Only ${findings.length} finding(s) provided. Expansions require at least 2 structured findings — specific, verifiable claims discovered during research. ${result.reasoning}`;
        result.improvementSuggestions = [
          "Add at least 2 structured findings using the 'findings' array. Each finding should be a specific, verifiable claim (e.g., benchmark result, configuration tip, practical insight) with a type (insight, recommendation, config, benchmark, warning, resource_note).",
          ...result.improvementSuggestions,
        ];
        log(`  [review] Override: approve→revise (${findings.length} findings < 2 minimum)`);
      }

      // 1g. URL verification hard gate — reject if majority of URLs are dead
      if (result.verdict === "approve" && urlVerification) {
        const checked = urlVerification.filter((r) => r.status !== "skipped");
        const dead = checked.filter((r) => r.status === "dead");
        if (checked.length >= 3 && dead.length / checked.length > 0.5) {
          result.verdict = "revise";
          const deadUrls = dead.map((u) => u.url).join(", ");
          result.reasoning = `${dead.length}/${checked.length} resource URLs failed verification (404/timeout/DNS). ${result.reasoning}`;
          result.improvementSuggestions = [
            `The following URLs could not be reached: ${deadUrls}. Replace with working URLs from real web research.`,
            ...result.improvementSuggestions,
          ];
          log(`  [review] Override: approve→revise (${dead.length}/${checked.length} URLs dead)`);
        }
      }

      // 1d. URL pattern validation — flag future/current year dates in resource URLs
      const currentYear = new Date().getFullYear();
      const suspiciousUrlResources = (expansion.resources ?? []).filter((r: any) => {
        if (!r.url) return false;
        // Check for current or future year in URL path (not domain)
        const yearPattern = new RegExp(`/(${currentYear}|${currentYear + 1}|${currentYear + 2})/`);
        return yearPattern.test(r.url);
      });
      if (result.verdict === "approve" && suspiciousUrlResources.length >= 2) {
        result.verdict = "revise";
        result.reasoning = `${suspiciousUrlResources.length} resource URLs contain current/future year dates (${currentYear}+), suggesting fabricated URLs. ${result.reasoning}`;
        result.improvementSuggestions = [
          `${suspiciousUrlResources.length} resource URLs contain dates from ${currentYear} or later, which are likely hallucinated. Replace with real, verifiable URLs.`,
          ...result.improvementSuggestions,
        ];
        log(`  [review] Override: approve→revise (${suspiciousUrlResources.length} URLs with suspicious year patterns)`);
      }

      // 1e. Resource description quality gate — flag thin summaries
      const thinSummaryResources = (expansion.resources ?? []).filter((r: any) =>
        !r.summary || r.summary.length < 80
      );
      if (result.verdict === "approve" && thinSummaryResources.length >= 2) {
        result.verdict = "revise";
        result.reasoning = `${thinSummaryResources.length} resources have summaries under 80 characters, indicating low-effort or template-generated descriptions. ${result.reasoning}`;
        result.improvementSuggestions = [
          "Expand resource summaries to include specific details: what the resource covers, key findings, why it's authoritative.",
          ...result.improvementSuggestions,
        ];
        log(`  [review] Override: approve→revise (${thinSummaryResources.length} resources with thin summaries)`);
      }

      // 1h. Topic placement hard gate — reject very poor placements
      if (result.verdict === "approve" && result.topicPlacement.appropriateness < 3) {
        result.verdict = "revise";
        result.reasoning = `Topic placement score ${result.topicPlacement.appropriateness}/10 is too low — this topic doesn't fit under its proposed parent. ${result.topicPlacement.suggestedParent ? `Consider placing under '${result.topicPlacement.suggestedParent}' instead. ` : ""}${result.reasoning}`;
        result.improvementSuggestions = [
          result.topicPlacement.suggestedParent
            ? `Move this topic under '${result.topicPlacement.suggestedParent}' by setting parentTopicSlug to '${result.topicPlacement.suggestedParent}'.`
            : `Reconsider the placement of this topic. ${result.topicPlacement.reasoning}`,
          ...result.improvementSuggestions,
        ];
        log(`  [review] Override: approve→revise (placement ${result.topicPlacement.appropriateness} < 3 minimum)`);
      }

      // 1i. Depth hard gate — block topics at depth 5+
      if (result.verdict === "approve" && targetDepth > 5) {
        result.verdict = "revise";
        result.reasoning = `Target depth ${targetDepth} exceeds maximum allowed depth of 5. ${result.reasoning}`;
        result.improvementSuggestions = [
          `This topic targets depth ${targetDepth}, which exceeds the maximum of 5. Merge this content into the parent topic or restructure under a shallower parent.`,
          ...result.improvementSuggestions,
        ];
        log(`  [review] Override: approve→revise (depth ${targetDepth} > 5 hard limit)`);
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
            karmaDelta = 50;
          } else if (accuracy >= 0.5) {
            karmaDelta = 20;
          } else if (accuracy >= 0.2) {
            karmaDelta = -20;
          } else {
            karmaDelta = -50;
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
            }, topicHues);
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

      if (consensusMode === "multi") {
        // In multi mode, submit as an evaluation vote instead of a final verdict
        await trpc.mutation("evaluator.submitEvaluation", {
          submissionId: submission.id,
          verdict: result.verdict,
          overallScore: result.overallScore,
          scores: {
            contentAssessment: result.contentAssessment,
            resourceAssessment: result.resourceAssessment,
            findingsAssessment: result.findingsAssessment,
            edgeAssessment: result.edgeAssessment,
            groundedness: result.groundedness,
            topicPlacement: result.topicPlacement,
          },
          reasoning: result.reasoning,
          suggestedReputationDelta: totalReputationDelta,
          improvementSuggestions: result.improvementSuggestions,
          duplicateOf: result.duplicateOf,
          resolvedTags: tagResult?.resolvedTags,
          resolvedEdges: edgeDiff?.evaluatorEdges.map((e) => ({
            targetTopicSlug: e.targetTopicSlug,
            relationType: e.relationType,
          })),
          icon: iconResult?.icon,
          iconHue: iconResult?.iconHue,
        });
      } else {
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
            groundedness: result.groundedness,
            findingsAssessment: result.findingsAssessment,
            topicPlacement: result.topicPlacement,
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
            urlVerification: urlVerification?.map((v) => ({
              url: v.url,
              status: v.status,
              httpStatus: v.httpStatus,
              error: v.error,
              durationMs: v.durationMs,
            })) ?? null,
          },
        });
      }

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
      const reputationDelta = approved ? 50 : -20;

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
        parentTopicId: string | null;
        topicResources: Array<{ resource: { type: string } }>;
        childTopics: Array<{ id: string }>;
      }>
    >("topics.list", { status: "published" });

    if (!topics?.length || topics.length < 5) return 0;

    // Deduplicate topics by title before analysis (keep canonical with most children)
    const titleGroups = new Map<string, typeof topics>();
    for (const t of topics) {
      const key = t.title.toLowerCase();
      const group = titleGroups.get(key) ?? [];
      group.push(t);
      titleGroups.set(key, group);
    }
    const deduped = Array.from(titleGroups.values()).map((group) => {
      group.sort((a, b) => {
        const diff = (b.childTopics?.length ?? 0) - (a.childTopics?.length ?? 0);
        return diff !== 0 ? diff : (b.content?.length ?? 0) - (a.content?.length ?? 0);
      });
      return group[0]!;
    });

    if (deduped.length < topics.length) {
      log(`  [gaps] Deduped ${topics.length} topics → ${deduped.length} unique`);
    }

    const topicStats = deduped.map((t) => {
      const typeCounts: Record<string, number> = {};
      for (const tr of t.topicResources ?? []) {
        const type = tr.resource?.type;
        if (type) typeCounts[type] = (typeCounts[type] ?? 0) + 1;
      }
      return {
        id: t.id,
        title: t.title,
        resourceCount: t.topicResources?.length ?? 0,
        resourceTypeCounts: typeCounts,
        hasSubtopics: (t.childTopics?.length ?? 0) > 0,
        childCount: t.childTopics?.length ?? 0,
        contentLength: t.content?.length ?? 0,
        isRoot: !t.parentTopicId,
        parentTopicId: t.parentTopicId,
      };
    });

    // Use listOpen which expires stale claims, instead of list(status: "open")
    const openBounties = await trpc.query<Bounty[]>("bounties.listOpen", {});
    const openCount = openBounties?.length ?? 0;
    const existingBounties = (openBounties ?? []).map((b) => ({
      title: b.title,
      topicSlug: b.topic?.id,
    }));

    // Build set of existing topic titles for post-generation filtering
    const existingTopicTitles = new Set(deduped.map((t) => t.title.toLowerCase()));

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
      `  [gaps] Analyzing ${topicStats.length} unique topics for gaps (${openCount} open bounties, targeting ${targetBountyCount} new)...`,
    );

    const { result, durationMs } = await analyzeGaps(
      topicStats,
      existingBounties,
      targetBountyCount,
    );

    let posted = 0;
    for (const gap of result.gaps) {
      // Skip bounties for topics that already exist (title match)
      if (gap.suggestedBounty.type === "topic") {
        const titleLower = gap.suggestedBounty.title
          .replace(/^Create (root topic|subtopic): /i, "")
          .toLowerCase();
        if (existingTopicTitles.has(titleLower)) {
          log(
            `  [gaps] Skipped bounty "${gap.suggestedBounty.title}" — topic already exists`,
          );
          continue;
        }
      }

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

async function doGraphRestructuring(
  trpc: ReturnType<typeof createTrpcClient>,
  log: Logger,
): Promise<number> {
  const MAX_RESTRUCTURING_BOUNTIES = 5;

  try {
    const topics = await trpc.query<
      Array<{
        id: string;
        title: string;
        summary: string | null;
        content: string;
        parentTopicId: string | null;
        depth: number;
        baseId: string | null;
        topicResources: Array<{ resource: { type: string } }>;
        childTopics: Array<{ id: string }>;
      }>
    >("topics.list", { status: "published" });

    if (!topics?.length || topics.length < 10) {
      log("  [restructure] Not enough topics for restructuring analysis (need 10+)");
      return 0;
    }

    const treeStats = topics.map((t) => ({
      id: t.id,
      title: t.title,
      summary: t.summary,
      parentTopicId: t.parentTopicId,
      depth: t.depth ?? 0,
      childCount: t.childTopics?.length ?? 0,
      resourceCount: t.topicResources?.length ?? 0,
      contentLength: t.content?.length ?? 0,
      baseSlug: t.baseId,
    }));

    log(`  [restructure] Analyzing ${treeStats.length} topics for structural issues...`);

    const { result, durationMs } = await suggestRestructuring(treeStats);

    // Fetch existing bounties for dedup
    const openBounties = await trpc.query<
      Array<{ id: string; title: string; status: string }>
    >("bounties.listOpen", {});
    const existingTitles = new Set(
      (openBounties ?? []).map((b) => b.title.toLowerCase()),
    );

    let posted = 0;
    for (const suggestion of result.suggestions) {
      if (posted >= MAX_RESTRUCTURING_BOUNTIES) break;
      if (suggestion.confidence < 60) {
        log(`  [restructure] Skipped "${suggestion.suggestedBounty.title}" (confidence ${suggestion.confidence} < 60)`);
        continue;
      }

      // Dedup by title prefix match
      const titleLower = suggestion.suggestedBounty.title.toLowerCase();
      if (existingTitles.has(titleLower)) {
        log(`  [restructure] Skipped "${suggestion.suggestedBounty.title}" — similar bounty exists`);
        continue;
      }

      try {
        await trpc.mutation("evaluator.postBounty", {
          title: suggestion.suggestedBounty.title,
          description: `${suggestion.suggestedBounty.description}\n\n**Type:** ${suggestion.type}\n**Reasoning:** ${suggestion.reasoning}${suggestion.targetParentSlug ? `\n**Target parent:** ${suggestion.targetParentSlug}` : ""}${suggestion.mergeWithSlug ? `\n**Merge with:** ${suggestion.mergeWithSlug}` : ""}`,
          type: "edit" as const,
          topicSlug: suggestion.topicSlug,
          karmaReward: suggestion.suggestedBounty.karmaReward,
        });
        posted++;
        existingTitles.add(titleLower);
        log(`  [restructure] Posted bounty: "${suggestion.suggestedBounty.title}" (${suggestion.type}, confidence: ${suggestion.confidence})`);
      } catch (err: any) {
        log(`  [restructure] Failed to post bounty: ${err.message}`);
      }
    }

    log(`  [restructure] Analysis complete (${durationMs}ms), posted ${posted} restructuring bounties`);
    return posted;
  } catch (err: any) {
    log(`  [restructure] Graph restructuring failed: ${err.message}`);
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
  const consensusMode = (process.env.CONSENSUS_MODE ?? "single") as "single" | "multi";
  const trpc = createTrpcClient(config.baseUrl, config.apiKey, log);

  log(
    `\n${"=".repeat(60)}\n[Arbiter] Cycle — ${new Date().toISOString()}${consensusMode === "multi" ? " (multi-evaluator consensus)" : ""}\n${"=".repeat(60)}`,
  );

  const signal = config.signal;
  let reviewed = 0,
    resourcesReviewed = 0,
    scored = 0,
    bountiesPosted = 0,
    restructuringBounties = 0;

  try {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    reviewed = await reviewPendingSubmissions(
      trpc,
      log,
      config.maxSubmissions,
      consensusMode,
    );
  } catch (err: any) {
    if (err?.name === "AbortError") { log("[Arbiter] Cancelled"); return { reviewed, resourcesReviewed, scored, bountiesPosted, restructuringBounties, durationMs: Date.now() - start }; }
    log(`[Arbiter] reviewPendingSubmissions failed: ${err.message}`);
  }

  try {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    resourcesReviewed = await reviewPendingResources(
      trpc,
      log,
      config.maxSubmissions,
    );
  } catch (err: any) {
    if (err?.name === "AbortError") { log("[Arbiter] Cancelled"); return { reviewed, resourcesReviewed, scored, bountiesPosted, restructuringBounties, durationMs: Date.now() - start }; }
    log(`[Arbiter] reviewPendingResources failed: ${err.message}`);
  }

  try {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    scored = await scoreUnscoredResources(trpc, log);
  } catch (err: any) {
    if (err?.name === "AbortError") { log("[Arbiter] Cancelled"); return { reviewed, resourcesReviewed, scored, bountiesPosted, restructuringBounties, durationMs: Date.now() - start }; }
    log(`[Arbiter] scoreUnscoredResources failed: ${err.message}`);
  }

  if (config.runGapAnalysis) {
    try {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      bountiesPosted = await doGapAnalysis(trpc, log);
    } catch (err: any) {
      if (err?.name === "AbortError") { log("[Arbiter] Cancelled"); return { reviewed, resourcesReviewed, scored, bountiesPosted, restructuringBounties, durationMs: Date.now() - start }; }
      log(`[Arbiter] runGapAnalysis failed: ${err.message}`);
    }
  }

  if (config.runRestructuring) {
    try {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      restructuringBounties = await doGraphRestructuring(trpc, log);
    } catch (err: any) {
      if (err?.name === "AbortError") { log("[Arbiter] Cancelled"); return { reviewed, resourcesReviewed, scored, bountiesPosted, restructuringBounties, durationMs: Date.now() - start }; }
      log(`[Arbiter] runRestructuring failed: ${err.message}`);
    }
  }

  try {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await recalculateReputation(trpc, log);
  } catch (err: any) {
    if (err?.name === "AbortError") { log("[Arbiter] Cancelled"); return { reviewed, resourcesReviewed, scored, bountiesPosted, restructuringBounties, durationMs: Date.now() - start }; }
    log(`[Arbiter] recalculateReputation failed: ${err.message}`);
  }

  const durationMs = Date.now() - start;
  const elapsed = (durationMs / 1000).toFixed(1);
  log(
    `\n[Arbiter] Cycle complete in ${elapsed}s` +
      ` — expansions: ${reviewed}, resources: ${resourcesReviewed}, scored: ${scored}` +
      (bountiesPosted > 0 ? `, bounties: ${bountiesPosted}` : "") +
      (restructuringBounties > 0 ? `, restructuring: ${restructuringBounties}` : ""),
  );

  return { reviewed, resourcesReviewed, scored, bountiesPosted, restructuringBounties, durationMs };
}
