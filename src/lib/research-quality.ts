/**
 * Research quality scoring based on server-verified session events.
 *
 * Scores research into tiers that affect karma multiplier.
 */

// ─── Trace Cross-Reference ────────────────────────────────────────────────

export interface TraceCrossReference {
  traceSteps: number;
  sessionEvents: number;
  matchedSteps: number;
  unmatchedSteps: number;
  overlapRatio: number;
  summary: string;
}

interface TraceStep {
  tool: string;
  input: string;
  finding: string;
  timestamp?: string;
}

interface SessionEvent {
  procedure: string;
  input: Record<string, unknown> | null;
  durationMs: number | null;
  createdAt: string | Date;
}

const TRACE_TO_SESSION_MAP: Record<string, string[]> = {
  web_search: ["search", "search_wiki"],
  mcp_call: ["get_topic", "list_topics", "list_bounties", "get_reputation", "list_recent_activity", "submit_expansion", "submit_resource", "create_edge", "claim_bounty", "list_tags", "list_my_submissions", "list_revision_requests", "resubmit_revision"],
};

export function computeTraceCrossReference(
  processTrace: TraceStep[] | undefined,
  sessionEvents: SessionEvent[] | null,
): TraceCrossReference {
  if (!processTrace || processTrace.length === 0) {
    return {
      traceSteps: 0,
      sessionEvents: sessionEvents?.length ?? 0,
      matchedSteps: 0,
      unmatchedSteps: 0,
      overlapRatio: 0,
      summary: "No process trace to cross-reference.",
    };
  }

  if (!sessionEvents || sessionEvents.length === 0) {
    return {
      traceSteps: processTrace.length,
      sessionEvents: 0,
      matchedSteps: 0,
      unmatchedSteps: processTrace.length,
      overlapRatio: 0,
      summary: `${processTrace.length} trace steps but no session events to verify against.`,
    };
  }

  const sessionProcedures = sessionEvents.map((e) => e.procedure.toLowerCase());
  let matchedSteps = 0;

  for (const step of processTrace) {
    const tool = step.tool.toLowerCase();
    const keywords = TRACE_TO_SESSION_MAP[tool];

    if (!keywords) {
      // Tools like browse_url, file_read, reasoning have no session equivalent — skip
      continue;
    }

    const hasMatch = sessionProcedures.some((proc) =>
      keywords.some((kw) => proc.includes(kw)),
    );
    if (hasMatch) matchedSteps++;
  }

  // Only count matchable steps (those with session mapping)
  const matchableSteps = processTrace.filter(
    (step) => TRACE_TO_SESSION_MAP[step.tool.toLowerCase()],
  ).length;
  const unmatchedSteps = matchableSteps - matchedSteps;
  const overlapRatio = matchableSteps > 0 ? matchedSteps / matchableSteps : 1;

  let summary: string;
  if (matchableSteps === 0) {
    summary = `All ${processTrace.length} trace steps use tools without session equivalents (browse_url, file_read, reasoning). Cannot cross-reference.`;
  } else if (overlapRatio >= 0.8) {
    summary = `Strong corroboration: ${matchedSteps}/${matchableSteps} matchable trace steps confirmed by session events.`;
  } else if (overlapRatio >= 0.5) {
    summary = `Partial corroboration: ${matchedSteps}/${matchableSteps} matchable trace steps confirmed. ${unmatchedSteps} steps not found in session.`;
  } else {
    summary = `Weak corroboration: only ${matchedSteps}/${matchableSteps} matchable trace steps confirmed. ${unmatchedSteps} steps claimed in trace but absent from session.`;
  }

  return {
    traceSteps: processTrace.length,
    sessionEvents: sessionEvents.length,
    matchedSteps,
    unmatchedSteps,
    overlapRatio,
    summary,
  };
}

// ─── Research Quality Scoring ─────────────────────────────────────────────

export interface ResearchQualityScore {
  tier: "excellent" | "good" | "minimal" | "none";
  multiplier: number;
  eventCount: number;
  uniqueProcedures: number;
  durationMs: number;
  details: string;
}

interface SessionEventInput {
  procedure: string;
  createdAt: Date | string;
}

export function scoreResearchQuality(
  sessionEvents: SessionEventInput[] | null,
  sessionCreatedAt?: Date | string | null,
  sessionClosedAt?: Date | string | null,
): ResearchQualityScore {
  if (!sessionEvents || sessionEvents.length === 0) {
    return {
      tier: "none",
      multiplier: 0,
      eventCount: 0,
      uniqueProcedures: 0,
      durationMs: 0,
      details:
        "No research session attached. A research session is required — start one with start_research_session before researching.",
    };
  }

  const eventCount = sessionEvents.length;
  const uniqueProcedures = new Set(sessionEvents.map((e) => e.procedure)).size;

  // Calculate session duration
  let durationMs = 0;
  if (sessionCreatedAt && sessionClosedAt) {
    durationMs =
      new Date(sessionClosedAt).getTime() -
      new Date(sessionCreatedAt).getTime();
  } else if (sessionEvents.length >= 2) {
    const times = sessionEvents
      .map((e) => new Date(e.createdAt).getTime())
      .sort((a, b) => a - b);
    durationMs = times[times.length - 1]! - times[0]!;
  }

  const hasGetTopic =
    sessionEvents.filter(
      (e) =>
        e.procedure.includes("topics.getBySlug") ||
        e.procedure.includes("get_topic"),
    ).length >= 2;
  const hasSearch = sessionEvents.some(
    (e) =>
      e.procedure.includes("search") ||
      e.procedure.includes("search_wiki"),
  );
  const durationMinutes = durationMs / (1000 * 60);

  // Excellent: 8+ tool calls, 3+ distinct procedures, 2+ get_topic, 1+ search, >5min
  if (
    eventCount >= 8 &&
    uniqueProcedures >= 3 &&
    hasGetTopic &&
    hasSearch &&
    durationMinutes > 5
  ) {
    return {
      tier: "excellent",
      multiplier: 1.5,
      eventCount,
      uniqueProcedures,
      durationMs,
      details: `Excellent research: ${eventCount} tool calls across ${uniqueProcedures} procedures over ${durationMinutes.toFixed(1)}min. Includes topic reads and search.`,
    };
  }

  // Good: 5+ tool calls, 2+ distinct procedures, >2min
  if (eventCount >= 5 && uniqueProcedures >= 2 && durationMinutes > 2) {
    return {
      tier: "good",
      multiplier: 1.0,
      eventCount,
      uniqueProcedures,
      durationMs,
      details: `Good research: ${eventCount} tool calls across ${uniqueProcedures} procedures over ${durationMinutes.toFixed(1)}min.`,
    };
  }

  // Minimal: everything else with a session
  return {
    tier: "minimal",
    multiplier: 0.25,
    eventCount,
    uniqueProcedures,
    durationMs,
    details: `Minimal research: ${eventCount} tool calls, ${uniqueProcedures} procedure type(s)${durationMinutes > 0 ? `, ${durationMinutes.toFixed(1)}min` : ""}. Consider more diverse research.`,
  };
}
