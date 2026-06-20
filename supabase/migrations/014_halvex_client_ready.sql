CREATE TABLE IF NOT EXISTS crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_id text REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  owner_name text NOT NULL,
  score integer NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'open',
  stage text NOT NULL DEFAULT 'New',
  stage_name text NOT NULL DEFAULT 'New',
  description text NOT NULL DEFAULT '',
  next_step text NOT NULL DEFAULT '',
  company_name text NOT NULL,
  primary_person_name text NOT NULL,
  value_amount integer NOT NULL DEFAULT 0,
  probability integer NOT NULL DEFAULT 0,
  expected_close_date timestamptz,
  latest_activity_at timestamptz,
  open_task_count integer NOT NULL DEFAULT 0,
  channel text NOT NULL DEFAULT 'mail',
  risk text NOT NULL DEFAULT 'new',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  name text NOT NULL,
  connected boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

CREATE TABLE IF NOT EXISTS crm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  channel text NOT NULL,
  from_role text NOT NULL,
  body text NOT NULL,
  external_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES crm_leads(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  due_at timestamptz,
  company_name text,
  person_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES crm_leads(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'note',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  company_name text,
  person_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_ai_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES crm_leads(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  prompt text NOT NULL DEFAULT '',
  result text NOT NULL,
  model text NOT NULL DEFAULT 'fallback',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TYPE crm_task_priority ADD VALUE IF NOT EXISTS 'medium';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE crm_activity_type ADD VALUE IF NOT EXISTS 'engagement';
  ALTER TYPE crm_activity_type ADD VALUE IF NOT EXISTS 'reply';
  ALTER TYPE crm_activity_type ADD VALUE IF NOT EXISTS 'follow_up';
  ALTER TYPE crm_activity_type ADD VALUE IF NOT EXISTS 'call_signal';
  ALTER TYPE crm_activity_type ADD VALUE IF NOT EXISTS 'intent';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES crm_leads(id) ON DELETE CASCADE;
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS person_name text;
ALTER TABLE crm_tasks ALTER COLUMN description SET DEFAULT '';

ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES crm_leads(id) ON DELETE CASCADE;
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS person_name text;
ALTER TABLE crm_activities ALTER COLUMN body SET DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_crm_leads_workspace_updated ON crm_leads (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_workspace_stage ON crm_leads (workspace_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_channels_workspace ON crm_channels (workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_messages_workspace_lead ON crm_messages (workspace_id, lead_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_workspace_lead ON crm_tasks (workspace_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_workspace_lead ON crm_activities (workspace_id, lead_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_ai_actions_workspace_lead ON crm_ai_actions (workspace_id, lead_id, created_at DESC);
