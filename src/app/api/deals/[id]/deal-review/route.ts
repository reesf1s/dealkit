export const dynamic = 'force-dynamic'
export const maxDuration = 45

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { anthropic } from '@/lib/ai/client'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getEffectiveDealSummary } from '@/lib/effective-deal-summary'

export interface DealReviewCriterion {
  name: string
  score: 0 | 1 | 2  // 0=red/missing, 1=amber/partial, 2=green/confirmed
  finding: string    // one sentence summary
  action: string | null  // specific recommended action
}

export interface DealReviewCrmUpdate {
  field: string
  suggestedValue: string
  reason: string
}

export interface DealReview {
  overall: number     // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  summary: string     // 2-3 sentence coaching summary
  criteria: DealReviewCriterion[]
  crmUpdates: DealReviewCrmUpdate[]
  coachingNote: string  // manager-facing coaching note
  generatedAt: string
}

const GRADE = (score: number): DealReview['grade'] =>
  score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkRateLimit(userId, 'deal-review', 10)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)

    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params

    const [deal] = await db.select({
      id:                 dealLogs.id,
      dealName:           dealLogs.dealName,
      prospectCompany:    dealLogs.prospectCompany,
      prospectName:       dealLogs.prospectName,
      stage:              dealLogs.stage,
      dealValue:          dealLogs.dealValue,
      closeDate:          dealLogs.closeDate,
      meetingNotes:       dealLogs.meetingNotes,
      nextSteps:          dealLogs.nextSteps,
      aiSummary:          dealLogs.aiSummary,
      dealReview:         dealLogs.dealReview,
      dealRisks:          dealLogs.dealRisks,
      conversionInsights: dealLogs.conversionInsights,
      conversionScore:    dealLogs.conversionScore,
      competitors:        dealLogs.competitors,
      contacts:           dealLogs.contacts,
      description:        dealLogs.description,
      engagementType:     dealLogs.engagementType,
    }).from(dealLogs)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const effectiveSummary = getEffectiveDealSummary(deal)

    const contextLines = [
      `Deal: ${deal.dealName || deal.prospectCompany}`,
      `Company: ${deal.prospectCompany}`,
      `Stage: ${deal.stage?.replace(/_/g, ' ')}`,
      deal.dealValue ? `Value: £${Number(deal.dealValue).toLocaleString()}` : '',
      deal.closeDate ? `Target close: ${new Date(deal.closeDate).toLocaleDateString('en-GB')}` : '',
      deal.conversionScore != null ? `Current AI score: ${deal.conversionScore}/100` : '',
      (deal.contacts as any[])?.length
        ? `Contacts: ${(deal.contacts as any[]).map((c: any) => `${c.name}${c.title ? ` (${c.title})` : ''}`).join(', ')}`
        : '',
      (deal.competitors as string[])?.length
        ? `Known competitors: ${(deal.competitors as string[]).join(', ')}`
        : '',
      deal.nextSteps?.trim() ? `Next steps: ${deal.nextSteps.trim()}` : '',
      (deal.dealRisks as string[])?.length
        ? `Identified risks: ${(deal.dealRisks as string[]).join('; ')}`
        : '',
      (deal.conversionInsights as string[])?.length
        ? `AI insights: ${(deal.conversionInsights as string[]).slice(0, 4).join('; ')}`
        : '',
      effectiveSummary ? `Summary: ${effectiveSummary}` : '',
      deal.meetingNotes
        ? `Meeting notes:\n${String(deal.meetingNotes).slice(-3500)}`
        : '',
    ].filter(Boolean).join('\n')

    const prompt = `You are a senior sales manager reviewing a deal. Score it across 6 dimensions and provide coaching.

DEAL CONTEXT:
${contextLines}

REVIEW CRITERIA (score each 0=red/missing, 1=amber/partial, 2=green/confirmed):
1. Champion — Is there an internal champion actively selling for us?
2. Urgency — Is there a clear compelling event or deadline driving the deal?
3. Economics — Is budget confirmed and ROI/value proposition clearly quantified?
4. Process — Do we know the full decision process, approvers, and procurement steps?
5. Competition — Are we differentiated and is the competitive situation understood?
6. Next Steps — Are concrete, mutually agreed next steps defined and on the calendar?

ALSO provide:
- 2-3 suggested CRM field updates based on what you can infer from the notes
- A 2-sentence coaching note for the manager about this deal's biggest risk

Respond ONLY with this exact JSON (no markdown):
{
  "overall": 0-100,
  "summary": "2-3 sentence deal health summary",
  "criteria": [
    {"name":"Champion","score":0|1|2,"finding":"one sentence","action":"specific action or null"},
    {"name":"Urgency","score":0|1|2,"finding":"one sentence","action":"specific action or null"},
    {"name":"Economics","score":0|1|2,"finding":"one sentence","action":"specific action or null"},
    {"name":"Process","score":0|1|2,"finding":"one sentence","action":"specific action or null"},
    {"name":"Competition","score":0|1|2,"finding":"one sentence","action":"specific action or null"},
    {"name":"Next Steps","score":0|1|2,"finding":"one sentence","action":"specific action or null"}
  ],
  "crmUpdates": [
    {"field":"field name","suggestedValue":"value","reason":"why"}
  ],
  "coachingNote": "Manager-facing note about biggest risk and recommended focus"
}`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    let parsed: Omit<DealReview, 'grade' | 'generatedAt'>
    try {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const review: DealReview = {
      ...parsed,
      overall: Math.min(100, Math.max(0, Math.round(parsed.overall))),
      grade: GRADE(parsed.overall),
      generatedAt: new Date().toISOString(),
    }

    await db.update(dealLogs)
      .set({ dealReview: review })
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))

    return NextResponse.json({ data: review })
  } catch (err: any) {
    console.error('[deal-review]', err)
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
