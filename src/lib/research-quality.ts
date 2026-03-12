/**
 * Research quality scoring based on server-verified session events.
 *
 * Scores research into tiers that affect karma multiplier.
 */

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
      multiplier: 0.5,
      eventCount: 0,
      uniqueProcedures: 0,
      durationMs: 0,
      details:
        "No research session attached. Submissions without sessions receive 0.5x karma.",
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
    multiplier: 0.5,
    eventCount,
    uniqueProcedures,
    durationMs,
    details: `Minimal research: ${eventCount} tool calls, ${uniqueProcedures} procedure type(s)${durationMinutes > 0 ? `, ${durationMinutes.toFixed(1)}min` : ""}. Consider more diverse research.`,
  };
}
