import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, count, gte, lte, sql } from 'drizzle-orm' // sql kept for inline queries below
import { db } from '@/lib/db'
import { dealLogs, collateral, events } from '@/lib/db/schema'
import { PLAN_LIMITS, isWithinLimit } from '@/lib/stripe/plans'
import { dbErrResponse, ensureIndexes } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { requestBrainRebuild } from '@/lib/brain-rebuild'

const STAGE_DEFAULT_SCORES: Record<string, number> = {
  prospecting: 15,
  qualification: 25,
  discovery: 40,
  proposal: 55,
  negotiation: 70,
  closed_won: 100,
  closed_lost: 0,
}

async function logEvent(workspaceId: string, userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ workspaceId, userId, type, metadata, createdAt: new Date() })
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    ensureIndexes().catch(() => {}) // runs runMigrations() then indexes on first cold start
    const { workspaceId } = await getWorkspaceContext(userId)
    const { searchParams } = new URL(req.url)
    const outcome = searchParams.get('outcome')
    const competitor = searchParams.get('competitor')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const conditions = [eq(dealLogs.workspaceId, workspaceId)]
    if (outcome === 'won') conditions.push(eq(dealLogs.stage, 'closed_won'))
    else if (outcome === 'lost') conditions.push(eq(dealLogs.stage, 'closed_lost'))
    else if (outcome === 'open') conditions.push(sql`${dealLogs.stage} NOT IN ('closed_won', 'closed_lost')`)
    if (fromDate) conditions.push(gte(dealLogs.createdAt, new Date(fromDate)))
    if (toDate) conditions.push(lte(dealLogs.createdAt, new Date(toDate)))
    if (competitor) conditions.push(
      sql`EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(${dealLogs.competitors}::jsonb) AS elem
        WHERE lower(elem) LIKE lower(${`%${competitor}%`})
      )`
    )
    const rows = await db.select().from(dealLogs).where(and(...conditions)).orderBy(dealLogs.createdAt)
    return NextResponse.json({ data: rows })
  } catch (err) { return dbErrResponse(err) }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId, plan } = await getWorkspaceContext(userId)
    const limits = PLAN_LIMITS[plan]
    if (limits.dealLogs !== null) {
      const [{ value: currentCount }] = await db.select({ value: count() }).from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId))
      if (!isWithinLimit(Number(currentCount), limits.dealLogs))
        return NextResponse.json({ error: `Deal log limit reached. Your ${plan} plan allows up to ${limits.dealLogs} deals. Please upgrade.`, code: 'PLAN_LIMIT_REACHED' }, { status: 403 })
    }
    const body = await req.json()
    const { dealName, prospectCompany, prospectName, prospectTitle, contacts, description, dealValue, stage, dealType, recurringInterval, competitors: dealCompetitors, notes, nextSteps, closeDate, wonDate, lostDate, lostReason, contractStartDate, contractEndDate, assignedRepId } = body
    if (!dealName || !prospectCompany) return NextResponse.json({ error: 'dealName and prospectCompany are required' }, { status: 400 })
    // Fix 2-digit year issue: new Date("0026-...") produces year 26 AD instead of 2026
    const fixDateYear = (d: Date): Date => { if (d.getFullYear() < 100) d.setFullYear(d.getFullYear() + 2000); return d }
    const safeDate = (v: string | null | undefined): Date | null => v ? fixDateYear(new Date(v)) : null
    const now = new Date()
    const [deal] = await db.insert(dealLogs).values({
      workspaceId, userId, dealName, prospectCompany,
      prospectName: prospectName ?? null, prospectTitle: prospectTitle ?? null,
      contacts: contacts ?? [], description: description ?? null,
      assignedRepId: assignedRepId ?? null,
      dealValue: dealValue ?? null,
      stage: stage ?? 'prospecting', dealType: dealType ?? 'one_off', recurringInterval: recurringInterval ?? null,
      competitors: dealCompetitors ?? [], notes: notes ?? null,
      nextSteps: nextSteps ?? null, closeDate: safeDate(closeDate),
      wonDate: safeDate(wonDate), lostDate: safeDate(lostDate),
      lostReason: lostReason ?? null,
      contractStartDate: safeDate(contractStartDate),
      contractEndDate: safeDate(contractEndDate),
      createdAt: now, updatedAt: now,
    }).returning()
    let eventType = 'deal_log.created'
    if (deal.stage === 'closed_won') eventType = 'deal_log.closed_won'
    else if (deal.stage === 'closed_lost') eventType = 'deal_log.closed_lost'
    await logEvent(workspaceId, userId, eventType, { dealLogId: deal.id, dealName: deal.dealName, dealValue: deal.dealValue, stage: deal.stage, lostReason: deal.lostReason ?? undefined })
    await db.update(collateral).set({ status: 'stale', updatedAt: now }).where(and(eq(collateral.workspaceId, workspaceId), eq(collateral.type, 'objection_handler')))
    if (((deal.competitors as string[]) ?? []).length > 0)
      await db.update(collateral).set({ status: 'stale', updatedAt: now }).where(and(eq(collateral.workspaceId, workspaceId), eq(collateral.type, 'battlecard')))

    // Default conversion score based on stage when no signals exist yet
    if (deal.conversionScore === null || deal.conversionScore === undefined) {
      const defaultScore = STAGE_DEFAULT_SCORES[deal.stage ?? 'prospecting'] ?? 15
      await db.update(dealLogs).set({ conversionScore: defaultScore, updatedAt: now }).where(eq(dealLogs.id, deal.id))
      deal.conversionScore = defaultScore
    }

    after(async () => {
      console.log(`[brain] Rebuild triggered by: deal_created (deal: ${deal.dealName}) at ${new Date().toISOString()}`)
      await requestBrainRebuild(workspaceId, 'deal_created')
    })
    return NextResponse.json({ data: deal }, { status: 201 })
  } catch (err) { return dbErrResponse(err) }
}
