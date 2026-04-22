export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { anthropic } from '@/lib/ai/client'
import { db } from '@/lib/db'
import { dealLogs, companyProfiles, competitors } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import { ensureLinksColumn } from '@/lib/api-helpers'
import {
  buildNoteCentricBrainContext,
  buildPreferredNoteCorpus,
  buildStructuredNoteCorpus,
  extractDatedEntries,
  formatDatedNote,
} from '@/lib/note-intelligence'

function getFirstText(content: Array<{ type: string; text?: string }>): string {
  const part = content.find(item => item.type === 'text' && typeof item.text === 'string')
  return part?.text ?? ''
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rl = await checkRateLimit(userId, 'meeting-prep', 10)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    await ensureLinksColumn()
    const [[deal], [company], comps, brain] = await Promise.all([
      db.select().from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1),
      db.select().from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1),
      db.select().from(competitors).where(eq(competitors.workspaceId, workspaceId)),
      getWorkspaceBrain(workspaceId),
    ])
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const dealComps = comps.filter(c => (deal.competitors as string[])?.includes(c.name))
    const brainContext = buildNoteCentricBrainContext(
      brain,
      [
        {
          id: deal.id,
          dealName: deal.dealName,
          prospectCompany: deal.prospectCompany ?? '',
        },
      ],
    )
    // Extract ML prediction and churn risk for this deal from the brain
    const mlPred = brain?.mlPredictions?.find(p => p.dealId === id)
    const churnRisk = mlPred?.churnRisk
    const churnDaysOverdue = mlPred?.churnDaysOverdue
    const winProb = mlPred?.winProbability
    const objectionIntel = brain?.objectionConditionalWins ?? []
    const dealRisksArr: string[] = (deal.dealRisks as string[]) ?? []
    const dealObjIntel = objectionIntel.filter(o =>
      dealRisksArr.some(r =>
        r.toLowerCase().includes(o.theme.toLowerCase().split(' ')[0])
      )
    )
    const structuredNotes = buildStructuredNoteCorpus({
      meetingNotes: deal.meetingNotes,
      hubspotNotes: deal.hubspotNotes,
      notes: typeof deal.notes === 'string' ? deal.notes : null,
    })
    const preferredNotes = structuredNotes || buildPreferredNoteCorpus({
      meetingNotes: deal.meetingNotes,
      hubspotNotes: deal.hubspotNotes,
      notes: typeof deal.notes === 'string' ? deal.notes : null,
    })
    const datedEntries = extractDatedEntries(preferredNotes)
    const latestMeetingNote = datedEntries[0] ? formatDatedNote(datedEntries[0]) : null
    const recentEvidence = datedEntries.slice(0, 6).map(entry => `- ${formatDatedNote(entry)}`).join('\n')
    const legacyContext = preferredNotes && datedEntries.length === 0
      ? preferredNotes.slice(-700)
      : null

    const mlSection = [
      winProb != null ? `Win probability (ML): ${Math.round(winProb * 100)}%` : '',
      churnRisk != null && churnRisk >= 40
        ? `⚠️ Churn risk: ${churnRisk}%${churnDaysOverdue ? ` — ${churnDaysOverdue}d overdue for follow-up` : ' — follow-up overdue'}`
        : '',
    ].filter(Boolean).join('\n')

    const objIntelSection = dealObjIntel.length > 0
      ? `\nOBJECTION INTELLIGENCE (champion effect on win rate by stage):\n${dealObjIntel.map(o => {
          const relevant = o.stageBreakdown.filter(s => s.sampleSize >= 2)
          if (!relevant.length) return null
          return `- "${o.theme}": ${relevant.map(s =>
            `${s.stage} — with champion ${s.winRateWithChampion != null ? `${Math.round(s.winRateWithChampion * 100)}%` : 'n/a'} vs without ${s.winRateNoChampion != null ? `${Math.round(s.winRateNoChampion * 100)}%` : 'n/a'}${s.championLift != null && s.championLift > 0.1 ? ` (champion adds +${Math.round(s.championLift * 100)}pts)` : ''}`
          ).join(' | ')}`
        }).filter(Boolean).join('\n')}`
      : ''

    const prompt = `You are a senior B2B sales coach. Produce a sharp, deal-specific meeting prep brief. Be direct — no filler, no generic advice. Every point must be specific to this deal.

CRITICAL: Treat meeting notes and uploaded notes as the source of truth. Do not reference task lists, checklists, or success criteria unless those facts are explicitly stated in the notes themselves.
If a note says "tomorrow", "next week", or a weekday, interpret it relative to the note date, not today.

DEAL: ${deal.dealName} | ${deal.prospectName ?? 'Unknown'} at ${deal.prospectCompany} | Stage: ${deal.stage}${deal.dealValue ? ` | Value: £${deal.dealValue.toLocaleString()}` : ''}
${!latestMeetingNote && !recentEvidence && deal.aiSummary ? `Status fallback: ${deal.aiSummary}` : ''}
${mlSection ? `\nML SIGNALS:\n${mlSection}` : ''}
${(deal.dealRisks as string[])?.length ? `\nKnown risks: ${(deal.dealRisks as string[]).join('; ')}` : ''}
${latestMeetingNote ? `\nLatest dated note:\n${latestMeetingNote}` : ''}
${recentEvidence ? `\nRecent dated evidence:\n${recentEvidence}` : ''}
${legacyContext ? `\nLegacy undated context (use cautiously, never as current momentum):\n${legacyContext}` : ''}
${company ? `\nOUR PRODUCT: ${company.companyName} — ${(company.valuePropositions as string[])?.slice(0, 3).join(' · ')}. Differentiators: ${(company.differentiators as string[])?.slice(0, 3).join(', ')}` : ''}
${dealComps.length > 0 ? `\nCOMPETITORS IN THIS DEAL: ${dealComps.map(c => `${c.name} (weaknesses: ${(c.weaknesses as string[])?.slice(0, 2).join(', ')})`).join('; ')}` : ''}
${objIntelSection}
${brainContext ? `\nPIPELINE INTELLIGENCE:\n${brainContext}` : ''}

Return in this exact format:

## Objective
One sentence — the specific outcome that must be achieved today.

## Key Points (max 4)
- Specific thing to communicate or position, grounded in deal history
- ...

## Objections to Expect
- [Most likely objection based on deal history] → [Precise counter using our differentiators]
- ...

## Questions to Ask (max 3)
- High-value open question to uncover next blocker or accelerate close
- ...

## Champion Strategy
One sentence: how to leverage or build a champion at ${deal.prospectCompany} given what you know.

## Next Step
One concrete, time-bound action to advance or close this deal.`
    const msg = await anthropic.messages.create({ model: 'gpt-5.4-mini', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
    const prep = getFirstText(msg.content)
    return NextResponse.json({ data: { prep } })
  } catch (e: unknown) { console.error('[meeting-prep] failed:', e instanceof Error ? e.message : e); return NextResponse.json({ error: 'Meeting prep failed' }, { status: 500 }) }
}
