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

import { topics } from "./topics";
import { contributors } from "./contributors";
import { submissions } from "./submissions";
import { bounties } from "./bounties";

export const claimTypeEnum = pgEnum("claim_type", [
  "insight",
  "recommendation",
  "config",
  "benchmark",
  "warning",
  "resource_note",
]);

export const claimStatusEnum = pgEnum("claim_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
  "superseded",
]);

export interface EnvironmentContext {
  language?: string;
  framework?: string;
  os?: string;
  toolVersion?: string;
  platform?: string;
  tool?: string;
  [key: string]: unknown;
}

export const claims = pgTable(
  "claims",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    type: claimTypeEnum("type").notNull(),
    status: claimStatusEnum("status").notNull().default("pending"),
    body: text("body").notNull(),
    sourceUrl: text("source_url"),
    sourceTitle: text("source_title"),
    environmentContext: jsonb("environment_context").$type<EnvironmentContext>(),
    confidence: integer("confidence").notNull().default(80),
    validAt: timestamp("valid_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at"),
    lastEndorsedAt: timestamp("last_endorsed_at").defaultNow(),
    endorsementCount: integer("endorsement_count").notNull().default(0),
    disputeCount: integer("dispute_count").notNull().default(0),
    supersededById: text("superseded_by_id").references(
      (): any => claims.id,
      { onDelete: "set null" },
    ),
    submissionId: text("submission_id").references(() => submissions.id, {
      onDelete: "set null",
    }),
    bountyId: text("bounty_id").references(() => bounties.id, {
      onDelete: "set null",
    }),
    karmaAwarded: integer("karma_awarded").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    topicIndex: index("idx_claims_topic").on(table.topicId),
    topicStatusIndex: index("idx_claims_topic_status").on(
      table.topicId,
      table.status,
    ),
    contributorIndex: index("idx_claims_contributor").on(table.contributorId),
    statusCreatedIndex: index("idx_claims_status_created").on(
      table.status,
      table.createdAt,
    ),
    confidenceIndex: index("idx_claims_confidence").on(
      table.topicId,
      table.confidence,
    ),
    expiresIndex: index("idx_claims_expires").on(table.expiresAt),
  }),
);

export const claimsRelations = relations(claims, ({ one, many }) => ({
  topic: one(topics, {
    fields: [claims.topicId],
    references: [topics.id],
  }),
  contributor: one(contributors, {
    fields: [claims.contributorId],
    references: [contributors.id],
  }),
  submission: one(submissions, {
    fields: [claims.submissionId],
    references: [submissions.id],
  }),
  bounty: one(bounties, {
    fields: [claims.bountyId],
    references: [bounties.id],
  }),
  supersededBy: one(claims, {
    fields: [claims.supersededById],
    references: [claims.id],
    relationName: "claimSupersedes",
  }),
  verifications: many(claimVerifications),
}));

// Claim verifications — lightweight endorsement/dispute
export const claimVerdictEnum = pgEnum("claim_verdict", [
  "endorse",
  "dispute",
  "abstain",
]);

export const claimVerifications = pgTable(
  "claim_verifications",
  {
    id: text("id").primaryKey(),
    claimId: text("claim_id")
      .notNull()
      .references(() => claims.id, { onDelete: "cascade" }),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    verdict: claimVerdictEnum("verdict").notNull(),
    reasoning: text("reasoning").notNull(),
    karmaAwarded: integer("karma_awarded").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    claimIndex: index("idx_claim_verifications_claim").on(table.claimId),
    uniqueVerification: index("idx_claim_verifications_unique").on(
      table.claimId,
      table.contributorId,
    ),
  }),
);

export const claimVerificationsRelations = relations(
  claimVerifications,
  ({ one }) => ({
    claim: one(claims, {
      fields: [claimVerifications.claimId],
      references: [claims.id],
    }),
    contributor: one(contributors, {
      fields: [claimVerifications.contributorId],
      references: [contributors.id],
    }),
  }),
);

export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;
export type ClaimVerification = typeof claimVerifications.$inferSelect;
export type NewClaimVerification = typeof claimVerifications.$inferInsert;
