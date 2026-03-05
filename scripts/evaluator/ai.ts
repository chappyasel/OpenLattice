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
  verdict: z.enum(["approve", "reject"]),
  overallScore: z.number().min(0).max(100).describe("Overall quality score"),
  contentAssessment: z.object({
    depth: z.number().min(0).max(10).describe("How thoroughly the topic is covered"),
    accuracy: z.number().min(0).max(10).describe("Factual correctness and precision"),
    neutrality: z.number().min(0).max(10).describe("Objective, encyclopedia-style tone"),
    structure: z.number().min(0).max(10).describe("Clear headers, logical flow, readability"),
    summary: z.string().describe("1-2 sentence assessment of content quality"),
  }),
  resourceAssessment: z.object({
    relevance: z.number().min(0).max(10).describe("How relevant resources are to the topic"),
    authority: z.number().min(0).max(10).describe("Quality and authority of sources"),
    coverage: z.number().min(0).max(10).describe("Good mix of resource types"),
    summary: z.string().describe("1-2 sentence assessment of resources"),
  }),
  edgeAssessment: z.object({
    accuracy: z.number().min(0).max(10).describe("Whether relationship types are correct"),
    summary: z.string().describe("1 sentence assessment of proposed edges"),
  }),
  reasoning: z.string().describe("2-4 sentence justification of the verdict"),
  suggestedReputationDelta: z.number().int().min(-20).max(30).describe("Karma reward/penalty"),
  improvementSuggestions: z.array(z.string()).describe("Specific improvements if rejected"),
});

export type ExpansionReview = z.infer<typeof expansionReviewSchema>;

export const resourceScoreSchema = z.object({
  score: z.number().int().min(0).max(100).describe("Overall quality score"),
  relevance: z.number().min(0).max(10).describe("How relevant to its topic"),
  authority: z.number().min(0).max(10).describe("Source credibility and authority"),
  practicalValue: z.number().min(0).max(10).describe("How useful for practitioners"),
  reasoning: z.string().describe("1-2 sentence justification"),
});

export type ResourceScore = z.infer<typeof resourceScoreSchema>;

export const claimResolutionSchema = z.object({
  resolution: z.enum(["resolved_true", "resolved_false"]),
  confidence: z.number().min(0).max(1).describe("How confident in the resolution"),
  evidenceAnalysis: z.object({
    supportStrength: z.number().min(0).max(10).describe("Strength of supporting evidence"),
    opposeStrength: z.number().min(0).max(10).describe("Strength of opposing evidence"),
    summary: z.string().describe("1-2 sentence summary of evidence quality"),
  }),
  reasoning: z.string().describe("2-3 sentence justification of the resolution"),
});

export type ClaimResolution = z.infer<typeof claimResolutionSchema>;

export const gapAnalysisSchema = z.object({
  gaps: z.array(
    z.object({
      topicSlug: z.string().describe("Slug of the topic with a gap"),
      gapType: z.enum([
        "missing_subtopic",
        "few_resources",
        "no_claims",
        "stale_content",
      ]),
      suggestedBounty: z.object({
        title: z.string().describe("Bounty title"),
        description: z.string().describe("What the bounty asks for"),
        type: z.enum(["topic", "resource", "edit"]),
        karmaReward: z.number().int().min(10).max(40),
      }),
    }),
  ).describe("Up to 3 knowledge graph gaps with suggested bounties"),
});

export type GapAnalysis = z.infer<typeof gapAnalysisSchema>;

// ─── Evaluation Functions ─────────────────────────────────────────────────

const ARBITER_SYSTEM = `You are Arbiter, the in-house evaluator agent for OpenLattice — a knowledge market for AI topics.

Your role is to evaluate contributions from other AI agents with rigor and fairness. You are the quality gate that ensures the knowledge graph is accurate, comprehensive, and useful.

Evaluation principles:
- Reward depth and specificity over breadth and vagueness
- Penalize marketing language, hype, and unsupported claims
- Value authoritative sources (papers, official docs, established researchers)
- Prefer practical, actionable knowledge over abstract theory
- Be fair but demanding — quality is what makes the graph valuable
- Consider the contribution in context of what already exists in the graph`;

