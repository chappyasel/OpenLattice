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
import type { UrlVerificationResult } from "./url-verify";

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
  groundedness: z.object({
    score: z.number().describe("Overall groundedness score (0-10). How grounded is this submission in real, verifiable, local/experiential knowledge vs. generic training-data regurgitation? 0-2: Pure training data — no process trace, no evidence of tool use, generic knowledge any LLM could produce. 3-4: Minimal grounding — process trace exists but is vague or likely fabricated, resources marked 'known' with no discovery context. 5-6: Moderate grounding — some web searches performed, some real URLs found, but content doesn't leverage specific findings. 7-8: Well-grounded — clear process trace showing real tool usage (web search, file reads), resources have discovery context and snippets, content references specific findings. 9-10: Deeply grounded — local/experiential knowledge with specific stacks, outcomes, timestamps. Content that could only come from someone who actually did the work."),
    hasProcessTrace: z.boolean().describe("Did the submission include a meaningful process trace?"),
    toolUseEvidence: z.number().describe("Evidence of real tool usage in the process trace (0-10). 0 = no trace, 5 = generic traces, 10 = detailed traces with specific queries/results"),
    sessionVerification: z.number().nullable().describe("If a server-verified research session was attached: how well does it corroborate the self-reported process trace? (0-10). null if no session. 0 = contradicts trace, 5 = partial match, 10 = strong corroboration"),
    localContext: z.number().describe("Evidence of local/experiential context — specific stacks, outcomes, time-bound claims (0-10). 0 = purely generic, 10 = deeply specific to a particular environment"),
    summary: z.string().describe("1-2 sentence assessment of how grounded this submission is"),
  }),
  findingsAssessment: z.object({
    specificity: z.number().describe("How specific and falsifiable are the findings? (0-10). 0 = vague platitudes ('X is useful'), 10 = precise, measurable, time-bound claims ('X v2.3 reduces latency by 40% on Postgres 16 with >1M rows')"),
    groundedness: z.number().describe("Are findings backed by the process trace and resources? (0-10). 0 = no connection to research, 10 = each finding clearly traces to a specific research step or source"),
    practicalValue: z.number().describe("How useful are these findings to practitioners? (0-10). 0 = obvious/trivial, 10 = non-obvious insight that saves real time/effort"),
    count: z.number().describe("Number of findings submitted"),
    summary: z.string().describe("1-2 sentence assessment of the findings quality"),
  }),
  edgeAssessment: z.object({
    accuracy: z.number().describe("Whether relationship types are correct (0-10)"),
    summary: z.string().describe("1 sentence assessment of proposed edges"),
  }),
  topicPlacement: z.object({
    appropriateness: z.number().describe("How well does this topic fit under its proposed parent? (0-10). 10 = perfect fit as a subtopic of the parent, 0 = completely wrong location. For root topics, assess whether it truly deserves top-level status or should be a subtopic of an existing topic."),
    suggestedParent: z.string().nullable().describe("If the topic would be better placed elsewhere, the slug of a better parent topic from the existing topics list. null if current placement is good."),
    reasoning: z.string().describe("1-2 sentence explanation of why this placement is or isn't appropriate"),
  }),
  reasoning: z.string().describe("2-4 sentence justification of the verdict"),
  suggestedReputationDelta: z.number().int().describe("Karma reward/penalty (-200 to +300)"),
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
        karmaReward: z.number().int().describe("Karma reward (100-400)"),
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

export const edgeEvaluationSchema = z.object({
  submittedEdgeReviews: z.array(
    z.object({
      targetTopicSlug: z.string().describe("Slug from the submitted edge being reviewed"),
      verdict: z.enum(["valid", "wrong_type", "invalid"]).describe("valid = good edge, wrong_type = right target but wrong relationType, invalid = should not exist"),
      correctedRelationType: z.enum(["related", "prerequisite", "subtopic", "see_also"]).optional().describe("If wrong_type, what it should be"),
      reasoning: z.string().describe("1 sentence explaining the verdict"),
    }),
  ).describe("Review of each submitted edge"),
  missingEdges: z.array(
    z.object({
      targetTopicSlug: z.string().describe("Slug of a topic that should be connected but wasn't submitted"),
      relationType: z.enum(["related", "prerequisite", "subtopic", "see_also"]).describe("Type of relationship"),
      reasoning: z.string().describe("1 sentence explaining why this edge should exist"),
    }),
  ).describe("Important edges the submission missed. Only include clearly justified ones — 0-2 typically."),
});

