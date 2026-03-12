export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, count, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  companyProfiles, competitors, caseStudies, dealLogs, productGaps, collateral, events,
} from '@/lib/db/schema'
import Anthropic from '@anthropic-ai/sdk'
import { getWorkspaceContext } from '@/lib/workspace'
import { generateCollateral } from '@/lib/ai/generate'
import { PLAN_LIMITS, isWithinLimit } from '@/lib/stripe/plans'
import type { CollateralType } from '@/types'

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

// ── Intent detection ───────────────────────────────────────────────────────────
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

const BATTLECARD_KEYWORDS = ['battlecard', 'battle card', 'add competitor', 'create competitor', 'new competitor', 'research competitor']

const COLLATERAL_TYPES: { keyword: string; type: CollateralType }[] = [
  { keyword: 'objection handler', type: 'objection_handler' },
  { keyword: 'one-pager', type: 'one_pager' },
  { keyword: 'one pager', type: 'one_pager' },
  { keyword: 'talk track', type: 'talk_track' },
  { keyword: 'email sequence', type: 'email_sequence' },
  { keyword: 'email follow-up', type: 'email_sequence' },
  { keyword: 'case study doc', type: 'case_study_doc' },
]

const COMPANY_UPDATE_PATTERNS = [
  /update.*compan/i, /update.*profile/i, /update our/i,
  /add.*product/i, /new product/i, /we(('re| are) a| offer| provide| do| help)/i,
  /company description/i, /value prop/i, /our differentiator/i,
]

const DEAL_CREATE_PATTERNS = [
  /new deal/i, /new prospect/i, /new lead/i, /new opportunity/i,
  /add.*deal/i, /create.*deal/i, /log.*deal/i, /just.*meeting with/i,
]

const CASE_STUDY_PATTERNS = [
  /case study/i, /customer win/i, /we won/i, /just closed with/i,
  /success story/i, /customer success/i, /closed.*deal with/i,
]

// Matches any deal modification request: todos (with/without hyphen), tasks,
// stage changes, value updates, deal field edits, etc.
const DEAL_ACTION_PATTERNS = [
  // to-do / todo / to do variants (hyphen, apostrophe, space)
  /remove.*to[\s-]?do/i, /delete.*to[\s-]?do/i, /clear.*to[\s-]?do/i,
  /mark.*to[\s-]?do/i, /complete.*to[\s-]?do/i, /tick.*to[\s-]?do/i,
  /outdated.*to[\s-]?do/i, /stale.*to[\s-]?do/i, /clean.*up.*to[\s-]?do/i,
  /to[\s-]?do.*deal/i, /deal.*to[\s-]?do/i,
  // tasks
  /remove.*task/i, /clear.*task/i, /delete.*task/i, /complete.*task/i,
  // deal field updates via chat (stage, value, notes on a named deal)
  /update.*deal/i, /change.*stage/i, /move.*deal/i, /mark.*deal/i,
  /deal.*stage/i, /set.*stage/i,
  // generic "in the X deal" action phrases
  /in the .+ deal/i, /for the .+ deal/i, /on the .+ deal/i,
]

type Intent = 'meeting_notes' | 'competitor_battlecard' | 'company_update' |
  'collateral_generate' | 'deal_create' | 'case_study_create' | 'deal_action' | 'qa'

function detectIntent(text: string): Intent {
  const lower = text.toLowerCase()
  if (looksLikeMeetingTranscript(text)) return 'meeting_notes'
  if (BATTLECARD_KEYWORDS.some(k => lower.includes(k))) return 'competitor_battlecard'
  const hasGenerateVerb = /\b(generate|create|make|write|build)\b/.test(lower)
  if (hasGenerateVerb && COLLATERAL_TYPES.some(c => lower.includes(c.keyword))) return 'collateral_generate'
  if (COMPANY_UPDATE_PATTERNS.some(p => p.test(text))) return 'company_update'
  if (DEAL_ACTION_PATTERNS.some(p => p.test(text))) return 'deal_action'
  if (DEAL_CREATE_PATTERNS.some(p => p.test(text))) return 'deal_create'
  if (CASE_STUDY_PATTERNS.some(p => p.test(text))) return 'case_study_create'
  return 'qa'
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
    model: 'claude-haiku-4-5-20251001', max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Extract competitor information from this text. Return ONLY a JSON array. Each object must have: "name" (required), "description" (1-2 sentences), "strengths" (string[]), "weaknesses" (string[]), "keyFeatures" (string[]), "notes" (string). Return [] if no competitors clearly mentioned.\n\nText: ${text.slice(0, 6000)}`,
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
      after(async () => {
        try {
          const result = await generateCollateral({ workspaceId, type: 'battlecard', competitorId })
          const generatedAt = new Date()
          await db.update(collateral).set({ title: result.title, status: 'ready', content: result.content, rawResponse: result.rawResponse, generatedAt, updatedAt: generatedAt }).where(eq(collateral.id, colId))
          await db.insert(events).values({ workspaceId, userId, type: 'collateral.generated', metadata: { collateralId: colId, collateralType: 'battlecard', title: result.title }, createdAt: new Date() })
        } catch { await db.update(collateral).set({ status: 'stale', updatedAt: new Date() }).where(eq(collateral.id, colId)) }
      })
      created.push(name)
    } catch { failed.push(name) }
  }

  let reply = ''
  if (created.length > 0) reply += `Saved **${created.join(', ')}** and started generating ${created.length > 1 ? 'battlecards' : 'a battlecard'} — ready in **Collateral** in ~1–2 minutes.`
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
  workspaceId: string, userId: string, text: string,
): Promise<{ reply: string; actions: ActionCard[] }> {
  const openDeals = await db
    .select({ id: dealLogs.id, dealName: dealLogs.dealName, prospectCompany: dealLogs.prospectCompany, stage: dealLogs.stage, todos: dealLogs.todos, dealValue: dealLogs.dealValue })
    .from(dealLogs)
    .where(and(eq(dealLogs.workspaceId, workspaceId), sql`${dealLogs.stage} NOT IN ('closed_won', 'closed_lost')`))
    .limit(20)

  const dealList = openDeals.map(d => `id:${d.id} | "${d.dealName}" — ${d.prospectCompany} (${d.stage})`).join('\n')

  const analysisMsg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `Analyze these B2B sales meeting notes. Return ONLY valid JSON.

Meeting notes:
${text}

Open deals:
${dealList || 'No open deals yet.'}

Return:
{
  "matchedDealId": "uuid or null",
  "matchedDealName": "name or null",
  "summary": "2-3 sentence summary",
  "todos": [{"text": "specific action item"}],
  "productGaps": [{"title": "feature", "description": "what they need", "priority": "high|medium|low"}],
  "dealUpdate": {"stage": "stage_or_null", "dealValue": null_or_cents, "notes": "brief note or null"},
  "risks": ["risk or blocker"]
}

matchedDealId must be one of the IDs above (or null). Stage values: prospecting|qualification|discovery|proposal|negotiation|closed_won|closed_lost. dealValue in cents. Priority: critical|high|medium|low.`,
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

  const actions: ActionCard[] = []
  const dealChanges: string[] = []

  if (parsed.matchedDealId) {
    const [existingDeal] = await db.select().from(dealLogs)
      .where(and(eq(dealLogs.id, parsed.matchedDealId), eq(dealLogs.workspaceId, workspaceId))).limit(1)

    if (existingDeal) {
      const pendingTodos = ((existingDeal.todos as { id: string; text: string; done: boolean }[]) ?? []).filter(t => !t.done)

      // Smart todo management: ask Claude what to do with existing todos
      let todoRemove: string[] = []
      let todoComplete: string[] = []
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

Existing pending todos:
${pendingTodos.map(t => `id:${t.id} | "${t.text}"`).join('\n')}

Return ONLY JSON:
{
  "complete": ["id-of-todo-mentioned-as-done"],
  "remove": ["id-of-todo-that-is-now-irrelevant"],
  "add": ["new todo text from meeting that is NOT already in existing todos"]
}

Rules: only mark "complete" if explicitly mentioned as done. Only "remove" if truly irrelevant/outdated. "add" should not duplicate existing todos.`,
            }],
          })
          const todoResult = JSON.parse(stripJson((todoMsg.content[0] as { type: string; text: string }).text))
          todoRemove = Array.isArray(todoResult.remove) ? todoResult.remove : []
          todoComplete = Array.isArray(todoResult.complete) ? todoResult.complete : []
          todoAdd = Array.isArray(todoResult.add) ? todoResult.add : todoAdd
        } catch { /* fall back to just adding */ }
      }

      // Apply todo changes
      const allTodos = (existingDeal.todos as { id: string; text: string; done: boolean; createdAt: string }[]) ?? []
      const updatedTodos = allTodos
        .filter(t => !todoRemove.includes(t.id))
        .map(t => todoComplete.includes(t.id) ? { ...t, done: true } : t)
      const newTodos = todoAdd.map(text => ({ id: crypto.randomUUID(), text, done: false, createdAt: new Date().toISOString() }))
      const mergedTodos = [...updatedTodos, ...newTodos]

      const updatePayload: Record<string, unknown> = { todos: mergedTodos, meetingNotes: text, updatedAt: new Date() }
      if (parsed.dealUpdate?.stage) { updatePayload.stage = parsed.dealUpdate.stage; dealChanges.push(`stage → **${parsed.dealUpdate.stage}**`) }
      if (parsed.dealUpdate?.dealValue) { updatePayload.dealValue = parsed.dealUpdate.dealValue; dealChanges.push(`value → **$${(parsed.dealUpdate.dealValue / 100).toLocaleString()}**`) }
      if (parsed.dealUpdate?.notes) updatePayload.notes = (existingDeal.notes ?? '') + '\n\n' + parsed.dealUpdate.notes

      await db.update(dealLogs).set(updatePayload).where(eq(dealLogs.id, parsed.matchedDealId))

      const todosAdded = newTodos.length
      const todosRemoved = todoRemove.length
      const todosCompleted = todoComplete.length
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

  // Background: extract Q&A to knowledge base
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

  // Merge arrays (append, don't replace)
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

