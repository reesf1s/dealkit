/**
 * POST /api/webhooks/linear
 * Receives Linear webhooks for issue create/update events.
 * Verifies HMAC-SHA256 signature and re-syncs the affected issue.
 *
 * Set up in Linear: Settings → API → Webhooks
 * URL: https://your-domain.com/api/webhooks/linear
 * Events: Issue created, Issue updated
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { linearIntegrations } from '@/lib/db/schema'
import { syncLinearIssues } from '@/lib/linear-sync'
import { matchAllOpenDeals } from '@/lib/linear-signal-match'

// ─────────────────────────────────────────────────────────────────────────────
// Webhook payload types (subset of Linear webhook schema)
// ─────────────────────────────────────────────────────────────────────────────

interface LinearWebhookPayload {
  action: 'create' | 'update' | 'remove'
  type: 'Issue' | 'IssueLabel' | 'Cycle' | string
  organizationId: string
  data: {
    id: string
    identifier: string
    title?: string
    teamId?: string
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

  // Re-sync all issues and re-match for this workspace (fire-and-forget)
  Promise.all([
    syncLinearIssues(matchedWorkspaceId),
    matchAllOpenDeals(matchedWorkspaceId),
  ]).catch(err => console.error('[webhook/linear] re-sync failed:', err))

  return NextResponse.json({ data: { received: true, verified: true } })
}
