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

interface Stakeholder {
  name: string
  title: string | null
  role: 'Champion' | 'Economic Buyer' | 'Technical Evaluator' | 'Blocker' | 'Coach' | 'End User'
  influence: 'high' | 'medium' | 'low'
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown'
  engagement: 'active' | 'passive' | 'disengaged'
  concerns: string[]
  action: string
  reportsTo: string | null
  influencedBy: string[]
}

interface StakeholderMap {
  stakeholders: Stakeholder[]
  gaps: string[]
  recommendation: string
  generatedAt: string
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await checkRateLimit(userId, 'stakeholder-map', 10)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)

    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params

    const [deal] = await db.select({
      id: dealLogs.id,
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      stage: dealLogs.stage,
      contacts: dealLogs.contacts,
      meetingNotes: dealLogs.meetingNotes,
    })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))
      .limit(1)

    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const contacts = (deal.contacts ?? []) as Array<{ name?: string; email?: string; title?: string; role?: string }>
    const meetingNotes = deal.meetingNotes?.trim() || ''

    if (contacts.length === 0 && !meetingNotes) {
      return NextResponse.json(
        { error: 'No contacts or meeting notes available to analyze. Add contacts or meeting notes first.' },
        { status: 400 },
      )
    }

    const contactsBlock = contacts.length > 0
      ? `Known contacts:\n${contacts.map(c => `- ${c.name || 'Unknown'}${c.title ? ` (${c.title})` : ''}${c.email ? ` <${c.email}>` : ''}${c.role ? ` — role: ${c.role}` : ''}`).join('\n')}`
      : 'No contacts on file.'

    const notesBlock = meetingNotes
      ? `Meeting notes:\n${meetingNotes.slice(0, 6000)}`
      : 'No meeting notes available.'

    const prompt = `Analyze the following deal information and build a stakeholder influence map.

Deal: ${deal.dealName}
Company: ${deal.prospectCompany}
Stage: ${deal.stage}

${contactsBlock}

${notesBlock}

For each stakeholder you can identify (from contacts and/or mentioned in notes), determine:
1. Their role in the buying process: Champion, Economic Buyer, Technical Evaluator, Blocker, Coach, or End User
2. Influence level: high, medium, or low
3. Sentiment toward the deal: positive, neutral, negative, or unknown
4. Engagement level: active, passive, or disengaged
5. Key concerns or interests they've expressed
6. Recommended next action for this stakeholder
7. Who they report to (if discernible)
8. Who influences them (if discernible)

Also identify:
- Gaps in stakeholder coverage (missing roles, missing executive sponsor, etc.)
- An overall recommendation for stakeholder engagement strategy

Respond with valid JSON only, no markdown. Use this exact structure:
{
  "stakeholders": [
    {
      "name": "string",
      "title": "string or null",
      "role": "Champion | Economic Buyer | Technical Evaluator | Blocker | Coach | End User",
      "influence": "high | medium | low",
      "sentiment": "positive | neutral | negative | unknown",
      "engagement": "active | passive | disengaged",
      "concerns": ["string"],
      "action": "string",
      "reportsTo": "string or null",
      "influencedBy": ["string"]
    }
  ],
  "gaps": ["string"],
  "recommendation": "string"
}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1400,
      system: 'You are a sales strategy analyst. You MUST respond with valid JSON only. No markdown fences, no commentary, no text before or after the JSON object.',
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = response.content[0]?.type === 'text' ? response.content[0].text : ''

    // Clean any markdown fences or surrounding text
    const cleaned = rawText
      .replace(/^[\s\S]*?(\{)/m, '$1')  // strip everything before first {
      .replace(/\}[\s\S]*$/m, '}')       // strip everything after last }
      .trim()

    let parsed: { stakeholders: Stakeholder[]; gaps: string[]; recommendation: string }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Try one more time with aggressive cleaning
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('No JSON found')
        parsed = JSON.parse(jsonMatch[0])
      } catch {
        console.error('[stakeholder-map] Parse failure. Raw:', rawText.slice(0, 500))
        return NextResponse.json({ error: 'AI returned an unexpected format. Try again.' }, { status: 502 })
      }
    }

    const data: StakeholderMap = {
      stakeholders: parsed.stakeholders ?? [],
      gaps: parsed.gaps ?? [],
      recommendation: parsed.recommendation ?? '',
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('[stakeholder-map]', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
