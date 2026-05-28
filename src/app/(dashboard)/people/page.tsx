'use client'

import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Mail, Plus, Search } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ClampedText, CrmBadge, CrmButton, CrmEmpty, CrmSegmentedFilters, FilterBar, CrmPage, CrmPanel, CrmSectionHeader, CrmSkeleton, CrmStat, ObjectWorkspaceHeader, SavedViewBar, shortDate } from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

export default function PeoplePage() {
  const { data, isLoading, mutate } = useSWR('/api/crm/contacts', fetcher, { revalidateOnFocus: false })
  const allPeople = useMemo(() => data?.data ?? [], [data])
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState<'all' | 'recent' | 'missing' | 'cold' | 'no_company' | 'open'>('all')
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

  return (
    <CrmPage wide>
      <ObjectWorkspaceHeader
        object="People"
        title="Contacts"
        description="First-class relationship records for buyers, champions, blockers, and day-to-day customer contacts."
        actions={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary"><Plus size={16} /> Add person</CrmButton>}
        stats={<>
        <CrmStat label="People" value={allPeople.length} />
        <CrmStat label="Touched this month" value={recentlyTouched} />
        <CrmStat label="Need company" value={missingCompany} />
        </>}
      />
      {quickAddOpen ? <QuickAddPerson onCancel={() => setQuickAddOpen(false)} onCreated={async () => { setQuickAddOpen(false); await mutate() }} /> : null}
      <CrmPanel>
        <CrmSectionHeader title="People records" description="Search, filter, and open the person record before taking action." action={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary"><Plus size={16} /> Add person</CrmButton>} />
        <SavedViewBar
          views={[
            { label: 'All people', active: segment === 'all', onClick: () => setSegment('all'), count: allPeople.length },
            { label: 'Recent', active: segment === 'recent', onClick: () => setSegment('recent'), count: recentlyTouched },
            { label: 'Cold', active: segment === 'cold', onClick: () => setSegment('cold') },
            { label: 'Missing data', active: segment === 'missing', onClick: () => setSegment('missing') },
            { label: 'No company', active: segment === 'no_company', onClick: () => setSegment('no_company'), count: missingCompany },
          ]}
        />
        <FilterBar>
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
        </FilterBar>
        <div className="crm-directory-heading">
          <span>Person</span>
          <span>Email</span>
          <span>Last touch</span>
        </div>
        {isLoading ? <CrmSkeleton rows={8} /> : null}
        {!isLoading && !people.length ? <CrmEmpty title={query ? 'No matching people' : 'No people yet'} action={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary">Add person</CrmButton>}>{query ? 'Try another search.' : 'Add or import contacts to build relationship memory.'}</CrmEmpty> : null}
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
      </CrmPanel>
    </CrmPage>
  )
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
      <CrmSectionHeader title="Add person" description="Create the contact now. Link deals and tasks as the relationship grows." />
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
