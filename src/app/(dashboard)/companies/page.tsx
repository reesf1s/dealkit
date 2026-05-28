'use client'

import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Building2, Globe2, Plus, Search } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ClampedText, CrmBadge, CrmButton, CrmEmpty, CrmSegmentedFilters, FilterBar, CrmPage, CrmPanel, CrmRiskBadge, CrmSectionHeader, CrmSkeleton, CrmStat, ObjectWorkspaceHeader, SavedViewBar, money, shortDate } from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

export default function CompaniesPage() {
  const { data, isLoading, mutate } = useSWR('/api/crm/companies', fetcher, { revalidateOnFocus: false })
  const allCompanies = useMemo(() => data?.data ?? [], [data])
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState<'all' | 'open' | 'risk' | 'missing' | 'recent' | 'no_next'>('all')
  const [now] = useState(() => Date.now())
  const companies = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allCompanies.filter((company: any) => {
      const haystack = [company.name, company.domain, company.industry, company.nextAction].filter(Boolean).join(' ').toLowerCase()
      const segmentMatch =
        segment === 'all' ||
        (segment === 'open' && Number(company.openDeals ?? 0) > 0) ||
        (segment === 'risk' && Number(company.riskCount ?? 0) > 0) ||
        (segment === 'missing' && (!company.domain || !company.industry)) ||
        (segment === 'recent' && company.lastActivityAt && now - new Date(company.lastActivityAt).getTime() <= 30 * 86_400_000) ||
        (segment === 'no_next' && Number(company.openDeals ?? 0) > 0 && !company.nextAction)
      return segmentMatch && (!q || haystack.includes(q))
    })
  }, [allCompanies, now, query, segment])
  const openDealAccounts = allCompanies.filter((company: any) => Number(company.openDeals ?? 0) > 0).length
  const riskAccounts = allCompanies.filter((company: any) => Number(company.riskCount ?? 0) > 0).length
  const pipelineValue = allCompanies.reduce((sum: number, company: any) => sum + Number(company.pipelineValue ?? 0), 0)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('quick') === 'company') setQuickAddOpen(true)
  }, [])

  return (
    <CrmPage wide>
      <ObjectWorkspaceHeader
        object="Companies"
        title="Accounts"
        description="Structured company records with linked people, active deals, notes, tasks, and relationship history."
        actions={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary"><Plus size={16} /> Add company</CrmButton>}
        stats={<>
        <CrmStat label="Companies" value={allCompanies.length} />
        <CrmStat label="With open deals" value={openDealAccounts} />
        <CrmStat label="Open pipeline" value={money(pipelineValue)} />
        <CrmStat label="Need attention" value={riskAccounts} />
        </>}
      />
      {quickAddOpen ? <QuickAddCompany onCancel={() => setQuickAddOpen(false)} onCreated={async () => { setQuickAddOpen(false); await mutate() }} /> : null}
      <CrmPanel>
        <CrmSectionHeader title="Company records" description="Saved views over the same account objects. Open the record for connected deals, people, notes, and tasks." action={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary"><Plus size={16} /> Add company</CrmButton>} />
        <SavedViewBar
          views={[
            { label: 'All companies', active: segment === 'all', onClick: () => setSegment('all'), count: allCompanies.length },
            { label: 'Open deals', active: segment === 'open', onClick: () => setSegment('open'), count: openDealAccounts },
            { label: 'At risk', active: segment === 'risk', onClick: () => setSegment('risk'), count: riskAccounts },
            { label: 'Missing data', active: segment === 'missing', onClick: () => setSegment('missing') },
            { label: 'No next action', active: segment === 'no_next', onClick: () => setSegment('no_next') },
          ]}
        />
        <FilterBar>
          <label className="crm-search-button"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search companies..." /></label>
          <CrmSegmentedFilters
            value={segment}
            onChange={setSegment}
            label="Company filters"
            options={[
              { value: 'all', label: 'All', count: allCompanies.length },
              { value: 'open', label: 'Open deals', count: openDealAccounts },
              { value: 'risk', label: 'Risk', count: riskAccounts },
              { value: 'recent', label: 'Recent' },
              { value: 'missing', label: 'Missing data' },
              { value: 'no_next', label: 'No next action' },
            ]}
          />
        </FilterBar>
        <div className="crm-directory-heading account">
          <span>Company</span>
          <span>Deals</span>
          <span>Pipeline</span>
          <span>Activity</span>
          <span>Health</span>
        </div>
        {isLoading ? <CrmSkeleton rows={8} /> : null}
        {!isLoading && !companies.length ? <CrmEmpty title={query ? 'No matching companies' : 'No companies yet'} action={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary">Add company</CrmButton>}>{query ? 'Try another search.' : 'Add or import companies to build account memory.'}</CrmEmpty> : null}
        {companies.length ? (
          <div className="crm-directory-list">
            {companies.map((company: any) => (
              <div key={company.id} className="crm-directory-row account">
                <span className="crm-directory-avatar"><Building2 size={16} /></span>
                <span className="crm-directory-main">
                  <Link href={`/companies/${company.id}`}><strong><ClampedText lines={1}>{company.name}</ClampedText></strong></Link>
                  <small><Globe2 size={13} /> <ClampedText lines={1}>{company.domain ?? 'No domain'} · {company.industry ?? 'Industry missing'}</ClampedText></small>
                </span>
                <span className="crm-directory-meta">{company.openDeals ?? 0} open deals</span>
                <span className="crm-directory-meta">{money(company.pipelineValue)} pipeline</span>
                <span className="crm-directory-meta">{company.lastActivityAt ? shortDate(company.lastActivityAt) : 'No activity'}</span>
                <CrmRiskBadge risk={company.riskCount ? 'high' : 'unknown'} />
                <span className="crm-row-actions"><CrmButton href="/tasks?quick=task" tone="ghost">Task</CrmButton></span>
              </div>
            ))}
          </div>
        ) : null}
      </CrmPanel>
    </CrmPage>
  )
}

function QuickAddCompany({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [industry, setIndustry] = useState('')
  const [sizeLabel, setSizeLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/crm/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, domain: domain || null, industry: industry || null, sizeLabel: sizeLabel || null }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error ?? 'Could not create company')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create company')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CrmPanel>
      <CrmSectionHeader title="Add company" description="Create an account. People, deals, tasks, and notes can attach to it later." />
      <form className="crm-form-grid" onSubmit={submit}>
        <label>Name<input className="crm-input" value={name} onChange={event => setName(event.target.value)} placeholder="Finch Studio" required /></label>
        <label>Domain<input className="crm-input" value={domain} onChange={event => setDomain(event.target.value)} placeholder="finchstudio.com" /></label>
        <label>Industry<input className="crm-input" value={industry} onChange={event => setIndustry(event.target.value)} placeholder="Agency" /></label>
        <label>Size<input className="crm-input" value={sizeLabel} onChange={event => setSizeLabel(event.target.value)} placeholder="11-50" /></label>
        <div className="crm-form-actions">
          <CrmButton type="submit" tone="primary" disabled={saving || !name.trim()}>{saving ? 'Creating...' : 'Create company'}</CrmButton>
          <CrmButton onClick={onCancel} disabled={saving}>Cancel</CrmButton>
          {error ? <CrmBadge tone="danger">{error}</CrmBadge> : null}
        </div>
      </form>
    </CrmPanel>
  )
}
