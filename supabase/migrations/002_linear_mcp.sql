-- ─────────────────────────────────────────────────────────────────────────────
-- MCP Phase 1 — Linear bidirectional intelligence link
-- Run once on Supabase SQL editor (or via migration tool).
-- ─────────────────────────────────────────────────────────────────────────────

-- linear_integrations: one per workspace
CREATE TABLE IF NOT EXISTS linear_integrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  api_key_enc     text NOT NULL,
  team_id         text NOT NULL,
  team_name       text,
  workspace_name  text,
  webhook_secret  text,
  last_sync_at    timestamptz,
  sync_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- linear_issues_cache: denormalised issues with embedding pointers
CREATE TABLE IF NOT EXISTS linear_issues_cache (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linear_issue_id text NOT NULL,
  linear_issue_url text,
  title           text NOT NULL,
  description     text,
  status          text,
  cycle_id        text,
  assignee_id     text,
  assignee_name   text,
  priority        integer NOT NULL DEFAULT 0,
  cached_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, linear_issue_id)
);

-- deal_linear_links: the link between a deal and a Linear issue
CREATE TABLE IF NOT EXISTS deal_linear_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id         uuid NOT NULL REFERENCES deal_logs(id) ON DELETE CASCADE,
  linear_issue_id text NOT NULL,
  linear_issue_url text,
  linear_title    text,
  relevance_score integer NOT NULL DEFAULT 0,  -- 0-100
  link_type       text NOT NULL DEFAULT 'feature_gap',  -- 'feature_gap'|'competitor_signal'|'manual'
  status          text NOT NULL DEFAULT 'suggested',    -- 'suggested'|'confirmed'|'dismissed'|'in_cycle'|'deployed'
  scoped_at       timestamptz,
  deployed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deal_id, linear_issue_id)
);

-- mcp_action_log: audit trail for all MCP actions
CREATE TABLE IF NOT EXISTS mcp_action_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  action_type     text NOT NULL,
  deal_id         uuid REFERENCES deal_logs(id) ON DELETE SET NULL,
  linear_issue_id text,
  triggered_by    text,
  payload         jsonb,
  result          jsonb,
  status          text NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_linear_issues_cache_workspace ON linear_issues_cache(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deal_linear_links_deal ON deal_linear_links(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_linear_links_workspace ON deal_linear_links(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deal_linear_links_status ON deal_linear_links(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_mcp_action_log_workspace ON mcp_action_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_mcp_action_log_deal ON mcp_action_log(deal_id);
