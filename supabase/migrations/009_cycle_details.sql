-- ─────────────────────────────────────────────────────────────────────────────
-- 009 — Cycle metadata on linear_issues_cache
--
-- Adds cycle name, number, and date range so the Loops tab can display
-- "In Cycle: [name]" and determine if an issue is in the active cycle.
-- Apply via Supabase SQL editor or MCP.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE linear_issues_cache
  ADD COLUMN IF NOT EXISTS cycle_name      text,
  ADD COLUMN IF NOT EXISTS cycle_number    integer,
  ADD COLUMN IF NOT EXISTS cycle_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS cycle_ends_at   timestamptz;
