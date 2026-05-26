'use client'

import useSWR from 'swr'
import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { OperatorHeader, OperatorPage, OperatorPanel } from '@/components/shared/OperatorUI'

export const dynamic = 'force-dynamic'

type Company = {
  id: string
  name: string
  domain: string | null
  openDeals: number
  pipelineValue: number
  lastActivityAt: string | null
  riskCount: number
}

function money(value: number) {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `£${Math.round(value / 1_000)}k`
  return `£${value}`
}

export default function CompaniesPage() {
  const { data, isLoading, mutate } = useSWR<{ data: Company[] }>('/api/crm/companies', fetcher, { revalidateOnFocus: false })
  const [form, setForm] = useState({ name: '', domain: '', industry: '' })
  const companies = data?.data ?? []

  async function addCompany(event: React.FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) return
    await fetch('/api/crm/companies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ name: '', domain: '', industry: '' })
    mutate()
  }

  return (
    <OperatorPage>
      <OperatorHeader eyebrow="Companies" title="Accounts" description="Companies inferred from legacy deals and native CRM records." />
      <OperatorPanel icon={Building2}>
        <form onSubmit={addCompany} className="crm-record-form">
          <input className="crm-input" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Company name" />
          <input className="crm-input" value={form.domain} onChange={event => setForm({ ...form, domain: event.target.value })} placeholder="Domain" />
          <input className="crm-input" value={form.industry} onChange={event => setForm({ ...form, industry: event.target.value })} placeholder="Industry" />
          <button className="operator-button operator-button-primary" type="submit">Add</button>
        </form>
        <div className="crm-table companies">
          <div className="crm-table-head"><span>Company</span><span>Domain</span><span>Open deals</span><span>Pipeline</span><span>Risk</span></div>
          {companies.map(company => (
            <div key={company.id} className="crm-table-row">
              <span><strong>{company.name}</strong></span>
              <span>{company.domain ?? '—'}</span>
              <span>{company.openDeals}</span>
              <span>{money(company.pipelineValue ?? 0)}</span>
              <span>{company.riskCount > 0 ? `${company.riskCount} high risk` : 'Clear'}</span>
            </div>
          ))}
          {!isLoading && companies.length === 0 && <div className="empty-state">No companies yet.</div>}
        </div>
      </OperatorPanel>
    </OperatorPage>
  )
}
