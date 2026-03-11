import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral, events } from '@/lib/db/schema'
import { generateCollateral } from '@/lib/ai/generate'
import type { CollateralType } from '@/types'
import { getWorkspaceContext } from '@/lib/workspace'

async function logEvent(workspaceId: string, userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ workspaceId, userId, type, metadata, createdAt: new Date() })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspaceId, plan } = await getWorkspaceContext(userId)
  if (plan !== 'pro') return NextResponse.json({ error: 'Batch regeneration is only available on the Pro plan.', code: 'PLAN_UPGRADE_REQUIRED' }, { status: 403 })
  const staleItems = await db.select().from(collateral).where(and(eq(collateral.workspaceId, workspaceId), eq(collateral.status, 'stale')))
  if (staleItems.length === 0) return NextResponse.json({ data: { regenerated: 0, items: [] } })
  const results: Array<{ id: string; title: string; success: boolean; error?: string }> = []
  for (const item of staleItems) {
    await db.update(collateral).set({ status: 'generating', updatedAt: new Date() }).where(eq(collateral.id, item.id))
    try {
      const result = await generateCollateral({ workspaceId, type: item.type as CollateralType, competitorId: item.sourceCompetitorId ?? undefined, caseStudyId: item.sourceCaseStudyId ?? undefined })
      const generatedAt = new Date()
      await db.update(collateral).set({ title: result.title, status: 'ready', content: result.content, rawResponse: result.rawResponse, generatedAt, updatedAt: generatedAt }).where(eq(collateral.id, item.id))
      await logEvent(workspaceId, userId, 'collateral.generated', { collateralId: item.id, collateralType: item.type, title: result.title })
      results.push({ id: item.id, title: result.title, success: true })
    } catch (err) {
      await db.update(collateral).set({ status: 'stale', updatedAt: new Date() }).where(eq(collateral.id, item.id))
      results.push({ id: item.id, title: item.title, success: false, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }
  return NextResponse.json({ data: { regenerated: results.filter(r => r.success).length, total: staleItems.length, items: results } })
}
