-- Persist CRM saved views at workspace scope.
-- Additive only: existing local browser views can continue to work as fallback.

CREATE TABLE IF NOT EXISTS crm_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  object_type text NOT NULL,
  label text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, object_type, label)
);

CREATE INDEX IF NOT EXISTS crm_saved_views_workspace_object_idx
  ON crm_saved_views (workspace_id, object_type, position, created_at DESC);
