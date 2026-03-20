export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces, dealLogs } from '@/lib/db/schema'

const VALID_STAGES = [
  'prospecting', 'qualification', 'discovery', 'proposal',
  'negotiation', 'closed_won', 'closed_lost',
] as const
type DealStage = typeof VALID_STAGES[number]

function isValidStage(s: string): s is DealStage {
  return VALID_STAGES.includes(s as DealStage)
}

export async function POST(req: NextRequest) {
  try {

    // ── Auth: check x-api-key header against ZAPIER_WEBHOOK_SECRET env var ──
    const headerApiKey = req.headers.get('x-api-key')
    const envSecret = process.env.ZAPIER_WEBHOOK_SECRET

    let body: {
      action: 'create_deal' | 'update_deal' | 'log_note'
      apiKey: string
      deal?: {
        name?: string
        company?: string
        value?: number
        stage?: string
        contactEmail?: string
        description?: string
      }
      dealId?: string
      note?: string
    }

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { action, apiKey } = body

    if (!apiKey) {
      return NextResponse.json({ error: 'apiKey is required in the request body' }, { status: 400 })
    }

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    // Validate the header key if env var is set
    if (envSecret && headerApiKey !== envSecret) {
      return NextResponse.json({ error: 'Invalid x-api-key header' }, { status: 401 })
    }

    // Look up workspace by zapier_api_key field
    const [workspace] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(sql`${workspaces}.zapier_api_key = ${apiKey}`)
      .limit(1)

    if (!workspace) {
      return NextResponse.json({ error: 'Invalid apiKey — no matching workspace found' }, { status: 401 })
    }

    const workspaceId = workspace.id

    // ── Action: create_deal ────────────────────────────────────────────────────
    if (action === 'create_deal') {
      const deal = body.deal
      if (!deal?.name || !deal?.company) {
        return NextResponse.json({ error: 'deal.name and deal.company are required for create_deal' }, { status: 400 })
      }

      const stage: DealStage = deal.stage && isValidStage(deal.stage)
        ? deal.stage as DealStage
        : 'prospecting'

      const now = new Date()
      const [created] = await db.insert(dealLogs).values({
        workspaceId,
        userId: null,
        dealName: deal.name,
        prospectCompany: deal.company,
        dealValue: deal.value ?? null,
        stage,
        description: deal.description ?? null,
        prospectName: null,
        contacts: deal.contactEmail
          ? [{ name: deal.company, email: deal.contactEmail }]
          : [],
        createdAt: now,
        updatedAt: now,
      }).returning({ id: dealLogs.id })

      return NextResponse.json({ success: true, dealId: created.id })
    }

    // ── Action: update_deal ────────────────────────────────────────────────────
    if (action === 'update_deal') {
      const { dealId, deal } = body
      if (!dealId) {
        return NextResponse.json({ error: 'dealId is required for update_deal' }, { status: 400 })
      }

      // Verify deal belongs to this workspace
      const [existing] = await db
        .select({ id: dealLogs.id })
        .from(dealLogs)
        .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
        .limit(1)

      if (!existing) {
        return NextResponse.json({ error: 'Deal not found or does not belong to this workspace' }, { status: 404 })
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() }
      if (deal?.name) updates.dealName = deal.name
      if (deal?.company) updates.prospectCompany = deal.company
      if (deal?.value !== undefined) updates.dealValue = deal.value
      if (deal?.stage && isValidStage(deal.stage)) updates.stage = deal.stage
      if (deal?.description !== undefined) updates.description = deal.description

      await db
        .update(dealLogs)
        .set(updates)
        .where(eq(dealLogs.id, dealId))

      return NextResponse.json({ success: true })
    }

    // ── Action: log_note ───────────────────────────────────────────────────────
    if (action === 'log_note') {
      const { dealId, note } = body
      if (!dealId) {
        return NextResponse.json({ error: 'dealId is required for log_note' }, { status: 400 })
      }
      if (!note) {
        return NextResponse.json({ error: 'note is required for log_note' }, { status: 400 })
      }

      const [existing] = await db
        .select({ id: dealLogs.id, meetingNotes: dealLogs.meetingNotes })
        .from(dealLogs)
        .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
        .limit(1)

      if (!existing) {
        return NextResponse.json({ error: 'Deal not found or does not belong to this workspace' }, { status: 404 })
      }

      const delimiter = '\n---\n'
      const updatedNotes = existing.meetingNotes
        ? `${existing.meetingNotes}${delimiter}${note}`
        : note

      await db
        .update(dealLogs)
        .set({ meetingNotes: updatedNotes, updatedAt: new Date() })
        .where(eq(dealLogs.id, dealId))

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[zapier-webhook] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
