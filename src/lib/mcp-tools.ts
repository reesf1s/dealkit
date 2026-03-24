/**
 * MCP Tools — deal intelligence functions for the Slack bot.
 *
 * These are internal TypeScript functions (not a separate MCP server yet — that's Phase 3).
 * They call existing Halvex DB/brain logic and return typed results ready for Block Kit formatting.
 *
 * Tools:
 *   getDealHealth()       — health score, trend, risks, actions for a named deal
 *   findAtRiskDeals()     — deals needing attention (score drops, stale, urgent)
 *   getLinkedIssues()     — Linear issues linked to a deal
 *   getWinLossSignals()   — top win/loss patterns from closed deal history
 */

import { getRelevantContext } from '@/lib/agent-context'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import { db } from '@/lib/db'
import { dealLinearLinks, linearIssuesCache } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────────────────────────
// Return types
// ─────────────────────────────────────────────────────────────────────────────

export interface DealHealthResult {
  found: boolean
  dealId?: string
  dealName?: string
  company?: string
  stage?: string
  score?: number | null
  scoreTrend?: 'improving' | 'declining' | 'stable' | 'new'
  scoreVelocity?: number        // change over last 14 days
  previousScore?: number        // most recent prior score from history
  risks?: string[]
  pendingTodos?: string[]
  daysSinceUpdate?: number
  closeDate?: string | null
  /** Recommended actions from brain pipeline recommendations */
  recommendations?: string[]
}

export interface AtRiskDeal {
  dealId: string
  dealName: string
  company: string
  score: number | null
  stage: string
  reason: string                // primary risk reason
  daysSinceUpdate?: number
}

export interface LinkedIssueResult {
  found: boolean
  dealId?: string
  dealName?: string
  company?: string
  issues?: {
    linearIssueId: string
    title: string
    linearIssueUrl?: string | null
    relevanceScore: number
    status: string              // 'suggested'|'confirmed'|'dismissed'|'in_cycle'|'deployed'
    issueStatus?: string | null // Linear status e.g. "In Progress"
  }[]
}

