/**
 * Pure logic for multi-evaluator consensus.
 * No database access or side effects.
 */

export interface EvaluationVote {
  evaluatorId: string;
  verdict: "approve" | "reject" | "revise";
  overallScore: number;
  scores: Record<string, unknown>;
  suggestedReputationDelta: number;
  resolvedTags?: string[];
  resolvedEdges?: Array<{ targetTopicSlug: string; relationType: string }>;
  icon?: string;
  iconHue?: number;
  weight: number; // 0.5 – 1.0
}

export interface ConsensusConfig {
  minEvaluations: number; // default 2
  agreementThreshold: number; // default 0.67
}

export interface ConsensusResult {
  status: "consensus" | "split" | "insufficient";
  verdict?: "approve" | "reject" | "revise";
  finalScore?: number; // weighted avg of overallScore
  finalReputationDelta?: number; // weighted avg
  resolvedTags?: string[]; // tags in >50% of approving evals
  resolvedEdges?: Array<{ targetTopicSlug: string; relationType: string }>;
  icon?: string; // from highest-weight evaluator
  iconHue?: number;
  confidence: number; // weighted % of winning verdict
  evaluatorAgreement: Record<string, boolean>; // evaluatorId → agreed
}

const VERDICTS = ["approve", "reject", "revise"] as const;

export function computeConsensus(
  votes: EvaluationVote[],
  config: ConsensusConfig,
): ConsensusResult {
  // 1. Insufficient votes
  if (votes.length < config.minEvaluations) {
    return { status: "insufficient", confidence: 0, evaluatorAgreement: {} };
  }

  // 2. Group by verdict, sum weights per group
  const weightByVerdict: Record<string, number> = {};
  const votesByVerdict: Record<string, EvaluationVote[]> = {};
  for (const v of VERDICTS) {
    weightByVerdict[v] = 0;
    votesByVerdict[v] = [];
  }
  const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
  for (const vote of votes) {
    weightByVerdict[vote.verdict]! += vote.weight;
    votesByVerdict[vote.verdict]!.push(vote);
  }

  // 3. Compute weighted % for each verdict
  const pctByVerdict: Record<string, number> = {};
  for (const v of VERDICTS) {
    pctByVerdict[v] = totalWeight > 0 ? weightByVerdict[v]! / totalWeight : 0;
  }

  // 4. Find highest verdict
  let winningVerdict: (typeof VERDICTS)[number] = "approve";
  let highestPct = 0;
  for (const v of VERDICTS) {
    if (pctByVerdict[v]! > highestPct) {
      highestPct = pctByVerdict[v]!;
      winningVerdict = v;
    }
  }

  // 5. Determine status
  const status: "consensus" | "split" =
    highestPct >= config.agreementThreshold ? "consensus" : "split";

  // 6. Final score = weighted average of overallScore across ALL votes
  const finalScore =
    totalWeight > 0
      ? votes.reduce((sum, v) => sum + v.overallScore * v.weight, 0) /
        totalWeight
      : 0;

  // 7. Final reputation delta = weighted average across ALL votes
  const finalReputationDelta =
    totalWeight > 0
      ? votes.reduce(
          (sum, v) => sum + v.suggestedReputationDelta * v.weight,
          0,
        ) / totalWeight
      : 0;

  // 8. Tags: include if in >50% of winning-verdict evaluations
  const winningVotes = votesByVerdict[winningVerdict]!;
  const resolvedTags = resolveByMajority(
    winningVotes.map((v) => v.resolvedTags ?? []),
  );

  // 9. Edges: same >50% rule (match by targetTopicSlug + relationType)
  const resolvedEdges = resolveEdgesByMajority(
    winningVotes.map((v) => v.resolvedEdges ?? []),
  );

  // 10. Icon/iconHue from highest-weight evaluator who voted with consensus verdict
  let icon: string | undefined;
  let iconHue: number | undefined;
  let bestWeight = -1;
  for (const vote of winningVotes) {
    if (vote.weight > bestWeight) {
      bestWeight = vote.weight;
      icon = vote.icon;
      iconHue = vote.iconHue;
    }
  }

  // 11. evaluatorAgreement
  const evaluatorAgreement: Record<string, boolean> = {};
  for (const vote of votes) {
    evaluatorAgreement[vote.evaluatorId] = vote.verdict === winningVerdict;
  }

  return {
    status,
    verdict: winningVerdict,
    finalScore,
    finalReputationDelta,
    resolvedTags,
    resolvedEdges,
    icon,
    iconHue,
    confidence: highestPct,
    evaluatorAgreement,
  };
}

/** Include items present in >50% of the vote arrays. */
function resolveByMajority(tagSets: string[][]): string[] {
  if (tagSets.length === 0) return [];
  const counts = new Map<string, number>();
  for (const tags of tagSets) {
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const threshold = tagSets.length / 2;
  return [...counts.entries()]
    .filter(([, count]) => count > threshold)
    .map(([tag]) => tag);
}

/** Include edges present in >50% of the vote arrays, matched by slug+relation. */
function resolveEdgesByMajority(
  edgeSets: Array<{ targetTopicSlug: string; relationType: string }>[],
): Array<{ targetTopicSlug: string; relationType: string }> {
  if (edgeSets.length === 0) return [];
  const counts = new Map<
    string,
    { targetTopicSlug: string; relationType: string; count: number }
  >();
  for (const edges of edgeSets) {
    for (const edge of edges) {
      const key = `${edge.targetTopicSlug}::${edge.relationType}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, { ...edge, count: 1 });
      }
    }
  }
  const threshold = edgeSets.length / 2;
  return [...counts.values()]
    .filter((e) => e.count > threshold)
    .map(({ targetTopicSlug, relationType }) => ({
      targetTopicSlug,
      relationType,
    }));
}

// ---------------------------------------------------------------------------
// Evaluator karma calculation
// ---------------------------------------------------------------------------

function getQueueMultiplier(pendingCount: number): number {
  if (pendingCount <= 10) return 1.0;
  if (pendingCount <= 25) return 1.5;
  if (pendingCount <= 50) return 2.0;
  return 3.0;
}

/**
 * Compute karma earned by an evaluator for completing an evaluation.
 *
 * Formula: `Math.floor(base * queueMult) + (agreed ? 20 : 0)`,
 * capped at `Math.floor(Math.abs(submissionReputationDelta) * 0.5)`.
 * If submissionReputationDelta is 0, use a minimum cap of 10.
 */
export function computeEvalKarma(
  submissionType: string, // "expansion" | "bounty_response" | "resource"
  pendingCount: number,
  agreedWithConsensus: boolean,
  submissionReputationDelta: number,
): number {
  const base =
    submissionType === "expansion" || submissionType === "bounty_response"
      ? 30
      : 10;
  const queueMult = getQueueMultiplier(pendingCount);
  const raw = Math.floor(base * queueMult) + (agreedWithConsensus ? 20 : 0);
  const absDelta = Math.abs(submissionReputationDelta);
  const cap = absDelta === 0 ? 10 : Math.floor(absDelta * 0.5);
  return Math.min(raw, cap);
}
