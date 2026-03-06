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
import { topicResources } from "./topicResources";
import { resourceTags } from "./tags";

export const resourceTypeEnum = pgEnum("resource_type", [
  "article",
  "paper",
  "book",
  "course",
  "video",
  "podcast",
  "dataset",
  "tool",
  "model",
  "library",
  "repository",
  "prompt",
  "workflow",
  "benchmark",
  "report",
  "discussion",
  "community",
  "event",
  "organization",
  "person",
  "concept",
  "comparison",
  "curated_list",
]);

export const resourceVisibilityEnum = pgEnum("resource_visibility", [
  "pending_review",
  "public",
  "hidden",
  "archived",
]);

export const resources = pgTable(
  "resources",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    url: text("url"),
    type: resourceTypeEnum("type").notNull(),
    summary: text("summary").notNull().default(""),
    content: text("content"),
    imageUrls: jsonb("image_urls").$type<string[]>().default([]),
    score: integer("score").notNull().default(0),
    visibility: resourceVisibilityEnum("visibility")
      .notNull()
      .default("pending_review"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    submittedById: text("submitted_by_id").references(() => contributors.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    typeIndex: index("idx_resources_type").on(table.type),
    visibilityIndex: index("idx_resources_visibility").on(table.visibility),
    scoreIndex: index("idx_resources_score").on(table.score),
  }),
);

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  submittedBy: one(contributors, {
    fields: [resources.submittedById],
    references: [contributors.id],
  }),
  topicResources: many(topicResources),
  resourceTags: many(resourceTags),
}));

export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
