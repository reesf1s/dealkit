export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productGaps, dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { ensureLinksColumn } from '@/lib/api-helpers'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const gaps = await db.select().from(productGaps).where(eq(productGaps.workspaceId, workspaceId)).orderBy(desc(productGaps.frequency), desc(productGaps.createdAt))

    // Compute real-time blocked revenue from active source deals
    const allDealIds = [...new Set(gaps.flatMap(g => (g.sourceDeals as string[]) ?? []))]
    const dealValueMap = new Map<string, number>()
    if (allDealIds.length > 0) {
      await ensureLinksColumn()
      const dealRows = await db.select({ id: dealLogs.id, dealValue: dealLogs.dealValue, stage: dealLogs.stage })
        .from(dealLogs).where(inArray(dealLogs.id, allDealIds))
      for (const d of dealRows) {
        if (d.stage !== 'closed_won' && d.stage !== 'closed_lost' && d.dealValue) {
          dealValueMap.set(d.id, d.dealValue)
        }
      }
    }

    const gapsWithRevenue = gaps.map(g => ({
      ...g,
      blockedRevenue: ((g.sourceDeals as string[]) ?? []).reduce((sum, id) => sum + (dealValueMap.get(id) ?? 0), 0),
    }))

    return NextResponse.json({ data: gapsWithRevenue })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const body = await req.json()
    const { userId: _uid, workspaceId: _wid, ...rest } = body
    const [gap] = await db.insert(productGaps).values({ ...rest, workspaceId, userId, createdAt: new Date(), updatedAt: new Date() }).returning()
    return NextResponse.json({ data: gap })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
