/**
 * computeUrgencyScore — deal urgency scoring for the Today tab.
 *
 * Returns a 0-100 urgency score (higher = more attention needed),
 * human-readable reasons, and a single recommended top action.
 *
 * Factors (no LLM — pure rules + data):
 *  - staleness:          days since last update (>7 days = escalating penalty)
 *  - velocity decline:   score dropping over last 3 history points
 *  - close date:         end date within 60 days
 *  - missing fields:     no contact, no value, no close date
 *  - risk signals:       budget freeze, champion change, competitor keywords in notes
 *  - base risk:          inverted conversionScore × dealValue × log(staleness+1)
 */

export interface UrgencyResult {
  score: number          // 0-100, higher = more urgent
  reasons: string[]      // human-readable flags
  topAction: string      // single most important action
}

interface ScorePoint {
  date: string
  score: number
  stage: string
}

interface DealInput {
  conversionScore: number | null
  dealValue: number | null
  daysSinceUpdate: number
  closeDate: string | null
  risks: string[]
  pendingTodos: string[]
  scoreHistory?: ScorePoint[]
  scoreTrend?: 'improving' | 'declining' | 'stable' | 'new'
  stage: string
  company: string
  name: string
}

const RISK_KEYWORDS = [
  'budget freeze', 'budget cut', 'no budget', 'budget hold',
  'champion left', 'champion change', 'new champion', 'lost champion',
  'competitor shortlisted', 'going with', 'evaluating', 'other vendor',
  'ghosting', 'no response', 'unresponsive', 'gone quiet',
  'deal on hold', 'paused', 'delayed', 'put on hold',
]

function detectRiskKeywords(risks: string[]): string[] {
  const found: string[] = []
  const combined = risks.join(' ').toLowerCase()
  for (const kw of RISK_KEYWORDS) {
    if (combined.includes(kw)) found.push(kw)
  }
  return found
}

function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null
  const d = new Date(isoDate)
  if (isNaN(d.getTime())) return null
  return Math.round((d.getTime() - Date.now()) / 86400000)
}

function isVelocityDeclining(history?: ScorePoint[]): boolean {
  if (!history || history.length < 3) return false
  const last3 = [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  // Declining if each point is lower than the previous (oldest → newest)
  const scores = last3.reverse().map(p => p.score)
  return scores[2] < scores[1] && scores[1] < scores[0]
}

export function computeUrgencyScore(deal: DealInput): UrgencyResult {
  const reasons: string[] = []
  let score = 0

  // ── Base: inverted win probability × value × log(staleness) ─────────────
  const winProb = deal.conversionScore ?? 50            // default 50% if not scored
  const valueK = Math.min((deal.dealValue ?? 10000) / 1000, 100)  // cap at 100k
  const stalenessLog = Math.log(deal.daysSinceUpdate + 1)
  const base = ((100 - winProb) / 100) * valueK * stalenessLog
  score += Math.min(base * 3, 40)                       // base contributes up to 40pts

  // ── Staleness penalty ────────────────────────────────────────────────────
  if (deal.daysSinceUpdate > 21) {
    score += 25
    reasons.push(`No activity in ${deal.daysSinceUpdate} days`)
  } else if (deal.daysSinceUpdate > 14) {
    score += 15
    reasons.push(`No activity in ${deal.daysSinceUpdate} days`)
  } else if (deal.daysSinceUpdate > 7) {
    score += 8
    reasons.push(`No update in ${deal.daysSinceUpdate} days`)
  }

  // ── Velocity decline ─────────────────────────────────────────────────────
  if (deal.scoreTrend === 'declining' || isVelocityDeclining(deal.scoreHistory)) {
    score += 15
    reasons.push('Win probability declining')
  }

  // ── Close date urgency ───────────────────────────────────────────────────
  const daysToClose = daysUntil(deal.closeDate)
  if (daysToClose !== null) {
    if (daysToClose <= 0) {
      score += 30
      reasons.push(`Close date passed ${Math.abs(daysToClose)}d ago`)
    } else if (daysToClose <= 14) {
      score += 25
      reasons.push(`Close date in ${daysToClose} days`)
    } else if (daysToClose <= 30) {
      score += 15
      reasons.push(`Close date in ${daysToClose} days`)
    } else if (daysToClose <= 60) {
      score += 8
      reasons.push(`Close date in ${daysToClose} days`)
    }
  }

  // ── Risk signal keywords ─────────────────────────────────────────────────
  const riskFlags = detectRiskKeywords(deal.risks)
  if (riskFlags.length > 0) {
    score += Math.min(riskFlags.length * 10, 20)
    if (riskFlags.some(f => f.includes('champion'))) reasons.push('Champion change risk')
    else if (riskFlags.some(f => f.includes('budget'))) reasons.push('Budget freeze signal')
    else if (riskFlags.some(f => f.includes('competitor') || f.includes('other vendor') || f.includes('going with'))) reasons.push('Competitor shortlisted')
    else reasons.push(`Risk: "${riskFlags[0]}"`)
  }

  // ── Missing critical fields ───────────────────────────────────────────────
  const missingFields: string[] = []
  if (deal.conversionScore == null) missingFields.push('no score')
  if (!deal.dealValue) missingFields.push('no value')
  if (!deal.closeDate) missingFields.push('no close date')
  if (missingFields.length >= 2) {
    score += 10
    reasons.push(`Missing: ${missingFields.join(', ')}`)
  }

  // ── Low win prob on late-stage deal ─────────────────────────────────────
  const lateStages = ['proposal', 'negotiation', 'contract', 'legal', 'closed']
  const isLateStage = lateStages.some(s => deal.stage?.toLowerCase().includes(s))
  if (isLateStage && (deal.conversionScore ?? 100) < 40) {
    score += 15
    reasons.push(`Late stage but low win probability (${deal.conversionScore}%)`)
  }

  // ── Cap and derive top action ────────────────────────────────────────────
  score = Math.min(Math.round(score), 100)

  const topAction = deriveTopAction(deal, reasons, daysToClose)

  return { score, reasons: reasons.slice(0, 4), topAction }
}

function deriveTopAction(
  deal: DealInput,
  reasons: string[],
  daysToClose: number | null,
): string {
  // Priority order: close date → champion risk → stale → low score
  if (daysToClose !== null && daysToClose <= 7 && daysToClose >= 0) {
    return `Close ${deal.company} before ${new Date(deal.closeDate!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  }
  if (reasons.some(r => r.includes('Champion'))) {
    return `Re-engage champion at ${deal.company}`
  }
  if (reasons.some(r => r.includes('Competitor'))) {
    return `Counter competitor at ${deal.company} — prepare battlecard`
  }
  if (reasons.some(r => r.includes('budget'))) {
    return `Address budget objection at ${deal.company}`
  }
  if (reasons.some(r => r.includes('No activity') || r.includes('No update'))) {
    return `Follow up with ${deal.company} — ${deal.daysSinceUpdate}d since last contact`
  }
  if (deal.pendingTodos?.length > 0) {
    return `Complete ${deal.pendingTodos.length} open todo${deal.pendingTodos.length !== 1 ? 's' : ''} for ${deal.company}`
  }
  if (daysToClose !== null && daysToClose <= 30) {
    return `Accelerate ${deal.company} — close in ${daysToClose}d`
  }
  return `Review and update ${deal.company} deal`
}
