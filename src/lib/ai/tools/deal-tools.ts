import { z } from 'zod'
import { eq, and, or, ilike, sql } from 'drizzle-orm'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { dealLogs, productGaps, companyProfiles } from '@/lib/db/schema'
import { anthropic } from '@/lib/ai/client'
import { rebuildWorkspaceBrain, getWorkspaceBrain } from '@/lib/workspace-brain'
import { extractTextSignals, heuristicScore } from '@/lib/text-signals'
import { computeCompositeScore } from '@/lib/deal-ml'
import type { ToolContext, ToolResult } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Shared constants
// ─────────────────────────────────────────────────────────────────────────────

const DEAL_STAGES = [
  'prospecting',
  'qualification',
  'discovery',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const

const stageEnum = z.string().describe('Deal stage: prospecting, qualification, discovery, proposal, negotiation, closed_won, closed_lost, or any custom stage ID')

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDealSummary(deal: any, stageLabels?: Record<string, string>): string {
  const lines = [
    `**${deal.dealName}** (${deal.prospectCompany}) — ID: \`${deal.id}\``,
    `- Stage: ${stageLabels?.[deal.stage] ?? deal.stage}`,
  ]
  if (deal.dealValue != null) lines.push(`- Value: $${deal.dealValue.toLocaleString()}`)
  if (deal.conversionScore != null) lines.push(`- Score: ${deal.conversionScore}%`)
  if (deal.closeDate) lines.push(`- Close date: ${new Date(deal.closeDate).toLocaleDateString()}`)
  if (deal.aiSummary) lines.push(`- Summary: ${deal.aiSummary}`)
  return lines.join('\n')
}

// UUID v4 pattern
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function formatDealDetailed(deal: any, stageLabels?: Record<string, string>): string {
  const lines = [
    `# ${deal.dealName}`,
    `**Company:** ${deal.prospectCompany}`,
    `**Stage:** ${stageLabels?.[deal.stage] ?? deal.stage}`,
  ]
  if (deal.dealValue != null) lines.push(`**Value:** $${deal.dealValue.toLocaleString()}`)
  if (deal.conversionScore != null) lines.push(`**Conversion Score:** ${deal.conversionScore}%`)
  if (deal.prospectName) lines.push(`**Contact:** ${deal.prospectName}${deal.prospectTitle ? ` (${deal.prospectTitle})` : ''}`)
  if (deal.closeDate) lines.push(`**Close Date:** ${new Date(deal.closeDate).toLocaleDateString()}`)
  if (deal.nextSteps) lines.push(`**Next Steps:** ${deal.nextSteps}`)
  if (deal.aiSummary) lines.push(`\n**AI Summary:** ${deal.aiSummary}`)
  if (deal.notes) lines.push(`\n**Notes:** ${deal.notes}`)

  const risks = (deal.dealRisks as string[]) ?? []
  if (risks.length > 0) {
    lines.push('\n**Risks:**')
    risks.forEach((r: string) => lines.push(`- ${r}`))
  }

  const todos = (deal.todos as any[]) ?? []
  const openTodos = todos.filter((t: any) => !t.done)
  const doneTodos = todos.filter((t: any) => t.done)
  if (openTodos.length > 0) {
    lines.push('\n**Open Action Items:**')
    openTodos.forEach((t: any) => lines.push(`- [ ] ${t.text}`))
  }
  if (doneTodos.length > 0) {
    lines.push('\n**Completed Items:**')
    doneTodos.forEach((t: any) => lines.push(`- [x] ${t.text}`))
  }

  const contacts = (deal.contacts as any[]) ?? []
  if (contacts.length > 0) {
    lines.push('\n**Contacts:**')
    contacts.forEach((c: any) => {
      const parts = [c.name]
      if (c.title) parts.push(c.title)
      if (c.email) parts.push(c.email)
      lines.push(`- ${parts.join(' | ')}`)
    })
  }

  const comps = (deal.competitors as string[]) ?? []
  if (comps.length > 0) {
    lines.push(`\n**Competitors:** ${comps.join(', ')}`)
  }

  if (deal.lostReason) lines.push(`\n**Lost Reason:** ${deal.lostReason}`)

  // Project plan
  const projectPlan = deal.projectPlan as any
  if (projectPlan?.phases?.length > 0) {
    lines.push('\n**Project Plan:**')
    for (const phase of projectPlan.phases) {
      const tasks = phase.tasks ?? []
      const done = tasks.filter((t: any) => t.status === 'complete').length
      lines.push(`\n  **${phase.name}** (${done}/${tasks.length} complete)${phase.targetDate ? ` — due ${phase.targetDate}` : ''}`)
      if (phase.description) lines.push(`  _${phase.description}_`)
      for (const t of tasks) {
        const status = t.status === 'complete' ? '✅' : t.status === 'in_progress' ? '🔄' : '⬜'
        const ownerStr = t.owner ? ` [${t.owner}]` : ''
        const dueStr = t.dueDate ? ` (due ${t.dueDate})` : ''
        lines.push(`  ${status} ${t.text}${ownerStr}${dueStr}`)
        if (t.notes) lines.push(`    _Note: ${t.notes}_`)
      }
    }
  }

  // Success criteria
  const criteria = (deal.successCriteriaTodos as any[]) ?? []
  if (criteria.length > 0) {
    const achieved = criteria.filter((c: any) => c.achieved).length
    lines.push(`\n**Success Criteria** (${achieved}/${criteria.length} met):`)
    const categories = [...new Set(criteria.map((c: any) => c.category ?? 'General'))]
    for (const cat of categories) {
      lines.push(`\n  _${cat}:_`)
      for (const c of criteria.filter((c: any) => (c.category ?? 'General') === cat)) {
        lines.push(`  ${c.achieved ? '✅' : '⬜'} ${c.text}`)
        if (c.note) lines.push(`    _Note: ${c.note}_`)
      }
    }
  }

  lines.push(`\n*Created: ${new Date(deal.createdAt).toLocaleDateString()} | Updated: ${new Date(deal.updatedAt).toLocaleDateString()}*`)
  return lines.join('\n')
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
}

// ─────────────────────────────────────────────────────────────────────────────
// search_deals
// ─────────────────────────────────────────────────────────────────────────────

export const search_deals = {
  description: 'Search for deals by name, company, or stage. Returns a concise list of matching deals with key metrics.',
  parameters: z.object({
    query: z.string().optional().describe('Search term to match against deal name or company'),
    stage: stageEnum.optional().describe('Filter by deal stage'),
  }),
  execute: async (params: { query?: string; stage?: string }, ctx: ToolContext): Promise<ToolResult> => {
    const conditions = [eq(dealLogs.workspaceId, ctx.workspaceId)]

    if (params.stage) {
      conditions.push(eq(dealLogs.stage, params.stage as any))
    }

    if (params.query) {
      const pattern = `%${params.query}%`
      conditions.push(
        or(
          ilike(dealLogs.dealName, pattern),
          ilike(dealLogs.prospectCompany, pattern),
        )!,
      )
    }

    const deals = await db
      .select()
      .from(dealLogs)
      .where(and(...conditions))
      .orderBy(dealLogs.updatedAt)
      .limit(20)

    if (deals.length === 0) {
      return { result: 'No deals found matching your search criteria.' }
    }

    const summaries = deals.map(d => formatDealSummary(d, ctx.stageLabels))
    return {
      result: `Found **${deals.length}** deal${deals.length === 1 ? '' : 's'}:\n\n${summaries.join('\n\n')}`,
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// get_deal_details
// ─────────────────────────────────────────────────────────────────────────────

export const get_deal_details = {
  description: 'Get full details of a specific deal. Accepts a UUID deal ID OR a deal name/company name — will auto-search if a non-UUID is provided.',
  parameters: z.object({
    dealId: z.string().describe('The UUID of the deal, OR a deal name / company name to search for'),
  }),
  execute: async (params: { dealId: string }, ctx: ToolContext): Promise<ToolResult> => {
    let deal: any = null

    // If it looks like a UUID, do a direct lookup
    if (UUID_RE.test(params.dealId)) {
      const [row] = await db
        .select()
        .from(dealLogs)
        .where(and(eq(dealLogs.id, params.dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
        .limit(1)
      deal = row
    }

    // If no UUID match (or it wasn't a UUID), fall back to name/company search
    if (!deal) {
      const pattern = `%${params.dealId}%`
      const matches = await db
        .select()
        .from(dealLogs)
        .where(and(
          eq(dealLogs.workspaceId, ctx.workspaceId),
          or(
            ilike(dealLogs.dealName, pattern),
            ilike(dealLogs.prospectCompany, pattern),
          ),
        ))
        .orderBy(dealLogs.updatedAt)
        .limit(5)

      if (matches.length === 1) {
        deal = matches[0]
      } else if (matches.length > 1) {
        // Multiple matches — return summaries so the agent can pick
        const summaries = matches.map(d => formatDealSummary(d, ctx.stageLabels))
        return {
          result: `Found **${matches.length}** deals matching "${params.dealId}". Which one?\n\n${summaries.join('\n\n')}`,
        }
      }
    }

    if (!deal) {
      return { result: `Deal "${params.dealId}" not found. Try searching with a different name.` }
    }

    return { result: formatDealDetailed(deal, ctx.stageLabels) }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// create_deal
// ─────────────────────────────────────────────────────────────────────────────

export const create_deal = {
  description: 'Create a new deal in the pipeline. For large deal imports with contacts, notes, todos, risks, etc., use import_deal instead — it handles everything in one operation.',
  parameters: z.object({
    dealName: z.string().describe('Name of the deal'),
    prospectCompany: z.string().describe('Company name of the prospect'),
    prospectName: z.string().optional().describe('Name of the main contact'),
    prospectTitle: z.string().optional().describe('Title/role of the main contact'),
    dealValue: z.number().optional().describe('Estimated deal value in dollars'),
    stage: stageEnum.optional().describe('Initial deal stage (defaults to prospecting)'),
    competitors: z.array(z.string()).optional().describe('List of competitor names'),
    notes: z.string().optional().describe('Initial notes for the deal'),
  }),
  execute: async (
    params: {
      dealName: string
      prospectCompany: string
      prospectName?: string
      prospectTitle?: string
      dealValue?: number
      stage?: string
      competitors?: string[]
      notes?: string
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const [created] = await db
      .insert(dealLogs)
      .values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        dealName: params.dealName,
        prospectCompany: params.prospectCompany,
        prospectName: params.prospectName ?? null,
        prospectTitle: params.prospectTitle ?? null,
        dealValue: params.dealValue ?? null,
        stage: (params.stage as any) ?? 'prospecting',
        competitors: params.competitors ?? [],
        notes: params.notes ?? null,
      })
      .returning()

    after(async () => {
      try { await rebuildWorkspaceBrain(ctx.workspaceId) } catch { /* non-fatal */ }
    })

    return {
      result: `Deal **${created.dealName}** with ${created.prospectCompany} created successfully in **${created.stage}** stage.${params.dealValue ? ` Value: $${params.dealValue.toLocaleString()}.` : ''}`,
      actions: [{
        type: 'deal_created',
        dealId: created.id,
        dealName: created.dealName,
        company: created.prospectCompany,
      }],
      uiHint: 'refresh_deals',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// import_deal  (single-operation deal creation with all data)
// ─────────────────────────────────────────────────────────────────────────────

export const import_deal = {
  description: 'Import a complete deal with ALL data in one operation — contacts, notes, todos, risks, summary, next steps, success criteria, competitors, project plan, and more. Use this when the user pastes a large deal description, interaction history, or CRM export. This is the preferred tool for creating deals with rich context.',
  parameters: z.object({
    dealName: z.string().describe('Name of the deal'),
    prospectCompany: z.string().describe('Company name'),
    stage: stageEnum.optional().describe('Deal stage — infer from context (e.g., "proposal" if proposals were sent)'),
    dealValue: z.number().optional().describe('Deal value in dollars'),
    closeDate: z.string().optional().describe('Expected close date (ISO format)'),
    prospectName: z.string().optional().describe('Primary contact name'),
    prospectTitle: z.string().optional().describe('Primary contact title'),
    contacts: z.array(z.object({
      name: z.string(),
      title: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      role: z.string().optional().describe('Role in deal: Champion, Decision Maker, Technical Evaluator, Internal Sales Rep, etc.'),
    })).optional().describe('All contacts involved in the deal'),
    competitors: z.array(z.string()).optional().describe('Competitor names being evaluated'),
    notes: z.string().optional().describe('Deal notes — preserve the user\'s exact wording and detail'),
    meetingHistory: z.array(z.object({
      date: z.string().describe('Date of the interaction (e.g. "Oct 23, 2025", "3 Dec 2025")'),
      content: z.string().describe('What happened — preserve exact detail'),
    })).optional().describe('Chronological interaction history — each entry is a dated event. Parse ALL dates from the source text.'),
    aiSummary: z.string().optional().describe('Comprehensive deal summary preserving all key details: names, dates, decisions, requirements, history'),
    nextSteps: z.string().optional().describe('Current next steps'),
    dealRisks: z.array(z.string()).optional().describe('Deal-closing risks (NOT product gaps)'),
    todos: z.array(z.string()).optional().describe('Action items — preserve exact wording'),
    successCriteria: z.array(z.object({
      text: z.string().describe('Exact criterion text'),
      category: z.string().optional().describe('Category: Security, Integration, Reporting, etc.'),
    })).optional().describe('Success criteria / requirements'),
    projectPlan: z.object({
      phases: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        targetDate: z.string().optional(),
        tasks: z.array(z.object({
          text: z.string(),
          status: z.string().optional().describe('pending, in_progress, or complete'),
          owner: z.string().optional(),
        })).optional(),
      })),
    }).optional().describe('Project plan with phases and tasks'),
    dealType: z.string().optional().describe('one_off or recurring'),
    recurringInterval: z.string().optional().describe('monthly, quarterly, or annual'),
  }),
  execute: async (
    params: {
      dealName: string
      prospectCompany: string
      stage?: string
      dealValue?: number
      closeDate?: string
      prospectName?: string
      prospectTitle?: string
      contacts?: { name: string; title?: string; email?: string; phone?: string; role?: string }[]
      competitors?: string[]
      notes?: string
      meetingHistory?: { date: string; content: string }[]
      aiSummary?: string
      nextSteps?: string
      dealRisks?: string[]
      todos?: string[]
      successCriteria?: { text: string; category?: string }[]
      projectPlan?: { phases: { name: string; description?: string; targetDate?: string; tasks?: { text: string; status?: string; owner?: string }[] }[] }
      dealType?: string
      recurringInterval?: string
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    // Build contacts array with IDs
    const contacts = (params.contacts ?? []).map(c => ({
      id: crypto.randomUUID(),
      name: c.name,
      ...(c.title ? { title: c.title } : {}),
      ...(c.email ? { email: c.email } : {}),
      ...(c.phone ? { phone: c.phone } : {}),
      ...(c.role ? { role: c.role } : {}),
    }))

    // Build todos with IDs
    const todos = (params.todos ?? []).map(text => ({
      id: crypto.randomUUID(),
      text,
      done: false,
      createdAt: new Date().toISOString(),
    }))

    // Build success criteria with IDs
    const successCriteriaTodos = (params.successCriteria ?? []).map(c => ({
      id: crypto.randomUUID(),
      text: c.text,
      category: c.category ?? 'General',
      achieved: false,
      note: '',
      createdAt: new Date().toISOString(),
    }))

    // Build project plan
    const projectPlan = params.projectPlan ? {
      phases: params.projectPlan.phases.map(phase => ({
        name: phase.name,
        description: phase.description ?? '',
        targetDate: phase.targetDate ?? null,
        tasks: (phase.tasks ?? []).map(t => ({
          id: crypto.randomUUID(),
          text: t.text,
          status: t.status ?? 'pending',
          owner: t.owner ?? null,
          dueDate: null,
          notes: '',
          createdAt: new Date().toISOString(),
        })),
      })),
    } : null

    // Parse close date
    let closeDate: Date | null = null
    if (params.closeDate) {
      try { closeDate = new Date(params.closeDate) } catch { /* ignore invalid dates */ }
    }

    // Single DB insert with everything
    const [created] = await db
      .insert(dealLogs)
      .values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        dealName: params.dealName,
        prospectCompany: params.prospectCompany,
        prospectName: params.prospectName ?? null,
        prospectTitle: params.prospectTitle ?? null,
        dealValue: params.dealValue ?? null,
        stage: (params.stage as any) ?? 'prospecting',
        closeDate,
        competitors: params.competitors ?? [],
        contacts,
        notes: params.notes ?? null,
        meetingNotes: params.meetingHistory?.length
          ? params.meetingHistory.map(e => `[${e.date}] ${e.content}`).join('\n---\n')
          : null,
        aiSummary: params.aiSummary ?? null,
        nextSteps: params.nextSteps ?? null,
        dealRisks: params.dealRisks ?? [],
        todos,
        successCriteria: params.successCriteria ? JSON.stringify(params.successCriteria) : null,
        successCriteriaTodos,
        projectPlan,
        dealType: (params.dealType as any) ?? 'one_off',
        recurringInterval: params.recurringInterval ?? null,
      })
      .returning()

    // Score the deal with ML signals
    try {
      const meetingText = params.meetingHistory?.map(e => e.content).join('\n') ?? ''
      const allText = [params.notes, meetingText, params.aiSummary].filter(Boolean).join('\n')
      if (allText.length > 20) {
        const signals = extractTextSignals(allText, created.createdAt ?? new Date(), new Date())
        const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)
        const mlPred = brain?.mlPredictions?.find(p => p.dealId === created.id)
        let finalScore: number
        if (mlPred && brain?.mlModel) {
          const { composite } = computeCompositeScore(
            heuristicScore(signals, 0.5),
            mlPred.winProbability,
            brain.mlModel.trainingSize,
          )
          finalScore = composite
        } else {
          finalScore = heuristicScore(signals, 0.5)
        }
        // Generate human-readable insights, not raw floats
        const insights: string[] = []
        if (signals.championStrength > 0.5) insights.push('Strong internal champion identified')
        else if (signals.championStrength > 0) insights.push('Potential champion — needs confirmation')
        if (signals.budgetConfirmed) insights.push('Budget confirmed')
        if (signals.decisionMakerSignal) insights.push('Decision maker engaged')
        if (signals.momentumScore > 0.7) insights.push('Strong forward momentum')
        else if (signals.momentumScore < 0.3) insights.push('Momentum stalling — needs re-engagement')
        if (signals.stakeholderDepth > 0.5) insights.push('Multiple stakeholders engaged')
        if (signals.nextStepDefined) insights.push('Clear next steps defined')
        if (signals.objectionCount > 0) insights.push(`${signals.objectionCount} objection${signals.objectionCount > 1 ? 's' : ''} identified`)
        if (insights.length === 0) insights.push('Early stage — limited signals available')

        await db.update(dealLogs).set({
          conversionScore: Math.max(0, Math.min(100, Math.round(finalScore))),
          conversionInsights: insights,
        }).where(eq(dealLogs.id, created.id))
      }
    } catch { /* scoring is non-fatal */ }

    after(async () => {
      try { await rebuildWorkspaceBrain(ctx.workspaceId) } catch { /* non-fatal */ }
    })

    // Build summary
    const parts: string[] = []
    if (contacts.length) parts.push(`${contacts.length} contact(s)`)
    if (todos.length) parts.push(`${todos.length} action item(s)`)
    if (successCriteriaTodos.length) parts.push(`${successCriteriaTodos.length} success criteria`)
    if (params.dealRisks?.length) parts.push(`${params.dealRisks.length} risk(s)`)
    if (params.competitors?.length) parts.push(`${params.competitors.length} competitor(s)`)
    if (projectPlan) {
      const taskCount = projectPlan.phases.reduce((sum, p) => sum + p.tasks.length, 0)
      parts.push(`${projectPlan.phases.length} phase(s) / ${taskCount} task(s)`)
    }
    if (params.meetingHistory?.length) parts.push(`${params.meetingHistory.length} interaction(s)`)
    if (params.aiSummary) parts.push('deal summary')

    const detailStr = parts.length > 0 ? ` with ${parts.join(', ')}` : ''

    return {
      result: `Deal **${created.dealName}** (${created.prospectCompany}) imported successfully into **${created.stage}**${params.dealValue ? ` — $${params.dealValue.toLocaleString()}` : ''}${detailStr}.`,
      actions: [{
        type: 'deal_created',
        dealId: created.id,
        dealName: created.dealName,
        company: created.prospectCompany,
      }],
      uiHint: 'refresh_deals',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// enrich_deal
// ─────────────────────────────────────────────────────────────────────────────

export const enrich_deal = {
  description: 'Comprehensively enrich an existing deal with contacts, meeting history, todos, success criteria, project plan, risks, and more — all in one operation. Use this when the user pastes detailed information about a deal that already exists. Merges new data with existing data.',
  parameters: z.object({
    dealId: z.string().describe('The UUID of the existing deal to enrich'),
    contacts: z.array(z.object({
      name: z.string(),
      title: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      role: z.string().optional().describe('e.g. Champion, Decision Maker, Technical Evaluator, Internal Sales Rep'),
    })).optional().describe('Contacts to add (merged with existing, deduped by name)'),
    todos: z.array(z.string()).optional().describe('Action items to add (exact user wording, merged with existing)'),
    meetingHistory: z.array(z.object({
      date: z.string().describe('Date of the interaction (e.g. "Oct 23, 2025")'),
      content: z.string().describe('What happened — preserve exact detail'),
    })).optional().describe('Interaction history entries to add — each with its own date'),
    notes: z.string().optional().describe('General notes to append'),
    aiSummary: z.string().optional().describe('Updated deal summary (replaces existing)'),
    nextSteps: z.string().optional().describe('Next steps (replaces existing)'),
    dealRisks: z.array(z.string()).optional().describe('Risks to add (merged with existing)'),
    competitors: z.array(z.string()).optional().describe('Competitors to add (merged with existing)'),
    successCriteria: z.array(z.object({
      text: z.string(),
      category: z.string().optional(),
    })).optional().describe('Success criteria to add'),
    projectPlan: z.object({
      phases: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        targetDate: z.string().optional(),
        tasks: z.array(z.object({
          text: z.string(),
          status: z.string().optional().describe('pending, in_progress, or complete'),
          owner: z.string().optional(),
        })).optional(),
      })),
    }).optional().describe('Project plan phases/tasks to add or merge'),
    stage: z.string().optional().describe('Update deal stage'),
    dealValue: z.number().optional().describe('Update deal value'),
    closeDate: z.string().optional().describe('Update close date'),
    dealType: z.string().optional().describe('one_off or recurring'),
    recurringInterval: z.string().optional().describe('monthly, quarterly, or annual'),
  }),
  execute: async (
    params: {
      dealId: string
      contacts?: { name: string; title?: string; email?: string; phone?: string; role?: string }[]
      todos?: string[]
      meetingHistory?: { date: string; content: string }[]
      notes?: string
      aiSummary?: string
      nextSteps?: string
      dealRisks?: string[]
      competitors?: string[]
      successCriteria?: { text: string; category?: string }[]
      projectPlan?: { phases: { name: string; description?: string; targetDate?: string; tasks?: { text: string; status?: string; owner?: string }[] }[] }
      stage?: string
      dealValue?: number
      closeDate?: string
      dealType?: string
      recurringInterval?: string
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const [existing] = await db
      .select()
      .from(dealLogs)
      .where(and(eq(dealLogs.id, params.dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
      .limit(1)

    if (!existing) return { result: 'Deal not found.' }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() }
    const changes: string[] = []

    // Merge contacts (dedup by name)
    if (params.contacts?.length) {
      const existingContacts = ((existing.contacts as any[]) ?? []).slice()
      const existingNames = new Set(existingContacts.map((c: any) => c.name?.toLowerCase()))
      let added = 0
      for (const c of params.contacts) {
        if (!existingNames.has(c.name.toLowerCase())) {
          existingContacts.push({
            id: crypto.randomUUID(),
            name: c.name,
            ...(c.title ? { title: c.title } : {}),
            ...(c.email ? { email: c.email } : {}),
            ...(c.phone ? { phone: c.phone } : {}),
            ...(c.role ? { role: c.role } : {}),
          })
          existingNames.add(c.name.toLowerCase())
          added++
        }
      }
      if (added > 0) {
        updateFields.contacts = existingContacts
        changes.push(`${added} contact(s) added`)
      }
    }

    // Merge todos (dedup by normalized text)
    if (params.todos?.length) {
      const existingTodos = ((existing.todos as any[]) ?? []).slice()
      const existingTexts = new Set(existingTodos.map((t: any) => t.text?.toLowerCase().trim()))
      let added = 0
      for (const text of params.todos) {
        if (!existingTexts.has(text.toLowerCase().trim())) {
          existingTodos.push({
            id: crypto.randomUUID(),
            text,
            done: false,
            createdAt: new Date().toISOString(),
          })
          added++
        }
      }
      if (added > 0) {
        updateFields.todos = existingTodos
        changes.push(`${added} action item(s) added`)
      }
    }

    // Merge meeting history entries (each with its own date)
    if (params.meetingHistory?.length) {
      const newEntries = params.meetingHistory.map(e => `[${e.date}] ${e.content}`).join('\n---\n')
      const existingNotes = existing.meetingNotes ?? ''
      updateFields.meetingNotes = existingNotes ? `${newEntries}\n---\n${existingNotes}` : newEntries
      changes.push(`${params.meetingHistory.length} meeting(s) added`)
    }

    // Append notes
    if (params.notes) {
      const existingNotes = existing.notes ?? ''
      updateFields.notes = existingNotes ? `${existingNotes}\n\n${params.notes}` : params.notes
      changes.push('notes appended')
    }

    // Merge risks
    if (params.dealRisks?.length) {
      const existingRisks = ((existing.dealRisks as string[]) ?? []).slice()
      const existingSet = new Set(existingRisks.map(r => r.toLowerCase()))
      let added = 0
      for (const risk of params.dealRisks) {
        if (!existingSet.has(risk.toLowerCase())) {
          existingRisks.push(risk)
          added++
        }
      }
      if (added > 0) {
        updateFields.dealRisks = existingRisks
        changes.push(`${added} risk(s) added`)
      }
    }

    // Merge competitors
    if (params.competitors?.length) {
      const existingComps = ((existing.competitors as string[]) ?? []).slice()
      const existingSet = new Set(existingComps.map(c => c.toLowerCase()))
      let added = 0
      for (const comp of params.competitors) {
        if (!existingSet.has(comp.toLowerCase())) {
          existingComps.push(comp)
          added++
        }
      }
      if (added > 0) {
        updateFields.competitors = existingComps
        changes.push(`${added} competitor(s) added`)
      }
    }

    // Add success criteria
    if (params.successCriteria?.length) {
      const existingCriteria = ((existing.successCriteriaTodos as any[]) ?? []).slice()
      for (const c of params.successCriteria) {
        existingCriteria.push({
          id: crypto.randomUUID(),
          text: c.text,
          category: c.category ?? 'General',
          achieved: false,
          note: '',
          createdAt: new Date().toISOString(),
        })
      }
      updateFields.successCriteriaTodos = existingCriteria
      changes.push(`${params.successCriteria.length} success criteria added`)
    }

    // Merge project plan
    if (params.projectPlan?.phases?.length) {
      const existingPlan = (existing.projectPlan as any) ?? { phases: [] }
      const existingPhases = existingPlan.phases?.slice() ?? []

      for (const newPhase of params.projectPlan.phases) {
        const existingPhase = existingPhases.find((p: any) => p.name?.toLowerCase() === newPhase.name.toLowerCase())
        if (existingPhase) {
          // Add tasks to existing phase
          const existingTaskTexts = new Set((existingPhase.tasks ?? []).map((t: any) => t.text?.toLowerCase()))
          for (const task of (newPhase.tasks ?? [])) {
            if (!existingTaskTexts.has(task.text.toLowerCase())) {
              existingPhase.tasks = existingPhase.tasks ?? []
              existingPhase.tasks.push({
                id: crypto.randomUUID(),
                text: task.text,
                status: task.status ?? 'pending',
                owner: task.owner ?? null,
                dueDate: null,
                notes: '',
                createdAt: new Date().toISOString(),
              })
            }
          }
        } else {
          // Add new phase
          existingPhases.push({
            name: newPhase.name,
            description: newPhase.description ?? '',
            targetDate: newPhase.targetDate ?? null,
            tasks: (newPhase.tasks ?? []).map(t => ({
              id: crypto.randomUUID(),
              text: t.text,
              status: t.status ?? 'pending',
              owner: t.owner ?? null,
              dueDate: null,
              notes: '',
              createdAt: new Date().toISOString(),
            })),
          })
        }
      }
      updateFields.projectPlan = { phases: existingPhases }
      changes.push('project plan updated')
    }

    // Simple field replacements
    if (params.aiSummary) {
      updateFields.aiSummary = params.aiSummary
      changes.push('summary updated')
    }
    if (params.nextSteps) {
      updateFields.nextSteps = params.nextSteps
      changes.push('next steps updated')
    }
    if (params.stage) {
      updateFields.stage = params.stage
      changes.push(`stage → ${params.stage}`)
      if (params.stage === 'closed_won') updateFields.wonDate = new Date()
      if (params.stage === 'closed_lost') updateFields.lostDate = new Date()
    }
    if (params.dealValue !== undefined) {
      updateFields.dealValue = params.dealValue
      changes.push(`value → $${params.dealValue.toLocaleString()}`)
    }
    if (params.closeDate) {
      try { updateFields.closeDate = new Date(params.closeDate) } catch {}
      changes.push(`close date → ${params.closeDate}`)
    }
    if (params.dealType) {
      updateFields.dealType = params.dealType
    }
    if (params.recurringInterval) {
      updateFields.recurringInterval = params.recurringInterval
    }

    if (changes.length === 0) {
      return { result: 'No new data to add.' }
    }

    await db.update(dealLogs).set(updateFields).where(eq(dealLogs.id, params.dealId))

    // Score the deal if it doesn't already have a score
    let scoreSet = false
    if (existing.conversionScore == null || existing.conversionScore === 0) {
      try {
        const meetingText = params.meetingHistory?.map(e => e.content).join('\n') ?? ''
        const allText = [params.notes, meetingText, params.aiSummary, existing.notes, existing.meetingNotes, existing.aiSummary].filter(Boolean).join('\n')
        if (allText.length > 20) {
          const signals = extractTextSignals(allText, existing.createdAt ?? new Date(), new Date())
          const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)
          const mlPred = brain?.mlPredictions?.find((p: any) => p.dealId === params.dealId)
          let finalScore: number
          if (mlPred && brain?.mlModel) {
            const { composite } = computeCompositeScore(
              heuristicScore(signals, 0.5),
              mlPred.winProbability,
              brain.mlModel.trainingSize,
            )
            finalScore = composite
          } else {
            finalScore = heuristicScore(signals, 0.5)
          }
          const insights: string[] = []
          if (signals.championStrength > 0.5) insights.push('Strong internal champion identified')
          else if (signals.championStrength > 0) insights.push('Potential champion — needs confirmation')
          if (signals.budgetConfirmed) insights.push('Budget confirmed')
          if (signals.decisionMakerSignal) insights.push('Decision maker engaged')
          if (signals.momentumScore > 0.7) insights.push('Strong forward momentum')
          else if (signals.momentumScore < 0.3) insights.push('Momentum stalling — needs re-engagement')
          if (signals.stakeholderDepth > 0.5) insights.push('Multiple stakeholders engaged')
          if (signals.nextStepDefined) insights.push('Clear next steps defined')
          if (signals.objectionCount > 0) insights.push(`${signals.objectionCount} objection${signals.objectionCount > 1 ? 's' : ''} identified`)
          if (insights.length === 0) insights.push('Early stage — limited signals available')
          await db.update(dealLogs).set({
            conversionScore: Math.max(0, Math.min(100, Math.round(finalScore))),
            conversionInsights: insights,
          }).where(eq(dealLogs.id, params.dealId))
          scoreSet = true
          changes.push(`conversion score: ${Math.round(finalScore)}%`)
        }
      } catch { /* scoring is non-fatal */ }
    }

    after(async () => {
      try { await rebuildWorkspaceBrain(ctx.workspaceId) } catch {}
    })

    return {
      result: `Enriched **${existing.dealName}** (${existing.prospectCompany}):\n${changes.map(c => `- ${c}`).join('\n')}`,
      actions: [{
        type: 'deal_updated',
        dealId: params.dealId,
        dealName: existing.dealName,
        changes,
      }],
      uiHint: 'refresh_deals',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// update_deal
// ─────────────────────────────────────────────────────────────────────────────

export const update_deal = {
  description: 'Update fields on an existing deal. Preserve the user\'s exact wording for notes and next steps — do not rephrase. Use meetingNotes to log updates to the Activity Log (Updates + Notes tab).',
  parameters: z.object({
    dealId: z.string().describe('The UUID of the deal to update'),
    stage: stageEnum.optional().describe('New deal stage'),
    dealValue: z.number().optional().describe('Updated deal value in dollars'),
    closeDate: z.string().optional().describe('Expected close date (ISO format or natural date)'),
    nextSteps: z.string().optional().describe('Next steps for the deal — preserve user\'s exact wording'),
    notes: z.string().optional().describe('Additional notes to append to the Notes field — preserve user\'s exact wording'),
    meetingNotes: z.string().optional().describe('Update/activity to log in the Activity Log (Updates + Notes tab). Use this when the user reports a conversation, meeting outcome, or deal update. Preserve exact wording.'),
    lostReason: z.string().optional().describe('Reason deal was lost (only for closed_lost)'),
    aiSummary: z.string().optional().describe('Replace the AI-generated deal summary'),
    dealRisks: z.array(z.string()).optional().describe('Replace the deal risks array entirely'),
    competitors: z.array(z.string()).optional().describe('Replace the competitors array entirely'),
  }),
  execute: async (
    params: {
      dealId: string
      stage?: string
      dealValue?: number
      closeDate?: string
      nextSteps?: string
      notes?: string
      meetingNotes?: string
      lostReason?: string
      aiSummary?: string
      dealRisks?: string[]
      competitors?: string[]
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const [existing] = await db
      .select()
      .from(dealLogs)
      .where(and(eq(dealLogs.id, params.dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
      .limit(1)

    if (!existing) {
      return { result: 'Deal not found.' }
    }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() }
    const changes: string[] = []

    if (params.stage) {
      updateFields.stage = params.stage
      changes.push(`Stage: ${existing.stage} -> ${params.stage}`)
      if (params.stage === 'closed_won') updateFields.wonDate = new Date()
      if (params.stage === 'closed_lost') updateFields.lostDate = new Date()
    }
    if (params.dealValue !== undefined) {
      updateFields.dealValue = params.dealValue
      changes.push(`Value: $${params.dealValue.toLocaleString()}`)
    }
    if (params.closeDate) {
      updateFields.closeDate = new Date(params.closeDate)
      changes.push(`Close date: ${params.closeDate}`)
    }
    if (params.nextSteps) {
      updateFields.nextSteps = params.nextSteps
      changes.push(`Next steps updated`)
    }
    if (params.notes) {
      const existingNotes = existing.notes ?? ''
      updateFields.notes = existingNotes ? `${existingNotes}\n\n${params.notes}` : params.notes
      changes.push('Notes appended')
    }
    if (params.meetingNotes) {
      const dateHeader = `[${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}]`
      const newEntry = `${dateHeader} ${params.meetingNotes}`
      const existingMeetingNotes = existing.meetingNotes ?? ''
      updateFields.meetingNotes = existingMeetingNotes ? `${newEntry}\n---\n${existingMeetingNotes}` : newEntry
      changes.push('Activity log updated')
    }
    if (params.lostReason) {
      updateFields.lostReason = params.lostReason
      changes.push(`Lost reason: ${params.lostReason}`)
    }
    if (params.aiSummary) {
      updateFields.aiSummary = params.aiSummary
      changes.push('Summary updated')
    }
    if (params.dealRisks) {
      updateFields.dealRisks = params.dealRisks
      changes.push(`Risks replaced (${params.dealRisks.length} total)`)
    }
    if (params.competitors) {
      updateFields.competitors = params.competitors
      changes.push(`Competitors replaced (${params.competitors.length} total)`)
    }

    if (changes.length === 0) {
      return { result: 'No changes specified.' }
    }

    await db.update(dealLogs).set(updateFields).where(eq(dealLogs.id, params.dealId))

    // Auto-refresh score + summary when meeting notes are added
    if (params.meetingNotes) {
      try {
        if (!(existing as any).conversionScorePinned) {
        const allText = [existing.notes, existing.meetingNotes, params.meetingNotes, existing.aiSummary].filter(Boolean).join('\n')
        if (allText.length > 20) {
          const signals = extractTextSignals(allText, existing.createdAt ?? new Date(), new Date())
          const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)
          const mlPred = brain?.mlPredictions?.find((p: any) => p.dealId === params.dealId)
          let finalScore: number
          if (mlPred && brain?.mlModel) {
            const { composite } = computeCompositeScore(
              heuristicScore(signals, 0.5),
              mlPred.winProbability,
              brain.mlModel.trainingSize,
            )
            finalScore = composite
          } else {
            finalScore = heuristicScore(signals, 0.5)
          }
          const insights: string[] = []
          if (signals.championStrength > 0.5) insights.push('Strong internal champion identified')
          else if (signals.championStrength > 0) insights.push('Potential champion — needs confirmation')
          if (signals.budgetConfirmed) insights.push('Budget confirmed')
          if (signals.decisionMakerSignal) insights.push('Decision maker engaged')
          if (signals.momentumScore > 0.7) insights.push('Strong forward momentum')
          else if (signals.momentumScore < 0.3) insights.push('Momentum stalling — needs re-engagement')
          if (signals.stakeholderDepth > 0.5) insights.push('Multiple stakeholders engaged')
          if (signals.nextStepDefined) insights.push('Clear next steps defined')
          if (signals.objectionCount > 0) insights.push(`${signals.objectionCount} objection${signals.objectionCount > 1 ? 's' : ''} identified`)
          if (insights.length === 0) insights.push('Early stage — limited signals available')
          await db.update(dealLogs).set({
            conversionScore: Math.max(0, Math.min(100, Math.round(finalScore))),
            conversionInsights: insights,
          }).where(eq(dealLogs.id, params.dealId))
        }
        } // end conversionScorePinned check
      } catch { /* scoring is non-fatal */ }
    }

    after(async () => {
      try { await rebuildWorkspaceBrain(ctx.workspaceId) } catch { /* non-fatal */ }
    })

    return {
      result: `Updated **${existing.dealName}**:\n${changes.map(c => `- ${c}`).join('\n')}`,
      actions: [{
        type: 'deal_updated',
        dealId: params.dealId,
        dealName: existing.dealName,
        changes,
      }],
      uiHint: 'refresh_deals',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// manage_todos
// ─────────────────────────────────────────────────────────────────────────────

export const manage_todos = {
  description: 'Add, complete, or remove action items (todos) on a deal. IMPORTANT: When adding todos, copy-paste the user\'s exact text. Do NOT rephrase, summarize, or shorten. If user said "What percentage of the time do employees in Sydney sit at the same desk area", that exact sentence is the todo text.',
  parameters: z.object({
    dealId: z.string().describe('The UUID of the deal'),
    add: z.array(z.string()).optional().describe('New todo texts — COPY the user\'s exact words, do not rephrase or summarize'),
    completeTexts: z.array(z.string()).optional().describe('Todo texts to mark as completed (fuzzy matched)'),
    removeTexts: z.array(z.string()).optional().describe('Todo texts to remove entirely (fuzzy matched)'),
  }),
  execute: async (
    params: {
      dealId: string
      add?: string[]
      completeTexts?: string[]
      removeTexts?: string[]
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const [deal] = await db
      .select({ id: dealLogs.id, dealName: dealLogs.dealName, todos: dealLogs.todos })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, params.dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
      .limit(1)

    if (!deal) return { result: 'Deal not found.' }

    let todos = ((deal.todos as any[]) ?? []).slice()
    let added = 0, completed = 0, removed = 0

    // Fuzzy match helper: find best matching todo by normalized text
    function fuzzyFind(text: string): any | undefined {
      const norm = normalize(text)
      return todos.find((t: any) => normalize(t.text).includes(norm) || norm.includes(normalize(t.text)))
    }

    // Complete todos
    if (params.completeTexts) {
      for (const text of params.completeTexts) {
        const match = fuzzyFind(text)
        if (match && !match.done) {
          match.done = true
          match.completedAt = new Date().toISOString()
          completed++
        }
      }
    }

    // Remove todos
    if (params.removeTexts) {
      for (const text of params.removeTexts) {
        const match = fuzzyFind(text)
        if (match) {
          todos = todos.filter((t: any) => t.id !== match.id)
          removed++
        }
      }
    }

    // Add new todos (dedup against existing)
    if (params.add) {
      const existingKeys = new Set(todos.map((t: any) => normalize(t.text)))
      for (const text of params.add) {
        if (!existingKeys.has(normalize(text))) {
          todos.push({
            id: crypto.randomUUID(),
            text,
            done: false,
            createdAt: new Date().toISOString(),
          })
          added++
        }
      }
    }

    await db.update(dealLogs).set({ todos, updatedAt: new Date() }).where(eq(dealLogs.id, params.dealId))

    const parts: string[] = []
    if (added > 0) parts.push(`${added} added`)
    if (completed > 0) parts.push(`${completed} completed`)
    if (removed > 0) parts.push(`${removed} removed`)

    return {
      result: `Todos updated on **${deal.dealName}**: ${parts.join(', ')}.`,
      actions: [{
        type: 'todos_updated',
        added,
        removed,
        completed,
        dealName: deal.dealName,
      }],
      uiHint: 'refresh_deals',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// add_contact
// ─────────────────────────────────────────────────────────────────────────────

export const add_contact = {
  description: 'Add a contact person to a deal. Adding a contact does NOT change anything else about the deal.',
  parameters: z.object({
    dealId: z.string().describe('The UUID of the deal'),
    name: z.string().describe('Contact name'),
    title: z.string().optional().describe('Job title or role'),
    email: z.string().optional().describe('Email address'),
    phone: z.string().optional().describe('Phone number'),
    role: z.string().optional().describe('Role in the deal (e.g., "Champion", "Decision Maker", "Internal Sales Rep")'),
  }),
  execute: async (
    params: { dealId: string; name: string; title?: string; email?: string; phone?: string; role?: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const [deal] = await db
      .select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany, stage: dealLogs.stage, contacts: dealLogs.contacts })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, params.dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
      .limit(1)

    if (!deal) return { result: 'Deal not found.' }

    const contacts = ((deal.contacts as any[]) ?? []).slice()
    const newContact: Record<string, string> = {
      id: crypto.randomUUID(),
      name: params.name,
    }
    if (params.title) newContact.title = params.title
    if (params.email) newContact.email = params.email
    if (params.phone) newContact.phone = params.phone
    if (params.role) newContact.role = params.role

    contacts.push(newContact)
    await db.update(dealLogs).set({ contacts, updatedAt: new Date() }).where(eq(dealLogs.id, params.dealId))

    const totalContacts = contacts.length
    return {
      result: `Added **${params.name}**${params.title ? ` (${params.title})` : ''}${params.role ? ` as ${params.role}` : ''} to **${deal.dealName}** (${deal.prospectCompany}, ${deal.stage}). Deal now has ${totalContacts} contact(s).`,
      actions: [{
        type: 'deal_updated',
        dealId: params.dealId,
        dealName: deal.dealName,
        changes: [`Contact added: ${params.name}`],
      }],
      uiHint: 'refresh_deals',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// delete_deal
// ─────────────────────────────────────────────────────────────────────────────

export const delete_deal = {
  description: 'Delete a deal from the pipeline. Requires confirmation from the user before proceeding.',
  parameters: z.object({
    dealId: z.string().describe('The UUID of the deal to delete'),
  }),
  execute: async (params: { dealId: string }, ctx: ToolContext): Promise<ToolResult> => {
    const [deal] = await db
      .select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, params.dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
      .limit(1)

    if (!deal) return { result: 'Deal not found.' }

    return {
      result: `Are you sure you want to delete the deal **${deal.dealName}** (${deal.prospectCompany})? This action cannot be undone. Reply "yes" to confirm.`,
      confirmationRequired: true,
      pendingAction: {
        tool: 'delete_deal_confirmed',
        dealId: params.dealId,
        dealName: deal.dealName,
      },
    }
  },
}

// Internal: actually deletes the deal after confirmation
export const delete_deal_confirmed = {
  description: 'Internal: Execute a confirmed deal deletion. Do not call directly — called after user confirms delete_deal.',
  parameters: z.object({
    dealId: z.string().describe('The UUID of the deal to delete'),
  }),
  execute: async (params: { dealId: string }, ctx: ToolContext): Promise<ToolResult> => {
    const [deal] = await db
      .select({ id: dealLogs.id, dealName: dealLogs.dealName })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, params.dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
      .limit(1)

    if (!deal) return { result: 'Deal not found.' }

    await db.delete(dealLogs).where(eq(dealLogs.id, params.dealId))

    after(async () => {
      try { await rebuildWorkspaceBrain(ctx.workspaceId) } catch { /* non-fatal */ }
    })

    return {
      result: `Deal **${deal.dealName}** has been permanently deleted.`,
      actions: [{ type: 'deal_deleted', dealId: params.dealId, dealName: deal.dealName }],
      uiHint: 'refresh_deals',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// process_meeting_notes
// ─────────────────────────────────────────────────────────────────────────────

const MeetingNotesSchema = z.object({
  summary: z.string().nullable().optional(),
  risks: z.array(z.string()).default([]),
  resolvedRisks: z.array(z.string()).default([]).describe('Substrings of existing risks that are now resolved/no longer applicable'),
  todos: z.array(z.object({ text: z.string() })).default([]),
  obsoleteTodoIds: z.array(z.string()).default([]),
  criteriaUpdates: z.array(z.object({
    criterionId: z.string(),
    achieved: z.boolean(),
    note: z.string().optional(),
  })).default([]),
  projectPlanUpdates: z.array(z.object({
    taskId: z.string(),
    status: z.enum(['not_started', 'in_progress', 'complete']),
    note: z.string().optional(),
  })).default([]),
  suggestedStage: z.enum(['prospecting', 'qualification', 'discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost']).nullable().optional(),
  stageReason: z.string().nullable().optional(),
  productGaps: z.array(z.object({
    title: z.string(),
    description: z.string().optional().default(''),
    priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  })).default([]),
  competitors: z.array(z.string()).default([]),
  intentSignals: z.object({
    championStatus: z.enum(['confirmed', 'suspected', 'none']).default('none'),
    budgetStatus: z.enum(['approved', 'awaiting', 'not_discussed', 'blocked']).default('not_discussed'),
    decisionTimeline: z.string().nullable().optional(),
    nextMeetingBooked: z.boolean().default(false),
  }).optional(),
})

export const process_meeting_notes = {
  description: 'Process meeting notes or transcript for a deal. Holistic deal update: extracts summary, action items, risks, product gaps, competitors, and intent signals. Cross-references success criteria, project plan tasks, and existing todos. Suggests stage changes when warranted. Updates the deal automatically.',
  parameters: z.object({
    notes: z.string().describe('The meeting notes or transcript text'),
    dealId: z.string().optional().describe('The UUID of the deal these notes relate to. If omitted, the active deal context is used.'),
  }),
  execute: async (
    params: { notes: string; dealId?: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const dealId = params.dealId ?? ctx.activeDealId
    if (!dealId) {
      return { result: 'No deal specified. Please provide a dealId or navigate to a deal first.' }
    }

    const [deal] = await db
      .select()
      .from(dealLogs)
      .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
      .limit(1)

    if (!deal) return { result: 'Deal not found.' }

    // Fetch known capabilities to prevent false product gap detection
    const [profile] = await db
      .select({ knownCapabilities: companyProfiles.knownCapabilities })
      .from(companyProfiles)
      .where(eq(companyProfiles.workspaceId, ctx.workspaceId))
      .limit(1)
    const knownCapabilities = (profile?.knownCapabilities as string[]) ?? []
    const capabilitiesContext = knownCapabilities.length > 0
      ? `\n\nCONFIRMED PRODUCT CAPABILITIES (do NOT flag these as product gaps):\n${knownCapabilities.map(c => `- ${c}`).join('\n')}`
      : ''

    // Compress meeting history to last 5 entries (entries separated by \n---\n)
    function compressMeetingHistory(raw: string | null): string {
      if (!raw) return ''
      const blocks = raw.split(/\n---\n/).map(b => b.trim()).filter(Boolean)
      return blocks.slice(-5).join('\n---\n')
    }

    const compressedHistory = compressMeetingHistory(deal.meetingNotes as string | null)
    const previousContext = [
      compressedHistory ? `MEETING HISTORY (last 5 updates):\n${compressedHistory}` : '',
      deal.aiSummary ? `CURRENT DEAL SUMMARY: ${deal.aiSummary}` : '',
      (deal.dealRisks as string[])?.length ? `KNOWN RISKS: ${(deal.dealRisks as string[]).join('; ')}` : '',
    ].filter(Boolean).join('\n\n')

    const existingTodos = (deal.todos as any[]) ?? []
    const openTodos = existingTodos.filter((t: any) => !t.done)
    const existingTodosContext = openTodos.length > 0
      ? `\n\nEXISTING OPEN ACTION ITEMS:\n${openTodos.map((t: any) => `- [${t.id}] ${t.text}`).join('\n')}\n\nRules:\n- Do NOT add duplicates of existing items\n- Return obsoleteTodoIds: IDs of items now done, superseded, or irrelevant`
      : ''

    // Build success criteria context
    const criteria = (deal.successCriteriaTodos as any[]) ?? []
    const openCriteria = criteria.filter((c: any) => !c.achieved)
    const existingCriteriaContext = openCriteria.length > 0
      ? `\n\nOPEN SUCCESS CRITERIA (mark achieved if meeting notes confirm they were demonstrated/met):\n${openCriteria.map((c: any) => `- [${c.id}] ${c.text} (${c.category})`).join('\n')}`
      : ''

    // Build project plan context
    const projectPlan = deal.projectPlan as any
    let existingProjectPlanContext = ''
    if (projectPlan?.phases?.length > 0) {
      const taskLines: string[] = []
      for (const phase of projectPlan.phases) {
        for (const task of (phase.tasks ?? [])) {
          if (task.status !== 'complete') {
            taskLines.push(`- [${task.id}] ${task.text} (${phase.name}, status: ${task.status})`)
          }
        }
      }
      if (taskLines.length > 0) {
        existingProjectPlanContext = `\n\nOPEN PROJECT PLAN TASKS (update status if meeting notes indicate progress):\n${taskLines.join('\n')}`
      }
    }

    // Phase 1: LLM extraction (no scoring)
    const extractionMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extract structured data from these sales meeting notes. Return ONLY valid JSON.

DEFINITIONS — read these carefully:
- DEAL RISKS: Concerns about whether this deal will CLOSE. Examples: budget freeze, champion leaving, competitor preferred, timeline slipping, decision-maker disengaged. NOT about product features.
- PRODUCT GAPS: Features/capabilities that OUR PRODUCT is MISSING that the prospect explicitly said they need. Only if they said "your product can't do X" or "we need X and you don't have it". NOT general concerns or nice-to-haves.
- ACTION ITEMS: Specific things someone needs to DO. Preserve exact wording — if they said "send the pricing deck to Sarah by Friday", that's the todo text.

${previousContext ? `${previousContext}\n\n---\n\n` : ''}NEW MEETING NOTES:
${params.notes}

Deal: ${deal.dealName} with ${deal.prospectCompany} (current stage: ${deal.stage})${capabilitiesContext}${existingTodosContext}${existingCriteriaContext}${existingProjectPlanContext}

Return this exact JSON:
{
  "summary": "2-4 sentence factual summary preserving key specifics: names, dates, numbers, decisions, and exact requirements discussed",
  "risks": ["NEW deal-closing risks introduced in these notes only"],
  "resolvedRisks": ["substring matching an existing risk that is now resolved — e.g. 'attendance unconfirmed' if attendance is now confirmed"],
  "todos": [{"text": "Exact action item preserving original wording, names, and deadlines"}],
  "obsoleteTodoIds": ["id-of-existing-todo-now-done-or-irrelevant"],
  "productGaps": [{"title": "Missing feature name", "description": "What our product cannot do that prospect explicitly said they need", "priority": "high"}],
  "competitors": ["competitor name only if explicitly mentioned as being evaluated"],
  "intentSignals": {
    "championStatus": "confirmed|suspected|none",
    "budgetStatus": "approved|awaiting|not_discussed|blocked",
    "decisionTimeline": "e.g. Q2 2026 or null if not mentioned",
    "nextMeetingBooked": false
  },
  "criteriaUpdates": [{"criterionId": "id", "achieved": true, "note": "Demonstrated in meeting"}],
  "projectPlanUpdates": [{"taskId": "id", "status": "complete", "note": "Completed — session confirmed for 19 Mar"}],
  "suggestedStage": "proposal or null if no stage change implied",
  "stageReason": "reason for stage change or null"
}

Rules:
- PRESERVE EXACT WORDING from the notes. If someone said "we need to demo desk utilization by team", that exact phrase goes in todos — not "prepare desk analytics demo".
- risks: NEW deal-closing risks from these notes ONLY (not repeats of known risks). Return [] if no new risks.
- resolvedRisks: CRITICAL — if a known risk is now resolved by these notes, add a short substring from it here. Examples: if "attendance unconfirmed" is a known risk and the notes say "confirmed attendance", add "attendance unconfirmed". If "session not scheduled" was a risk and notes say "session agreed for 19 Mar", add "session not scheduled". Be generous — if notes clearly indicate a risk is gone, resolve it.
- todos: New items only, no duplicates. Include who is responsible and deadlines if mentioned. Return [] if none.
- productGaps: ONLY if prospect explicitly said our product lacks something. General concerns are risks, not gaps. Return [] if no explicit product gaps.
- competitors: Only if named as an explicit alternative being evaluated. Return [] if none.
- intentSignals: Extract ONLY what is explicitly stated, never infer.
- criteriaUpdates: ONLY if the meeting notes clearly demonstrate a criterion was met. Don't guess. Return [] if none confirmed.
- projectPlanUpdates: CRITICAL — if the notes describe completing or progressing a task, match it to the task ID and set status to "complete" or "in_progress". Be smart: "agreed on plan and dates" = complete any planning tasks; "session confirmed for 19 Mar" = complete any attendance-confirmation tasks. Return [] if no task progress.
- suggestedStage: ONLY if notes clearly imply a stage transition (e.g., "sent proposal" = proposal, "received signed contract" = closed_won). Return null if current stage still appropriate.
- DO NOT infer things that weren't said. If the notes don't mention budget, leave budgetStatus as "not_discussed".`,
      }],
    })

    const rawText = ((extractionMsg.content[0] as any).text ?? '').trim()

    // Parse with retry
    let parsed: z.infer<typeof MeetingNotesSchema>
    try {
      const jsonStr = rawText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
      const braceIdx = jsonStr.indexOf('{')
      const cleanJson = braceIdx > 0 ? jsonStr.slice(braceIdx) : jsonStr
      const result = MeetingNotesSchema.safeParse(JSON.parse(cleanJson))
      if (result.success) {
        parsed = result.data
      } else {
        // Retry with correction
        const retryMsg = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `Return ONLY valid JSON. No markdown.\n\nOriginal:\n${rawText}\n\nErrors: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}\n\nFix and return only the corrected object.`,
          }],
        })
        const retryRaw = ((retryMsg.content[0] as any).text ?? '').trim()
        const retryClean = retryRaw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
        const retryBrace = retryClean.indexOf('{')
        parsed = MeetingNotesSchema.parse(JSON.parse(retryBrace > 0 ? retryClean.slice(retryBrace) : retryClean))
      }
    } catch {
      parsed = MeetingNotesSchema.parse({})
    }

    // Build update fields
    const newTodos = (parsed.todos ?? []).map(t => ({
      id: crypto.randomUUID(),
      text: t.text,
      done: false,
      createdAt: new Date().toISOString(),
    }))

    const obsoleteIds = new Set(parsed.obsoleteTodoIds ?? [])
    const dateStamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const risksLine = (parsed.risks ?? []).length > 0 ? ` Risks: ${parsed.risks.join('; ')}.` : ''
    const actionLine = newTodos.length > 0 ? ` Actions: ${newTodos.map(t => t.text).join('; ')}.` : ''
    const compactEntry = parsed.summary
      ? `[${dateStamp}] ${parsed.summary}${risksLine}${actionLine}`
      : `[${dateStamp}] Meeting notes processed.${actionLine}`

    const appendedNotes = deal.meetingNotes ? `${deal.meetingNotes}\n${compactEntry}` : compactEntry

    // Merge todos: remove obsolete, dedup, append new
    const existingKept = existingTodos.filter((t: any) => !obsoleteIds.has(t.id))
    const existingKeys = new Set(existingKept.map((t: any) => normalize(t.text)))
    const dedupedNew = newTodos.filter(t => !existingKeys.has(normalize(t.text)))
    const mergedTodos = [...existingKept, ...dedupedNew]

    // Merge competitors
    const extractedComps = (parsed.competitors ?? []).filter(c => typeof c === 'string' && c.trim())
    const existingComps = (deal.competitors as string[]) ?? []
    const existingCompKeys = new Set(existingComps.map(c => c.toLowerCase()))
    const newComps = extractedComps.filter(c => !existingCompKeys.has(c.toLowerCase()))
    const mergedCompetitors = newComps.length > 0 ? [...existingComps, ...newComps] : undefined

    // Smart risk merge: keep existing unresolved risks, add new ones
    const existingRisks = (deal.dealRisks as string[]) ?? []
    const resolvedPatterns = (parsed.resolvedRisks ?? []).map(r => r.toLowerCase())
    const survivingRisks = existingRisks.filter(r =>
      !resolvedPatterns.some(pattern => r.toLowerCase().includes(pattern) || pattern.includes(r.toLowerCase().slice(0, 30)))
    )
    const existingRiskKeys = new Set(survivingRisks.map(r => r.toLowerCase().slice(0, 40)))
    const newRisks = (parsed.risks ?? []).filter(r => !existingRiskKeys.has(r.toLowerCase().slice(0, 40)))
    const mergedRisks = [...survivingRisks, ...newRisks]

    const updateFields: Record<string, unknown> = {
      meetingNotes: appendedNotes,
      dealRisks: mergedRisks,
      todos: mergedTodos,
      updatedAt: new Date(),
    }
    if (mergedCompetitors) updateFields.competitors = mergedCompetitors
    if (parsed.summary) updateFields.aiSummary = parsed.summary
    if (parsed.intentSignals) updateFields.intentSignals = parsed.intentSignals

    // Apply success criteria updates
    if (parsed.criteriaUpdates?.length) {
      const criteriaUpdateMap = new Map(parsed.criteriaUpdates.map(u => [u.criterionId, u]))
      const existingCriteria = ((deal.successCriteriaTodos as any[]) ?? []).slice()
      const updatedCriteria = existingCriteria.map((c: any) => {
        const update = criteriaUpdateMap.get(c.id)
        if (!update) return c
        return {
          ...c,
          ...(update.achieved !== undefined ? { achieved: update.achieved } : {}),
          ...(update.note ? { note: (c.note ? `${c.note}\n${update.note}` : update.note) } : {}),
        }
      })
      updateFields.successCriteriaTodos = updatedCriteria
    }

    // Apply project plan task updates (match by ID, fallback to text similarity)
    if (parsed.projectPlanUpdates?.length) {
      const taskUpdateMap = new Map(parsed.projectPlanUpdates.map(u => [u.taskId, u]))
      const existingPlan = (deal.projectPlan as any) ?? { phases: [] }

      // Build a text→update map for fuzzy fallback matching
      const textFallbackMap = new Map<string, typeof parsed.projectPlanUpdates[0]>()
      for (const u of parsed.projectPlanUpdates) {
        // Sometimes LLM returns partial task text instead of ID
        if (!u.taskId.match(/^[0-9a-f-]{36}$/i)) {
          textFallbackMap.set(u.taskId.toLowerCase(), u)
        }
      }

      const updatedPlan = {
        ...existingPlan,
        updatedAt: new Date().toISOString(),
        phases: (existingPlan.phases ?? []).map((phase: any) => ({
          ...phase,
          tasks: (phase.tasks ?? []).map((task: any) => {
            // Try ID match first
            let update = taskUpdateMap.get(task.id)
            // Fallback: fuzzy text match
            if (!update && textFallbackMap.size > 0) {
              const taskTextLower = (task.text ?? '').toLowerCase()
              for (const [key, u] of textFallbackMap) {
                if (taskTextLower.includes(key.slice(0, 20)) || key.includes(taskTextLower.slice(0, 20))) {
                  update = u
                  break
                }
              }
            }
            if (!update) return task
            return {
              ...task,
              status: update.status ?? task.status,
              notes: update.note ? (task.notes ? `${task.notes}\n${update.note}` : update.note) : task.notes,
            }
          }),
        })),
      }
      updateFields.projectPlan = updatedPlan
    }

    // Apply suggested stage change
    if (parsed.suggestedStage && parsed.suggestedStage !== deal.stage) {
      updateFields.stage = parsed.suggestedStage
      if (parsed.suggestedStage === 'closed_won') updateFields.wonDate = new Date()
      if (parsed.suggestedStage === 'closed_lost') updateFields.lostDate = new Date()
    }

    // Phase 2: Score computation — re-score unless user has explicitly pinned the score
    if (!(deal as any).conversionScorePinned) {
      try {
        const signals = extractTextSignals(appendedNotes, deal.createdAt ?? new Date(), new Date())
        const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)
        const mlPred = brain?.mlPredictions?.find(p => p.dealId === dealId)

        let finalScore: number
        if (mlPred && brain?.mlModel) {
          const { composite } = computeCompositeScore(
            heuristicScore(signals, 0.5),
            mlPred.winProbability,
            brain.mlModel.trainingSize,
          )
          finalScore = composite
        } else {
          finalScore = heuristicScore(signals, 0.5)
        }

        // Intent signal adjustments
        if (parsed.intentSignals) {
          const is = parsed.intentSignals
          if (is.championStatus === 'confirmed') finalScore = Math.min(100, finalScore + 6)
          if (is.championStatus === 'suspected') finalScore = Math.min(100, finalScore + 3)
          if (is.budgetStatus === 'approved') finalScore = Math.min(100, finalScore + 8)
          if (is.budgetStatus === 'awaiting') finalScore = Math.min(100, finalScore + 2)
          if (is.budgetStatus === 'blocked') finalScore = Math.max(0, finalScore - 8)
          if (is.nextMeetingBooked) finalScore = Math.min(100, finalScore + 3)
        }

        updateFields.conversionScore = Math.max(0, Math.min(100, Math.round(finalScore)))
      } catch { /* non-fatal */ }
    }

    await db.update(dealLogs).set(updateFields).where(eq(dealLogs.id, dealId))

    // Create product gaps
    const createdGaps: string[] = []
    for (const gap of (parsed.productGaps ?? [])) {
      if (!gap.title) continue
      const [existing] = await db
        .select()
        .from(productGaps)
        .where(and(eq(productGaps.workspaceId, ctx.workspaceId), eq(productGaps.title, gap.title)))
        .limit(1)

      if (existing) {
        await db.update(productGaps).set({
          frequency: (existing.frequency ?? 1) + 1,
          sourceDeals: [...((existing.sourceDeals as string[]) ?? []), dealId],
          updatedAt: new Date(),
        }).where(eq(productGaps.id, existing.id))
      } else {
        await db.insert(productGaps).values({
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          title: gap.title,
          description: gap.description ?? '',
          priority: gap.priority ?? 'medium',
          frequency: 1,
          sourceDeals: [dealId],
          status: 'open',
          affectedRevenue: deal.dealValue ?? null,
        })
      }
      createdGaps.push(gap.title)
    }

    after(async () => {
      try { await rebuildWorkspaceBrain(ctx.workspaceId) } catch { /* non-fatal */ }
    })

    // Build response
    const resultLines = [`Meeting notes processed for **${deal.dealName}**.`]
    if (parsed.summary) resultLines.push(`\n**Summary:** ${parsed.summary}`)
    if (parsed.risks.length > 0) {
      resultLines.push(`\n**Risks identified:**`)
      parsed.risks.forEach(r => resultLines.push(`- ${r}`))
    }
    if (dedupedNew.length > 0) {
      resultLines.push(`\n**New action items:**`)
      dedupedNew.forEach(t => resultLines.push(`- ${t.text}`))
    }
    if (obsoleteIds.size > 0) {
      resultLines.push(`\n*${obsoleteIds.size} obsolete todo(s) removed.*`)
    }
    if (createdGaps.length > 0) {
      resultLines.push(`\n**Product gaps logged:**`)
      createdGaps.forEach(g => resultLines.push(`- ${g}`))
    }
    if (newComps.length > 0) {
      resultLines.push(`\n**New competitors detected:** ${newComps.join(', ')}`)
    }
    if (parsed.criteriaUpdates?.length) {
      const achievedCount = parsed.criteriaUpdates.filter(u => u.achieved).length
      if (achievedCount > 0) {
        resultLines.push(`\n**Success criteria:** ${achievedCount} marked as achieved`)
      }
    }
    if (parsed.projectPlanUpdates?.length) {
      resultLines.push(`\n**Project plan:** ${parsed.projectPlanUpdates.length} task(s) updated`)
    }
    if (parsed.suggestedStage && parsed.suggestedStage !== deal.stage) {
      resultLines.push(`\n**Stage changed:** ${deal.stage} → ${parsed.suggestedStage}${parsed.stageReason ? ` (${parsed.stageReason})` : ''}`)
    }
    if (updateFields.conversionScore != null) {
      resultLines.push(`\n**Updated conversion score:** ${updateFields.conversionScore}%`)
    }

    const actions: any[] = []
    if (dedupedNew.length > 0 || obsoleteIds.size > 0) {
      actions.push({
        type: 'todos_updated',
        added: dedupedNew.length,
        removed: obsoleteIds.size,
        completed: 0,
        dealName: deal.dealName,
      })
    }
    if (createdGaps.length > 0) {
      actions.push({
        type: 'gaps_logged',
        gaps: createdGaps,
        count: createdGaps.length,
      })
    }

    return {
      result: resultLines.join('\n'),
      actions,
      uiHint: 'refresh_deals',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// update_project_plan
// ─────────────────────────────────────────────────────────────────────────────

export const update_project_plan = {
  description: 'Add tasks or phases to a deal\'s project plan. Preserves the EXACT text provided — do not summarize or rephrase the user\'s words. Can also update task status or remove tasks.',
  parameters: z.object({
    dealId: z.string().describe('The UUID of the deal'),
    addPhase: z.object({
      name: z.string().describe('Phase name'),
      description: z.string().optional().describe('Phase description'),
      targetDate: z.string().optional().describe('Target date YYYY-MM-DD'),
      tasks: z.array(z.object({
        text: z.string().describe('EXACT task text — preserve the user\'s wording verbatim'),
        owner: z.string().optional().describe('Owner/assignee'),
        dueDate: z.string().optional().describe('Due date YYYY-MM-DD'),
        notes: z.string().optional().describe('Additional context or notes'),
      })).describe('Tasks in this phase'),
    }).optional().describe('Add a new phase with tasks'),
    addTasks: z.object({
      phaseId: z.string().optional().describe('Phase ID to add tasks to (if omitted, adds to first/default phase)'),
      phaseName: z.string().optional().describe('Phase name to find or create'),
      tasks: z.array(z.object({
        text: z.string().describe('EXACT task text — preserve the user\'s wording verbatim'),
        owner: z.string().optional().describe('Owner/assignee'),
        dueDate: z.string().optional().describe('Due date YYYY-MM-DD'),
        notes: z.string().optional().describe('Additional context'),
      })).describe('Tasks to add'),
    }).optional().describe('Add tasks to an existing phase'),
    updateTask: z.object({
      taskId: z.string().describe('Task ID to update'),
      status: z.enum(['not_started', 'in_progress', 'complete']).optional(),
      text: z.string().optional(),
      owner: z.string().optional(),
      notes: z.string().optional(),
    }).optional().describe('Update a specific task'),
    removeTaskId: z.string().optional().describe('Task ID to remove'),
    replaceEntirePlan: z.object({
      phases: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        targetDate: z.string().optional(),
        tasks: z.array(z.object({
          text: z.string(),
          status: z.string().optional(),
          owner: z.string().optional(),
        })).optional(),
      })),
    }).optional().describe('If provided, COMPLETELY REPLACES the entire project plan. Use when user says reset/rebuild the plan. Do not use with other params.'),
  }),
  execute: async (
    params: {
      dealId: string
      addPhase?: { name: string; description?: string; targetDate?: string; tasks: { text: string; owner?: string; dueDate?: string; notes?: string }[] }
      addTasks?: { phaseId?: string; phaseName?: string; tasks: { text: string; owner?: string; dueDate?: string; notes?: string }[] }
      updateTask?: { taskId: string; status?: string; text?: string; owner?: string; notes?: string }
      removeTaskId?: string
      replaceEntirePlan?: { phases: { name: string; description?: string; targetDate?: string; tasks?: { text: string; status?: string; owner?: string }[] }[] }
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const [deal] = await db
      .select({ id: dealLogs.id, dealName: dealLogs.dealName, projectPlan: dealLogs.projectPlan })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, params.dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
      .limit(1)

    if (!deal) return { result: 'Deal not found.' }

    const now = new Date().toISOString()
    const existing = (deal.projectPlan as any) ?? { title: `Project Plan — ${deal.dealName}`, createdAt: now, phases: [] }
    let plan = { ...existing, updatedAt: now }
    const changes: string[] = []

    // Replace entire plan — skip all other operations
    if (params.replaceEntirePlan) {
      const newPhases = params.replaceEntirePlan.phases.map((phase, pi) => ({
        id: `p${pi + 1}_${Date.now()}`,
        name: phase.name,
        description: phase.description || '',
        order: pi + 1,
        targetDate: phase.targetDate || null,
        tasks: (phase.tasks ?? []).map((t, ti) => ({
          id: `t${pi + 1}_${ti + 1}_${Date.now()}`,
          text: t.text,
          status: t.status ?? 'not_started',
          owner: t.owner || null,
          dueDate: null,
          notes: null,
          linkedTodoId: null,
        })),
      }))
      plan = {
        title: existing.title ?? `Project Plan — ${deal.dealName}`,
        createdAt: existing.createdAt ?? now,
        updatedAt: now,
        phases: newPhases,
      }
      const totalTasks = newPhases.reduce((sum, p) => sum + p.tasks.length, 0)
      changes.push(`Replaced entire plan: ${newPhases.length} phase(s), ${totalTasks} task(s)`)

      await db.update(dealLogs)
        .set({ projectPlan: plan, updatedAt: new Date() } as any)
        .where(eq(dealLogs.id, params.dealId))

      after(async () => {
        try { await rebuildWorkspaceBrain(ctx.workspaceId) } catch { /* non-fatal */ }
      })

      return {
        result: `Project plan replaced on **${deal.dealName}**:\n${changes.map(c => `- ${c}`).join('\n')}`,
        actions: [{ type: 'deal_updated', dealId: params.dealId, dealName: deal.dealName, changes }],
        uiHint: 'refresh_deals',
      }
    }

    // Add a new phase
    if (params.addPhase) {
      const newPhase = {
        id: `p${(plan.phases?.length ?? 0) + 1}_${Date.now()}`,
        name: params.addPhase.name,
        description: params.addPhase.description || '',
        order: (plan.phases?.length ?? 0) + 1,
        targetDate: params.addPhase.targetDate || null,
        tasks: params.addPhase.tasks.map((t, i) => ({
          id: `t${i + 1}_${Date.now()}`,
          text: t.text,
          status: 'not_started',
          owner: t.owner || null,
          dueDate: t.dueDate || null,
          notes: t.notes || null,
          linkedTodoId: null,
        })),
      }
      plan.phases = [...(plan.phases ?? []), newPhase]
      changes.push(`Added phase "${params.addPhase.name}" with ${params.addPhase.tasks.length} task(s)`)
    }

    // Add tasks to existing phase
    if (params.addTasks) {
      let targetPhase: any = null

      if (params.addTasks.phaseId) {
        targetPhase = plan.phases?.find((p: any) => p.id === params.addTasks!.phaseId)
      }
      if (!targetPhase && params.addTasks.phaseName) {
        targetPhase = plan.phases?.find((p: any) =>
          p.name.toLowerCase().includes(params.addTasks!.phaseName!.toLowerCase())
        )
        // Create phase if not found
        if (!targetPhase) {
          targetPhase = {
            id: `p${(plan.phases?.length ?? 0) + 1}_${Date.now()}`,
            name: params.addTasks.phaseName,
            description: '',
            order: (plan.phases?.length ?? 0) + 1,
            targetDate: null,
            tasks: [],
          }
          plan.phases = [...(plan.phases ?? []), targetPhase]
        }
      }
      if (!targetPhase && plan.phases?.length > 0) {
        targetPhase = plan.phases[0]
      }
      if (!targetPhase) {
        targetPhase = {
          id: `p1_${Date.now()}`,
          name: 'Tasks',
          description: '',
          order: 1,
          targetDate: null,
          tasks: [],
        }
        plan.phases = [targetPhase]
      }

      const newTasks = params.addTasks.tasks.map((t, i) => ({
        id: `t${(targetPhase.tasks?.length ?? 0) + i + 1}_${Date.now()}`,
        text: t.text,
        status: 'not_started' as const,
        owner: t.owner || null,
        dueDate: t.dueDate || null,
        notes: t.notes || null,
        linkedTodoId: null,
      }))

      // Mutate in-place within the phases array
      plan.phases = plan.phases.map((p: any) =>
        p.id === targetPhase.id
          ? { ...p, tasks: [...(p.tasks ?? []), ...newTasks] }
          : p
      )
      changes.push(`Added ${newTasks.length} task(s) to "${targetPhase.name}"`)
    }

    // Update a task
    if (params.updateTask) {
      const { taskId, ...updates } = params.updateTask
      plan.phases = plan.phases.map((p: any) => ({
        ...p,
        tasks: (p.tasks ?? []).map((t: any) => {
          if (t.id !== taskId) return t
          const upd = { ...t }
          if (updates.status) upd.status = updates.status
          if (updates.text) upd.text = updates.text
          if (updates.owner) upd.owner = updates.owner
          if (updates.notes !== undefined) upd.notes = updates.notes
          return upd
        }),
      }))
      changes.push(`Updated task ${taskId}`)
    }

    // Remove a task
    if (params.removeTaskId) {
      plan.phases = plan.phases.map((p: any) => ({
        ...p,
        tasks: (p.tasks ?? []).filter((t: any) => t.id !== params.removeTaskId),
      }))
      changes.push(`Removed task ${params.removeTaskId}`)
    }

    await db.update(dealLogs)
      .set({ projectPlan: plan, updatedAt: new Date() } as any)
      .where(eq(dealLogs.id, params.dealId))

    after(async () => {
      try { await rebuildWorkspaceBrain(ctx.workspaceId) } catch { /* non-fatal */ }
    })

    return {
      result: `Project plan updated on **${deal.dealName}**:\n${changes.map(c => `- ${c}`).join('\n')}`,
      actions: [{
        type: 'deal_updated',
        dealId: params.dealId,
        dealName: deal.dealName,
        changes,
      }],
      uiHint: 'refresh_deals',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// update_success_criteria
// ─────────────────────────────────────────────────────────────────────────────

export const update_success_criteria = {
  description: 'Add, update, or remove success criteria on a deal. Preserves the EXACT text provided — do not summarize or rephrase. Each criterion should capture the specific requirement the customer stated.',
  parameters: z.object({
    dealId: z.string().describe('The UUID of the deal'),
    add: z.array(z.object({
      text: z.string().describe('EXACT criterion text — preserve the user/customer\'s wording verbatim. Include the full specific question or requirement.'),
      category: z.string().optional().describe('Category/theme (e.g., Reporting, Integration, Security, Demo)'),
      note: z.string().optional().describe('Additional context (e.g., who requested it, when)'),
    })).optional().describe('Criteria to add'),
    achieve: z.array(z.string()).optional().describe('Criterion IDs to mark as achieved'),
    remove: z.array(z.string()).optional().describe('Criterion IDs to remove'),
    updateNote: z.object({
      criterionId: z.string(),
      note: z.string(),
    }).optional().describe('Update the note on a specific criterion'),
  }),
  execute: async (
    params: {
      dealId: string
      add?: { text: string; category?: string; note?: string }[]
      achieve?: string[]
      remove?: string[]
      updateNote?: { criterionId: string; note: string }
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const [deal] = await db
      .select({ id: dealLogs.id, dealName: dealLogs.dealName, successCriteriaTodos: dealLogs.successCriteriaTodos })
      .from(dealLogs)
      .where(and(eq(dealLogs.id, params.dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
      .limit(1)

    if (!deal) return { result: 'Deal not found.' }

    let criteria = ((deal.successCriteriaTodos as any[]) ?? []).slice()
    const changes: string[] = []

    // Add new criteria
    if (params.add?.length) {
      for (const item of params.add) {
        criteria.push({
          id: crypto.randomUUID(),
          text: item.text,
          category: item.category || 'General',
          achieved: false,
          note: item.note || '',
          createdAt: new Date().toISOString(),
        })
      }
      changes.push(`Added ${params.add.length} criterion/criteria`)
    }

    // Mark as achieved
    if (params.achieve?.length) {
      const achieveSet = new Set(params.achieve)
      criteria = criteria.map((c: any) =>
        achieveSet.has(c.id) ? { ...c, achieved: true } : c
      )
      changes.push(`Marked ${params.achieve.length} as achieved`)
    }

    // Remove criteria
    if (params.remove?.length) {
      const removeSet = new Set(params.remove)
      criteria = criteria.filter((c: any) => !removeSet.has(c.id))
      changes.push(`Removed ${params.remove.length} criterion/criteria`)
    }

    // Update note
    if (params.updateNote) {
      criteria = criteria.map((c: any) =>
        c.id === params.updateNote!.criterionId
          ? { ...c, note: params.updateNote!.note }
          : c
      )
      changes.push('Updated criterion note')
    }

    await db.update(dealLogs)
      .set({ successCriteriaTodos: criteria, updatedAt: new Date() })
      .where(eq(dealLogs.id, params.dealId))

    after(async () => {
      try { await rebuildWorkspaceBrain(ctx.workspaceId) } catch { /* non-fatal */ }
    })

    const achieved = criteria.filter((c: any) => c.achieved).length
    return {
      result: `Success criteria updated on **${deal.dealName}** (${achieved}/${criteria.length} met):\n${changes.map(c => `- ${c}`).join('\n')}`,
      actions: [{
        type: 'deal_updated',
        dealId: params.dealId,
        dealName: deal.dealName,
        changes,
      }],
      uiHint: 'refresh_deals',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// correct_deal_data
// ─────────────────────────────────────────────────────────────────────────────

export const correct_deal_data = {
  description: 'Correct or override specific data on a deal. Use when the user says something is wrong and needs fixing — risks, contacts, summary, competitors, or any field. Applies the correction immediately without questioning.',
  parameters: z.object({
    dealId: z.string().describe('The UUID of the deal'),
    replaceRisks: z.array(z.string()).optional().describe('Complete replacement for deal risks. Pass [] to clear all risks.'),
    replaceSummary: z.string().optional().describe('New AI summary to replace the current one'),
    replaceNextSteps: z.string().optional().describe('New next steps'),
    replaceCompetitors: z.array(z.string()).optional().describe('Complete replacement for competitors array'),
    removeContactIds: z.array(z.string()).optional().describe('Contact IDs to remove'),
    updateContact: z.object({
      contactId: z.string(),
      name: z.string().optional(),
      title: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      role: z.string().optional(),
    }).optional().describe('Update a specific contact\'s details'),
    resetConversionScore: z.boolean().optional().describe('Set to true to clear the conversion score and insights (reset to null). Use when the AI wrongly set a score.'),
    replaceConversionScore: z.number().optional().describe('Override the conversion score (0-100). Only use when the user explicitly provides a score.'),
    replaceConversionInsights: z.array(z.string()).optional().describe('Replace conversion insights entirely. Pass [] to clear.'),
    replaceMeetingNotes: z.string().optional().describe('Replace the entire meeting history (Activity Log). Use when the user says the history is wrong/corrupted.'),
    replaceProjectPlan: z.object({
      phases: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        targetDate: z.string().optional(),
        tasks: z.array(z.object({
          text: z.string(),
          status: z.string().optional().describe('pending, in_progress, or complete'),
          owner: z.string().optional(),
          dueDate: z.string().optional(),
          notes: z.string().optional(),
        })).optional(),
      })),
    }).nullable().optional().describe('Completely replace the project plan. Pass null to clear it. Use when user says "reset project plan" or "replace the project plan".'),
    clearProjectPlan: z.boolean().optional().describe('Set true to completely wipe the project plan'),
    replaceStage: stageEnum.optional().describe('Override the deal stage'),
    correctionNote: z.string().optional().describe('Why this correction was made — appended to meeting notes for audit trail'),
  }),
  execute: async (
    params: {
      dealId: string
      replaceRisks?: string[]
      replaceSummary?: string
      replaceNextSteps?: string
      replaceCompetitors?: string[]
      removeContactIds?: string[]
      updateContact?: { contactId: string; name?: string; title?: string; email?: string; phone?: string; role?: string }
      resetConversionScore?: boolean
      replaceConversionScore?: number
      replaceConversionInsights?: string[]
      replaceMeetingNotes?: string
      replaceProjectPlan?: { phases: { name: string; description?: string; targetDate?: string; tasks?: { text: string; status?: string; owner?: string; dueDate?: string; notes?: string }[] }[] } | null
      clearProjectPlan?: boolean
      replaceStage?: string
      correctionNote?: string
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const [deal] = await db
      .select()
      .from(dealLogs)
      .where(and(eq(dealLogs.id, params.dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
      .limit(1)

    if (!deal) return { result: 'Deal not found.' }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() }
    const corrections: string[] = []

    if (params.replaceRisks !== undefined) {
      updateFields.dealRisks = params.replaceRisks
      corrections.push(`Risks replaced (${params.replaceRisks.length} total)`)
    }
    if (params.replaceSummary) {
      updateFields.aiSummary = params.replaceSummary
      corrections.push('Summary corrected')
    }
    if (params.replaceNextSteps) {
      updateFields.nextSteps = params.replaceNextSteps
      corrections.push('Next steps corrected')
    }
    if (params.replaceCompetitors !== undefined) {
      updateFields.competitors = params.replaceCompetitors
      corrections.push(`Competitors corrected (${params.replaceCompetitors.length} total)`)
    }

    // Remove contacts
    if (params.removeContactIds?.length) {
      const removeSet = new Set(params.removeContactIds)
      const contacts = ((deal.contacts as any[]) ?? []).filter((c: any) => !removeSet.has(c.id))
      updateFields.contacts = contacts
      corrections.push(`Removed ${params.removeContactIds.length} contact(s)`)
    }

    // Update a contact
    if (params.updateContact) {
      const { contactId, ...updates } = params.updateContact
      const contacts = ((deal.contacts as any[]) ?? []).map((c: any) => {
        if (c.id !== contactId) return c
        const upd = { ...c }
        if (updates.name) upd.name = updates.name
        if (updates.title) upd.title = updates.title
        if (updates.email) upd.email = updates.email
        if (updates.phone) upd.phone = updates.phone
        if (updates.role) upd.role = updates.role
        return upd
      })
      updateFields.contacts = contacts
      corrections.push('Contact details updated')
    }

    // Reset or replace conversion score
    if (params.resetConversionScore) {
      updateFields.conversionScore = null
      updateFields.conversionInsights = []
      updateFields.conversionScorePinned = false  // unlock so AI can re-score
      corrections.push('Conversion score cleared — AI will re-score on next update')
    } else if (params.replaceConversionScore !== undefined) {
      updateFields.conversionScore = Math.max(0, Math.min(100, params.replaceConversionScore))
      updateFields.conversionScorePinned = true   // pin — AI must not overwrite this
      corrections.push(`Conversion score pinned at ${params.replaceConversionScore}%`)
    }
    if (params.replaceConversionInsights !== undefined) {
      updateFields.conversionInsights = params.replaceConversionInsights
      corrections.push(`Conversion insights replaced (${params.replaceConversionInsights.length} total)`)
    }

    // Replace meeting history entirely
    if (params.replaceMeetingNotes !== undefined) {
      updateFields.meetingNotes = params.replaceMeetingNotes || null
      corrections.push('Activity log / meeting history replaced')
    }

    // Replace or clear project plan entirely
    if (params.clearProjectPlan || params.replaceProjectPlan === null) {
      updateFields.projectPlan = null
      corrections.push('Project plan cleared')
    } else if (params.replaceProjectPlan) {
      const newPlan = {
        phases: params.replaceProjectPlan.phases.map(phase => ({
          name: phase.name,
          description: phase.description ?? '',
          targetDate: phase.targetDate ?? null,
          tasks: (phase.tasks ?? []).map(t => ({
            id: crypto.randomUUID(),
            text: t.text,
            status: t.status ?? 'pending',
            owner: t.owner ?? null,
            dueDate: t.dueDate ?? null,
            notes: t.notes ?? '',
            createdAt: new Date().toISOString(),
          })),
        })),
      }
      updateFields.projectPlan = newPlan
      const taskCount = newPlan.phases.reduce((sum, p) => sum + p.tasks.length, 0)
      corrections.push(`Project plan replaced: ${newPlan.phases.length} phase(s), ${taskCount} task(s)`)
    }

    // Override stage
    if (params.replaceStage) {
      updateFields.stage = params.replaceStage
      if (params.replaceStage === 'closed_won') updateFields.wonDate = new Date()
      if (params.replaceStage === 'closed_lost') updateFields.lostDate = new Date()
      corrections.push(`Stage corrected to ${params.replaceStage}`)
    }

    // Correction note is logged server-side only, not appended to meeting history
    // Meeting history should only contain real interactions, not system corrections
    if (params.correctionNote) {
      console.log(`[correct_deal_data] ${deal.dealName}: ${params.correctionNote}`)
    }

    if (corrections.length === 0) {
      return { result: 'No corrections specified.' }
    }

    await db.update(dealLogs).set(updateFields).where(eq(dealLogs.id, params.dealId))

    after(async () => {
      try { await rebuildWorkspaceBrain(ctx.workspaceId) } catch { /* non-fatal */ }
    })

    return {
      result: `Corrected **${deal.dealName}**:\n${corrections.map(c => `- ${c}`).join('\n')}`,
      actions: [{
        type: 'deal_updated',
        dealId: params.dealId,
        dealName: deal.dealName,
        changes: corrections,
      }],
      uiHint: 'refresh_deals',
    }
  },
}
