'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, Search, Sparkles } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import {
  CrmButton,
  CrmEmptyAction,
  CrmHero,
  CrmPageShell,
  CrmPanel,
  CrmPill,
} from '@/components/crm/CrmDesignSystem'

export const dynamic = 'force-dynamic'

type Stage = { id: string; name: string; key: string; color: string; position: number; probability: number; isClosed: boolean }
type Deal = {
  id: string
  title: string
  valueAmount: number | null
  expectedCloseDate: string | null
  status: string
  aiScore: number | null
  aiRiskLevel: string
  aiNextAction: string | null
  lastActivityAt: string | null
  nextStepDueAt: string | null
  companyName: string | null
  stageId: string | null
}
type PipelineData = { stages: Stage[]; deals: Deal[] }

function money(value: number | null | undefined) {
  if (!value || value <= 0) return 'Value missing'
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `£${Math.round(value / 1_000)}k`
  return `£${value}`
}

function dateLabel(value: string | null) {
  if (!value) return 'Close date missing'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function riskTone(deal: Deal) {
  if (deal.aiRiskLevel === 'high' || (deal.aiScore ?? 100) < 50) return 'risk' as const
  if (deal.aiRiskLevel === 'medium' || (deal.aiScore ?? 100) < 75) return 'watch' as const
  if (deal.aiRiskLevel === 'low') return 'good' as const
  return 'neutral' as const
}

function insight(deal: Deal) {
  if (!deal.valueAmount || deal.valueAmount <= 0) return 'Value is missing, so forecast confidence should stay limited.'
  if (!deal.expectedCloseDate) return 'Close date missing. Add one before trusting forecast timing.'
  if (!deal.aiNextAction && !deal.nextStepDueAt) return 'No next step. This needs a clear owner action.'
  if (deal.aiRiskLevel === 'high') return 'Risk is elevated. Review blockers before moving this forward.'
  if (deal.aiNextAction) return deal.aiNextAction
  return 'Next step is set. Keep momentum by logging the next customer touch.'
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
  const pipelineValue = openDeals.reduce((sum, deal) => sum + Math.max(0, deal.valueAmount ?? 0), 0)
  const missingNextStep = openDeals.filter(deal => !deal.aiNextAction && !deal.nextStepDueAt).length

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
    <CrmPageShell wide>
      <CrmHero
        eyebrow="Pipeline"
        title="A calmer way to see what is real."
        brief={`There are ${openDeals.length} open deals, ${money(pipelineValue)} in known value, and ${missingNextStep} deals missing a next step.`}
        primary={<CrmButton href="/home" variant="primary">Review priorities</CrmButton>}
        secondary={<CrmButton href="/deals" variant="secondary">Deal list</CrmButton>}
        meta={
          <div className="crm-mini-brief">
            <strong>AI pipeline read</strong>
            Missing value, missing close dates, and unresolved risk reduce confidence. Halvex keeps those visible instead of pretending the forecast is perfect.
          </div>
        }
      />

      <CrmPanel>
        <form onSubmit={addDeal} className="crm-pipeline-toolbar">
          <label style={{ position: 'relative', flex: '1 1 280px' }}>
            <Search size={14} style={{ position: 'absolute', left: 13, top: 12, color: '#788177' }} />
            <input
              className="crm-reset-input"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search deals, companies, next actions"
              style={{ width: '100%', paddingLeft: 34 }}
            />
          </label>
          <select value={risk} onChange={event => setRisk(event.target.value)} className="crm-reset-select">
            <option value="all">All risk</option>
            <option value="high">High risk</option>
            <option value="medium">Medium risk</option>
            <option value="low">Low risk</option>
            <option value="unknown">Unknown</option>
          </select>
          <input className="crm-reset-input" value={quickAdd.title} onChange={event => setQuickAdd({ ...quickAdd, title: event.target.value })} placeholder="Deal name" />
          <input className="crm-reset-input" value={quickAdd.companyName} onChange={event => setQuickAdd({ ...quickAdd, companyName: event.target.value })} placeholder="Company" />
          <input className="crm-reset-input" value={quickAdd.valueAmount} onChange={event => setQuickAdd({ ...quickAdd, valueAmount: event.target.value })} placeholder="Value" inputMode="numeric" style={{ width: 118 }} />
          <CrmButton variant="primary" type="submit">Add deal</CrmButton>
        </form>
      </CrmPanel>

      <div className="crm-reset-kanban">
        {(pipeline?.stages ?? []).map(stage => {
          const stageDeals = deals.filter(deal => deal.stageId === stage.id)
          const total = stageDeals.reduce((sum, deal) => sum + Math.max(0, deal.valueAmount ?? 0), 0)
          return (
            <section
              key={stage.id}
              className="crm-stage-column"
              onDragOver={event => event.preventDefault()}
              onDrop={() => draggedId && moveDeal(draggedId, stage.id)}
            >
              <header>
                <div>
                  <h2>{stage.name}</h2>
                  <small>{stageDeals.length} deals</small>
                </div>
                <div className="crm-stage-total">
                  <strong>{money(total)}</strong>
                  <br />
                  <span>{stage.probability}% default</span>
                </div>
              </header>

              {stageDeals.map(deal => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  draggable
                  onDragStart={() => setDraggedId(deal.id)}
                  className="crm-reset-deal-card"
                >
                  <div className="crm-reset-deal-head">
                    <div>
                      <strong>{deal.title}</strong>
                      <p>{deal.companyName ?? 'Company missing'}</p>
                    </div>
                    <CrmPill tone={riskTone(deal)}>{deal.aiScore ?? '—'}</CrmPill>
                  </div>
                  <div className="crm-deal-value-row">
                    <CrmPill tone={!deal.valueAmount || deal.valueAmount <= 0 ? 'watch' : 'neutral'}>{money(deal.valueAmount)}</CrmPill>
                    <CrmPill tone={!deal.expectedCloseDate ? 'watch' : 'neutral'}><CalendarClock size={12} /> {dateLabel(deal.expectedCloseDate)}</CrmPill>
                    <CrmPill tone={riskTone(deal)}>{deal.aiRiskLevel} risk</CrmPill>
                  </div>
                  <div className="crm-ai-line">
                    {riskTone(deal) === 'risk' ? <AlertTriangle size={13} /> : <Sparkles size={13} />}
                    <span>{insight(deal)}</span>
                  </div>
                </Link>
              ))}

              {!isLoading && stageDeals.length === 0 && (
                <CrmEmptyAction title="Ready for deals" description="Drop deals here or add one above when this stage becomes part of your sales motion." />
              )}
            </section>
          )
        })}
      </div>
    </CrmPageShell>
  )
}
