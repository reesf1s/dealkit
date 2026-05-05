type SnapshotSource = {
  stage?: string | null
  nextSteps?: string | null
  notes?: string | null
  meetingNotes?: string | null
  aiSummary?: string | null
  dealRisks?: unknown
}

export type DealSnapshot = {
  whereWeAre: string
  latestUpdate: string | null
  previousUpdate: string | null
  recentUpdates: Array<{ dateLabel: string | null; summary: string }>
  nextAction: string | null
  blocker: string | null
  latestDateLabel: string | null
}

const ACTION_VERBS = [
  'call',
  'email',
  'send',
  'book',
  'confirm',
  'schedule',
  'escalate',
  'finalize',
  'finalise',
  'align',
  'share',
  'draft',
  'review',
  'secure',
  'complete',
  'prepare',
  'follow',
  'chase',
  'message',
  'demo',
  'present',
  'update',
]

const SECTION_ACTION_RE = /(?:actions?|next steps?|next step|action items?)\s*:\s*([\s\S]*?)(?=(?:risks?|blockers?|actions?|next steps?|next step|action items?)\s*:|$)/i
const SECTION_BLOCKER_RE = /(?:risks?|blockers?)\s*:\s*([\s\S]*?)(?=(?:actions?|next steps?|next step|action items?)\s*:|$)/i

export function clipAtWord(input: string, max = 160): string {
  const text = input.replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const sliced = text.slice(0, max)
  const lastSpace = sliced.lastIndexOf(' ')
  return `${(lastSpace > 18 ? sliced.slice(0, lastSpace) : sliced).trim()}…`
}

