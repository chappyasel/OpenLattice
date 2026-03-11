import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { type db } from "@/server/db";
import { collections } from "@/server/db/schema";

/**
 * Resolve a collection slug to its ID.
 * Returns undefined when no slug is provided (global query).
 * Throws NOT_FOUND if slug is given but doesn't exist.
 */
export async function resolveCollectionId(
  database: typeof db,
  collectionSlug?: string,
): Promise<string | undefined> {
  if (!collectionSlug) return undefined;

  const collection = await database.query.collections.findFirst({
    where: eq(collections.slug, collectionSlug),
    columns: { id: true },
  });

  if (!collection) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Collection "${collectionSlug}" not found`,
    });
  }

  return collection.id;
}
