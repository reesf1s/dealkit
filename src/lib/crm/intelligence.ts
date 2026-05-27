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
    source?: string | null
    type?: string | null
  }>
  openTasks?: Array<{ id: string; title?: string | null; dueAt?: Date | string | null; priority?: string | null }>
  contacts?: Array<{ id: string; fullName?: string | null; email?: string | null; jobTitle?: string | null }>
  meetings?: Array<{ id: string; title?: string | null; startsAt?: Date | string | null }>
}

type EvidenceItem = {
  id: string
  title: string
  text: string
  occurredAt: Date | null
  source?: string | null
  type?: string | null
  weight: number
  ageDays: number | null
}

type IgnoredEvidenceItem = {
  id: string
  title: string
  reason: string
  occurredAt: Date | null
}

type TermMatch = {
  label: string
  pattern: RegExp
  severity: 'low' | 'medium' | 'high'
  explanation: (evidence: EvidenceItem) => string
}

const RISK_TERMS: TermMatch[] = [
  { label: 'blocked', severity: 'high', pattern: /\b(blocked|blocker|blocking|stuck|stalled)\b/i, explanation: evidence => `Latest evidence says the deal is blocked or stuck: "${quoteEvidence(evidence.text)}"` },
  { label: 'data alignment', severity: 'high', pattern: /\b(data alignment|data accuracy|alignment concern|misalignment|numbers do not align|numbers don't align|disagreeing with numbers|floorplans?|occupancy data|people data|data issue)\b/i, explanation: evidence => `Data or requirements are unresolved: "${quoteEvidence(evidence.text)}"` },
  { label: 'unconfirmed improvements', severity: 'medium', pattern: /\b(awaiting|waiting|confirm|clarify|specific changes|improvements underway|what these are|need to understand)\b/i, explanation: evidence => `Buyer is waiting on clarification before progressing: "${quoteEvidence(evidence.text)}"` },
  { label: 'procurement or legal', severity: 'high', pattern: /\b(procurement|legal|compliance|security|contract|redline|dpa|msa|infosec)\b/i, explanation: evidence => `Procurement, legal, security, or contract work is in the path: "${quoteEvidence(evidence.text)}"` },
  { label: 'budget or pricing', severity: 'medium', pattern: /\b(budget|pricing|price|cost|expensive|commercial|discount)\b/i, explanation: evidence => `Commercial uncertainty appears in the evidence: "${quoteEvidence(evidence.text)}"` },
  { label: 'uncertainty', severity: 'medium', pattern: /\b(concern|concerns|issue|issues|uncertain|not sure|risk|delay|delayed|slipped|waiting)\b/i, explanation: evidence => `Recent evidence contains unresolved uncertainty: "${quoteEvidence(evidence.text)}"` },
]

const POSITIVE_TERMS: TermMatch[] = [
  { label: 'strong engagement', severity: 'low', pattern: /\b(keen|positive|engaged|interested|strong engagement|really keen)\b/i, explanation: evidence => `Buyer engagement is positive: "${quoteEvidence(evidence.text)}"` },
  { label: 'next step agreed', severity: 'low', pattern: /\b(next step|follow up|send|share|schedule|book|confirmed|agreed)\b/i, explanation: evidence => `There is a concrete motion to move the deal forward: "${quoteEvidence(evidence.text)}"` },
  { label: 'criteria defined', severity: 'low', pattern: /\b(success criteria|criteria|critical path|framework|decision|timeline|gate)\b/i, explanation: evidence => `Evaluation criteria or decision process is visible: "${quoteEvidence(evidence.text)}"` },
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

function isClosedStatus(status?: string | null) {
  return status === 'won' || status === 'lost' || status === 'archived'
}

function taskAgeDays(task: { dueAt?: Date | string | null }, now = new Date()) {
  const dueAt = asDate(task.dueAt)
  if (!dueAt) return null
  return Math.floor((now.getTime() - dueAt.getTime()) / 86_400_000)
}

function isStaleOpenTask(task: { dueAt?: Date | string | null; title?: string | null }, now = new Date()) {
  const age = taskAgeDays(task, now)
  const title = cleanText(task.title)
  if (age != null && age > 30) return true
  if (/^\[\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\]/.test(title) && age == null) return true
  return false
}

function leadingDateAgeDays(text?: string | null, now = new Date()) {
  const value = cleanText(text)
  const match = value.match(/^\[(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\]/)
  if (!match) return null
  const date = new Date(`${match[1]} ${match[2]} ${match[3]} 00:00:00 UTC`)
  if (Number.isNaN(date.getTime())) return null
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000)
}

function isStaleStoredNextAction(text?: string | null, now = new Date()) {
  const age = leadingDateAgeDays(text, now)
  return age != null && age > 30
}

function quoteEvidence(text: string) {
  return cleanText(text).slice(0, 170)
}

function cleanText(value?: string | null) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim()
}

function isGenericActivity(activity: NonNullable<DealContextLike['latestActivities']>[number]) {
  const title = cleanText(activity.title).toLowerCase()
  const body = cleanText(activity.body || activity.summary).toLowerCase()
  if (title === 'updated deal facts' && (!body || body === 'deal facts were updated inline.')) return true
  if (/^legacy stage:/.test(title) && (!body || body === 'no extra detail saved.')) return true
  if (title === 'deal imported from csv' || title === 'deal created') return true
  return false
}

function activityText(activity: NonNullable<DealContextLike['latestActivities']>[number]) {
  return [activity.summary, activity.body].map(cleanText).filter(Boolean).join(' ')
}

function buildIgnoredEvidence(context: DealContextLike): IgnoredEvidenceItem[] {
  return (context.latestActivities ?? [])
    .map(activity => {
      const text = activityText(activity)
      const occurredAt = asDate(activity.occurredAt)
      if (!text) {
        return {
          id: activity.id,
          title: cleanText(activity.title) || 'Activity',
          reason: 'No readable evidence text',
          occurredAt,
        }
      }
      if (isGenericActivity(activity)) {
        return {
          id: activity.id,
          title: cleanText(activity.title) || 'Activity',
          reason: 'Generic field-change or import record',
          occurredAt,
        }
      }
      return null
    })
    .filter(Boolean) as IgnoredEvidenceItem[]
}

export function buildDealEvidence(context: DealContextLike, now = new Date()): EvidenceItem[] {
  return (context.latestActivities ?? [])
    .map(activity => {
      const text = activityText(activity)
      const occurredAt = asDate(activity.occurredAt)
      const ageDays = occurredAt ? daysSince(occurredAt, now) : null
      const generic = isGenericActivity(activity)
      const weight = generic ? 0 : 20
        + (ageDays == null ? 0 : Math.max(0, 18 - Math.min(ageDays, 18)))
        + (activity.source === 'ai_assisted_update' ? 8 : 0)
        + (activity.type === 'meeting' ? 6 : 0)
        + (text.length > 80 ? 8 : 0)
      return {
        id: activity.id,
        title: cleanText(activity.title) || 'Activity',
        text,
        occurredAt,
        source: activity.source,
        type: activity.type,
        weight,
        ageDays,
      }
    })
    .filter(item => item.text && item.weight > 0)
    .sort((a, b) => {
      const aRecency = a.ageDays == null ? 0 : a.ageDays <= 7 ? 4 : a.ageDays <= 21 ? 3 : a.ageDays <= 60 ? 2 : a.ageDays <= 120 ? 1 : 0
      const bRecency = b.ageDays == null ? 0 : b.ageDays <= 7 ? 4 : b.ageDays <= 21 ? 3 : b.ageDays <= 60 ? 2 : b.ageDays <= 120 ? 1 : 0
      if (bRecency !== aRecency) return bRecency - aRecency
      return (b.occurredAt?.getTime() ?? 0) - (a.occurredAt?.getTime() ?? 0)
        || b.weight - a.weight
    })
}

function findMatches(evidence: EvidenceItem[], terms: TermMatch[]) {
  const matches: Array<{ term: TermMatch; evidence: EvidenceItem }> = []
  for (const item of evidence) {
    for (const term of terms) {
      if (term.pattern.test(item.text) && !matches.some(match => match.term.label === term.label)) {
        matches.push({ term, evidence: item })
      }
    }
  }
  return matches
}

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))]
}

