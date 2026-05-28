import 'server-only'

import { deriveDealIntelligence, dealEvidenceText } from '@/lib/crm/intelligence'
import type { NativeDealContext } from '@/lib/crm/deal-context'
import type { Plan } from '@/types'

export const HALVEX_DEFAULT_MODEL = process.env.HALVEX_AI_MODEL || 'gpt-5.4-mini'
export const HALVEX_PREMIUM_MODEL = process.env.HALVEX_PREMIUM_AI_MODEL || 'gpt-5.5'
type DealContext = NonNullable<NativeDealContext>

function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY)
}

function openaiApiKey() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return apiKey
}

export function selectHalvexModel(plan?: Plan | null, opts: { premium?: boolean } = {}) {
  if (opts.premium && plan === 'pro') return HALVEX_PREMIUM_MODEL
  return HALVEX_DEFAULT_MODEL
}

function parseJsonObject<T>(text: string, fallback: T): T {
  try {
    const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '')
    return JSON.parse(trimmed) as T
  } catch {
    return fallback
  }
}

function extractResponseText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text
  const parts = Array.isArray(payload?.output) ? payload.output : []
  return parts
    .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .filter((content: any) => content?.type === 'output_text' && typeof content.text === 'string')
    .map((content: any) => content.text)
    .join('\n')
    .trim()
}

function limitWords(value: unknown, maxWords: number) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const words = text.split(' ')
  if (words.length <= maxWords) return text
  return `${words.slice(0, maxWords).join(' ')}...`
}

function cleanGeneratedList(value: unknown, fallback: string[], maxItems: number, maxWords: number) {
  const source = Array.isArray(value) ? value : fallback
  const cleaned = source
    .map(item => limitWords(item, maxWords))
    .filter(Boolean)
  return cleaned.length ? cleaned.slice(0, maxItems) : fallback.slice(0, maxItems)
}

async function generateHalvexText(input: {
  model: string
  system: string
  prompt: string
  maxOutputTokens: number
  effort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh'
}) {
  const candidateModels = [
    input.model,
    input.model === HALVEX_DEFAULT_MODEL ? null : HALVEX_DEFAULT_MODEL,
    'gpt-4.1-mini',
  ].filter((model, index, all): model is string => Boolean(model) && all.indexOf(model) === index)

  let lastError: Error | null = null
  for (const model of candidateModels) {
    try {
      return await callOpenAiResponses({ ...input, model })
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('OpenAI request failed')
      const message = lastError.message.toLowerCase()
      if (!/model|not found|does not exist|invalid|unsupported|404/.test(message)) throw lastError
      console.warn(`[crm] OpenAI model ${model} unavailable, trying fallback`, lastError.message)
    }
  }
  throw lastError ?? new Error('OpenAI request failed')
}

async function callOpenAiResponses(input: {
  model: string
  system: string
  prompt: string
  maxOutputTokens: number
  effort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh'
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        instructions: input.system,
        input: input.prompt,
        max_output_tokens: input.maxOutputTokens,
        reasoning: { effort: input.effort ?? 'none' },
        store: true,
      }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = payload?.error?.message ?? `OpenAI request failed with ${response.status}`
      throw new Error(message)
    }
    return extractResponseText(payload)
  } finally {
    clearTimeout(timeout)
  }
}

export type ProposedDealUpdate = {
  blocker: string | null
  risk: string | null
  nextAction: string | null
  task: string | null
  summary: string
  confidence: number
  evidence: string[]
}

