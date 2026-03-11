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
import { bases } from "./bases";

export const contributorReputation = pgTable(
  "contributor_reputation",
  {
    id: text("id").primaryKey(),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    // Scoped to bases instead of topics for domain-level reputation
    baseId: text("base_id").references(() => bases.id, {
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
    baseIndex: index("idx_reputation_base").on(table.baseId),
    uniqueReputation: uniqueIndex("idx_reputation_unique").on(
      table.contributorId,
      table.baseId,
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
    base: one(bases, {
      fields: [contributorReputation.baseId],
      references: [bases.id],
    }),
  }),
);

export type ContributorReputation =
  typeof contributorReputation.$inferSelect;
