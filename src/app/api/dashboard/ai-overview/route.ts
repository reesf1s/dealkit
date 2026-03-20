import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, workspaces, companyProfiles, competitors } from '@/lib/db/schema'
import { dbErrResponse, ensureLinksColumn } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'
import { anthropic } from '@/lib/ai/client'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getWorkspaceBrain, formatBrainContext } from '@/lib/workspace-brain'
import { parseMeetingEntries } from '@/lib/text-signals'

// Helper to load pipeline stage labels
async function loadStageLabels(workspaceId: string): Promise<Record<string, string>> {
  try {
    const [ws] = await db
      .select({ pipelineConfig: workspaces.pipelineConfig })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1)
    const pConfig = ws?.pipelineConfig as any
    if (pConfig?.stages?.length) {
      const labels: Record<string, string> = {}
      for (const s of pConfig.stages) labels[s.id] = s.label
      return labels
    }
  } catch { /* non-fatal */ }
  return {}
}

export type AIOverview = {
  summary: string
  keyActions: string[]
  pipelineHealth: string
  momentum: string | null
  topRisk: string | null
  generatedAt: string
  briefingHealth: 'green' | 'amber' | 'red'
  topAttentionDeals: { dealId: string; dealName: string; company: string; reason: string; urgency: 'high' | 'medium' }[]
  singleMostImportantAction: string
}

