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

      <PipelineReportBoard home={home} activeDeals={activeDeals} priorities={priorities} />

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

function PipelineReportBoard({ home, activeDeals, priorities }: { home?: HomeData; activeDeals: Array<any>; priorities: HomeData['priorities'] }) {
  const openValue = home?.openPipelineValue ?? 0
  const topDeal = [...activeDeals].sort((a, b) => Number(b.valueAmount ?? 0) - Number(a.valueAmount ?? 0))[0]
  const atRisk = home?.atRiskDeals?.length ?? 0
  const closing = home?.likelyClosers?.length ?? 0
  const stale = home?.staleDeals?.length ?? 0
  const totalSignals = Math.max(1, atRisk + closing + stale + activeDeals.length)
  const segments = [
    { label: 'At risk', value: atRisk, tone: 'hot' },
    { label: 'Closing', value: closing, tone: 'good' },
    { label: 'Stale', value: stale, tone: 'warn' },
    { label: 'Active', value: activeDeals.length, tone: 'calm' },
  ]
  const sourceRows = segments.filter(segment => segment.value > 0)
  const reportRows = sourceRows.length ? sourceRows : segments.slice(0, 3)
  const trend = activeDeals.slice(0, 7)

  return (
    <section className="app-report-board">
      <div className="app-report-main">
        <div className="app-report-eyebrow">
          <button type="button" aria-label="Add report">+</button>
          {activeDeals.slice(0, 3).map(deal => <span key={deal.id}>{initials(deal.companyName ?? deal.title)}</span>)}
        </div>
        <div className="app-report-title">
          <span>Pipeline report</span>
          <h2>{money(openValue)}</h2>
          <p>{activeDeals.length} active records · {priorities.length} work items</p>
        </div>
        <div className="app-report-progress">
          {segments.map(segment => (
            <div key={segment.label} className={`tone-${segment.tone}`} style={{ width: `${Math.max(8, Math.round((segment.value / totalSignals) * 100))}%` }}>
              <span>{segment.label}</span>
              <strong>{segment.value}</strong>
            </div>
          ))}
        </div>
        <div className="app-report-lower">
          <div className="app-source-card">
            <header><strong>Focus mix</strong><button type="button">Filters</button></header>
            {reportRows.map(row => (
              <div key={row.label} className={`tone-${row.tone}`}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
                <small>{Math.round((row.value / totalSignals) * 100)}%</small>
              </div>
            ))}
          </div>
          <div className="app-mini-chart">
            <header><strong>Value shape</strong><button type="button">Value</button></header>
            <div>
              {(trend.length ? trend : Array.from({ length: 6 })).map((deal: any, index) => (
                <span key={deal?.id ?? index} style={{ height: `${Math.max(18, Math.min(88, Number(deal?.valueAmount ?? (index + 1) * 8) / Math.max(1, Number(topDeal?.valueAmount ?? 100)) * 88))}%` }}>
                  <i />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <aside className="app-report-side">
        {topDeal ? <Link href={`/deals/${topDeal.id}`} className="app-report-card">
          <small>Top deal</small>
          <strong>{topDeal ? money(topDeal.valueAmount) : money(0)}</strong>
          <span>{topDeal?.companyName ?? topDeal?.title ?? 'No deal yet'}</span>
        </Link> : <article className="app-report-card">
          <small>Top deal</small>
          <strong>{money(0)}</strong>
          <span>No deal yet</span>
        </article>}
        <article className="app-report-card dark">
          <small>Best next move</small>
          <strong>{topDeal?.aiNextAction ? 'Ready' : 'Set next step'}</strong>
          <span>{topDeal?.aiNextAction ?? 'Add a dated action to the highest-value record.'}</span>
        </article>
        <article className="app-report-card compact"><small>Deals</small><strong>{activeDeals.length}</strong><span>{closing} closing</span></article>
        <article className="app-report-card compact accent"><small>Review</small><strong>{atRisk + stale}</strong><span>risk + stale</span></article>
        <article className="app-report-card wide">
          <small>Halvex read</small>
          <strong>{priorities[0]?.title ?? 'No urgent work'}</strong>
          <span>{priorities[0]?.reason ?? 'The workspace is ready for the next real CRM update.'}</span>
          <button type="button" onClick={() => askHalvex('Analyse today’s CRM workspace. Return the top pipeline risk, missing data, and next manual action.')}>Analyse</button>
        </article>
      </aside>
    </section>
  )
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

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'H'
}

function CardHeader({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return <header className="app-card-header"><div><span>{icon}</span><h2>{title}</h2></div>{action}</header>
}

function askHalvex(query: string) {
  window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query } }))
}
