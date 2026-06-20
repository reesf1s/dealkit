export type RecoveryIntentId =
  | 'fill_capacity'
  | 'rebook'
  | 'reduce_no_show'
  | 'win_back'
  | 'upsell'
  | 'protect_booking'
  | 'follow_up'

export type RecoveryRecord = {
  id: string
  title?: string | null
  description?: string | null
  nextStep?: string | null
  status?: string | null
  stageKey?: string | null
  stageName?: string | null
  companyName?: string | null
  primaryPersonName?: string | null
  valueAmount?: number | string | null
  probability?: number | string | null
  expectedCloseDate?: string | Date | null
  latestActivityAt?: string | Date | null
  openTaskCount?: number | string | null
}

export type RecoveryTask = {
  id: string
  title?: string | null
  description?: string | null
  priority?: string | null
  dueAt?: string | Date | null
  companyName?: string | null
  dealTitle?: string | null
  personName?: string | null
}

export type RecoveryActivity = {
  id: string
  title?: string | null
  body?: string | null
  type?: string | null
  occurredAt?: string | Date | null
  companyName?: string | null
  dealTitle?: string | null
  personName?: string | null
}

export type RecoveryInsight = {
  id: string
  title: string
  body: string
  intentId: RecoveryIntentId
  priority: 'high' | 'medium' | 'low'
  estimatedValue: number
  count: number
  href: string
}

export type RecoveryIntentSummary = {
  id: RecoveryIntentId
  label: string
  description: string
  count: number
  value: number
  confidence: number
}

export type RecoveryCluster = {
  id: string
  label: string
  summary: string
  intentId: RecoveryIntentId
  count: number
  value: number
  confidence: number
  members: Array<{ id: string; title: string; href: string }>
}

export type RecoveryIntelligence = {
  summary: {
    recoveredEstimate: number
    openCapacity: number
    atRiskCount: number
    confidence: number
  }
  intents: RecoveryIntentSummary[]
  clusters: RecoveryCluster[]
  recommendations: RecoveryInsight[]
}

const INTENTS: Record<RecoveryIntentId, { label: string; description: string; terms: string[] }> = {
  fill_capacity: {
    label: 'Fill pipeline',
    description: 'Open pipeline space or underworked opportunity value.',
    terms: ['gap', 'empty', 'slot', 'availability', 'capacity', 'walk in', 'walk-in', 'pipeline gap'],
  },
  rebook: {
    label: 'Book next step',
    description: 'Prospects who need a meeting, reply, or next-step confirmation.',
    terms: ['rebook', 'return', 'next visit', 'follow up', 'follow-up', 'meeting', 'demo', 'call'],
  },
  reduce_no_show: {
    label: 'Confirm urgency',
    description: 'Deals that need confirmation, timeline pressure, or decision clarity.',
    terms: ['no show', 'no-show', 'deposit', 'confirm', 'confirmation', 'reminder', 'late cancel', 'cancellation', 'deadline', 'timeline'],
  },
  win_back: {
    label: 'Win back',
    description: 'Dormant prospects or old opportunities worth reactivating.',
    terms: ['lapsed', 'inactive', 'lost', 'dormant', 'win back', 'winback', 'not seen', 'reactivate'],
  },
  upsell: {
    label: 'Expand deal',
    description: 'Higher-value packages, plans, seats, or expansion opportunities.',
    terms: ['upgrade', 'add on', 'add-on', 'package', 'membership', 'bundle', 'premium', 'course'],
  },
  protect_booking: {
    label: 'Protect deal',
    description: 'Valuable deals with weak intent or missing next steps.',
    terms: ['risk', 'uncertain', 'maybe', 'hold', 'reschedule', 'tentative', 'waiting'],
  },
  follow_up: {
    label: 'Follow up',
    description: 'General message, call, or task-driven sales work.',
    terms: ['call', 'email', 'message', 'text', 'reply', 'send', 'chase', 'task'],
  },
}

const ORDERED_INTENTS = Object.keys(INTENTS) as RecoveryIntentId[]

export function buildRecoveryIntelligence(input: {
  records: RecoveryRecord[]
  tasks?: RecoveryTask[]
  activities?: RecoveryActivity[]
  now?: Date
}): RecoveryIntelligence {
  const now = input.now ?? new Date()
  const scored = input.records.map(record => scoreRecord(record, now))
  const taskSignals = (input.tasks ?? []).map(task => scoreText(`${task.title ?? ''} ${task.description ?? ''} ${task.dealTitle ?? ''} ${task.companyName ?? ''}`))
  const activitySignals = (input.activities ?? []).map(activity => scoreText(`${activity.title ?? ''} ${activity.body ?? ''} ${activity.dealTitle ?? ''} ${activity.companyName ?? ''}`))
  const allSignals = [...scored.map(item => item.scores), ...taskSignals, ...activitySignals]
  const intents = summarizeIntents(scored, allSignals)
  const clusters = clusterRecords(scored)
  const recommendations = buildRecommendations(scored, clusters, intents)
  const openValue = scored.filter(item => item.record.status !== 'won').reduce((sum, item) => sum + item.value, 0)
  const atRiskCount = scored.filter(item => ['protect_booking', 'reduce_no_show', 'win_back'].includes(item.primaryIntent)).length
  const recoveredEstimate = recommendations.reduce((sum, item) => sum + item.estimatedValue, 0)
  const confidence = average([...intents.map(intent => intent.confidence), ...clusters.map(cluster => cluster.confidence)])

  return {
    summary: {
      recoveredEstimate: Math.round(recoveredEstimate),
      openCapacity: Math.round(openValue * 0.14),
      atRiskCount,
      confidence: Math.round(confidence || 63),
    },
    intents,
    clusters,
    recommendations,
  }
}

