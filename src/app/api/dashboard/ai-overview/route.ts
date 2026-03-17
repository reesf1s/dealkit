import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, workspaces, companyProfiles, competitors } from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { anthropic } from '@/lib/ai/client'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getWorkspaceBrain, formatBrainContext } from '@/lib/workspace-brain'

export type AIOverview = {
  summary: string
  keyActions: string[]
  pipelineHealth: string
  momentum: string | null
  topRisk: string | null
  generatedAt: string
}

// Run once per cold start to add new columns if they don't exist yet
let migrated = false
async function ensureColumns() {
  if (migrated) return
  try {
    await db.execute(
      sql`ALTER TABLE workspaces
          ADD COLUMN IF NOT EXISTS ai_overview jsonb,
          ADD COLUMN IF NOT EXISTS ai_overview_generated_at timestamptz`
    )
    migrated = true
  } catch {
    migrated = true // don't retry on failure
  }
}

async function generateOverview(workspaceId: string): Promise<AIOverview> {
  const [deals, companyRows, comps] = await Promise.all([
    db.select().from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId)),
    db.select().from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1),
    db.select().from(competitors).where(eq(competitors.workspaceId, workspaceId)),
  ])

  const openDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const wonDeals = deals.filter(d => d.stage === 'closed_won')
  const lostDeals = deals.filter(d => d.stage === 'closed_lost')
  const closedCount = wonDeals.length + lostDeals.length
  const winRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0
  const totalPipelineValue = openDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)

  // Stage breakdown
  const stageMap: Record<string, { count: number; value: number }> = {}
  for (const d of openDeals) {
    if (!stageMap[d.stage]) stageMap[d.stage] = { count: 0, value: 0 }
    stageMap[d.stage].count++
    stageMap[d.stage].value += d.dealValue ?? 0
  }

  // Pending todos across open deals
  type Todo = { text: string; done: boolean }
  const allTodos = openDeals.flatMap(d =>
    ((d.todos as Todo[]) ?? [])
      .filter(t => !t.done)
      .map(t => ({ text: t.text, deal: d.dealName, stage: d.stage }))
  )

  // Risks across open deals
  const allRisks = openDeals.flatMap(d =>
    ((d.dealRisks as string[]) ?? []).map(r => ({ risk: r, deal: d.dealName }))
  )

  // Active competitors in pipeline
  const activeCompetitors = [...new Set(openDeals.flatMap(d => (d.competitors as string[]) ?? []))]

  const fmt = (v: number) => v >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${v}`
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const contextStr = [
    `Company: ${companyRows[0]?.companyName ?? 'Unknown'}`,
    `Date: ${today}`,
    '',
    'PIPELINE SUMMARY:',
    `- Open deals: ${openDeals.length} worth ${fmt(totalPipelineValue)} total pipeline value`,
    `- Win rate: ${winRate}% (${wonDeals.length} won, ${lostDeals.length} lost)`,
    `- Known competitors: ${comps.map(c => c.name).join(', ') || 'none'}`,
    '',
    'STAGE BREAKDOWN:',
    ...Object.entries(stageMap).map(([stage, { count, value }]) =>
      `- ${stage}: ${count} deal${count > 1 ? 's' : ''} (${fmt(value)})`
    ),
    '',
    'OPEN DEALS (top 12):',
    ...openDeals.slice(0, 12).map(d =>
      `- "${d.dealName}" @ ${d.prospectCompany} | Stage: ${d.stage} | Value: ${fmt(d.dealValue ?? 0)} | Score: ${d.conversionScore ?? 'N/A'} | Close: ${d.closeDate ? new Date(d.closeDate).toLocaleDateString('en-GB') : 'TBD'} | Competitors: ${((d.competitors as string[]) ?? []).join(', ') || 'none'}`
    ),
    '',
    'PENDING TODOS (top 10):',
    ...(allTodos.length > 0
      ? allTodos.slice(0, 10).map(t => `- [${t.deal} · ${t.stage}] ${t.text}`)
      : ['- No pending todos']),
    '',
    'ACTIVE RISKS:',
    ...(allRisks.length > 0
      ? allRisks.slice(0, 6).map(r => `- [${r.deal}] ${r.risk}`)
      : ['- No risks flagged']),
    '',
    'COMPETITORS IN ACTIVE DEALS:',
    activeCompetitors.join(', ') || 'None',
  ].join('\n')

  // Enrich context with workspace brain if available (includes per-deal summaries + risks from analyze-notes)
  const brain = await getWorkspaceBrain(workspaceId)
  let brainContext = ''
  if (brain) {
    try {
      const baseBrainCtx = formatBrainContext(brain)

      // Churn risk alerts — deals overdue for follow-up
      const churnAlerts = (brain.mlPredictions ?? [])
        .filter(p => (p.churnRisk ?? 0) >= 65)
        .sort((a, b) => (b.churnRisk ?? 0) - (a.churnRisk ?? 0))
        .slice(0, 5)
      const churnCtx = churnAlerts.length > 0
        ? `\nCHURN RISK ALERTS:\n${churnAlerts.map(p => {
            const deal = openDeals.find(d => d.id === p.dealId)
            return `- ${deal?.dealName ?? p.dealId}: ${p.churnRisk}% churn risk${p.churnDaysOverdue ? ` (${p.churnDaysOverdue}d overdue)` : ''}`
          }).join('\n')}`
        : ''

      // Product gap win rate deltas
      const gapDeltas = (brain.productGapPriority ?? [])
        .filter(g => typeof g.winRateDelta === 'number' && g.winRateDelta <= -10)
        .slice(0, 3)
      const gapCtx = gapDeltas.length > 0
        ? `\nPRODUCT GAPS HURTING WIN RATE:\n${gapDeltas.map(g =>
            `- "${g.title}": ${g.winRateWithGap}% win rate with gap vs ${g.winRateWithoutGap}% without (▼${Math.abs(g.winRateDelta!)}pts impact)`
          ).join('\n')}`
        : ''

      brainContext = `\n\nDEAL INTELLIGENCE (from meeting analysis):\n${baseBrainCtx}${churnCtx}${gapCtx}`
    }
    catch { /* non-fatal: stale/corrupt brain snapshot */ }
  }

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: `You are a senior sales strategist reviewing a sales team's pipeline. Analyse the data and respond with ONLY a JSON object — no markdown, no explanation — with these exact keys:
- "summary": string — 2–3 sentences summarising pipeline health and outlook, using specific numbers (deals, values, win rate). Be direct and honest.
- "keyActions": string[] — exactly 3–5 specific, actionable items the rep should do TODAY. Each must start with a verb and be under 15 words. Prioritise by urgency/value.
- "pipelineHealth": string — a short phrase rating overall health (e.g. "Strong — 3 deals in late stage", "Caution — pipeline stagnating", "Healthy — £120k in negotiation").
- "momentum": string | null — one short positive signal or win to note, or null if there is none.
- "topRisk": string | null — the single biggest risk or blocker across the pipeline, or null if pipeline is empty or risk-free.`,
    messages: [{ role: 'user', content: `Pipeline data for ${today}:\n\n${contextStr}${brainContext}` }],
  })

  const rawText = (msg.content[0] as { type: string; text: string }).text.trim()
  // Strip markdown code fences if Claude wraps in ```json
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const parsed = JSON.parse(cleaned)

  return {
    summary: String(parsed.summary ?? ''),
    keyActions: Array.isArray(parsed.keyActions) ? parsed.keyActions.map(String) : [],
    pipelineHealth: String(parsed.pipelineHealth ?? ''),
    momentum: parsed.momentum ? String(parsed.momentum) : null,
    topRisk: parsed.topRisk ? String(parsed.topRisk) : null,
    generatedAt: new Date().toISOString(),
  }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureColumns()

    const { workspaceId } = await getWorkspaceContext(userId)

    // Return cached overview only — generation happens via POST (refresh button)
    const rows = await db.execute<{
      ai_overview: AIOverview | null
      ai_overview_generated_at: Date | null
    }>(sql`SELECT ai_overview, ai_overview_generated_at FROM workspaces WHERE id = ${workspaceId} LIMIT 1`)

    const row = rows[0]
    if (row?.ai_overview) {
      return NextResponse.json({ data: row.ai_overview, cached: true })
    }

    return NextResponse.json({ data: null, cached: false })
  } catch (err) {
    return dbErrResponse(err)
  }
}

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rl = await checkRateLimit(userId, 'ai-overview', 3)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)

    await ensureColumns()

    const { workspaceId } = await getWorkspaceContext(userId)

    const overview = await generateOverview(workspaceId)

    await db.execute(sql`
      UPDATE workspaces
      SET ai_overview = ${JSON.stringify(overview)}::jsonb,
          ai_overview_generated_at = NOW()
      WHERE id = ${workspaceId}
    `)

    return NextResponse.json({ data: overview, cached: false })
  } catch (err) {
    return dbErrResponse(err)
  }
}
