-- ─────────────────────────────────────────────────────────────────────────────
-- MCP Phase 2 — Slack Gateway tables
-- Run once on Supabase SQL editor (or via migration tool).
-- ─────────────────────────────────────────────────────────────────────────────

-- slack_connections: one per workspace, encrypted bot token
CREATE TABLE IF NOT EXISTS slack_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  slack_team_id   text NOT NULL UNIQUE,
  slack_team_name text,
  bot_token_enc   text NOT NULL,
  installed_by    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- slack_user_mappings: Clerk user ↔ Slack user with notification prefs
CREATE TABLE IF NOT EXISTS slack_user_mappings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  clerk_user_id           text NOT NULL,
  slack_user_id           text NOT NULL,
  notify_health_drops     boolean NOT NULL DEFAULT true,
  notify_issue_links      boolean NOT NULL DEFAULT true,
  notify_stale_deals      boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, clerk_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_slack_connections_team_id ON slack_connections(slack_team_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_workspace ON slack_user_mappings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_clerk_user ON slack_user_mappings(clerk_user_id);
