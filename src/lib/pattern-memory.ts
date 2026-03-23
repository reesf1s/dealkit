import { db } from '@/lib/db'
import { signalOutcomes } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * Record a structured signal snapshot when a deal closes.
 * Called inside after() so it never blocks the response.
 * Idempotent — skips if already recorded for this deal.
 */
export async function recordSignalOutcome(dealId: string, workspaceId: string, dealData: any) {
  const isClosed = dealData.stage === 'closed_won' || dealData.stage === 'closed_lost'
  if (!isClosed) return

  const outcome = dealData.stage === 'closed_won' ? 'won' : 'lost'
  const intentSignals = dealData.intentSignals || {}
  const contacts = (dealData.contacts as any[]) || []
  const competitors = (dealData.competitors as any[]) || []

  // Check if already recorded
  const existing = await db.select({ id: signalOutcomes.id })
    .from(signalOutcomes)
    .where(and(eq(signalOutcomes.dealId, dealId), eq(signalOutcomes.workspaceId, workspaceId)))
    .limit(1)

  if (existing.length > 0) return // Already recorded

  const createdAt = dealData.createdAt ? new Date(dealData.createdAt) : new Date()
  const daysToClose = Math.floor((Date.now() - createdAt.getTime()) / 86400000)

  await db.insert(signalOutcomes).values({
    workspaceId,
    dealId,
    outcome,
    closeDate: dealData.closeDate ? new Date(dealData.closeDate) : new Date(),
    championIdentified: intentSignals.championStatus === 'confirmed',
    budgetConfirmed: intentSignals.budgetStatus === 'confirmed' || intentSignals.budgetStatus === 'approved',
    competitorPresent: competitors.length > 0,
    competitorName: competitors[0]?.name || competitors[0] || null,
    objectionThemes: [], // Will be populated from note signals
    sentimentTrajectory: (intentSignals.momentum ?? 0.5) > 0.6 ? 'improving' : (intentSignals.momentum ?? 0.5) < 0.4 ? 'declining' : 'stable',
    daysToClose,
    totalMeetings: 0, // Will be computed from parsed notes
    stakeholderCount: contacts.length,
    dealValue: dealData.dealValue ?? 0,
    stage: dealData.stage,
    winReason: dealData.winReason || null,
    lossReason: dealData.lostReason || null,
  })

  console.log(`[pattern-memory] Recorded ${outcome} outcome for deal ${dealId}`)
}

/**
 * Query pattern: what happens when signals match a given pattern?
 * Returns win rate, avg days to close, and top loss reasons.
 */
export async function queryPattern(
  workspaceId: string,
  pattern: { championIdentified?: boolean; budgetConfirmed?: boolean; competitorPresent?: boolean }
) {
  const conditions = [eq(signalOutcomes.workspaceId, workspaceId)]

  if (pattern.championIdentified !== undefined) {
    conditions.push(eq(signalOutcomes.championIdentified, pattern.championIdentified))
  }
  if (pattern.budgetConfirmed !== undefined) {
    conditions.push(eq(signalOutcomes.budgetConfirmed, pattern.budgetConfirmed))
  }
  if (pattern.competitorPresent !== undefined) {
    conditions.push(eq(signalOutcomes.competitorPresent, pattern.competitorPresent))
  }

  const results = await db.select().from(signalOutcomes).where(and(...conditions))

  const wins = results.filter(r => r.outcome === 'won')
  const losses = results.filter(r => r.outcome === 'lost')

  return {
    total: results.length,
    winRate: results.length > 0 ? wins.length / results.length : null,
    avgDaysToClose: wins.length > 0
      ? Math.round(wins.reduce((s, r) => s + (r.daysToClose || 0), 0) / wins.length)
      : null,
    topLossReasons: losses.map(r => r.lossReason).filter(Boolean),
  }
}
