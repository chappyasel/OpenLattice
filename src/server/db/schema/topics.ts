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
import { edges } from "./edges";
import { topicResources } from "./topicResources";
import { topicTags } from "./tags";

export const difficultyEnum = pgEnum("difficulty", [
  "beginner",
  "intermediate",
  "advanced",
]);

export const topicStatusEnum = pgEnum("topic_status", [
  "draft",
  "published",
  "archived",
]);

export const topics = pgTable(
  "topics",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    summary: text("summary"),
    difficulty: difficultyEnum("difficulty").notNull().default("beginner"),
    status: topicStatusEnum("status").notNull().default("draft"),
    parentTopicId: text("parent_topic_id").references((): any => topics.id, {
      onDelete: "set null",
    }),
    icon: text("icon"),
    iconHue: integer("icon_hue"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdById: text("created_by_id").references(() => contributors.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    statusIndex: index("idx_topics_status").on(table.status),
    parentIndex: index("idx_topics_parent").on(table.parentTopicId),
  }),
);

export const topicsRelations = relations(topics, ({ one, many }) => ({
  parentTopic: one(topics, {
    fields: [topics.parentTopicId],
    references: [topics.id],
    relationName: "topicParent",
  }),
  createdBy: one(contributors, {
    fields: [topics.createdById],
    references: [contributors.id],
  }),
  childTopics: many(topics, { relationName: "topicParent" }),
  sourceEdges: many(edges, { relationName: "edgeSource" }),
  targetEdges: many(edges, { relationName: "edgeTarget" }),
  topicResources: many(topicResources),
  topicTags: many(topicTags),
}));

export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
