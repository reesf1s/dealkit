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
import { db } from '@/lib/db'
import { dealLogs, competitors as competitorRecords, productGaps as productGapsTable, collateral as collateralTable } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { runMLEngine, computeCompositeScore, type TrainedMLModel, type DealMLPrediction, type MLTrends, type DealArchetype, type StageVelocityIntel, type CompetitivePattern, type ScoreCalibrationPoint, type CloseDateModel, ML_MIN_TRAINING_DEALS } from '@/lib/deal-ml'
import { extractTextSignals, analyzeDeterioration, parseMeetingEntries, type TextSignals } from '@/lib/text-signals'
import { BRAIN_VERSION } from '@/lib/brain-constants'
export { BRAIN_VERSION } from '@/lib/brain-constants'
import { getActiveGlobalModel, getGlobalConsent, extractContributions, contributeToGlobalPool } from '@/lib/global-pool'

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
  }[]
  staleDeals: {                 // open deals with no activity for 14+ days
    dealId: string
    dealName: string
    company: string
    daysSinceUpdate: number
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

export interface DeteriorationAlert {
  dealId:         string
  dealName:       string
  company:        string
  earlySentiment: number    // 0–1
  recentSentiment:number    // 0–1
  delta:          number    // recent − early (negative = deteriorating)
  warning:        string
}

let schemaMigrated = false
async function ensureBrainColumn() {
  if (schemaMigrated) return
  try {
    await db.execute(sql`
      ALTER TABLE workspaces
      ADD COLUMN IF NOT EXISTS workspace_brain jsonb,
      ADD COLUMN IF NOT EXISTS pipeline_config jsonb
    `)
  } catch { /* already exists */ }
  try {
    await db.execute(sql`
      ALTER TABLE deal_logs
      ADD COLUMN IF NOT EXISTS project_plan jsonb,
      ADD COLUMN IF NOT EXISTS intent_signals jsonb
    `)
  } catch { /* already exists */ }
  schemaMigrated = true
}

/** Read the brain. Returns null if not yet built. */
export async function getWorkspaceBrain(workspaceId: string): Promise<WorkspaceBrain | null> {
  await ensureBrainColumn()
  const rows = await db.execute<{ workspace_brain: WorkspaceBrain | null }>(
    sql`SELECT workspace_brain FROM workspaces WHERE id = ${workspaceId} LIMIT 1`
  )
  return rows[0]?.workspace_brain ?? null
}

/** Rebuild and persist the brain from current deal state. Call in background after any deal mutation. */
export async function rebuildWorkspaceBrain(workspaceId: string): Promise<WorkspaceBrain> {
  await ensureBrainColumn()

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
      updatedAt: dealLogs.updatedAt,
      closeDate: dealLogs.closeDate,
      projectPlan: dealLogs.projectPlan,
      // Historical intelligence fields
      createdAt: dealLogs.createdAt,
      wonDate: dealLogs.wonDate,
      lostDate: dealLogs.lostDate,
      lostReason: dealLogs.lostReason,
      meetingNotes: dealLogs.meetingNotes,
    })
    .from(dealLogs)
    .where(eq(dealLogs.workspaceId, workspaceId))

  // ── Tier 2: parallel fetch of product gaps + collateral ───────────────────
  const [gaps, collateralRows] = await Promise.all([
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
  ])

  const now = new Date()
  const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

  // ── Extract text signals for ALL deals upfront (used for ML features and signal summaries) ──
  const signalMap = new Map<string, TextSignals>()
  for (const d of deals) {
    signalMap.set(d.id, extractTextSignals(
      d.meetingNotes as string | null,
      d.createdAt,
      d.updatedAt,
    ))
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
      conversionScore: d.conversionScore,
      dealValue: d.dealValue,
      risks: (d.dealRisks as string[]) ?? [],
      pendingTodos: pending.slice(0, 8),
      summary: d.aiSummary,
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
      signalSummary: sig ? {
        momentum:          sig.momentumScore,
        riskLevel:         sig.objectionCount >= 4 ? 'high' : sig.objectionCount >= 2 ? 'medium' : 'low',
        isDeteriorating:   false,   // filled in deterioration pass below
        predictedCloseDays: null,   // filled in after ML runs
        velocity:          sig.engagementVelocity,
        stakeholderDepth:  sig.stakeholderDepth,
        nextStepDefined:   sig.nextStepDefined,
        championStrength:  sig.championStrength,
      } : undefined,
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
      }
    })
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)

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
  const closedDeals = deals.filter(d => d.stage === 'closed_won' || d.stage === 'closed_lost')
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
      const newNames = allCompetitorNames.filter(n => !existingNames.has(n.toLowerCase()))
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

  for (const snap of snapshots) {
    if (snap.stage === 'closed_won' || snap.stage === 'closed_lost') continue
    if (pipelineRecommendations.length >= 6) break

    // Deal in prospecting for 7+ days with no score → suggest qualification
    if (snap.stage === 'prospecting' && snap.daysSinceUpdate >= 7 && snap.conversionScore == null) {
      pipelineRecommendations.push({
        dealId: snap.id, dealName: snap.name, company: snap.company,
        recommendation: 'No analysis yet — paste meeting notes to qualify this deal',
        priority: 'medium', action: 'Analyze meeting notes', actionType: 'meeting',
      })
      continue
    }

    // High-scoring deal still in early stage → suggest advancing
    if (snap.conversionScore != null && snap.conversionScore >= 70 && ['prospecting', 'qualification', 'discovery'].includes(snap.stage)) {
      const nextStage = snap.stage === 'prospecting' ? 'qualification' : snap.stage === 'qualification' ? 'discovery' : 'proposal'
      pipelineRecommendations.push({
        dealId: snap.id, dealName: snap.name, company: snap.company,
        recommendation: `High conversion score (${snap.conversionScore}%) — consider advancing to ${nextStage.replace('_', ' ')}`,
        priority: 'high', action: `Move to ${nextStage.replace('_', ' ')}`, actionType: 'stage_change',
      })
      continue
    }

    // Deal in proposal/negotiation with risks but no objection handler → suggest collateral
    if (['proposal', 'negotiation'].includes(snap.stage) && snap.risks.length >= 2) {
      pipelineRecommendations.push({
        dealId: snap.id, dealName: snap.name, company: snap.company,
        recommendation: `${snap.risks.length} risks identified — generate an objection handler to prepare`,
        priority: 'high', action: 'Generate objection handler', actionType: 'collateral',
      })
      continue
    }

    // Deal with incomplete project plan tasks overdue
    if (snap.projectPlanProgress && snap.projectPlanProgress.complete < snap.projectPlanProgress.total) {
      const remaining = snap.projectPlanProgress.total - snap.projectPlanProgress.complete
      pipelineRecommendations.push({
        dealId: snap.id, dealName: snap.name, company: snap.company,
        recommendation: `${remaining} project plan task${remaining > 1 ? 's' : ''} still pending`,
        priority: remaining > 3 ? 'high' : 'medium', action: 'Review project plan', actionType: 'custom',
      })
      continue
    }

    // Deal with many pending todos → suggest follow-up
    if (snap.pendingTodos.length >= 4) {
      pipelineRecommendations.push({
        dealId: snap.id, dealName: snap.name, company: snap.company,
        recommendation: `${snap.pendingTodos.length} pending to-dos — review and prioritise`,
        priority: 'medium', action: 'Review to-dos', actionType: 'follow_up',
      })
    }
  }

  // ── Compounding intelligence: Win/Loss analysis from closed deal history ────
  const wonDeals  = deals.filter(d => d.stage === 'closed_won')
  const lostDeals = deals.filter(d => d.stage === 'closed_lost')
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
      const comps = (d.competitors as string[]) ?? []
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
      stage:            d.stage,
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
    }
  })

  if ((wonDeals.length + lostDeals.length) >= ML_MIN_TRAINING_DEALS || globalPrior) {
    const mlResult = runMLEngine(mlInputs, now, globalPrior)
    if (mlResult.model) {
      mlModel              = mlResult.model
      mlTrends             = mlResult.trends ?? undefined
      dealArchetypes       = mlResult.archetypes.length > 0 ? mlResult.archetypes : undefined
      stageVelocityIntel   = mlResult.stageVelocity ?? undefined
      competitivePatterns  = mlResult.competitivePatterns.length > 0 ? mlResult.competitivePatterns : undefined
      calibrationTimeline  = mlResult.calibrationTimeline.length > 0 ? mlResult.calibrationTimeline : undefined
      closeDateModel       = mlResult.closeDateModel ?? undefined

      // Embed composite scores into predictions — blends LLM+ML so stored conversionScore reflects both
      mlPredictions = mlResult.predictions.map(pred => {
        const snap = snapshots.find(s => s.id === pred.dealId)
        if (snap?.conversionScore != null) {
          const { composite } = computeCompositeScore(snap.conversionScore, pred.winProbability, mlResult.model!.trainingSize)
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

  const brain: WorkspaceBrain = {
    brainVersion: BRAIN_VERSION,
    updatedAt: now.toISOString(),
    deals: snapshots,
    pipeline: { totalActive: activeDeals.length, totalValue, avgConversionScore, stageBreakdown },
    topRisks,
    keyPatterns,
    urgentDeals,
    staleDeals,
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
    followUpIntel:          (followUpStageStats.length > 0 || followUpAlerts.length > 0) ? followUpIntel : undefined,
    repIntel:               repIntel.length > 0 ? repIntel : undefined,
    objectionWinMap:        objectionWinMap.length > 0 ? objectionWinMap : undefined,
    objectionConditionalWins: objectionConditionalWins.length > 0 ? objectionConditionalWins : undefined,
    productGapPriority:     productGapPriority.length > 0 ? productGapPriority : undefined,
    collateralEffectiveness: collateralEffectiveness.length > 0 ? collateralEffectiveness : undefined,
    globalPrior:            globalPriorMeta,
    winPlaybook,
  }

  await db.execute(sql`
    UPDATE workspaces
    SET workspace_brain = ${JSON.stringify(brain)}::jsonb
    WHERE id = ${workspaceId}
  `)

  // ── Global pool contribution — fire-and-forget after brain is saved ───────────
  // Non-blocking: never fails the rebuild. Only runs if workspace has consent.
  void (async () => {
    try {
      const hasConsent = await getGlobalConsent(workspaceId)
      if (!hasConsent) return

      // Build closed deal contribution records using the pre-computed mlInputs feature vectors
      // We need to re-run extractFeatures to get the per-deal feature vectors.
      // Use the collateral types already fetched earlier in the rebuild.
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
          // Re-derive feature vector — same logic as extractFeatures in deal-ml.ts
          // but we use the pre-computed NLP features from signalMap
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
          // Intentionally 10 features (excludes rep_win_rate at index 10).
          // rep_win_rate is workspace-specific and must never cross workspace boundaries.
          // Global pool trains on 10-feature vectors; Bayesian blend pads to 11 locally.
          const features = [
            fStage, fValue, fAge, fRisk,
            0.5,   // competitor_win_rate: use neutral default (avoid cross-workspace leakage)
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
    } catch {
      // Silently swallow — pool contribution must never block or error workspace operations
    }
  })()

  return brain
}

/** Format the brain as a compact context string for LLM prompts. */
export function formatBrainContext(brain: WorkspaceBrain): string {
  // Defensive: old DB snapshots may have missing/null fields — guard every access
  const lines: string[] = []
  const fmt = (v: number) => v >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${v}`

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
      lines.push(`• ${d.name} (${d.company}) — ${d.stage}${valueStr}${scoreStr}${closeDateStr}`)
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
