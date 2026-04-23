// ─────────────────────────────────────────────────────────────────────────────
// deal-context.server.ts — Server-only DB functions
// DO NOT import from client components — uses db/drizzle/fs
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { parseMeetingEntries } from '@/lib/text-signals'
import { getEffectiveDealSummarySnippet } from './effective-deal-summary'
import { getScoreColor, type DealContext } from './deal-context'

export { type DealContext } from './deal-context'

export async function buildDealContext(dealId: string, workspaceId: string): Promise<DealContext | null> {
  const [deal] = await db.select().from(dealLogs)
    .where(and(eq(dealLogs.id, dealId), eq(dealLogs.workspaceId, workspaceId)))
    .limit(1)
  if (!deal) return null
  return serverDealToContext(deal)
}

export async function buildAllDealContexts(workspaceId: string): Promise<DealContext[]> {
  const deals = await db.select().from(dealLogs)
    .where(eq(dealLogs.workspaceId, workspaceId))
  return deals.map(serverDealToContext)
}

function serverDealToContext(deal: any): DealContext {
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

  const intentSignals = (deal.intentSignals as any) || {}
  const championIdentified = intentSignals.championStatus === 'confirmed'
  const budgetConfirmed = intentSignals.budgetStatus === 'confirmed' || intentSignals.budgetStatus === 'approved'

  const todos = (deal.todos as any[]) || []
  const openActions = todos.filter((t: any) => !t.done)
  const completedActions = todos.filter((t: any) => t.done)

  const contacts = ((deal.contacts as any[]) || []).map((c: any) => ({
    name: c.name || 'Unknown',
    role: c.role || c.title || '',
    email: c.email,
  }))

  const scheduledEvents = (deal.scheduledEvents as any[]) || []
  const upcomingEvents = scheduledEvents
    .filter((e: any) => e.date && new Date(e.date).getTime() >= now - 86400000)
    .map((e: any) => ({
      type: e.type || 'meeting',
      title: e.description || e.title || 'Event',
      date: e.date,
      time: e.time || null,
    }))

  const competitors = ((deal.competitors as any[]) || []).map((c: any) =>
    typeof c === 'string' ? c : c.name || String(c)
  )

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
    lastNoteSummary: getEffectiveDealSummarySnippet(deal, 200),
    openActionCount: openActions.length,
    completedActionCount: completedActions.length,
    recentCompletedActions: completedActions.slice(-5).map((t: any) => t.text || ''),
    upcomingEvents,
    contacts,
  }
}
