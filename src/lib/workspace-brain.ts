/**
 * Workspace Brain — the single shared knowledge store for an organisation.
 *
 * After every deal mutation (create/update/delete/analyze) the brain is
 * rebuilt from current DB state and stored as compressed JSONB on the workspace.
 *
 * Every feature (chat Q&A, AI overview, deal action) reads from here instead
 * of issuing expensive per-request fan-out queries.
 *
 * Proactive intelligence (no AI call, pure data analysis):
 * - urgentDeals: close date within 7 days, or high-stage deals with low score
 * - staleDeals:  open deals with no update in 14+ days
 * - keyPatterns: recurring risk/objection themes across the pipeline
 */
import { after } from 'next/server'
import { db } from '@/lib/db'
import { dealLogs, competitors as competitorRecords, productGaps as productGapsTable, collateral as collateralTable, workspaces as workspacesTable } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { runMLEngine, computeCompositeScore, computeClosedDealHash, loadCachedModel, saveCachedModel, type TrainedMLModel, type DealMLPrediction, type MLTrends, type DealArchetype, type StageVelocityIntel, type CompetitivePattern, type ScoreCalibrationPoint, type CloseDateModel, type ScoreBreakdown, ML_MIN_TRAINING_DEALS } from '@/lib/deal-ml'
import { extractTextSignals, analyzeDeterioration, parseMeetingEntries, heuristicScore, type TextSignals } from '@/lib/text-signals'
import { BRAIN_VERSION } from '@/lib/brain-constants'
export { BRAIN_VERSION } from '@/lib/brain-constants'
import { getActiveGlobalModel, getGlobalConsent, extractContributions, contributeToGlobalPool } from '@/lib/global-pool'
import { computeUrgencyScore } from '@/lib/ml/urgency'
import { getEffectiveDealSummary } from '@/lib/effective-deal-summary'

export interface DealSignalSummary {
  momentum:         number    // 0–1 sentiment momentum (>0.5 = building)
  riskLevel:        'low' | 'medium' | 'high'
  isDeteriorating:  boolean
  predictedCloseDays: number | null
  velocity:         'accelerating' | 'steady' | 'decelerating'
  stakeholderDepth: number    // 0–1
  nextStepDefined:  boolean
  championStrength: number    // 0–1
}

export interface ScoreHistoryPoint {
  date: string       // ISO date string (YYYY-MM-DD)
  score: number      // 0–100 conversion score at that point
  stage: string      // stage at that point
}

export interface DealSnapshot {
  id: string
  name: string
  company: string
  stage: string
  conversionScore: number | null
  dealValue: number | null     // raw value in pounds/dollars (NOT pence)
  risks: string[]
  pendingTodos: string[]
  summary: string | null
  lastUpdated: string
  closeDate: string | null     // ISO string or null
  daysSinceUpdate: number
  projectPlanProgress?: { total: number; complete: number } | null
  signalSummary?: DealSignalSummary
  scoreHistory?: ScoreHistoryPoint[]  // score snapshots over time (appended on each rebuild)
  scoreTrend?: 'improving' | 'declining' | 'stable' | 'new'  // computed from scoreHistory
  scoreVelocity?: number       // change in score over last 14 days (positive = improving)
}

export interface WorkspaceBrain {
  brainVersion?: number               // bump BRAIN_VERSION to force a cache-bust rebuild
  updatedAt: string
  deals: DealSnapshot[]
  pipeline: {
    totalActive: number
    totalValue: number          // raw pounds/dollars (NOT pence)
    avgConversionScore: number | null
    stageBreakdown: Record<string, number>
  }
  topRisks: string[]            // deduplicated across all active deals
  keyPatterns: { label: string; dealIds: string[]; companies: string[]; dealNames: string[]; competitorNames?: string[]; riskSnippets?: { dealId: string; company: string; snippets: string[] }[] }[]  // recurring themes detected automatically
  urgentDeals: {                // deals needing attention soon
    dealId: string
    dealName: string
    company: string
    reason: string              // e.g. "Close date in 3 days" or "High-stage with low score"
    urgencyScore?: number       // 0-100 composite urgency (from computeUrgencyScore)
    topAction?: string          // single most important next action
  }[]
  staleDeals: {                 // open deals with no activity for 14+ days
    dealId: string
    dealName: string
    company: string
    daysSinceUpdate: number
    daysSinceActivity: number   // alias for daysSinceUpdate (used by proactive alerts UI)
    stage: string
    score: number | null
  }[]
  scoreAlerts: {               // deals whose score dropped >10 pts since last brain
    dealId: string
    dealName: string
    company: string
    previousScore: number
    currentScore: number
    delta: number
    possibleCause: string      // "sentiment declined" | "stalling in stage" | "competitor entered" | "no recent activity"
  }[]
  missingSignals: {            // late-stage deals missing critical qualification signals
    dealId: string
    dealName: string
    company: string
    stage: string
    missing: ('champion' | 'budget' | 'next_steps')[]
  }[]
  suggestedCollateral: {        // proactive collateral suggestions based on deal data
    dealId: string
    dealName: string
    company: string
    suggestion: string          // e.g. "Objection handler for budget concerns"
    type: string                // collateral type or 'custom'
    reason: string              // why this is suggested
  }[]
  pipelineRecommendations: {
    dealId: string
    dealName: string
    company: string
    recommendation: string
    priority: 'high' | 'medium' | 'low'
    action?: string
    actionType?: 'stage_change' | 'follow_up' | 'collateral' | 'meeting' | 'custom'
  }[]
  // ── Compounding intelligence — accumulates from closed deal history ─────────
  winLossIntel?: {
    winCount: number
    lossCount: number
    winRate: number                    // 0-100 integer
    avgWonValue: number                // average value of won deals
    avgDaysToClose: number             // average days from creation to close (won deals)
    topLossReasons: string[]           // most common reasons deals were lost
    competitorRecord: {                // win/loss record per named competitor
      name: string
      wins: number
      losses: number
      winRate: number                  // 0-100 integer
    }[]
    scoreCalibration: {
      avgScoreOnWins: number | null    // avg AI score on deals that were eventually won
      avgScoreOnLosses: number | null  // avg AI score on deals that were eventually lost
      highScoreWinRate: number | null  // % of 70%+ scored deals that actually won (out of closed)
    }
  }
  dealVelocity?: {
    weightedForecast: number           // probability-adjusted pipeline: sum(value × score/100)
    forecastDealCount: number          // active deals contributing to forecast
    avgDaysToClose: number             // mirror from winLossIntel for quick access
  }
  // ── Machine-learning layer — trained on closed deal history ────────────────
  mlModel?: TrainedMLModel            // logistic regression weights (workspace IP)
  mlPredictions?: DealMLPrediction[]  // win probability per open deal
  mlTrends?: MLTrends                 // trend analysis: win rate, velocity, competitor threats
  dealArchetypes?: DealArchetype[]                // k-means deal segments
  stageVelocityIntel?: StageVelocityIntel         // quantile-based stall detection
  competitivePatterns?: CompetitivePattern[]      // per-competitor mini-LR insights
  calibrationTimeline?: ScoreCalibrationPoint[]   // monthly ML discrimination tracking
  closeDateModel?: CloseDateModel                 // OLS close date regression model
  // ── Pipeline health & revenue intelligence ──────────────────────────────────
  pipelineHealthIndex?: PipelineHealthIndex        // composite 0–100 pipeline health
  revenueForecasts?: RevenueForecast[]             // probability-weighted monthly revenue
  deteriorationAlerts?: DeteriorationAlert[]       // deals showing declining note sentiment
  scoreTrendAlerts?: ScoreTrendAlert[]              // deals with significant score changes over time
  // ── Tier 1 intelligence ─────────────────────────────────────────────────────
  followUpIntel?: FollowUpCadenceIntel             // per-stage optimal follow-up cadence + alerts
  repIntel?: RepIntelStats[]                       // per-rep behavioural stats
  // ── Tier 2 intelligence ─────────────────────────────────────────────────────
  objectionWinMap?: {                              // risk themes that still led to wins — "we've beaten this"
    theme: string
    dealsWithTheme: number
    winsWithTheme: number
    winRateWithTheme: number                       // 0-100
    globalWinRate?: number                         // 0-100 industry win rate for this theme (if global prior active)
  }[]
  objectionConditionalWins?: {                     // per-theme × stage × champion conditional model
    theme: string
    dealsWithTheme: number
    stageBreakdown: {
      stage: string
      winRateWithChampion: number | null           // 0-100 win rate when champion present (null = <2 samples)
      winRateNoChampion: number | null             // 0-100 win rate when no champion (null = <2 samples)
      championLift: number | null                  // pts difference (withChampion − noChampion)
      sampleSize: number
    }[]
    championLiftAvg: number | null                 // avg pts lift of having champion across all stages
  }[]
  productGapPriority?: {                           // gaps ranked by open pipeline revenue at risk
    gapId: string
    title: string
    priority: string
    status: string
    revenueAtRisk: number
    dealsBlocked: number
    winRateWithGap?: number                        // 0-100 win rate on closed deals where gap came up
    winRateWithoutGap?: number                     // 0-100 win rate on closed deals without this gap
    winRateDelta?: number                          // winRateWithGap - winRateWithoutGap (negative = gap hurts)
  }[]
  collateralEffectiveness?: {                      // win rate per collateral type used in closed deals
    type: string
    totalUsed: number
    wins: number
    losses: number
    winRate: number                                // 0-100
  }[]
  // ── Cross-workspace transfer learning ────────────────────────────────────────
  globalPrior?: {
    trainingSize:      number     // how many records are in the global pool
    globalWinRate:     number     // 0-100 industry-wide win rate
    stageVelocityP50:  number     // global median days to close
    stageVelocityP75:  number     // global p75 days to close
    usingPrior:        boolean    // whether global prior is actively blended
    localWeight:       number     // 0-100: % of local vs global in blended model
    riskThemeWinRates: number[]   // 0-100 per theme (7 items, same index as riskWords)
  }
  winPlaybook?: {
    fastestClosePattern: {
      avgDaysToClose: number
      sampleSize: number
      commonSignals: string[]
      threshold: number
    } | null
    topObjectionWinPatterns: {
      theme: string
      winsWithTheme: number
      winRateWithTheme: number
      howBeaten: string
    }[]
    championPattern: {
      winRateWithChampion: number | null
      winRateNoChampion: number | null
      championLift: number | null
      sampleSize: number
    } | null
    perCompetitorWinCondition: {
      competitor: string
      winRate: number
      winCondition: string
      sampleSize: number
    }[]
  }
  // ── Contextual suggested prompts for Ask AI ────────────────────────────────
  suggestedPrompts?: string[]              // top 4 contextual prompts computed during brain rebuild
  // ── One-time backfill flag — set after extraction backfill runs ────────────
  extractionBackfillDone?: boolean
  // ── Loop summary and AI-driven actions ──────────────────────────────────────
  loopSummary?: {
    activeLoops: number
    waitingForPM: number
    inCycle: number
    shipped: number
    revenueAtRisk: number
  }
  dealActions?: Array<{
    dealId: string
    dealName: string
    dealValue: number
    action: string
    reason: string
    urgency: 'critical' | 'high' | 'medium'
    confidence: number
  }>
  intentSignals?: Array<{
    dealId: string
    dealName: string
    signal: string
    signalType: 'competitor' | 'budget' | 'champion' | 'objection' | 'positive'
    detectedAt: string
    daysAgo: number
  }>
  dailyBriefing?: string
  dailyBriefingGeneratedAt?: string
}

export interface PipelineHealthIndex {
  score:                 number     // 0–100 composite
  stageDepth:            number     // 0–100: % of deals in proposal/negotiation
  velocityHealth:        number     // 0–100: % of deals not stalling
  conversionConfidence:  number     // 0–100: avg ML win probability (or avg score)
  momentumScore:         number     // 0–100: aggregate deal momentum
  interpretation: 'Excellent' | 'Strong' | 'Moderate' | 'Weak' | 'Critical'
  keyInsight:            string
}

export interface RevenueForecast {
  month:           string    // "2026-04"
  expectedRevenue: number    // probability-weighted: sum(dealValue × winProbability)
  bestCase:        number    // sum of deal values (assuming all win)
  dealCount:       number
  avgConfidence:   number    // avg ML win probability (0–100)
}

export interface FollowUpCadenceIntel {
  /** Per-stage: how long won deals tolerated between notes — the safe follow-up window */
  stageStats: {
    stage:          string
    p50GapDays:     number    // median max note gap across won deals in this stage
    p75GapDays:     number    // 75th percentile — "danger zone" threshold
    sampleSize:     number
  }[]
  /** Open deals that have exceeded the safe window for their current stage */
  followUpAlerts: {
    dealId:              string
    dealName:            string
    company:             string
    stage:               string
    daysSinceLastNote:   number
    typicalMaxGapDays:   number   // p75 from won deals (or fallback 14)
    urgency:             'nudge' | 'alert' | 'critical'
    daysOverdue:         number
  }[]
}

export interface RepIntelStats {
  userId:                  string
  totalDeals:              number
  wonDeals:                number
  closedDeals:             number    // won + lost (denominator for winRate)
  winRate:                 number    // 0–100 (among closed deals)
  avgTodoCompletionRate:   number    // 0–100 integer %
  dealsWithNextStepPct:    number    // % of open deals with a defined next step
  avgDaysSinceLastNote:    number    // how recently they typically update open deals
}

export interface ScoreTrendAlert {
  dealId:         string
  dealName:       string
  company:        string
  trend:          'improving' | 'declining'
  currentScore:   number      // current score
  priorScore:     number      // score ~14 days ago (or earliest in window)
  delta:          number      // currentScore - priorScore
  periodDays:     number      // how many days the trend spans
  message:        string      // human-readable summary
}

export interface DeteriorationAlert {
  dealId:         string
  dealName:       string
  company:        string
  earlySentiment: number    // 0–1
  recentSentiment:number    // 0–1
  delta:          number    // recent − early (negative = deteriorating)
  warning:        string
}

/** No-op: all DDL migrations now live in lib/db/migrations.ts and run via runMigrations(). */
async function ensureBrainColumn() {}

// ── In-memory read cache ──────────────────────────────────────────────────────
// Avoids a DB round-trip on every request. TTL of 30 minutes; invalidated
// automatically whenever rebuildWorkspaceBrain writes a fresh brain.
const _brainReadCache = new Map<string, { brain: WorkspaceBrain; cachedAt: number }>()
const BRAIN_READ_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function _invalidateBrainCache(workspaceId: string) {
  _brainReadCache.delete(workspaceId)
}

/** Read the brain. Returns null if not yet built.
 *  Never runs DDL here — DDL only runs inside _doRebuildWorkspaceBrain (via after()).
 *  Catching column-not-found errors so a fresh DB returns null gracefully. */
export async function getWorkspaceBrain(workspaceId: string): Promise<WorkspaceBrain | null> {
  // Serve from in-memory cache if fresh
  const cached = _brainReadCache.get(workspaceId)
  if (cached && Date.now() - cached.cachedAt < BRAIN_READ_CACHE_TTL) {
    return cached.brain
  }
  try {
    const rows = await db.execute<{ workspace_brain: WorkspaceBrain | null }>(
      sql`SELECT workspace_brain FROM workspaces WHERE id = ${workspaceId} LIMIT 1`
    )
    const brain = rows[0]?.workspace_brain ?? null
    if (brain) _brainReadCache.set(workspaceId, { brain, cachedAt: Date.now() })
    return brain
  } catch {
    // Column doesn't exist yet on a fresh DB — brain will be created on next rebuild
    return null
  }
}

// ── Rebuild deduplication + cooldown ─────────────────────────────────────────
// Prevents multiple simultaneous brain rebuilds for the same workspace (which
// would each open DB connections, thrash the pool, and produce the same result).
// Cooldown: skip rebuild if one completed within the last 10 seconds — rapid
// mutations (e.g. import_deal) would otherwise chain N rebuilds.
const _rebuildInFlight = new Map<string, Promise<WorkspaceBrain>>()
const _lastRebuildAt = new Map<string, number>()
const REBUILD_COOLDOWN_MS = 10_000 // 10 seconds

/** Rebuild and persist the brain from current deal state. Call in background after any deal mutation. */
export async function rebuildWorkspaceBrain(workspaceId: string, reason = 'unknown'): Promise<WorkspaceBrain> {
  // Cooldown: skip if rebuilt very recently and no rebuild is in flight
  const lastAt = _lastRebuildAt.get(workspaceId) ?? 0
  if (!_rebuildInFlight.has(workspaceId) && Date.now() - lastAt < REBUILD_COOLDOWN_MS) {
    // Return current brain from DB without rebuilding
    return getWorkspaceBrain(workspaceId).then(b => b ?? _doRebuildWorkspaceBrain(workspaceId, reason))
  }

  // Deduplicate: if a rebuild is already running for this workspace, wait for it
  const existing = _rebuildInFlight.get(workspaceId)
  if (existing) return existing

  const promise = _doRebuildWorkspaceBrain(workspaceId, reason).finally(() => {
    _rebuildInFlight.delete(workspaceId)
    _lastRebuildAt.set(workspaceId, Date.now())
  })
  _rebuildInFlight.set(workspaceId, promise)
  return promise
}

// ── Debounced brain rebuild ───────────────────────────────────────────────────
// queueBrainRebuild provides a 5-second debounce for rapid successive mutations
// (e.g. 5 notes added in a row). Within a single long-lived process this helps
// coalesce bursts. On Vercel serverless each request runs in its own execution
// context so the debounce only helps within one request — for critical events
// (deal close, HubSpot sync) always call rebuildWorkspaceBrain directly inside
// after() so Vercel keeps the execution alive for the awaited promise.
const _pendingRebuilds = new Map<string, { timer: NodeJS.Timeout; reason: string }>()

/**
 * Queue a debounced brain rebuild (5-second window). Cancels any existing
 * pending rebuild for this workspace and re-queues.
 *
 * NOTE: on Vercel serverless the timer won't survive across requests. For
 * critical triggers use `rebuildWorkspaceBrain` directly inside `after()`.
 *
 * @deprecated Prefer `after(async () => { await rebuildWorkspaceBrain(id) })`.
 *             This shim is kept for callers that haven't been migrated yet.
 */
export function queueBrainRebuild(workspaceId: string, reason: string): void {
  // Cancel any pending debounce entry (kept for bookkeeping; timer is no-op on serverless)
  const existing = _pendingRebuilds.get(workspaceId)
  if (existing) clearTimeout(existing.timer)
  _pendingRebuilds.delete(workspaceId)

  // Use next/after so the rebuild runs after the response is sent on Vercel serverless,
  // where setTimeout callbacks are silently dropped once the response is flushed.
  after(async () => {
    try {
      await rebuildWorkspaceBrain(workspaceId, reason)
    } catch (e) {
      console.error(`[brain] queueBrainRebuild(${reason}) failed for ${workspaceId}:`, e)
    }
  })
}

