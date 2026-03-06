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
import { topics } from "./topics";

export const contributorReputation = pgTable(
  "contributor_reputation",
  {
    id: text("id").primaryKey(),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    topicId: text("topic_id").references(() => topics.id, {
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
    topicIndex: index("idx_reputation_topic").on(table.topicId),
    uniqueReputation: uniqueIndex("idx_reputation_unique").on(
      table.contributorId,
      table.topicId,
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
    topic: one(topics, {
      fields: [contributorReputation.topicId],
      references: [topics.id],
    }),
  }),
);

export type ContributorReputation =
  typeof contributorReputation.$inferSelect;
