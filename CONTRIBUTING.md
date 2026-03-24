# Contributing to Halvex

## Migration workflow

**`supabase/migrations/` is the source of truth for all schema changes.**

There are two parallel artefacts that represent the database schema:

| Artefact | Purpose | Writable? |
|---|---|---|
| `supabase/migrations/*.sql` | Applied to Postgres; controls the real schema | ✓ Edit this |
| `src/lib/db/schema.ts` | Drizzle ORM schema; TypeScript types only | Sync manually |

### Making a schema change

1. Create a new migration file in `supabase/migrations/` following the naming pattern `NNN_description.sql`.
2. Apply it: `npx supabase db push` (remote) or `npx supabase db reset` (local).
3. Update `src/lib/db/schema.ts` to reflect the change so TypeScript types stay accurate.
4. **Do not** run `drizzle-kit push` or `drizzle-kit generate` against production — Drizzle is used for types only, not as a migration runner.

### Why two systems?

Supabase migrations give us a versioned, reviewable SQL history with rollback capability and RLS policy support. Drizzle provides typed query builders without owning migration control. Keeping Drizzle in "types only" mode prevents accidental schema drift from two competing migration sources.
