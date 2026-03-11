CREATE TYPE "public"."evaluation_verdict" AS ENUM('approve', 'reject', 'revise');--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'evaluation_submitted';--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'consensus_reached';--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'trust_level_changed';--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"evaluator_id" text,
	"verdict" "evaluation_verdict" NOT NULL,
	"overall_score" integer NOT NULL,
	"scores" jsonb,
	"reasoning" text NOT NULL,
	"suggested_reputation_delta" integer NOT NULL,
	"improvement_suggestions" jsonb,
	"duplicate_of" text,
	"resolved_tags" jsonb,
	"resolved_edges" jsonb,
	"icon" text,
	"icon_hue" integer,
	"karma_awarded" integer DEFAULT 0 NOT NULL,
	"agreed_with_consensus" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluator_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"contributor_id" text NOT NULL,
	"total_evaluations" integer DEFAULT 0 NOT NULL,
	"agreement_count" integer DEFAULT 0 NOT NULL,
	"disagreement_count" integer DEFAULT 0 NOT NULL,
	"evaluator_karma" integer DEFAULT 0 NOT NULL,
	"last_evaluated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "evaluation_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "consensus_reached_at" timestamp;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_evaluator_id_contributors_id_fk" FOREIGN KEY ("evaluator_id") REFERENCES "public"."contributors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluator_stats" ADD CONSTRAINT "evaluator_stats_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_evaluations_submission" ON "evaluations" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_evaluations_unique" ON "evaluations" USING btree ("submission_id","evaluator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_evaluator_stats_contributor" ON "evaluator_stats" USING btree ("contributor_id");