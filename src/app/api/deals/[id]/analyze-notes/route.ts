export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { anthropic } from '@/lib/ai/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { dealLogs, productGaps, companyProfiles, workspaces } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getWorkspaceBrain } from '@/lib/workspace-brain'
import { requestBrainRebuild } from '@/lib/brain-rebuild'
import { computeCompositeScore, type ScoreBreakdown } from '@/lib/deal-ml'
import { ensureLinksColumn } from '@/lib/api-helpers'
import { extractTextSignals, heuristicScore } from '@/lib/text-signals'
import { buildDealBriefing, scoreNarrationPrompt, type ActionItemContext } from '@/lib/brain-narrator'
import { NoteExtractionSchema, buildCorrectionPrompt, type NoteExtraction } from '@/lib/extraction-schema'
import { smartMatchDeal } from '@/lib/smart-match'

type PipelineStageConfig = { id: string; order: number; isDefault?: boolean }
type DealTodo = {
  id: string
  text: string
  done: boolean
  createdAt?: string
  source?: 'ai' | 'manual'
}
type ScheduledEvent = {
  id?: string
  type?: string
  description?: string
  date?: string | null
  time?: string | null
  participants?: string[]
  extractedAt?: string
}

function getFirstText(content: Array<{ type: string; text?: string }>): string {
  const part = content.find(item => item.type === 'text' && typeof item.text === 'string')
  return part?.text ?? ''
}


