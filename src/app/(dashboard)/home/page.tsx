'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowRight, Building2, CheckCircle2, Clock3, LayoutGrid, NotebookPen, Plus, Sparkles, UsersRound } from 'lucide-react'
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
  ObjectWorkspaceHeader,
  WorkspaceBriefing,
  money,
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
  const [completingId, setCompletingId] = useState<string | null>(null)
  const home = data?.data
  const priorities = home?.priorities ?? []
  const activeDeals = [...(home?.likelyClosers ?? []), ...(home?.atRiskDeals ?? []), ...(home?.staleDeals ?? []), ...(home?.dealIntelligence ?? [])]
    .filter((deal, index, all) => all.findIndex(item => item.id === deal.id) === index)
    .slice(0, 6)
  const isEmptyWorkspace = !isLoading && priorities.length === 0 && activeDeals.length === 0 && Number(home?.openPipelineValue ?? 0) === 0

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
    <CrmPage wide>
      <ObjectWorkspaceHeader
        object="Home"
        title="Revenue desk"
        description="Today’s customer work, active records, and the next commitments that keep the pipeline moving."
        actions={<><CrmButton href="/tasks?quick=task" tone="primary"><Plus size={16} /> Add task</CrmButton><CrmButton href="/deals?quick=deal"><Plus size={16} /> Add deal</CrmButton></>}
        stats={<>
        <CrmStat label="Tasks due" value={priorities.length} hint={priorities.length ? 'Review or complete' : 'Clear'} />
        <CrmStat label="Open pipeline" value={money(home?.openPipelineValue ?? 0)} />
        <CrmStat label="Likely closers" value={(home?.likelyClosers ?? []).length} />
        <CrmStat label="At risk" value={(home?.atRiskDeals ?? []).length} />
        </>}
      />

      {isEmptyWorkspace ? (
        <CrmLaunchpad />
      ) : (
        <WorkspaceBriefing items={[
          { label: '1', title: 'Finish committed work', text: 'Due tasks are the primary operating queue. Complete, snooze, or open the linked record before adding more activity.', action: <CrmButton href="/tasks">Open tasks</CrmButton> },
          { label: '2', title: 'Keep records complete', text: 'Companies, people, and deals stay useful when owner, next step, value, and relationship context are current.', action: <CrmButton href="/deals">Review deals</CrmButton> },
          { label: 'AI', title: 'Ask only when it helps', text: 'Use Halvex to explain risk, extract updates from notes, or draft follow-ups. It suggests; you decide.', action: <CrmButton onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: 'What should I focus on in the CRM today?' } }))}>Ask Halvex</CrmButton> },
        ]} />
      )}

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
          <CrmSectionHeader title="Record shortcuts" description="Create or open the objects that keep the CRM useful." action={<CrmButton href="/deals">Deals</CrmButton>} />
          <div className="crm-stack">
            <Shortcut href="/deals?quick=deal" icon={<LayoutGrid size={17} />} title="New deal" text="Capture an opportunity, then add people, tasks, and notes from the record." />
            <Shortcut href="/companies?quick=company" icon={<Plus size={17} />} title="New company" text="Create the account object before tracking relationship context." />
            <Shortcut href="/people?quick=person" icon={<UsersRound size={17} />} title="New person" text="Keep buyer and champion context attached to a first-class record." />
            <Shortcut href="/tasks?quick=task" icon={<CheckCircle2 size={17} />} title="New task" text="Add the next manual customer action with a due date." />
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
          <Suggestion href="/deals" icon={<Clock3 size={17} />} title="Review deal health" text="See records with missing data, stale activity, or unclear next steps." />
          <Suggestion href="/tasks?view=overdue" icon={<CheckCircle2 size={17} />} title="Clean up old tasks" text="Old imported tasks should be marked done, snoozed, or replaced with current actions." />
          <Suggestion href="/deals" icon={<LayoutGrid size={17} />} title="Analyse a deal" text="Open a record and ask for evidence-based risks, missing buyer info, or next steps." />
        </div>
      </CrmPanel>
    </CrmPage>
  )
}

function Shortcut({ href, icon, title, text }: { href: string; icon: ReactNode; title: string; text: string }) {
  return <Link href={href} className="crm-work-row compact"><span className="crm-icon">{icon}</span><div><strong>{title}</strong><p>{text}</p></div></Link>
}

function CrmLaunchpad() {
  const steps = [
    { href: '/companies?quick=company', icon: <Building2 size={16} />, label: 'Company', title: 'Create the account', text: 'Start with the business you sell to so every person, deal, note, and task has a home.' },
    { href: '/people?quick=person', icon: <UsersRound size={16} />, label: 'Person', title: 'Add the buyer', text: 'Capture the human relationship: role, email, company, and why they matter.' },
    { href: '/deals?quick=deal', icon: <LayoutGrid size={16} />, label: 'Deal', title: 'Open the opportunity', text: 'Set stage, value, close date, owner, probability, priority, and the next step.' },
    { href: '/tasks?quick=task', icon: <CheckCircle2 size={16} />, label: 'Task', title: 'Commit the next action', text: 'Make the follow-up explicit with a due date and a linked record.' },
  ]

  return (
    <section className="crm-launchpad" aria-label="CRM setup launchpad">
      <div className="crm-launchpad-copy">
        <small>Workspace setup</small>
        <h2>Build the first customer record in under five minutes.</h2>
        <p>
          Halvex works best when the basics are clear: account, buyer, deal, next step, and notes.
          This is a manual CRM first, with intelligence available once there is real context to read.
        </p>
        <div className="crm-launchpad-actions">
          <CrmButton href="/companies?quick=company" tone="primary"><Plus size={16} /> Add company</CrmButton>
          <CrmButton href="/deals?quick=deal">Create deal</CrmButton>
          <CrmButton onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: 'Give me a concise five-minute setup plan for this CRM workspace: company, person, deal, note, task, then deal analysis.' } }))}><Sparkles size={15} /> Ask Halvex</CrmButton>
        </div>
      </div>

      <div className="crm-launchpad-board">
        <div className="crm-launchpad-board-header">
          <span>First workspace path</span>
          <strong>0 / 5 records</strong>
        </div>
        <div className="crm-launchpad-steps">
          {steps.map((step, index) => (
            <Link key={step.title} href={step.href} className="crm-launch-step">
              <span className="crm-launch-step-index">{index + 1}</span>
              <span className="crm-icon">{step.icon}</span>
              <span>
                <small>{step.label}</small>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </span>
              <ArrowRight size={15} />
            </Link>
          ))}
        </div>
        <div className="crm-launchpad-note">
          <span className="crm-icon"><NotebookPen size={16} /></span>
          <div>
            <strong>Then add one messy note</strong>
            <p>Open the deal, write what happened, and use “Extract CRM updates” to turn it into fields, tasks, and buyer context.</p>
          </div>
        </div>
      </div>
    </section>
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
