export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { dealLogs, productGaps, companyProfiles } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { rebuildWorkspaceBrain } from '@/lib/workspace-brain'

const anthropic = new Anthropic()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rl = await checkRateLimit(userId, 'analyze-notes', 10)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const { meetingNotes } = await req.json()
    if (!meetingNotes?.trim()) return NextResponse.json({ error: 'No meeting notes provided' }, { status: 400 })
    // Selective columns only — avoids SELECT * failing on any schema col that hasn't been migrated yet
    const [deal] = await db.select({
      id: dealLogs.id,
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      dealValue: dealLogs.dealValue,
      stage: dealLogs.stage,
      todos: dealLogs.todos,
      aiSummary: dealLogs.aiSummary,
      dealRisks: dealLogs.dealRisks,
      meetingNotes: dealLogs.meetingNotes,
    }).from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1)
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

    // Compress meeting history to last 5 structured [date] entries only — skip raw email blobs
    // This prevents unbounded context growth while preserving recent trajectory
    function compressMeetingHistory(raw: string | null): string {
      if (!raw) return ''
      const entries = raw.split('\n').reduce<string[]>((acc, line) => {
        if (/^\[\d/.test(line)) acc.push(line)        // start of a new [date] entry
        else if (acc.length > 0) acc[acc.length - 1] += ' ' + line.trim() // continuation
        return acc
      }, [])
      const recent = entries.slice(-5) // keep only last 5 structured entries
      return recent.join('\n')
    }

    const compressedHistory = compressMeetingHistory(deal.meetingNotes as string | null)

    const previousContext = [
      compressedHistory ? `MEETING HISTORY (last 5 updates for this deal):\n${compressedHistory}` : '',
      deal.aiSummary ? `CURRENT DEAL SUMMARY: ${deal.aiSummary}` : '',
      (deal.dealRisks as string[])?.length ? `KNOWN RISKS: ${(deal.dealRisks as string[]).join('; ')}` : '',
    ].filter(Boolean).join('\n\n')

    const existingTodos = (deal.todos as any[]) ?? []
    const openTodos = existingTodos.filter((t: any) => !t.done)
    const existingTodosContext = openTodos.length > 0
      ? `\n\nEXISTING OPEN ACTION ITEMS:\n${openTodos.map((t: any) => `- [${t.id}] ${t.text}`).join('\n')}\n\nRules for todos:\n- Do NOT add duplicates or near-duplicates of existing items\n- Return obsoleteTodoIds: IDs of existing items that are now done, superseded, irrelevant, or duplicated — these will be DELETED`
      : ''

    const msg = await anthropic.messages.create({
      // Sonnet for deeper analysis + larger output budget — handles complex multi-field extraction reliably
      model: 'claude-3-5-sonnet-20241022', max_tokens: 3000,
      messages: [{ role: 'user', content: `You are analyzing B2B sales meeting notes. Extract structured information and return ONLY valid JSON, no markdown.

${previousContext ? `${previousContext}\n\n---\n\n` : ''}NEW MEETING NOTES TO ANALYZE:
${meetingNotes}

Deal context: ${deal.dealName} with ${deal.prospectCompany}${capabilitiesContext}${existingTodosContext}

${previousContext ? 'Use the full meeting history above to inform your analysis — the summary, conversion score, and risks should reflect the entire deal trajectory, not just today\'s notes.' : ''}

Return this exact JSON structure:
{
  "summary": "2-3 sentence deal summary",
  "conversionScore": 65,
  "conversionInsights": ["Why score is X", "Key risk or opportunity", "Recommended next action"],
  "risks": ["Deal risk or warning signal observed in the notes"],
  "todos": [{"text": "action item"}],
  "obsoleteTodoIds": ["existing-todo-id-if-now-irrelevant"],
  "productGaps": [{"title": "gap title", "description": "what customer needs that product lacks", "priority": "high"}]
}

conversionScore: 0-100. priority: critical | high | medium | low

IMPORTANT — todos rules:
- Only add NEW action items not already covered by existing open items.
- Do not duplicate: if an existing item says "Send proposal" and the notes mention sending a proposal, do NOT add it again.
- obsoleteTodoIds: list IDs of existing open items that are now clearly done, superseded, or irrelevant based on the new notes. Return [] if none.

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
    // Strip markdown fences and any leading/trailing text before the JSON object
    function stripToJson(raw: string): string {
      const fenceStripped = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
      // If there's text before the opening brace, trim it
      const braceIdx = fenceStripped.indexOf('{')
      return braceIdx > 0 ? fenceStripped.slice(braceIdx) : fenceStripped
    }
    let parsed: any = {}
    let parseOk = false
    try {
      const raw = (msg.content[0] as any).text.trim()
      parsed = JSON.parse(stripToJson(raw))
      parseOk = true
    } catch {
      // JSON parsing failed — don't corrupt existing fields with raw text
      parsed = { summary: null, conversionScore: null, conversionInsights: null, risks: [], todos: [], productGaps: [] }
    }
    const newTodos = (parsed.todos ?? []).map((t: any) => ({ id: crypto.randomUUID(), text: t.text, done: false, createdAt: new Date().toISOString() }))
    const obsoleteIds = new Set<string>(parsed.obsoleteTodoIds ?? [])
    const dateStamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    // Store compact takeaways (not raw notes) to keep history token-efficient across many meetings
    const risksLine = (parsed.risks ?? []).length > 0 ? ` Risks: ${(parsed.risks as string[]).join('; ')}.` : ''
    const actionLine = newTodos.length > 0 ? ` Actions: ${newTodos.map((t: any) => t.text).join('; ')}.` : ''
    const compactEntry = parsed.summary
      ? `[${dateStamp}] ${parsed.summary}${risksLine}${actionLine}`
      : `[${dateStamp}] Meeting notes processed (analysis unavailable)${actionLine}`
    const appendedNotes = deal.meetingNotes
      ? `${deal.meetingNotes}\n${compactEntry}`
      : compactEntry
    // Remove obsolete todos entirely; deduplicate by normalising text; append new non-duplicate todos
    const existingKept = ((deal.todos as any[]) ?? []).filter((t: any) => !obsoleteIds.has(t.id))
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
    const existingKeys = new Set(existingKept.map((t: any) => normalize(t.text)))
    const dedupedNew = newTodos.filter((t: any) => !existingKeys.has(normalize(t.text)))
    const mergedTodos = [...existingKept, ...dedupedNew]
    // Only overwrite aiSummary/conversionScore/insights if parse succeeded — never corrupt with raw text or nulls
    const updateFields: Record<string, unknown> = {
      meetingNotes: appendedNotes,
      dealRisks: parsed.risks ?? [],
      todos: mergedTodos,
      updatedAt: new Date(),
    }
    if (parseOk && parsed.summary) updateFields.aiSummary = parsed.summary
    if (parseOk && parsed.conversionScore != null) updateFields.conversionScore = parsed.conversionScore
    if (parseOk && parsed.conversionInsights != null) updateFields.conversionInsights = parsed.conversionInsights

    const [updatedDeal] = await db.update(dealLogs).set(updateFields).where(eq(dealLogs.id, id)).returning()
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
    // Rebuild workspace brain in background so chat/overview always have fresh context
    after(async () => {
      try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ }
    })

    return NextResponse.json({ data: { deal: updatedDeal, productGaps: createdGaps, parsed } })
  } catch (e: any) {
    console.error('[analyze-notes] 500:', e?.message, e?.stack?.split('\n')[1])
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}
