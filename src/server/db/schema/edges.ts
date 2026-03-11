import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { topics } from "./topics";
import { contributors } from "./contributors";

export const edgeRelationTypeEnum = pgEnum("edge_relation_type", [
  "related",
  "prerequisite",
  "subtopic",
  "see_also",
]);

export const edges = pgTable(
  "edges",
  {
    id: text("id").primaryKey(),
    sourceTopicId: text("source_topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    targetTopicId: text("target_topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    relationType: edgeRelationTypeEnum("relation_type")
      .notNull()
      .default("related"),
    weight: integer("weight").notNull().default(1),
    isCrossCollection: boolean("is_cross_collection")
      .notNull()
      .default(false),
    createdById: text("created_by_id").references(() => contributors.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    sourceIndex: index("idx_edges_source").on(table.sourceTopicId),
    targetIndex: index("idx_edges_target").on(table.targetTopicId),
    uniqueEdge: uniqueIndex("idx_edges_unique").on(
      table.sourceTopicId,
      table.targetTopicId,
    ),
  }),
);

export const edgesRelations = relations(edges, ({ one }) => ({
  sourceTopic: one(topics, {
    fields: [edges.sourceTopicId],
    references: [topics.id],
    relationName: "edgeSource",
  }),
  targetTopic: one(topics, {
    fields: [edges.targetTopicId],
    references: [topics.id],
    relationName: "edgeTarget",
  }),
  createdBy: one(contributors, {
    fields: [edges.createdById],
    references: [contributors.id],
  }),
}));

export type Edge = typeof edges.$inferSelect;
export type NewEdge = typeof edges.$inferInsert;
