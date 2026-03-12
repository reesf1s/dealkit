export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { and, count, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral, events } from '@/lib/db/schema'
import { PLAN_LIMITS, isWithinLimit } from '@/lib/stripe/plans'
import { generateCollateral } from '@/lib/ai/generate'
import type { CollateralType } from '@/types'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

async function logEvent(workspaceId: string, userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ workspaceId, userId, type, metadata, createdAt: new Date() })
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId, plan } = await getWorkspaceContext(userId)
    const limits = PLAN_LIMITS[plan]
    if (limits.collateral !== null) {
      const [{ value: currentCount }] = await db.select({ value: count() }).from(collateral).where(eq(collateral.workspaceId, workspaceId))
      if (!isWithinLimit(Number(currentCount), limits.collateral))
        return NextResponse.json({ error: `Collateral limit reached. Your ${plan} plan allows up to ${limits.collateral} items. Please upgrade.`, code: 'PLAN_LIMIT_REACHED' }, { status: 403 })
    }
    const body = await req.json()
    const { type, competitorId, caseStudyId, productName, buyerRole, customPrompt }: { type: CollateralType; competitorId?: string; caseStudyId?: string; productName?: string; buyerRole?: string; customPrompt?: string } = body
    const validTypes: CollateralType[] = ['battlecard','case_study_doc','one_pager','objection_handler','talk_track','email_sequence']
    if (!type || !validTypes.includes(type)) return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 })

    // Validate required params before inserting a record (fail fast, no orphaned rows)
    if (type === 'battlecard' && !competitorId) {
      return NextResponse.json({ error: 'competitorId is required for battlecard generation' }, { status: 400 })
    }
    if (type === 'case_study_doc' && !caseStudyId) {
      return NextResponse.json({ error: 'caseStudyId is required for case study doc generation' }, { status: 400 })
    }

    const now = new Date()
    const [record] = await db.insert(collateral).values({
      workspaceId, userId, type, title: `Generating ${type.replace(/_/g, ' ')}…`, status: 'generating',
      sourceCompetitorId: competitorId ?? null, sourceCaseStudyId: caseStudyId ?? null,
      sourceDealLogId: null, content: null, rawResponse: null, generatedAt: null, createdAt: now, updatedAt: now,
    }).returning()

    // Run generation after the response is sent — avoids Vercel timeout killing the AI call
    after(async () => {
      try {
        const result = await generateCollateral({ workspaceId, type, competitorId, caseStudyId, productName, buyerRole, customPrompt })
        const generatedAt = new Date()
        const [updated] = await db.update(collateral)
          .set({ title: result.title, status: 'ready', content: result.content, rawResponse: result.rawResponse, generatedAt, updatedAt: generatedAt })
          .where(eq(collateral.id, record.id))
          .returning()
        await logEvent(workspaceId, userId, 'collateral.generated', { collateralId: updated.id, collateralType: updated.type, title: updated.title })
      } catch (err) {
        console.error('[collateral/generate] AI generation failed:', err)
        await db.update(collateral).set({ status: 'stale', updatedAt: new Date() }).where(eq(collateral.id, record.id))
      }
    })

    return NextResponse.json({ data: { id: record.id, status: 'generating' } }, { status: 201 })
  } catch (err) { return dbErrResponse(err) }
}