function companyLabel(context: DealContextLike) {
  return context.deal.companyName ?? context.deal.title
}

export function dealEvidenceText(context: DealContextLike, now = new Date()) {
  const evidence = buildDealEvidence(context, now)
  const currentTasks = (context.openTasks ?? []).filter(task => !isStaleOpenTask(task, now)).slice(0, 4)
  const staleTasks = (context.openTasks ?? []).filter(task => isStaleOpenTask(task, now))
  return [
    `Deal: ${context.deal.title}`,
    `Company: ${context.deal.companyName ?? 'Unknown'}`,
    `Stage: ${context.deal.stageName ?? 'Unknown'}`,
    context.deal.aiNextAction && !isStaleStoredNextAction(context.deal.aiNextAction, now) ? `Current next action: ${context.deal.aiNextAction}` : null,
    context.deal.aiNextAction && isStaleStoredNextAction(context.deal.aiNextAction, now) ? `Historical next action to verify, not current instruction: ${context.deal.aiNextAction}` : null,
    ...evidence.slice(0, 12).map(item => [
      `[activity:${item.id}] ${item.title}`,
      item.occurredAt ? `Date: ${item.occurredAt.toISOString()}` : null,
      `Evidence: ${item.text}`,
    ].filter(Boolean).join('\n')),
    ...currentTasks.map(task => `[current_task:${task.id}] ${cleanText(task.title)}`),
    staleTasks.length ? `[stale_open_tasks] ${staleTasks.length} older open task${staleTasks.length === 1 ? '' : 's'} exist. Treat them as cleanup/verification, not current instructions.` : null,
  ].filter(Boolean).join('\n\n').slice(0, 12000)
}

