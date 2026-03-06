/**
 * Cleanup script for duplicate topics, resources, and stale bounties.
 *
 * For each group of duplicate topics (same title, case-insensitive):
 * 1. Pick the canonical (most children, then shortest slug) topic
 * 2. Move resources, edges, tags, children to canonical
 * 3. Delete duplicate topics (no AI merge — just keep canonical's content)
 * 4. Fix bounty statuses
 * 5. Deduplicate resources by URL
 *
 * Usage: npx tsx scripts/cleanup-duplicates.ts [--dry-run]
 */

import dotenv from "dotenv";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/server/db/schema";

dotenv.config({ path: "./.env" });

const pgClient = postgres(process.env.DATABASE_URL as string);
const db = drizzle(pgClient, { schema });

const DRY_RUN = process.argv.includes("--dry-run");

function log(msg: string) {
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}${msg}`);
}

async function deduplicateTopics() {
  log("=== Phase 1: Deduplicate Topics ===\n");

  // Find duplicate topic groups by lowercase title
  const dupeGroups = await db.execute<{ lower_title: string; cnt: number }>(
    sql`SELECT LOWER(title) as lower_title, COUNT(*) as cnt FROM topics GROUP BY LOWER(title) HAVING COUNT(*) > 1 ORDER BY cnt DESC`,
  );

  log(`Found ${dupeGroups.length} groups of duplicate topics\n`);

  let mergedCount = 0;
  let deletedCount = 0;

  for (const group of dupeGroups) {
    const lowerTitle = group.lower_title;

    // Get all topics with this title, with child counts
    const dupes = await db.query.topics.findMany({
      where: sql`LOWER(${schema.topics.title}) = ${lowerTitle}`,
      with: { childTopics: { columns: { id: true } } },
      orderBy: (t, { asc }) => [asc(t.id)],
    });

    if (dupes.length < 2) continue;

    // Canonical = most children, then shortest slug (no -N suffix)
    const sorted = [...dupes].sort((a: any, b: any) => {
      const diff = (b.childTopics?.length ?? 0) - (a.childTopics?.length ?? 0);
      return diff !== 0 ? diff : a.id.length - b.id.length;
    });
    const canonical = sorted[0]!;
    const duplicates = sorted.slice(1);

    log(`"${canonical.title}" — ${dupes.length} copies, canonical: ${canonical.id} (${(canonical as any).childTopics?.length ?? 0} children)`);

    for (const dupe of duplicates) {
      if (DRY_RUN) {
        log(`  Would delete ${dupe.id}`);
        deletedCount++;
        continue;
      }

      // Move resources from duplicate to canonical
      const dupeTopicResources = await db.query.topicResources.findMany({
        where: eq(schema.topicResources.topicId, dupe.id),
      });
      for (const tr of dupeTopicResources) {
        await db
          .insert(schema.topicResources)
          .values({
            id: `${canonical.id}--${tr.resourceId}`,
            topicId: canonical.id,
            resourceId: tr.resourceId,
            addedById: tr.addedById,
          })
          .onConflictDoNothing();
        await db.delete(schema.topicResources).where(eq(schema.topicResources.id, tr.id));
      }

      // Re-point source edges
      const sourceEdges = await db.query.edges.findMany({
        where: eq(schema.edges.sourceTopicId, dupe.id),
      });
      for (const edge of sourceEdges) {
        // Skip self-referential edges
        const targetId = edge.targetTopicId === dupe.id ? canonical.id : edge.targetTopicId;
        await db
          .insert(schema.edges)
          .values({
            id: `${canonical.id}--${edge.relationType}--${targetId}`,
            sourceTopicId: canonical.id,
            targetTopicId: targetId,
            relationType: edge.relationType,
          })
          .onConflictDoNothing();
        await db.delete(schema.edges).where(eq(schema.edges.id, edge.id));
      }

      // Re-point target edges
      const targetEdges = await db.query.edges.findMany({
        where: eq(schema.edges.targetTopicId, dupe.id),
      });
      for (const edge of targetEdges) {
        const sourceId = edge.sourceTopicId === dupe.id ? canonical.id : edge.sourceTopicId;
        await db
          .insert(schema.edges)
          .values({
            id: `${sourceId}--${edge.relationType}--${canonical.id}`,
            sourceTopicId: sourceId,
            targetTopicId: canonical.id,
            relationType: edge.relationType,
          })
          .onConflictDoNothing();
        await db.delete(schema.edges).where(eq(schema.edges.id, edge.id));
      }

      // Re-point child topics
      await db
        .update(schema.topics)
        .set({ parentTopicId: canonical.id })
        .where(eq(schema.topics.parentTopicId, dupe.id));

      // Re-point topic tags
      const dupeTags = await db.query.topicTags.findMany({
        where: eq(schema.topicTags.topicId, dupe.id),
      });
      for (const tt of dupeTags) {
        await db
          .insert(schema.topicTags)
          .values({
            id: `${canonical.id}--${tt.tagId}`,
            topicId: canonical.id,
            tagId: tt.tagId,
          })
          .onConflictDoNothing();
        await db.delete(schema.topicTags).where(eq(schema.topicTags.id, tt.id));
      }

      // Re-point activity references
      await db
        .update(schema.activity)
        .set({ topicId: canonical.id })
        .where(eq(schema.activity.topicId, dupe.id));

      // Re-point bounty references
      await db
        .update(schema.bounties)
        .set({ topicId: canonical.id })
        .where(eq(schema.bounties.topicId, dupe.id));

      // Delete the duplicate topic
      await db.delete(schema.topics).where(eq(schema.topics.id, dupe.id));

      deletedCount++;
      log(`  Deleted ${dupe.id} (moved ${dupeTopicResources.length} resources, ${sourceEdges.length}+${targetEdges.length} edges)`);
    }

    mergedCount++;
  }

  log(`\nProcessed ${mergedCount} groups, deleted ${deletedCount} duplicate topics`);
}

async function fixBountyStatuses() {
  log("\n=== Phase 2: Fix Bounty Statuses ===\n");

  // Expire stale claims
  const expired = await db
    .update(schema.bounties)
    .set({
      status: "open",
      claimedById: null,
      claimedAt: null,
      claimExpiresAt: null,
    })
    .where(
      sql`${schema.bounties.status} = 'claimed' AND ${schema.bounties.claimExpiresAt} < NOW()`,
    )
    .returning();
  log(`Expired ${expired.length} stale bounty claims`);

  // Find bounties that have approved submissions but aren't completed
  const stuckBounties = await db.execute<{ bounty_id: string; bounty_title: string; contributor_id: string }>(
    sql`
      SELECT DISTINCT b.id as bounty_id, b.title as bounty_title, s.contributor_id
      FROM bounties b
      JOIN submissions s ON s.bounty_id = b.id AND s.status = 'approved'
      WHERE b.status IN ('open', 'claimed')
    `,
  );

  log(`Found ${stuckBounties.length} bounties with approved submissions that aren't completed`);

  for (const row of stuckBounties) {
    log(`  Completing: "${row.bounty_title}" (${row.bounty_id})`);
    if (!DRY_RUN) {
      await db
        .update(schema.bounties)
        .set({
          status: "completed",
          completedById: row.contributor_id,
        })
        .where(eq(schema.bounties.id, row.bounty_id));
    }
  }
}

