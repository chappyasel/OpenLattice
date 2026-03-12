/**
 * Resolves the evaluator's API key at runtime by looking up the autonomous
 * contributor and deriving a deterministic key from AUTH_SECRET.
 *
 * The key is deterministic so that multiple instances (local + remote) sharing
 * the same database won't invalidate each other's keys mid-cycle.
 */

import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { contributors } from "@/server/db/schema";
import { env } from "@/env";

export async function getEvaluatorApiKey(): Promise<string> {
  const evaluator = await db.query.contributors.findFirst({
    where: eq(contributors.trustLevel, "autonomous"),
  });

  if (!evaluator) {
    throw new Error(
      "No autonomous contributor found. Create one in the admin UI first.",
    );
  }

  // Derive a stable key from AUTH_SECRET + contributor ID.
  // All instances sharing the same env + DB produce the same key,
  // so concurrent runs won't invalidate each other.
  const rawKey = `ol_eval_${crypto
    .createHmac("sha256", env.AUTH_SECRET)
    .update(evaluator.id)
    .digest("hex")
    .slice(0, 48)}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  // Only update the DB if the hash changed (avoids unnecessary writes)
  if (evaluator.apiKey !== keyHash) {
    await db
      .update(contributors)
      .set({ apiKey: keyHash })
      .where(eq(contributors.id, evaluator.id));
  }

  return rawKey;
}
