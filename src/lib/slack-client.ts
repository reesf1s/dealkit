/**
 * Slack client — Web API wrapper and request verification.
 *
 * Provides:
 *   verifySlackRequest()   — HMAC-SHA256 signature guard (replay-attack safe)
 *   getSlackBotToken()     — decrypt stored bot token for a workspace
 *   slackPostMessage()     — chat.postMessage
 *   slackPostEphemeral()   — chat.postEphemeral (ephemeral/error messages)
 *   slackOpenDm()          — conversations.open → returns DM channel ID
 *
 * All functions check for required env vars at call-time, never at module load.
 * Missing SLACK_SIGNING_SECRET / SLACK_CLIENT_ID / SLACK_CLIENT_SECRET
 * cause a descriptive Error rather than a crash.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { slackConnections } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { decrypt, getEncryptionKey } from '@/lib/encrypt'

// ─────────────────────────────────────────────────────────────────────────────
// Env var helpers (throw at call-time, not module load)
// ─────────────────────────────────────────────────────────────────────────────

export function getSlackSigningSecret(): string {
  const s = process.env.SLACK_SIGNING_SECRET
  if (!s) throw new Error('SLACK_SIGNING_SECRET env var is not set')
  return s
}

export function getSlackClientId(): string {
  const s = process.env.SLACK_CLIENT_ID
  if (!s) throw new Error('SLACK_CLIENT_ID env var is not set')
  return s
}

export function getSlackClientSecret(): string {
  const s = process.env.SLACK_CLIENT_SECRET
  if (!s) throw new Error('SLACK_CLIENT_SECRET env var is not set')
  return s
}

/** Returns true if all three Slack env vars are present (used for guard checks in routes). */
export function isSlackConfigured(): boolean {
  return !!(
    process.env.SLACK_SIGNING_SECRET &&
    process.env.SLACK_CLIENT_ID &&
    process.env.SLACK_CLIENT_SECRET
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Request verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify a Slack request signature.
 * Returns false if invalid or if the timestamp is >5 min old (replay prevention).
 *
 * @param rawBody   - raw request body string (must NOT be parsed before calling)
 * @param timestamp - value of X-Slack-Request-Timestamp header
 * @param signature - value of X-Slack-Signature header (e.g. "v0=abc123…")
 */
export function verifySlackRequest(
  rawBody: string,
  timestamp: string,
  signature: string,
): boolean {
  // Replay attack guard: reject if >5 min old
  const requestTs = parseInt(timestamp, 10)
  if (isNaN(requestTs)) return false
  const nowSecs = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSecs - requestTs) > 300) return false

  const signingSecret = getSlackSigningSecret()
  const basestring = `v0:${timestamp}:${rawBody}`
  const hmac = createHmac('sha256', signingSecret).update(basestring).digest('hex')
  const expected = `v0=${hmac}`

  // Constant-time comparison to prevent timing attacks
  try {
    const expectedBuf = Buffer.from(expected, 'utf8')
    const actualBuf   = Buffer.from(signature, 'utf8')
    if (expectedBuf.length !== actualBuf.length) return false
    return timingSafeEqual(expectedBuf, actualBuf)
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Token retrieval
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decrypt and return the bot token for a workspace.
 * Returns null if no Slack connection exists for the workspace.
 */
export async function getSlackBotToken(workspaceId: string): Promise<string | null> {
  const [row] = await db
    .select({ botTokenEnc: slackConnections.botTokenEnc })
    .from(slackConnections)
    .where(eq(slackConnections.workspaceId, workspaceId))
    .limit(1)

  if (!row) return null
  return decrypt(row.botTokenEnc, getEncryptionKey())
}

/**
 * Look up a workspace ID by Slack team ID.
 * Returns null if the team is not connected.
 */
export async function getWorkspaceBySlackTeam(slackTeamId: string): Promise<string | null> {
  const [row] = await db
    .select({ workspaceId: slackConnections.workspaceId })
    .from(slackConnections)
    .where(eq(slackConnections.slackTeamId, slackTeamId))
    .limit(1)

  return row?.workspaceId ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Slack Web API helpers
// ─────────────────────────────────────────────────────────────────────────────

const SLACK_API = 'https://slack.com/api'

interface SlackApiResponse {
  ok: boolean
  error?: string
  [key: string]: unknown
}

/** Internal helper: POST to a Slack API method with a bot token. */
async function callSlackApi(
  method: string,
  token: string,
  body: Record<string, unknown>,
): Promise<SlackApiResponse> {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json() as SlackApiResponse
  if (!data.ok) {
    console.error(`[slack-client] ${method} failed:`, data.error)
  }
  return data
}

/**
 * Block Kit block type (minimal — enough for our use cases).
 * Slack's actual schema is more complex but we only need these shapes.
 */
export interface SlackBlock {
  type: string
  [key: string]: unknown
}

/**
 * Send a message to a Slack channel using Block Kit.
 * Falls back to `text` for clients that don't render blocks.
 */
export async function slackPostMessage(
  token: string,
  channel: string,
  blocks: SlackBlock[],
  text = '',
): Promise<SlackApiResponse> {
  return callSlackApi('chat.postMessage', token, { channel, blocks, text })
}

/**
 * Send an ephemeral message visible only to a specific user in a channel.
 * Used for error/fallback responses.
 */
export async function slackPostEphemeral(
  token: string,
  channel: string,
  user: string,
  text: string,
): Promise<SlackApiResponse> {
  return callSlackApi('chat.postEphemeral', token, { channel, user, text })
}

/**
 * Open a DM channel with a Slack user and return the channel ID.
 * Returns null if the API call fails.
 */
export async function slackOpenDm(
  token: string,
  slackUserId: string,
): Promise<string | null> {
  const data = await callSlackApi('conversations.open', token, { users: slackUserId })
  if (!data.ok) return null
  const channel = (data as { ok: boolean; channel?: { id: string } }).channel
  return channel?.id ?? null
}

/**
 * Exchange a temporary OAuth code for a bot token.
 * Called from the OAuth callback route.
 */
export async function exchangeOAuthCode(code: string, redirectUri: string): Promise<{
  ok: boolean
  botToken?: string
  slackTeamId?: string
  slackTeamName?: string
  installedByUserId?: string
  error?: string
}> {
  const clientId     = getSlackClientId()
  const clientSecret = getSlackClientSecret()

  const params = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    code,
    redirect_uri:  redirectUri,
  })

  const res = await fetch(`${SLACK_API}/oauth.v2.access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const data = await res.json() as {
    ok: boolean
    error?: string
    access_token?: string
    team?: { id: string; name: string }
    authed_user?: { id: string }
  }

  if (!data.ok) {
    return { ok: false, error: data.error ?? 'oauth_failed' }
  }

  return {
    ok: true,
    botToken:          data.access_token,
    slackTeamId:       data.team?.id,
    slackTeamName:     data.team?.name,
    installedByUserId: data.authed_user?.id,
  }
}
