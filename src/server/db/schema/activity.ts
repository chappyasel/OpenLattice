import { relations, sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { contributors } from "./contributors";
import { topics } from "./topics";
import { resources } from "./resources";
import { claims } from "./claims";
import { bounties } from "./bounties";
import { submissions } from "./submissions";

export const activityTypeEnum = pgEnum("activity_type", [
  "topic_created",
  "resource_submitted",
  "edge_created",
  "claim_made",
  "claim_challenged",
  "claim_resolved",
  "bounty_completed",
  "submission_reviewed",
  "reputation_changed",
]);

export const activity = pgTable(
  "activity",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    type: activityTypeEnum("type").notNull(),
    contributorId: text("contributor_id").references(() => contributors.id, {
      onDelete: "set null",
    }),
    topicId: text("topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    resourceId: text("resource_id").references(() => resources.id, {
      onDelete: "set null",
    }),
    claimId: text("claim_id").references(() => claims.id, {
      onDelete: "set null",
    }),
    bountyId: text("bounty_id").references(() => bounties.id, {
      onDelete: "set null",
    }),
    submissionId: text("submission_id").references(() => submissions.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    typeIndex: index("idx_activity_type").on(table.type),
    contributorIndex: index("idx_activity_contributor").on(
      table.contributorId,
    ),
    createdAtIndex: index("idx_activity_created_at").on(table.createdAt),
  }),
);

export const activityRelations = relations(activity, ({ one }) => ({
  contributor: one(contributors, {
    fields: [activity.contributorId],
    references: [contributors.id],
  }),
  topic: one(topics, {
    fields: [activity.topicId],
    references: [topics.id],
  }),
  resource: one(resources, {
    fields: [activity.resourceId],
    references: [resources.id],
  }),
  claim: one(claims, {
    fields: [activity.claimId],
    references: [claims.id],
  }),
  bounty: one(bounties, {
    fields: [activity.bountyId],
    references: [bounties.id],
  }),
  submission: one(submissions, {
    fields: [activity.submissionId],
    references: [submissions.id],
  }),
}));

export type Activity = typeof activity.$inferSelect;
export type NewActivity = typeof activity.$inferInsert;
