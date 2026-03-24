/**
 * POST /api/webhooks/slack/actions
 * Handles Slack Block Kit interactive component callbacks (button clicks).
 *
 * Handles:
 *   draft_release_email_{dealId}_{linearIssueId}    — generate + DM back the release email
 *   skip_release_email_{dealId}                     — dismiss the release email notification
 *   scope_and_add_to_cycle_{dealId}_{linearIssueId} — scope issue to cycle automatically
 *   dismiss_issue_link_{dealId}_{linearIssueId}     — dismiss the issue link suggestion
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
import { mcpActionLog, dealLinearLinks, dealLogs, linearIssuesCache, hubspotIntegrations } from '@/lib/db/schema'
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

    // Fetch deal contact info for the CTA section
    const [deal] = await db
      .select({
        prospectCompany: dealLogs.prospectCompany,
        prospectName: dealLogs.prospectName,
        contacts: dealLogs.contacts,
      })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    const contacts = (deal?.contacts as { name?: string; email?: string; title?: string }[]) ?? []
    const primaryContact = deal?.prospectName ?? contacts[0]?.name
    const primaryEmail = contacts[0]?.email

    const emailParts = [
      `✉️ *Release email ready for ${deal?.prospectCompany ?? 'your prospect'}*`,
      '',
      `*Subject:* ${email.subject}`,
      '',
      `*Body:*`,
      email.body,
      '',
    ]

    // Call scheduling message (if generated)
    if (email.callSchedulingMessage) {
      emailParts.push(
        `---`,
        ``,
        `*💬 Suggested message to schedule a call${primaryContact ? ` with ${primaryContact}` : ''}:*`,
        `_${email.callSchedulingMessage}_`,
        ``,
      )
    }

    // Contact info for convenience
    if (primaryContact || primaryEmail) {
      const contactLine = [
        primaryContact ? `*${primaryContact}*` : null,
        primaryEmail ? primaryEmail : null,
      ].filter(Boolean).join(' — ')
      emailParts.push(
        `*Contact:* ${contactLine}`,
        ``,
      )
    }

    emailParts.push(`_Copy the email above and send from your email client._`)

    const emailText = emailParts.join('\n')

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

// ─────────────────────────────────────────────────────────────────────────────
// handleScopeAndAddToCycle — auto-scope issue when user clicks "Yes, scope it"
// ─────────────────────────────────────────────────────────────────────────────

async function handleScopeAndAddToCycle(
  workspaceId: string,
  token: string,
  dmChannelId: string,
  dealId: string,
  linearIssueId: string,
): Promise<void> {
  try {
    // Fetch deal context
    const [deal] = await db
      .select({
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
        prospectName: dealLogs.prospectName,
        dealRisks: dealLogs.dealRisks,
      })
      .from(dealLogs)
      .where(eq(dealLogs.id, dealId))
      .limit(1)

    if (!deal) {
      await slackPostMessage(token, dmChannelId, errorBlocks('Could not find deal context.'), 'Error')
      return
    }

    // Fetch issue from cache
    const [cached] = await db
      .select({ title: linearIssuesCache.title, description: linearIssuesCache.description })
      .from(linearIssuesCache)
      .where(and(
        eq(linearIssuesCache.workspaceId, workspaceId),
        eq(linearIssuesCache.linearIssueId, linearIssueId),
      ))
      .limit(1)

    const issueTitle = cached?.title ?? linearIssueId
    const issueDesc = cached?.description ?? ''

    // Mark link as in_cycle
    await db
      .update(dealLinearLinks)
      .set({ status: 'in_cycle', scopedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(dealLinearLinks.workspaceId, workspaceId),
        eq(dealLinearLinks.dealId, dealId),
        eq(dealLinearLinks.linearIssueId, linearIssueId),
      ))

    await db.insert(mcpActionLog).values({
      workspaceId,
      actionType: 'scope_issue',
      dealId,
      linearIssueId,
      triggeredBy: 'slack',
      status: 'complete',
      payload: { autoScoped: true, trigger: 'block_action' },
    })

    const dealRisks = (deal.dealRisks as string[]) ?? []
    const riskContext = dealRisks.length > 0 ? `\nDeal risks this solves: ${dealRisks.slice(0, 2).join(', ')}` : ''

    const responseText = [
      `✅ *Scoped ${linearIssueId} for the ${deal.dealName} deal*`,
      '',
      `*Issue:* ${issueTitle}`,
      issueDesc ? `*Description:* ${issueDesc.slice(0, 200)}` : '',
      riskContext,
      '',
      `*User Story:*`,
      `As a ${deal.prospectCompany} user, I want ${issueTitle.toLowerCase()} so that I can achieve the outcomes that matter to our team.`,
      '',
      `*Acceptance Criteria:*`,
      `- [ ] Feature works as described`,
      `- [ ] ${deal.prospectCompany} can access it in their account`,
      `- [ ] No regression in existing functionality`,
      '',
      `Link status updated to *in_cycle*. This will unlock the ${deal.dealName} deal when it ships. 🚀`,
    ].filter(Boolean).join('\n')

    await slackPostMessage(token, dmChannelId, markdownToBlocks(responseText), responseText)
  } catch (e) {
    console.error('[slack/actions] handleScopeAndAddToCycle failed:', e)
    try {
      await slackPostMessage(token, dmChannelId, errorBlocks('Failed to scope issue. Please try again.'), 'Error')
    } catch { /* suppress */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// handleDismissIssueLink — dismiss a suggested issue link
