export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, ilike } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral, competitors, events } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { generateCollateral } from '@/lib/ai/generate'
import type { CollateralType } from '@/types'

async function logEvent(workspaceId: string, userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ workspaceId, userId, type, metadata, createdAt: new Date() })
}

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const [item] = await db.select().from(collateral).where(and(eq(collateral.id, id), eq(collateral.workspaceId, workspaceId))).limit(1)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: item })
  } catch (err) {
    return dbErrResponse(err)
  }
}

// PATCH /api/collateral/:id — regenerate this collateral in-place (bypasses plan limit since updating existing)
export async function PATCH(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params

    const [item] = await db
      .select()
      .from(collateral)
      .where(and(eq(collateral.id, id), eq(collateral.workspaceId, workspaceId)))
      .limit(1)

    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Mark as generating immediately so the UI starts polling
    await db.update(collateral).set({ status: 'generating', updatedAt: new Date() }).where(eq(collateral.id, id))

    const collateralType = item.type as CollateralType
    let competitorId = item.sourceCompetitorId ?? undefined
    const caseStudyId = item.sourceCaseStudyId ?? undefined

    // For AI-generated battlecards, sourceCompetitorId may be null.
    // Try to resolve the competitor by name extracted from the title ("Battlecard: vs {Name}").
    if (collateralType === 'battlecard' && !competitorId) {
      const titleMatch = item.title?.match(/^Battlecard:\s*vs\s+(.+)$/i)
      if (titleMatch) {
        const competitorName = titleMatch[1].trim()
        // Strip any "(now X)" or "(formerly X)" suffix — competitor may have been renamed in the title
        const baseName = competitorName.replace(/\s*\(.*?\)\s*$/, '').trim()

        // 1. Try exact match first
        const [exact] = await db
          .select({ id: competitors.id })
          .from(competitors)
          .where(and(eq(competitors.workspaceId, workspaceId), ilike(competitors.name, competitorName)))
          .limit(1)

        if (exact) {
          competitorId = exact.id
        } else {
          // 2. Fall back: partial match on base name (handles renames like "Dojo AI (now OfficeSpace)")
          const [partial] = await db
            .select({ id: competitors.id })
            .from(competitors)
            .where(and(eq(competitors.workspaceId, workspaceId), ilike(competitors.name, `%${baseName}%`)))
            .limit(1)
          if (partial) competitorId = partial.id
        }
      }
    }

    // Run synchronously within maxDuration=60 — eliminates after() uncertainty
    try {
      const result = await generateCollateral({ workspaceId, type: collateralType, competitorId, caseStudyId })
      const generatedAt = new Date()
      await db
        .update(collateral)
        .set({ title: result.title, status: 'ready', content: result.content, rawResponse: result.rawResponse, generatedAt, updatedAt: generatedAt })
        .where(eq(collateral.id, id))
      await logEvent(workspaceId, userId, 'collateral.generated', { collateralId: id, collateralType, title: result.title, regenerated: true })
      return NextResponse.json({ data: { id, status: 'ready', title: result.title } })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[collateral/regenerate] AI generation failed:', errMsg)
      await db.update(collateral)
        .set({ status: 'stale', rawResponse: { error: errMsg }, updatedAt: new Date() })
        .where(eq(collateral.id, id))
      return NextResponse.json({ error: `Generation failed: ${errMsg}`, code: 'GENERATION_FAILED' }, { status: 500 })
    }
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const [existing] = await db.select({ id: collateral.id, type: collateral.type, title: collateral.title }).from(collateral).where(and(eq(collateral.id, id), eq(collateral.workspaceId, workspaceId))).limit(1)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await db.delete(collateral).where(and(eq(collateral.id, id), eq(collateral.workspaceId, workspaceId)))
    await logEvent(workspaceId, userId, 'collateral.archived', { collateralId: id, collateralType: existing.type, title: existing.title })
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    return dbErrResponse(err)
  }
}
