export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { dealLogs, companyProfiles, competitors } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import { buildDealBriefing } from '@/lib/brain-narrator'
import { ensureLinksColumn } from '@/lib/api-helpers'

const anthropic = new Anthropic()

export type RiskKit = {
  emailSubject: string
  emailBody: string
  meetingPrepAngle: string
  collateralSuggestion: string
  urgencyReason: string
  generatedAt: string
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkRateLimit(userId, 'risk-kit', 5)
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

    // Build briefing for context
    const dealForBriefing = {
      dealName: deal.dealName,
      company: deal.prospectCompany,
      stage: deal.stage,
      dealRisks: (deal.dealRisks as string[]) ?? [],
      dealCompetitors: (deal.competitors as string[]) ?? [],
      conversionScore: deal.conversionScore ?? null,
    }
    const briefing = buildDealBriefing(brain ?? null, id, dealForBriefing)

    // ML signals
    const mlPred = brain?.mlPredictions?.find(p => p.dealId === id)
    const churnRisk = mlPred?.churnRisk
    const winProb = mlPred?.winProbability

    // Win playbook context
    const playbook = brain?.winPlaybook
    const compWinConditions = playbook?.perCompetitorWinCondition
      ?.filter(c => (deal.competitors as string[])?.includes(c.competitor))
      ?? []

    const prompt = `You are a senior B2B sales strategist generating a deal re-engagement kit for a stalled or at-risk deal.

DEAL: ${deal.dealName} | ${deal.prospectName ?? 'Unknown'} at ${deal.prospectCompany} | Stage: ${deal.stage}${deal.dealValue ? ` | Value: £${deal.dealValue.toLocaleString()}` : ''}
${deal.aiSummary ? `Status: ${deal.aiSummary}` : ''}
${churnRisk != null ? `Churn risk: ${churnRisk}% — ${mlPred?.churnDaysOverdue ? `${mlPred.churnDaysOverdue}d overdue for follow-up` : 'follow-up overdue'}` : ''}
${winProb != null ? `Win probability: ${Math.round(winProb * 100)}%` : ''}
${(deal.dealRisks as string[])?.length ? `Known risks: ${(deal.dealRisks as string[]).join('; ')}` : ''}
${deal.meetingNotes ? `\nRecent history (last update):\n${deal.meetingNotes.split('\n').slice(-3).join('\n')}` : ''}
${company ? `\nOUR PRODUCT: ${company.companyName} — ${(company.valuePropositions as string[])?.slice(0, 3).join(' · ')}` : ''}
${dealComps.length > 0 ? `\nCOMPETITORS: ${dealComps.map(c => `${c.name} (weakness: ${(c.weaknesses as string[])?.[0] ?? 'unknown'})`).join('; ')}` : ''}
${compWinConditions.length > 0 ? `\nWIN CONDITIONS WHEN FACING THESE COMPETITORS: ${compWinConditions.map(c => `${c.competitor}: ${c.winCondition} (${c.winRate}% win rate)`).join(' | ')}` : ''}
${briefing.recommendation ? `\nTop recommendation: ${briefing.recommendation}` : ''}

Return ONLY the following prefixed sections, each on its own line:

EMAIL_SUBJECT: [compelling re-engagement subject line, under 60 chars, no clickbait]
EMAIL_BODY: [3-4 sentence email. First: acknowledge the gap/silence honestly. Second: offer specific value relevant to their stated concern. Third: clear low-friction CTA. Sign off naturally. No placeholders like [Name].]
MEETING_PREP_ANGLE: [One sentence: the single positioning angle to lead with in the next call, specific to this deal's risks and the prospect's concerns.]
COLLATERAL_SUGGESTION: [One specific piece of content or proof point to share — case study type, ROI data, or demo flow — grounded in their known objections.]
URGENCY_REASON: [One honest, deal-specific reason to act now — without manufactured urgency. E.g. upcoming budget freeze, competitor evaluation window, their stated timeline.]`

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (msg.content[0] as any).text ?? ''

    function extractField(prefix: string): string {
      const match = raw.match(new RegExp(`^${prefix}:\\s*(.+)$`, 'm'))
      return match?.[1]?.trim() ?? ''
    }

    const kit: RiskKit = {
      emailSubject: extractField('EMAIL_SUBJECT'),
      emailBody: extractField('EMAIL_BODY'),
      meetingPrepAngle: extractField('MEETING_PREP_ANGLE'),
      collateralSuggestion: extractField('COLLATERAL_SUGGESTION'),
      urgencyReason: extractField('URGENCY_REASON'),
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json({ data: kit })
  } catch (e: unknown) {
    console.error('[risk-kit] failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Risk kit generation failed' }, { status: 500 })
  }
}