export function fallbackProposedDealUpdate(note: string, context?: NativeDealContext | null): ProposedDealUpdate {
  const lower = note.toLowerCase()
  const hasBlocker = /blocked|blocker|concern|issue|alignment|procurement|legal|security|budget|pricing|competitor|uncertain|delay|stalled/.test(lower)
  const dueMatch = note.match(/\bby\s+([A-Za-z]+|\d{1,2}(?:st|nd|rd|th)?)(?:\s+\w+)?/i)
  const task = /send|follow|chase|share|book|schedule|confirm|clarify/i.test(note)
    ? note.split(/[.!?]/).find(part => /send|follow|chase|share|book|schedule|confirm|clarify/i.test(part))?.trim() || null
    : null
  const nextAction = task
    ? `${task}${dueMatch?.[0] ? ` ${dueMatch[0]}` : ''}.`
    : hasBlocker ? 'Clarify the blocker and agree the next step.' : context?.deal.aiNextAction ?? null
  return {
    blocker: hasBlocker ? 'The update mentions an unresolved blocker or concern.' : null,
    risk: hasBlocker ? 'Medium risk until this is resolved.' : 'No new risk detected from this note.',
    nextAction,
    task: nextAction,
    summary: `${context?.deal.companyName ?? context?.deal.title ?? 'Deal'} update: ${note.trim().slice(0, 220)}`,
    confidence: hasBlocker ? 68 : 58,
    evidence: [note.trim().slice(0, 220)],
  }
}

function splitCurrentAndStaleTasks(tasks: DealContext['openTasks']) {
  const now = Date.now()
  return tasks.reduce<{ current: DealContext['openTasks']; stale: DealContext['openTasks'] }>((groups, task) => {
    const dueAt = task.dueAt ? new Date(task.dueAt).getTime() : null
    const isStale = dueAt != null && Number.isFinite(dueAt) && now - dueAt > 30 * 86_400_000
    if (isStale) groups.stale.push(task)
    else groups.current.push(task)
    return groups
  }, { current: [], stale: [] })
}

export async function proposeDealUpdateWithAI(note: string, context: NativeDealContext | null, plan?: Plan | null): Promise<ProposedDealUpdate> {
  const fallback = fallbackProposedDealUpdate(note, context)
  if (!hasOpenAiKey() || !context) return fallback

  const intelligence = deriveDealIntelligence(context)
  const tasks = splitCurrentAndStaleTasks(context.openTasks)
  const promptContext = {
    deal: context.deal,
    company: context.company,
    contacts: context.contacts,
    openTasks: tasks.current,
    staleOpenTaskCount: tasks.stale.length,
    recentActivities: context.latestActivities.slice(0, 8).map(activity => ({
      id: activity.id,
      title: activity.title,
      summary: activity.summary,
      body: activity.body,
      occurredAt: activity.occurredAt,
    })),
    currentIntelligence: intelligence,
  }

  let text = ''
  try {
    text = await generateHalvexText({
      model: selectHalvexModel(plan),
      system: [
        'You are Halvex, a calm AI deal operator for a small-team CRM.',
        'Use only the CRM context and the user note. Do not invent facts.',
        'Turn the note into proposed CRM insight updates. Important fields are suggestions only; the user approves before saving.',
        'If there is a useful follow-up, put it in task as a recommended task only. The system will not create it unless the user explicitly chooses to.',
        'Return only compact JSON with keys: blocker, risk, nextAction, task, summary, confidence, evidence.',
      ].join(' '),
      prompt: JSON.stringify({ crmContext: promptContext, userNote: note }),
      maxOutputTokens: 900,
      effort: 'none',
    })
  } catch (error) {
    console.warn('[crm] deal update AI unavailable, using deterministic proposal', error)
    return fallback
  }

  const parsed = parseJsonObject<ProposedDealUpdate>(text, fallback)
  return {
    blocker: parsed.blocker ?? null,
    risk: parsed.risk ?? fallback.risk,
    nextAction: parsed.nextAction ?? fallback.nextAction,
    task: parsed.task ?? parsed.nextAction ?? fallback.task,
    summary: parsed.summary || fallback.summary,
    confidence: Math.max(10, Math.min(88, Number(parsed.confidence ?? fallback.confidence))),
    evidence: Array.isArray(parsed.evidence) && parsed.evidence.length ? parsed.evidence.slice(0, 5) : fallback.evidence,
  }
}

