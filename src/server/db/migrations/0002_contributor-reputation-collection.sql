CREATE TYPE "public"."claim_status" AS ENUM('pending', 'approved', 'rejected', 'expired', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."claim_type" AS ENUM('insight', 'recommendation', 'config', 'benchmark', 'warning', 'resource_note');--> statement-breakpoint
CREATE TYPE "public"."claim_verdict" AS ENUM('endorse', 'dispute', 'abstain');--> statement-breakpoint
CREATE TYPE "public"."karma_event_type" AS ENUM('submission_approved', 'submission_rejected', 'bounty_completed', 'evaluation_reward', 'kudos_received', 'signup_bonus', 'admin_adjustment', 'query_cost', 'wallet_deposit', 'wallet_withdrawal');--> statement-breakpoint
CREATE TYPE "public"."note_type" AS ENUM('insight', 'recommendation', 'config', 'benchmark', 'warning', 'caveat');--> statement-breakpoint
CREATE TABLE "claim_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"claim_id" text NOT NULL,
	"contributor_id" text NOT NULL,
	"verdict" "claim_verdict" NOT NULL,
	"reasoning" text NOT NULL,
	"karma_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"contributor_id" text NOT NULL,
	"type" "claim_type" NOT NULL,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"body" text NOT NULL,
	"source_url" text,
	"source_title" text,
	"environment_context" jsonb,
	"confidence" integer DEFAULT 80 NOT NULL,
	"valid_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"last_endorsed_at" timestamp DEFAULT now(),
	"endorsement_count" integer DEFAULT 0 NOT NULL,
	"dispute_count" integer DEFAULT 0 NOT NULL,
	"superseded_by_id" text,
	"submission_id" text,
	"bounty_id" text,
	"karma_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
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
CREATE TABLE "karma_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"contributor_id" text NOT NULL,
	"event_type" "karma_event_type" NOT NULL,
	"delta" integer NOT NULL,
	"balance" integer NOT NULL,
	"description" text,
	"submission_id" text,
	"bounty_id" text,
	"topic_id" text,
	"collection_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practitioner_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"contributor_id" text NOT NULL,
	"body" text NOT NULL,
	"type" "note_type" NOT NULL,
	"environment_context" jsonb,
	"source_url" text,
	"endorsement_count" integer DEFAULT 0 NOT NULL,
	"submission_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contributor_reputation" DROP CONSTRAINT "contributor_reputation_topic_id_topics_id_fk";
--> statement-breakpoint
DROP INDEX "idx_reputation_topic";--> statement-breakpoint
DROP INDEX "idx_reputation_unique";--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "collection_id" text;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "collection_id" text;--> statement-breakpoint
ALTER TABLE "contributor_reputation" ADD COLUMN "collection_id" text;--> statement-breakpoint
ALTER TABLE "edges" ADD COLUMN "is_cross_collection" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "edges" ADD COLUMN "created_by_id" text;--> statement-breakpoint
ALTER TABLE "edges" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "collection_id" text;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "materialized_path" text;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "depth" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "freshness_score" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "last_contributed_at" timestamp;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "contributor_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "source_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "claim_verifications" ADD CONSTRAINT "claim_verifications_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_verifications" ADD CONSTRAINT "claim_verifications_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_superseded_by_id_claims_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karma_ledger" ADD CONSTRAINT "karma_ledger_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "karma_ledger" ADD CONSTRAINT "karma_ledger_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioner_notes" ADD CONSTRAINT "practitioner_notes_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioner_notes" ADD CONSTRAINT "practitioner_notes_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioner_notes" ADD CONSTRAINT "practitioner_notes_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_claim_verifications_claim" ON "claim_verifications" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_claim_verifications_unique" ON "claim_verifications" USING btree ("claim_id","contributor_id");--> statement-breakpoint
CREATE INDEX "idx_claims_topic" ON "claims" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_claims_topic_status" ON "claims" USING btree ("topic_id","status");--> statement-breakpoint
CREATE INDEX "idx_claims_contributor" ON "claims" USING btree ("contributor_id");--> statement-breakpoint
CREATE INDEX "idx_claims_status_created" ON "claims" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_claims_confidence" ON "claims" USING btree ("topic_id","confidence");--> statement-breakpoint
CREATE INDEX "idx_claims_expires" ON "claims" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_collections_slug" ON "collections" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_karma_contributor_time" ON "karma_ledger" USING btree ("contributor_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_karma_collection_time" ON "karma_ledger" USING btree ("collection_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_karma_event_type" ON "karma_ledger" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_notes_topic" ON "practitioner_notes" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_notes_topic_type" ON "practitioner_notes" USING btree ("topic_id","type");--> statement-breakpoint
CREATE INDEX "idx_notes_contributor" ON "practitioner_notes" USING btree ("contributor_id");--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributor_reputation" ADD CONSTRAINT "contributor_reputation_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_created_by_id_contributors_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."contributors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_collection_time" ON "activity" USING btree ("collection_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_bounties_collection" ON "bounties" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "idx_reputation_collection" ON "contributor_reputation" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "idx_topics_collection" ON "topics" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "idx_topics_path" ON "topics" USING btree ("materialized_path");--> statement-breakpoint
CREATE INDEX "idx_topics_freshness" ON "topics" USING btree ("freshness_score");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reputation_unique" ON "contributor_reputation" USING btree ("contributor_id","collection_id");--> statement-breakpoint
ALTER TABLE "contributor_reputation" DROP COLUMN "topic_id";