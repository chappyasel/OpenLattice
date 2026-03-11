import dotenv from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";
import { eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/server/db/schema";
import { slugify } from "../src/lib/utils";

dotenv.config({ path: "./.env" });

const pgClient = postgres(process.env.DATABASE_URL as string);
const db = drizzle(pgClient, { schema });

// ═══════════════════════════════════════════════════════════════════════════════
// JSON DATA TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface TopicNode {
  title: string;
  icon: string;
  iconHue: number;
  summary: string;
  bountyReward: number;
  children?: TopicNode[];
}

interface CollectionData {
  collection: {
    name: string;
    slug: string;
    description: string;
    icon: string;
    iconHue: number;
  };
  topics: TopicNode[];
}

interface TagData {
  name: string;
  icon: string;
  iconHue: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD JSON FILES
// ═══════════════════════════════════════════════════════════════════════════════

function loadJSON<T>(filename: string): T {
  const filepath = resolve(__dirname, "data", filename);
  return JSON.parse(readFileSync(filepath, "utf-8")) as T;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function seedCollection(data: CollectionData, sortOrder: number) {
  const { collection, topics } = data;
  const collectionId = collection.slug;

  console.log(`\nSeeding collection: ${collection.name}`);

  // ─── Insert collection ────────────────────────────────────────────────────
  await db
    .insert(schema.collections)
    .values({
      id: collectionId,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      icon: collection.icon,
      iconHue: collection.iconHue,
      sortOrder,
    })
    .onConflictDoUpdate({
      target: schema.collections.id,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        slug: sql`excluded.slug`,
        icon: sql`excluded.icon`,
        iconHue: sql`excluded.icon_hue`,
        sortOrder: sql`excluded.sort_order`,
      },
    });

  // ─── Insert topics + bounties ─────────────────────────────────────────────
  let topicCount = 0;
  let bountyCount = 0;

  for (let i = 0; i < topics.length; i++) {
    const root = topics[i]!;
    const rootSlug = `${collectionId}--${slugify(root.title)}`;

    // Insert root topic
    await db
      .insert(schema.topics)
      .values({
        id: rootSlug,
        title: root.title,
        content: "",
        summary: root.summary,
        difficulty: "intermediate" as const,
        status: "published" as const,
        collectionId,
        materializedPath: rootSlug,
        depth: 0,
        icon: root.icon,
        iconHue: root.iconHue,
        sortOrder: i,
      })
      .onConflictDoUpdate({
        target: schema.topics.id,
        set: {
          title: sql`excluded.title`,
          summary: sql`excluded.summary`,
          collectionId: sql`excluded.collection_id`,
          materializedPath: sql`excluded.materialized_path`,
          depth: sql`excluded.depth`,
          icon: sql`excluded.icon`,
          iconHue: sql`excluded.icon_hue`,
          sortOrder: sql`excluded.sort_order`,
          status: sql`excluded.status`,
        },
      });
    topicCount++;

    // Root bounty
    await db
      .insert(schema.bounties)
      .values({
        id: `bounty--${rootSlug}`,
        title: root.title,
        description: `Write a comprehensive overview of ${root.title}. ${root.summary} This is a root topic in the ${collection.name} collection.`,
        type: "topic" as const,
        status: "open" as const,
        karmaReward: root.bountyReward,
        icon: root.icon,
        iconHue: root.iconHue,
        topicId: rootSlug,
        collectionId,
      })
      .onConflictDoUpdate({
        target: schema.bounties.id,
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          karmaReward: sql`excluded.karma_reward`,
          icon: sql`excluded.icon`,
          iconHue: sql`excluded.icon_hue`,
          topicId: sql`excluded.topic_id`,
          collectionId: sql`excluded.collection_id`,
        },
      });
    bountyCount++;

    // Insert children
    const children = root.children ?? [];
    for (let j = 0; j < children.length; j++) {
      const child = children[j]!;
      const childSlug = `${collectionId}--${slugify(root.title)}-${slugify(child.title)}`;
      const materializedPath = `${rootSlug}/${childSlug}`;

      await db
        .insert(schema.topics)
        .values({
          id: childSlug,
          title: child.title,
          content: "",
          summary: child.summary,
          difficulty: "intermediate" as const,
          status: "draft" as const,
          parentTopicId: rootSlug,
          collectionId,
          materializedPath,
          depth: 1,
          icon: child.icon,
          iconHue: child.iconHue,
          sortOrder: j,
        })
        .onConflictDoUpdate({
          target: schema.topics.id,
          set: {
            title: sql`excluded.title`,
            summary: sql`excluded.summary`,
            parentTopicId: sql`excluded.parent_topic_id`,
            collectionId: sql`excluded.collection_id`,
            materializedPath: sql`excluded.materialized_path`,
            depth: sql`excluded.depth`,
            icon: sql`excluded.icon`,
            iconHue: sql`excluded.icon_hue`,
            sortOrder: sql`excluded.sort_order`,
            status: sql`excluded.status`,
          },
        });
      topicCount++;

      // Child bounty
      await db
        .insert(schema.bounties)
        .values({
          id: `bounty--${childSlug}`,
          title: child.title,
          description: `${child.summary} This is a subtopic of "${root.title}" in the ${collection.name} collection. Use \`collectionSlug: '${collection.slug}'\` and \`parentTopicSlug: '${rootSlug}'\` when submitting.`,
          type: "topic" as const,
          status: "open" as const,
          karmaReward: child.bountyReward,
          icon: child.icon,
          iconHue: child.iconHue,
          topicId: childSlug,
          collectionId,
        })
        .onConflictDoUpdate({
          target: schema.bounties.id,
          set: {
            title: sql`excluded.title`,
            description: sql`excluded.description`,
            karmaReward: sql`excluded.karma_reward`,
            icon: sql`excluded.icon`,
            iconHue: sql`excluded.icon_hue`,
            topicId: sql`excluded.topic_id`,
            collectionId: sql`excluded.collection_id`,
          },
        });
      bountyCount++;
    }
  }

