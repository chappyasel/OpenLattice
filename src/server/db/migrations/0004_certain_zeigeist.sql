CREATE TYPE "public"."session_status" AS ENUM('active', 'closed', 'expired');--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'topic_reparented';--> statement-breakpoint
CREATE TABLE "bases" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"icon_hue" integer,
	"slug" text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"contributor_id" text NOT NULL,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "session_events" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"procedure" text NOT NULL,
	"input" jsonb,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "collections" CASCADE;--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_collection_id_collections_id_fk";
--> statement-breakpoint
ALTER TABLE "bounties" DROP CONSTRAINT "bounties_collection_id_collections_id_fk";
--> statement-breakpoint
ALTER TABLE "contributor_reputation" DROP CONSTRAINT "contributor_reputation_collection_id_collections_id_fk";
--> statement-breakpoint
ALTER TABLE "topics" DROP CONSTRAINT "topics_collection_id_collections_id_fk";
--> statement-breakpoint
ALTER TABLE "karma_ledger" DROP CONSTRAINT "karma_ledger_collection_id_collections_id_fk";
--> statement-breakpoint
DROP INDEX "idx_activity_collection_time";--> statement-breakpoint
DROP INDEX "idx_bounties_collection";--> statement-breakpoint
DROP INDEX "idx_reputation_collection";--> statement-breakpoint
DROP INDEX "idx_topics_collection";--> statement-breakpoint
DROP INDEX "idx_karma_collection_time";--> statement-breakpoint
DROP INDEX "idx_reputation_unique";--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "base_id" text;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "base_id" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "origin" text DEFAULT 'standalone' NOT NULL;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "groundedness_evidence" jsonb;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "evaluation_score" integer;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "evaluation_reasoning" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "supersedes_claim_id" text;--> statement-breakpoint
ALTER TABLE "contributor_reputation" ADD COLUMN "base_id" text;--> statement-breakpoint
ALTER TABLE "edges" ADD COLUMN "is_cross_base" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "base_id" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "karma_ledger" ADD COLUMN "base_id" text;--> statement-breakpoint
ALTER TABLE "research_sessions" ADD CONSTRAINT "research_sessions_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_research_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."research_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bases_slug" ON "bases" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_sessions_contributor" ON "research_sessions" USING btree ("contributor_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_status_created" ON "research_sessions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_session_events_session_created" ON "session_events" USING btree ("session_id","created_at");--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."bases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."bases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_supersedes_claim_id_claims_id_fk" FOREIGN KEY ("supersedes_claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_reputation" ADD CONSTRAINT "contributor_reputation_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."bases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_session_id_research_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."research_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karma_ledger" ADD CONSTRAINT "karma_ledger_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."bases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_base_time" ON "activity" USING btree ("base_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_bounties_base" ON "bounties" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "idx_reputation_base" ON "contributor_reputation" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "idx_topics_base" ON "topics" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "idx_karma_base_time" ON "karma_ledger" USING btree ("base_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reputation_unique" ON "contributor_reputation" USING btree ("contributor_id","base_id");--> statement-breakpoint
ALTER TABLE "activity" DROP COLUMN "collection_id";--> statement-breakpoint
ALTER TABLE "bounties" DROP COLUMN "collection_id";--> statement-breakpoint
ALTER TABLE "contributor_reputation" DROP COLUMN "collection_id";--> statement-breakpoint
ALTER TABLE "edges" DROP COLUMN "is_cross_collection";--> statement-breakpoint
ALTER TABLE "topics" DROP COLUMN "collection_id";--> statement-breakpoint
ALTER TABLE "karma_ledger" DROP COLUMN "collection_id";