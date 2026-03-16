/**
 * Text Signal Extractor — pure deterministic NLP for sales deal notes.
 *
 * v2 — Extended signal set:
 *   Core:      engagement, sentiment, urgency, DM signal, budget, objectionCount
 *   New:       momentumScore, objectionCategories, stakeholderDepth, nextStepDefined,
 *              engagementVelocity, championStrength
 *   Composite: textEngagement (ML feature — replaces ai_confidence)
 *
 * Also exports:
 *   analyzeDeterioration()  — splits notes into early/recent halves, detects declining health
 *   heuristicScore()        — 0–100 deal score when no ML model is available
 *
 * No external calls. No randomness. Same input → same output every time.
 */

// ─── Signal vocabularies ──────────────────────────────────────────────────────

const POSITIVE: string[] = [
  'excited', 'committed', 'moving forward', 'approved', 'agreed', 'confirmed',
  'ready to', 'ready to sign', 'champion', 'sponsor', 'budget approved',
  'budget allocated', 'budget confirmed', 'high priority', 'top priority',
  'green light', 'sign off', 'signed off', 'go ahead', 'great fit',
  'love it', 'exactly what', 'perfectly aligned', 'impressed', 'strong fit',
  'reference call', 'next steps agreed', 'ceo confirmed', 'board approved',
  'implementation started', 'contract review', 'legal approved', 'po raised',
  'purchase order', 'eager', 'enthusiastic', 'very interested', 'keen to',
  'fantastic', 'excellent progress', 'really excited', 'huge opportunity',
  'strong interest', 'pushing forward', 'accelerating', 'wants to proceed',
]

const NEGATIVE: string[] = [
  'budget freeze', 'budget cut', 'no budget', 'headcount freeze',
  'not sure', 'reconsidering', 'delay', 'postpone', 'no decision',
  'on hold', 'not a priority', 'low priority', 'too expensive',
  'cost concern', 'roi unclear', 'no response', 'ghosted', 'gone quiet',
  'not responding', 'dark', 'evaluating others', 'going with another',
  'went with', 'pushback', 'escalated concern', 'blocker',
  'legal hold', 'procurement issue', 'lost', 'cancelled', 'closed out',
  'walking away', 'killing the deal', 'no longer interested',
  'passed on', 'competitor chosen', 'missed meeting', 'no show',
  'falling away', 'cooling off', 'deprioritised', 'deprioritized',
]

const URGENCY: string[] = [
  'urgent', 'asap', 'immediately', 'end of quarter', 'end of year',
  'eoy', 'eoq', 'deadline', 'must go live', 'need to launch',
  'launch date', 'go-live', 'this month', 'this quarter', 'within 30',
  'within 60', 'before q', 'before end of', 'time sensitive',
  'critical date', 'hard deadline', 'locked in date', 'board date',
]

const DECISION_MAKER: string[] = [
  'ceo', 'cfo', 'cto', 'coo', 'president', 'managing director', 'md ',
  'vp ', 'svp', 'evp', 'chief ', 'head of ', 'director of ',
  'board', 'exec team', 'executive team', 'decision maker',
  'final approval', 'sign off authority', 'ultimate decision',
  'sponsor', 'executive sponsor', 'steering committee',
]

const BUDGET_CONFIRMED: string[] = [
  'budget confirmed', 'budget approved', 'budget allocated', 'budget signed off',
  'funding approved', 'funds available', 'financially approved', 'po raised',
  'purchase order', 'finance approved', 'signed budget', 'committed budget',
]

// ─── Extended vocabularies ────────────────────────────────────────────────────

/** Explicit next-step / action signals — deal has clear forward momentum */
const NEXT_STEP_PHRASES: string[] = [
  'next step', 'next steps', 'action item', 'action items', 'follow up', 'follow-up',
  'schedule a', 'book a call', 'book a meeting', 'book a demo', 'arranged a',
  'meeting scheduled', 'demo booked', 'call booked', 'proposal due', 'will send',
  'to send over', 'presenting on', 'due by', 'agreed to send', 'will arrange',
  'will schedule', 'agreed next', 'confirmed next', 'action:', 'todo:', 'to-do:',
]

