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

    // Stage breakdown
    const stages = brain.pipeline.stageBreakdown
    if (Object.keys(stages).length > 0) {
      lines.push('\n**Stage Breakdown:**')
      for (const [stage, count] of Object.entries(stages)) {
        lines.push(`- ${stage}: ${count} deal${count === 1 ? '' : 's'}`)
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
      deals.forEach(d => lines.push(`- ${d.dealName} (${d.prospectCompany}) — ${d.stage} [ID: ${d.id}]`))
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