function normalizeText(input: string | null | undefined, max = 200): string {
  if (!input) return ''
  const text = input
    .replace(/\r/g, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_>#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,;:\-–—\s]+/, '')
  return clipAtWord(text, max)
}

function normalizeTextUnbounded(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .replace(/\r/g, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_>#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,;:\-–—\s]+/, '')
}

function firstSentence(input: string | null | undefined, max = 170): string {
  const normalized = normalizeText(input, 360)
  if (!normalized) return ''
  const sentence = normalized.split(/[.!?]/)[0]?.trim() ?? normalized
  return clipAtWord(sentence, max)
}

function firstSentenceUnbounded(input: string | null | undefined): string {
  const normalized = normalizeTextUnbounded(input)
  if (!normalized) return ''
  return normalized.split(/[.!?]/)[0]?.trim() ?? normalized
}

function toStageLabel(stage?: string | null): string {
  if (!stage) return 'active'
  return stage.replace(/_/g, ' ')
}

function splitEntrySections(entry: string): {
  summary: string
  action: string
  blocker: string
} {
  const action = normalizeTextUnbounded(entry.match(SECTION_ACTION_RE)?.[1] ?? '')
  const blocker = normalizeTextUnbounded(entry.match(SECTION_BLOCKER_RE)?.[1] ?? '')

  const summary = normalizeTextUnbounded(
    entry
      .replace(/(?:actions?|next steps?|next step|action items?)\s*:[\s\S]*?(?=(?:risks?|blockers?|actions?|next steps?|next step|action items?)\s*:|$)/gi, ' ')
      .replace(/(?:risks?|blockers?)\s*:[\s\S]*?(?=(?:actions?|next steps?|next step|action items?)\s*:|$)/gi, ' '),
  )

  return { summary, action, blocker }
}

type ParsedUpdate = {
  dateLabel: string | null
  summary: string
  action: string | null
  blocker: string | null
}

function extractLatestMeetingEntry(meetingNotes?: string | null): { dateLabel: string | null; content: string } | null {
  const text = (meetingNotes ?? '').replace(/\r/g, '').trim()
  if (!text) return null

  const entries = text
    .split(/\n---\n+/)
    .map(segment => segment.trim())
    .filter(Boolean)
  const latest = (entries.length > 0 ? entries[entries.length - 1] : text).trim()
  if (!latest) return null

  const dateMatch = latest.match(/^\[(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\]\s*/i)
  const dateLabel = dateMatch?.[1] ?? null
  const content = dateMatch ? latest.slice(dateMatch[0].length).trim() : latest

  return { dateLabel, content }
}

function parseUpdateEntry(entry: string): ParsedUpdate | null {
  const trimmed = entry.trim()
  if (!trimmed) return null
  const dateMatch = trimmed.match(/^\[(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\]\s*/i)
  const dateLabel = dateMatch?.[1] ?? null
  const content = dateMatch ? trimmed.slice(dateMatch[0].length).trim() : trimmed
  const sections = splitEntrySections(content)

  const summary = firstSentenceUnbounded(sections.summary || content)
  if (!summary) return null

  const explicitAction = firstSentenceUnbounded(sections.action)
  const explicitBlocker = firstSentenceUnbounded(sections.blocker)

  return {
    dateLabel,
    summary,
    action: explicitAction || null,
    blocker: explicitBlocker || null,
  }
}

function extractRecentUpdates(meetingNotes?: string | null, limit = 2): ParsedUpdate[] {
  const text = (meetingNotes ?? '').replace(/\r/g, '').trim()
  if (!text) return []
  const entries = text
    .split(/\n---\n+/)
    .map(segment => segment.trim())
    .filter(Boolean)
  if (entries.length === 0) return []
  return entries
    .slice(-Math.max(1, limit))
    .map(parseUpdateEntry)
    .filter((value): value is ParsedUpdate => Boolean(value))
}

export function isActionableNextStep(value: string): boolean {
  if (!value) return false
  const text = value.trim().toLowerCase()
  if (!text) return false
  if (
    /(sent|completed|complete|updated|recap|summary only|meeting notes|already done|done)/i.test(text)
    && !/^(complete|finalize|finalise|close|confirm)\b/i.test(text)
  ) {
    return false
  }
  return ACTION_VERBS.some(verb => text.startsWith(verb))
}

function extractNextAction(
  meetingAction: string,
  nextSteps: string | null | undefined,
  latestSummary: string,
): string | null {
  const primaryAction = firstSentence(meetingAction, 150)
  if (primaryAction && isActionableNextStep(primaryAction)) return primaryAction

  const next = firstSentence(nextSteps, 150)
  if (next && isActionableNextStep(next)) return next

  const inline = latestSummary.match(/(?:next step(?:s)?(?: is|:)?|agreed to)\s+([^.;]+)/i)?.[1]
  const inlineAction = firstSentence(inline, 140)
  if (inlineAction && isActionableNextStep(inlineAction)) return inlineAction

  return null
}

function inferBlocker(
  explicitBlocker: string,
  dealRisks: unknown,
  latestText: string,
): string | null {
  const blocker = firstSentenceUnbounded(explicitBlocker)
  if (blocker && !/(^none$|no blockers?|nothing blocking|clear path)/i.test(blocker)) return blocker

  const inlineBlocker = firstSentenceUnbounded(
    latestText.match(/(?:blocker(?: is|:)?|risk(?: is|:)?|held up by)\s+([^.;]+)/i)?.[1],
  )
  if (inlineBlocker && !/(^none$|no blockers?|nothing blocking|clear path)/i.test(inlineBlocker)) {
    return inlineBlocker
  }

  if (latestText.trim().length > 0) {
    return null
  }

  if (Array.isArray(dealRisks) && dealRisks.length > 0) {
    const firstRisk = firstSentenceUnbounded(String(dealRisks[0]))
    if (firstRisk && !/(^none$|no blockers?|clear path)/i.test(firstRisk)) return firstRisk
  }

  return null
}

export function buildDealSnapshot(source: SnapshotSource): DealSnapshot {
  const recentUpdates = extractRecentUpdates(source.meetingNotes, 2)
  const latestUpdateObj = recentUpdates.length > 0 ? recentUpdates[recentUpdates.length - 1] : null
  const previousUpdateObj = recentUpdates.length > 1 ? recentUpdates[recentUpdates.length - 2] : null
  const latestEntry = extractLatestMeetingEntry(source.meetingNotes)
  const latestEntryText = latestEntry?.content ?? ''
  const sections = splitEntrySections(latestEntryText)

  const latestUpdate =
    latestUpdateObj?.summary
    || firstSentenceUnbounded(sections.summary)
    || firstSentenceUnbounded(latestEntryText)
    || firstSentenceUnbounded(source.nextSteps)
    || firstSentenceUnbounded(source.notes)
    || firstSentenceUnbounded(source.aiSummary)
    || null
  const previousUpdate = previousUpdateObj?.summary ?? null

  const whereWeAre =
    latestUpdate && previousUpdate
    ? clipAtWord(`${latestUpdate} Before that: ${previousUpdate}`, 260)
    : latestUpdate
    || firstSentence(source.aiSummary, 160)
    || `In ${toStageLabel(source.stage)} stage with no recent activity logged`

  const nextAction = extractNextAction(
    latestUpdateObj?.action ?? sections.action,
    source.nextSteps,
    latestUpdate ?? '',
  )
  const blocker = inferBlocker(
    latestUpdateObj?.blocker ?? sections.blocker,
    source.dealRisks,
    [latestUpdate, source.nextSteps, source.aiSummary].filter(Boolean).join(' '),
  )

  return {
    whereWeAre,
    latestUpdate,
    previousUpdate,
    recentUpdates: recentUpdates.map(update => ({ dateLabel: update.dateLabel, summary: update.summary })),
    nextAction,
    blocker,
    latestDateLabel: latestUpdateObj?.dateLabel ?? latestEntry?.dateLabel ?? null,
  }
}
