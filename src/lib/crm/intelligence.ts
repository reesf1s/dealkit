import 'server-only'

type RiskLevel = 'low' | 'medium' | 'high' | 'unknown'

type DealContextLike = {
  deal: {
    id: string
    title: string
    valueAmount?: number | null
    expectedCloseDate?: Date | string | null
    status?: string | null
    probability?: number | null
    aiNextAction?: string | null
    lastActivityAt?: Date | string | null
    companyName?: string | null
    stageName?: string | null
  }
  latestActivities?: Array<{
    id: string
    title?: string | null
    body?: string | null
    summary?: string | null
    occurredAt?: Date | string | null
  }>
  openTasks?: Array<{ id: string; title?: string | null; dueAt?: Date | string | null }>
  contacts?: Array<{ id: string; fullName?: string | null; email?: string | null }>
  meetings?: Array<{ id: string; title?: string | null; startsAt?: Date | string | null }>
}

const HIGH_RISK_TERMS = [
  'blocked',
  'blocker',
  'concern',
  'concerns',
  'issue',
  'issues',
  'misalignment',
  'alignment',
  'procurement',
  'legal',
  'compliance',
  'security',
  'data',
  'pricing',
  'budget',
  'competitor',
  'uncertain',
  'not sure',
  'delay',
  'delayed',
  'slipped',
  'stalled',
]

const POSITIVE_TERMS = [
  'agreed',
  'confirmed',
  'approved',
  'champion',
  'next step',
  'meeting booked',
  'budget confirmed',
  'keen',
  'positive',
  'moving forward',
  'signed',
]

function asDate(value?: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function daysSince(value?: Date | string | null, now = new Date()) {
  const date = asDate(value)
  if (!date) return null
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000)
}

function daysUntil(value?: Date | string | null, now = new Date()) {
  const date = asDate(value)
  if (!date) return null
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000)
}

export function dealEvidenceText(context: DealContextLike) {
  return [
    context.deal.title,
    context.deal.companyName,
    context.deal.aiNextAction,
    ...(context.latestActivities ?? []).slice(0, 8).flatMap(activity => [activity.title, activity.summary, activity.body]),
    ...(context.openTasks ?? []).slice(0, 6).map(task => task.title),
  ].filter(Boolean).join('\n').slice(0, 9000)
}

export function deriveDealIntelligence(context: DealContextLike, now = new Date()) {
  const deal = context.deal
  const text = dealEvidenceText(context).toLowerCase()
  const open = deal.status !== 'won' && deal.status !== 'lost' && deal.status !== 'archived'
  const lastActivityDays = daysSince(deal.lastActivityAt, now)
  const closeDays = daysUntil(deal.expectedCloseDate, now)
  const hasUpcomingMeeting = (context.meetings ?? []).some(meeting => {
    const startsAt = asDate(meeting.startsAt)
    return startsAt ? startsAt.getTime() >= now.getTime() : false
  })
  const hasNextAction = Boolean(deal.aiNextAction || (context.openTasks ?? []).length)
  const matchedRiskTerms = HIGH_RISK_TERMS.filter(term => text.includes(term))
  const matchedPositiveTerms = POSITIVE_TERMS.filter(term => text.includes(term))

  const missingData: string[] = []
  if (!deal.valueAmount) missingData.push('Value is missing')
  if (!deal.expectedCloseDate) missingData.push('Close date is missing')
  if (!(context.contacts ?? []).length) missingData.push('No contacts linked')
  if (!hasNextAction) missingData.push('No next action recorded')
  if (!(context.latestActivities ?? []).length) missingData.push('No timeline evidence yet')

  const riskDrivers: string[] = []
  if (open && lastActivityDays == null) riskDrivers.push('No recent activity is recorded')
  if (open && lastActivityDays != null && lastActivityDays >= 14) riskDrivers.push(`No activity in ${lastActivityDays} days`)
  if (open && closeDays != null && closeDays < 0) riskDrivers.push('Close date has passed while the deal is still open')
  if (open && !hasNextAction) riskDrivers.push('No concrete next step is attached')
  if (matchedRiskTerms.length) riskDrivers.push(`Recent context mentions ${matchedRiskTerms.slice(0, 3).join(', ')}`)
  if (!deal.valueAmount) riskDrivers.push('Forecast value is missing')
  if (!deal.expectedCloseDate) riskDrivers.push('Close date is missing')

  const positiveSignals: string[] = []
  if (hasUpcomingMeeting) positiveSignals.push('Upcoming meeting is linked')
  if (hasNextAction) positiveSignals.push('A next action exists')
  if (lastActivityDays != null && lastActivityDays <= 7) positiveSignals.push('Recent activity is present')
  if (matchedPositiveTerms.length) positiveSignals.push(`Recent context mentions ${matchedPositiveTerms.slice(0, 3).join(', ')}`)

  let score = typeof deal.probability === 'number' ? deal.probability : 42
  if (deal.status === 'won') score = 100
  else if (deal.status === 'lost') score = 0
  else {
    if (lastActivityDays != null && lastActivityDays <= 3) score += 12
    if (lastActivityDays != null && lastActivityDays >= 14) score -= 16
    if (hasNextAction) score += 10
    else score -= 14
    if (hasUpcomingMeeting) score += 8
    if (closeDays != null && closeDays < 0) score -= 18
    if (matchedRiskTerms.length) score -= Math.min(24, matchedRiskTerms.length * 5)
    if (matchedPositiveTerms.length) score += Math.min(12, matchedPositiveTerms.length * 3)
    if (!deal.valueAmount) score -= 6
    if (!deal.expectedCloseDate) score -= 6
  }
  score = Math.max(0, Math.min(deal.status === 'won' ? 100 : 92, Math.round(score)))

  let confidence = 78
  confidence -= missingData.length * 8
  if ((context.latestActivities ?? []).length < 2) confidence -= 18
  if (lastActivityDays == null || lastActivityDays >= 30) confidence -= 12
  if (matchedRiskTerms.length) confidence -= 4
  if (deal.status === 'won' || deal.status === 'lost') confidence = Math.max(confidence, 86)
  confidence = Math.max(18, Math.min(deal.status === 'won' ? 100 : 88, Math.round(confidence)))

  let riskLevel: RiskLevel = 'low'
  if (deal.status === 'won') riskLevel = 'low'
  else if (deal.status === 'lost') riskLevel = 'high'
  else if (riskDrivers.length >= 3 || matchedRiskTerms.length >= 2 || score < 42) riskLevel = 'high'
  else if (riskDrivers.length || missingData.length >= 2 || score < 64) riskLevel = 'medium'

  const nextAction = deal.aiNextAction
    || (context.openTasks ?? [])[0]?.title
    || (matchedRiskTerms.length ? 'Clarify the unresolved concern and agree a next step.' : 'Add a concrete next action.')

  const summary = [
    `${deal.companyName ?? deal.title} is ${deal.stageName ? `in ${deal.stageName}` : 'active'}.`,
    riskDrivers.length ? `Risk: ${riskDrivers[0]}.` : positiveSignals[0] ? `Signal: ${positiveSignals[0]}.` : 'Evidence is still limited.',
    `Next: ${nextAction}`,
  ].join(' ')

  return {
    score,
    confidence,
    riskLevel,
    riskDrivers,
    positiveSignals,
    missingData,
    nextAction,
    summary,
    evidenceActivityIds: (context.latestActivities ?? []).slice(0, 5).map(activity => activity.id),
  }
}

