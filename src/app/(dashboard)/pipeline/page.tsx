'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { useMemo, useState } from 'react'
import { AlertTriangle, Plus, Search } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { OperatorHeader, OperatorKpi, OperatorMetricGrid, OperatorPage, OperatorPanel } from '@/components/shared/OperatorUI'

export const dynamic = 'force-dynamic'

type Stage = { id: string; name: string; key: string; color: string; position: number; probability: number; isClosed: boolean }
type Deal = {
  id: string
  title: string
  valueAmount: number | null
  valueCurrency: string
  expectedCloseDate: string | null
  status: string
  aiScore: number | null
  aiRiskLevel: string
  aiNextAction: string | null
  lastActivityAt: string | null
  nextStepDueAt: string | null
  companyName: string | null
  stageId: string | null
  ownerEmail: string | null
}
type PipelineData = { stages: Stage[]; deals: Deal[] }

function money(value: number | null | undefined) {
  const v = value ?? 0
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000) return `£${Math.round(v / 1_000)}k`
  return `£${v}`
}

function relDate(value: string | null) {
  if (!value) return 'No close date'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function riskTone(risk: string, score: number | null) {
  if (risk === 'high' || (score ?? 100) < 45) return '#ef4444'
  if (risk === 'medium' || (score ?? 100) < 65) return '#f59e0b'
  return '#22c55e'
}

export default function PipelinePage() {
  const { data, isLoading, mutate } = useSWR<{ data: PipelineData }>('/api/crm/pipeline', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20_000,
  })
  const [query, setQuery] = useState('')
  const [risk, setRisk] = useState('all')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [quickAdd, setQuickAdd] = useState({ title: '', companyName: '', valueAmount: '' })
  const pipeline = data?.data

  const deals = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (pipeline?.deals ?? []).filter(deal => {
      const matchesQuery = !q || `${deal.title} ${deal.companyName ?? ''} ${deal.aiNextAction ?? ''}`.toLowerCase().includes(q)
      const matchesRisk = risk === 'all' || deal.aiRiskLevel === risk
      return matchesQuery && matchesRisk
    })
  }, [pipeline?.deals, query, risk])

  const openDeals = deals.filter(deal => deal.status === 'open')
  const pipelineValue = openDeals.reduce((sum, deal) => sum + (deal.valueAmount ?? 0), 0)
  const weighted = openDeals.reduce((sum, deal) => sum + (deal.valueAmount ?? 0) * ((deal.aiScore ?? 45) / 100), 0)

  async function moveDeal(dealId: string, stageId: string) {
    await fetch(`/api/crm/deals/${dealId}/stage`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stageId }),
    })
    setDraggedId(null)
    mutate()
  }

  async function addDeal(event: React.FormEvent) {
    event.preventDefault()
    if (!quickAdd.title.trim() || !quickAdd.companyName.trim()) return
    await fetch('/api/crm/pipeline', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: quickAdd.title,
        companyName: quickAdd.companyName,
        valueAmount: quickAdd.valueAmount ? Number(quickAdd.valueAmount) : null,
      }),
    })
    setQuickAdd({ title: '', companyName: '', valueAmount: '' })
    mutate()
  }

  return (
    <OperatorPage maxWidth="none">
      <OperatorHeader
        eyebrow="Pipeline"
        title="Native CRM pipeline"
        description="Drag deals between stages, keep next actions visible, and let Halvex flag risk without extra admin."
      />

      <OperatorMetricGrid>
        <OperatorKpi label="Open deals" value={openDeals.length} />
        <OperatorKpi label="Pipeline value" value={money(pipelineValue)} />
        <OperatorKpi label="Weighted value" value={money(Math.round(weighted))} />
        <OperatorKpi label="High risk" value={openDeals.filter(deal => deal.aiRiskLevel === 'high').length} tone="red" icon={AlertTriangle} />
      </OperatorMetricGrid>

      <OperatorPanel>
        <form onSubmit={addDeal} className="crm-toolbar">
          <label className="crm-search">
            <Search size={14} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search deals, companies, next actions" />
          </label>
          <select value={risk} onChange={event => setRisk(event.target.value)} className="crm-select">
            <option value="all">All risk</option>
            <option value="high">High risk</option>
            <option value="medium">Medium risk</option>
            <option value="low">Low risk</option>
            <option value="unknown">Unknown</option>
          </select>
          <input className="crm-input" value={quickAdd.title} onChange={event => setQuickAdd({ ...quickAdd, title: event.target.value })} placeholder="Deal name" />
          <input className="crm-input" value={quickAdd.companyName} onChange={event => setQuickAdd({ ...quickAdd, companyName: event.target.value })} placeholder="Company" />
          <input className="crm-input small" value={quickAdd.valueAmount} onChange={event => setQuickAdd({ ...quickAdd, valueAmount: event.target.value })} placeholder="Value" inputMode="numeric" />
          <button className="operator-button operator-button-primary" type="submit"><Plus size={14} /> Add</button>
        </form>
      </OperatorPanel>

      <div className="crm-kanban">
        {(pipeline?.stages ?? []).map(stage => {
          const stageDeals = deals.filter(deal => deal.stageId === stage.id)
          const total = stageDeals.reduce((sum, deal) => sum + (deal.valueAmount ?? 0), 0)
          return (
            <section
              key={stage.id}
              className="crm-kanban-column"
              onDragOver={event => event.preventDefault()}
              onDrop={() => draggedId && moveDeal(draggedId, stage.id)}
            >
              <header>
                <span style={{ background: stage.color }} />
                <strong>{stage.name}</strong>
                <small>{stageDeals.length} · {money(total)}</small>
              </header>
              <div className="crm-kanban-cards">
                {stageDeals.map(deal => (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    className="crm-deal-card"
                    draggable
                    onDragStart={() => setDraggedId(deal.id)}
                  >
                    <div className="crm-deal-card-head">
                      <strong>{deal.title}</strong>
                      <span style={{ background: riskTone(deal.aiRiskLevel, deal.aiScore) }} />
                    </div>
                    <p>{deal.companyName ?? 'No company'}</p>
                    <div className="crm-deal-card-meta">
                      <span>{money(deal.valueAmount)}</span>
                      <span>{relDate(deal.expectedCloseDate)}</span>
                      <span>{deal.aiScore ?? 'n/a'}%</span>
                    </div>
                    <small>{deal.aiNextAction || deal.nextStepDueAt ? 'Next step set' : 'No next step'}</small>
                  </Link>
                ))}
                {!isLoading && stageDeals.length === 0 && <div className="crm-empty-column">Drop deals here</div>}
              </div>
            </section>
          )
        })}
      </div>
    </OperatorPage>
  )
}
