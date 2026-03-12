export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral, competitors, events } from '@/lib/db/schema'
import { generateCollateral } from '@/lib/ai/generate'
import type { CollateralType } from '@/types'
import { getWorkspaceContext } from '@/lib/workspace'
import { ilike } from 'drizzle-orm'

async function logEvent(workspaceId: string, userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ workspaceId, userId, type, metadata, createdAt: new Date() })
}

async function resolveCompetitorId(workspaceId: string, item: typeof collateral.$inferSelect): Promise<string | undefined> {
  if (item.sourceCompetitorId) return item.sourceCompetitorId

  // Fallback: resolve from title "Battlecard: vs {Name}"
  const titleMatch = item.title?.match(/^Battlecard:\s*vs\s+(.+)$/i)
  if (!titleMatch) return undefined

  const competitorName = titleMatch[1].trim()
  const baseName = competitorName.replace(/\s*\(.*?\)\s*$/, '').trim()

  const [exact] = await db
    .select({ id: competitors.id })
    .from(competitors)
    .where(and(eq(competitors.workspaceId, workspaceId), ilike(competitors.name, competitorName)))
    .limit(1)
  if (exact) return exact.id

  const [partial] = await db
    .select({ id: competitors.id })
    .from(competitors)
    .where(and(eq(competitors.workspaceId, workspaceId), ilike(competitors.name, `%${baseName}%`)))
    .limit(1)
  return partial?.id
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspaceId } = await getWorkspaceContext(userId)

  const staleItems = await db
    .select()
    .from(collateral)
    .where(and(eq(collateral.workspaceId, workspaceId), eq(collateral.status, 'stale')))

  if (staleItems.length === 0) return NextResponse.json({ data: { queued: 0 } })

  // Mark all as generating immediately
  await Promise.all(
    staleItems.map(item =>
      db.update(collateral).set({ status: 'generating', updatedAt: new Date() }).where(eq(collateral.id, item.id))
    )
  )

  // Run sequentially with a gap to avoid rate limits
  after(async () => {
    for (const item of staleItems) {
      const competitorId = await resolveCompetitorId(workspaceId, item)
      const caseStudyId = item.sourceCaseStudyId ?? undefined
      try {
        const result = await generateCollateral({
          workspaceId,
          type: item.type as CollateralType,
          competitorId,
          caseStudyId,
        })
        const generatedAt = new Date()
        await db.update(collateral)
          .set({ title: result.title, status: 'ready', content: result.content, rawResponse: result.rawResponse, generatedAt, updatedAt: generatedAt })
          .where(eq(collateral.id, item.id))
        await logEvent(workspaceId, userId, 'collateral.generated', { collateralId: item.id, collateralType: item.type, title: result.title, bulkRegen: true })
      } catch (err) {
        console.error(`[regenerate-stale] Failed for ${item.id}:`, err)
        await db.update(collateral).set({ status: 'stale', updatedAt: new Date() }).where(eq(collateral.id, item.id))
      }
      // Small gap between requests to avoid rate limits
      await new Promise(r => setTimeout(r, 1500))
    }
  })

  return NextResponse.json({ data: { queued: staleItems.length } })
}
