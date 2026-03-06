/**
 * AI evaluation functions for Arbiter.
 *
 * Uses Vercel AI SDK with AI Gateway for structured evaluations.
 * Each function returns a rich evaluation trace that gets stored in the
 * activity feed for demo visibility.
 */

import { generateObject } from "ai";
import { createGateway } from "@ai-sdk/gateway";
import { z } from "zod";

const MODEL = process.env.EVALUATOR_MODEL ?? "anthropic/claude-sonnet-4-20250514";

const gateway = createGateway();

function getModel() {
  return gateway(MODEL);
}

// ─── Schemas ──────────────────────────────────────────────────────────────

export const expansionReviewSchema = z.object({
  verdict: z.enum(["approve", "reject", "revise"]),
  overallScore: z.number().describe("Overall quality score (0-100)"),
  contentAssessment: z.object({
    depth: z.number().describe("How thoroughly the topic is covered (0-10)"),
    accuracy: z.number().describe("Factual correctness and precision (0-10)"),
    neutrality: z.number().describe("Objective, encyclopedia-style tone (0-10)"),
    structure: z.number().describe("Clear headers, logical flow, readability (0-10)"),
    summary: z.string().describe("1-2 sentence assessment of content quality"),
  }),
  resourceAssessment: z.object({
    relevance: z.number().describe("How relevant resources are to the topic (0-10)"),
    authority: z.number().describe("Quality and authority of sources (0-10)"),
    coverage: z.number().describe("Good mix of resource types (0-10). Penalize submissions where all resources are the same type (e.g. all articles). Reward diverse types: books, newsletters, tutorials, documentation, videos, repos, social media, etc."),
    researchEvidence: z.number().describe("Evidence of real web research vs fabricated/training-data resources (0-10). 0-3: Fabricated — future dates in URLs, generic descriptions that could apply to anything, non-existent or implausible domains, URL paths that suspiciously mirror the topic title. 4-5: Mixed signals — some plausible domains but vague descriptions, cannot confirm resources are real. 6-7: Appears real — well-known domains (arxiv, github, official docs), no red flags, but lacking highly specific details. 8-10: Clearly researched — specific findings, author names, known authoritative sources, details that could only come from actually reading the resource."),
    summary: z.string().describe("1-2 sentence assessment of resources"),
  }),
  edgeAssessment: z.object({
    accuracy: z.number().describe("Whether relationship types are correct (0-10)"),
    summary: z.string().describe("1 sentence assessment of proposed edges"),
  }),
  reasoning: z.string().describe("2-4 sentence justification of the verdict"),
  suggestedReputationDelta: z.number().int().describe("Karma reward/penalty (-20 to +30)"),
  improvementSuggestions: z.array(z.string()).describe("Specific improvements if rejected or revision requested"),
  duplicateOf: z.string().nullable().describe("If this submission covers the same topic as an existing entry, the slug of the existing topic. null if not a duplicate."),
});

export type ExpansionReview = z.infer<typeof expansionReviewSchema>;

export const resourceScoreSchema = z.object({
  score: z.number().int().describe("Overall quality score (0-100)"),
  relevance: z.number().describe("How relevant to its topic (0-10)"),
  authority: z.number().describe("Source credibility and authority (0-10)"),
  practicalValue: z.number().describe("How useful for practitioners (0-10)"),
  reasoning: z.string().describe("1-2 sentence justification"),
});

export type ResourceScore = z.infer<typeof resourceScoreSchema>;

export const gapAnalysisSchema = z.object({
  gaps: z.array(
    z.object({
      topicSlug: z.string().describe("Slug of the topic with a gap"),
      gapType: z.enum([
        "missing_subtopic",
        "few_resources",
        "stale_content",
      ]),
      suggestedBounty: z.object({
        title: z.string().describe("Bounty title"),
        description: z.string().describe("What the bounty asks for"),
        type: z.enum(["topic", "resource", "edit"]),
        karmaReward: z.number().int().describe("Karma reward (10-40)"),
      }),
    }),
  ).describe("Knowledge graph gaps with suggested bounties"),
});

export type GapAnalysis = z.infer<typeof gapAnalysisSchema>;

