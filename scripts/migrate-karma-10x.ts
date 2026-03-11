import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/server/db/schema";

dotenv.config({ path: "./.env" });

const pgClient = postgres(process.env.DATABASE_URL as string);
const db = drizzle(pgClient, { schema });

async function migrate() {
  // Safety check: require --force flag to run
  if (!process.argv.includes("--force")) {
    console.error(
      "⚠️  This script will multiply ALL karma values by 10 across the database.",
    );
    console.error("   This is a one-time migration and should not be run twice.");
    console.error("");
    console.error("   To proceed, run with --force:");
    console.error("   npx tsx scripts/migrate-karma-10x.ts --force");
    process.exit(1);
  }

  console.log("Starting karma 10x migration...\n");

  // 1. Update contributors.karma
  const contributorsResult = await db.execute(
    sql`UPDATE contributors SET karma = karma * 10`,
  );
  console.log(`Updated contributors.karma: ${contributorsResult.count} rows`);

  // 2. Update bounties.karma_reward
  const bountiesResult = await db.execute(
    sql`UPDATE bounties SET karma_reward = karma_reward * 10`,
  );
  console.log(`Updated bounties.karma_reward: ${bountiesResult.count} rows`);

  // 3. Update submissions.reputation_delta (only non-null values)
  const submissionsResult = await db.execute(
    sql`UPDATE submissions SET reputation_delta = reputation_delta * 10 WHERE reputation_delta IS NOT NULL`,
  );
  console.log(
    `Updated submissions.reputation_delta: ${submissionsResult.count} rows`,
  );

  console.log("\nKarma 10x migration complete.");
}

migrate()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pgClient.end();
  });
