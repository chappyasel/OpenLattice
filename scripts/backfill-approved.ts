/**
 * Backfill script: applies approved expansion/bounty_response submissions
 * that were never materialized into the knowledge graph.
 *
 * Usage: npx tsx scripts/backfill-approved.ts [--dry-run]
 */
process.env.SKIP_ENV_VALIDATION = "1";
import dotenv from "dotenv";
import { and, eq, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/server/db/schema";
import { applyExpansion } from "../src/server/api/routers/expansions";

dotenv.config({ path: "./.env" });

const dryRun = process.argv.includes("--dry-run");

const pgClient = postgres(process.env.DATABASE_URL as string);
const db = drizzle(pgClient, { schema });

async function main() {
  // Find all approved expansion/bounty_response submissions
  const approvedSubs = await db.query.submissions.findMany({
    where: and(
      eq(schema.submissions.status, "approved"),
    ),
  });

  // Filter to only expansion/bounty_response types
  const expansionSubs = approvedSubs.filter(
    (s) => s.type === "expansion" || s.type === "bounty_response",
  );

  // Check which ones already have a topic_created activity (already materialized)
  const materializedIds = new Set<string>();
  if (expansionSubs.length > 0) {
    const activities = await db.query.activity.findMany({
      where: and(
        eq(schema.activity.type, "topic_created"),
      ),
      columns: { submissionId: true },
    });
    for (const a of activities) {
      if (a.submissionId) materializedIds.add(a.submissionId);
    }
  }

  const unmaterialized = expansionSubs.filter(
    (s) => !materializedIds.has(s.id),
  );

  console.log(`Found ${expansionSubs.length} approved expansion submissions`);
  console.log(`Already materialized: ${materializedIds.size}`);
  console.log(`Need to apply: ${unmaterialized.length}`);

  if (unmaterialized.length === 0) {
    console.log("Nothing to do!");
    await pgClient.end();
    return;
  }

  if (dryRun) {
    console.log("\n--- DRY RUN --- Would apply these submissions:");
    for (const sub of unmaterialized) {
      const data = sub.data as any;
      console.log(`  ${sub.id} — "${data?.topic?.title}" by ${sub.contributorId}`);
    }
    await pgClient.end();
    return;
  }

  console.log("\nApplying...\n");

  let success = 0;
  let failed = 0;

  for (const sub of unmaterialized) {
    const data = sub.data as any;
    const title = data?.topic?.title ?? "(unknown)";
    try {
      const result = await applyExpansion(
        db,
        sub.id,
        data,
        sub.contributorId,
      );
      console.log(`  ✓ ${sub.id} — "${title}" → topic: ${result?.topicId}`);
      success++;
    } catch (err: any) {
      console.error(`  ✗ ${sub.id} — "${title}": ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} applied, ${failed} failed`);
  await pgClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
