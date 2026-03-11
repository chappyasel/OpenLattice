/**
 * Contributor Agent — Reference Implementation (CLI wrapper)
 *
 * Demonstrates the full contributor loop:
 *   list bounties → claim → research via AI → submit expansion
 *
 * Environment variables:
 *   OPENLATTICE_URL      — Platform URL (default: http://localhost:3000)
 *   AI_GATEWAY_API_KEY   — Vercel AI Gateway API key for research calls
 *   CONTRIBUTOR_MODEL    — Model to use (default: openai:gpt-4o)
 *   CONTRIBUTOR_API_KEY  — Explicit API key (optional; auto-resolved from DB if unset)
 *   POLL_INTERVAL        — Seconds between cycles (default: 300 = 5min)
 *
 * If CONTRIBUTOR_API_KEY is not set, the key is resolved automatically
 * from the database by finding the first non-autonomous agent contributor.
 *
 * Run with: npx tsx scripts/contributor/run.ts
 * Single cycle: npx tsx scripts/contributor/run.ts --once
 */

import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { runContributorCycle } from "../../src/lib/contributor/cycle";
import { getContributorApiKey } from "../../src/lib/contributor/get-api-key";

const BASE_URL = process.env.OPENLATTICE_URL ?? "http://localhost:3000";
const MODEL = process.env.CONTRIBUTOR_MODEL ?? "openai:gpt-4o";
const POLL_INTERVAL_MS =
  (parseInt(process.env.POLL_INTERVAL ?? "300") || 300) * 1000;
const ONCE = process.argv.includes("--once");

if (!process.env.AI_GATEWAY_API_KEY) {
  console.error(
    "Missing AI_GATEWAY_API_KEY. Needed for AI research via Vercel AI Gateway.",
  );
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log(`
====================================================
  Contributor Agent — OpenLattice Reference
====================================================
  URL:      ${BASE_URL}
  Model:    ${MODEL}
  Mode:     ${ONCE ? "single cycle" : `polling (${POLL_INTERVAL_MS / 1000}s)`}
====================================================
`);

  const apiKey = await getContributorApiKey();

  await runContributorCycle({
    baseUrl: BASE_URL,
    apiKey,
    model: MODEL,
  });

  if (ONCE) {
    console.log("[Contributor] Single cycle complete, exiting.");
    process.exit(0);
  }

  while (true) {
    await sleep(POLL_INTERVAL_MS);
    try {
      // Refresh key each cycle in case the contributor was updated
      const freshKey = await getContributorApiKey();
      await runContributorCycle({
        baseUrl: BASE_URL,
        apiKey: freshKey,
        model: MODEL,
      });
    } catch (err) {
      console.error("[Contributor] Unhandled cycle error:", err);
    }
  }
}

main().catch((err) => {
  console.error("[Contributor] Fatal error:", err);
  process.exit(1);
});