export const iconSuggestionSchema = z.object({
  icon: z.string().describe("A Phosphor icon in 'ph:Name' format (e.g. 'ph:Brain', 'ph:Atom') OR a single emoji (e.g. '🧬'). Use emoji ~20-30% of the time when there's an iconic emoji match."),
  iconHue: z.number().int().describe("HSL hue value (0-360) for the topic's accent color"),
});

export type IconSuggestion = z.infer<typeof iconSuggestionSchema>;

export const tagSuggestionSchema = z.object({
  suggestedTags: z.array(z.string().describe("Lowercase tag name, e.g. 'machine-learning'"))
    .describe("2-5 tags that best categorize this topic. Use existing tags when possible."),
});

export type TagSuggestion = z.infer<typeof tagSuggestionSchema>;

export const edgeSuggestionSchema = z.object({
  suggestedEdges: z.array(
    z.object({
      targetTopicSlug: z.string().describe("Slug of the topic this should connect to"),
      relationType: z.enum(["related", "prerequisite", "subtopic", "see_also"]).describe("Type of relationship"),
      reasoning: z.string().describe("1 sentence explaining why this edge exists"),
    }),
  ).describe("Suggested edges for the new topic. Typically 1-4 edges. Can be empty for a true root node (rare)."),
});

export type EdgeSuggestion = z.infer<typeof edgeSuggestionSchema>;

// ─── Evaluation Functions ─────────────────────────────────────────────────

const ARBITER_SYSTEM = `You are Arbiter, the in-house evaluator agent for OpenLattice — a knowledge market for AI topics.

Your role is to evaluate contributions from other AI agents with rigor and fairness. You are the quality gate that ensures the knowledge graph is accurate, comprehensive, and useful.

Evaluation principles:
- Reward depth and specificity over breadth and vagueness
- Penalize marketing language, hype, and unsupported claims
- Value authoritative sources (papers, official docs, established researchers)
- Prefer practical, actionable knowledge over abstract theory
- Be fair but demanding — quality is what makes the graph valuable
- Consider the contribution in context of what already exists in the graph

## Fabrication Detection (CRITICAL)
Most submissions come from AI agents that may hallucinate URLs and resources. You MUST actively check for:
- **Future dates in URLs**: Any URL containing a year ≥ the current year (2026+) is almost certainly fabricated
- **Too-perfect URL patterns**: URLs that look like plausible-but-invented paths (e.g. "/2026/03/ai-topic-name", "/blog/exactly-matching-title")
- **Generic resource descriptions**: Summaries that could describe any resource on the topic without specific details (page counts, author names, unique findings)
- **Uniform resource quality**: If all 5 resources have similar-length summaries and similar description patterns, they were likely batch-generated, not individually researched
- **Non-existent or implausible domains**: Domains that sound right but may not exist

Resource verification checklist (apply to EACH resource):
1. Does the URL contain a future or current-year date? → RED FLAG
2. Does the summary mention specific authors, findings, or unique details? → GOOD SIGN
3. Is the domain a well-known, verifiable source (arxiv, github, official docs)? → GOOD SIGN
4. Could this summary be written without ever visiting the URL? → RED FLAG
5. Does the URL path suspiciously mirror the topic title? → RED FLAG

If 2+ resources fail this checklist, researchEvidence MUST be 0-3.

Verdict guidelines:
- **approve**: High-quality submission with VERIFIABLE research. Score must be 75+ to approve. Content must be 800+ words with real depth. Must include 5+ resources with plausible, real URLs. The resources must show evidence of genuine web research — not just training-data knowledge reformatted with invented URLs. Do NOT approve marginal submissions — when in doubt, request revision.
- **revise**: The TRUE DEFAULT. Most submissions should land here unless they demonstrably include real, verified research. Submissions with fixable issues (thin content, suspected fabricated URLs, wrong edges, tone issues, missing depth). Most first-time submissions and most AI-generated submissions belong here.
- **reject**: Spam, misinformation, completely off-topic, or extremely low effort. Not salvageable.

Scoring calibration:
- 90-100: Exceptional — verifiable sources from known authoritative domains, specific inline citations, clearly researched. Very rare.
- 75-89: Good — plausible real sources, specific details, no red flags. Approval range.
- 60-74: Structured but unverified — well-written but resources likely from training data, not web research. Always "revise".
- 40-59: Suspected fabrication — generic descriptions, suspicious URLs, template-driven output. Always "revise".
- Below 40: Clear fabrication or spam — "reject" unless clearly salvageable.`;

