# Contributing to Halvex

## Schema changes

The live application schema is represented in two places:

| Artefact | Purpose |
|---|---|
| `src/lib/db/schema.ts` | Drizzle ORM schema used by the app and TypeScript |
| `supabase/migrations/*.sql` | Reviewable SQL history for client database setup |

### Making a schema change

1. Update `src/lib/db/schema.ts`.
2. Add or update the matching SQL migration in `supabase/migrations/`.
3. Run `npm run lint`, `npm run test`, and `npm run build`.
4. For a provisioned environment, apply the schema with the agreed deployment flow. `npm run db:push` is available for controlled Drizzle-backed environments.

Keep the schema focused on the current product: auth/workspaces, Stripe billing state, CRM leads, markdown notes, messages, channel connection state, tasks, activities, and AI action history.
