# Halvex

AI-powered deal intelligence platform. Halvex is an MCP layer connecting sales and product via Linear, Slack, and HubSpot. It scores live deals, surfaces objection patterns, and closes the loop between what prospects say and what gets built.

## What it does

- **Deal scores** — composite win-probability (text signals + local ML + global Bayesian prior) on every open deal
- **Objection engine** — extracts objections from notes, maps them to case studies and battle cards
- **Product gap loop** — links deal friction to Linear issues and notifies sales on deployment via Slack
- **Knowledge base** — company profile, competitors, case studies, and collateral kept fresh automatically

## Local setup

**1. Install**
```bash
npm install
```

**2. Environment variables** — copy `.env.example` to `.env.local`:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | Supabase service role key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✓ | Clerk key (`pk_test_…` dev / `pk_live_…` prod) |
| `CLERK_SECRET_KEY` | ✓ | Clerk secret key |
| `ANTHROPIC_API_KEY` | ✓ | Anthropic API key |
| `STRIPE_SECRET_KEY` | ✓ | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | ✓ | Stripe webhook signing secret |
| `SENTRY_DSN` | — | Sentry DSN — omit to disable error tracking |

**3. Run migrations** (Supabase is source of truth for schema):
```bash
npx supabase db push        # against remote
# or: npx supabase db reset  # local dev
```

**4. Start dev server**
```bash
npm run dev
```

## Architecture

```
src/app/           Next.js App Router pages + API routes
src/components/    React UI (deals, pipeline, dashboard)
src/lib/
  db/              Drizzle schema + typed DB client
  ml/              Composite score, text-signal extraction
  deal-ml.ts       Per-workspace logistic regression
  global-model.ts  Cross-workspace Bayesian prior (nightly cron)
  workspace-brain.ts  RAG knowledge compression
  slack-agent.ts   Slack MCP event handlers
supabase/migrations/  SQL migrations — schema source of truth
```

### Score model

Win-probability blends three components: text signals (always on), local ML logistic regression (activates at 10 closed deals), and a global cross-workspace Bayesian prior (blends down as local data grows, requires 50 pool deals to train). See `src/lib/ml/composite-score.ts` and `src/lib/global-model.ts`.

### Migration workflow

`supabase/migrations/` is the schema source of truth. The Drizzle schema in `src/lib/db/schema.ts` is kept in sync manually for TypeScript type generation only — do not run `drizzle-kit push` against production. See `CONTRIBUTING.md`.

## Integrations

Clerk (auth), Supabase + pgvector (DB + embeddings), Anthropic Claude (AI), Linear MCP (product gaps), Slack MCP (closed-loop delivery), HubSpot (CRM sync), Stripe (billing).