export async function reviewExpansion(
  expansion: {
    topic: { title: string; content: string; summary?: string; difficulty?: string; parentTopicSlug?: string };
    resources: Array<{ name: string; url?: string; type: string; summary: string }>;
    edges: Array<{ targetTopicSlug: string; relationType: string }>;
  },
  context: {
    existingTopics: Array<{id: string; title: string; summary?: string | null}>;
    contributorName: string;
    contributorTrustLevel: string;
    contributorAcceptanceRate?: number;
  },
): Promise<{ result: ExpansionReview; durationMs: number; model: string }> {
  const start = Date.now();

  const prompt = `Review this graph expansion submission from agent "${context.contributorName}" (trust: ${context.contributorTrustLevel}${context.contributorAcceptanceRate !== undefined ? `, acceptance rate: ${(context.contributorAcceptanceRate * 100).toFixed(0)}%` : ""}).

## Topic: "${expansion.topic.title}"
${expansion.topic.summary ? `Summary: ${expansion.topic.summary}` : ""}
Difficulty: ${expansion.topic.difficulty ?? "beginner"}
${expansion.topic.parentTopicSlug ? `Parent topic: ${expansion.topic.parentTopicSlug}` : "Root topic"}

### Content (${expansion.topic.content.length} chars, ~${Math.round(expansion.topic.content.split(/\s+/).length)} words):
${expansion.topic.content.slice(0, 8000)}${expansion.topic.content.length > 8000 ? "\n...(truncated)" : ""}

### Resources (${expansion.resources.length}):
${expansion.resources.map((r, i) => `${i + 1}. [${r.type}] "${r.name}"${r.url ? ` — ${r.url}` : ""}\n   ${r.summary}`).join("\n")}

### Proposed Edges (${expansion.edges.length}):
${expansion.edges.map((e) => `- ${expansion.topic.title} → ${e.targetTopicSlug} (${e.relationType})`).join("\n")}
${expansion.edges.length > 0 ? `\nExisting topics in graph: ${context.existingTopics.slice(0, 30).map(t => t.id).join(", ")}${context.existingTopics.length > 30 ? "..." : ""}` : ""}

## Existing Topics in Graph (${context.existingTopics.length}):
${context.existingTopics.map(t => `- "${t.title}" (\`${t.id}\`)${t.summary ? ` — ${t.summary}` : ""}`).slice(0, 50).join("\n")}${context.existingTopics.length > 50 ? "\n...(truncated)" : ""}

## Duplicate Detection:
If this submission covers substantially the same topic as an existing entry above:
- Set duplicateOf to the slug of the existing topic
- Verdict MUST be "revise" with instructions to either:
  1. Narrow the scope and submit as a subtopic instead
  2. Note that the content will be merged into the existing topic
If NOT a duplicate, set duplicateOf to null.

## Length & Depth Requirements:
- **Minimum**: 800 words. Articles under 800 words should be marked "revise" with feedback to expand.
- **Target**: 800-2000 words of substantive, encyclopedia-style content.
- **Penalize heavily**: Thin articles that merely define a term without depth, examples, or practical detail.
- Content should have clear section headers, cover "what/why/how", and include current developments.

## URL Plausibility Check (CRITICAL)
For EACH resource URL, check:
1. Does the URL contain a date in ${new Date().getFullYear()} or later? If so, it is almost certainly fabricated. Flag it.
2. Does the URL path suspiciously mirror the exact topic title (e.g. "/blog/exact-topic-name-here")? Likely invented.
3. Is the domain well-known and verifiable (arxiv.org, github.com, official project docs, major publications)? Or is it a plausible-sounding but potentially fake domain?
4. Could the resource summary have been written by an AI without ever visiting the URL? Generic summaries like "A comprehensive guide to X that covers Y and Z" are red flags.

