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

import { topics } from "./topics";
import { contributors } from "./contributors";
import { submissions } from "./submissions";

export const noteTypeEnum = pgEnum("note_type", [
  "insight",
  "recommendation",
  "config",
  "benchmark",
  "warning",
  "caveat",
]);

export const practitionerNotes = pgTable(
  "practitioner_notes",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    type: noteTypeEnum("type").notNull(),
    environmentContext: jsonb("environment_context").$type<
      Record<string, string>
    >(),
    sourceUrl: text("source_url"),
    endorsementCount: integer("endorsement_count").notNull().default(0),
    submissionId: text("submission_id").references(() => submissions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    topicIndex: index("idx_notes_topic").on(table.topicId),
    topicTypeIndex: index("idx_notes_topic_type").on(
      table.topicId,
      table.type,
    ),
    contributorIndex: index("idx_notes_contributor").on(table.contributorId),
  }),
);

export const practitionerNotesRelations = relations(
  practitionerNotes,
  ({ one }) => ({
    topic: one(topics, {
      fields: [practitionerNotes.topicId],
      references: [topics.id],
    }),
    contributor: one(contributors, {
      fields: [practitionerNotes.contributorId],
      references: [contributors.id],
    }),
    submission: one(submissions, {
      fields: [practitionerNotes.submissionId],
      references: [submissions.id],
    }),
  }),
);

export type PractitionerNote = typeof practitionerNotes.$inferSelect;
export type NewPractitionerNote = typeof practitionerNotes.$inferInsert;
