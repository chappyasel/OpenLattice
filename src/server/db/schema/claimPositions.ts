import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { claims } from "./claims";
import { contributors } from "./contributors";
import { resources } from "./resources";

export const positionTypeEnum = pgEnum("position_type", [
  "support",
  "oppose",
]);

export const positionOutcomeEnum = pgEnum("position_outcome", [
  "pending",
  "won",
  "lost",
]);

export const claimPositions = pgTable(
  "claim_positions",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    claimId: text("claim_id")
      .notNull()
      .references(() => claims.id, { onDelete: "cascade" }),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    position: positionTypeEnum("position").notNull(),
    stakeAmount: integer("stake_amount").notNull().default(10),
    evidence: text("evidence"),
    resourceId: text("resource_id").references(() => resources.id, {
      onDelete: "set null",
    }),
    outcome: positionOutcomeEnum("outcome").default("pending"),
    reputationDelta: integer("reputation_delta"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    claimIndex: index("idx_positions_claim").on(table.claimId),
    contributorIndex: index("idx_positions_contributor").on(
      table.contributorId,
    ),
    uniquePosition: uniqueIndex("idx_positions_unique").on(
      table.claimId,
      table.contributorId,
    ),
  }),
);

export const claimPositionsRelations = relations(
  claimPositions,
  ({ one }) => ({
    claim: one(claims, {
      fields: [claimPositions.claimId],
      references: [claims.id],
    }),
    contributor: one(contributors, {
      fields: [claimPositions.contributorId],
      references: [contributors.id],
    }),
    resource: one(resources, {
      fields: [claimPositions.resourceId],
      references: [resources.id],
    }),
  }),
);

export type ClaimPosition = typeof claimPositions.$inferSelect;
export type NewClaimPosition = typeof claimPositions.$inferInsert;
