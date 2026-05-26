'use client'

import useSWR from 'swr'
import { CalendarDays, CheckCircle2, LayoutGrid, Plus, Sparkles } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import {
  ActionCard,
  ButtonV2,
  DealCardV2,
  EmptyStateV2,
  HeroPanel,
  MeetingCard,
  money,
  PanelV2,
  SectionHeader,
} from '@/components/v2/V2DesignSystem'

export const dynamic = 'force-dynamic'

type HomeData = {
  priorities: Array<{ id: string; title: string; reason: string; linkedType: string; linkedId: string; dealId?: string | null; suggestedAction: string; confidence: string }>
  atRiskDeals: Array<any>
  staleDeals: Array<any>
  upcomingMeetings: Array<{ id: string; title: string; startsAt: string; dealId: string | null; dealTitle: string | null; companyName: string | null }>
  overdueTasks: Array<{ id: string; title: string; dueAt: string | null; dealId: string | null; dealTitle: string | null; companyName: string | null }>
  openPipelineValue: number
  likelyClosers: Array<any>
  dealIntelligence: Array<any>
}

export default function HomePage() {
  const { data, isLoading } = useSWR<{ data: HomeData }>('/api/crm/today', fetcher, { revalidateOnFocus: false })
  const { data: googleData } = useSWR('/api/integrations/google/status', fetcher, { revalidateOnFocus: false })
  const googleConfigured = googleData?.data?.configured !== false
  const home = data?.data
  const priorities = home?.priorities ?? []
  const meetings = home?.upcomingMeetings ?? []
  const activeDeals = [...(home?.dealIntelligence ?? []), ...(home?.likelyClosers ?? []), ...(home?.atRiskDeals ?? []), ...(home?.staleDeals ?? [])]
    .filter((deal, index, all) => all.findIndex(item => item.id === deal.id) === index)
    .slice(0, 6)

  return (
    <div className="v2-page">
      <HeroPanel
        eyebrow="Home"
        title="Today"
        actions={(
          <>
            <ButtonV2 tone="dark" onClick={() => {
              window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: 'What should I do today?' } }))
            }}>
              <CalendarDays size={16} /> Review my day
            </ButtonV2>
            <ButtonV2 href="/deals"><Plus size={16} /> Add deal</ButtonV2>
          </>
        )}
        aside={(
          <>
            <div className="v2-glass-card">
              <strong>AI daily brief</strong>
              <span>{priorities.length ? `${priorities.length} actions need attention. Start with ${priorities[0].title}.` : 'Connect Calendar or add deal context and Halvex will build a daily plan.'}</span>
            </div>
            <div className="v2-glass-card">
              <strong>Pipeline pulse</strong>
              <span>{money(home?.openPipelineValue ?? 0)} open pipeline · {(home?.likelyClosers ?? []).length} likely closers</span>
            </div>
          </>
        )}
      >
        Meetings, follow-ups, deal changes, and risk signals, already sorted into a calm daily plan.
      </HeroPanel>

      <div className="v2-grid-2">
        <PanelV2>
          <SectionHeader title="Today's meetings" icon={<CalendarDays size={18} />}>
            Meeting prep should start from your people, companies, deals, and timeline.
          </SectionHeader>
          <div className="v2-stack">
            {meetings.length ? meetings.map(meeting => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                action={<ButtonV2 href={meeting.dealId ? `/deals/${meeting.dealId}` : '/calendar'}>Prep me</ButtonV2>}
              />
            )) : (
              <EmptyStateV2
                title="Bring your meetings into Halvex"
                action={<ButtonV2 href={googleConfigured ? '/api/integrations/google/auth' : '/settings?section=integrations'} tone="dark">{googleConfigured ? 'Connect Google Calendar' : 'Set up Google Calendar'}</ButtonV2>}
              >
                {googleConfigured ? 'Calendar becomes the front door for prep, notes, follow-up, and deal updates.' : 'Google Calendar is designed in, but production OAuth credentials still need to be added before users can connect.'}
              </EmptyStateV2>
            )}
          </div>
        </PanelV2>

        <PanelV2>
          <SectionHeader title="Priority actions" icon={<Sparkles size={18} />}>
            The work Halvex thinks will move revenue today.
          </SectionHeader>
          <div className="v2-stack">
            {priorities.length ? priorities.slice(0, 6).map(priority => (
              <ActionCard
                key={priority.id}
                title={priority.title}
                reason={priority.reason}
                href={priority.dealId ? `/deals/${priority.dealId}` : undefined}
                source={priority.confidence === 'high' ? 'High confidence' : 'AI suggested'}
                action={<CheckCircle2 size={18} />}
              />
            )) : (
              <EmptyStateV2 title="No busywork yet">
                Add deals, connect Calendar, or import relationships. Halvex will turn activity into clear actions.
              </EmptyStateV2>
            )}
          </div>
        </PanelV2>
      </div>

      <PanelV2>
        <SectionHeader title="Deal intelligence" icon={<LayoutGrid size={18} />} action={<ButtonV2 href="/deals?view=intelligence">Open intelligence</ButtonV2>}>
          What Halvex believes is moving, slipping, or missing enough evidence.
        </SectionHeader>
        {isLoading ? <EmptyStateV2 title="Loading CRM context">Reading your workspace records.</EmptyStateV2> : activeDeals.length ? (
          <div className="v2-grid-3">
            {activeDeals.map(deal => <DealCardV2 key={deal.id} deal={deal} />)}
          </div>
        ) : (
          <EmptyStateV2 title="Add or import deals to see the daily cockpit" action={<ButtonV2 href="/deals" tone="dark">Open Deals</ButtonV2>}>
            V2 is designed to be useful before the database is perfect, but it needs at least a few opportunities to reason over.
          </EmptyStateV2>
        )}
      </PanelV2>
    </div>
  )
}