/** Strong champion / internal advocate signals */
const CHAMPION_SIGNALS: string[] = [
  'internal champion', 'executive sponsor confirmed', 'strong advocate',
  'advocating for us', 'pushing for us', 'fighting our corner',
  'fully committed', 'going to bat', 'selling internally',
  'internal buy-in', 'loves the product', 'loves the solution', 'believes in us',
  'pushing this through', 'making the case for us', 'presenting to the board for us',
  'will champion', 'is our champion', 'very vocal supporter',
]

// Objection category vocabularies
const OBJECTION_BUDGET: string[] = [
  'budget freeze', 'budget cut', 'no budget', 'too expensive', 'cost concern',
  'over budget', 'can\'t afford', 'financial constraints', 'limited budget',
  'tight budget', 'no funds', 'funding issue', 'cost too high', 'roi unclear',
  'not financially approved', 'waiting on budget', 'budget not confirmed',
]

const OBJECTION_TIMING: string[] = [
  'not right now', 'bad timing', 'wrong time', 'next quarter', 'next year',
  'on hold', 'paused', 'frozen', 'not yet', 'too soon', 'later this year',
  'timing not right', 'let\'s revisit', 'come back to', 'after the holidays',
  'after budget', 'after the merger', 'after the restructure', 'timing issue',
]

const OBJECTION_AUTHORITY: string[] = [
  'not my decision', 'need approval', 'need sign-off', 'above my pay grade',
  'need to check with', 'committee decision', 'board decision', 'can\'t approve',
  'not authorised', 'waiting on approval', 'need buy-in', 'group decision',
  'others involved', 'multiple decision makers', 'stakeholder alignment needed',
]

const OBJECTION_COMPETITOR: string[] = [
  'evaluating others', 'going with another', 'competitor chosen', 'went with',
  'passed on', 'already using', 'current provider', 'other vendors', 'shortlisted others',
  'comparing with', 'also looking at', 'alternative solution', 'rfp', 'rft', 'tender',
]

const OBJECTION_VALUE: string[] = [
  'roi unclear', 'not sure of the value', 'can\'t see the benefit', 'not convinced',
  'prove roi', 'unclear benefit', 'marginal benefit', 'nice to have', 'not essential',
  'not compelling', 'need to justify', 'don\'t see the need', 'questionable value',
  'unclear how this helps', 'not a must have', 'low priority use case',
]

// Stakeholder type vocabularies (for breadth scoring)
const STAKEHOLDER_EXEC: string[]        = ['ceo', 'coo', 'managing director', ' md ', 'president', ' board', 'exec team', 'executive team', 'chief executive']
const STAKEHOLDER_FINANCE: string[]     = ['cfo', 'finance director', 'finance manager', 'finance team', 'treasurer', 'head of finance', 'vp finance', 'controller', 'financial controller']
const STAKEHOLDER_TECH: string[]        = ['cto', 'it director', 'head of it', 'it team', 'engineering', 'vp engineering', 'head of technology', 'it manager', 'technical lead']
const STAKEHOLDER_LEGAL: string[]       = ['legal team', 'counsel', 'general counsel', 'lawyer', 'legal review', 'compliance team', 'data protection', 'legal department']
const STAKEHOLDER_PROCUREMENT: string[] = ['procurement', 'purchasing', 'sourcing team', 'vendor management', 'supply chain', 'category manager', 'procurement team']
const STAKEHOLDER_COMMERCIAL: string[]  = ['vp sales', 'sales director', 'commercial director', 'chief revenue', 'head of sales', 'revenue team', 'commercial team', 'head of commercial']

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ObjectionCategories {
  budget:     boolean   // budget/cost objections detected
  timing:     boolean   // timing/delay objections detected
  authority:  boolean   // approval/authority gaps detected
  competitor: boolean   // competitor preference signals detected
  value:      boolean   // ROI/value uncertainty detected
}

