-- ─────────────────────────────────────────────────────────────────────────────
-- MCP Phase 3 — Cycle Planning
-- Adds scoped user story, acceptance criteria, and cycle assignment columns
-- to deal_linear_links.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE deal_linear_links
  ADD COLUMN IF NOT EXISTS scoped_description         text,
  ADD COLUMN IF NOT EXISTS scoped_user_story          text,
  ADD COLUMN IF NOT EXISTS scoped_acceptance_criteria text,
  ADD COLUMN IF NOT EXISTS cycle_id                   text,
  ADD COLUMN IF NOT EXISTS assignee_id                text,
  ADD COLUMN IF NOT EXISTS assignee_name              text;

-- status progression: suggested → confirmed → in_cycle → deployed
-- (no enum change needed; status column already uses text with app-level validation)
