-- Shadow-backfill native CRM records from legacy deal_logs.
-- Idempotent and additive: legacy records are preserved and never deleted.

BEGIN;

INSERT INTO crm_pipelines (workspace_id, name, business_type, is_default)
SELECT id, 'Sales pipeline', 'other_b2b'::business_type, true
FROM workspaces
ON CONFLICT (workspace_id, name) DO UPDATE
SET is_default = excluded.is_default,
    updated_at = now();

INSERT INTO crm_pipeline_stages (
  workspace_id,
  pipeline_id,
  name,
  key,
  color,
  position,
  probability,
  is_closed
)
SELECT p.workspace_id, p.id, s.name, s.key, s.color, s.position, s.probability, s.is_closed
FROM crm_pipelines p
CROSS JOIN (
  VALUES
    ('Prospecting', 'prospecting', '#64748b', 10, 10, false),
    ('Qualification', 'qualification', '#2563eb', 20, 25, false),
    ('Discovery', 'discovery', '#7c3aed', 30, 40, false),
    ('Proposal', 'proposal', '#d97706', 40, 60, false),
    ('Negotiation', 'negotiation', '#ea580c', 50, 75, false),
    ('Closed won', 'closed_won', '#16a34a', 60, 100, true),
    ('Closed lost', 'closed_lost', '#dc2626', 70, 0, true)
) AS s(name, key, color, position, probability, is_closed)
WHERE p.name = 'Sales pipeline'
ON CONFLICT (pipeline_id, key) DO UPDATE
SET name = excluded.name,
    color = excluded.color,
    position = excluded.position,
    probability = excluded.probability,
    is_closed = excluded.is_closed,
    updated_at = now();

WITH company_source AS (
  SELECT DISTINCT ON (workspace_id, lower(trim(prospect_company)))
    workspace_id,
    trim(prospect_company) AS name,
    user_id AS owner_id
  FROM deal_logs
  WHERE prospect_company IS NOT NULL
    AND trim(prospect_company) <> ''
    AND workspace_id IS NOT NULL
  ORDER BY workspace_id, lower(trim(prospect_company)), updated_at DESC NULLS LAST
)
INSERT INTO crm_companies (
  workspace_id,
  name,
  source,
  owner_id,
  legacy_prospect_company,
  created_at,
  updated_at
)
SELECT workspace_id, name, 'legacy_deal_logs', owner_id, name, now(), now()
FROM company_source
ON CONFLICT (workspace_id, name) DO UPDATE
SET legacy_prospect_company = excluded.legacy_prospect_company,
    updated_at = now();

WITH json_contacts AS (
  SELECT DISTINCT ON (
    dl.workspace_id,
    coalesce(nullif(lower(trim(contact->>'email')), ''), lower(trim(contact->>'name')) || '|' || c.id::text)
  )
    dl.workspace_id,
    c.id AS company_id,
    trim(contact->>'name') AS full_name,
    nullif(lower(trim(contact->>'email')), '') AS email,
    nullif(trim(contact->>'role'), '') AS job_title,
    dl.user_id AS owner_id
  FROM deal_logs dl
  JOIN crm_companies c
    ON c.workspace_id = dl.workspace_id
   AND lower(c.name) = lower(trim(dl.prospect_company))
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(dl.contacts) = 'array' THEN dl.contacts ELSE '[]'::jsonb END
  ) contact
  WHERE nullif(trim(contact->>'name'), '') IS NOT NULL
  ORDER BY
    dl.workspace_id,
    coalesce(nullif(lower(trim(contact->>'email')), ''), lower(trim(contact->>'name')) || '|' || c.id::text),
    dl.updated_at DESC NULLS LAST
), email_contacts AS (
  INSERT INTO crm_contacts (
    workspace_id,
    company_id,
    full_name,
    email,
    job_title,
    source,
    owner_id,
    created_at,
    updated_at
  )
  SELECT workspace_id, company_id, full_name, email, job_title, 'legacy_deal_logs', owner_id, now(), now()
  FROM json_contacts
  WHERE email IS NOT NULL
  ON CONFLICT (workspace_id, email) DO UPDATE
  SET company_id = coalesce(crm_contacts.company_id, excluded.company_id),
      full_name = excluded.full_name,
      job_title = coalesce(excluded.job_title, crm_contacts.job_title),
      updated_at = now()
  RETURNING id
)
INSERT INTO crm_contacts (
  workspace_id,
  company_id,
  full_name,
  job_title,
  source,
  owner_id,
  created_at,
  updated_at
)
SELECT jc.workspace_id, jc.company_id, jc.full_name, jc.job_title, 'legacy_deal_logs', jc.owner_id, now(), now()
FROM json_contacts jc
WHERE jc.email IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM crm_contacts existing
    WHERE existing.workspace_id = jc.workspace_id
      AND existing.company_id IS NOT DISTINCT FROM jc.company_id
      AND lower(existing.full_name) = lower(jc.full_name)
  );