export interface TextSignals {
  // ── Core signals (v1) ──────────────────────────────────────────────────────
  engagementScore:     number    // 0–1: note recency × volume
  sentimentScore:      number    // 0–1: positive / (positive+negative). 0.5 = neutral.
  urgencyScore:        number    // 0–1: urgency language density
  decisionMakerSignal: boolean   // true if a decision-maker is mentioned
  budgetConfirmed:     boolean   // true if budget is explicitly confirmed
  objectionCount:      number    // distinct negative signals detected
  noteCount:           number    // number of structured note entries
  daysSinceLastNote:   number    // days since last meeting/update
  /** Composite 0–1 for ML engine. Replaces `ai_confidence`. No circular LLM dependency. */
  textEngagement:      number

  // ── Extended signals (v2) ─────────────────────────────────────────────────
  /** 0–1: sentiment trend. >0.5 = building, <0.5 = declining. 0.5 = stable/unknown. */
  momentumScore:       number
  /** Structured breakdown of objection categories present in notes. */
  objectionCategories: ObjectionCategories
  /** 0–1: breadth of stakeholder types engaged (6 categories). */
  stakeholderDepth:    number
  /** true if notes mention a concrete next step or action item. */
  nextStepDefined:     boolean
  /** Whether note frequency is increasing, steady, or decreasing over time. */
  engagementVelocity:  'accelerating' | 'steady' | 'decelerating'
  /** 0–1: composite champion/sponsor/advocate signal strength. */
  championStrength:    number
}

