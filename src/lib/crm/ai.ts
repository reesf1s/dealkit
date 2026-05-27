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

async function generateHalvexText(input: {
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
        'Turn the note into proposed CRM updates. Important fields are suggestions only; the user approves before saving.',
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
        'Always separate what happened, what it means, and what to do next.',
        'Use specific deal names, newest activity, risk drivers, next actions, and links described in the data.',
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
        'Treat stale imported tasks and old dated next actions as historical clean-up items unless they are confirmed by recent evidence.',
        'Always explain what happened, what it means, what to do next, and confidence.',
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

  return {
    ...fallback,
    summary: parsed.summary || fallback.summary,
    nextAction: parsed.nextAction || fallback.nextAction,
    riskDrivers: Array.isArray(parsed.riskDrivers) ? parsed.riskDrivers : fallback.riskDrivers,
    positiveSignals: Array.isArray(parsed.positiveSignals) ? parsed.positiveSignals : fallback.positiveSignals,
    missingData: Array.isArray(parsed.missingData) ? parsed.missingData : fallback.missingData,
    confidence: Math.max(10, Math.min(88, Number(parsed.confidence ?? fallback.confidence))),
  }
}
