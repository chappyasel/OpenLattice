/**
 * Karma ledger service.
 *
 * All karma mutations MUST go through `recordKarma` to maintain consistency
 * between the `karma_ledger` (append-only audit log) and the denormalized
 * `contributors.karma` balance.
 */

import { eq, sql } from "drizzle-orm";
import { contributors, karmaLedger } from "@/server/db/schema";
import { activityId } from "@/lib/utils";

import type { KarmaLedgerEntry } from "@/server/db/schema";

type KarmaEventType = KarmaLedgerEntry["eventType"];

interface RecordKarmaInput {
  contributorId: string;
  delta: number;
  eventType: KarmaEventType;
  description: string;
  submissionId?: string | null;
  bountyId?: string | null;
  topicId?: string | null;
  collectionId?: string | null;
}

/**
 * Atomically record a karma change: insert ledger entry + update contributor balance.
 * Returns the new balance.
 */
export async function recordKarma(
  db: any,
  input: RecordKarmaInput,
): Promise<number> {
  return db.transaction(async (tx: any) => {
    // 1. Update the contributor's karma balance and get the new value
    const [updated] = await tx
      .update(contributors)
      .set({
        karma: sql`GREATEST(0, ${contributors.karma} + ${input.delta})`,
      })
      .where(eq(contributors.id, input.contributorId))
      .returning({ karma: contributors.karma });

    const newBalance = updated?.karma ?? 0;

    // 2. Insert ledger entry with the new balance
    await tx.insert(karmaLedger).values({
      id: activityId("karma", input.contributorId),
      contributorId: input.contributorId,
      eventType: input.eventType,
      delta: input.delta,
      balance: newBalance,
      description: input.description,
      submissionId: input.submissionId ?? null,
      bountyId: input.bountyId ?? null,
      topicId: input.topicId ?? null,
      collectionId: input.collectionId ?? null,
    });

    return newBalance;
  });
}
