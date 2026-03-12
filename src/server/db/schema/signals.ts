import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { contributors } from "./contributors";
import { bounties } from "./bounties";

export const signalTypeEnum = pgEnum("signal_type", [
  "outdated",
  "inaccurate",
  "dead_link",
  "needs_depth",
  "duplicate",
  "misplaced",
]);

export const signalTargetTypeEnum = pgEnum("signal_target_type", [
  "topic",
  "resource",
  "claim",
]);

export const signalStatusEnum = pgEnum("signal_status", [
  "open",
  "resolved",
  "dismissed",
]);

/** Valid signal type + target type combinations */
export const VALID_SIGNAL_COMBOS: Record<string, string[]> = {
  dead_link: ["resource"],
  misplaced: ["topic"],
  duplicate: ["topic"],
  outdated: ["topic", "resource", "claim"],
  inaccurate: ["topic", "resource", "claim"],
  needs_depth: ["topic", "resource", "claim"],
};

export const signals = pgTable(
  "signals",
  {
    id: text("id").primaryKey(),
    targetType: signalTargetTypeEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    signalType: signalTypeEnum("signal_type").notNull(),
    status: signalStatusEnum("status").notNull().default("open"),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    evidence: text("evidence"),
    suggestedFix: text("suggested_fix"),
    bountyId: text("bounty_id").references(() => bounties.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueSignal: uniqueIndex("idx_signals_unique").on(
      table.targetType,
      table.targetId,
      table.signalType,
      table.contributorId,
    ),
    targetIndex: index("idx_signals_target").on(
      table.targetType,
      table.targetId,
    ),
    statusIndex: index("idx_signals_status").on(table.status),
    contributorIndex: index("idx_signals_contributor").on(table.contributorId),
  }),
);

export const signalsRelations = relations(signals, ({ one }) => ({
  contributor: one(contributors, {
    fields: [signals.contributorId],
    references: [contributors.id],
  }),
  bounty: one(bounties, {
    fields: [signals.bountyId],
    references: [bounties.id],
  }),
}));

export type Signal = typeof signals.$inferSelect;
export type NewSignal = typeof signals.$inferInsert;
