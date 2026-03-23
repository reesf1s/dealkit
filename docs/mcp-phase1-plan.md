# Halvex MCP Phase 1 — Implementation Plan

> Bite-sized 2–5 min tasks with exact file paths, code, and verification commands.

---

## Task 1 — Drizzle schema additions
**File:** `src/lib/db/schema.ts`
Add: `linear_integrations`, `deal_linear_links`, `linear_issues_cache`, `mcp_action_log` tables + enums.
**Verify:** `npx tsc --noEmit`

## Task 2 — SQL migration
**File:** `supabase/migrations/002_linear_mcp.sql`
Raw DDL matching the Drizzle schema, safe to run on Supabase.
**Verify:** Visual review + Drizzle schema alignment

## Task 3 — AES-256-GCM encryption utility
**File:** `src/lib/encrypt.ts`
`encrypt(text, key)` / `decrypt(enc, key)` using Node crypto.
**Verify:** `npx tsc --noEmit`; unit test in vitest

## Task 4 — Linear API client
**File:** `src/lib/linear-client.ts`
GraphQL client wrapping Linear API. Functions:
- `validateApiKey(apiKey)` → `{ teamId, teamName, workspaceName }`
- `fetchTeamIssues(apiKey, teamId, cursor?)` → paginated issues
- `updateIssueDescription(apiKey, issueId, newDescription)` → void
- `getIssue(apiKey, issueId)` → single issue
**Verify:** `npx tsc --noEmit`; unit test with mocked fetch

## Task 5 — Extend EmbeddingCache + embedLinearIssues
**File:** `src/lib/semantic-search.ts` (extend only — add to end)
- Extend `EmbeddingCache` interface with `linearIssues?` array
- Bump `CACHE_VERSION` to 2
- Export `embedLinearIssues(workspaceId)` function
**Verify:** `npx tsc --noEmit`; unit test

## Task 6 — Linear sync function
**File:** `src/lib/linear-sync.ts`
- `syncLinearIssues(workspaceId)` — fetches all team issues via paginated API, upserts to `linear_issues_cache`, calls `embedLinearIssues`
- Returns `{ synced: number, embedded: number }`
**Verify:** `npx tsc --noEmit`

## Task 7 — Signal match function
**File:** `src/lib/linear-signal-match.ts`
- `matchDealToIssues(workspaceId, dealId)` — extracts deal signal text, computes cosine sim against linear issue embeddings, upserts `deal_linear_links` with appropriate status
- Returns `{ linked: number, suggested: number }`
- `matchAllAtRiskDeals(workspaceId)` — runs matchDealToIssues for all open deals with health < 80
**Verify:** `npx tsc --noEmit`; unit test with synthetic vectors

## Task 8 — API: linear integration routes
**Files:**
- `src/app/api/integrations/linear/connect/route.ts`
- `src/app/api/integrations/linear/disconnect/route.ts`
- `src/app/api/integrations/linear/status/route.ts`
- `src/app/api/integrations/linear/sync/route.ts`
**Verify:** `npx tsc --noEmit`

## Task 9 — API: deal linear links routes
**Files:**
- `src/app/api/deals/[id]/linear-links/route.ts` — GET (list links), POST (manual link)
- `src/app/api/deals/[id]/linear-links/[linkId]/confirm/route.ts` — POST
- `src/app/api/deals/[id]/linear-links/[linkId]/dismiss/route.ts` — POST
**Verify:** `npx tsc --noEmit`

## Task 10 — API: cron + webhook
**Files:**
- `src/app/api/cron/linear-match/route.ts` — runs matchAllAtRiskDeals for all workspaces
- `src/app/api/webhooks/linear/route.ts` — receives Linear webhooks, updates cache
**Verify:** `npx tsc --noEmit`

## Task 11 — UI: ProductIssuesPanel component
**File:** `src/components/deals/ProductIssuesPanel.tsx`
Panel showing linked/suggested Linear issues on the deal page.
Confirm/dismiss buttons call the routes from Task 9.
**Verify:** `npx tsc --noEmit`

## Task 12 — UI: Wire panel into deal page
**File:** `src/app/(dashboard)/deals/[id]/page.tsx`
Import and render `ProductIssuesPanel` in the Overview tab after `ProductGapsBanner`.
**Verify:** `npx tsc --noEmit`; visual check in browser

## Task 13 — UI: Settings page Linear section
**File:** `src/app/(dashboard)/settings/page.tsx`
Add Linear connect/disconnect UI block (same pattern as HubSpot section).
**Verify:** `npx tsc --noEmit`; visual check in browser

## Task 14 — vercel.json: cron entry
**File:** `vercel.json`
Add `{ "path": "/api/cron/linear-match", "schedule": "0 4 * * *" }`.
**Verify:** JSON valid

## Task 15 — Deal note save hook
**File:** `src/app/api/deals/[id]/route.ts` (PATCH handler)
After saving notes, fire-and-forget `matchDealToIssues(workspaceId, dealId)` for the updated deal.
**Verify:** `npx tsc --noEmit`

## Task 16 — Vitest setup + unit tests
**Files:**
- `vitest.config.ts`
- `src/lib/__tests__/encrypt.test.ts`
- `src/lib/__tests__/linear-signal-match.test.ts`
**Verify:** `npx vitest run`

## Task 17 — Full TypeScript check
`npx tsc --noEmit` — must exit 0.
