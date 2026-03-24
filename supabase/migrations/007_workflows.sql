-- 007_workflows.sql
-- Workflow automation rules table

CREATE TABLE IF NOT EXISTS workflows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  trigger_type  TEXT NOT NULL DEFAULT 'manual',
  trigger_config JSONB DEFAULT '{}',
  actions       JSONB DEFAULT '[]',
  output_target TEXT DEFAULT 'today_tab',
  is_enabled    BOOLEAN DEFAULT false,
  last_run_at   TIMESTAMPTZ,
  last_output   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflows_workspace_id_idx ON workflows (workspace_id);
