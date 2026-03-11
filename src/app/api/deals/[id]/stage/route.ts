export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const { stage, kanbanOrder } = body
    const validStages = ['prospecting','qualification','discovery','proposal','negotiation','closed_won','closed_lost']
    if (!validStages.includes(stage)) return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    const update: Record<string, unknown> = { stage, updatedAt: new Date() }
    if (kanbanOrder !== undefined) update.kanbanOrder = kanbanOrder
    if (stage === 'closed_won') update.wonDate = new Date()
    if (stage === 'closed_lost') update.lostDate = new Date()
    const [deal] = await db.update(dealLogs).set(update).where(and(eq(dealLogs.id, id), eq(dealLogs.userId, userId))).returning()
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: deal })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
