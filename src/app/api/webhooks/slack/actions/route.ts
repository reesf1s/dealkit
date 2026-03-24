/**
 * POST /api/webhooks/slack/actions
 * Handles Slack Block Kit interactive component callbacks (button clicks).
 *
 * Handles:
 *   draft_release_email_{dealId}_{linearIssueId}  — generate + DM back the release email
 *   skip_release_email_{dealId}                   — dismiss the notification silently
 *
 * Slack sends an application/x-www-form-urlencoded body with a `payload` field
 * containing a JSON string.
 *
 * Pattern:
 *   1. Verify X-Slack-Signature
 *   2. Return 200 immediately (Slack requires < 3s)
 *   3. Process action asynchronously
 *
 * Docs: https://api.slack.com/interactivity/handling
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { isSlackConfigured, verifySlackRequest, getSlackBotToken, getWorkspaceBySlackTeam, slackPostMessage } from '@/lib/slack-client'
import { getOrGenerateReleaseEmail } from '@/lib/release-email-generator'
import { db } from '@/lib/db'
import { mcpActionLog } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { markdownToBlocks, errorBlocks } from '@/lib/slack-blocks'

// ─────────────────────────────────────────────────────────────────────────────
// Slack action payload types (subset)
// ─────────────────────────────────────────────────────────────────────────────

interface SlackActionPayload {
  type: 'block_actions'
  team: { id: string; domain: string }
  user: { id: string; username: string }
  channel?: { id: string }
  container?: { channel_id?: string }
  actions: Array<{
    action_id: string
    block_id?: string
    value?: string
  }>
  response_url?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Action handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleDraftReleaseEmail(
  workspaceId: string,
  token: string,
  dmChannelId: string,
  dealId: string,
  linearIssueId: string,
): Promise<void> {
  try {
    const email = await getOrGenerateReleaseEmail(workspaceId, dealId, linearIssueId)

    if (!email) {
      await slackPostMessage(
        token,
        dmChannelId,
        errorBlocks('Could not generate release email — missing deal or issue context.'),
        'Could not generate release email',
      )
      return
    }

    const emailText = [
      `✉️ *Release email ready*`,
      '',
      `*Subject:* ${email.subject}`,
      '',
      `*Body:*`,
      email.body,
      '',
      `_Copy this and send from your email client._`,
    ].join('\n')

    await slackPostMessage(
      token,
      dmChannelId,
      markdownToBlocks(emailText),
      emailText,
    )

    // Mark the pending action as complete
    await db
      .update(mcpActionLog)
      .set({ status: 'complete' })
      .where(and(
        eq(mcpActionLog.workspaceId, workspaceId),
        eq(mcpActionLog.dealId, dealId),
        eq(mcpActionLog.linearIssueId, linearIssueId),
        eq(mcpActionLog.status, 'awaiting_confirmation'),
        eq(mcpActionLog.actionType, 'issue_deployed_notification'),
      ))
  } catch (e) {
    console.error('[slack/actions] handleDraftReleaseEmail failed:', e)
    try {
      await slackPostMessage(
        token,
        dmChannelId,
        errorBlocks('Something went wrong generating the release email. Please try again.'),
        'Error generating release email',
      )
    } catch { /* suppress recovery error */ }
  }
}

async function handleSkipReleaseEmail(
  workspaceId: string,
  dealId: string,
  linearIssueId: string | null,
): Promise<void> {
  // Mark pending notification as complete (dismissed)
  const conditions = [
    eq(mcpActionLog.workspaceId, workspaceId),
    eq(mcpActionLog.dealId, dealId),
    eq(mcpActionLog.status, 'awaiting_confirmation'),
    eq(mcpActionLog.actionType, 'issue_deployed_notification'),
  ]

  if (linearIssueId) {
    conditions.push(eq(mcpActionLog.linearIssueId, linearIssueId))
  }

  await db
    .update(mcpActionLog)
    .set({ status: 'complete' })
    .where(and(...conditions))
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isSlackConfigured()) {
    return NextResponse.json({ error: 'Slack app not configured' }, { status: 503 })
  }

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

  // Parse URL-encoded body — Slack sends `payload=<JSON>`
  let payload: SlackActionPayload
  try {
    const params = new URLSearchParams(rawBody)
    const payloadStr = params.get('payload')
    if (!payloadStr) return NextResponse.json({ error: 'No payload' }, { status: 400 })
    payload = JSON.parse(payloadStr) as SlackActionPayload
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (payload.type !== 'block_actions' || !payload.actions?.length) {
    return NextResponse.json({ data: { skipped: true } })
  }

  const action = payload.actions[0]
  const actionId = action.action_id
  const teamId = payload.team.id
  const dmChannelId = payload.channel?.id ?? payload.container?.channel_id

  // ── Return 200 immediately, process async ────────────────────────────────
  Promise.resolve().then(async () => {
    try {
      const workspaceId = await getWorkspaceBySlackTeam(teamId)
      if (!workspaceId) {
        console.warn(`[webhook/slack/actions] No workspace for team ${teamId}`)
        return
      }

      const token = await getSlackBotToken(workspaceId)
      if (!token) return

      // draft_release_email_{dealId}_{linearIssueId}
      const draftMatch = actionId.match(/^draft_release_email_([^_]+(?:_[^_]+)*)_([A-Z]+-\d+)$/)
      if (draftMatch) {
        const dealId = draftMatch[1]
        const linearIssueId = draftMatch[2]
        const channel = dmChannelId ?? payload.user.id  // fallback to opening a DM
        await handleDraftReleaseEmail(workspaceId, token, channel, dealId, linearIssueId)
        return
      }

      // skip_release_email_{dealId} (may or may not have issue suffix)
      const skipMatch = actionId.match(/^skip_release_email_(.+)$/)
      if (skipMatch) {
        const dealId = skipMatch[1]
        await handleSkipReleaseEmail(workspaceId, dealId, null)
        return
      }

      console.warn(`[webhook/slack/actions] Unhandled action_id: ${actionId}`)
    } catch (e) {
      console.error('[webhook/slack/actions] Async processing failed:', e)
    }
  })

  // Return empty 200 — Slack will remove the loading state
  return new NextResponse('', { status: 200 })
}
