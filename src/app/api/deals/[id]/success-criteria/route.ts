export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { dealLogs, companyProfiles } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

const anthropic = new Anthropic()

// POST — parse raw success criteria text into structured items
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const { text } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

    const [[deal], [profile]] = await Promise.all([
      db.select().from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1),
      db.select({ companyName: companyProfiles.companyName, knownCapabilities: companyProfiles.knownCapabilities })
        .from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1),
    ])
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const dealContext = [
      `Deal: ${deal.dealName} with ${deal.prospectCompany}`,
      deal.stage ? `Stage: ${deal.stage}` : '',
      profile?.companyName ? `Our company: ${profile.companyName}` : '',
      (profile?.knownCapabilities as string[])?.length
        ? `Confirmed capabilities (already supported — do NOT flag as missing): ${(profile.knownCapabilities as string[]).join(', ')}`
        : '',
      deal.aiSummary ? `Deal summary: ${deal.aiSummary}` : '',
    ].filter(Boolean).join('\n')

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 900,
      system: 'You are a JSON-only API. You never use markdown fences, prose, or explanation. Every response is a raw JSON array starting with [ and ending with ].',
      messages: [{ role: 'user', content: `Extract success criteria from this proposal text for the following deal.

DEAL CONTEXT:
${dealContext}

PROPOSAL TEXT:
${text.trim()}

Return a JSON array of criteria objects. Each object: {"text": "concise requirement (max 15 words)", "category": "theme label"}
- 3–15 items depending on complexity
- category examples: Security, Integration, Reporting, Performance, Compliance, Onboarding
- Each criterion must be a single, specific, measurable requirement` }],
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

    return NextResponse.json({ data: { successCriteriaTodos: updated.successCriteriaTodos } })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

// PATCH — update a single criterion (achieved toggle + note)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const { criterionId, achieved, note } = await req.json()

    const [deal] = await db.select({ successCriteriaTodos: dealLogs.successCriteriaTodos })
      .from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1)
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = ((deal.successCriteriaTodos as any[]) ?? []).map((c: any) =>
      c.id === criterionId
        ? { ...c, ...(achieved !== undefined ? { achieved } : {}), ...(note !== undefined ? { note } : {}) }
        : c
    )

    await db.update(dealLogs).set({ successCriteriaTodos: updated, updatedAt: new Date() }).where(eq(dealLogs.id, id))
    return NextResponse.json({ data: { successCriteriaTodos: updated } })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
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
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
