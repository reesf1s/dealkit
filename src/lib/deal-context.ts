import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { parseMeetingEntries } from '@/lib/text-signals'

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
  scoreColor: string  // hex color

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
  if (isClosed) return 'var(--text-tertiary)' // grey for closed deals
  if (score >= 70) return 'var(--success)'
  if (score >= 40) return 'var(--warning)'
  return 'var(--danger)'
}

export function getScoreDisplay(ctx: Pick<DealContext, 'isClosed' | 'outcome' | 'compositeScore'>): { text: string; color: string } {
  if (ctx.isClosed) {
    return {
      text: ctx.outcome === 'won' ? 'Won' : 'Lost',
      color: ctx.outcome === 'won' ? 'var(--success)' : 'var(--danger)',
    }
  }
  return {
    text: `${ctx.compositeScore}%`,
    color: getScoreColor(ctx.compositeScore, false),
  }
}

export async function buildDealContext(dealId: string, workspaceId: string): Promise<DealContext | null> {
  const [deal] = await db.select().from(dealLogs)
    .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
    .limit(1)
  if (!deal) return null
  return dealToContext(deal)
}

export async function buildAllDealContexts(workspaceId: string): Promise<DealContext[]> {
  const deals = await db.select().from(dealLogs)
    .where(eq(dealLogs.workspaceId, workspaceId))
  return deals.map(dealToContext)
}

function dealToContext(deal: any): DealContext {
  const now = Date.now()
  const isClosed = deal.stage === 'closed_won' || deal.stage === 'closed_lost'
  const outcome: 'won' | 'lost' | null = deal.outcome === 'won' ? 'won'
    : deal.outcome === 'lost' ? 'lost'
    : deal.stage === 'closed_won' ? 'won'
    : deal.stage === 'closed_lost' ? 'lost'
    : null

  // Parse meeting notes to find last note date and note count
  const meetingNotes = deal.meetingNotes || deal.hubspotNotes || ''
  const meetingEntries = parseMeetingEntries(meetingNotes)
  const noteCount = meetingEntries.length

  // Last note date from parsed entries or updatedAt
  let lastNoteDate: string | null = null
  let daysSinceLastNote = 999

  const datedEntries = meetingEntries
    .filter(e => e.date && !isNaN(e.date.getTime()))
    .sort((a, b) => b.date!.getTime() - a.date!.getTime())

  if (datedEntries.length > 0) {
    lastNoteDate = datedEntries[0].date!.toISOString()
    daysSinceLastNote = Math.floor((now - datedEntries[0].date!.getTime()) / 86400000)
  } else if (deal.updatedAt) {
    lastNoteDate = new Date(deal.updatedAt).toISOString()
    daysSinceLastNote = Math.floor((now - new Date(deal.updatedAt).getTime()) / 86400000)
  }

  // Parse intent signals
  const intentSignals = deal.intentSignals as any || {}
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

  // Momentum and sentiment — derive from text signals if available
  // note_signals_json is a raw SQL column not in Drizzle schema, so we use intentSignals as fallback
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
    noteCount,
    lastNoteDate,
    lastNoteSummary: deal.aiSummary ? String(deal.aiSummary).slice(0, 200) : null,
    openActionCount: openActions.length,
    completedActionCount: completedActions.length,
    recentCompletedActions: completedActions.slice(-5).map((t: any) => t.text || ''),
    upcomingEvents,
    contacts,
  }
}
