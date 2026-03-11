import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, count, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { collateral, users, events } from '@/lib/db/schema'
import { PLAN_LIMITS, isWithinLimit } from '@/lib/stripe/plans'
import { generateCollateral } from '@/lib/ai/generate'
import type { CollateralType } from '@/types'

async function logEvent(userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ userId, type, metadata, createdAt: new Date() })
}

// POST /api/collateral/generate — AI-generate a new collateral item
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [user] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Check collateral plan limit
  const limits = PLAN_LIMITS[user.plan]
  if (limits.collateral !== null) {
    const [{ value: currentCount }] = await db
      .select({ value: count() })
      .from(collateral)
      .where(and(eq(collateral.userId, userId)))

    if (!isWithinLimit(Number(currentCount), limits.collateral)) {
      return NextResponse.json(
        {
          error: `Collateral limit reached. Your ${user.plan} plan allows up to ${limits.collateral} collateral items. Please upgrade.`,
          code: 'PLAN_LIMIT_REACHED',
        },
        { status: 403 },
      )
    }
  }

  const body = await req.json()
  const {
    type,
    competitorId,
    caseStudyId,
    productName,
    buyerRole,
  }: {
    type: CollateralType
    competitorId?: string
    caseStudyId?: string
    productName?: string
    buyerRole?: string
  } = body

  const validTypes: CollateralType[] = [
    'battlecard',
    'case_study_doc',
    'one_pager',
    'objection_handler',
    'talk_track',
    'email_sequence',
  ]

  if (!type || !validTypes.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${validTypes.join(', ')}` },
      { status: 400 },
    )
  }

  const now = new Date()

  // Create the record in 'generating' state first so UI can show progress
  const [record] = await db
    .insert(collateral)
    .values({
      userId,
      type,
      title: `Generating ${type.replace(/_/g, ' ')}…`,
      status: 'generating',
      sourceCompetitorId: competitorId ?? null,
      sourceCaseStudyId: caseStudyId ?? null,
      sourceDealLogId: null,
      content: null,
      rawResponse: null,
      generatedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  try {
    const result = await generateCollateral({
      userId,
      type,
      competitorId,
      caseStudyId,
      productName,
      buyerRole,
    })

    const generatedAt = new Date()

    const [updated] = await db
      .update(collateral)
      .set({
        title: result.title,
        status: 'ready',
        content: result.content,
        rawResponse: result.rawResponse,
        generatedAt,
        updatedAt: generatedAt,
      })
      .where(eq(collateral.id, record.id))
      .returning()

    await logEvent(userId, 'collateral.generated', {
      collateralId: updated.id,
      collateralType: updated.type,
      title: updated.title,
    })

    return NextResponse.json({ data: updated }, { status: 201 })
  } catch (err) {
    // On failure, mark the record as stale so user can retry
    await db
      .update(collateral)
      .set({ status: 'stale', updatedAt: new Date() })
      .where(eq(collateral.id, record.id))

    console.error('[collateral/generate] AI generation failed:', err)
    return NextResponse.json(
      { error: 'AI generation failed. The collateral record has been marked stale.' },
      { status: 500 },
    )
  }
}
