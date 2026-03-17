export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, count, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  companyProfiles, competitors, caseStudies, dealLogs, productGaps, collateral, events,
} from '@/lib/db/schema'
import Anthropic from '@anthropic-ai/sdk'
import { getWorkspaceContext } from '@/lib/workspace'
import { generateCollateral, generateFreeformCollateral } from '@/lib/ai/generate'
import { PLAN_LIMITS, isWithinLimit } from '@/lib/stripe/plans'
import type { CollateralType } from '@/types'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getWorkspaceBrain, formatBrainContext, rebuildWorkspaceBrain } from '@/lib/workspace-brain'
import type { WorkspaceBrain } from '@/lib/workspace-brain'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Action card types (returned alongside reply for rich UI rendering) ─────────
export type ActionCard =
  | { type: 'deal_updated'; dealId: string; dealName: string; changes: string[] }
  | { type: 'deal_created'; dealId: string; dealName: string; company: string }
  | { type: 'competitor_created'; names: string[]; battlecardsStarted: boolean }
  | { type: 'company_updated'; fields: string[] }
  | { type: 'collateral_generating'; colType: string; title: string }
  | { type: 'case_study_created'; id: string; customerName: string }
  | { type: 'gaps_logged'; gaps: string[]; count: number }
  | { type: 'todos_updated'; added: number; removed: number; completed: number; dealName: string }

export interface PendingAction {
  type: 'todo_cleanup'
  dealId: string
  dealName: string
  removeIds: string[]
  completeIds: string[]
  removedTexts: string[]
  completedTexts: string[]
}

// ── Intent classification — LLM-first, regex fallback ─────────────────────────
type Intent =
  | 'meeting_notes' | 'competitor_battlecard' | 'company_update'
  | 'collateral' | 'project_plan' | 'deal_create' | 'case_study_create'
  | 'deal_action' | 'product_gap' | 'pipeline_query' | 'qa'

const MEETING_KEYWORDS = [
  'action item', 'follow up', 'next step', 'discussed', 'agenda',
  'attendee', 'participant', 'meeting notes', 'call notes', 'recap',
  'meeting with', 'call with', 'talked to', 'spoke with',
]

function looksLikeMeetingTranscript(text: string): boolean {
  if (text.length < 250) return false
  const lower = text.toLowerCase()
  const keywordMatches = MEETING_KEYWORDS.filter(kw => lower.includes(kw)).length
  const lineCount = text.split('\n').length
  return keywordMatches >= 2 || (lineCount >= 8 && keywordMatches >= 1)
}

// Fallback regex-based classifier (used when Haiku call fails)
function detectIntentFallback(text: string): Intent {
  const lower = text.toLowerCase()
  if (/\b(new deal|new prospect|add.*deal|create.*deal|log.*deal)\b/i.test(text)) return 'deal_create'
  if (looksLikeMeetingTranscript(text)) return 'meeting_notes'
  if (/battlecard|add competitor|create competitor|new competitor|track.*competitor/i.test(text)) return 'competitor_battlecard'
  if (/product\s+gap|feature\s+gap|feature\s+request|missing\s+feature/i.test(text)) return 'product_gap'
  if (/\b(generate|create|make|write|build)\b.*\b(email|analysis|one.?pager|talk.?track|objection|handler|doc|brief|playbook|strategy|proposal|pitch|template|battlecard|collateral|asset)\b/i.test(text)) return 'collateral'
  if (/project\s+plan|implementation\s+plan|rollout|onboarding\s+plan/i.test(text)) return 'project_plan'
  if (/\b(draft|write|compose)\b.*\b(email|message|reply|response)\b/i.test(text)) return 'qa'
  if (/update.*compan|update.*profile|value prop|our differentiator/i.test(text)) return 'company_update'
  if (/remove.*to[\s-']?do|review.*to[\s-']?do|clean.*todo|scan.*todo|update.*stage|move.*deal|change.*stage|close date|next step/i.test(text)) return 'deal_action'
  if (/case study|customer win|we won|just closed with/i.test(text)) return 'case_study_create'
  if (/what.*pipeline|pipeline.*overview|pipeline.*summary|what should i focus|where should i/i.test(text)) return 'pipeline_query'
  return 'qa'
}

async function classifyIntent(text: string): Promise<Intent> {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [{
        role: 'user',
        content: `Classify this sales rep message into ONE intent. Return ONLY the intent name, nothing else.

Intents:
meeting_notes - pasting meeting/call transcript or detailed notes from a meeting
competitor_battlecard - adding a competitor company or requesting a battlecard
product_gap - logging a missing feature, integration, or product gap
company_update - updating own company profile, products, or value propositions
collateral - requesting to generate/create any document or asset (one-pager, email sequence, talk track, objection handler, analysis, proposal, etc.)
project_plan - creating a project plan with phases, tasks, or milestones
deal_create - creating a new deal, prospect, or opportunity
case_study_create - logging a customer win or success story
deal_action - modifying a deal (todos, stage, value, contacts, competitors, notes, close date)
pipeline_query - asking about pipeline health, overview, what to focus on, forecast
qa - any question, content draft request, or anything else

Message: "${text.slice(0, 600)}"`,
      }],
    })
    const raw = (msg.content[0] as { type: string; text: string }).text.trim().toLowerCase()
    const valid: Intent[] = [
      'meeting_notes', 'competitor_battlecard', 'company_update', 'collateral',
      'project_plan', 'deal_create', 'case_study_create', 'deal_action',
      'product_gap', 'pipeline_query', 'qa',
    ]
    return valid.includes(raw as Intent) ? (raw as Intent) : 'qa'
  } catch {
    return detectIntentFallback(text)
  }
}

function stripJson(raw: string): string {
  return raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
}

// ── Handler: competitor battlecard creation ────────────────────────────────────
async function handleCompetitorBattlecard(
  workspaceId: string, userId: string, text: string, plan: string,
): Promise<{ reply: string; actions: ActionCard[] }> {
  const [profileRow] = await db.select({ id: companyProfiles.id }).from(companyProfiles)
    .where(eq(companyProfiles.workspaceId, workspaceId)).limit(1)
  const hasCompanyProfile = !!profileRow

  const extractMsg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 600,
    messages: [{
      role: 'user',
      content: `Extract competitor names from this text. Return ONLY a JSON array of objects.\n\nEach object: { "name": "required", "description": "1-2 sentences or null", "strengths": [], "weaknesses": [], "keyFeatures": [], "notes": null }\n\nReturn [] ONLY if absolutely no company/product names are present.\n\nText: ${text.slice(0, 3000)}`,
    }],
  })

  interface ExtractedComp { name: string; description?: string; strengths?: string[]; weaknesses?: string[]; keyFeatures?: string[]; notes?: string }
  let extracted: ExtractedComp[] = []
  try {
    const parsed = JSON.parse(stripJson((extractMsg.content[0] as { type: string; text: string }).text))
    if (Array.isArray(parsed)) extracted = parsed.filter((c: ExtractedComp) => c?.name)
  } catch { extracted = [] }

  if (extracted.length === 0) {
    return { reply: "I couldn't find specific competitor names in your message. Try: _\"Create battlecards for Salesforce, HubSpot\"_", actions: [] }
  }

  const limits = PLAN_LIMITS[plan as 'free' | 'starter' | 'pro']
  const created: string[] = []
  const savedOnly: string[] = []
  const failed: string[] = []

  for (const comp of extracted.slice(0, 15)) {
    const name = comp.name?.trim()
    if (!name) continue
    try {
      if (limits.competitors !== null) {
        const [{ value: c }] = await db.select({ value: count() }).from(competitors).where(eq(competitors.workspaceId, workspaceId))
        if (!isWithinLimit(Number(c), limits.competitors)) { failed.push(`${name} (limit reached)`); continue }
      }
      const now = new Date()
      const [competitor] = await db.insert(competitors).values({
        workspaceId, userId, name,
        description: comp.description ?? null,
        strengths: comp.strengths ?? [], weaknesses: comp.weaknesses ?? [],
        keyFeatures: comp.keyFeatures ?? [], differentiators: [],
        notes: comp.notes ?? null, createdAt: now, updatedAt: now,
      }).returning()
      await db.insert(events).values({ workspaceId, userId, type: 'competitor.created', metadata: { competitorId: competitor.id, name, source: 'ai_chat' }, createdAt: now })

      if (!hasCompanyProfile) { savedOnly.push(name); continue }
      if (limits.collateral !== null) {
        const [{ value: cc }] = await db.select({ value: count() }).from(collateral).where(eq(collateral.workspaceId, workspaceId))
        if (!isWithinLimit(Number(cc), limits.collateral)) { savedOnly.push(`${name} (collateral limit)`); continue }
      }

      const [colRecord] = await db.insert(collateral).values({
        workspaceId, userId, type: 'battlecard', title: `Battlecard: vs ${name}`,
        status: 'generating', sourceCompetitorId: competitor.id,
        sourceCaseStudyId: null, sourceDealLogId: null, content: null, rawResponse: null,
        generatedAt: null, createdAt: now, updatedAt: now,
      }).returning()
      const colId = colRecord.id
      const competitorId = competitor.id
      try {
        const result = await generateCollateral({ workspaceId, type: 'battlecard', competitorId })
        const generatedAt = new Date()
        await db.update(collateral).set({ title: result.title, status: 'ready', content: result.content, rawResponse: result.rawResponse, generatedAt, updatedAt: generatedAt }).where(eq(collateral.id, colId))
        await db.insert(events).values({ workspaceId, userId, type: 'collateral.generated', metadata: { collateralId: colId, collateralType: 'battlecard', title: result.title }, createdAt: new Date() })
      } catch { await db.update(collateral).set({ status: 'stale', updatedAt: new Date() }).where(eq(collateral.id, colId)) }
      created.push(name)
    } catch { failed.push(name) }
  }

  let reply = ''
  if (created.length > 0) reply += `Saved **${created.join(', ')}** and generated ${created.length > 1 ? 'battlecards' : 'a battlecard'} — ready in [Collateral](/collateral).`
  if (savedOnly.length > 0) {
    if (!hasCompanyProfile) reply += `\n\nSaved **${savedOnly.join(', ')}** — no battlecard yet. Complete your [Company Profile](/company) first.`
    else reply += `\n\nSaved (no battlecard — plan limit): ${savedOnly.join(', ')}`
  }
  if (failed.length > 0) reply += `\n\n❌ Couldn't save: ${failed.join(', ')}`
  if (!reply) reply = 'No competitors found in your message.'

  const allNames = [...created, ...savedOnly]
  return {
    reply,
    actions: allNames.length > 0 ? [{ type: 'competitor_created', names: allNames, battlecardsStarted: created.length > 0 }] : [],
  }
}

