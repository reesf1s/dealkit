# MCP Phase 2 — Implementation Plan

**Branch:** `feat/mcp-phase2`
**Worktree:** `.claude/worktrees/halvex-mcp-phase2`

Each task is bite-sized, independently verifiable, and follows TDD (write test stub → implement → verify via tsc mental check).

---

## Task 1: DB Schema + Supabase Migration

**Files:**
- `src/lib/db/schema.ts` — add `slackConnections`, `slackUserMappings` tables + row types

**What to do:**
1. Add `slackConnections` table (after the `mcpActionLog` table)
2. Add `slackUserMappings` table
3. Add relations
4. Export row types
5. Apply Supabase migration (project: `glkvrweabeilwnrpzqxg`)

**Verification:**
- Mental tsc: schema compiles with no unknown references
- Supabase migration applied successfully

---

## Task 2: `src/lib/slack-client.ts`

**What to do:**
1. `getSlackBotToken(workspaceId)` — decrypt token from `slack_connections`
2. `verifySlackRequest(body, timestamp, signature)` — HMAC-SHA256 with replay guard
3. `slackPostMessage(token, channel, blocks, text?)` — POST to `chat.postMessage`
4. `slackPostEphemeral(token, channel, user, text)` — error/fallback messages
5. `slackOpenDm(token, userId)` — opens DM channel, returns channel ID

**Verification:**
- All function signatures typed, no `any`
- `verifySlackRequest` handles missing env var gracefully
- Missing `SLACK_SIGNING_SECRET` → throws descriptive error

---

## Task 3: `src/lib/mcp-tools.ts`

Four intelligence functions that call existing brain/DB logic:

1. `getDealHealth(workspaceId, query)` → `DealHealthResult`
   - Uses `getRelevantContext()` from `agent-context.ts` to find deal by name
   - Returns score, trend, risks, recommended actions from brain

2. `findAtRiskDeals(workspaceId)` → `AtRiskResult[]`
   - Reads from `workspaceBrain.scoreAlerts` + `workspaceBrain.staleDeals` + `workspaceBrain.urgentDeals`

3. `getLinkedIssues(workspaceId, query)` → `LinkedIssueResult`
   - Finds relevant deal, queries `deal_linear_links` for that deal

4. `getWinLossSignals(workspaceId)` → `WinLossResult`
   - Reads `workspaceBrain.winIntelligence` and `workspaceBrain.lossIntelligence`

**Verification:**
- Return types fully defined (no `any`)
- Each function handles: no brain data, no deals found, no workspace

---

## Task 4: `src/lib/slack-intent.ts` + `src/lib/slack-blocks.ts`

**slack-intent.ts:**
- `classifyIntent(text)` → `{ intent: SlackIntent, query: string }`
- Pattern matching against 4 intents + unknown fallback
- Export `SlackIntent` type

**slack-blocks.ts:**
- `dealHealthBlocks(result)` — header + score + trend + risks + action buttons (links)
- `atRiskBlocks(results)` — list of at-risk deals
- `linkedIssuesBlocks(result)` — issue list with badges
- `winLossBlocks(result)` — win/loss signals
- `errorBlocks(message)` — friendly error
- `fallbackBlocks()` — unknown intent help text

**Verification:**
- All Block Kit types satisfy Slack's structure (header, section, context, actions)
- No `any` types used

---

## Task 5: OAuth Routes

**Files:**
- `src/app/api/integrations/slack/install/route.ts`
- `src/app/api/integrations/slack/callback/route.ts`
- `src/app/api/integrations/slack/status/route.ts`
- `src/app/api/integrations/slack/disconnect/route.ts`

**install route:** Redirect to Slack OAuth URL with correct scopes
**callback route:** Exchange code → store encrypted bot token → redirect to `/settings?slack=connected`
**status route:** Returns `{ connected, teamName, teamId, installedBy }` or `{ connected: false }`
**disconnect route:** Delete row from `slack_connections`

**Verification:**
- Missing `SLACK_CLIENT_ID/SECRET` → 503 with clear message (not crash)
- Auth check: all routes require Clerk user
- Callback handles `error` query param from Slack

---

## Task 6: `src/app/api/webhooks/slack/events/route.ts`

**What to do:**
1. Read raw body, verify `X-Slack-Signature`
2. Return 200 immediately for `url_verification` challenge
3. For `event_callback`: look up workspace by `team_id`, return 200 immediately
4. Dispatch async based on `event.type`:
   - `app_mention` → extract text after `<@BOT_ID>`, classify + respond
   - `message.im` → classify + respond
5. Never 500 — catch all errors

**Verification:**
- URL verification challenge works (echoes back `challenge` field)
- Async processing doesn't block 200 response
- Invalid signature → 400 (not 500)

---

## Task 7: `src/app/api/webhooks/slack/commands/route.ts`

**What to do:**
1. Parse `application/x-www-form-urlencoded` body
2. Verify Slack signature
3. Return immediate 200 with `{ response_type: "ephemeral", text: "Working on it…" }`
4. Async: classify intent → dispatch tool → format blocks → POST to `response_url`

**Verification:**
- Returns within 1s (Slack's 3s limit — well under)
- `response_url` POST fires correctly
- Unknown workspace (not connected) → helpful fallback message

---

## Task 8: `src/lib/slack-notify.ts` + Wire Notifications

**slack-notify.ts:**
- `notifyHealthDrop(workspaceId, alert)` — for each score alert, DM mapped users
- `notifyNewIssueLink(workspaceId, dealId, issue)` — DM on high-relevance link

**Wire into:**
- `src/lib/workspace-brain.ts` — at end of rebuild, after `scoreAlerts` are computed:
  ```ts
  import { notifyHealthDrop } from './slack-notify'
  // fire-and-forget, non-blocking
  Promise.resolve().then(() => {
    for (const alert of brain.scoreAlerts) {
      notifyHealthDrop(workspaceId, alert).catch(console.error)
    }
  })
  ```
- `src/lib/linear-signal-match.ts` — after inserting a new link with relevanceScore ≥ 80

**Verification:**
- `notifyHealthDrop` no-ops gracefully if no `slack_connections` row exists
- Never throws or blocks brain rebuild
- Only fires for `notify_health_drops = true` users

---

## Task 9: Settings UI

**File:** `src/app/(dashboard)/settings/page.tsx`

**What to add:**
- After the Linear SectionCard, add a Slack SectionCard
- Connected state: shows Slack team name, connected badge, Disconnect button
- Disconnected state: "Connect Slack" button → links to `/api/integrations/slack/install`
- Uses same pattern as Linear section (SWR `mutateSlack`, state vars)
- New state vars: `slack` (status), `slackDisconnecting`, `mutateSlack`

**Verification:**
- No modification to any other existing logic
- Compiles without new imports breaking
- Displays correctly for connected/disconnected state

---

## Code Review Checklist (between each task)

**Critical:** TypeScript errors, security issues (signature bypass, unencrypted secrets), 500 to Slack
**Major:** Missing env var guard, missing error handling, async not fire-and-forget
**Minor:** Inconsistent naming, missing log lines, overly long functions

---

## Pre-Push Final Checks

1. [ ] Supabase migration applied
2. [ ] All new routes check for missing env vars
3. [ ] No `any` types introduced
4. [ ] All Slack routes return 200 immediately (never 500)
5. [ ] `slack-notify.ts` hooks are non-blocking (fire-and-forget)
6. [ ] Settings UI compiles (new state vars, SWR fetcher)
7. [ ] Push to `feat/mcp-phase2` → merge to main → Vercel READY
