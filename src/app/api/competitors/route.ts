import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { competitors, events } from '@/lib/db/schema'
import { PLAN_LIMITS, isWithinLimit } from '@/lib/stripe/plans'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

async function logEvent(workspaceId: string, userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ workspaceId, userId, type, metadata, createdAt: new Date() })
}

// GET /api/competitors
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    const rows = await db
      .select()
      .from(competitors)
      .where(eq(competitors.workspaceId, workspaceId))
      .orderBy(competitors.createdAt)

    return NextResponse.json({ data: rows })
  } catch (err) {
    return dbErrResponse(err)
  }
}

// POST /api/competitors
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId, plan } = await getWorkspaceContext(userId)

    const limits = PLAN_LIMITS[plan]
    if (limits.competitors !== null) {
      const [{ value: currentCount }] = await db
        .select({ value: count() })
        .from(competitors)
        .where(eq(competitors.workspaceId, workspaceId))

      if (!isWithinLimit(Number(currentCount), limits.competitors)) {
        return NextResponse.json(
          {
            error: `Competitor limit reached. Your ${plan} plan allows up to ${limits.competitors} competitors. Please upgrade to add more.`,
            code: 'PLAN_LIMIT_REACHED',
          },
          { status: 403 },
        )
      }
    }

    const body = await req.json()
    const { name, website, description, strengths, weaknesses, pricing, targetMarket, keyFeatures, differentiators, notes } = body

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const now = new Date()
    const [competitor] = await db
      .insert(competitors)
      .values({
        workspaceId,
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

    await logEvent(workspaceId, userId, 'competitor.created', { competitorId: competitor.id, name })

    return NextResponse.json({ data: competitor }, { status: 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}
