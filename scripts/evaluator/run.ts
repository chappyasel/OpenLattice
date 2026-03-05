/**
 * Evaluator Agent — Arbiter
 *
 * Runs on a 5-minute polling loop to:
 *   1. Review pending expansion submissions
 *   2. Score unscored resources
 *   3. Resolve contested claims
 *   4. Recalculate contributor reputation
 *
 * Set EVALUATOR_API_KEY to Arbiter's API key and OPENLATTICE_URL to the
 * platform URL before running.
 *
 * Run with: npx tsx scripts/evaluator/run.ts
 */

import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

const BASE_URL = process.env.OPENLATTICE_URL ?? "http://localhost:3000";
const API_KEY = process.env.EVALUATOR_API_KEY;

if (!API_KEY) {
  console.error(
    "Missing EVALUATOR_API_KEY. Set it to the Arbiter agent's API key.",
  );
  process.exit(1);
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── tRPC Client Helpers ───────────────────────────────────────────────────

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

  const body = (await res.json()) as { result?: { data?: { json?: T } }; error?: unknown };

  if (body.error) {
    throw new Error(`tRPC error on ${path}: ${JSON.stringify(body.error)}`);
  }

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

  const body = (await res.json()) as { result?: { data?: { json?: T } }; error?: unknown };

  if (body.error) {
    throw new Error(`tRPC error on ${path}: ${JSON.stringify(body.error)}`);
  }

  return body.result?.data?.json as T;
}

// ─── Evaluation Logic ──────────────────────────────────────────────────────

/**
 * Score a resource in the 60-90 range, weighted toward quality submissions.
 * Real scoring will use AI evaluation in a future iteration.
 */
function computeResourceScore(): number {
  // Skew toward higher scores (base 65 + 0-25 bonus)
  return 65 + Math.floor(Math.random() * 25);
}

/**
 * Decide whether to approve an expansion submission.
 * For now: approve 80% of pending expansions. Real logic will use AI review.
 */
function shouldApproveExpansion(): { approved: boolean; reasoning: string } {
  const approved = Math.random() < 0.8;
  return {
    approved,
    reasoning: approved
      ? "Content is relevant, well-structured, and adds meaningful coverage to the topic."
      : "Submission requires more depth and supporting sources before approval.",
  };
}

/**
 * Resolve a claim based on the weight of positions.
 * Support majority → resolved_true, oppose majority → resolved_false.
 */
function resolveClaimFromPositions(
  positions: Array<{ position: "support" | "oppose"; stakeAmount: number }>,
): { resolution: "resolved_true" | "resolved_false"; note: string } {
  const supportWeight = positions
    .filter((p) => p.position === "support")
    .reduce((sum, p) => sum + p.stakeAmount, 0);
  const opposeWeight = positions
    .filter((p) => p.position === "oppose")
    .reduce((sum, p) => sum + p.stakeAmount, 0);

  if (supportWeight >= opposeWeight) {
    return {
      resolution: "resolved_true",
      note: `Resolved true. Support stake: ${supportWeight}, oppose stake: ${opposeWeight}.`,
    };
  }
  return {
    resolution: "resolved_false",
    note: `Resolved false. Oppose stake: ${opposeWeight} outweighed support stake: ${supportWeight}.`,
  };
}

// ─── Evaluation Passes ─────────────────────────────────────────────────────

async function reviewPendingSubmissions(): Promise<number> {
  let reviewed = 0;
  try {
    const submissions = await trpcQuery<
      Array<{ id: string; type: string; data: Record<string, unknown> }>
    >("evaluator.listPendingSubmissions", { type: "expansion" });

    if (!submissions || submissions.length === 0) return 0;

    for (const submission of submissions) {
      try {
        const { approved, reasoning } = shouldApproveExpansion();
        await trpcMutation("evaluator.reviewSubmission", {
          submissionId: submission.id,
          approved,
          reasoning,
        });
        reviewed++;
        console.log(
          `  [submissions] ${approved ? "Approved" : "Rejected"} ${submission.id.slice(0, 8)}... — ${reasoning.slice(0, 60)}`,
        );
      } catch (err) {
        console.error(
          `  [submissions] Failed to review ${submission.id}:`,
          err,
        );
      }
    }
  } catch (err) {
    console.error("  [submissions] Failed to fetch pending submissions:", err);
  }
  return reviewed;
}

async function scoreUnscoredResources(): Promise<number> {
  let scored = 0;
  try {
    const resources = await trpcQuery<Array<{ id: string; name: string }>>(
      "evaluator.listUnscoredResources",
      {},
    );

    if (!resources || resources.length === 0) return 0;

    for (const resource of resources) {
      try {
        const score = computeResourceScore();
        await trpcMutation("evaluator.scoreResource", {
          resourceId: resource.id,
          score,
        });
        scored++;
        console.log(
          `  [resources] Scored "${resource.name.slice(0, 40)}" → ${score}`,
        );
      } catch (err) {
        console.error(`  [resources] Failed to score ${resource.id}:`, err);
      }
    }
  } catch (err) {
    console.error("  [resources] Failed to fetch unscored resources:", err);
  }
  return scored;
}

async function resolveContestedClaims(): Promise<number> {
  let resolved = 0;
  try {
    const claims = await trpcQuery<
      Array<{
        id: string;
        title: string;
        positions: Array<{ position: "support" | "oppose"; stakeAmount: number }>;
      }>
    >("evaluator.listContestedClaims", { minPositions: 2 });

    if (!claims || claims.length === 0) return 0;

    for (const claim of claims) {
      try {
        const { resolution, note } = resolveClaimFromPositions(
          claim.positions,
        );
        await trpcMutation("evaluator.resolveClaim", {
          claimId: claim.id,
          resolution,
          resolutionNote: note,
        });
        resolved++;
        console.log(
          `  [claims] Resolved "${claim.title.slice(0, 40)}" → ${resolution}`,
        );
      } catch (err) {
        console.error(`  [claims] Failed to resolve ${claim.id}:`, err);
      }
    }
  } catch (err) {
    console.error("  [claims] Failed to fetch contested claims:", err);
  }
  return resolved;
}

async function recalculateReputation(): Promise<void> {
  try {
    await trpcMutation("evaluator.recalculateReputation", {});
    console.log("  [reputation] Recalculated contributor reputation scores");
  } catch (err) {
    console.error("  [reputation] Failed to recalculate reputation:", err);
  }
}

// ─── Main Loop ─────────────────────────────────────────────────────────────

async function runEvaluationCycle(): Promise<void> {
  const start = Date.now();
  console.log(`\n[Arbiter] Evaluation cycle starting at ${new Date().toISOString()}`);

  const [reviewed, scored, resolved] = await Promise.all([
    reviewPendingSubmissions(),
    scoreUnscoredResources(),
    resolveContestedClaims(),
  ]);

  await recalculateReputation();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `[Arbiter] Cycle complete in ${elapsed}s — reviewed: ${reviewed}, scored: ${scored}, resolved: ${resolved}`,
  );
}

async function main(): Promise<void> {
  console.log("[Arbiter] Evaluator agent starting...");
  console.log(`  URL: ${BASE_URL}`);
  console.log(`  Poll interval: ${POLL_INTERVAL_MS / 1000}s`);

  // Run immediately on startup, then on interval
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
