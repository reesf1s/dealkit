import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { dbErrResponse, ensureLinksColumn } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id: dealId } = await params

    // Dynamic import — semantic search may not be available if pgvector isn't installed
    let similar: { entityId: string; similarity: number }[]
    try {
      const { findSimilarDeals } = await import('@/lib/semantic-search')
      similar = await findSimilarDeals(workspaceId, dealId, 5)
    } catch {
      return NextResponse.json({ data: [], message: 'Semantic search not available' })
    }

    if (similar.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Fetch deal details for similar deals
    const ids = similar.map(s => s.entityId)
    await ensureLinksColumn()
    const deals = await db
      .select({
        id: dealLogs.id,
        dealName: dealLogs.dealName,
        prospectCompany: dealLogs.prospectCompany,
        stage: dealLogs.stage,
        dealValue: dealLogs.dealValue,
        conversionScore: dealLogs.conversionScore,
      })
      .from(dealLogs)
      .where(and(eq(dealLogs.workspaceId, workspaceId), inArray(dealLogs.id, ids)))

    const dealMap = new Map(deals.map(d => [d.id, d]))
    const data = similar
      .map(s => {
        const d = dealMap.get(s.entityId)
        if (!d) return null
        return {
          id: d.id,
          dealName: d.dealName,
          prospectCompany: d.prospectCompany,
          stage: d.stage,
          dealValue: d.dealValue,
          conversionScore: d.conversionScore,
          similarity: Math.round(s.similarity * 100),
        }
      })
      .filter(Boolean)

    return NextResponse.json({ data })
  } catch (err) {
    return dbErrResponse(err)
  }
}
