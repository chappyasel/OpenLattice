/**
 * Confidence decay for claims.
 *
 * Claims lose confidence over time based on their type.
 * Endorsements reset the decay clock.
 */

const HALF_LIFE_DAYS: Record<string, number> = {
  benchmark: 90,
  config: 90,
  recommendation: 180,
  warning: 180,
  insight: 365,
  resource_note: 365,
};

export function getHalfLifeDays(type: string): number {
  return HALF_LIFE_DAYS[type] ?? 365;
}

export function computeEffectiveConfidence(
  confidence: number,
  lastEndorsedAt: Date | string,
  type: string,
): number {
  const halfLifeDays = getHalfLifeDays(type);
  const now = new Date();
  const lastEndorsed = new Date(lastEndorsedAt);
  const daysSinceLastEndorsed =
    (now.getTime() - lastEndorsed.getTime()) / (1000 * 60 * 60 * 24);

  const effective =
    confidence * Math.pow(0.5, daysSinceLastEndorsed / halfLifeDays);
  return Math.round(effective * 100) / 100;
}

export function isStale(claim: {
  confidence: number;
  lastEndorsedAt: Date | string | null;
  type: string;
}): boolean {
  if (!claim.lastEndorsedAt) return false;
  const effective = computeEffectiveConfidence(
    claim.confidence,
    claim.lastEndorsedAt,
    claim.type,
  );
  return effective < 20;
}
