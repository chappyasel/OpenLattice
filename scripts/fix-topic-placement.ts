import dotenv from "dotenv";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/server/db/schema";
import { slugify } from "../src/lib/utils";

dotenv.config({ path: "./.env" });

const pgClient = postgres(process.env.DATABASE_URL as string);
const db = drizzle(pgClient, { schema });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ═══════════════════════════════════════════════════════════════════════════════
// Load seed data to determine expected root topics
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
  base: { name: string; slug: string; description: string; icon: string; iconHue: number };
  topics: TopicNode[];
}

function loadJSON<T>(filename: string): T {
  const filepath = resolve(__dirname, "data", filename);
  return JSON.parse(readFileSync(filepath, "utf-8")) as T;
}

const bases = [
  loadJSON<BaseData>("building-with-ai.json"),
  loadJSON<BaseData>("ai-fundamentals.json"),
  loadJSON<BaseData>("saas-playbook.json"),
];

// Build the set of expected root topic IDs
const expectedRootIds = new Set<string>();
// Also build a map of child title -> parent root topic ID for matching
const childTitleToParent = new Map<string, string>();
// And a map of root topic title keywords for fuzzy matching
const rootTopicKeywords = new Map<string, { id: string; baseSlug: string; summary: string }>();

for (const base of bases) {
  for (const topic of base.topics) {
    const rootId = `${base.base.slug}--${slugify(topic.title)}`;
    expectedRootIds.add(rootId);
    rootTopicKeywords.set(topic.title.toLowerCase(), {
      id: rootId,
      baseSlug: base.base.slug,
      summary: topic.summary,
    });

    // Map child titles to their parent root
    for (const child of topic.children ?? []) {
      childTitleToParent.set(child.title.toLowerCase(), rootId);
      // Also store slugified versions
      childTitleToParent.set(slugify(child.title), rootId);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Keyword-based matching for topics that don't exactly match a child title
// ═══════════════════════════════════════════════════════════════════════════════

// Map of keywords -> root topic ID for each base
const keywordMap: { keywords: string[]; rootId: string }[] = [
  // Building with AI
  { keywords: ["mcp", "model context protocol", "tool", "agent", "multi-agent", "coding tool", "ai search", "workflow", "automation", "crewai", "langgraph", "autogen", "claude code", "cursor", "copilot", "devin"],
    rootId: "building-with-ai--agents-tools" },
  { keywords: ["prompt", "rag", "retrieval", "fine-tun", "fine tun", "evaluation", "eval", "synthetic data", "generation", "chain-of-thought", "few-shot", "embedding"],
    rootId: "building-with-ai--prompting-generation" },
  { keywords: ["api", "vector database", "pinecone", "weaviate", "chroma", "pgvector", "production", "deploy", "infrastructure", "serving", "monitoring", "developer tool", "devtool"],
    rootId: "building-with-ai--infrastructure-deployment" },
  { keywords: ["getting started", "first ai app", "beginner", "choosing", "no-code", "chatgpt vs", "claude vs"],
    rootId: "building-with-ai--getting-started" },

  // AI Fundamentals
  { keywords: ["llm", "large language model", "transformer", "attention", "open-source model", "open source model", "llama", "mistral", "gemma", "computer vision", "image generation", "diffusion", "dall-e", "midjourney", "stable diffusion", "speech", "audio", "whisper", "architecture", "model"],
    rootId: "ai-fundamentals--models-architecture" },
  { keywords: ["safety", "alignment", "rlhf", "constitutional", "bias", "fairness", "privacy", "misinformation", "deepfake", "red team"],
    rootId: "ai-fundamentals--safety-alignment" },
  { keywords: ["regulation", "eu ai act", "copyright", "geopolitic", "governance", "policy", "legal"],
    rootId: "ai-fundamentals--governance-policy" },
  { keywords: ["future of work", "education", "creative ai", "economics", "history of ai", "society", "impact", "job", "employment", "automation"],
    rootId: "ai-fundamentals--society-impact" },
  { keywords: ["healthcare", "finance", "trading", "science", "alphafold", "climate", "robotics", "industry", "application", "medical", "drug discovery"],
    rootId: "ai-fundamentals--industry-applications" },
  { keywords: ["glossary", "learning path", "key people", "landmark paper", "community", "reference", "how ai works", "communities"],
    rootId: "ai-fundamentals--reference" },

  // SaaS Playbook
  { keywords: ["idea", "problem discovery", "market research", "niche", "competitor", "opportunity"],
    rootId: "saas-playbook--idea" },
  { keywords: ["validation", "customer interview", "landing page test", "waitlist", "pre sale", "demand test"],
    rootId: "saas-playbook--validation" },
  { keywords: ["planning", "roadmap", "feature prioritization", "mvp scope", "tech stack", "development plan"],
    rootId: "saas-playbook--planning" },
  { keywords: ["design", "wireframe", "ui design", "ux flow", "prototype", "design system"],
    rootId: "saas-playbook--design" },
  { keywords: ["development", "frontend", "backend", "api", "database", "authentication", "integration"],
    rootId: "saas-playbook--development" },
  { keywords: ["cloud hosting", "devops", "ci cd", "ci/cd", "monitoring", "security", "infrastructure"],
    rootId: "saas-playbook--infrastructure" },
  { keywords: ["testing", "unit test", "integration test", "bug", "performance test", "beta test"],
    rootId: "saas-playbook--testing" },
  { keywords: ["launch", "product hunt", "beta user", "early adopter", "public release"],
    rootId: "saas-playbook--launch" },
  { keywords: ["acquisition", "seo", "content marketing", "social media", "cold email", "influencer", "affiliate"],
    rootId: "saas-playbook--acquisition" },
  { keywords: ["distribution", "directories", "marketplace", "communities", "partnership", "integration partner"],
    rootId: "saas-playbook--distribution" },
  { keywords: ["conversion", "sales funnel", "free trial", "freemium", "pricing", "checkout"],
    rootId: "saas-playbook--conversion" },
  { keywords: ["revenue", "subscription", "upsell", "add-on", "annual plan", "enterprise deal"],
    rootId: "saas-playbook--revenue" },
  { keywords: ["analytics", "user tracking", "funnel analysis", "cohort", "kpi", "a/b test"],
    rootId: "saas-playbook--analytics" },
  { keywords: ["retention", "onboarding", "email automation", "customer support", "feature adoption", "churn"],
    rootId: "saas-playbook--retention" },
  { keywords: ["growth", "referral", "community building", "product led", "viral", "expansion strategy"],
    rootId: "saas-playbook--growth" },
  { keywords: ["scaling", "automation", "hiring", "systems", "global expansion", "exit strategy"],
    rootId: "saas-playbook--scaling" },
];

function findBestParent(title: string, summary: string | null, baseId: string | null): string | null {
  const titleLower = title.toLowerCase();
  const titleSlug = slugify(title);

  // 1. Exact match on child title from seed data
  if (childTitleToParent.has(titleLower)) {
    return childTitleToParent.get(titleLower)!;
  }
  if (childTitleToParent.has(titleSlug)) {
    return childTitleToParent.get(titleSlug)!;
  }

  // 2. Keyword matching
  const searchText = `${titleLower} ${(summary ?? "").toLowerCase()}`;
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const entry of keywordMap) {
    // If we know the baseId, only match within that base
    if (baseId && !entry.rootId.startsWith(baseId)) continue;

    let score = 0;
    for (const kw of entry.keywords) {
      if (searchText.includes(kw)) {
        score += kw.length; // longer keyword matches are more specific
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry.rootId;
    }
  }

  return bestMatch;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main fix logic
// ═══════════════════════════════════════════════════════════════════════════════

async function fix() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Fix Topic Placement");
  console.log("═══════════════════════════════════════════════");

  // Get all topics
  const allTopics = await db.query.topics.findMany({
    columns: { id: true, title: true, summary: true, parentTopicId: true, baseId: true, depth: true, materializedPath: true },
  });

  console.log(`\nTotal topics in DB: ${allTopics.length}`);

  // Find misplaced root topics (depth 0 but not in expected roots)
  const misplaced = allTopics.filter(
    (t) => t.depth === 0 && !expectedRootIds.has(t.id)
  );

  console.log(`Expected root topics: ${expectedRootIds.size}`);
  console.log(`Misplaced root topics (depth 0 but shouldn't be): ${misplaced.length}`);

  if (misplaced.length === 0) {
    console.log("\nNo misplaced topics found! Everything looks correct.");
    await pgClient.end();
    return;
  }

  // Also find topics with null parentTopicId that aren't expected roots
  const orphanNonRoots = allTopics.filter(
    (t) => t.parentTopicId === null && !expectedRootIds.has(t.id)
  );

  console.log(`\nMisplaced topics to fix:`);
  const moves: { topicId: string; title: string; newParentId: string; baseId: string }[] = [];
  const unmatched: typeof misplaced = [];

  for (const topic of misplaced) {
    const parentId = findBestParent(topic.title, topic.summary, topic.baseId);
    if (parentId) {
      moves.push({ topicId: topic.id, title: topic.title, newParentId: parentId, baseId: topic.baseId ?? parentId.split("--")[0]! });
      console.log(`  ✓ "${topic.title}" → under "${parentId}"`);
    } else {
      unmatched.push(topic);
      console.log(`  ✗ "${topic.title}" — NO MATCH FOUND (base: ${topic.baseId})`);
    }
  }

  if (unmatched.length > 0) {
    console.log(`\n⚠ ${unmatched.length} topics could not be auto-matched. They will be placed under the first root topic of their base as a fallback.`);
    for (const topic of unmatched) {
      // Find first root topic in the same base
      const baseSlug = topic.baseId ?? "building-with-ai";
      const baseData = bases.find((b) => b.base.slug === baseSlug);
      if (baseData) {
        const fallbackRoot = `${baseSlug}--${slugify(baseData.topics[0]!.title)}`;
        moves.push({ topicId: topic.id, title: topic.title, newParentId: fallbackRoot, baseId: baseSlug });
        console.log(`  → "${topic.title}" → fallback to "${fallbackRoot}"`);
      }
    }
  }

  // Apply moves
  console.log(`\nApplying ${moves.length} reparent operations...`);
  for (const move of moves) {
    // Get the parent topic to compute new path
    const parent = allTopics.find((t) => t.id === move.newParentId);
    const parentPath = parent?.materializedPath ?? move.newParentId;
    const parentDepth = parent?.depth ?? 0;
    const newDepth = parentDepth + 1;
    const newPath = `${parentPath}/${move.topicId}`;

    await db
      .update(schema.topics)
      .set({
        parentTopicId: move.newParentId,
        baseId: move.baseId,
        depth: newDepth,
        materializedPath: newPath,
      })
      .where(eq(schema.topics.id, move.topicId));
  }

  // Now recompute materialized paths for ALL descendants of moved topics
  // (in case they have children that also need path updates)
  console.log("\nRecomputing materialized paths for all topics...");
  const refreshedTopics = await db.query.topics.findMany({
    columns: { id: true, parentTopicId: true, materializedPath: true, depth: true },
  });

  const childrenMap = new Map<string | null, string[]>();
  for (const t of refreshedTopics) {
    const parent = t.parentTopicId ?? null;
    if (!childrenMap.has(parent)) childrenMap.set(parent, []);
    childrenMap.get(parent)!.push(t.id);
  }

  const topicMap = new Map(refreshedTopics.map((t) => [t.id, t]));

  // BFS from roots
  let updated = 0;
  const queue: { id: string; path: string; depth: number }[] = [];
  for (const rootId of childrenMap.get(null) ?? []) {
    queue.push({ id: rootId, path: rootId, depth: 0 });
  }

  while (queue.length > 0) {
    const { id, path, depth } = queue.shift()!;
    const existing = topicMap.get(id);
    if (existing && (existing.materializedPath !== path || existing.depth !== depth)) {
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

  console.log(`  ${updated} paths recomputed`);

  // Final summary
  const finalTopics = await db.query.topics.findMany({
    columns: { id: true, depth: true },
  });
  const finalRoots = finalTopics.filter((t) => t.depth === 0);
  const unexpectedRoots = finalRoots.filter((t) => !expectedRootIds.has(t.id));

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Results");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Total topics: ${finalTopics.length}`);
  console.log(`  Root topics (depth 0): ${finalRoots.length}`);
  console.log(`  Expected root topics: ${expectedRootIds.size}`);
  if (unexpectedRoots.length > 0) {
    console.log(`  ⚠ Unexpected roots remaining: ${unexpectedRoots.length}`);
    for (const r of unexpectedRoots) {
      console.log(`    - ${r.id}`);
    }
  } else {
    console.log(`  ✓ All root topics match seed data!`);
  }

  await pgClient.end();
}

fix().catch((err) => {
  console.error("Fix failed:", err);
  process.exit(1);
});
