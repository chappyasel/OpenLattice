import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { type db } from "@/server/db";
import { bases } from "@/server/db/schema";

/**
 * Resolve a base slug to its ID.
 * Returns undefined when no slug is provided (global query).
 * Throws NOT_FOUND if slug is given but doesn't exist.
 */
export async function resolveBaseId(
  database: typeof db,
  baseSlug?: string,
): Promise<string | undefined> {
  if (!baseSlug) return undefined;

  const base = await database.query.bases.findFirst({
    where: eq(bases.slug, baseSlug),
    columns: { id: true },
  });

  if (!base) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Base "${baseSlug}" not found`,
    });
  }

  return base.id;
}
