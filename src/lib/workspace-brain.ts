/**
 * Workspace Brain — the single shared knowledge store for an organisation.
 *
 * After every deal mutation (create/update/delete/analyze) the brain is
 * rebuilt from current DB state and stored as compressed JSONB on the workspace.
 *
 * Every feature (chat Q&A, AI overview, deal action) reads from here instead
 * of issuing expensive per-request fan-out queries.
 *
 * Proactive intelligence (no AI call, pure data analysis):
 * - urgentDeals: close date within 7 days, or high-stage deals with low score
 * - staleDeals:  open deals with no update in 14+ days
 * - keyPatterns: recurring risk/objection themes across the pipeline
 */
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export interface DealSnapshot {
  id: string
  name: string
  company: string
  stage: string
  conversionScore: number | null
  dealValue: number | null     // raw value in pounds/dollars (NOT pence)
  risks: string[]
  pendingTodos: string[]
  summary: string | null
  lastUpdated: string
  closeDate: string | null     // ISO string or null
  daysSinceUpdate: number
}

export interface WorkspaceBrain {
  updatedAt: string
  deals: DealSnapshot[]
  pipeline: {
    totalActive: number
    totalValue: number          // raw pounds/dollars (NOT pence)
    avgConversionScore: number | null
    stageBreakdown: Record<string, number>
  }
  topRisks: string[]            // deduplicated across all active deals
  keyPatterns: { label: string; dealIds: string[]; companies: string[] }[]         // recurring themes detected automatically
  urgentDeals: {                // deals needing attention soon
    dealId: string
    dealName: string
    company: string
    reason: string              // e.g. "Close date in 3 days" or "High-stage with low score"
  }[]
  staleDeals: {                 // open deals with no activity for 14+ days
    dealId: string
    dealName: string
    company: string
    daysSinceUpdate: number
  }[]
}

let schemaMigrated = false
async function ensureBrainColumn() {
  if (schemaMigrated) return
  try {
    await db.execute(sql`
      ALTER TABLE workspaces
      ADD COLUMN IF NOT EXISTS workspace_brain jsonb
    `)
  } catch { /* already exists */ }
  schemaMigrated = true
}

/** Read the brain. Returns null if not yet built. */
export async function getWorkspaceBrain(workspaceId: string): Promise<WorkspaceBrain | null> {
  await ensureBrainColumn()
  const rows = await db.execute<{ workspace_brain: WorkspaceBrain | null }>(
    sql`SELECT workspace_brain FROM workspaces WHERE id = ${workspaceId} LIMIT 1`
  )
  return rows[0]?.workspace_brain ?? null
}