export function classifyRecoveryIntent(record: RecoveryRecord, now = new Date()): RecoveryIntentId {
  return scoreRecord(record, now).primaryIntent
}

function scoreRecord(record: RecoveryRecord, now: Date) {
  const text = normalize(`${clean(record.title)} ${clean(record.description)} ${clean(record.nextStep)} ${clean(record.stageName)}`)
  const scores = scoreText(text)
  const probability = numberValue(record.probability)
  const value = Math.round(numberValue(record.valueAmount))
  const openTasks = numberValue(record.openTaskCount)
  const expectedDate = dateValue(record.expectedCloseDate)
  const latestActivity = dateValue(record.latestActivityAt)
  const daysToBooking = expectedDate ? daysBetween(now, expectedDate) : null
  const staleDays = latestActivity ? daysBetween(latestActivity, now) : null

  if (record.status === 'lost') scores.win_back += 3
  if (!expectedDate && record.status !== 'won') scores.fill_capacity += 2
  if (daysToBooking !== null && daysToBooking <= 5 && probability < 55) scores.reduce_no_show += 3
  if (probability > 0 && probability < 45 && value > 0) scores.protect_booking += 2
  if (staleDays !== null && staleDays > 45) scores.win_back += 2
  if (openTasks > 0) scores.follow_up += Math.min(3, openTasks)
  if (value >= 500) scores.protect_booking += 1

  const primaryIntent = ORDERED_INTENTS.reduce((best, intent) => scores[intent] > scores[best] ? intent : best, 'follow_up' as RecoveryIntentId)
  const total = ORDERED_INTENTS.reduce((sum, intent) => sum + scores[intent], 0) || 1
  const vector = ORDERED_INTENTS.map(intent => scores[intent] / total).concat([
    Math.min(1, value / 1000),
    probability / 100,
    expectedDate ? 1 : 0,
  ])

  return {
    record,
    scores,
    primaryIntent,
    value,
    confidence: Math.round(55 + (scores[primaryIntent] / total) * 40),
    vector,
  }
}

function scoreText(text: string): Record<RecoveryIntentId, number> {
  const normalized = normalize(text)
  const scores = Object.fromEntries(ORDERED_INTENTS.map(intent => [intent, 0])) as Record<RecoveryIntentId, number>
  for (const intent of ORDERED_INTENTS) {
    for (const term of INTENTS[intent].terms) {
      if (normalized.includes(term)) scores[intent] += term.includes(' ') ? 2 : 1
    }
  }
  if (scores.follow_up === 0) scores.follow_up = 1
  return scores
}

function summarizeIntents(scored: ReturnType<typeof scoreRecord>[], signalScores: Array<Record<RecoveryIntentId, number>>): RecoveryIntentSummary[] {
  return ORDERED_INTENTS.map(intent => {
    const matching = scored.filter(item => item.primaryIntent === intent)
    const signalStrength = signalScores.reduce((sum, scores) => sum + scores[intent], 0)
    return {
      id: intent,
      label: INTENTS[intent].label,
      description: INTENTS[intent].description,
      count: matching.length,
      value: Math.round(matching.reduce((sum, item) => sum + item.value, 0)),
      confidence: Math.min(96, Math.round(48 + signalStrength * 6 + matching.length * 4)),
    }
  }).filter(intent => intent.count > 0 || intent.confidence >= 60)
    .sort((a, b) => (b.value + b.count * 120) - (a.value + a.count * 120))
    .slice(0, 5)
}

function clusterRecords(scored: ReturnType<typeof scoreRecord>[]): RecoveryCluster[] {
  const clusters: Array<{ seed: ReturnType<typeof scoreRecord>; items: ReturnType<typeof scoreRecord>[] }> = []
  const ordered = [...scored].sort((a, b) => b.value - a.value)

  for (const item of ordered) {
    const match = clusters.find(cluster => cosine(item.vector, cluster.seed.vector) >= 0.72 || item.primaryIntent === cluster.seed.primaryIntent && sameLocation(item, cluster.seed))
    if (match) match.items.push(item)
    else clusters.push({ seed: item, items: [item] })
  }

  return clusters
    .map((cluster, index) => {
      const value = cluster.items.reduce((sum, item) => sum + item.value, 0)
      const intentId = dominantIntent(cluster.items)
      const location = mostCommon(cluster.items.map(item => clean(item.record.companyName)))
      return {
        id: `cluster-${index + 1}`,
        label: location ? `${INTENTS[intentId].label} group` : INTENTS[intentId].label,
        summary: clusterSummary(intentId, cluster.items.length, value),
        intentId,
        count: cluster.items.length,
        value: Math.round(value),
        confidence: Math.round(average(cluster.items.map(item => item.confidence))),
        members: cluster.items.slice(0, 4).map(item => ({ id: item.record.id, title: clean(item.record.title) || 'Untitled lead', href: '/home' })),
      }
    })
    .sort((a, b) => (b.value + b.count * 120) - (a.value + a.count * 120))
    .slice(0, 4)
}

