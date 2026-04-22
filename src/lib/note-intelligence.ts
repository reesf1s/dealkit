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

export function daysSince(date: Date, nowMs = Date.now()): number {
  return Math.round((nowMs - date.getTime()) / MS_PER_DAY)
}

export function formatDatedNote(entry: DatedNoteEntry, nowMs = Date.now()): string {
  const summary = stripDatePrefix(entry.text).slice(0, 160)
  const age = daysSince(entry.date, nowMs)
  const dateLabel = entry.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${dateLabel} (${age}d ago): ${summary}`
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
