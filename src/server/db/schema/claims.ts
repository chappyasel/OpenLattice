import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { topics } from "./topics";
import { contributors } from "./contributors";
import { claimPositions } from "./claimPositions";

export const claimStatusEnum = pgEnum("claim_status", [
  "open",
  "contested",
  "resolved_true",
  "resolved_false",
  "expired",
]);

export const claims = pgTable(
  "claims",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    topicId: text("topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    status: claimStatusEnum("status").notNull().default("open"),
    confidence: real("confidence").default(0.5),
    stakeAmount: integer("stake_amount").notNull().default(10),
    createdById: text("created_by_id").references(() => contributors.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at"),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    slugIndex: uniqueIndex("idx_claims_slug").on(table.slug),
    statusIndex: index("idx_claims_status").on(table.status),
    topicIndex: index("idx_claims_topic").on(table.topicId),
  }),
);

export const claimsRelations = relations(claims, ({ one, many }) => ({
  topic: one(topics, {
    fields: [claims.topicId],
    references: [topics.id],
  }),
  createdBy: one(contributors, {
    fields: [claims.createdById],
    references: [contributors.id],
  }),
  positions: many(claimPositions),
}));

export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;
