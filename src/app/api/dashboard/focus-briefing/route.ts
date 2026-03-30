/**
 * GET  /api/dashboard/focus-briefing — returns cached briefing (no API call)
 * POST /api/dashboard/focus-briefing — regenerates briefing via Haiku, caches it
 *
 * Briefing is stored in workspaces.focus_briefing_cache JSONB column.
 * Only regenerates on explicit POST (refresh button). GET is free.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, workspaces } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { getWorkspaceBrain } from '@/lib/workspace-brain'

interface CachedBriefing {
  text: string
  generatedAt: string
}

// ─── GET: return cached briefing (zero API cost) ────────────────────────────

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)

    const [ws] = await db
      .select({ cache: sql<CachedBriefing | null>`focus_briefing_cache` })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1)

    const cached = ws?.cache as CachedBriefing | null
    if (cached?.text) {
      return NextResponse.json({ text: cached.text, generatedAt: cached.generatedAt, cached: true })
    }
    return NextResponse.json({ text: null, cached: false })
  } catch (e) {
    console.error('[focus-briefing] GET error:', e)
    return NextResponse.json({ text: null, cached: false })
  }
}

// ─── POST: regenerate briefing via Haiku + cache it ─────────────────────────

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)

    const [deals, brain] = await Promise.all([
      db.select().from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId)),
      getWorkspaceBrain(workspaceId),
    ])

    const openDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    if (openDeals.length === 0) {
      const text = 'No open deals in your pipeline yet. Add a deal to get started.'
      return NextResponse.json({ text, cached: false })
    }

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

    const staleDeals = brain?.staleDeals?.slice(0, 5).map(s => `${s.company}: ${s.daysSinceUpdate}d stale`).join(', ') || 'none'
    const urgentDeals = brain?.urgentDeals?.slice(0, 5).map(u => `${u.company}: ${u.reason}`).join(', ') || 'none'

    const { anthropic } = await import('@/lib/ai/client')

    const resp = await anthropic.messages.create({
      model: 'gpt-4.1-mini',
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

    // Cache in DB
    const cache: CachedBriefing = { text, generatedAt: new Date().toISOString() }
    await db.execute(
      sql`UPDATE workspaces SET focus_briefing_cache = ${JSON.stringify(cache)}::jsonb WHERE id = ${workspaceId}::uuid`
    )

    return NextResponse.json({ text, generatedAt: cache.generatedAt, cached: false })
  } catch (e) {
    console.error('[focus-briefing]', e)
    const msg = e instanceof Error ? e.message : 'Failed to generate briefing'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
