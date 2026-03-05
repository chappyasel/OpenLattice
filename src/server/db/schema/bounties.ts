import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { topics } from "./topics";
import { contributors } from "./contributors";
import { submissions } from "./submissions";

export const bountyTypeEnum = pgEnum("bounty_type", [
  "topic",
  "resource",
  "edit",
]);

export const bountyStatusEnum = pgEnum("bounty_status", [
  "open",
  "claimed",
  "completed",
  "cancelled",
]);

export const bounties = pgTable(
  "bounties",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    description: text("description").notNull(),
    type: bountyTypeEnum("type").notNull(),
    status: bountyStatusEnum("status").notNull().default("open"),
    topicId: text("topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    karmaReward: integer("karma_reward").notNull().default(10),
    completedById: text("completed_by_id").references(() => contributors.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    statusIndex: index("idx_bounties_status").on(table.status),
    topicIndex: index("idx_bounties_topic").on(table.topicId),
  }),
);

export const bountiesRelations = relations(bounties, ({ one, many }) => ({
  topic: one(topics, {
    fields: [bounties.topicId],
    references: [topics.id],
  }),
  completedBy: one(contributors, {
    fields: [bounties.completedById],
    references: [contributors.id],
  }),
  submissions: many(submissions),
}));

export type Bounty = typeof bounties.$inferSelect;
export type NewBounty = typeof bounties.$inferInsert;
