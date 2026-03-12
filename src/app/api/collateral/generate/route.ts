export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, count, eq, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral, companyProfiles, events } from '@/lib/db/schema'
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

    // Check company profile exists BEFORE doing anything — if missing, fail immediately with a clear error
    const [profileRow] = await db
      .select({ id: companyProfiles.id })
      .from(companyProfiles)
      .where(eq(companyProfiles.workspaceId, workspaceId))
      .limit(1)
    if (!profileRow) {
      return NextResponse.json({
        error: 'Company profile not set up. Please complete your company profile before generating collateral.',
        code: 'NO_COMPANY_PROFILE',
      }, { status: 400 })
    }

    const limits = PLAN_LIMITS[plan]
    if (limits.collateral !== null) {
      const [{ value: currentCount }] = await db.select({ value: count() }).from(collateral).where(eq(collateral.workspaceId, workspaceId))
      if (!isWithinLimit(Number(currentCount), limits.collateral))
        return NextResponse.json({ error: `Collateral limit reached. Your ${plan} plan allows up to ${limits.collateral} items. Please upgrade.`, code: 'PLAN_LIMIT_REACHED' }, { status: 403 })
    }

    const body = await req.json()
    const { type, competitorId, caseStudyId, productName, buyerRole, customPrompt }: {
      type: CollateralType; competitorId?: string; caseStudyId?: string
      productName?: string; buyerRole?: string; customPrompt?: string
    } = body

    const validTypes: CollateralType[] = ['battlecard','case_study_doc','one_pager','objection_handler','talk_track','email_sequence']
    if (!type || !validTypes.includes(type))
      return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    if (type === 'battlecard' && !competitorId)
      return NextResponse.json({ error: 'competitorId is required for battlecard generation' }, { status: 400 })
    if (type === 'case_study_doc' && !caseStudyId)
      return NextResponse.json({ error: 'caseStudyId is required for case study doc generation' }, { status: 400 })

    const now = new Date()

    // Reuse any existing non-ready record with the same key to prevent duplicates.
    // A "stuck" generating record (e.g. from a timed-out previous request) or a stale
    // record for the same competitor/case-study should be overwritten, not duplicated.
    const competitorMatch = competitorId ? eq(collateral.sourceCompetitorId, competitorId) : isNull(collateral.sourceCompetitorId)
    const caseStudyMatch = caseStudyId ? eq(collateral.sourceCaseStudyId, caseStudyId) : isNull(collateral.sourceCaseStudyId)

    const [existing] = await db.select({ id: collateral.id }).from(collateral).where(
      and(
        eq(collateral.workspaceId, workspaceId),
        eq(collateral.type, type),
        competitorMatch,
        caseStudyMatch,
        or(eq(collateral.status, 'generating'), eq(collateral.status, 'stale')),
      )
    ).limit(1)

    let record: { id: string }
    if (existing) {
      // Overwrite the stuck/stale record in-place — no new row created
      const [updated] = await db.update(collateral)
        .set({ userId, title: `Generating ${type.replace(/_/g, ' ')}…`, status: 'generating', content: null, rawResponse: null, generatedAt: null, updatedAt: now })
        .where(eq(collateral.id, existing.id))
        .returning({ id: collateral.id })
      record = updated
    } else {
      const [inserted] = await db.insert(collateral).values({
        workspaceId, userId, type, title: `Generating ${type.replace(/_/g, ' ')}…`, status: 'generating',
        sourceCompetitorId: competitorId ?? null, sourceCaseStudyId: caseStudyId ?? null,
        sourceDealLogId: null, content: null, rawResponse: null, generatedAt: null, createdAt: now, updatedAt: now,
      }).returning({ id: collateral.id })
      record = inserted
    }

    // Run synchronously — Haiku at 1024 tokens typically completes in 3-8s, well within maxDuration=60
    try {
      const result = await generateCollateral({ workspaceId, type, competitorId, caseStudyId, productName, buyerRole, customPrompt })
      const generatedAt = new Date()
      const [updated] = await db.update(collateral)
        .set({ title: result.title, status: 'ready', content: result.content, rawResponse: result.rawResponse, generatedAt, updatedAt: generatedAt })
        .where(eq(collateral.id, record.id))
        .returning()
      await logEvent(workspaceId, userId, 'collateral.generated', { collateralId: updated.id, collateralType: updated.type, title: updated.title })
      return NextResponse.json({ data: { id: updated.id, status: 'ready', title: updated.title } }, { status: 201 })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[collateral/generate] AI generation failed:', errMsg)
      // Store error in rawResponse so it's visible, mark stale
      await db.update(collateral)
        .set({ status: 'stale', rawResponse: { error: errMsg }, updatedAt: new Date() })
        .where(eq(collateral.id, record.id))
      return NextResponse.json({ error: `Generation failed: ${errMsg}`, code: 'GENERATION_FAILED' }, { status: 500 })
    }
  } catch (err) { return dbErrResponse(err) }
}