export async function answerAssistantWithAI(input: {
  message: string
  plan?: Plan | null
  today: unknown
  pipeline: unknown
  activity: unknown
  dealContext?: unknown
  fallbackAnswer: string
}) {
  if (!hasOpenAiKey()) return input.fallbackAnswer

  try {
    const text = await generateHalvexText({
      model: selectHalvexModel(input.plan, { premium: true }),
      system: [
        'You are Halvex, a concise AI CRM assistant for founders and small sales teams.',
        'Use only the provided CRM data. Never pretend missing data exists.',
        'If dealContext is provided, answer only about that deal. Do not use other deals, priorities, or activity unless they are explicitly included inside dealContext.',
        'If dealContext.contextPolicy exists, obey it over all other CRM data.',
        'Prioritise dealContext.latestActivities and current openTasks. Treat staleOpenTasks and staleActivities as historical context that may need user confirmation.',
        'For normal answers, use exactly these labels: What happened:, What it means:, Next:.',
        'For follow-up email drafts, use only Subject: and Body:.',
        'Use specific deal names, newest activity, risk drivers, next actions, and links described in the data.',
        'Avoid generic phrases such as promising opportunity, strong engagement, or high potential unless the provided CRM data proves the claim.',
        'If recommending action, make it a concrete CRM action: create task, save note, update field, draft follow-up, or open a named record.',
        'Treat old open tasks as items to verify with the user, not as fresh instructions.',
        'Mention confidence limits when evidence is thin. Keep the answer under 160 words.',
      ].join(' '),
      prompt: JSON.stringify({
        question: input.message,
        today: input.today,
        pipeline: input.pipeline,
        recentActivity: input.activity,
        dealContext: input.dealContext,
      }),
      maxOutputTokens: 900,
      effort: 'none',
    })

    return text.trim() || input.fallbackAnswer
  } catch (error) {
    console.warn('[crm] assistant AI unavailable, using deterministic answer', error)
    return input.fallbackAnswer
  }
}

export type AssistantToolPlan = {
  answer?: string
  clarification?: string
  actions?: Array<{
    type:
      | 'create_deal'
      | 'update_deal'
      | 'move_deal_stage'
      | 'add_deal_note'
      | 'create_task'
      | 'edit_task'
      | 'complete_task'
      | 'snooze_task'
      | 'cancel_task'
      | 'create_company'
      | 'create_contact'
      | 'draft_follow_up'
      | 'open_record'
    target?: string | null
    fields?: Record<string, unknown>
    note?: string | null
    title?: string | null
    dueAt?: string | null
    priority?: 'low' | 'normal' | 'high' | 'urgent' | null
    stage?: string | null
  }>
}

export async function planAssistantToolsWithAI(input: {
  message: string
  plan?: Plan | null
  crm: {
    currentDealId?: string | null
    stages: Array<{ id: string; name: string; key?: string | null }>
    deals: Array<{
      id: string
      title: string
      companyName?: string | null
      stageName?: string | null
      status?: string | null
      valueAmount?: number | null
      expectedCloseDate?: Date | string | null
      aiNextAction?: string | null
    }>
    tasks: Array<{
      id: string
      title: string
      status?: string | null
      dueAt?: Date | string | null
      dealId?: string | null
      dealTitle?: string | null
      companyName?: string | null
    }>
    companies: Array<{ id: string; name: string; domain?: string | null }>
    contacts: Array<{ id: string; fullName: string; email?: string | null; companyName?: string | null }>
  }
}): Promise<AssistantToolPlan | null> {
  if (!hasOpenAiKey()) return null

  const toolContract = {
    rule: 'Return compact JSON only. Never execute. Mutating actions will be shown to the user for confirmation.',
    allowedActions: [
      'create_deal',
      'update_deal',
      'move_deal_stage',
      'add_deal_note',
      'create_task',
      'edit_task',
      'complete_task',
      'snooze_task',
      'cancel_task',
      'create_company',
      'create_contact',
      'draft_follow_up',
      'open_record',
    ],
    updateDealFields: ['title', 'stage', 'status', 'valueAmount', 'expectedCloseDate', 'aiNextAction'],
    taskFields: ['title', 'dueAt', 'priority'],
    safety: [
      'If the user asks for raw SQL, schema changes, destructive deletes, billing changes, or data outside the CRM, return a clarification explaining this assistant only uses CRM tools.',
      'If a record target is ambiguous or missing, return clarification instead of guessing.',
      'Deal-scoped requests must stay on currentDealId when provided unless the user explicitly names a different record.',
      'For draft_follow_up, do not create or send email.',
      'For broad requests, propose up to 5 concrete actions.',
    ],
  }

  try {
    const text = await generateHalvexText({
      model: selectHalvexModel(input.plan, { premium: true }),
      system: [
        'You are the Halvex CRM tool planner.',
        'Translate natural language into safe internal CRM tool proposals.',
        'You can help with any CRM workflow only through the allowed action types.',
        'Do not invent records, IDs, stages, dates, values, people, or companies.',
        'When uncertain, ask a concise clarification.',
        'Return JSON with keys: answer, clarification, actions.',
      ].join(' '),
      prompt: JSON.stringify({
        userMessage: input.message,
        toolContract,
        crm: input.crm,
      }),
      maxOutputTokens: 1400,
      effort: 'low',
    })
    const parsed = parseJsonObject<AssistantToolPlan | null>(text, null)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      answer: typeof parsed.answer === 'string' ? parsed.answer : undefined,
      clarification: typeof parsed.clarification === 'string' ? parsed.clarification : undefined,
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 5) : [],
    }
  } catch (error) {
    console.warn('[crm] assistant tool planner unavailable, using deterministic planner', error)
    return null
  }
}

