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
import { getEffectiveDealSummary } from '@/lib/effective-deal-summary'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkRateLimit(userId, 'compose-email', 20)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)

    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params

    const body = await req.json().catch(() => ({}))
    const tone: string = body.tone ?? 'professional'

    const [deal] = await db.select({
      id:                dealLogs.id,
      dealName:          dealLogs.dealName,
      prospectCompany:   dealLogs.prospectCompany,
      prospectName:      dealLogs.prospectName,
      prospectTitle:     dealLogs.prospectTitle,
      contacts:          dealLogs.contacts,
      dealValue:         dealLogs.dealValue,
      stage:             dealLogs.stage,
      meetingNotes:      dealLogs.meetingNotes,
      nextSteps:         dealLogs.nextSteps,
      aiSummary:         dealLogs.aiSummary,
      dealReview:        dealLogs.dealReview,
      dealRisks:         dealLogs.dealRisks,
      dealType:          dealLogs.dealType,
      recurringInterval: dealLogs.recurringInterval,
    }).from(dealLogs)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const contacts = (deal.contacts as Array<{ name: string; title?: string; email?: string }>) ?? []
    const primaryContact = deal.prospectName || contacts[0]?.name || 'there'
    const primaryTitle = deal.prospectTitle || contacts[0]?.title || ''

    const toneGuide =
      tone === 'friendly'  ? 'conversational and warm — use first name, sound human not corporate' :
      tone === 'urgent'    ? 'direct and action-oriented — create clear urgency around timeline or next step' :
                             'professional and concise — executive-friendly, respects their time'

    const valueStr = deal.dealValue
      ? `£${Number(deal.dealValue).toLocaleString()}${deal.dealType === 'recurring' ? ` ${deal.recurringInterval ?? 'recurring'}` : ''}`
      : null
    const effectiveSummary = getEffectiveDealSummary(deal)

    const contextLines = [
      `Deal: ${deal.dealName || deal.prospectCompany}`,
      `Company: ${deal.prospectCompany}`,
      `Contact: ${primaryContact}${primaryTitle ? ` (${primaryTitle})` : ''}`,
      `Stage: ${deal.stage?.replace(/_/g, ' ')}`,
      valueStr ? `Value: ${valueStr}` : '',
      deal.nextSteps?.trim() ? `Agreed next steps: ${deal.nextSteps.trim()}` : '',
      effectiveSummary ? `Deal summary: ${effectiveSummary}` : '',
      deal.meetingNotes
        ? `Recent meeting notes:\n${String(deal.meetingNotes).slice(-1800)}`
        : '',
    ].filter(Boolean).join('\n')

    const prompt = `You are a senior enterprise sales professional writing a follow-up email.

DEAL CONTEXT:
${contextLines}

REQUIREMENTS:
- Tone: ${toneGuide}
- Reference SPECIFIC details from the meeting notes — zero generic filler
- Maximum 3 short paragraphs
- End with a single, specific call-to-action
- Do NOT open with "I hope this email finds you well" or any variant
- Address the contact as ${primaryContact}

Respond ONLY with this exact JSON (no markdown fences):
{"subject":"...","body":"..."}

Use \\n in body for paragraph breaks. Make it genuinely personal and actionable.`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()

    let result: { subject: string; body: string }
    try {
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      result = JSON.parse(cleaned)
    } catch {
      result = { subject: `Following up — ${deal.prospectCompany}`, body: raw }
    }

    return NextResponse.json({ data: result })
  } catch (err: any) {
    console.error('[compose-email]', err)
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
