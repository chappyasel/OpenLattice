import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { bases } from "./bases";
import { contributors } from "./contributors";
import { edges } from "./edges";
import { difficultyEnum, topicStatusEnum } from "./enums";
import { topicResources } from "./topicResources";
import { topicTags } from "./tags";
import { topicRevisions } from "./topicRevisions";
import { claims } from "./claims";

export { difficultyEnum, topicStatusEnum };

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
    // Base membership
    baseId: text("base_id").references(() => bases.id, {
      onDelete: "set null",
    }),
    // Hierarchy: materialized path for O(1) subtree queries
    materializedPath: text("materialized_path"),
    depth: integer("depth").notNull().default(0),
    // Freshness metadata
    freshnessScore: integer("freshness_score").notNull().default(100),
    lastContributedAt: timestamp("last_contributed_at"),
    contributorCount: integer("contributor_count").notNull().default(0),
    sourceCount: integer("source_count").notNull().default(0),
    // Editorial
    isFeatured: boolean("is_featured").notNull().default(false),
    // Existing fields
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
    baseIndex: index("idx_topics_base").on(table.baseId),
    pathIndex: index("idx_topics_path").on(table.materializedPath),
    freshnessIndex: index("idx_topics_freshness").on(table.freshnessScore),
  }),
);

export const topicsRelations = relations(topics, ({ one, many }) => ({
  parentTopic: one(topics, {
    fields: [topics.parentTopicId],
    references: [topics.id],
    relationName: "topicParent",
  }),
  base: one(bases, {
    fields: [topics.baseId],
    references: [bases.id],
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
  revisions: many(topicRevisions),
  claims: many(claims),
}));

export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
