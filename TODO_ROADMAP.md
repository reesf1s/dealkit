# Halvex CRM Rebuild Roadmap

## Phase 0: Audit And Foundation

- Native CRM schema added in parallel with legacy data.
- Migration/backfill path created from `deal_logs`.
- Customer app shell switched to CRM sections.
- Google Calendar connection added as the first production integration.

## Phase 1: Production Hardening

- Apply `supabase/migrations/010_native_crm_rebuild.sql` to staging and production before enabling native routes broadly.
- Run `/api/crm/backfill` for each workspace and compare native deal counts against eligible `deal_logs`.
- Add admin-only migration report UI with counts and unmapped legacy fields.
- Add tests for backfill idempotency, workspace scoping, and stage movement activity creation.

## Phase 2: CRM Depth

- Add create/edit drawers for companies, contacts, deals, tasks, and notes.
- Add company/contact detail pages.
- Add CSV import flow into native CRM tables.
- Add invite UI backed by `workspace_invites`.
- Add route-level empty/error/loading states for all native pages.

## Phase 3: AI-Native Experience

- Replace placeholder assistant answers with tool-calling over native CRM functions.
- Persist generated daily briefs in native tables.
- Add AI follow-up drafting composer from deal context.
- Add evidence-linked AI summary regeneration.
- Add signal history and score change timeline.

## Phase 4: Calendar And Activity Automation

- Add scheduled Google Calendar sync.
- Add manual meeting-to-deal linking.
- Add meeting prep briefs from native deal context.
- Add Gmail sync only after calendar and core CRM are stable.

## Phase 5: Legacy Cleanup

- Keep legacy tables until production validation is complete.
- Remove HubSpot/Linear/Slack/product-gap/collateral routes from customer navigation and marketing copy.
- Delete legacy code only after explicit approval and confirmed backups.
