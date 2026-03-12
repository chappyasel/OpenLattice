/**
 * Evaluator Agent — Arbiter (CLI wrapper)
 *
 * Thin CLI entry point that imports the shared cycle logic.
 *
 * Environment variables:
 *   OPENLATTICE_URL      — Platform URL (default: http://localhost:3000)
 *   AI_GATEWAY_API_KEY   — Vercel AI Gateway API key for evaluation calls
 *   EVALUATOR_MODEL      — Model to use (default: anthropic/claude-sonnet-4-20250514)
 *   POLL_INTERVAL        — Seconds between cycles (default: 60)
 *   GAP_ANALYSIS_EVERY   — Run gap analysis every N cycles (default: 3)
 *
 * The evaluator API key is resolved automatically from the database
 * by finding the autonomous contributor.
 *
 * Run with: npx tsx scripts/evaluator/run.ts
 * Single cycle: npx tsx scripts/evaluator/run.ts --once
 */

import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { runEvaluationCycle } from "../../src/lib/evaluator/cycle";
import { getEvaluatorApiKey } from "../../src/lib/evaluator/get-api-key";

const BASE_URL = process.env.OPENLATTICE_URL ?? "http://localhost:3000";
const POLL_INTERVAL_MS =
  (parseInt(process.env.POLL_INTERVAL ?? "60") || 60) * 1000;
const GAP_ANALYSIS_EVERY =
  parseInt(process.env.GAP_ANALYSIS_EVERY ?? "3") || 3;
const RESTRUCTURING_EVERY =
  parseInt(process.env.RESTRUCTURING_EVERY ?? "5") || 5;
const ONCE = process.argv.includes("--once");

if (!process.env.AI_GATEWAY_API_KEY) {
  console.error("Missing AI_GATEWAY_API_KEY. Needed for AI evaluation via Vercel AI Gateway.");
  process.exit(1);
}

let cycleCount = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log(`
====================================================
  Arbiter — OpenLattice Evaluator Agent
====================================================
  URL:      ${BASE_URL}
  Model:    ${process.env.EVALUATOR_MODEL ?? "anthropic/claude-sonnet-4-20250514"}
  Mode:     ${ONCE ? "single cycle" : `polling (${POLL_INTERVAL_MS / 1000}s)`}
  Gaps:     every ${GAP_ANALYSIS_EVERY} cycles
  Restruct: every ${RESTRUCTURING_EVERY} cycles
====================================================
`);

  const apiKey = await getEvaluatorApiKey();

  cycleCount++;
  await runEvaluationCycle({
    baseUrl: BASE_URL,
    apiKey,
    runGapAnalysis: cycleCount % GAP_ANALYSIS_EVERY === 0,
    runRestructuring: cycleCount % RESTRUCTURING_EVERY === 0,
  });

  if (ONCE) {
    console.log("[Arbiter] Single cycle complete, exiting.");
    process.exit(0);
  }

  while (true) {
    await sleep(POLL_INTERVAL_MS);
    try {
      // Refresh key each cycle in case the contributor was updated
      const freshKey = await getEvaluatorApiKey();
      cycleCount++;
      await runEvaluationCycle({
        baseUrl: BASE_URL,
        apiKey: freshKey,
        runGapAnalysis: cycleCount % GAP_ANALYSIS_EVERY === 0,
        runRestructuring: cycleCount % RESTRUCTURING_EVERY === 0,
      });
    } catch (err) {
      console.error("[Arbiter] Unhandled cycle error:", err);
    }
  }
}

main().catch((err) => {
  console.error("[Arbiter] Fatal error:", err);
  process.exit(1);
});
