import { z } from 'zod'
import { eq, and, or, ilike, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs, competitors, caseStudies, productGaps } from '@/lib/db/schema'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import type { ToolContext, ToolResult } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// query_pipeline
// ─────────────────────────────────────────────────────────────────────────────

export const query_pipeline = {
  description: 'Get pipeline overview and analytics. Returns stage breakdown, total value, risks, and key metrics from the workspace brain.',
  parameters: z.object({
    focus: z.string().optional().describe('Optional focus area (e.g. "risks", "velocity", "forecast", "stale deals")'),
  }),
  execute: async (params: { focus?: string }, ctx: ToolContext): Promise<ToolResult> => {
    const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)

    if (!brain) {
      return { result: 'No pipeline data available yet. Add some deals to get started.' }
    }

    const lines: string[] = ['# Pipeline Overview']

    // Core pipeline metrics
    lines.push(`\n**Active Deals:** ${brain.pipeline.totalActive}`)
    lines.push(`**Total Pipeline Value:** $${brain.pipeline.totalValue.toLocaleString()}`)
    if (brain.pipeline.avgConversionScore != null) {
      lines.push(`**Avg Conversion Score:** ${brain.pipeline.avgConversionScore}%`)
    }

    // Stage breakdown — use custom labels when available
    const stages = brain.pipeline.stageBreakdown
    const sl = (id: string) => ctx.stageLabels?.[id] ?? id
    if (Object.keys(stages).length > 0) {
      lines.push('\n**Stage Breakdown:**')
      for (const [stage, count] of Object.entries(stages)) {
        lines.push(`- ${sl(stage)}: ${count} deal${count === 1 ? '' : 's'}`)
      }
    }

    // Win/loss intel
    if (brain.winLossIntel) {
      const wl = brain.winLossIntel
      lines.push('\n**Win/Loss Intelligence:**')
      lines.push(`- Win rate: ${wl.winRate}% (${wl.winCount}W / ${wl.lossCount}L)`)
      if (wl.avgWonValue > 0) lines.push(`- Avg won deal value: $${wl.avgWonValue.toLocaleString()}`)
      if (wl.avgDaysToClose > 0) lines.push(`- Avg days to close: ${wl.avgDaysToClose}`)
      if (wl.topLossReasons.length > 0) lines.push(`- Top loss reasons: ${wl.topLossReasons.join(', ')}`)
    }

    // Forecast
    if (brain.dealVelocity) {
      lines.push('\n**Forecast:**')
      lines.push(`- Weighted forecast: $${brain.dealVelocity.weightedForecast.toLocaleString()}`)
      lines.push(`- Deals in forecast: ${brain.dealVelocity.forecastDealCount}`)
    }

    // Focus-specific sections
    const focus = params.focus?.toLowerCase()

    if (!focus || focus.includes('risk')) {
      if (brain.topRisks.length > 0) {
        lines.push('\n**Top Risks Across Pipeline:**')
        brain.topRisks.slice(0, 5).forEach(r => lines.push(`- ${r}`))
      }
    }

    if (!focus || focus.includes('urgent')) {
      if (brain.urgentDeals.length > 0) {
        lines.push('\n**Urgent Deals:**')
        brain.urgentDeals.forEach(d => lines.push(`- **${d.dealName}** (${d.company}): ${d.reason}`))
      }
    }

    if (!focus || focus.includes('stale')) {
      if (brain.staleDeals.length > 0) {
        lines.push('\n**Stale Deals (14+ days inactive):**')
        brain.staleDeals.forEach(d => lines.push(`- **${d.dealName}** (${d.company}): ${d.daysSinceUpdate} days since update`))
      }
    }

    if (focus?.includes('recommend') && brain.pipelineRecommendations.length > 0) {
      lines.push('\n**Recommendations:**')
      brain.pipelineRecommendations.slice(0, 5).forEach(r =>
        lines.push(`- [${r.priority}] **${r.dealName}**: ${r.recommendation}`),
      )
    }

    if (focus?.includes('pattern') && brain.keyPatterns.length > 0) {
      lines.push('\n**Key Patterns:**')
      brain.keyPatterns.forEach(p =>
        lines.push(`- ${p.label} (${p.dealIds.length} deal${p.dealIds.length === 1 ? '' : 's'})`),
      )
    }

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// get_competitor_intel
// ─────────────────────────────────────────────────────────────────────────────

export const get_competitor_intel = {
  description: 'Get intelligence on competitors. Can retrieve a specific competitor or list all competitors in the workspace.',
  parameters: z.object({
    competitorName: z.string().optional().describe('Name of the competitor to look up. If omitted, returns all competitors.'),
  }),
  execute: async (params: { competitorName?: string }, ctx: ToolContext): Promise<ToolResult> => {
    const whereClause = params.competitorName
      ? and(eq(competitors.workspaceId, ctx.workspaceId), ilike(competitors.name, `%${params.competitorName}%`))
      : eq(competitors.workspaceId, ctx.workspaceId)

    const comps = await db
      .select()
      .from(competitors)
      .where(whereClause)
      .limit(20)

    if (comps.length === 0) {
      return {
        result: params.competitorName
          ? `No competitor found matching "${params.competitorName}".`
          : 'No competitors have been added to the workspace yet.',
      }
    }

    const lines: string[] = []
    for (const comp of comps) {
      lines.push(`## ${comp.name}`)
      if (comp.description) lines.push(comp.description)

      const strengths = (comp.strengths as string[]) ?? []
      if (strengths.length > 0) {
        lines.push('**Strengths:**')
        strengths.forEach(s => lines.push(`- ${s}`))
      }

      const weaknesses = (comp.weaknesses as string[]) ?? []
      if (weaknesses.length > 0) {
        lines.push('**Weaknesses:**')
        weaknesses.forEach(w => lines.push(`- ${w}`))
      }

      const features = (comp.keyFeatures as string[]) ?? []
      if (features.length > 0) {
        lines.push('**Key Features:**')
        features.forEach(f => lines.push(`- ${f}`))
      }

      if (comp.notes) lines.push(`**Notes:** ${comp.notes}`)
      lines.push('')
    }

    // Enrich with brain competitive patterns if available
    const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)
    if (brain?.winLossIntel?.competitorRecord?.length) {
      lines.push('## Win/Loss Record by Competitor')
      for (const rec of brain.winLossIntel.competitorRecord) {
        lines.push(`- **${rec.name}**: ${rec.wins}W / ${rec.losses}L (${rec.winRate}% win rate)`)
      }
    }

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// search_workspace
// ─────────────────────────────────────────────────────────────────────────────

export const search_workspace = {
  description: 'Search across all workspace entities (deals, competitors, case studies, product gaps) by name or title.',
  parameters: z.object({
    query: z.string().describe('Search term'),
  }),
  execute: async (params: { query: string }, ctx: ToolContext): Promise<ToolResult> => {
    const pattern = `%${params.query}%`
    const wsId = ctx.workspaceId

    // Run keyword search and semantic search in parallel
    let semanticResults: { entityId: string; entityType: string; similarity: number }[] = []
    const [deals, comps, cases, gaps] = await Promise.all([
      db.select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany, stage: dealLogs.stage })
        .from(dealLogs)
        .where(and(eq(dealLogs.workspaceId, wsId), or(ilike(dealLogs.dealName, pattern), ilike(dealLogs.prospectCompany, pattern))))
        .limit(10),
      db.select({ id: competitors.id, name: competitors.name })
        .from(competitors)
        .where(and(eq(competitors.workspaceId, wsId), ilike(competitors.name, pattern)))
        .limit(10),
      db.select({ id: caseStudies.id, customerName: caseStudies.customerName })
        .from(caseStudies)
        .where(and(eq(caseStudies.workspaceId, wsId), ilike(caseStudies.customerName, pattern)))
        .limit(10),
      db.select({ id: productGaps.id, title: productGaps.title, status: productGaps.status })
        .from(productGaps)
        .where(and(eq(productGaps.workspaceId, wsId), ilike(productGaps.title, pattern)))
        .limit(10),
      // Semantic search — non-blocking fallback (returns [] if embeddings unavailable)
      (async () => {
        try {
          const { semanticSearch } = await import('@/lib/semantic-search')
          semanticResults = await semanticSearch(wsId, params.query, { limit: 8, minSimilarity: 0.35 })
        } catch { /* non-fatal */ }
      })(),
    ])

    // Merge keyword + semantic results
    const seenIds = new Set([
      ...deals.map(d => d.id),
      ...comps.map(c => c.id),
      ...cases.map(c => c.id),
      ...gaps.map(g => g.id),
    ])

    // Collect semantic-only results (not already found by keyword)
    const semanticOnlyDeals: string[] = []
    const semanticOnlyComps: string[] = []
    const semanticOnlyCases: string[] = []
    const semanticOnlyGaps: string[] = []
    for (const sr of semanticResults) {
      if (seenIds.has(sr.entityId)) continue
      seenIds.add(sr.entityId)
      if (sr.entityType === 'deal') semanticOnlyDeals.push(sr.entityId)
      else if (sr.entityType === 'competitor') semanticOnlyComps.push(sr.entityId)
      else if (sr.entityType === 'case_study') semanticOnlyCases.push(sr.entityId)
      else if (sr.entityType === 'product_gap') semanticOnlyGaps.push(sr.entityId)
    }

    // Fetch details for semantic-only results
    const [semDeals, semComps, semCases, semGaps] = await Promise.all([
      semanticOnlyDeals.length > 0
        ? db.select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany, stage: dealLogs.stage })
            .from(dealLogs).where(and(eq(dealLogs.workspaceId, wsId), inArray(dealLogs.id, semanticOnlyDeals)))
        : Promise.resolve([]),
      semanticOnlyComps.length > 0
        ? db.select({ id: competitors.id, name: competitors.name })
            .from(competitors).where(and(eq(competitors.workspaceId, wsId), inArray(competitors.id, semanticOnlyComps)))
        : Promise.resolve([]),
      semanticOnlyCases.length > 0
        ? db.select({ id: caseStudies.id, customerName: caseStudies.customerName })
            .from(caseStudies).where(and(eq(caseStudies.workspaceId, wsId), inArray(caseStudies.id, semanticOnlyCases)))
        : Promise.resolve([]),
      semanticOnlyGaps.length > 0
        ? db.select({ id: productGaps.id, title: productGaps.title, status: productGaps.status })
            .from(productGaps).where(and(eq(productGaps.workspaceId, wsId), inArray(productGaps.id, semanticOnlyGaps)))
        : Promise.resolve([]),
    ])

    const allDeals = [...deals, ...semDeals]
    const allComps = [...comps, ...semComps]
    const allCases = [...cases, ...semCases]
    const allGaps = [...gaps, ...semGaps]
    const totalResults = allDeals.length + allComps.length + allCases.length + allGaps.length

    if (totalResults === 0) {
      return { result: `No results found for "${params.query}".` }
    }

    const lines: string[] = [`Found **${totalResults}** result${totalResults === 1 ? '' : 's'} for "${params.query}":`]

    if (allDeals.length > 0) {
      lines.push('\n**Deals:**')
      const slabel = (id: string) => ctx.stageLabels?.[id] ?? id
      allDeals.forEach(d => lines.push(`- ${d.dealName} (${d.prospectCompany}) — ${slabel(d.stage)} [ID: ${d.id}]`))
    }
    if (allComps.length > 0) {
      lines.push('\n**Competitors:**')
      allComps.forEach(c => lines.push(`- ${c.name} [ID: ${c.id}]`))
    }
    if (allCases.length > 0) {
      lines.push('\n**Case Studies:**')
      allCases.forEach(cs => lines.push(`- ${cs.customerName} [ID: ${cs.id}]`))
    }
    if (allGaps.length > 0) {
      lines.push('\n**Product Gaps:**')
      allGaps.forEach(g => lines.push(`- ${g.title} (${g.status}) [ID: ${g.id}]`))
    }

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// find_similar_deals
// ─────────────────────────────────────────────────────────────────────────────

