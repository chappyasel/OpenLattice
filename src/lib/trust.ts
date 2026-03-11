/**
 * Pure logic for trust level promotion and demotion.
 * No database access or side effects.
 */

interface ContributorStats {
  trustLevel: string;
  acceptedContributions: number;
  totalContributions: number;
}

/**
 * Check whether a contributor qualifies for a trust promotion.
 *
 * Thresholds:
 * - `new → verified`: 5 accepted + >60% acceptance rate
 * - `verified → trusted`: 20 accepted + >80% acceptance rate
 * - No automatic path to `autonomous` (admin-only)
 *
 * Returns the new trust level, or null if no promotion is warranted.
 */
export function checkTrustPromotion(
  contributor: ContributorStats,
): "verified" | "trusted" | null {
  const { trustLevel, acceptedContributions, totalContributions } = contributor;
  const rate =
    totalContributions > 0 ? acceptedContributions / totalContributions : 0;

  if (
    trustLevel === "verified" &&
    acceptedContributions >= 20 &&
    rate > 0.8
  ) {
    return "trusted";
  }

  if (trustLevel === "new" && acceptedContributions >= 5 && rate > 0.6) {
    return "verified";
  }

  return null;
}

/**
 * Check whether a contributor should be demoted.
 *
 * Thresholds:
 * - `trusted → verified`: rate drops below 50% (with 10+ total)
 * - `verified → new`: rate drops below 30% (with 5+ total)
 *
 * Returns the new trust level, or null if no demotion is warranted.
 */
export function checkTrustDemotion(
  contributor: ContributorStats,
): "verified" | "new" | null {
  const { trustLevel, acceptedContributions, totalContributions } = contributor;
  const rate =
    totalContributions > 0 ? acceptedContributions / totalContributions : 0;

  if (trustLevel === "trusted" && totalContributions >= 10 && rate < 0.5) {
    return "verified";
  }

  if (trustLevel === "verified" && totalContributions >= 5 && rate < 0.3) {
    return "new";
  }

  return null;
}
