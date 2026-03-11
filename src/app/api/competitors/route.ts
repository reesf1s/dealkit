import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { competitors, users, events } from '@/lib/db/schema'
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

// GET /api/competitors — list all competitors for current user
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureUser(userId)

    const rows = await db
      .select()
      .from(competitors)
      .where(eq(competitors.userId, userId))
      .orderBy(competitors.createdAt)

    return NextResponse.json({ data: rows })
  } catch (err) {
    return dbErrResponse(err)
  }
}

// POST /api/competitors — create a new competitor (enforces free plan limit)
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureUser(userId)

    // Fetch user plan
    const [user] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    // Check plan limit
    const limits = PLAN_LIMITS[user.plan]
    if (limits.competitors !== null) {
      const [{ value: currentCount }] = await db
        .select({ value: count() })
        .from(competitors)
        .where(eq(competitors.userId, userId))

      if (!isWithinLimit(Number(currentCount), limits.competitors)) {
        return NextResponse.json(
          {
            error: `Competitor limit reached. Your ${user.plan} plan allows up to ${limits.competitors} competitors. Please upgrade to add more.`,
            code: 'PLAN_LIMIT_REACHED',
          },
          { status: 403 },
        )
      }
    }

    const body = await req.json()
    const {
      name,
      website,
      description,
      strengths,
      weaknesses,
      pricing,
      targetMarket,
      keyFeatures,
      differentiators,
      notes,
    } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const now = new Date()
    const [competitor] = await db
      .insert(competitors)
      .values({
        userId,
        name,
        website: website ?? null,
        description: description ?? null,
        strengths: strengths ?? [],
        weaknesses: weaknesses ?? [],
        pricing: pricing ?? null,
        targetMarket: targetMarket ?? null,
        keyFeatures: keyFeatures ?? [],
        differentiators: differentiators ?? [],
        notes: notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    await logEvent(userId, 'competitor.created', { competitorId: competitor.id, name })

    return NextResponse.json({ data: competitor }, { status: 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}
