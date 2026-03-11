import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { topics } from "./topics";
import { bounties } from "./bounties";
import { activity } from "./activity";
import { contributorReputation } from "./contributorReputation";
import { karmaLedger } from "./karmaLedger";

export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    iconHue: integer("icon_hue"),
    slug: text("slug").notNull(),
    isPublic: boolean("is_public").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    slugIndex: uniqueIndex("idx_collections_slug").on(table.slug),
  }),
);

export const collectionsRelations = relations(collections, ({ many }) => ({
  topics: many(topics),
  bounties: many(bounties),
  activity: many(activity),
  reputation: many(contributorReputation),
  karmaLedger: many(karmaLedger),
}));

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