// ── Handler: generate collateral ──────────────────────────────────────────────
async function handleCollateralGeneration(
  workspaceId: string, userId: string, text: string, plan: string,
): Promise<{ reply: string; actions: ActionCard[] }> {
  const lower = text.toLowerCase()

  // Detect which type to generate
  const match = COLLATERAL_TYPES.find(c => lower.includes(c.keyword))
  if (!match) {
    return {
      reply: 'I can generate: **Objection Handler**, **One-Pager**, **Talk Track**, **Email Sequence**, or **Case Study Doc**.\n\nTry: _"Generate an objection handler"_ or _"Create a talk track for CTOs"_',
      actions: [],
    }
  }

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

  // Extract optional params (buyerRole for talk_track/email_sequence)
  let buyerRole: string | undefined
  if (match.type === 'talk_track' || match.type === 'email_sequence') {
    const roleMatch = text.match(/for\s+(a\s+)?([A-Z][A-Za-z\s]+?)(?:\s+(?:at|in|with|$)|\s*$)/m)
    if (roleMatch) buyerRole = roleMatch[2].trim()
  }

  const typeLabel: Record<CollateralType, string> = {
    battlecard: 'Battlecard', case_study_doc: 'Case Study Doc', one_pager: 'One-Pager',
    objection_handler: 'Objection Handler', talk_track: 'Talk Track', email_sequence: 'Email Sequence',
  }
  const title = buyerRole ? `${typeLabel[match.type]} — ${buyerRole}` : typeLabel[match.type]
  const now = new Date()

  const [record] = await db.insert(collateral).values({
    workspaceId, userId, type: match.type,
    title: `Generating ${title}…`, status: 'generating',
    sourceCompetitorId: null, sourceCaseStudyId: null, sourceDealLogId: null,
    content: null, rawResponse: null, generatedAt: null, createdAt: now, updatedAt: now,
  }).returning()

  const colId = record.id
  const colType = match.type
  after(async () => {
    try {
      const result = await generateCollateral({ workspaceId, type: colType, buyerRole })
      const generatedAt = new Date()
      await db.update(collateral)
        .set({ title: result.title, status: 'ready', content: result.content, rawResponse: result.rawResponse, generatedAt, updatedAt: generatedAt })
        .where(eq(collateral.id, colId))
      await db.insert(events).values({ workspaceId, userId, type: 'collateral.generated', metadata: { collateralId: colId, collateralType: colType, title: result.title }, createdAt: new Date() })
    } catch { await db.update(collateral).set({ status: 'stale', updatedAt: new Date() }).where(eq(collateral.id, colId)) }
  })

  return {
    reply: `Generating your **${title}** now — it'll be ready in [Collateral](/collateral) in about 1 minute.`,
    actions: [{ type: 'collateral_generating', colType: match.type, title }],
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
  "dealValue": "number in cents or null",
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
    todos: [], meetingNotes: null, aiSummary: null, conversionScore: null,
    conversionInsights: null, dealRisks: [],
    createdAt: now, updatedAt: now,
  }).returning()

  await db.insert(events).values({ workspaceId, userId, type: 'deal_log.created', metadata: { dealId: deal.id, dealName: deal.dealName, source: 'ai_chat' }, createdAt: now })

  return {
    reply: `Created deal **${deal.dealName}** at **${deal.prospectCompany}**${deal.dealValue ? ` ($${(deal.dealValue / 100).toLocaleString()})` : ''}. Stage: **${deal.stage}**.\n\nView and edit it in [Deal Log](/deals/${deal.id}).`,
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

// ── Handler: deal action (manage todos) ───────────────────────────────────────
async function handleDealAction(
  workspaceId: string, userId: string, text: string,
): Promise<{ reply: string; actions: ActionCard[] }> {
  const dealRows = await db.select().from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId))
  if (dealRows.length === 0) {
    return { reply: 'No deals found in your workspace.', actions: [] }
  }

  const dealList = dealRows.map(d => `id:${d.id} | "${d.dealName}" — ${d.prospectCompany}`).join('\n')

  // Step 1: identify target deal + action type
  const identifyMsg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 300,
    messages: [{
      role: 'user',
      content: `User request: "${text}"

Available deals:
${dealList}

Return ONLY JSON:
{
  "dealId": "matching deal id or null",
  "action": "remove_outdated_todos|complete_todos|remove_specific_todos|update_stage|update_value|update_notes|qa",
  "description": "brief description of what to do",
  "stageValue": "new stage if action=update_stage, else null — one of: prospecting|qualification|discovery|proposal|negotiation|closed_won|closed_lost",
  "valueInCents": "integer if action=update_value, else null",
  "notesText": "text to append if action=update_notes, else null"
}

Match the deal by name/company. If no clear deal match, return dealId: null.`,
    }],
  })

  interface ActionIdentified {
    dealId: string | null; action: string; description: string
    stageValue?: string | null; valueInCents?: number | null; notesText?: string | null
  }
  let identified: ActionIdentified = { dealId: null, action: 'qa', description: '' }
  try { identified = JSON.parse(stripJson((identifyMsg.content[0] as { type: string; text: string }).text)) } catch { /* use defaults */ }

  if (!identified.dealId) {
    // Couldn't match a deal — show full todos for all deals
    const allTodoSummaries = dealRows.slice(0, 10).map(d => {
      const pending = ((d.todos as { text: string; done: boolean }[]) ?? []).filter(t => !t.done)
      return `**${d.dealName}**: ${pending.length === 0 ? 'no pending todos' : pending.map(t => `• ${t.text}`).join(', ')}`
    }).join('\n')
    return { reply: `I couldn't identify a specific deal from your message. Here are current todos:\n\n${allTodoSummaries}`, actions: [] }
  }

  const deal = dealRows.find(d => d.id === identified.dealId)
  if (!deal) return { reply: "Couldn't find that deal.", actions: [] }

  // Handle non-todo deal field updates
  if (identified.action === 'update_stage' && identified.stageValue) {
    await db.update(dealLogs).set({ stage: identified.stageValue as 'prospecting' | 'qualification' | 'discovery' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost', updatedAt: new Date() }).where(eq(dealLogs.id, deal.id))
    await db.insert(events).values({ workspaceId, userId, type: 'deal_log.updated', metadata: { dealId: deal.id, field: 'stage', value: identified.stageValue, source: 'ai_chat' }, createdAt: new Date() })
    return {
      reply: `Updated **${deal.dealName}** stage to **${identified.stageValue}**.`,
      actions: [{ type: 'deal_updated', dealId: deal.id, dealName: deal.dealName, changes: [`stage → ${identified.stageValue}`] }],
    }
  }

  if (identified.action === 'update_value' && identified.valueInCents != null) {
    await db.update(dealLogs).set({ dealValue: identified.valueInCents, updatedAt: new Date() }).where(eq(dealLogs.id, deal.id))
    await db.insert(events).values({ workspaceId, userId, type: 'deal_log.updated', metadata: { dealId: deal.id, field: 'dealValue', value: identified.valueInCents, source: 'ai_chat' }, createdAt: new Date() })
    return {
      reply: `Updated **${deal.dealName}** deal value to **$${(identified.valueInCents / 100).toLocaleString()}**.`,
      actions: [{ type: 'deal_updated', dealId: deal.id, dealName: deal.dealName, changes: [`value → $${(identified.valueInCents / 100).toLocaleString()}`] }],
    }
  }

  if (identified.action === 'update_notes' && identified.notesText) {
    const newNotes = ((deal.notes ?? '') + '\n\n' + identified.notesText).trim()
    await db.update(dealLogs).set({ notes: newNotes, updatedAt: new Date() }).where(eq(dealLogs.id, deal.id))
    await db.insert(events).values({ workspaceId, userId, type: 'deal_log.updated', metadata: { dealId: deal.id, field: 'notes', source: 'ai_chat' }, createdAt: new Date() })
    return {
      reply: `Added notes to **${deal.dealName}**.`,
      actions: [{ type: 'deal_updated', dealId: deal.id, dealName: deal.dealName, changes: ['notes updated'] }],
    }
  }

  const allTodos = (deal.todos as { id: string; text: string; done: boolean; createdAt: string }[]) ?? []
  const pendingTodos = allTodos.filter(t => !t.done)

  if (pendingTodos.length === 0) {
    return { reply: `**${deal.dealName}** has no pending todos.`, actions: [] }
  }

  // Step 2: decide which todos to remove/complete
  const decideMsg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 512,
    messages: [{
      role: 'user',
      content: `User request: "${text}"
Goal: ${identified.description}

Pending todos for deal "${deal.dealName}":
${pendingTodos.map(t => `id:${t.id} | "${t.text}"`).join('\n')}

Return ONLY JSON:
{
  "remove": ["id-to-remove"],
  "complete": ["id-to-mark-done"],
  "reason": "brief explanation of changes made"
}

Be conservative — only touch todos clearly relevant to the request. If asked to "remove outdated", judge which are truly stale/irrelevant. Never remove todos that are still clearly needed.`,
    }],
  })

  interface TodoDecision { remove: string[]; complete: string[]; reason: string }
  let decisions: TodoDecision = { remove: [], complete: [], reason: '' }
  try { decisions = JSON.parse(stripJson((decideMsg.content[0] as { type: string; text: string }).text)) } catch { /* no changes */ }

  const updatedTodos = allTodos
    .filter(t => !decisions.remove.includes(t.id))
    .map(t => decisions.complete.includes(t.id) ? { ...t, done: true } : t)

  await db.update(dealLogs).set({ todos: updatedTodos, updatedAt: new Date() }).where(eq(dealLogs.id, deal.id))
  await db.insert(events).values({
    workspaceId, userId, type: 'deal_log.todos_updated',
    metadata: { dealId: deal.id, removed: decisions.remove.length, completed: decisions.complete.length, source: 'ai_chat' },
    createdAt: new Date(),
  })

  const removed = decisions.remove.length
  const completed = decisions.complete.length

  let reply: string
  if (removed === 0 && completed === 0) {
    reply = `No todos were changed for **${deal.dealName}**. ${decisions.reason || 'All todos appear current.'}`
  } else {
    reply = `Updated todos for **${deal.dealName}**:`
    if (removed > 0) reply += `\n- Removed ${removed} outdated todo${removed > 1 ? 's' : ''}`
    if (completed > 0) reply += `\n- Marked ${completed} todo${completed > 1 ? 's' : ''} as done`
    if (decisions.reason) reply += `\n\n_${decisions.reason}_`
  }

  return {
    reply,
    actions: [{ type: 'todos_updated', added: 0, removed, completed, dealName: deal.dealName }],
  }
}

