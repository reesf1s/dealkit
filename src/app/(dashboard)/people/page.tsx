'use client'

import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Mail, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ClampedText, CrmBadge, CrmButton, CrmEmpty, CrmSegmentedFilters, FilterBar, CrmPage, CrmPanel, CrmSectionHeader, CrmSkeleton, CrmStat, ObjectStartState, ObjectWorkspaceHeader, SavedViewBar, shortDate } from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

type PeopleSegment = 'all' | 'recent' | 'missing' | 'cold' | 'no_company' | 'open'

type PeopleSavedView = {
  id: string
  label: string
  query: string
  segment: PeopleSegment
}

const PEOPLE_SAVED_VIEWS_KEY = 'halvex-people-saved-views'
const PEOPLE_SAVED_VIEWS_API = '/api/crm/saved-views?objectType=person'

export default function PeoplePage() {
  const { data, isLoading, mutate } = useSWR('/api/crm/contacts', fetcher, { revalidateOnFocus: false })
  const allPeople = useMemo(() => data?.data ?? [], [data])
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState<PeopleSegment>('all')
  const [savedViews, setSavedViews] = useState<PeopleSavedView[]>([])
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const { data: savedViewData, mutate: mutateSavedViews } = useSWR(PEOPLE_SAVED_VIEWS_API, fetcher, { revalidateOnFocus: false })
  const [now] = useState(() => Date.now())
  const people = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allPeople.filter((person: any) => {
      const haystack = [person.fullName, person.email, person.jobTitle, person.companyName].filter(Boolean).join(' ').toLowerCase()
      const lastTouch = person.lastContactedAt ? now - new Date(person.lastContactedAt).getTime() : null
      const segmentMatch =
        segment === 'all' ||
        (segment === 'recent' && lastTouch != null && lastTouch <= 30 * 86_400_000) ||
        (segment === 'missing' && (!person.companyName || !person.email || !person.jobTitle)) ||
        (segment === 'cold' && (lastTouch == null || lastTouch > 60 * 86_400_000)) ||
        (segment === 'no_company' && !person.companyName) ||
        (segment === 'open' && Number(person.openDeals ?? person.openDealCount ?? 0) > 0)
      return segmentMatch && (!q || haystack.includes(q))
    })
  }, [allPeople, now, query, segment])
  const missingCompany = allPeople.filter((person: any) => !person.companyName).length
  const recentlyTouched = allPeople.filter((person: any) => person.lastContactedAt && now - new Date(person.lastContactedAt).getTime() <= 30 * 86_400_000).length
  const showPeopleControls = allPeople.length > 0 || Boolean(query) || segment !== 'all'
  const showRecordsPanel = !(quickAddOpen && !allPeople.length && !query && segment === 'all')

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('quick') === 'person') setQuickAddOpen(true)
  }, [])

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(PEOPLE_SAVED_VIEWS_KEY) || '[]')
      if (Array.isArray(parsed)) setSavedViews(parsed.filter(Boolean).slice(0, 8))
    } catch {
      setSavedViews([])
    }
  }, [])

  useEffect(() => {
    const serverViews = savedViewData?.data
    if (!Array.isArray(serverViews)) return
    const mapped = serverViews.map((view: any) => ({ id: view.id, label: view.label, ...(view.config ?? {}) })).filter(isPeopleSavedView).slice(0, 8)
    setSavedViews(mapped)
    window.localStorage.setItem(PEOPLE_SAVED_VIEWS_KEY, JSON.stringify(mapped))
  }, [savedViewData])

  function persistSavedViews(next: PeopleSavedView[]) {
    setSavedViews(next)
    window.localStorage.setItem(PEOPLE_SAVED_VIEWS_KEY, JSON.stringify(next))
  }

  function applySavedView(savedView: PeopleSavedView) {
    setQuery(savedView.query)
    setSegment(savedView.segment)
  }

  async function deleteSavedView(id: string) {
    persistSavedViews(savedViews.filter(savedView => savedView.id !== id))
    await fetch(`/api/crm/saved-views?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null)
    await mutateSavedViews()
  }

  async function saveCurrentView(label: string) {
    const nextView: PeopleSavedView = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `view-${Date.now()}`,
      label,
      query,
      segment,
    }
    persistSavedViews([nextView, ...savedViews.filter(savedView => savedView.label.toLowerCase() !== label.toLowerCase())].slice(0, 8))
    await fetch('/api/crm/saved-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectType: 'person', label, config: { query, segment } }),
    }).catch(() => null)
    await mutateSavedViews()
    setSaveViewOpen(false)
  }

  return (
    <CrmPage wide>
      <ObjectWorkspaceHeader
        object="People"
        title="People"
        actions={allPeople.length ? <CrmButton onClick={() => setQuickAddOpen(true)} tone="primary"><Plus size={16} /> Add person</CrmButton> : undefined}
        stats={allPeople.length ? <>
        <CrmStat label="People" value={allPeople.length} />
        <CrmStat label="Touched this month" value={recentlyTouched} />
        {missingCompany ? <CrmStat label="No company" value={missingCompany} /> : null}
        </> : undefined}
      />
      {quickAddOpen ? <QuickAddPerson onCancel={() => setQuickAddOpen(false)} onCreated={async () => { setQuickAddOpen(false); await mutate() }} /> : null}
      {showRecordsPanel ? <CrmPanel className="crm-record-workbench">
        <CrmSectionHeader title="Records" action={showPeopleControls ? <CrmButton onClick={() => setQuickAddOpen(true)} tone="primary"><Plus size={16} /> Add person</CrmButton> : undefined} />
        {showPeopleControls ? <SavedViewBar
          views={[
            { label: 'All people', active: segment === 'all', onClick: () => setSegment('all'), count: allPeople.length },
            { label: 'Recent', active: segment === 'recent', onClick: () => setSegment('recent'), count: recentlyTouched },
            { label: 'Cold', active: segment === 'cold', onClick: () => setSegment('cold') },
            { label: 'Missing data', active: segment === 'missing', onClick: () => setSegment('missing') },
            { label: 'No company', active: segment === 'no_company', onClick: () => setSegment('no_company'), count: missingCompany },
            ...savedViews.map(savedView => ({ label: savedView.label, active: savedView.query === query && savedView.segment === segment, onClick: () => applySavedView(savedView) })),
          ]}
        >
          <button type="button" className="crm-saved-view-save" onClick={() => setSaveViewOpen(prev => !prev)}><SlidersHorizontal size={14} /> Save view</button>
        </SavedViewBar> : null}
        {showPeopleControls && saveViewOpen ? (
          <PeopleSaveViewPanel
            onSave={saveCurrentView}
            onCancel={() => setSaveViewOpen(false)}
            savedViews={savedViews}
            onDelete={deleteSavedView}
            current={{ query, segment }}
          />
        ) : null}
        {showPeopleControls ? <FilterBar>
          <label className="crm-search-button"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people..." /></label>
          <CrmSegmentedFilters
            value={segment}
            onChange={setSegment}
            label="People filters"
            options={[
              { value: 'all', label: 'All', count: allPeople.length },
              { value: 'recent', label: 'Recent' },
              { value: 'cold', label: 'Cold' },
              { value: 'missing', label: 'Missing data' },
              { value: 'no_company', label: 'No company', count: missingCompany },
              { value: 'open', label: 'Open deals' },
            ]}
          />
        </FilterBar> : null}
        {showPeopleControls ? <div className="crm-directory-heading">
          <span>Person</span>
          <span>Email</span>
          <span>Last touch</span>
        </div> : null}
        {isLoading ? <CrmSkeleton rows={8} /> : null}
        {!isLoading && !people.length ? (
          query || segment !== 'all' ? (
            <CrmEmpty title="No matching people" action={<CrmButton onClick={() => { setQuery(''); setSegment('all') }}>Clear filters</CrmButton>} />
          ) : !quickAddOpen ? (
            <ObjectStartState
              label=""
              title="No people yet"
              description=""
              primaryAction={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary">Add person</CrmButton>}
              secondaryAction={<CrmButton href="/companies?quick=company">Add company</CrmButton>}
              steps={[]}
            />
          ) : null
        ) : null}
        {people.length ? (
          <div className="crm-directory-list">
            {people.map((person: any) => (
              <div key={person.id} className="crm-directory-row">
                <span className="crm-directory-avatar">{initials(person.fullName)}</span>
                <span className="crm-directory-main">
                  <Link href={`/people/${person.id}`}><strong><ClampedText lines={1}>{person.fullName}</ClampedText></strong></Link>
                  <small><ClampedText lines={1}>{person.jobTitle ?? 'Role missing'} · {person.companyName ?? 'No company linked'}</ClampedText></small>
                </span>
                <span className="crm-directory-meta"><Mail size={14} /> <ClampedText lines={1}>{person.email ?? 'No email'}</ClampedText></span>
                <span className="crm-directory-meta">Last touch: {person.lastContactedAt ? shortDate(person.lastContactedAt) : 'No recent touch'}</span>
                <span className="crm-row-actions">
                  <CrmButton href="/tasks?quick=task" tone="ghost">Task</CrmButton>
                  <CrmButton href="/deals?quick=deal" tone="ghost">Deal</CrmButton>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </CrmPanel> : null}
    </CrmPage>
  )
}

function PeopleSaveViewPanel({ onSave, onCancel, savedViews, onDelete, current }: {
  onSave: (label: string) => void
  onCancel: () => void
  savedViews: PeopleSavedView[]
  onDelete: (id: string) => void
  current: Pick<PeopleSavedView, 'query' | 'segment'>
}) {
  const [label, setLabel] = useState('')
  return (
    <div className="crm-save-view-panel">
      <form onSubmit={(event) => { event.preventDefault(); if (label.trim()) onSave(label.trim()) }}>
        <div>
          <strong>Save this people view</strong>
          <p>Search and segment filters.</p>
        </div>
        <input className="crm-input" value={label} onChange={event => setLabel(event.target.value)} placeholder="e.g. Cold founders" autoFocus />
        <CrmButton type="submit" tone="primary" disabled={!label.trim()}>Save view</CrmButton>
        <CrmButton onClick={onCancel}>Cancel</CrmButton>
      </form>
      <div className="crm-save-view-summary">
        <span>Current lens</span>
        <p>{describePeopleView(current)}</p>
      </div>
      {savedViews.length ? (
        <div className="crm-save-view-list">
          {savedViews.map(savedView => (
            <article key={savedView.id}>
              <div><strong>{savedView.label}</strong><p>{describePeopleView(savedView)}</p></div>
              <button type="button" onClick={() => onDelete(savedView.id)}>Remove</button>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function describePeopleView(view: Pick<PeopleSavedView, 'query' | 'segment'>) {
  const segmentLabel: Record<PeopleSegment, string> = {
    all: 'all people',
    recent: 'recent relationships',
    missing: 'missing relationship data',
    cold: 'cold relationships',
    no_company: 'people without company',
    open: 'people attached to open deals',
  }
  return [segmentLabel[view.segment], view.query ? `search "${view.query}"` : null].filter(Boolean).join(' · ')
}

function isPeopleSavedView(view: any): view is PeopleSavedView {
  return Boolean(view?.id && view?.label && typeof view.query === 'string' && typeof view.segment === 'string')
}

function initials(value?: string | null) {
  const parts = String(value ?? 'Person').trim().split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] ?? 'P') + (parts[1]?.[0] ?? '')
}

function QuickAddPerson({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email: email || null, companyName: companyName || null, jobTitle: jobTitle || null }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error ?? 'Could not create person')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create person')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CrmPanel>
      <CrmSectionHeader title="Add person" />
      <form className="crm-form-grid" onSubmit={submit}>
        <label>Name<input className="crm-input" value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Darren Smith" required /></label>
        <label>Email<input className="crm-input" value={email} onChange={event => setEmail(event.target.value)} type="email" placeholder="darren@company.com" /></label>
        <label>Company<input className="crm-input" value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder="Bank of England" /></label>
        <label>Role<input className="crm-input" value={jobTitle} onChange={event => setJobTitle(event.target.value)} placeholder="Head of Workplace" /></label>
        <div className="crm-form-actions">
          <CrmButton type="submit" tone="primary" disabled={saving || !fullName.trim()}>{saving ? 'Creating...' : 'Create person'}</CrmButton>
          <CrmButton onClick={onCancel} disabled={saving}>Cancel</CrmButton>
          {error ? <CrmBadge tone="danger">{error}</CrmBadge> : null}
        </div>
      </form>
    </CrmPanel>
  )
}