WITH prospect_contacts AS (
  SELECT DISTINCT ON (dl.workspace_id, c.id, lower(trim(dl.prospect_name)))
    dl.workspace_id,
    c.id AS company_id,
    trim(dl.prospect_name) AS full_name,
    nullif(trim(dl.prospect_title), '') AS job_title,
    dl.user_id AS owner_id
  FROM deal_logs dl
  JOIN crm_companies c
    ON c.workspace_id = dl.workspace_id
   AND lower(c.name) = lower(trim(dl.prospect_company))
  WHERE dl.prospect_name IS NOT NULL
    AND trim(dl.prospect_name) <> ''
  ORDER BY dl.workspace_id, c.id, lower(trim(dl.prospect_name)), dl.updated_at DESC NULLS LAST
)
INSERT INTO crm_contacts (
  workspace_id,
  company_id,
  full_name,
  job_title,
  source,
  owner_id,
  created_at,
  updated_at
)
SELECT pc.workspace_id, pc.company_id, pc.full_name, pc.job_title, 'legacy_deal_logs', pc.owner_id, now(), now()
FROM prospect_contacts pc
WHERE NOT EXISTS (
  SELECT 1
  FROM crm_contacts existing
  WHERE existing.workspace_id = pc.workspace_id
    AND existing.company_id IS NOT DISTINCT FROM pc.company_id
    AND lower(existing.full_name) = lower(pc.full_name)
);

INSERT INTO crm_deals (
  workspace_id,
  company_id,
  pipeline_id,
  stage_id,
  owner_id,
  title,
  value_amount,
  value_currency,
  expected_close_date,
  probability,
  status,
  source,
  ai_score,
  ai_confidence,
  ai_risk_level,
  ai_summary,
  ai_next_action,
  last_activity_at,
  next_step_due_at,
  legacy_deal_log_id,
  created_at,
  updated_at
)
SELECT
  dl.workspace_id,
  c.id,
  p.id,
  ps.id,
  dl.user_id,
  coalesce(nullif(trim(dl.deal_name), ''), trim(dl.prospect_company) || ' deal'),
  dl.deal_value,
  'GBP',
  dl.close_date,
  ps.probability,
  CASE
    WHEN dl.stage::text = 'closed_won' OR dl.won_date IS NOT NULL OR lower(coalesce(dl.outcome, '')) = 'won'
      THEN 'won'::crm_deal_status
    WHEN dl.stage::text = 'closed_lost' OR dl.lost_date IS NOT NULL OR lower(coalesce(dl.outcome, '')) = 'lost'
      THEN 'lost'::crm_deal_status
    ELSE 'open'::crm_deal_status
  END,
  'legacy_deal_logs',
  greatest(0, least(100, dl.conversion_score)),
  CASE WHEN dl.conversion_score IS NULL THEN NULL ELSE 80 END,
  CASE
    WHEN dl.conversion_score IS NULL THEN 'unknown'::crm_risk_level
    WHEN dl.conversion_score >= 70 THEN 'low'::crm_risk_level
    WHEN dl.conversion_score >= 45 THEN 'medium'::crm_risk_level
    ELSE 'high'::crm_risk_level
  END,
  dl.ai_summary,
  nullif(trim(dl.next_steps), ''),
  dl.updated_at,
  CASE WHEN nullif(trim(dl.next_steps), '') IS NOT NULL THEN dl.close_date ELSE NULL END,
  dl.id,
  dl.created_at,
  dl.updated_at
