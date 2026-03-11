import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { topics } from "./topics";
import { bases } from "./bases";
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
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    type: bountyTypeEnum("type").notNull(),
    status: bountyStatusEnum("status").notNull().default("open"),
    topicId: text("topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    baseId: text("base_id").references(() => bases.id, {
      onDelete: "set null",
    }),
    karmaReward: integer("karma_reward").notNull().default(10),
    icon: text("icon"),
    iconHue: integer("icon_hue"),
    claimedById: text("claimed_by_id").references(() => contributors.id, {
      onDelete: "set null",
    }),
    claimedAt: timestamp("claimed_at"),
    claimExpiresAt: timestamp("claim_expires_at"),
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
    baseIndex: index("idx_bounties_base").on(table.baseId),
  }),
);

export const bountiesRelations = relations(bounties, ({ one, many }) => ({
  topic: one(topics, {
    fields: [bounties.topicId],
    references: [topics.id],
  }),
  base: one(bases, {
    fields: [bounties.baseId],
    references: [bases.id],
  }),
  claimedBy: one(contributors, {
    fields: [bounties.claimedById],
    references: [contributors.id],
    relationName: "bountyClaimedBy",
  }),
  completedBy: one(contributors, {
    fields: [bounties.completedById],
    references: [contributors.id],
    relationName: "bountyCompletedBy",
  }),
  submissions: many(submissions),
}));

export type Bounty = typeof bounties.$inferSelect;
export type NewBounty = typeof bounties.$inferInsert;
