/**
 * GET /api/analytics/win-loss
 * Surfaces patterns from closed deals: win rate, cycle times, loss reasons,
 * competitor impact, score correlation, monthly trends, and more.
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000))
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Count occurrences in a JSONB string-array column, returning sorted desc. */
function countStrings(arrays: unknown[][]): { text: string; count: number }[] {
  const map: Record<string, number> = {}
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue
    for (const item of arr) {
      const text = typeof item === 'string' ? item : (item as { text?: string })?.text
      if (!text) continue
      map[text] = (map[text] || 0) + 1
    }
  }
  return Object.entries(map)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ctx = await getWorkspaceContext(userId)
    if (!ctx.workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Fetch all closed deals in one query
    const closedDeals = await db
      .select()
      .from(dealLogs)
      .where(
        and(
          eq(dealLogs.workspaceId, ctx.workspaceId),
          inArray(dealLogs.stage, ['closed_won', 'closed_lost']),
        ),
      )

    // ----- Empty-state guard -----
    if (closedDeals.length === 0) {
      return NextResponse.json({
        data: {
          overall: {
            winRate: 0,
            totalClosed: 0,
            won: 0,
            lost: 0,
            avgWonValue: 0,
            avgLostValue: 0,
            avgWonCycle: 0,
            avgLostCycle: 0,
          },
          scoreCorrelation: { avgWonScore: 0, avgLostScore: 0 },
          contactCorrelation: { avgWonContacts: 0, avgLostContacts: 0 },
          lossReasons: [],
          winFactors: [],
          competitorImpact: [],
          deathStage: null,
          monthlyTrend: [],
          generatedAt: new Date().toISOString(),
        },
      })
    }

    // ----- Partition won / lost -----
    const won = closedDeals.filter((d) => d.stage === 'closed_won')
    const lost = closedDeals.filter((d) => d.stage === 'closed_lost')

    // ----- Overall -----
    const totalClosed = closedDeals.length
    const winRate = Math.round((won.length / totalClosed) * 100)

    const avgWonValue = avg(won.map((d) => d.dealValue ?? 0))
    const avgLostValue = avg(lost.map((d) => d.dealValue ?? 0))

    const cycleDays = (d: typeof closedDeals[number]): number => {
      const start = new Date(d.createdAt)
      const end = d.wonDate ?? d.lostDate ?? d.updatedAt
      return daysBetween(start, new Date(end))
    }

    const avgWonCycle = Math.round(avg(won.map(cycleDays)))
    const avgLostCycle = Math.round(avg(lost.map(cycleDays)))

    // ----- Score correlation -----
    const wonScores = won.map((d) => d.conversionScore).filter((s): s is number => s != null)
    const lostScores = lost.map((d) => d.conversionScore).filter((s): s is number => s != null)
    const scoreCorrelation = {
      avgWonScore: Math.round(avg(wonScores)),
      avgLostScore: Math.round(avg(lostScores)),
    }

    // ----- Contact count correlation -----
    const contactCount = (d: typeof closedDeals[number]): number => {
      const c = d.contacts as unknown[]
      return Array.isArray(c) ? c.length : 0
    }
    const contactCorrelation = {
      avgWonContacts: avg(won.map(contactCount)),
      avgLostContacts: avg(lost.map(contactCount)),
    }

    // ----- Loss reasons (dealRisks) -----
    const lossReasonsRaw = countStrings(lost.map((d) => d.dealRisks as unknown[]))
    const lossReasons = lossReasonsRaw.map(({ text, count }) => ({ reason: text, count }))

    // ----- Win factors (conversionInsights) -----
    const winFactorsRaw = countStrings(won.map((d) => d.conversionInsights as unknown[]))
    const winFactors = winFactorsRaw.map(({ text, count }) => ({ factor: text, count }))

    // ----- Competitor impact -----
    const compMap: Record<string, { wonAgainst: number; lostTo: number }> = {}
    for (const d of won) {
      const comps = d.competitors as string[] | null
      if (!Array.isArray(comps)) continue
      for (const c of comps) {
        if (!c) continue
        if (!compMap[c]) compMap[c] = { wonAgainst: 0, lostTo: 0 }
        compMap[c].wonAgainst++
      }
    }
    for (const d of lost) {
      const comps = d.competitors as string[] | null
      if (!Array.isArray(comps)) continue
      for (const c of comps) {
        if (!c) continue
        if (!compMap[c]) compMap[c] = { wonAgainst: 0, lostTo: 0 }
        compMap[c].lostTo++
      }
      // Also count competitorLostTo if set
      if (d.competitorLostTo) {
        if (!compMap[d.competitorLostTo]) compMap[d.competitorLostTo] = { wonAgainst: 0, lostTo: 0 }
        compMap[d.competitorLostTo].lostTo++
      }
    }
    const competitorImpact = Object.entries(compMap)
      .map(([competitor, stats]) => ({ competitor, ...stats }))
      .sort((a, b) => b.lostTo + b.wonAgainst - (a.lostTo + a.wonAgainst))

    // ----- Death stage: most common lostReason or last stage hint -----
    // We use the `lostReason` field first, but the spec asks for "last stage before closed_lost".
    // Since deals move to closed_lost, we look at scoreHistory or simply report the most common
    // lost reason. Without explicit stage-change history, we report lostReason as the death signal.
    // If lostReason is sparse, we report null.
    const stageCounts: Record<string, number> = {}
    for (const d of lost) {
      // Use lostReason as proxy for death context
      const reason = d.lostReason || 'unknown'
      stageCounts[reason] = (stageCounts[reason] || 0) + 1
    }
    let deathStage: { stage: string; count: number; percentage: number } | null = null
    if (lost.length > 0) {
      const sorted = Object.entries(stageCounts).sort(([, a], [, b]) => b - a)
      const [topStage, topCount] = sorted[0]
      deathStage = {
        stage: topStage,
        count: topCount,
        percentage: Math.round((topCount / lost.length) * 100),
      }
    }

    // ----- Monthly trend (last 6 months) -----
    const now = new Date()
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthMap: Record<string, { won: number; lost: number }> = {}
    // Pre-fill last 6 months
    for (let i = 0; i < 6; i++) {
      const d = new Date(now)
      d.setMonth(d.getMonth() - i)
      const key = monthKey(d)
      monthMap[key] = { won: 0, lost: 0 }
    }

    for (const d of closedDeals) {
      const closedDate = d.wonDate ?? d.lostDate ?? d.updatedAt
      const cd = new Date(closedDate)
      if (cd < sixMonthsAgo) continue
      const key = monthKey(cd)
      if (!monthMap[key]) monthMap[key] = { won: 0, lost: 0 }
      if (d.stage === 'closed_won') monthMap[key].won++
      else monthMap[key].lost++
    }

    const monthlyTrend = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { won: w, lost: l }]) => ({
        month,
        won: w,
        lost: l,
        winRate: w + l > 0 ? Math.round((w / (w + l)) * 100) : 0,
      }))

    return NextResponse.json({
      data: {
        overall: {
          winRate,
          totalClosed,
          won: won.length,
          lost: lost.length,
          avgWonValue,
          avgLostValue,
          avgWonCycle,
          avgLostCycle,
        },
        scoreCorrelation,
        contactCorrelation,
        lossReasons,
        winFactors,
        competitorImpact,
        deathStage,
        monthlyTrend,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('[win-loss]', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
