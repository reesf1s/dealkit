import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { caseStudies, users, events } from '@/lib/db/schema'
import { PLAN_LIMITS, isWithinLimit } from '@/lib/stripe/plans'
import { dbErrResponse } from '@/lib/api-helpers'

async function logEvent(userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ userId, type, metadata, createdAt: new Date() })
}

async function ensureUser(userId: string) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
  if (!existing) {
    await db.insert(users).values({ id: userId, email: `${userId}@clerk.placeholder`, plan: 'free', createdAt: new Date(), updatedAt: new Date() })
  }
}

// GET /api/case-studies
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureUser(userId)

    const rows = await db
      .select()
      .from(caseStudies)
      .where(eq(caseStudies.userId, userId))
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

    await ensureUser(userId)

    const [user] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const limits = PLAN_LIMITS[user.plan]
    if (limits.caseStudies !== null) {
      const [{ value: currentCount }] = await db
        .select({ value: count() })
        .from(caseStudies)
        .where(eq(caseStudies.userId, userId))

      if (!isWithinLimit(Number(currentCount), limits.caseStudies)) {
        return NextResponse.json(
          {
            error: `Case study limit reached. Your ${user.plan} plan allows up to ${limits.caseStudies} case studies. Please upgrade.`,
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

    await logEvent(userId, 'case_study.created', {
      caseStudyId: caseStudy.id,
      customerName,
    })

    return NextResponse.json({ data: caseStudy }, { status: 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}
