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

/** Extract the most recent meeting note entry (last section after --- or last [date] block) */
function extractLatestNote(notes: string | null): string | null {
  if (!notes) return null
  // Split by --- separators and take the last non-empty section
  const sections = notes.split(/\n---\n/).filter(s => s.trim())
  if (sections.length === 0) return null
  const last = sections[sections.length - 1].trim()
  // Truncate to keep prompt size reasonable
  return last.length > 500 ? last.slice(0, 500) + '…' : last
}

// ─── GET: return cached briefing (zero API cost) ────────────────────────────

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)

    const [ws] = await db
      .select({
        cache: sql<CachedBriefing | null>`focus_briefing_cache`,
        brainUpdatedAt: sql<string | null>`(workspace_brain->>'updatedAt')`,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1)

    const cached = ws?.cache as CachedBriefing | null
    if (cached?.text) {
      // Signal staleness if brain was rebuilt after the briefing was generated
      const stale = ws?.brainUpdatedAt && cached.generatedAt
        ? new Date(ws.brainUpdatedAt).getTime() > new Date(cached.generatedAt).getTime()
        : false
      return NextResponse.json({ text: cached.text, generatedAt: cached.generatedAt, cached: true, stale })
    }
    return NextResponse.json({ text: null, cached: false, stale: false })
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
        const contacts = Array.isArray(d.contacts) ? (d.contacts as Array<{ name: string; title?: string }>).slice(0, 3).map(c => c.title ? `${c.name} (${c.title})` : c.name).join(', ') : ''
        const latestNote = extractLatestNote(d.meetingNotes as string | null)
        const noteLine = latestNote ? ` Latest update: ${latestNote}` : ''
        // Score trend — compare last 2 history entries if available
        const history = Array.isArray(d.scoreHistory) ? d.scoreHistory as Array<{ score: number; date: string }> : []
        const scoreTrend = history.length >= 2
          ? (() => {
              const prev = history[history.length - 2].score
              const curr = history[history.length - 1].score
              const delta = curr - prev
              return delta > 0 ? ` (↑+${delta}pts)` : delta < 0 ? ` (↓${delta}pts)` : ''
            })()
          : ''
        return `- ${d.prospectCompany} (${value}, score ${score}%${scoreTrend}, ${stage}): Risks: ${risks || 'none'}. Next: ${nextSteps || 'none'}. Contacts: ${contacts || 'none'}.${noteLine}`
      })
      .join('\n')

    const staleDeals = brain?.staleDeals?.slice(0, 5).map(s => `${s.company}: ${s.daysSinceUpdate}d stale`).join(', ') || 'none'
    const urgentDeals = brain?.urgentDeals?.slice(0, 5).map(u => `${u.company}: ${u.reason}`).join(', ') || 'none'

    const { anthropic } = await import('@/lib/ai/client')

    const resp = await anthropic.messages.create({
      model: 'gpt-5.4-mini',
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: `You are an expert sales coach giving a tight morning briefing. Your job: tell the rep exactly what to do today, in priority order, with enough context to act immediately without looking anything up.

FORMAT EXACTLY:
🔴 **Act Now** _(deals that will slip without action today)_
1. [Company] (£[value], [score]%) — [what happened + what to do NOW + who to contact]
2. ...

🟡 **Move Forward** _(high-value deals with clear next steps)_
3. [Company] (£[value]) — [specific next action + why it matters]
4. ...

🟢 **Keep Warm** _(healthy deals that just need a touch)_
► [Company] — [1-line action]
► ...

---
💡 _[1 sentence synthesis: total pipeline value, main blocker theme]_

RULES:
- Use REAL company names, contact names (first + last), and £ values from the data
- CRITICAL: "Latest update" is the ground truth — it OVERRIDES "Next steps" if both exist
- Act Now = stale >10 days, competitor mentioned, passed deadline, or score below 45
- Move Forward = score ≥55%, notes in last 7 days, clear path to close
- Keep Warm = score ≥65%, low urgency, needs a nudge
- Be SPECIFIC: "Send revised MSA to Sarah Chen by EOD" not "Follow up on contract"
- Max 7–8 items total. Skip low-value deals with no notes.
- If fewer than 3 deals, omit empty sections gracefully.

PIPELINE DATA:
${dealLines}

BRAIN SIGNALS:
Stale: ${staleDeals}
Urgent: ${urgentDeals}

Write ONLY the briefing. No intro or sign-off.`
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
