/**
 * GET /api/mcp/resources/features-requested
 *
 * MCP resource: feature gaps requested by deals (especially lost deals).
 * Auth: Authorization: Bearer <mcp_api_key>
 */

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces, productGaps, dealLogs } from '@/lib/db/schema'
import { ensureIndexes } from '@/lib/api-helpers'

export const maxDuration = 60

async function resolveWorkspace(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return null

  const [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.mcpApiKey, token))
    .limit(1)

  return ws?.id ?? null
}

export async function GET(req: NextRequest) {
  await ensureIndexes()

  const workspaceId = await resolveWorkspace(req)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  // Get open/in-review product gaps for this workspace
  const gaps = await db
    .select({
      id: productGaps.id,
      title: productGaps.title,
      description: productGaps.description,
      priority: productGaps.priority,
      frequency: productGaps.frequency,
      status: productGaps.status,
      sourceDeals: productGaps.sourceDeals,
      affectedRevenue: productGaps.affectedRevenue,
      suggestedFix: productGaps.suggestedFix,
      createdAt: productGaps.createdAt,
    })
    .from(productGaps)
    .where(
      and(
        eq(productGaps.workspaceId, workspaceId),
        inArray(productGaps.status, ['open', 'in_review']),
      )
    )
    .orderBy(sql`${productGaps.frequency} DESC, ${productGaps.affectedRevenue} DESC NULLS LAST`)
    .limit(50)

  // Enrich with deal names for source deals that are closed_lost
  const allDealIds = gaps.flatMap(g => {
    const src = g.sourceDeals as string[] | null
    return src ?? []
  })

  const uniqueDealIds = [...new Set(allDealIds)]
  let dealNameMap = new Map<string, { name: string; stage: string }>()

  if (uniqueDealIds.length > 0) {
    const deals = await db
      .select({ id: dealLogs.id, dealName: dealLogs.dealName, stage: dealLogs.stage })
      .from(dealLogs)
      .where(and(
        eq(dealLogs.workspaceId, workspaceId),
        inArray(dealLogs.id, uniqueDealIds),
      ))
    dealNameMap = new Map(deals.map(d => [d.id, { name: d.dealName, stage: d.stage }]))
  }

  const enriched = gaps.map(g => {
    const srcIds = (g.sourceDeals as string[]) ?? []
    const sourceDealInfo = srcIds.map(id => {
      const d = dealNameMap.get(id)
      return d ? { id, name: d.name, stage: d.stage } : { id, name: null, stage: null }
    })
    const lostDeals = sourceDealInfo.filter(d => d.stage === 'closed_lost')
    return {
      ...g,
      sourceDealInfo,
      lostDealCount: lostDeals.length,
    }
  })

  return NextResponse.json({
    uri: '/api/mcp/resources/features-requested',
    mimeType: 'application/json',
    data: enriched,
    count: enriched.length,
  })
}
