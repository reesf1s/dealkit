-- ─────────────────────────────────────────────────────────────────────────────
-- 008 — App roles + Slack pending actions
--
-- Apply via Supabase SQL editor or MCP.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add app_role to workspace_memberships
--    Separate from the existing workspace `role` (owner/admin/member) which controls
--    workspace-level access. app_role controls product feature access:
--      sales   — log deals, ask Slack bot, request prioritisation
--      product — approve/decline prioritisation requests, see revenue impact on roadmap
--      admin   — full access (sales + product + user management + integrations + billing)
ALTER TABLE workspace_memberships
  ADD COLUMN IF NOT EXISTS app_role text NOT NULL DEFAULT 'sales'
  CHECK (app_role IN ('sales', 'product', 'admin'));

-- 2. slack_pending_actions — explicit state store for multi-step Slack flows
--    Used when a sales rep confirms "yes" → bot holds the action here while waiting
--    for a product team member to approve. Separate from mcp_action_log (audit trail)
--    so we can query pending actions by user efficiently.
CREATE TABLE IF NOT EXISTS slack_pending_actions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slack_user_id    text NOT NULL,   -- Slack user ID who owns this pending action
  slack_channel_id text NOT NULL,   -- channel to reply to when resolved
  action_type      text NOT NULL,   -- 'confirm_prioritisation' | 'pm_approve_prioritisation'
  deal_id          uuid REFERENCES deal_logs(id) ON DELETE CASCADE,
  payload          jsonb NOT NULL DEFAULT '{}',
  expires_at       timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slack_pending_user_workspace
  ON slack_pending_actions(slack_user_id, workspace_id, expires_at);
