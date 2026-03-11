import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'

// GET /api/insights — aggregated deal intelligence for the current user
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const deals = await db
      .select()
      .from(dealLogs)
      .where(eq(dealLogs.userId, userId))

    const totalDeals = deals.length
    const wonDeals = deals.filter((d) => d.stage === 'closed_won').length
    const lostDeals = deals.filter((d) => d.stage === 'closed_lost').length
    const closedDeals = wonDeals + lostDeals
    const winRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0

    // ── dealsByCompetitor ──────────────────────────────────────────────────────
    const competitorMap = new Map<string, { wins: number; losses: number }>()

    for (const deal of deals) {
      if (deal.stage !== 'closed_won' && deal.stage !== 'closed_lost') continue
      const comps = (deal.competitors as string[]) ?? []
      for (const comp of comps) {
        if (!comp) continue
        const entry = competitorMap.get(comp) ?? { wins: 0, losses: 0 }
        if (deal.stage === 'closed_won') entry.wins++
        else entry.losses++
        competitorMap.set(comp, entry)
      }
    }

    const dealsByCompetitor = Array.from(competitorMap.entries()).map(([competitor, stats]) => {
      const total = stats.wins + stats.losses
      return {
        competitor,
        wins: stats.wins,
        losses: stats.losses,
        winRate: total > 0 ? Math.round((stats.wins / total) * 100) : 0,
      }
    })

    // ── dealsByProduct (derived from prospectTitle / notes as a proxy) ────────
    // Products are stored in company_profiles, not on deals directly.
    // We group by the first word of prospectTitle as a best-effort proxy.
    // This should be replaced with a real productId foreign key in a future migration.
    const productMap = new Map<string, { wins: number; losses: number }>()

    for (const deal of deals) {
      if (deal.stage !== 'closed_won' && deal.stage !== 'closed_lost') continue
      // Use prospectTitle as a proxy for product/segment if available
      const product = deal.prospectTitle?.trim() ?? 'Unknown'
      const entry = productMap.get(product) ?? { wins: 0, losses: 0 }
      if (deal.stage === 'closed_won') entry.wins++
      else entry.losses++
      productMap.set(product, entry)
    }

    const dealsByProduct = Array.from(productMap.entries()).map(([product, stats]) => {
      const total = stats.wins + stats.losses
      return {
        product,
        wins: stats.wins,
        losses: stats.losses,
        winRate: total > 0 ? Math.round((stats.wins / total) * 100) : 0,
      }
    })

    // ── dealsByRole (buyer role, proxied via prospectTitle) ───────────────────
    const roleMap = new Map<string, { wins: number; losses: number }>()

    for (const deal of deals) {
      if (deal.stage !== 'closed_won' && deal.stage !== 'closed_lost') continue
      const role = deal.prospectTitle?.trim() ?? 'Unknown'
      const entry = roleMap.get(role) ?? { wins: 0, losses: 0 }
      if (deal.stage === 'closed_won') entry.wins++
      else entry.losses++
      roleMap.set(role, entry)
    }

    const dealsByRole = Array.from(roleMap.entries()).map(([role, stats]) => {
      const total = stats.wins + stats.losses
      return {
        role,
        wins: stats.wins,
        losses: stats.losses,
        winRate: total > 0 ? Math.round((stats.wins / total) * 100) : 0,
      }
    })

    // ── topLossReasons ─────────────────────────────────────────────────────────
    const lossReasonMap = new Map<string, number>()

    for (const deal of deals) {
      if (deal.stage !== 'closed_lost' || !deal.lostReason) continue
      const reason = deal.lostReason.trim()
      lossReasonMap.set(reason, (lossReasonMap.get(reason) ?? 0) + 1)
    }

    const topLossReasons = Array.from(lossReasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // ── topObjections (mined from notes field as a heuristic) ─────────────────
    // A proper implementation would have a structured objections field on deal_logs.
    // For now we parse notes for lines starting with common objection keywords.
    const objectionMap = new Map<string, number>()
    const objectionKeywords = ['too expensive', 'no budget', 'wrong time', 'not a priority', 'already use', 'competitor', 'need approval', 'timing']

    for (const deal of deals) {
      if (!deal.notes) continue
      const notesLower = deal.notes.toLowerCase()
      for (const kw of objectionKeywords) {
        if (notesLower.includes(kw)) {
          objectionMap.set(kw, (objectionMap.get(kw) ?? 0) + 1)
        }
      }
    }

    const topObjections = Array.from(objectionMap.entries())
      .map(([objection, count]) => ({ objection, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return NextResponse.json({
      data: {
        totalDeals,
        wonDeals,
        lostDeals,
        winRate,
        dealsByProduct,
        dealsByCompetitor,
        dealsByRole,
        topObjections,
        topLossReasons,
      },
    })
  } catch (err) {
    return dbErrResponse(err)
  }
}
