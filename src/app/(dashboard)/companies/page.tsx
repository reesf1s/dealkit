'use client'

import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Building2, Globe2, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ClampedText, CrmBadge, CrmButton, CrmEmpty, CrmSegmentedFilters, FilterBar, CrmPage, CrmPanel, CrmRiskBadge, CrmSectionHeader, CrmSkeleton, CrmStat, ObjectStartState, ObjectWorkspaceHeader, SavedViewBar, money, shortDate } from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

type CompanySegment = 'all' | 'open' | 'risk' | 'missing' | 'recent' | 'no_next'

type CompanySavedView = {
  id: string
  label: string
  query: string
  segment: CompanySegment
}

const COMPANY_SAVED_VIEWS_KEY = 'halvex-company-saved-views'
const COMPANY_SAVED_VIEWS_API = '/api/crm/saved-views?objectType=company'

export default function CompaniesPage() {
  const { data, isLoading, mutate } = useSWR('/api/crm/companies', fetcher, { revalidateOnFocus: false })
  const allCompanies = useMemo(() => data?.data ?? [], [data])
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState<CompanySegment>('all')
  const [savedViews, setSavedViews] = useState<CompanySavedView[]>([])
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const { data: savedViewData, mutate: mutateSavedViews } = useSWR(COMPANY_SAVED_VIEWS_API, fetcher, { revalidateOnFocus: false })
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

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(COMPANY_SAVED_VIEWS_KEY) || '[]')
      if (Array.isArray(parsed)) setSavedViews(parsed.filter(Boolean).slice(0, 8))
    } catch {
      setSavedViews([])
    }
  }, [])

  useEffect(() => {
    const serverViews = savedViewData?.data
    if (!Array.isArray(serverViews)) return
    const mapped = serverViews.map((view: any) => ({ id: view.id, label: view.label, ...(view.config ?? {}) })).filter(isCompanySavedView).slice(0, 8)
    setSavedViews(mapped)
    window.localStorage.setItem(COMPANY_SAVED_VIEWS_KEY, JSON.stringify(mapped))
  }, [savedViewData])

  function persistSavedViews(next: CompanySavedView[]) {
    setSavedViews(next)
    window.localStorage.setItem(COMPANY_SAVED_VIEWS_KEY, JSON.stringify(next))
  }

  function applySavedView(savedView: CompanySavedView) {
    setQuery(savedView.query)
    setSegment(savedView.segment)
  }

  async function deleteSavedView(id: string) {
    persistSavedViews(savedViews.filter(savedView => savedView.id !== id))
    await fetch(`/api/crm/saved-views?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null)
    await mutateSavedViews()
  }

  async function saveCurrentView(label: string) {
    const nextView: CompanySavedView = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `view-${Date.now()}`,
      label,
      query,
      segment,
    }
    persistSavedViews([nextView, ...savedViews.filter(savedView => savedView.label.toLowerCase() !== label.toLowerCase())].slice(0, 8))
    await fetch('/api/crm/saved-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectType: 'company', label, config: { query, segment } }),
    }).catch(() => null)
    await mutateSavedViews()
    setSaveViewOpen(false)
  }

  return (
    <CrmPage wide>
      <ObjectWorkspaceHeader
        object="Companies"
        title="Company objects"
        description="The account layer: linked people, open deals, notes, tasks, activity, ownership, and account risk."
        actions={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary"><Plus size={16} /> Add company</CrmButton>}
        stats={<>
        <CrmStat label="Companies" value={allCompanies.length} />
        <CrmStat label="With open deals" value={openDealAccounts} />
        <CrmStat label="Open pipeline" value={money(pipelineValue)} />
        <CrmStat label="Need attention" value={riskAccounts} />
        </>}
      />
      <CompanyOperatingMap
        companies={allCompanies}
        pipelineValue={pipelineValue}
        openDealAccounts={openDealAccounts}
        riskAccounts={riskAccounts}
        onMissingData={() => setSegment('missing')}
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
            ...savedViews.map(savedView => ({ label: savedView.label, active: savedView.query === query && savedView.segment === segment, onClick: () => applySavedView(savedView) })),
          ]}
        >
          <button type="button" className="crm-saved-view-save" onClick={() => setSaveViewOpen(prev => !prev)}><SlidersHorizontal size={14} /> Save view</button>
        </SavedViewBar>
        {saveViewOpen ? (
          <CompanySaveViewPanel
            onSave={saveCurrentView}
            onCancel={() => setSaveViewOpen(false)}
            savedViews={savedViews}
            onDelete={deleteSavedView}
            current={{ query, segment }}
          />
        ) : null}
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
        {!isLoading && !companies.length ? (
          query || segment !== 'all' ? (
            <CrmEmpty title="No matching companies" action={<CrmButton onClick={() => { setQuery(''); setSegment('all') }}>Clear filters</CrmButton>}>Try another search or reset the current company lens.</CrmEmpty>
          ) : (
            <ObjectStartState
              label="First account"
              title="Create the company record that everything else attaches to."
              description="A good account record gives every person, deal, note, and task a shared home. Start with the company, then add the buyer and opportunity from there."
              primaryAction={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary">Add company</CrmButton>}
              secondaryAction={<CrmButton href="/people?quick=person">Add person</CrmButton>}
              steps={[
                { label: 'Account', title: 'Name and domain', text: 'Capture the business, website, industry, size, and owner context.' },
                { label: 'Relationship', title: 'Link people', text: 'Add buyers, champions, finance contacts, or blockers as first-class people records.' },
                { label: 'Revenue', title: 'Attach deals and work', text: 'Create opportunities, notes, tasks, and next steps from the connected record.' },
              ]}
            />
          )
        ) : null}
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

function CompanySaveViewPanel({ onSave, onCancel, savedViews, onDelete, current }: {
  onSave: (label: string) => void
  onCancel: () => void
  savedViews: CompanySavedView[]
  onDelete: (id: string) => void
  current: Pick<CompanySavedView, 'query' | 'segment'>
}) {
  const [label, setLabel] = useState('')
  return (
    <div className="crm-save-view-panel">
      <form onSubmit={(event) => { event.preventDefault(); if (label.trim()) onSave(label.trim()) }}>
        <div>
          <strong>Save this company view</strong>
          <p>Stores the current account segment and search so each team member can keep their own working lenses.</p>
        </div>
        <input className="crm-input" value={label} onChange={event => setLabel(event.target.value)} placeholder="e.g. Accounts without next action" autoFocus />
        <CrmButton type="submit" tone="primary" disabled={!label.trim()}>Save view</CrmButton>
        <CrmButton onClick={onCancel}>Cancel</CrmButton>
      </form>
      <div className="crm-save-view-summary">
        <span>Current lens</span>
        <p>{describeCompanyView(current)}</p>
      </div>
      {savedViews.length ? (
        <div className="crm-save-view-list">
          {savedViews.map(savedView => (
            <article key={savedView.id}>
              <div><strong>{savedView.label}</strong><p>{describeCompanyView(savedView)}</p></div>
              <button type="button" onClick={() => onDelete(savedView.id)}>Remove</button>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function describeCompanyView(view: Pick<CompanySavedView, 'query' | 'segment'>) {
  const segmentLabel: Record<CompanySegment, string> = {
    all: 'all companies',
    open: 'accounts with open deals',
    risk: 'accounts at risk',
    missing: 'missing account data',
    recent: 'recent account activity',
    no_next: 'open accounts without next action',
  }
  return [segmentLabel[view.segment], view.query ? `search "${view.query}"` : null].filter(Boolean).join(' · ')
}

function CompanyOperatingMap({ companies, pipelineValue, openDealAccounts, riskAccounts, onMissingData }: { companies: any[]; pipelineValue: number; openDealAccounts: number; riskAccounts: number; onMissingData: () => void }) {
  const missingData = companies.filter((company: any) => !company.domain || !company.industry).length
  const noNextAction = companies.filter((company: any) => Number(company.openDeals ?? 0) > 0 && !company.nextAction).length
  const topAccounts = [...companies]
    .sort((a: any, b: any) => Number(b.pipelineValue ?? 0) - Number(a.pipelineValue ?? 0))
    .slice(0, 4)

  return (
    <section className="crm-operating-map accounts" aria-label="Account operating map">
      <div className="crm-operating-map-main">
        <div className="crm-operating-map-head">
          <span>Account map</span>
          <strong>{openDealAccounts} selling accounts · {money(pipelineValue)}</strong>
        </div>
        <div className="crm-operating-account-strip">
          {topAccounts.length ? topAccounts.map((company: any) => (
            <article key={company.id}>
              <strong><ClampedText lines={1}>{company.name}</ClampedText></strong>
              <span>{company.openDeals ?? 0} open deals</span>
              <small>{money(company.pipelineValue)} pipeline</small>
            </article>
          )) : <article><strong>No accounts yet</strong><span>Create the first company</span><small>Then add people and deals</small></article>}
        </div>
      </div>
      <div className="crm-operating-map-side">
        <button type="button" onClick={onMissingData}><span>Missing data</span><strong>{missingData}</strong></button>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: 'Find company records with missing account data, stale activity, or unclear next actions.' } }))}><span>No next action</span><strong>{noNextAction}</strong></button>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: 'Summarise the riskiest accounts with evidence and recommended manual actions.' } }))}><span>At risk</span><strong>{riskAccounts}</strong></button>
      </div>
    </section>
  )
}

function isCompanySavedView(view: any): view is CompanySavedView {
  return Boolean(view?.id && view?.label && typeof view.query === 'string' && typeof view.segment === 'string')
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
