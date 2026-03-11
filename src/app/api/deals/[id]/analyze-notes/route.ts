export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { dealLogs, productGaps } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

const anthropic = new Anthropic()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const { meetingNotes } = await req.json()
    if (!meetingNotes?.trim()) return NextResponse.json({ error: 'No meeting notes provided' }, { status: 400 })
    const [deal] = await db.select().from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1)
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
      messages: [{ role: 'user', content: `You are analyzing B2B sales meeting notes. Extract structured information and return ONLY valid JSON, no markdown.

Meeting notes:
${meetingNotes}

Deal context: ${deal.dealName} with ${deal.prospectCompany}

Return this exact JSON structure:
{
  "summary": "2-3 sentence deal summary",
  "conversionScore": 65,
  "conversionInsights": ["Why score is X", "Key risk or opportunity", "Recommended next action"],
  "todos": [{"text": "action item"}],
  "productGaps": [{"title": "gap title", "description": "what customer needs that product lacks", "priority": "high"}]
}

conversionScore: 0-100. priority: critical | high | medium | low` }],
    })
    let parsed: any = {}
    try {
      const raw = (msg.content[0] as any).text.trim()
      parsed = JSON.parse(raw.replace(/^```json?\n?/, '').replace(/\n?```$/, ''))
    } catch {
      parsed = { summary: meetingNotes.slice(0, 200), conversionScore: 50, conversionInsights: [], todos: [], productGaps: [] }
    }
    const todos = (parsed.todos ?? []).map((t: any) => ({ id: crypto.randomUUID(), text: t.text, done: false, createdAt: new Date().toISOString() }))
    const [updatedDeal] = await db.update(dealLogs).set({
      meetingNotes, aiSummary: parsed.summary, conversionScore: parsed.conversionScore,
      conversionInsights: parsed.conversionInsights ?? [],
      todos: [...((deal.todos as any[]) ?? []), ...todos], updatedAt: new Date(),
    }).where(eq(dealLogs.id, id)).returning()
    const createdGaps = []
    for (const gap of (parsed.productGaps ?? [])) {
      if (!gap.title) continue
      const [existing] = await db.select().from(productGaps).where(and(eq(productGaps.workspaceId, workspaceId), eq(productGaps.title, gap.title))).limit(1)
      if (existing) {
        const [updated] = await db.update(productGaps).set({ frequency: (existing.frequency ?? 1) + 1, sourceDeals: [...((existing.sourceDeals as string[]) ?? []), id], updatedAt: new Date() }).where(eq(productGaps.id, existing.id)).returning()
        createdGaps.push(updated)
      } else {
        const [created] = await db.insert(productGaps).values({ workspaceId, userId, title: gap.title, description: gap.description ?? '', priority: gap.priority ?? 'medium', frequency: 1, sourceDeals: [id], status: 'open', affectedRevenue: deal.dealValue ?? null }).returning()
        createdGaps.push(created)
      }
    }
    return NextResponse.json({ data: { deal: updatedDeal, productGaps: createdGaps, parsed } })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
