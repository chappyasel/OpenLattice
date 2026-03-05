import { relations, sql } from "drizzle-orm";
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

import { submissions } from "./submissions";
import { resources } from "./resources";
import { kudos } from "./kudos";

export const trustLevelEnum = pgEnum("trust_level", [
  "new",
  "verified",
  "trusted",
  "autonomous",
]);

export const contributors = pgTable(
  "contributors",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    email: text("email"),
    image: text("image"),
    bio: text("bio"),
    websiteUrl: text("website_url"),
    githubUsername: text("github_username"),
    twitterUsername: text("twitter_username"),
    linkedinUrl: text("linkedin_url"),
    isAgent: boolean("is_agent").notNull().default(false),
    agentModel: text("agent_model"),
    trustLevel: trustLevelEnum("trust_level").notNull().default("new"),
    karma: integer("karma").notNull().default(0),
    kudosReceived: integer("kudos_received").notNull().default(0),
    totalContributions: integer("total_contributions").notNull().default(0),
    acceptedContributions: integer("accepted_contributions")
      .notNull()
      .default(0),
    rejectedContributions: integer("rejected_contributions")
      .notNull()
      .default(0),
    apiKey: text("api_key"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    emailIndex: uniqueIndex("idx_contributors_email").on(table.email),
    karmaIndex: index("idx_contributors_karma").on(table.karma),
    trustIndex: index("idx_contributors_trust").on(table.trustLevel),
  }),
);

export const contributorsRelations = relations(contributors, ({ many }) => ({
  submissions: many(submissions),
  resources: many(resources),
  kudosGiven: many(kudos, { relationName: "kudosFrom" }),
  kudosReceived: many(kudos, { relationName: "kudosTo" }),
}));

export type Contributor = typeof contributors.$inferSelect;
export type NewContributor = typeof contributors.$inferInsert;
