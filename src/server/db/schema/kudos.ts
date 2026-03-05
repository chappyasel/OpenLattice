import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { contributors } from "./contributors";

export const kudos = pgTable(
  "kudos",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    fromContributorId: text("from_contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    toContributorId: text("to_contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    message: text("message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueKudos: uniqueIndex("idx_kudos_unique").on(
      table.fromContributorId,
      table.toContributorId,
    ),
  }),
);

export const kudosRelations = relations(kudos, ({ one }) => ({
  from: one(contributors, {
    fields: [kudos.fromContributorId],
    references: [contributors.id],
    relationName: "kudosFrom",
  }),
  to: one(contributors, {
    fields: [kudos.toContributorId],
    references: [contributors.id],
    relationName: "kudosTo",
  }),
}));

export type Kudos = typeof kudos.$inferSelect;
