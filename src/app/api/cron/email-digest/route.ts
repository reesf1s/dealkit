/**
 * GET /api/cron/email-digest
 * Daily 7 AM — deal health digest for workspace owners.
 *
 * For each workspace with urgent deals (urgencyScore > 70 and not updated
 * in > 5 days), sends a plain-text email via Resend (or stubs to console.log
 * if RESEND_API_KEY is not configured).
 *
 * Secured by CRON_SECRET (same pattern as all other cron routes).
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { workspaces, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import { computeUrgencyScore } from '@/lib/ml/urgency'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/email-digest] CRON_SECRET not set — endpoint disabled')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allWorkspaces = await db.select({ id: workspaces.id, name: workspaces.name, ownerId: workspaces.ownerId }).from(workspaces)

  let sent = 0
  let skipped = 0

  for (const ws of allWorkspaces) {
    try {
      const brain = await getWorkspaceBrain(ws.id)
      if (!brain) { skipped++; continue }

      // Find active deals with urgency score > 70 and not updated in > 5 days
      const alertDeals = (brain.deals ?? [])
        .filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
        .map(d => ({ deal: d, urgency: computeUrgencyScore(d) }))
        .filter(({ deal, urgency }) => urgency.score > 70 && deal.daysSinceUpdate > 5)
        .sort((a, b) => b.urgency.score - a.urgency.score)
        .slice(0, 5)

      if (alertDeals.length === 0) { skipped++; continue }

      // Get owner email
      const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, ws.ownerId)).limit(1)
      if (!owner?.email) { skipped++; continue }

      const subject = `${alertDeals.length} deal${alertDeals.length !== 1 ? 's' : ''} need your attention today — Halvex`
      const body = buildEmailBody(ws.name, alertDeals)

      await sendEmail(owner.email, subject, body)
      sent++
    } catch (e) {
      console.error(`[cron/email-digest] Error for workspace ${ws.id}:`, e)
      skipped++
    }
  }

  return NextResponse.json({ sent, skipped, total: allWorkspaces.length })
}

// ── Email body builder ─────────────────────────────────────────────────────────

function buildEmailBody(
  workspaceName: string,
  alertDeals: { deal: { company: string; name: string; stage: string; daysSinceUpdate: number; dealValue: number | null }; urgency: { score: number; reasons: string[]; topAction: string } }[],
): string {
  const lines: string[] = [
    `Halvex deal digest for ${workspaceName}`,
    `${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`,
    '',
    `${alertDeals.length} deal${alertDeals.length !== 1 ? 's' : ''} need your attention:`,
    '',
  ]

  for (const { deal, urgency } of alertDeals) {
    const val = deal.dealValue ? ` · £${deal.dealValue.toLocaleString('en-GB')}` : ''
    lines.push(`${deal.company} — ${deal.name}${val}`)
    lines.push(`  Stage: ${deal.stage} · Last update: ${deal.daysSinceUpdate} days ago`)
    lines.push(`  ${urgency.reasons[0] ?? 'Needs attention'}`)
    lines.push(`  → ${urgency.topAction}`)
    lines.push('')
  }

  lines.push('---')
  lines.push('View your pipeline: https://halvex.ai/dashboard')
  lines.push('')
  lines.push('Halvex · Deal Intelligence')

  return lines.join('\n')
}

// ── Email sender (Resend or console stub) ──────────────────────────────────────

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    // Stub: log the email in development / when Resend is not configured
    console.log('[email-digest] RESEND_API_KEY not set — logging email instead:')
    console.log(`TO: ${to}`)
    console.log(`SUBJECT: ${subject}`)
    console.log(`BODY:\n${body}`)
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Halvex <digest@halvex.ai>',
      to: [to],
      subject,
      text: body,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend API error: ${res.status} — ${err}`)
  }
}
