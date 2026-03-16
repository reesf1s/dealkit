/**
 * Text Signal Extractor — pure deterministic NLP for sales deal notes.
 *
 * Replaces the LLM as the source of deal health signals. The ML engine
 * trains on these objective features instead of a circular dependency
 * on the LLM's own scoring output.
 *
 * No external calls. No randomness. Same input → same output every time.
 * This is pure IP: the signal vocabulary and weighting is workspace-agnostic
 * but the patterns it learns are entirely workspace-specific.
 */

// ─── Signal vocabularies ──────────────────────────────────────────────────────

// Positive deal health signals
const POSITIVE: string[] = [
  'excited', 'committed', 'moving forward', 'approved', 'agreed', 'confirmed',
  'ready to', 'ready to sign', 'champion', 'sponsor', 'budget approved',
  'budget allocated', 'budget confirmed', 'high priority', 'top priority',
  'green light', 'sign off', 'signed off', 'go ahead', 'great fit',
  'love it', 'exactly what', 'perfectly aligned', 'impressed', 'strong fit',
  'reference call', 'next steps agreed', 'ceo confirmed', 'board approved',
  'implementation started', 'contract review', 'legal approved', 'po raised',
  'purchase order', 'eager', 'enthusiastic', 'very interested', 'keen to',
]

// Negative deal health / risk signals
const NEGATIVE: string[] = [
  'budget freeze', 'budget cut', 'no budget', 'headcount freeze',
  'not sure', 'reconsidering', 'delay', 'postpone', 'no decision',
  'on hold', 'not a priority', 'low priority', 'too expensive',
  'cost concern', 'roi unclear', 'no response', 'ghosted', 'gone quiet',
  'not responding', 'dark', 'evaluating others', 'going with another',
  'went with', 'pushback', 'escalated concern', 'blocker',
  'legal hold', 'procurement issue', 'lost', 'cancelled', 'closed out',
  'walking away', 'killing the deal', 'no longer interested',
  'passed on', 'competitor chosen',
]

// Urgency / time pressure signals
const URGENCY: string[] = [
  'urgent', 'asap', 'immediately', 'end of quarter', 'end of year',
  'eoy', 'eoq', 'deadline', 'must go live', 'need to launch',
  'launch date', 'go-live', 'this month', 'this quarter', 'within 30',
  'within 60', 'before q', 'before end of', 'time sensitive',
]

// Decision-maker presence signals
const DECISION_MAKER: string[] = [
  'ceo', 'cfo', 'cto', 'coo', 'president', 'managing director', 'md ',
  'vp ', 'svp', 'evp', 'chief ', 'head of ', 'director of ',
  'board', 'exec team', 'executive team', 'decision maker',
  'final approval', 'sign off authority', 'ultimate decision',
  'sponsor', 'executive sponsor', 'steering committee',
]