export async function generateDealBriefWithAI(context: NativeDealContext | null, plan?: Plan | null) {
  if (!context) return null
  const fallback = deriveDealIntelligence(context)
  if (!hasOpenAiKey()) return fallback

  let text = ''
  try {
    text = await generateHalvexText({
      model: selectHalvexModel(plan, { premium: true }),
      system: [
        'You are the Halvex deal intelligence engine.',
        'Analyse only the CRM context provided. Do not invent facts.',
        'Prioritise the newest substantive evidence over generic field-change records.',
        'Separate current evidence from older/historical evidence. If older evidence may be stale, ask the user to verify it rather than presenting it as current truth.',
        'Treat stale imported tasks and old dated next actions as historical clean-up items unless they are confirmed by recent evidence.',
        'Write in a useful CRM style: direct, specific, and concise. Avoid generic sales optimism.',
        'Always explain what happened, what it means, what to do next, and confidence.',
        'Keep summary under 55 words. Keep nextAction under 28 words. Each risk driver must be short and actionable.',
        'Return compact JSON with keys: summary, nextAction, riskDrivers, positiveSignals, missingData, confidence.',
        'Score and risk are computed deterministically elsewhere; do not make the deal sound safer than the evidence.',
      ].join(' '),
      prompt: JSON.stringify({
        deal: context.deal,
        company: context.company,
        contacts: context.contacts,
        openTasks: context.openTasks,
        meetings: context.meetings,
        evidenceText: dealEvidenceText(context),
        deterministicIntelligence: fallback,
      }),
      maxOutputTokens: 900,
      effort: 'none',
    })
  } catch (error) {
    console.warn('[crm] deal brief AI unavailable, using deterministic brief', error)
    return fallback
  }

  const parsed = parseJsonObject<{
    summary?: string
    nextAction?: string
    riskDrivers?: string[]
    positiveSignals?: string[]
    missingData?: string[]
    confidence?: number
  }>(text, {})
  const parsedConfidence = Number(parsed.confidence ?? fallback.confidence)
  const confidenceCeiling = context.deal.status === 'won' && fallback.riskLevel === 'low'
    ? 100
    : Math.min(88, fallback.confidence + 8)
  const confidenceFloor = Math.max(10, fallback.confidence - 18)
  const confidence = context.deal.status === 'won' && fallback.riskLevel === 'low'
    ? Math.max(86, Math.min(100, Number.isFinite(parsedConfidence) ? parsedConfidence : fallback.confidence))
    : Math.max(confidenceFloor, Math.min(confidenceCeiling, Number.isFinite(parsedConfidence) ? parsedConfidence : fallback.confidence))

  return {
    ...fallback,
    summary: limitWords(parsed.summary, 55) || limitWords(fallback.summary, 55),
    nextAction: limitWords(parsed.nextAction, 28) || limitWords(fallback.nextAction, 28),
    riskDrivers: cleanGeneratedList(parsed.riskDrivers, fallback.riskDrivers, 4, 22),
    positiveSignals: cleanGeneratedList(parsed.positiveSignals, fallback.positiveSignals, 4, 20),
    missingData: cleanGeneratedList(parsed.missingData, fallback.missingData, 4, 12),
    confidence,
  }
}