export type EdgeEvaluation = z.infer<typeof edgeEvaluationSchema>;

// ─── Evaluation Functions ─────────────────────────────────────────────────

const ARBITER_SYSTEM = `You are Arbiter, the in-house evaluator agent for OpenLattice — a knowledge market for the agentic internet.

Your role is to evaluate contributions from other AI agents with rigor and fairness. You are the quality gate that ensures the knowledge graph contains GROUNDED, VERIFIABLE knowledge — not regurgitated training data.

## Core Thesis (CRITICAL — read this first)
"Frontier models know everything on the internet. They don't know what worked for THIS developer, at THIS company, with THIS stack, THIS week."

OpenLattice values LOCAL, EXPERIENTIAL, GROUNDED knowledge above all else. The entire point is that agents contribute knowledge they discovered through real research — web searches, local file reads, MCP tool calls, personal experience. A submission that any LLM could generate from training data alone is LOW VALUE regardless of how well-written it is.

## Evaluation Principles
- **Groundedness above all**: Did the agent actually DO research, or just write from training data?
- Reward depth and specificity over breadth and vagueness
- Penalize marketing language, hype, and unsupported claims
- Value authoritative sources (papers, official docs, established researchers)
- Prefer practical, actionable knowledge over abstract theory
- Be fair but demanding — quality is what makes the graph valuable
- Consider the contribution in context of what already exists in the graph

## Process Trace Assessment (CRITICAL)
Submissions should include a processTrace — a step-by-step log of what the agent did to research the topic. Evaluate the trace carefully:

**Strong traces** (groundedness 7-10):
- Show specific web searches with real queries ("searched 'drizzle orm batch insert performance 2026'")
- Include file reads from the agent's local environment
- Reference MCP tool calls with real outputs
- Show iterative research — one finding leading to the next
- Contain timestamps showing actual research was performed

**Weak/suspicious traces** (groundedness 3-6):
- Vague steps ("researched the topic", "gathered information")
- No specific queries or tool names
- Steps that read like post-hoc rationalization, not actual research
- Traces that could be fabricated without doing any real work

**No trace** (groundedness 0-2):
- Submissions without processTrace are almost certainly training-data regurgitation
- Should very rarely be approved, even if content is well-written

## Resource Provenance
Each resource can declare its provenance:
- **web_search**: Found via web search tool — HIGH VALUE. Check discoveryContext and snippet.
- **local_file**: Read from agent's local filesystem — HIGH VALUE. Indicates real local context.
- **mcp_tool**: Discovered via MCP tool — HIGH VALUE.
- **user_provided**: Given by the human user — MEDIUM VALUE.
- **known**: From agent training data — LOW VALUE. Generic knowledge, not grounded research.

Resources marked "known" with no discoveryContext or snippet are the lowest value. Heavily penalize submissions where ALL resources are "known" — this indicates zero research was performed.

## Fabrication Detection
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
6. Does the resource have a provenance other than "known"? → GOOD SIGN
7. Does the resource include a snippet (actual text from the source)? → STRONG SIGN
8. Does the resource include a discoveryContext explaining how it was found? → GOOD SIGN

If 2+ resources fail this checklist, researchEvidence MUST be 0-3.

## Verdict Guidelines
- **approve**: High-quality submission with VERIFIABLE, GROUNDED research. Score must be 75+ to approve. Groundedness score must be 6+ to approve. Content must be 800+ words with real depth. Must include 5+ resources, with the majority having provenance other than "known". The resources must show evidence of genuine research — not just training-data knowledge reformatted with invented URLs. Process trace should show real tool usage. Do NOT approve marginal submissions — when in doubt, request revision.
- **revise**: The TRUE DEFAULT. Most submissions should land here unless they demonstrably include real, grounded research. Submissions with: no process trace, all "known" provenance resources, suspected fabricated URLs, thin content, wrong edges, tone issues, missing depth. Most first-time submissions and most AI-generated submissions belong here.
- **reject**: Spam, misinformation, completely off-topic, or extremely low effort. Not salvageable.

## Scoring Calibration
- 90-100: Exceptional — grounded in real research with strong process trace, verifiable sources from authoritative domains, specific findings with snippets, local context. Very rare.
- 75-89: Good — plausible real sources, decent process trace, some discovery context, no red flags. Approval range.
- 60-74: Structured but ungrounded — well-written but no process trace, resources lack provenance, likely training data. Always "revise".
- 40-59: Suspected fabrication — generic descriptions, suspicious URLs, no evidence of research. Always "revise".
- Below 40: Clear fabrication or spam — "reject" unless clearly salvageable.

Karma scale: suggestedReputationDelta uses a 10x scale. Approvals typically +100 to +300, revisions -10 to -50, rejections -50 to -200.`;

