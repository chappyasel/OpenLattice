/**
 * One-time migration script to clean up evaluator-created tags.
 *
 * 1. Inserts the new seeded tags (AI Agents, Computer Vision, etc.)
 * 2. Reassigns topic_tags from old evaluator tags → proper seeded tags
 * 3. Deletes all orphaned evaluator-created tags (no icon)
 *
 * Usage: npx tsx scripts/migrate-tags.ts
 */

import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: "./.env" });

const sql = postgres(process.env.DATABASE_URL as string);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const TAG_MIGRATION_MAP: Record<string, string> = {
  // Exact duplicates (case mismatch with seeded tags)
  "safety-and-ethics": "safety-ethics",
  "policy-and-governance": "policy-governance",
  "society-and-culture": "society-culture",

  // Merges into Applied
  "llm-applications": "applied",
  "practical-techniques": "applied",
  "automation": "applied",
  "prompting": "applied",
  "productivity-and-workflows": "applied",

  // Merges into Technical
  "transformer-architectures": "technical",
  "optimization": "technical",
  "retrieval-augmented-generation": "technical",

  // Merges into Tooling
  "mlops-infrastructure": "tooling",
  "code-quality": "tooling",
  "developer-tools": "tooling",

  // Merges into other seeded tags
  "no-code-ai": "beginner-friendly",
  "legal-and-licensing": "policy-governance",
  "business-models": "industry",
  "climate-and-sustainability": "society-culture",
  "community-and-networking": "society-culture",
  "professional-development": "education",
  "fine-tuning": "llm-training",
  "multi-agent-systems": "ai-agents",
};

const NEW_TAGS = [
  { name: "AI Agents", icon: "ph:Robot", iconHue: 180 },
  { name: "Computer Vision", icon: "ph:Eye", iconHue: 60 },
  { name: "Generative Models", icon: "ph:PaintBrush", iconHue: 290 },
  { name: "LLM Training", icon: "ph:Brain", iconHue: 330 },
  { name: "Evaluation & Benchmarking", icon: "ph:ChartBar", iconHue: 80 },
  { name: "Education", icon: "ph:GraduationCap", iconHue: 100 },
  { name: "History", icon: "ph:ClockCounterClockwise", iconHue: 40 },
];

async function main() {
  console.log("=== Tag Migration ===\n");

  // 1. Upsert new seeded tags (update icon/name if they already exist without icons)
  console.log("1. Upserting new tags...");
  for (const tag of NEW_TAGS) {
    const id = slugify(tag.name);
    await sql`
      INSERT INTO tags (id, name, icon, icon_hue, description)
      VALUES (${id}, ${tag.name}, ${tag.icon}, ${tag.iconHue}, '')
      ON CONFLICT (id) DO UPDATE SET icon = ${tag.icon}, icon_hue = ${tag.iconHue}, name = ${tag.name}
    `;
    console.log(`   ${tag.name} (${id})`);
  }

  // 2. Reassign topic_tags from old → new
  console.log("\n2. Reassigning topic_tags...");
  for (const [oldId, newId] of Object.entries(TAG_MIGRATION_MAP)) {
    // Update topic_tags, skipping any that would create duplicates
    const moved = await sql`
      UPDATE topic_tags
      SET tag_id = ${newId}, id = topic_id || '--' || ${newId}
      WHERE tag_id = ${oldId}
      AND NOT EXISTS (
        SELECT 1 FROM topic_tags t2
        WHERE t2.topic_id = topic_tags.topic_id AND t2.tag_id = ${newId}
      )
    `;

    // Delete any remaining (duplicates that couldn't be moved)
    const dupes = await sql`
      DELETE FROM topic_tags WHERE tag_id = ${oldId} RETURNING *
    `;

    console.log(
      `   ${oldId} → ${newId}: ${moved.count} moved, ${dupes.count} dupes removed`,
    );
  }

  // 3. Delete all tags with no icon (evaluator-created junk)
  console.log("\n3. Deleting icon-less tags...");

  // First delete any remaining topic_tags pointing to icon-less tags
  const orphaned = await sql`
    DELETE FROM topic_tags
    WHERE tag_id IN (SELECT id FROM tags WHERE icon IS NULL)
    RETURNING *
  `;
  console.log(`   Removed ${orphaned.count} orphaned topic_tags`);

  // Then delete the tags themselves
  const deleted = await sql`
    DELETE FROM tags WHERE icon IS NULL RETURNING name
  `;
  console.log(`   Deleted ${deleted.count} icon-less tags:`);
  for (const t of deleted) {
    console.log(`     - ${t.name}`);
  }

  // 4. Verify final state
  console.log("\n4. Final tag state:");
  const finalTags = await sql`
    SELECT t.name, t.icon,
      (SELECT COUNT(*) FROM topic_tags tt WHERE tt.tag_id = t.id) AS topic_count
    FROM tags t
    ORDER BY t.name
  `;
  for (const t of finalTags) {
    console.log(`   ${t.name} (${t.icon}) — ${t.topic_count} topics`);
  }

  console.log("\n=== Migration Complete ===");
  await sql.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await sql.end();
  process.exit(1);
});
