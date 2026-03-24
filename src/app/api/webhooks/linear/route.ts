/**
 * POST /api/webhooks/linear
 * Receives Linear webhooks for issue create/update events.
 * Verifies HMAC-SHA256 signature and re-syncs the affected issue.
 *
 * Phase 4 extension: when an issue's state.type changes to 'completed',
 * marks any in_cycle deal_linear_links as 'deployed' and fires proactive
 * Slack DMs to opted-in workspace members.
 *
 * Set up in Linear: Settings → API → Webhooks
 * URL: https://your-domain.com/api/webhooks/linear
 * Events: Issue created, Issue updated
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { linearIntegrations, dealLinearLinks, dealLogs } from '@/lib/db/schema'
import { syncLinearIssues } from '@/lib/linear-sync'
import { matchAllOpenDeals } from '@/lib/linear-signal-match'
import { notifyIssueDeployed } from '@/lib/slack-notify'

// ─────────────────────────────────────────────────────────────────────────────
// Webhook payload types (subset of Linear webhook schema)
// ─────────────────────────────────────────────────────────────────────────────

interface LinearWebhookPayload {
  action: 'create' | 'update' | 'remove'
  type: 'Issue' | 'IssueLabel' | 'Cycle' | string
  organizationId: string
  data: {
    id: string
    identifier: string   // e.g. "ENG-36"
    title?: string
    teamId?: string
    state?: {
      id: string
      name: string
      type: string        // 'backlog'|'unstarted'|'started'|'completed'|'cancelled'
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature verification
// ─────────────────────────────────────────────────────────────────────────────

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Deployment detection — called when state.type === 'completed'
// ─────────────────────────────────────────────────────────────────────────────

async function handleIssueCompleted(
  workspaceId: string,
  linearIssueId: string,
  issueTitle: string | undefined,
): Promise<void> {
  // Find all in_cycle links for this issue in this workspace
  const links = await db
    .select({
      dealId: dealLinearLinks.dealId,
      linearTitle: dealLinearLinks.linearTitle,
    })
    .from(dealLinearLinks)
    .where(and(
      eq(dealLinearLinks.workspaceId, workspaceId),
      eq(dealLinearLinks.linearIssueId, linearIssueId),
      eq(dealLinearLinks.status, 'in_cycle'),
    ))

  if (links.length === 0) return

  // Mark all matching links as deployed
  await db
    .update(dealLinearLinks)
    .set({ status: 'deployed', deployedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(dealLinearLinks.workspaceId, workspaceId),
      eq(dealLinearLinks.linearIssueId, linearIssueId),
      eq(dealLinearLinks.status, 'in_cycle'),
    ))

  // Fire proactive DM for each affected deal
  for (const link of links) {
    const [deal] = await db
      .select({
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
      })
      .from(dealLogs)
      .where(eq(dealLogs.id, link.dealId))
      .limit(1)

    if (!deal) continue

    notifyIssueDeployed(workspaceId, {
      dealId: link.dealId,
      dealName: deal.dealName,
      company: deal.prospectCompany,
      linearIssueId,
      linearTitle: link.linearTitle ?? issueTitle ?? linearIssueId,
    }).catch(err => console.error('[webhook/linear] notifyIssueDeployed failed:', err))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('linear-signature') ?? ''

  // Find all workspaces with a webhook secret and verify against one of them.
  // Linear sends one webhook per workspace so we match by organizationId if possible.
  let payload: LinearWebhookPayload
  try {
    payload = JSON.parse(rawBody) as LinearWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only process Issue events
  if (payload.type !== 'Issue' || !['create', 'update'].includes(payload.action)) {
    return NextResponse.json({ data: { skipped: true } })
  }

  // Find a matching workspace by webhook secret verification
  const integrations = await db
    .select()
    .from(linearIntegrations)

  let matchedWorkspaceId: string | null = null
  for (const integration of integrations) {
    if (!integration.webhookSecret) continue
    if (verifySignature(rawBody, signature, integration.webhookSecret)) {
      matchedWorkspaceId = integration.workspaceId
      break
    }
  }

  if (!matchedWorkspaceId) {
    // If no webhook secret is configured, fall back to processing all workspaces
    // (acceptable for initial setup; tighten once webhook secret is stored)
    console.warn('[webhook/linear] No matching workspace found for webhook — signature unverified')
    return NextResponse.json({ data: { received: true, verified: false } })
  }

  const workspaceId = matchedWorkspaceId
  const issueIdentifier = payload.data.identifier
  const stateType = payload.data.state?.type

  // Phase 4: detect issue completion and trigger deployment flow (fire-and-forget)
  if (payload.action === 'update' && stateType === 'completed' && issueIdentifier) {
    handleIssueCompleted(workspaceId, issueIdentifier, payload.data.title).catch(
      err => console.error('[webhook/linear] handleIssueCompleted failed:', err),
    )
  }

  // Re-sync all issues and re-match for this workspace (fire-and-forget)
  Promise.all([
    syncLinearIssues(workspaceId),
    matchAllOpenDeals(workspaceId),
  ]).catch(err => console.error('[webhook/linear] re-sync failed:', err))

  return NextResponse.json({ data: { received: true, verified: true } })
}
