'use client'

import type { FormEvent } from 'react'
import { Suspense, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutGrid, List, Plus, Search, SlidersHorizontal } from 'lucide-react'
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
  CrmPanel,
  CrmRiskBadge,
  CrmSectionHeader,
  CrmSegmentedFilters,
  CrmSkeleton,
  CrmStat,
  ObjectWorkspaceHeader,
  SavedViewBar,
  ViewTabs,
  WorkspaceBriefing,
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
  const view = search.get('view') ?? 'list'
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
      <ObjectWorkspaceHeader
        object="Deals"
        title="Pipeline records"
        description="Spreadsheet-grade deal control with a secondary board for stage movement. Manual fields stay first-class; Halvex adds evidence-based judgement on demand."
        actions={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary"><Plus size={16} /> New deal</CrmButton>}
        stats={<>
        <CrmStat label="Open deals" value={openDeals.length} />
        <CrmStat label="Open value" value={money(openValue)} />
        <CrmStat label="No next step" value={noNext} />
        <CrmStat label="Needs review" value={needsReview} />
        </>}
      />

      <WorkspaceBriefing items={[
        { label: 'Manual first', title: 'Run deals from the table', text: 'Scan stage, value, close date, people, last activity, next step, risk, and priority without opening every record.' },
        { label: 'Views', title: 'Saved operating lenses', text: 'Open, closing soon, no next step, at risk, and all deals are filters over the same object data, not disconnected reports.' },
        { label: 'AI layer', title: 'Ask for the missing read', text: 'Open a deal to analyse risk, find missing buyer information, extract note updates, or draft a follow-up with evidence.' },
      ]} />

      {quickAddOpen ? <QuickAddDeal onCancel={() => setQuickAddOpen(false)} onCreated={async (id) => { await mutate(); router.push(`/deals/${id}`) }} /> : null}

      <CrmPanel>
        <CrmSectionHeader
          title="Records"
          description="Saved views over the same deal objects. The table is the primary workspace; the board is for stage movement."
          action={<ViewTabs tabs={[
            { href: '/deals?view=list', label: 'List', active: view === 'list', icon: <List size={14} /> },
            { href: '/deals?view=pipeline', label: 'Pipeline', active: view === 'pipeline', icon: <LayoutGrid size={14} /> },
          ]} />}
        />

        <SavedViewBar
          views={[
            { label: 'Open', active: statusFilter === 'open' && risk === 'all' && stageFilter === 'all', onClick: () => { setStatusFilter('open'); setRisk('all'); setStageFilter('all') }, count: allDeals.filter((deal: any) => deal.status === 'open').length },
            { label: 'Closing soon', active: sortBy === 'close' && statusFilter === 'open', onClick: () => { setStatusFilter('open'); setSortBy('close') } },
            { label: 'No next step', active: risk === 'all' && statusFilter === 'open' && sortBy === 'updated' && query === 'no-next-step', onClick: () => { setStatusFilter('open'); setQuery('no-next-step') }, count: noNext },
            { label: 'At risk', active: risk === 'high', onClick: () => { setStatusFilter('open'); setRisk('high') }, count: allDeals.filter((deal: any) => deal.aiRiskLevel === 'high').length },
            { label: 'All deals', active: statusFilter === 'all', onClick: () => setStatusFilter('all'), count: allDeals.length },
            ...savedViews.map(savedView => ({ label: savedView.label, active: isSavedViewActive(savedView, { query, risk, stageFilter, statusFilter, sortBy, view }), onClick: () => applySavedView(savedView) })),
          ]}
        >
          <button type="button" className="crm-saved-view-save" onClick={() => setSaveViewOpen(prev => !prev)}><SlidersHorizontal size={14} /> Save view</button>
        </SavedViewBar>

        {saveViewOpen ? (
          <SaveDealViewPanel
            onSave={saveCurrentView}
            onCancel={() => setSaveViewOpen(false)}
            savedViews={savedViews}
            onDelete={deleteSavedView}
            current={{ query, risk, stageFilter, statusFilter, sortBy, view }}
          />
        ) : null}

        <div className="crm-ai-workstrip" aria-label="Deal intelligence actions">
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: 'Review the open pipeline and identify deals with weak next steps, stale activity, or optimistic close dates.' } }))}>Analyse pipeline health</button>
          <button type="button" onClick={() => setQuery('no-next-step')}>Show missing next steps</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: 'Which active deals need buyer information before the next call?' } }))}>Find missing buyer info</button>
        </div>

        <FilterBar>
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
        </FilterBar>

        {isLoading ? <CrmSkeleton rows={8} /> : null}
        {!isLoading && !deals.length ? <CrmEmpty title={query ? 'No matching deals' : 'No deals yet'} action={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary">Add deal</CrmButton>}>{query ? 'Clear filters or try another search.' : 'Create or import opportunities to start managing your pipeline.'}</CrmEmpty> : null}
        {!isLoading && deals.length > 0 && view === 'list' ? <ListView deals={deals} stages={stages} onMove={moveDeal} movingId={movingId} /> : null}
        {!isLoading && deals.length > 0 && view === 'pipeline' ? <PipelineView stages={stages} deals={deals} onMove={moveDeal} movingId={movingId} /> : null}
      </CrmPanel>
    </CrmPage>
  )
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
          <strong>Save this deal view</strong>
          <p>Stores the current search, status, stage, risk, sort, and list/pipeline mode on this device.</p>
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
    <CrmPanel>
      <CrmSectionHeader title="Add deal" description="Capture the opportunity. Add people, tasks, and notes from the record page." />
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
    </CrmPanel>
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
                <h3>{stage.name}</h3>
                <p>{stageDeals.length} deals · {money(value)}</p>
              </div>
              <div className="crm-stage-list">
                {stageDeals.length ? stageDeals.map(deal => <PipelineDealCard key={deal.id} deal={deal} stages={stages} onMove={onMove} moving={movingId === deal.id} />) : <CrmEmpty title="No deals here">This stage is clear.</CrmEmpty>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
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
                  {!(deal.people ?? []).length ? <span className="crm-muted-cell">No people</span> : null}
                </div>
              </td>
              <td>
                <select className="crm-select" value={deal.stageId ?? ''} disabled={movingId === deal.id} onChange={event => onMove(deal.id, event.target.value)}>
                  {stages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                </select>
              </td>
              <td>{money(deal.valueAmount)}</td>
              <td>{shortDate(deal.expectedCloseDate) ?? 'Missing'}</td>
              <td><span className="crm-muted-cell">{ownerLabel(deal.ownerEmail)}</span></td>
              <td>{shortDate(deal.lastActivityAt) ?? 'No activity'}</td>
              <td><ClampedText lines={2} title={deal.aiNextAction ?? 'No next step'}>{deal.aiNextAction ?? 'No next step'}</ClampedText></td>
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
