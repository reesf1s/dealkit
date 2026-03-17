export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { db } from '@/lib/db'
import { dealLogs, productGaps, companyProfiles, workspaces } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { rebuildWorkspaceBrain, getWorkspaceBrain } from '@/lib/workspace-brain'
import { computeCompositeScore } from '@/lib/deal-ml'
import { ensureLinksColumn } from '@/lib/api-helpers'
import { extractTextSignals, heuristicScore } from '@/lib/text-signals'
import { buildDealBriefing, scoreNarrationPrompt } from '@/lib/brain-narrator'

const anthropic = new Anthropic()

// ── Zod schema for LLM output validation ──────────────────────────────────────
const AnalyzeNotesSchema = z.object({
  summary: z.string().nullable().optional(),
  risks: z.array(z.string()).default([]),
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

// Ensure intent_signals column exists — runs once per process lifetime
let intentSignalsMigrated = false
async function ensureIntentSignalsCol() {
  if (intentSignalsMigrated) return
  try {
    await db.execute(sql`ALTER TABLE deal_logs ADD COLUMN IF NOT EXISTS intent_signals jsonb`)
  } catch { /* already exists */ }
  intentSignalsMigrated = true
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureIntentSignalsCol()
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
    const pipelineStages = ((wsRow?.pipelineConfig as any)?.stages ?? []) as { id: string; order: number; isDefault?: boolean }[]
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

    // Compress meeting history to last 5 structured [date] entries only — skip raw email blobs
    // This prevents unbounded context growth while preserving recent trajectory
    function compressMeetingHistory(raw: string | null): string {
      if (!raw) return ''
      const entries = raw.split('\n').reduce<string[]>((acc, line) => {
        if (/^\[\d/.test(line)) acc.push(line)        // start of a new [date] entry
        else if (acc.length > 0) acc[acc.length - 1] += ' ' + line.trim() // continuation
        return acc
      }, [])
      const recent = entries.slice(-5) // keep only last 5 structured entries
      return recent.join('\n')
    }

    const compressedHistory = compressMeetingHistory(deal.meetingNotes as string | null)

    const previousContext = [
      compressedHistory ? `MEETING HISTORY (last 5 updates for this deal):\n${compressedHistory}` : '',
      deal.aiSummary ? `CURRENT DEAL SUMMARY: ${deal.aiSummary}` : '',
      (deal.dealRisks as string[])?.length ? `KNOWN RISKS: ${(deal.dealRisks as string[]).join('; ')}` : '',
    ].filter(Boolean).join('\n\n')

    const existingTodos = (deal.todos as any[]) ?? []
    const openTodos = existingTodos.filter((t: any) => !t.done)
    const existingTodosContext = openTodos.length > 0
      ? `\n\nEXISTING OPEN ACTION ITEMS:\n${openTodos.map((t: any) => `- [${t.id}] ${t.text}`).join('\n')}\n\nRules for todos:\n- Do NOT add duplicates or near-duplicates of existing items\n- Return obsoleteTodoIds: IDs of existing items that are now done, superseded, irrelevant, or duplicated — these will be DELETED`
      : ''

    // Phase 1: LLM extracts structured data ONLY — no scoring.
    // Scoring is computed deterministically by the brain from text signals + ML.
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 2000,
      messages: [{ role: 'user', content: `You are extracting structured data from B2B sales meeting notes. Return ONLY valid JSON, no markdown, no analysis.

${previousContext ? `${previousContext}\n\n---\n\n` : ''}NEW MEETING NOTES:
${meetingNotes}

Deal: ${deal.dealName} with ${deal.prospectCompany}${capabilitiesContext}${existingTodosContext}

Return this exact JSON — extract facts, do not score or judge:
{
  "summary": "2-3 sentence factual summary of deal status and trajectory",
  "risks": ["direct observation from THESE notes only — what was said or happened (max 10 words, e.g. 'No reply for 2 weeks' or 'Budget under review' or 'Evaluating Salesforce' — no inferences, no assumptions about unseen stakeholders or processes)"],
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

Rules — risks: deal-level signals only (not product feature requests). Max 4. Return [] if none.
Rules — todos: new items only. No duplicates of existing open items. Return [] if none.
Rules — obsoleteTodoIds: IDs of open items now done, superseded, or irrelevant. Return [].
Rules — productGaps: only if prospect EXPLICITLY said your product lacks a feature/integration. Return [] otherwise.
Rules — competitors: max 4, ONLY if named as an explicit alternative being evaluated. Return [] if none.
Rules — intentSignals: extract ONLY what is explicitly stated. championStatus=confirmed only if someone is actively advocating internally. budgetStatus=approved only if spend is explicitly confirmed. decisionTimeline=null if not mentioned. nextMeetingBooked=true only if a specific next meeting was arranged in these notes.
priority: critical | high | medium | low` }],
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
            model: 'claude-sonnet-4-6', max_tokens: 2000,
            messages: [
              { role: 'user', content: `Return ONLY valid JSON matching the exact schema. No markdown, no explanation.\n\nOriginal output:\n${rawText}\n\nValidation errors: ${issues}\n\nFix the JSON and return only the corrected object.` },
            ],
          })
          const retryRaw = (retryMsg.content[0] as any).text.trim()
          return parseAndValidate(retryRaw, 2)
        }

        // Second attempt still invalid — use safe defaults
        console.warn('[analyze-notes] Zod validation failed after retry:', result.error.issues)
        return { parsed: AnalyzeNotesSchema.parse({}), parseOk: false }
      } catch {
        if (attempt === 1) {
          // JSON parse error — retry with explicit correction prompt
          const retryMsg = await anthropic.messages.create({
            model: 'claude-sonnet-4-6', max_tokens: 2000,
            messages: [
              { role: 'user', content: `The following response is not valid JSON. Return ONLY the corrected JSON object with no markdown fences, no explanation:\n\n${rawText}` },
            ],
          })
          const retryRaw = (retryMsg.content[0] as any).text.trim()
          return parseAndValidate(retryRaw, 2)
        }
        // Both attempts failed — return safe defaults
        return { parsed: AnalyzeNotesSchema.parse({}), parseOk: false }
      }
    }

    const rawText = (msg.content[0] as any).text.trim()
    const { parsed, parseOk } = await parseAndValidate(rawText)
    const newTodos = (parsed.todos ?? []).map((t: any) => ({ id: crypto.randomUUID(), text: t.text, done: false, createdAt: new Date().toISOString() }))
    const obsoleteIds = new Set<string>(parsed.obsoleteTodoIds ?? [])
    const dateStamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    // Store compact takeaways (not raw notes) to keep history token-efficient across many meetings
    const risksLine = (parsed.risks ?? []).length > 0 ? ` Risks: ${(parsed.risks as string[]).join('; ')}.` : ''
    const actionLine = newTodos.length > 0 ? ` Actions: ${newTodos.map((t: any) => t.text).join('; ')}.` : ''
    const compactEntry = parsed.summary
      ? `[${dateStamp}] ${parsed.summary}${risksLine}${actionLine}`
      : `[${dateStamp}] Meeting notes processed (analysis unavailable)${actionLine}`
    const appendedNotes = deal.meetingNotes
      ? `${deal.meetingNotes}\n${compactEntry}`
      : compactEntry
    // Remove obsolete todos entirely; deduplicate by normalising text; append new non-duplicate todos
    const existingKept = ((deal.todos as any[]) ?? []).filter((t: any) => !obsoleteIds.has(t.id))
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
    const existingKeys = new Set(existingKept.map((t: any) => normalize(t.text)))
    const dedupedNew = newTodos.filter((t: any) => !existingKeys.has(normalize(t.text)))
    const mergedTodos = [...existingKept, ...dedupedNew]
    // Merge newly extracted competitors with existing stored competitors (dedup, lowercase-normalised)
    const extractedComps: string[] = (parsed.competitors ?? [])
      .filter((c: unknown) => typeof c === 'string' && (c as string).trim().length > 0)
      .map((c: string) => c.trim())
    const existingComps: string[] = (deal.competitors as string[]) ?? []
    const existingCompKeys = new Set(existingComps.map(c => c.toLowerCase()))
    const newComps = extractedComps.filter(c => !existingCompKeys.has(c.toLowerCase()))
    const mergedCompetitors = newComps.length > 0 ? [...existingComps, ...newComps] : undefined

    // Only overwrite aiSummary/conversionScore/insights if parse succeeded — never corrupt with raw text or nulls
    const updateFields: Record<string, unknown> = {
      meetingNotes: appendedNotes,
      dealRisks: parsed.risks ?? [],
      todos: mergedTodos,
      updatedAt: new Date(),
    }
    if (mergedCompetitors) updateFields.competitors = mergedCompetitors
    if (parseOk && parsed.summary) updateFields.aiSummary = parsed.summary

    // ── Phase 2: Brain-determined scoring ──────────────────────────────────────
    // The brain (ML + text signals) determines the score. The LLM did NOT produce one.
    // Pipeline: text signals → heuristic score (always) → ML composite (if trained).
    try {
      const combinedNotes = appendedNotes  // includes today's notes
      const signals = extractTextSignals(combinedNotes, deal.createdAt ?? new Date(), new Date())
      const brain = await getWorkspaceBrain(workspaceId)
      const mlPred = brain?.mlPredictions?.find(p => p.dealId === id)

      let finalScore: number
      let scoreBasis: 'ml_composite' | 'text_heuristic' = 'text_heuristic'

      if (mlPred && brain?.mlModel) {
        // ML model trained on closed deals: use composite (ML dominates as training grows)
        // Compute stage position (0–1) relative to this workspace's actual pipeline
        const stageIdx = activeStages.findIndex(s => s.id === deal.stage)
        const stageNorm = activeStages.length > 0 && stageIdx >= 0
          ? stageIdx / Math.max(activeStages.length - 1, 1)
          : 0.5
        const { composite } = computeCompositeScore(
          heuristicScore(signals, stageNorm),
          mlPred.winProbability,
          brain.mlModel.trainingSize,
        )
        finalScore = composite
        scoreBasis = 'ml_composite'
      } else {
        // No ML model yet: stage-position-adjusted text signal heuristic
        const stageIdx = activeStages.findIndex(s => s.id === deal.stage)
        const stageNorm = activeStages.length > 0 && stageIdx >= 0
          ? stageIdx / Math.max(activeStages.length - 1, 1)
          : 0.5
        finalScore = heuristicScore(signals, stageNorm)
      }

      // Phase 3: LLM narrates the brain's determination (tiny call — 3 bullets only)
      const dealForBriefing = {
        dealName: deal.dealName,
        company: deal.prospectCompany,
        stage: deal.stage,
        dealRisks: parsed.risks ?? [],
        dealCompetitors: [],
        conversionScore: finalScore,
      }
      const briefing = buildDealBriefing(brain, id, dealForBriefing, signals)
      const narrationMsg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 400,
        messages: [{ role: 'user', content: scoreNarrationPrompt(briefing) }],
      })
      const narration = (narrationMsg.content[0] as any)?.text?.trim() ?? ''
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
      // Only adjusts when the LLM sees something the text signals didn't detect.
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
      }

      updateFields.conversionScore = finalScore
      if (narratedInsights.length > 0) updateFields.conversionInsights = narratedInsights
    } catch { /* non-fatal — deal saves without score if brain fails */ }

    // Persist intent signals — separate from scoring so a scoring failure doesn't lose them
    if (parseOk && parsed.intentSignals) updateFields.intentSignals = parsed.intentSignals

    const [updatedDeal] = await db.update(dealLogs).set(updateFields).where(eq(dealLogs.id, id)).returning()
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
      try { await rebuildWorkspaceBrain(workspaceId) } catch { /* non-fatal */ }
    })

    return NextResponse.json({ data: { deal: updatedDeal, productGaps: createdGaps, parsed } })
  } catch (e: any) {
    console.error('[analyze-notes] 500:', e?.message, e?.stack?.split('\n')[1])
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}
