/**
 * POST /api/webhooks/slack/commands
 * Handles the /halvex slash command.
 *
 * Slack sends commands as application/x-www-form-urlencoded.
 * We must respond with 200 within 3 seconds — we return "Working on it…"
 * immediately, then POST the real response to response_url asynchronously.
 *
 * Payload fields from Slack:
 *   command       - "/halvex"
 *   text          - everything after the command e.g. "how is the Coke deal?"
 *   user_id       - Slack user ID
 *   team_id       - Slack team ID
 *   channel_id    - channel where the command was run
 *   response_url  - URL to POST the async response to
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  isSlackConfigured,
  verifySlackRequest,
  getWorkspaceBySlackTeam,
  getSlackBotToken,
} from '@/lib/slack-client'
import { handleSlackMessage } from '@/lib/slack-agent'
import { errorBlocks } from '@/lib/slack-blocks'

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Guard: Slack must be configured
  if (!isSlackConfigured()) {
    return NextResponse.json({ error: 'Slack app not configured' }, { status: 503 })
  }

  // Read raw body (needed for signature verification)
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: 'Could not read body' }, { status: 400 })
  }

  // Verify signature
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''

  try {
    if (!verifySlackRequest(rawBody, timestamp, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Signature verification failed'
    return NextResponse.json({ error: msg }, { status: 503 })
  }

  // Parse form body
  const params = new URLSearchParams(rawBody)
  const text       = params.get('text') ?? ''
  const teamId     = params.get('team_id') ?? ''
  const slackUserId = params.get('user_id') ?? ''
  const channelId  = params.get('channel_id') ?? ''
  const responseUrl = params.get('response_url') ?? ''

  // ── Return 200 immediately with "Working on it…" ─────────────────────────
  // Slack requires a 200 within 3 seconds. We acknowledge immediately then
  // fire the actual work asynchronously via the response_url.
  const immediateResponse = NextResponse.json({
    response_type: 'ephemeral',
    text: ':hourglass_flowing_sand: Working on it…',
  })

  // Fire-and-forget
  Promise.resolve().then(async () => {
    try {
      // Look up workspace
      const workspaceId = await getWorkspaceBySlackTeam(teamId)

      if (!workspaceId) {
        await postToResponseUrl(responseUrl, {
          response_type: 'ephemeral',
          text: '⚠️ Halvex is not connected to this Slack workspace. Go to *Settings → Slack* to connect.',
        })
        return
      }

      // Handle empty command: show help
      const query = text.trim()
      if (!query) {
        await postToResponseUrl(responseUrl, {
          response_type: 'ephemeral',
          text: [
            '*Usage:* `/halvex [question]`',
            '',
            '*Examples:*',
            '• `/halvex how is the Coke deal?`',
            '• `/halvex what deals need attention?`',
            '• `/halvex what can I build to convert Acme?`',
            '• `/halvex why are we losing deals?`',
          ].join('\n'),
        })
        return
      }

      // Run agentic handler
      const result = await handleSlackMessage(query, workspaceId, slackUserId, channelId)

      // Post result to response_url (visible to the user who ran the command)
      await postToResponseUrl(responseUrl, {
        response_type: 'in_channel',
        text: result.text,
        blocks: result.blocks,
      })
    } catch (e) {
      console.error('[webhook/slack/commands] Async processing failed:', e)
      await postToResponseUrl(responseUrl, {
        response_type: 'ephemeral',
        text: '⚠️ I ran into an issue. Please try again in a moment.',
      }).catch(() => { /* suppress */ })
    }
  })

  return immediateResponse
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: POST to Slack response_url
// ─────────────────────────────────────────────────────────────────────────────

async function postToResponseUrl(
  responseUrl: string,
  body: Record<string, unknown>,
): Promise<void> {
  if (!responseUrl) return
  try {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e) {
    console.error('[slack/commands] postToResponseUrl failed:', e)
  }
}
