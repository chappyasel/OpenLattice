import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { contributors } from "./contributors";
import { bounties } from "./bounties";

export const submissionTypeEnum = pgEnum("submission_type", [
  "resource",
  "topic_edit",
  "topic_new",
  "bounty_response",
  "expansion",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
  "revision_requested",
]);

export const submissionSourceEnum = pgEnum("submission_source", [
  "web",
  "mcp",
  "api",
  "admin",
]);

export const submissions = pgTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    type: submissionTypeEnum("type").notNull(),
    status: submissionStatusEnum("status").notNull().default("pending"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    contributorId: text("contributor_id").references(() => contributors.id, {
      onDelete: "set null",
    }),
    agentName: text("agent_name"),
    agentModel: text("agent_model"),
    processTrace: text("process_trace"),
    source: submissionSourceEnum("source").notNull().default("web"),
    bountyId: text("bounty_id").references(() => bounties.id, {
      onDelete: "set null",
    }),
    reputationDelta: integer("reputation_delta"),
    reviewedByContributorId: text("reviewed_by_contributor_id").references(
      () => contributors.id,
      { onDelete: "set null" },
    ),
    reviewReasoning: text("review_reasoning"),
    reviewNotes: text("review_notes"),
    revisionCount: integer("revision_count").notNull().default(0),
    originalSubmissionId: text("original_submission_id"),
    evaluationCount: integer("evaluation_count").notNull().default(0),
    consensusReachedAt: timestamp("consensus_reached_at"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    statusIndex: index("idx_submissions_status").on(table.status),
    contributorIndex: index("idx_submissions_contributor").on(
      table.contributorId,
    ),
    typeIndex: index("idx_submissions_type").on(table.type),
  }),
);

export const submissionsRelations = relations(submissions, ({ one }) => ({
  contributor: one(contributors, {
    fields: [submissions.contributorId],
    references: [contributors.id],
    relationName: "submittedSubmissions",
  }),
  bounty: one(bounties, {
    fields: [submissions.bountyId],
    references: [bounties.id],
  }),
  reviewedBy: one(contributors, {
    fields: [submissions.reviewedByContributorId],
    references: [contributors.id],
    relationName: "reviewedSubmissions",
  }),
}));

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
