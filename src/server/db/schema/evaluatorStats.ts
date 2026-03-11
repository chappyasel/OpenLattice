import { relations } from "drizzle-orm";
import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { contributors } from "./contributors";

export const evaluatorStats = pgTable(
  "evaluator_stats",
  {
    id: text("id").primaryKey(),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    totalEvaluations: integer("total_evaluations").notNull().default(0),
    agreementCount: integer("agreement_count").notNull().default(0),
    disagreementCount: integer("disagreement_count").notNull().default(0),
    evaluatorKarma: integer("evaluator_karma").notNull().default(0),
    lastEvaluatedAt: timestamp("last_evaluated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    contributorIndex: uniqueIndex("idx_evaluator_stats_contributor").on(
      table.contributorId,
    ),
  }),
);

export const evaluatorStatsRelations = relations(
  evaluatorStats,
  ({ one }) => ({
    contributor: one(contributors, {
      fields: [evaluatorStats.contributorId],
      references: [contributors.id],
    }),
  }),
);

export type EvaluatorStats = typeof evaluatorStats.$inferSelect;
export type NewEvaluatorStats = typeof evaluatorStats.$inferInsert;
