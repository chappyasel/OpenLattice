CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_topics_title_trgm ON topics USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_resources_name_trgm ON resources USING GIN (name gin_trgm_ops);
