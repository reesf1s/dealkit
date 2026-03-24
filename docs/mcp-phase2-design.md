# MCP Phase 2 — Slack Gateway: Design Document

**Date:** 2026-03-23
**Branch:** `feat/mcp-phase2`
**Follows:** Phase 1 (Linear bidirectional link — merged to main)

---

## Overview

Phase 2 adds a Slack bot to the Halvex MCP. Sales reps can query deal intelligence conversationally and receive proactive DM notifications when deals need attention. The bot is the conversational surface layer over the existing Workspace Brain and MCP tool logic.

---

## What We're Building

```
Slack user → message / slash command
           → /api/webhooks/slack/events or /api/webhooks/slack/commands
           → verifySlackRequest()          (HMAC-SHA256 guard)
           → look up workspace via slack_team_id → slack_connections table
           → classifyIntent()              (pattern-based)
           → dispatch to mcp-tools.ts      (calls existing brain/DB logic)
           → formatBlocks()                (Block Kit)
           → chat.postMessage or response_url
```

Proactive path:
```
Brain rebuild → scoreAlerts detected → slack-notify.ts → DM to mapped users
Linear signal match → high-relevance link created → DM notification
```

---

## New DB Tables

### `slack_connections`
One per workspace. Stores the bot token (AES-256-GCM encrypted) and Slack team metadata.

```sql
CREATE TABLE slack_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  slack_team_id   text NOT NULL UNIQUE,
  slack_team_name text,
  bot_token_enc   text NOT NULL,      -- AES-256-GCM encrypted via encrypt.ts
  installed_by    text,               -- Clerk user ID
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### `slack_user_mappings`
Maps Clerk user → Slack user for DM delivery. Stores per-user notification prefs.

```sql
CREATE TABLE slack_user_mappings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  clerk_user_id           text NOT NULL,
  slack_user_id           text NOT NULL,
  notify_health_drops     boolean DEFAULT true,
  notify_issue_links      boolean DEFAULT true,
  notify_stale_deals      boolean DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, clerk_user_id)
);
```

---

## New Files

| File | Purpose |
|---|---|
| `src/lib/db/schema.ts` | Add `slackConnections`, `slackUserMappings` tables + row types |
| `src/lib/slack-client.ts` | Slack Web API wrapper (`postMessage`, `postEphemeral`), `verifySlackRequest()` |
| `src/lib/slack-intent.ts` | Pattern-based intent classifier |
| `src/lib/slack-blocks.ts` | Block Kit formatters for deal health, at-risk list, linked issues, win/loss |
| `src/lib/mcp-tools.ts` | Intelligence functions: `getDealHealth`, `findAtRiskDeals`, `getLinkedIssues`, `getWinLossSignals` |
| `src/lib/slack-notify.ts` | `notifyHealthDrop()`, `notifyNewIssueLink()` — called from brain/cron |
| `src/app/api/integrations/slack/install/route.ts` | Redirect to Slack OAuth |
| `src/app/api/integrations/slack/callback/route.ts` | OAuth callback, store bot token |
| `src/app/api/integrations/slack/status/route.ts` | GET connection status |
| `src/app/api/integrations/slack/disconnect/route.ts` | POST disconnect |
| `src/app/api/webhooks/slack/events/route.ts` | Slack Events API handler |
| `src/app/api/webhooks/slack/commands/route.ts` | `/halvex` slash command handler |
| `src/app/(dashboard)/settings/page.tsx` | Add Slack section (Connect button, status) |

---

## Intent Classification

Pattern-based (no LLM needed for MVP). Patterns are tested against lowercased message text.

| Intent | Patterns | Tool |
|---|---|---|
| `deal_health` | `/how is.*deal/`, `/health.*\b(\w+)\b/`, `/deal.*score/`, company name mentioned | `getDealHealth` |
| `at_risk` | `/at.?risk/`, `/need attention/`, `/dying deals?/`, `/deals?.*(need|worry|concern)/` | `findAtRiskDeals` |
| `linked_issues` | `/what can.*build/`, `/issues?.*(for\|to\|convert)/`, `/linear/`, `/feature gap/` | `getLinkedIssues` |
| `win_loss` | `/why.*los/`, `/win.*loss/`, `/los.*rate/`, `/what.*winning/` | `getWinLossSignals` |
| `unknown` | fallback | graceful message |

---

## Block Kit Response Design

### Deal Health Response
```
╔══════════════════════════════════════╗
║ 🔴 Coca-Cola Deal — Health Score: 61  ║  ← header
╟──────────────────────────────────────╢
║ Trend: ↓ Declining (was 74 last week) ║  ← context block
╟──────────────────────────────────────╢
║ Top Risks:                            ║
║ • No activity in 12 days              ║  ← section
║ • Champion not confirmed              ║
╟──────────────────────────────────────╢
║ [View Deal]  [Get Actions]            ║  ← actions (links)
╚══════════════════════════════════════╝
```

### At-Risk Deals
```
⚠️ *5 deals need attention*
• Coca-Cola (61) — No activity 12d
• Acme Corp (44) — Competitor entered
• TechCorp (38) — Close date in 2 days
...
[View Pipeline]
```

### Linked Issues (for a deal)
```
🔗 *Issues relevant to Coca-Cola*
• ENG-42 — Single sign-on support (relevance: 94%) ✅ Confirmed
• ENG-81 — Audit log export (relevance: 76%) 💡 Suggested
[Confirm ENG-42]  [Add to Cycle]
```

### Win/Loss Signals
```
📊 *Why you're winning / losing*
✅ Win reasons: Budget confirmed early · Strong champion · Fast POC
❌ Loss reasons: Missing SSO · Competitor pricing · Slow response
```

---

## OAuth Flow

1. User clicks "Connect Slack" in settings → GET `/api/integrations/slack/install`
2. Route redirects to `https://slack.com/oauth/v2/authorize?client_id=...&scopes=...&redirect_uri=...`
3. Slack redirects back to `/api/integrations/slack/callback?code=...`
4. Exchange code for bot token via `oauth.v2.access`
5. Encrypt bot token with `encrypt()`, store in `slack_connections`
6. Redirect to `/settings?slack=connected`

