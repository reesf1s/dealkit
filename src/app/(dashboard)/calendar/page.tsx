'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, CalendarDays, RefreshCw, Send, Sparkles, UserRoundPlus } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import {
  CrmButton,
  CrmEmptyAction,
  CrmHero,
  CrmMeetingCard,
  CrmPageShell,
  CrmPanel,
  CrmPill,
  CrmPriorityCard,
} from '@/components/crm/CrmDesignSystem'

export const dynamic = 'force-dynamic'

type CalendarData = {
  upcomingMeetings: Array<{ id: string; title: string; startsAt: string; dealId: string | null; dealTitle: string | null; companyName: string | null }>
  overdueTasks: Array<{ id: string; title: string; dueAt: string | null; dealId: string | null; dealTitle: string | null; companyName: string | null }>
  priorities: Array<{ id: string; title: string; reason: string; suggestedAction: string; dealId?: string | null; confidence: string }>
}

type GoogleStatus = {
  connected: boolean
  connection: null | {
    googleAccountEmail: string | null
    lastCalendarSyncAt: string | null
    syncError: string | null
  }
}

function time(value: string | null | undefined) {
  if (!value) return 'No time'
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function dayLabel(value: string | null | undefined) {
  if (!value) return 'Unscheduled'
  const date = new Date(value)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(date)
}

export default function CalendarPage() {
  const [syncing, setSyncing] = useState(false)
  const { data: todayRes, mutate } = useSWR<{ data: CalendarData }>('/api/crm/today', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20_000,
  })
  const { data: googleRes, mutate: mutateGoogle } = useSWR<{ data: GoogleStatus }>('/api/integrations/google/status', fetcher, {
    revalidateOnFocus: false,
  })

  const calendar = todayRes?.data
  const google = googleRes?.data
  const meetings = calendar?.upcomingMeetings ?? []
  const grouped = meetings.reduce<Record<string, typeof meetings>>((acc, meeting) => {
    const key = dayLabel(meeting.startsAt)
    acc[key] = acc[key] ?? []
    acc[key].push(meeting)
    return acc
  }, {})

  async function syncCalendar() {
    setSyncing(true)
    try {
      await fetch('/api/integrations/google/sync', { method: 'POST' })
      await Promise.all([mutate(), mutateGoogle()])
    } finally {
      setSyncing(false)
    }
  }

  return (
    <CrmPageShell>
      <CrmHero
        eyebrow="Calendar"
        title="Meetings are where the CRM should start."
        brief={
          google?.connected
            ? `Connected to ${google.connection?.googleAccountEmail ?? 'Google Calendar'}. Halvex is turning upcoming meetings into prep, follow-ups, and linked deal context.`
            : 'Connect Google Calendar to pull sales meetings into Halvex, match attendees to contacts, and prep every call from real CRM context.'
        }
        primary={
          google?.connected
            ? <CrmButton onClick={syncCalendar} variant="primary"><RefreshCw size={15} /> {syncing ? 'Syncing...' : 'Sync Calendar'}</CrmButton>
            : <CrmButton href="/api/integrations/google/auth" variant="primary"><CalendarDays size={15} /> Connect Google Calendar</CrmButton>
        }
        secondary={<CrmButton href="/home" variant="secondary">Back Home</CrmButton>}
        meta={
          <div className="crm-mini-brief">
            <strong>Meeting workflow</strong>
            Prep before the call, create the follow-up after, and keep the deal timeline current without CRM admin.
          </div>
        }
      />

      <div className="crm-page-grid">
        <CrmPanel
          title="Upcoming sales meetings"
          description="Matched to deals and companies where Halvex has enough context."
          icon={CalendarDays}
        >
          {Object.entries(grouped).map(([label, items]) => (
            <section key={label} className="crm-calendar-day">
              <h3>{label}</h3>
              {items.map(meeting => (
                <CrmMeetingCard
                  key={meeting.id}
                  title={meeting.title}
                  time={time(meeting.startsAt)}
                  company={meeting.companyName ?? meeting.dealTitle}
                  dealHref={meeting.dealId ? `/deals/${meeting.dealId}` : null}
                  prep={meeting.dealId ? 'AI prep can use the linked deal, contacts, and recent timeline.' : 'No deal link yet. Match this meeting to unlock prep.'}
                />
              ))}
            </section>
          ))}

          {meetings.length === 0 && (
            <CrmEmptyAction
              icon={CalendarDays}
              title={google?.connected ? 'No upcoming meetings found' : 'Connect Calendar to unlock the daily flow'}
              description={google?.connected ? 'Sync again or add calendar events with known contacts.' : 'Halvex will match attendees to contacts, link companies, and surface meeting prep here.'}
              action={google?.connected ? <CrmButton onClick={syncCalendar} variant="primary">Sync again</CrmButton> : <CrmButton href="/api/integrations/google/auth" variant="primary">Connect Google</CrmButton>}
            />
          )}
        </CrmPanel>

        <div style={{ display: 'grid', gap: 18 }}>
          <CrmPanel title="Prep queue" description="Suggested prep based on linked CRM context." icon={Sparkles}>
            {meetings.slice(0, 4).map(meeting => (
              <CrmPriorityCard
                key={meeting.id}
                title={`Prep for ${meeting.title}`}
                reason={meeting.companyName ? `${meeting.companyName} has linked CRM context.` : 'This meeting needs a deal or contact link.'}
                action={meeting.dealId ? 'Review deal brief and latest activity before the call.' : 'Link attendees to contacts so Halvex can prepare the meeting.'}
                href={meeting.dealId ? `/deals/${meeting.dealId}` : '/contacts'}
                tone={meeting.dealId ? 'blue' : 'watch'}
                meta={<CrmPill tone={meeting.dealId ? 'good' : 'watch'}>{meeting.dealId ? 'Ready' : 'Needs link'}</CrmPill>}
              />
            ))}
            {meetings.length === 0 && <CrmEmptyAction title="Prep appears after sync" description="Once meetings are synced, Halvex will show prep cards with linked deals and last touch context." />}
          </CrmPanel>

          <CrmPanel title="After the meeting" description="Turn meeting outcomes into CRM hygiene." icon={Send}>
            {(calendar?.overdueTasks ?? []).slice(0, 4).map(task => (
              <Link key={task.id} href={task.dealId ? `/deals/${task.dealId}` : '/tasks'} className="crm-card-link">
                <div className="crm-pulse-row">
                  <strong>{task.title}</strong>
                  <span>{task.companyName ?? task.dealTitle ?? 'Task'}</span>
                </div>
              </Link>
            ))}
            <CrmEmptyAction
              icon={UserRoundPlus}
              title="Capture the next step"
              description="After each meeting, create the follow-up task or draft an email from the linked deal page."
              action={<CrmButton href="/tasks" variant="secondary">Open tasks <ArrowRight size={14} /></CrmButton>}
            />
          </CrmPanel>
        </div>
      </div>
    </CrmPageShell>
  )
}