// ── Handler: meeting transcript ────────────────────────────────────────────────
async function handleMeetingNotes(
  workspaceId: string, userId: string, text: string, activeDealId: string | null,
): Promise<{ reply: string; actions: ActionCard[] }> {
  const openDeals = await db
    .select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany, stage: dealLogs.stage, todos: dealLogs.todos, dealValue: dealLogs.dealValue, notes: dealLogs.notes })
    .from(dealLogs)
    .where(and(eq(dealLogs.workspaceId, workspaceId), sql`${dealLogs.stage} NOT IN ('closed_won', 'closed_lost')`))
    .limit(20)

  function recentNoteEntries(notes: string | null, n = 3): string {
    if (!notes) return ''
    const entries = notes.split('\n').filter(l => l.startsWith('['))
    return entries.slice(-n).join(' | ')
  }

  // If activeDealId is provided, skip the LLM matching and use it directly
  let forcedMatchId: string | null = null
  if (activeDealId) {
    const activeDeal = openDeals.find(d => d.id === activeDealId)
    if (activeDeal) forcedMatchId = activeDealId
  }

  const dealList = openDeals.map(d =>
    `id:${d.id} | "${d.dealName}" — ${d.prospectCompany} (${d.stage})${d.notes ? ` | Prior context: ${recentNoteEntries(d.notes)}` : ''}`
  ).join('\n')

  const analysisMsg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `Analyze these B2B sales meeting notes. Return ONLY valid JSON.

Meeting notes:
${text}

Open deals:
${dealList || 'No open deals yet.'}
${forcedMatchId ? `\nIMPORTANT: The user is currently viewing deal ID "${forcedMatchId}". Set matchedDealId to this value.` : ''}

Return:
{
  "matchedDealId": "uuid or null",
  "matchedDealName": "name or null",
  "summary": "2-3 sentence summary",
  "todos": [{"text": "specific action item"}],
  "productGaps": [{"title": "feature", "description": "what they need", "priority": "high|medium|low"}],
  "dealUpdate": {"stage": "stage_or_null", "dealValue": null_or_dollars, "notes": "brief note or null"},
  "risks": ["risk or blocker"]
}

matchedDealId must be one of the IDs above (or null). Stage values: prospecting|qualification|discovery|proposal|negotiation|closed_won|closed_lost. dealValue in dollars (integer).`,
    }],
  })

  let parsed: {
    matchedDealId: string | null; matchedDealName: string | null; summary: string
    todos: { text: string }[]; productGaps: { title: string; description: string; priority: string }[]
    dealUpdate: { stage: string | null; dealValue: number | null; notes: string | null }
    risks: string[]
  } = { matchedDealId: null, matchedDealName: null, summary: '', todos: [], productGaps: [], dealUpdate: { stage: null, dealValue: null, notes: null }, risks: [] }

  try {
    parsed = JSON.parse(stripJson((analysisMsg.content[0] as { type: string; text: string }).text))
  } catch { /* use defaults */ }

  // If activeDealId was provided, override whatever Claude matched
  if (forcedMatchId && (!parsed.matchedDealId || parsed.matchedDealId !== forcedMatchId)) {
    const activeDeal = openDeals.find(d => d.id === forcedMatchId)
    parsed.matchedDealId = forcedMatchId
    parsed.matchedDealName = activeDeal?.dealName ?? parsed.matchedDealName
  }

  const actions: ActionCard[] = []
  const dealChanges: string[] = []

  if (parsed.matchedDealId) {
    const [existingDeal] = await db.select({
      id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany,
      stage: dealLogs.stage, todos: dealLogs.todos, notes: dealLogs.notes,
      dealValue: dealLogs.dealValue,
    }).from(dealLogs)
      .where(and(eq(dealLogs.id, parsed.matchedDealId), eq(dealLogs.workspaceId, workspaceId))).limit(1)

    if (existingDeal) {
      const pendingTodos = ((existingDeal.todos as { id: string; text: string; done: boolean }[]) ?? []).filter(t => !t.done)

      let todoRemoveIndices: number[] = []
      let todoCompleteIndices: number[] = []
      let todoAdd: string[] = parsed.todos.map(t => t.text)

      if (pendingTodos.length > 0 && parsed.todos.length > 0) {
        try {
          const todoMsg = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001', max_tokens: 512,
            messages: [{
              role: 'user',
              content: `You are reviewing a CRM deal's todos after a sales meeting.

Meeting notes (summary): ${parsed.summary}
New todos from meeting: ${parsed.todos.map(t => t.text).join('; ')}

Existing pending todos (numbered 1 to ${pendingTodos.length}):
${pendingTodos.map((t, i) => `${i + 1}. "${t.text}"`).join('\n')}

Return ONLY JSON using the 1-based numbers above:
{
  "complete": [1],
  "remove": [2, 3],
  "add": ["new todo text NOT already in existing todos"]
}

Rules: only mark "complete" if explicitly mentioned as done. Only "remove" if truly irrelevant/outdated. "add" should not duplicate existing todos.`,
            }],
          })
          const todoResult = JSON.parse(stripJson((todoMsg.content[0] as { type: string; text: string }).text))
          const toNums = (arr: unknown): number[] =>
            (Array.isArray(arr) ? arr : []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= pendingTodos.length)
          todoRemoveIndices = toNums(todoResult.remove)
          todoCompleteIndices = toNums(todoResult.complete)
          todoAdd = Array.isArray(todoResult.add) ? todoResult.add : todoAdd
        } catch { /* fall back to just adding */ }
      }

      const todoRemoveIds = new Set(todoRemoveIndices.map(n => pendingTodos[n - 1]?.id).filter(Boolean))
      const todoCompleteIds = new Set(todoCompleteIndices.map(n => pendingTodos[n - 1]?.id).filter(Boolean))

      const allTodos = (existingDeal.todos as { id: string; text: string; done: boolean; createdAt: string }[]) ?? []
      const updatedTodos = allTodos
        .filter(t => !todoRemoveIds.has(t.id))
        .map(t => todoCompleteIds.has(t.id) ? { ...t, done: true } : t)
      const newTodos = todoAdd.map(text => ({ id: crypto.randomUUID(), text, done: false, createdAt: new Date().toISOString() }))
      const mergedTodos = [...updatedTodos, ...newTodos]

      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      const newEntry = `[${dateStr}] ${parsed.summary}`
      const accumulatedNotes = existingDeal.notes ? `${existingDeal.notes}\n${newEntry}` : newEntry

      const updatePayload: Record<string, unknown> = { todos: mergedTodos, meetingNotes: text, notes: accumulatedNotes, updatedAt: new Date() }
      if (parsed.risks?.length) { updatePayload.dealRisks = parsed.risks; dealChanges.push(`${parsed.risks.length} risk${parsed.risks.length > 1 ? 's' : ''} identified`) }
      if (parsed.dealUpdate?.stage) { updatePayload.stage = parsed.dealUpdate.stage; dealChanges.push(`stage → **${parsed.dealUpdate.stage}**`) }
      if (parsed.dealUpdate?.dealValue) { updatePayload.dealValue = parsed.dealUpdate.dealValue; dealChanges.push(`value → **$${parsed.dealUpdate.dealValue.toLocaleString()}**`) }

      await db.update(dealLogs).set(updatePayload).where(eq(dealLogs.id, parsed.matchedDealId))

      const todosAdded = newTodos.length
      const todosRemoved = todoRemoveIds.size
      const todosCompleted = todoCompleteIds.size
      if (todosAdded) dealChanges.push(`+${todosAdded} todo${todosAdded > 1 ? 's' : ''}`)
      if (todosCompleted) dealChanges.push(`${todosCompleted} todo${todosCompleted > 1 ? 's' : ''} marked done`)
      if (todosRemoved) dealChanges.push(`${todosRemoved} stale todo${todosRemoved > 1 ? 's' : ''} removed`)

      actions.push({ type: 'todos_updated', added: todosAdded, removed: todosRemoved, completed: todosCompleted, dealName: existingDeal.dealName })
      if (dealChanges.length > 0 || parsed.dealUpdate?.stage || parsed.dealUpdate?.notes) {
        actions.push({ type: 'deal_updated', dealId: parsed.matchedDealId, dealName: existingDeal.dealName, changes: dealChanges })
      }
    }
  }

  // Product gaps
  const createdGapTitles: string[] = []
  for (const gap of (parsed.productGaps ?? [])) {
    if (!gap.title) continue
    const [existing] = await db.select().from(productGaps)
      .where(and(eq(productGaps.workspaceId, workspaceId), eq(productGaps.title, gap.title))).limit(1)
    if (existing) {
      await db.update(productGaps).set({
        frequency: (existing.frequency ?? 1) + 1,
        sourceDeals: parsed.matchedDealId ? [...((existing.sourceDeals as string[]) ?? []), parsed.matchedDealId] : (existing.sourceDeals as string[]) ?? [],
        updatedAt: new Date(),
      }).where(eq(productGaps.id, existing.id))
      createdGapTitles.push(`${gap.title} (+1)`)
    } else {
      await db.insert(productGaps).values({
        workspaceId, userId, title: gap.title, description: gap.description ?? '',
        priority: gap.priority ?? 'medium', frequency: 1,
        sourceDeals: parsed.matchedDealId ? [parsed.matchedDealId] : [],
        status: 'open', createdAt: new Date(), updatedAt: new Date(),
      })
      createdGapTitles.push(gap.title)
    }
  }
  if (createdGapTitles.length > 0) actions.push({ type: 'gaps_logged', gaps: createdGapTitles, count: createdGapTitles.length })

  const dealContext = parsed.matchedDealName ? ` for **${parsed.matchedDealName}**` : ''
  let reply = `Processed meeting notes${dealContext}.\n\n**${parsed.summary}**`
  if (parsed.risks?.length) reply += `\n\n⚠️ **Risks:** ${parsed.risks.join(' · ')}`
  if (!parsed.matchedDealId && openDeals.length > 0) reply += `\n\n_Tip: I couldn't match these notes to a deal. Paste notes on the deal page for a precise match._`
  else if (!parsed.matchedDealId) reply += `\n\n_No open deals found. Log a deal first, then I can link meeting notes to it._`

  // Auto-generate risk-based objection handler when risks found on a matched deal
  if (parsed.risks?.length >= 1 && parsed.matchedDealId) {
    const matchedDeal = openDeals.find(d => d.id === parsed.matchedDealId)
    const riskContext = [
      `Prospect: ${matchedDeal?.prospectCompany ?? 'Unknown'}`,
      `Stage: ${matchedDeal?.stage ?? 'unknown'}`,
      `Active risks from latest meeting: ${parsed.risks.join('; ')}`,
      parsed.summary ? `Meeting summary: ${parsed.summary}` : '',
    ].filter(Boolean).join('\n')

    reply += `\n\n🎯 **Auto-generating objection handler** tailored to these risks — check [Collateral](/collateral) shortly.`
    actions.push({ type: 'collateral_generating', colType: 'objection_handler', title: `Risk Response: ${matchedDeal?.dealName ?? 'Deal'}` })

    after(async () => {
      try {
        const [profileRow] = await db.select({ id: companyProfiles.id }).from(companyProfiles)
          .where(eq(companyProfiles.workspaceId, workspaceId)).limit(1)
        if (!profileRow) return

        const now = new Date()
        const [colRecord] = await db.insert(collateral).values({
          workspaceId, userId, type: 'objection_handler',
          title: `Risk Response: ${matchedDeal?.dealName ?? 'Deal'}`,
          status: 'generating', sourceCompetitorId: null, sourceCaseStudyId: null,
          sourceDealLogId: parsed.matchedDealId, content: null, rawResponse: null,
          generatedAt: null, createdAt: now, updatedAt: now,
        }).returning()

        const result = await generateCollateral({
          workspaceId, type: 'objection_handler',
          dealContext: riskContext,
          customPrompt: `Focus specifically on handling these deal risks from the latest meeting: ${parsed.risks.join('; ')}. Make responses tactical and immediately usable by the sales rep.`,
        })
        const generatedAt = new Date()
        await db.update(collateral).set({
          title: result.title, status: 'ready', content: result.content,
          rawResponse: result.rawResponse, generatedAt, updatedAt: generatedAt,
        }).where(eq(collateral.id, colRecord.id))
        await db.insert(events).values({
          workspaceId, userId, type: 'collateral.generated',
          metadata: { collateralId: colRecord.id, collateralType: 'objection_handler', title: result.title, source: 'auto_risk' },
          createdAt: new Date(),
        })
      } catch { /* best effort */ }
    })
  }

  after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ } })
  after(async () => {
    try {
      const qaMsg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 512,
        messages: [{ role: 'user', content: `Extract prospect questions + ideal answers from these sales meeting notes. Return ONLY a JSON array of strings: ["Q: [question] | A: [answer]"]. Max 6. Return [] if none.\n\n${text.slice(0, 4000)}` }],
      })
      const newQAs: string[] = JSON.parse(stripJson((qaMsg.content[0] as { type: string; text: string }).text))
      if (Array.isArray(newQAs) && newQAs.length > 0) {
        const [profile] = await db.select({ id: companyProfiles.id, commonObjections: companyProfiles.commonObjections })
          .from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1)
        if (profile) {
          const existing = (profile.commonObjections as string[]) ?? []
          const merged = [...new Set([...existing, ...newQAs])].slice(-30)
          await db.update(companyProfiles).set({ commonObjections: merged, updatedAt: new Date() }).where(eq(companyProfiles.id, profile.id))
        }
      }
    } catch { /* best effort */ }
  })

  return { reply, actions }
}

