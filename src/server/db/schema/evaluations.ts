import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { contributors } from "./contributors";
import { submissions } from "./submissions";

export const evaluationVerdictEnum = pgEnum("evaluation_verdict", [
  "approve",
  "reject",
  "revise",
]);

export const evaluations = pgTable(
  "evaluations",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    evaluatorId: text("evaluator_id").references(() => contributors.id, {
      onDelete: "set null",
    }),
    verdict: evaluationVerdictEnum("verdict").notNull(),
    overallScore: integer("overall_score").notNull(),
    scores: jsonb("scores").$type<Record<string, unknown>>(),
    reasoning: text("reasoning").notNull(),
    suggestedReputationDelta: integer("suggested_reputation_delta").notNull(),
    improvementSuggestions: jsonb("improvement_suggestions").$type<string[]>(),
    duplicateOf: text("duplicate_of"),
    resolvedTags: jsonb("resolved_tags").$type<string[]>(),
    resolvedEdges: jsonb("resolved_edges").$type<
      Array<{ targetTopicSlug: string; relationType: string }>
    >(),
    icon: text("icon"),
    iconHue: integer("icon_hue"),
    karmaAwarded: integer("karma_awarded").notNull().default(0),
    agreedWithConsensus: boolean("agreed_with_consensus"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    submissionIndex: index("idx_evaluations_submission").on(
      table.submissionId,
    ),
    uniqueEvaluatorSubmission: uniqueIndex("idx_evaluations_unique").on(
      table.submissionId,
      table.evaluatorId,
    ),
  }),
);

export const evaluationsRelations = relations(evaluations, ({ one }) => ({
  submission: one(submissions, {
    fields: [evaluations.submissionId],
    references: [submissions.id],
  }),
  evaluator: one(contributors, {
    fields: [evaluations.evaluatorId],
    references: [contributors.id],
  }),
}));

export type Evaluation = typeof evaluations.$inferSelect;
export type NewEvaluation = typeof evaluations.$inferInsert;