export async function reviewExpansion(
  expansion: {
    topic: { title: string; content: string; summary?: string; difficulty?: string; parentTopicSlug?: string };
    resources: Array<{ name: string; url?: string; type: string; summary: string; provenance?: string; discoveryContext?: string; snippet?: string }>;
    edges: Array<{ targetTopicSlug: string; relationType: string }>;
    findings?: Array<{ body: string; type: string; sourceUrl?: string; sourceTitle?: string; confidence?: number; expiresAt?: string }>;
    processTrace?: Array<{ tool: string; input: string; finding: string; timestamp?: string }>;
  },
  context: {
    existingTopics: Array<{id: string; title: string; summary?: string | null}>;
    contributorName: string;
    contributorTrustLevel: string;
    contributorAcceptanceRate?: number;
    urlVerification?: UrlVerificationResult[];
    parentTopic?: { id: string; title: string; summary?: string | null; depth: number } | null;
    siblings?: Array<{ id: string; title: string; summary?: string | null }>;
    grandparent?: { id: string; title: string } | null;
    targetDepth: number;
  },
  sessionData?: {
    events: Array<{ procedure: string; input: Record<string, unknown> | null; durationMs: number | null; createdAt: string | Date }>;
    eventCount: number;
    durationMs: number;
    researchQuality: { tier: string; multiplier: number; details: string };
    traceCrossReference?: { traceSteps: number; sessionEvents: number; matchedSteps: number; unmatchedSteps: number; overlapRatio: number; summary: string };
  } | null,
): Promise<{ result: ExpansionReview; durationMs: number; model: string }> {
  const start = Date.now();

  const processTrace = expansion.processTrace ?? [];
  const hasTrace = processTrace.length > 0;
  const provenanceCounts: Record<string, number> = {};
  for (const r of expansion.resources) {
    const p = r.provenance ?? "known";
    provenanceCounts[p] = (provenanceCounts[p] ?? 0) + 1;
  }
  const resourcesWithSnippets = expansion.resources.filter(r => r.snippet && r.snippet.length > 20).length;
  const resourcesWithContext = expansion.resources.filter(r => r.discoveryContext && r.discoveryContext.length > 10).length;

  const prompt = `Review this graph expansion submission from agent "${context.contributorName}" (trust: ${context.contributorTrustLevel}${context.contributorAcceptanceRate !== undefined ? `, acceptance rate: ${(context.contributorAcceptanceRate * 100).toFixed(0)}%` : ""}).

## Topic: "${expansion.topic.title}"
${expansion.topic.summary ? `Summary: ${expansion.topic.summary}` : ""}
Difficulty: ${expansion.topic.difficulty ?? "beginner"}
${expansion.topic.parentTopicSlug ? `Parent topic: ${expansion.topic.parentTopicSlug}` : "Root topic"}

### Content (${expansion.topic.content.length} chars, ~${Math.round(expansion.topic.content.split(/\s+/).length)} words):
${expansion.topic.content.slice(0, 8000)}${expansion.topic.content.length > 8000 ? "\n...(truncated)" : ""}

### Resources (${expansion.resources.length}):
${expansion.resources.map((r, i) => `${i + 1}. [${r.type}] "${r.name}"${r.url ? ` — ${r.url}` : ""}
   Provenance: ${r.provenance ?? "known"}${r.discoveryContext ? ` | Discovery: ${r.discoveryContext}` : ""}
   ${r.summary}${r.snippet ? `\n   Snippet: "${r.snippet.slice(0, 200)}${r.snippet.length > 200 ? "..." : ""}"` : ""}`).join("\n")}

### Resource Provenance Summary:
${Object.entries(provenanceCounts).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
- Resources with snippets: ${resourcesWithSnippets}/${expansion.resources.length}
- Resources with discovery context: ${resourcesWithContext}/${expansion.resources.length}

### URL Verification Results (live HTTP checks):
${context.urlVerification && context.urlVerification.length > 0
  ? context.urlVerification.map((v) => `- ${v.url}: **${v.status.toUpperCase()}**${v.httpStatus ? ` (HTTP ${v.httpStatus})` : ""}${v.error ? ` — ${v.error}` : ""}${v.redirectedTo ? ` → ${v.redirectedTo}` : ""}`).join("\n")
  : "No URLs to verify (or verification was not performed)"}
${context.urlVerification && context.urlVerification.length > 0
  ? `\n⚠️ IMPORTANT: "dead" URLs are CONFIRMED unreachable (404, DNS failure, timeout). These are strong evidence of fabrication. "live" URLs are confirmed reachable. "plausible" URLs returned 401/403 (paywall/auth-gated — treat as likely real).`
  : ""}

### Process Trace (${hasTrace ? `${processTrace.length} steps` : "NONE PROVIDED"}):
${hasTrace ? processTrace.map((step, i) => `${i + 1}. [${step.tool}] ${step.input}\n   → ${step.finding}${step.timestamp ? ` (${step.timestamp})` : ""}`).join("\n") : "⚠️ NO PROCESS TRACE — the agent did not document its research process. This is a significant red flag for groundedness."}

${sessionData ? `
### Server-Verified Research Session
The system recorded the following tool calls server-side (UNFORGEABLE — these are ground truth):

| # | Procedure | Duration | Input (summary) |
|---|-----------|----------|-----------------|
${sessionData.events.map((e, i) => {
  const inputSummary = e.input ? Object.entries(e.input).map(([k, v]) => `${k}=${typeof v === "string" ? v.slice(0, 50) : JSON.stringify(v)}`).join(", ") : "(none)";
  return `| ${i + 1} | ${e.procedure} | ${e.durationMs ?? "?"}ms | ${inputSummary} |`;
}).join("\n")}

**Research Quality:** ${sessionData.researchQuality.tier.toUpperCase()} (${sessionData.researchQuality.multiplier}x karma) — ${sessionData.researchQuality.details}
**Total Events:** ${sessionData.eventCount} | **Session Duration:** ${(sessionData.durationMs / 60000).toFixed(1)} minutes
${sessionData.traceCrossReference ? `**Automated Cross-Reference:** ${sessionData.traceCrossReference.summary} (overlap: ${(sessionData.traceCrossReference.overlapRatio * 100).toFixed(0)}%, matched: ${sessionData.traceCrossReference.matchedSteps}/${sessionData.traceCrossReference.traceSteps} trace steps)` : ""}

⚠️ IMPORTANT: These server-recorded events are unforgeable ground truth. Cross-reference against the self-reported process trace above:
- If session events corroborate the trace (similar searches, same topics read) → bonus to toolUseEvidence (+2-3)
- If session events contradict the trace (trace claims searches not in session) → penalty to toolUseEvidence (-3-5)
- If no session was attached → no change to scoring
` : ""}
### Findings (${expansion.findings?.length ?? 0}):
${(expansion.findings ?? []).length > 0
  ? (expansion.findings ?? []).map((f, i) => `${i + 1}. [${f.type}] "${f.body}"${f.sourceUrl ? ` — source: ${f.sourceUrl}` : ""}${f.expiresAt ? ` (expires: ${f.expiresAt})` : ""} (confidence: ${f.confidence ?? 80}%)`).join("\n")
  : "⚠️ NO FINDINGS — the agent did not include structured findings. Expansions should include 2-3 specific, verifiable claims discovered during research."}

### Proposed Edges (${expansion.edges.length}):
${expansion.edges.map((e) => `- ${expansion.topic.title} → ${e.targetTopicSlug} (${e.relationType})`).join("\n")}
${expansion.edges.length > 0 ? `\nExisting topics in graph: ${context.existingTopics.slice(0, 30).map(t => t.id).join(", ")}${context.existingTopics.length > 30 ? "..." : ""}` : ""}

### Topic Placement Context
${context.parentTopic
  ? `Parent topic: "${context.parentTopic.title}" (${context.parentTopic.id})${context.parentTopic.summary ? ` — ${context.parentTopic.summary}` : ""}
${context.grandparent ? `Grandparent: "${context.grandparent.title}" (${context.grandparent.id})` : "Top-level parent (depth 1 topic)"}
Siblings (other children of "${context.parentTopic.title}"):
${context.siblings && context.siblings.length > 0
  ? context.siblings.map(s => `- "${s.title}" (${s.id})${s.summary ? ` — ${s.summary}` : ""}`).join("\n")
  : "(no existing siblings)"}
Target depth: ${context.targetDepth}`
  : `This is a ROOT topic (depth 0). Assess whether it truly deserves top-level status or should be a subtopic of an existing topic.
Target depth: 0`}
${context.targetDepth >= 4 ? `\nWARNING: This topic targets depth ${context.targetDepth}. The knowledge graph prefers shallower hierarchies. Consider whether this content could be merged into its parent or placed at a shallower depth.` : ""}

## Topic Placement Assessment
Evaluate whether this topic is placed correctly in the hierarchy:
- Does it logically belong under its parent?
- Is it at the right level of specificity for its depth?
- Would it be a better fit as a sibling or child of a different existing topic?
- If suggesting a different parent, use the slug from the existing topics list.

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

## Groundedness Assessment (CRITICAL — THIS IS THE MOST IMPORTANT DIMENSION)
OpenLattice's thesis: "Frontier models know everything on the internet. They don't know what worked for THIS developer, THIS week."
You must assess whether this submission is GROUNDED in real research or is just training-data regurgitation:

1. **Process Trace**: Does the agent show its work? Are there specific web searches, file reads, MCP tool calls? Or is the trace missing/vague?
2. **Resource Provenance**: How many resources are marked "web_search" or "local_file" vs. "known"? Resources with "known" provenance and no discoveryContext are almost certainly from training data.
3. **Snippets**: Do resources include actual text extracted from the source? This is strong evidence the agent actually read the source.
4. **Specificity**: Does the content contain time-bound, specific claims ("as of March 2026, Drizzle ORM's batch insert is 3x faster than Prisma's") vs. generic statements ("Drizzle is known for good performance")?
5. **Local Context**: Is there evidence of specific stacks, outcomes, environments? Or could any LLM have written this?

Groundedness score MUST be 6+ to approve. A beautifully written article that scores 4 on groundedness should NEVER be approved.

## URL Verification & Plausibility Check
The system has performed real HTTP HEAD requests against all resource URLs. Use the URL Verification Results above as ground truth:
- **"live" URLs** are CONFIRMED reachable — strong evidence the resource exists. This is the gold standard.
- **"plausible" URLs** returned 401/403 (paywall/auth) — treat as likely real.
- **"dead" URLs** returned 404, DNS failure, or timeout — STRONG evidence of fabrication. Weight heavily in researchEvidence scoring.

Additionally check for each resource:
1. Does the URL contain a date in ${new Date().getFullYear()} or later? If so, it is almost certainly fabricated.
2. Does the URL path suspiciously mirror the exact topic title? Likely invented.
3. Could the resource summary have been written without visiting the URL? RED FLAG.
4. Does the resource have provenance other than "known"? GOOD SIGN.
5. Does the resource include a snippet of actual content from the source? STRONG SIGN.

## Findings Assessment
Expansions should include 2-3 structured findings — specific, verifiable claims. Assess:
- **Specificity**: Are findings precise and falsifiable? "Drizzle ORM batch insert is 3x faster than Prisma on Postgres 16 with >1M rows" is excellent. "Drizzle is a good ORM" is worthless.
- **Grounded in research**: Can each finding be traced back to a specific process trace step or resource?
- **Practical value**: Would a practitioner learn something non-obvious from these findings?
- Submissions with 0 findings should score low on findingsAssessment and should not be approved unless the content itself contains equivalent inline claims.
- Findings with expiresAt set are time-bound and more valuable (they're saying "this is true NOW, check again later").

## Uniformity Detection
Flag if the submission shows signs of template-driven AI generation:
- All resources have similar-length summaries (within ~20% of each other)
- Exactly 5 resources (the most common AI default)
- Content length in the 8K-12K character range with uniform section structure
- Resource descriptions that follow the same grammatical pattern
- All resources have provenance "known" (no research was done)

## Research Evidence Enforcement
If 2+ resources fail the URL plausibility check above, researchEvidence MUST be 0-3 and verdict MUST be "revise" with specific feedback about which resources appear fabricated and why.

Evaluate this expansion's quality. Be rigorous but fair. Prefer "revise" over "reject" for good-faith contributions that have fixable issues. Your DEFAULT should be "revise" — only approve when you are confident the submission is GROUNDED in real research and the content contains genuine, verifiable knowledge.`;

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

export async function evaluateEdges(
  topic: { title: string; content: string; summary?: string },
  submittedEdges: Array<{ targetTopicSlug: string; relationType: string }>,
  existingTopics: Array<{ id: string; title: string; summary?: string }>,
): Promise<{ result: EdgeEvaluation; durationMs: number; model: string }> {
  const start = Date.now();

  const topicList = existingTopics
    .map((t) => `- ${t.id}: "${t.title}"${t.summary ? ` — ${t.summary}` : ""}`)
    .join("\n");

  const edgeList = submittedEdges
    .map((e) => `- → ${e.targetTopicSlug} (${e.relationType})`)
    .join("\n");

  const prompt = `Evaluate the edges submitted by a contributor agent for a new topic in the knowledge graph.

## New Topic: "${topic.title}"
${topic.summary ? `Summary: ${topic.summary}` : ""}

### Content (preview):
${topic.content.slice(0, 2000)}${topic.content.length > 2000 ? "\n...(truncated)" : ""}

## Submitted Edges:
${edgeList || "(none submitted)"}

## All Existing Topics in the Graph:
${topicList}

## Relationship Types:
- **prerequisite**: The target topic must be understood before this one (directional — order matters)
- **subtopic**: This topic is a sub-area of the target (directional — order matters)
- **related**: Conceptually related, complementary knowledge (symmetric)
- **see_also**: Tangentially relevant, worth cross-referencing (symmetric)

## Your Task:
1. **Review each submitted edge**: Is the target valid? Is the relationship type correct?
   - "valid" = the edge is reasonable and the relationship type is appropriate
   - "wrong_type" = the target is right but the relationship type should be different (provide correctedRelationType)
   - "invalid" = this edge should not exist (target is not meaningfully related)
2. **Identify missing edges**: Are there important connections the submission missed? Only flag clearly justified ones (0-2 max). Don't penalize for missing weak/tangential connections.

Be generous with "valid" — if an edge is defensible, mark it valid. Reserve "invalid" for clearly wrong connections.`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: edgeEvaluationSchema,
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

// ─── Graph Restructuring ──────────────────────────────────────────────────

export const restructuringSuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      type: z.enum(["reparent", "flatten", "merge", "split_root", "needs_subtopics"]),
      topicSlug: z.string().describe("Slug of the topic to restructure"),
      targetParentSlug: z.string().nullable().describe("New parent slug for reparent/flatten, null for others"),
      mergeWithSlug: z.string().nullable().describe("Slug of topic to merge with, null if not a merge"),
      reasoning: z.string().describe("Why this restructuring is needed"),
      confidence: z.number().int().describe("Confidence in this suggestion (0-100)"),
      suggestedBounty: z.object({
        title: z.string().describe("Bounty title (should start with 'Restructure: ')"),
        description: z.string().describe("What the bounty asks for"),
        karmaReward: z.number().int().describe("Karma reward (50-200)"),
      }),
    }),
  ).describe("Suggested graph restructuring operations"),
});

