/**
 * Resolves Scout's API key at runtime by looking up (or creating) the Scout
 * contributor in the database and generating a fresh temporary key.
 */

import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { contributors } from "@/server/db/schema";

export async function getScoutApiKey(): Promise<string> {
  let scout = await db.query.contributors.findFirst({
    where: and(
      eq(contributors.name, "Scout"),
      eq(contributors.isAgent, true),
    ),
  });

  if (!scout) {
    // Auto-create Scout contributor
    const id = `scout-${crypto.randomBytes(8).toString("hex")}`;
    const [created] = await db
      .insert(contributors)
      .values({
        id,
        name: "Scout",
        isAgent: true,
        trustLevel: "verified",
        agentModel: "claude-sonnet-4-6",
      })
      .returning();
    scout = created!;
  }

  // Generate a fresh temporary API key
  const rawKey = `ol_scout_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  // Store the hash so the tRPC apiKeyProcedure can verify it
  await db
    .update(contributors)
    .set({ apiKey: keyHash })
    .where(eq(contributors.id, scout.id));

  return rawKey;
}
