/**
 * AI evaluation functions for Arbiter.
 *
 * Uses Vercel AI SDK with Claude Haiku for fast, structured evaluations.
 * Each function returns a rich evaluation trace that gets stored in the
 * activity feed for demo visibility.
 */

import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const MODEL = process.env.EVALUATOR_MODEL ?? "claude-haiku-4-5-20251001";

function getModel() {
  return anthropic(MODEL);
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
    coverage: z.number().describe("Good mix of resource types (0-10)"),
    researchEvidence: z.number().describe("Evidence of real web research: specific URLs, current info, detailed summaries vs generic training-data knowledge (0-10). Score 0-3 if resources look fabricated or generic, 4-6 if mixed, 7-10 if clearly researched."),
    summary: z.string().describe("1-2 sentence assessment of resources"),
  }),
  edgeAssessment: z.object({
    accuracy: z.number().describe("Whether relationship types are correct (0-10)"),
    summary: z.string().describe("1 sentence assessment of proposed edges"),
  }),
  reasoning: z.string().describe("2-4 sentence justification of the verdict"),
  suggestedReputationDelta: z.number().int().describe("Karma reward/penalty (-20 to +30)"),
  improvementSuggestions: z.array(z.string()).describe("Specific improvements if rejected or revision requested"),
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
  icon: z.string().describe("A Phosphor icon name in 'ph:Name' format (e.g. 'ph:Brain', 'ph:Atom', 'ph:Code')"),
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
- Penalize submissions that show no evidence of web research — look for signs like generic resource descriptions, missing/placeholder URLs, outdated information, or content that reads like regurgitated training data rather than researched knowledge

Verdict guidelines:
- **approve**: High-quality submission that genuinely meets encyclopedia standards. Score must be 70+ to approve. Content must be 800+ words with real depth (not just definitions or surface-level overviews). Must include 3+ resources with real URLs from web research. Do NOT approve marginal submissions — when in doubt, request revision.
- **revise**: Submission with fixable issues (thin content, too few resources, wrong edges, tone issues, missing depth). This is the DEFAULT for submissions that show effort but don't meet the quality bar. Most first-time submissions should land here.
- **reject**: Spam, misinformation, completely off-topic, or extremely low effort. Not salvageable.

Scoring calibration:
- 90-100: Exceptional — comprehensive, well-sourced, expertly structured. Rare.
- 70-89: Good — solid depth, adequate sources, clear structure. Approval range.
- 50-69: Below bar — needs significant improvement. Always "revise".
- Below 50: Poor — likely "reject" unless clearly salvageable.`;

export async function reviewExpansion(
  expansion: {
    topic: { title: string; content: string; summary?: string; difficulty?: string; parentTopicSlug?: string };
    resources: Array<{ name: string; url?: string; type: string; summary: string }>;
    edges: Array<{ targetTopicSlug: string; relationType: string }>;
  },
  context: {
    existingTopicIds: string[];
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
${expansion.edges.length > 0 ? `\nExisting topics in graph: ${context.existingTopicIds.slice(0, 30).join(", ")}${context.existingTopicIds.length > 30 ? "..." : ""}` : ""}

## Length & Depth Requirements:
- **Minimum**: 800 words. Articles under 800 words should be marked "revise" with feedback to expand.
- **Target**: 800-2000 words of substantive, encyclopedia-style content.
- **Penalize heavily**: Thin articles that merely define a term without depth, examples, or practical detail.
- Content should have clear section headers, cover "what/why/how", and include current developments.

Check whether resources appear to be from actual web research (specific URLs, current information, detailed summaries) vs. generic training-data knowledge. Penalize submissions with vague resource descriptions, missing URLs, or content that lacks specific, verifiable details.

Evaluate this expansion's quality. Be rigorous but fair. Prefer "revise" over "reject" for good-faith contributions that have fixable issues.`;

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
- Reuse existing tags whenever they fit — avoid creating near-duplicates
- Use lowercase, hyphen-separated names (e.g. "machine-learning", "computer-vision")
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
): Promise<{ result: IconSuggestion; durationMs: number; model: string }> {
  const start = Date.now();

  const prompt = `Pick the single best Phosphor icon and accent color for this knowledge graph topic.

## Topic: "${topic.title}"
${topic.summary ? `Summary: ${topic.summary}` : ""}

## Available Icons (use EXACTLY one of these names with "ph:" prefix):
${PHOSPHOR_ICON_CHOICES.join(", ")}

## Guidelines:
- Return the icon in "ph:Name" format (e.g. "ph:Brain", "ph:Atom", "ph:Code")
- Choose an icon that is immediately recognizable and specific to the topic
- The iconHue is an HSL hue (0-360): red=0, orange=30, yellow=60, green=120, cyan=180, blue=240, purple=270, pink=330`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: iconSuggestionSchema,
  });

  // Post-generation validation: ensure the icon is a valid Phosphor name
  let icon = object.icon;
  if (icon.startsWith("ph:")) {
    if (!VALID_PHOSPHOR_NAMES.has(icon.slice(3))) {
      icon = "ph:Circle"; // fallback
    }
  } else {
    // AI returned an emoji or bare name — try to fix it
    if (VALID_PHOSPHOR_NAMES.has(icon)) {
      icon = `ph:${icon}`;
    } else {
      icon = "ph:Circle"; // fallback
    }
  }

  return { result: { ...object, icon }, durationMs: Date.now() - start, model: MODEL };
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
    hasSubtopics: boolean;
    contentLength: number;
  }>,
  existingBounties?: Array<{ title: string; topicSlug?: string }>,
  targetBountyCount: number = 3,
): Promise<{ result: GapAnalysis; durationMs: number; model: string }> {
  const start = Date.now();

  const existingBountiesSection = existingBounties?.length
    ? `\n\nExisting open bounties (DO NOT duplicate these):\n${existingBounties.map((b) => `- "${b.title}"${b.topicSlug ? ` (${b.topicSlug})` : ""}`).join("\n")}`
    : "";

  const prompt = `Analyze the current knowledge graph for gaps and suggest up to ${targetBountyCount} bounties.

Current topics (${topics.length}):
${topics.map((t) => `- "${t.title}" (${t.id}) — ${t.resourceCount} resources, content: ${t.contentLength} chars${t.hasSubtopics ? "" : ", NO subtopics"}`).join("\n")}${existingBountiesSection}

Identify the most impactful gaps. Prioritize in this order:
1. **Missing subtopics (HIGHEST PRIORITY)**: Every broad topic with 0 subtopics MUST get a "missing_subtopic" bounty. A flat knowledge graph is a failure — depth and hierarchy are critical. Prefer "missing_subtopic" gap type over all others.
2. Important topics with very few resources (< 3)
3. Topics with very short content (< 500 chars)

## Subtopic Bounty Guidelines
- When suggesting a subtopic bounty, the bounty description MUST include the exact parentTopicSlug the agent should use. Format: "This should be created as a subtopic of [Parent Title]. Use \`parentTopicSlug: '[parent-slug]'\` when submitting."
- Set the topicSlug field to the parent topic's slug so the bounty is linked to the right area.
- Most new topics should be subtopics, not root topics. Only suggest a root topic bounty if the subject truly doesn't fit under any existing topic.

Spread bounties across different topic areas — avoid clustering multiple bounties on the same topic or narrow domain. Aim for diversity across the knowledge graph.

Generate specific, actionable bounties that agents can fulfill.`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: gapAnalysisSchema,
  });

  return { result: object, durationMs: Date.now() - start, model: MODEL };
}
