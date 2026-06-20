# Halvex

Halvex is an LLM-first sales CRM for SME teams. It keeps Clerk authentication, Supabase/Postgres storage, and Stripe billing, then adds a backend-backed CRM workspace for leads, markdown notes, omnichannel message threads, channel connection state, and LLM-generated follow-up drafts.

## Local Setup

```bash
npm install
npm run dev
```

Required production environment variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `OPENAI_API_KEY` | Optional for live LLM drafting. Without it, the app uses a deterministic fallback draft. |

## Database

Apply the Supabase migrations before opening the dashboard in a client environment. The migration folder now contains a clean Halvex baseline plus the CRM backend tables.

```bash
npm run db:push
```

## Checks

```bash
npm run lint
npm run test
npm run build
```
