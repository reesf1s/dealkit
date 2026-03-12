export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { dealLogs, productGaps, companyProfiles } from '@/lib/db/schema'
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

    // Fetch known capabilities so AI doesn't re-flag confirmed product features as gaps
    const [profile] = await db
      .select({ knownCapabilities: companyProfiles.knownCapabilities })
      .from(companyProfiles)
      .where(eq(companyProfiles.workspaceId, workspaceId))
      .limit(1)
    const knownCapabilities = (profile?.knownCapabilities as string[]) ?? []
    const capabilitiesContext = knownCapabilities.length > 0
      ? `\n\nCONFIRMED PRODUCT CAPABILITIES (do NOT flag these as product gaps under any circumstances):\n${knownCapabilities.map(c => `- ${c}`).join('\n')}`
      : ''

    const previousContext = [
      deal.meetingNotes ? `PREVIOUS MEETING HISTORY (all prior meetings for this deal):\n${deal.meetingNotes}` : '',
      deal.aiSummary ? `CURRENT DEAL SUMMARY: ${deal.aiSummary}` : '',
      (deal.dealRisks as string[])?.length ? `KNOWN DEAL RISKS SO FAR: ${(deal.dealRisks as string[]).join('; ')}` : '',
    ].filter(Boolean).join('\n\n')

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
      messages: [{ role: 'user', content: `You are analyzing B2B sales meeting notes. Extract structured information and return ONLY valid JSON, no markdown.

${previousContext ? `${previousContext}\n\n---\n\n` : ''}NEW MEETING NOTES TO ANALYZE:
${meetingNotes}

Deal context: ${deal.dealName} with ${deal.prospectCompany}${capabilitiesContext}

${previousContext ? 'Use the full meeting history above to inform your analysis — the summary, conversion score, and risks should reflect the entire deal trajectory, not just today\'s notes.' : ''}

Return this exact JSON structure:
{
  "summary": "2-3 sentence deal summary",
  "conversionScore": 65,
  "conversionInsights": ["Why score is X", "Key risk or opportunity", "Recommended next action"],
  "risks": ["Deal risk or warning signal observed in the notes"],
  "todos": [{"text": "action item"}],
  "productGaps": [{"title": "gap title", "description": "what customer needs that product lacks", "priority": "high"}]
}

conversionScore: 0-100. priority: critical | high | medium | low

IMPORTANT — risks rules:
- Include any signals that could jeopardise this deal: disengagement, slow responses, champion leaving, budget concerns, competing priorities, late-stage hesitation, unclear decision-maker, etc.
- These are deal-level risks, NOT product feature complaints. A risk is something about this specific sales cycle.
- Keep each risk concise (1 sentence). Max 4 risks. Return [] if none observed.

IMPORTANT — productGaps rules:
- Only include a product gap if the prospect EXPLICITLY mentioned a missing feature, integration, or capability that your product does not currently support.
- Examples of real product gaps: "we need Salesforce integration", "it doesn't support SSO", "we require an API for X".
- DO NOT create product gaps from: scheduling tasks, follow-up emails, admin work, attendance tracking requests (unless the prospect said the product lacks it), general to-dos, deal risks, or anything that is a sales/process action rather than a product capability complaint.
- If no explicit product gaps are mentioned, return an empty array: "productGaps": []` }],
    })
    let parsed: any = {}
    try {
      const raw = (msg.content[0] as any).text.trim()
      parsed = JSON.parse(raw.replace(/^```json?\n?/, '').replace(/\n?```$/, ''))
    } catch {
      parsed = { summary: meetingNotes.slice(0, 200), conversionScore: 50, conversionInsights: [], risks: [], todos: [], productGaps: [] }
    }
    const todos = (parsed.todos ?? []).map((t: any) => ({ id: crypto.randomUUID(), text: t.text, done: false, createdAt: new Date().toISOString() }))
    const dateStamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const appendedNotes = deal.meetingNotes
      ? `${deal.meetingNotes}\n\n---\n[${dateStamp}]\n${meetingNotes}`
      : meetingNotes
    const [updatedDeal] = await db.update(dealLogs).set({
      meetingNotes: appendedNotes, aiSummary: parsed.summary, conversionScore: parsed.conversionScore,
      conversionInsights: parsed.conversionInsights ?? [],
      dealRisks: parsed.risks ?? [],
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