// ─────────────────────────────────────────────────────────────────────────────

async function handleDismissIssueLink(
  workspaceId: string,
  dealId: string,
  linearIssueId: string,
): Promise<void> {
  await db
    .update(dealLinearLinks)
    .set({ status: 'dismissed', updatedAt: new Date() })
    .where(and(
      eq(dealLinearLinks.workspaceId, workspaceId),
      eq(dealLinearLinks.dealId, dealId),
      eq(dealLinearLinks.linearIssueId, linearIssueId),
    ))

  await db.insert(mcpActionLog).values({
    workspaceId,
    actionType: 'link_dismissed',
    dealId,
    linearIssueId,
    triggeredBy: 'slack',
    status: 'complete',
    payload: { trigger: 'block_action' },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// handleSkipReleaseEmail
// ─────────────────────────────────────────────────────────────────────────────

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
// handleSendViaHubspot — log the release email as a sent email in HubSpot CRM
// ─────────────────────────────────────────────────────────────────────────────

async function handleSendViaHubspot(
  workspaceId: string,
  token: string,
  dmChannelId: string,
  dealId: string,
): Promise<void> {
  try {
    // Get deal + contact info
    const [deal] = await db
      .select({
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
        prospectName: dealLogs.prospectName,
        contacts: dealLogs.contacts,
      })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) {
      await slackPostMessage(token, dmChannelId, errorBlocks('Could not find deal to send email for.'), 'Error')
      return
    }

    // Get HubSpot integration
    const [hsIntegration] = await db
      .select({ accessToken: hubspotIntegrations.accessToken })
      .from(hubspotIntegrations)
      .where(eq(hubspotIntegrations.workspaceId, workspaceId))
      .limit(1)

    if (!hsIntegration) {
      await slackPostMessage(token, dmChannelId, errorBlocks('HubSpot is not connected. Connect it in Settings → Integrations.'), 'HubSpot not connected')
      return
    }

    // Get the most recent release email from action log
    const [emailLog] = await db
      .select({ result: mcpActionLog.result })
      .from(mcpActionLog)
      .where(and(
        eq(mcpActionLog.workspaceId, workspaceId),
        eq(mcpActionLog.dealId, dealId),
        eq(mcpActionLog.actionType, 'release_email_generated'),
        eq(mcpActionLog.status, 'complete'),
      ))
      .orderBy(mcpActionLog.createdAt)
      .limit(1)

    const emailResult = emailLog?.result as { subject?: string; body?: string } | null
    const contacts = (deal.contacts as { name?: string; email?: string }[]) ?? []
    const primaryContact = deal.prospectName ?? contacts[0]?.name ?? 'Contact'
    const primaryEmail = contacts[0]?.email

    if (!emailResult?.subject || !emailResult?.body) {
      await slackPostMessage(token, dmChannelId, errorBlocks('No release email found to send. Draft one first.'), 'No email')
      return
    }

    // Log as an email engagement in HubSpot via Engagements API v1
    const hsBody = {
      engagement: { active: true, type: 'EMAIL' },
      associations: {},
      metadata: {
        from: { email: 'noreply@halvex.io', firstName: 'Halvex', lastName: 'AI' },
        to: primaryEmail ? [{ email: primaryEmail }] : [],
        subject: emailResult.subject,
        text: emailResult.body,
        html: `<p>${emailResult.body.replace(/\n/g, '<br>')}</p>`,
        sentVia: 'halvex',
      },
    }

    const hsRes = await fetch('https://api.hubapi.com/engagements/v1/engagements', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hsIntegration.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(hsBody),
    })

    if (!hsRes.ok) {
      const errText = await hsRes.text().catch(() => '')
      console.error('[slack/actions] HubSpot engagement create failed:', hsRes.status, errText)
      await slackPostMessage(token, dmChannelId, errorBlocks('Could not log email in HubSpot. Check your integration in Settings → Integrations.'), 'HubSpot error')
      return
    }

    await db.insert(mcpActionLog).values({
      workspaceId,
      actionType: 'hubspot_email_logged',
      dealId,
      triggeredBy: 'slack',
      status: 'complete',
      payload: { trigger: 'block_action', subject: emailResult.subject },
    })

    const confirmText = `✅ *Email sent to ${primaryContact} via HubSpot*\nLogged under the ${deal.dealName} deal.`
    await slackPostMessage(token, dmChannelId, markdownToBlocks(confirmText), confirmText)
  } catch (e) {
    console.error('[slack/actions] handleSendViaHubspot failed:', e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// handleScheduleFollowup — log a follow-up reminder intent to mcp_action_log
// ─────────────────────────────────────────────────────────────────────────────

async function handleScheduleFollowup(
  workspaceId: string,
  token: string,
  dmChannelId: string,
  dealId: string,
  slackUserId: string,
): Promise<void> {
  try {
    const [deal] = await db
      .select({ dealName: dealLogs.dealName, prospectName: dealLogs.prospectName, prospectCompany: dealLogs.prospectCompany })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    const scheduledFor = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // now + 3 days
    const contactName = deal?.prospectName ?? deal?.prospectCompany ?? 'the prospect'

    await db.insert(mcpActionLog).values({
      workspaceId,
      actionType: 'follow_up_reminder',
      dealId,
      triggeredBy: 'slack',
      status: 'pending',
      payload: {
        slackUserId,
        scheduledFor: scheduledFor.toISOString(),
        note: `Follow up on release email — check if ${contactName} has responded`,
        dealName: deal?.dealName,
        company: deal?.prospectCompany,
      },
    })

    const msg = `✅ *Reminder set for ${scheduledFor.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}* — I'll nudge you if ${contactName} hasn't responded to the release email.`
    await slackPostMessage(token, dmChannelId, markdownToBlocks(msg), msg)
  } catch (e) {
    console.error('[slack/actions] handleScheduleFollowup failed:', e)
  }
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

      // skip_release_email_{dealId}
      const skipMatch = actionId.match(/^skip_release_email_(.+)$/)
      if (skipMatch) {
        const dealId = skipMatch[1]
        await handleSkipReleaseEmail(workspaceId, dealId, null)
        return
      }

      // scope_and_add_to_cycle_{dealId}_{linearIssueId}
      const scopeMatch = actionId.match(/^scope_and_add_to_cycle_([a-f0-9-]{36})_([A-Z]+-\d+)$/)
      if (scopeMatch) {
        const dealId = scopeMatch[1]
        const linearIssueId = scopeMatch[2]
        const channel = dmChannelId ?? payload.user.id
        await handleScopeAndAddToCycle(workspaceId, token, channel, dealId, linearIssueId)
        return
      }

      // dismiss_issue_link_{dealId}_{linearIssueId}
      const dismissMatch = actionId.match(/^dismiss_issue_link_([a-f0-9-]{36})_([A-Z]+-\d+)$/)
      if (dismissMatch) {
        const dealId = dismissMatch[1]
        const linearIssueId = dismissMatch[2]
        await handleDismissIssueLink(workspaceId, dealId, linearIssueId)
        return
      }

      // send_via_hubspot_{dealId}
      const hubspotMatch = actionId.match(/^send_via_hubspot_([a-f0-9-]{36})$/)
      if (hubspotMatch) {
        const dealId = hubspotMatch[1]
        const channel = dmChannelId ?? payload.user.id
        await handleSendViaHubspot(workspaceId, token, channel, dealId)
        return
      }

      // schedule_followup_{dealId}
      const followupMatch = actionId.match(/^schedule_followup_([a-f0-9-]{36})$/)
      if (followupMatch) {
        const dealId = followupMatch[1]
        const channel = dmChannelId ?? payload.user.id
        await handleScheduleFollowup(workspaceId, token, channel, dealId, payload.user.id)
        return
      }

      // skip_followup_{dealId} — just a no-op dismiss
      if (actionId.startsWith('skip_followup_')) {
        return
      }

      // copy_release_email_{dealId} — no-op (clipboard copy happens client-side)
      if (actionId.startsWith('copy_release_email_')) {
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
