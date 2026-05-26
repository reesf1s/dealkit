# Halvex V2 Migration Plan

## Intent

Halvex V2 is a complete customer-product rebuild, not a redesign of the old app. The old dashboard, add-on surfaces, table-heavy pages, and disconnected modules are removed from the primary product workflow. Production CRM data is preserved and migrated into the V2 object model.

## Data To Preserve

Keep all production records for:

- `workspaces`, `users`, `workspace_memberships`, `workspace_invites`
- legacy `deal_logs` as read-only rollback/source data
- native CRM records: `crm_deals`, `crm_companies`, `crm_contacts`, `crm_deal_participants`
- supporting records: `crm_activities`, `crm_tasks`, `crm_notes`, `crm_email_threads`, `crm_calendar_events`
- intelligence records: `crm_ai_summaries`, `crm_signals`, `crm_notifications`
- Google Calendar connection records: `google_connections`
- useful AI/scoring utilities under `src/lib/crm`, `src/lib/ai`, and deterministic signal rules

Do not drop production tables without explicit approval.

## V2 Object Model

The customer product is reduced to four core objects:

- People: backed by `crm_contacts`
- Companies: backed by `crm_companies`
- Deals: backed by `crm_deals`, stages, participants, activities, tasks, summaries, signals
- Meetings: backed by `crm_calendar_events`

Tasks, notes, activities, AI summaries, signals, email threads, and calendar events are supporting context attached to those objects. They are not standalone product modules.

## Current Routes To Remove From Customer Workflow

These routes are legacy product surfaces and should redirect into the V2 CRM loop:

- `/today` -> `/home`
- `/dashboard` -> `/home`
- `/pipeline` -> `/deals?view=pipeline`
- `/contacts` -> `/people`
- `/tasks` -> `/home`
- `/activity` -> `/inbox`
- `/connections` -> `/settings?section=integrations`
- `/company` -> `/companies`
- `/analytics`, `/automations`, `/chat`, `/collateral`, `/competitors`, `/intelligence`, `/models`, `/playbook`, `/product-gaps`, `/workflows`, `/case-studies` -> `/home`

Public/legal/share routes can remain. APIs can remain while V2 depends on them or while legacy migrations need them.

## New V2 Routes

- `/home`: daily revenue cockpit
- `/inbox`: triage for unsorted updates, tasks, meetings, missing data, and AI suggestions
- `/calendar`: meeting-led workflow with Google Calendar connection, prep, and post-meeting updates
- `/deals`: combined Pipeline, List, and Intelligence views
- `/deals/[id]`: Deal Workspace with inline facts, AI brief, intelligence, timeline, and Add Update composer
- `/people`: relationship memory list
- `/people/[id]`: person relationship workspace
- `/companies`: company/account memory list
- `/companies/[id]`: company workspace
- `/assistant`: full assistant workspace
- `/settings`: quiet settings for workspace, members, pipelines, imports, integrations, billing

## Fields To Preserve And Map

- Deal identity: `crm_deals.id`, `title`, `legacy_deal_log_id`
- Deal facts: `company_id`, `pipeline_id`, `stage_id`, `owner_id`, `value_amount`, `expected_close_date`, `status`
- Intelligence: `ai_score`, `ai_confidence`, `ai_risk_level`, `ai_summary`, `ai_next_action`
- Relationship links: `crm_deal_participants`, `crm_contacts.company_id`, `crm_deals.company_id`
- Timeline: `crm_activities`, `crm_tasks`, `crm_notes`, `crm_calendar_events`, `crm_ai_summaries`, `crm_signals`
- Provenance: `source`, `external_id`, `metadata`

## Schema Migration Risks

- Existing native CRM tables are adequate for V2. No destructive schema changes are required for the first V2 cut.
- `crm_deals.ai_next_action` currently doubles as next-action text. If richer next-action ownership/status is needed later, add a separate action table rather than mutating historical tasks.
- Calendar sync is already represented in `crm_calendar_events`; V2 should surface it rather than create a parallel meeting model.
- Inline deal editing needs safe APIs that update only workspace-scoped records.
- Natural-language update parsing should create proposed changes first; important field updates require user confirmation.

## Implementation Sequence

1. Replace the old dashboard layout with `AppShellV2`, `SidebarV2`, `TopCommandBar`, and `AssistantDrawer`.
2. Add V2 components: `HeroPanel`, `RecordHero`, `ActionCard`, `MeetingCard`, `DealCardV2`, `IntelligencePanel`, `TimelineV2`, `AddUpdateComposer`, badges, inline fields, object chips, and suggested-change review.
3. Rebuild `/home`, `/inbox`, `/calendar`, `/deals`, `/deals/[id]`, `/people`, `/people/[id]`, `/companies`, `/companies/[id]`, `/assistant`, and `/settings`.
4. Add workspace-scoped deal update endpoints for inline edits and approved natural-language updates.
5. Redirect legacy customer routes out of the product workflow.
6. Verify typecheck, tests, build, and browser screenshots.
7. Deploy only after V2 compiles and the live app smoke checks pass.

## Acceptance Criteria

- The old blocky admin shell is gone from the customer workflow.
- V2 navigation is only Home, Inbox, Calendar, Deals, People, Companies, Assistant.
- The product reads as one minimal CRM, not many modules.
- Deal Workspace makes updating fields and feeding AI new information obvious.
- AI score, confidence, and risk are visually and conceptually separate.
- No production CRM data is deleted.
