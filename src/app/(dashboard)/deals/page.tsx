'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { fetcher } from '@/lib/fetcher'
import { OperatorHeader, OperatorPage, OperatorPanel } from '@/components/shared/OperatorUI'

export const dynamic = 'force-dynamic'

type Deal = {
  id: string
  title: string
  valueAmount: number | null
  expectedCloseDate: string | null
  status: string
  aiScore: number | null
  aiRiskLevel: string
  aiNextAction: string | null
  companyName: string | null
  stageName: string | null
}

function money(value: number | null) {
  if (!value) return '—'
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `£${Math.round(value / 1_000)}k`
  return `£${value}`
}

export default function DealsPage() {
  const { data, isLoading } = useSWR<{ data: { deals: Deal[] } }>('/api/crm/pipeline', fetcher, {
    revalidateOnFocus: false,
  })
  const [query, setQuery] = useState('')
  const deals = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.data.deals ?? []).filter(deal => !q || `${deal.title} ${deal.companyName ?? ''} ${deal.stageName ?? ''}`.toLowerCase().includes(q))
  }, [data?.data.deals, query])

  return (
    <OperatorPage>
      <OperatorHeader
        eyebrow="Deals"
        title="All opportunities"
        description="A clean native CRM list with score, risk, owner context, and next-action visibility."
        actions={<Link href="/pipeline" className="operator-button operator-button-primary">Kanban</Link>}
      />
      <OperatorPanel>
        <label className="crm-search" style={{ marginBottom: 12 }}>
          <Search size={14} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search deals" />
        </label>
        <div className="crm-table">
          <div className="crm-table-head">
            <span>Deal</span><span>Stage</span><span>Value</span><span>Score</span><span>Risk</span><span>Next action</span>
          </div>
          {deals.map(deal => (
            <Link key={deal.id} href={`/deals/${deal.id}`} className="crm-table-row">
              <span><strong>{deal.title}</strong><small>{deal.companyName ?? 'No company'}</small></span>
              <span>{deal.stageName ?? 'Unstaged'}</span>
              <span>{money(deal.valueAmount)}</span>
              <span>{deal.aiScore ?? '—'}%</span>
              <span>{deal.aiRiskLevel}</span>
              <span>{deal.aiNextAction ?? 'No next step'}</span>
            </Link>
          ))}
          {!isLoading && deals.length === 0 && <div className="empty-state">No deals found.</div>}
        </div>
      </OperatorPanel>
    </OperatorPage>
  )
}
