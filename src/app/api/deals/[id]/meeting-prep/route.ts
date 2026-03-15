export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { dealLogs, companyProfiles, competitors, collateral } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getWorkspaceBrain, formatBrainContext } from '@/lib/workspace-brain'

const anthropic = new Anthropic()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rl = await checkRateLimit(userId, 'meeting-prep', 10)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const [[deal], [company], comps, relatedCollateral, brain] = await Promise.all([
      db.select().from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1),
      db.select().from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1),
      db.select().from(competitors).where(eq(competitors.workspaceId, workspaceId)),
      db.select().from(collateral).where(and(eq(collateral.workspaceId, workspaceId), eq(collateral.sourceDealLogId, id))),
      getWorkspaceBrain(workspaceId),
    ])
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const dealComps = comps.filter(c => (deal.competitors as string[])?.includes(c.name))
    const brainContext = brain ? formatBrainContext(brain) : null
    const prompt = `You are a B2B sales coach. Generate a focused meeting prep brief — only the most critical points a rep needs. Be concise.

DEAL: ${deal.dealName} | ${deal.prospectName ?? 'Unknown'} at ${deal.prospectCompany} | Stage: ${deal.stage}${deal.dealValue ? ` | Value: £${deal.dealValue.toLocaleString()}` : ''}
${deal.aiSummary ? `Summary: ${deal.aiSummary}` : ''}
${(deal.dealRisks as string[])?.length ? `Risks: ${(deal.dealRisks as string[]).join('; ')}` : ''}
${((deal.todos as any[]) ?? []).filter((t: any) => !t.done).length > 0 ? `Open actions: ${((deal.todos as any[]) ?? []).filter((t: any) => !t.done).map((t: any) => t.text).join('; ')}` : ''}
${deal.meetingNotes ? `Meeting history:\n${deal.meetingNotes}` : ''}
${company ? `\nOUR PRODUCT: ${company.companyName} — ${(company.valuePropositions as string[])?.slice(0, 3).join(' · ')}. Key differentiators: ${(company.differentiators as string[])?.slice(0, 3).join(', ')}` : ''}
${dealComps.length > 0 ? `\nCOMPETITORS: ${dealComps.map(c => `${c.name} (weaknesses: ${(c.weaknesses as string[])?.slice(0, 2).join(', ')})`).join('; ')}` : ''}
${brainContext ? `\nPIPELINE INTELLIGENCE (use to add relevant cross-deal context to the prep):\n${brainContext}` : ''}

Return a brief prep doc in this exact format (use plain headers and bullet points):

## Objective
One sentence: what must be achieved in this meeting.

## Key Points (max 4)
- Most important thing to communicate
- ...

## Objections to Expect
- Objection → short response
- ...

## Questions to Ask (max 3)
- ...

## Next Step
One clear next action to close or advance.`
    const msg = await anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 700, messages: [{ role: 'user', content: prompt }] })
    const prep = (msg.content[0] as any).text
    return NextResponse.json({ data: { prep } })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
