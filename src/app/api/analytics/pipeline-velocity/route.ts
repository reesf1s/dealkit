export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, events } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'

const PIPELINE_STAGES = [
  'prospecting',
  'qualification',
  'discovery',
  'proposal',
  'negotiation',
] as const

const DAY_MS = 86_400_000

interface StageMetric {
  stage: string
  avgDays: number
  conversionRate: number
  dealCount: number
  dropOffRate: number
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    const deals = await db
      .select()
      .from(dealLogs)
      .where(eq(dealLogs.workspaceId, workspaceId))

    if (deals.length === 0) {
      return NextResponse.json({
        data: {
          stageMetrics: PIPELINE_STAGES.map(s => ({ stage: s, avgDays: 0, conversionRate: 0, dealCount: 0, dropOffRate: 0 })),
          velocity: { value: 0, formula: 'deals × avgSize × winRate / cycleLength' },
          avgCycleLength: 0,
          winRate: 0,
          avgDealSize: 0,
          bottleneck: null,
          totalDeals: 0,
          generatedAt: new Date().toISOString(),
        },
      })
    }

    // Try to get stage change events
    let stageChangeEvents: any[] = []
    try {
      stageChangeEvents = await db
        .select()
        .from(events)
        .where(
          and(
            eq(events.workspaceId, workspaceId),
            eq(events.type, 'deal_log.updated'),
            sql`${events.metadata}->>'field' = 'stage'`,
          ),
        )
    } catch { /* events table may not have data */ }

    const hasEvents = stageChangeEvents.length > 0

    // Build stage transition data
    interface Transition { dealId: string; fromStage: string; toStage: string; at: Date }
    const transitions: Transition[] = stageChangeEvents
      .filter(e => {
        const m = e.metadata as any
        return m?.field === 'stage' && m?.previousValue && m?.value && m?.dealId
      })
      .map(e => {
        const m = e.metadata as any
        return { dealId: m.dealId as string, fromStage: m.previousValue, toStage: m.value, at: new Date(e.createdAt) }
      })

    // Group transitions by deal
    const byDeal = new Map<string, Transition[]>()
    for (const t of transitions) {
      const arr = byDeal.get(t.dealId) ?? []
      arr.push(t)
      byDeal.set(t.dealId, arr)
    }
    for (const arr of byDeal.values()) arr.sort((a, b) => a.at.getTime() - b.at.getTime())

    // Stage ordering map for progression detection
    const stageIdx: Record<string, number> = {}
    PIPELINE_STAGES.forEach((s, i) => { stageIdx[s] = i })
    stageIdx['closed_won'] = 5
    stageIdx['closed_lost'] = 5

    // ── Determine which deals have passed through each stage ──
    // For each deal, reconstruct its journey
    const dealJourneys = new Map<string, string[]>()

    for (const deal of deals) {
      const dealTransitions = byDeal.get(deal.id) ?? []
      if (dealTransitions.length > 0) {
        // Build journey from transitions
        const journey: string[] = [dealTransitions[0].fromStage]
        for (const t of dealTransitions) journey.push(t.toStage)
        dealJourneys.set(deal.id, journey)
      } else {
        // No transitions — infer journey from current stage
        // If a deal is in "proposal", it likely passed through earlier stages
        const currentIdx = stageIdx[deal.stage] ?? 0
        const journey = PIPELINE_STAGES.filter((_, i) => i <= currentIdx).map(s => s as string)
        if (deal.stage === 'closed_won' || deal.stage === 'closed_lost') {
          journey.push(deal.stage)
        }
        dealJourneys.set(deal.id, journey)
      }
    }

