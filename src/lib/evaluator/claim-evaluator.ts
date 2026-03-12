/**
 * Lightweight AI evaluator for standalone claims.
 *
 * Simpler than full expansion review — focuses on specificity,
 * evidence quality, and URL verification.
 */

import { generateObject } from "ai";
import { createGateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { verifyUrls } from "./url-verify";

const MODEL = process.env.EVALUATOR_MODEL ?? "anthropic/claude-sonnet-4-20250514";

const gateway = createGateway();

function getModel() {
  return gateway(MODEL);
}

export const claimReviewSchema = z.object({
  verdict: z.enum(["approve", "reject"]),
  score: z.number().int().min(0).max(100).describe("Overall quality score"),
  specificity: z
    .number()
    .min(0)
    .max(10)
    .describe(
      "Is the claim specific and falsifiable? 0=vague platitude, 10=precise measurable claim",
    ),
  evidenceQuality: z
    .number()
    .min(0)
    .max(10)
    .describe(
      "Does the snippet/source back the claim? 0=no evidence, 10=strong direct evidence",
    ),
  adjustedConfidence: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Your assessment of the true confidence level"),
  reasoning: z.string().describe("2-3 sentence justification"),
});

export type ClaimReview = z.infer<typeof claimReviewSchema>;

export async function reviewClaim(
  claim: {
    body: string;
    type: string;
    confidence: number;
    sourceUrl?: string | null;
    sourceTitle?: string | null;
    environmentContext?: Record<string, unknown> | null;
    groundednessEvidence?: {
      snippet?: string;
      discoveryContext?: string;
      provenance?: string;
      sessionId?: string;
    } | null;
  },
  context: {
    topicTitle: string;
    contributorName: string;
    contributorTrustLevel: string;
  },
): Promise<{ result: ClaimReview; durationMs: number; model: string }> {
  const start = Date.now();

  // Verify URL if provided and confidence >= 80
  let urlStatus: string | null = null;
  if (claim.sourceUrl && claim.confidence >= 80) {
    try {
      const [verification] = await verifyUrls([claim.sourceUrl], {
        timeoutMs: 5000,
        maxConcurrent: 1,
        totalTimeoutMs: 5000,
      });
      urlStatus = verification?.status ?? null;
    } catch {
      // URL verification failed, proceed without
    }
  }

  const evidence = claim.groundednessEvidence;
  const prompt = `Evaluate this standalone claim submitted to the knowledge graph.

## Claim
- **Type:** ${claim.type}
- **Body:** "${claim.body}"
- **Confidence:** ${claim.confidence}%
- **Topic:** ${context.topicTitle}
- **Contributor:** ${context.contributorName} (trust: ${context.contributorTrustLevel})

## Evidence
- **Source URL:** ${claim.sourceUrl ?? "None"}${urlStatus ? ` (verification: ${urlStatus})` : ""}
- **Source Title:** ${claim.sourceTitle ?? "None"}
- **Provenance:** ${evidence?.provenance ?? "unknown"}
- **Discovery Context:** ${evidence?.discoveryContext ?? "None"}
- **Snippet:** ${evidence?.snippet ? `"${evidence.snippet.slice(0, 500)}"` : "None"}
- **Has Research Session:** ${evidence?.sessionId ? "Yes" : "No"}
- **Environment:** ${claim.environmentContext ? JSON.stringify(claim.environmentContext) : "None"}

## Evaluation Criteria
1. **Specificity**: Is this claim falsifiable? Does it include numbers, versions, dates, comparisons? Vague claims like "X is useful" score 0-3. Precise claims like "X v2.3 reduces latency by 40% on Postgres 16" score 8-10.
2. **Evidence Quality**: Does the snippet directly support the claim? Is the source URL real and relevant? No evidence = 0-3. Strong snippet + live URL = 8-10.
3. **Adjusted Confidence**: What should the real confidence be? Lower if evidence is weak, raise if strong.

## Hard Gates
- Specificity < 4 → MUST reject
- Evidence quality < 4 AND confidence >= 80 → MUST reject
${urlStatus === "dead" ? "- Source URL is DEAD (404/DNS failure) AND confidence >= 80 → MUST reject" : ""}

## Verdict
- **approve**: Specific, verifiable claim with adequate evidence for its confidence level
- **reject**: Vague, unverifiable, or poorly evidenced claim`;

  const { object } = await generateObject({
    model: getModel(),
    system:
      "You are a claim evaluator for OpenLattice, a knowledge market. Evaluate claims with rigor — only approve specific, verifiable assertions with adequate evidence.",
    prompt,
    schema: claimReviewSchema,
  });

  // Apply hard gates (override AI if needed)
  const result = { ...object };
  if (result.verdict === "approve" && result.specificity < 4) {
    result.verdict = "reject";
    result.reasoning = `Specificity ${result.specificity}/10 is below minimum threshold of 4. ${result.reasoning}`;
  }
  if (
    result.verdict === "approve" &&
    result.evidenceQuality < 4 &&
    claim.confidence >= 80
  ) {
    result.verdict = "reject";
    result.reasoning = `Evidence quality ${result.evidenceQuality}/10 is too low for confidence ${claim.confidence}%. ${result.reasoning}`;
  }
  if (
    result.verdict === "approve" &&
    urlStatus === "dead" &&
    claim.confidence >= 80
  ) {
    result.verdict = "reject";
    result.reasoning = `Source URL is unreachable (dead). ${result.reasoning}`;
  }

  return { result, durationMs: Date.now() - start, model: MODEL };
}
