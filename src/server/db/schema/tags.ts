import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { topics } from "./topics";
import { resources } from "./resources";

export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    iconHue: integer("icon_hue").notNull(),
    icon: text("icon").notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    nameIndex: uniqueIndex("idx_tags_name_lower").on(
      sql`LOWER(${table.name})`,
    ),
  }),
);

export const topicTags = pgTable(
  "topic_tags",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    topicIndex: index("idx_topic_tags_topic").on(table.topicId),
    tagIndex: index("idx_topic_tags_tag").on(table.tagId),
    uniqueTopicTag: uniqueIndex("idx_topic_tags_unique").on(
      table.topicId,
      table.tagId,
    ),
  }),
);

export const resourceTags = pgTable(
  "resource_tags",
  {
    id: text("id").primaryKey(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    resourceIndex: index("idx_resource_tags_resource").on(table.resourceId),
    tagIndex: index("idx_resource_tags_tag").on(table.tagId),
    uniqueResourceTag: uniqueIndex("idx_resource_tags_unique").on(
      table.resourceId,
      table.tagId,
    ),
  }),
);

export const tagsRelations = relations(tags, ({ many }) => ({
  topicTags: many(topicTags),
  resourceTags: many(resourceTags),
}));

export const topicTagsRelations = relations(topicTags, ({ one }) => ({
  topic: one(topics, {
    fields: [topicTags.topicId],
    references: [topics.id],
  }),
  tag: one(tags, {
    fields: [topicTags.tagId],
    references: [tags.id],
  }),
}));

export const resourceTagsRelations = relations(resourceTags, ({ one }) => ({
  resource: one(resources, {
    fields: [resourceTags.resourceId],
    references: [resources.id],
  }),
  tag: one(tags, {
    fields: [resourceTags.tagId],
    references: [tags.id],
  }),
}));

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