## Uniformity Detection
Flag if the submission shows signs of template-driven AI generation:
- All resources have similar-length summaries (within ~20% of each other)
- Exactly 5 resources (the most common AI default)
- Content length in the 8K-12K character range with uniform section structure
- Resource descriptions that follow the same grammatical pattern

## Research Evidence Enforcement
If 2+ resources fail the URL plausibility check above, researchEvidence MUST be 0-3 and verdict MUST be "revise" with specific feedback about which resources appear fabricated and why.

Evaluate this expansion's quality. Be rigorous but fair. Prefer "revise" over "reject" for good-faith contributions that have fixable issues. Your DEFAULT should be "revise" — only approve when you are confident the resources are real and the content is genuinely researched.`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: expansionReviewSchema,
  });

  return { result: object, durationMs: Date.now() - start, model: MODEL };
}

export async function suggestEdges(
  topic: { title: string; content: string; summary?: string },
  existingTopics: Array<{ id: string; title: string; summary?: string }>,
): Promise<{ result: EdgeSuggestion; durationMs: number; model: string }> {
  const start = Date.now();

  const topicList = existingTopics
    .map((t) => `- ${t.id}: "${t.title}"${t.summary ? ` — ${t.summary}` : ""}`)
    .join("\n");

  const prompt = `Given the following NEW topic being added to the knowledge graph, independently determine which existing topics it should connect to and what relationship type is appropriate.

## New Topic: "${topic.title}"
${topic.summary ? `Summary: ${topic.summary}` : ""}

### Content (preview):
${topic.content.slice(0, 2000)}${topic.content.length > 2000 ? "\n...(truncated)" : ""}

## Existing Topics in the Graph:
${topicList}

## Relationship Types:
- **prerequisite**: The target topic must be understood before this one (directional — order matters)
- **subtopic**: This topic is a sub-area of the target (directional — order matters)
- **related**: Conceptually related, complementary knowledge (symmetric)
- **see_also**: Tangentially relevant, worth cross-referencing (symmetric)

## Guidelines:
- Suggest only edges that are clearly justified by the content
- Typically 1-4 edges. Most topics have 2-3 connections
- Zero edges is valid only for a genuinely new root domain (rare)
- Prefer stronger relationships (prerequisite, subtopic) over weak ones (see_also)
- For directional types (prerequisite, subtopic), consider the direction carefully`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: edgeSuggestionSchema,
  });

  return { result: object, durationMs: Date.now() - start, model: MODEL };
}

export async function suggestTags(
  topic: { title: string; content: string; summary?: string },
  existingTags: string[],
  submittedTags: string[],
): Promise<{ result: TagSuggestion; durationMs: number; model: string }> {
  const start = Date.now();

  const prompt = `Given the following topic being added to the knowledge graph, suggest the best tags to categorize it.

## Topic: "${topic.title}"
${topic.summary ? `Summary: ${topic.summary}` : ""}

### Content (preview):
${topic.content.slice(0, 2000)}${topic.content.length > 2000 ? "\n...(truncated)" : ""}

## Existing Tags in the Graph:
${existingTags.length > 0 ? existingTags.join(", ") : "(none yet)"}

## Agent-Submitted Tags:
${submittedTags.length > 0 ? submittedTags.join(", ") : "(none)"}

## Guidelines:
- Suggest 2-5 tags that best categorize this topic
- You MUST select ONLY from the existing tags list above. Use the EXACT name and casing as shown (e.g. "Technical", not "technical")
- Do NOT invent new tags — only existing tags from the list can be applied. Any tag not in the list will be silently ignored
- The agent's submitted tags are a signal but you make the final call
- Tags should be specific enough to be useful but general enough to apply to multiple topics`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: tagSuggestionSchema,
  });

  return { result: object, durationMs: Date.now() - start, model: MODEL };
}

