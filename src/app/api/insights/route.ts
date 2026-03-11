import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId } = await getWorkspaceContext(userId)
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
    return NextResponse.json({ data: { totalDeals, wonDeals, lostDeals, winRate, dealsByProduct, dealsByCompetitor, dealsByRole, topObjections, topLossReasons } })
  } catch (err) { return dbErrResponse(err) }
}
