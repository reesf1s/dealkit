import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { events, dealLogs } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
    const type = searchParams.get('type') // filter by event type

    const conditions = [eq(events.workspaceId, workspaceId)]
    if (type && type !== 'all') conditions.push(eq(events.type, type))

    const rows = await db
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(desc(events.createdAt))
      .limit(limit)

    // Enrich with deal names where metadata.dealId is present
    const dealIds = [...new Set(
      rows
        .map(r => (r.metadata as Record<string, unknown>)?.dealId as string | undefined)
        .filter(Boolean)
    )] as string[]

    let dealMap: Record<string, { dealName: string; prospectCompany: string }> = {}
    if (dealIds.length > 0) {
      const deals = await db
        .select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany })
        .from(dealLogs)
        .where(and(eq(dealLogs.workspaceId, workspaceId)))
      dealMap = Object.fromEntries(
        deals
          .filter(d => dealIds.includes(d.id))
          .map(d => [d.id, { dealName: d.dealName, prospectCompany: d.prospectCompany }])
      )
    }

    const enriched = rows.map(r => {
      const meta = r.metadata as Record<string, unknown>
      const dealId = meta?.dealId as string | undefined
      return {
        ...r,
        dealName: dealId ? dealMap[dealId]?.dealName : undefined,
        prospectCompany: dealId ? dealMap[dealId]?.prospectCompany : undefined,
      }
    })

    return NextResponse.json({ data: enriched })
  } catch (err) { return dbErrResponse(err) }
}
