import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { contributors } from "./contributors";
import { collections } from "./collections";

export const karmaEventTypeEnum = pgEnum("karma_event_type", [
  "submission_approved",
  "submission_rejected",
  "bounty_completed",
  "evaluation_reward",
  "kudos_received",
  "signup_bonus",
  "admin_adjustment",
  "query_cost",
  "wallet_deposit",
  "wallet_withdrawal",
]);

export const karmaLedger = pgTable(
  "karma_ledger",
  {
    id: text("id").primaryKey(),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    eventType: karmaEventTypeEnum("event_type").notNull(),
    delta: integer("delta").notNull(),
    balance: integer("balance").notNull(),
    description: text("description"),
    submissionId: text("submission_id"),
    bountyId: text("bounty_id"),
    topicId: text("topic_id"),
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    contributorTimeIndex: index("idx_karma_contributor_time").on(
      table.contributorId,
      table.createdAt,
    ),
    collectionTimeIndex: index("idx_karma_collection_time").on(
      table.collectionId,
      table.createdAt,
    ),
    eventTypeIndex: index("idx_karma_event_type").on(table.eventType),
  }),
);

export const karmaLedgerRelations = relations(karmaLedger, ({ one }) => ({
  contributor: one(contributors, {
    fields: [karmaLedger.contributorId],
    references: [contributors.id],
  }),
  collection: one(collections, {
    fields: [karmaLedger.collectionId],
    references: [collections.id],
  }),
}));

export type KarmaLedgerEntry = typeof karmaLedger.$inferSelect;
export type NewKarmaLedgerEntry = typeof karmaLedger.$inferInsert;
