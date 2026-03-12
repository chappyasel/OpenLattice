/**
 * One-time script to assign orphaned topics (base_id IS NULL) to their appropriate bases.
 *
 * Usage: npx tsx scripts/fix-orphaned-topics.ts
 */

import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: "./.env" });

const sql = postgres(process.env.DATABASE_URL as string);

const assignments: [string, string][] = [
  // ai-fundamentals
  ["ai-geopolitics", "ai-fundamentals"],
  ["ai-in-science", "ai-fundamentals"],
  ["creative-ai", "ai-fundamentals"],
  ["ai-and-copyright", "ai-fundamentals"],
  ["ai-regulation", "ai-fundamentals"],
  ["healthcare-ai", "ai-fundamentals"],
  ["ai-economics", "ai-fundamentals"],
  ["open-source-models", "ai-fundamentals"],
  ["ai-glossary", "ai-fundamentals"],
  // building-with-ai
  ["getting-started-with-ai", "building-with-ai"],
  ["ai-coding-tools", "building-with-ai"],
  ["vector-databases", "building-with-ai"],
];

async function main() {
  console.log("Fixing orphaned topics...\n");

  for (const [topicId, baseId] of assignments) {
    const result = await sql`
      UPDATE topics SET base_id = ${baseId}
      WHERE id = ${topicId} AND base_id IS NULL
      RETURNING id, title, base_id
    `;
    if (result.length > 0) {
      console.log(`  ✓ ${result[0]!.title} → ${baseId}`);
    } else {
      console.log(`  ✗ ${topicId} — not found or already assigned`);
    }
  }

  // Verify none remain
  const remaining = await sql`SELECT id, title FROM topics WHERE base_id IS NULL`;
  if (remaining.length > 0) {
    console.log(`\n⚠ ${remaining.length} topics still orphaned:`);
    for (const t of remaining) console.log(`  - ${t.title} (${t.id})`);
  } else {
    console.log("\n✓ No orphaned topics remain.");
  }

  await sql.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Failed:", err);
  await sql.end();
  process.exit(1);
});
