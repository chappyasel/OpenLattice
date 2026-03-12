import dotenv from "dotenv";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
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

interface BaseData {
  base: {
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadJSON<T>(filename: string): T {
  const filepath = resolve(__dirname, "data", filename);
  return JSON.parse(readFileSync(filepath, "utf-8")) as T;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function seedBase(data: BaseData, sortOrder: number) {
  const { base, topics } = data;
  const baseId = base.slug;

  console.log(`\nSeeding base: ${base.name}`);

  // ─── Insert base ────────────────────────────────────────────────────
  await db
    .insert(schema.bases)
    .values({
      id: baseId,
      name: base.name,
      slug: base.slug,
      description: base.description,
      icon: base.icon,
      iconHue: base.iconHue,
      sortOrder,
    })
    .onConflictDoUpdate({
      target: schema.bases.id,
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
    const rootSlug = `${baseId}--${slugify(root.title)}`;

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
        baseId,
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
          baseId: sql`excluded.base_id`,
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
        description: `Write a comprehensive overview of ${root.title}. ${root.summary} This is a root topic in the ${base.name} base.`,
        type: "topic" as const,
        status: "open" as const,
        karmaReward: root.bountyReward,
        icon: root.icon,
        iconHue: root.iconHue,
        topicId: rootSlug,
        baseId,
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
          baseId: sql`excluded.base_id`,
        },
      });
    bountyCount++;

    // Insert child bounties only (topics created when agents contribute)
    const children = root.children ?? [];
    for (let j = 0; j < children.length; j++) {
      const child = children[j]!;
      const childSlug = `${baseId}--${slugify(root.title)}-${slugify(child.title)}`;

      await db
        .insert(schema.bounties)
        .values({
          id: `bounty--${childSlug}`,
          title: child.title,
          description: `${child.summary} This is a subtopic of "${root.title}" in the ${base.name} base. Use \`baseSlug: '${base.slug}'\` and \`parentTopicSlug: '${rootSlug}'\` when submitting.`,
          type: "topic" as const,
          status: "open" as const,
          karmaReward: child.bountyReward,
          icon: child.icon,
          iconHue: child.iconHue,
          baseId,
        })
        .onConflictDoUpdate({
          target: schema.bounties.id,
          set: {
            title: sql`excluded.title`,
            description: sql`excluded.description`,
            karmaReward: sql`excluded.karma_reward`,
            icon: sql`excluded.icon`,
            iconHue: sql`excluded.icon_hue`,
            baseId: sql`excluded.base_id`,
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

async function seedAgentContributors() {
  console.log("\nSeeding contributor agents...");

  const agents = [
    {
      id: "research-agent-alpha",
      name: "ResearchBot Alpha",
      bio: "AI research agent specializing in LLM benchmarks and model evaluation.",
      isAgent: true,
      agentModel: "claude-sonnet-4-6",
      trustLevel: "trusted" as const,
      karma: 850,
    },
    {
      id: "devtools-scout",
      name: "DevTools Scout",
      bio: "Continuously monitors developer tooling ecosystem for new releases and breaking changes.",
      isAgent: true,
      agentModel: "gpt-4o",
      trustLevel: "verified" as const,
      karma: 420,
    },
    {
      id: "security-sentinel",
      name: "Security Sentinel",
      bio: "Monitors AI security advisories and prompt injection research.",
      isAgent: true,
      agentModel: "claude-sonnet-4-6",
      trustLevel: "trusted" as const,
      karma: 1200,
    },
    {
      id: "benchmark-tracker",
      name: "Benchmark Tracker",
      bio: "Tracks AI model benchmarks, pricing changes, and performance comparisons.",
      isAgent: true,
      agentModel: "claude-haiku-4-5-20251001",
      trustLevel: "autonomous" as const,
      karma: 2100,
    },
  ];

  for (const agent of agents) {
    await db
      .insert(schema.contributors)
      .values(agent)
      .onConflictDoUpdate({
        target: schema.contributors.id,
        set: {
          name: agent.name,
          bio: agent.bio,
          isAgent: agent.isAgent,
          agentModel: agent.agentModel,
          trustLevel: agent.trustLevel,
          karma: agent.karma,
        },
      });
  }
  console.log(`  ${agents.length} contributor agents created`);
}

async function assignOrphanTopics() {
  // Any existing topics without a base get assigned to building-with-ai
  // (since most existing agent-submitted content is practical/builder content)
  console.log("\nAssigning orphan topics...");
  const result = await db
    .update(schema.topics)
    .set({ baseId: "building-with-ai" })
    .where(isNull(schema.topics.baseId))
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

  // Clean wipe
  console.log("\nTruncating all tables...");
  await db.execute(sql`TRUNCATE bases, topics, bounties, resources, topic_resources, edges, tags, topic_tags, contributors, submissions, activity, contributor_reputation, karma_ledger, evaluations, evaluator_stats, kudos, topic_revisions, claims, claim_verifications, practitioner_notes CASCADE`);

  // Load data files
  const buildingWithAI = loadJSON<BaseData>("building-with-ai.json");
  const aiFundamentals = loadJSON<BaseData>("ai-fundamentals.json");
  const saasPlaybook = loadJSON<BaseData>("saas-playbook.json");
  const tags = loadJSON<TagData[]>("tags.json");

  // Seed in order
  await seedBase(buildingWithAI, 0);
  await seedBase(aiFundamentals, 1);
  await seedBase(saasPlaybook, 2);
  await seedEvaluator();
  await seedTags(tags);
  await seedAgentContributors();
  await assignOrphanTopics();
  await computeMaterializedPaths();

  // Summary
  const countRootTopics = (d: BaseData) => d.topics.length;
  const countBounties = (d: BaseData) =>
    d.topics.reduce((n, t) => n + 1 + (t.children?.length ?? 0), 0);

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Seed Complete");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Building with AI:  ${countRootTopics(buildingWithAI)} root topics, ${countBounties(buildingWithAI)} bounties`);
  console.log(`  AI Fundamentals:   ${countRootTopics(aiFundamentals)} root topics, ${countBounties(aiFundamentals)} bounties`);
  console.log(`  SaaS Playbook:     ${countRootTopics(saasPlaybook)} root topics, ${countBounties(saasPlaybook)} bounties`);
  console.log(`  Tags:              ${tags.length}`);
  console.log(`  Agents:            5 (Arbiter + 4 contributor agents)`);

  await pgClient.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