// ── Handler: product gap creation ─────────────────────────────────────────────
async function handleProductGapCreate(
  workspaceId: string, userId: string, text: string,
): Promise<{ reply: string; actions: ActionCard[] }> {
  const extractMsg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 600,
    messages: [{
      role: 'user',
      content: `Extract product/feature gap details from this text. Return ONLY JSON.

{
  "gaps": [
    {
      "title": "concise gap title e.g. 'Appspace integration'",
      "description": "what the customer needs / why it's missing",
      "priority": "critical|high|medium|low",
      "sourceDeal": "company or deal name if mentioned, or null"
    }
  ]
}

If no clear gap is described, return { "gaps": [] }.

Text: ${text.slice(0, 3000)}`,
    }],
  })

  let gaps: { title: string; description: string; priority: string; sourceDeal: string | null }[] = []
  try {
    const parsed = JSON.parse(stripJson((extractMsg.content[0] as { type: string; text: string }).text))
    gaps = parsed.gaps ?? []
  } catch { gaps = [] }

  if (gaps.length === 0) {
    return { reply: "I couldn't identify a specific product gap from that. Try: _\"Add Salesforce integration as a product gap for Acme deal\"_", actions: [] }
  }

  const created: string[] = []
  for (const gap of gaps) {
    if (!gap.title) continue

    let linkedDealId: string | null = null
    if (gap.sourceDeal) {
      const [matchedDeal] = await db
        .select({ id: dealLogs.id })
        .from(dealLogs)
        .where(and(
          eq(dealLogs.workspaceId, workspaceId),
          or(
            ilike(dealLogs.dealName, `%${gap.sourceDeal}%`),
            ilike(dealLogs.prospectCompany, `%${gap.sourceDeal}%`),
          ),
        ))
        .limit(1)
      linkedDealId = matchedDeal?.id ?? null
    }

    const [existing] = await db.select().from(productGaps)
      .where(and(eq(productGaps.workspaceId, workspaceId), eq(productGaps.title, gap.title))).limit(1)
    if (existing) {
      const existingDeals = (existing.sourceDeals as string[]) ?? []
      const updatedDeals = linkedDealId && !existingDeals.includes(linkedDealId)
        ? [...existingDeals, linkedDealId]
        : existingDeals
      await db.update(productGaps).set({ frequency: (existing.frequency ?? 1) + 1, sourceDeals: updatedDeals, updatedAt: new Date() })
        .where(eq(productGaps.id, existing.id))
      created.push(`${gap.title} (frequency +1)`)
    } else {
      await db.insert(productGaps).values({
        workspaceId, userId, title: gap.title,
        description: gap.description ?? '',
        priority: (['critical', 'high', 'medium', 'low'].includes(gap.priority) ? gap.priority : 'medium') as 'critical' | 'high' | 'medium' | 'low',
        frequency: 1, sourceDeals: linkedDealId ? [linkedDealId] : [], status: 'open',
        createdAt: new Date(), updatedAt: new Date(),
      })
      created.push(gap.title)
    }
  }

  const names = created.join(', ')
  return {
    reply: `Logged ${created.length} product gap${created.length > 1 ? 's' : ''}: **${names}**.\n\nView and manage on the [Feature Gaps](/product-gaps) page.`,
    actions: [{ type: 'gaps_logged', gaps: created, count: created.length }],
  }
}

