-- Native Halvex CRM rebuild foundation.
-- Adds first-class CRM tables in parallel with legacy deal_logs.
-- This migration is additive only: no legacy production data is dropped.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE business_type AS ENUM ('saas', 'agency', 'consultancy', 'recruitment', 'services', 'other_b2b');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_deal_status AS ENUM ('open', 'won', 'lost', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_risk_level AS ENUM ('low', 'medium', 'high', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_activity_type AS ENUM ('email', 'meeting', 'call', 'note', 'task', 'stage_change', 'ai_insight', 'import');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_task_status AS ENUM ('todo', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_task_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_signal_direction AS ENUM ('positive', 'negative', 'neutral');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_signal_type AS ENUM (
    'stale_deal',
    'no_next_step',
    'positive_sentiment',
    'negative_sentiment',
    'champion_engaged',
    'champion_inactive',
    'close_date_slipped',
    'value_changed',
    'stage_advanced',
    'response_delay',
    'meeting_booked',
    'pricing_mentioned',
    'competitor_mentioned',
    'legal_or_procurement_mentioned',
    'close_date_overdue',
    'stage_stagnant'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_notification_type AS ENUM ('daily_brief', 'risk_alert', 'task_due', 'meeting_prep', 'import_complete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS crm_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text,
  website text,
  industry text,
  size_label text,
  description text,
  source text NOT NULL DEFAULT 'manual',
  owner_id text REFERENCES users(id) ON DELETE SET NULL,
  legacy_prospect_company text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, domain),
  UNIQUE(workspace_id, name)
);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES crm_companies(id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  full_name text NOT NULL,
  email text,
  phone text,
  job_title text,
  linkedin_url text,
  source text NOT NULL DEFAULT 'manual',
  owner_id text REFERENCES users(id) ON DELETE SET NULL,
  last_contacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, email)
);

CREATE TABLE IF NOT EXISTS crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Sales pipeline',
  business_type business_type NOT NULL DEFAULT 'other_b2b',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);

CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  key text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  position integer NOT NULL DEFAULT 0,
  probability integer NOT NULL DEFAULT 20,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id, key)
);

CREATE TABLE IF NOT EXISTS crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES crm_companies(id) ON DELETE SET NULL,
  pipeline_id uuid REFERENCES crm_pipelines(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES crm_pipeline_stages(id) ON DELETE SET NULL,
  owner_id text REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  value_amount integer,
  value_currency text NOT NULL DEFAULT 'GBP',
  expected_close_date timestamptz,
  probability integer,
  status crm_deal_status NOT NULL DEFAULT 'open',
  source text NOT NULL DEFAULT 'manual',
  ai_score integer,
  ai_confidence integer,
  ai_risk_level crm_risk_level NOT NULL DEFAULT 'unknown',
  ai_summary text,
  ai_next_action text,
  last_activity_at timestamptz,
  next_step_due_at timestamptz,
  legacy_deal_log_id uuid UNIQUE REFERENCES deal_logs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_deal_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  role text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deal_id, contact_id)
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE CASCADE,
  company_id uuid REFERENCES crm_companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE SET NULL,
  type crm_activity_type NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  title text NOT NULL,
  body text,
  summary text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, source, external_id)
);

CREATE TABLE IF NOT EXISTS crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE CASCADE,
  company_id uuid REFERENCES crm_companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE SET NULL,
  assigned_to text REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  status crm_task_status NOT NULL DEFAULT 'todo',
  priority crm_task_priority NOT NULL DEFAULT 'normal',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE CASCADE,
  company_id uuid REFERENCES crm_companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE SET NULL,
  company_id uuid REFERENCES crm_companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'manual',
  external_thread_id text,
  subject text,
  snippet text,
  summary text,
  last_message_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, provider, external_thread_id)
);

CREATE TABLE IF NOT EXISTS crm_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE SET NULL,
  company_id uuid REFERENCES crm_companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'manual',
  external_id text,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  meeting_url text,
  source text NOT NULL DEFAULT 'manual',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, provider, external_id)
);

CREATE TABLE IF NOT EXISTS crm_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE CASCADE,
  summary_type text NOT NULL DEFAULT 'deal_brief',
  content text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence integer,
  generated_by text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES crm_deals(id) ON DELETE CASCADE,
  type crm_signal_type NOT NULL,
  strength integer NOT NULL DEFAULT 50,
  direction crm_signal_direction NOT NULL DEFAULT 'neutral',
  explanation text NOT NULL,
  evidence_activity_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence integer NOT NULL DEFAULT 80,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  type crm_notification_type NOT NULL,
  title text NOT NULL,
  body text,
  linked_record_type text,
  linked_record_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role workspace_role NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE,
  invited_by text REFERENCES users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, email)
);

CREATE TABLE IF NOT EXISTS google_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_account_email text,
  access_token_enc text NOT NULL,
  refresh_token_enc text,
  expires_at timestamptz,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  calendar_sync_token text,
  last_calendar_sync_at timestamptz,
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_deals_workspace_status ON crm_deals (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_deals_workspace_stage ON crm_deals (workspace_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_legacy ON crm_deals (legacy_deal_log_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_workspace_occurred ON crm_activities (workspace_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_deal ON crm_activities (deal_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_workspace_due ON crm_tasks (workspace_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_crm_calendar_workspace_start ON crm_calendar_events (workspace_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_crm_signals_deal ON crm_signals (deal_id, created_at DESC);
