/**
 * Consolidated Deal Tools — 5 tools only
 *
 * 1. get_deal       — Look up any deal's full context
 * 2. update_deal    — ONE tool for ALL deal mutations
 * 3. search_deals   — Find deals by name, company, or contact
 * 4. generate_content — Create battlecards, emails, talking points
 * 5. answer_question — Answer pipeline questions using brain context
 */

import { z } from 'zod'
import { eq, and, or, ilike } from 'drizzle-orm'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { dealLogs, productGaps, companyProfiles, competitors } from '@/lib/db/schema'
import { anthropic } from '@/lib/ai/client'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import { requestBrainRebuild } from '@/lib/brain-rebuild'
import { recordSignalOutcome } from '@/lib/pattern-memory'
import { extractTextSignals, heuristicScore } from '@/lib/text-signals'
import { computeCompositeScore } from '@/lib/deal-ml'
import { buildDealBriefing, scoreNarrationPrompt } from '@/lib/brain-narrator'
import { generateCollateral, generateFreeformCollateral } from '@/lib/ai/generate'
import { clearManualBriefOverride, setManualBriefOverride } from '@/lib/brief-override'
import { upsertCollateral } from '@/lib/collateral-helpers'
import { executeWithVerification } from '@/lib/ai/tool-wrapper'
import type { ToolContext, ToolResult } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Shared constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVE_STAGES = ['prospecting', 'qualification', 'discovery', 'proposal', 'negotiation']

function stageToNorm(stage: string | null | undefined, pipelineStages?: string[]): number {
  if (!stage) return 0.5
  const stages = pipelineStages ?? ACTIVE_STAGES
  const idx = stages.indexOf(stage)
  if (idx === -1) return 0.5
  return stages.length > 1 ? idx / (stages.length - 1) : 0.5
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Score computation (reused by multiple mutation paths)
// ─────────────────────────────────────────────────────────────────────────────

async function computeAndUpdateScore(
  dealId: string,
  workspaceId: string,
  allText: string,
  createdAt: Date,
  stage: string | null | undefined,
  ctx: ToolContext,
  intentSignals?: any,
): Promise<{ score?: number; insights?: string[] }> {
  try {
    if (allText.length < 20) return {}
    const signals = extractTextSignals(allText, createdAt, new Date())
    const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)
    const mlPred = brain?.mlPredictions?.find((p: any) => p.dealId === dealId)
    const sNorm = stageToNorm(stage)
    let finalScore: number
    if (mlPred && brain?.mlModel) {
      const { composite } = computeCompositeScore(
        heuristicScore(signals, sNorm),
        mlPred.winProbability,
        brain.mlModel.trainingSize,
      )
      finalScore = composite
    } else {
      finalScore = heuristicScore(signals, sNorm)
    }

    // Intent signal adjustments
    if (intentSignals) {
      if (intentSignals.championStatus === 'confirmed') finalScore = Math.min(100, finalScore + 6)
      if (intentSignals.championStatus === 'suspected') finalScore = Math.min(100, finalScore + 3)
      if (intentSignals.budgetStatus === 'approved') finalScore = Math.min(100, finalScore + 8)
      if (intentSignals.budgetStatus === 'awaiting') finalScore = Math.min(100, finalScore + 2)
      if (intentSignals.budgetStatus === 'blocked') finalScore = Math.max(0, finalScore - 8)
      if (intentSignals.nextMeetingBooked) finalScore = Math.min(100, finalScore + 3)
    }

    const score = Math.max(0, Math.min(100, Math.round(finalScore)))

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
      conversionScore: score,
      conversionInsights: insights,
    }).where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))

    return { score, insights }
  } catch { return {} }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Process meeting notes via LLM extraction (moved from old process_meeting_notes)
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
  closeDateUpdate: z.object({
    newDate: z.string().nullable(),
    reason: z.string(),
  }).nullable().optional(),
  scheduledEvents: z.array(z.object({
    type: z.enum(['meeting', 'follow_up', 'deadline', 'demo', 'decision']).default('meeting'),
    description: z.string(),
    date: z.string().describe('ISO date YYYY-MM-DD'),
    time: z.string().nullable().optional().describe('HH:MM 24-hour or null'),
    participants: z.array(z.string()).default([]),
  })).optional().default([]),
})

/**
 * Full meeting notes processing pipeline: LLM extraction, merge, scoring, insights.
 * Returns the changes made for reporting.
 */