// ── Handler: company profile update ───────────────────────────────────────────
async function handleCompanyUpdate(
  workspaceId: string, userId: string, text: string,
): Promise<{ reply: string; actions: ActionCard[] }> {
  const extractMsg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Extract company profile information from this text. Return ONLY JSON. Only include fields clearly mentioned — use null for anything not mentioned.

{
  "companyName": "string or null",
  "description": "string or null",
  "industry": "string or null",
  "targetMarket": "string or null",
  "competitiveAdvantage": "string or null",
  "founded": "string or null",
  "employeeCount": "string or null",
  "valuePropositions": ["string"] or null,
  "differentiators": ["string"] or null,
  "products": [{"name": "string", "description": "string", "keyFeatures": ["string"]}] or null
}

Text: ${text.slice(0, 6000)}`,
    }],
  })

  interface ExtractedProfile {
    companyName?: string | null; description?: string | null; industry?: string | null
    targetMarket?: string | null; competitiveAdvantage?: string | null
    founded?: string | null; employeeCount?: string | null
    valuePropositions?: string[] | null; differentiators?: string[] | null
    products?: { name: string; description: string; keyFeatures: string[] }[] | null
  }

  let extracted: ExtractedProfile = {}
  try {
    extracted = JSON.parse(stripJson((extractMsg.content[0] as { type: string; text: string }).text))
  } catch { return { reply: "I couldn't extract company information from that. Try: _\"Our company is called X, we help Y do Z...\"_", actions: [] } }

  const updatedFields: string[] = []
  const [existing] = await db.select().from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1)
  const now = new Date()

  const mergeUpdate: Record<string, unknown> = { updatedAt: now }

  if (extracted.companyName) { mergeUpdate.companyName = extracted.companyName; updatedFields.push('company name') }
  if (extracted.description) { mergeUpdate.description = extracted.description; updatedFields.push('description') }
  if (extracted.industry) { mergeUpdate.industry = extracted.industry; updatedFields.push('industry') }
  if (extracted.targetMarket) { mergeUpdate.targetMarket = extracted.targetMarket; updatedFields.push('target market') }
  if (extracted.competitiveAdvantage) { mergeUpdate.competitiveAdvantage = extracted.competitiveAdvantage; updatedFields.push('competitive advantage') }
  if (extracted.founded) { mergeUpdate.founded = extracted.founded; updatedFields.push('founded year') }
  if (extracted.employeeCount) { mergeUpdate.employeeCount = extracted.employeeCount; updatedFields.push('employee count') }

  if (extracted.valuePropositions?.length) {
    const existing_vp = (existing?.valuePropositions as string[]) ?? []
    const merged = [...new Set([...existing_vp, ...extracted.valuePropositions])]
    mergeUpdate.valuePropositions = merged
    updatedFields.push(`value propositions (+${extracted.valuePropositions.length})`)
  }
  if (extracted.differentiators?.length) {
    const existing_diff = (existing?.differentiators as string[]) ?? []
    const merged = [...new Set([...existing_diff, ...extracted.differentiators])]
    mergeUpdate.differentiators = merged
    updatedFields.push(`differentiators (+${extracted.differentiators.length})`)
  }
  if (extracted.products?.length) {
    const existingProds = (existing?.products as { name: string }[]) ?? []
    const existingNames = new Set(existingProds.map(p => p.name.toLowerCase()))
    const newProds = extracted.products.filter(p => !existingNames.has(p.name.toLowerCase()))
    if (newProds.length > 0) {
      mergeUpdate.products = [...existingProds, ...newProds]
      updatedFields.push(`products (+${newProds.length}: ${newProds.map(p => p.name).join(', ')})`)
    }
  }

  if (updatedFields.length === 0) {
    return { reply: "I couldn't find specific company details to update. Try mentioning your company name, products, value propositions, or description.", actions: [] }
  }

  if (existing) {
    await db.update(companyProfiles).set(mergeUpdate).where(eq(companyProfiles.workspaceId, workspaceId))
  } else {
    const companyName = (extracted.companyName ?? mergeUpdate.companyName ?? 'My Company') as string
    await db.insert(companyProfiles).values({
      workspaceId, userId, companyName,
      description: (extracted.description as string) ?? null,
      industry: (extracted.industry as string) ?? null,
      targetMarket: (extracted.targetMarket as string) ?? null,
      competitiveAdvantage: (extracted.competitiveAdvantage as string) ?? null,
      founded: extracted.founded ? parseInt(String(extracted.founded), 10) || null : null,
      employeeCount: (extracted.employeeCount as string) ?? null,
      valuePropositions: (extracted.valuePropositions as string[]) ?? [],
      differentiators: (extracted.differentiators as string[]) ?? [],
      products: (extracted.products ?? []),
      commonObjections: [], knownCapabilities: [],
      createdAt: now, updatedAt: now,
    })
  }

  await db.insert(events).values({ workspaceId, userId, type: 'company_profile.updated', metadata: { fields: updatedFields, source: 'ai_chat' }, createdAt: now })

  return {
    reply: `Updated your company profile with ${updatedFields.length} field${updatedFields.length > 1 ? 's' : ''}: **${updatedFields.join(', ')}**.\n\nView and refine on the [Company Profile](/company) page.`,
    actions: [{ type: 'company_updated', fields: updatedFields }],
  }
}

// ── Handler: unified collateral generation (fully freeform, brain-enriched) ───
async function handleCollateral(
  workspaceId: string, userId: string, text: string, plan: string,
  activeDealId: string | null, brain: WorkspaceBrain | null,
): Promise<{ reply: string; actions: ActionCard[] }> {
  // Check company profile exists
  const [profileRow] = await db.select({ id: companyProfiles.id }).from(companyProfiles)
    .where(eq(companyProfiles.workspaceId, workspaceId)).limit(1)
  if (!profileRow) {
    return { reply: "I need your **Company Profile** before I can generate collateral. Complete it at [Company](/company) first.", actions: [] }
  }

  // Check plan limits
  const limits = PLAN_LIMITS[plan as 'free' | 'starter' | 'pro']
  if (limits.collateral !== null) {
    const [{ value: cc }] = await db.select({ value: count() }).from(collateral).where(eq(collateral.workspaceId, workspaceId))
    if (!isWithinLimit(Number(cc), limits.collateral)) {
      return { reply: `Collateral limit reached on your ${plan} plan. [Upgrade](/settings) to generate more.`, actions: [] }
    }
  }

  // Use Haiku to extract what the user wants to generate
  const extractMsg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Extract document generation request details. Return ONLY JSON:
{
  "title": "concise document title (5-8 words)",
  "description": "what the document should contain and achieve",
  "customTypeName": "short type label e.g. 'Objection Handler', 'One-Pager', 'Talk Track', 'Pricing Justification', 'Competitive Analysis', 'Email Sequence', 'Strategy Brief'",
  "targetAudience": "who this is for, e.g. 'CFO', 'IT team', 'all stakeholders' or null",
  "mentionedCompany": "prospect/company name mentioned in request, or null"
}
Request: ${text.slice(0, 600)}`,
    }],
  })

  let extracted: { title: string; description: string; customTypeName: string; targetAudience: string | null; mentionedCompany: string | null } = {
    title: 'Custom Document', description: text, customTypeName: 'Custom Document', targetAudience: null, mentionedCompany: null,
  }
  try {
    extracted = JSON.parse(stripJson((extractMsg.content[0] as { type: string; text: string }).text))
  } catch { /* use defaults */ }

  // Build deal context — prefer activeDealId directly, then text-based fuzzy match
  let dealContext: string | undefined
  let sourceDealLogId: string | null = null

  if (activeDealId && brain?.deals) {
    const brainDeal = brain.deals.find(d => d.id === activeDealId)
    if (brainDeal) {
      sourceDealLogId = activeDealId
      const winConditions = (brain.winPlaybook as any)?.perCompetitorWinCondition
      const dealComps = brainDeal.risks ?? []
      dealContext = [
        `Prospect: ${brainDeal.company}`,
        `Deal: "${brainDeal.name}"`,
        `Stage: ${brainDeal.stage?.replace(/_/g, ' ')}`,
        brainDeal.dealValue ? `Deal value: £${brainDeal.dealValue.toLocaleString()}` : '',
        brainDeal.conversionScore != null ? `Win probability score: ${brainDeal.conversionScore}%` : '',
        dealComps.length ? `Active risks: ${dealComps.slice(0, 3).join('; ')}` : '',
        brainDeal.summary ? `Deal summary: ${brainDeal.summary}` : '',
        extracted.targetAudience ? `Target audience: ${extracted.targetAudience}` : '',
        winConditions ? `Win conditions based on past deals: ${JSON.stringify(winConditions).slice(0, 300)}` : '',
      ].filter(Boolean).join('\n')
    }
  }

  // Fallback: fuzzy match by company name mentioned in text
  if (!dealContext) {
    const dealRows = await db.select({
      id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany,
      stage: dealLogs.stage, dealRisks: dealLogs.dealRisks, aiSummary: dealLogs.aiSummary,
      dealValue: dealLogs.dealValue, competitors: dealLogs.competitors,
    }).from(dealLogs).where(and(eq(dealLogs.workspaceId, workspaceId), sql`${dealLogs.stage} NOT IN ('closed_won', 'closed_lost')`)).limit(20)

    const lowerText = (text + ' ' + (extracted.mentionedCompany ?? '')).toLowerCase()
    const matchedDeal = dealRows.find(d =>
      lowerText.includes(d.dealName.toLowerCase()) || lowerText.includes(d.prospectCompany.toLowerCase())
    )
    if (matchedDeal) {
      sourceDealLogId = matchedDeal.id
      const risks = (matchedDeal.dealRisks as string[]) ?? []
      const comps = (matchedDeal.competitors as string[]) ?? []
      dealContext = [
        `Prospect: ${matchedDeal.prospectCompany}`,
        `Stage: ${matchedDeal.stage?.replace(/_/g, ' ')}`,
        comps.length ? `Competitors: ${comps.join(', ')}` : '',
        matchedDeal.aiSummary ? `Deal summary: ${matchedDeal.aiSummary}` : '',
        risks.length ? `Active risks: ${risks.join('; ')}` : '',
        matchedDeal.dealValue ? `Deal value: £${matchedDeal.dealValue.toLocaleString()}` : '',
        extracted.targetAudience ? `Target audience: ${extracted.targetAudience}` : '',
      ].filter(Boolean).join('\n')
    }
  }

  // Inject pipeline-wide intelligence for richer generation
  let brainContext = ''
  if (brain) {
    const winRate = (brain.winLossIntel as any)?.winRate
    const champLift = (brain.winPlaybook as any)?.championPattern?.championLift
    const topGaps = (brain.productGapPriority ?? []).slice(0, 3).map((g: any) => g.title)
    brainContext = [
      winRate != null ? `Workspace win rate: ${winRate}%` : '',
      champLift != null ? `Having a champion improves win rate by +${Math.round(champLift * 100)}pts` : '',
      topGaps.length ? `Top product gaps to address: ${topGaps.join(', ')}` : '',
    ].filter(Boolean).join('\n')
  }

  const enhancedPrompt = [
    text,
    brainContext ? `\n\nWorkspace intelligence:\n${brainContext}` : '',
    extracted.targetAudience ? `\nTarget audience: ${extracted.targetAudience}` : '',
  ].filter(Boolean).join('')

  const dealSuffix = dealContext ? ` — ${dealContext.split('\n')[0].replace('Prospect: ', '')}` : ''
  const title = `${extracted.title}${dealSuffix}`
  const now = new Date()

  const [record] = await db.insert(collateral).values({
    workspaceId, userId, type: 'custom' as CollateralType,
    title: `Generating ${title}…`, status: 'generating',
    customTypeName: extracted.customTypeName,
    generationSource: 'chat',
    sourceCompetitorId: null, sourceCaseStudyId: null, sourceDealLogId,
    content: null, rawResponse: null, generatedAt: null, createdAt: now, updatedAt: now,
  }).returning()

  const colId = record.id
  try {
    const result = await generateFreeformCollateral({
      workspaceId,
      title: extracted.title,
      description: extracted.description,
      dealContext,
      customPrompt: enhancedPrompt,
    })
    const generatedAt = new Date()
    await db.update(collateral)
      .set({ title: result.title, status: 'ready', content: result.content, rawResponse: result.rawResponse, generatedAt, updatedAt: generatedAt })
      .where(eq(collateral.id, colId))
    await db.insert(events).values({
      workspaceId, userId, type: 'collateral.generated',
      metadata: { collateralId: colId, collateralType: 'custom', customTypeName: extracted.customTypeName, title: result.title, source: 'chat' },
      createdAt: new Date(),
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await db.update(collateral).set({ status: 'stale', rawResponse: { error: errMsg }, updatedAt: new Date() }).where(eq(collateral.id, colId))
    return { reply: `❌ Failed to generate **${title}**: ${errMsg}`, actions: [] }
  }

  return {
    reply: `Your **${extracted.customTypeName}** is ready — [View in Collateral](/collateral/${colId})`,
    actions: [{ type: 'collateral_generating', colType: 'custom', title: extracted.title }],
  }
}

// ── Handler: project plan creation ──────────────────────────────────────────
async function handleProjectPlan(
  workspaceId: string, userId: string, text: string, activeDealId: string | null,
): Promise<{ reply: string; actions: ActionCard[] }> {
  const dealRows = await db.select({
    id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany,
    stage: dealLogs.stage, projectPlan: dealLogs.projectPlan, todos: dealLogs.todos,
  }).from(dealLogs).where(and(eq(dealLogs.workspaceId, workspaceId), sql`${dealLogs.stage} NOT IN ('closed_won', 'closed_lost')`)).limit(20)

  const lowerText = text.toLowerCase()

  // Prefer activeDealId if provided
  let matchedDeal = activeDealId ? dealRows.find(d => d.id === activeDealId) : undefined

  if (!matchedDeal) {
    matchedDeal = dealRows.find(d =>
      lowerText.includes(d.dealName.toLowerCase()) || lowerText.includes(d.prospectCompany.toLowerCase())
    )
  }

  if (!matchedDeal && dealRows.length > 0) {
    const dealList = dealRows.map(d => `${d.dealName} (${d.prospectCompany})`).join(', ')
    const matchMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Which of these deals does this project plan relate to? Return ONLY the exact deal name, or "none" if unclear.\nDeals: ${dealList}\nText: ${text.slice(0, 500)}`,
      }],
    })
    const matchName = (matchMsg.content[0] as { type: string; text: string }).text.trim().toLowerCase()
    if (matchName !== 'none') {
      matchedDeal = dealRows.find(d =>
        matchName.includes(d.dealName.toLowerCase()) || matchName.includes(d.prospectCompany.toLowerCase())
      )
    }
  }

  if (!matchedDeal) {
    return {
      reply: "I need to know which deal this project plan is for. Mention the deal or company name, or navigate to the deal page and ask again.",
      actions: [],
    }
  }

  const existingTodos = ((matchedDeal as any).todos as any[]) ?? []
  const todoContext = existingTodos.length > 0
    ? `\n\nExisting deal to-dos (link relevant tasks using these IDs):\n${existingTodos.map((t: any) => `- ID: ${t.id} | "${t.text}" | Done: ${t.done}`).join('\n')}`
    : ''

  const extractMsg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 4000,
    system: `You are a project plan extractor for a sales deal management tool. Convert ANY format of input into structured project plan JSON. Respond with ONLY a valid JSON object — no explanation, no preamble, no markdown fences.`,
    messages: [{
      role: 'user',
      content: `Convert this into a project plan for the deal with "${matchedDeal.prospectCompany}".

The input may be a table, spreadsheet, or free text. Extract all tasks/calls/meetings and group into logical phases.
${todoContext}

Return this JSON (use short IDs like "p1", "t1"):
{
  "title": "Project Plan — [short descriptive title]",
  "phases": [
    {
      "id": "p1",
      "name": "Phase name",
      "description": "Brief description",
      "order": 1,
      "targetDate": "YYYY-MM-DD or null",
      "tasks": [
        {
          "id": "t1",
          "text": "Task description",
          "status": "not_started",
          "owner": "person/team or null",
          "dueDate": "YYYY-MM-DD or null",
          "linkedTodoId": null,
          "notes": "extra context or null"
        }
      ]
    }
  ]
}

Input:
${text.slice(0, 8000)}`,
    }],
  })

  let parsed: any
  try {
    const raw = (extractMsg.content[0] as { type: string; text: string }).text
    let jsonText = raw.trim()
    try { parsed = JSON.parse(jsonText) } catch {
      jsonText = jsonText.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim()
      try { parsed = JSON.parse(jsonText) } catch {
        const s = raw.indexOf('{'), e = raw.lastIndexOf('}')
        if (s !== -1 && e > s) parsed = JSON.parse(raw.slice(s, e + 1))
        else throw new Error('no JSON')
      }
    }
  } catch {
    return {
      reply: "I couldn't extract a project plan from that. Try mentioning the deal name and pasting the plan content — tables, bullet points, or meeting notes all work.",
      actions: [],
    }
  }

  const now = new Date().toISOString()
  const existing = matchedDeal.projectPlan as any

  const projectPlan = existing?.phases
    ? {
        title: parsed.title || existing.title,
        createdAt: existing.createdAt,
        updatedAt: now,
        sourceText: (existing.sourceText ? existing.sourceText + '\n---\n' : '') + text.slice(0, 3000),
        phases: [
          ...existing.phases,
          ...parsed.phases.map((p: any, i: number) => ({ ...p, order: existing.phases.length + i + 1 })),
        ],
      }
    : {
        title: parsed.title || `Project Plan — ${matchedDeal.prospectCompany}`,
        createdAt: now,
        updatedAt: now,
        sourceText: text.slice(0, 3000),
        phases: parsed.phases ?? [],
      }

  await db.update(dealLogs)
    .set({ projectPlan, updatedAt: new Date() } as any)
    .where(eq(dealLogs.id, matchedDeal.id))

  after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch {} })

  const totalTasks = parsed.phases?.reduce((sum: number, p: any) => sum + (p.tasks?.length ?? 0), 0) ?? 0
  const linkedCount = parsed.phases?.reduce((sum: number, p: any) => sum + (p.tasks?.filter((t: any) => t.linkedTodoId).length ?? 0), 0) ?? 0

  return {
    reply: `Created **project plan** for **${matchedDeal.prospectCompany}** with ${parsed.phases?.length ?? 0} phases and ${totalTasks} tasks.${linkedCount > 0 ? ` ${linkedCount} task${linkedCount > 1 ? 's' : ''} linked to existing to-dos.` : ''}\n\nView and manage it in [Deal → Project Plan](/deals/${matchedDeal.id}).`,
    actions: [{ type: 'deal_updated' as const, dealId: matchedDeal.id, dealName: matchedDeal.dealName, changes: ['Project plan created'] }],
  }
}

// ── Handler: create deal ───────────────────────────────────────────────────────
async function handleDealCreate(
  workspaceId: string, userId: string, text: string,
): Promise<{ reply: string; actions: ActionCard[] }> {
  const extractMsg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Extract deal/prospect information from this text. Return ONLY JSON:
{
  "dealName": "string (use company name if no deal name given)",
  "prospectCompany": "string",
  "prospectName": "string or null",
  "prospectTitle": "string or null",
  "dealValue": "number in dollars (integer) or null",
  "stage": "prospecting|qualification|discovery|proposal|negotiation or null",
  "competitors": ["string"] or [],
  "notes": "string or null"
}
Text: ${text.slice(0, 3000)}`,
    }],
  })

  interface ExtractedDeal {
    dealName?: string; prospectCompany?: string; prospectName?: string | null; prospectTitle?: string | null
    dealValue?: number | null; stage?: string | null; competitors?: string[]; notes?: string | null
  }

  let extracted: ExtractedDeal = {}
  try { extracted = JSON.parse(stripJson((extractMsg.content[0] as { type: string; text: string }).text)) }
  catch { return { reply: "I couldn't extract deal details. Try: _\"New prospect: ACME Corp, meeting with John Smith (CEO), potential $50k deal\"_", actions: [] } }

  if (!extracted.prospectCompany && !extracted.dealName) {
    return { reply: "I need at least a company name to create a deal. Try: _\"New deal: ACME Corp, $50k\"_", actions: [] }
  }

  const now = new Date()
  const [deal] = await db.insert(dealLogs).values({
    workspaceId, userId,
    dealName: extracted.dealName ?? extracted.prospectCompany ?? 'New Deal',
    prospectCompany: extracted.prospectCompany ?? extracted.dealName ?? '',
    prospectName: extracted.prospectName ?? null,
    prospectTitle: extracted.prospectTitle ?? null,
    dealValue: extracted.dealValue ?? null,
    stage: (extracted.stage as 'prospecting' | 'qualification' | 'discovery' | 'proposal' | 'negotiation') ?? 'prospecting',
    competitors: extracted.competitors ?? [],
    notes: extracted.notes ?? null,
    createdAt: now, updatedAt: now,
  }).returning()

  await db.insert(events).values({ workspaceId, userId, type: 'deal_log.created', metadata: { dealId: deal.id, dealName: deal.dealName, source: 'ai_chat' }, createdAt: now })
  after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ } })

  return {
    reply: `Created deal **${deal.dealName}** at **${deal.prospectCompany}**${deal.dealValue ? ` ($${deal.dealValue.toLocaleString()})` : ''}. Stage: **${deal.stage}**.\n\nView and edit it in [Deal Log](/deals/${deal.id}).`,
    actions: [{ type: 'deal_created', dealId: deal.id, dealName: deal.dealName, company: deal.prospectCompany }],
  }
}