// Budget confirmation signals (distinct from generic mentions)
const BUDGET_CONFIRMED: string[] = [
  'budget confirmed', 'budget approved', 'budget allocated', 'budget signed off',
  'funding approved', 'funds available', 'financially approved', 'po raised',
  'purchase order', 'finance approved', 'signed budget', 'committed budget',
]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TextSignals {
  engagementScore:     number   // 0–1: note recency × volume. Decays without activity.
  sentimentScore:      number   // 0–1: ratio of positive to all sentiment words. 0.5 = neutral.
  urgencyScore:        number   // 0–1: urgency language density.
  decisionMakerSignal: boolean  // true if a decision-maker is mentioned in notes.
  budgetConfirmed:     boolean  // true if budget is explicitly confirmed (not just mentioned).
  objectionCount:      number   // number of distinct negative signals detected.
  noteCount:           number   // number of structured note entries.
  daysSinceLastNote:   number   // days since last meeting/update.
  /** Composite 0–1 feature for ML engine. Replaces `ai_confidence`. */
  textEngagement:      number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countMatches(text: string, vocab: string[]): number {
  let n = 0
  for (const phrase of vocab) {
    if (text.includes(phrase)) n++
  }
  return n
}

/** Split structured meeting notes (entries beginning with a date) into individual entries. */
function parseMeetingEntries(notes: string): { text: string; date: Date | null }[] {
  if (!notes?.trim()) return []
  // Split on lines that start a new dated entry: "[15 Mar 2025]", "2025-03-15", "March 15, 2025"
  const parts = notes.split(/(?=\n?\[?\d{4}[-/]\d{1,2}[-/]\d{1,2}|\n?\[?\d{1,2}\s+\w{3,9}\s+\d{4})/)
  return parts
    .map(part => {
      const trimmed = part.trim()
      if (trimmed.length < 10) return null
      const m = trimmed.match(/\[?(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\s+\w+\s+\d{4})\]?/)
      const date = m ? (() => { try { return new Date(m[1]) } catch { return null } })() : null
      return { text: trimmed.toLowerCase(), date }
    })
    .filter((e): e is { text: string; date: Date | null } => e !== null)
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function extractTextSignals(
  meetingNotes: string | null | undefined,
  dealCreatedAt: Date | string,
  dealUpdatedAt: Date | string,
): TextSignals {
  const now = Date.now()
  const createdMs = new Date(dealCreatedAt).getTime()
  const updatedMs = new Date(dealUpdatedAt).getTime()
  const text = (meetingNotes ?? '').toLowerCase()
  const entries = parseMeetingEntries(text)

  // ── Engagement: recency × volume ────────────────────────────────────────────
  const noteCount = entries.length
  // Find most recent entry with a valid date
  const latestEntry = entries
    .filter(e => e.date && !isNaN(e.date.getTime()))
    .sort((a, b) => b.date!.getTime() - a.date!.getTime())[0]
  const lastNoteMs  = latestEntry?.date?.getTime() ?? updatedMs
  const daysSinceLastNote = Math.max(0, (now - lastNoteMs) / 86_400_000)
  const recencyScore  = Math.max(0, 1 - daysSinceLastNote / 21)  // full score if updated today; 0 after 21 days
  const volumeScore   = Math.min(1, noteCount / 5)                // caps at 5 entries
  const engagementScore = recencyScore * 0.65 + volumeScore * 0.35

  // ── Sentiment ───────────────────────────────────────────────────────────────
  const positiveCount = countMatches(text, POSITIVE)
  const negativeCount = countMatches(text, NEGATIVE)
  const totalSentiment = positiveCount + negativeCount
  const sentimentScore = totalSentiment > 0
    ? positiveCount / totalSentiment
    : 0.5  // neutral if no sentiment language

  // ── Urgency ─────────────────────────────────────────────────────────────────
  const urgencyCount = countMatches(text, URGENCY)
  const urgencyScore = Math.min(1, urgencyCount / 3)

  // ── Boolean signals ─────────────────────────────────────────────────────────
  const decisionMakerSignal = countMatches(text, DECISION_MAKER) > 0
  const budgetConfirmed     = countMatches(text, BUDGET_CONFIRMED) > 0
  const objectionCount      = negativeCount

  // ── Composite `textEngagement` for ML feature slot ──────────────────────────
  // Weighted blend designed to track the same construct as ai_confidence
  // but without circular LLM dependency.
  const textEngagement = Math.min(1,
    engagementScore        * 0.35 +
    sentimentScore         * 0.30 +
    urgencyScore           * 0.10 +
    (decisionMakerSignal ? 0.15 : 0) +
    (budgetConfirmed     ? 0.10 : 0)
  )

  return {
    engagementScore,
    sentimentScore,
    urgencyScore,
    decisionMakerSignal,
    budgetConfirmed,
    objectionCount,
    noteCount,
    daysSinceLastNote,
    textEngagement,
  }
}

/**
 * Compute a heuristic deal score (0–100) from text signals alone.
 * Used when no ML model is available yet (fewer than 6 closed deals).
 * Fully deterministic — no LLM required.
 */
export function heuristicScore(signals: TextSignals): number {
  let score = 40  // baseline: uncertain
  score += signals.sentimentScore   * 25   // strong positive language pushes toward 65
  score += signals.engagementScore  * 20   // active, recent engagement
  score += (signals.decisionMakerSignal ? 10 : 0)
  score += (signals.budgetConfirmed     ?  8 : 0)
  score += signals.urgencyScore         *  5
  score -= Math.min(signals.objectionCount * 6, 20)  // each objection docks 6pts, capped at -20
  return Math.max(0, Math.min(100, Math.round(score)))
}