// ── Zod schema for LLM output validation ──────────────────────────────────────
const AnalyzeNotesSchema = z.object({
  summary: z.string().nullable().optional(),
  risks: z.array(z.string()).default([]),
  resolvedRisks: z.array(z.string()).default([]),
  todos: z.array(z.object({ text: z.string() })).default([]),
  obsoleteTodoIds: z.array(z.string()).default([]),
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
type AnalyzeNotesOutput = z.infer<typeof AnalyzeNotesSchema>

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureLinksColumn()
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rl = await checkRateLimit(userId, 'analyze-notes', 10)
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)
    const { workspaceId } = await getWorkspaceContext(userId)
    const { id } = await params
    const { meetingNotes } = await req.json()
    if (!meetingNotes?.trim()) return NextResponse.json({ error: 'No meeting notes provided' }, { status: 400 })

    // Load pipeline config to compute stage position for heuristic score
    // (custom stages need position-relative baseline, not hardcoded stage-name priors)
    const [wsRow] = await db.select({ pipelineConfig: workspaces.pipelineConfig })
      .from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
    const pipelineStages = ((wsRow?.pipelineConfig as { stages?: PipelineStageConfig[] } | null | undefined)?.stages ?? []) as PipelineStageConfig[]
    const activeStages = pipelineStages
      .filter(s => s.id !== 'closed_won' && s.id !== 'closed_lost')
      .sort((a, b) => a.order - b.order)

    // Selective columns only — avoids SELECT * failing on any schema col that hasn't been migrated yet
    const [deal] = await db.select({
      id: dealLogs.id,
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      dealValue: dealLogs.dealValue,
      stage: dealLogs.stage,
      todos: dealLogs.todos,
      aiSummary: dealLogs.aiSummary,
      dealRisks: dealLogs.dealRisks,
      meetingNotes: dealLogs.meetingNotes,
      competitors: dealLogs.competitors,
      createdAt: dealLogs.createdAt,
      updatedAt: dealLogs.updatedAt,
      conversionScorePinned: dealLogs.conversionScorePinned,
      scheduledEvents: dealLogs.scheduledEvents,
      scoreHistory: dealLogs.scoreHistory,
    }).from(dealLogs).where(and(eq(dealLogs.id, id), eq(dealLogs.workspaceId, workspaceId))).limit(1)
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Fetch known capabilities so AI doesn't re-flag confirmed product features as gaps
    const [profile] = await db
      .select({ knownCapabilities: companyProfiles.knownCapabilities })
      .from(companyProfiles)
      .where(eq(companyProfiles.workspaceId, workspaceId))
      .limit(1)
    const knownCapabilities = (profile?.knownCapabilities as string[]) ?? []
    const capabilitiesContext = knownCapabilities.length > 0
      ? `\n\nCONFIRMED PRODUCT CAPABILITIES (do NOT flag these as product gaps under any circumstances):\n${knownCapabilities.map(c => `- ${c}`).join('\n')}`
      : ''

    // Compress meeting history to last 10 structured entries — split on \n---\n separator
    // This prevents unbounded context growth while preserving recent trajectory
    function compressMeetingHistory(raw: string | null): string {
      if (!raw) return ''
      const entries = raw.split('\n---\n').map(e => e.trim()).filter(Boolean)
      const recent = entries.slice(-10) // keep last 10 entries
      return recent.join('\n---\n')
    }

    const compressedHistory = compressMeetingHistory(deal.meetingNotes as string | null)

    const previousContext = [
      compressedHistory ? `MEETING HISTORY (last 5 updates for this deal):\n${compressedHistory}` : '',
      deal.aiSummary ? `CURRENT DEAL SUMMARY: ${deal.aiSummary}` : '',
      (deal.dealRisks as string[])?.length ? `KNOWN RISKS: ${(deal.dealRisks as string[]).join('; ')}` : '',
    ].filter(Boolean).join('\n\n')

    const existingTodos = (deal.todos as DealTodo[] | null) ?? []
    const openTodos = existingTodos.filter(todo => !todo.done)
    const existingTodosContext = openTodos.length > 0
      ? `\n\nEXISTING OPEN ACTION ITEMS:\n${openTodos.map(todo => `- [${todo.id}] ${todo.text}`).join('\n')}\n\nRules for todos:\n- Do NOT add duplicates or near-duplicates of existing items\n- Return obsoleteTodoIds: IDs of existing items that are now done, superseded, irrelevant, or duplicated — these will be DELETED`
      : ''

    // Phase 1: LLM extracts structured data ONLY — no scoring.
    // Scoring is computed deterministically by the brain from text signals + ML.
    const noteDate = new Date().toISOString().slice(0, 10)
    const currentYear = new Date().getFullYear()

    const msg = await anthropic.messages.create({
      messages: [{ role: 'user', content: `You are extracting structured data from B2B sales meeting notes. Return ONLY valid JSON, no markdown, no analysis.

${previousContext ? `${previousContext}\n\n---\n\n` : ''}NEW MEETING NOTES:
${meetingNotes}

Deal: ${deal.dealName} with ${deal.prospectCompany}${capabilitiesContext}${existingTodosContext}

Return this exact JSON — extract facts, do not score or judge:
{
  "summary": "2-3 sentence factual summary of deal status and trajectory",
  "risks": ["NEW risks from THESE notes only — what was said or happened (max 10 words, e.g. 'No reply for 2 weeks' or 'Budget under review' or 'Evaluating Salesforce' — no inferences, no assumptions about unseen stakeholders or processes). Do NOT repeat existing risks from context — only include brand new ones."],
  "resolvedRisks": ["exact substring or close match of an EXISTING risk that is now resolved or no longer valid based on these notes — e.g. if 'No reply for 2 weeks' is in known risks and the prospect just replied, include it here"],
  "todos": [{"text": "specific action item"}],
  "obsoleteTodoIds": ["id-of-existing-todo-now-done-or-irrelevant"],
  "productGaps": [{"title": "gap title", "description": "what prospect said is missing", "priority": "high"}],
  "competitors": ["competitor or alternative vendor name ONLY if explicitly mentioned as something the prospect is evaluating or comparing against — company/product names only"],
  "intentSignals": {
    "championStatus": "confirmed|suspected|none",
    "budgetStatus": "approved|awaiting|not_discussed|blocked",
    "decisionTimeline": "e.g. Q2 2026 or end of year — null if not mentioned",
    "nextMeetingBooked": false
  }
}

Rules — risks: NEW deal-level signals only from THESE notes (not product feature requests, not repeating known risks). Max 4 new risks. Return [] if none.
Rules — resolvedRisks: substrings of KNOWN RISKS that are now resolved. Return [] if none resolved.
Rules — todos: new items only. No duplicates of existing open items. Return [] if none.
Rules — obsoleteTodoIds: IDs of open items now done, superseded, or irrelevant. Return [].
Rules — productGaps: ONLY extract if the prospect EXPLICITLY states the missing feature BLOCKS or PREVENTS their decision — they say they "can't move forward without X", "need X to sign off", "won't work for us without X", or it is described as a hard requirement. DO NOT extract preferences, wishes, or nice-to-haves ("it would be nice if...", "we'd love...", "ideally..."). DO NOT extract: security/compliance/SOC2/data residency — procurement requirements; pricing/commercial concerns; procurement/vendor process friction; internal budget/sign-off friction; implementation/migration concerns; general desires for features the prospect hasn't said are blockers. A valid product gap must be: (1) a missing software capability (integration, feature, API, performance limit, UI function), AND (2) explicitly stated as a hard requirement or decision-blocker. Return [] if no hard-requirement feature gaps are present.
Rules — competitors: max 4, ONLY if named as an explicit alternative being evaluated. Return [] if none.
Rules — intentSignals: extract ONLY what is explicitly stated. championStatus=confirmed only if someone is actively advocating internally. budgetStatus=approved only if spend is explicitly confirmed. decisionTimeline=null if not mentioned. nextMeetingBooked=true only if a specific next meeting was arranged in these notes.
priority: critical | high | medium | low

After the JSON above, include a signal extraction block wrapped in <extraction></extraction> tags:
<extraction>
{
  "champion_signal": true/false,
  "budget_signal": "confirmed"/"discussed"/"concern"/"not_mentioned",
  "decision_timeline": "Q2 2026" or null,
  "next_step": "description of next action" or null,
  "competitors_mentioned": ["name1", "name2"],
  "objections": [{"theme": "budget", "text": "exact quote or paraphrase", "severity": "high"}],
  "positive_signals": ["signal1", "signal2"],
  "negative_signals": ["signal1"],
  "stakeholders_mentioned": [{"name": "John", "role": "CEO", "functional_area": "executive"}],
  "product_gaps": [{"gap": "Salesforce integration", "severity": "high", "quote": "we need this to work with SF"}],
  // product_gaps: ONLY if prospect explicitly says it BLOCKS or PREVENTS their decision (hard requirement). NOT nice-to-haves or preferences.
  "sentiment_score": 0.72,
  "urgency_signals": ["end of quarter deadline"],
  "user_verified": false,
  "scheduled_events": [{"type": "meeting", "description": "Discovery call with Jack", "date": "YYYY-MM-DD", "time": "14:00", "source_text": "exact phrase from note"}]
}
</extraction>

Note creation date: ${noteDate} (today is ${noteDate}, current year is ${currentYear}).

For "scheduled_events": Extract any scheduled future events mentioned. For each:
- "type": classify as meeting/follow_up/demo/deadline/decision/other
- "description": brief description like "Discovery call with Jack" or "Send proposal"
- "date": resolve to ISO date YYYY-MM-DD. Resolve relative dates using the note date (${noteDate}):
  - "next Tuesday" = the Tuesday after ${noteDate}
  - "end of March" = ${currentYear}-03-31
  - "in two weeks" = ${noteDate} + 14 days
  - Only include future dates (after ${noteDate}). If date cannot be resolved, set null.
- "time": if time is mentioned (e.g. "at 2pm" → "14:00"), else null
- "source_text": the exact phrase from the note that mentioned this event
Return [] if no scheduled events are mentioned.

For objections, classify each into EXACTLY one theme and assign a severity:
- "budget": price concerns, cost objections, ROI questions, affordability
- "timing": not now, too early, waiting for something, seasonality
- "authority": decision maker not involved, committee approval needed, no sign-off
- "competitor": mentions of competing products, existing vendor relationships
- "value": unclear benefit, not convinced of need, feature gaps
- "technical": IT concerns, security, compliance, data concerns
- "integration": specific integration requirements (Salesforce, HubSpot, etc.)
- "other": anything that doesn't fit the above
Severity: "high" = deal-blocking, "medium" = significant concern, "low" = minor/easily addressed.` }],
      model: 'gpt-5.4-mini', max_tokens: 2500,
    })
    // Strip markdown fences and any leading/trailing text before the JSON object
    function stripToJson(raw: string): string {
      const fenceStripped = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
      const braceIdx = fenceStripped.indexOf('{')
      return braceIdx > 0 ? fenceStripped.slice(braceIdx) : fenceStripped
    }

    // Zod validation + retry logic — attempt 1 uses the initial LLM response;
    // on validation failure we retry once with an explicit correction prompt.
    async function parseAndValidate(rawText: string, attempt = 1): Promise<{ parsed: AnalyzeNotesOutput; parseOk: boolean }> {
      try {
        const jsonStr = stripToJson(rawText)
        const rawObj = JSON.parse(jsonStr)
        const result = AnalyzeNotesSchema.safeParse(rawObj)
        if (result.success) return { parsed: result.data, parseOk: true }

        // Validation failed — if first attempt, ask Claude to fix it
        if (attempt === 1) {
          const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
          const retryMsg = await anthropic.messages.create({
            model: 'gpt-5.4-mini', max_tokens: 2000,
            messages: [
              { role: 'user', content: `Return ONLY valid JSON matching the exact schema. No markdown, no explanation.\n\nOriginal output:\n${rawText}\n\nValidation errors: ${issues}\n\nFix the JSON and return only the corrected object.` },
            ],
          })
          const retryRaw = getFirstText(retryMsg.content).trim()
          return parseAndValidate(retryRaw, 2)
        }

        // Second attempt still invalid — use safe defaults
        console.warn('[analyze-notes] Zod validation failed after retry:', result.error.issues)
        return { parsed: AnalyzeNotesSchema.parse({}), parseOk: false }
      } catch {
        if (attempt === 1) {
          // JSON parse error — retry with explicit correction prompt
          const retryMsg = await anthropic.messages.create({
            model: 'gpt-5.4-mini', max_tokens: 2000,
            messages: [
              { role: 'user', content: `The following response is not valid JSON. Return ONLY the corrected JSON object with no markdown fences, no explanation:\n\n${rawText}` },
            ],
          })
          const retryRaw = getFirstText(retryMsg.content).trim()
          return parseAndValidate(retryRaw, 2)
        }
        // Both attempts failed — return safe defaults
        return { parsed: AnalyzeNotesSchema.parse({}), parseOk: false }
      }
    }

    const rawText = getFirstText(msg.content).trim()
    const { parsed, parseOk } = await parseAndValidate(rawText)

    // ── Parse and validate the <extraction> signal block ──────────────────────
    // The LLM appends a structured <extraction>JSON</extraction> block with rich signal data.
    // We validate it with NoteExtractionSchema + retry logic for reliability.
    async function parseExtractionBlock(fullResponse: string): Promise<NoteExtraction | null> {
      try {
        const match = fullResponse.match(/<extraction>([\s\S]*?)<\/extraction>/i)
        if (!match) return null
        const jsonStr = match[1].trim()
        const raw = JSON.parse(jsonStr)
        const result = NoteExtractionSchema.safeParse(raw)
        if (result.success) return result.data

        // Validation failed — retry with correction prompt
        const correctionPrompt = buildCorrectionPrompt(jsonStr, JSON.stringify(result.error.issues))
        const retryMsg = await anthropic.messages.create({
          model: 'gpt-5.4-mini', max_tokens: 1024,
          messages: [{ role: 'user', content: correctionPrompt }],
        })
        const retryText = getFirstText(retryMsg.content)
        const jsonMatch = retryText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) return null
        const retryParsed = JSON.parse(jsonMatch[0])
        const retryResult = NoteExtractionSchema.safeParse(retryParsed)
        if (retryResult.success) return retryResult.data

        // Second failure — try partial parse with defaults
        const partial = NoteExtractionSchema.partial().safeParse(retryParsed)
        if (partial.success) {
          return NoteExtractionSchema.parse({ ...partial.data })
        }
        return null
      } catch {
        return null
      }
    }

    const noteExtraction = await parseExtractionBlock(rawText)

    const newTodos: DealTodo[] = (parsed.todos ?? []).map(todo => ({
      id: crypto.randomUUID(),
      text: todo.text,
      done: false,
      createdAt: new Date().toISOString(),
      source: 'ai',
    }))
    const obsoleteIds = new Set<string>(parsed.obsoleteTodoIds ?? [])
    const dateStamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    // Store compact takeaways (not raw notes) to keep history token-efficient across many meetings
    const risksLine = (parsed.risks ?? []).length > 0 ? ` Risks: ${(parsed.risks as string[]).join('; ')}.` : ''
    const compactEntry = parsed.summary
      ? `[${dateStamp}] ${parsed.summary}${risksLine}`
      : `[${dateStamp}] Meeting notes processed (analysis unavailable)`
    const appendedNotes = deal.meetingNotes
      ? `${deal.meetingNotes}\n---\n${compactEntry}`
      : compactEntry
    // Remove obsolete todos entirely; deduplicate by normalising text; append new non-duplicate todos
    const existingKept = ((deal.todos as DealTodo[] | null) ?? []).filter(todo => !obsoleteIds.has(todo.id))
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
    const existingKeys = new Set(existingKept.map(todo => normalize(todo.text)))
    const dedupedNew = newTodos.filter(todo => !existingKeys.has(normalize(todo.text)))
    const mergedTodos = [...existingKept, ...dedupedNew]
    // Merge newly extracted competitors with existing stored competitors (dedup, lowercase-normalised)
    const extractedComps: string[] = (parsed.competitors ?? [])
      .filter((c: unknown) => typeof c === 'string' && (c as string).trim().length > 0)
      .map((c: string) => c.trim())
    const existingComps: string[] = (deal.competitors as string[]) ?? []
    const existingCompKeys = new Set(existingComps.map(c => c.toLowerCase()))
    const newComps = extractedComps.filter(c => !existingCompKeys.has(c.toLowerCase()))
    const mergedCompetitors = newComps.length > 0 ? [...existingComps, ...newComps] : undefined

    // Smart risk merge: keep existing risks minus resolved ones, add newly detected risks
    const resolvedRisksRaw: string[] = parsed.resolvedRisks ?? []
    const existingRisks: string[] = (deal.dealRisks as string[]) ?? []
    const newRisks: string[] = parsed.risks ?? []
    const survivingRisks = resolvedRisksRaw.length > 0
      ? existingRisks.filter(r => !resolvedRisksRaw.some(resolved =>
          r.toLowerCase().includes(resolved.toLowerCase()) ||
          resolved.toLowerCase().includes(r.toLowerCase())
        ))
      : existingRisks
    // Dedup new risks against surviving
    const existingRiskKeys = new Set(survivingRisks.map(r => r.toLowerCase().slice(0, 40)))
    const dedupedNewRisks = newRisks.filter(r => !existingRiskKeys.has(r.toLowerCase().slice(0, 40)))
    const mergedRisks = [...survivingRisks, ...dedupedNewRisks]

    // Only overwrite aiSummary/conversionScore/insights if parse succeeded — never corrupt with raw text or nulls
    const updateFields: Record<string, unknown> = {
      meetingNotes: appendedNotes,
      dealRisks: mergedRisks,
      todos: mergedTodos,
      updatedAt: new Date(),
    }
    if (mergedCompetitors) updateFields.competitors = mergedCompetitors
    if (parseOk && parsed.summary) updateFields.aiSummary = parsed.summary

    // ── Phase 2: Brain-determined scoring — deterministic math, no LLM ──────────
    // Pipeline: text signals → heuristic score (always) → ML composite (if trained).
    // The LLM NEVER generates the score; it only narrates the already-computed result.
    try {
      const combinedNotes = appendedNotes  // includes today's notes
      const signals = extractTextSignals(combinedNotes, deal.createdAt ?? new Date(), new Date())
      const brain = await getWorkspaceBrain(workspaceId)
      const mlPred = brain?.mlPredictions?.find(p => p.dealId === id)

      const stageIdx = activeStages.findIndex(s => s.id === deal.stage)
      const stageNorm = activeStages.length > 0 && stageIdx >= 0
        ? stageIdx / Math.max(activeStages.length - 1, 1)
        : 0.5

      let finalScore: number
      let scoreBreakdown: ScoreBreakdown | null = null

      if (mlPred && brain?.mlModel) {
        // ML model trained on closed deals: deterministic composite score
        const textScore = heuristicScore(signals, stageNorm)
        const result = computeCompositeScore(
          textScore,
          mlPred.winProbability,
          brain.mlModel.trainingSize,
          signals.momentumScore,
        )
        finalScore = result.composite
        scoreBreakdown = {
          composite_score: result.composite,
          text_signal_score: textScore,
          text_weight: result.textWeight,
          ml_score: result.mlScore,
          ml_weight: result.mlWeight,
          momentum_component: result.momentumComponent,
          ml_active: true,
          training_deals: brain.mlModel.trainingSize,
          model_version: new Date().toISOString(),
        }
      } else {
        // No ML model yet: stage-position-adjusted text signal heuristic only
        finalScore = heuristicScore(signals, stageNorm)
        scoreBreakdown = {
          composite_score: finalScore,
          text_signal_score: finalScore,
          text_weight: 0.70,
          ml_score: 50,
          ml_weight: 0,
          momentum_component: 50 + Math.max(-10, Math.min(10, (signals.momentumScore - 0.5) * 20)),
          ml_active: false,
          training_deals: 0,
          model_version: new Date().toISOString(),
        }
      }

      // Phase 3: LLM narrates the brain's determination (tiny call — 3 bullets only)
      // The LLM receives the already-computed score and explains it; it does not alter it.
      const dealForBriefing = {
        dealName: deal.dealName,
        company: deal.prospectCompany,
        stage: deal.stage,
        dealRisks: parsed.risks ?? [],
        dealCompetitors: [],
        conversionScore: finalScore,
      }
      const briefing = buildDealBriefing(brain, id, dealForBriefing, signals)

      // Build action item context from extracted facts for specific, grounded narration
      const daysSinceUpdate = deal.updatedAt
        ? Math.floor((Date.now() - new Date(deal.updatedAt).getTime()) / 86_400_000)
        : null
      const extra: ActionItemContext = {
        contacts: noteExtraction?.stakeholders_mentioned?.map(s => ({ name: s.name, role: s.role })) ?? [],
        daysSinceUpdate,
        scheduledEvents: noteExtraction?.scheduled_events?.map(e => ({ description: e.description, date: e.date })) ?? [],
        nextMeetingBooked: parsed.intentSignals?.nextMeetingBooked ?? undefined,
        decisionTimeline: parsed.intentSignals?.decisionTimeline ?? null,
      }

      const narrationMsg = await anthropic.messages.create({
        model: 'gpt-5.4-mini', max_tokens: 400,
        messages: [{ role: 'user', content: scoreNarrationPrompt(briefing, extra) }],
      })
      const narration = getFirstText(narrationMsg.content).trim()
      // Parse bullet points from narration into insight strings
      const narratedInsights = narration
        .split('\n')
        .map((l: string) => l.replace(/^[-•*·]\s*/, '').trim())
        .filter((l: string) => l.length > 8)
        // Filter out score-summary insights to prevent dual-score display in UI
        .filter((l: string) => !/\d+\/100/i.test(l))
        .slice(0, 3)

      // ── Intent signal score adjustment ─────────────────────────────────────────
      // LLM-extracted intent catches paraphrases that vocabulary matching misses.
      // This is a deterministic adjustment based on extracted facts — not a score guess.
      if (parsed.intentSignals) {
        const is = parsed.intentSignals
        if (is.championStatus === 'confirmed' && !signals.decisionMakerSignal) finalScore = Math.min(100, finalScore + 6)
        if (is.championStatus === 'suspected' && !signals.decisionMakerSignal) finalScore = Math.min(100, finalScore + 3)
        if (is.budgetStatus === 'approved' && !signals.budgetConfirmed)         finalScore = Math.min(100, finalScore + 8)
        if (is.budgetStatus === 'awaiting' && !signals.budgetConfirmed)         finalScore = Math.min(100, finalScore + 2)
        if (is.budgetStatus === 'blocked')                                       finalScore = Math.max(0,  finalScore - 8)
        if (is.nextMeetingBooked === true)                                       finalScore = Math.min(100, finalScore + 3)
        if (typeof is.decisionTimeline === 'string' && is.decisionTimeline) {
          const tlDate = Date.parse(is.decisionTimeline)
          if (!isNaN(tlDate)) {
            const daysTo = (tlDate - Date.now()) / 86_400_000
            if (daysTo >= 0 && daysTo <= 90) finalScore = Math.min(100, finalScore + 3)
          }
        }
        // Update breakdown final score after intent adjustments
        if (scoreBreakdown) scoreBreakdown.composite_score = Math.max(0, Math.min(100, Math.round(finalScore)))
      }

      // Only update score if not pinned by user — user-set scores are authoritative
      if (!deal.conversionScorePinned) {
        const roundedScore = Math.max(0, Math.min(100, Math.round(finalScore)))
        updateFields.conversionScore = roundedScore
        if (narratedInsights.length > 0) updateFields.conversionInsights = narratedInsights
        if (scoreBreakdown) updateFields.score_breakdown = JSON.stringify(scoreBreakdown)
        // Append to per-deal score history for sparkline visualisation
        const existingHistory: Array<{ score: number; date: string }> =
          Array.isArray(deal.scoreHistory) ? (deal.scoreHistory as Array<{ score: number; date: string }>) : []
        const newPoint = { score: roundedScore, date: new Date().toISOString() }
        // Keep last 20 points
        updateFields.scoreHistory = [...existingHistory, newPoint].slice(-20)
      }
    } catch { /* non-fatal — deal saves without score if brain fails */ }

    // Persist intent signals — separate from scoring so a scoring failure doesn't lose them
    if (parseOk && parsed.intentSignals) updateFields.intentSignals = parsed.intentSignals

    // ── Store structured extraction signals ────────────────────────────────────
    // note_signals_json stores the per-note extraction result as a JSON string.
    // We also use extraction data to augment intentSignals for aggregate tracking.
    if (noteExtraction) {
      // Store the extraction for this note (always user_verified: false on AI extraction)
      updateFields.note_signals_json = JSON.stringify({ ...noteExtraction, user_verified: false })

      // Supplement intentSignals with richer extraction data if LLM intentSignals not already captured
      if (!updateFields.intentSignals) {
        updateFields.intentSignals = {
          championStatus: noteExtraction.champion_signal ? 'confirmed' : 'none',
          budgetStatus: noteExtraction.budget_signal === 'confirmed' ? 'approved'
            : noteExtraction.budget_signal === 'discussed' ? 'awaiting'
            : noteExtraction.budget_signal === 'concern' ? 'blocked'
            : 'not_discussed',
          decisionTimeline: noteExtraction.decision_timeline ?? null,
          nextMeetingBooked: false,
        }
      } else {
        // Merge: extraction champion/budget can upgrade existing intentSignals if stronger signal found
        const existing = updateFields.intentSignals as Record<string, unknown>
        if (noteExtraction.champion_signal && existing.championStatus === 'none') {
          existing.championStatus = 'confirmed'
        }
        if (noteExtraction.budget_signal === 'confirmed' && existing.budgetStatus !== 'approved') {
          existing.budgetStatus = 'approved'
        }
        if (!existing.decisionTimeline && noteExtraction.decision_timeline) {
          existing.decisionTimeline = noteExtraction.decision_timeline
        }
      }
    }

    // ── Merge scheduled events from extraction into deal.scheduledEvents ────
    // The <extraction> block may contain scheduled_events that need to be persisted
    // to the scheduledEvents column so the calendar API can read them.
    if (noteExtraction && (noteExtraction.scheduled_events ?? []).length > 0) {
      const existingEvents = (deal.scheduledEvents as ScheduledEvent[] | null) ?? []
      const existingKeys = new Set(existingEvents.map(event =>
        `${event.date}|${(event.description ?? '').slice(0, 40).toLowerCase()}`
      ))
      const newEvents = noteExtraction.scheduled_events
        .filter(e => e.date && e.description)
        .map(e => ({
          id: crypto.randomUUID(),
          type: e.type === 'other' ? 'meeting' : e.type,
          description: e.description,
          date: e.date,
          time: e.time ?? null,
          participants: [],
          extractedAt: new Date().toISOString(),
        }))
        .filter(e => !existingKeys.has(`${e.date}|${e.description.slice(0, 40).toLowerCase()}`))
      if (newEvents.length > 0) {
        updateFields.scheduledEvents = [...existingEvents, ...newEvents]
      }
    }

    // Main deal update (without embeddings — those need raw SQL for pgvector)
    const [updatedDeal] = await db.update(dealLogs).set(updateFields).where(eq(dealLogs.id, id)).returning()

    // Generate embeddings via after() — non-blocking, survives Vercel serverless
    const _embId = id, _embWs = workspaceId, _embNotes = appendedNotes
    const _embDeal = deal, _embSignals = updateFields.intentSignals
    after(async () => {
      try {
        const { generateEmbedding, generateDealEmbedding } = await import('@/lib/openai-embeddings')
        const noteEmb = await generateEmbedding(_embNotes)
        const dealEmb = await generateDealEmbedding({
          name: _embDeal.dealName || '',
          company: _embDeal.prospectCompany || '',
          stage: _embDeal.stage || '',
          meetingNotes: _embNotes,
          signals: _embSignals ?? undefined,
        })
        const noteVec = `'[${noteEmb.join(',')}]'::vector`
        const dealVec = `'[${dealEmb.join(',')}]'::vector`
        await db.execute(sql.raw(
          `UPDATE deal_logs SET note_embedding = ${noteVec}, deal_embedding = ${dealVec} WHERE id = '${_embId}' AND workspace_id = '${_embWs}'`
        ))
        console.log(`[embeddings] Generated for deal ${_embId}`)
      } catch (err) {
        console.error('[embeddings] Failed to generate embeddings:', err)
      }
    })
    const createdGaps = []
    for (const gap of (parsed.productGaps ?? [])) {
      if (!gap.title) continue
      const [existing] = await db.select().from(productGaps).where(and(eq(productGaps.workspaceId, workspaceId), eq(productGaps.title, gap.title))).limit(1)
      if (existing) {
        const [updated] = await db.update(productGaps).set({ frequency: (existing.frequency ?? 1) + 1, sourceDeals: [...((existing.sourceDeals as string[]) ?? []), id], updatedAt: new Date() }).where(eq(productGaps.id, existing.id)).returning()
        createdGaps.push(updated)
      } else {
        const [created] = await db.insert(productGaps).values({ workspaceId, userId, title: gap.title, description: gap.description ?? '', priority: gap.priority ?? 'medium', frequency: 1, sourceDeals: [id], status: 'open', affectedRevenue: deal.dealValue ?? null }).returning()
        createdGaps.push(created)
      }
    }
    // Rebuild workspace brain in background so chat/overview always have fresh context
    after(async () => {
      console.log(`[brain] Rebuild triggered by: analyze_notes at ${new Date().toISOString()}`)
      await requestBrainRebuild(workspaceId, 'analyze_notes')
    })

    // Auto-trigger smart matching after extraction so product gaps → Linear links are created
    const _smWs = workspaceId, _smId = id
    after(async () => {
      try {
        await smartMatchDeal(_smWs, _smId)
      } catch (e) {
        console.warn('[analyze-notes] smartMatchDeal after() failed:', e instanceof Error ? e.message : e)
      }
    })

    return NextResponse.json({ data: { deal: updatedDeal, productGaps: createdGaps, parsed } })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    const stackLine = e instanceof Error ? e.stack?.split('\n')[1] : undefined
    console.error('[analyze-notes] 500:', message, stackLine)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
