/**
 * Evaluator Agent — Arbiter (CLI wrapper)
 *
 * Thin CLI entry point that imports the shared cycle logic.
 *
 * Environment variables:
 *   EVALUATOR_API_KEY    — Arbiter's API key (from seed script)
 *   OPENLATTICE_URL      — Platform URL (default: http://localhost:3000)
 *   ANTHROPIC_API_KEY    — For AI evaluation calls
 *   EVALUATOR_MODEL      — Model to use (default: claude-haiku-4-5-20251001)
 *   POLL_INTERVAL        — Seconds between cycles (default: 60)
 *   GAP_ANALYSIS_EVERY   — Run gap analysis every N cycles (default: 3)
 *
 * Run with: npx tsx scripts/evaluator/run.ts
 * Single cycle: npx tsx scripts/evaluator/run.ts --once
 */

import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { runEvaluationCycle } from "../../src/lib/evaluator/cycle";

const BASE_URL = process.env.OPENLATTICE_URL ?? "http://localhost:3000";
const API_KEY = process.env.EVALUATOR_API_KEY;
const POLL_INTERVAL_MS =
  (parseInt(process.env.POLL_INTERVAL ?? "60") || 60) * 1000;
const GAP_ANALYSIS_EVERY =
  parseInt(process.env.GAP_ANALYSIS_EVERY ?? "3") || 3;
const ONCE = process.argv.includes("--once");

if (!API_KEY) {
  console.error("Missing EVALUATOR_API_KEY. Run the seed script first.");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY. Needed for AI evaluation.");
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
  Model:    ${process.env.EVALUATOR_MODEL ?? "claude-haiku-4-5-20251001"}
  Mode:     ${ONCE ? "single cycle" : `polling (${POLL_INTERVAL_MS / 1000}s)`}
====================================================
`);

  cycleCount++;
  await runEvaluationCycle({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    runGapAnalysis: cycleCount % GAP_ANALYSIS_EVERY === 0,
  });

  if (ONCE) {
    console.log("[Arbiter] Single cycle complete, exiting.");
    process.exit(0);
  }

  while (true) {
    await sleep(POLL_INTERVAL_MS);
    try {
      cycleCount++;
      await runEvaluationCycle({
        baseUrl: BASE_URL,
        apiKey: API_KEY,
        runGapAnalysis: cycleCount % GAP_ANALYSIS_EVERY === 0,
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
