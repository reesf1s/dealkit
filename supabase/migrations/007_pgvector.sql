-- ─────────────────────────────────────────────────────────────────────────────
-- pgvector + OpenAI embeddings for deal-to-Linear issue matching
-- Replaces TF-IDF cosine similarity with dense 1536-dim vectors.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pgvector extension (requires Supabase pg_vector extension to be enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- deal_logs already has deal_embedding and note_embedding as vector(1536) columns
-- (added in migration v25, stored as text in Drizzle schema).
-- Ensure the index exists for cosine similarity search.
CREATE INDEX IF NOT EXISTS deals_embedding_idx
  ON deal_logs USING ivfflat (deal_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Add pgvector embedding column to linear_issues_cache.
-- The existing `embedding` column stores TF-IDF vectors as JSONB — preserved as-is.
-- The new `pgvector_embedding` column stores OpenAI text-embedding-3-small vectors.
ALTER TABLE linear_issues_cache
  ADD COLUMN IF NOT EXISTS pgvector_embedding vector(1536);

CREATE INDEX IF NOT EXISTS linear_issues_pgvector_idx
  ON linear_issues_cache USING ivfflat (pgvector_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Deduplication index for mcp_action_log:
-- Prevents logging duplicate link_created events for the same workspace+deal+issue
-- within a rolling 60-second window (enforced at the application layer using this index
-- as a partial unique on recent rows — note: time-bounded unique indexes require
-- application-layer enforcement since NOW() is volatile in Postgres partial indexes).
-- Index is used by the dedup SELECT query to make it fast.
CREATE INDEX IF NOT EXISTS mcp_action_log_dedup_idx
  ON mcp_action_log (workspace_id, action_type, deal_id, linear_issue_id, created_at DESC);
