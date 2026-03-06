DO $$ BEGIN CREATE TYPE "public"."activity_type" AS ENUM('topic_created', 'resource_submitted', 'edge_created', 'bounty_completed', 'submission_reviewed', 'reputation_changed', 'kudos_given'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."bounty_status" AS ENUM('open', 'claimed', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."bounty_type" AS ENUM('topic', 'resource', 'edit'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."trust_level" AS ENUM('new', 'verified', 'trusted', 'autonomous'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."edge_relation_type" AS ENUM('related', 'prerequisite', 'subtopic', 'see_also'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."difficulty" AS ENUM('beginner', 'intermediate', 'advanced'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."topic_status" AS ENUM('draft', 'published', 'archived'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."resource_type" AS ENUM('article', 'paper', 'book', 'course', 'video', 'podcast', 'dataset', 'tool', 'model', 'library', 'repository', 'prompt', 'workflow', 'benchmark', 'report', 'discussion', 'community', 'event', 'organization', 'person', 'concept', 'comparison', 'curated_list', 'newsletter', 'social_media', 'tutorial', 'documentation'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."resource_visibility" AS ENUM('pending_review', 'public', 'hidden', 'archived'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."submission_source" AS ENUM('web', 'mcp', 'api', 'admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."submission_status" AS ENUM('pending', 'approved', 'rejected', 'revision_requested'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."submission_type" AS ENUM('resource', 'topic_edit', 'topic_new', 'bounty_response', 'expansion'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE IF NOT EXISTS 'newsletter';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE IF NOT EXISTS 'social_media';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE IF NOT EXISTS 'tutorial';--> statement-breakpoint
ALTER TYPE "public"."resource_type" ADD VALUE IF NOT EXISTS 'documentation';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "activity_type" NOT NULL,
	"contributor_id" text,
	"topic_id" text,
	"resource_id" text,
	"bounty_id" text,
	"submission_id" text,
	"description" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bounties" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" "bounty_type" NOT NULL,
	"status" "bounty_status" DEFAULT 'open' NOT NULL,
	"topic_id" text,
	"karma_reward" integer DEFAULT 10 NOT NULL,
	"icon" text,
	"icon_hue" integer,
	"claimed_by_id" text,
	"claimed_at" timestamp,
	"claim_expires_at" timestamp,
	"completed_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contributor_reputation" (
	"id" text PRIMARY KEY NOT NULL,
	"contributor_id" text NOT NULL,
	"topic_id" text,
	"score" integer DEFAULT 100 NOT NULL,
	"total_contributions" integer DEFAULT 0 NOT NULL,
	"accepted_contributions" integer DEFAULT 0 NOT NULL,
	"rejected_contributions" integer DEFAULT 0 NOT NULL,
	"last_calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contributors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"image" text,
	"bio" text,
	"website_url" text,
	"github_username" text,
	"twitter_username" text,
	"linkedin_url" text,
	"is_agent" boolean DEFAULT false NOT NULL,
	"agent_model" text,
	"trust_level" "trust_level" DEFAULT 'new' NOT NULL,
	"karma" integer DEFAULT 0 NOT NULL,
	"kudos_received" integer DEFAULT 0 NOT NULL,
	"total_contributions" integer DEFAULT 0 NOT NULL,
	"accepted_contributions" integer DEFAULT 0 NOT NULL,
	"rejected_contributions" integer DEFAULT 0 NOT NULL,
	"api_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "edges" (
	"id" text PRIMARY KEY NOT NULL,
	"source_topic_id" text NOT NULL,
	"target_topic_id" text NOT NULL,
	"relation_type" "edge_relation_type" DEFAULT 'related' NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"summary" text,
	"difficulty" "difficulty" DEFAULT 'beginner' NOT NULL,
	"status" "topic_status" DEFAULT 'draft' NOT NULL,
	"parent_topic_id" text,
	"icon" text,
	"icon_hue" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"type" "resource_type" NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"content" text,
	"image_urls" jsonb DEFAULT '[]'::jsonb,
	"score" integer DEFAULT 0 NOT NULL,
	"visibility" "resource_visibility" DEFAULT 'pending_review' NOT NULL,
	"data" jsonb,
	"submitted_by_id" text,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon_hue" integer NOT NULL,
	"icon" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "topic_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "topic_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"relevance_score" integer DEFAULT 50 NOT NULL,
	"added_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "submission_type" NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"data" jsonb NOT NULL,
	"contributor_id" text,
	"agent_name" text,
	"agent_model" text,
	"process_trace" text,
	"source" "submission_source" DEFAULT 'web' NOT NULL,
	"bounty_id" text,
	"reputation_delta" integer,
	"reviewed_by_contributor_id" text,
	"review_reasoning" text,
	"review_notes" text,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"original_submission_id" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kudos" (
	"id" text PRIMARY KEY NOT NULL,
	"from_contributor_id" text NOT NULL,
	"to_contributor_id" text NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "topic_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"difficulty" "difficulty",
	"change_summary" text,
	"contributor_id" text,
	"submission_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "activity" ADD CONSTRAINT "activity_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "activity" ADD CONSTRAINT "activity_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "activity" ADD CONSTRAINT "activity_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "activity" ADD CONSTRAINT "activity_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "activity" ADD CONSTRAINT "activity_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bounties" ADD CONSTRAINT "bounties_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bounties" ADD CONSTRAINT "bounties_claimed_by_id_contributors_id_fk" FOREIGN KEY ("claimed_by_id") REFERENCES "public"."contributors"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bounties" ADD CONSTRAINT "bounties_completed_by_id_contributors_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."contributors"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "contributor_reputation" ADD CONSTRAINT "contributor_reputation_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "contributor_reputation" ADD CONSTRAINT "contributor_reputation_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "edges" ADD CONSTRAINT "edges_source_topic_id_topics_id_fk" FOREIGN KEY ("source_topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "edges" ADD CONSTRAINT "edges_target_topic_id_topics_id_fk" FOREIGN KEY ("target_topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_topic_id_topics_id_fk" FOREIGN KEY ("parent_topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "topics" ADD CONSTRAINT "topics_created_by_id_contributors_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."contributors"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "resources" ADD CONSTRAINT "resources_submitted_by_id_contributors_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."contributors"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "topic_tags" ADD CONSTRAINT "topic_tags_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "topic_tags" ADD CONSTRAINT "topic_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "topic_resources" ADD CONSTRAINT "topic_resources_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "topic_resources" ADD CONSTRAINT "topic_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "topic_resources" ADD CONSTRAINT "topic_resources_added_by_id_contributors_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."contributors"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "submissions" ADD CONSTRAINT "submissions_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "submissions" ADD CONSTRAINT "submissions_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reviewed_by_contributor_id_contributors_id_fk" FOREIGN KEY ("reviewed_by_contributor_id") REFERENCES "public"."contributors"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kudos" ADD CONSTRAINT "kudos_from_contributor_id_contributors_id_fk" FOREIGN KEY ("from_contributor_id") REFERENCES "public"."contributors"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "kudos" ADD CONSTRAINT "kudos_to_contributor_id_contributors_id_fk" FOREIGN KEY ("to_contributor_id") REFERENCES "public"."contributors"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "topic_revisions" ADD CONSTRAINT "topic_revisions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "topic_revisions" ADD CONSTRAINT "topic_revisions_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "topic_revisions" ADD CONSTRAINT "topic_revisions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_type" ON "activity" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_contributor" ON "activity" USING btree ("contributor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_activity_created_at" ON "activity" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bounties_status" ON "bounties" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bounties_topic" ON "bounties" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reputation_contributor" ON "contributor_reputation" USING btree ("contributor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reputation_topic" ON "contributor_reputation" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_reputation_unique" ON "contributor_reputation" USING btree ("contributor_id","topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_contributors_email" ON "contributors" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contributors_karma" ON "contributors" USING btree ("karma");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contributors_trust" ON "contributors" USING btree ("trust_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_edges_source" ON "edges" USING btree ("source_topic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_edges_target" ON "edges" USING btree ("target_topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_edges_unique" ON "edges" USING btree ("source_topic_id","target_topic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_topics_status" ON "topics" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_topics_parent" ON "topics" USING btree ("parent_topic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resources_type" ON "resources" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resources_visibility" ON "resources" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resources_score" ON "resources" USING btree ("score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resource_tags_resource" ON "resource_tags" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_resource_tags_tag" ON "resource_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_resource_tags_unique" ON "resource_tags" USING btree ("resource_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tags_name_lower" ON "tags" USING btree (LOWER("name"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_topic_tags_topic" ON "topic_tags" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_topic_tags_tag" ON "topic_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_topic_tags_unique" ON "topic_tags" USING btree ("topic_id","tag_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_topic_resources_topic" ON "topic_resources" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_topic_resources_resource" ON "topic_resources" USING btree ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_topic_resources_unique" ON "topic_resources" USING btree ("topic_id","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_submissions_status" ON "submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_submissions_contributor" ON "submissions" USING btree ("contributor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_submissions_type" ON "submissions" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_kudos_unique" ON "kudos" USING btree ("from_contributor_id","to_contributor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_topic_revisions_topic" ON "topic_revisions" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_topic_revisions_number" ON "topic_revisions" USING btree ("topic_id","revision_number");