export interface DeteriorationAnalysis {
  isDeteriorating:  boolean   // true if recent sentiment is meaningfully lower than early
  earlySentiment:   number    // 0–1 avg sentiment in first half of notes
  recentSentiment:  number    // 0–1 avg sentiment in second half of notes
  delta:            number    // recentSentiment − earlySentiment (negative = bad)
  warning:          string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countMatches(text: string, vocab: string[]): number {
  let n = 0
  for (const phrase of vocab) {
    if (text.includes(phrase)) n++
  }
  return n
}

function hasAny(text: string, vocab: string[]): boolean {
  return vocab.some(phrase => text.includes(phrase))
}

/** Split structured meeting notes (entries beginning with a date) into individual entries. */
function parseMeetingEntries(notes: string): { text: string; date: Date | null }[] {
  if (!notes?.trim()) return []
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

/** Compute 0–1 sentiment for a set of note entries. */
function sentimentForEntries(entries: { text: string }[]): number {
  if (entries.length === 0) return 0.5
  const combined = entries.map(e => e.text).join(' ')
  const pos = countMatches(combined, POSITIVE)
  const neg = countMatches(combined, NEGATIVE)
  const total = pos + neg
  return total > 0 ? pos / total : 0.5
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function extractTextSignals(
  meetingNotes: string | null | undefined,
  dealCreatedAt: Date | string,
  dealUpdatedAt: Date | string,
): TextSignals {
  const now = Date.now()
  const updatedMs = new Date(dealUpdatedAt).getTime()
  const text = (meetingNotes ?? '').toLowerCase()
  const entries = parseMeetingEntries(text)

  // ── Engagement: recency × volume ────────────────────────────────────────────
  const noteCount = entries.length
  const datedEntries = entries
    .filter(e => e.date && !isNaN(e.date.getTime()))
    .sort((a, b) => a.date!.getTime() - b.date!.getTime())

  const latestEntry = datedEntries[datedEntries.length - 1] ?? null
  const lastNoteMs  = latestEntry?.date?.getTime() ?? updatedMs
  const daysSinceLastNote = Math.max(0, (now - lastNoteMs) / 86_400_000)
  const recencyScore  = Math.max(0, 1 - daysSinceLastNote / 21)
  const volumeScore   = Math.min(1, noteCount / 5)
  const engagementScore = recencyScore * 0.65 + volumeScore * 0.35

  // ── Sentiment ───────────────────────────────────────────────────────────────
  const positiveCount = countMatches(text, POSITIVE)
  const negativeCount = countMatches(text, NEGATIVE)
  const totalSentiment = positiveCount + negativeCount
  const sentimentScore = totalSentiment > 0 ? positiveCount / totalSentiment : 0.5

  // ── Urgency ─────────────────────────────────────────────────────────────────
  const urgencyCount = countMatches(text, URGENCY)
  const urgencyScore = Math.min(1, urgencyCount / 3)

  // ── Boolean signals ─────────────────────────────────────────────────────────
  const decisionMakerSignal = countMatches(text, DECISION_MAKER) > 0
  const budgetConfirmed     = countMatches(text, BUDGET_CONFIRMED) > 0
  const objectionCount      = negativeCount

  // ── Composite textEngagement (backward-compatible formula) ──────────────────
  const textEngagement = Math.min(1,
    engagementScore        * 0.35 +
    sentimentScore         * 0.30 +
    urgencyScore           * 0.10 +
    (decisionMakerSignal ? 0.15 : 0) +
    (budgetConfirmed     ? 0.10 : 0)
  )

  // ── Momentum: recent vs early sentiment ─────────────────────────────────────
  let momentumScore = 0.5
  if (datedEntries.length >= 4) {
    const mid = Math.floor(datedEntries.length / 2)
    const earlyHalf  = datedEntries.slice(0, mid)
    const recentHalf = datedEntries.slice(mid)
    const earlySent  = sentimentForEntries(earlyHalf)
    const recentSent = sentimentForEntries(recentHalf)
    // Map delta [-1,+1] → [0,1] around 0.5
    momentumScore = Math.max(0, Math.min(1, 0.5 + (recentSent - earlySent)))
  } else if (entries.length >= 2) {
    // Not enough dated entries — use undated split
    const mid = Math.floor(entries.length / 2)
    const earlySent  = sentimentForEntries(entries.slice(0, mid))
    const recentSent = sentimentForEntries(entries.slice(mid))
    momentumScore = Math.max(0, Math.min(1, 0.5 + (recentSent - earlySent)))
  }

  // ── Objection categories ────────────────────────────────────────────────────
  const objectionCategories: ObjectionCategories = {
    budget:     hasAny(text, OBJECTION_BUDGET),
    timing:     hasAny(text, OBJECTION_TIMING),
    authority:  hasAny(text, OBJECTION_AUTHORITY),
    competitor: hasAny(text, OBJECTION_COMPETITOR),
    value:      hasAny(text, OBJECTION_VALUE),
  }

  // ── Stakeholder depth (breadth across 6 functional areas) ───────────────────
  const stakeholderCategories = [
    STAKEHOLDER_EXEC, STAKEHOLDER_FINANCE, STAKEHOLDER_TECH,
    STAKEHOLDER_LEGAL, STAKEHOLDER_PROCUREMENT, STAKEHOLDER_COMMERCIAL,
  ]
  const matchedCategories = stakeholderCategories.filter(cat => hasAny(text, cat)).length
  const stakeholderDepth = matchedCategories / stakeholderCategories.length

  // ── Next step defined ───────────────────────────────────────────────────────
  const nextStepDefined = hasAny(text, NEXT_STEP_PHRASES)

  // ── Engagement velocity ─────────────────────────────────────────────────────
  let engagementVelocity: 'accelerating' | 'steady' | 'decelerating' = 'steady'
  if (datedEntries.length >= 4) {
    const mid = Math.floor(datedEntries.length / 2)
    const earlyCount  = mid
    const recentCount = datedEntries.length - mid
    // Normalise by time span of each half to account for uneven periods
    const earlySpanDays  = Math.max(1, (datedEntries[mid - 1]!.date!.getTime() - datedEntries[0]!.date!.getTime()) / 86_400_000)
    const recentSpanDays = Math.max(1, (datedEntries[datedEntries.length - 1]!.date!.getTime() - datedEntries[mid]!.date!.getTime()) / 86_400_000)
    const earlyRate  = earlyCount  / earlySpanDays
    const recentRate = recentCount / recentSpanDays
    if (recentRate > earlyRate * 1.4)      engagementVelocity = 'accelerating'
    else if (recentRate < earlyRate * 0.6) engagementVelocity = 'decelerating'
  }

  // ── Champion strength ───────────────────────────────────────────────────────
  const hasChampionPhrase = hasAny(text, CHAMPION_SIGNALS)
  const sentimentBonus    = sentimentScore > 0.7 ? 1 : sentimentScore > 0.55 ? 0.5 : 0
  const championStrength  = Math.min(1,
    (hasChampionPhrase ? 0.40 : 0) +
    (decisionMakerSignal ? 0.25 : 0) +
    (budgetConfirmed     ? 0.20 : 0) +
    sentimentBonus       * 0.15
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
    momentumScore,
    objectionCategories,
    stakeholderDepth,
    nextStepDefined,
    engagementVelocity,
    championStrength,
  }
}

// ─── Deterioration detector ───────────────────────────────────────────────────

/**
 * Compares sentiment in the first vs second half of a deal's note history.
 * A meaningful decline (> 15pp) indicates a deal deteriorating over time.
 * Call for any deal with 4+ dated entries.
 */
export function analyzeDeterioration(
  meetingNotes: string | null | undefined,
): DeteriorationAnalysis {
  const text = (meetingNotes ?? '').toLowerCase()
  const entries = parseMeetingEntries(text)
  const dated   = entries
    .filter(e => e.date && !isNaN(e.date.getTime()))
    .sort((a, b) => a.date!.getTime() - b.date!.getTime())

  if (dated.length < 4) {
    return { isDeteriorating: false, earlySentiment: 0.5, recentSentiment: 0.5, delta: 0, warning: null }
  }

  const mid            = Math.floor(dated.length / 2)
  const earlySentiment = sentimentForEntries(dated.slice(0, mid))
  const recentSentiment= sentimentForEntries(dated.slice(mid))
  const delta          = recentSentiment - earlySentiment
  const isDeteriorating = delta < -0.15

  const warning = isDeteriorating
    ? `Signals declining: recent notes (${Math.round(recentSentiment * 100)}% positive) vs earlier notes (${Math.round(earlySentiment * 100)}% positive) — deal may be at risk`
    : null

  return { isDeteriorating, earlySentiment, recentSentiment, delta, warning }
}

// ─── Heuristic score ──────────────────────────────────────────────────────────

/**
 * Compute a heuristic deal score (0–100) from text signals alone.
 * Used when no ML model is available yet (fewer than 6 closed deals).
 * Fully deterministic — no LLM required.
 */
export function heuristicScore(signals: TextSignals): number {
  let score = 40  // baseline: uncertain

  // Core signals
  score += signals.sentimentScore  * 22
  score += signals.engagementScore * 18
  score += (signals.decisionMakerSignal ? 9  : 0)
  score += (signals.budgetConfirmed     ? 8  : 0)
  score += signals.urgencyScore         * 5

  // Extended signals (v2)
  score += (signals.momentumScore - 0.5) * 12  // +6 if building, -6 if declining
  score += signals.championStrength       * 9
  score += (signals.nextStepDefined       ? 4  : 0)
  score += signals.stakeholderDepth       * 5
  score += (signals.engagementVelocity === 'accelerating' ? 3  : 0)

  // Objection penalties
  score -= Math.min(signals.objectionCount * 4, 16)
  score -= (signals.objectionCategories.budget     ? 5  : 0)
  score -= (signals.objectionCategories.authority  ? 3  : 0)
  score -= (signals.objectionCategories.competitor ? 2  : 0)
  score -= (signals.engagementVelocity === 'decelerating' ? 5 : 0)

  return Math.max(0, Math.min(100, Math.round(score)))
}