async function processMeetingNotesHelper(
  notes: string,
  deal: any,
  ctx: ToolContext,
): Promise<{ updateFields: Record<string, unknown>; changes: string[]; parsed: z.infer<typeof MeetingNotesSchema> }> {
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

  const criteria = (deal.successCriteriaTodos as any[]) ?? []
  const openCriteria = criteria.filter((c: any) => !c.achieved)
  const existingCriteriaContext = openCriteria.length > 0
    ? `\n\nOPEN SUCCESS CRITERIA (mark achieved if meeting notes confirm they were demonstrated/met):\n${openCriteria.map((c: any) => `- [${c.id}] ${c.text} (${c.category})`).join('\n')}`
    : ''

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

  // LLM extraction
  const extractionMsg = await anthropic.messages.create({
    model: 'gpt-5.4-mini',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Extract structured data from these sales meeting notes. Return ONLY valid JSON.

Today's date is ${new Date().toISOString().split('T')[0]}.

DEFINITIONS — read these carefully:
- DEAL RISKS: Concerns about whether this deal will CLOSE. Examples: budget freeze, champion leaving, competitor preferred, timeline slipping, decision-maker disengaged. NOT about product features.
- PRODUCT GAPS: Features/capabilities that OUR PRODUCT is MISSING that the prospect explicitly said they need. Only if they said "your product can't do X" or "we need X and you don't have it". NOT general concerns or nice-to-haves.
- ACTION ITEMS: Specific things someone needs to DO. Preserve exact wording.

${previousContext ? `${previousContext}\n\n---\n\n` : ''}NEW MEETING NOTES:
${notes}

Deal: ${deal.dealName} with ${deal.prospectCompany} (current stage: ${deal.stage}${deal.closeDate ? `, current close date: ${new Date(deal.closeDate).toISOString().split('T')[0]}` : ''})${capabilitiesContext}${existingTodosContext}${existingCriteriaContext}${existingProjectPlanContext}

Return this exact JSON:
{
  "summary": "2-4 sentence factual summary preserving key specifics",
  "risks": ["NEW deal-closing risks only"],
  "resolvedRisks": ["substring matching existing risk now resolved"],
  "todos": [{"text": "Exact action item preserving original wording"}],
  "obsoleteTodoIds": ["id-of-existing-todo-now-done"],
  "productGaps": [{"title": "Missing feature", "description": "What we can't do", "priority": "high"}],
  "competitors": ["competitor name only if explicitly evaluated"],
  "intentSignals": {
    "championStatus": "confirmed|suspected|none",
    "budgetStatus": "approved|awaiting|not_discussed|blocked",
    "decisionTimeline": "e.g. Q2 2026 or null",
    "nextMeetingBooked": false
  },
  "criteriaUpdates": [{"criterionId": "id", "achieved": true, "note": "Demonstrated"}],
  "projectPlanUpdates": [{"taskId": "id", "status": "complete", "note": "Done"}],
  "suggestedStage": "null if no stage change",
  "stageReason": "null",
  "closeDateUpdate": {"newDate": "null if no change", "reason": "reason"},
  "scheduledEvents": [{"type": "meeting", "description": "...", "date": "YYYY-MM-DD", "time": "HH:MM", "participants": []}]
}

Rules:
- PRESERVE EXACT WORDING from the notes for todos.
- risks: NEW risks from these notes ONLY. Return [] if none.
- resolvedRisks: if a known risk is now resolved, add substring here.
- todos: New items only, no duplicates. Return [] if none.
- productGaps: ONLY explicit product gaps. Return [] if none.
- competitors: Only if named as alternative being evaluated. Return [] if none.
- intentSignals: Extract ONLY what is explicitly stated.
- criteriaUpdates: ONLY if clearly demonstrated. Return [] if none.
- projectPlanUpdates: If notes describe completing/progressing a task, match by ID. Return [] if none.
- suggestedStage: ONLY if notes clearly imply stage transition. Return null otherwise.
- closeDateUpdate: If timeline change mentioned. Return null if none.
- scheduledEvents: Extract dated events. Resolve relative dates. Return [] if none.
- DO NOT infer things that weren't said.`,
    }],
  })

  const rawText = ((extractionMsg.content[0] as any).text ?? '').trim()

  let parsed: z.infer<typeof MeetingNotesSchema>
  try {
    const jsonStr = rawText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
    const braceIdx = jsonStr.indexOf('{')
    const cleanJson = braceIdx > 0 ? jsonStr.slice(braceIdx) : jsonStr
    const result = MeetingNotesSchema.safeParse(JSON.parse(cleanJson))
    if (result.success) {
      parsed = result.data
    } else {
      const retryMsg = await anthropic.messages.create({
        model: 'gpt-5.4-mini',
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

  const appendedNotes = deal.meetingNotes ? `${deal.meetingNotes}\n---\n${compactEntry}` : compactEntry

  // Merge todos
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

  // Smart risk merge
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

  // Merge scheduled events
  if ((parsed.scheduledEvents ?? []).length > 0) {
    const existingEvents = ((deal as any).scheduledEvents as any[]) ?? []
    const existingEvtKeys = new Set(existingEvents.map((e: any) => `${e.date}|${e.description?.slice(0, 40).toLowerCase()}`))
    const newEvents = (parsed.scheduledEvents ?? [])
      .filter(e => e.date && e.description)
      .map(e => ({ ...e, id: crypto.randomUUID(), extractedAt: new Date().toISOString() }))
      .filter(e => !existingEvtKeys.has(`${e.date}|${e.description.slice(0, 40).toLowerCase()}`))
    if (newEvents.length > 0) {
      updateFields.scheduledEvents = [...existingEvents, ...newEvents]
    }
  }

  // Apply success criteria updates
  if (parsed.criteriaUpdates?.length) {
    const criteriaUpdateMap = new Map(parsed.criteriaUpdates.map(u => [u.criterionId, u]))
    const existingCriteriaArr = ((deal.successCriteriaTodos as any[]) ?? []).slice()
    const updatedCriteria = existingCriteriaArr.map((c: any) => {
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

  // Apply project plan task updates
  if (parsed.projectPlanUpdates?.length) {
    const taskUpdateMap = new Map(parsed.projectPlanUpdates.map(u => [u.taskId, u]))
    const existingPlan = (deal.projectPlan as any) ?? { phases: [] }
    const textFallbackMap = new Map<string, typeof parsed.projectPlanUpdates[0]>()
    for (const u of parsed.projectPlanUpdates) {
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
          let update = taskUpdateMap.get(task.id)
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

  // Apply close date update — guard against LLM returning literal string "null"
  if (parsed.closeDateUpdate?.newDate && parsed.closeDateUpdate.newDate !== 'null') {
    const d = new Date(parsed.closeDateUpdate.newDate)
    if (!isNaN(d.getTime())) {
      if (d.getFullYear() < 100) d.setFullYear(d.getFullYear() + 2000)
      updateFields.closeDate = d
    }
  }

  // Score computation (unless pinned)
  if (!(deal as any).conversionScorePinned) {
    await computeAndUpdateScore(
      deal.id, ctx.workspaceId, appendedNotes,
      deal.createdAt ?? new Date(),
      (updateFields.stage as string | undefined) ?? deal.stage,
      ctx, parsed.intentSignals,
    )
  }

  // Regenerate conversion insights
  try {
    const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)
    const currentScore = (updateFields.conversionScore as number | undefined) ?? (deal as any).conversionScore ?? 50
    const signals = extractTextSignals(appendedNotes, deal.createdAt ?? new Date(), new Date())
    const briefing = buildDealBriefing(brain ?? null, deal.id, {
      dealName: deal.dealName,
      company: deal.prospectCompany ?? '',
      stage: (updateFields.stage as string | undefined) ?? deal.stage,
      dealRisks: mergedRisks,
      dealCompetitors: mergedCompetitors ?? (deal.competitors as string[]) ?? [],
      conversionScore: currentScore,
      meetingNotes: appendedNotes,
    }, signals)
    const narrationMsg = await anthropic.messages.create({
      model: 'gpt-5.4-mini',
      max_tokens: 400,
      messages: [{ role: 'user', content: scoreNarrationPrompt(briefing) }],
    })
    const narration = (narrationMsg.content[0] as any)?.text?.trim() ?? ''
    const freshInsights = narration
      .split('\n')
      .map((l: string) => l.replace(/^[-•*·]\s*/, '').trim())
      .filter((l: string) => l.length > 8)
      .filter((l: string) => !/\d+\/100/i.test(l))
      .slice(0, 3)
    if (freshInsights.length > 0) {
      updateFields.conversionInsights = freshInsights
    }
  } catch { /* non-fatal */ }

  // Generate embeddings AFTER the main update (raw SQL needed for pgvector)
  const _embDealId = deal.id
  const _embWorkspaceId = ctx.workspaceId
  const _embNotes = appendedNotes
  const _embDeal = deal
  const _embStage = updateFields.stage || deal.stage || ''
  const _embSignals = updateFields.intentSignals ?? deal.intentSignals
  // Generate embeddings in after() — setTimeout is killed by Vercel serverless
  after(async () => {
    try {
      const { generateEmbedding, generateDealEmbedding } = await import('@/lib/openai-embeddings')
      const { sql: rawSql } = await import('drizzle-orm')
      const noteEmb = await generateEmbedding(_embNotes)
      const dealEmb = await generateDealEmbedding({
        name: _embDeal.dealName || '',
        company: _embDeal.prospectCompany || '',
        stage: String(_embStage),
        meetingNotes: _embNotes,
        signals: _embSignals,
      })
      const noteVec = `'[${noteEmb.join(',')}]'::vector`
      const dealVec = `'[${dealEmb.join(',')}]'::vector`
      await db.execute(rawSql.raw(
        `UPDATE deal_logs SET note_embedding = ${noteVec}, deal_embedding = ${dealVec} WHERE id = '${_embDealId}' AND workspace_id = '${_embWorkspaceId}'`
      ))
      console.log(`[embeddings] Generated for deal ${_embDealId}`)
    } catch (err) {
      console.error('[embeddings] Failed to generate embeddings:', err)
    }
  })

  // Build changes summary
  const changes: string[] = []
  if (parsed.summary) changes.push(`Summary updated`)
  if (parsed.risks.length > 0) changes.push(`${parsed.risks.length} new risk(s) identified`)
  if (dedupedNew.length > 0) changes.push(`${dedupedNew.length} new action item(s)`)
  if (obsoleteIds.size > 0) changes.push(`${obsoleteIds.size} obsolete todo(s) removed`)
  if (newComps.length > 0) changes.push(`Competitors: ${newComps.join(', ')}`)
  if (parsed.criteriaUpdates?.length) {
    const achievedCount = parsed.criteriaUpdates.filter(u => u.achieved).length
    if (achievedCount > 0) changes.push(`${achievedCount} success criteria achieved`)
  }
  if (parsed.projectPlanUpdates?.length) changes.push(`${parsed.projectPlanUpdates.length} project plan task(s) updated`)
  if (parsed.suggestedStage && parsed.suggestedStage !== deal.stage) changes.push(`Stage: ${deal.stage} → ${parsed.suggestedStage}`)
  if (parsed.closeDateUpdate?.newDate) changes.push(`Close date updated`)
  if ((parsed.scheduledEvents ?? []).length > 0) changes.push(`${(parsed.scheduledEvents ?? []).length} calendar event(s) extracted`)

  return { updateFields, changes, parsed }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 1: get_deal
// ─────────────────────────────────────────────────────────────────────────────

export const get_deal = {
  description: 'Look up any deal\'s full context by ID or name. Returns full deal data including score, stage, contacts, todos, notes summary, risks, signals, project plan, and success criteria.',
  parameters: z.object({
    dealId: z.string().optional().describe('The UUID of the deal'),
    dealName: z.string().optional().describe('Deal name or company name to search for'),
  }),
  execute: async (
    params: { dealId?: string; dealName?: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    let deal: any = null
    const searchTerm = params.dealId || params.dealName

    if (!searchTerm) {
      return { result: 'Please provide a dealId or dealName to look up.' }
    }

    // If it looks like a UUID, direct lookup
    if (UUID_RE.test(searchTerm)) {
      const [row] = await db
        .select()
        .from(dealLogs)
        .where(and(eq(dealLogs.id, searchTerm), eq(dealLogs.workspaceId, ctx.workspaceId)))
        .limit(1)
      deal = row
    }

    // If no UUID match, search by name/company
    if (!deal) {
      const term = params.dealName || params.dealId || ''
      const pattern = `%${term}%`
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
        const summaries = matches.map(d => formatDealSummary(d, ctx.stageLabels))
        return {
          result: `Found **${matches.length}** deals matching "${term}". Which one?\n\n${summaries.join('\n\n')}`,
        }
      }
    }

    if (!deal) {
      return { result: `Deal "${searchTerm}" not found. Try searching with a different name.` }
    }

    return { result: formatDealDetailed(deal, ctx.stageLabels) }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 2: update_deal — ONE tool for ALL deal mutations
// ─────────────────────────────────────────────────────────────────────────────

export const update_deal = {
  description: `ONE tool for ALL deal mutations. Handles notes, todos, stage, value, contacts, close date, corrections, project plan, success criteria, and more. Pass ALL changes in the "changes" object in one call. When "addNote" is provided, full meeting notes processing runs automatically (extracts todos, risks, signals, updates score). For corrections (user says "that's wrong"), use the replace* fields.`,
  parameters: z.object({
    dealId: z.string().describe('The UUID of the deal to update'),
    changes: z.object({
      // --- Append / Add operations ---
      addNote: z.string().optional().describe('Meeting notes or update text to process. Triggers full LLM extraction (todos, risks, signals, score). Preserve user\'s exact wording.'),
      addTodo: z.union([z.string(), z.array(z.string())]).optional().describe('Todo item(s) to add. Preserve exact user wording.'),
      completeTodo: z.union([z.string(), z.array(z.string())]).optional().describe('Todo text(s) to mark as completed (fuzzy matched)'),
      removeTodo: z.union([z.string(), z.array(z.string())]).optional().describe('Todo text(s) to remove (fuzzy matched)'),
      addContact: z.object({
        name: z.string(),
        role: z.string().optional(),
        title: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
      }).optional().describe('Add a contact to the deal'),
      // --- Set operations (simple field updates) ---
      setStage: z.string().optional().describe('Set deal stage'),
      setValue: z.number().optional().describe('Set deal value in dollars'),
      setCloseDate: z.string().optional().describe('Set close date (ISO or natural date)'),
      setNextSteps: z.string().optional().describe('Set next steps text'),
      setLostReason: z.string().optional().describe('Set lost reason (only for closed_lost)'),
      appendNotes: z.string().optional().describe('Append to the general Notes field (NOT meeting notes processing)'),
      // --- Correction / Replace operations ---
      replaceSummary: z.string().optional().describe('Replace the AI summary'),
      replaceRisks: z.array(z.string()).optional().describe('Replace all deal risks. Pass [] to clear.'),
      replaceCompetitors: z.array(z.string()).optional().describe('Replace competitors array'),
      replaceNextSteps: z.string().optional().describe('Replace next steps'),
      removeContactIds: z.array(z.string()).optional().describe('Contact IDs to remove'),
      updateContact: z.object({
        contactId: z.string(),
        name: z.string().optional(),
        title: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        role: z.string().optional(),
      }).optional().describe('Update a specific contact'),
      resetConversionScore: z.boolean().optional().describe('Clear score + insights so AI can re-score'),
      replaceConversionScore: z.number().optional().describe('Pin score at this value (0-100)'),
      replaceConversionInsights: z.array(z.string()).optional().describe('Replace insights array'),
      replaceMeetingNotes: z.string().optional().describe('Replace entire meeting history'),
      // --- Project plan ---
      addProjectPhase: z.object({
        name: z.string(),
        description: z.string().optional(),
        targetDate: z.string().optional(),
        tasks: z.array(z.object({
          text: z.string(),
          owner: z.string().optional(),
          dueDate: z.string().optional(),
        })).optional(),
      }).optional().describe('Add a phase to the project plan'),
      addProjectTasks: z.object({
        phaseName: z.string().optional(),
        tasks: z.array(z.object({
          text: z.string(),
          owner: z.string().optional(),
          dueDate: z.string().optional(),
        })),
      }).optional().describe('Add tasks to a project plan phase'),
      updateProjectTask: z.object({
        taskId: z.string(),
        status: z.string().optional(),
        text: z.string().optional(),
        owner: z.string().optional(),
        notes: z.string().optional(),
      }).optional().describe('Update a project plan task'),
      replaceProjectPlan: z.object({
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
      }).nullable().optional().describe('Replace entire project plan. Pass null to clear.'),
      clearProjectPlan: z.boolean().optional().describe('Clear the project plan entirely'),
      // --- Success criteria ---
      addSuccessCriteria: z.array(z.object({
        text: z.string(),
        category: z.string().optional(),
      })).optional().describe('Add success criteria'),
      achieveCriteria: z.array(z.string()).optional().describe('Criterion IDs to mark achieved'),
      removeCriteria: z.array(z.string()).optional().describe('Criterion IDs to remove'),
      // --- Deal creation fields (for create/import) ---
      dealName: z.string().optional().describe('Deal name (for creating new deals)'),
      prospectCompany: z.string().optional().describe('Company name (for creating new deals)'),
      // --- Delete ---
      deleteDeal: z.boolean().optional().describe('Delete this deal permanently'),
    }),
  }),
  execute: async (
    params: { dealId: string; changes: any },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const c = params.changes
    const dealId = params.dealId

    // Handle deletion separately
    if (c.deleteDeal) {
      const [deal] = await db
        .select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany })
        .from(dealLogs)
        .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
        .limit(1)
      if (!deal) return { result: `TOOL FAILED: Deal not found.` }

      await db.delete(dealLogs).where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
      after(async () => { await requestBrainRebuild(ctx.workspaceId, 'deal_tool_call') })
      return {
        result: `Deal **${deal.dealName}** has been permanently deleted.`,
        actions: [{ type: 'deal_deleted', dealId, dealName: deal.dealName }],
        uiHint: 'refresh_deals',
      }
    }

    // Verify deal exists
    const verifyResult = await executeWithVerification(
      'update_deal', ctx.workspaceId, dealId,
      async () => {
        return await db.select().from(dealLogs)
          .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
          .limit(1)
      },
    )
    if (!verifyResult.success) {
      return { result: verifyResult.error! }
    }
    const deal = verifyResult.result

    const updateFields: Record<string, unknown> = { updatedAt: new Date() }
    const changesList: string[] = []

    // ── addNote: full meeting notes processing ──────────────────────────
    if (c.addNote) {
      const { updateFields: noteFields, changes: noteChanges, parsed } = await processMeetingNotesHelper(c.addNote, deal, ctx)
      Object.assign(updateFields, noteFields)
      updateFields.dealReview = clearManualBriefOverride(
        (updateFields.dealReview as Record<string, unknown> | null | undefined)
          ?? (deal.dealReview as Record<string, unknown> | null | undefined),
      )
      changesList.push(...noteChanges)

      // Create product gaps
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
        changesList.push(`Product gap: ${gap.title}`)
      }
    }

    // ── Todo operations ─────────────────────────────────────────────────
    if (c.addTodo || c.completeTodo || c.removeTodo) {
      let todos = ((updateFields.todos as any[]) ?? (deal.todos as any[]) ?? []).slice()

      const fuzzyFind = (text: string) => {
        const norm = normalize(text)
        return todos.find((t: any) => normalize(t.text).includes(norm) || norm.includes(normalize(t.text)))
      }

      // Complete
      const completeItems = Array.isArray(c.completeTodo) ? c.completeTodo : c.completeTodo ? [c.completeTodo] : []
      for (const text of completeItems) {
        const match = fuzzyFind(text)
        if (match && !match.done) {
          match.done = true
          match.completedAt = new Date().toISOString()
          changesList.push(`Completed todo: "${text}"`)
        }
      }

      // Remove
      const removeItems = Array.isArray(c.removeTodo) ? c.removeTodo : c.removeTodo ? [c.removeTodo] : []
      for (const text of removeItems) {
        const match = fuzzyFind(text)
        if (match) {
          todos = todos.filter((t: any) => t.id !== match.id)
          changesList.push(`Removed todo: "${text}"`)
        }
      }

      // Add
      const addItems = Array.isArray(c.addTodo) ? c.addTodo : c.addTodo ? [c.addTodo] : []
      const existingTodoKeys = new Set(todos.map((t: any) => normalize(t.text)))
      for (const text of addItems) {
        if (!existingTodoKeys.has(normalize(text))) {
          todos.push({
            id: crypto.randomUUID(),
            text,
            done: false,
            createdAt: new Date().toISOString(),
          })
          changesList.push(`Added todo: "${text}"`)
        }
      }

      updateFields.todos = todos
    }

    // ── Add contact ─────────────────────────────────────────────────────
    if (c.addContact) {
      const contacts = ((deal.contacts as any[]) ?? []).slice()
      const newContact: Record<string, string> = {
        id: crypto.randomUUID(),
        name: c.addContact.name,
      }
      if (c.addContact.title) newContact.title = c.addContact.title
      if (c.addContact.email) newContact.email = c.addContact.email
      if (c.addContact.phone) newContact.phone = c.addContact.phone
      if (c.addContact.role) newContact.role = c.addContact.role
      contacts.push(newContact)
      updateFields.contacts = contacts
      changesList.push(`Added contact: ${c.addContact.name}${c.addContact.role ? ` (${c.addContact.role})` : ''}`)
    }

    // ── Simple set operations ───────────────────────────────────────────
    if (c.setStage) {
      updateFields.stage = c.setStage
      if (c.setStage === 'closed_won') updateFields.wonDate = new Date()
      if (c.setStage === 'closed_lost') updateFields.lostDate = new Date()
      changesList.push(`Stage → ${c.setStage}`)
    }
    if (c.setValue !== undefined) {
      updateFields.dealValue = c.setValue
      changesList.push(`Value → $${c.setValue.toLocaleString()}`)
    }
    if (c.setCloseDate) {
      const cd = new Date(c.setCloseDate)
      if (!isNaN(cd.getTime())) {
        if (cd.getFullYear() < 100) cd.setFullYear(cd.getFullYear() + 2000)
        updateFields.closeDate = cd
      }
      changesList.push(`Close date → ${c.setCloseDate}`)
    }
    if (c.setNextSteps) {
      updateFields.nextSteps = c.setNextSteps
      changesList.push('Next steps updated')
    }
    if (c.setLostReason) {
      updateFields.lostReason = c.setLostReason
      changesList.push(`Lost reason: ${c.setLostReason}`)
    }
    if (c.appendNotes) {
      const existingNotes = deal.notes ?? ''
      updateFields.notes = existingNotes ? `${existingNotes}\n\n${c.appendNotes}` : c.appendNotes
      updateFields.dealReview = clearManualBriefOverride(
        (updateFields.dealReview as Record<string, unknown> | null | undefined)
          ?? (deal.dealReview as Record<string, unknown> | null | undefined),
      )
      changesList.push('Notes appended')
    }

    // ── Correction / Replace operations ─────────────────────────────────
    if (c.replaceSummary) {
      updateFields.aiSummary = c.replaceSummary
      updateFields.dealReview = setManualBriefOverride(
        (updateFields.dealReview as Record<string, unknown> | null | undefined)
          ?? (deal.dealReview as Record<string, unknown> | null | undefined),
        c.replaceSummary,
        'agent',
      )
      changesList.push('Summary replaced')
    }
    if (c.replaceRisks !== undefined) {
      updateFields.dealRisks = c.replaceRisks
      changesList.push(`Risks replaced (${c.replaceRisks.length} total)`)
    }
    if (c.replaceCompetitors !== undefined) {
      updateFields.competitors = c.replaceCompetitors
      changesList.push(`Competitors replaced (${c.replaceCompetitors.length} total)`)
    }
    if (c.replaceNextSteps) {
      updateFields.nextSteps = c.replaceNextSteps
      changesList.push('Next steps replaced')
    }
    if (c.removeContactIds?.length) {
      const removeSet = new Set(c.removeContactIds)
      const contacts = ((deal.contacts as any[]) ?? []).filter((ct: any) => !removeSet.has(ct.id))
      updateFields.contacts = contacts
      changesList.push(`Removed ${c.removeContactIds.length} contact(s)`)
    }
    if (c.updateContact) {
      const { contactId, ...updates } = c.updateContact
      const contacts = ((deal.contacts as any[]) ?? []).map((ct: any) => {
        if (ct.id !== contactId) return ct
        const upd = { ...ct }
        if (updates.name) upd.name = updates.name
        if (updates.title) upd.title = updates.title
        if (updates.email) upd.email = updates.email
        if (updates.phone) upd.phone = updates.phone
        if (updates.role) upd.role = updates.role
        return upd
      })
      updateFields.contacts = contacts
      changesList.push('Contact updated')
    }
    if (c.resetConversionScore) {
      updateFields.conversionScore = null
      updateFields.conversionInsights = []
      updateFields.conversionScorePinned = false
      changesList.push('Conversion score cleared — AI will re-score')
    } else if (c.replaceConversionScore !== undefined) {
      updateFields.conversionScore = Math.max(0, Math.min(100, c.replaceConversionScore))
      updateFields.conversionScorePinned = true
      changesList.push(`Conversion score pinned at ${c.replaceConversionScore}%`)
    }
    if (c.replaceConversionInsights !== undefined) {
      updateFields.conversionInsights = c.replaceConversionInsights
      changesList.push('Insights replaced')
    }
    if (c.replaceMeetingNotes !== undefined) {
      updateFields.meetingNotes = c.replaceMeetingNotes || null
      updateFields.dealReview = clearManualBriefOverride(
        (updateFields.dealReview as Record<string, unknown> | null | undefined)
          ?? (deal.dealReview as Record<string, unknown> | null | undefined),
      )
      changesList.push('Meeting history replaced')
    }

    // ── Project plan operations ─────────────────────────────────────────
    if (c.clearProjectPlan || c.replaceProjectPlan === null) {
      updateFields.projectPlan = null
      changesList.push('Project plan cleared')
    } else if (c.replaceProjectPlan) {
      const newPlan = {
        phases: c.replaceProjectPlan.phases.map((phase: any) => ({
          id: crypto.randomUUID(),
          name: phase.name,
          description: phase.description ?? '',
          targetDate: phase.targetDate ?? null,
          tasks: (phase.tasks ?? []).map((t: any) => ({
            id: crypto.randomUUID(),
            text: t.text,
            status: t.status ?? 'pending',
            owner: t.owner ?? null,
            dueDate: null,
            notes: '',
            createdAt: new Date().toISOString(),
          })),
        })),
      }
      updateFields.projectPlan = newPlan
      const taskCount = newPlan.phases.reduce((sum: number, p: any) => sum + p.tasks.length, 0)
      changesList.push(`Project plan replaced: ${newPlan.phases.length} phase(s), ${taskCount} task(s)`)
    } else if (c.addProjectPhase) {
      const existing = (deal.projectPlan as any) ?? { phases: [] }
      const newPhase = {
        id: crypto.randomUUID(),
        name: c.addProjectPhase.name,
        description: c.addProjectPhase.description || '',
        targetDate: c.addProjectPhase.targetDate || null,
        tasks: (c.addProjectPhase.tasks ?? []).map((t: any) => ({
          id: crypto.randomUUID(),
          text: t.text,
          status: 'not_started',
          owner: t.owner || null,
          dueDate: t.dueDate || null,
          notes: '',
        })),
      }
      updateFields.projectPlan = { ...existing, phases: [...(existing.phases ?? []), newPhase], updatedAt: new Date().toISOString() }
      changesList.push(`Added phase "${c.addProjectPhase.name}" with ${newPhase.tasks.length} task(s)`)
    } else if (c.addProjectTasks) {
      const existing = (deal.projectPlan as any) ?? { phases: [] }
      let targetPhase = c.addProjectTasks.phaseName
        ? existing.phases?.find((p: any) => p.name.toLowerCase().includes(c.addProjectTasks.phaseName!.toLowerCase()))
        : existing.phases?.[0]
      if (!targetPhase) {
        targetPhase = {
          id: crypto.randomUUID(),
          name: c.addProjectTasks.phaseName || 'Tasks',
          description: '',
          targetDate: null,
          tasks: [],
        }
        existing.phases = [...(existing.phases ?? []), targetPhase]
      }
      const newTasks = c.addProjectTasks.tasks.map((t: any) => ({
        id: crypto.randomUUID(),
        text: t.text,
        status: 'not_started',
        owner: t.owner || null,
        dueDate: t.dueDate || null,
        notes: '',
      }))
      updateFields.projectPlan = {
        ...existing,
        updatedAt: new Date().toISOString(),
        phases: existing.phases.map((p: any) =>
          p.id === targetPhase.id ? { ...p, tasks: [...(p.tasks ?? []), ...newTasks] } : p
        ),
      }
      changesList.push(`Added ${newTasks.length} task(s) to "${targetPhase.name}"`)
    } else if (c.updateProjectTask) {
      const existing = (deal.projectPlan as any) ?? { phases: [] }
      const { taskId, ...updates } = c.updateProjectTask
      updateFields.projectPlan = {
        ...existing,
        updatedAt: new Date().toISOString(),
        phases: (existing.phases ?? []).map((p: any) => ({
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
        })),
      }
      changesList.push(`Updated project task ${taskId}`)
    }

    // ── Success criteria operations ─────────────────────────────────────
    if (c.addSuccessCriteria?.length) {
      const existingCriteria = ((deal.successCriteriaTodos as any[]) ?? []).slice()
      for (const item of c.addSuccessCriteria) {
        existingCriteria.push({
          id: crypto.randomUUID(),
          text: item.text,
          category: item.category || 'General',
          achieved: false,
          note: '',
          createdAt: new Date().toISOString(),
        })
      }
      updateFields.successCriteriaTodos = existingCriteria
      changesList.push(`Added ${c.addSuccessCriteria.length} success criteria`)
    }
    if (c.achieveCriteria?.length) {
      const achieveSet = new Set(c.achieveCriteria)
      const criteria = ((updateFields.successCriteriaTodos as any[]) ?? (deal.successCriteriaTodos as any[]) ?? []).map((ct: any) =>
        achieveSet.has(ct.id) ? { ...ct, achieved: true } : ct
      )
      updateFields.successCriteriaTodos = criteria
      changesList.push(`Marked ${c.achieveCriteria.length} criteria as achieved`)
    }
    if (c.removeCriteria?.length) {
      const removeSet = new Set(c.removeCriteria)
      const criteria = ((updateFields.successCriteriaTodos as any[]) ?? (deal.successCriteriaTodos as any[]) ?? []).filter((ct: any) => !removeSet.has(ct.id))
      updateFields.successCriteriaTodos = criteria
      changesList.push(`Removed ${c.removeCriteria.length} criteria`)
    }

    // ── Execute the update with verification ────────────────────────────
    if (changesList.length === 0) {
      return { result: 'No changes specified.' }
    }

    const writeResult = await executeWithVerification(
      'update_deal', ctx.workspaceId, dealId,
      async () => {
        return await db.update(dealLogs).set(updateFields)
          .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, ctx.workspaceId)))
          .returning({ id: dealLogs.id })
      },
    )

    if (!writeResult.success) {
      return { result: writeResult.error! }
    }

    // Auto-refresh score after mutations if no addNote (addNote already handles scoring)
    if (!c.addNote && !c.resetConversionScore && c.replaceConversionScore === undefined) {
      if (!(deal as any).conversionScorePinned && (c.setStage || c.appendNotes || c.addTodo)) {
        try {
          const allText = [deal.notes, deal.meetingNotes, deal.aiSummary].filter(Boolean).join('\n')
          await computeAndUpdateScore(dealId, ctx.workspaceId, allText, deal.createdAt ?? new Date(), (c.setStage ?? deal.stage), ctx)
        } catch { /* non-fatal */ }
      }
    }

    // Record signal-to-outcome pattern memory when deal is closed via agent
    const finalStage = c.setStage ?? deal.stage
    if (finalStage === 'closed_won' || finalStage === 'closed_lost') {
      after(async () => {
        try { await recordSignalOutcome(dealId, ctx.workspaceId, { ...deal, ...updateFields }) }
        catch { /* non-fatal */ }
      })
    }

    after(async () => {
      await requestBrainRebuild(ctx.workspaceId, 'deal_tool_call')
    })

    return {
      result: `Updated **${deal.dealName}**:\n${changesList.map(ch => `- ${ch}`).join('\n')}`,
      actions: [{
        type: 'deal_updated',
        dealId,
        dealName: deal.dealName,
        changes: changesList,
      }],
      uiHint: 'refresh_deals',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 3: create_deal
// ─────────────────────────────────────────────────────────────────────────────

export const create_deal = {
  description: 'Create a new deal. Requires dealName and prospectCompany at minimum. Returns the created deal with its ID.',
  parameters: z.object({
    dealName: z.string().describe('Name for the deal'),
    prospectCompany: z.string().describe('Company name'),
    prospectName: z.string().optional().describe('Primary contact name'),
    prospectTitle: z.string().optional().describe('Primary contact title'),
    dealValue: z.number().optional().describe('Deal value in currency'),
    stage: z.string().optional().describe('Deal stage (prospecting, qualification, discovery, proposal, negotiation)'),
    notes: z.string().optional().describe('Initial notes or context about the deal'),
    nextSteps: z.string().optional().describe('Next steps for the deal'),
    closeDate: z.string().optional().describe('Expected close date (ISO format)'),
    competitors: z.array(z.string()).optional().describe('Known competitor names'),
  }),
  execute: async (
    params: {
      dealName: string
      prospectCompany: string
      prospectName?: string
      prospectTitle?: string
      dealValue?: number
      stage?: string
      notes?: string
      nextSteps?: string
      closeDate?: string
      competitors?: string[]
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const now = new Date()
    const fixDateYear = (d: Date): Date => { if (d.getFullYear() < 100) d.setFullYear(d.getFullYear() + 2000); return d }
    const safeDate = (v: string | null | undefined): Date | null => v ? fixDateYear(new Date(v)) : null

    const [deal] = await db.insert(dealLogs).values({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      dealName: params.dealName,
      prospectCompany: params.prospectCompany,
      prospectName: params.prospectName ?? null,
      prospectTitle: params.prospectTitle ?? null,
      dealValue: params.dealValue ?? null,
      stage: (params.stage as 'prospecting' | 'qualification' | 'discovery' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost') ?? 'prospecting',
      notes: params.notes ?? null,
      nextSteps: params.nextSteps ?? null,
      closeDate: safeDate(params.closeDate),
      competitors: params.competitors ?? [],
      contacts: [],
      createdAt: now,
      updatedAt: now,
    }).returning()

    after(async () => {
      await requestBrainRebuild(ctx.workspaceId, 'deal_created')
    })

    return {
      result: `Deal **${deal.dealName}** (${deal.prospectCompany}) created successfully.\n\nID: \`${deal.id}\`\nStage: ${deal.stage}\n${deal.dealValue ? `Value: $${deal.dealValue.toLocaleString()}` : ''}`,
      actions: [{
        type: 'deal_created',
        dealId: deal.id,
        dealName: deal.dealName,
        company: deal.prospectCompany,
      }],
      uiHint: 'refresh_deals',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 4: search_deals
// ─────────────────────────────────────────────────────────────────────────────

export const search_deals = {
  description: 'Search for deals by name, company, contact, or stage. Returns a list of matching deals with id, name, company, stage, and score.',
  parameters: z.object({
    searchQuery: z.string().optional().describe('Search term to match against deal name, company, or contact'),
    stage: z.string().optional().describe('Filter by deal stage'),
  }),
  execute: async (
    params: { searchQuery?: string; stage?: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const conditions = [eq(dealLogs.workspaceId, ctx.workspaceId)]

    if (params.stage) {
      conditions.push(eq(dealLogs.stage, params.stage as any))
    }

    if (params.searchQuery) {
      const pattern = `%${params.searchQuery}%`
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
// TOOL 4: generate_content
// ─────────────────────────────────────────────────────────────────────────────

/** Build deal context string for content generation */
async function buildDealContext(dealId: string, workspaceId: string): Promise<string | undefined> {
  const [deal] = await db
    .select()
    .from(dealLogs)
    .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
    .limit(1)

  if (!deal) return undefined

  const lines = [
    `Deal: ${deal.dealName} with ${deal.prospectCompany}`,
    `Stage: ${deal.stage}`,
  ]
  if (deal.dealValue) lines.push(`Value: $${deal.dealValue.toLocaleString()}`)
  if (deal.aiSummary) lines.push(`Summary: ${deal.aiSummary}`)
  const risks = (deal.dealRisks as string[]) ?? []
  if (risks.length > 0) lines.push(`Risks: ${risks.join('; ')}`)
  const comps = (deal.competitors as string[]) ?? []
  if (comps.length > 0) lines.push(`Competitors: ${comps.join(', ')}`)
  return lines.join('\n')
}

export const generate_content = {
  description: 'Generate ANY type of sales content — emails, battlecards, talking points, proposals, timelines, integration plans, risk assessments, executive summaries, or any freeform document. Saved to the collateral library.',
  parameters: z.object({
    dealId: z.string().optional().describe('Optional deal ID to tailor content for a specific deal'),
    contentType: z.string().describe('Type of content: email, battlecard, talking_points, proposal, timeline, one_pager, or any freeform type'),
    topic: z.string().optional().describe('Topic or title for the content'),
    recipient: z.string().optional().describe('Recipient role/name for emails or personalized content'),
    customPrompt: z.string().optional().describe('Additional instructions for content generation'),
    competitorId: z.string().optional().describe('Competitor UUID for battlecard generation'),
    tone: z.string().optional().describe('Desired tone (professional, casual, urgent)'),
  }),
  execute: async (
    params: {
      dealId?: string
      contentType: string
      topic?: string
      recipient?: string
      customPrompt?: string
      competitorId?: string
      tone?: string
    },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const contentType = params.contentType.toLowerCase()

    // Battlecard generation
    if (contentType === 'battlecard' && params.competitorId) {
      const [comp] = await db
        .select({ id: competitors.id, name: competitors.name })
        .from(competitors)
        .where(and(eq(competitors.id, params.competitorId), eq(competitors.workspaceId, ctx.workspaceId)))
        .limit(1)
      if (!comp) return { result: 'Competitor not found.' }

      const generated = await generateCollateral({
        workspaceId: ctx.workspaceId,
        type: 'battlecard',
        competitorId: params.competitorId,
      })
      await upsertCollateral({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        type: 'battlecard',
        title: generated.title,
        status: 'ready',
        content: generated.content,
        rawResponse: generated.rawResponse,
        generatedAt: new Date(),
        sourceCompetitorId: params.competitorId,
        generationSource: 'agent',
      })
      return {
        result: `Battlecard **"${generated.title}"** generated and saved to your collateral library.`,
        actions: [{ type: 'collateral_generating', colType: 'battlecard', title: generated.title }],
        uiHint: 'refresh_collateral',
      }
    }

    // Email drafting
    if (contentType === 'email') {
      const dealContext = params.dealId
        ? await buildDealContext(params.dealId, ctx.workspaceId)
        : undefined

      const promptParts = ['Draft a sales email with the following parameters:']
      if (params.recipient) promptParts.push(`Recipient role: ${params.recipient}`)
      if (params.tone) promptParts.push(`Tone: ${params.tone}`)
      if (params.topic) promptParts.push(`Topic: ${params.topic}`)
      if (params.customPrompt) promptParts.push(`Additional instructions: ${params.customPrompt}`)
      if (dealContext) promptParts.push(`\nDeal context:\n${dealContext}`)
      promptParts.push(
        '\nReturn the email with clear Subject: and Body: sections.',
        'Make it personalized, concise, and actionable.',
        'Use {{first_name}} and {{company_name}} as placeholders if deal context is not available.',
      )

      const msg = await anthropic.messages.create({
        model: 'gpt-5.4-mini',
        max_tokens: 1500,
        messages: [{ role: 'user', content: promptParts.join('\n') }],
      })
      const emailText = ((msg.content[0] as any).text ?? '').trim()
      return { result: `Here's the drafted email:\n\n${emailText}` }
    }

    // General content generation
    const dealContext = params.dealId
      ? await buildDealContext(params.dealId, ctx.workspaceId)
      : undefined

    const title = params.topic || `${params.contentType} Content`
    const description = [
      `Generate a ${params.contentType}`,
      params.topic ? `about: ${params.topic}` : '',
      params.recipient ? `for: ${params.recipient}` : '',
    ].filter(Boolean).join(' ')

    const generated = await generateFreeformCollateral({
      workspaceId: ctx.workspaceId,
      title,
      description,
      dealContext,
      customPrompt: params.customPrompt,
    })

    await upsertCollateral({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      type: 'custom',
      title: generated.title,
      status: 'ready',
      content: generated.content,
      rawResponse: generated.rawResponse,
      generatedAt: new Date(),
      customTypeName: title,
      generationSource: 'agent',
      sourceDealLogId: params.dealId ?? null,
    })

    return {
      result: `Content **"${generated.title}"** generated and saved to your collateral library.`,
      actions: [{ type: 'collateral_generating', colType: 'custom', title: generated.title }],
      uiHint: 'refresh_collateral',
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 5: answer_question
// ─────────────────────────────────────────────────────────────────────────────

export const answer_question = {
  description: 'Answer pipeline questions using workspace brain data — pipeline health, win rates, stage velocity, forecasts, deal patterns, competitor intel, score trends, and performance analytics. Use this for any analytical question that doesn\'t require looking up or modifying a specific deal.',
  parameters: z.object({
    question: z.string().describe('The pipeline or analytics question to answer'),
    focus: z.string().optional().describe('Focus area: pipeline, forecast, competitors, risks, velocity, performance, trends, overview'),
  }),
  execute: async (
    params: { question: string; focus?: string },
    ctx: ToolContext,
  ): Promise<ToolResult> => {
    const brain = ctx.brain ?? await getWorkspaceBrain(ctx.workspaceId)

    if (!brain) {
      return { result: 'No pipeline data available yet. Add some deals to get started.' }
    }

    // Build comprehensive context from brain
    const contextParts: string[] = []

    // Pipeline overview
    contextParts.push(`Pipeline: ${brain.pipeline.totalActive} active deals, $${brain.pipeline.totalValue.toLocaleString()} total value`)
    if (brain.pipeline.avgConversionScore != null) {
      contextParts.push(`Average conversion score: ${brain.pipeline.avgConversionScore}%`)
    }

    // Stage breakdown
    const stages = brain.pipeline.stageBreakdown
    if (Object.keys(stages).length > 0) {
      const stageStr = Object.entries(stages).map(([s, c]) => `${ctx.stageLabels?.[s] ?? s}: ${c}`).join(', ')
      contextParts.push(`Stages: ${stageStr}`)
    }

    // Win/loss intel
    if (brain.winLossIntel) {
      const wl = brain.winLossIntel
      contextParts.push(`Win rate: ${wl.winRate}% (${wl.winCount}W/${wl.lossCount}L)`)
      if (wl.avgDaysToClose > 0) contextParts.push(`Avg days to close: ${wl.avgDaysToClose}`)
      if (wl.topLossReasons.length > 0) contextParts.push(`Loss reasons: ${wl.topLossReasons.join(', ')}`)
    }

    // Deal summaries
    if (brain.deals?.length) {
      contextParts.push('\nDeals:')
      for (const d of brain.deals.slice(0, 20)) {
        const parts = [`${d.name} (${d.company}) — ${ctx.stageLabels?.[d.stage] ?? d.stage}`]
        if (d.conversionScore != null) parts.push(`${d.conversionScore}%`)
        if (d.dealValue != null) parts.push(`$${d.dealValue.toLocaleString()}`)
        if (d.risks.length > 0) parts.push(`Risks: ${d.risks.join(', ')}`)
        contextParts.push(`- ${parts.join(' | ')}`)
      }
    }

    // ML insights
    if (brain.mlModel) {
      contextParts.push(`\nML Model: trained on ${brain.mlModel.trainingSize} deals, accuracy ${((brain.mlModel.looAccuracy ?? 0) * 100).toFixed(0)}%`)
    }

    // Competitor intelligence (from keyPatterns)
    const compPatterns = brain.keyPatterns?.filter(p => p.competitorNames?.length)
    if (compPatterns?.length) {
      contextParts.push('\nCompetitor Intel:')
      for (const p of compPatterns) {
        contextParts.push(`- ${p.competitorNames!.join(', ')}: appears in ${p.dealNames?.join(', ') || 'multiple deals'}`)
      }
    }

    const brainContext = contextParts.join('\n')

    // Use LLM to answer the question with brain context
    const msg = await anthropic.messages.create({
      model: 'gpt-5.4-mini',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are a sales analytics expert. Answer this question using ONLY the data provided below. Be specific with numbers and deal names. Use £ for currency values.

WORKSPACE DATA:
${brainContext}

QUESTION: ${params.question}${params.focus ? `\nFOCUS: ${params.focus}` : ''}

Answer concisely with specific data points. If the data doesn't contain enough info to answer, say what's missing.`,
      }],
    })

    const answer = ((msg.content[0] as any).text ?? '').trim()
    return { result: answer }
  },
}
