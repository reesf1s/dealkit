# Halvex CRM Design Reset Plan

## 1. What Is Wrong Now

The current product is technically functional but not commercially convincing. It reads like an internal admin dashboard: grey surfaces, generic cards, empty metrics, cramped kanban columns, and record pages that expose database structure rather than helping a founder decide what to do next.

Specific issues:

- Home is a metrics page, not a daily revenue workspace.
- AI is hidden as an add-on instead of being embedded in meetings, follow-ups, risk, and next actions.
- Calendar is not first-class, even though meetings are the natural CRM entry point for small teams.
- Pipeline cards lack taste, hierarchy, and data-quality states.
- Deal pages feel like admin records rather than a calm deal workspace.
- Scores can look falsely certain when evidence contains unresolved risk, missing value, no close date, or open tasks.
- Empty states feel like absence rather than guided onboarding.

## 2. Screens To Rebuild

Primary rebuild:

- Home: replaces Today as the core first screen.
- Calendar: first-class Google Calendar and sales meeting workflow.
- Pipeline: calmer kanban with better cards, stage summaries, and data-quality states.
- Deal page: AI deal brief, believable score/confidence, risk drivers, timeline, tasks, meetings, and contacts.

Secondary alignment:

- Sidebar and top command bar labels.
- Legacy route redirects.
- Public/product copy only where it supports the new CRM direction.

## 3. Components To Create

New product UI primitives:

- `CrmPageShell`
- `CrmHero`
- `CrmPanel`
- `CrmEmptyAction`
- `CrmMeetingCard`
- `CrmPriorityCard`
- `CrmDealCard`
- `CrmStageColumn`
- `CrmIntelligencePanel`
- `CrmTimeline`
- `CrmScoreBadge`
- `CrmCommandButton`

Design rules:

- Soft neutral background with mountain atmosphere used as a restrained spatial layer.
- White elevated panels with subtle blur, 12-16px radius, and low-noise borders.
- Typography hierarchy that prioritizes decisions, not labels.
- Risk colours used only for risk.
- Empty states are onboarding actions, not zeros.

## 4. Backend To Reuse

Keep:

- Clerk auth and workspace scoping.
- Supabase/Postgres/Drizzle schema.
- Native CRM entities and APIs.
- `buildDealContext`.
- Deterministic signal extraction.
- Deal score and confidence primitives.
- Google Calendar connection/sync APIs.
- CSV import and workspace invite flows.
- Legacy `deal_logs` migration/backfill path.

Refactor only where UX trust requires it:

- Score presentation must separate score from confidence.
- Low-risk presentation must be downgraded when context includes unresolved concerns, missing value, missing close date, no next step, or open risk signals.

## 5. Google Calendar Flow Needed

Calendar must become a core product surface:

- Show connection state prominently on Home and Calendar.
- Sync upcoming Google Calendar events.
- Match attendees to contacts by email.
- Link events to companies and deals where possible.
- Show AI meeting prep from linked CRM context.
- Allow follow-up task creation after a meeting.
- Keep manual deal linking available when matching is uncertain.

## 6. Sellable MVP Acceptance Criteria

The reset is acceptable when:

- Home immediately tells a founder what to do today.
- No primary screen leads with empty zero-metric cards.
- Calendar feels like part of the CRM, not a settings integration.
- Pipeline is calm, scannable, and premium.
- Deal page makes AI useful, visible, and believable.
- Scores never imply false certainty.
- Missing value/close date/next step are shown as clear data-quality states.
- AI statements include confidence or evidence language.
- Screens look good in desktop screenshots without requiring explanation.
- The app feels lighter than HubSpot and more purpose-built than Notion.
