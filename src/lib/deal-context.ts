// ─────────────────────────────────────────────────────────────────────────────
// deal-context.ts — Client-safe types and utilities
// NO server imports (db, drizzle, fs, net) — safe for browser bundles
// ─────────────────────────────────────────────────────────────────────────────

export interface DealContext {
  // Core
  id: string
  name: string
  company: string
  stage: string
  dealValue: number
  dealType: string | null
  currency: string

  // Outcome
  outcome: 'won' | 'lost' | null
  isClosed: boolean
  closeDate: string | null
  wonDate: string | null
  lostDate: string | null
  lossReason: string | null

  // Computed
  dealAgeDays: number
  daysSinceLastNote: number

  // Score
  compositeScore: number
  scoreColor: string

  // Signals
  championIdentified: boolean
  budgetConfirmed: boolean
  nextStepDefined: boolean
  competitorsPresent: string[]
  sentimentRecent: number
  momentum: number

  // Activity
  noteCount: number
  lastNoteDate: string | null
  lastNoteSummary: string | null
  openActionCount: number
  completedActionCount: number
  recentCompletedActions: string[]

  // Calendar events
  upcomingEvents: { type: string; title: string; date: string; time: string | null }[]

  // Contacts
  contacts: { name: string; role: string; email?: string }[]
}

// Score color — THE one function everyone uses
export function getScoreColor(score: number, isClosed: boolean): string {
  if (isClosed) return 'var(--ds-text-3, #6B7280)'
  if (score >= 70) return 'var(--ds-green, #3CCB7F)'
  if (score >= 40) return 'var(--ds-amber, #F59E0B)' // More orange, more distinct from red/green
  return 'var(--ds-red, #E5484D)'
}

export function getScoreDisplay(ctx: Pick<DealContext, 'isClosed' | 'outcome' | 'compositeScore'>): { text: string; color: string } {
  if (ctx.isClosed) {
    return {
      text: ctx.outcome === 'won' ? 'Won' : 'Lost',
      color: ctx.outcome === 'won' ? 'var(--ds-green, #3CCB7F)' : 'var(--ds-red, #E5484D)',
    }
  }
  return {
    text: `${ctx.compositeScore}%`,
    color: getScoreColor(ctx.compositeScore, false),
  }
}

/**
 * Convert raw deal data (from API/SWR) into a DealContext.
 * Client-safe — no DB access. Pass the deal object you already have.
 */
export function rawDealToContext(deal: any): DealContext {
  const now = Date.now()
  const isClosed = deal.stage === 'closed_won' || deal.stage === 'closed_lost'
  const outcome: 'won' | 'lost' | null = deal.outcome === 'won' ? 'won'
    : deal.outcome === 'lost' ? 'lost'
    : deal.stage === 'closed_won' ? 'won'
    : deal.stage === 'closed_lost' ? 'lost'
    : null

  // Parse intent signals
  const intentSignals = (deal.intentSignals as any) || {}
  const championIdentified = intentSignals.championStatus === 'confirmed'
  const budgetConfirmed = intentSignals.budgetStatus === 'confirmed' || intentSignals.budgetStatus === 'approved'

  // Parse todos for action counts
  const todos = (deal.todos as any[]) || []
  const openActions = todos.filter((t: any) => !t.done)
  const completedActions = todos.filter((t: any) => t.done)

  // Parse contacts
  const contacts = ((deal.contacts as any[]) || []).map((c: any) => ({
    name: c.name || 'Unknown',
    role: c.role || c.title || '',
    email: c.email,
  }))

  // Parse scheduled events
  const scheduledEvents = (deal.scheduledEvents as any[]) || []
  const upcomingEvents = scheduledEvents
    .filter((e: any) => e.date && new Date(e.date).getTime() >= now - 86400000)
    .map((e: any) => ({
      type: e.type || 'meeting',
      title: e.description || e.title || 'Event',
      date: e.date,
      time: e.time || null,
    }))

  // Parse competitors
  const competitors = ((deal.competitors as any[]) || []).map((c: any) =>
    typeof c === 'string' ? c : c.name || String(c)
  )

  // Days since last note — use updatedAt as proxy on client
  let daysSinceLastNote = 999
  let lastNoteDate: string | null = null
  if (deal.updatedAt) {
    lastNoteDate = new Date(deal.updatedAt).toISOString()
    daysSinceLastNote = Math.floor((now - new Date(deal.updatedAt).getTime()) / 86400000)
  }

  const momentum = intentSignals.momentum ?? 0.5
  const sentiment = intentSignals.sentiment ?? 0.5
  const compositeScore = deal.conversionScore ?? 0

  return {
    id: deal.id,
    name: deal.dealName || 'Untitled',
    company: deal.prospectCompany || '',
    stage: deal.stage || 'prospecting',
    dealValue: deal.dealValue ?? 0,
    dealType: deal.dealType || null,
    currency: 'GBP',
    outcome,
    isClosed,
    closeDate: deal.closeDate ? new Date(deal.closeDate).toISOString() : null,
    wonDate: deal.wonDate ? new Date(deal.wonDate).toISOString() : null,
    lostDate: deal.lostDate ? new Date(deal.lostDate).toISOString() : null,
    lossReason: deal.lostReason || null,
    dealAgeDays: deal.createdAt ? Math.floor((now - new Date(deal.createdAt).getTime()) / 86400000) : 0,
    daysSinceLastNote,
    compositeScore,
    scoreColor: getScoreColor(compositeScore, isClosed),
    championIdentified,
    budgetConfirmed,
    nextStepDefined: !!(deal.nextSteps?.trim()),
    competitorsPresent: competitors,
    sentimentRecent: sentiment,
    momentum,
    noteCount: 0, // Not available client-side without parsing
    lastNoteDate,
    lastNoteSummary: deal.aiSummary ? String(deal.aiSummary).slice(0, 200) : null,
    openActionCount: openActions.length,
    completedActionCount: completedActions.length,
    recentCompletedActions: completedActions.slice(-5).map((t: any) => t.text || ''),
    upcomingEvents,
    contacts,
  }
}
