import { z } from 'zod'
import { eq, and, or, ilike } from 'drizzle-orm'
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
    ])

    const totalResults = deals.length + comps.length + cases.length + gaps.length

    if (totalResults === 0) {
      return { result: `No results found for "${params.query}".` }
    }

    const lines: string[] = [`Found **${totalResults}** result${totalResults === 1 ? '' : 's'} for "${params.query}":`]

    if (deals.length > 0) {
      lines.push('\n**Deals:**')
      const slabel = (id: string) => ctx.stageLabels?.[id] ?? id
      deals.forEach(d => lines.push(`- ${d.dealName} (${d.prospectCompany}) — ${slabel(d.stage)} [ID: ${d.id}]`))
    }
    if (comps.length > 0) {
      lines.push('\n**Competitors:**')
      comps.forEach(c => lines.push(`- ${c.name} [ID: ${c.id}]`))
    }
    if (cases.length > 0) {
      lines.push('\n**Case Studies:**')
      cases.forEach(cs => lines.push(`- ${cs.customerName} [ID: ${cs.id}]`))
    }
    if (gaps.length > 0) {
      lines.push('\n**Product Gaps:**')
      gaps.forEach(g => lines.push(`- ${g.title} (${g.status}) [ID: ${g.id}]`))
    }

    return { result: lines.join('\n') }
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