export interface WinLossResult {
  hasData: boolean
  winCount?: number
  lossCount?: number
  winRate?: number
  topWinSignals?: string[]      // top 3 win patterns
  topLossReasons?: string[]     // top 3 loss reasons
  competitorRecord?: {
    name: string
    wins: number
    losses: number
    winRate: number
  }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool 1: getDealHealth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find a deal by name/company and return its health intelligence.
 * Uses agent-context name matching + semantic search to identify the deal.
 */
export async function getDealHealth(
  workspaceId: string,
  query: string,
): Promise<DealHealthResult> {
  let context: Awaited<ReturnType<typeof getRelevantContext>>
  try {
    context = await getRelevantContext(workspaceId, query, 1)
  } catch {
    return { found: false }
  }

  const deal = context.relevantDeals[0]
  if (!deal) return { found: false }

  // Get brain for recommendations and score trend
  const brain = await getWorkspaceBrain(workspaceId)
  const brainDeal = brain?.deals.find(d => d.id === deal.id)
  const rec = brain?.pipelineRecommendations?.find(r => r.dealId === deal.id)

  // Get score history to derive previousScore
  const history = brainDeal?.scoreHistory ?? []
  const previousScore = history.length >= 2
    ? history[history.length - 2].score
    : undefined

  return {
    found: true,
    dealId: deal.id,
    dealName: deal.dealName,
    company: deal.prospectCompany,
    stage: deal.stage,
    score: deal.conversionScore,
    scoreTrend: brainDeal?.scoreTrend,
    scoreVelocity: brainDeal?.scoreVelocity,
    previousScore,
    risks: (deal.dealRisks as string[]) ?? [],
    pendingTodos: ((deal.todos as { text: string; done: boolean }[]) ?? [])
      .filter(t => !t.done)
      .map(t => t.text),
    daysSinceUpdate: brainDeal?.daysSinceUpdate,
    closeDate: deal.closeDate ? new Date(deal.closeDate).toISOString().split('T')[0] : null,
    recommendations: rec ? [rec.recommendation] : [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool 2: findAtRiskDeals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return deals that need attention: score alerts, stale deals, and urgent deals.
 * Reads from the cached WorkspaceBrain — O(1), no DB query.
 */
export async function findAtRiskDeals(workspaceId: string): Promise<AtRiskDeal[]> {
  const brain = await getWorkspaceBrain(workspaceId)
  if (!brain) return []

  const results: AtRiskDeal[] = []
  const seen = new Set<string>()

  // Score alerts (health drops ≥ 10)
  for (const alert of brain.scoreAlerts ?? []) {
    if (seen.has(alert.dealId)) continue
    seen.add(alert.dealId)
    results.push({
      dealId: alert.dealId,
      dealName: alert.dealName,
      company: alert.company,
      score: alert.currentScore,
      stage: brain.deals.find(d => d.id === alert.dealId)?.stage ?? 'unknown',
      reason: `Score dropped ${alert.delta} pts (${alert.previousScore} → ${alert.currentScore}): ${alert.possibleCause}`,
    })
  }

  // Urgent deals (close date soon or high-stage low-score)
  for (const urgent of brain.urgentDeals ?? []) {
    if (seen.has(urgent.dealId)) continue
    seen.add(urgent.dealId)
    const d = brain.deals.find(d => d.id === urgent.dealId)
    results.push({
      dealId: urgent.dealId,
      dealName: urgent.dealName,
      company: urgent.company,
      score: d?.conversionScore ?? null,
      stage: d?.stage ?? 'unknown',
      reason: urgent.reason,
    })
  }

  // Stale deals (no activity in 14+ days)
  for (const stale of brain.staleDeals ?? []) {
    if (seen.has(stale.dealId)) continue
    seen.add(stale.dealId)
    results.push({
      dealId: stale.dealId,
      dealName: stale.dealName,
      company: stale.company,
      score: stale.score,
      stage: stale.stage,
      reason: `No activity for ${stale.daysSinceUpdate} days`,
      daysSinceUpdate: stale.daysSinceUpdate,
    })
  }

  // Sort by urgency: score alerts first, then urgent, then stale
  // (already in order above, but cap at 8 results for Slack readability)
  return results.slice(0, 8)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool 3: getLinkedIssues
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find a deal by name/company and return its Linear issue links.
 */
export async function getLinkedIssues(
  workspaceId: string,
  query: string,
): Promise<LinkedIssueResult> {
  let context: Awaited<ReturnType<typeof getRelevantContext>>
  try {
    context = await getRelevantContext(workspaceId, query, 1)
  } catch {
    return { found: false }
  }

  const deal = context.relevantDeals[0]
  if (!deal) return { found: false }

  // Get links for this deal (exclude dismissed)
  const links = await db
    .select()
    .from(dealLinearLinks)
    .where(
      and(
        eq(dealLinearLinks.workspaceId, workspaceId),
        eq(dealLinearLinks.dealId, deal.id),
      )
    )

  const activeLinks = links.filter(l => l.status !== 'dismissed')

  if (activeLinks.length === 0) {
    return { found: true, dealId: deal.id, dealName: deal.dealName, company: deal.prospectCompany, issues: [] }
  }

  // Hydrate with cached issue status
  const issueIds = activeLinks.map(l => l.linearIssueId)
  const cachedIssues = await db
    .select({ linearIssueId: linearIssuesCache.linearIssueId, status: linearIssuesCache.status })
    .from(linearIssuesCache)
    .where(eq(linearIssuesCache.workspaceId, workspaceId))

  const issueStatusMap = new Map(cachedIssues.map(i => [i.linearIssueId, i.status]))

  const issues = activeLinks
    .filter(l => issueIds.includes(l.linearIssueId))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 6)
    .map(l => ({
      linearIssueId: l.linearIssueId,
      title: l.linearTitle ?? l.linearIssueId,
      linearIssueUrl: l.linearIssueUrl,
      relevanceScore: l.relevanceScore,
      status: l.status,
      issueStatus: issueStatusMap.get(l.linearIssueId) ?? null,
    }))

  return {
    found: true,
    dealId: deal.id,
    dealName: deal.dealName,
    company: deal.prospectCompany,
    issues,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool 4: getWinLossSignals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return win/loss intelligence from the workspace brain.
 * Also surfaces win playbook patterns if available.
 */
export async function getWinLossSignals(workspaceId: string): Promise<WinLossResult> {
  const brain = await getWorkspaceBrain(workspaceId)
  if (!brain?.winLossIntel) return { hasData: false }

  const intel = brain.winLossIntel
  const playbook = brain.winPlaybook

  // Build top win signals from playbook + objection wins
  const topWinSignals: string[] = []

  if (playbook?.fastestClosePattern?.commonSignals) {
    for (const sig of playbook.fastestClosePattern.commonSignals.slice(0, 2)) {
      topWinSignals.push(sig)
    }
  }

  const objectionWins = (brain.objectionWinMap ?? [])
    .filter(o => o.winRateWithTheme >= 50)
    .sort((a, b) => b.winsWithTheme - a.winsWithTheme)
    .slice(0, 3)
  for (const o of objectionWins) {
    if (topWinSignals.length < 3) {
      topWinSignals.push(`Overcame "${o.theme}" (${o.winRateWithTheme}% win rate)`)
    }
  }

  return {
    hasData: true,
    winCount: intel.winCount,
    lossCount: intel.lossCount,
    winRate: intel.winRate,
    topWinSignals: topWinSignals.slice(0, 3),
    topLossReasons: intel.topLossReasons.slice(0, 3),
    competitorRecord: intel.competitorRecord
      .filter(c => c.wins + c.losses >= 2)
      .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
      .slice(0, 4),
  }
}
