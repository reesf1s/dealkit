import { parseMeetingEntries } from '@/lib/text-signals'
import type { WorkspaceBrain } from '@/lib/workspace-brain'

const MS_PER_DAY = 86_400_000

export type NoteSourceFields = {
  meetingNotes?: string | null
  hubspotNotes?: string | null
  notes?: string | null
}

export type DatedNoteEntry = {
  text: string
  date: Date
}

export type BriefingNoteFocus = {
  latestEntries: DatedNoteEntry[]
  outstandingEntries: DatedNoteEntry[]
  legacyContext: string | null
  preferredNotes: string
}

const OUTSTANDING_THEME_PATTERNS: Array<{ theme: string; pattern: RegExp }> = [
  { theme: 'budget', pattern: /\b(budget|funding|finance|commercial approval|pricing|commercials?)\b/i },
  { theme: 'legal', pattern: /\b(legal|msa|dpa|redlines?|contract|procurement)\b/i },
  { theme: 'security', pattern: /\b(security|infosec|compliance|soc2|data residency|data room)\b/i },
  { theme: 'technical', pattern: /\b(integration|api|implementation|migration|sso|directory|headcount|hierarchy|floorplan|deployment)\b/i },
  { theme: 'stakeholder', pattern: /\b(champion|sponsor|stakeholder|buyer|sign[- ]?off|approval|decision maker|committee)\b/i },
  { theme: 'competitor', pattern: /\b(competitor|salesforce|hubspot|microsoft|alternative|evaluation)\b/i },
  { theme: 'timeline', pattern: /\b(deadline|go-live|timeline|quarter|month-end|close date|decision date)\b/i },
]

const OUTSTANDING_MARKERS =
  /\b(blocked|blocker|pending|awaiting|waiting|stalled|delayed|stuck|risk|issue|concern|challenge|needs|need|requires|review|approval|sign[- ]?off|redlines?|procurement|security review|budget review|not confirmed|not approved|evaluation|decision pending|follow[- ]?up required|outstanding)\b/i

const RESOLVED_MARKERS =
  /\b(resolved|done|complete|completed|implemented|delivered|live|shipped|approved|signed|booked|confirmed|scheduled|working|closed|rolled out|enabled|in place|on track)\b/i

function normalizeNoteText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function compactWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function stripDatePrefix(text: string): string {
  return compactWhitespace(text.replace(/^\[?\d{4}[-/]\d{1,2}[-/]\d{1,2}\]?\s*/, ''))
}

export function sentenceCase(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function buildStructuredNoteCorpus(fields: NoteSourceFields): string {
  return [fields.meetingNotes, fields.hubspotNotes]
    .map(normalizeNoteText)
    .filter(Boolean)
    .join('\n---\n')
}

export function buildPreferredNoteCorpus(fields: NoteSourceFields): string {
  const structured = buildStructuredNoteCorpus(fields)
  if (structured) return structured
  return normalizeNoteText(fields.notes)
}

export function extractDatedEntries(notes: string): DatedNoteEntry[] {
  return parseMeetingEntries(notes)
    .filter((entry): entry is { text: string; date: Date } => !!entry.date && !Number.isNaN(entry.date.getTime()))
    .sort((left, right) => right.date.getTime() - left.date.getTime())
}

function extractThemes(text: string): string[] {
  return OUTSTANDING_THEME_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ theme }) => theme)
}

function recentNotesResolveTheme(recentText: string, theme: string): boolean {
  const themePattern = OUTSTANDING_THEME_PATTERNS.find(item => item.theme === theme)?.pattern
  if (!themePattern) return false
  return themePattern.test(recentText) && RESOLVED_MARKERS.test(recentText)
}

function isOutstandingCandidate(text: string): boolean {
  return OUTSTANDING_MARKERS.test(text) && !RESOLVED_MARKERS.test(text)
}

export function daysSince(date: Date, nowMs = Date.now()): number {
  return Math.round((nowMs - date.getTime()) / MS_PER_DAY)
}

