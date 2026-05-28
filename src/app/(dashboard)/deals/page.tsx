'use client'

import type { FormEvent } from 'react'
import { Suspense, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutGrid, List, Plus, Search } from 'lucide-react'
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
  PageIntent,
  ScenicPanel,
  ViewTabs,
  money,
  shortDate,
} from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

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
  const { data, isLoading, mutate } = useSWR('/api/crm/pipeline', fetcher, { revalidateOnFocus: false })
  const stages = data?.data?.stages ?? []
  const allDeals = useMemo(() => data?.data?.deals ?? [], [data])
  const deals = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = allDeals.filter((deal: any) => {
      const haystack = [deal.title, deal.companyName, deal.stageName, deal.aiNextAction, deal.aiRiskLevel].filter(Boolean).join(' ').toLowerCase()
      const riskMatches = risk === 'all' || deal.aiRiskLevel === risk
      const stageMatches = stageFilter === 'all' || deal.stageId === stageFilter
      const statusMatches = statusFilter === 'all' || deal.status === statusFilter
      return riskMatches && stageMatches && statusMatches && (!q || haystack.includes(q))
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
      <ScenicPanel
        eyebrow="Deals"
        title="Sales pipeline"
        description="Create, edit, filter, sort, and move opportunities manually. AI deal intelligence is available when you ask for it."
        actions={<><CrmButton onClick={() => setQuickAddOpen(true)} tone="primary"><Plus size={16} /> Add deal</CrmButton><CrmButton href="/settings?section=imports">Import</CrmButton></>}
        compact
      >
        <CrmStat label="Open deals" value={openDeals.length} />
        <CrmStat label="Open value" value={money(openValue)} />
        <CrmStat label="No next step" value={noNext} />
        <CrmStat label="Needs review" value={needsReview} />
      </ScenicPanel>

      <PageIntent items={[
        { label: 'Saved view', title: 'Open pipeline', text: 'Default working set: active opportunities sorted by recent activity.', action: <CrmButton href="/deals?view=list">Open list</CrmButton> },
        { label: 'Manual fields', title: 'Keep records complete', text: 'Stage, value, close date, probability and next step stay editable by the user.', action: <CrmButton href="/deals?view=pipeline">Board</CrmButton> },
        { label: 'On demand', title: 'Ask for deal intelligence', text: 'Use health only when you want risks, summaries, or recommended next steps.', action: <CrmButton href="/deals?view=health">Insights</CrmButton> },
      ]} />

      {quickAddOpen ? <QuickAddDeal onCancel={() => setQuickAddOpen(false)} onCreated={async (id) => { await mutate(); router.push(`/deals/${id}`) }} /> : null}

      <CrmPanel>
        <CrmSectionHeader
          title="Deals"
          description="Pipeline and list views share the same records. Health is advisory and never edits the CRM."
          action={<ViewTabs tabs={[
            { href: '/deals?view=pipeline', label: 'Pipeline', active: view === 'pipeline', icon: <LayoutGrid size={14} /> },
            { href: '/deals?view=list', label: 'List', active: view === 'list', icon: <List size={14} /> },
            { href: '/deals?view=health', label: 'Health', active: view === 'health' || view === 'intelligence' },
          ]} />}
        />

        <FilterBar>
          <label className="crm-search-button">
            <Search size={16} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search deals, companies, stages, next actions..." />
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
        {!isLoading && deals.length > 0 && view === 'pipeline' ? <PipelineView stages={stages} deals={deals} onMove={moveDeal} movingId={movingId} /> : null}
        {!isLoading && deals.length > 0 && view === 'list' ? <ListView deals={deals} stages={stages} onMove={moveDeal} movingId={movingId} /> : null}
        {!isLoading && deals.length > 0 && (view === 'health' || view === 'intelligence') ? <HealthView deals={deals} /> : null}
      </CrmPanel>
    </CrmPage>
  )
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
      <CrmSectionHeader title="Add deal" description="Capture the opportunity. Add people, tasks, notes, and meetings from the record page." />
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
      <table className="crm-table">
        <thead><tr><th>Deal</th><th>Company</th><th>Stage</th><th>Value</th><th>Close</th><th>Risk</th><th>Next action</th></tr></thead>
        <tbody>
          {deals.map(deal => (
            <tr key={deal.id}>
              <td><Link href={`/deals/${deal.id}`}><ClampedText lines={1} title={deal.title}>{deal.title}</ClampedText></Link></td>
              <td><ClampedText lines={1}>{deal.companyName ?? 'Unknown company'}</ClampedText></td>
              <td>
                <select className="crm-select" value={deal.stageId ?? ''} disabled={movingId === deal.id} onChange={event => onMove(deal.id, event.target.value)}>
                  {stages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                </select>
              </td>
              <td>{money(deal.valueAmount)}</td>
              <td>{shortDate(deal.expectedCloseDate) ?? 'Missing'}</td>
              <td><CrmRiskBadge risk={deal.aiRiskLevel} /></td>
              <td><ClampedText lines={2} title={deal.aiNextAction ?? 'No next step'}>{deal.aiNextAction ?? 'No next step'}</ClampedText></td>
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

function HealthView({ deals }: { deals: any[] }) {
  const groups = [
    { title: 'At risk', deals: deals.filter(deal => deal.aiRiskLevel === 'high' || (deal.aiScore ?? 50) < 45), text: 'Risk, blockers, or low momentum.' },
    { title: 'No next step', deals: deals.filter(deal => !deal.aiNextAction && !deal.nextStepDueAt), text: 'Open deals need one concrete next action.' },
    { title: 'Missing key data', deals: deals.filter(deal => !deal.valueAmount || !deal.expectedCloseDate), text: 'Missing value or close date lowers confidence.' },
  ]
  return (
    <div className="crm-grid-3">
      {groups.map(group => (
        <CrmPanel key={group.title}>
          <CrmSectionHeader title={group.title} description={group.text} />
          <div className="crm-stack">
            {group.deals.slice(0, 6).map(deal => (
              <Link key={deal.id} href={`/deals/${deal.id}`} className="crm-record-card">
                <strong><ClampedText lines={1}>{deal.title}</ClampedText></strong>
                <p><ClampedText lines={2}>{deal.companyName ?? 'Unknown company'} · {deal.aiNextAction ?? deal.intelligence?.riskDrivers?.[0] ?? 'Review this record.'}</ClampedText></p>
              </Link>
            ))}
            {!group.deals.length ? <CrmEmpty title="Nothing here">No records match this pattern.</CrmEmpty> : null}
          </div>
        </CrmPanel>
      ))}
    </div>
  )
}
