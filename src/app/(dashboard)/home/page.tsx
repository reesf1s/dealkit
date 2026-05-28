'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, Clock3, LayoutGrid, Plus } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import {
  CrmButton,
  ClampedText,
  CompactDealCard,
  CrmEmpty,
  CrmPage,
  CrmPanel,
  CrmSectionHeader,
  CrmSkeleton,
  CrmStat,
  PageIntent,
  ScenicPanel,
  money,
  shortDate,
} from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

type HomeData = {
  priorities: Array<{ id: string; title: string; reason: string; linkedType: string; linkedId: string; dealId?: string | null; suggestedAction?: string | null; confidence?: string }>
  upcomingMeetings: Array<{ id: string; title: string; startsAt: string; dealId: string | null; dealTitle: string | null; companyName: string | null }>
  openPipelineValue: number
  likelyClosers: Array<any>
  atRiskDeals: Array<any>
  staleDeals: Array<any>
  dealIntelligence: Array<any>
}

export default function HomePage() {
  const { data, isLoading, mutate } = useSWR<{ data: HomeData }>('/api/crm/today', fetcher, { revalidateOnFocus: false })
  const { data: googleData } = useSWR('/api/integrations/google/status', fetcher, { revalidateOnFocus: false })
  const [completingId, setCompletingId] = useState<string | null>(null)
  const home = data?.data
  const priorities = home?.priorities ?? []
  const meetings = home?.upcomingMeetings ?? []
  const activeDeals = [...(home?.likelyClosers ?? []), ...(home?.atRiskDeals ?? []), ...(home?.staleDeals ?? []), ...(home?.dealIntelligence ?? [])]
    .filter((deal, index, all) => all.findIndex(item => item.id === deal.id) === index)
    .slice(0, 6)
  const calendarConfigured = googleData?.data?.configured !== false

  async function completePriority(priority: HomeData['priorities'][number]) {
    if (priority.linkedType !== 'task') return
    setCompletingId(priority.id)
    try {
      await fetch('/api/crm/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: priority.linkedId, action: 'complete' }),
      })
      await mutate()
    } finally {
      setCompletingId(null)
    }
  }

  return (
    <CrmPage>
      <ScenicPanel
        eyebrow="Home"
        title="What needs attention today?"
        description="Tasks, meetings, active deals, and Halvex suggestions arranged into one calm revenue desk."
        actions={<><CrmButton href="/tasks?quick=task" tone="primary"><Plus size={16} /> Add task</CrmButton><CrmButton href="/deals?quick=deal"><Plus size={16} /> Add deal</CrmButton></>}
        compact
      >
        <CrmStat label="Tasks due" value={priorities.length} hint={priorities.length ? 'Review or complete' : 'Clear'} />
        <CrmStat label="Meetings" value={meetings.length} hint="Next 7 days" />
        <CrmStat label="Open pipeline" value={money(home?.openPipelineValue ?? 0)} />
        <CrmStat label="Likely closers" value={(home?.likelyClosers ?? []).length} />
      </ScenicPanel>

      <PageIntent items={[
        { label: 'Start here', title: 'Finish today’s commitments', text: 'Tasks are the main operating list. Complete, snooze, or open the linked record before adding more work.', action: <CrmButton href="/tasks">Open tasks</CrmButton> },
        { label: 'Then', title: 'Prepare for meetings', text: 'Calendar items should lead you to the right person, company, or deal before the call.', action: <CrmButton href="/calendar">Open calendar</CrmButton> },
        { label: 'Finally', title: 'Review deal health', text: 'Halvex highlights missing fields and risk, but the CRM record remains manually owned.', action: <CrmButton href="/deals?view=health">Review health</CrmButton> },
      ]} />

      <div className="crm-home-desk">
        <CrmPanel className="crm-home-primary">
          <CrmSectionHeader title="Tasks due" description="The practical work list. Complete tasks here or open the linked record." action={<CrmButton href="/tasks">All tasks</CrmButton>} />
          <div className="crm-stack">
            {isLoading ? <CrmSkeleton rows={4} /> : priorities.length ? priorities.slice(0, 6).map(priority => (
              <article key={priority.id} className="crm-work-row">
                <span className="crm-icon"><CheckCircle2 size={17} /></span>
                <div>
                  <strong><ClampedText lines={2} title={priority.title}>{priority.title}</ClampedText></strong>
                  <p><ClampedText lines={2}>{priority.reason}</ClampedText></p>
                </div>
                <div className="crm-form-actions">
                  {priority.dealId ? <CrmButton href={`/deals/${priority.dealId}`} tone="ghost">Open</CrmButton> : null}
                  {priority.linkedType === 'task' ? <CrmButton onClick={() => completePriority(priority)} disabled={completingId === priority.id}>Done</CrmButton> : null}
                </div>
              </article>
            )) : (
              <CrmEmpty title="No tasks due" action={<CrmButton href="/tasks?quick=task" tone="primary">Add task</CrmButton>}>
                Create follow-ups from deals, meetings, or relationship work.
              </CrmEmpty>
            )}
          </div>
        </CrmPanel>

        <CrmPanel className="crm-home-side">
          <CrmSectionHeader title="Meetings" description="Calendar is a CRM workflow: open the record, take notes, create follow-up." action={<CrmButton href="/calendar">Calendar</CrmButton>} />
          <div className="crm-stack">
            {isLoading ? <CrmSkeleton rows={3} /> : meetings.length ? meetings.slice(0, 5).map(meeting => (
              <article key={meeting.id} className="crm-work-row compact">
                <span className="crm-icon"><CalendarDays size={17} /></span>
                <div>
                  <strong><ClampedText lines={2}>{meeting.title}</ClampedText></strong>
                  <p><ClampedText lines={1}>{shortDate(meeting.startsAt)} · {meeting.companyName ?? 'No company matched'}{meeting.dealTitle ? ` · ${meeting.dealTitle}` : ''}</ClampedText></p>
                </div>
                <CrmButton href={meeting.dealId ? `/deals/${meeting.dealId}` : '/calendar'} tone="ghost">{meeting.dealId ? 'Open deal' : 'Open'}</CrmButton>
              </article>
            )) : (
              <CrmEmpty
                title="No meetings connected"
                action={<CrmButton href={calendarConfigured ? '/api/integrations/google/auth' : '/settings?section=integrations'} tone="primary">Connect Calendar</CrmButton>}
              >
                Bring Google Calendar in so meetings link back to people, companies, and deals.
              </CrmEmpty>
            )}
          </div>
        </CrmPanel>
      </div>

      <CrmPanel className="crm-home-deals">
        <CrmSectionHeader title="Active deals" description="A CRM view first. Deal health appears only as concise context." action={<CrmButton href="/deals"><LayoutGrid size={16} /> Deals</CrmButton>} />
        {isLoading ? <CrmSkeleton rows={5} /> : activeDeals.length ? (
          <div className="crm-grid-3">
            {activeDeals.map(deal => <CompactDealCard key={deal.id} deal={deal} />)}
          </div>
        ) : (
          <CrmEmpty title="Add your first opportunities" action={<CrmButton href="/deals?quick=deal" tone="primary">Add deal</CrmButton>}>
            Halvex becomes useful once you track deals, people, tasks, and meetings in one place.
          </CrmEmpty>
        )}
      </CrmPanel>

      <CrmPanel>
        <CrmSectionHeader title="Continue where you left off" description="Recently relevant records from your current pipeline, so the CRM feels like a workspace instead of a report." />
        {activeDeals.length ? (
          <div className="crm-continuation-strip">
            {activeDeals.slice(0, 5).map(deal => (
              <Link key={deal.id} href={`/deals/${deal.id}`} className="crm-continuation-card">
                <strong><ClampedText lines={1}>{deal.title}</ClampedText></strong>
                <p><ClampedText lines={1}>{deal.companyName ?? 'Unknown company'} · {deal.stageName ?? 'No stage'}</ClampedText></p>
              </Link>
            ))}
          </div>
        ) : <CrmEmpty title="No recent records">Add or import deals to build your working set.</CrmEmpty>}
      </CrmPanel>

      <CrmPanel className="crm-suggestion-panel">
        <CrmSectionHeader title="Halvex suggestions" description="Optional intelligence. Nothing changes your CRM unless you choose to act." />
        <div className="crm-grid-3">
          <Suggestion href="/deals?view=health" icon={<Clock3 size={17} />} title="Review deal health" text="See records with missing data, stale activity, or unclear next steps." />
          <Suggestion href="/tasks?view=overdue" icon={<CheckCircle2 size={17} />} title="Clean up old tasks" text="Old imported tasks should be marked done, snoozed, or replaced with current actions." />
          <Suggestion href="/assistant" icon={<CalendarDays size={17} />} title="Ask for a summary" text="Use the assistant when you need a founder-level read across the CRM." />
        </div>
      </CrmPanel>
    </CrmPage>
  )
}

function Suggestion({ href, icon, title, text }: { href: string; icon: ReactNode; title: string; text: string }) {
  return (
    <Link href={href} className="crm-record-card">
      <span className="crm-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </Link>
  )
}