async function deduplicateResources() {
  log("\n=== Phase 3: Deduplicate Resources by URL ===\n");

  const dupeUrls = await db.execute<{ url: string; cnt: number }>(
    sql`SELECT url, COUNT(*) as cnt FROM resources WHERE url IS NOT NULL GROUP BY url HAVING COUNT(*) > 1 ORDER BY cnt DESC`,
  );

  log(`Found ${dupeUrls.length} duplicate resource URLs\n`);

  let deduped = 0;

  for (const row of dupeUrls) {
    const dupes = await db.query.resources.findMany({
      where: eq(schema.resources.url, row.url),
      orderBy: (r, { asc }) => [asc(r.createdAt)],
    });

    if (dupes.length < 2) continue;

    const canonical = dupes[0]!;
    const duplicates = dupes.slice(1);

    for (const dupe of duplicates) {
      if (!DRY_RUN) {
        const links = await db.query.topicResources.findMany({
          where: eq(schema.topicResources.resourceId, dupe.id),
        });

        for (const link of links) {
          await db
            .insert(schema.topicResources)
            .values({
              id: `${link.topicId}--${canonical.id}`,
              topicId: link.topicId,
              resourceId: canonical.id,
              addedById: link.addedById,
            })
            .onConflictDoNothing();
          await db.delete(schema.topicResources).where(eq(schema.topicResources.id, link.id));
        }

        await db
          .update(schema.activity)
          .set({ resourceId: canonical.id })
          .where(eq(schema.activity.resourceId, dupe.id));

        await db.delete(schema.resources).where(eq(schema.resources.id, dupe.id));
      }
      deduped++;
    }

    if (duplicates.length > 0) {
      log(`  "${row.url?.slice(0, 60)}" — kept ${canonical.id}, removed ${duplicates.length}`);
    }
  }

  log(`\nDeduplicated ${deduped} resources`);
}

async function main() {
  log("OpenLattice Data Cleanup\n");
  log(`Mode: ${DRY_RUN ? "DRY RUN (no changes will be made)" : "LIVE"}\n`);

  await deduplicateTopics();
  await fixBountyStatuses();
  await deduplicateResources();

  log("\n=== Verification ===\n");

  const remainingDupes = await db.execute(
    sql`SELECT LOWER(title) as t, COUNT(*) as c FROM topics GROUP BY LOWER(title) HAVING COUNT(*) > 1`,
  );
  log(`Remaining duplicate topic groups: ${remainingDupes.length}`);

  const topicCount = await db.execute(sql`SELECT COUNT(*) as c FROM topics`);
  log(`Total topics: ${(topicCount[0] as any)?.c}`);

  const remainingResUrlDupes = await db.execute(
    sql`SELECT url, COUNT(*) as c FROM resources WHERE url IS NOT NULL GROUP BY url HAVING COUNT(*) > 1`,
  );
  log(`Remaining duplicate resource URLs: ${remainingResUrlDupes.length}`);

  const stuckBounties = await db.execute(
    sql`SELECT COUNT(*) as c FROM bounties b JOIN submissions s ON s.bounty_id = b.id AND s.status = 'approved' WHERE b.status IN ('open', 'claimed')`,
  );
  log(`Stuck bounties (approved but not completed): ${(stuckBounties[0] as any)?.c ?? 0}`);

  log("\nDone!");
  await pgClient.end();
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  pgClient.end();
  process.exit(1);
});
