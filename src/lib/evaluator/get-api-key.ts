/**
 * Resolves the evaluator's API key at runtime by looking up the autonomous
 * contributor in the database and generating a fresh temporary key.
 *
 * This removes the need for the EVALUATOR_API_KEY env var — the evaluator
 * contributor is managed entirely through the admin UI.
 */

import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { contributors } from "@/server/db/schema";

export async function getEvaluatorApiKey(): Promise<string> {
  const evaluator = await db.query.contributors.findFirst({
    where: eq(contributors.trustLevel, "autonomous"),
  });

  if (!evaluator) {
    throw new Error(
      "No autonomous contributor found. Create one in the admin UI first.",
    );
  }

  // Generate a fresh temporary API key
  const rawKey = `ol_eval_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  // Store the hash so the tRPC apiKeyProcedure can verify it
  await db
    .update(contributors)
    .set({ apiKey: keyHash })
    .where(eq(contributors.id, evaluator.id));

  return rawKey;
}
