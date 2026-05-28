'use client'

import type { ReactNode } from 'react'
import useSWR from 'swr'
import { CalendarDays, CheckCircle2, FileText, MailPlus, RefreshCw } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ClampedText, CrmButton, CrmEmpty, CrmPage, CrmPanel, CrmSectionHeader, CrmSkeleton, CrmStat, PageIntent, ScenicPanel, shortDate } from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

export default function CalendarPage() {
  const { data: todayData, mutate } = useSWR('/api/crm/today', fetcher, { revalidateOnFocus: false })
  const { data: googleData } = useSWR('/api/integrations/google/status', fetcher, { revalidateOnFocus: false })
  const meetings = todayData?.data?.upcomingMeetings ?? []
  const groupedMeetings = groupMeetings(meetings)
  const connected = Boolean(googleData?.data?.connected)
  const configured = googleData?.data?.configured !== false

  async function sync() {
    await fetch('/api/integrations/google/sync', { method: 'POST' })
    await mutate()
  }

  return (
    <CrmPage>
      <ScenicPanel
        eyebrow="Calendar"
        title="Who am I meeting, and why?"
        description="See what is next, open the linked CRM record, save notes, and follow up from one meeting workflow."
        actions={connected ? <CrmButton onClick={sync} tone="primary"><RefreshCw size={16} /> Sync Calendar</CrmButton> : <CrmButton href={configured ? '/api/integrations/google/auth' : '/settings?section=integrations'} tone="primary"><CalendarDays size={16} /> {configured ? 'Connect Google Calendar' : 'Set up Calendar'}</CrmButton>}
        compact
      >
        <CrmStat label="Upcoming meetings" value={meetings.length} />
        <CrmStat label="Calendar status" value={connected ? 'Connected' : 'Not connected'} />
        <CrmStat label="Matched records" value={meetings.filter((meeting: any) => meeting.dealId).length} />
      </ScenicPanel>

      <PageIntent items={[
        { label: 'Before', title: 'Open the linked CRM record', text: 'Meeting prep starts from the deal, person, company, and recent activity.' },
        { label: 'During', title: 'Capture plain notes', text: 'Notes should live on the relevant record so the relationship history is not lost.' },
        { label: 'After', title: 'Create the follow-up manually', text: 'Halvex can draft or suggest, but users decide the real task and due date.' },
      ]} />

      <div className="crm-grid-2">
        <CrmPanel>
          <CrmSectionHeader title="Upcoming meetings" description="Open the linked deal before the call. If no deal is matched, find or create the right record." />
          <div className="crm-stack">
            {!todayData ? <CrmSkeleton rows={4} /> : meetings.length ? groupedMeetings.map(group => (
              <section key={group.label} className="crm-meeting-group">
                <h3>{group.label}</h3>
                {group.items.map((meeting: any) => (
                  <article key={meeting.id} className="crm-meeting-card">
                    <span className="crm-icon"><CalendarDays size={16} /></span>
                    <div>
                      <strong><ClampedText lines={2}>{meeting.title}</ClampedText></strong>
                      <p><ClampedText lines={1}>{shortDate(meeting.startsAt)} · {meeting.companyName ?? 'No company matched'}{meeting.dealTitle ? ` · ${meeting.dealTitle}` : ''}</ClampedText></p>
                      <small>{meeting.dealId ? 'Matched to CRM record' : 'Needs matching'}</small>
                    </div>
                    <div className="crm-form-actions">
                      <CrmButton href={meeting.dealId ? `/deals/${meeting.dealId}` : '/people'}>{meeting.dealId ? 'Open deal' : 'Find person'}</CrmButton>
                      <CrmButton href={meeting.dealId ? `/deals/${meeting.dealId}#deal-note` : '/calendar'} tone="ghost">Add note</CrmButton>
                    </div>
                  </article>
                ))}
              </section>
            )) : (
              <CrmEmpty title={connected ? 'No matched meetings' : 'Connect Calendar'} action={!connected ? <CrmButton href={configured ? '/api/integrations/google/auth' : '/settings?section=integrations'} tone="primary">{configured ? 'Connect Google' : 'Open settings'}</CrmButton> : undefined}>
                {connected ? 'When meetings are found, Halvex will match attendees to people, companies, and deals.' : 'Calendar makes prep and follow-up part of the CRM.'}
              </CrmEmpty>
            )}
          </div>
        </CrmPanel>

        <CrmPanel>
          <CrmSectionHeader title="Meeting routine" description="A simple workflow around every customer conversation." />
          <div className="crm-stack">
            <Routine icon={<FileText size={16} />} title="Before" text="Open the linked record and review stage, people, tasks, and recent activity." />
            <Routine icon={<FileText size={16} />} title="After" text="Save notes on the deal, person, or company timeline." />
            <Routine icon={<CheckCircle2 size={16} />} title="Follow-up" text="Create the next task manually with a due date." />
            <Routine icon={<MailPlus size={16} />} title="Optional" text="Ask Halvex to draft an email from the current CRM context." />
          </div>
        </CrmPanel>
      </div>
    </CrmPage>
  )
}

function groupMeetings(meetings: any[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 86_400_000)
  const groups = [
    { label: 'Today', items: [] as any[] },
    { label: 'Tomorrow', items: [] as any[] },
    { label: 'Later this week', items: [] as any[] },
  ]
  for (const meeting of meetings) {
    const date = meeting.startsAt ? new Date(meeting.startsAt) : null
    const start = date ? new Date(date) : null
    start?.setHours(0, 0, 0, 0)
    if (start && start.getTime() === today.getTime()) groups[0].items.push(meeting)
    else if (start && start.getTime() === tomorrow.getTime()) groups[1].items.push(meeting)
    else groups[2].items.push(meeting)
  }
  return groups.filter(group => group.items.length)
}

function Routine({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="crm-list-row">
      <span className="crm-icon">{icon}</span>
      <div><strong>{title}</strong><p>{text}</p></div>
    </article>
  )
}
