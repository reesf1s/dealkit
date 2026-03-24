-- 007_pgvector_embeddings.sql
-- Adds pgvector support for dense semantic embeddings (OpenAI text-embedding-3-small, 1536 dims).
--
-- The current architecture uses TF-IDF vectors stored as JSONB in workspace.embedding_cache.
-- This migration adds proper vector columns so that when OPENAI_API_KEY is set, the system
-- can use pgvector cosine similarity for higher-quality matching.
--
-- Note: deal_logs.deal_embedding and deal_logs.note_embedding already exist as TEXT columns
-- (see comment in schema.ts). This migration converts them to native vector type so pgvector
-- indexes and <=> operator work correctly.

-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Convert existing text embedding columns on deal_logs to vector(1536)
-- These were stored as text and cast to vector in SQL — making them native is cleaner.
ALTER TABLE deal_logs
  ALTER COLUMN deal_embedding TYPE vector(1536) USING deal_embedding::vector(1536);

ALTER TABLE deal_logs
  ALTER COLUMN note_embedding TYPE vector(1536) USING note_embedding::vector(1536);

-- Add pgvector embedding column to linear_issues_cache for dense (OpenAI) embeddings.
-- The existing jsonb `embedding` column stores TF-IDF vectors; this new column stores
-- the 1536-dim OpenAI embeddings when available.
ALTER TABLE linear_issues_cache
  ADD COLUMN IF NOT EXISTS dense_embedding vector(1536);

-- IVFFlat indexes for cosine similarity search
-- lists = 100 is appropriate for typical workspace sizes (<= 10k deals / issues)
CREATE INDEX IF NOT EXISTS idx_deal_logs_deal_embedding
  ON deal_logs USING ivfflat (deal_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_linear_issues_dense_embedding
  ON linear_issues_cache USING ivfflat (dense_embedding vector_cosine_ops)
  WITH (lists = 100);
