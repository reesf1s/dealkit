'use client'

import useSWR from 'swr'
import { CalendarDays, FileText, MailPlus, RefreshCw } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import {
  ActionCard,
  ButtonV2,
  EmptyStateV2,
  HeroPanel,
  MeetingCard,
  PanelV2,
  SectionHeader,
} from '@/components/v2/V2DesignSystem'

export const dynamic = 'force-dynamic'

export default function CalendarPage() {
  const { data: todayData, mutate } = useSWR('/api/crm/today', fetcher, { revalidateOnFocus: false })
  const { data: googleData } = useSWR('/api/integrations/google/status', fetcher, { revalidateOnFocus: false })
  const meetings = todayData?.data?.upcomingMeetings ?? []
  const connected = Boolean(googleData?.data?.connected)

  async function sync() {
    await fetch('/api/integrations/google/sync', { method: 'POST' })
    mutate()
  }

  return (
    <div className="v2-page">
      <HeroPanel
        eyebrow="Calendar"
        title="Meetings are where the CRM should start."
        actions={(
          <>
            {connected ? <ButtonV2 tone="dark" onClick={sync}><RefreshCw size={16} /> Sync Calendar</ButtonV2> : <ButtonV2 tone="dark" href="/api/integrations/google/auth"><CalendarDays size={16} /> Connect Google Calendar</ButtonV2>}
            <ButtonV2 href="/home">Back Home</ButtonV2>
          </>
        )}
        aside={(
          <div className="v2-glass-card">
            <strong>Meeting workflow</strong>
            <span>Prep before the call, add notes after, then approve deal updates without CRM admin.</span>
          </div>
        )}
      >
        Halvex matches attendees to people, companies, and deals so every meeting can create useful context.
      </HeroPanel>

      <div className="v2-grid-2">
        <PanelV2>
          <SectionHeader title="Upcoming sales meetings" icon={<CalendarDays size={18} />}>
            Each meeting should explain who is attending, what deal it touches, and what needs to happen next.
          </SectionHeader>
          <div className="v2-stack">
            {meetings.length ? meetings.map((meeting: any) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                action={<ButtonV2 href={meeting.dealId ? `/deals/${meeting.dealId}` : '/inbox'}>Prep me</ButtonV2>}
              />
            )) : (
              <EmptyStateV2 title={connected ? 'No upcoming matched meetings' : 'Connect Calendar to unlock the daily flow'} action={!connected ? <ButtonV2 href="/api/integrations/google/auth" tone="dark">Connect Google</ButtonV2> : undefined}>
                {connected ? 'When meetings are found, Halvex will match attendees to people, companies, and deals.' : 'Calendar is the fastest way to make Halvex feel alive.'}
              </EmptyStateV2>
            )}
          </div>
        </PanelV2>

        <PanelV2>
          <SectionHeader title="Meeting operating loop" icon={<FileText size={18} />}>
            This is how you give Halvex new information without filling in CRM fields.
          </SectionHeader>
          <div className="v2-stack">
            <ActionCard title="Prep before the call" reason="Halvex reads linked deal context, last touch, risks, and open tasks." source="Before meeting" />
            <ActionCard title="Add note after the call" reason="Write naturally. Halvex proposes blockers, next actions, tasks, and summary updates." source="After meeting" />
            <ActionCard title="Approve the CRM changes" reason="Important fields are never silently overwritten. You choose what gets saved." source="User approved" />
            <ActionCard title="Draft follow-up" reason="Create a concise follow-up from the meeting note and deal context." source="AI draft" action={<MailPlus size={17} />} />
          </div>
        </PanelV2>
      </div>
    </div>
  )
}
