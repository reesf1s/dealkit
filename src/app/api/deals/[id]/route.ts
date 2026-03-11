import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, events } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'

async function logEvent(userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ userId, type, metadata, createdAt: new Date() })
}

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/deals/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const [deal] = await db
      .select()
      .from(dealLogs)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.userId, userId)))
      .limit(1)

    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ data: deal })
  } catch (err) {
    return dbErrResponse(err)
  }
}

// DELETE /api/deals/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const [existing] = await db
      .select({ id: dealLogs.id, dealName: dealLogs.dealName })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.userId, userId)))
      .limit(1)

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db
      .delete(dealLogs)
      .where(and(eq(dealLogs.id, id), eq(dealLogs.userId, userId)))

    await logEvent(userId, 'deal_log.updated', {
      dealLogId: id,
      dealName: existing.dealName,
      action: 'deleted',
    })

    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    return dbErrResponse(err)
  }
}
