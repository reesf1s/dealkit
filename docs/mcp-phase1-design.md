# Halvex MCP Phase 1 — Design Document

> Brainstorm output. Answers design questions before any code is written.

---

## What we're building

A Linear bidirectional intelligence link:
- Halvex ML matches dying deals to relevant Linear issues
- Rep confirms/dismisses suggestions from the deal page
- Confirmed links update the Linear issue description with deal context
- Links stay in sync via webhooks and nightly cron

---

## Design Decisions

### 1. Product Issues panel location

**File:** `src/app/(dashboard)/deals/[id]/page.tsx`

The deal page has a tabbed layout (Overview, Timeline, etc.). The "Product Issues" panel will be added to the **Overview tab**, after the existing `ProductGapsBanner` component (around line 4766). It renders only when the workspace has Linear connected — non-breaking by design.

The existing `ProductGapsBanner` links product gaps (internal) to deals. The new "Product Issues" panel links Linear issues (external) to deals. They are complementary and should sit adjacent in the UI.

### 2. Linear integration pattern

No full OAuth required — Linear supports **personal API keys** and **workspace API keys** (linear.app → Settings → API). Same pattern as HubSpot "private app token":

- User pastes their Linear API key in Halvex settings
- POST `/api/integrations/linear/connect` validates the key against the Linear GraphQL API
- Saved in a new `linear_integrations` table (same pattern as `hubspot_integrations`)
- Team ID is fetched from the key and stored for issue queries

Routes needed:
- `POST /api/integrations/linear/connect` — save + validate token
- `POST /api/integrations/linear/disconnect` — delete row
- `GET /api/integrations/linear/status` — return connection state
- `POST /api/integrations/linear/sync` — trigger manual issue sync

### 3. Nightly cron

Lives in `vercel.json` (same as existing HubSpot/brain crons). New entry:
```json
{ "path": "/api/cron/linear-match", "schedule": "0 4 * * *" }
```
4 AM daily — avoids contention with existing crons at 2 AM, 3 AM, 6 AM.

### 4. Linear API key encryption

**No existing encryption in the codebase** — HubSpot tokens stored plaintext. PRD mandates AES-256-GCM for Linear keys.

New `src/lib/encrypt.ts`:
- Uses Node.js `crypto` module, no extra dependencies
- `encrypt(plaintext: string, key: Buffer): string` → returns `iv:authTag:ciphertext` (hex-encoded)
- `decrypt(ciphertext: string, key: Buffer): string` → reverses it
- Key derived from `ENCRYPTION_KEY` env var (32-byte hex → Buffer)
- Column `linear_integrations.api_key_enc` stores the encrypted value

### 5. TF-IDF embedding extension

**Existing system:** `EmbeddingCache` (in `semantic-search.ts`) stores:
```ts
{ version: 1, dims: 336, deals: [...], competitors: [...], collateral: [...] }
```

**Extension strategy:** Add `linearIssues` to the cache (version bump to 2):
```ts
linearIssues?: { id: string; vector: number[]; hash: string }[]
```

Backward compatible — old caches without this field will have `linearIssues = undefined`, triggering a recompute.

**New exported function** `embedLinearIssues(workspaceId)` added at the bottom of `semantic-search.ts` (extends, does not modify core logic):
- Loads existing cache
- For each issue in `linear_issues_cache`, compute `embedQuery(title + ' ' + description)`
- Hash-diff skips unchanged issues
- Saves updated cache

**Why `embedQuery` not `embedDeal`?** Linear issues are topic-focused text (feature request, bug), not structured deal data. `embedQuery` applies clean TF-IDF on the raw text, which is exactly right.

### 6. Signal extraction for deals

For each deal being matched, extract objection/gap signals from:
- `dealRisks` (array of strings)
- `notes` (free text)
- `meetingNotes` (free text)
- `lostReason` (if applicable)

Concatenate into a single "signal text", then `embedQuery(signalText)`.

Compare against all `linearIssues` vectors in the cache using `cosineSimilarity`.

### 7. Data model

Four new tables (see `supabase/migrations/002_linear_mcp.sql`):
- `linear_integrations` — one per workspace, stores encrypted API key + team ID
- `linear_issues_cache` — denormalized copy of Linear issues with TF-IDF vectors
- `deal_linear_links` — the link record between a deal and a Linear issue
- `mcp_action_log` — audit log for all MCP actions (scope, email, slack, link)

No columns added to `workspaces` table — cleaner to use a separate table (consistent with `hubspot_integrations` pattern).

### 8. Database / auth patterns

- All DB: Drizzle ORM + postgres-js driver
- All routes: `await auth()` from Clerk → `getWorkspaceContext(userId)` → workspace-scoped queries
- Cron routes: authenticated via `CRON_SECRET` header (standard Vercel pattern)
- Webhook route: authenticated via Linear webhook signature (HMAC-SHA256)

---

## Non-breaking guarantees

- `Product Issues` panel renders only if `linear_integrations` row exists for workspace
- `embedLinearIssues()` is a no-op if no issues in cache
- All new cron/webhook routes are additive — don't touch existing routes
- EmbeddingCache version bump: old cache (v1) will simply be rebuilt on next brain refresh
