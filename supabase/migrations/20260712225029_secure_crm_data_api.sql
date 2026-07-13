-- Halvex uses a server-only Postgres connection and does not expose CRM data
-- through the Supabase Data API. Keep the public schema closed to browser roles.

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.events enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_channels enable row level security;
alter table public.crm_messages enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_ai_actions enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.workspaces from anon, authenticated;
revoke all on table public.workspace_memberships from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.crm_leads from anon, authenticated;
revoke all on table public.crm_channels from anon, authenticated;
revoke all on table public.crm_messages from anon, authenticated;
revoke all on table public.crm_tasks from anon, authenticated;
revoke all on table public.crm_activities from anon, authenticated;
revoke all on table public.crm_ai_actions from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