export function deriveDealIntelligence(context: DealContextLike, now = new Date()) {
  const deal = context.deal
  const closed = isClosedStatus(deal.status)
  const closedStageMismatch = closed && (
    (deal.status === 'won' && /lost/i.test(cleanText(deal.stageName))) ||
    (deal.status === 'lost' && /won/i.test(cleanText(deal.stageName)))
  )
  const open = !closed
  const evidence = buildDealEvidence(context, now)
  const latestSubstantive = evidence
    .slice()
    .sort((a, b) => (b.occurredAt?.getTime() ?? 0) - (a.occurredAt?.getTime() ?? 0))[0]
  const lastSubstantiveActivityDays = latestSubstantive?.occurredAt ? daysSince(latestSubstantive.occurredAt, now) : null
  const lastActivityDays = lastSubstantiveActivityDays ?? daysSince(deal.lastActivityAt, now)
  const closeDays = daysUntil(deal.expectedCloseDate, now)
  const hasUpcomingMeeting = (context.meetings ?? []).some(meeting => {
    const startsAt = asDate(meeting.startsAt)
    return startsAt ? startsAt.getTime() >= now.getTime() : false
  })
  const allOpenTasks = context.openTasks ?? []
  const currentOpenTasks = open ? allOpenTasks.filter(task => !isStaleOpenTask(task, now)) : []
  const staleOpenTasks = open ? allOpenTasks.filter(task => isStaleOpenTask(task, now)) : allOpenTasks
  const storedNextAction = cleanText(deal.aiNextAction)
  const currentStoredNextAction = open && storedNextAction && !isStaleStoredNextAction(storedNextAction, now) ? storedNextAction : ''
  const hasNextAction = Boolean(currentStoredNextAction || currentOpenTasks.length)
  const overdueTasks = currentOpenTasks.filter(task => {
    const dueAt = asDate(task.dueAt)
    return dueAt ? dueAt.getTime() < now.getTime() : false
  })
  const riskMatches = findMatches(evidence, RISK_TERMS)
  const positiveMatches = findMatches(evidence, POSITIVE_TERMS)
  const ignoredEvidence = buildIgnoredEvidence(context).slice(0, 8)

  const missingData: string[] = []
  if (!deal.valueAmount) missingData.push('Value is missing')
  if (!deal.expectedCloseDate) missingData.push('Close date is missing')
  if (!(context.contacts ?? []).length) missingData.push('No contacts linked')
  if (open && !hasNextAction) missingData.push('No current next action recorded')
  if (open && staleOpenTasks.length) missingData.push('Old open tasks need review')
  if (!evidence.length) missingData.push('No substantive timeline evidence yet')

  const riskDrivers = unique([
    open && lastActivityDays == null ? 'No recent activity is recorded' : '',
    open && lastActivityDays != null && lastActivityDays >= 14 ? `No activity in ${lastActivityDays} days` : '',
    open && closeDays != null && closeDays < 0 ? 'Close date has passed while the deal is still open' : '',
    open && !hasNextAction ? 'No concrete next step is attached' : '',
    open && staleOpenTasks.length ? `${staleOpenTasks.length} old open task${staleOpenTasks.length === 1 ? '' : 's'} should be confirmed as done, stale, or still relevant` : '',
    closed && allOpenTasks.length ? `${allOpenTasks.length} open task${allOpenTasks.length === 1 ? '' : 's'} remain on a closed deal and should be cleaned up` : '',
    closed && deal.status === 'won' && /lost/i.test(cleanText(deal.stageName)) ? 'Deal status is won but the stage label says closed lost' : '',
    closed && deal.status === 'lost' && /won/i.test(cleanText(deal.stageName)) ? 'Deal status is lost but the stage label says closed won' : '',
    ...overdueTasks.slice(0, 3).map(task => {
      const dueAt = asDate(task.dueAt)
      const overdueDays = dueAt ? Math.max(1, Math.ceil((now.getTime() - dueAt.getTime()) / 86_400_000)) : null
      return `Next action is overdue${overdueDays ? ` by ${overdueDays} days` : ''}: ${cleanText(task.title)}`
    }),
    ...riskMatches.map(match => match.term.explanation(match.evidence)),
    !deal.valueAmount ? 'Forecast value is missing' : '',
    !deal.expectedCloseDate ? 'Close date is missing' : '',
  ]).slice(0, 7)

  const positiveSignals = unique([
    hasUpcomingMeeting ? 'Upcoming meeting is linked' : '',
    hasNextAction && !overdueTasks.length ? `Next action is explicit: ${currentStoredNextAction || cleanText(currentOpenTasks[0]?.title)}` : '',
    lastActivityDays != null && lastActivityDays <= 7 ? 'Recent activity is present' : '',
    ...positiveMatches.map(match => match.term.explanation(match.evidence)),
  ]).slice(0, 6)

  let score = typeof deal.probability === 'number' ? deal.probability : 42
  if (closedStageMismatch) score = 35
  else if (deal.status === 'won') score = 100
  else if (deal.status === 'lost') score = 0
  else {
    if (lastActivityDays != null && lastActivityDays <= 3) score += 9
    if (lastActivityDays != null && lastActivityDays >= 14) score -= 16
    if (hasNextAction) score += 8
    else score -= 14
    score -= Math.min(18, overdueTasks.length * 9)
    score -= Math.min(14, staleOpenTasks.length * 3)
    if (hasUpcomingMeeting) score += 7
    if (closeDays != null && closeDays < 0) score -= 18
    for (const match of riskMatches) score -= match.term.severity === 'high' ? 11 : match.term.severity === 'medium' ? 7 : 4
    for (const match of positiveMatches) score += match.term.severity === 'low' ? 4 : 2
    if (!deal.valueAmount) score -= 6
    if (!deal.expectedCloseDate) score -= 6
  }
  score = Math.max(0, Math.min(deal.status === 'won' ? 100 : 92, Math.round(score)))

  let confidence = 76
  confidence -= missingData.length * 7
  if (evidence.length < 2) confidence -= 16
  if (lastActivityDays == null || lastActivityDays >= 30) confidence -= 12
  if (overdueTasks.length) confidence -= Math.min(14, overdueTasks.length * 5)
  if (staleOpenTasks.length) confidence -= Math.min(18, staleOpenTasks.length * 4)
  if (riskMatches.length) confidence -= Math.min(12, riskMatches.length * 3)
  if (latestSubstantive?.ageDays != null && latestSubstantive.ageDays <= 7) confidence += 6
  if ((deal.status === 'won' || deal.status === 'lost') && !closedStageMismatch) confidence = Math.max(confidence, 86)
  if (closedStageMismatch) confidence -= 30
  confidence = Math.max(18, Math.min(deal.status === 'won' && !closedStageMismatch ? 100 : 88, Math.round(confidence)))

  const highRiskMatches = riskMatches.filter(match => match.term.severity === 'high')
  let riskLevel: RiskLevel = 'low'
  if (closedStageMismatch) riskLevel = 'high'
  else if (deal.status === 'won') riskLevel = 'low'
  else if (deal.status === 'lost') riskLevel = 'high'
  else if (highRiskMatches.length || overdueTasks.length >= 2 || staleOpenTasks.length >= 3 || riskDrivers.length >= 3 || score < 42) riskLevel = 'high'
  else if (riskMatches.length || riskDrivers.length || missingData.length >= 2 || score < 64) riskLevel = 'medium'

  const nextAction = currentStoredNextAction
    || cleanText(currentOpenTasks?.[0]?.title)
    || (riskMatches[0] ? nextActionForRisk(riskMatches[0].term.label, companyLabel(context)) : `Add a concrete next action for ${companyLabel(context)}.`)

  const latestLine = latestSubstantive
    ? `Latest evidence: ${quoteEvidence(latestSubstantive.text)}`
    : 'Latest evidence is thin.'
  const meaningLine = riskDrivers[0]
    ? `Meaning: ${riskDrivers[0]}`
    : positiveSignals[0]
      ? `Meaning: ${positiveSignals[0]}`
      : 'Meaning: Halvex needs more activity before it can be confident.'
  const summary = [
    `${companyLabel(context)} is ${deal.stageName ? `in ${deal.stageName}` : 'active'}.`,
    latestLine,
    meaningLine,
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
    latestEvidence: latestSubstantive ? {
      id: latestSubstantive.id,
      title: latestSubstantive.title,
      text: latestSubstantive.text,
      occurredAt: latestSubstantive.occurredAt,
    } : null,
    evidence: evidence.slice(0, 6).map(item => ({
      id: item.id,
      title: item.title,
      text: item.text,
      occurredAt: item.occurredAt,
      source: item.source,
    })),
    evidenceActivityIds: evidence.slice(0, 5).map(activity => activity.id),
    ignoredEvidence,
    inferenceSteps: [
      evidence.length ? `Used ${evidence.length} substantive timeline item${evidence.length === 1 ? '' : 's'} as evidence.` : 'Found no substantive timeline evidence.',
      ignoredEvidence.length ? `Ignored ${ignoredEvidence.length} generic or empty timeline item${ignoredEvidence.length === 1 ? '' : 's'} so they do not distort the brief.` : 'No generic timeline items had to be ignored.',
      riskDrivers.length ? `Risk is driven by: ${riskDrivers.slice(0, 2).join(' / ')}` : 'No material risk driver was detected from current evidence.',
      positiveSignals.length ? `Positive signals include: ${positiveSignals.slice(0, 2).join(' / ')}` : 'Positive signal evidence is limited.',
      missingData.length ? `Confidence is reduced by missing data: ${missingData.join(' / ')}` : 'Core deal facts are present.',
      staleOpenTasks.length ? `Old open tasks are treated as cleanup/verification, not fresh next-step evidence.` : '',
    ].filter(Boolean),
  }
}

function nextActionForRisk(label: string, company: string) {
  if (label === 'data alignment') return `Send ${company} a clear note on the data/requirements issue and ask them to confirm what must change before the next review.`
  if (label === 'unconfirmed improvements') return `Ask ${company} which changes or improvements they need confirmed, then turn that into a dated follow-up task.`
  if (label === 'procurement or legal') return `Confirm the procurement, legal, or security owner and the exact approval step blocking progress.`
  if (label === 'budget or pricing') return `Clarify the commercial concern and agree whether value, scope, or timing needs to change.`
  return `Clarify the unresolved blocker with ${company} and agree the next dated step.`
}