/** Rebuild and persist the brain from current deal state. Call in background after any deal mutation. */
export async function rebuildWorkspaceBrain(workspaceId: string): Promise<WorkspaceBrain> {
  await ensureBrainColumn()

  const deals = await db
    .select({
      id: dealLogs.id,
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      stage: dealLogs.stage,
      dealValue: dealLogs.dealValue,
      conversionScore: dealLogs.conversionScore,
      dealRisks: dealLogs.dealRisks,
      todos: dealLogs.todos,
      aiSummary: dealLogs.aiSummary,
      updatedAt: dealLogs.updatedAt,
      closeDate: dealLogs.closeDate,
    })
    .from(dealLogs)
    .where(eq(dealLogs.workspaceId, workspaceId))

  const now = new Date()
  const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

  const snapshots: DealSnapshot[] = deals.map(d => {
    const allTodos = (d.todos as { text: string; done: boolean }[]) ?? []
    const pending = allTodos.filter(t => !t.done).map(t => t.text)
    const updatedMs = d.updatedAt ? new Date(d.updatedAt).getTime() : now.getTime()
    const daysSince = Math.floor((now.getTime() - updatedMs) / 86_400_000)
    return {
      id: d.id,
      name: d.dealName,
      company: d.prospectCompany,
      stage: d.stage,
      conversionScore: d.conversionScore,
      dealValue: d.dealValue,
      risks: (d.dealRisks as string[]) ?? [],
      pendingTodos: pending.slice(0, 8),
      summary: d.aiSummary,
      lastUpdated: d.updatedAt
        ? new Date(d.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '',
      closeDate: d.closeDate ? new Date(d.closeDate).toISOString() : null,
      daysSinceUpdate: daysSince,
    }
  })

  // ── Pipeline stats ─────────────────────────────────────────────────────────
  const totalValue = activeDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)
  const scores = activeDeals.map(d => d.conversionScore).filter((s): s is number => s != null)
  const avgConversionScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

  const stageBreakdown: Record<string, number> = {}
  for (const d of deals) {
    stageBreakdown[d.stage] = (stageBreakdown[d.stage] ?? 0) + 1
  }

  // ── Top risks — deduplicated ────────────────────────────────────────────────
  const allRisks = activeDeals.flatMap(d => (d.dealRisks as string[]) ?? [])
  const topRisks = [...new Set(allRisks)].slice(0, 8)

  // ── Proactive: urgent deals ────────────────────────────────────────────────
  // Flag: close date within 7 days, OR in proposal/negotiation with score < 35
  const urgentDeals: WorkspaceBrain['urgentDeals'] = []
  const lateStages = new Set(['proposal', 'negotiation'])
  for (const snap of snapshots) {
    if (snap.stage === 'closed_won' || snap.stage === 'closed_lost') continue
    if (snap.closeDate) {
      const daysToClose = Math.ceil((new Date(snap.closeDate).getTime() - now.getTime()) / 86_400_000)
      if (daysToClose >= 0 && daysToClose <= 7) {
        urgentDeals.push({
          dealId: snap.id,
          dealName: snap.name,
          company: snap.company,
          reason: daysToClose === 0 ? 'Close date is TODAY' : `Close date in ${daysToClose} day${daysToClose === 1 ? '' : 's'}`,
        })
        continue
      }
      if (daysToClose < 0) {
        urgentDeals.push({
          dealId: snap.id,
          dealName: snap.name,
          company: snap.company,
          reason: `Overdue — close date passed ${Math.abs(daysToClose)} day${Math.abs(daysToClose) === 1 ? '' : 's'} ago`,
        })
        continue
      }
    }
    if (lateStages.has(snap.stage) && snap.conversionScore != null && snap.conversionScore < 35) {
      urgentDeals.push({
        dealId: snap.id,
        dealName: snap.name,
        company: snap.company,
        reason: `In ${snap.stage} with only ${snap.conversionScore}% conversion likelihood`,
      })
    }
  }

  // ── Proactive: stale deals (no update in 14+ days) ─────────────────────────
  const staleDeals: WorkspaceBrain['staleDeals'] = activeDeals
    .filter(d => {
      const daysSince = snapshots.find(s => s.id === d.id)?.daysSinceUpdate ?? 0
      return daysSince >= 14
    })
    .map(d => {
      const snap = snapshots.find(s => s.id === d.id)!
      return {
        dealId: d.id,
        dealName: d.dealName,
        company: d.prospectCompany,
        daysSinceUpdate: snap.daysSinceUpdate,
      }
    })
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)

  // ── Proactive: key patterns — recurring risk themes ────────────────────────
  // Count keyword frequency across all risk strings; surface themes seen in 2+ deals
  const riskWords = [
    { label: 'budget concerns', keywords: ['budget', 'cost', 'price', 'expensive', 'pricing'] },
    { label: 'slow responses / disengagement', keywords: ['slow', 'unresponsive', 'ghost', 'disengaged', 'no reply', 'silent'] },
    { label: 'competitor pressure', keywords: ['competitor', 'competing', 'alternative', 'rival', 'vs '] },
    { label: 'unclear decision-maker', keywords: ['decision', 'authority', 'champion', 'sponsor', 'approver'] },
    { label: 'timeline slippage', keywords: ['delay', 'postpone', 'pushed back', 'timeline', 'deadline'] },
    { label: 'procurement / legal blockers', keywords: ['procurement', 'legal', 'contract', 'compliance', 'security review'] },
    { label: 'internal competing priorities', keywords: ['priority', 'bandwidth', 'internal', 'resource', 'capacity'] },
  ]

  const keyPatterns: WorkspaceBrain['keyPatterns'] = []
  for (const theme of riskWords) {
    const matchingDeals = activeDeals.filter(d => {
      const allText = ((d.dealRisks as string[]) ?? []).join(' ').toLowerCase()
      return theme.keywords.some(kw => allText.includes(kw))
    })
    if (matchingDeals.length >= 2) {
      keyPatterns.push({
        label: theme.label,
        dealIds: matchingDeals.map(d => d.id),
        companies: matchingDeals.map(d => d.prospectCompany),
      })
    }
  }

  const brain: WorkspaceBrain = {
    updatedAt: now.toISOString(),
    deals: snapshots,
    pipeline: { totalActive: activeDeals.length, totalValue, avgConversionScore, stageBreakdown },
    topRisks,
    keyPatterns,
    urgentDeals,
    staleDeals,
  }

  await db.execute(sql`
    UPDATE workspaces
    SET workspace_brain = ${JSON.stringify(brain)}::jsonb
    WHERE id = ${workspaceId}
  `)

  return brain
}