export function formatDatedNote(entry: DatedNoteEntry, nowMs = Date.now()): string {
  const summary = stripDatePrefix(entry.text).slice(0, 160)
  const age = daysSince(entry.date, nowMs)
  const dateLabel = entry.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${dateLabel} (${age}d ago): ${summary}`
}

export function buildBriefingNoteFocus(
  fields: NoteSourceFields,
  options?: { latestCount?: number; maxOutstanding?: number; legacyContextChars?: number },
): BriefingNoteFocus {
  const latestCount = options?.latestCount ?? 2
  const maxOutstanding = options?.maxOutstanding ?? 2
  const legacyContextChars = options?.legacyContextChars ?? 700

  const structuredNotes = buildStructuredNoteCorpus(fields)
  const preferredNotes = structuredNotes || buildPreferredNoteCorpus(fields)
  const datedEntries = extractDatedEntries(preferredNotes)
  const latestEntries = datedEntries.slice(0, latestCount)
  const recentText = latestEntries.map(entry => stripDatePrefix(entry.text).toLowerCase()).join(' ')

  const seenThemes = new Set<string>()
  const outstandingEntries = datedEntries
    .slice(latestCount)
    .filter(entry => {
      const clean = stripDatePrefix(entry.text)
      if (!isOutstandingCandidate(clean)) return false
      const themes = extractThemes(clean)
      if (themes.length === 0) return false
      if (themes.some(theme => recentNotesResolveTheme(recentText, theme))) return false
      const hasNewTheme = themes.some(theme => !seenThemes.has(theme))
      if (!hasNewTheme) return false
      themes.forEach(theme => seenThemes.add(theme))
      return true
    })
    .slice(0, maxOutstanding)

  const legacyContext = preferredNotes && datedEntries.length === 0
    ? preferredNotes.slice(-legacyContextChars)
    : null

  return {
    latestEntries,
    outstandingEntries,
    legacyContext,
    preferredNotes,
  }
}

export function buildNoteCentricBrainContext(
  brain: WorkspaceBrain | null,
  openDeals: Array<{ id: string; dealName: string; prospectCompany: string }>,
): string {
  if (!brain) return ''

  const dealLookup = new Map(openDeals.map(deal => [deal.id, deal]))
  const lines: string[] = []
  const deteriorationAlerts = brain.deteriorationAlerts ?? []
  const predictions = brain.mlPredictions ?? []

  if (brain.pipelineHealthIndex) {
    lines.push(`Pipeline health index: ${brain.pipelineHealthIndex.score}/100 (${brain.pipelineHealthIndex.interpretation}).`)
    lines.push(`Health insight: ${brain.pipelineHealthIndex.keyInsight}`)
  }

  if ((brain.topRisks ?? []).length > 0) {
    lines.push(`Top cross-pipeline risks: ${(brain.topRisks ?? []).slice(0, 4).join(' | ')}`)
  }

  if ((brain.keyPatterns ?? []).length > 0) {
    for (const pattern of brain.keyPatterns.slice(0, 3)) {
      lines.push(`Recurring pattern: ${pattern.label} — ${pattern.companies.slice(0, 3).join(', ')}`)
    }
  }

  if (deteriorationAlerts.length > 0) {
    for (const alert of deteriorationAlerts.slice(0, 3)) {
      lines.push(`Declining note sentiment: ${alert.dealName} (${alert.company}) — ${alert.warning}`)
    }
  }

  if (predictions.length > 0) {
    const highRisk = predictions
      .filter(prediction => (prediction.churnRisk ?? 0) >= 65)
      .sort((left, right) => (right.churnRisk ?? 0) - (left.churnRisk ?? 0))
      .slice(0, 4)

    for (const risk of highRisk) {
      const deal = dealLookup.get(risk.dealId)
      if (!deal) continue
      lines.push(`${deal.dealName} (${deal.prospectCompany}) — ${risk.churnRisk}% churn risk${risk.churnDaysOverdue ? `, ${risk.churnDaysOverdue}d since last contact` : ''}`)
    }
  }

  return lines.length > 0 ? `\n\nNOTE-CENTRIC INTELLIGENCE:\n${lines.map(line => `- ${line}`).join('\n')}` : ''
}
