ALTER TABLE "collections" RENAME TO "bases";
ALTER TABLE "topics" RENAME COLUMN "collection_id" TO "base_id";
ALTER TABLE "bounties" RENAME COLUMN "collection_id" TO "base_id";
ALTER TABLE "activity" RENAME COLUMN "collection_id" TO "base_id";
ALTER TABLE "contributor_reputation" RENAME COLUMN "collection_id" TO "base_id";
ALTER TABLE "karma_ledger" RENAME COLUMN "collection_id" TO "base_id";
ALTER TABLE "edges" RENAME COLUMN "is_cross_collection" TO "is_cross_base";

-- Drop + recreate indexes with new names
DROP INDEX IF EXISTS "idx_collections_slug";
CREATE UNIQUE INDEX "idx_bases_slug" ON "bases" USING btree ("slug");

DROP INDEX IF EXISTS "idx_topics_collection";
CREATE INDEX "idx_topics_base" ON "topics" USING btree ("base_id");

DROP INDEX IF EXISTS "idx_bounties_collection";
CREATE INDEX "idx_bounties_base" ON "bounties" USING btree ("base_id");

DROP INDEX IF EXISTS "idx_activity_collection_time";
CREATE INDEX "idx_activity_base_time" ON "activity" USING btree ("base_id","created_at");

DROP INDEX IF EXISTS "idx_reputation_collection";
CREATE INDEX "idx_reputation_base" ON "contributor_reputation" USING btree ("base_id");

DROP INDEX IF EXISTS "idx_reputation_unique";
CREATE UNIQUE INDEX "idx_reputation_unique" ON "contributor_reputation" USING btree ("contributor_id","base_id");

DROP INDEX IF EXISTS "idx_karma_collection_time";
CREATE INDEX "idx_karma_base_time" ON "karma_ledger" USING btree ("base_id","created_at");

-- Update FK constraints
ALTER TABLE "topics" DROP CONSTRAINT "topics_collection_id_collections_id_fk";
ALTER TABLE "topics" ADD CONSTRAINT "topics_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "bases"("id") ON DELETE set null;

ALTER TABLE "bounties" DROP CONSTRAINT "bounties_collection_id_collections_id_fk";
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "bases"("id") ON DELETE set null;

ALTER TABLE "activity" DROP CONSTRAINT "activity_collection_id_collections_id_fk";
ALTER TABLE "activity" ADD CONSTRAINT "activity_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "bases"("id") ON DELETE set null;

ALTER TABLE "contributor_reputation" DROP CONSTRAINT "contributor_reputation_collection_id_collections_id_fk";
ALTER TABLE "contributor_reputation" ADD CONSTRAINT "contributor_reputation_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "bases"("id") ON DELETE cascade;

ALTER TABLE "karma_ledger" DROP CONSTRAINT "karma_ledger_collection_id_collections_id_fk";
ALTER TABLE "karma_ledger" ADD CONSTRAINT "karma_ledger_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "bases"("id") ON DELETE set null;
