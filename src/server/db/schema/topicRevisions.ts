import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { difficultyEnum } from "./enums";
import { topics } from "./topics";
import { contributors } from "./contributors";
import { submissions } from "./submissions";

export const topicRevisions = pgTable(
  "topic_revisions",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    summary: text("summary"),
    difficulty: difficultyEnum("difficulty"),
    changeSummary: text("change_summary"),
    contributorId: text("contributor_id").references(() => contributors.id, {
      onDelete: "set null",
    }),
    submissionId: text("submission_id").references(() => submissions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    topicIndex: index("idx_topic_revisions_topic").on(table.topicId),
    revisionIndex: index("idx_topic_revisions_number").on(
      table.topicId,
      table.revisionNumber,
    ),
  }),
);

export const topicRevisionsRelations = relations(
  topicRevisions,
  ({ one }) => ({
    topic: one(topics, {
      fields: [topicRevisions.topicId],
      references: [topics.id],
    }),
    contributor: one(contributors, {
      fields: [topicRevisions.contributorId],
      references: [contributors.id],
    }),
    submission: one(submissions, {
      fields: [topicRevisions.submissionId],
      references: [submissions.id],
    }),
  }),
);

export type TopicRevision = typeof topicRevisions.$inferSelect;
export type NewTopicRevision = typeof topicRevisions.$inferInsert;