FROM deal_logs dl
JOIN crm_companies c
  ON c.workspace_id = dl.workspace_id
 AND lower(c.name) = lower(trim(dl.prospect_company))
JOIN crm_pipelines p
  ON p.workspace_id = dl.workspace_id
 AND p.name = 'Sales pipeline'
LEFT JOIN crm_pipeline_stages ps
  ON ps.pipeline_id = p.id
 AND ps.key = dl.stage::text
WHERE dl.workspace_id IS NOT NULL
ON CONFLICT (legacy_deal_log_id) DO UPDATE
SET company_id = excluded.company_id,
    pipeline_id = excluded.pipeline_id,
    stage_id = excluded.stage_id,
    owner_id = excluded.owner_id,
    title = excluded.title,
    value_amount = excluded.value_amount,
    expected_close_date = excluded.expected_close_date,
    probability = excluded.probability,
    status = excluded.status,
    ai_score = excluded.ai_score,
    ai_confidence = excluded.ai_confidence,
    ai_risk_level = excluded.ai_risk_level,
    ai_summary = excluded.ai_summary,
    ai_next_action = excluded.ai_next_action,
    last_activity_at = excluded.last_activity_at,
    next_step_due_at = excluded.next_step_due_at,
    updated_at = excluded.updated_at;

WITH primary_contacts AS (
  SELECT d.id AS deal_id, d.workspace_id, c.id AS contact_id
  FROM deal_logs dl
  JOIN crm_deals d ON d.legacy_deal_log_id = dl.id
  JOIN crm_contacts c
    ON c.workspace_id = dl.workspace_id
   AND c.company_id IS NOT DISTINCT FROM d.company_id
   AND lower(c.full_name) = lower(trim(dl.prospect_name))
  WHERE dl.prospect_name IS NOT NULL
    AND trim(dl.prospect_name) <> ''
)
INSERT INTO crm_deal_participants (workspace_id, deal_id, contact_id, role, is_primary)
SELECT workspace_id, deal_id, contact_id, 'primary', true
FROM primary_contacts
ON CONFLICT (deal_id, contact_id) DO UPDATE
SET is_primary = true,
    role = coalesce(crm_deal_participants.role, 'primary');

WITH json_participants AS (
  SELECT DISTINCT d.id AS deal_id, d.workspace_id, c.id AS contact_id, nullif(trim(contact->>'role'), '') AS role
  FROM deal_logs dl
  JOIN crm_deals d ON d.legacy_deal_log_id = dl.id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(dl.contacts) = 'array' THEN dl.contacts ELSE '[]'::jsonb END
  ) contact
  JOIN crm_contacts c
    ON c.workspace_id = dl.workspace_id
   AND c.company_id IS NOT DISTINCT FROM d.company_id
   AND (
      (nullif(lower(trim(contact->>'email')), '') IS NOT NULL AND c.email = lower(trim(contact->>'email')))
      OR (nullif(lower(trim(contact->>'email')), '') IS NULL AND lower(c.full_name) = lower(trim(contact->>'name')))
    )
)
INSERT INTO crm_deal_participants (workspace_id, deal_id, contact_id, role, is_primary)
SELECT workspace_id, deal_id, contact_id, role, false
FROM json_participants
ON CONFLICT (deal_id, contact_id) DO UPDATE
SET role = coalesce(excluded.role, crm_deal_participants.role);

