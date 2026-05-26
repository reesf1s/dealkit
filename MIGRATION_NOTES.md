# Halvex CRM Migration Notes

## Product Direction

Halvex is moving from a CRM add-on/deal-intelligence layer to a native AI CRM for small teams. The old product shape is no longer the target UI, but its data and intelligence primitives remain valuable.

## Reuse

- **Auth/workspace:** Clerk auth, `users`, `workspaces`, `workspace_memberships`, and `getWorkspaceContext`.
- **Database:** Supabase Postgres, pgvector, Drizzle schema/types, and Vercel deployment setup.
- **AI primitives:** deterministic text signals, score concepts, existing OpenAI/Vercel AI SDK wrapper, embeddings, and evidence-grounded deal context patterns.
- **UI tokens:** existing quiet operator design system, sidebar shell, command palette, and Operator UI primitives.
- **Legacy data:** all records in `deal_logs`, embedded contacts, notes, todos, scheduled events, scores, summaries, HubSpot-imported fields, and activity-like records.

## Refactor

- **Deal context:** replace legacy `deal_logs` context with native CRM `buildDealContext` from `src/lib/crm/deal-context.ts`, backed by `getDealContextNative`, joining deals, companies, contacts, activities, tasks, meetings, summaries, and signals.
- **Scoring/signals:** keep simple deterministic scoring and signal extraction for V1; treat the complex ML layer as internal/optional until native CRM usage proves the model needs it.
- **Pipeline:** move from `workspace.pipeline_config` + `deal_logs.stage` to `crm_pipelines`, `crm_pipeline_stages`, and `crm_deals.stage_id`.
- **Tasks/activity:** move from JSON todos and note blobs into `crm_tasks`, `crm_activities`, `crm_notes`, and `crm_calendar_events`.

## Replace

- Customer-facing navigation and pages now target Today, Pipeline, Deals, Companies, Contacts, Tasks, Activity, Assistant, and Settings.
- Native CRM APIs live under `/api/crm/*`.
- Google Calendar replaces CRM-sync-first thinking for the first production integration.

## Remove From Customer Product

- HubSpot as primary product workflow.
- Linear/product-gap/collateral/Slack-loop positioning and navigation.
- Old “deal intelligence layer for your CRM” copy.
- Enterprise forecasting/reporting emphasis.

Legacy code and tables remain in place until an explicit deletion approval.

## Production Data Sources Feeding Legacy `deal_logs`

- Manual deal creation and updates through `/api/deals`.
- HubSpot sync through `/api/integrations/hubspot/*` and `/api/cron/hubspot-sync`.
- Inbound email append flow through `/api/inbound-email`.
- Deal note analysis routes that write meeting notes, scheduled events, AI summaries, todos, and score fields.
- Existing seed/demo SQL in `scripts/demo-data.sql` for local/demo use only.

## Migration Strategy

The migration is additive and shadow-based:

1. Add native CRM tables in parallel.
2. Create or reuse a default native pipeline per workspace.
3. Backfill each legacy `deal_logs` row into a native `crm_deals` row with `legacy_deal_log_id`.
4. Infer `crm_companies` from `prospect_company`.
5. Infer `crm_contacts` from primary prospect fields and embedded contacts JSON.
6. Convert legacy notes, HubSpot notes, todos, scheduled events, summaries, and scores into native activity/task/calendar/AI/signal records where possible.
7. Switch customer pages to native reads.
8. Keep legacy tables for rollback and audit.

## Current Implementation State

- Native CRM tables and Drizzle types are added.
- `/api/crm/*` routes serve Today, Pipeline, Deals, Companies, Contacts, Tasks, Activity, Assistant, and backfill.
- Customer navigation has been switched to the native CRM shape.
- Google Calendar OAuth/sync routes are added and store meetings in `crm_calendar_events`.
- Existing client data is preserved; no legacy table drops are included.