// ── Handler: create case study ─────────────────────────────────────────────────
async function handleCaseStudyCreate(
  workspaceId: string, userId: string, text: string,
): Promise<{ reply: string; actions: ActionCard[] }> {
  const extractMsg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 768,
    messages: [{
      role: 'user',
      content: `Extract case study information from this text. Return ONLY JSON:
{
  "customerName": "string",
  "customerIndustry": "string or null",
  "customerSize": "string or null",
  "challenge": "string — what problem they had",
  "solution": "string — how it was solved",
  "results": "string — outcomes achieved",
  "metrics": [{"label": "string", "value": "string", "unit": "string or null"}]
}
Text: ${text.slice(0, 4000)}`,
    }],
  })

  interface ExtractedCS {
    customerName?: string; customerIndustry?: string | null; customerSize?: string | null
    challenge?: string; solution?: string; results?: string
    metrics?: { label: string; value: string; unit?: string | null }[]
  }

  let extracted: ExtractedCS = {}
  try { extracted = JSON.parse(stripJson((extractMsg.content[0] as { type: string; text: string }).text)) }
  catch { return { reply: "I couldn't extract case study details. Try describing: the customer, their challenge, your solution, and the results.", actions: [] } }

  if (!extracted.customerName || !extracted.challenge) {
    return { reply: "I need at least the customer name and their challenge to create a case study. Tell me more about the win.", actions: [] }
  }

  const now = new Date()
  const [cs] = await db.insert(caseStudies).values({
    workspaceId, userId,
    customerName: extracted.customerName,
    customerIndustry: extracted.customerIndustry ?? null,
    customerSize: extracted.customerSize ?? null,
    challenge: extracted.challenge ?? '',
    solution: extracted.solution ?? '',
    results: extracted.results ?? '',
    metrics: extracted.metrics ?? [],
    generatedNarrative: null, isPublic: false,
    createdAt: now, updatedAt: now,
  }).returning()

  await db.insert(events).values({ workspaceId, userId, type: 'case_study.created', metadata: { caseStudyId: cs.id, customerName: cs.customerName, source: 'ai_chat' }, createdAt: now })

  return {
    reply: `Created case study for **${cs.customerName}**. You can now generate a polished Case Study Doc from [Collateral](/collateral), or view/edit it in [Case Studies](/case-studies).`,
    actions: [{ type: 'case_study_created', id: cs.id, customerName: cs.customerName }],
  }
}

