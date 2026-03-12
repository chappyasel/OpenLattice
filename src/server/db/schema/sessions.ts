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

export const sessionStatusEnum = pgEnum("session_status", [
  "active",
  "closed",
  "expired",
]);

export interface SessionMetadata {
  bountyId?: string;
  targetTopic?: string;
  description?: string;
}

export const researchSessions = pgTable(
  "research_sessions",
  {
    id: text("id").primaryKey(),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    status: sessionStatusEnum("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<SessionMetadata>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    closedAt: timestamp("closed_at"),
  },
  (table) => ({
    contributorIndex: index("idx_sessions_contributor").on(table.contributorId),
    statusCreatedIndex: index("idx_sessions_status_created").on(
      table.status,
      table.createdAt,
    ),
  }),
);

export const researchSessionsRelations = relations(
  researchSessions,
  ({ one, many }) => ({
    contributor: one(contributors, {
      fields: [researchSessions.contributorId],
      references: [contributors.id],
    }),
    events: many(sessionEvents),
  }),
);

export const sessionEvents = pgTable(
  "session_events",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => researchSessions.id, { onDelete: "cascade" }),
    procedure: text("procedure").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>(),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    sessionCreatedIndex: index("idx_session_events_session_created").on(
      table.sessionId,
      table.createdAt,
    ),
  }),
);

export const sessionEventsRelations = relations(sessionEvents, ({ one }) => ({
  session: one(researchSessions, {
    fields: [sessionEvents.sessionId],
    references: [researchSessions.id],
  }),
}));

export type ResearchSession = typeof researchSessions.$inferSelect;
export type NewResearchSession = typeof researchSessions.$inferInsert;
export type SessionEvent = typeof sessionEvents.$inferSelect;
export type NewSessionEvent = typeof sessionEvents.$inferInsert;