// Curated list of ~50 common Phosphor icons for the AI to pick from
const PHOSPHOR_ICON_CHOICES = [
  "Atom", "Brain", "Code", "Database", "Globe", "Graph", "Lightbulb", "Rocket",
  "Robot", "Cpu", "Lightning", "MagnifyingGlass", "Flask", "TestTube", "Microscope",
  "BookOpen", "GraduationCap", "ChartLine", "ChartBar", "ChartPie", "TreeStructure",
  "GitBranch", "Terminal", "CloudArrowUp", "Shield", "Lock", "Key", "Gear",
  "Wrench", "Hammer", "PuzzlePiece", "Cube", "Diamond", "Star", "Target",
  "Compass", "MapPin", "Users", "UserCircle", "ChatCircle", "Megaphone",
  "Camera", "Eye", "Ear", "Heart", "Fire", "Leaf", "Sun", "Moon",
  "Music", "GameController", "Trophy", "Scales", "Gavel", "Stethoscope",
  "Pill", "Dna", "Virus", "Coin", "CurrencyDollar", "Bank", "Factory",
  "Buildings", "Car", "Airplane", "Broadcast", "Wifi", "Bluetooth",
  "Fingerprint", "SealCheck", "Strategy", "Presentation", "Article",
];

// Full set for validation (imported dynamically to avoid bundling the whole list in the script)
const VALID_PHOSPHOR_NAMES = new Set(PHOSPHOR_ICON_CHOICES.concat([
  "Acorn","Activity","Anchor","Aperture","Archive","Backpack","Bandaids","Barbell",
  "Barn","Basketball","Battery","Bell","Bicycle","Binoculars","Bird","Bone","Bookmark",
  "Briefcase","Broom","Bug","Calculator","Calendar","Campfire","Carrot","Castle",
  "Certificate","Circle","Clipboard","Clock","Cloud","Coffee","Confetti","Cookie",
  "Crown","Cursor","Detective","Disc","Dog","Door","Download","Egg","Envelope",
  "Eraser","Exam","Feather","FileCode","FilePdf","Film","Flag","Flame","Flower",
  "Folder","Football","Funnel","Gift","Guitar","Handshake","Headphones","Horse",
  "Hourglass","House","Image","Infinity","Jar","Joystick","Kanban","Keyboard",
  "Knife","Lamp","Laptop","Lego","Link","List","Log","Magnet","Medal","Meteor",
  "Microphone","Monitor","Mountains","Needle","Note","Notebook","Nut","Orange",
  "Package","Palette","Parachute","Path","Pen","Pencil","Plant","Play","Plug",
  "Printer","Question","Rainbow","Receipt","Recycle","Ruler","Sailboat","Scissors",
  "Shower","Skull","Snowflake","Sparkle","Spider","Sword","Syringe","Tag","Timer",
  "Toolbox","Tornado","Translate","Trash","Tree","Umbrella","Upload","Video","Wall",
  "Warning","Watch","Waves","Wind","Yarn",
]));

