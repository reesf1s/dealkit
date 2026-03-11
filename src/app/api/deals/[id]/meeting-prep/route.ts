export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { dealLogs, companyProfiles, competitors, collateral } from '@/lib/db/schema'

const anthropic = new Anthropic()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params

    const [[deal], [company], comps, relatedCollateral] = await Promise.all([
      db.select().from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.userId, userId))).limit(1),
      db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId)).limit(1),
      db.select().from(competitors).where(eq(competitors.userId, userId)),
      db.select().from(collateral).where(and(eq(collateral.userId, userId), eq(collateral.sourceDealLogId, id))),
    ])
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const dealComps = comps.filter(c => (deal.competitors as string[])?.includes(c.name))

    const prompt = `You are a world-class B2B sales coach preparing a rep for an important meeting.

# Deal: ${deal.dealName}
- Prospect: ${deal.prospectName ?? 'Unknown'} at ${deal.prospectCompany}
- Stage: ${deal.stage}
- Value: ${deal.dealValue ? `$${(deal.dealValue/100).toLocaleString()}` : 'Unknown'}
- Notes: ${deal.notes ?? 'None'}
- Meeting notes history: ${deal.meetingNotes ?? 'None'}
- AI summary: ${deal.aiSummary ?? 'None'}
- Open todos: ${((deal.todos as any[]) ?? []).filter(t => !t.done).map((t: any) => t.text).join(', ') || 'None'}

# Our Company
${company ? `${company.companyName} - ${company.description ?? ''}
Value props: ${(company.valuePropositions as string[])?.join(', ') ?? ''}
Differentiators: ${(company.differentiators as string[])?.join(', ') ?? ''}` : 'Not configured'}

# Competing Against
${dealComps.length > 0 ? dealComps.map(c => `- ${c.name}: Strengths: ${(c.strengths as string[])?.join(', ')}. Weaknesses: ${(c.weaknesses as string[])?.join(', ')}`).join('\n') : 'No known competitors'}

# Existing Collateral
${relatedCollateral.length > 0 ? relatedCollateral.map(c => `- ${c.title} (${c.type})`).join('\n') : 'No collateral generated yet'}

Generate a concise meeting prep document in markdown with these sections:
## Meeting Objective
## Key Talking Points (3-5 bullets)
## Competitive Handling (if competitors known)
## Anticipated Objections & Responses
## Questions to Ask
## Success Criteria for This Meeting
## Next Steps Template

Be specific, practical, and focused on closing.`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const prep = (msg.content[0] as any).text
    return NextResponse.json({ data: { prep } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