// ── Main POST handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { workspaceId, plan } = await getWorkspaceContext(userId)
    const { messages } = await req.json()
    if (!messages?.length) return NextResponse.json({ error: 'messages required' }, { status: 400 })

    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    const lastText: string = lastUserMsg?.content ?? ''

    const intent = detectIntent(lastText)

    if (intent === 'competitor_battlecard') {
      const result = await handleCompetitorBattlecard(workspaceId, userId, lastText, plan)
      return NextResponse.json(result)
    }

    if (intent === 'meeting_notes') {
      const result = await handleMeetingNotes(workspaceId, userId, lastText)
      return NextResponse.json(result)
    }

    if (intent === 'company_update') {
      const result = await handleCompanyUpdate(workspaceId, userId, lastText)
      return NextResponse.json(result)
    }

    if (intent === 'collateral_generate') {
      const result = await handleCollateralGeneration(workspaceId, userId, lastText, plan)
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
      const result = await handleDealAction(workspaceId, userId, lastText)
      return NextResponse.json(result)
    }

    // ── Q&A: load full workspace context ─────────────────────────────────────
    const [profileRows, competitorRows, caseStudyRows, dealRows, gapRows] = await Promise.all([
      db.select().from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)).limit(1),
      db.select().from(competitors).where(eq(competitors.workspaceId, workspaceId)),
      db.select().from(caseStudies).where(eq(caseStudies.workspaceId, workspaceId)),
      db.select().from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId)).limit(20),
      db.select().from(productGaps).where(eq(productGaps.workspaceId, workspaceId)).limit(20),
    ])

    const profile = profileRows[0]
    const kbParts: string[] = []
    if (profile) {
      const knownCaps = (profile.knownCapabilities as string[]) ?? []
      kbParts.push(`## Company: ${profile.companyName}\nIndustry: ${profile.industry ?? 'unknown'}\nDescription: ${profile.description ?? 'none'}\nTarget market: ${profile.targetMarket ?? 'none'}\nValue props: ${(profile.valuePropositions as string[]).join(', ')}\nDifferentiators: ${(profile.differentiators as string[]).join(', ')}\nCommon objections: ${(profile.commonObjections as string[]).join('; ')}${knownCaps.length > 0 ? `\nConfirmed capabilities: ${knownCaps.join('; ')}` : ''}`)
    }
    if (competitorRows.length > 0) {
      kbParts.push(`## Competitors (${competitorRows.length})`)
      competitorRows.forEach(c => kbParts.push(`- ${c.name}: ${c.description ?? ''}. Strengths: ${(c.strengths as string[]).join(', ')}. Weaknesses: ${(c.weaknesses as string[]).join(', ')}`))
    }
    if (caseStudyRows.length > 0) {
      kbParts.push(`## Case Studies`)
      caseStudyRows.forEach(cs => kbParts.push(`- ${cs.customerName}: ${cs.challenge.slice(0, 80)} → ${cs.results.slice(0, 80)}`))
    }
    if (dealRows.length > 0) {
      const won = dealRows.filter(d => d.stage === 'closed_won').length
      const lost = dealRows.filter(d => d.stage === 'closed_lost').length
      const open = dealRows.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
      kbParts.push(`## Deals — ${won} won, ${lost} lost, ${open.length} open`)
      open.slice(0, 10).forEach(d => {
        const pending = ((d.todos as { text: string; done: boolean }[]) ?? []).filter(t => !t.done)
        const todoText = pending.length > 0
          ? `Todos: ${pending.map(t => `• ${t.text}`).join(', ')}`
          : 'No pending todos'
        kbParts.push(`- "${d.dealName}" at ${d.prospectCompany} (${d.stage}): $${d.dealValue ? (d.dealValue / 100).toLocaleString() : '?'}. ${todoText}`)
      })
    }
    if (gapRows.length > 0) {
      kbParts.push(`## Product Gaps`)
      gapRows.forEach(g => kbParts.push(`- ${g.title} [${g.priority}/${g.status}] freq:${g.frequency}: ${g.description.slice(0, 80)}`))
    }

    const systemPrompt = `You are DealKit AI — a sharp, concise sales intelligence assistant. You have full context of the workspace below. Answer questions directly and give actionable advice. Use UK English.

What I can do automatically (just tell me):
• Paste meeting notes → I'll update todos, product gaps and deals
• "Create battlecard for [Competitor]" → adds competitor + generates battlecard
• "Update our company profile: [info]" → updates your company data
• "Generate an objection handler / one-pager / talk track / email sequence" → generates collateral
• "New deal: [Company], [value], [contact]" → logs a new deal
• "Case study: [Customer] [story]" → creates a case study

${kbParts.join('\n\n') || 'No workspace data yet. Help the user set up their profile.'}`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply, actions: [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
