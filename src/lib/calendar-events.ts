import type { DealContext } from './deal-context'

export interface CalendarEvent {
  dealId: string
  dealName: string
  type: string
  title: string
  date: string
  time: string | null
  color: string
  dashed?: boolean
}

const EVENT_COLORS: Record<string, string> = {
  meeting: '#6366F1',
  follow_up: '#FBBF24',
  demo: '#34D399',
  deadline: '#F87171',
  decision: '#A855F7',
  predicted_close: '#A78BFA',
  action_due: '#F59E0B',
  contract: '#2DD4BF',
  stale: '#6B7280',
}

export function getCalendarEvents(
  deals: DealContext[],
  startDate: Date,
  endDate: Date
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const startMs = startDate.getTime()
  const endMs = endDate.getTime()

  for (const deal of deals) {
    // Source 1: Scheduled events from note extraction
    for (const event of deal.upcomingEvents) {
      const eventMs = new Date(event.date).getTime()
      if (eventMs >= startMs && eventMs <= endMs) {
        events.push({
          dealId: deal.id,
          dealName: deal.name,
          type: event.type,
          title: `${deal.name}: ${event.title}`,
          date: event.date,
          time: event.time,
          color: EVENT_COLORS[event.type] || EVENT_COLORS.meeting,
        })
      }
    }

    // Source 2: Close dates (open deals only)
    if (deal.closeDate && !deal.isClosed) {
      const closeMs = new Date(deal.closeDate).getTime()
      if (closeMs >= startMs && closeMs <= endMs) {
        events.push({
          dealId: deal.id,
          dealName: deal.name,
          type: 'predicted_close',
          title: `${deal.name}: Expected close`,
          date: deal.closeDate,
          time: null,
          color: EVENT_COLORS.predicted_close,
          dashed: true,
        })
      }
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date))
}