INSERT INTO crm_activities (
  workspace_id,
  deal_id,
  company_id,
  type,
  source,
  title,
  body,
  summary,
  occurred_at,
  created_by,
  external_id,
  metadata
)
SELECT d.workspace_id, d.id, d.company_id, 'import'::crm_activity_type, 'legacy_backfill',
       'Imported from legacy Halvex deal log', NULL, NULL, dl.created_at, dl.user_id,
       'legacy:' || dl.id::text || ':import', jsonb_build_object('legacy_deal_log_id', dl.id)
FROM deal_logs dl
JOIN crm_deals d ON d.legacy_deal_log_id = dl.id
ON CONFLICT (workspace_id, source, external_id) DO NOTHING;

INSERT INTO crm_activities (
  workspace_id,
  deal_id,
  company_id,
  type,
  source,
  title,
  body,
  summary,
  occurred_at,
  created_by,
  external_id,
  metadata
)
SELECT d.workspace_id, d.id, d.company_id, 'note'::crm_activity_type, 'legacy_backfill',
       'Meeting notes', dl.meeting_notes, left(dl.meeting_notes, 300),
       coalesce(dl.updated_at, dl.created_at), dl.user_id,
       'legacy:' || dl.id::text || ':meeting_notes', jsonb_build_object('legacy_deal_log_id', dl.id)
FROM deal_logs dl
JOIN crm_deals d ON d.legacy_deal_log_id = dl.id
WHERE dl.meeting_notes IS NOT NULL
  AND trim(dl.meeting_notes) <> ''
ON CONFLICT (workspace_id, source, external_id) DO UPDATE
SET body = excluded.body,
    summary = excluded.summary;

INSERT INTO crm_activities (
  workspace_id,
  deal_id,
  company_id,
  type,
  source,
  title,
  body,
  summary,
  occurred_at,
  created_by,
  external_id,
  metadata
)
SELECT d.workspace_id, d.id, d.company_id, 'note'::crm_activity_type, 'legacy_backfill',
       'Legacy notes', dl.notes, left(dl.notes, 300), coalesce(dl.updated_at, dl.created_at),
       dl.user_id, 'legacy:' || dl.id::text || ':notes', jsonb_build_object('legacy_deal_log_id', dl.id)
FROM deal_logs dl
JOIN crm_deals d ON d.legacy_deal_log_id = dl.id
WHERE dl.notes IS NOT NULL
  AND trim(dl.notes) <> ''
ON CONFLICT (workspace_id, source, external_id) DO UPDATE
SET body = excluded.body,
    summary = excluded.summary;

INSERT INTO crm_activities (
  workspace_id,
  deal_id,
  company_id,
  type,
  source,
  title,
  body,
  summary,
  occurred_at,
  created_by,
  external_id,
  metadata
)
SELECT d.workspace_id, d.id, d.company_id, 'note'::crm_activity_type, 'legacy_backfill',
       'HubSpot notes', dl.hubspot_notes, left(dl.hubspot_notes, 300),
       coalesce(dl.updated_at, dl.created_at), dl.user_id,
       'legacy:' || dl.id::text || ':hubspot_notes', jsonb_build_object('legacy_deal_log_id', dl.id)
FROM deal_logs dl
JOIN crm_deals d ON d.legacy_deal_log_id = dl.id
WHERE dl.hubspot_notes IS NOT NULL
  AND trim(dl.hubspot_notes) <> ''
ON CONFLICT (workspace_id, source, external_id) DO UPDATE
SET body = excluded.body,
    summary = excluded.summary;

INSERT INTO crm_activities (
  workspace_id,
  deal_id,
  company_id,
  type,
  source,
  title,
  body,
  summary,
  occurred_at,
  created_by,
  external_id,
  metadata
)
SELECT d.workspace_id, d.id, d.company_id, 'stage_change'::crm_activity_type, 'legacy_backfill',
       'Legacy stage: ' || replace(dl.stage::text, '_', ' '), NULL, NULL,
       coalesce(dl.updated_at, dl.created_at), dl.user_id,
       'legacy:' || dl.id::text || ':stage',
       jsonb_build_object('legacy_stage', dl.stage::text, 'legacy_deal_log_id', dl.id)
