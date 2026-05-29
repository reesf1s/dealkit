'use client'

import type { FormEvent, ReactNode } from 'react'
import { Suspense, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Bot, CalendarCheck, CheckSquare, CircleDollarSign, LayoutGrid, List, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import {
  CrmBadge,
  CrmButton,
  ClampedText,
  CompactPipelineCard,
  CrmEmpty,
  DataTable,
  FilterBar,
  CrmPage,
  CrmRiskBadge,
  CrmSegmentedFilters,
  CrmSkeleton,
  SavedViewBar,
  ViewTabs,
  money,
  shortDate,
} from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

type DealSavedView = {
  id: string
  label: string
  view: string
  query: string
  risk: 'all' | 'high' | 'medium' | 'low'
  stageFilter: string
  statusFilter: 'all' | 'open' | 'won' | 'lost' | 'archived'
  sortBy: 'updated' | 'value' | 'close' | 'stage'
}

const DEAL_SAVED_VIEWS_KEY = 'halvex-deal-saved-views'
const DEAL_SAVED_VIEWS_API = '/api/crm/saved-views?objectType=deal'

export default function DealsPage() {
  return (
    <Suspense fallback={<CrmPage><CrmSkeleton rows={6} /></CrmPage>}>
      <DealsContent />
    </Suspense>
  )
}

function DealsContent() {
  const router = useRouter()
  const search = useSearchParams()
  const view = search.get('view') ?? 'pipeline'
  const [quickAddOpen, setQuickAddOpen] = useState(search.get('quick') === 'deal')
  const [query, setQuery] = useState('')
  const [risk, setRisk] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'won' | 'lost' | 'archived'>('open')
  const [sortBy, setSortBy] = useState<'updated' | 'value' | 'close' | 'stage'>('updated')
  const [movingId, setMovingId] = useState<string | null>(null)
  const [savedViews, setSavedViews] = useState<DealSavedView[]>([])
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const { data, isLoading, mutate } = useSWR('/api/crm/pipeline', fetcher, { revalidateOnFocus: false })
  const { data: savedViewData, mutate: mutateSavedViews } = useSWR(DEAL_SAVED_VIEWS_API, fetcher, { revalidateOnFocus: false })
  const stages = data?.data?.stages ?? []
  const allDeals = useMemo(() => data?.data?.deals ?? [], [data])
  const deals = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = allDeals.filter((deal: any) => {
      const haystack = [deal.title, deal.companyName, deal.stageName, deal.aiNextAction, deal.aiRiskLevel].filter(Boolean).join(' ').toLowerCase()
      const riskMatches = risk === 'all' || deal.aiRiskLevel === risk
      const stageMatches = stageFilter === 'all' || deal.stageId === stageFilter
      const statusMatches = statusFilter === 'all' || deal.status === statusFilter
      const queryMatches = q === 'no-next-step'
        ? !deal.aiNextAction && !deal.nextStepDueAt
        : !q || haystack.includes(q)
      return riskMatches && stageMatches && statusMatches && queryMatches
    })
    return filtered.sort((a: any, b: any) => {
      if (sortBy === 'value') return Number(b.valueAmount ?? 0) - Number(a.valueAmount ?? 0)
      if (sortBy === 'close') return dateValue(a.expectedCloseDate) - dateValue(b.expectedCloseDate)
      if (sortBy === 'stage') return String(a.stageName ?? '').localeCompare(String(b.stageName ?? ''))
      return dateValue(b.updatedAt ?? b.lastActivityAt) - dateValue(a.updatedAt ?? a.lastActivityAt)
    })
  }, [allDeals, query, risk, sortBy, stageFilter, statusFilter])
  const openDeals = deals.filter((deal: any) => deal.status === 'open')
  const openValue = openDeals.reduce((sum: number, deal: any) => sum + (deal.valueAmount ?? 0), 0)
  const noNext = openDeals.filter((deal: any) => !deal.aiNextAction && !deal.nextStepDueAt).length
  const needsReview = openDeals.filter((deal: any) => deal.aiRiskLevel === 'high' || !deal.valueAmount || !deal.expectedCloseDate).length
  const showDealControls = allDeals.length > 0 || Boolean(query) || risk !== 'all' || stageFilter !== 'all' || statusFilter !== 'open'

  useEffect(() => {
    if (search.get('quick') === 'deal') setQuickAddOpen(true)
  }, [search])

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(DEAL_SAVED_VIEWS_KEY) || '[]')
      if (Array.isArray(parsed)) setSavedViews(parsed.filter(Boolean).slice(0, 8))
    } catch {
      setSavedViews([])
    }
  }, [])

  useEffect(() => {
    const serverViews = savedViewData?.data
    if (!Array.isArray(serverViews)) return
    const mapped = serverViews.map((view: any) => ({ id: view.id, label: view.label, ...(view.config ?? {}) })).filter(isDealSavedView).slice(0, 8)
    setSavedViews(mapped)
    window.localStorage.setItem(DEAL_SAVED_VIEWS_KEY, JSON.stringify(mapped))
  }, [savedViewData])

  function persistSavedViews(next: DealSavedView[]) {
    setSavedViews(next)
    window.localStorage.setItem(DEAL_SAVED_VIEWS_KEY, JSON.stringify(next))
  }

  function applySavedView(savedView: DealSavedView) {
    setQuery(savedView.query)
    setRisk(savedView.risk)
    setStageFilter(savedView.stageFilter)
    setStatusFilter(savedView.statusFilter)
    setSortBy(savedView.sortBy)
    if (savedView.view !== view) router.push(`/deals?view=${savedView.view}`)
  }

  async function deleteSavedView(id: string) {
    persistSavedViews(savedViews.filter(savedView => savedView.id !== id))
    await fetch(`/api/crm/saved-views?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null)
    await mutateSavedViews()
  }

  async function saveCurrentView(label: string) {
    const nextView: DealSavedView = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `view-${Date.now()}`,
      label,
      view,
      query,
      risk,
      stageFilter,
      statusFilter,
      sortBy,
    }
    persistSavedViews([nextView, ...savedViews.filter(savedView => savedView.label.toLowerCase() !== label.toLowerCase())].slice(0, 8))
    await fetch('/api/crm/saved-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectType: 'deal', label, config: { view, query, risk, stageFilter, statusFilter, sortBy } }),
    }).catch(() => null)
    await mutateSavedViews()
    setSaveViewOpen(false)
  }

  async function moveDeal(dealId: string, stageId: string) {
    setMovingId(dealId)
    try {
      await fetch(`/api/crm/deals/${dealId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId }),
      })
      await mutate()
    } finally {
      setMovingId(null)
    }
  }

  return (
    <CrmPage wide>
      <section className="app-page-head pipeline-page-head">
        <div>
          <span className="app-kicker">Pipeline</span>
          <h1>Pipeline</h1>
          <p>{openDeals.length} open · {money(openValue)} · {noNext} without next step</p>
        </div>
        <div className="app-page-actions">
          <CrmButton onClick={() => askHalvex('Analyse the open pipeline. Show risks, stale records, buyer gaps, and suggested actions.')}>
            <Bot size={16} /> Analyse
          </CrmButton>
          <CrmButton onClick={() => setQuickAddOpen(true)} tone="primary"><Plus size={16} /> New deal</CrmButton>
        </div>
      </section>

      {quickAddOpen ? <QuickAddDeal onCancel={() => setQuickAddOpen(false)} onCreated={async (id) => { await mutate(); router.push(`/deals/${id}`) }} /> : null}

      <PipelineInsightTimeline deals={openDeals} needsReview={needsReview} />

      <section className="app-card app-pipeline-shell">
        <CardHeader
          icon={<LayoutGrid size={18} />}
          title="Opportunities"
          action={<ViewTabs tabs={[
            { href: '/deals?view=list', label: 'List', active: view === 'list', icon: <List size={14} /> },
            { href: '/deals?view=pipeline', label: 'Pipeline', active: view === 'pipeline', icon: <LayoutGrid size={14} /> },
          ]} />}
        />

        {showDealControls ? <SavedViewBar
          views={[
            { label: 'Open', active: statusFilter === 'open' && risk === 'all' && stageFilter === 'all', onClick: () => { setStatusFilter('open'); setRisk('all'); setStageFilter('all') }, count: allDeals.filter((deal: any) => deal.status === 'open').length },
            { label: 'Closing soon', active: sortBy === 'close' && statusFilter === 'open', onClick: () => { setStatusFilter('open'); setSortBy('close') } },
            { label: 'No next step', active: risk === 'all' && statusFilter === 'open' && sortBy === 'updated' && query === 'no-next-step', onClick: () => { setStatusFilter('open'); setQuery('no-next-step') }, count: noNext },
            { label: 'At risk', active: risk === 'high', onClick: () => { setStatusFilter('open'); setRisk('high') }, count: allDeals.filter((deal: any) => deal.aiRiskLevel === 'high').length },
            { label: 'All deals', active: statusFilter === 'all', onClick: () => setStatusFilter('all'), count: allDeals.length },
            ...savedViews.map(savedView => ({ label: savedView.label, active: isSavedViewActive(savedView, { query, risk, stageFilter, statusFilter, sortBy, view }), onClick: () => applySavedView(savedView) })),
          ]}
        >
          <button type="button" className="crm-saved-view-save" onClick={() => setSaveViewOpen(prev => !prev)}><SlidersHorizontal size={14} /> Save</button>
        </SavedViewBar> : null}

        {showDealControls && saveViewOpen ? (
          <SaveDealViewPanel
            onSave={saveCurrentView}
            onCancel={() => setSaveViewOpen(false)}
            savedViews={savedViews}
            onDelete={deleteSavedView}
            current={{ query, risk, stageFilter, statusFilter, sortBy, view }}
          />
        ) : null}

        {showDealControls ? <FilterBar>
          <label className="crm-search-button">
            <Search size={16} />
            <input value={query === 'no-next-step' ? '' : query} onChange={event => setQuery(event.target.value)} placeholder="Search deals, companies, people, next steps..." />
          </label>
          <select className="crm-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="archived">Archived</option>
          </select>
          <select className="crm-select" value={stageFilter} onChange={event => setStageFilter(event.target.value)}>
            <option value="all">All stages</option>
            {stages.map((stage: any) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
          <select className="crm-select" value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)}>
            <option value="updated">Sort by activity</option>
            <option value="value">Sort by value</option>
            <option value="close">Sort by close date</option>
            <option value="stage">Sort by stage</option>
          </select>
          <CrmSegmentedFilters
            label="Deal risk filters"
            value={risk}
            onChange={setRisk}
            options={[
              { value: 'all', label: 'All', count: allDeals.length },
              { value: 'high', label: 'High risk', count: allDeals.filter((deal: any) => deal.aiRiskLevel === 'high').length },
              { value: 'medium', label: 'Medium', count: allDeals.filter((deal: any) => deal.aiRiskLevel === 'medium').length },
              { value: 'low', label: 'Low', count: allDeals.filter((deal: any) => deal.aiRiskLevel === 'low').length },
            ]}
          />
        </FilterBar> : null}

        {isLoading ? <CrmSkeleton rows={8} /> : null}
        {!isLoading && !deals.length && query ? <CrmEmpty title="No matching deals" action={<CrmButton onClick={() => { setQuery(''); setRisk('all'); setStageFilter('all') }} tone="primary">Clear filters</CrmButton>} /> : null}
        {!isLoading && !deals.length && !query && !quickAddOpen ? (
          <CrmEmpty title="No deals yet" action={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary"><Plus size={15} /> New deal</CrmButton>}>
            Create the first opportunity with a company, value, close date, and next step. The list and board will build from the same record.
          </CrmEmpty>
        ) : null}
        {!isLoading && deals.length > 0 && view === 'list' ? <ListView deals={deals} stages={stages} onMove={moveDeal} movingId={movingId} /> : null}
        {!isLoading && deals.length > 0 && view === 'pipeline' ? <PipelineView stages={stages} deals={deals} onMove={moveDeal} movingId={movingId} /> : null}
      </section>
    </CrmPage>
  )
}

