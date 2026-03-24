/**
 * POST /api/webhooks/slack/events
 * Receives Slack Events API payloads.
 *
 * Handles:
 *   - URL verification challenge (initial setup)
 *   - app_mention: user @-mentions the bot in any channel
 *   - message.im: direct message to the bot
 *
 * Pattern:
 *   1. Read raw body, verify X-Slack-Signature
 *   2. Return 200 immediately (Slack requires < 3s)
 *   3. Process asynchronously (no blocking on AI call)
 *
 * Never returns 5xx — Slack retries aggressively on server errors.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { isSlackConfigured, verifySlackRequest, getSlackBotToken, getWorkspaceBySlackTeam, slackPostMessage } from '@/lib/slack-client'
import { handleSlackMessage } from '@/lib/slack-agent'
import { errorBlocks } from '@/lib/slack-blocks'

// ─────────────────────────────────────────────────────────────────────────────
// Slack payload types
// ─────────────────────────────────────────────────────────────────────────────

interface SlackUrlVerification {
  type: 'url_verification'
  challenge: string
}

interface SlackEventCallback {
  type: 'event_callback'
  team_id: string
  event: {
    type: string
    user: string
    text?: string
    channel: string
    channel_type?: string
    bot_id?: string
    ts?: string
  }
}

type SlackEventPayload = SlackUrlVerification | SlackEventCallback

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Guard: Slack must be configured
  if (!isSlackConfigured()) {
    return NextResponse.json({ error: 'Slack app not configured' }, { status: 503 })
  }

  // Read raw body for signature verification
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: 'Could not read body' }, { status: 400 })
  }

  // Handle Slack URL verification challenge BEFORE signature check —
  // Slack sends the challenge without a valid signature during initial setup.
  let payload: SlackEventPayload
  try {
    payload = JSON.parse(rawBody) as SlackEventPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // Verify signature for all other events
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''

  try {
    if (!verifySlackRequest(rawBody, timestamp, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  } catch (e) {
    // verifySlackRequest throws if SLACK_SIGNING_SECRET is missing
    const msg = e instanceof Error ? e.message : 'Signature verification failed'
    return NextResponse.json({ error: msg }, { status: 503 })
  }

  // Only handle event_callback
  if (payload.type !== 'event_callback') {
    return NextResponse.json({ data: { skipped: true } })
  }

  const event = payload.event

  // Ignore messages from bots (prevents echo loops)
  if (event.bot_id) {
    return NextResponse.json({ data: { skipped: true } })
  }

  // Only handle app_mention and message.im
  if (event.type !== 'app_mention' && event.type !== 'message.im') {
    return NextResponse.json({ data: { skipped: true } })
  }

  // ── Return 200 immediately, process async ────────────────────────────────
  // We fire-and-forget the async processing. Slack only needs the 200 ACK.
  const teamId = payload.team_id
  const slackUserId = event.user
  const channelId = event.channel
  const rawText = event.text ?? ''

  // Strip bot mention prefix from text (e.g. "<@U01234567> how is the Coke deal?" → "how is the Coke deal?")
  const userText = rawText.replace(/<@[A-Z0-9]+>/g, '').trim()

  // Fire-and-forget
  Promise.resolve().then(async () => {
    try {
      // Look up workspace
      const workspaceId = await getWorkspaceBySlackTeam(teamId)
      if (!workspaceId) {
        console.warn(`[webhook/slack/events] No workspace found for team ${teamId}`)
        return
      }

      // Get bot token
      const token = await getSlackBotToken(workspaceId)
      if (!token) {
        console.warn(`[webhook/slack/events] No bot token for workspace ${workspaceId}`)
        return
      }

      // Run agentic handler
      const result = await handleSlackMessage(userText, workspaceId, slackUserId, channelId)

      // Post response
      await slackPostMessage(token, channelId, result.blocks, result.text)
    } catch (e) {
      console.error('[webhook/slack/events] Async processing failed:', e)
      // Best-effort error DM — if this fails too, just log
      try {
        const workspaceId = await getWorkspaceBySlackTeam(teamId)
        if (workspaceId) {
          const token = await getSlackBotToken(workspaceId)
          if (token) {
            await slackPostMessage(
              token,
              channelId,
              errorBlocks('I ran into an issue processing your message. Please try again.'),
              'Error processing message',
            )
          }
        }
      } catch { /* suppress recovery error */ }
    }
  })

  return NextResponse.json({ data: { received: true } })
}