// ── Handler: deal action (manage todos, field updates) — activeDealId-aware ───
async function handleDealAction(
  workspaceId: string, userId: string, text: string, activeDealId: string | null,
): Promise<{ reply: string; actions: ActionCard[]; confirmationRequired?: boolean; pendingAction?: PendingAction }> {
  const dealRows = await db.select({
    id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany,
    stage: dealLogs.stage, todos: dealLogs.todos, notes: dealLogs.notes, meetingNotes: dealLogs.meetingNotes,
    dealValue: dealLogs.dealValue, competitors: dealLogs.competitors, contacts: dealLogs.contacts,
  }).from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId))

  if (dealRows.length === 0) {
    return { reply: 'No deals found in your workspace.', actions: [] }
  }

  // Always run LLM for action classification — pass activeDealId as a strong hint
  const dealList = dealRows.map(d => `id:${d.id} | "${d.dealName}" — ${d.prospectCompany}`).join('\n')
  const activeDealHint = activeDealId
    ? `\nIMPORTANT: The user is currently viewing deal ID "${activeDealId}". Use this as the target deal unless the request clearly refers to a different deal.`
    : ''

  const identifyMsg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 350,
    messages: [{
      role: 'user',
      content: `User request: "${text}"

Available deals:
${dealList}${activeDealHint}

Return ONLY JSON:
{
  "dealId": "matching deal id or null",
  "action": "remove_outdated_todos|complete_todos|remove_specific_todos|update_stage|update_value|update_notes|update_close_date|update_next_steps|add_competitor|remove_competitor|add_contact|qa",
  "description": "brief description of what to do",
  "stageValue": "new stage if action=update_stage, else null — one of: prospecting|qualification|discovery|proposal|negotiation|closed_won|closed_lost",
  "valueInDollars": "integer in dollars if action=update_value, else null",
  "notesText": "text to append if action=update_notes, else null",
  "closeDateISO": "ISO date string YYYY-MM-DD if action=update_close_date, else null",
  "nextStepsText": "new next steps text if action=update_next_steps, else null",
  "competitorName": "competitor name if add/remove_competitor, else null",
  "contactName": "contact name if action=add_contact, else null",
  "contactTitle": "contact title if action=add_contact, else null",
  "contactEmail": "contact email if action=add_contact, else null"
}`,
    }],
  })

  interface ActionIdentified {
    dealId: string | null; action: string; description: string
    stageValue?: string | null; valueInDollars?: number | null; notesText?: string | null
    closeDateISO?: string | null; nextStepsText?: string | null
    competitorName?: string | null; contactName?: string | null
    contactTitle?: string | null; contactEmail?: string | null
  }
  let identified: ActionIdentified = { dealId: null, action: 'qa', description: '' }
  try { identified = JSON.parse(stripJson((identifyMsg.content[0] as { type: string; text: string }).text)) } catch { /* use defaults */ }

  // Fall back to activeDealId if LLM didn't identify a deal
  const resolvedDealId = identified.dealId ?? activeDealId

  if (!resolvedDealId) {
    const allTodoSummaries = dealRows.slice(0, 10).map(d => {
      const pending = ((d.todos as { text: string; done: boolean }[]) ?? []).filter(t => !t.done)
      return `**${d.dealName}**: ${pending.length === 0 ? 'no pending todos' : pending.map(t => `• ${t.text}`).join(', ')}`
    }).join('\n')
    return { reply: `I couldn't identify a specific deal from your message. Here are current todos:\n\n${allTodoSummaries}`, actions: [] }
  }

  const targetDeal = dealRows.find(d => d.id === resolvedDealId)
  if (!targetDeal) return { reply: "Couldn't find that deal.", actions: [] }

  // Handle non-todo deal field updates
  if (identified.action === 'update_stage' && identified.stageValue) {
    await db.update(dealLogs).set({ stage: identified.stageValue as any, updatedAt: new Date() }).where(eq(dealLogs.id, targetDeal.id))
    await db.insert(events).values({ workspaceId, userId, type: 'deal_log.updated', metadata: { dealId: targetDeal.id, field: 'stage', value: identified.stageValue, source: 'ai_chat' }, createdAt: new Date() })
    after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ } })
    return {
      reply: `Updated **${targetDeal.dealName}** stage to **${identified.stageValue}**.`,
      actions: [{ type: 'deal_updated', dealId: targetDeal.id, dealName: targetDeal.dealName, changes: [`stage → ${identified.stageValue}`] }],
    }
  }

  if (identified.action === 'update_value' && identified.valueInDollars != null) {
    await db.update(dealLogs).set({ dealValue: identified.valueInDollars, updatedAt: new Date() }).where(eq(dealLogs.id, targetDeal.id))
    after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ } })
    return {
      reply: `Updated **${targetDeal.dealName}** deal value to **$${identified.valueInDollars.toLocaleString()}**.`,
      actions: [{ type: 'deal_updated', dealId: targetDeal.id, dealName: targetDeal.dealName, changes: [`value → $${identified.valueInDollars.toLocaleString()}`] }],
    }
  }

  if (identified.action === 'update_notes' && identified.notesText) {
    const newNotes = ((targetDeal.notes ?? '') + '\n\n' + identified.notesText).trim()
    await db.update(dealLogs).set({ notes: newNotes, updatedAt: new Date() }).where(eq(dealLogs.id, targetDeal.id))
    after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ } })
    return {
      reply: `Added notes to **${targetDeal.dealName}**.`,
      actions: [{ type: 'deal_updated', dealId: targetDeal.id, dealName: targetDeal.dealName, changes: ['notes updated'] }],
    }
  }

  if (identified.action === 'update_close_date' && identified.closeDateISO) {
    const closeDate = new Date(identified.closeDateISO)
    if (!isNaN(closeDate.getTime())) {
      await db.update(dealLogs).set({ closeDate, updatedAt: new Date() } as any).where(eq(dealLogs.id, targetDeal.id))
      after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ } })
      return {
        reply: `Set close date for **${targetDeal.dealName}** to **${closeDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}**.`,
        actions: [{ type: 'deal_updated', dealId: targetDeal.id, dealName: targetDeal.dealName, changes: [`close date → ${identified.closeDateISO}`] }],
      }
    }
  }

  if (identified.action === 'update_next_steps' && identified.nextStepsText) {
    await db.update(dealLogs).set({ nextSteps: identified.nextStepsText, updatedAt: new Date() } as any).where(eq(dealLogs.id, targetDeal.id))
    after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ } })
    return {
      reply: `Updated next steps for **${targetDeal.dealName}**: "${identified.nextStepsText}"`,
      actions: [{ type: 'deal_updated', dealId: targetDeal.id, dealName: targetDeal.dealName, changes: ['next steps updated'] }],
    }
  }

  if (identified.action === 'add_competitor' && identified.competitorName) {
    const currentComp: string[] = (targetDeal as any).competitors ?? []
    if (!currentComp.map((c: string) => c.toLowerCase()).includes(identified.competitorName.toLowerCase())) {
      await db.update(dealLogs).set({ competitors: [...currentComp, identified.competitorName], updatedAt: new Date() } as any).where(eq(dealLogs.id, targetDeal.id))
      after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ } })
    }
    return {
      reply: `Added **${identified.competitorName}** as a competitor on **${targetDeal.dealName}**.`,
      actions: [{ type: 'deal_updated', dealId: targetDeal.id, dealName: targetDeal.dealName, changes: [`competitor added: ${identified.competitorName}`] }],
    }
  }

  if (identified.action === 'remove_competitor' && identified.competitorName) {
    const currentComp: string[] = (targetDeal as any).competitors ?? []
    const updated = currentComp.filter((c: string) => c.toLowerCase() !== identified.competitorName!.toLowerCase())
    await db.update(dealLogs).set({ competitors: updated, updatedAt: new Date() } as any).where(eq(dealLogs.id, targetDeal.id))
    after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ } })
    return {
      reply: `Removed **${identified.competitorName}** from competitors on **${targetDeal.dealName}**.`,
      actions: [{ type: 'deal_updated', dealId: targetDeal.id, dealName: targetDeal.dealName, changes: [`competitor removed: ${identified.competitorName}`] }],
    }
  }

  if (identified.action === 'add_contact' && identified.contactName) {
    const existing: any = await db.select({ contacts: dealLogs.contacts }).from(dealLogs).where(eq(dealLogs.id, targetDeal.id)).limit(1)
    const currentContacts: any[] = (existing[0]?.contacts as any[]) ?? []
    const newContact = { name: identified.contactName, title: identified.contactTitle ?? undefined, email: identified.contactEmail ?? undefined }
    await db.update(dealLogs).set({ contacts: [...currentContacts, newContact], updatedAt: new Date() } as any).where(eq(dealLogs.id, targetDeal.id))
    after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ } })
    return {
      reply: `Added **${identified.contactName}**${identified.contactTitle ? ` (${identified.contactTitle})` : ''} to **${targetDeal.dealName}**.`,
      actions: [{ type: 'deal_updated', dealId: targetDeal.id, dealName: targetDeal.dealName, changes: [`contact added: ${identified.contactName}`] }],
    }
  }

  const deal = targetDeal
  const allTodos = (deal.todos as { id: string; text: string; done: boolean; createdAt: string }[]) ?? []
  const pendingTodos = allTodos.filter(t => !t.done)

  if (pendingTodos.length === 0) {
    return { reply: `**${deal.dealName}** has no pending todos.`, actions: [] }
  }

  // Build meeting history for context
  const recentNotes = (() => {
    const history = (deal.meetingNotes as string | null) || (deal.notes as string | null)
    if (!history) return 'No meeting history recorded.'
    const entries = history.split('\n').reduce<string[]>((acc, line) => {
      if (/^\[\d/.test(line)) acc.push(line)
      else if (acc.length > 0) acc[acc.length - 1] += ' ' + line.trim()
      return acc
    }, [])
    if (entries.length > 0) return entries.slice(-5).join('\n')
    return history.split('\n').filter(l => l.trim()).slice(-40).join('\n')
  })()

  const decideMsg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `User request: "${text}"

Deal: "${deal.dealName}" — ${deal.prospectCompany} (stage: ${deal.stage})

Meeting history / notes:
${recentNotes}

Pending todos (numbered 1 to ${pendingTodos.length}):
${pendingTodos.map((t, i) => `${i + 1}. "${t.text}"`).join('\n')}

Return ONLY JSON using the 1-based numbers above:
{
  "remove": [2, 4],
  "complete": [1],
  "reason": "brief explanation of changes made"
}

Cross-reference the meeting history to judge which todos are still relevant.
Be conservative — only remove todos that are clearly stale, already handled, or made irrelevant by what happened in meetings.`,
    }],
  })

  interface TodoDecision { remove: number[]; complete: number[]; reason: string }
  let decisions: TodoDecision = { remove: [], complete: [], reason: '' }
  try {
    const raw = JSON.parse(stripJson((decideMsg.content[0] as { type: string; text: string }).text))
    const toNumbers = (arr: unknown): number[] =>
      (Array.isArray(arr) ? arr : []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= pendingTodos.length)
    decisions = { remove: toNumbers(raw.remove), complete: toNumbers(raw.complete), reason: raw.reason ?? '' }
  } catch { /* no changes */ }

  const removeIds = decisions.remove.map(n => pendingTodos[n - 1]?.id).filter(Boolean) as string[]
  const completeIds = decisions.complete.map(n => pendingTodos[n - 1]?.id).filter(Boolean) as string[]

  if (removeIds.length === 0 && completeIds.length === 0) {
    return { reply: `No todos were changed for **${deal.dealName}**. ${decisions.reason || 'All todos appear current and relevant.'}`, actions: [] }
  }

  // For destructive removals, require confirmation before executing
  if (removeIds.length > 0) {
    const removedTexts = allTodos.filter(t => removeIds.includes(t.id)).map(t => t.text)
    const completedTexts = allTodos.filter(t => completeIds.includes(t.id)).map(t => t.text)

    let previewReply = `Here's what I'd change for **${deal.dealName}**:`
    if (removeIds.length > 0) {
      previewReply += `\n\n**Remove (${removeIds.length}):**`
      removedTexts.forEach(t => { previewReply += `\n- ~~${t}~~` })
    }
    if (completeIds.length > 0) {
      previewReply += `\n\n**Mark Done (${completeIds.length}):**`
      completedTexts.forEach(t => { previewReply += `\n- ✓ ${t}` })
    }
    if (decisions.reason) previewReply += `\n\n_${decisions.reason}_`
    previewReply += `\n\n**Confirm to apply these changes.**`

    return {
      reply: previewReply,
      actions: [],
      confirmationRequired: true,
      pendingAction: {
        type: 'todo_cleanup',
        dealId: deal.id,
        dealName: deal.dealName,
        removeIds,
        completeIds,
        removedTexts,
        completedTexts,
      },
    }
  }

  // Complete-only (non-destructive) — execute immediately
  const updatedTodos = allTodos.map(t => completeIds.includes(t.id) ? { ...t, done: true } : t)
  await db.update(dealLogs).set({ todos: updatedTodos, updatedAt: new Date() }).where(eq(dealLogs.id, deal.id))
  await db.insert(events).values({
    workspaceId, userId, type: 'deal_log.todos_updated',
    metadata: { dealId: deal.id, removed: 0, completed: completeIds.length, source: 'ai_chat' },
    createdAt: new Date(),
  })
  after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ } })

  const completedTexts = allTodos.filter(t => completeIds.includes(t.id)).map(t => t.text)
  let reply = `✅ **${deal.dealName}** — Marked ${completeIds.length} todo${completeIds.length > 1 ? 's' : ''} done:`
  completedTexts.forEach(t => { reply += `\n- ✓ ${t}` })
  if (decisions.reason) reply += `\n\n_${decisions.reason}_`

  return {
    reply,
    actions: [{ type: 'todos_updated', added: 0, removed: 0, completed: completeIds.length, dealName: deal.dealName }],
  }
}