**Required scopes:** `chat:write`, `commands`, `im:history`, `im:read`, `im:write`, `app_mentions:read`

**Redirect URI:** `https://your-domain.com/api/integrations/slack/callback`

---

## Request Verification

All Slack webhook routes must verify the `X-Slack-Signature` header before processing:

```
HMAC-SHA256(SLACK_SIGNING_SECRET, "v0:" + timestamp + ":" + rawBody)
```

- Check `X-Slack-Request-Timestamp` is within 5 minutes (replay attack prevention)
- Compare with constant-time comparison
- Return 400 if invalid — never 500 (Slack retries aggressively on 5xx)

---

## Async Processing Pattern

Slack requires a 200 within 3 seconds. All event/command handlers:
1. Verify signature
2. Return `200 OK` immediately (with `{ "text": "Working on it…" }` for commands)
3. Do actual work asynchronously in a `Promise` that does NOT block the response

Pattern: `after()` from `next/server` OR fire-and-forget with `fetch(response_url, ...)`.

---

## Proactive Notifications

### Trigger 1: Health Drop ≥ 10 pts
- Hook into brain rebuild completion (end of `rebuildWorkspaceBrain()`)
- Compare `brain.scoreAlerts` (already computed, threshold ≥ 10)
- For each alert: look up `slack_user_mappings` for workspace members who opted in
- Send DM to each mapped user

### Trigger 2: High-Relevance Issue Link Created
- Hook into `matchAllOpenDeals()` in `src/lib/linear-signal-match.ts`
- After inserting a new `deal_linear_links` row with `relevanceScore ≥ 80`
- Look up mapped Slack users, send DM

### DM format:
```
⚠️ *Coca-Cola deal* health dropped from 74 → 61
Top risk: No activity in 12 days
[View deal]  [Get recommended actions]
```

---

## Error Handling Rules

- **Never 500 to Slack** — all routes catch and return 200/400 with error text
- **Missing env vars** — check for `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` at route entry; return a clear JSON `{ error: "Slack app not configured" }` with `503`
- **No connection found** — return helpful "Slack not connected for this workspace" message
- **Intent unknown** — return graceful fallback: "I didn't understand that. Try: 'how is the Acme deal?' or 'what deals need attention?'"

---

## Environment Variables

Add these to Vercel (user must create the Slack app first):

| Var | Where to get it |
|---|---|
| `SLACK_CLIENT_ID` | Slack app dashboard → Basic Information → App Credentials |
| `SLACK_CLIENT_SECRET` | Slack app dashboard → Basic Information → App Credentials |
| `SLACK_SIGNING_SECRET` | Slack app dashboard → Basic Information → App Credentials |

---

## Slack App Setup Instructions (for user)

1. Go to https://api.slack.com/apps → **Create New App** → **From scratch**
2. Name: "Halvex" — pick your workspace
3. **OAuth & Permissions** → Bot Token Scopes:
   - `chat:write` — send messages
   - `commands` — slash commands
   - `im:history` — read DMs
   - `im:read` — DM channel info
   - `im:write` — open DM channels
   - `app_mentions:read` — @mentions
4. **Event Subscriptions** → Enable, set Request URL to `https://your-domain.com/api/webhooks/slack/events`
   - Subscribe to bot events: `app_mention`, `message.im`
5. **Slash Commands** → `/halvex` → Request URL: `https://your-domain.com/api/webhooks/slack/commands`
6. **OAuth & Permissions** → Redirect URLs → add `https://your-domain.com/api/integrations/slack/callback`
7. Copy **Client ID**, **Client Secret**, **Signing Secret** → add to Vercel env vars
8. **Install App** → copy Bot User OAuth Token (used by the OAuth flow, not needed manually)

---

## TypeScript Safety Notes

- All Slack API payloads typed as interfaces (no `any`)
- `slackConnections` / `slackUserMappings` added to schema + inferred row types exported
- Env var checks at request time (not module load) — same pattern as `getEncryptionKey()`
- All async Slack calls wrapped in try/catch, errors logged but never surface as 500

---

## Supabase Migration

Apply before pushing code to main (project_id: `glkvrweabeilwnrpzqxg`):

```sql
-- slack_connections: one per workspace, stores encrypted bot token
CREATE TABLE IF NOT EXISTS slack_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slack_team_id   text NOT NULL,
  slack_team_name text,
  bot_token_enc   text NOT NULL,
  installed_by    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slack_connections_workspace_id_key UNIQUE (workspace_id),
  CONSTRAINT slack_connections_slack_team_id_key UNIQUE (slack_team_id)
);

-- slack_user_mappings: Clerk user → Slack user, with notification prefs
CREATE TABLE IF NOT EXISTS slack_user_mappings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  clerk_user_id           text NOT NULL,
  slack_user_id           text NOT NULL,
  notify_health_drops     boolean DEFAULT true,
  notify_issue_links      boolean DEFAULT true,
  notify_stale_deals      boolean DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slack_user_mappings_workspace_clerk_key UNIQUE (workspace_id, clerk_user_id)
);
```

---

## What This is NOT (Phase 2b / Phase 3)

- No standalone MCP server process (the "tools" are internal TypeScript functions)
- No streaming / multi-turn conversation (each message is stateless)
- No AI-generated response text (all responses are data-driven from brain/DB)
- No Slack modal UIs (buttons link back to the web app)
