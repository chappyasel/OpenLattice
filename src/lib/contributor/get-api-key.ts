/**
 * Resolves the contributor agent's API key at runtime by looking up a
 * non-autonomous agent contributor in the database and generating a fresh
 * temporary key.
 *
 * If CONTRIBUTOR_API_KEY is set in the environment, it is returned directly.
 * Otherwise the key is generated from the first matching agent contributor.
 */

import crypto from "crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/server/db";
import { contributors } from "@/server/db/schema";

export async function getContributorApiKey(): Promise<string> {
  // Allow explicit override via env var
  if (process.env.CONTRIBUTOR_API_KEY) {
    return process.env.CONTRIBUTOR_API_KEY;
  }

  // Find first non-autonomous agent contributor
  const contributor = await db.query.contributors.findFirst({
    where: and(
      eq(contributors.isAgent, true),
      ne(contributors.trustLevel, "autonomous"),
    ),
  });

  if (!contributor) {
    throw new Error(
      "No non-autonomous agent contributor found. Create one in the admin UI first, " +
        "or set CONTRIBUTOR_API_KEY in your environment.",
    );
  }

  // Generate a fresh temporary API key
  const rawKey = `ol_contrib_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  // Store the hash so the tRPC apiKeyProcedure can verify it
  await db
    .update(contributors)
    .set({ apiKey: keyHash })
    .where(eq(contributors.id, contributor.id));

  return rawKey;
}