async function generateOverview(workspaceId: string): Promise<AIOverview> {
  await ensureLinksColumn()
  const [deals, companyRows, comps, stageLabels] = await Promise.all([
    db.select().from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId)),
    db.select().from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1),
    db.select().from(competitors).where(eq(competitors.workspaceId, workspaceId)),
    loadStageLabels(workspaceId),
  ])
  const sl = (stageId: string) => stageLabels[stageId] ?? stageId

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
      .map(t => ({ text: t.text, deal: d.dealName, stage: sl(d.stage) }))
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
      `- ${sl(stage)}: ${count} deal${count > 1 ? 's' : ''} (${fmt(value)})`
    ),
    '',
    'OPEN DEALS (top 12) — each with UNIQUE context:',
    ...openDeals.slice(0, 12).map(d => {
      // Parse meeting notes to extract last note info
      const allNotes = [d.meetingNotes, d.hubspotNotes].filter(Boolean).join('\n---\n')
      const entries = parseMeetingEntries(allNotes)
      const sortedEntries = entries.filter(e => e.date).sort((a, b) => (b.date!.getTime() - a.date!.getTime()))
      const lastEntry = sortedEntries[0]
      const lastNoteDate = lastEntry?.date ? lastEntry.date.toISOString().split('T')[0] : null
      const daysSinceLastNote = lastEntry?.date ? Math.round((Date.now() - lastEntry.date.getTime()) / 86400000) : null
      const lastNoteOneLiner = lastEntry?.text ? lastEntry.text.replace(/\[?\d{4}[-/]\d{1,2}[-/]\d{1,2}\]?\s*/, '').trim().slice(0, 100) : null

      // Open action count
      const openActionCount = ((d.todos as any[]) ?? []).filter((t: any) => !t.done).length

      // Deal risks for unique risk
      const dealRisks = (d.dealRisks as string[]) ?? []
      const uniqueRisk = dealRisks[0] ?? null

      // AI summary as one-line context
      const oneLineContext = d.aiSummary ? d.aiSummary.split('.')[0].trim().slice(0, 100) : null

      const parts = [
        `- "${d.dealName}" @ ${d.prospectCompany} | Stage: ${sl(d.stage)} | Value: ${fmt(d.dealValue ?? 0)} | Score: ${d.conversionScore ?? 'N/A'} | Close: ${d.closeDate ? new Date(d.closeDate).toLocaleDateString('en-GB') : 'TBD'} | Competitors: ${((d.competitors as string[]) ?? []).join(', ') || 'none'}`,
        oneLineContext ? `  Context: ${oneLineContext}` : null,
        uniqueRisk ? `  Top risk: ${uniqueRisk}` : null,
        daysSinceLastNote != null ? `  Days since last note: ${daysSinceLastNote}` : null,
        lastNoteDate ? `  Last note (${lastNoteDate}): "${lastNoteOneLiner}"` : null,
        openActionCount > 0 ? `  Open actions: ${openActionCount}` : null,
      ]
      return parts.filter(Boolean).join('\n')
    }),
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
      const baseBrainCtx = formatBrainContext(brain, Object.keys(stageLabels).length > 0 ? stageLabels : undefined)

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

  // --- Deterministic: topAttentionDeals ---
  const predictions = brain?.mlPredictions ?? []
  type AttentionDeal = { dealId: string; dealName: string; company: string; reason: string; urgency: 'high' | 'medium'; _sortKey: number }
  const nowMs = Date.now()
  const attentionDeals: AttentionDeal[] = []
  for (const d of openDeals) {
    const pred = predictions.find(p => p.dealId === d.id)
    const churnRisk = pred?.churnRisk ?? 0
    const score = d.conversionScore ?? 100
    const closeDateMs = d.closeDate ? new Date(d.closeDate).getTime() : null
    const daysToClose = closeDateMs != null ? Math.round((closeDateMs - nowMs) / 86400000) : null
    const closeSoon = daysToClose != null && daysToClose <= 14 && !['negotiation', 'closed_won', 'closed_lost'].includes(d.stage)

    if (churnRisk >= 65 || score <= 30 || closeSoon) {
      let reason: string
      let urgency: 'high' | 'medium'
      let sortKey: number

      // Build deal-specific signal fragments
      const intentSignals = d.intentSignals as any
      const budgetStatus = intentSignals?.budgetStatus
      const championStatus = intentSignals?.championStatus
      const dealRisks = (d.dealRisks as string[]) ?? []
      const dealCompetitors = (d.competitors as string[]) ?? []
      const openTodosCount = ((d.todos as any[]) ?? []).filter((t: any) => !t.done).length
      const stageLabel = sl(d.stage)
      const lastNote = d.meetingNotes
        ? d.meetingNotes.split('---')[0].replace(/^\[.*?\]\s*/, '').trim().slice(0, 80)
        : null

      // Compose signal-rich reason text
      const signals: string[] = []
      if (churnRisk >= 65) {
        const overdue = pred?.churnDaysOverdue ?? 0
        signals.push(`${churnRisk}% churn risk, ${overdue}d since last contact`)
        if (budgetStatus === 'not_discussed' || !budgetStatus) signals.push('budget never confirmed')
        if (championStatus === 'none' || !championStatus) signals.push('no champion identified')
        if (dealRisks.length > 0) signals.push(dealRisks[0].slice(0, 60))
        if (dealCompetitors.length > 0) signals.push(`competing with ${dealCompetitors[0]}`)
        urgency = 'high'
        sortKey = churnRisk * 1000
      } else if (score <= 30) {
        signals.push(`score ${score}/100 in ${stageLabel}`)
        if (budgetStatus === 'not_discussed' || !budgetStatus) signals.push('budget unconfirmed')
        if (budgetStatus === 'blocked') signals.push('budget blocked')
        if (championStatus === 'none' || !championStatus) signals.push('no champion')
        if (dealCompetitors.length > 0) signals.push(`${dealCompetitors[0]} in evaluation`)
        if (dealRisks.length > 0) signals.push(dealRisks[0].slice(0, 60))
        if (openTodosCount > 0) signals.push(`${openTodosCount} open action${openTodosCount > 1 ? 's' : ''}`)
        urgency = score <= 20 ? 'high' : 'medium'
        sortKey = (100 - score) * 100
      } else {
        // closeSoon
        signals.push(`close date in ${daysToClose}d, still in ${stageLabel}`)
        if (budgetStatus === 'not_discussed' || !budgetStatus) signals.push('budget not confirmed')
        if (budgetStatus === 'blocked') signals.push('budget blocked')
        if (championStatus === 'none' || !championStatus) signals.push('no champion identified')
        if (dealCompetitors.length > 0) signals.push(`${dealCompetitors[0]} competing`)
        if (openTodosCount > 0) signals.push(`${openTodosCount} open action${openTodosCount > 1 ? 's' : ''}`)
        urgency = 'medium'
        sortKey = daysToClose != null ? (14 - daysToClose) * 10 : 0
      }

      // Build sentence: lead with stage + primary trigger, then supporting signals
      const signalStr = signals.slice(0, 3).join('; ')
      reason = signalStr.charAt(0).toUpperCase() + signalStr.slice(1) + '.'
      if (lastNote && reason.length < 80) {
        reason = `${reason} Last note: "${lastNote.slice(0, 60)}${lastNote.length > 60 ? '…' : ''}"`
      }

      attentionDeals.push({
        dealId: d.id,
        dealName: d.dealName,
        company: d.prospectCompany ?? '',
        reason,
        urgency,
        _sortKey: sortKey,
      })
    }
  }
  attentionDeals.sort((a, b) => b._sortKey - a._sortKey)
  const topAttentionDeals = attentionDeals.slice(0, 3).map(({ _sortKey: _sk, ...rest }) => rest)

  // --- Deterministic: briefingHealth ---
  const allPreds = predictions
  const hasRed = openDeals.some(d => {
    const pred = allPreds.find(p => p.dealId === d.id)
    return (pred?.churnRisk ?? 0) >= 80 || (d.conversionScore ?? 100) <= 15
  })
  const hasAmber = openDeals.some(d => {
    const pred = allPreds.find(p => p.dealId === d.id)
    return (pred?.churnRisk ?? 0) >= 50 || (d.conversionScore ?? 100) <= 30
  })
  const briefingHealth: 'green' | 'amber' | 'red' = hasRed ? 'red' : hasAmber ? 'amber' : 'green'

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: `You are a senior sales strategist reviewing a sales team's pipeline. Analyse the data and respond with ONLY a JSON object — no markdown, no explanation — with these exact keys:
- "summary": string — 2–3 sentences summarising pipeline health and outlook, using specific numbers (deals, values, win rate). Be direct and honest.
- "keyActions": string[] — exactly 3–5 specific, actionable items the rep should do TODAY. Each must start with a verb and be under 15 words. Prioritise by urgency/value. CRITICAL: Each action must reference at least ONE specific signal from the deal data — a named deal, a person, a specific objection, a day count, a competitor, or a missing qualifier. DO NOT use generic phrases like "check in on progress", "ensure next steps are clear", or "follow up with prospects". BAD: "Follow up on stalled deals". GOOD: "Push RELX for budget confirmation — 14d to close date, still in Proposal".

CRITICAL: Every action MUST be unique. If two deals have similar scores, their actions must STILL differ because their context differs. Reference the specific last meeting, specific risk, specific person, or specific next step for each deal.

DO NOT use these phrases for any deal:
- "Define the final step"
- "Confirm the next concrete step"
- "Keep momentum"
These are generic filler. Replace with what the ACTUAL next step is from the deal's notes and actions.
- "pipelineHealth": string — a short phrase rating overall health (e.g. "Strong — 3 deals in late stage", "Caution — pipeline stagnating", "Healthy — £120k in negotiation").
- "momentum": string | null — one short positive signal or win to note, or null if there is none. If a deal's score improved, include the delta and before/after: e.g. "BOE +18pts (74→92%) — POC trial started". Never use vague phrases like "Engagement strengthening"; cite the specific event.
- "topRisk": string | null — the single biggest risk or blocker across the pipeline, or null if pipeline is empty or risk-free.
- "singleMostImportantAction": string — one sentence describing the single most impactful action the rep should take today, chosen from the full context. Must be specific, start with a verb, reference a specific deal or person, and be under 20 words.`,
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
    briefingHealth,
    topAttentionDeals,
    singleMostImportantAction: String(parsed.singleMostImportantAction ?? ''),
  }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
