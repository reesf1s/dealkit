/**
 * Workspace Brain — the single shared knowledge store for an organisation.
 *
 * After every deal analysis (meeting notes, stage change, etc.) the brain is
 * rebuilt from current DB state and stored as compressed JSONB on the workspace.
 *
 * Every feature (chat Q&A, AI overview, deal action) reads from here instead
 * of issuing expensive per-request fan-out queries.
 */
import { db } from '@/lib/db'
import { dealLogs, workspaces } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export interface DealSnapshot {
  id: string
  name: string
  company: string
  stage: string
  conversionScore: number | null
  dealValue: number | null
  risks: string[]
  pendingTodos: string[]
  summary: string | null
  lastUpdated: string
}

export interface WorkspaceBrain {
  updatedAt: string
  deals: DealSnapshot[]
  pipeline: {
    totalActive: number
    totalValue: number        // in smallest currency unit (pence)
    avgConversionScore: number | null
    stageBreakdown: Record<string, number>
  }
  topRisks: string[]          // deduplicated across all deals, most critical first
  keyPatterns: string[]        // recurring themes (objections, gaps, wins)
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

/** Rebuild and persist the brain from current deal state. Call this in background after any deal mutation. */
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
    })
    .from(dealLogs)
    .where(eq(dealLogs.workspaceId, workspaceId))

  const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

  const snapshots: DealSnapshot[] = deals.map(d => {
    const allTodos = (d.todos as { text: string; done: boolean }[]) ?? []
    const pending = allTodos.filter(t => !t.done).map(t => t.text)
    return {
      id: d.id,
      name: d.dealName,
      company: d.prospectCompany,
      stage: d.stage,
      conversionScore: d.conversionScore,
      dealValue: d.dealValue,
      risks: (d.dealRisks as string[]) ?? [],
      pendingTodos: pending.slice(0, 8),  // cap at 8 to keep brain compact
      summary: d.aiSummary,
      lastUpdated: d.updatedAt
        ? new Date(d.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '',
    }
  })

  const totalValue = activeDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)
  const scores = activeDeals.map(d => d.conversionScore).filter(Boolean) as number[]
  const avgConversionScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

  const stageBreakdown: Record<string, number> = {}
  for (const d of deals) {
    stageBreakdown[d.stage] = (stageBreakdown[d.stage] ?? 0) + 1
  }

  // Collect and deduplicate risks across all active deals
  const allRisks = activeDeals.flatMap(d => (d.dealRisks as string[]) ?? [])
  const topRisks = [...new Set(allRisks)].slice(0, 8)

  const brain: WorkspaceBrain = {
    updatedAt: new Date().toISOString(),
    deals: snapshots,
    pipeline: {
      totalActive: activeDeals.length,
      totalValue,
      avgConversionScore,
      stageBreakdown,
    },
    topRisks,
    keyPatterns: [],
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

  lines.push(`PIPELINE OVERVIEW (as of ${new Date(brain.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})`)
  lines.push(`Active deals: ${brain.pipeline.totalActive} | Total pipeline value: £${(brain.pipeline.totalValue / 100).toLocaleString()} | Avg conversion likelihood: ${brain.pipeline.avgConversionScore ?? 'N/A'}%`)

  if (brain.deals.length > 0) {
    lines.push('\nDEALS:')
    for (const d of brain.deals) {
      const isClosed = d.stage === 'closed_won' || d.stage === 'closed_lost'
      const scoreStr = d.conversionScore != null ? ` | ${d.conversionScore}% conversion` : ''
      const valueStr = d.dealValue ? ` | £${(d.dealValue / 100).toLocaleString()}` : ''
      lines.push(`• ${d.name} (${d.company}) — ${d.stage}${valueStr}${scoreStr}`)
      if (d.summary) lines.push(`  Summary: ${d.summary}`)
      if (!isClosed && d.risks.length > 0) lines.push(`  Risks: ${d.risks.slice(0, 2).join(' | ')}`)
      if (!isClosed && d.pendingTodos.length > 0) lines.push(`  Open actions (${d.pendingTodos.length}): ${d.pendingTodos.slice(0, 3).join(' | ')}${d.pendingTodos.length > 3 ? ` +${d.pendingTodos.length - 3} more` : ''}`)
    }
  }

  if (brain.topRisks.length > 0) {
    lines.push(`\nTOP RISKS ACROSS PIPELINE:\n${brain.topRisks.slice(0, 4).map(r => `• ${r}`).join('\n')}`)
  }

  return lines.join('\n')
}
