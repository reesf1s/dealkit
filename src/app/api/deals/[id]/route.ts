import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, events } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

async function logEvent(workspaceId: string, userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ workspaceId, userId, type, metadata, createdAt: new Date() })
}

let dealColsMigrated = false
async function ensureDealColumns() {
  if (dealColsMigrated) return
  try {
    await db.execute(sql`
      ALTER TABLE deal_logs
      ADD COLUMN IF NOT EXISTS contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS description text
    `)
  } catch { /* columns may already exist */ }
  dealColsMigrated = true
}
interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const [deal] = await db.select().from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1)
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: deal })
  } catch (err) { return dbErrResponse(err) }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const [existing] = await db.select({ id: dealLogs.id }).from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await ensureDealColumns()
    const body = await req.json()
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    const fields = ['dealName','prospectCompany','prospectName','prospectTitle','contacts','description','dealValue','stage','competitors','notes','meetingNotes','aiSummary','conversionScore','conversionInsights','todos','nextSteps','closeDate','wonDate','lostDate','lostReason','dealType','recurringInterval','kanbanOrder']
    for (const f of fields) if (body[f] !== undefined) updateData[f] = body[f]
    const [updated] = await db.update(dealLogs).set(updateData).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).returning()
    await logEvent(workspaceId, userId, 'deal_log.updated', { dealLogId: id, dealName: updated.dealName })
    return NextResponse.json({ data: updated })
  } catch (err) { return dbErrResponse(err) }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const [existing] = await db.select({ id: dealLogs.id, dealName: dealLogs.dealName }).from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await db.delete(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId)))
    await logEvent(workspaceId, userId, 'deal_log.updated', { dealLogId: id, dealName: existing.dealName, action: 'deleted' })
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) { return dbErrResponse(err) }
}
