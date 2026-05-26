export type NativeDealStatus = 'open' | 'won' | 'lost' | 'archived'
export type NativeRiskLevel = 'low' | 'medium' | 'high' | 'unknown'
export type NativeSignalDirection = 'positive' | 'negative' | 'neutral'
export type NativeSignalType =
  | 'stale_deal'
  | 'no_next_step'
  | 'close_date_overdue'
  | 'stage_stagnant'
  | 'close_date_slipped'
  | 'value_changed'
  | 'meeting_booked'

export type DealScoreInput = {
  status: NativeDealStatus | string
  probability: number | null
  lastActivityAt: Date | null
  nextStepDueAt: Date | null
  expectedCloseDate: Date | null
}

export type SignalInput = DealScoreInput & {
  now?: Date
  hasOpenTasks: boolean
  hasNextAction: boolean
  hasUpcomingMeeting: boolean
  daysInStage?: number | null
  closeDateMovedCount?: number | null
  valueChangeAmount?: number | null
  evidenceActivityIds?: string[]
}

export type DeterministicSignal = {
  type: NativeSignalType
  strength: number
  direction: NativeSignalDirection
  explanation: string
  evidenceActivityIds: string[]
  confidence: number
}

export function titleCaseName(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

export function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  }
}

export function parseDomain(emailOrWebsite?: string | null) {
  const value = (emailOrWebsite ?? '').trim().toLowerCase()
  if (!value) return null
  if (value.includes('@')) return value.split('@').pop() ?? null
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function mapLegacyStage(stage: string | null | undefined) {
  switch (stage) {
    case 'qualification': return 'qualified'
    case 'prospecting': return 'lead_in'
    case 'negotiation': return 'contract'
    case 'closed_won': return 'won'
    case 'closed_lost': return 'lost'
    default: return stage || 'lead_in'
  }
}

export function mapLegacyStatus(stage: string | null | undefined): NativeDealStatus {
  if (stage === 'closed_won') return 'won'
  if (stage === 'closed_lost') return 'lost'
  return 'open'
}

export function riskFromScore(score: number | null | undefined, staleDays = 0): NativeRiskLevel {
  if (staleDays >= 21 || (score ?? 50) < 35) return 'high'
  if (staleDays >= 14 || (score ?? 50) < 60) return 'medium'
  return 'low'
}

export function scoreDeal(input: DealScoreInput, now = new Date()) {
  if (input.status === 'won') return 100
  if (input.status === 'lost') return 0
  const daysSinceActivity = input.lastActivityAt
    ? Math.floor((now.getTime() - input.lastActivityAt.getTime()) / 86_400_000)
    : 30
  let score = input.probability ?? 35
  if (daysSinceActivity <= 3) score += 12
  else if (daysSinceActivity >= 14) score -= 18
  if (input.nextStepDueAt) score += 10
  else score -= 12
  if (input.expectedCloseDate && input.expectedCloseDate.getTime() < now.getTime()) score -= 18
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function extractDeterministicSignals(input: SignalInput): DeterministicSignal[] {
  const now = input.now ?? new Date()
  const nowMs = now.getTime()
  const evidenceActivityIds = input.evidenceActivityIds ?? []
  const signals: DeterministicSignal[] = []
  const lastActivityDays = input.lastActivityAt
    ? Math.floor((nowMs - input.lastActivityAt.getTime()) / 86_400_000)
    : 999

  if (input.status === 'open' && lastActivityDays >= 14) {
    signals.push({
      type: 'stale_deal',
      strength: Math.min(100, 50 + lastActivityDays),
      direction: 'negative',
      explanation: `No activity recorded in ${lastActivityDays} days.`,
      evidenceActivityIds,
      confidence: 90,
    })
  }

  if (input.status === 'open' && !input.hasOpenTasks && !input.hasNextAction) {
    signals.push({
      type: 'no_next_step',
      strength: 75,
      direction: 'negative',
      explanation: 'No open task or clear next action is attached to this deal.',
      evidenceActivityIds,
      confidence: 85,
    })
  }

  if (input.status === 'open' && input.expectedCloseDate && input.expectedCloseDate.getTime() < nowMs) {
    signals.push({
      type: 'close_date_overdue',
      strength: 85,
      direction: 'negative',
      explanation: 'Expected close date has passed while the deal is still open.',
      evidenceActivityIds,
      confidence: 90,
    })
  }

  if (input.status === 'open' && (input.daysInStage ?? 0) >= 21) {
    signals.push({
      type: 'stage_stagnant',
      strength: 70,
      direction: 'negative',
      explanation: `Deal has been in the same stage for ${input.daysInStage} days.`,
      evidenceActivityIds,
      confidence: 75,
    })
  }

  if (input.status === 'open' && (input.closeDateMovedCount ?? 0) > 1) {
    signals.push({
      type: 'close_date_slipped',
      strength: 80,
      direction: 'negative',
      explanation: `Close date has moved ${input.closeDateMovedCount} times.`,
      evidenceActivityIds,
      confidence: 75,
    })
  }

  if ((input.valueChangeAmount ?? 0) !== 0) {
    const amount = input.valueChangeAmount ?? 0
    signals.push({
      type: 'value_changed',
      strength: Math.min(90, Math.max(45, Math.abs(amount))),
      direction: amount > 0 ? 'positive' : 'negative',
      explanation: amount > 0 ? 'Deal value increased.' : 'Deal value decreased.',
      evidenceActivityIds,
      confidence: 70,
    })
  }

  if (input.hasUpcomingMeeting) {
    signals.push({
      type: 'meeting_booked',
      strength: 65,
      direction: 'positive',
      explanation: 'Upcoming meeting is linked to this deal.',
      evidenceActivityIds,
      confidence: 80,
    })
  }

  return signals
}
