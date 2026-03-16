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
import { dealLogs, competitors as competitorRecords } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

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
}

export interface WorkspaceBrain {
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
      ADD COLUMN IF NOT EXISTS project_plan jsonb
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
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      stage: dealLogs.stage,
      dealValue: dealLogs.dealValue,
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
    })
    .from(dealLogs)
    .where(eq(dealLogs.workspaceId, workspaceId))

  const now = new Date()
  const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

  const snapshots: DealSnapshot[] = deals.map(d => {
    const allTodos = (d.todos as { text: string; done: boolean }[]) ?? []
    const pending = allTodos.filter(t => !t.done).map(t => t.text)
    const updatedMs = d.updatedAt ? new Date(d.updatedAt).getTime() : now.getTime()
    const daysSince = Math.floor((now.getTime() - updatedMs) / 86_400_000)
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

    // Average value of won deals
    const wonWithVal = wonDeals.filter(d => d.dealValue != null && d.dealValue > 0)
    const avgWonValue = wonWithVal.length > 0
      ? Math.round(wonWithVal.reduce((s, d) => s + (d.dealValue ?? 0), 0) / wonWithVal.length)
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
  const forecastDeals = activeDeals.filter(d => d.dealValue && d.dealValue > 0 && d.conversionScore != null)
  const weightedForecast = Math.round(
    forecastDeals.reduce((s, d) => s + (d.dealValue! * (d.conversionScore! / 100)), 0)
  )
  const dealVelocity: WorkspaceBrain['dealVelocity'] = {
    weightedForecast,
    forecastDealCount: forecastDeals.length,
    avgDaysToClose: winLossIntel?.avgDaysToClose ?? 0,
  }

  const brain: WorkspaceBrain = {
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
  }

  await db.execute(sql`
    UPDATE workspaces
    SET workspace_brain = ${JSON.stringify(brain)}::jsonb
    WHERE id = ${workspaceId}
  `)

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

  return lines.join('\n')
}
