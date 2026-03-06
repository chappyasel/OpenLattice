import { relations } from "drizzle-orm";
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
import { contributors } from "./contributors";

export const topicResources = pgTable(
  "topic_resources",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    relevanceScore: integer("relevance_score").notNull().default(50),
    addedById: text("added_by_id").references(() => contributors.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    topicIndex: index("idx_topic_resources_topic").on(table.topicId),
    resourceIndex: index("idx_topic_resources_resource").on(table.resourceId),
    uniqueTopicResource: uniqueIndex("idx_topic_resources_unique").on(
      table.topicId,
      table.resourceId,
    ),
  }),
);

export const topicResourcesRelations = relations(
  topicResources,
  ({ one }) => ({
    topic: one(topics, {
      fields: [topicResources.topicId],
      references: [topics.id],
    }),
    resource: one(resources, {
      fields: [topicResources.resourceId],
      references: [resources.id],
    }),
    addedBy: one(contributors, {
      fields: [topicResources.addedById],
      references: [contributors.id],
    }),
  }),
);
