import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral, users, events } from '@/lib/db/schema'
import { generateCollateral } from '@/lib/ai/generate'
import type { CollateralType } from '@/types'

async function logEvent(userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ userId, type, metadata, createdAt: new Date() })
}

// POST /api/collateral/regenerate-stale — pro-only batch regeneration
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [user] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (user.plan !== 'pro') {
    return NextResponse.json(
      {
        error: 'Batch regeneration of stale collateral is only available on the Pro plan.',
        code: 'PLAN_UPGRADE_REQUIRED',
      },
      { status: 403 },
    )
  }

  // Fetch all stale collateral for this user
  const staleItems = await db
    .select()
    .from(collateral)
    .where(and(eq(collateral.userId, userId), eq(collateral.status, 'stale')))

  if (staleItems.length === 0) {
    return NextResponse.json({ data: { regenerated: 0, items: [] } })
  }

  const results: Array<{ id: string; title: string; success: boolean; error?: string }> = []

  for (const item of staleItems) {
    const now = new Date()

    // Mark as generating
    await db
      .update(collateral)
      .set({ status: 'generating', updatedAt: now })
      .where(eq(collateral.id, item.id))

    try {
      const result = await generateCollateral({
        type: item.type as CollateralType,
        competitorId: item.sourceCompetitorId ?? undefined,
        caseStudyId: item.sourceCaseStudyId ?? undefined,
      })

      const generatedAt = new Date()

      await db
        .update(collateral)
        .set({
          title: result.title,
          status: 'ready',
          content: result.content,
          rawResponse: result.rawResponse,
          generatedAt,
          updatedAt: generatedAt,
        })
        .where(eq(collateral.id, item.id))

      await logEvent(userId, 'collateral.generated', {
        collateralId: item.id,
        collateralType: item.type,
        title: result.title,
      })

      results.push({ id: item.id, title: result.title, success: true })
    } catch (err) {
      // Revert back to stale on failure
      await db
        .update(collateral)
        .set({ status: 'stale', updatedAt: new Date() })
        .where(eq(collateral.id, item.id))

      const message = err instanceof Error ? err.message : 'Unknown error'
      results.push({ id: item.id, title: item.title, success: false, error: message })
      console.error(`[regenerate-stale] Failed to regenerate collateral ${item.id}:`, err)
    }
  }

  const successCount = results.filter((r) => r.success).length

  return NextResponse.json({
    data: {
      regenerated: successCount,
      total: staleItems.length,
      items: results,
    },
  })
}