// ── Execute a confirmed pending action ────────────────────────────────────────
async function executeConfirmedAction(
  workspaceId: string, userId: string, pendingAction: PendingAction,
): Promise<{ reply: string; actions: ActionCard[] }> {
  if (pendingAction.type === 'todo_cleanup') {
    const { dealId, dealName, removeIds, completeIds } = pendingAction

    const [dealRow] = await db.select({ todos: dealLogs.todos })
      .from(dealLogs).where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId))).limit(1)

    if (!dealRow) return { reply: "Couldn't find that deal.", actions: [] }

    const allTodos = (dealRow.todos as { id: string; text: string; done: boolean; createdAt: string }[]) ?? []
    const removeSet = new Set(removeIds)
    const completeSet = new Set(completeIds)

    const updatedTodos = allTodos
      .filter(t => !removeSet.has(t.id))
      .map(t => completeSet.has(t.id) ? { ...t, done: true } : t)

    await db.update(dealLogs).set({ todos: updatedTodos, updatedAt: new Date() }).where(eq(dealLogs.id, dealId))
    await db.insert(events).values({
      workspaceId, userId, type: 'deal_log.todos_updated',
      metadata: { dealId, removed: removeIds.length, completed: completeIds.length, source: 'ai_chat_confirmed' },
      createdAt: new Date(),
    })
    after(async () => { try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ } })

    let reply = `✅ **${dealName}** — Todos updated`
    if (removeIds.length > 0) {
      reply += `\n\n**Removed (${removeIds.length}):**`
      pendingAction.removedTexts.forEach(t => { reply += `\n- ~~${t}~~` })
    }
    if (completeIds.length > 0) {
      reply += `\n\n**Marked Done (${completeIds.length}):**`
      pendingAction.completedTexts.forEach(t => { reply += `\n- ✓ ${t}` })
    }

    const remaining = updatedTodos.filter(t => !t.done)
    if (remaining.length > 0) {
      reply += `\n\n**Remaining (${remaining.length}):**`
      remaining.forEach(t => { reply += `\n- ${t.text}` })
    }

    return {
      reply,
      actions: [{ type: 'todos_updated', added: 0, removed: removeIds.length, completed: completeIds.length, dealName }],
    }
  }

  return { reply: 'Unknown action type.', actions: [] }
}

// ── Handler: pipeline query — structured overview using brain data ────────────
async function handlePipelineQuery(
  workspaceId: string, text: string,
): Promise<{ reply: string; actions: ActionCard[] }> {
  const brain = await getWorkspaceBrain(workspaceId)

  if (!brain || !brain.deals || brain.deals.length === 0) {
    return {
      reply: "No pipeline data yet — add some deals first and I'll give you a full overview.",
      actions: [],
    }
  }

  const activeDeals = brain.deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
  const urgentDeals = brain.urgentDeals ?? []
  const staleDeals = brain.staleDeals ?? []
  const patterns = brain.keyPatterns ?? []
  const recs = brain.pipelineRecommendations ?? []

  const totalValue = activeDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)
  const highScore = activeDeals.filter(d => (d.conversionScore ?? 0) >= 70)
  const atRisk = activeDeals.filter(d => d.conversionScore != null && d.conversionScore < 40)

  const dealSummaries = activeDeals.slice(0, 15).map(d =>
    `- ${d.company} "${d.name}" | ${d.stage} | ${d.dealValue ? `£${d.dealValue.toLocaleString()}` : 'no value'} | score: ${d.conversionScore != null ? `${d.conversionScore}%` : 'not scored'}${(d.risks ?? []).length > 0 ? ` | risks: ${d.risks.slice(0, 2).join('; ')}` : ''}${(d.pendingTodos ?? []).length > 0 ? ` | ${d.pendingTodos.length} open todos` : ''}`
  ).join('\n')

  const patternSummary = patterns.slice(0, 4).map(p => `• ${p.label} — ${p.companies?.slice(0, 3).join(', ')}`).join('\n')
  const recSummary = recs.filter(r => r.priority === 'high').slice(0, 3).map(r => `• ${r.action} → ${r.dealName}`).join('\n')

  const churnAlerts = (brain.mlPredictions ?? [])
    .filter(p => (p.churnRisk ?? 0) >= 65)
    .sort((a, b) => (b.churnRisk ?? 0) - (a.churnRisk ?? 0))
    .slice(0, 4)
  const churnSection = churnAlerts.length > 0
    ? `\nChurn risk alerts:\n${churnAlerts.map(p => {
        const d = activeDeals.find(deal => deal.id === p.dealId)
        return `• ${d?.company ?? p.dealId} "${d?.name ?? ''}" — ${p.churnRisk}% churn risk${p.churnDaysOverdue ? ` (${p.churnDaysOverdue}d since last contact)` : ''}`
      }).join('\n')}`
    : ''

  const gapImpacts = (brain.productGapPriority ?? [])
    .filter(g => typeof g.winRateDelta === 'number' && g.winRateDelta <= -10)
    .slice(0, 3)
  const gapSection = gapImpacts.length > 0
    ? `\nProduct gaps impacting win rate:\n${gapImpacts.map(g =>
        `• "${g.title}": ${g.winRateWithGap}% win rate with gap vs ${g.winRateWithoutGap}% without (▼${Math.abs(g.winRateDelta!)}pts)`
      ).join('\n')}`
    : ''

  const summaryMsg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `You are a B2B sales AI assistant. Produce a concise, direct pipeline summary for the CEO/sales leader.

User asked: "${text}"

Pipeline data:
${dealSummaries}

Stats: ${activeDeals.length} active deals | Total pipeline value: ${totalValue > 0 ? `£${totalValue.toLocaleString()}` : 'unknown'} | ${highScore.length} likely to close | ${atRisk.length} at risk

Urgent deals: ${urgentDeals.slice(0, 3).map(d => d.company).join(', ') || 'none'}
Stale deals: ${staleDeals.slice(0, 3).map(d => d.company).join(', ') || 'none'}${churnSection}${gapSection}

Cross-deal patterns:
${patternSummary || 'None detected'}

High-priority recommendations:
${recSummary || 'None yet'}

Write a direct, scannable summary with:
1. One-line overall health assessment
2. Top 2-3 deals to focus on RIGHT NOW (with specific reason)
3. Biggest risk across the pipeline
4. One action the sales leader should take today

Be specific. Reference deal names. UK English. Use markdown.`,
    }],
  })

  const reply = (summaryMsg.content[0] as { type: string; text: string }).text
  return { reply, actions: [] }
}