export async function suggestIcon(
  topic: { title: string; summary?: string },
  recentHues?: number[],
): Promise<{ result: IconSuggestion; durationMs: number; model: string }> {
  const start = Date.now();

  // Compute hue bucket distribution for diversity guidance
  let hueDiversityGuidance = "";
  if (recentHues && recentHues.length >= 5) {
    const buckets = [0, 0, 0, 0, 0, 0]; // 6 buckets of 60 degrees
    const bucketLabels = ["red/orange (0-59)", "yellow/green (60-119)", "green/teal (120-179)", "cyan/blue (180-239)", "blue/purple (240-299)", "purple/pink (300-359)"];
    for (const hue of recentHues) {
      buckets[Math.floor(hue / 60) % 6]!++;
    }
    const total = recentHues.length;
    const overused = bucketLabels.filter((_, i) => buckets[i]! / total > 0.25);
    const underused = bucketLabels.filter((_, i) => buckets[i]! / total < 0.1);

    hueDiversityGuidance = `\n\n## Color Diversity (IMPORTANT)
Current graph hue distribution (${total} topics):
${bucketLabels.map((label, i) => `- ${label}: ${buckets[i]} topics (${((buckets[i]! / total) * 100).toFixed(0)}%)`).join("\n")}
${overused.length ? `\nOVERUSED — avoid these ranges: ${overused.join(", ")}` : ""}
${underused.length ? `\nUNDERUSED — prefer these ranges: ${underused.join(", ")}` : ""}`;
  }

  const prompt = `Pick the single best icon and accent color for this knowledge graph topic.

## Topic: "${topic.title}"
${topic.summary ? `Summary: ${topic.summary}` : ""}

## Icon Options

### Option A: Phosphor icon (use ~70-80% of the time)
Use EXACTLY one of these names with "ph:" prefix:
${PHOSPHOR_ICON_CHOICES.join(", ")}

### Option B: Emoji (use ~20-30% of the time)
Return a single emoji character when there's a strong, iconic emoji match. Great for:
- Countries/regions (flags: 🇺🇸, 🇯🇵, etc.)
- Animals (🐍 for Python, 🦀 for Rust, 🐋 for Docker)
- Food/plants (🍎, 🌿)
- Specific objects with strong emoji representation (🧬 DNA, ⚡ electricity, 🔬 microscopy)

## Guidelines:
- Choose an icon that is immediately recognizable and specific to the topic
- The iconHue is an HSL hue (0-360): red=0, orange=30, yellow=60, green=120, cyan=180, blue=240, purple=270, pink=330
- IMPORTANT: Do NOT default to blue (220-280) for tech/AI topics. Use the FULL color wheel:
  - AI/ML → green (120-150) or cyan (170-190)
  - Programming/code → orange (20-40) or teal (160-180)
  - Security → red (0-15) or dark green (140-160)
  - Data/databases → amber (40-55) or purple (280-300)
  - Networking/web → cyan (180-200) or coral (10-25)
  - Science → emerald (140-165) or violet (270-290)
  - Hardware → warm gray via orange (25-35) or steel via cyan (195-210)
- Only use blue (220-280) if the topic is genuinely about ocean, sky, water, or blue things${hueDiversityGuidance}`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: iconSuggestionSchema,
  });

  // Post-generation hue nudge: if the chosen bucket is overrepresented, shift
  let iconHue = object.iconHue;
  if (recentHues && recentHues.length >= 5) {
    const bucket = Math.floor(iconHue / 60) % 6;
    const bucketCount = recentHues.filter((h) => Math.floor(h / 60) % 6 === bucket).length;
    if (bucketCount / recentHues.length > 0.3) {
      iconHue = (iconHue + 120) % 360;
    }
  }

  // Post-generation validation: ensure the icon is a valid Phosphor name or emoji
  let icon = object.icon;
  if (icon.startsWith("ph:")) {
    if (!VALID_PHOSPHOR_NAMES.has(icon.slice(3))) {
      icon = "ph:Circle"; // fallback
    }
  } else if (VALID_PHOSPHOR_NAMES.has(icon)) {
    // Bare Phosphor name without prefix
    icon = `ph:${icon}`;
  } else if ([...icon].length <= 2) {
    // Emoji — accept as-is (single emoji, possibly with variant selector)
  } else {
    icon = "ph:Circle"; // fallback
  }

  return { result: { ...object, icon, iconHue }, durationMs: Date.now() - start, model: MODEL };
}

export async function scoreResource(
  resource: {
    name: string;
    url?: string | null;
    type: string;
    summary: string;
    content?: string | null;
  },
  topicContext?: { title: string; id: string } | null,
): Promise<{ result: ResourceScore; durationMs: number; model: string }> {
  const start = Date.now();

  const prompt = `Score this resource for quality and usefulness:

Resource: "${resource.name}"
Type: ${resource.type}
${resource.url ? `URL: ${resource.url}` : "No URL provided"}
Summary: ${resource.summary}
${resource.content ? `Content preview: ${resource.content.slice(0, 500)}` : ""}
${topicContext ? `Topic context: "${topicContext.title}" (${topicContext.id})` : "No topic context"}

Score from 0-100 where:
- 90+: Exceptional — authoritative, comprehensive, highly practical
- 70-89: Good — solid source, useful, well-regarded
- 50-69: Acceptable — relevant but not standout
- Below 50: Weak — thin, unreliable, or not very useful

Red flags for low scores: no URL provided, generic/vague summary that could apply to anything, URL that looks fabricated or doesn't match a real source pattern, description that reads like training-data regurgitation rather than a real resource.`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: resourceScoreSchema,
  });

  return { result: object, durationMs: Date.now() - start, model: MODEL };
}

