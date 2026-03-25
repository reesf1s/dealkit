/**
 * POST /api/dashboard/focus-briefing
 * Generates a structured daily focus briefing using Claude Haiku.
 * Returns plain text (not streaming) for easy consumption.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { getWorkspaceBrain } from '@/lib/workspace-brain'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)

    // Load deals + brain
    const [deals, brain] = await Promise.all([
      db.select().from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId)),
      getWorkspaceBrain(workspaceId),
    ])

    const openDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    if (openDeals.length === 0) {
      return NextResponse.json({ text: 'No open deals in your pipeline yet. Add a deal to get started.' })
    }

    // Build concise deal context for Haiku
    const dealLines = openDeals
      .sort((a, b) => (Number(b.dealValue) || 0) - (Number(a.dealValue) || 0))
      .slice(0, 15)
      .map(d => {
        const value = d.dealValue ? `£${Number(d.dealValue).toLocaleString()}` : 'No value'
        const score = d.conversionScore ?? 0
        const stage = (d.stage ?? '').replace(/_/g, ' ')
        const risks = Array.isArray(d.dealRisks) ? (d.dealRisks as Array<string | { risk: string }>).slice(0, 2).map(r => typeof r === 'string' ? r : r.risk).join('; ') : ''
        const nextSteps = d.nextSteps ?? ''
        const contacts = Array.isArray(d.contacts) ? (d.contacts as Array<{ name: string }>).map(c => c.name).join(', ') : ''
        return `- ${d.prospectCompany} (${value}, score ${score}%, ${stage}): ${risks || 'No risks flagged'}. Next: ${nextSteps || 'None set'}. Contacts: ${contacts || 'None'}`
      })
      .join('\n')

    // Brain context
    const staleDeals = brain?.staleDeals?.slice(0, 5).map(s => `${s.company}: ${s.daysSinceUpdate}d stale`).join(', ') || 'none'
    const urgentDeals = brain?.urgentDeals?.slice(0, 5).map(u => `${u.company}: ${u.reason}`).join(', ') || 'none'

    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic()

    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You are a sales intelligence assistant. Write a structured daily focus briefing.

FORMAT EXACTLY LIKE THIS:
🔴 **Urgent — Unblock These Now**
1. [Company] ([value]) — [specific action with contact name]
2. ...

🟡 **High Value — Push Forward**
3. [Company] ([value]) — [specific next step]
4. ...

🟢 **Quick Checks**
► [Company] — [one-line check]
► ...

End with: "The big [N] = ~£[X] with solvable blockers."

RULES:
- Use REAL deal names, contact names, £ values from the data below
- Be specific — "Chase Tom on SOC 2 review" not "Follow up with stakeholder"
- Urgent = deals with passed deadlines, declining scores, or stalled decisions
- High value = large deals with clear next steps
- Quick checks = high-score deals needing a status confirmation
- Max 7-8 items total

PIPELINE DATA:
${dealLines}

BRAIN SIGNALS:
Stale: ${staleDeals}
Urgent: ${urgentDeals}

Write ONLY the briefing. No preamble.`
      }]
    })

    const text = resp.content[0].type === 'text' ? resp.content[0].text.trim() : ''
    return NextResponse.json({ text })
  } catch (e) {
    console.error('[focus-briefing]', e)
    const msg = e instanceof Error ? e.message : 'Failed to generate briefing'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