function buildRecommendations(
  scored: ReturnType<typeof scoreRecord>[],
  clusters: RecoveryCluster[],
  intents: RecoveryIntentSummary[],
): RecoveryInsight[] {
  const clusterInsights = clusters.slice(0, 3).map((cluster, index) => ({
    id: `recommendation-${cluster.id}`,
    title: recommendationTitle(cluster.intentId),
    body: cluster.summary,
    intentId: cluster.intentId,
    priority: index === 0 ? 'high' as const : cluster.value > 500 ? 'medium' as const : 'low' as const,
    estimatedValue: Math.round(cluster.value * recoveryRate(cluster.intentId)),
    count: cluster.count,
    href: cluster.members[0]?.href ?? '/deals',
  }))

  if (clusterInsights.length) return clusterInsights

  return intents.slice(0, 3).map((intent, index) => ({
    id: `recommendation-${intent.id}`,
    title: recommendationTitle(intent.id),
    body: `${intent.count || 'A'} ${intent.label.toLowerCase()} signal${intent.count === 1 ? '' : 's'} need attention.`,
    intentId: intent.id,
    priority: index === 0 ? 'high' as const : 'medium' as const,
    estimatedValue: Math.round(intent.value * recoveryRate(intent.id)),
    count: intent.count,
    href: '/tasks',
  }))
}

function dominantIntent(items: Array<ReturnType<typeof scoreRecord>>): RecoveryIntentId {
  const counts = Object.fromEntries(ORDERED_INTENTS.map(intent => [intent, 0])) as Record<RecoveryIntentId, number>
  for (const item of items) counts[item.primaryIntent] += 1
  return ORDERED_INTENTS.reduce((best, intent) => counts[intent] > counts[best] ? intent : best, items[0]?.primaryIntent ?? 'follow_up')
}

function recommendationTitle(intent: RecoveryIntentId) {
  switch (intent) {
    case 'fill_capacity': return 'Fill the highest-value gaps'
    case 'rebook': return 'Book the next meetings'
    case 'reduce_no_show': return 'Confirm urgent decisions'
    case 'win_back': return 'Win back dormant prospects'
    case 'upsell': return 'Offer the stronger plan'
    case 'protect_booking': return 'Protect weak-intent value'
    case 'follow_up': return 'Clear the follow-up queue'
  }
}

function clusterSummary(intent: RecoveryIntentId, count: number, value: number) {
  const worth = value ? `worth about ${formatCurrency(value)}` : 'ready for review'
  switch (intent) {
    case 'fill_capacity': return `${count} pipeline gaps are ${worth}.`
    case 'rebook': return `${count} prospects are ready for a next-step meeting ${worth}.`
    case 'reduce_no_show': return `${count} deals need urgency and confirmation pressure ${worth}.`
    case 'win_back': return `${count} dormant prospects can be reactivated ${worth}.`
    case 'upsell': return `${count} deals can likely carry a higher-value offer ${worth}.`
    case 'protect_booking': return `${count} weak-intent deals need protection ${worth}.`
    case 'follow_up': return `${count} follow-ups are grouped into one sales run ${worth}.`
  }
}

function recoveryRate(intent: RecoveryIntentId) {
  switch (intent) {
    case 'fill_capacity': return 0.22
    case 'rebook': return 0.28
    case 'reduce_no_show': return 0.18
    case 'win_back': return 0.16
    case 'upsell': return 0.2
    case 'protect_booking': return 0.14
    case 'follow_up': return 0.12
  }
}

function sameLocation(a: ReturnType<typeof scoreRecord>, b: ReturnType<typeof scoreRecord>) {
  const left = clean(a.record.companyName)
  const right = clean(b.record.companyName)
  return Boolean(left && right && left === right)
}

function cosine(left: number[], right: number[]) {
  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftMagnitude += left[index] ** 2
    rightMagnitude += right[index] ** 2
  }
  return dot / ((Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude)) || 1)
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

function average(values: number[]) {
  const cleanValues = values.filter(value => Number.isFinite(value))
  return cleanValues.length ? cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length : 0
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function dateValue(value: unknown) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function daysBetween(left: Date, right: Date) {
  return Math.round((right.getTime() - left.getTime()) / 86_400_000)
}

function normalize(value: string) {
  return clean(value).toLowerCase().replace(/\s+/g, ' ').trim()
}

function clean(value: unknown) {
  return String(value ?? '')
    .replace(/\bAI\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)
}