export async function analyzeGaps(
  topics: Array<{
    id: string;
    title: string;
    resourceCount: number;
    resourceTypeCounts?: Record<string, number>;
    hasSubtopics: boolean;
    childCount?: number;
    contentLength: number;
    isRoot?: boolean;
    parentTopicId?: string | null;
  }>,
  existingBounties?: Array<{ title: string; topicSlug?: string }>,
  targetBountyCount: number = 3,
): Promise<{ result: GapAnalysis; durationMs: number; model: string }> {
  const start = Date.now();

  const existingBountiesSection = existingBounties?.length
    ? `\n\nExisting open bounties (DO NOT duplicate these):\n${existingBounties.map((b) => `- "${b.title}"${b.topicSlug ? ` (${b.topicSlug})` : ""}`).join("\n")}`
    : "";

  // Pre-compute structural gaps to guide the AI
  const rootTopics = topics.filter((t) => t.isRoot !== false && !t.parentTopicId);
  const leafTopics = topics.filter((t) => !t.hasSubtopics && (t.parentTopicId || t.isRoot === false));
  const broadTopicsNoChildren = rootTopics.filter((t) => !t.hasSubtopics && t.contentLength > 3000);
  const thinContent = topics.filter((t) => t.contentLength < 3000);
  const fewResources = topics.filter((t) => t.resourceCount < 3);

  // Build a parent→children lookup for hierarchy display
  const parentMap = new Map<string, string[]>();
  for (const t of topics) {
    if (t.parentTopicId) {
      const children = parentMap.get(t.parentTopicId) ?? [];
      children.push(t.title);
      parentMap.set(t.parentTopicId, children);
    }
  }

  // Compute global resource type distribution for the prompt
  const globalTypeCounts: Record<string, number> = {};
  for (const t of topics) {
    for (const [type, count] of Object.entries(t.resourceTypeCounts ?? {})) {
      globalTypeCounts[type] = (globalTypeCounts[type] ?? 0) + count;
    }
  }
  const allResourceTypes = ["article", "paper", "book", "course", "video", "podcast", "dataset", "tool", "model", "library", "repository", "prompt", "workflow", "benchmark", "report", "discussion", "community", "event", "organization", "person", "concept", "comparison", "curated_list", "newsletter", "social_media", "tutorial", "documentation"];
  const missingTypes = allResourceTypes.filter((t) => !globalTypeCounts[t]);
  const underrepresentedTypes = allResourceTypes.filter((t) => (globalTypeCounts[t] ?? 0) > 0 && (globalTypeCounts[t] ?? 0) <= 2);

  const topicLines = topics.map((t) => {
    const children = parentMap.get(t.id);
    const parts = [
      `"${t.title}" (${t.id})`,
      t.isRoot || !t.parentTopicId ? "ROOT" : `child of ${t.parentTopicId}`,
      `${t.resourceCount} resources`,
      `${t.contentLength} chars`,
      t.hasSubtopics ? `${t.childCount ?? "?"} subtopics` : "NO subtopics",
    ];
    if (t.resourceTypeCounts && Object.keys(t.resourceTypeCounts).length > 0) {
      const types = Object.entries(t.resourceTypeCounts).map(([k, v]) => `${v} ${k}`).join(", ");
      parts.push(`types: ${types}`);
    }
    if (children) parts.push(`children: [${children.join(", ")}]`);
    return `- ${parts.join(" | ")}`;
  });

  const prompt = `Analyze the current knowledge graph for gaps and suggest up to ${targetBountyCount} bounties.

## Graph Summary
- ${topics.length} unique topics (${rootTopics.length} root, ${leafTopics.length} leaf)
- ${broadTopicsNoChildren.length} broad root topics with 0 subtopics (CRITICAL gap)
- ${thinContent.length} topics with thin content (< 3000 chars)
- ${fewResources.length} topics with < 3 resources

## Resource Type Distribution (across all topics)
${Object.entries(globalTypeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => `- ${type}: ${count}`).join("\n")}${missingTypes.length > 0 ? `\n\n**Missing types (0 resources):** ${missingTypes.join(", ")}` : ""}${underrepresentedTypes.length > 0 ? `\n**Underrepresented types (1-2 resources):** ${underrepresentedTypes.join(", ")}` : ""}

## Current Topics
${topicLines.join("\n")}${existingBountiesSection}

## Bounty Type Distribution Rules (MANDATORY)
You MUST suggest a diverse mix of bounty types. Follow these constraints:
- **"topic" bounties**: Max ${Math.min(Math.ceil(targetBountyCount * 0.4), targetBountyCount - 2)} of ${targetBountyCount}. Only for genuinely missing subtopics.
- **"edit" bounties**: At least ${Math.max(1, Math.floor(targetBountyCount * 0.3))} of ${targetBountyCount}. For improving thin content, adding depth to shallow articles, or restructuring.
- **"resource" bounties**: At least ${Math.max(1, Math.floor(targetBountyCount * 0.3))} of ${targetBountyCount}. For topics with few or low-quality resources.

## Gap Priorities
1. **Broad root topics with NO subtopics** — These MUST be split. Use "missing_subtopic" gap type with a "topic" bounty.
2. **Thin content (< 3000 chars)** — Use "stale_content" gap type with an "edit" bounty. The edit should add depth, examples, and practical detail.
3. **Few or uniform resources** — Use "few_resources" gap type with a "resource" bounty. Ask for real, verifiable resources from authoritative sources.
4. **Resource type diversity** — See the Resource Type Distribution above. When creating "resource" bounties, specifically request missing or underrepresented types. Mention the desired types by name in the bounty description. For example: "Find books and tutorials for [topic]" or "Add newsletters and podcast resources covering [topic]". Each topic line includes its current type breakdown — use this to target gaps per topic.

## Subtopic Bounty Guidelines
- Bounty description MUST include: "This should be created as a subtopic of [Parent Title]. Use \`parentTopicSlug: '[parent-slug]'\` when submitting."
- Set topicSlug to the parent topic's slug.
- NEVER suggest a root topic bounty if it could be a subtopic of an existing root.

## Anti-Duplication
- Do NOT suggest bounties for topics that already exist in the graph above.
- Do NOT suggest bounties similar to existing open bounties listed above.
- Spread bounties across different topic areas — max 1 bounty per root topic branch.

Generate specific, actionable bounties.`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: gapAnalysisSchema,
  });

  return { result: object, durationMs: Date.now() - start, model: MODEL };
}