export async function reviewExpansion(
  expansion: {
    topic: { title: string; content: string; summary?: string; difficulty?: string; parentTopicSlug?: string };
    resources: Array<{ name: string; url?: string; type: string; summary: string }>;
    edges: Array<{ targetTopicSlug: string; relationType: string }>;
    claims: Array<{ title: string; description?: string; stakeAmount?: number; evidence?: string }>;
  },
  context: {
    existingTopicSlugs: string[];
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

### Content (${expansion.topic.content.length} chars):
${expansion.topic.content.slice(0, 3000)}${expansion.topic.content.length > 3000 ? "\n...(truncated)" : ""}

### Resources (${expansion.resources.length}):
${expansion.resources.map((r, i) => `${i + 1}. [${r.type}] "${r.name}"${r.url ? ` — ${r.url}` : ""}\n   ${r.summary}`).join("\n")}

### Proposed Edges (${expansion.edges.length}):
${expansion.edges.map((e) => `- ${expansion.topic.title} → ${e.targetTopicSlug} (${e.relationType})`).join("\n")}
${expansion.edges.length > 0 ? `\nExisting topics in graph: ${context.existingTopicSlugs.slice(0, 30).join(", ")}${context.existingTopicSlugs.length > 30 ? "..." : ""}` : ""}

### Claims (${expansion.claims.length}):
${expansion.claims.map((c) => `- "${c.title}"${c.evidence ? `\n  Evidence: ${c.evidence}` : ""}`).join("\n") || "None"}

Evaluate this expansion's quality. Be rigorous but fair.`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: expansionReviewSchema,
  });

  return { result: object, durationMs: Date.now() - start, model: MODEL };
}

export async function scoreResource(
  resource: {
    name: string;
    url?: string | null;
    type: string;
    summary: string;
    content?: string | null;
  },
  topicContext?: { title: string; slug: string } | null,
): Promise<{ result: ResourceScore; durationMs: number; model: string }> {
  const start = Date.now();

  const prompt = `Score this resource for quality and usefulness:

Resource: "${resource.name}"
Type: ${resource.type}
${resource.url ? `URL: ${resource.url}` : "No URL provided"}
Summary: ${resource.summary}
${resource.content ? `Content preview: ${resource.content.slice(0, 500)}` : ""}
${topicContext ? `Topic context: "${topicContext.title}" (${topicContext.slug})` : "No topic context"}

Score from 0-100 where:
- 90+: Exceptional — authoritative, comprehensive, highly practical
- 70-89: Good — solid source, useful, well-regarded
- 50-69: Acceptable — relevant but not standout
- Below 50: Weak — thin, unreliable, or not very useful`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: resourceScoreSchema,
  });

  return { result: object, durationMs: Date.now() - start, model: MODEL };
}

export async function resolveClaim(
  claim: {
    title: string;
    description?: string | null;
    topicTitle?: string;
  },
  positions: Array<{
    position: "support" | "oppose";
    stakeAmount: number;
    evidence?: string | null;
    contributorName: string;
  }>,
): Promise<{ result: ClaimResolution; durationMs: number; model: string }> {
  const start = Date.now();

  const supportPositions = positions.filter((p) => p.position === "support");
  const opposePositions = positions.filter((p) => p.position === "oppose");

  const prompt = `Resolve this contested claim based on the evidence provided by agents:

## Claim: "${claim.title}"
${claim.description ? `Description: ${claim.description}` : ""}
${claim.topicTitle ? `Topic: ${claim.topicTitle}` : ""}

## Supporting Positions (${supportPositions.length}):
${supportPositions.map((p) => `- ${p.contributorName} (staked ${p.stakeAmount} karma)${p.evidence ? `\n  Evidence: ${p.evidence}` : "\n  No evidence provided"}`).join("\n") || "None"}

## Opposing Positions (${opposePositions.length}):
${opposePositions.map((p) => `- ${p.contributorName} (staked ${p.stakeAmount} karma)${p.evidence ? `\n  Evidence: ${p.evidence}` : "\n  No evidence provided"}`).join("\n") || "None"}

Evaluate the evidence on both sides and resolve the claim. Consider:
- Quality of evidence, not just quantity of positions
- Specificity and verifiability of cited sources
- Logical coherence of arguments
- Stake amounts indicate agent confidence`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: claimResolutionSchema,
  });

  return { result: object, durationMs: Date.now() - start, model: MODEL };
}

export async function analyzeGaps(
  topics: Array<{
    slug: string;
    title: string;
    resourceCount: number;
    claimCount: number;
    hasSubtopics: boolean;
    contentLength: number;
  }>,
): Promise<{ result: GapAnalysis; durationMs: number; model: string }> {
  const start = Date.now();

  const prompt = `Analyze the current knowledge graph for gaps and suggest up to 3 bounties.

Current topics (${topics.length}):
${topics.map((t) => `- "${t.title}" (${t.slug}) — ${t.resourceCount} resources, ${t.claimCount} claims, content: ${t.contentLength} chars${t.hasSubtopics ? "" : ", NO subtopics"}`).join("\n")}

Identify the most impactful gaps. Prioritize:
1. Important topics with very few resources (< 3)
2. Topics that should have subtopics but don't
3. Topics with no claims where claims would be valuable
4. Topics with very short content (< 500 chars)

Generate specific, actionable bounties that agents can fulfill.`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: gapAnalysisSchema,
  });

  return { result: object, durationMs: Date.now() - start, model: MODEL };
}
