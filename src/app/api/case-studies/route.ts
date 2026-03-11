import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { caseStudies, events } from '@/lib/db/schema'
import { PLAN_LIMITS, isWithinLimit } from '@/lib/stripe/plans'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

async function logEvent(workspaceId: string, userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ workspaceId, userId, type, metadata, createdAt: new Date() })
}

// GET /api/case-studies
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    const rows = await db
      .select()
      .from(caseStudies)
      .where(eq(caseStudies.workspaceId, workspaceId))
      .orderBy(caseStudies.createdAt)

    return NextResponse.json({ data: rows })
  } catch (err) {
    return dbErrResponse(err)
  }
}

// POST /api/case-studies
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId, plan } = await getWorkspaceContext(userId)

    const limits = PLAN_LIMITS[plan]
    if (limits.caseStudies !== null) {
      const [{ value: currentCount }] = await db
        .select({ value: count() })
        .from(caseStudies)
        .where(eq(caseStudies.workspaceId, workspaceId))

      if (!isWithinLimit(Number(currentCount), limits.caseStudies)) {
        return NextResponse.json(
          {
            error: `Case study limit reached. Your ${plan} plan allows up to ${limits.caseStudies} case studies. Please upgrade.`,
            code: 'PLAN_LIMIT_REACHED',
          },
          { status: 403 },
        )
      }
    }

    const body = await req.json()
    const {
      customerName,
      customerIndustry,
      customerSize,
      challenge,
      solution,
      results,
      metrics,
      generatedNarrative,
      isPublic,
    } = body

    if (!customerName || !challenge || !solution || !results) {
      return NextResponse.json(
        { error: 'customerName, challenge, solution, and results are required' },
        { status: 400 },
      )
    }

    const now = new Date()
    const [caseStudy] = await db
      .insert(caseStudies)
      .values({
        workspaceId,
        userId,
        customerName,
        customerIndustry: customerIndustry ?? null,
        customerSize: customerSize ?? null,
        challenge,
        solution,
        results,
        metrics: metrics ?? [],
        generatedNarrative: generatedNarrative ?? null,
        isPublic: isPublic ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    await logEvent(workspaceId, userId, 'case_study.created', {
      caseStudyId: caseStudy.id,
      customerName,
    })

    return NextResponse.json({ data: caseStudy }, { status: 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}
