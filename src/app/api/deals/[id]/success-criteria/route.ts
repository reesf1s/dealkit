export const dynamic = 'force-dynamic'
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { dealLogs, companyProfiles } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getWorkspaceBrain, formatBrainContext, rebuildWorkspaceBrain } from '@/lib/workspace-brain'
import { ensureLinksColumn } from '@/lib/api-helpers'

const anthropic = new Anthropic()

// POST — parse raw success criteria text into structured items
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rl = await checkRateLimit(userId, 'success-criteria', 10)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const { text } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

    await ensureLinksColumn()
    const [[deal], [profile], brain] = await Promise.all([
      db.select().from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1),
      db.select({ companyName: companyProfiles.companyName, knownCapabilities: companyProfiles.knownCapabilities })
        .from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1),
      getWorkspaceBrain(workspaceId),
    ])
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let brainContext = ''
    if (brain) {
      try { brainContext = `\n\nPIPELINE INTELLIGENCE:\n${formatBrainContext(brain)}` }
      catch { /* non-fatal */ }
    }

    const dealContext = [
      `Deal: ${deal.dealName} with ${deal.prospectCompany}`,
      deal.stage ? `Stage: ${deal.stage}` : '',
      profile?.companyName ? `Our company: ${profile.companyName}` : '',
      (profile?.knownCapabilities as string[])?.length
        ? `Confirmed capabilities (already supported — do NOT flag as missing): ${(profile.knownCapabilities as string[]).join(', ')}`
        : '',
      deal.aiSummary ? `Deal summary: ${deal.aiSummary}` : '',
      brainContext,
    ].filter(Boolean).join('\n')

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 900,
      system: 'You are a JSON-only API. You never use markdown fences, prose, or explanation. Every response is a raw JSON array starting with [ and ending with ].',
      messages: [{ role: 'user', content: `Extract success criteria from this proposal text for the following deal.

DEAL CONTEXT:
${dealContext}

PROPOSAL TEXT:
${text.trim()}

Return a JSON array of criteria objects. Each object: {"text": "the specific requirement — preserve the original wording as closely as possible", "category": "theme label"}
- 3–15 items depending on complexity
- category examples: Security, Integration, Reporting, Performance, Compliance, Onboarding, Demo
- Each criterion must preserve the SPECIFIC language used in the proposal. Do NOT over-summarize or abstract away detail.
- If the original text contains specific questions or demo requests, keep the full question as the criterion text` }],
    })

    let items: any[] = []
    try {
      const raw = (msg.content[0] as any).text.trim()
      // Strip any markdown fences or leading/trailing text
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error(`No JSON array found in: ${raw.slice(0, 200)}`)
      const parsed = JSON.parse(jsonMatch[0])
      items = parsed.map((item: any) => ({
        id: crypto.randomUUID(),
        text: item.text ?? '',
        category: item.category ?? 'General',
        achieved: false,
        note: '',
        createdAt: new Date().toISOString(),
      }))
    } catch (parseErr: any) {
      console.error('[success-criteria] parse error:', parseErr.message)
      return NextResponse.json({ error: `Failed to parse AI response: ${parseErr.message}` }, { status: 500 })
    }

    // Merge with any existing criteria (append new, keep achieved ones)
    const existing = (deal.successCriteriaTodos as any[]) ?? []
    const merged = [...existing, ...items]

    const [updated] = await db.update(dealLogs)
      .set({ successCriteria: text.trim(), successCriteriaTodos: merged, updatedAt: new Date() })
      .where(eq(dealLogs.id, id)).returning()

    after(async () => {
      console.log(`[brain] Rebuild triggered by: success_criteria at ${new Date().toISOString()}`)
      try { await rebuildWorkspaceBrain(workspaceId, 'success_criteria') } catch { /* non-fatal */ }
    })
    return NextResponse.json({ data: { successCriteriaTodos: updated.successCriteriaTodos } })
  } catch (e: unknown) { console.error('[success-criteria] failed:', e instanceof Error ? e.message : e); return NextResponse.json({ error: 'Operation failed' }, { status: 500 }) }
}

// PATCH — update a single criterion (achieved toggle + note)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const { criterionId, achieved, note, assignee } = await req.json()

    const [deal] = await db.select({ successCriteriaTodos: dealLogs.successCriteriaTodos })
      .from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1)
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = ((deal.successCriteriaTodos as any[]) ?? []).map((c: any) =>
      c.id === criterionId
        ? { ...c, ...(achieved !== undefined ? { achieved } : {}), ...(note !== undefined ? { note } : {}), ...(assignee !== undefined ? { assignee } : {}) }
        : c
    )

    await db.update(dealLogs).set({ successCriteriaTodos: updated, updatedAt: new Date() }).where(eq(dealLogs.id, id))
    return NextResponse.json({ data: { successCriteriaTodos: updated } })
  } catch (e: unknown) { console.error('[success-criteria] failed:', e instanceof Error ? e.message : e); return NextResponse.json({ error: 'Operation failed' }, { status: 500 }) }
}

// DELETE — remove a single criterion by ID
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const { criterionId } = await req.json()

    const [deal] = await db.select({ successCriteriaTodos: dealLogs.successCriteriaTodos })
      .from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1)
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = ((deal.successCriteriaTodos as any[]) ?? []).filter((c: any) => c.id !== criterionId)
    await db.update(dealLogs).set({ successCriteriaTodos: updated, updatedAt: new Date() }).where(eq(dealLogs.id, id))
    return NextResponse.json({ data: { successCriteriaTodos: updated } })
  } catch (e: unknown) { console.error('[success-criteria] failed:', e instanceof Error ? e.message : e); return NextResponse.json({ error: 'Operation failed' }, { status: 500 }) }
}
