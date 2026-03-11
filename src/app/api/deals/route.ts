import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, count, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, collateral, users, events } from '@/lib/db/schema'
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

// GET /api/deals — list deals with optional filters
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureUser(userId)

    const { searchParams } = new URL(req.url)
    const outcome = searchParams.get('outcome')       // 'won' | 'lost' | 'open'
    const competitor = searchParams.get('competitor') // competitor name (partial match not supported in drizzle easily — exact)
    const product = searchParams.get('product')       // not stored directly — future use
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const conditions = [eq(dealLogs.userId, userId)]

    if (outcome === 'won') {
      conditions.push(eq(dealLogs.stage, 'closed_won'))
    } else if (outcome === 'lost') {
      conditions.push(eq(dealLogs.stage, 'closed_lost'))
    } else if (outcome === 'open') {
      // All stages that are not terminal
      conditions.push(
        sql`${dealLogs.stage} NOT IN ('closed_won', 'closed_lost')`,
      )
    }

    if (fromDate) {
      conditions.push(gte(dealLogs.createdAt, new Date(fromDate)))
    }
    if (toDate) {
      conditions.push(lte(dealLogs.createdAt, new Date(toDate)))
    }

    let rows = await db
      .select()
      .from(dealLogs)
      .where(and(...conditions))
      .orderBy(dealLogs.createdAt)

    // Filter by competitor name in JSONB array (post-query filter for simplicity)
    if (competitor) {
      rows = rows.filter((d) => {
        const comps = d.competitors as string[]
        return comps.some((c) => c.toLowerCase().includes(competitor.toLowerCase()))
      })
    }

    return NextResponse.json({ data: rows })
  } catch (err) {
    return dbErrResponse(err)
  }
}

// POST /api/deals — create a deal log
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
    if (limits.dealLogs !== null) {
      const [{ value: currentCount }] = await db
        .select({ value: count() })
        .from(dealLogs)
        .where(eq(dealLogs.userId, userId))

      if (!isWithinLimit(Number(currentCount), limits.dealLogs)) {
        return NextResponse.json(
          {
            error: `Deal log limit reached. Your ${user.plan} plan allows up to ${limits.dealLogs} deals. Please upgrade.`,
            code: 'PLAN_LIMIT_REACHED',
          },
          { status: 403 },
        )
      }
    }

    const body = await req.json()
    const {
      dealName,
      prospectCompany,
      prospectName,
      prospectTitle,
      dealValue,
      stage,
      competitors: dealCompetitors,
      notes,
      nextSteps,
      closeDate,
      wonDate,
      lostDate,
      lostReason,
    } = body

    if (!dealName || !prospectCompany) {
      return NextResponse.json(
        { error: 'dealName and prospectCompany are required' },
        { status: 400 },
      )
    }

    const now = new Date()

    const [deal] = await db
      .insert(dealLogs)
      .values({
        userId,
        dealName,
        prospectCompany,
        prospectName: prospectName ?? null,
        prospectTitle: prospectTitle ?? null,
        dealValue: dealValue ?? null,
        stage: stage ?? 'prospecting',
        competitors: dealCompetitors ?? [],
        notes: notes ?? null,
        nextSteps: nextSteps ?? null,
        closeDate: closeDate ? new Date(closeDate) : null,
        wonDate: wonDate ? new Date(wonDate) : null,
        lostDate: lostDate ? new Date(lostDate) : null,
        lostReason: lostReason ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    // Log appropriate event type
    const resolvedStage = deal.stage
    let eventType: string = 'deal_log.created'
    if (resolvedStage === 'closed_won') eventType = 'deal_log.closed_won'
    else if (resolvedStage === 'closed_lost') eventType = 'deal_log.closed_lost'

    await logEvent(userId, eventType, {
      dealLogId: deal.id,
      dealName: deal.dealName,
      dealValue: deal.dealValue,
      stage: deal.stage,
      lostReason: deal.lostReason ?? undefined,
    })

    // Mark objection handler collateral as stale — new deal data may affect best responses
    await db
      .update(collateral)
      .set({ status: 'stale', updatedAt: now })
      .where(
        and(eq(collateral.userId, userId), eq(collateral.type, 'objection_handler')),
      )

    // If there are competitors in the deal, mark battlecards as stale
    const dealComps = (deal.competitors as string[]) ?? []
    if (dealComps.length > 0) {
      await db
        .update(collateral)
        .set({ status: 'stale', updatedAt: now })
        .where(
          and(eq(collateral.userId, userId), eq(collateral.type, 'battlecard')),
        )
    }

    return NextResponse.json({ data: deal }, { status: 201 })
  } catch (err) {
    return dbErrResponse(err)
  }
}