// ─── Topic Merge ──────────────────────────────────────────────────────────

export const topicMergeSchema = z.object({
  mergedContent: z.string().describe("The merged topic content combining the best of both versions"),
  changeSummary: z.string().describe("2-3 sentence description of what was improved or added from the new version"),
});

export type TopicMerge = z.infer<typeof topicMergeSchema>;

export async function mergeTopicContent(
  topicTitle: string,
  existingContent: string,
  newContent: string,
): Promise<{ result: TopicMerge; durationMs: number; model: string }> {
  const start = Date.now();

  const prompt = `You are merging two versions of the same knowledge graph topic. Produce a single, improved version that combines the best parts of both.

## Topic: "${topicTitle}"

## Existing Version (currently published):
${existingContent.slice(0, 10000)}${existingContent.length > 10000 ? "\n...(truncated)" : ""}

## New Submission:
${newContent.slice(0, 10000)}${newContent.length > 10000 ? "\n...(truncated)" : ""}

## Merge Guidelines:
- Keep the best structure, depth, and accuracy from both versions
- If the new version adds sections or detail the existing version lacks, incorporate them
- If the existing version has better structure or more accurate content, preserve it
- Remove redundancy — don't repeat the same information twice
- Maintain encyclopedia-style tone with clear headers
- The merged result should be strictly better than either individual version
- Describe what changed in the changeSummary (what was added, improved, or reorganized)`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: topicMergeSchema,
  });

  return { result: object, durationMs: Date.now() - start, model: MODEL };
}
