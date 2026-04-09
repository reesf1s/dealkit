export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { anthropic } from '@/lib/ai/client'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export type MeddicSignal = { score: 0 | 0.5 | 1; note: string | null }
export type MeddicScore = {
  metrics:          MeddicSignal
  economicBuyer:    MeddicSignal
  decisionCriteria: MeddicSignal
  decisionProcess:  MeddicSignal
  identifyPain:     MeddicSignal
  champion:         MeddicSignal
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkRateLimit(userId, 'meddic', 20)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)

    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params

    const [deal] = await db.select({
      id:              dealLogs.id,
      dealName:        dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      prospectName:    dealLogs.prospectName,
      prospectTitle:   dealLogs.prospectTitle,
      contacts:        dealLogs.contacts,
      meetingNotes:    dealLogs.meetingNotes,
      nextSteps:       dealLogs.nextSteps,
      aiSummary:       dealLogs.aiSummary,
      dealRisks:       dealLogs.dealRisks,
      stage:           dealLogs.stage,
    }).from(dealLogs)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const contacts = (deal.contacts as Array<{ name: string; title?: string }>) ?? []

    const contextParts = [
      deal.meetingNotes
        ? `Meeting notes:\n${String(deal.meetingNotes).slice(-3000)}`
        : 'No meeting notes.',
      deal.aiSummary    ? `Deal summary: ${deal.aiSummary}` : '',
      (deal.dealRisks as string[])?.length
        ? `Known risks: ${(deal.dealRisks as string[]).join(', ')}`
        : '',
      deal.nextSteps    ? `Next steps: ${deal.nextSteps}` : '',
      contacts.length
        ? `Contacts: ${contacts.map(c => `${c.name}${c.title ? ` (${c.title})` : ''}`).join(', ')}`
        : '',
    ].filter(Boolean).join('\n\n')

    const prompt = `You are a sales methodology expert evaluating a deal against the MEDDIC framework.

Deal: ${deal.dealName || deal.prospectCompany} | Stage: ${deal.stage?.replace(/_/g, ' ')}

${contextParts}

Score each MEDDIC pillar based on evidence in the notes:
  1 = clearly confirmed
  0.5 = mentioned or partially evident
  0 = no evidence

Return ONLY this exact JSON (no markdown, no extra text):
{
  "metrics":          { "score": 0, "note": null },
  "economicBuyer":    { "score": 0, "note": null },
  "decisionCriteria": { "score": 0, "note": null },
  "decisionProcess":  { "score": 0, "note": null },
  "identifyPain":     { "score": 0, "note": null },
  "champion":         { "score": 0, "note": null }
}

Replace the score values and add concise 1-sentence notes. Use null for note if score is 0.`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()

    let meddic: MeddicScore
    try {
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      meddic = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Failed to parse MEDDIC response' }, { status: 500 })
    }

    // Persist to DB
    await db.update(dealLogs)
      .set({ meddic: meddic as any, updatedAt: new Date() } as any)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))

    return NextResponse.json({ data: meddic })
  } catch (err: any) {
    console.error('[meddic]', err)
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