function CardHeader({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return <header className="app-card-header"><div><span>{icon}</span><h2>{title}</h2></div>{action}</header>
}

function askHalvex(query: string) {
  window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query } }))
}

function SaveDealViewPanel({ onSave, onCancel, savedViews, onDelete, current }: {
  onSave: (label: string) => void
  onCancel: () => void
  savedViews: DealSavedView[]
  onDelete: (id: string) => void
  current: Pick<DealSavedView, 'query' | 'risk' | 'stageFilter' | 'statusFilter' | 'sortBy' | 'view'>
}) {
  const [label, setLabel] = useState('')
  return (
    <div className="crm-save-view-panel">
      <form onSubmit={(event) => { event.preventDefault(); if (label.trim()) onSave(label.trim()) }}>
        <div>
          <strong>Save view</strong>
          <p>Search, filters, sort, and layout.</p>
        </div>
        <input className="crm-input" value={label} onChange={event => setLabel(event.target.value)} placeholder="e.g. Founder follow-ups" autoFocus />
        <CrmButton type="submit" tone="primary" disabled={!label.trim()}>Save view</CrmButton>
        <CrmButton onClick={onCancel}>Cancel</CrmButton>
      </form>
      <div className="crm-save-view-summary">
        <span>Current lens</span>
        <p>{describeSavedView(current)}</p>
      </div>
      {savedViews.length ? (
        <div className="crm-save-view-list">
          {savedViews.map(savedView => (
            <article key={savedView.id}>
              <div><strong>{savedView.label}</strong><p>{describeSavedView(savedView)}</p></div>
              <button type="button" onClick={() => onDelete(savedView.id)}>Remove</button>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function isSavedViewActive(savedView: DealSavedView, current: Pick<DealSavedView, 'query' | 'risk' | 'stageFilter' | 'statusFilter' | 'sortBy' | 'view'>) {
  return savedView.query === current.query
    && savedView.risk === current.risk
    && savedView.stageFilter === current.stageFilter
    && savedView.statusFilter === current.statusFilter
    && savedView.sortBy === current.sortBy
    && savedView.view === current.view
}

function isDealSavedView(view: any): view is DealSavedView {
  return Boolean(view?.id && view?.label && typeof view.query === 'string' && typeof view.view === 'string')
}

function describeSavedView(view: Pick<DealSavedView, 'query' | 'risk' | 'stageFilter' | 'statusFilter' | 'sortBy' | 'view'>) {
  return [
    view.view === 'pipeline' ? 'Pipeline' : 'List',
    view.statusFilter !== 'open' ? `${view.statusFilter} status` : 'open deals',
    view.risk !== 'all' ? `${view.risk} risk` : null,
    view.stageFilter !== 'all' ? 'specific stage' : null,
    view.query ? `search "${view.query}"` : null,
    `sort ${view.sortBy}`,
  ].filter(Boolean).join(' · ')
}

function QuickAddDeal({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [valueAmount, setValueAmount] = useState('')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/crm/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          companyName,
          valueAmount: valueAmount ? Number(valueAmount) : null,
          expectedCloseDate: expectedCloseDate || null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error ?? 'Could not create deal')
      onCreated(payload.data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create deal')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="app-card app-quick-add">
      <CardHeader icon={<Plus size={18} />} title="New deal" />
      <form className="crm-form-grid" onSubmit={submit}>
        <label>Deal<input className="crm-input" value={title} onChange={event => setTitle(event.target.value)} placeholder="Website rebuild" required /></label>
        <label>Company<input className="crm-input" value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder="Finch Studio" required /></label>
        <label>Value<input className="crm-input" value={valueAmount} onChange={event => setValueAmount(event.target.value)} type="number" min="0" placeholder="12000" /></label>
        <label>Close date<input className="crm-input" value={expectedCloseDate} onChange={event => setExpectedCloseDate(event.target.value)} type="date" /></label>
        <div className="crm-form-actions">
          <CrmButton type="submit" tone="primary" disabled={saving || !title.trim() || !companyName.trim()}>{saving ? 'Creating...' : 'Create deal'}</CrmButton>
          <CrmButton onClick={onCancel} disabled={saving}>Cancel</CrmButton>
          {error ? <CrmBadge tone="danger">{error}</CrmBadge> : null}
        </div>
      </form>
    </section>
  )
}

function PipelineView({ stages, deals, onMove, movingId }: { stages: any[]; deals: any[]; onMove: (dealId: string, stageId: string) => void; movingId: string | null }) {
  const dealsByStage = useMemo(() => {
    const groups = new Map<string, any[]>()
    for (const deal of deals) {
      const key = deal.stageId ?? 'unstaged'
      groups.set(key, [...(groups.get(key) ?? []), deal])
    }
    return groups
  }, [deals])

  return (
    <div className="crm-pipeline-frame">
      <div className="crm-pipeline" role="list" aria-label="Sales pipeline">
        {stages.map((stage: any) => {
          const stageDeals = dealsByStage.get(stage.id) ?? []
          const value = stageDeals.reduce((sum, deal) => sum + (deal.valueAmount ?? 0), 0)
          return (
            <section key={stage.id} className="crm-stage" role="listitem">
              <div className="crm-stage-header">
                <div>
                  <h3><span aria-hidden="true" />{stage.name}</h3>
                  <p>{money(value)}</p>
                </div>
                <strong>{stageDeals.length}</strong>
              </div>
              <div className="crm-stage-list">
                {stageDeals.length ? stageDeals.map(deal => <PipelineDealCard key={deal.id} deal={deal} stages={stages} onMove={onMove} moving={movingId === deal.id} />) : <CrmEmpty title="No opportunities" />}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function PipelineInsightTimeline({ deals, needsReview }: { deals: any[]; needsReview: number }) {
  const closingSoon = deals
    .filter(deal => daysUntil(deal.expectedCloseDate) != null && Number(daysUntil(deal.expectedCloseDate)) <= 14)
    .sort((a, b) => dateValue(a.expectedCloseDate) - dateValue(b.expectedCloseDate))[0]
  const highValue = [...deals].sort((a, b) => Number(b.valueAmount ?? 0) - Number(a.valueAmount ?? 0))[0]
  const stale = deals.find(deal => !deal.aiNextAction && !deal.nextStepDueAt)
  const suggested = stale ?? closingSoon ?? highValue
  const due = suggested?.expectedCloseDate ? shortDate(suggested.expectedCloseDate) : 'Today'
  return (
    <section className="pipeline-insight-canvas" aria-label="Pipeline insights">
      <div className="pipeline-insight-copy">
        <span>Pipeline insights</span>
        <h2>See what&apos;s happening across deals and why</h2>
        <p>Spot stalled opportunities, clustered objections, overdue next steps, and closing pressure without digging through every record.</p>
      </div>
      <div className="pipeline-insight-timeline">
        <div className="pipeline-insight-line" aria-hidden="true" />
        <TimelineMoment position="17%" time="2h ago" icon={<CalendarCheck size={17} />} label={closingSoon ? 'Close date approaching' : 'Pipeline checked'} deal={closingSoon} fallback="No close dates due soon" />
        <TimelineMoment position="47%" time="23m ago" icon={<CheckSquare size={17} />} label={stale ? 'Next step missing' : 'Task coverage reviewed'} deal={stale} fallback="Open deals have next steps" accent />
        <TimelineMoment position="84%" time="Just now" icon={<CircleDollarSign size={17} />} label={highValue ? 'Largest deal reviewed' : 'Forecast ready'} deal={highValue} fallback="Add values to weight the pipeline" />
        <article className="pipeline-suggestion-card">
          <span>Why this was suggested</span>
          {suggested ? (
            <>
              <p>{stale ? `${suggested.companyName ?? suggested.title} has no saved next step, so it can quietly stall even if the deal is still open.` : closingSoon ? `${suggested.companyName ?? suggested.title} is approaching its close date and should have clear evidence for the next move.` : `${suggested.companyName ?? suggested.title} is the largest open opportunity and deserves a clean action plan.`}</p>
              <div className="pipeline-suggestion-task"><CheckSquare size={17} /> {stale ? `Set a next step for ${suggested.companyName ?? suggested.title}` : `Review ${suggested.companyName ?? suggested.title}`}</div>
              <dl>
                <div><dt>Status</dt><dd>Todo</dd></div>
                <div><dt>Assignee</dt><dd>{ownerLabel(suggested.ownerEmail)}</dd></div>
                <div><dt>Related record</dt><dd><Link href={`/deals/${suggested.id}`}>{suggested.companyName ?? suggested.title}</Link></dd></div>
                <div><dt>Due date</dt><dd>{due}</dd></div>
                <div><dt>Source</dt><dd>{needsReview ? `${needsReview} records need review` : 'Pipeline analysis'}</dd></div>
              </dl>
            </>
          ) : (
            <>
              <p>Create your first opportunities and Halvex will surface the deals that need a task, note, or field update.</p>
              <div className="pipeline-suggestion-task"><CheckSquare size={17} /> Add a deal with company, value, close date, and next step</div>
            </>
          )}
        </article>
      </div>
    </section>
  )
}

function TimelineMoment({ position, time, icon, label, deal, fallback, accent = false }: { position: string; time: string; icon: ReactNode; label: string; deal?: any; fallback: string; accent?: boolean }) {
  return (
    <article className={`pipeline-moment ${accent ? 'accent' : ''}`} style={{ left: position }}>
      <span className="pipeline-moment-time">{time}</span>
      <span className="pipeline-moment-dot" aria-hidden="true" />
      <div className="pipeline-moment-pill">
        {icon}
        <strong>{label}</strong>
        {deal ? <Link href={`/deals/${deal.id}`}>{deal.companyName ?? deal.title}</Link> : <small>{fallback}</small>}
      </div>
    </article>
  )
}

function PipelineDealCard({ deal, stages, onMove, moving }: { deal: any; stages: any[]; onMove: (dealId: string, stageId: string) => void; moving: boolean }) {
  return <CompactPipelineCard deal={deal} stages={stages} onMove={onMove} moving={moving} />
}

function ListView({ deals, stages, onMove, movingId }: { deals: any[]; stages: any[]; onMove: (dealId: string, stageId: string) => void; movingId: string | null }) {
  return (
    <DataTable>
      <table className="crm-table crm-object-table">
        <thead><tr><th>Deal</th><th>Company</th><th>People</th><th>Stage</th><th>Value</th><th>Close date</th><th>Owner</th><th>Last activity</th><th>Next step</th><th>Risk</th><th>Priority</th></tr></thead>
        <tbody>
          {deals.map(deal => (
            <tr key={deal.id}>
              <td><Link href={`/deals/${deal.id}`}><ClampedText lines={1} title={deal.title}>{deal.title}</ClampedText></Link></td>
              <td><ClampedText lines={1}>{deal.companyName ?? 'Unknown company'}</ClampedText></td>
              <td>
                <div className="crm-people-cell">
                  {(deal.people ?? []).slice(0, 2).map((person: any) => (
                    <Link key={person.contactId ?? person.id} href={`/people/${person.contactId ?? person.id}`} className="crm-person-pill">
                      {person.fullName}
                    </Link>
                  ))}
                  {(deal.people ?? []).length > 2 ? <span className="crm-person-more">+{(deal.people ?? []).length - 2}</span> : null}
                  {!(deal.people ?? []).length ? <span className="crm-muted-cell">None</span> : null}
                </div>
              </td>
              <td>
                <select className="crm-select" value={deal.stageId ?? ''} disabled={movingId === deal.id} onChange={event => onMove(deal.id, event.target.value)}>
                  {stages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                </select>
              </td>
              <td>{money(deal.valueAmount)}</td>
              <td>{shortDate(deal.expectedCloseDate) ?? '—'}</td>
              <td><span className="crm-muted-cell">{ownerLabel(deal.ownerEmail)}</span></td>
              <td>{shortDate(deal.lastActivityAt) ?? '—'}</td>
              <td><ClampedText lines={2} title={deal.aiNextAction ?? '—'}>{deal.aiNextAction ?? '—'}</ClampedText></td>
              <td><CrmRiskBadge risk={deal.aiRiskLevel} /></td>
              <td><span className={`crm-priority-pill ${dealPriority(deal).toLowerCase()}`}>{dealPriority(deal)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTable>
  )
}

function dateValue(value?: string | Date | null) {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  return Number.isFinite(time) ? time : 0
}

function ownerLabel(email?: string | null) {
  if (!email) return 'Unassigned'
  return String(email).split('@')[0] ?? email
}

function dealPriority(deal: any) {
  if (deal.aiRiskLevel === 'high' || (!deal.aiNextAction && deal.status === 'open')) return 'High'
  if (!deal.expectedCloseDate || !deal.valueAmount) return 'Medium'
  return 'Normal'
}

function daysUntil(value?: string | Date | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  if (!Number.isFinite(time)) return null
  return Math.ceil((time - Date.now()) / 86_400_000)
}