export const find_similar_deals = {
  description: 'Find deals semantically similar to a given deal — useful for pattern matching, learning from past wins/losses, and identifying common themes. Uses AI embeddings to match deals by context, not just keywords.',
  parameters: z.object({
    dealId: z.string().describe('The UUID of the deal to find similar deals for'),
    limit: z.number().optional().describe('Max results (default 5)'),
  }),
  execute: async (params: { dealId: string; limit?: number }, ctx: ToolContext): Promise<ToolResult> => {
    try {
      const { findSimilarDeals } = await import('@/lib/semantic-search')
      const similar = await findSimilarDeals(ctx.workspaceId, params.dealId, params.limit ?? 5)

      if (similar.length === 0) {
        return { result: 'No similar deals found. Embeddings may not be generated yet — they build automatically after deal updates.' }
      }

      // Fetch deal details for similar deals
      const ids = similar.map(s => s.entityId)
      const dealRows = await db
        .select({
          id: dealLogs.id,
          dealName: dealLogs.dealName,
          prospectCompany: dealLogs.prospectCompany,
          stage: dealLogs.stage,
          dealValue: dealLogs.dealValue,
          conversionScore: dealLogs.conversionScore,
        })
        .from(dealLogs)
        .where(and(eq(dealLogs.workspaceId, ctx.workspaceId), inArray(dealLogs.id, ids)))

      const dealMap = new Map(dealRows.map(d => [d.id, d]))
      const sl = (id: string) => ctx.stageLabels?.[id] ?? id
      const fmt = (v: number) => v >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${v}`

      const lines = [`**Similar deals** (by semantic similarity):\n`]
      for (const s of similar) {
        const d = dealMap.get(s.entityId)
        if (!d) continue
        const score = d.conversionScore != null ? ` | Score: ${d.conversionScore}%` : ''
        const value = d.dealValue ? ` | ${fmt(d.dealValue)}` : ''
        lines.push(`- **${d.dealName}** (${d.prospectCompany}) — ${sl(d.stage)}${value}${score} — ${Math.round(s.similarity * 100)}% match [ID: ${d.id}]`)
      }

      return { result: lines.join('\n') }
    } catch {
      return { result: 'Semantic search is not available. Embeddings may need to be configured.' }
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// get_deal_intelligence
// ─────────────────────────────────────────────────────────────────────────────

export const get_deal_intelligence = {
  description: 'Get deep ML intelligence for a deal — win probability, score drivers, churn risk, archetype, competitive patterns, stage velocity, and predicted close date. This is the brain\'s full analysis.',
  parameters: z.object({
    dealId: z.string().describe('The UUID of the deal'),
  }),
  execute: async (params: { dealId: string }, ctx: ToolContext): Promise<ToolResult> => {
    const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)
    if (!brain) return { result: 'No workspace intelligence available yet. Log some deals first.' }

    const pred = brain.mlPredictions?.find(p => p.dealId === params.dealId)
    if (!pred) return { result: 'No ML prediction available for this deal. It may be newly created — intelligence builds after brain rebuild.' }

    const lines: string[] = []

    // Core prediction
    lines.push(`**Win Probability:** ${(pred.winProbability * 100).toFixed(0)}%${pred.compositeScore != null ? ` (composite: ${(pred.compositeScore * 100).toFixed(0)}%)` : ''}`)
    lines.push(`**Confidence:** ${pred.confidence}`)

    // Score trend history
    const dealSnap = brain.deals?.find(d => d.id === params.dealId)
    if (dealSnap?.scoreTrend && dealSnap.scoreTrend !== 'new') {
      const trendLabel = dealSnap.scoreTrend === 'improving' ? 'Improving' : dealSnap.scoreTrend === 'declining' ? 'Declining' : 'Stable'
      const arrow = dealSnap.scoreTrend === 'improving' ? '+' : dealSnap.scoreTrend === 'declining' ? '' : ''
      lines.push(`**Score Trend:** ${trendLabel} (${arrow}${dealSnap.scoreVelocity ?? 0}pts over recent period)`)
    }
    if (dealSnap?.scoreHistory && dealSnap.scoreHistory.length >= 2) {
      const recent = dealSnap.scoreHistory.slice(-5)
      lines.push(`**Score History:** ${recent.map(p => `${p.date}: ${p.score}%`).join(' → ')}`)
    }
    // Score trend alert for this deal (if any)
    const trendAlert = brain.scoreTrendAlerts?.find(a => a.dealId === params.dealId)
    if (trendAlert) {
      lines.push(`**Score Alert:** ${trendAlert.message}`)
    }

    // Score drivers
    if (pred.scoreDrivers?.length) {
      lines.push('\n**Score Drivers** (what\'s moving this score):')
      for (const d of pred.scoreDrivers) {
        const arrow = d.direction === 'positive' ? '+' : '-'
        lines.push(`  ${arrow} **${d.label}**: ${d.value?.toFixed?.(2) ?? d.value} (${d.contribution > 0 ? '+' : ''}${(d.contribution * 100).toFixed(1)}pp)`)
      }
    }

    // Churn risk
    if (pred.churnRisk != null) {
      lines.push(`\n**Churn Risk:** ${pred.churnRisk.toFixed(0)}% probability of going silent`)
      if (pred.churnDaysOverdue) lines.push(`  Days overdue for follow-up: ${pred.churnDaysOverdue}`)
    }

    // Archetype
    if (pred.archetypeId != null && brain.dealArchetypes?.length) {
      const arch = brain.dealArchetypes.find(a => a.id === pred.archetypeId)
      if (arch) {
        lines.push(`\n**Deal Archetype:** ${arch.label} (win rate: ${arch.winRate.toFixed(0)}%, ${arch.dealCount} similar deals)`)
        if (arch.winningCharacteristic) lines.push(`  Winning characteristic: ${arch.winningCharacteristic}`)
      }
    }

    // Predicted close
    if (pred.predictedDaysToClose != null) {
      lines.push(`\n**Predicted Close:** ~${pred.predictedDaysToClose} days`)
    }

    // Similar deals (KNN)
    if (pred.similarWins?.length) {
      lines.push('\n**Most Similar Wins:**')
      for (const sw of pred.similarWins.slice(0, 3)) {
        lines.push(`  - ${sw.company} (${(sw.similarity * 100).toFixed(0)}% similar)`)
      }
    }
    if (pred.similarLosses?.length) {
      lines.push('**Most Similar Losses:**')
      for (const sl of pred.similarLosses.slice(0, 3)) {
        lines.push(`  - ${sl.company} (${(sl.similarity * 100).toFixed(0)}% similar)`)
      }
    }

    // Risk flags
    if (pred.riskFlags?.length) {
      lines.push('\n**ML Risk Flags:**')
      for (const flag of pred.riskFlags) {
        lines.push(`  - ${flag}`)
      }
    }

    // Stage velocity alerts for this deal
    const stageAlerts = brain.stageVelocityIntel?.stageAlerts?.filter(a => a.dealId === params.dealId) ?? []
    if (stageAlerts.length > 0) {
      lines.push('\n**Stage Velocity Alerts:**')
      for (const alert of stageAlerts) {
        lines.push(`  [${alert.severity}] ${alert.stage}: ${alert.currentAgeDays}d in stage (expected max: ${alert.expectedMaxDays}d)`)
      }
    }

    // Deterioration alerts for this deal
    const detAlert = brain.deteriorationAlerts?.find(a => a.dealId === params.dealId)
    if (detAlert) {
      lines.push(`\n**Deterioration Warning:** ${detAlert.warning}`)
      lines.push(`  Sentiment: ${detAlert.earlySentiment.toFixed(2)} -> ${detAlert.recentSentiment.toFixed(2)} (delta: ${detAlert.delta.toFixed(2)})`)
    }

    // Competitive patterns — look up deal's competitors from dealLogs
    const dealRow = await db
      .select({ competitors: dealLogs.competitors })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, params.dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
      .limit(1)
    const dealComps = (dealRow[0]?.competitors as string[]) ?? []
    if (dealComps.length > 0 && brain.competitivePatterns?.length) {
      lines.push('\n**Competitive Intelligence:**')
      for (const compName of dealComps) {
        const pattern = brain.competitivePatterns.find(p => p.competitor?.toLowerCase() === compName?.toLowerCase())
        if (pattern) {
          lines.push(`  **vs ${compName}:** ${pattern.winRate.toFixed(0)}% win rate (${pattern.totalDeals} deals)`)
          if (pattern.topWinCondition) lines.push(`    Win condition: ${pattern.topWinCondition}`)
          if (pattern.topLossRisk) lines.push(`    Loss risk: ${pattern.topLossRisk}`)
        }
      }
    }

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// get_win_playbook
// ─────────────────────────────────────────────────────────────────────────────

export const get_win_playbook = {
  description: 'Get the workspace\'s winning patterns — what works in your deals. Includes champion effect, fastest close patterns, objection win rates, and per-competitor strategies.',
  parameters: z.object({
    competitor: z.string().optional().describe('Focus on a specific competitor'),
  }),
  execute: async (params: { competitor?: string }, ctx: ToolContext): Promise<ToolResult> => {
    const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)
    if (!brain) return { result: 'No workspace intelligence available yet.' }

    const lines: string[] = ['**Winning Playbook**']

    // Win playbook data
    if (brain.winPlaybook) {
      const wp = brain.winPlaybook

      if (wp.championPattern) {
        lines.push('\n**Champion Effect:**')
        if (wp.championPattern.winRateWithChampion != null) {
          lines.push(`  With champion: ${wp.championPattern.winRateWithChampion.toFixed(0)}% win rate`)
        }
        if (wp.championPattern.winRateNoChampion != null) {
          lines.push(`  Without champion: ${wp.championPattern.winRateNoChampion.toFixed(0)}% win rate`)
        }
        if (wp.championPattern.championLift != null) {
          lines.push(`  Champion lift: +${wp.championPattern.championLift.toFixed(0)}pp`)
        }
        lines.push(`  Sample size: ${wp.championPattern.sampleSize} deals`)
      }

      if (wp.fastestClosePattern) {
        lines.push('\n**Fastest Close Pattern:**')
        lines.push(`  Avg days to close: ${wp.fastestClosePattern.avgDaysToClose}`)
        lines.push(`  Sample size: ${wp.fastestClosePattern.sampleSize} deals`)
        if (wp.fastestClosePattern.commonSignals?.length) {
          lines.push(`  Common signals: ${wp.fastestClosePattern.commonSignals.join(', ')}`)
        }
      }

      if (wp.topObjectionWinPatterns?.length) {
        lines.push('\n**How We Beat Objections:**')
        for (const p of wp.topObjectionWinPatterns) {
          lines.push(`  - **${p.theme}**: ${p.winRateWithTheme.toFixed(0)}% win rate (${p.winsWithTheme} wins)`)
          if (p.howBeaten) lines.push(`    How beaten: ${p.howBeaten}`)
        }
      }

      // Per-competitor win conditions from playbook
      if (params.competitor && wp.perCompetitorWinCondition?.length) {
        const match = wp.perCompetitorWinCondition.find(c =>
          c.competitor?.toLowerCase().includes(params.competitor!.toLowerCase())
        )
        if (match) {
          lines.push(`\n**vs ${match.competitor} (Playbook):**`)
          lines.push(`  Win rate: ${match.winRate.toFixed(0)}%`)
          lines.push(`  Win condition: ${match.winCondition}`)
          lines.push(`  Sample size: ${match.sampleSize} deals`)
        }
      }
    }

    // Objection win map (broader dataset)
    if (brain.objectionWinMap?.length) {
      lines.push('\n**Objection Win Rates** (when we face these objections):')
      for (const obj of brain.objectionWinMap) {
        const globalNote = obj.globalWinRate != null ? ` (industry: ${obj.globalWinRate.toFixed(0)}%)` : ''
        lines.push(`  - ${obj.theme}: ${obj.winRateWithTheme.toFixed(0)}% win rate (${obj.dealsWithTheme} deals)${globalNote}`)
      }
    }

    // Conditional objection model (champion lift per theme)
    if (brain.objectionConditionalWins?.length) {
      lines.push('\n**Champion Lift by Objection:**')
      for (const oc of brain.objectionConditionalWins) {
        if (oc.championLiftAvg != null) {
          lines.push(`  - ${oc.theme}: +${oc.championLiftAvg.toFixed(0)}pp with champion (${oc.dealsWithTheme} deals)`)
        }
      }
    }

    // Competitor-specific patterns from ML
    if (params.competitor && brain.competitivePatterns?.length) {
      const pattern = brain.competitivePatterns.find(p =>
        p.competitor?.toLowerCase().includes(params.competitor!.toLowerCase())
      )
      if (pattern) {
        lines.push(`\n**vs ${pattern.competitor} (ML Pattern):**`)
        lines.push(`  Win rate: ${pattern.winRate.toFixed(0)}% (${pattern.totalDeals} deals)`)
        if (pattern.topWinCondition) lines.push(`  Win condition: ${pattern.topWinCondition}`)
        if (pattern.topLossRisk) lines.push(`  Loss risk: ${pattern.topLossRisk}`)
      }
    } else if (brain.competitivePatterns?.length) {
      lines.push('\n**Competitor Records (ML):**')
      for (const cp of brain.competitivePatterns.slice(0, 8)) {
        lines.push(`  - vs ${cp.competitor}: ${cp.winRate.toFixed(0)}% win rate (${cp.totalDeals} deals)`)
      }
    }

    // Collateral effectiveness
    if (brain.collateralEffectiveness?.length) {
      lines.push('\n**Collateral Impact on Win Rate:**')
      for (const ce of brain.collateralEffectiveness) {
        lines.push(`  - ${ce.type}: ${ce.winRate.toFixed(0)}% win rate when used (${ce.totalUsed} deals)`)
      }
    }

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// get_rep_performance
// ─────────────────────────────────────────────────────────────────────────────

export const get_rep_performance = {
  description: 'Get sales rep performance analytics — win rates, activity levels, behavioural patterns. Helps identify coaching opportunities.',
  parameters: z.object({
    repId: z.string().optional().describe('Focus on a specific rep by user ID'),
  }),
  execute: async (params: { repId?: string }, ctx: ToolContext): Promise<ToolResult> => {
    const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)
    if (!brain?.repIntel?.length) return { result: 'No rep performance data available yet. Need closed deals to analyse patterns.' }

    const lines: string[] = ['**Rep Performance Analytics**']

    const reps = params.repId
      ? brain.repIntel.filter(r => r.userId === params.repId)
      : brain.repIntel

    if (reps.length === 0) return { result: `No rep data found${params.repId ? ` for user ${params.repId}` : ''}.` }

    for (const rep of reps) {
      lines.push(`\n**${rep.userId}**`)
      lines.push(`  Win rate: ${rep.winRate.toFixed(0)}% (${rep.wonDeals}W / ${rep.closedDeals} closed, ${rep.totalDeals} total)`)
      lines.push(`  Todo completion: ${rep.avgTodoCompletionRate.toFixed(0)}%`)
      lines.push(`  Next-step coverage: ${rep.dealsWithNextStepPct.toFixed(0)}%`)
      lines.push(`  Avg days since last note: ${rep.avgDaysSinceLastNote.toFixed(0)}`)
    }

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// get_pipeline_forecast
// ─────────────────────────────────────────────────────────────────────────────

export const get_pipeline_forecast = {
  description: 'Get ML-powered pipeline forecast — probability-weighted revenue, best case scenarios, risk-adjusted predictions by month, pipeline health index, and trend analysis.',
  parameters: z.object({}),
  execute: async (_params: Record<string, never>, ctx: ToolContext): Promise<ToolResult> => {
    const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)
    if (!brain) return { result: 'No workspace intelligence available yet.' }

    const lines: string[] = ['**Pipeline Forecast**']

    // Pipeline snapshot
    lines.push(`\nActive pipeline: ${brain.pipeline.totalActive} deals, $${brain.pipeline.totalValue.toLocaleString()}`)
    if (brain.pipeline.avgConversionScore != null) {
      lines.push(`Avg conversion score: ${brain.pipeline.avgConversionScore}%`)
    }

    // Weighted forecast from dealVelocity
    if (brain.dealVelocity) {
      lines.push(`\n**Weighted Forecast:** $${brain.dealVelocity.weightedForecast.toLocaleString()} (${brain.dealVelocity.forecastDealCount} deals)`)
      if (brain.dealVelocity.avgDaysToClose > 0) {
        lines.push(`Avg days to close: ${brain.dealVelocity.avgDaysToClose}`)
      }
    }

    // Revenue forecasts by month
    if (brain.revenueForecasts?.length) {
      lines.push('\n**Monthly Forecast (probability-weighted):**')
      for (const f of brain.revenueForecasts) {
        lines.push(`  ${f.month}: $${f.expectedRevenue.toLocaleString()} expected | $${f.bestCase.toLocaleString()} best case (${f.dealCount} deals, ${f.avgConfidence.toFixed(0)}% avg confidence)`)
      }
    }

    // ML trends
    if (brain.mlTrends) {
      const t = brain.mlTrends
      lines.push('\n**Trends:**')
      if (t.winRate) {
        lines.push(`  Win rate: ${t.winRate.direction} (${t.winRate.slopePctPerMonth > 0 ? '+' : ''}${t.winRate.slopePctPerMonth.toFixed(1)}%/mo, recent: ${t.winRate.recentPct.toFixed(0)}%, prior: ${t.winRate.priorPct.toFixed(0)}%)`)
      }
      if (t.dealVelocity) {
        lines.push(`  Deal velocity: ${t.dealVelocity.direction} (recent: ${t.dealVelocity.recentAvgDays.toFixed(0)}d, prior: ${t.dealVelocity.priorAvgDays.toFixed(0)}d)`)
      }
      if (t.competitorThreats?.length) {
        lines.push('  Competitor threats:')
        for (const ct of t.competitorThreats) {
          lines.push(`    - ${ct.name}: ${ct.direction} (recent: ${ct.recentWinRatePct.toFixed(0)}%, all-time: ${ct.allTimeWinRatePct.toFixed(0)}%)`)
        }
      }
    }

    // Pipeline health
    if (brain.pipelineHealthIndex) {
      const phi = brain.pipelineHealthIndex
      lines.push(`\n**Pipeline Health Index:** ${phi.score.toFixed(0)}/100 (${phi.interpretation})`)
      lines.push(`  Stage depth: ${phi.stageDepth.toFixed(0)} | Velocity: ${phi.velocityHealth.toFixed(0)} | Conversion: ${phi.conversionConfidence.toFixed(0)} | Momentum: ${phi.momentumScore.toFixed(0)}`)
      if (phi.keyInsight) lines.push(`  Insight: ${phi.keyInsight}`)
    }

    // Stage velocity overview
    if (brain.stageVelocityIntel) {
      const sv = brain.stageVelocityIntel
      lines.push(`\n**Stage Velocity:** Median ${sv.medianDaysToClose}d to close (p75: ${sv.p75DaysToClose}d)`)
      if (sv.stageAlerts?.length) {
        lines.push(`  ${sv.stageAlerts.length} deal(s) stalling:`)
        for (const a of sv.stageAlerts.slice(0, 5)) {
          lines.push(`    [${a.severity}] ${a.company}: ${a.currentAgeDays}d in ${a.stage} (max expected: ${a.expectedMaxDays}d)`)
        }
      }
    }

    // Score trends
    const scoreTrends = brain.scoreTrendAlerts ?? []
    if (scoreTrends.length > 0) {
      const declining = scoreTrends.filter(t => t.trend === 'declining')
      const improving = scoreTrends.filter(t => t.trend === 'improving')
      lines.push('\n**Score Trends:**')
      if (declining.length > 0) {
        lines.push(`  ${declining.length} deal(s) declining:`)
        for (const d of declining.slice(0, 3)) {
          lines.push(`    - ${d.dealName}: ${d.priorScore}% -> ${d.currentScore}% (${d.delta}pts)`)
        }
      }
      if (improving.length > 0) {
        lines.push(`  ${improving.length} deal(s) improving:`)
        for (const d of improving.slice(0, 3)) {
          lines.push(`    + ${d.dealName}: ${d.priorScore}% -> ${d.currentScore}% (+${d.delta}pts)`)
        }
      }
    }

    // Global benchmarks
    if (brain.globalPrior) {
      lines.push(`\n**Industry Benchmark:** ${brain.globalPrior.globalWinRate.toFixed(0)}% win rate (${brain.globalPrior.trainingSize} deals in pool)`)
      if (brain.globalPrior.usingPrior) {
        lines.push(`  Blending: ${brain.globalPrior.localWeight}% local / ${(100 - brain.globalPrior.localWeight)}% global`)
      }
    }

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// get_workspace_overview
// ─────────────────────────────────────────────────────────────────────────────

export const get_workspace_overview = {
  description: 'Get a full workspace health snapshot including pipeline stats, deal intelligence, and brain insights.',
  parameters: z.object({}),
  execute: async (_params: Record<string, never>, ctx: ToolContext): Promise<ToolResult> => {
    const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)

    if (!brain) {
      return { result: 'No workspace data available yet. Add deals, competitors, and case studies to build intelligence.' }
    }

    const lines: string[] = ['# Workspace Health Snapshot']

    // Pipeline summary
    lines.push(`\n## Pipeline`)
    lines.push(`- Active deals: ${brain.pipeline.totalActive}`)
    lines.push(`- Total value: $${brain.pipeline.totalValue.toLocaleString()}`)
    if (brain.pipeline.avgConversionScore != null) {
      lines.push(`- Avg score: ${brain.pipeline.avgConversionScore}%`)
    }

    // Win/loss
    if (brain.winLossIntel) {
      lines.push(`\n## Win/Loss`)
      lines.push(`- Win rate: ${brain.winLossIntel.winRate}%`)
      lines.push(`- Record: ${brain.winLossIntel.winCount}W / ${brain.winLossIntel.lossCount}L`)
      if (brain.winLossIntel.avgDaysToClose > 0) lines.push(`- Avg cycle: ${brain.winLossIntel.avgDaysToClose} days`)
    }

    // Forecast
    if (brain.dealVelocity) {
      lines.push(`\n## Forecast`)
      lines.push(`- Weighted: $${brain.dealVelocity.weightedForecast.toLocaleString()}`)
    }

    // Pipeline health
    if (brain.pipelineHealthIndex) {
      const phi = brain.pipelineHealthIndex as any
      if (phi.overall != null) lines.push(`\n## Pipeline Health Index: ${phi.overall}/100`)
    }

    // Urgent items
    if (brain.urgentDeals.length > 0) {
      lines.push(`\n## Urgent (${brain.urgentDeals.length})`)
      brain.urgentDeals.slice(0, 3).forEach(d =>
        lines.push(`- **${d.dealName}**: ${d.reason}`),
      )
    }

    // Stale deals
    if (brain.staleDeals.length > 0) {
      lines.push(`\n## Stale (${brain.staleDeals.length})`)
      brain.staleDeals.slice(0, 3).forEach(d =>
        lines.push(`- **${d.dealName}**: ${d.daysSinceUpdate}d inactive`),
      )
    }

    // Top risks
    if (brain.topRisks.length > 0) {
      lines.push(`\n## Top Risks`)
      brain.topRisks.slice(0, 5).forEach(r => lines.push(`- ${r}`))
    }

    // Recommendations
    if (brain.pipelineRecommendations.length > 0) {
      lines.push(`\n## Top Recommendations`)
      brain.pipelineRecommendations.slice(0, 3).forEach(r =>
        lines.push(`- [${r.priority}] **${r.dealName}**: ${r.recommendation}`),
      )
    }

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// get_deal_score_history
// ─────────────────────────────────────────────────────────────────────────────

export const get_deal_score_history = {
  description: 'Get the full score history timeline for a deal — shows how the deal\'s conversion score has changed over time. Useful for understanding momentum, identifying inflection points, and spotting declining deals.',
  parameters: z.object({
    dealId: z.string().describe('The UUID of the deal'),
  }),
  execute: async (params: { dealId: string }, ctx: ToolContext): Promise<ToolResult> => {
    const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)
    if (!brain) return { result: 'No workspace intelligence available yet.' }

    const deal = brain.deals?.find(d => d.id === params.dealId)
    if (!deal) return { result: 'Deal not found in the brain.' }

    const lines: string[] = [`**Score History for ${deal.name}** (${deal.company})`]
    lines.push(`Current Stage: ${deal.stage} | Current Score: ${deal.conversionScore ?? 'N/A'}%`)

    if (!deal.scoreHistory || deal.scoreHistory.length === 0) {
      lines.push('\nNo score history available yet. History builds as the brain is rebuilt after deal updates.')
      return { result: lines.join('\n') }
    }

    // Trend summary
    if (deal.scoreTrend && deal.scoreTrend !== 'new') {
      const arrow = deal.scoreTrend === 'improving' ? 'Trending UP' : deal.scoreTrend === 'declining' ? 'Trending DOWN' : 'Stable'
      lines.push(`**Trend:** ${arrow} (${deal.scoreVelocity != null && deal.scoreVelocity > 0 ? '+' : ''}${deal.scoreVelocity ?? 0}pts over recent period)`)
    }

    // Full timeline
    lines.push('\n**Timeline:**')
    let prevScore: number | null = null
    for (const pt of deal.scoreHistory) {
      const delta = prevScore !== null ? pt.score - prevScore : 0
      const deltaStr = prevScore !== null ? ` (${delta > 0 ? '+' : ''}${delta})` : ''
      lines.push(`  ${pt.date}: **${pt.score}%**${deltaStr} — ${pt.stage}`)
      prevScore = pt.score
    }

    // Overall change
    if (deal.scoreHistory.length >= 2) {
      const first = deal.scoreHistory[0]
      const last = deal.scoreHistory[deal.scoreHistory.length - 1]
      const totalDelta = last.score - first.score
      const totalDays = Math.round((new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000)
      lines.push(`\n**Overall:** ${first.score}% → ${last.score}% (${totalDelta > 0 ? '+' : ''}${totalDelta}pts over ${totalDays}d)`)
    }

    // Alert from brain if any
    const alert = brain.scoreTrendAlerts?.find(a => a.dealId === params.dealId)
    if (alert) {
      lines.push(`\n**Alert:** ${alert.message}`)
    }

    return { result: lines.join('\n') }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// get_score_trends
// ─────────────────────────────────────────────────────────────────────────────

export const get_score_trends = {
  description: 'Get all deal score trends across the pipeline — shows which deals are improving, declining, or stable. Useful for pipeline health checks and identifying deals that need attention.',
  parameters: z.object({}),
  execute: async (_params: Record<string, never>, ctx: ToolContext): Promise<ToolResult> => {
    const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)
    if (!brain) return { result: 'No workspace intelligence available yet.' }

    const lines: string[] = ['**Pipeline Score Trends**\n']

    // Score trend alerts (significant changes)
    const alerts = brain.scoreTrendAlerts ?? []
    if (alerts.length > 0) {
      const improving = alerts.filter(a => a.trend === 'improving')
      const declining = alerts.filter(a => a.trend === 'declining')

      if (declining.length > 0) {
        lines.push('**Declining Deals (needs attention):**')
        for (const a of declining) {
          lines.push(`  - **${a.dealName}** (${a.company}): ${a.priorScore}% -> ${a.currentScore}% (${a.delta}pts over ${a.periodDays}d)`)
        }
      }
      if (improving.length > 0) {
        lines.push(`\n**Improving Deals:**`)
        for (const a of improving) {
          lines.push(`  - **${a.dealName}** (${a.company}): ${a.priorScore}% -> ${a.currentScore}% (+${a.delta}pts over ${a.periodDays}d)`)
        }
      }
    }

    // All deals with trends
    const dealsWithHistory = (brain.deals ?? []).filter(d =>
      d.scoreHistory && d.scoreHistory.length >= 2 &&
      d.stage !== 'closed_won' && d.stage !== 'closed_lost'
    )
    if (dealsWithHistory.length > 0 && alerts.length === 0) {
      lines.push('All deals are currently stable (no significant score changes detected).')
    }

    // Summary stats
    const allOpen = (brain.deals ?? []).filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    const improvingCount = allOpen.filter(d => d.scoreTrend === 'improving').length
    const decliningCount = allOpen.filter(d => d.scoreTrend === 'declining').length
    const stableCount = allOpen.filter(d => d.scoreTrend === 'stable').length
    const newCount = allOpen.filter(d => d.scoreTrend === 'new' || !d.scoreTrend).length

    lines.push(`\n**Summary:** ${improvingCount} improving | ${decliningCount} declining | ${stableCount} stable | ${newCount} awaiting history`)

    return { result: lines.join('\n') }
  },
}