/**
 * @deprecated Use `queueBrainRebuild` or call `rebuildWorkspaceBrain` directly
 * inside `after(async () => { ... })`. Kept as a shim so callers that haven't
 * been updated yet still compile.
 */
export function scheduleBrainRebuild(workspaceId: string, trigger = 'scheduled'): void {
  queueBrainRebuild(workspaceId, trigger)
}

// ── One-time extraction backfill ──────────────────────────────────────────────
// Runs on the first brain rebuild for any workspace that has deals with meeting
// notes but no structured note_signals_json. Uses the same extraction prompt as
// analyze-notes/route.ts but processes deals in a batch without blocking the UI.
async function _runExtractionBackfill(workspaceId: string): Promise<{ processed: number; skipped: number; errors: number }> {
  const stats = { processed: 0, skipped: 0, errors: 0 }
  try {
    // Find deals that have meeting notes but no extraction yet
    const rows = await db.execute<{ id: string; meeting_notes: string | null; hubspot_notes: string | null; note_signals_json: string | null }>(sql`
      SELECT id, meeting_notes, hubspot_notes, note_signals_json
      FROM deal_logs
      WHERE workspace_id = ${workspaceId}
        AND (meeting_notes IS NOT NULL AND meeting_notes != '' OR hubspot_notes IS NOT NULL AND hubspot_notes != '')
        AND (note_signals_json IS NULL OR note_signals_json = '')
      LIMIT 50
    `)

    const dealsToProcess = Array.isArray(rows) ? rows : (rows as any).rows ?? []
    if (dealsToProcess.length === 0) return stats

    const { anthropic } = await import('@/lib/ai/client')
    const { NoteExtractionSchema } = await import('@/lib/extraction-schema')

    for (const deal of dealsToProcess) {
      try {
        // Combine manual meeting notes + HubSpot notes for extraction
        const noteParts = [deal.meeting_notes, deal.hubspot_notes].filter(Boolean)
        const notes = noteParts.join('\n\n')
        if (!notes.trim()) { stats.skipped++; continue }

        // Run the extraction block only (no full analyze-notes prompt — lighter call)
        const msg = await anthropic.messages.create({
          model: 'gpt-5.4-mini',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Extract structured signals from these B2B sales meeting notes. Return ONLY a JSON object matching the schema exactly — no markdown, no explanation.

MEETING NOTES:
${notes.slice(0, 4000)}

Return this JSON:
{
  "champion_signal": boolean,
  "budget_signal": "confirmed" | "discussed" | "concern" | "not_mentioned",
  "decision_timeline": string | null,
  "next_step": string | null,
  "competitors_mentioned": string[],
  "objections": [{"theme": "budget"|"timing"|"authority"|"competitor"|"value"|"technical"|"integration"|"other", "text": string, "severity": "high"|"medium"|"low"}],
  "positive_signals": string[],
  "negative_signals": string[],
  "stakeholders_mentioned": [{"name": string, "role": string, "functional_area": string}],
  "product_gaps": [{"gap": string, "severity": "high"|"medium"|"low", "quote": string}],
  "sentiment_score": number (0.0-1.0),
  "urgency_signals": string[],
  "user_verified": false
}`
          }],
        })

        const rawText = (msg.content[0] as any)?.text?.trim() ?? ''
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) { stats.errors++; continue }

        const parsed = NoteExtractionSchema.safeParse(JSON.parse(jsonMatch[0]))
        if (!parsed.success) { stats.errors++; continue }

        // Store extraction and update deal fields
        const extraction = { ...parsed.data, user_verified: false }
        const updateFields: Record<string, unknown> = {
          note_signals_json: JSON.stringify(extraction),
        }

        // Update intent signals if not already set
        const intentSignals = {
          championStatus: extraction.champion_signal ? 'confirmed' : 'none',
          budgetStatus: extraction.budget_signal === 'confirmed' ? 'approved'
            : extraction.budget_signal === 'discussed' ? 'awaiting'
            : extraction.budget_signal === 'concern' ? 'blocked'
            : 'not_discussed',
          decisionTimeline: extraction.decision_timeline ?? null,
          nextMeetingBooked: false,
        }
        updateFields.intentSignals = intentSignals

        await db.execute(sql`
          UPDATE deal_logs
          SET note_signals_json = ${updateFields.note_signals_json as string},
              intent_signals = ${JSON.stringify(intentSignals)}::jsonb
          WHERE id = ${deal.id}
            AND workspace_id = ${workspaceId}
            AND (note_signals_json IS NULL OR note_signals_json = '')
        `)

        stats.processed++
      } catch { stats.errors++ }
    }
  } catch (e) {
    console.warn('[brain-backfill] extraction backfill error:', (e as Error)?.message)
  }
  return stats
}

// ── Generate contextual suggested prompts for Ask AI ─────────────────────────
// Picks top 4 most relevant prompts based on current brain/deal state.
// Pure data analysis — no AI calls.
function _generateSuggestedPrompts(opts: {
  activeDeals: { id: string; dealName: string; prospectCompany: string; stage: string; conversionScore: number | null; scheduledEvents: unknown; dealCompetitors: unknown; updatedAt: Date | null }[]
  staleDeals: WorkspaceBrain['staleDeals']
  scoreAlerts: WorkspaceBrain['scoreAlerts']
  wonCount: number
  lostCount: number
  previousBrain: WorkspaceBrain | null
  stageTransitionRows: any[]
  now: Date
}): string[] {
  const { activeDeals, staleDeals, scoreAlerts, wonCount, lostCount, previousBrain, stageTransitionRows, now } = opts
  const candidates: { priority: number; prompt: string }[] = []

  // 1. Deal with meeting today or tomorrow (from scheduled_events)
  const todayStr = now.toISOString().slice(0, 10)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  for (const d of activeDeals) {
    const events = (d.scheduledEvents ?? []) as { type?: string; date?: string | null; description?: string }[]
    for (const evt of events) {
      if (!evt.date) continue
      const evtDate = evt.date.slice(0, 10)
      if (evtDate === todayStr) {
        candidates.push({ priority: 1, prompt: `Prep me for the ${d.dealName} meeting today` })
      } else if (evtDate === tomorrowStr) {
        candidates.push({ priority: 2, prompt: `Prep me for the ${d.dealName} meeting tomorrow` })
      }
    }
  }

  // 2. Score dropped >10pts since last rebuild (from scoreAlerts)
  for (const alert of (scoreAlerts ?? []).slice(0, 2)) {
    candidates.push({
      priority: 3,
      prompt: `Why did ${alert.dealName} drop from ${alert.previousScore}% to ${alert.currentScore}%?`,
    })
  }

  // 3. Deal stuck in current stage longer than average
  if (stageTransitionRows.length > 0) {
    const transitionMap = new Map<string, Date>()
    for (const row of stageTransitionRows) {
      if (row.deal_id && row.transitioned_at) {
        transitionMap.set(row.deal_id, new Date(row.transitioned_at))
      }
    }
    // Compute average days in stage across all active deals that have transitions
    const daysInStageList: { dealId: string; dealName: string; stage: string; days: number }[] = []
    for (const d of activeDeals) {
      const t = transitionMap.get(d.id)
      if (t) {
        const days = (now.getTime() - t.getTime()) / 86_400_000
        daysInStageList.push({ dealId: d.id, dealName: d.dealName, stage: d.stage, days })
      }
    }
    if (daysInStageList.length >= 2) {
      const avg = daysInStageList.reduce((s, x) => s + x.days, 0) / daysInStageList.length
      const stuck = daysInStageList
        .filter(x => x.days > avg * 1.5 && x.days > 7)
        .sort((a, b) => b.days - a.days)
      for (const s of stuck.slice(0, 2)) {
        candidates.push({
          priority: 4,
          prompt: `How do I unstick ${s.dealName} from ${s.stage}?`,
        })
      }
    }
  }

  // 4. Deal with no notes in 14+ days (from staleDeals)
  for (const s of (staleDeals ?? []).slice(0, 2)) {
    candidates.push({
      priority: 5,
      prompt: `Help me re-engage ${s.dealName}`,
    })
  }

  // 5. Zero closed deals or near ML activation milestone
  const closedTotal = wonCount + lostCount
  if (closedTotal < 10) {
    candidates.push({
      priority: 6,
      prompt: 'What do I need to do to activate ML predictions?',
    })
  }

  // 6. New competitor detected — check if any active deal has a competitor not seen in previous brain
  const previousCompetitors = new Set<string>()
  if (previousBrain?.deals) {
    // Competitors are in keyPatterns competitorNames and in deal risks
    for (const p of previousBrain.keyPatterns ?? []) {
      for (const c of p.competitorNames ?? []) previousCompetitors.add(c.toLowerCase())
    }
  }
  for (const d of activeDeals) {
    for (const c of ((d.dealCompetitors as string[]) ?? [])) {
      if (c && !previousCompetitors.has(c.toLowerCase())) {
        candidates.push({
          priority: 7,
          prompt: `Build a battlecard against ${c}`,
        })
      }
    }
  }

  // Sort by priority (lower = more urgent), deduplicate, pick top 4
  candidates.sort((a, b) => a.priority - b.priority)
  const seen = new Set<string>()
  const prompts: string[] = []
  for (const c of candidates) {
    if (seen.has(c.prompt)) continue
    seen.add(c.prompt)
    prompts.push(c.prompt)
    if (prompts.length >= 3) break // leave room for the fallback
  }

  // Always include one generic fallback
  prompts.push('Summarise my pipeline this week')

  return prompts
}

async function _doRebuildWorkspaceBrain(workspaceId: string, reason = 'unknown'): Promise<WorkspaceBrain> {
  const rebuildStartMs = Date.now()
  console.log(`[brain] Rebuild started for workspace ${workspaceId} — triggered by: ${reason}`)
  await ensureBrainColumn()

  // ── Backfill outcome field for deals closed before this column existed ───────
  // Safe to run every rebuild — WHERE clause limits to rows that need fixing.
  try {
    await db.execute(sql`
      UPDATE deal_logs
      SET outcome = 'won',
          close_date = COALESCE(close_date, won_date, updated_at)
      WHERE workspace_id = ${workspaceId}
        AND stage = 'closed_won'
        AND outcome IS NULL
    `)
    await db.execute(sql`
      UPDATE deal_logs
      SET outcome = 'lost',
          close_date = COALESCE(close_date, lost_date, updated_at)
      WHERE workspace_id = ${workspaceId}
        AND stage = 'closed_lost'
        AND outcome IS NULL
    `)
  } catch { /* non-fatal — column may not exist yet on first run */ }

  // Load previous brain to carry forward score history
  const previousBrain = await getWorkspaceBrain(workspaceId)
  const previousDeals = new Map<string, DealSnapshot>()
  if (previousBrain?.deals) {
    for (const d of previousBrain.deals) previousDeals.set(d.id, d)
  }

  // ── One-time extraction backfill — runs on first rebuild that hasn't done it ─
  // After running, the flag is stored in the brain JSON so it won't run again.
  // Safe: gated by note_signals_json IS NULL so it only processes unextracted deals.
  let extractionBackfillDone = previousBrain?.extractionBackfillDone ?? false
  if (!extractionBackfillDone) {
    const backfillStats = await _runExtractionBackfill(workspaceId)
    extractionBackfillDone = true
    if (backfillStats.processed > 0 || backfillStats.errors === 0) {
      console.log(`[brain] extraction backfill: ${backfillStats.processed} processed, ${backfillStats.skipped} skipped, ${backfillStats.errors} errors`)
    }
  }

  const deals = await db
    .select({
      id: dealLogs.id,
      userId: dealLogs.userId,
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      stage: dealLogs.stage,
      dealValue: dealLogs.dealValue,
      dealType: dealLogs.dealType,
      recurringInterval: dealLogs.recurringInterval,
      conversionScore: dealLogs.conversionScore,
      dealRisks: dealLogs.dealRisks,
      dealCompetitors: dealLogs.competitors,
      todos: dealLogs.todos,
      aiSummary: dealLogs.aiSummary,
      dealReview: dealLogs.dealReview,
      updatedAt: dealLogs.updatedAt,
      closeDate: dealLogs.closeDate,
      projectPlan: dealLogs.projectPlan,
      // Historical intelligence fields
      createdAt: dealLogs.createdAt,
      wonDate: dealLogs.wonDate,
      lostDate: dealLogs.lostDate,
      lostReason: dealLogs.lostReason,
      meetingNotes: dealLogs.meetingNotes,
      hubspotNotes: dealLogs.hubspotNotes,
      intentSignals: dealLogs.intentSignals,
      outcome: dealLogs.outcome,
      scheduledEvents: dealLogs.scheduledEvents,
      nextSteps: dealLogs.nextSteps,
    })
    .from(dealLogs)
    .where(eq(dealLogs.workspaceId, workspaceId))

  // ── Tier 2: parallel fetch of product gaps + collateral + stage transitions ──
  const [gaps, collateralRows, stageTransitionRows] = await Promise.all([
    db.select({
      id: productGapsTable.id,
      title: productGapsTable.title,
      priority: productGapsTable.priority,
      status: productGapsTable.status,
      sourceDeals: productGapsTable.sourceDeals,
    }).from(productGapsTable).where(eq(productGapsTable.workspaceId, workspaceId)),
    db.select({
      type: collateralTable.type,
      status: collateralTable.status,
      sourceDealLogId: collateralTable.sourceDealLogId,
    }).from(collateralTable).where(eq(collateralTable.workspaceId, workspaceId)),
    // Latest stage transition per deal — for accurate days-in-current-stage
    db.execute<{ deal_id: string; to_stage: string; transitioned_at: string }>(sql`
      SELECT DISTINCT ON (deal_id) deal_id, to_stage, transitioned_at
      FROM stage_transitions
      WHERE workspace_id = ${workspaceId}
      ORDER BY deal_id, transitioned_at DESC
    `).catch(() => [] as { deal_id: string; to_stage: string; transitioned_at: string }[]),
  ])

  const now = new Date()

  // ── Merge hubspotNotes into meetingNotes so all AI/NLP code sees the full picture ──
  // hubspot_notes is always fresh from HubSpot; meeting_notes is manually editable.
  // We combine them here so every downstream consumer gets both without knowing the distinction.
  for (const d of deals) {
    const manual  = (d.meetingNotes as string | null) ?? ''
    const hsNotes = (d.hubspotNotes as string | null) ?? ''
    if (hsNotes && manual) {
      d.meetingNotes = `${manual}\n\n${hsNotes}`
    } else if (hsNotes) {
      d.meetingNotes = hsNotes
    }
    // If no hubspotNotes, meetingNotes stays as-is
  }

  // ── Auto-fix corrupted scores (from the *100 bug) — only if not user-pinned ──
  for (const d of deals) {
    if (d.conversionScore != null && (d.conversionScore > 100 || d.conversionScore < 0) && !(d as any).conversionScorePinned) {
      const fixed = Math.max(0, Math.min(100, Math.round(d.conversionScore / 100)))
      try {
        await db.update(dealLogs).set({ conversionScore: fixed, updatedAt: now }).where(eq(dealLogs.id, d.id))
        d.conversionScore = fixed
      } catch { /* non-fatal */ }
    }
  }

  const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost' && d.outcome !== 'won' && d.outcome !== 'lost')

  // ── Extract text signals for ALL deals upfront (used for ML features and signal summaries) ──
  const signalMap = new Map<string, TextSignals>()
  for (const d of deals) {
    signalMap.set(d.id, extractTextSignals(
      d.meetingNotes as string | null,
      d.createdAt,
      d.updatedAt,
    ))
  }

  // ── Baseline score backfill — for deals that have never been analyzed ────────
  // Any active deal with conversionScore === null gets a stage-normalized heuristic
  // baseline so the pipeline board shows a real estimate instead of null/0%.
  // Does NOT overwrite scores that were explicitly set (even 0).
  try {
    const [wsRow] = await db.select({ pipelineConfig: workspacesTable.pipelineConfig })
      .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1)
    const pipelineStages = ((wsRow?.pipelineConfig as any)?.stages ?? []) as { id: string; order: number }[]
    const activePipelineStages = pipelineStages
      .filter(s => s.id !== 'closed_won' && s.id !== 'closed_lost')
      .sort((a, b) => a.order - b.order)

    const dealsNeedingBaseline = deals.filter(d =>
      d.conversionScore === null &&
      d.stage !== 'closed_won' && d.stage !== 'closed_lost' &&
      d.outcome !== 'won' && d.outcome !== 'lost'
    )

    for (const d of dealsNeedingBaseline) {
      const signals = signalMap.get(d.id)
      if (!signals) continue
      const stageIdx = activePipelineStages.findIndex(s => s.id === d.stage)
      const stageNorm = activePipelineStages.length > 0 && stageIdx >= 0
        ? stageIdx / Math.max(activePipelineStages.length - 1, 1)
        : 0.5
      const baseline = heuristicScore(signals, stageNorm)
      if (baseline > 0) {
        try {
          await db.update(dealLogs).set({ conversionScore: baseline }).where(eq(dealLogs.id, d.id))
          d.conversionScore = baseline
        } catch { /* non-fatal */ }
      }
    }
  } catch { /* non-fatal — baseline scoring failure should not block brain rebuild */ }

  // ── Deterioration pass — compute per-deal before snapshot creation ──────────
  // analyzeDeterioration splits notes into early/recent halves and detects declining sentiment
  const deteriorationMap = new Map<string, boolean>()
  for (const d of deals) {
    if (d.stage === 'closed_won' || d.stage === 'closed_lost') continue
    try {
      const det = analyzeDeterioration(d.meetingNotes as string | null)
      if (det.isDeteriorating) deteriorationMap.set(d.id, true)
    } catch { /* non-fatal */ }
  }

  const snapshots: DealSnapshot[] = deals.map(d => {
    const allTodos = (d.todos as { text: string; done: boolean }[]) ?? []
    const pending = allTodos.filter(t => !t.done).map(t => t.text)
    const updatedMs = d.updatedAt ? new Date(d.updatedAt).getTime() : now.getTime()
    const daysSince = Math.floor((now.getTime() - updatedMs) / 86_400_000)
    const sig = signalMap.get(d.id)
    return {
      id: d.id,
      name: d.dealName,
      company: d.prospectCompany,
      stage: d.stage,
      conversionScore: d.conversionScore != null ? Math.max(0, Math.min(100, d.conversionScore)) : null,
      dealValue: d.dealValue,
      risks: (d.dealRisks as string[]) ?? [],
      pendingTodos: pending.slice(0, 8),
      summary: getEffectiveDealSummary(d),
      lastUpdated: d.updatedAt
        ? new Date(d.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '',
      closeDate: d.closeDate ? new Date(d.closeDate).toISOString() : null,
      daysSinceUpdate: daysSince,
      projectPlanProgress: (() => {
        const plan = (d as any).projectPlan as any
        if (!plan?.phases) return null
        const tasks = plan.phases.flatMap((p: any) => p.tasks ?? [])
        if (tasks.length === 0) return null
        return { total: tasks.length, complete: tasks.filter((t: any) => t.status === 'complete').length }
      })(),
      signalSummary: sig ? (() => {
        // Task 6: Prefer stored intentSignals for champion/budget if available (extraction-backed).
        // Fall back to regex-based text signal detection if no stored extraction data.
        const storedSignals = d.intentSignals as { championStatus?: string; budgetStatus?: string } | null
        const storedChampionStrength = storedSignals?.championStatus === 'confirmed' ? 1.0
          : storedSignals?.championStatus === 'suspected' ? 0.5
          : null
        return {
          momentum:           sig.momentumScore,
          riskLevel:          sig.objectionCount >= 4 ? 'high' : sig.objectionCount >= 2 ? 'medium' : 'low',
          isDeteriorating:    deteriorationMap.get(d.id) ?? false,
          predictedCloseDays: null,   // filled in after ML runs
          velocity:           sig.engagementVelocity,
          stakeholderDepth:   sig.stakeholderDepth,
          nextStepDefined:    sig.nextStepDefined,
          // Prefer stored extraction-backed champion strength; fall back to regex
          championStrength:   storedChampionStrength ?? sig.championStrength,
        }
      })() : undefined,
      // ── Score history: carry forward from previous brain + append today's score ──
      scoreHistory: (() => {
        const prev = previousDeals.get(d.id)
        const existing: ScoreHistoryPoint[] = prev?.scoreHistory ?? []
        const todayStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
        const currentScore = d.conversionScore
        if (currentScore == null) return existing.length > 0 ? existing : undefined
        // Deduplicate: don't add if last entry is the same date with the same score
        const last = existing[existing.length - 1]
        if (last && last.date === todayStr && last.score === currentScore) return existing
        // If same date but different score, replace the last entry
        if (last && last.date === todayStr) {
          return [...existing.slice(0, -1), { date: todayStr, score: currentScore, stage: d.stage }]
        }
        // Append new point, keep max 90 days of history
        const newHistory = [...existing, { date: todayStr, score: currentScore, stage: d.stage }]
        return newHistory.length > 90 ? newHistory.slice(-90) : newHistory
      })(),
    }
  })

  // ── Pipeline stats ─────────────────────────────────────────────────────────
  const totalValue = activeDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)
  const scores = activeDeals.map(d => d.conversionScore).filter((s): s is number => s != null)
  const avgConversionScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

  const stageBreakdown: Record<string, number> = {}
  for (const d of deals) {
    stageBreakdown[d.stage] = (stageBreakdown[d.stage] ?? 0) + 1
  }

  // ── Top risks — deduplicated ────────────────────────────────────────────────
  const allRisks = activeDeals.flatMap(d => (d.dealRisks as string[]) ?? [])
  const topRisks = [...new Set(allRisks)].slice(0, 8)

  // ── Proactive: urgent deals ────────────────────────────────────────────────
  // Flag: close date within 7 days, OR in proposal/negotiation with score < 35
  const urgentDeals: WorkspaceBrain['urgentDeals'] = []
  const lateStages = new Set(['proposal', 'negotiation'])
  for (const snap of snapshots) {
    if (snap.stage === 'closed_won' || snap.stage === 'closed_lost') continue
    if (snap.closeDate) {
      const daysToClose = Math.ceil((new Date(snap.closeDate).getTime() - now.getTime()) / 86_400_000)
      if (daysToClose >= 0 && daysToClose <= 7) {
        urgentDeals.push({
          dealId: snap.id,
          dealName: snap.name,
          company: snap.company,
          reason: daysToClose === 0 ? 'Close date is TODAY' : `Close date in ${daysToClose} day${daysToClose === 1 ? '' : 's'}`,
        })
        continue
      }
      if (daysToClose < 0) {
        urgentDeals.push({
          dealId: snap.id,
          dealName: snap.name,
          company: snap.company,
          reason: `Overdue — close date passed ${Math.abs(daysToClose)} day${Math.abs(daysToClose) === 1 ? '' : 's'} ago`,
        })
        continue
      }
    }
    if (lateStages.has(snap.stage) && snap.conversionScore != null && snap.conversionScore < 35) {
      urgentDeals.push({
        dealId: snap.id,
        dealName: snap.name,
        company: snap.company,
        reason: `In ${snap.stage} with only ${snap.conversionScore}% conversion likelihood`,
      })
    }
  }

  // ── Enrich urgentDeals with urgencyScore + topAction, add high-score misses ──
  const urgentDealIds = new Set(urgentDeals.map(u => u.dealId))
  for (const snap of snapshots) {
    if (snap.stage === 'closed_won' || snap.stage === 'closed_lost') continue
    const urgency = computeUrgencyScore(snap)
    // Enrich existing entries
    const existing = urgentDeals.find(u => u.dealId === snap.id)
    if (existing) {
      existing.urgencyScore = urgency.score
      existing.topAction = urgency.topAction
      continue
    }
    // Add deals missed by heuristics but scoring >60 urgency
    if (urgency.score >= 60 && urgency.reasons.length > 0) {
      urgentDealIds.add(snap.id)
      urgentDeals.push({
        dealId: snap.id,
        dealName: snap.name,
        company: snap.company,
        reason: urgency.reasons[0],
        urgencyScore: urgency.score,
        topAction: urgency.topAction,
      })
    }
  }
  // Sort urgentDeals by urgencyScore descending
  urgentDeals.sort((a, b) => (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0))

  // ── Proactive: stale deals (no update in 14+ days) ─────────────────────────
  const staleDeals: WorkspaceBrain['staleDeals'] = activeDeals
    .filter(d => {
      const daysSince = snapshots.find(s => s.id === d.id)?.daysSinceUpdate ?? 0
      return daysSince >= 14
    })
    .map(d => {
      const snap = snapshots.find(s => s.id === d.id)!
      return {
        dealId: d.id,
        dealName: d.dealName,
        company: d.prospectCompany,
        daysSinceUpdate: snap.daysSinceUpdate,
        daysSinceActivity: snap.daysSinceUpdate,
        stage: d.stage,
        score: snap.conversionScore,
      }
    })
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)

  // ── Proactive: score drop alerts (vs previous brain) ──────────────────────
  const scoreAlerts: WorkspaceBrain['scoreAlerts'] = []
  for (const snap of snapshots) {
    if (snap.stage === 'closed_won' || snap.stage === 'closed_lost') continue
    if (snap.conversionScore == null) continue
    const prev = previousDeals.get(snap.id)
    if (!prev || prev.conversionScore == null) continue
    const delta = snap.conversionScore - prev.conversionScore
    if (delta < -10) {
      // Determine most likely cause
      const sig = signalMap.get(snap.id)
      let possibleCause: string
      if (sig?.momentumScore != null && sig.momentumScore < 0.35) {
        possibleCause = 'sentiment declined'
      } else if (snap.daysSinceUpdate >= 14) {
        possibleCause = 'no recent activity'
      } else {
        const risks = snap.risks.map(r => r.toLowerCase())
        if (risks.some(r => r.includes('competitor') || r.includes('rival'))) {
          possibleCause = 'competitor entered'
        } else {
          possibleCause = 'stalling in stage'
        }
      }
      scoreAlerts.push({
        dealId: snap.id,
        dealName: snap.name,
        company: snap.company,
        previousScore: prev.conversionScore,
        currentScore: snap.conversionScore,
        delta,
        possibleCause,
      })
    }
  }
  scoreAlerts.sort((a, b) => a.delta - b.delta)  // most severe drops first

  // ── Proactive: missing signals nudge (late-stage deals) ────────────────────
  const LATE_STAGES_MISSING = new Set(['proposal', 'negotiation', 'closing', 'contract'])
  const missingSignals: WorkspaceBrain['missingSignals'] = []
  for (const d of activeDeals) {
    if (!LATE_STAGES_MISSING.has(d.stage)) continue
    const snap = snapshots.find(s => s.id === d.id)
    if (!snap) continue
    const intentSignals = d.intentSignals as { championStatus?: string; budgetStatus?: string } | null
    const missing: ('champion' | 'budget' | 'next_steps')[] = []
    if (!intentSignals?.championStatus || intentSignals.championStatus !== 'confirmed') {
      missing.push('champion')
    }
    if (!intentSignals?.budgetStatus || intentSignals.budgetStatus === 'not_discussed') {
      missing.push('budget')
    }
    if ((snap.pendingTodos ?? []).length === 0) {
      missing.push('next_steps')
    }
    if (missing.length > 0) {
      missingSignals.push({
        dealId: d.id,
        dealName: d.dealName,
        company: d.prospectCompany,
        stage: d.stage,
        missing,
      })
    }
  }
  missingSignals.sort((a, b) => b.missing.length - a.missing.length)

  // ── Proactive: key patterns — recurring risk themes ────────────────────────
  // Count keyword frequency across all risk strings; surface themes seen in 2+ deals
  const riskWords = [
    {
      label: 'budget concerns',
      keywords: [
        'budget', 'expensive', 'pricing', 'cost concern', 'cost is', 'price is',
        'too expensive', 'affordab', 'no budget', 'limited budget', 'tight budget',
        'budget freeze', 'budget cut', 'budget approval', 'finance team', 'cfo approval',
        'justify the cost', 'commercial approval', 'value for money', 'cost-benefit',
        'roi', 'return on investment', 'over budget', 'financial approval', 'spend approval',
        'not approved', 'waiting on budget', 'budget not confirmed',
      ],
    },
    {
      label: 'slow responses / disengagement',
      keywords: [
        'unresponsive', 'ghosted', 'disengaged', 'no reply', 'not responding',
        'gone quiet', 'delayed response', 'slow to respond', 'no show', 'missed meeting',
        'cancelled meeting', 'rescheduled again', 'hard to reach', 'radio silence',
        'lost momentum', 'cooling off', 'less engaged', 'not engaged',
        'haven\'t heard back', 'waiting for response', 'no feedback', 'ignoring',
        'no follow through', 'hard to get hold', 'hard to get hold of', 'difficult to reach',
        'not returning', 'dropped off', 'fallen off', 'stopped responding',
      ],
    },
    {
      label: 'competitor pressure',
      keywords: [
        'competitor', 'competing solution', 'rival', 'switching from', 'already using',
        'evaluating others', 'other vendors', 'shortlist', 'comparing with',
        'also looking at', 'going with', 'incumbent', 'current provider', 'existing solution',
        'selected another', 'chose competitor', 'other platform', 'alternative solution',
        'rfp', 'rft', 'tender', 'benchmark', 'they use', 'they are using',
        'current system', 'existing vendor', 'incumbent solution', 'looking at others',
        'competitive bid', 'multiple vendors', 'vendor comparison',
      ],
    },
    {
      label: 'unclear decision-maker',
      keywords: [
        'unclear who', 'decision maker', 'no champion', 'no sponsor', 'approver unknown',
        'committee approval', 'board approval', 'needs sign-off', 'unclear authority',
        'multiple stakeholders', 'consensus required', 'steering committee',
        'executive sign-off', 'waiting on approval', 'not the decision maker',
        'need to involve', 'bring in their manager', 'no single owner', 'no clear owner',
        'political', 'internal politics', 'sign off needed', 'approval chain',
        'need buy-in', 'stakeholder alignment', 'no executive sponsor',
        'champion is not', 'champion doesn\'t', 'can\'t approve', 'cannot approve',
      ],
    },
    {
      label: 'timeline slippage',
      keywords: [
        'delayed', 'postponed', 'pushed back', 'slipped', 'no deadline', 'timeline unclear',
        'timeline at risk', 'not urgent', 'no urgency', 'next quarter', 'next year',
        'after the holiday', 'after budget', 'on hold', 'paused', 'frozen',
        'no fixed date', 'no go-live', 'no go live', 'go-live at risk',
        'no target date', 'vague timeline', 'indefinite', 'when budget',
        'deprioritised', 'deprioritized', 'not a priority right now', 'timing uncertain',
        'start date unclear', 'no confirmed start',
      ],
    },
    {
      label: 'procurement / legal blockers',
      keywords: [
        'procurement', 'legal review', 'compliance review', 'security review',
        'contract review', 'legal blocker', 'legal hold', 'data protection', 'gdpr',
        'infosec', 'vendor assessment', 'due diligence', 'it approval', 'risk assessment',
        'vendor registration', 'msa', 'nda', 'terms review', 'data processing',
        'dpa', 'iso 27001', 'soc 2', 'pen test', 'penetration test', 'it security',
        'compliance team', 'legal team', 'legal department', 'awaiting legal',
        'legal sign off', 'contract negotiation', 'terms negotiation',
      ],
    },
    {
      label: 'internal competing priorities',
      keywords: [
        'competing priorities', 'bandwidth issue', 'deprioritised', 'deprioritized',
        'resource constrained', 'internal blocker', 'other projects', 'too busy',
        'no capacity', 'headcount', 'restructuring', 'reorganization', 'reorganisation',
        'leadership change', 'team change', 'focus elsewhere', 'strategy change',
        'new initiative', 'acquisition', 'merger', 'integration work', 'other initiative',
        'stretched', 'overloaded', 'no bandwidth', 'team too small', 'not resourced',
        'internal project', 'internal focus', 'change freeze', 'change moratorium',
      ],
    },
  ]

  const keyPatterns: WorkspaceBrain['keyPatterns'] = []
  for (const theme of riskWords) {
    const matchingDeals = activeDeals.filter(d => {
      const allText = ((d.dealRisks as string[]) ?? []).join(' ').toLowerCase()
      return theme.keywords.some(kw => allText.includes(kw))
    })
    if (matchingDeals.length >= 2) {
      // For competitor pressure: first try explicit competitors[] array, then scan risk text
      let competitorNames: string[] | undefined
      if (theme.label === 'competitor pressure') {
        const fromArray = [...new Set(matchingDeals.flatMap(d => (d.dealCompetitors as string[]) ?? []).filter(Boolean))]
        if (fromArray.length > 0) {
          competitorNames = fromArray
        } else {
          // Fallback: extract likely competitor names from risk text using common patterns
          const allRiskText = matchingDeals.flatMap(d => (d.dealRisks as string[]) ?? []).join(' ')
          const extracted = new Set<string>()
          const patterns = [
            /\bvs\.?\s+([A-Z][a-zA-Z0-9]{2,}(?:\s+[A-Z][a-zA-Z0-9]{2,})?)/g,
            /\bevaluating\s+([A-Z][a-zA-Z0-9]{2,}(?:\s+[A-Z][a-zA-Z0-9]{2,})?)/gi,
            /\bconsidering\s+([A-Z][a-zA-Z0-9]{2,}(?:\s+[A-Z][a-zA-Z0-9]{2,})?)/gi,
            /\busing\s+([A-Z][a-zA-Z0-9]{2,}(?:\s+[A-Z][a-zA-Z0-9]{2,})?)\s+(?:currently|instead|today)/gi,
          ]
          const stopWords = new Set(['The','This','They','Their','We','Our','Also','But','And','For','Has','Have','Not','Can','Will'])
          for (const re of patterns) {
            let m: RegExpExecArray | null
            while ((m = re.exec(allRiskText)) !== null) {
              const name = m[1].trim()
              if (!stopWords.has(name.split(' ')[0])) extracted.add(name)
            }
          }
          if (extracted.size > 0) competitorNames = [...extracted]
        }
      }
      // Extract the actual matching risk strings for each deal in this pattern
      const riskSnippets = matchingDeals.map(d => {
        const risks = (d.dealRisks as string[]) ?? []
        const matching = risks.filter(r => theme.keywords.some(kw => r.toLowerCase().includes(kw)))
        return { dealId: d.id, company: d.prospectCompany, snippets: matching.slice(0, 2) }
      }).filter(r => r.snippets.length > 0)

      keyPatterns.push({
        label: theme.label,
        dealIds: matchingDeals.map(d => d.id),
        companies: matchingDeals.map(d => d.prospectCompany),
        dealNames: matchingDeals.map(d => d.dealName),
        ...(riskSnippets.length > 0 ? { riskSnippets } : {}),
        ...(competitorNames && competitorNames.length > 0 ? { competitorNames } : {}),
      })
    }
  }

  // ── Tier 2: Objection → Win Condition Mapping ─────────────────────────────
  // For risk themes that appear in CLOSED deals, compute how often the deal still won.
  // "We had [budget concern] on 6 deals and still closed 4 of them" = proven solvable.
  const closedDeals = deals.filter(d => d.stage === 'closed_won' || d.stage === 'closed_lost' || d.outcome === 'won' || d.outcome === 'lost')
  const objectionWinMap: NonNullable<WorkspaceBrain['objectionWinMap']> = []
  if (closedDeals.length >= 4) {
    for (const theme of riskWords) {
      const withTheme = closedDeals.filter(d => {
        const allText = ((d.dealRisks as string[]) ?? []).join(' ').toLowerCase()
        return theme.keywords.some(kw => allText.includes(kw))
      })
      if (withTheme.length < 2) continue
      const wins = withTheme.filter(d => d.stage === 'closed_won').length
      objectionWinMap.push({
        theme: theme.label,
        dealsWithTheme: withTheme.length,
        winsWithTheme: wins,
        winRateWithTheme: Math.round((wins / withTheme.length) * 100),
      })
    }
    objectionWinMap.sort((a, b) => b.winsWithTheme - a.winsWithTheme)
  }

  // ── Extraction-based objection themes (augments or replaces risk-word map) ──
  // Reads note_signals_json from all deals (not just closed) to populate the
  // Top Objections card even before 4+ closed deals exist.
  // Theme labels match the LLM extraction prompt: budget|timing|authority|competitor|value|technical|integration|other
  if (objectionWinMap.length === 0) {
    try {
      const extractionRows = await db.execute<{ id: string; stage: string; note_signals_json: string | null }>(
        sql`SELECT id, stage, note_signals_json FROM deal_logs WHERE workspace_id = ${workspaceId} AND note_signals_json IS NOT NULL`
      )
      const themeMap = new Map<string, { dealIds: Set<string>; wins: number; losses: number }>()
      for (const row of extractionRows) {
        try {
          const extraction = JSON.parse(row.note_signals_json ?? 'null')
          if (!extraction?.objections?.length) continue
          const isWon = row.stage === 'closed_won'
          const isLost = row.stage === 'closed_lost'
          for (const obj of extraction.objections as { theme?: string; text?: string }[]) {
            const t = (obj.theme ?? 'other').toLowerCase().trim()
            const entry = themeMap.get(t) ?? { dealIds: new Set(), wins: 0, losses: 0 }
            if (!entry.dealIds.has(row.id)) {
              entry.dealIds.add(row.id)
              if (isWon) entry.wins++
              if (isLost) entry.losses++
            }
            themeMap.set(t, entry)
          }
        } catch { /* skip malformed rows */ }
      }
      const themeLabels: Record<string, string> = {
        budget: 'Budget concern', timing: 'Timing / not now', authority: 'Authority / sign-off',
        competitor: 'Competitor pressure', value: 'Value / benefit unclear', technical: 'Technical concerns',
        integration: 'Integration requirements', other: 'Other objections',
      }
      for (const [theme, data] of themeMap) {
        if (data.dealIds.size < 1) continue
        const total = data.dealIds.size
        const wins = data.wins
        const closed = data.wins + data.losses
        objectionWinMap.push({
          theme: themeLabels[theme] ?? theme,
          dealsWithTheme: total,
          winsWithTheme: wins,
          winRateWithTheme: closed >= 2 ? Math.round((wins / closed) * 100) : 0,
        })
      }
      objectionWinMap.sort((a, b) => b.dealsWithTheme - a.dealsWithTheme)
    } catch { /* non-fatal — skip if table/column not ready */ }
  }

  // ── Tier 2: Objection × Stage × Champion Conditional Model ────────────────
  // For each risk theme present in closed deals, break down win rate by:
  //   - Stage the deal was in when the theme was present
  //   - Whether a champion was identified (championStrength > 0.5 from text signals)
  // This answers: "When 'budget concerns' comes up in proposal WITH a champion, we win 71% vs 23% without"
  // Minimum: ≥6 closed deals with the theme to compute stage breakdown
  const objectionConditionalWins: NonNullable<WorkspaceBrain['objectionConditionalWins']> = []
  if (closedDeals.length >= 6) {
    for (const theme of riskWords) {
      const withTheme = closedDeals.filter(d => {
        const allText = ((d.dealRisks as string[]) ?? []).join(' ').toLowerCase()
        return theme.keywords.some(kw => allText.includes(kw))
      })
      if (withTheme.length < 4) continue

      // Group by stage
      const stageMap = new Map<string, { wins: number; totalWithChamp: number; winsWithChamp: number; totalNoChamp: number; winsNoChamp: number }>()
      for (const d of withTheme) {
        const sig = signalMap.get(d.id)
        const hasChampion = (sig?.championStrength ?? 0) > 0.5
        const isWon = d.stage === 'closed_won'
        const entry = stageMap.get(d.stage) ?? { wins: 0, totalWithChamp: 0, winsWithChamp: 0, totalNoChamp: 0, winsNoChamp: 0 }
        if (isWon) entry.wins++
        if (hasChampion) {
          entry.totalWithChamp++
          if (isWon) entry.winsWithChamp++
        } else {
          entry.totalNoChamp++
          if (isWon) entry.winsNoChamp++
        }
        stageMap.set(d.stage, entry)
      }

      const stageOrder = ['prospecting', 'qualification', 'discovery', 'proposal', 'negotiation']
      const stageBreakdown: NonNullable<WorkspaceBrain['objectionConditionalWins']>[0]['stageBreakdown'] = []
      const liftValues: number[] = []

      for (const stage of stageOrder) {
        const entry = stageMap.get(stage)
        if (!entry) continue
        const sampleSize = entry.totalWithChamp + entry.totalNoChamp
        if (sampleSize < 2) continue

        // Bayesian rate with Laplace smoothing (α=0.5) — stabilises small sample estimates
        const wrWithChamp = entry.totalWithChamp >= 2
          ? Math.round(((entry.winsWithChamp + 0.5) / (entry.totalWithChamp + 1)) * 100)
          : null
        const wrNoChamp = entry.totalNoChamp >= 2
          ? Math.round(((entry.winsNoChamp + 0.5) / (entry.totalNoChamp + 1)) * 100)
          : null
        const lift = wrWithChamp != null && wrNoChamp != null ? wrWithChamp - wrNoChamp : null
        if (lift != null) liftValues.push(lift)

        stageBreakdown.push({ stage, winRateWithChampion: wrWithChamp, winRateNoChampion: wrNoChamp, championLift: lift, sampleSize })
      }

      if (stageBreakdown.length === 0) continue
      const championLiftAvg = liftValues.length > 0
        ? Math.round(liftValues.reduce((a, b) => a + b, 0) / liftValues.length)
        : null

      objectionConditionalWins.push({
        theme: theme.label,
        dealsWithTheme: withTheme.length,
        stageBreakdown,
        championLiftAvg,
      })
    }
    objectionConditionalWins.sort((a, b) => b.dealsWithTheme - a.dealsWithTheme)
  }

  // ── Tier 2: Product Gap Revenue Priority + Win Rate Delta ──────────────────
  // For each active gap, compute how much open pipeline revenue is at risk
  // by joining sourceDeals[] against active deals with a deal value.
  // Also compute: win rate on deals WITH this gap vs WITHOUT it (requires ≥3 closed deals with gap).
  const productGapPriority: NonNullable<WorkspaceBrain['productGapPriority']> = []
  for (const gap of gaps) {
    if (gap.status === 'shipped' || gap.status === 'wont_fix') continue
    const sourceDealIds: string[] = (gap.sourceDeals as string[]) ?? []
    const openGapDeals = activeDeals.filter(d => sourceDealIds.includes(d.id))
    const revenueAtRisk = openGapDeals.reduce((s, d) => s + (d.dealValue ?? 0), 0)
    // Win rate delta: deals WITH this gap that closed vs. deals WITHOUT this gap that closed
    const closedWithGap    = closedDeals.filter(d => sourceDealIds.includes(d.id))
    const closedWithoutGap = closedDeals.filter(d => !sourceDealIds.includes(d.id))
    let winRateWithGap:    number | undefined
    let winRateWithoutGap: number | undefined
    let winRateDelta:      number | undefined
    if (closedWithGap.length >= 3) {
      winRateWithGap = Math.round((closedWithGap.filter(d => d.stage === 'closed_won').length / closedWithGap.length) * 100)
      if (closedWithoutGap.length >= 3) {
        winRateWithoutGap = Math.round((closedWithoutGap.filter(d => d.stage === 'closed_won').length / closedWithoutGap.length) * 100)
        winRateDelta      = winRateWithGap - winRateWithoutGap
      }
    }

    productGapPriority.push({
      gapId:         gap.id,
      title:         gap.title,
      priority:      gap.priority,
      status:        gap.status,
      revenueAtRisk,
      dealsBlocked:  openGapDeals.length,
      winRateWithGap,
      winRateWithoutGap,
      winRateDelta,
    })
  }
  productGapPriority.sort((a, b) => b.revenueAtRisk - a.revenueAtRisk || b.dealsBlocked - a.dealsBlocked)

  // ── Tier 2: Collateral Effectiveness Scoring ───────────────────────────────
  // Map each collateral type → closed deal outcomes to compute win rate per type.
  // Only counts "ready" collateral that was generated for a specific deal.
  const effectivenessMap = new Map<string, { wins: number; losses: number }>()
  for (const item of collateralRows) {
    if (item.status !== 'ready' || !item.sourceDealLogId) continue
    const deal = deals.find(d => d.id === item.sourceDealLogId)
    if (!deal || (deal.stage !== 'closed_won' && deal.stage !== 'closed_lost')) continue
    const cur = effectivenessMap.get(item.type) ?? { wins: 0, losses: 0 }
    if (deal.stage === 'closed_won') { cur.wins++ } else { cur.losses++ }
    effectivenessMap.set(item.type, cur)
  }
  const collateralEffectiveness: NonNullable<WorkspaceBrain['collateralEffectiveness']> = []
  for (const [type, { wins, losses }] of effectivenessMap.entries()) {
    const total = wins + losses
    if (total < 2) continue
    collateralEffectiveness.push({ type, totalUsed: total, wins, losses, winRate: Math.round((wins / total) * 100) })
  }
  collateralEffectiveness.sort((a, b) => b.winRate - a.winRate)

  // ── Auto-create competitor stubs for any named competitors in active deals ─
  // This ensures every competitor mentioned in a deal appears in the Intelligence hub.
  try {
    const allCompetitorNames = [
      ...new Set(activeDeals.flatMap(d => (d.dealCompetitors as string[]) ?? []).filter(Boolean)),
    ]
    if (allCompetitorNames.length > 0) {
      // Fetch existing competitor names for this workspace
      const existingRows = await db
        .select({ name: competitorRecords.name })
        .from(competitorRecords)
        .where(eq(competitorRecords.workspaceId, workspaceId))
      const existingNames = new Set(existingRows.map(r => r.name.toLowerCase()))
      let newNames = allCompetitorNames.filter(n => !existingNames.has(n.toLowerCase()))

      // Semantic dedup — catch aliases like "Salesforce" vs "SFDC" vs "Salesforce CRM"
      if (newNames.length > 0) {
        try {
          const { findCompetitorDuplicates } = await import('@/lib/semantic-search')
          const dupes = await findCompetitorDuplicates(workspaceId, newNames, 0.82)
          if (dupes.length > 0) {
            const dupeNames = new Set(dupes.map(d => d.newName.toLowerCase()))
            console.log(`[brain] Semantic dedup: skipping ${dupeNames.size} competitor aliases: ${[...dupeNames].join(', ')}`)
            newNames = newNames.filter(n => !dupeNames.has(n.toLowerCase()))
          }
        } catch { /* non-fatal — semantic dedup is best-effort enhancement */ }
      }

      if (newNames.length > 0) {
        const nowTs = new Date()
        await db.insert(competitorRecords).values(
          newNames.map(name => ({
            workspaceId,
            name,
            notes: 'Auto-added from deal tracking — add details to build a battlecard.',
            strengths: [],
            weaknesses: [],
            keyFeatures: [],
            differentiators: [],
            createdAt: nowTs,
            updatedAt: nowTs,
          }))
        )
      }
    }
  } catch { /* non-fatal — competitor auto-create is best-effort */ }

  // ── Proactive: suggested collateral ───────────────────────────────────────
  const suggestedCollateral: WorkspaceBrain['suggestedCollateral'] = []

  for (const snap of snapshots) {
    if (snap.stage === 'closed_won' || snap.stage === 'closed_lost') continue
    if (suggestedCollateral.length >= 5) break

    // Deal in negotiation/proposal with risks → objection handler
    if ((snap.stage === 'negotiation' || snap.stage === 'proposal') && snap.risks.length > 0) {
      const topRisk = snap.risks[0]
      suggestedCollateral.push({
        dealId: snap.id,
        dealName: snap.name,
        company: snap.company,
        suggestion: `Objection handler for ${topRisk.toLowerCase()}`,
        type: 'objection_handler',
        reason: `Deal is in ${snap.stage} stage with identified risk: "${topRisk}"`,
      })
      if (suggestedCollateral.length >= 5) break
    }

    // Deal has competitor-related risks → battlecard
    const riskText = snap.risks.join(' ').toLowerCase()
    const hasCompetitorMention = ['competitor', 'competing', 'alternative', 'rival', 'vs '].some(kw => riskText.includes(kw))
    if (hasCompetitorMention) {
      suggestedCollateral.push({
        dealId: snap.id,
        dealName: snap.name,
        company: snap.company,
        suggestion: `Competitive battlecard for ${snap.company}`,
        type: 'battlecard',
        reason: 'Competitor mentions detected in deal risks',
      })
      if (suggestedCollateral.length >= 5) break
    }

    // Deal in discovery with no summary → talk track
    if (snap.stage === 'discovery' && !snap.summary) {
      suggestedCollateral.push({
        dealId: snap.id,
        dealName: snap.name,
        company: snap.company,
        suggestion: 'Discovery call talk track',
        type: 'talk_track',
        reason: 'Deal is in discovery stage with no summary yet — a structured talk track can guide the conversation',
      })
      if (suggestedCollateral.length >= 5) break
    }
  }

  // Stale deals → re-engagement email sequence
  for (const s of staleDeals) {
    if (suggestedCollateral.length >= 5) break
    suggestedCollateral.push({
      dealId: s.dealId,
      dealName: s.dealName,
      company: s.company,
      suggestion: `Re-engagement email sequence for ${s.company}`,
      type: 'email_sequence',
      reason: `Deal has had no update in ${s.daysSinceUpdate} days — a re-engagement sequence can restart the conversation`,
    })
  }

  // Pattern-based suggestions (across multiple deals)
  for (const pattern of keyPatterns) {
    if (suggestedCollateral.length >= 5) break
    if (pattern.label === 'budget concerns' && pattern.dealIds.length >= 2) {
      suggestedCollateral.push({
        dealId: pattern.dealIds[0],
        dealName: pattern.dealNames?.[0] ?? 'Multiple deals',
        company: pattern.companies?.[0] ?? 'Multiple',
        suggestion: 'Cost-benefit analysis template',
        type: 'custom',
        reason: `Budget concerns detected across ${pattern.dealIds.length} deals (${pattern.companies.slice(0, 3).join(', ')})`,
      })
    }
    if (suggestedCollateral.length >= 5) break
    if (pattern.label === 'competitor pressure' && pattern.dealIds.length >= 2) {
      suggestedCollateral.push({
        dealId: pattern.dealIds[0],
        dealName: pattern.dealNames?.[0] ?? 'Multiple deals',
        company: pattern.companies?.[0] ?? 'Multiple',
        suggestion: 'Competitive positioning guide',
        type: 'custom',
        reason: `Competitor pressure detected across ${pattern.dealIds.length} deals (${pattern.companies.slice(0, 3).join(', ')})`,
      })
    }
  }

  // Trim to max 5
  suggestedCollateral.splice(5)

  // ── Proactive: pipeline recommendations ──────────────────────────────────
  const pipelineRecommendations: WorkspaceBrain['pipelineRecommendations'] = []

  // Map risk keywords to specific mitigation actions
  const riskMitigations: { keywords: string[]; action: string; prompt: string }[] = [
    { keywords: ['budget', 'cost', 'price', 'expensive', 'roi', 'finance'], action: 'Address budget concern', prompt: 'Request a ROI/business-case meeting to quantify the cost of inaction' },
    { keywords: ['procurement', 'legal', 'compliance', 'security', 'gdpr', 'contract'], action: 'Unblock procurement', prompt: 'Proactively send a vendor security pack and DPA to cut legal review time' },
    { keywords: ['unresponsive', 'ghosted', 'no reply', 'gone quiet', 'disengaged'], action: 'Re-engage stakeholder', prompt: 'Try a different contact or a pattern-interrupt message to get a response' },
    { keywords: ['competitor', 'evaluating', 'shortlist', 'other vendors', 'rfp'], action: 'Strengthen competitive position', prompt: 'Request the evaluation criteria and build a direct comparison that highlights your differentiators' },
    { keywords: ['decision', 'approver', 'stakeholder', 'champion', 'sponsor', 'sign-off'], action: 'Expand stakeholder map', prompt: 'Identify the economic buyer and book a separate meeting to secure executive sponsorship' },
    { keywords: ['timeline', 'delayed', 'postponed', 'on hold', 'not urgent', 'priority'], action: 'Create urgency', prompt: 'Tie the deal timeline to a specific business date or cost-of-delay calculation to rebuild urgency' },
  ]

  for (const snap of snapshots) {
    if (snap.stage === 'closed_won' || snap.stage === 'closed_lost') continue
    if (pipelineRecommendations.length >= 6) break
    const sig = snap.signalSummary

    // 1. Deteriorating engagement — highest priority, very specific
    if (sig?.isDeteriorating && ['proposal', 'negotiation', 'discovery'].includes(snap.stage)) {
      const topRisk = snap.risks[0]
      pipelineRecommendations.push({
        dealId: snap.id, dealName: snap.name, company: snap.company,
        recommendation: topRisk
          ? `Engagement declining at ${snap.company}. Top risk: "${topRisk}". Act before this goes cold.`
          : `Engagement declining at ${snap.company}. Meeting notes suggest cooling sentiment — re-engage now.`,
        priority: 'high', action: 'Address declining engagement', actionType: 'follow_up',
      })
      continue
    }

    // 2. No champion / weak stakeholder depth at late stage
    if (sig && sig.championStrength < 0.25 && sig.stakeholderDepth < 0.3 && ['proposal', 'negotiation'].includes(snap.stage)) {
      pipelineRecommendations.push({
        dealId: snap.id, dealName: snap.name, company: snap.company,
        recommendation: `No clear internal champion at ${snap.company} in ${snap.stage} stage. Single point of contact is a deal risk — expand your stakeholder map.`,
        priority: 'high', action: 'Develop a champion', actionType: 'meeting',
      })
      continue
    }

    // 3. Specific risk mitigation — map risks to concrete next actions
    if (snap.risks.length >= 1) {
      const riskText = snap.risks.join(' ').toLowerCase()
      const matched = riskMitigations.find(m => m.keywords.some(kw => riskText.includes(kw)))
      if (matched) {
        pipelineRecommendations.push({
          dealId: snap.id, dealName: snap.name, company: snap.company,
          recommendation: `${snap.company} (${snap.stage}): ${matched.prompt}`,
          priority: ['proposal', 'negotiation'].includes(snap.stage) ? 'high' : 'medium',
          action: matched.action, actionType: 'custom',
        })
        continue
      }
    }

    // 4. No next step defined at an active stage
    if (sig && !sig.nextStepDefined && ['qualification', 'discovery', 'proposal'].includes(snap.stage)) {
      pipelineRecommendations.push({
        dealId: snap.id, dealName: snap.name, company: snap.company,
        recommendation: `No next step defined for ${snap.company}. Deals without a booked follow-up go cold 3× faster — confirm the next meeting now.`,
        priority: 'medium', action: 'Book next step', actionType: 'meeting',
      })
      continue
    }

    // 5. Decelerating momentum at a late stage
    if (sig?.velocity === 'decelerating' && ['proposal', 'negotiation'].includes(snap.stage)) {
      pipelineRecommendations.push({
        dealId: snap.id, dealName: snap.name, company: snap.company,
        recommendation: `${snap.company} deal velocity is slowing in ${snap.stage} stage. Consider escalating to a decision-maker or introducing new value to reset momentum.`,
        priority: 'medium', action: 'Reset deal momentum', actionType: 'follow_up',
      })
      continue
    }

    // 6. Fresh deal with no analysis yet
    if (snap.stage === 'prospecting' && snap.daysSinceUpdate >= 7 && snap.conversionScore == null) {
      pipelineRecommendations.push({
        dealId: snap.id, dealName: snap.name, company: snap.company,
        recommendation: `${snap.company} has had no notes or analysis in ${snap.daysSinceUpdate} days. Add meeting notes to get a qualification score and AI-powered next steps.`,
        priority: 'medium', action: 'Add meeting notes', actionType: 'meeting',
      })
      continue
    }

    // 7. Pending to-dos blocking progress
    if (snap.pendingTodos.length >= 3) {
      const topTodo = snap.pendingTodos[0]
      pipelineRecommendations.push({
        dealId: snap.id, dealName: snap.name, company: snap.company,
        recommendation: `${snap.pendingTodos.length} open actions for ${snap.company}, including: "${topTodo}". Complete these to keep the deal moving.`,
        priority: snap.pendingTodos.length >= 5 ? 'high' : 'medium', action: 'Complete open actions', actionType: 'follow_up',
      })
    }
  }

  // ── Compounding intelligence: Win/Loss analysis from closed deal history ────
  const wonDeals  = deals.filter(d => d.stage === 'closed_won'  || d.outcome === 'won')
  const lostDeals = deals.filter(d => d.stage === 'closed_lost' || d.outcome === 'lost')
  const totalClosed = wonDeals.length + lostDeals.length

  let winLossIntel: WorkspaceBrain['winLossIntel'] | undefined
  if (totalClosed >= 1) {
    const winCount  = wonDeals.length
    const lossCount = lostDeals.length
    const winRate   = totalClosed > 0 ? Math.round((winCount / totalClosed) * 100) : 0

    // Average annualised value of won deals (consistent with dashboard KPIs)
    function annualiseWon(value: number, dealType: string | null, recurringInterval: string | null): number {
      if (!value) return 0
      if (dealType !== 'recurring') return value
      if (recurringInterval === 'monthly') return value * 12
      if (recurringInterval === 'quarterly') return value * 4
      return value
    }
    const wonWithVal = wonDeals.filter(d => d.dealValue != null && d.dealValue > 0)
    const avgWonValue = wonWithVal.length > 0
      ? Math.round(wonWithVal.reduce((s, d) => s + annualiseWon(d.dealValue ?? 0, d.dealType ?? null, d.recurringInterval ?? null), 0) / wonWithVal.length)
      : 0

    // Average deal cycle: createdAt → wonDate
    const wonWithDates = wonDeals.filter(d => d.wonDate && d.createdAt)
    const avgDaysToClose = wonWithDates.length > 0
      ? Math.round(wonWithDates.reduce((s, d) => {
          const ms = new Date(d.wonDate as Date).getTime() - new Date(d.createdAt).getTime()
          return s + ms / 86_400_000
        }, 0) / wonWithDates.length)
      : 0

    // Top loss reasons from lostReason field
    const reasonFreq = new Map<string, number>()
    for (const d of lostDeals) {
      const r = (d.lostReason ?? '').trim()
      if (r) reasonFreq.set(r, (reasonFreq.get(r) ?? 0) + 1)
    }
    const topLossReasons = [...reasonFreq.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([r]) => r)

    // Competitor win/loss record
    const compStats = new Map<string, { wins: number; losses: number }>()
    for (const d of wonDeals) {
      for (const c of (d.dealCompetitors as string[]) ?? []) {
        if (!c) continue
        const k = c.toLowerCase()
        const s = compStats.get(k) ?? { wins: 0, losses: 0 }
        s.wins++; compStats.set(k, s)
      }
    }
    for (const d of lostDeals) {
      for (const c of (d.dealCompetitors as string[]) ?? []) {
        if (!c) continue
        const k = c.toLowerCase()
        const s = compStats.get(k) ?? { wins: 0, losses: 0 }
        s.losses++; compStats.set(k, s)
      }
    }
    const competitorRecord = [...compStats.entries()]
      .filter(([, s]) => s.wins + s.losses >= 1)
      .map(([name, s]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        wins: s.wins, losses: s.losses,
        winRate: Math.round((s.wins / (s.wins + s.losses)) * 100),
      }))
      .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
      .slice(0, 6)

    // Score calibration: were AI scores predictive?
    const wonWithScore  = wonDeals.filter(d => d.conversionScore != null)
    const lostWithScore = lostDeals.filter(d => d.conversionScore != null)
    const avgScoreOnWins   = wonWithScore.length > 0
      ? Math.round(wonWithScore.reduce((s, d) => s + (d.conversionScore ?? 0), 0) / wonWithScore.length)
      : null
    const avgScoreOnLosses = lostWithScore.length > 0
      ? Math.round(lostWithScore.reduce((s, d) => s + (d.conversionScore ?? 0), 0) / lostWithScore.length)
      : null
    // High-score (70%+) win rate: among closed deals with score ≥ 70, what % were won?
    const highScoreDeals = [...wonDeals, ...lostDeals].filter(d => (d.conversionScore ?? 0) >= 70)
    const highScoreWinRate = highScoreDeals.length >= 2
      ? Math.round((highScoreDeals.filter(d => d.stage === 'closed_won').length / highScoreDeals.length) * 100)
      : null

    winLossIntel = {
      winCount, lossCount, winRate, avgWonValue, avgDaysToClose,
      topLossReasons, competitorRecord,
      scoreCalibration: { avgScoreOnWins, avgScoreOnLosses, highScoreWinRate },
    }
  }

  // ── Deal Velocity: probability-adjusted forecast from active pipeline ────────
  // Annualise recurring values so forecast is on the same scale as pipeline KPIs
  function annualiseVal(value: number, dealType: string | null, recurringInterval: string | null): number {
    if (!value) return 0
    if (dealType !== 'recurring') return value
    if (recurringInterval === 'monthly') return value * 12
    if (recurringInterval === 'quarterly') return value * 4
    return value
  }
  const forecastDeals = activeDeals.filter(d => d.dealValue && d.dealValue > 0 && d.conversionScore != null)
  const weightedForecast = Math.round(
    forecastDeals.reduce((s, d) => s + (annualiseVal(d.dealValue!, d.dealType ?? null, d.recurringInterval ?? null) * (d.conversionScore! / 100)), 0)
  )
  const dealVelocity: WorkspaceBrain['dealVelocity'] = {
    weightedForecast,
    forecastDealCount: forecastDeals.length,
    avgDaysToClose: winLossIntel?.avgDaysToClose ?? 0,
  }

  // ── Win Playbook ──────────────────────────────────────────────────────────────
  // Requires ≥10 closed won deals to surface reliable patterns.
  // wonDeals is already declared above (deals filtered to closed_won stage)
  let winPlaybook: WorkspaceBrain['winPlaybook'] = undefined
  if (wonDeals.length >= 10) {
    // 1. Fastest-close pattern — bottom quartile by days to close
    const daysToClose = wonDeals
      .map(d => {
        const created = d.createdAt ? new Date(d.createdAt).getTime() : null
        const updated = d.updatedAt ? new Date(d.updatedAt).getTime() : null
        return created && updated ? Math.round((updated - created) / 86_400_000) : null
      })
      .filter((d): d is number => d !== null && d > 0)
      .sort((a, b) => a - b)

    const fastThreshold = daysToClose.length > 0
      ? daysToClose[Math.floor(daysToClose.length * 0.25)]
      : null

    const fastestClosePattern = fastThreshold != null ? {
      avgDaysToClose: Math.round(daysToClose.slice(0, Math.ceil(daysToClose.length * 0.25)).reduce((s, v) => s + v, 0) / Math.max(1, Math.ceil(daysToClose.length * 0.25))),
      sampleSize: Math.ceil(daysToClose.length * 0.25),
      commonSignals: ['budget confirmed early', 'champion identified', 'next meeting booked'],
      threshold: fastThreshold,
    } : null

    // 2. Champion pattern — deals with vs without a champion (intentSignals.championStatus)
    const wonWithChampion = wonDeals.filter(d => {
      const is = d.intentSignals as any
      return is?.championStatus === 'confirmed' || is?.championStatus === 'suspected'
    })
    const allWithChampion = closedDeals.filter(d => {
      const is = d.intentSignals as any
      return is?.championStatus === 'confirmed' || is?.championStatus === 'suspected'
    })
    const allNoChampion = closedDeals.filter(d => {
      const is = d.intentSignals as any
      return !is?.championStatus || is.championStatus === 'none'
    })
    const wonNoChampion = allNoChampion.filter(d => d.stage === 'closed_won')

    const championPattern = allWithChampion.length >= 3 || allNoChampion.length >= 3 ? {
      winRateWithChampion: allWithChampion.length >= 3 ? Math.round((wonWithChampion.length / allWithChampion.length) * 100) / 100 : null,
      winRateNoChampion: allNoChampion.length >= 3 ? Math.round((wonNoChampion.length / allNoChampion.length) * 100) / 100 : null,
      championLift: allWithChampion.length >= 3 && allNoChampion.length >= 3
        ? Math.round(((wonWithChampion.length / allWithChampion.length) - (wonNoChampion.length / allNoChampion.length)) * 100) / 100
        : null,
      sampleSize: closedDeals.length,
    } : null

    // 3. Per-competitor win conditions — from objectionConditionalWins if available
    const perCompetitorWinCondition: NonNullable<WorkspaceBrain['winPlaybook']>['perCompetitorWinCondition'] = []
    const compWinMap = new Map<string, { wins: number; total: number }>()
    for (const d of closedDeals) {
      const comps = (d.dealCompetitors as string[]) ?? []
      for (const comp of comps) {
        const entry = compWinMap.get(comp) ?? { wins: 0, total: 0 }
        entry.total++
        if (d.stage === 'closed_won') entry.wins++
        compWinMap.set(comp, entry)
      }
    }
    for (const [competitor, { wins, total }] of compWinMap.entries()) {
      if (total >= 3) {
        perCompetitorWinCondition.push({
          competitor,
          winRate: Math.round((wins / total) * 100),
          winCondition: wins / total >= 0.5 ? 'Lead with integration depth and customer evidence' : 'Requires strong champion and POC results to overcome',
          sampleSize: total,
        })
      }
    }

    // 4. Objection win patterns — from existing objectionConditionalWins
    const topObjectionWinPatterns = (objectionConditionalWins ?? [])
      .filter(o => o.stageBreakdown.some(s => s.winRateWithChampion != null && s.winRateWithChampion >= 0.6))
      .slice(0, 5)
      .map(o => ({
        theme: o.theme,
        winsWithTheme: o.dealsWithTheme,
        winRateWithTheme: Math.round(o.stageBreakdown.reduce((s, b) => s + (b.winRateWithChampion ?? 0), 0) / Math.max(1, o.stageBreakdown.filter(b => b.winRateWithChampion != null).length) * 100),
        howBeaten: 'Assign a champion and run a structured POC',
      }))

    winPlaybook = {
      fastestClosePattern,
      topObjectionWinPatterns,
      championPattern,
      perCompetitorWinCondition,
    }
  }

  // ── ML engine — fetch global prior then train on closed deal history ─────────
  let mlModel: WorkspaceBrain['mlModel']                   = undefined
  let mlPredictions: WorkspaceBrain['mlPredictions']       = undefined
  let mlTrends: WorkspaceBrain['mlTrends']                 = undefined
  let dealArchetypes: WorkspaceBrain['dealArchetypes']     = undefined
  let stageVelocityIntel: WorkspaceBrain['stageVelocityIntel'] = undefined
  let competitivePatterns: WorkspaceBrain['competitivePatterns'] = undefined
  let calibrationTimeline: WorkspaceBrain['calibrationTimeline'] = undefined
  let closeDateModel: WorkspaceBrain['closeDateModel']     = undefined
  let globalPriorMeta: WorkspaceBrain['globalPrior']       = undefined

  // Fetch global prior in parallel — non-blocking, fails gracefully
  const globalPrior = await getActiveGlobalModel().catch(() => null)

  // Augment objectionWinMap with per-theme global benchmark win rates
  if (globalPrior && globalPrior.riskThemeWinRates.length === 7) {
    const themeOrder = [
      'budget concerns',
      'slow responses / disengagement',
      'competitor pressure',
      'unclear decision-maker',
      'timeline slippage',
      'procurement / legal blockers',
      'internal competing priorities',
    ]
    for (const entry of objectionWinMap) {
      const idx = themeOrder.indexOf(entry.theme)
      if (idx !== -1) {
        entry.globalWinRate = Math.round(globalPrior.riskThemeWinRates[idx] * 100)
      }
    }
  }

  // Build ML inputs using pre-extracted text signals — no LLM dependency.
  // All 4 NLP features are pre-computed from the signalMap built above.
  // Always built (needed for contribution extraction and cold-start predictions).
  const mlInputs = deals.map(d => {
    const sig = signalMap.get(d.id)
    return {
      id:               d.id,
      company:          d.prospectCompany,
      // Normalise stage so ML engine sees closed_won/closed_lost regardless of which
      // field was set — some deals use outcome='won'/'lost' without updating stage.
      stage:            d.outcome === 'won' ? 'closed_won' : d.outcome === 'lost' ? 'closed_lost' : d.stage,
      dealValue:        d.dealValue,
      dealRisks:        (d.dealRisks as string[]) ?? [],
      dealCompetitors:  (d.dealCompetitors as string[]) ?? [],
      todos:            (d.todos as { done: boolean }[]) ?? [],
      createdAt:        d.createdAt,
      updatedAt:        d.updatedAt,
      wonDate:          d.wonDate,
      lostDate:         d.lostDate,
      repId:            d.userId as string | null,   // rep identity as ML feature dimension
      textEngagement:   sig?.textEngagement,
      momentumScore:    sig?.momentumScore,
      stakeholderDepth: sig?.stakeholderDepth,
      urgencyScore:     sig?.urgencyScore,
      championStrength: sig?.championStrength,
    }
  })

  if ((wonDeals.length + lostDeals.length) >= ML_MIN_TRAINING_DEALS || globalPrior) {
    // ── ML model cache: skip retraining if closed-deal set is unchanged ────
    const closedDeals = mlInputs.filter(d => d.stage === 'closed_won' || d.stage === 'closed_lost')
    const closedHash  = computeClosedDealHash(closedDeals.map(d => d.id))
    const cached      = await loadCachedModel(workspaceId, 'win_probability', closedHash)

    const mlResult = runMLEngine(mlInputs, now, globalPrior, cached, workspaceId)

    // If we trained a fresh model (cache miss), persist weights for next rebuild
    if (!cached && mlResult.model) {
      saveCachedModel(workspaceId, 'win_probability', mlResult.model, closedHash).catch(err =>
        console.error('[brain] saveCachedModel failed (non-fatal):', err)
      )
    }
    if (mlResult.model) {
      mlModel              = mlResult.model
      mlTrends             = mlResult.trends ?? undefined
      dealArchetypes       = mlResult.archetypes.length > 0 ? mlResult.archetypes : undefined
      stageVelocityIntel   = mlResult.stageVelocity ?? undefined
      competitivePatterns  = mlResult.competitivePatterns.length > 0 ? mlResult.competitivePatterns : undefined
      calibrationTimeline  = mlResult.calibrationTimeline.length > 0 ? mlResult.calibrationTimeline : undefined
      closeDateModel       = mlResult.closeDateModel ?? undefined

      // Embed composite scores into predictions — deterministic ML+text-signal blend
      // The momentumScore from text signals is passed as the 4th argument.
      mlPredictions = mlResult.predictions.map(pred => {
        const snap = snapshots.find(s => s.id === pred.dealId)
        if (snap?.conversionScore != null) {
          const dealSignals = signalMap.get(pred.dealId)
          const { composite } = computeCompositeScore(
            snap.conversionScore,
            pred.winProbability,
            mlResult.model!.trainingSize,
            dealSignals?.momentumScore,
          )
          return { ...pred, compositeScore: composite }
        }
        return pred
      })

      // Backfill predictedDaysToClose into snapshot signalSummaries
      for (const pred of mlPredictions) {
        const snap = snapshots.find(s => s.id === pred.dealId)
        if (snap?.signalSummary && pred.predictedDaysToClose != null) {
          snap.signalSummary.predictedCloseDays = pred.predictedDaysToClose
        }
      }

      // Capture global prior metadata for the brain (displayed in UI as "based on X industry deals")
      if (globalPrior && mlResult.model?.usingGlobalPrior !== false) {
        const alpha = mlResult.model?.globalPriorAlpha ?? 0
        globalPriorMeta = {
          trainingSize:      globalPrior.trainingSize,
          globalWinRate:     Math.round(globalPrior.globalWinRate * 100),
          stageVelocityP50:  Math.round(globalPrior.stageVelocityP50),
          stageVelocityP75:  Math.round(globalPrior.stageVelocityP75),
          usingPrior:        alpha > 0,
          localWeight:       Math.round((1 - alpha) * 100),
          riskThemeWinRates: globalPrior.riskThemeWinRates.map(r => Math.round(r * 100)),
        }
      }

      // ── Augment stageVelocityIntel with stage_transitions data ────────────────
      // Replace deal.createdAt-based age with actual days-in-current-stage from transitions.
      // This gives accurate stall detection per-stage, not just overall deal age.
      if (stageVelocityIntel && (stageTransitionRows as any[]).length > 0) {
        const transitionMap = new Map<string, Date>()
        for (const row of stageTransitionRows as any[]) {
          if (row.deal_id && row.transitioned_at) {
            transitionMap.set(row.deal_id, new Date(row.transitioned_at))
          }
        }
        // Re-compute stageAlerts using actual days-in-current-stage
        const p75 = stageVelocityIntel.p75DaysToClose
        const updatedAlerts = stageVelocityIntel.stageAlerts.map(alert => {
          const transitionedAt = transitionMap.get(alert.dealId)
          if (!transitionedAt) return alert
          const actualDaysInStage = (now.getTime() - transitionedAt.getTime()) / 86_400_000
          return {
            ...alert,
            currentAgeDays: Math.round(actualDaysInStage),
            severity: (actualDaysInStage > p75 * 1.5 ? 'critical' : 'warning') as 'critical' | 'warning',
          }
        })
        // Add any open deals with transitions that weren't in alerts (stalling in early stages)
        const alertedIds = new Set(updatedAlerts.map(a => a.dealId))
        for (const [dealId, transitionedAt] of transitionMap.entries()) {
          if (alertedIds.has(dealId)) continue
          const deal = activeDeals.find(d => d.id === dealId)
          if (!deal) continue
          const actualDaysInStage = (now.getTime() - transitionedAt.getTime()) / 86_400_000
          if (actualDaysInStage > p75) {
            updatedAlerts.push({
              dealId,
              company: deal.prospectCompany,
              currentAgeDays: Math.round(actualDaysInStage),
              expectedMaxDays: p75,
              stage: deal.stage,
              severity: (actualDaysInStage > p75 * 1.5 ? 'critical' : 'warning') as 'critical' | 'warning',
            })
          }
        }
        stageVelocityIntel = { ...stageVelocityIntel, stageAlerts: updatedAlerts }
      }
    }
  }

  // ── Follow-up cadence intelligence ────────────────────────────────────────────
  // Compute per-stage "safe gap" from won deals — how long they went between notes and still won
  function localQuantile(sorted: number[], q: number): number {
    if (sorted.length === 0) return 0
    const idx = q * (sorted.length - 1)
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    return (sorted[lo] ?? 0) + ((sorted[hi] ?? sorted[lo] ?? 0) - (sorted[lo] ?? 0)) * (idx - lo)
  }

  const stageGapBuckets = new Map<string, number[]>()
  for (const d of deals.filter(d => d.stage === 'closed_won')) {
    const notes = d.meetingNotes as string | null
    if (!notes) continue
    const dates = parseMeetingEntries(notes)
      .map(e => e.date)
      .filter((dt): dt is Date => dt !== null && !isNaN(dt.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())
    if (dates.length < 2) continue
    let maxGap = 0
    for (let i = 1; i < dates.length; i++) {
      const gap = (dates[i].getTime() - dates[i - 1].getTime()) / 86_400_000
      if (gap > maxGap) maxGap = gap
    }
    if (maxGap <= 0 || maxGap > 90) continue // ignore outliers
    const arr = stageGapBuckets.get(d.stage) ?? []
    arr.push(maxGap)
    stageGapBuckets.set(d.stage, arr)
  }

  const followUpStageStats: FollowUpCadenceIntel['stageStats'] = [...stageGapBuckets.entries()].map(([stage, gaps]) => {
    const sorted = [...gaps].sort((a, b) => a - b)
    return {
      stage,
      p50GapDays: Math.round(localQuantile(sorted, 0.5)),
      p75GapDays: Math.round(localQuantile(sorted, 0.75)),
      sampleSize: sorted.length,
    }
  })

  const followUpAlerts: FollowUpCadenceIntel['followUpAlerts'] = []
  for (const d of activeDeals) {
    const sig = signalMap.get(d.id)
    if (!sig || sig.daysSinceLastNote < 1) continue
    const daysSince = sig.daysSinceLastNote
    const stageStat = followUpStageStats.find(s => s.stage === d.stage)
    const p75 = stageStat?.p75GapDays ?? 14  // fallback to global stale threshold
    if (daysSince < p75 * 0.6) continue      // still within safe zone
    const urgency: 'nudge' | 'alert' | 'critical' =
      daysSince > p75 * 1.5 ? 'critical' :
      daysSince > p75       ? 'alert'    : 'nudge'
    followUpAlerts.push({
      dealId: d.id, dealName: d.dealName, company: d.prospectCompany, stage: d.stage,
      daysSinceLastNote: Math.round(daysSince), typicalMaxGapDays: p75, urgency,
      daysOverdue: Math.max(0, Math.round(daysSince - p75)),
    })
  }

  const followUpIntel: FollowUpCadenceIntel = {
    stageStats:      followUpStageStats,
    followUpAlerts:  followUpAlerts.sort((a, b) => b.daysSinceLastNote - a.daysSinceLastNote).slice(0, 10),
  }

  // ── Deal churn survival model ──────────────────────────────────────────────
  // Discrete-time survival model: P(deal goes silent within 14 days) per open deal.
  // Uses per-stage p75 note gap from won deals as the "safe window" baseline.
  // Formula: sigmoid(2.5 × (daysSince/p75 − 0.8)) + risk/nextStep adjustments.
  // Requires stageGapBuckets to have ≥1 stage with data (otherwise uses 14d global fallback).
  // Merges churnRisk into mlPredictions entries so it surfaces in the deal detail ML panel.
  for (const d of activeDeals) {
    const sig = signalMap.get(d.id)
    if (!sig) continue
    const daysSince = sig.daysSinceLastNote
    const stageStat = followUpStageStats.find(s => s.stage === d.stage)
    const p75 = stageStat?.p75GapDays ?? 14   // fallback to global stale threshold

    // gap_ratio: 0 = just contacted, 1 = at danger threshold, 2 = well past threshold
    const gapRatio  = daysSince / Math.max(p75, 1)
    // Base logit: sigmoid(2.5 × (gap_ratio − 0.8)):
    //   gap_ratio 0.0 → ~12%,  0.8 → 50%,  1.2 → ~73%,  1.5 → ~85%,  2.0 → ~95%
    const baseLogit = 2.5 * (gapRatio - 0.8)
    const riskCount = ((d.dealRisks as string[]) ?? []).length
    const logit     = baseLogit + (riskCount >= 3 ? 0.7 : 0) - (sig.nextStepDefined ? 0.7 : 0)
    const churnProb = 1 / (1 + Math.exp(-logit))
    const churnRisk = Math.min(95, Math.max(5, Math.round(churnProb * 100)))
    const daysOverdue = Math.max(0, Math.round(daysSince - p75))

    // Merge into mlPrediction for this deal (set after ML engine runs)
    if (mlPredictions) {
      const pred = mlPredictions.find(p => p.dealId === d.id)
      if (pred) {
        pred.churnRisk = churnRisk
        pred.churnDaysOverdue = daysOverdue
      }
    }
  }

  // ── Rep intelligence — per-rep behavioural stats correlated with outcomes ────
  const repDealMap = new Map<string, typeof deals>()
  for (const d of deals) {
    const uid = d.userId as string | null
    if (!uid) continue
    const arr = repDealMap.get(uid) ?? []
    arr.push(d)
    repDealMap.set(uid, arr)
  }

  const repIntel: RepIntelStats[] = []
  for (const [userId, repDealList] of repDealMap.entries()) {
    const closed = repDealList.filter(d => d.stage === 'closed_won' || d.stage === 'closed_lost')
    const won    = repDealList.filter(d => d.stage === 'closed_won')
    const winRate = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : 0

    const todoRates = repDealList
      .map(d => { const t = (d.todos as { done: boolean }[]) ?? []; return t.length > 0 ? t.filter(x => x.done).length / t.length : null })
      .filter((r): r is number => r !== null)
    // Fix: multiply by 100 then round to get integer % (was dividing by 100 yielding 0–1 range)
    const avgTodoCompletionRate = todoRates.length > 0
      ? Math.round((todoRates.reduce((a, b) => a + b, 0) / todoRates.length) * 100) : 0

    // Fix: use open deals only for next-step coverage and avg days since note
    const openRepDeals = repDealList.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    const openSigs = openRepDeals.map(d => signalMap.get(d.id)).filter(Boolean) as TextSignals[]
    const nextStepCount = openSigs.filter(s => s.nextStepDefined).length
    const dealsWithNextStepPct = openSigs.length > 0 ? Math.round((nextStepCount / openSigs.length) * 100) : 0
    const daysArr = openSigs.map(s => s.daysSinceLastNote).filter(d => d < 365)
    const avgDaysSinceLastNote = daysArr.length > 0
      ? Math.round(daysArr.reduce((a, b) => a + b, 0) / daysArr.length) : 0

    repIntel.push({
      userId, totalDeals: repDealList.length, wonDeals: won.length, closedDeals: closed.length, winRate,
      avgTodoCompletionRate, dealsWithNextStepPct, avgDaysSinceLastNote,
    })
  }

  // ── Deterioration alerts — active deals with declining note sentiment ────────
  const deteriorationAlerts: DeteriorationAlert[] = []
  for (const d of activeDeals) {
    const notes = d.meetingNotes as string | null
    const det = analyzeDeterioration(notes)
    if (det.isDeteriorating && det.warning) {
      deteriorationAlerts.push({
        dealId:         d.id,
        dealName:       d.dealName,
        company:        d.prospectCompany,
        earlySentiment: det.earlySentiment,
        recentSentiment:det.recentSentiment,
        delta:          det.delta,
        warning:        det.warning,
      })
      // Also update the snapshot's signalSummary
      const snap = snapshots.find(s => s.id === d.id)
      if (snap?.signalSummary) snap.signalSummary.isDeteriorating = true
    }
  }

  // ── Score trend analysis — compute per-deal trend + surface significant changes ──
  const scoreTrendAlerts: ScoreTrendAlert[] = []
  const TREND_WINDOW_DAYS = 14
  const TREND_THRESHOLD = 8  // minimum score change to flag as meaningful
  for (const snap of snapshots) {
    if (snap.stage === 'closed_won' || snap.stage === 'closed_lost') continue
    const history = snap.scoreHistory
    if (!history || history.length < 2) {
      snap.scoreTrend = snap.conversionScore != null ? 'new' : undefined
      snap.scoreVelocity = 0
      continue
    }
    // Find the score ~TREND_WINDOW_DAYS ago (or earliest available)
    const todayStr = now.toISOString().slice(0, 10)
    const windowStart = new Date(now.getTime() - TREND_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
    // Find the earliest point within or before the window
    let priorPoint: ScoreHistoryPoint | null = null
    for (const pt of history) {
      if (pt.date <= windowStart) priorPoint = pt
      else if (!priorPoint && pt.date < todayStr) priorPoint = pt
    }
    const currentPoint = history[history.length - 1]
    if (!priorPoint || priorPoint === currentPoint) {
      snap.scoreTrend = 'stable'
      snap.scoreVelocity = 0
      continue
    }
    const delta = currentPoint.score - priorPoint.score
    const daysBetween = Math.max(1, (new Date(currentPoint.date).getTime() - new Date(priorPoint.date).getTime()) / 86_400_000)
    snap.scoreVelocity = Math.round(delta)
    if (delta >= TREND_THRESHOLD) {
      snap.scoreTrend = 'improving'
    } else if (delta <= -TREND_THRESHOLD) {
      snap.scoreTrend = 'declining'
    } else {
      snap.scoreTrend = 'stable'
    }
    // Surface significant changes as alerts
    if (Math.abs(delta) >= TREND_THRESHOLD) {
      const trend = delta > 0 ? 'improving' : 'declining'
      scoreTrendAlerts.push({
        dealId: snap.id,
        dealName: snap.name,
        company: snap.company,
        trend,
        currentScore: currentPoint.score,
        priorScore: priorPoint.score,
        delta,
        periodDays: Math.round(daysBetween),
        message: trend === 'improving'
          ? `Score improved ${delta}pts (${priorPoint.score}% → ${currentPoint.score}%) over ${Math.round(daysBetween)}d`
          : `Score dropped ${Math.abs(delta)}pts (${priorPoint.score}% → ${currentPoint.score}%) over ${Math.round(daysBetween)}d`,
      })
    }
  }
  scoreTrendAlerts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  // ── Pipeline Health Index ─────────────────────────────────────────────────
  const lateStageCount = activeDeals.filter(d => ['proposal', 'negotiation'].includes(d.stage)).length
  const stageDepthPct  = activeDeals.length > 0 ? Math.round((lateStageCount / activeDeals.length) * 100) : 0

  const stallingCount  = stageVelocityIntel?.stageAlerts.length ?? 0
  const velocityHealthPct = activeDeals.length > 0
    ? Math.max(0, Math.round(((activeDeals.length - stallingCount) / activeDeals.length) * 100))
    : 100

  let conversionConfidencePct: number
  if (mlPredictions && mlPredictions.length > 0) {
    const avgProb = mlPredictions.reduce((s, p) => s + p.winProbability, 0) / mlPredictions.length
    conversionConfidencePct = Math.round(avgProb * 100)
  } else {
    conversionConfidencePct = avgConversionScore ?? 50
  }

  const momVals = activeDeals.map(d => signalMap.get(d.id)?.momentumScore ?? 0.5)
  const avgMomentumPct = momVals.length > 0
    ? Math.round((momVals.reduce((a, b) => a + b, 0) / momVals.length) * 100)
    : 50

  const phiScore = Math.round(
    stageDepthPct          * 0.25 +
    velocityHealthPct      * 0.30 +
    conversionConfidencePct* 0.30 +
    avgMomentumPct         * 0.15
  )
  const phiInterpretation: PipelineHealthIndex['interpretation'] =
    phiScore >= 80 ? 'Excellent' :
    phiScore >= 65 ? 'Strong'    :
    phiScore >= 50 ? 'Moderate'  :
    phiScore >= 35 ? 'Weak'      : 'Critical'

  let phiKeyInsight: string
  if (stallingCount >= Math.ceil(activeDeals.length / 2) && stallingCount > 0) {
    phiKeyInsight = `${stallingCount} of ${activeDeals.length} active deals are stalling past expected velocity`
  } else if (deteriorationAlerts.length >= 2) {
    phiKeyInsight = `${deteriorationAlerts.length} deals showing declining sentiment — review before they go cold`
  } else if (lateStageCount >= Math.ceil(activeDeals.length * 0.4) && lateStageCount > 0) {
    phiKeyInsight = `${lateStageCount} deals in late stages — strong near-term revenue opportunity`
  } else if (avgMomentumPct < 40) {
    phiKeyInsight = 'Deal momentum declining across the board — re-engagement needed'
  } else if (conversionConfidencePct > 65) {
    phiKeyInsight = 'ML model sees above-average win probability across the open pipeline'
  } else {
    phiKeyInsight = `${phiInterpretation} pipeline with ${activeDeals.length} active deals under management`
  }

  const pipelineHealthIndex: PipelineHealthIndex = {
    score:                phiScore,
    stageDepth:           stageDepthPct,
    velocityHealth:       velocityHealthPct,
    conversionConfidence: conversionConfidencePct,
    momentumScore:        avgMomentumPct,
    interpretation:       phiInterpretation,
    keyInsight:           phiKeyInsight,
  }

  // ── Revenue forecasts — probability-weighted by predicted close date ────────
  const revenueForecasts: RevenueForecast[] = (() => {
    if (!mlPredictions || mlPredictions.length === 0) return []
    const buckets = new Map<string, { expected: number; bestCase: number; count: number; probSum: number }>()
    for (const pred of mlPredictions) {
      if (pred.predictedDaysToClose == null) continue
      const deal = activeDeals.find(d => d.id === pred.dealId)
      if (!deal?.dealValue || deal.dealValue <= 0) continue
      const closeDate = new Date(now.getTime() + pred.predictedDaysToClose * 86_400_000)
      const monthKey  = `${closeDate.getFullYear()}-${String(closeDate.getMonth() + 1).padStart(2, '0')}`
      const b = buckets.get(monthKey) ?? { expected: 0, bestCase: 0, count: 0, probSum: 0 }
      b.expected += deal.dealValue * pred.winProbability
      b.bestCase += deal.dealValue
      b.count++
      b.probSum  += pred.winProbability
      buckets.set(monthKey, b)
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 6)
      .map(([month, b]) => ({
        month,
        expectedRevenue: Math.round(b.expected),
        bestCase:        Math.round(b.bestCase),
        dealCount:       b.count,
        avgConfidence:   Math.round((b.probSum / b.count) * 100),
      }))
  })()

  // ── Contextual suggested prompts for Ask AI ─────────────────────────────────
  const suggestedPrompts = _generateSuggestedPrompts({
    activeDeals,
    staleDeals,
    scoreAlerts,
    wonCount: wonDeals.length,
    lostCount: lostDeals.length,
    previousBrain,
    stageTransitionRows: stageTransitionRows as any[],
    now,
  })

  // Compute loopSummary from dealLinearLinks
  let loopSummary: WorkspaceBrain['loopSummary'] | undefined
  try {
    const { dealLinearLinks: dllTable } = await import('@/lib/db/schema')
    const allLinks = await db.select({
      status: dllTable.status,
      dealId: dllTable.dealId,
    }).from(dllTable).where(eq(dllTable.workspaceId, workspaceId))

    const activeStatuses = ['suggested', 'confirmed', 'in_cycle']
    const activeLinks = allLinks.filter(l => activeStatuses.includes(l.status ?? ''))
    const inCycleLinks = allLinks.filter(l => l.status === 'in_cycle')
    const shippedLinks = allLinks.filter(l => l.status === 'deployed')

    // Revenue at risk = sum of deal values where loops are pending/in_cycle
    const atRiskDealIds = new Set(activeLinks.map(l => l.dealId))
    const atRiskDeals = snapshots.filter(d => atRiskDealIds.has(d.id) && d.dealValue)
    const revenueAtRisk = atRiskDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)

    loopSummary = {
      activeLoops: activeLinks.length,
      waitingForPM: activeLinks.filter(l => l.status === 'confirmed').length,
      inCycle: inCycleLinks.length,
      shipped: shippedLinks.length,
      revenueAtRisk,
    }
  } catch (e) {
    console.error('[brain] loopSummary error', e)
  }

  // Generate dealActions via Claude Haiku for at-risk/stale deals
  let dealActions: WorkspaceBrain['dealActions'] | undefined
  try {
    const { anthropic: anthropicClient } = await import('@/lib/ai/client')

    const dealsForActions = [
      ...(urgentDeals ?? []).slice(0, 2).map(d => {
        const snap = snapshots.find(s => s.id === d.dealId)
        return { dealId: d.dealId, dealName: d.dealName, company: d.company, issue: d.reason, dealValue: snap?.dealValue ?? 0 }
      }),
      ...(staleDeals ?? []).slice(0, 3).map(d => {
        const snap = snapshots.find(s => s.id === d.dealId)
        return { dealId: d.dealId, dealName: d.dealName, company: d.company, issue: `No update in ${d.daysSinceUpdate}d`, dealValue: snap?.dealValue ?? 0 }
      }),
    ].slice(0, 5)

    if (dealsForActions.length > 0) {
      const dealContext = dealsForActions.map(d => {
        return `Deal: ${d.dealName} | Company: ${d.company} | Value: £${(d.dealValue ?? 0).toLocaleString()} | Issue: ${d.issue}`
      }).join('\n')

      const winPatterns = (objectionWinMap ?? []).slice(0, 3).map(p => `"${p.theme}" → ${Math.round(p.winRateWithTheme * 100)}% win rate`).join(', ') || 'No patterns yet'

      const resp = await anthropicClient.messages.create({
        model: 'gpt-5.4-mini',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `You are a sales coach. For each deal below, generate ONE specific action to take TODAY to move it forward. Be concrete and brief (max 15 words per action).

Win patterns from this pipeline: ${winPatterns}

Deals:
${dealContext}

Respond with JSON array: [{"dealId":"...","action":"...","reason":"...","urgency":"critical|high|medium","confidence":0.0-1.0}]
Only return the JSON array, nothing else.`
        }]
      })

      const text = resp.content[0].type === 'text' ? resp.content[0].text.trim() : '[]'
      const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '')) as Array<{
        dealId: string
        action: string
        reason: string
        urgency: 'critical' | 'high' | 'medium'
        confidence: number
      }>

      dealActions = parsed.map(a => {
        const snap = snapshots.find(s => s.id === a.dealId)
        return {
          dealId: a.dealId,
          dealName: snap?.name ?? a.dealId,
          dealValue: snap?.dealValue ?? 0,
          action: a.action,
          reason: a.reason,
          urgency: a.urgency,
          confidence: a.confidence,
        }
      })
    }
  } catch (e) {
    console.error('[brain] dealActions error', e)
  }

  // Generate daily briefing
  let dailyBriefing: string | undefined
  let dailyBriefingGeneratedAt: string | undefined
  try {
    const shouldRegenerate = !previousBrain?.dailyBriefingGeneratedAt ||
      (Date.now() - new Date(previousBrain.dailyBriefingGeneratedAt).getTime()) > 1 * 60 * 60 * 1000 // 1 hour

    if (shouldRegenerate && (dealActions?.length || staleDeals?.length)) {
      const { anthropic: anthropicClient } = await import('@/lib/ai/client')

      const topAction = dealActions?.[0]
      const loopStats = loopSummary
      const staleCount = staleDeals?.length ?? 0

      const context = [
        loopStats ? `Active loops: ${loopStats.activeLoops}, in cycle: ${loopStats.inCycle}, shipped: ${loopStats.shipped}` : '',
        topAction ? `Highest priority deal: ${topAction.dealName} — ${topAction.action}` : '',
        staleCount > 0 ? `${staleCount} deal(s) need follow-up` : '',
        activeDeals.length > 0 ? `${activeDeals.length} active deals worth £${(totalValue ?? 0).toLocaleString()}` : '',
      ].filter(Boolean).join('. ')

      const resp = await anthropicClient.messages.create({
        model: 'gpt-5.4-mini',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `You are a sales intelligence assistant. Write a 2-3 sentence daily briefing for a sales rep. Be specific, concise and motivating. Use the data below. Do NOT start with "Good morning" — start with the most important insight.

Data: ${context}

Write only the briefing text, no quotes, no preamble.`
        }]
      })

      dailyBriefing = resp.content[0].type === 'text' ? resp.content[0].text.trim() : undefined
      dailyBriefingGeneratedAt = new Date().toISOString()
    } else if (previousBrain?.dailyBriefing) {
      // Keep existing briefing
      dailyBriefing = previousBrain.dailyBriefing
      dailyBriefingGeneratedAt = previousBrain.dailyBriefingGeneratedAt
    }
  } catch (e) {
    console.error('[brain] dailyBriefing error', e)
  }

  const brain: WorkspaceBrain = {
    brainVersion: BRAIN_VERSION,
    updatedAt: now.toISOString(),
    deals: snapshots,
    pipeline: { totalActive: activeDeals.length, totalValue, avgConversionScore, stageBreakdown },
    topRisks,
    keyPatterns,
    urgentDeals,
    staleDeals,
    scoreAlerts,
    missingSignals,
    suggestedCollateral,
    pipelineRecommendations,
    winLossIntel,
    dealVelocity,
    mlModel,
    mlPredictions,
    mlTrends,
    dealArchetypes,
    stageVelocityIntel,
    competitivePatterns,
    calibrationTimeline,
    closeDateModel,
    pipelineHealthIndex: activeDeals.length > 0 ? pipelineHealthIndex : undefined,
    revenueForecasts:    revenueForecasts.length > 0 ? revenueForecasts : undefined,
    deteriorationAlerts: deteriorationAlerts.length > 0 ? deteriorationAlerts : undefined,
    scoreTrendAlerts:    scoreTrendAlerts.length > 0 ? scoreTrendAlerts : undefined,
    followUpIntel:          (followUpStageStats.length > 0 || followUpAlerts.length > 0) ? followUpIntel : undefined,
    repIntel:               repIntel.length > 0 ? repIntel : undefined,
    objectionWinMap:        objectionWinMap.length > 0 ? objectionWinMap : undefined,
    objectionConditionalWins: objectionConditionalWins.length > 0 ? objectionConditionalWins : undefined,
    productGapPriority:     productGapPriority.length > 0 ? productGapPriority : undefined,
    collateralEffectiveness: collateralEffectiveness.length > 0 ? collateralEffectiveness : undefined,
    globalPrior:            globalPriorMeta,
    winPlaybook,
    suggestedPrompts,
    extractionBackfillDone,
    loopSummary,
    dealActions,
    dailyBriefing,
    dailyBriefingGeneratedAt,
  }

  await db.execute(sql`
    UPDATE workspaces
    SET workspace_brain = ${JSON.stringify(brain)}::jsonb,
        focus_briefing_cache = NULL
    WHERE id = ${workspaceId}
  `)
  // Invalidate read cache so next getWorkspaceBrain call returns fresh data
  _invalidateBrainCache(workspaceId)

  // ── Refresh deal next_steps from latest meeting notes ──────────────────────
  // Prevents stale next_steps when meeting notes extraction fails or returns null
  try {
    for (const deal of activeDeals) {
      const notes = deal.meetingNotes as string | null
      if (!notes) continue
      // Extract the latest note section (after last --- separator)
      const sections = notes.split(/\n---\n/).filter(s => s.trim())
      if (sections.length === 0) continue
      const lastSection = sections[sections.length - 1].trim()
      if (!lastSection) continue
      // Check if latest note is newer than current next_steps by comparing content
      const currentNext = (deal.nextSteps ?? '') as string
      // Only update if the latest note contains information not in current next_steps
      // Simple heuristic: if current next_steps text appears nowhere in the latest note section, it's likely stale
      const latestLower = lastSection.toLowerCase()
      const currentLower = currentNext.toLowerCase()
      // Skip if next_steps already reflects latest note content
      if (currentNext && latestLower.includes(currentLower.slice(0, 50))) continue
      // Extract a concise next_steps from the latest note (take Actions line if present, else first 300 chars)
      const actionsMatch = lastSection.match(/Actions?:\s*([\s\S]+)/i)
      const freshNext = actionsMatch
        ? actionsMatch[1].trim().slice(0, 300)
        : lastSection.slice(0, 300)
      if (freshNext && freshNext !== currentNext) {
        await db.update(dealLogs).set({
          nextSteps: freshNext,
          updatedAt: new Date(),
        }).where(eq(dealLogs.id, deal.id))
      }
    }
  } catch (e) {
    console.error('[brain] deal next_steps refresh error', e)
  }

  // ── Rebuild log — record every rebuild for ML auditability ───────────────────
  try {
    const durationMs     = Date.now() - rebuildStartMs
    const closedTotal    = wonDeals.length + lostDeals.length
    const openScored     = activeDeals.filter(d => d.conversionScore != null).length
    const openScores     = activeDeals.map(d => d.conversionScore).filter((s): s is number => s != null)
    const avgScoreVal    = openScores.length > 0
      ? Math.round(openScores.reduce((a, b) => a + b, 0) / openScores.length * 10) / 10
      : null
    // Build models_trained / models_skipped for auditability
    const modelsTrained: string[] = []
    const modelsSkipped: { model: string; reason: string }[] = []
    if (mlModel)              modelsTrained.push('logistic_regression')
    else                      modelsSkipped.push({ model: 'logistic_regression', reason: `need ${ML_MIN_TRAINING_DEALS} closed deals, have ${closedTotal}` })
    if (dealArchetypes)       modelsTrained.push('kmeans_archetypes')
    else                      modelsSkipped.push({ model: 'kmeans_archetypes', reason: 'insufficient training data' })
    if (stageVelocityIntel)   modelsTrained.push('stage_velocity')
    else                      modelsSkipped.push({ model: 'stage_velocity', reason: 'need 3+ won deals' })
    if (competitivePatterns)  modelsTrained.push('competitive_patterns')
    else                      modelsSkipped.push({ model: 'competitive_patterns', reason: 'insufficient competitor data' })
    if (closeDateModel)       modelsTrained.push('ols_close_date')
    else                      modelsSkipped.push({ model: 'ols_close_date', reason: 'need 10+ won deals' })
    await db.execute(sql`
      INSERT INTO brain_rebuild_log
        (workspace_id, triggered_by, closed_deals_total, wins, losses,
         ml_active, model_accuracy_loo, open_deals_scored, avg_score, duration_ms,
         models_trained, models_skipped, tokens_used)
      VALUES
        (${workspaceId}, 'auto', ${closedTotal}, ${wonDeals.length}, ${lostDeals.length},
         ${mlModel != null}, ${mlModel?.looAccuracy ?? null}, ${openScored},
         ${avgScoreVal}, ${durationMs},
         ${JSON.stringify(modelsTrained)}, ${JSON.stringify(modelsSkipped)}, ${null})
    `)
  } catch { /* non-fatal — log failure must never block the brain rebuild */ }

  // ── Calibration history — upsert current month's ML discrimination data ────────
  // Stores monthly calibration persistently so the /models page can show a trend line
  // even if deals move between won/lost after the original close month.
  try {
    if (calibrationTimeline && calibrationTimeline.length > 0) {
      const currentMonth = now.toISOString().slice(0, 7) // 'YYYY-MM'
      // Aggregate all closed deals scored this month for a current-month upsert
      const closedForCal = [...wonDeals, ...lostDeals]
      const withScore = closedForCal.filter(d => d.conversionScore != null)
      if (withScore.length >= 2) {
        const wonWithScore  = withScore.filter(d => d.stage === 'closed_won' || d.outcome === 'won')
        const lostWithScore = withScore.filter(d => d.stage === 'closed_lost' || d.outcome === 'lost')
        const avgWon  = wonWithScore.length > 0
          ? wonWithScore.reduce((s, d) => s + (d.conversionScore ?? 0), 0) / wonWithScore.length
          : null
        const avgLost = lostWithScore.length > 0
          ? lostWithScore.reduce((s, d) => s + (d.conversionScore ?? 0), 0) / lostWithScore.length
          : null
        const separation = avgWon != null && avgLost != null ? avgWon - avgLost : null
        await db.execute(sql`
          INSERT INTO calibration_history
            (id, workspace_id, month, avg_score_won, avg_score_lost, separation, deal_count)
          VALUES
            (gen_random_uuid()::text, ${workspaceId}, ${currentMonth},
             ${avgWon}, ${avgLost}, ${separation}, ${withScore.length})
          ON CONFLICT (workspace_id, month) DO UPDATE SET
            avg_score_won  = EXCLUDED.avg_score_won,
            avg_score_lost = EXCLUDED.avg_score_lost,
            separation     = EXCLUDED.separation,
            deal_count     = EXCLUDED.deal_count
        `)
      }
    }
  } catch { /* non-fatal — calibration history is best-effort */ }

  // ── Post-save background tasks ────────────────────────────────────────────────
  // Run sequentially (not concurrently) to avoid opening multiple DB connections
  // simultaneously, which was exhausting the pgBouncer pool of 5 and causing
  // /api/deals and /api/brain to hang on every rebuild.
  // A 30-second hard timeout caps the total time spent on post-save work.
  await Promise.race([
    (async () => {
      // 1. Semantic embeddings — skips unchanged entities via content hashing
      try {
        const { embedWorkspaceEntities } = await import('@/lib/semantic-search')
        await embedWorkspaceEntities(workspaceId)
      } catch { /* non-fatal */ }

      // 2. Proactive collateral — 24-hour cooldown, returns in <50ms most runs
      try { await generateProactiveCollateral(workspaceId, brain) }
      catch { /* non-fatal */ }

      // 3. Global pool contribution — no-ops if workspace has no consent
      try {
        const hasConsent = await getGlobalConsent(workspaceId)
        if (hasConsent) {

          // Build closed deal contribution records using the pre-computed NLP signals
          const collateralByDeal = new Map<string, string[]>()
          for (const c of collateralRows) {
            if (!c.sourceDealLogId) continue
            const arr = collateralByDeal.get(c.sourceDealLogId) ?? []
            arr.push(c.type)
            collateralByDeal.set(c.sourceDealLogId, arr)
          }

          const closedForContribution = deals
            .filter(d => d.stage === 'closed_won' || d.stage === 'closed_lost')
            .map(d => {
              const sig = signalMap.get(d.id)
              const stageOrdinal: Record<string, number> = {
                prospecting: 0, qualification: 1, discovery: 2,
                proposal: 3, negotiation: 4, closed_won: 4, closed_lost: 4,
              }
              const fStage = (stageOrdinal[d.stage] ?? 0) / 4
              const allVals = deals.map(x => x.dealValue ?? 0).filter(v => v > 0)
              const maxVal  = allVals.length > 0 ? Math.max(...allVals) : 100_000
              const val     = Math.max(d.dealValue ?? 0, 1)
              const fValue  = maxVal > 1 ? Math.log(val + 1) / Math.log(maxVal + 1) : 0.5
              const ageMs   = d.createdAt ? (now.getTime() - new Date(d.createdAt).getTime()) : 0
              const fAge    = Math.min(ageMs / 86_400_000 / 180, 1)
              const fRisk   = Math.min(((d.dealRisks as string[]) ?? []).length / 5, 1)
              const fTodo   = (() => { const t = (d.todos as { done: boolean }[]) ?? []; return t.length > 0 ? t.filter(x => x.done).length / t.length : 0.5 })()
              // Intentionally 10 features — rep_win_rate excluded to prevent cross-workspace leakage
              const features = [
                fStage, fValue, fAge, fRisk,
                0.5, // competitor_win_rate: neutral default
                fTodo,
                sig?.textEngagement    ?? 0.5,
                sig?.momentumScore     ?? 0.5,
                sig?.stakeholderDepth  ?? 0.5,
                sig?.urgencyScore      ?? 0.5,
              ]
              return {
                stage:           d.stage,
                dealValue:       d.dealValue,
                dealRisks:       (d.dealRisks as string[]) ?? [],
                createdAt:       d.createdAt,
                wonDate:         d.wonDate,
                lostDate:        d.lostDate,
                collateralTypes: collateralByDeal.get(d.id) ?? [],
                features,
              }
            })

          const contributions = extractContributions(closedForContribution)
          await contributeToGlobalPool(workspaceId, contributions)
        }
      } catch {
        // Silently swallow — pool contribution must never block or error workspace operations
      }
    })(),
    // Hard cap: never hold the after() lifecycle open longer than 30 seconds
    new Promise<void>(resolve => setTimeout(resolve, 30_000)),
  ])

  const duration = Date.now() - rebuildStartMs
  console.log(`[brain] Rebuild complete for workspace ${workspaceId}: ${activeDeals.length} open deals, ${(wonDeals.length + lostDeals.length)} closed, ${duration}ms`)

  // Background embedding backfill — don't block the rebuild
  import('./embedding-backfill').then(({ backfillEmbeddings }) =>
    backfillEmbeddings(workspaceId).catch(err =>
      console.error('[brain] Embedding backfill failed:', err)
    )
  )

  return brain
}

/** Format the brain as a compact context string for LLM prompts. */
export function formatBrainContext(brain: WorkspaceBrain, stageLabels?: Record<string, string>): string {
  // Defensive: old DB snapshots may have missing/null fields — guard every access
  const lines: string[] = []
  const fmt = (v: number) => v >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${v}`
  const sl = (stageId: string) => stageLabels?.[stageId] ?? stageId

  const pipeline = brain.pipeline ?? { totalActive: 0, totalValue: 0, avgConversionScore: null, stageBreakdown: {} }
  const deals = brain.deals ?? []
  const urgentDeals = brain.urgentDeals ?? []
  const staleDeals = brain.staleDeals ?? []
  const topRisks = brain.topRisks ?? []
  const keyPatterns = brain.keyPatterns ?? []

  lines.push(`PIPELINE OVERVIEW (brain updated ${brain.updatedAt ? new Date(brain.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'unknown'})`)
  lines.push(`Active deals: ${pipeline.totalActive} | Total pipeline: ${fmt(pipeline.totalValue)} | Avg conversion: ${pipeline.avgConversionScore ?? 'N/A'}%`)

  if (deals.length > 0) {
    lines.push('\nDEALS:')
    for (const d of deals) {
      const isClosed = d.stage === 'closed_won' || d.stage === 'closed_lost'
      const scoreStr = d.conversionScore != null ? ` | ${d.conversionScore}%` : ''
      const valueStr = d.dealValue ? ` | ${fmt(d.dealValue)}` : ''
      const closeDateStr = d.closeDate ? ` | Close: ${new Date(d.closeDate).toLocaleDateString('en-GB')}` : ''
      lines.push(`• ${d.name} (${d.company}) — ${sl(d.stage)}${valueStr}${scoreStr}${closeDateStr}`)
      if (d.summary) lines.push(`  Summary: ${d.summary}`)
      if (!isClosed && (d.risks ?? []).length > 0) lines.push(`  Risks: ${d.risks.slice(0, 2).join(' | ')}`)
      if (!isClosed && (d.pendingTodos ?? []).length > 0) lines.push(`  Todos (${d.pendingTodos.length}): ${d.pendingTodos.slice(0, 3).join(' | ')}${d.pendingTodos.length > 3 ? ` +${d.pendingTodos.length - 3} more` : ''}`)
    }
  }

  if (urgentDeals.length > 0) {
    lines.push('\nURGENT — NEEDS ATTENTION:')
    for (const u of urgentDeals) {
      lines.push(`⚠️ ${u.dealName} (${u.company}): ${u.reason}`)
    }
  }

  if (staleDeals.length > 0) {
    lines.push('\nSTALE DEALS (no update 14+ days):')
    for (const s of staleDeals.slice(0, 4)) {
      lines.push(`• ${s.dealName} (${s.company}) — ${s.daysSinceUpdate} days since last update`)
    }
  }

  if (topRisks.length > 0) {
    lines.push(`\nTOP RISKS ACROSS PIPELINE:\n${topRisks.slice(0, 4).map(r => `• ${r}`).join('\n')}`)
  }

  if (keyPatterns.length > 0) {
    lines.push(`\nRECURRING PATTERNS:`)
    for (const raw of keyPatterns as unknown[]) {
      if (typeof raw === 'string') {
        // backward-compat: old DB snapshots store keyPatterns as string[]
        lines.push(`• ${raw}`)
      } else {
        const p = raw as { label: string; dealIds: string[]; companies: string[] }
        const companies = p.companies ?? []
        lines.push(`• ${p.label ?? 'unknown'}${companies.length > 0 ? ` — ${companies.slice(0, 3).join(', ')}${companies.length > 3 ? ` +${companies.length - 3} more` : ''}` : ''}`)
      }
    }
  }

  const suggestedCollateral = brain.suggestedCollateral ?? []
  if (suggestedCollateral.length > 0) {
    lines.push(`\nSUGGESTED COLLATERAL:`)
    for (const sc of suggestedCollateral) {
      lines.push(`• [${sc.type}] ${sc.suggestion} — for ${sc.dealName} (${sc.company})`)
      lines.push(`  Reason: ${sc.reason}`)
    }
  }

  const recs = brain.pipelineRecommendations ?? []
  if (recs.length > 0) {
    lines.push(`\nPIPELINE RECOMMENDATIONS:`)
    for (const r of recs) {
      lines.push(`• [${r.priority}] ${r.dealName} (${r.company}): ${r.recommendation}`)
    }
  }

  // Project plan summaries
  const plansWithProgress = (brain.deals ?? []).filter(d => d.projectPlanProgress)
  if (plansWithProgress.length > 0) {
    lines.push(`\nPROJECT PLANS:`)
    for (const d of plansWithProgress) {
      const p = d.projectPlanProgress!
      lines.push(`• ${d.name} (${d.company}): ${p.complete}/${p.total} tasks complete`)
    }
  }

  // Win/Loss intelligence — feeds historical context into AI responses
  const wl = brain.winLossIntel
  if (wl && (wl.winCount + wl.lossCount) >= 1) {
    lines.push(`\nHISTORICAL WIN/LOSS INTELLIGENCE:`)
    lines.push(`Win rate: ${wl.winRate}% (${wl.winCount} won / ${wl.lossCount} lost)`)
    if (wl.avgWonValue > 0) lines.push(`Avg won deal value: ${fmt(wl.avgWonValue)}`)
    if (wl.avgDaysToClose > 0) lines.push(`Avg days to close: ${wl.avgDaysToClose} days`)
    if (wl.scoreCalibration.avgScoreOnWins != null) lines.push(`AI score on won deals: avg ${wl.scoreCalibration.avgScoreOnWins}% | on lost deals: avg ${wl.scoreCalibration.avgScoreOnLosses ?? 'N/A'}%`)
    if (wl.scoreCalibration.highScoreWinRate != null) lines.push(`Deals scored 70%+: ${wl.scoreCalibration.highScoreWinRate}% actually won`)
    if (wl.topLossReasons.length > 0) lines.push(`Top loss reasons: ${wl.topLossReasons.slice(0, 3).join(' | ')}`)
    if (wl.competitorRecord.length > 0) {
      lines.push(`Competitor record: ${wl.competitorRecord.slice(0, 4).map(c => `${c.name} ${c.wins}W-${c.losses}L (${c.winRate}% win rate)`).join(' | ')}`)
    }
  }

  const dv = brain.dealVelocity
  if (dv && dv.weightedForecast > 0) {
    lines.push(`\nWEIGHTED FORECAST (probability-adjusted): ${fmt(dv.weightedForecast)} across ${dv.forecastDealCount} scored deals`)
  }

  // ML model insights
  const ml = brain.mlModel
  if (ml) {
    lines.push(`\nML MODEL (trained on ${ml.trainingSize} closed deals, ${Math.round(ml.looAccuracy * 100)}% LOO accuracy):`)
    const top = ml.featureImportance.slice(0, 3)
    lines.push(`Top win drivers: ${top.map(f => `${f.name} (${f.direction})`).join(' | ')}`)
  }
  const preds = brain.mlPredictions ?? []
  if (preds.length > 0) {
    lines.push(`\nML WIN PROBABILITIES (open deals):`)
    for (const p of preds) {
      const deal = (brain.deals ?? []).find(d => d.id === p.dealId)
      const name = deal ? `${deal.name} (${deal.company})` : p.dealId
      lines.push(`• ${name}: ${Math.round(p.winProbability * 100)}% win probability [${p.confidence} confidence]${p.riskFlags.length > 0 ? ` — ${p.riskFlags[0]}` : ''}`)
    }
  }
  const tr = brain.mlTrends
  if (tr) {
    if (tr.winRate.direction !== 'stable') {
      lines.push(`\nTREND: Win rate ${tr.winRate.direction} — ${tr.winRate.priorPct}% → ${tr.winRate.recentPct}% (${tr.winRate.slopePctPerMonth > 0 ? '+' : ''}${tr.winRate.slopePctPerMonth}pp/month)`)
    }
    if (tr.dealVelocity.direction !== 'stable') {
      lines.push(`TREND: Deals closing ${tr.dealVelocity.direction} — ${tr.dealVelocity.priorAvgDays}d → ${tr.dealVelocity.recentAvgDays}d avg`)
    }
    const threats = tr.competitorThreats.filter(c => c.direction === 'more_competitive')
    if (threats.length > 0) {
      lines.push(`COMPETITIVE THREAT: ${threats.map(c => `${c.name} win rate dropping ${c.allTimeWinRatePct}% → ${c.recentWinRatePct}%`).join(' | ')}`)
    }
  }

  // Deal archetypes — k-means segments
  const archetypes = brain.dealArchetypes ?? []
  if (archetypes.length > 0) {
    lines.push(`\nDEAL ARCHETYPES (k-means clusters):`)
    for (const a of archetypes) {
      lines.push(`• ${a.label}: ${a.dealCount} deals | ${a.winRate}% win rate | avg £${Math.round(a.avgDealValue / 1000)}k | ${a.winningCharacteristic}`)
      if (a.openDealIds.length > 0) {
        const names = a.openDealIds.slice(0, 3).map(id => {
          const d = (brain.deals ?? []).find(x => x.id === id)
          return d ? d.name : id
        })
        lines.push(`  Open deals in archetype: ${names.join(', ')}${a.openDealIds.length > 3 ? ` +${a.openDealIds.length - 3} more` : ''}`)
      }
    }
  }

  // Stage velocity stall alerts
  const sv = brain.stageVelocityIntel
  if (sv && sv.stageAlerts.length > 0) {
    lines.push(`\nSTAGE VELOCITY ALERTS (stalled vs historical ${sv.medianDaysToClose}d median):`)
    for (const alert of sv.stageAlerts.slice(0, 4)) {
      lines.push(`• [${alert.severity.toUpperCase()}] ${alert.company} in ${alert.stage}: ${alert.currentAgeDays}d (expected max ${alert.expectedMaxDays}d)`)
    }
  }

  // Per-competitor ML patterns
  const compPats = brain.competitivePatterns ?? []
  if (compPats.length > 0) {
    lines.push(`\nCOMPETITIVE INTELLIGENCE (per-competitor ML patterns):`)
    for (const cp of compPats.slice(0, 4)) {
      lines.push(`• vs ${cp.competitor}: ${cp.winRate}% win rate over ${cp.totalDeals} deals | win when: ${cp.topWinCondition} | lose when: ${cp.topLossRisk}`)
    }
  }

  // Score calibration (latest month)
  const cal = brain.calibrationTimeline ?? []
  if (cal.length > 0) {
    const latest = cal[cal.length - 1]
    if (latest.discrimination > 0) {
      lines.push(`\nML CALIBRATION (${latest.month}): discrimination +${Math.round(latest.discrimination)}pp (${Math.round(latest.avgMlOnWins)}% on wins vs ${Math.round(latest.avgMlOnLoss)}% on losses — model is predictive)`)
    } else {
      lines.push(`\nML CALIBRATION (${latest.month}): discrimination ${Math.round(latest.discrimination)}pp — model needs more data`)
    }
  }

  // Pipeline Health Index
  const phi = brain.pipelineHealthIndex
  if (phi) {
    lines.push(`\nPIPELINE HEALTH INDEX: ${phi.score}/100 (${phi.interpretation})`)
    lines.push(`Stage depth: ${phi.stageDepth}% | Velocity health: ${phi.velocityHealth}% | ML confidence: ${phi.conversionConfidence}% | Momentum: ${phi.momentumScore}%`)
    lines.push(`Insight: ${phi.keyInsight}`)
  }

  // Deterioration alerts
  const detAlerts = brain.deteriorationAlerts ?? []
  if (detAlerts.length > 0) {
    lines.push(`\nDETERIORATION ALERTS (declining note sentiment):`)
    for (const d of detAlerts.slice(0, 4)) {
      lines.push(`⚠ ${d.dealName} (${d.company}): ${d.warning}`)
    }
  }

  // Score trend alerts
  const scoreTrends = brain.scoreTrendAlerts ?? []
  if (scoreTrends.length > 0) {
    lines.push(`\nSCORE TREND ALERTS (significant score changes over time):`)
    for (const t of scoreTrends.slice(0, 6)) {
      const arrow = t.trend === 'improving' ? '↑' : '↓'
      lines.push(`${arrow} ${t.dealName} (${t.company}): ${t.message}`)
    }
  }

  // Per-deal score trends summary (for deals with history)
  const dealsWithTrend = (brain.deals ?? []).filter(d =>
    d.scoreTrend && d.scoreTrend !== 'new' && d.scoreTrend !== 'stable' &&
    d.stage !== 'closed_won' && d.stage !== 'closed_lost'
  )
  if (dealsWithTrend.length > 0 && scoreTrends.length === 0) {
    lines.push(`\nDEAL SCORE TRENDS:`)
    for (const d of dealsWithTrend.slice(0, 6)) {
      const arrow = d.scoreTrend === 'improving' ? '↑' : '↓'
      lines.push(`${arrow} ${d.name} (${d.company}): ${d.scoreTrend} (${d.scoreVelocity != null && d.scoreVelocity > 0 ? '+' : ''}${d.scoreVelocity ?? 0}pts)`)
    }
  }

  // Revenue forecast
  const rfx = brain.revenueForecasts ?? []
  if (rfx.length > 0) {
    lines.push(`\nML REVENUE FORECAST (probability-weighted by predicted close date):`)
    for (const r of rfx) {
      lines.push(`• ${r.month}: ${fmt(r.expectedRevenue)} expected / ${fmt(r.bestCase)} best-case (${r.dealCount} deal${r.dealCount === 1 ? '' : 's'}, ${r.avgConfidence}% avg confidence)`)
    }
  }

  // Close date model
  const cdm = brain.closeDateModel
  if (cdm) {
    lines.push(`\nCLOSE DATE MODEL: trained on ${cdm.trainingSize} won deals | avg close time ${cdm.meanDaysToClose} days | ±${cdm.rmse} day RMSE`)
  }

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Proactive Collateral Auto-Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * After a brain rebuild, check for high-priority collateral suggestions and
 * auto-generate the top 1–2 if the workspace has enough grounding knowledge.
 *
 * Runs as a fire-and-forget background task — never blocks the rebuild.
 * Skips generation if:
 * - No company profile exists (content would be generic/useless)
 * - A similar collateral piece already exists for the same deal
 * - The suggestion lacks grounding data (e.g. battlecard without competitor intel)
 */
export async function generateProactiveCollateral(
  workspaceId: string,
  brain: WorkspaceBrain,
): Promise<void> {
  const { generateFreeformCollateral } = await import('@/lib/ai/generate')
  const { companyProfiles } = await import('@/lib/db/schema')

  const suggestions = brain.suggestedCollateral ?? []
  if (suggestions.length === 0) return

  // 0. Cooldown — only generate proactive collateral once per 24 hours per workspace
  const recentProactive = await db
    .select({ id: collateralTable.id })
    .from(collateralTable)
    .where(
      and(
        eq(collateralTable.workspaceId, workspaceId),
        eq(collateralTable.generationSource, 'proactive_brain'),
        sql`${collateralTable.createdAt} > NOW() - INTERVAL '24 hours'`,
      )
    )
    .limit(1)
  if (recentProactive.length > 0) return

  // 1. Check company profile exists — needed for grounded content
  const [profile] = await db
    .select({ id: companyProfiles.id })
    .from(companyProfiles)
    .where(eq(companyProfiles.workspaceId, workspaceId))
    .limit(1)
  if (!profile) return

  // 2. Load existing collateral to de-duplicate
  const existingCollateral = await db
    .select({
      title: collateralTable.title,
      type: collateralTable.type,
      sourceDealLogId: collateralTable.sourceDealLogId,
      generationSource: collateralTable.generationSource,
      customTypeName: collateralTable.customTypeName,
    })
    .from(collateralTable)
    .where(eq(collateralTable.workspaceId, workspaceId))

  // Build a set of "dealId:type" keys for fast dedup
  const existingKeys = new Set(
    existingCollateral.map(c => `${c.sourceDealLogId ?? ''}:${c.type}:${(c.customTypeName ?? c.title).toLowerCase()}`)
  )

  // 3. Check grounding knowledge availability
  const hasCompetitorIntel = (brain.competitivePatterns ?? []).length > 0
    || (brain.winLossIntel?.competitorRecord ?? []).length > 0
  const hasWinPlaybook = !!brain.winPlaybook
  const hasWinLossData = (brain.winLossIntel?.winCount ?? 0) + (brain.winLossIntel?.lossCount ?? 0) >= 3

  // 4. Filter and prioritise suggestions
  const viable: typeof suggestions = []
  for (const s of suggestions) {
    if (viable.length >= 2) break

    // Skip if similar collateral already exists for this deal
    const key = `${s.dealId}:custom:${s.suggestion.toLowerCase()}`
    const titleKey = `${s.dealId}:${s.type === 'custom' ? 'custom' : s.type}:${s.suggestion.toLowerCase()}`
    if (existingKeys.has(key) || existingKeys.has(titleKey)) continue

    // Also check fuzzy match on title
    const hasSimilar = existingCollateral.some(c =>
      c.sourceDealLogId === s.dealId &&
      (c.customTypeName ?? c.title).toLowerCase().includes(s.suggestion.toLowerCase().slice(0, 20))
    )
    if (hasSimilar) continue

    // Check grounding requirements by type
    if (s.type === 'battlecard' && !hasCompetitorIntel) continue
    if (s.type === 'objection_handler' && !hasWinLossData && !hasWinPlaybook) continue

    viable.push(s)
  }

  if (viable.length === 0) return

  // 5. Generate top 1–2 collateral pieces
  for (const suggestion of viable) {
    try {
      // Build deal context for grounding
      const dealSnap = (brain.deals ?? []).find(d => d.id === suggestion.dealId)
      let dealContext: string | undefined
      if (dealSnap) {
        const lines = [
          `Deal: ${dealSnap.name} with ${dealSnap.company}`,
          `Stage: ${dealSnap.stage}`,
        ]
        if (dealSnap.dealValue) lines.push(`Value: £${dealSnap.dealValue.toLocaleString()}`)
        if (dealSnap.summary) lines.push(`Summary: ${dealSnap.summary}`)
        if (dealSnap.risks.length > 0) lines.push(`Risks: ${dealSnap.risks.join('; ')}`)
        if (dealSnap.pendingTodos.length > 0) lines.push(`Pending actions: ${dealSnap.pendingTodos.slice(0, 5).join('; ')}`)
        dealContext = lines.join('\n')
      }

      const generated = await generateFreeformCollateral({
        workspaceId,
        title: suggestion.suggestion,
        description: `${suggestion.reason}. Generate actionable, specific content grounded in workspace intelligence and deal data.`,
        dealContext,
        customPrompt: buildProactiveCustomPrompt(suggestion, brain),
      })

      // Save to collateral table
      await db
        .insert(collateralTable)
        .values({
          workspaceId,
          userId: null, // system-generated, no user
          type: 'custom',
          title: generated.title,
          status: 'ready',
          content: generated.content,
          rawResponse: generated.rawResponse,
          generatedAt: new Date(),
          customTypeName: suggestion.suggestion,
          generationSource: 'proactive_brain',
          sourceDealLogId: suggestion.dealId,
        })

      console.log(`[proactive] Generated collateral: "${generated.title}" for deal ${suggestion.dealName}`)
    } catch (err) {
      // Non-fatal — log and continue to next suggestion
      console.error(`[proactive] Failed to generate "${suggestion.suggestion}":`, err)
    }
  }
}

/** Build type-specific additional instructions for proactive generation. */
function buildProactiveCustomPrompt(
  suggestion: WorkspaceBrain['suggestedCollateral'][number],
  brain: WorkspaceBrain,
): string {
  const parts: string[] = []

  if (suggestion.type === 'objection_handler') {
    parts.push('Focus on specific objections identified in the deal risks.')
    parts.push('Include: the objection, why it surfaces, reframing language, proof points, and a suggested response script.')
    // Inject win playbook data if available
    const wp = brain.winPlaybook
    if (wp) {
      if (wp.topObjectionWinPatterns.length > 0) {
        const factors = wp.topObjectionWinPatterns.map(p => p.howBeaten).filter(Boolean)
        if (factors.length > 0) parts.push(`Key win factors to leverage: ${factors.join(', ')}`)
      }
      if (wp.fastestClosePattern) parts.push(`Typical close timeline: ${wp.fastestClosePattern.avgDaysToClose} days`)
    }
    const objWins = brain.objectionWinMap ?? []
    if (objWins.length > 0) {
      parts.push('Historical objection outcomes:')
      for (const o of objWins.slice(0, 3)) {
        parts.push(`- "${o.theme}": ${o.winRateWithTheme}% win rate when encountered (${o.dealsWithTheme} deals)`)
      }
    }
  }

  if (suggestion.type === 'battlecard') {
    parts.push('Structure as a competitive battlecard: positioning, strengths vs weaknesses, counter-objections, win themes.')
    const compPats = brain.competitivePatterns ?? []
    if (compPats.length > 0) {
      parts.push('Competitive intelligence from ML analysis:')
      for (const cp of compPats.slice(0, 3)) {
        parts.push(`- vs ${cp.competitor}: ${cp.winRate}% win rate | Win when: ${cp.topWinCondition} | Lose when: ${cp.topLossRisk}`)
      }
    }
    const compRecord = brain.winLossIntel?.competitorRecord ?? []
    if (compRecord.length > 0) {
      parts.push('Historical competitor record:')
      for (const c of compRecord.slice(0, 3)) {
        parts.push(`- ${c.name}: ${c.wins}W-${c.losses}L (${c.winRate}% win rate)`)
      }
    }
  }

  if (suggestion.type === 'email_sequence') {
    parts.push('Create a 3-email re-engagement sequence with clear subject lines, personalised opening, value hook, and CTA.')
    parts.push('Emails should be spaced 3-5 days apart, escalating in urgency but not desperation.')
  }

  if (suggestion.type === 'talk_track') {
    parts.push('Structure as a discovery call guide: opening, qualifying questions, pain point exploration, value demonstration, next steps.')
    const wp = brain.winPlaybook
    if (wp?.topObjectionWinPatterns.length) {
      const factors = wp.topObjectionWinPatterns.map(p => p.theme).filter(Boolean)
      if (factors.length > 0) parts.push(`Discovery should explore these themes: ${factors.join(', ')}`)
    }
  }

  if (suggestion.type === 'custom') {
    parts.push('This is a cross-deal strategic document. Make it actionable and specific to the patterns detected.')
    if (suggestion.reason.includes('budget')) {
      parts.push('Focus on ROI quantification, cost-benefit framing, and business case structure.')
    }
    if (suggestion.reason.includes('competitor')) {
      parts.push('Focus on competitive positioning, differentiation, and win strategies.')
    }
  }

  return parts.join('\n')
}
