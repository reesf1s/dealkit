export const maxDuration = 60
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, count, eq, ilike } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral, companyProfiles, competitors, dealLogs, events } from '@/lib/db/schema'
import { PLAN_LIMITS, isWithinLimit } from '@/lib/stripe/plans'
import { generateCollateral, generateFreeformCollateral } from '@/lib/ai/generate'
import type { CollateralType } from '@/types'
import { dbErrResponse, ensureLinksColumn } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { upsertCollateral } from '@/lib/collateral-helpers'

async function logEvent(workspaceId: string, userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ workspaceId, userId, type, metadata, createdAt: new Date() })
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rl = await checkRateLimit(userId, 'collateral:generate', 5)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)
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
    const { type, competitorId: rawCompetitorId, caseStudyId, productName, buyerRole, customPrompt, dealId, title: customTitle, description: customDescription }: {
      type: CollateralType; competitorId?: string; caseStudyId?: string
      productName?: string; buyerRole?: string; customPrompt?: string; dealId?: string
      title?: string; description?: string
    } = body
    let competitorId = rawCompetitorId

    const validTypes: CollateralType[] = ['battlecard','case_study_doc','one_pager','objection_handler','talk_track','email_sequence','custom']
    if (!type || !validTypes.includes(type))
      return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    if (type === 'battlecard' && !competitorId)
      return NextResponse.json({ error: 'competitorId is required for battlecard generation' }, { status: 400 })
    if (type === 'case_study_doc' && !caseStudyId)
      return NextResponse.json({ error: 'caseStudyId is required for case study doc generation' }, { status: 400 })

    // ── Build deal context if a dealId was provided ──────────────────────────
    let dealContext: string | undefined
    let sourceDealLogId: string | null = null

    if (dealId) {
      await ensureLinksColumn()
      const [dealRow] = await db.select().from(dealLogs)
        .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId))).limit(1)

      if (dealRow) {
        sourceDealLogId = dealId

        // Auto-resolve competitor from deal's competitor names if not explicitly passed
        if (!competitorId && type === 'battlecard') {
          const dealCompNames = (dealRow.competitors as string[]) ?? []
          for (const name of dealCompNames) {
            const [comp] = await db.select({ id: competitors.id }).from(competitors)
              .where(and(eq(competitors.workspaceId, workspaceId), ilike(competitors.name, `%${name}%`))).limit(1)
            if (comp) { competitorId = comp.id; break }
          }
        }

        const risks = (dealRow.dealRisks as string[]) ?? []
        const dealComps = (dealRow.competitors as string[]) ?? []
        dealContext = [
          `Prospect: ${dealRow.prospectCompany}${dealRow.prospectName ? ` — ${dealRow.prospectName}` : ''}${dealRow.prospectTitle ? ` (${dealRow.prospectTitle})` : ''}`,
          `Stage: ${dealRow.stage?.replace(/_/g, ' ')}`,
          dealComps.length ? `Competing against: ${dealComps.join(', ')}` : '',
          dealRow.aiSummary ? `Deal summary: ${dealRow.aiSummary}` : '',
          risks.length ? `Active deal risks: ${risks.join('; ')}` : '',
          dealRow.dealValue ? `Deal value: $${dealRow.dealValue.toLocaleString()}` : '',
        ].filter(Boolean).join('\n')
      }
    }

    // Upsert: reuse any existing row with the same (workspace, type, competitor, caseStudy)
    // to prevent duplicate collateral. Ready/stale/generating rows are all matched.
    const record = await upsertCollateral({
      workspaceId,
      userId,
      type,
      title: `Generating ${type.replace(/_/g, ' ')}…`,
      status: 'generating',
      sourceCompetitorId: competitorId ?? null,
      sourceCaseStudyId: caseStudyId ?? null,
      sourceDealLogId,
    })

    // Run synchronously — Haiku at 1024 tokens typically completes in 3-8s, well within maxDuration=60
    try {
      const result = type === 'custom'
        ? await generateFreeformCollateral({
            workspaceId,
            title: customTitle ?? 'Custom Content',
            description: customDescription ?? customPrompt ?? 'Generate content',
            dealContext,
            customPrompt,
          })
        : await generateCollateral({ workspaceId, type, competitorId, caseStudyId, productName, buyerRole, customPrompt, dealContext })
      const generatedAt = new Date()
      const [updated] = await db.update(collateral)
        .set({
          title: result.title, status: 'ready', content: result.content, rawResponse: result.rawResponse, generatedAt, updatedAt: generatedAt,
          ...(type === 'custom' && customTitle ? { customTypeName: customTitle } : {}),
        })
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
