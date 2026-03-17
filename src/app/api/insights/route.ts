import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { dbErrResponse, ensureLinksColumn } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
    await ensureLinksColumn()
    const deals = await db.select().from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId))
    const totalDeals = deals.length
    const wonDeals = deals.filter(d => d.stage === 'closed_won').length
    const lostDeals = deals.filter(d => d.stage === 'closed_lost').length
    const closedDeals = wonDeals + lostDeals
    const winRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0
    const competitorMap = new Map<string, { wins: number; losses: number }>()
    for (const deal of deals) {
      if (deal.stage !== 'closed_won' && deal.stage !== 'closed_lost') continue
      for (const comp of ((deal.competitors as string[]) ?? [])) {
        if (!comp) continue
        const e = competitorMap.get(comp) ?? { wins: 0, losses: 0 }
        if (deal.stage === 'closed_won') e.wins++; else e.losses++
        competitorMap.set(comp, e)
      }
    }
    const dealsByCompetitor = Array.from(competitorMap.entries()).map(([competitor, s]) => ({ competitor, wins: s.wins, losses: s.losses, winRate: (s.wins + s.losses) > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0 }))
    const productMap = new Map<string, { wins: number; losses: number }>()
    for (const deal of deals) {
      if (deal.stage !== 'closed_won' && deal.stage !== 'closed_lost') continue
      const p = deal.prospectTitle?.trim() ?? 'Unknown'
      const e = productMap.get(p) ?? { wins: 0, losses: 0 }
      if (deal.stage === 'closed_won') e.wins++; else e.losses++
      productMap.set(p, e)
    }
    const dealsByProduct = Array.from(productMap.entries()).map(([product, s]) => ({ product, wins: s.wins, losses: s.losses, winRate: (s.wins + s.losses) > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0 }))
    const dealsByRole = dealsByProduct.map(d => ({ role: d.product, wins: d.wins, losses: d.losses, winRate: d.winRate }))
    const lossReasonMap = new Map<string, number>()
    for (const deal of deals) {
      if (deal.stage !== 'closed_lost' || !deal.lostReason) continue
      lossReasonMap.set(deal.lostReason.trim(), (lossReasonMap.get(deal.lostReason.trim()) ?? 0) + 1)
    }
    const topLossReasons = Array.from(lossReasonMap.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 5)
    const objectionMap = new Map<string, number>()
    const kws = ['too expensive','no budget','wrong time','not a priority','already use','competitor','need approval','timing']
    for (const deal of deals) {
      if (!deal.notes) continue
      const nl = deal.notes.toLowerCase()
      for (const kw of kws) if (nl.includes(kw)) objectionMap.set(kw, (objectionMap.get(kw) ?? 0) + 1)
    }
    const topObjections = Array.from(objectionMap.entries()).map(([objection, count]) => ({ objection, count })).sort((a, b) => b.count - a.count).slice(0, 5)

    // Cross-deal pattern alerts
    const openDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    const crossDealAlerts: Array<{ type: string; message: string; count: number; dealIds: string[] }> = []

    // Competitor momentum: same competitor in 2+ active deals
    const openCompMap = new Map<string, string[]>()
    for (const deal of openDeals) {
      for (const comp of ((deal.competitors as string[]) ?? [])) {
        if (!comp) continue
        const arr = openCompMap.get(comp) ?? []
        openCompMap.set(comp, [...arr, deal.id])
      }
    }
    for (const [comp, ids] of openCompMap.entries()) {
      if (ids.length >= 2) {
        const stats = competitorMap.get(comp)
        const wr = stats && (stats.wins + stats.losses) > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : null
        crossDealAlerts.push({ type: 'competitor_momentum', message: `${comp} is in ${ids.length} active deals${wr !== null ? ` — ${wr}% win rate vs them` : ''}. Refresh your battlecard.`, count: ids.length, dealIds: ids })
      }
    }

    // Recurring risks: same risk string in 2+ active deals
    const riskMap2 = new Map<string, string[]>()
    for (const deal of openDeals) {
      for (const risk of ((deal.dealRisks as string[]) ?? [])) {
        if (!risk) continue
        const key = risk.toLowerCase().trim()
        const arr = riskMap2.get(key) ?? []
        riskMap2.set(key, [...arr, deal.id])
      }
    }
    for (const [risk, ids] of riskMap2.entries()) {
      if (ids.length >= 2) {
        crossDealAlerts.push({ type: 'recurring_risk', message: `"${risk}" is a flagged risk across ${ids.length} active deals — address it in your collateral.`, count: ids.length, dealIds: ids })
      }
    }

    // Losing streak: lost to same competitor 2+ times recently
    const recentLost = deals.filter(d => d.stage === 'closed_lost').slice(-15)
    const lossStreakMap = new Map<string, number>()
    for (const deal of recentLost) {
      for (const comp of ((deal.competitors as string[]) ?? [])) {
        if (!comp) continue
        lossStreakMap.set(comp, (lossStreakMap.get(comp) ?? 0) + 1)
      }
    }
    for (const [comp, count] of lossStreakMap.entries()) {
      if (count >= 2 && !crossDealAlerts.some(a => a.type === 'competitor_momentum' && a.message.startsWith(comp))) {
        crossDealAlerts.push({ type: 'losing_streak', message: `Lost ${count} recent deals where ${comp} was involved — update your battlecard positioning.`, count, dealIds: [] })
      }
    }

    return NextResponse.json({ data: { totalDeals, wonDeals, lostDeals, winRate, dealsByProduct, dealsByCompetitor, dealsByRole, topObjections, topLossReasons, crossDealAlerts } })
  } catch (err) { return dbErrResponse(err) }
}
