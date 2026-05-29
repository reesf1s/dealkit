'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Building2, CheckCircle2, Clock3, LayoutGrid, Plus, Sparkles } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import {
  CrmButton,
  ClampedText,
  CompactDealCard,
  CrmEmpty,
  CrmPage,
  CrmSkeleton,
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
  const openValue = home?.openPipelineValue ?? 0
  const hasWork = priorities.length > 0 || activeDeals.length > 0 || openValue > 0

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
      <section className="app-page-head">
        <div>
          <span className="app-kicker">Home</span>
          <h1>Today</h1>
          <p>{money(openValue)} pipeline · {priorities.length} due · {activeDeals.length} active</p>
        </div>
        <div className="app-page-actions">
          <CrmButton href="/companies?quick=company"><Building2 size={16} /> Company</CrmButton>
          <CrmButton href="/deals?quick=deal" tone="primary"><Plus size={16} /> Deal</CrmButton>
        </div>
      </section>

      <section className="app-metric-grid">
        <MetricCard label="Open pipeline" value={money(openValue)} />
        <MetricCard label="Due" value={priorities.length} />
        <MetricCard label="At risk" value={(home?.atRiskDeals ?? []).length} />
        <MetricCard label="Closing" value={(home?.likelyClosers ?? []).length} />
      </section>

      <PipelineSignalStrip deals={activeDeals} />

      {!isLoading && !hasWork ? (
        <section className="app-card">
          <CardHeader icon={<Plus size={18} />} title="Workspace" action={<CrmButton href="/deals?quick=deal" tone="primary">New deal</CrmButton>} />
          <CrmEmpty
            title="Start with one real opportunity"
            action={<><CrmButton href="/companies?quick=company">Company</CrmButton><CrmButton href="/people?quick=person">Person</CrmButton></>}
          >
            Add the company and buyer once, then create the opportunity. Home will turn into a daily work queue as soon as there is real pipeline context.
          </CrmEmpty>
        </section>
      ) : null}

      {isLoading || hasWork ? (
        <>
          <section className="app-dashboard-grid">
            <div className="app-card app-card-large">
              <CardHeader icon={<CheckCircle2 size={18} />} title="Work" action={<CrmButton href="/tasks">Tasks</CrmButton>} />
              <div className="app-list">
                {isLoading ? <CrmSkeleton rows={4} /> : priorities.length ? priorities.slice(0, 6).map(priority => (
                  <article key={priority.id} className="app-row">
                    <span className="app-row-icon"><CheckCircle2 size={16} /></span>
                    <div>
                      <strong><ClampedText lines={1} title={priority.title}>{priority.title}</ClampedText></strong>
                      <p><ClampedText lines={1}>{priority.reason}</ClampedText></p>
                    </div>
                    <div className="app-row-actions">
                      {priority.dealId ? <CrmButton href={`/deals/${priority.dealId}`} tone="ghost">Open</CrmButton> : null}
                      {priority.linkedType === 'task' ? <CrmButton onClick={() => completePriority(priority)} disabled={completingId === priority.id}>Done</CrmButton> : null}
                    </div>
                  </article>
                )) : <CrmEmpty title="No tasks due" action={<CrmButton href="/tasks?quick=task" tone="primary">Add task</CrmButton>} />}
              </div>
            </div>

            <div className="app-card app-ai-card">
              <CardHeader icon={<Sparkles size={18} />} title="Halvex" />
              <button type="button" onClick={() => askHalvex('Analyse pipeline and list the records that need attention today.')}>Analyse pipeline</button>
              <button type="button" onClick={() => askHalvex('Find missing next steps, buyer gaps, and stale records in this workspace.')}>Find gaps</button>
              <button type="button" onClick={() => askHalvex('Draft a concise follow-up for the highest priority open deal.')}>Draft follow-up</button>
            </div>
          </section>

          <section className="app-card">
            <CardHeader icon={<LayoutGrid size={18} />} title="Pipeline" action={<CrmButton href="/deals">Deals</CrmButton>} />
            {isLoading ? <CrmSkeleton rows={5} /> : activeDeals.length ? (
              <div className="app-card-grid">
                {activeDeals.map(deal => <CompactDealCard key={deal.id} deal={deal} />)}
              </div>
            ) : <CrmEmpty title="No active deals" action={<CrmButton href="/deals?quick=deal" tone="primary">Add deal</CrmButton>} />}
          </section>

          <section className="app-card">
            <CardHeader icon={<Clock3 size={18} />} title="Recent" />
            {activeDeals.length ? (
              <div className="app-continuation">
                {activeDeals.slice(0, 5).map(deal => (
                  <Link key={deal.id} href={`/deals/${deal.id}`}>
                    <strong><ClampedText lines={1}>{deal.title}</ClampedText></strong>
                    <span><ClampedText lines={1}>{deal.companyName ?? 'Unknown company'} · {deal.stageName ?? 'No stage'}</ClampedText></span>
                  </Link>
                ))}
              </div>
            ) : <CrmEmpty title="No recent records" />}
          </section>
        </>
      ) : null}
    </CrmPage>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return <article className="app-metric-card"><span>{label}</span><strong>{value}</strong></article>
}

function PipelineSignalStrip({ deals }: { deals: Array<any> }) {
  if (!deals.length) return null
  const visible = deals.slice(0, 4)
  const total = visible.reduce((sum, deal) => sum + Number(deal.valueAmount ?? 0), 0) || visible.length
  return (
    <section className="app-signal-strip" aria-label="Pipeline rhythm">
      <div className="app-signal-copy">
        <span>Pipeline rhythm</span>
        <strong>{visible.length} records need a clear next move</strong>
      </div>
      <div className="app-signal-track">
        {visible.map((deal, index) => {
          const amount = Number(deal.valueAmount ?? 0) || 1
          const width = Math.max(16, Math.round((amount / total) * 100))
          return (
            <Link key={deal.id} href={`/deals/${deal.id}`} style={{ '--signal-width': `${width}%` } as any}>
              <span>{deal.companyName ?? deal.title}</span>
              <strong>{money(deal.valueAmount)}</strong>
              <small>{deal.aiNextAction ? 'Next step set' : 'Needs next step'}</small>
              <i aria-hidden="true" data-index={index} />
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function CardHeader({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return <header className="app-card-header"><div><span>{icon}</span><h2>{title}</h2></div>{action}</header>
}

function askHalvex(query: string) {
  window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query } }))
}
