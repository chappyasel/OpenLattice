import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { contributors } from "./contributors";
import { collections } from "./collections";

export const contributorReputation = pgTable(
  "contributor_reputation",
  {
    id: text("id").primaryKey(),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    // Scoped to collections instead of topics for domain-level reputation
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "cascade",
    }),
    score: integer("score").notNull().default(100),
    totalContributions: integer("total_contributions").notNull().default(0),
    acceptedContributions: integer("accepted_contributions")
      .notNull()
      .default(0),
    rejectedContributions: integer("rejected_contributions")
      .notNull()
      .default(0),
    lastCalculatedAt: timestamp("last_calculated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    contributorIndex: index("idx_reputation_contributor").on(
      table.contributorId,
    ),
    collectionIndex: index("idx_reputation_collection").on(table.collectionId),
    uniqueReputation: uniqueIndex("idx_reputation_unique").on(
      table.contributorId,
      table.collectionId,
    ),
  }),
);

export const contributorReputationRelations = relations(
  contributorReputation,
  ({ one }) => ({
    contributor: one(contributors, {
      fields: [contributorReputation.contributorId],
      references: [contributors.id],
    }),
    collection: one(collections, {
      fields: [contributorReputation.collectionId],
      references: [collections.id],
    }),
  }),
);

export type ContributorReputation =
  typeof contributorReputation.$inferSelect;