FROM deal_logs dl
JOIN crm_deals d ON d.legacy_deal_log_id = dl.id
ON CONFLICT (workspace_id, source, external_id) DO NOTHING;

WITH todo_source AS (
  SELECT d.workspace_id, d.id AS deal_id, d.company_id, d.owner_id, todo.value AS todo, todo.ordinality
  FROM deal_logs dl
  JOIN crm_deals d ON d.legacy_deal_log_id = dl.id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(dl.todos) = 'array' THEN dl.todos ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS todo(value, ordinality)
), normalized AS (
  SELECT workspace_id, deal_id, company_id, owner_id,
         nullif(trim(coalesce(todo->>'text', todo->>'title')), '') AS title,
         CASE WHEN lower(coalesce(todo->>'completed', 'false')) = 'true'
           THEN 'done'::crm_task_status
           ELSE 'todo'::crm_task_status
         END AS status,
         CASE WHEN coalesce(todo->>'createdAt', '') ~ '^\d{4}-\d{2}-\d{2}'
           THEN (todo->>'createdAt')::timestamptz
           ELSE NULL
         END AS due_at
  FROM todo_source
)
INSERT INTO crm_tasks (
  workspace_id,
  deal_id,
  company_id,
  assigned_to,
  title,
  due_at,
  status,
  priority,
  source,
  created_at,
  updated_at
)
SELECT workspace_id, deal_id, company_id, owner_id, title, due_at, status,
       'normal'::crm_task_priority, 'legacy_backfill', now(), now()
FROM normalized n
WHERE title IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM crm_tasks existing
    WHERE existing.workspace_id = n.workspace_id
      AND existing.deal_id = n.deal_id
      AND existing.source = 'legacy_backfill'
      AND lower(existing.title) = lower(n.title)
  );

INSERT INTO crm_tasks (
  workspace_id,
  deal_id,
  company_id,
  assigned_to,
  title,
  due_at,
  status,
  priority,
  source,
  created_at,
  updated_at
)
SELECT d.workspace_id, d.id, d.company_id, d.owner_id, dl.next_steps, dl.close_date,
       'todo'::crm_task_status, 'high'::crm_task_priority, 'legacy_next_step', now(), now()
FROM deal_logs dl
JOIN crm_deals d ON d.legacy_deal_log_id = dl.id
WHERE dl.next_steps IS NOT NULL
  AND trim(dl.next_steps) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM crm_tasks existing
    WHERE existing.workspace_id = d.workspace_id
      AND existing.deal_id = d.id
      AND existing.source = 'legacy_next_step'
      AND lower(existing.title) = lower(dl.next_steps)
  );

WITH event_source AS (
  SELECT d.workspace_id, d.id AS deal_id, d.company_id, event.value AS event, event.ordinality
  FROM deal_logs dl
  JOIN crm_deals d ON d.legacy_deal_log_id = dl.id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(dl.scheduled_events) = 'array' THEN dl.scheduled_events ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS event(value, ordinality)
), normalized AS (
  SELECT workspace_id, deal_id, company_id,
         coalesce(nullif(trim(event->>'title'), ''), 'Scheduled meeting') AS title,
         nullif(trim(event->>'notes'), '') AS description,
         CASE WHEN coalesce(event->>'date', '') ~ '^\d{4}-\d{2}-\d{2}'
           THEN (event->>'date')::timestamptz
           ELSE now()
         END AS starts_at,
         CASE WHEN jsonb_typeof(event->'attendees') = 'array' THEN event->'attendees' ELSE '[]'::jsonb END AS attendees,
         ordinality
  FROM event_source
)
INSERT INTO crm_calendar_events (
  workspace_id,
  deal_id,
  company_id,
  provider,
  external_id,
  title,
  description,
  starts_at,
  ends_at,
  attendees,
  source,
  metadata,
  created_at,
  updated_at
)
SELECT workspace_id, deal_id, company_id, 'legacy',
       'legacy-event:' || deal_id::text || ':' || ordinality::text,
       title, description, starts_at, starts_at + interval '30 minutes', attendees,
       'legacy_backfill', jsonb_build_object('legacy_source', 'deal_logs.scheduled_events'), now(), now()