    // ── Calculate stage metrics ──
    const stageMetrics: StageMetric[] = PIPELINE_STAGES.map((stage, idx) => {
      // How many deals entered this stage
      let entered = 0
      let progressed = 0

      for (const [dealId, journey] of dealJourneys) {
        const stagePos = journey.indexOf(stage)
        if (stagePos >= 0) {
          entered++
          // Did the deal progress beyond this stage?
          const nextStages = journey.slice(stagePos + 1)
          if (nextStages.length > 0) {
            const nextIdx = stageIdx[nextStages[0]] ?? -1
            if (nextIdx > idx || nextStages[0] === 'closed_won') {
              progressed++
            }
          }
        }
      }

      // Average time in stage
      let avgDays = 0
      if (hasEvents) {
        const dwellTimes: number[] = []
        for (const arr of byDeal.values()) {
          for (const t of arr) {
            if (t.fromStage === stage) {
              const entry = arr.find(prev => prev.toStage === stage && prev.at < t.at)
              const entryTime = entry ? entry.at : new Date(deals.find(d => d.id === t.dealId)?.createdAt ?? t.at)
              const days = (t.at.getTime() - entryTime.getTime()) / DAY_MS
              if (days >= 0 && days < 365) dwellTimes.push(days)
            }
          }
        }
        if (dwellTimes.length > 0) {
          avgDays = Math.round((dwellTimes.reduce((s, d) => s + d, 0) / dwellTimes.length) * 10) / 10
        }
      } else {
        // Estimate from deal age — if a deal is currently in this stage,
        // use days since created (rough approximation split across stages)
        const dealsInStage = deals.filter(d => d.stage === stage)
        if (dealsInStage.length > 0) {
          const daysArr = dealsInStage.map(d => {
            const age = (Date.now() - new Date(d.createdAt).getTime()) / DAY_MS
            const numStages = Math.max(1, idx + 1) // stages traversed
            return Math.max(0, age / numStages) // estimate per-stage time
          })
          avgDays = Math.round((daysArr.reduce((s, d) => s + d, 0) / daysArr.length) * 10) / 10
        }
      }

      const dealCount = deals.filter(d => d.stage === stage).length
      const conversionRate = entered > 0 ? Math.round((progressed / entered) * 100) : 0

      return {
        stage,
        avgDays,
        conversionRate,
        dealCount,
        dropOffRate: entered > 0 ? 100 - conversionRate : 0,
      }
    })

    // ── Pipeline velocity ──
    const wonDeals = deals.filter(d => d.stage === 'closed_won' || d.outcome === 'won')
    const lostDeals = deals.filter(d => d.stage === 'closed_lost' || d.outcome === 'lost')
    const totalClosed = wonDeals.length + lostDeals.length
    const winRate = totalClosed > 0 ? Math.round((wonDeals.length / totalClosed) * 100) : 0

    const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    const dealValues = activeDeals.map(d => d.dealValue ?? 0).filter(v => v > 0)
    const avgDealSize = dealValues.length > 0
      ? Math.round(dealValues.reduce((s, v) => s + v, 0) / dealValues.length)
      : 0

    const cycleLengths = wonDeals
      .map(d => {
        const end = d.wonDate ?? d.updatedAt
        if (!end) return null
        return (new Date(end).getTime() - new Date(d.createdAt).getTime()) / DAY_MS
      })
      .filter((d): d is number => d !== null && d > 0)

    const avgCycleLength = cycleLengths.length > 0
      ? Math.round(cycleLengths.reduce((s, d) => s + d, 0) / cycleLengths.length)
      : 0

    const velocity = avgCycleLength > 0
      ? Math.round((activeDeals.length * avgDealSize * (winRate / 100)) / avgCycleLength)
      : 0

    // ── Bottleneck ──
    let bottleneck: { stage: string; reason: string } | null = null
    const withData = stageMetrics.filter(m => m.dealCount > 0 || m.avgDays > 0)
    if (withData.length > 0) {
      // Highest drop-off with meaningful data
      const highDropOff = withData
        .filter(m => m.dropOffRate > 0)
        .sort((a, b) => b.dropOffRate - a.dropOffRate)[0]

      // Longest dwell
      const longDwell = withData
        .filter(m => m.avgDays > 0)
        .sort((a, b) => b.avgDays - a.avgDays)[0]

      if (highDropOff && highDropOff.dropOffRate >= 50) {
        bottleneck = { stage: highDropOff.stage, reason: `${highDropOff.dropOffRate}% drop-off rate` }
      } else if (longDwell && longDwell.avgDays > 0) {
        bottleneck = { stage: longDwell.stage, reason: `Longest dwell time (${longDwell.avgDays}d avg)` }
      }
    }

    return NextResponse.json({
      data: {
        stageMetrics,
        velocity: { value: velocity, formula: 'deals × avgSize × winRate / cycleLength' },
        avgCycleLength,
        winRate,
        avgDealSize,
        bottleneck,
        totalDeals: deals.length,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('[pipeline-velocity]', err)
    return NextResponse.json({ error: 'Failed to compute pipeline velocity' }, { status: 500 })
  }
}