// ── Main POST handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rl = await checkRateLimit(userId, 'chat', 20)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)
    const { workspaceId, plan } = await getWorkspaceContext(userId)
    const { messages, activeDealId, currentPage, confirmAction } = await req.json()

    // ── Confirmed action (user clicked "Confirm" on a pending destructive action) ──
    if (confirmAction) {
      const result = await executeConfirmedAction(workspaceId, userId, confirmAction as PendingAction)
      return NextResponse.json(result)
    }

    if (!messages?.length) return NextResponse.json({ error: 'messages required' }, { status: 400 })

    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    const lastText: string = lastUserMsg?.content ?? ''

    // LLM-based intent classification (with regex fallback)
    const intent = await classifyIntent(lastText)

    if (intent === 'competitor_battlecard') {
      const result = await handleCompetitorBattlecard(workspaceId, userId, lastText, plan)
      return NextResponse.json(result)
    }

    if (intent === 'meeting_notes') {
      const result = await handleMeetingNotes(workspaceId, userId, lastText, activeDealId ?? null)
      return NextResponse.json(result)
    }

    if (intent === 'product_gap') {
      const result = await handleProductGapCreate(workspaceId, userId, lastText)
      return NextResponse.json(result)
    }

    if (intent === 'company_update') {
      const result = await handleCompanyUpdate(workspaceId, userId, lastText)
      return NextResponse.json(result)
    }

    if (intent === 'collateral') {
      // Load brain for rich context injection
      const brain = await getWorkspaceBrain(workspaceId)
      const result = await handleCollateral(workspaceId, userId, lastText, plan, activeDealId ?? null, brain)
      return NextResponse.json(result)
    }

    if (intent === 'project_plan') {
      const result = await handleProjectPlan(workspaceId, userId, lastText, activeDealId ?? null)
      return NextResponse.json(result)
    }

    if (intent === 'deal_create') {
      const result = await handleDealCreate(workspaceId, userId, lastText)
      return NextResponse.json(result)
    }

    if (intent === 'case_study_create') {
      const result = await handleCaseStudyCreate(workspaceId, userId, lastText)
      return NextResponse.json(result)
    }

    if (intent === 'deal_action') {
      const result = await handleDealAction(workspaceId, userId, lastText, activeDealId ?? null)
      return NextResponse.json(result)
    }

    if (intent === 'pipeline_query') {
      const result = await handlePipelineQuery(workspaceId, lastText)
      return NextResponse.json(result)
    }

    // ── Q&A: brain-first context ──────────────────────────────────────────────
    const [profileRows, competitorRows, caseStudyRows, brain] = await Promise.all([
      db.select().from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1),
      db.select({ name: competitors.name, strengths: competitors.strengths, weaknesses: competitors.weaknesses })
        .from(competitors).where(eq(competitors.workspaceId, workspaceId)).limit(8),
      db.select({ customerName: caseStudies.customerName, challenge: caseStudies.challenge, results: caseStudies.results })
        .from(caseStudies).where(eq(caseStudies.workspaceId, workspaceId)).limit(5),
      getWorkspaceBrain(workspaceId),
    ])

    const needDealFallback = !brain
    const [dealRows, gapRows] = needDealFallback
      ? await Promise.all([
          db.select({
            id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany,
            stage: dealLogs.stage, todos: dealLogs.todos, dealValue: dealLogs.dealValue,
          }).from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId)).limit(12),
          db.select({ title: productGaps.title, priority: productGaps.priority, status: productGaps.status })
            .from(productGaps).where(eq(productGaps.workspaceId, workspaceId)).limit(10),
        ])
      : [[], []]

    const profile = profileRows[0]
    const kbParts: string[] = []
    if (profile) {
      kbParts.push(`## Company: ${profile.companyName}\nValue props: ${((profile.valuePropositions as string[]) ?? []).slice(0, 4).join(', ')}\nDifferentiators: ${((profile.differentiators as string[]) ?? []).slice(0, 3).join(', ')}\nObjections: ${((profile.commonObjections as string[]) ?? []).slice(0, 3).join('; ')}`)
    }
    if (competitorRows.length > 0) {
      kbParts.push(`## Competitors: ${competitorRows.map(c => `${c.name} (weaknesses: ${((c.weaknesses as string[]) ?? []).slice(0, 2).join(', ')})`).join(' | ')}`)
    }
    if (caseStudyRows.length > 0) {
      kbParts.push(`## Case Studies: ${caseStudyRows.map(cs => `${cs.customerName}: ${(cs.challenge ?? '').slice(0, 50)}`).join(' | ')}`)
    }

    let brainSection = ''
    if (brain) {
      try { brainSection = `\n\n## Pipeline Intelligence\n${formatBrainContext(brain)}` }
      catch { /* non-fatal */ }
    } else if (dealRows.length > 0) {
      const open = dealRows.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
      kbParts.push(`## ${open.length} open deals`)
      open.slice(0, 8).forEach(d => {
        const pending = ((d.todos as { text: string; done: boolean }[]) ?? []).filter(t => !t.done)
        kbParts.push(`- ${d.dealName} (${d.prospectCompany}) ${d.stage}${d.dealValue ? ` £${d.dealValue.toLocaleString()}` : ''}${pending.length > 0 ? ` — ${pending.length} todos` : ''}`)
      })
    }
    if (!brain && gapRows.length > 0) {
      kbParts.push(`## Gaps: ${gapRows.map(g => `${g.title} [${g.priority}]`).join(', ')}`)
    }

    const brainDeals = brain?.deals ?? []
    const activeBrainDeal = activeDealId ? brainDeals.find(d => d.id === activeDealId) : null
    const activeDealRow = activeDealId && !activeBrainDeal ? dealRows.find(d => d.id === activeDealId) : null
    const activeDealSection = activeBrainDeal
      ? `\n\n## CURRENTLY VIEWING: ${activeBrainDeal.company}\nDeal: "${activeBrainDeal.name}" | Stage: ${activeBrainDeal.stage}${activeBrainDeal.dealValue ? ` | £${activeBrainDeal.dealValue.toLocaleString()}` : ''}${activeBrainDeal.conversionScore != null ? ` | Score: ${activeBrainDeal.conversionScore}%` : ''}\n${(activeBrainDeal.risks ?? []).length > 0 ? `Risks: ${activeBrainDeal.risks.join(', ')}\n` : ''}${(activeBrainDeal.pendingTodos ?? []).length > 0 ? `Open todos: ${activeBrainDeal.pendingTodos.join('; ')}\n` : ''}${activeBrainDeal.summary ? `Summary: ${activeBrainDeal.summary}\n` : ''}When the user says "this deal" or "this company" they mean ${activeBrainDeal.company}.`
      : activeDealRow
        ? `\n\n## CURRENTLY VIEWING: ${activeDealRow.prospectCompany}\nDeal: "${activeDealRow.dealName}" | Stage: ${activeDealRow.stage}\nWhen the user says "this deal" or "this company" they mean ${activeDealRow.prospectCompany}.`
        : ''

    const pageContext = currentPage ? `\nUser is currently on: ${currentPage}` : ''
    const wantsContent = /\b(draft|write|compose|prepare|create|send)\b.*\b(email|letter|message|response|reply|memo|proposal|brief|summary)\b/i.test(lastText)
    const qaMaxTokens = wantsContent ? 2000 : 800

    const systemPrompt = `You are DealKit AI — the central command for this sales team. You have full visibility across the pipeline, deals, risks, and collateral. Be direct, specific, concise. UK English.

RULES: Short answers. No filler. Bold deal names and numbers. Bullet lists over prose. Reference specific deals/contacts/risks. When asked what to do — be prescriptive, not vague.${pageContext}

WHAT I CAN DO:
• **Meeting notes** → paste them and I'll update the deal, todos, risks, and generate an objection handler
• **"New deal: [Company]"** → log a deal instantly
• **"Move [Deal] to proposal"** → change stage
• **"Set close date for [Deal] to [date]"** → update close date
• **"Generate [anything]"** → create any sales asset — one-pager, email sequence, competitive analysis, pricing brief, etc.
• **"Battlecard for [Competitor]"** → competitor research + battlecard
• **"Project plan for [Company]: [paste plan]"** → structured plan with phases & tasks
• **"Scan [Deal] todos"** → review and clean up stale actions
• **"What's my pipeline?"** → full pipeline overview

CONTENT: If asked to draft an email, write a message, or create any content — produce it immediately, complete and ready to send. Use deal data to personalise.
${wantsContent ? `\nCONTENT MODE: Write a COMPLETE, polished, ready-to-use piece. Include subject line for emails. Personalise using deal context — never be generic.` : ''}
${activeDealSection}
${kbParts.join('\n') || 'No workspace data yet.'}${brainSection}`

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6', max_tokens: qaMaxTokens,
      system: systemPrompt,
      messages: messages.slice(-6).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t: event.delta.text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
          controller.close()
        } catch {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