FROM normalized
ON CONFLICT (workspace_id, provider, external_id) DO UPDATE
SET title = excluded.title,
    description = excluded.description,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    attendees = excluded.attendees,
    updated_at = now();

INSERT INTO crm_ai_summaries (
  workspace_id,
  deal_id,
  summary_type,
  content,
  evidence,
  confidence,
  generated_by,
  created_at
)
SELECT d.workspace_id, d.id, 'legacy_deal_brief', dl.ai_summary,
       jsonb_build_array(jsonb_build_object('type', 'legacy_deal_log', 'id', dl.id)),
       CASE WHEN dl.conversion_score IS NULL THEN NULL ELSE 80 END,
       'legacy_backfill',
       coalesce(dl.updated_at, dl.created_at)
FROM deal_logs dl
JOIN crm_deals d ON d.legacy_deal_log_id = dl.id
WHERE dl.ai_summary IS NOT NULL
  AND trim(dl.ai_summary) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM crm_ai_summaries existing
    WHERE existing.workspace_id = d.workspace_id
      AND existing.deal_id = d.id
      AND existing.summary_type = 'legacy_deal_brief'
      AND existing.generated_by = 'legacy_backfill'
  );

INSERT INTO crm_signals (
  workspace_id,
  deal_id,
  type,
  strength,
  direction,
  explanation,
  evidence_activity_ids,
  confidence,
  created_at
)
SELECT d.workspace_id, d.id, 'no_next_step'::crm_signal_type, 80, 'negative'::crm_signal_direction,
       'Legacy deal has no recorded next step.', '[]'::jsonb, 90, now()
FROM crm_deals d
WHERE d.status = 'open'
  AND (d.ai_next_action IS NULL OR trim(d.ai_next_action) = '')
  AND NOT EXISTS (
    SELECT 1
    FROM crm_signals s
    WHERE s.deal_id = d.id
      AND s.type = 'no_next_step'
      AND s.explanation = 'Legacy deal has no recorded next step.'
  );

INSERT INTO crm_signals (
  workspace_id,
  deal_id,
  type,
  strength,
  direction,
  explanation,
  evidence_activity_ids,
  confidence,
  created_at
)
SELECT d.workspace_id, d.id, 'close_date_overdue'::crm_signal_type, 85, 'negative'::crm_signal_direction,
       'Expected close date has passed while the deal is still open.', '[]'::jsonb, 90, now()
FROM crm_deals d
WHERE d.status = 'open'
  AND d.expected_close_date IS NOT NULL
  AND d.expected_close_date < now()
  AND NOT EXISTS (
    SELECT 1
    FROM crm_signals s
    WHERE s.deal_id = d.id
      AND s.type = 'close_date_overdue'
      AND s.explanation = 'Expected close date has passed while the deal is still open.'
  );

INSERT INTO crm_signals (
  workspace_id,
  deal_id,
  type,
  strength,
  direction,
  explanation,
  evidence_activity_ids,
  confidence,
  created_at
)
SELECT d.workspace_id, d.id, 'stale_deal'::crm_signal_type, 70, 'negative'::crm_signal_direction,
       'No material activity has been recorded in the last 14 days.', '[]'::jsonb, 85, now()
FROM crm_deals d
WHERE d.status = 'open'
  AND d.last_activity_at IS NOT NULL
  AND d.last_activity_at < now() - interval '14 days'
  AND NOT EXISTS (
    SELECT 1
    FROM crm_signals s
    WHERE s.deal_id = d.id
      AND s.type = 'stale_deal'
      AND s.explanation = 'No material activity has been recorded in the last 14 days.'
  );

COMMIT;