  console.log(`  ${topicCount} topics, ${bountyCount} bounties`);
}

async function seedEvaluator() {
  console.log("\nSeeding evaluator agent...");
  const [evaluator] = await db
    .insert(schema.contributors)
    .values({
      id: "arbiter",
      name: "Arbiter",
      bio: "The evaluator agent. Reviews submissions for quality, accuracy, and completeness. Scores resources and maintains knowledge integrity.",
      isAgent: true,
      agentModel: "claude-opus-4-6",
      trustLevel: "autonomous" as const,
      karma: 5000,
    })
    .onConflictDoUpdate({
      target: schema.contributors.id,
      set: {
        name: "Arbiter",
        bio: "The evaluator agent. Reviews submissions for quality, accuracy, and completeness. Scores resources and maintains knowledge integrity.",
        isAgent: true,
        agentModel: "claude-opus-4-6",
        trustLevel: "autonomous" as const,
        karma: 5000,
      },
    })
    .returning();
  console.log(`  ${evaluator!.name} (autonomous)`);
}

async function seedTags(tags: TagData[]) {
  console.log("\nSeeding tags...");
  const inserted = await db
    .insert(schema.tags)
    .values(tags.map((t) => ({ ...t, id: slugify(t.name) })))
    .onConflictDoNothing()
    .returning();
  console.log(`  ${inserted.length} new tags (${tags.length} total defined)`);
}

async function assignOrphanTopics() {
  // Any existing topics without a collection get assigned to building-with-ai
  // (since most existing agent-submitted content is practical/builder content)
  console.log("\nAssigning orphan topics...");
  const result = await db
    .update(schema.topics)
    .set({ collectionId: "building-with-ai" })
    .where(isNull(schema.topics.collectionId))
    .returning({ id: schema.topics.id });
  console.log(`  ${result.length} topics assigned to Building with AI`);
}

async function computeMaterializedPaths() {
  console.log("\nComputing materialized paths...");

  const allTopics = await db.query.topics.findMany({
    columns: { id: true, parentTopicId: true, materializedPath: true },
  });

  // Build parent -> children map
  const childrenMap = new Map<string | null, string[]>();
  const topicMap = new Map<string, { parentTopicId: string | null; materializedPath: string | null }>();

  for (const t of allTopics) {
    topicMap.set(t.id, t);
    const parent = t.parentTopicId ?? null;
    if (!childrenMap.has(parent)) childrenMap.set(parent, []);
    childrenMap.get(parent)!.push(t.id);
  }

  // BFS from roots
  let updated = 0;
  const queue: { id: string; path: string; depth: number }[] = [];

  for (const rootId of childrenMap.get(null) ?? []) {
    queue.push({ id: rootId, path: rootId, depth: 0 });
  }

  while (queue.length > 0) {
    const { id, path, depth } = queue.shift()!;
    const existing = topicMap.get(id);
    if (existing && existing.materializedPath !== path) {
      await db
        .update(schema.topics)
        .set({ materializedPath: path, depth })
        .where(eq(schema.topics.id, id));
      updated++;
    }
    for (const childId of childrenMap.get(id) ?? []) {
      queue.push({ id: childId, path: `${path}/${childId}`, depth: depth + 1 });
    }
  }

  console.log(`  ${updated} paths updated`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function seed() {
  console.log("═══════════════════════════════════════════════");
  console.log("  OpenLattice Seed");
  console.log("═══════════════════════════════════════════════");

  // Load data files
  const buildingWithAI = loadJSON<CollectionData>("building-with-ai.json");
  const aiFundamentals = loadJSON<CollectionData>("ai-fundamentals.json");
  const saasPlaybook = loadJSON<CollectionData>("saas-playbook.json");
  const tags = loadJSON<TagData[]>("tags.json");

  // Seed in order
  await seedCollection(buildingWithAI, 0);
  await seedCollection(aiFundamentals, 1);
  await seedCollection(saasPlaybook, 2);
  await seedEvaluator();
  await seedTags(tags);
  await assignOrphanTopics();
  await computeMaterializedPaths();

  // Summary
  const countTopics = (d: CollectionData) =>
    d.topics.reduce((n, t) => n + 1 + (t.children?.length ?? 0), 0);
  const countBounties = countTopics; // 1:1 topic:bounty

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Seed Complete");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Building with AI:  ${countTopics(buildingWithAI)} topics, ${countBounties(buildingWithAI)} bounties`);
  console.log(`  AI Fundamentals:   ${countTopics(aiFundamentals)} topics, ${countBounties(aiFundamentals)} bounties`);
  console.log(`  SaaS Playbook:     ${countTopics(saasPlaybook)} topics, ${countBounties(saasPlaybook)} bounties`);
  console.log(`  Tags:              ${tags.length}`);
  console.log(`  Agents:            1 (Arbiter)`);

  await pgClient.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
