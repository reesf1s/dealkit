export const dynamic = 'force-dynamic'
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { rebuildWorkspaceBrain } from '@/lib/workspace-brain'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const body = await req.json()
    const { stage, kanbanOrder } = body
    const validStages = ['prospecting','qualification','discovery','proposal','negotiation','closed_won','closed_lost']
    // Also accept custom stage IDs (format: custom_slug_timestamp)
    if (!validStages.includes(stage) && !stage?.startsWith('custom_')) return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    const update: Record<string, unknown> = { stage, updatedAt: new Date() }
    if (kanbanOrder !== undefined) update.kanbanOrder = kanbanOrder
    if (stage === 'closed_won') update.wonDate = new Date()
    if (stage === 'closed_lost') update.lostDate = new Date()
    const [deal] = await db.update(dealLogs).set(update).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).returning()
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ } })
    return NextResponse.json({ data: deal })
  } catch (e: unknown) {
    console.error('[deals/stage] failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Stage update failed' }, { status: 500 })
  }
}
