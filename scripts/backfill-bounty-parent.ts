import dotenv from "dotenv";
import { eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/server/db/schema";

dotenv.config({ path: "./.env" });

const pgClient = postgres(process.env.DATABASE_URL as string);
const db = drizzle(pgClient, { schema });

async function backfill() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Backfill bounty parentTopicSlug");
  console.log("═══════════════════════════════════════════════");

  // 1. Ensure the column exists (db:push should have been run first)
  //    If it doesn't, this script will just fail gracefully.

  const allBounties = await db.query.bounties.findMany({
    columns: {
      id: true,
      description: true,
      topicId: true,
      baseId: true,
      parentTopicSlug: true,
    },
  });

  console.log(`\nTotal bounties: ${allBounties.length}`);

  const alreadySet = allBounties.filter((b) => b.parentTopicSlug !== null);
  console.log(`Already have parentTopicSlug: ${alreadySet.length}`);

  let updated = 0;
  let skipped = 0;

  for (const bounty of allBounties) {
    if (bounty.parentTopicSlug) continue; // already set

    // Strategy 1: Parse parentTopicSlug from description text
    // Matches: parentTopicSlug: 'some-slug' or parentTopicSlug: "some-slug"
    const match = bounty.description.match(/parentTopicSlug:\s*['"`]([^'"`]+)['"`]/);
    if (match?.[1]) {
      // Verify the parent topic actually exists
      const parent = await db.query.topics.findFirst({
        where: eq(schema.topics.id, match[1]),
        columns: { id: true },
      });
      if (parent) {
        await db
          .update(schema.bounties)
          .set({ parentTopicSlug: match[1] })
          .where(eq(schema.bounties.id, bounty.id));
        console.log(`  ✓ ${bounty.id} → parentTopicSlug: ${match[1]} (from description)`);
        updated++;
        continue;
      }
    }

    // Strategy 2: For child bounties (have baseId, no topicId), derive parent from ID pattern
    // Child bounty IDs look like: bounty--{baseId}--{rootSlug}-{childSlug}
    // Root bounty IDs look like:  bounty--{baseId}--{rootSlug}
    // If this bounty has a topicId, it's a root bounty (topicId = the root topic itself)
    if (!bounty.topicId && bounty.baseId) {
      // Remove "bounty--" prefix to get the slug part
      const slugPart = bounty.id.replace(/^bounty--/, "");
      // The slug has format: {baseId}--{rootPart}-{childPart}
      // We need to find the root topic ID = {baseId}--{rootPart}
      const basePrefix = `${bounty.baseId}--`;
      if (slugPart.startsWith(basePrefix)) {
        const afterBase = slugPart.slice(basePrefix.length);
        // Try progressively shorter prefixes to find the root topic
        const parts = afterBase.split("-");
        for (let i = parts.length - 1; i >= 1; i--) {
          const candidateRoot = `${basePrefix}${parts.slice(0, i).join("-")}`;
          const parent = await db.query.topics.findFirst({
            where: eq(schema.topics.id, candidateRoot),
            columns: { id: true, depth: true },
          });
          if (parent && parent.depth === 0) {
            await db
              .update(schema.bounties)
              .set({ parentTopicSlug: candidateRoot })
              .where(eq(schema.bounties.id, bounty.id));
            console.log(`  ✓ ${bounty.id} → parentTopicSlug: ${candidateRoot} (from ID pattern)`);
            updated++;
            break;
          }
        }
        continue;
      }
    }

    skipped++;
  }

  // Also clean up the old description suffix now that it's structural
  const withOldSuffix = allBounties.filter((b) =>
    b.description.includes("Use `baseSlug:") && b.description.includes("parentTopicSlug:")
  );
  if (withOldSuffix.length > 0) {
    console.log(`\nCleaning description suffix from ${withOldSuffix.length} bounties...`);
    for (const bounty of withOldSuffix) {
      const cleaned = bounty.description
        .replace(/\s*Use `baseSlug:.*?`\s*and\s*`parentTopicSlug:.*?`\s*when submitting\.\s*$/, "")
        .trim();
      if (cleaned !== bounty.description) {
        await db
          .update(schema.bounties)
          .set({ description: cleaned })
          .where(eq(schema.bounties.id, bounty.id));
        console.log(`  ✓ Cleaned description: ${bounty.id}`);
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Results");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (root bounties or no match): ${skipped}`);
  console.log(`  Already set: ${alreadySet.length}`);
  console.log(`  Descriptions cleaned: ${withOldSuffix.length}`);

  await pgClient.end();
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