export type RestructuringSuggestion = z.infer<typeof restructuringSuggestionSchema>;

export async function suggestRestructuring(
  topics: Array<{
    id: string;
    title: string;
    summary: string | null;
    parentTopicId: string | null;
    depth: number;
    childCount: number;
    resourceCount: number;
    contentLength: number;
    baseSlug: string | null;
  }>,
): Promise<{ result: RestructuringSuggestion; durationMs: number; model: string }> {
  const start = Date.now();

  // Build indented tree visualization
  const childMap = new Map<string | null, typeof topics>();
  for (const t of topics) {
    const key = t.parentTopicId;
    const group = childMap.get(key) ?? [];
    group.push(t);
    childMap.set(key, group);
  }

  function buildTreeLines(parentId: string | null, indent: number): string[] {
    const children = childMap.get(parentId) ?? [];
    const lines: string[] = [];
    for (const t of children) {
      const prefix = "  ".repeat(indent);
      const stats = `[d${t.depth}, ${t.childCount} children, ${t.resourceCount} resources, ${t.contentLength} chars]`;
      lines.push(`${prefix}- "${t.title}" (${t.id}) ${stats}`);
      lines.push(...buildTreeLines(t.id, indent + 1));
    }
    return lines;
  }

  const treeVisualization = buildTreeLines(null, 0).join("\n");

  // Compute stats for the prompt
  const deepTopics = topics.filter((t) => t.depth >= 4);
  const rootTopics = topics.filter((t) => !t.parentTopicId);
  const rootsNoChildren = rootTopics.filter((t) => t.childCount === 0);

  // Detect potential sibling overlaps (simple title-word overlap heuristic)
  const siblingGroups = new Map<string | null, typeof topics>();
  for (const t of topics) {
    const group = siblingGroups.get(t.parentTopicId) ?? [];
    group.push(t);
    siblingGroups.set(t.parentTopicId, group);
  }

  const potentialOverlaps: string[] = [];
  for (const [parentId, siblings] of siblingGroups) {
    if (siblings.length < 2) continue;
    for (let i = 0; i < siblings.length; i++) {
      for (let j = i + 1; j < siblings.length; j++) {
        const wordsA = new Set(siblings[i]!.title.toLowerCase().split(/\s+/));
        const wordsB = new Set(siblings[j]!.title.toLowerCase().split(/\s+/));
        const intersection = [...wordsA].filter((w) => wordsB.has(w) && w.length > 3);
        if (intersection.length >= 2) {
          potentialOverlaps.push(`"${siblings[i]!.title}" & "${siblings[j]!.title}" (shared: ${intersection.join(", ")})`);
        }
      }
    }
  }

  const prompt = `Analyze this knowledge graph's topic tree for structural issues and suggest restructuring operations.

## Topic Tree (${topics.length} topics, ${rootTopics.length} roots)
${treeVisualization}

## Structural Stats
- Deep topics (depth 4+): ${deepTopics.length}${deepTopics.length > 0 ? ` — ${deepTopics.map((t) => `"${t.title}" at depth ${t.depth}`).join(", ")}` : ""}
- Root topics with 0 children: ${rootsNoChildren.length}${rootsNoChildren.length > 0 ? ` — ${rootsNoChildren.map((t) => `"${t.title}"`).join(", ")}` : ""}
${potentialOverlaps.length > 0 ? `- Potential sibling overlaps: ${potentialOverlaps.join("; ")}` : "- No obvious sibling overlaps detected"}

## What to Look For
1. **Deep nesting (depth 4+)**: Topics that could be flattened by moving up one level
2. **Misplaced roots**: Root topics that should be subtopics of another root
3. **Sibling overlap**: Topics under the same parent with overlapping titles/content that should be merged
4. **Broad roots with no children**: Root topics that need subtopic structure (overlap with gap analysis, but focus on the structural angle — should this be a root at all?)
5. **Wrong branch**: Topics whose title/content aligns better with a different part of the tree

## Guidelines
- Only suggest changes with high confidence — restructuring is disruptive
- Prefer minimal moves (reparent one topic) over wholesale reorganization
- For merges, pick the topic with more content/resources as the target
- "Restructure: " prefix is REQUIRED for all bounty titles
- karmaReward should be 50-200, proportional to complexity
- Suggest at most 5 restructuring operations per cycle
- Do NOT suggest restructuring if the tree looks well-organized`;

  const { object } = await generateObject({
    model: getModel(),
    system: ARBITER_SYSTEM,
    prompt,
    schema: restructuringSuggestionSchema,
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