/** Format the brain as a compact context string for LLM prompts. */
export function formatBrainContext(brain: WorkspaceBrain): string {
  const lines: string[] = []
  const fmt = (v: number) => v >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${v}`

  lines.push(`PIPELINE OVERVIEW (brain updated ${new Date(brain.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})`)
  lines.push(`Active deals: ${brain.pipeline.totalActive} | Total pipeline: ${fmt(brain.pipeline.totalValue)} | Avg conversion: ${brain.pipeline.avgConversionScore ?? 'N/A'}%`)

  if (brain.deals.length > 0) {
    lines.push('\nDEALS:')
    for (const d of brain.deals) {
      const isClosed = d.stage === 'closed_won' || d.stage === 'closed_lost'
      const scoreStr = d.conversionScore != null ? ` | ${d.conversionScore}%` : ''
      const valueStr = d.dealValue ? ` | ${fmt(d.dealValue)}` : ''
      const closeDateStr = d.closeDate ? ` | Close: ${new Date(d.closeDate).toLocaleDateString('en-GB')}` : ''
      lines.push(`• ${d.name} (${d.company}) — ${d.stage}${valueStr}${scoreStr}${closeDateStr}`)
      if (d.summary) lines.push(`  Summary: ${d.summary}`)
      if (!isClosed && d.risks.length > 0) lines.push(`  Risks: ${d.risks.slice(0, 2).join(' | ')}`)
      if (!isClosed && d.pendingTodos.length > 0) lines.push(`  Todos (${d.pendingTodos.length}): ${d.pendingTodos.slice(0, 3).join(' | ')}${d.pendingTodos.length > 3 ? ` +${d.pendingTodos.length - 3} more` : ''}`)
    }
  }

  if (brain.urgentDeals.length > 0) {
    lines.push('\nURGENT — NEEDS ATTENTION:')
    for (const u of brain.urgentDeals) {
      lines.push(`⚠️ ${u.dealName} (${u.company}): ${u.reason}`)
    }
  }

  if (brain.staleDeals.length > 0) {
    lines.push('\nSTALE DEALS (no update 14+ days):')
    for (const s of brain.staleDeals.slice(0, 4)) {
      lines.push(`• ${s.dealName} (${s.company}) — ${s.daysSinceUpdate} days since last update`)
    }
  }

  if (brain.topRisks.length > 0) {
    lines.push(`\nTOP RISKS ACROSS PIPELINE:\n${brain.topRisks.slice(0, 4).map(r => `• ${r}`).join('\n')}`)
  }

  if (brain.keyPatterns.length > 0) {
    lines.push(`\nRECURRING PATTERNS:`)
    for (const p of brain.keyPatterns) {
      lines.push(`• ${p.label}${p.companies.length > 0 ? ` — ${p.companies.slice(0, 3).join(', ')}${p.companies.length > 3 ? ` +${p.companies.length - 3} more` : ''}` : ''}`)
    }
  }

  return lines.join('\n')
}
