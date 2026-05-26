# Halvex CRM

Halvex CRM is an AI-native CRM for small teams who hate CRM admin. It keeps pipeline, contacts, tasks, activity, and deal intelligence in one fast workspace so founders and sales teams can see what changed and what to do next.

## Current Product Direction

- Native CRM records: companies, contacts, deals, pipelines, activities, tasks, notes, signals, AI summaries, notifications, and calendar events.
- Today view: priorities, at-risk deals, stale deals, overdue tasks, upcoming meetings, and a daily sales brief foundation.
- Pipeline: kanban stages, stage totals, quick deal creation, risk indicators, and stage movement activity.
- Deal intelligence: native deal context, deterministic signals, simple scoring, risk labels, summaries, and evidence references.
- Migration path: legacy `deal_logs` are shadow-backfilled into native CRM tables. Legacy tables are preserved until an explicit production deletion decision.
- Google Calendar: OAuth connection and upcoming-event sync for meeting visibility.

## Local Setup

**1. Install**
```bash
npm install
```

**2. Environment variables** — copy `.env.example` to `.env.local`.

Required for core app:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase service role key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | yes | Clerk secret key |
| `ANTHROPIC_API_KEY` | yes | Anthropic API key |
| `ENCRYPTION_KEY` | yes | 64-char hex key for OAuth token encryption |
| `GOOGLE_CLIENT_ID` | calendar | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | calendar | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | billing | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | billing | Stripe webhook signing secret |
| `SENTRY_DSN` | no | Sentry DSN |

**3. Run migrations**
```bash
npx supabase db push
```

The native CRM schema lives in `supabase/migrations/010_native_crm_rebuild.sql` and is mirrored in `src/lib/db/schema.ts`.

**4. Start the app**
```bash
npm run dev
```

**5. Seed local CRM demo data**
```bash
HALVEX_ALLOW_DEV_SEED=true npm run seed:crm:dev
```

The seed command is blocked in production environments.

## Production Migration Flow

1. Apply the native CRM migration to staging.
2. Run the idempotent CRM backfill from Settings or `POST /api/crm/backfill`.
3. Validate migration health through Settings or `GET /api/crm/backfill/validate`.
4. Confirm native deal count, mapped legacy deals, company fallbacks, and workspace scoping.
5. Switch customer workflows to native CRM routes only after validation is clear.

## Useful Commands

```bash
npm test
npx tsc --noEmit
npm run build
```

`npm run lint` still includes legacy/generated surfaces and should be cleaned separately before making lint a release gate.

## Architecture

```text
src/app/                    Next.js App Router pages and API routes
src/app/api/crm/            Native CRM API surface
src/app/api/integrations/   Google Calendar and retained integration endpoints
src/components/             Shared app UI
src/lib/crm/                CRM services, migration backfill, scoring, signals, calendar sync
src/lib/db/                 Drizzle schema and DB client
supabase/migrations/        SQL migrations
```

See `MIGRATION_NOTES.md` and `TODO_ROADMAP.md` for the rebuild audit, preserved infrastructure, cutover plan, and remaining launch hardening work.
