'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Bot, Building2, CheckCircle2, Clock3, Plus, UsersRound } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ClampedText, CrmBadge, CrmButton, CrmEmpty, CrmPage, CrmPanel, CrmRiskBadge, CrmSectionHeader, CrmSkeleton, CrmStat, ObjectWorkspaceHeader, WorkspaceBriefing, money, shortDate } from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

export default function CompanyPage() {
  const params = useParams<{ id: string }>()
  const { data: companiesData, isLoading, mutate: mutateCompanies } = useSWR('/api/crm/companies', fetcher, { revalidateOnFocus: false })
  const { data: pipelineData } = useSWR('/api/crm/pipeline', fetcher, { revalidateOnFocus: false })
  const { data: peopleData } = useSWR('/api/crm/contacts', fetcher, { revalidateOnFocus: false })
  const { data: tasksData, mutate: mutateTasks } = useSWR('/api/crm/tasks?status=todo', fetcher, { revalidateOnFocus: false })
  const { data: notesData, mutate: mutateNotes } = useSWR(params?.id ? `/api/crm/notes?companyId=${params.id}` : null, fetcher, { revalidateOnFocus: false })
  const company = (companiesData?.data ?? []).find((item: any) => item.id === params.id)
  const deals = (pipelineData?.data?.deals ?? []).filter((deal: any) => deal.companyId === params.id)
  const people = (peopleData?.data ?? []).filter((person: any) => person.companyId === params.id || person.companyName === company?.name)
  const tasks = (tasksData?.data ?? []).filter((task: any) => task.companyId === params.id || deals.some((deal: any) => deal.id === task.dealId))
  const notes = notesData?.data ?? []

  if (isLoading) return <CrmPage wide><CrmSkeleton rows={6} /></CrmPage>
  if (!company) return <CrmPage><CrmEmpty title="Company not found">This account may not exist in this workspace.</CrmEmpty></CrmPage>

  return (
    <CrmPage wide>
      <ObjectWorkspaceHeader
        object="Company"
        title={company.name}
        description={`${company.openDeals} open deals · ${money(company.pipelineValue)} pipeline. Account memory connects people, meetings, tasks, and deals.`}
        actions={<><CrmButton href="/deals?quick=deal" tone="primary"><Plus size={16} /> Add deal</CrmButton><CrmButton onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `Give me the account read for ${company.name}: open deals, people, tasks, notes, risk, and next action.` } }))}><Bot size={16} /> Account read</CrmButton></>}
        stats={<>
          <CrmStat label="Open deals" value={company.openDeals ?? 0} />
          <CrmStat label="Pipeline" value={money(company.pipelineValue)} />
          <CrmStat label="People" value={people.length} />
          <CrmStat label="Open tasks" value={tasks.length} />
          <CrmStat label="Risk" value={<CrmRiskBadge risk={company.riskCount ? 'high' : 'unknown'} />} />
        </>}
      />
      <WorkspaceBriefing items={[
        { label: 'Account', title: 'One account record', text: 'Company fields, notes, linked deals, and tasks stay attached to the same account object.' },
        { label: 'Work', title: 'Act from context', text: 'Create a deal or task from the account after checking pipeline, recent activity, and existing notes.' },
        { label: 'AI', title: 'Ask for an account read', text: 'Halvex can summarize risks and suggested next steps, but changes stay manual until accepted.' },
      ]} />
      <div className="crm-record-layout">
        <main className="crm-record-main">
          <CrmPanel>
            <CrmSectionHeader title="Account details" description="The base CRM account record." />
            <CompanyDetailsForm company={company} peopleCount={people.length} taskCount={tasks.length} onSaved={mutateCompanies} />
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="People" description="Contacts attached to this account, so company memory is not trapped inside individual deals." action={<CrmButton href="/people?quick=person"><Plus size={16} /> Add person</CrmButton>} />
            <div className="crm-stack">
              {people.length ? people.map((person: any) => (
                <Link key={person.id} href={`/people/${person.id}`} className="crm-list-row">
                  <span className="crm-icon"><UsersRound size={16} /></span>
                  <div><strong><ClampedText lines={1}>{person.fullName}</ClampedText></strong><p>{person.jobTitle ?? 'Role missing'} · {person.email ?? 'No email'}</p></div>
                  <CrmBadge tone={person.jobTitle ? 'good' : 'warn'}>{person.jobTitle ? 'Known role' : 'Missing role'}</CrmBadge>
                </Link>
              )) : <CrmEmpty title="No people linked">Add contacts so the account has buyers, champions, and day-to-day relationship context.</CrmEmpty>}
            </div>
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="Linked deals" description="Opportunities attached to this account." />
            <div className="crm-stack">
              {deals.length ? deals.map((deal: any) => (
                <Link key={deal.id} href={`/deals/${deal.id}`} className="crm-list-row">
                  <span className="crm-icon"><Building2 size={16} /></span>
                  <div><strong>{deal.title}</strong><p>{deal.stageName ?? 'No stage'} · {money(deal.valueAmount)} · {deal.aiNextAction ?? 'No next step'}</p></div>
                  <CrmRiskBadge risk={deal.aiRiskLevel} />
                </Link>
              )) : <CrmEmpty title="No linked deals">Create or link a deal to make this account actionable.</CrmEmpty>}
            </div>
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="Open work" description="Tasks linked directly to this account or to its active deals." />
            <CompanyTaskComposer companyId={company.id} onSaved={mutateTasks} />
            <div className="crm-stack">
              {tasks.length ? tasks.map((task: any) => (
                <article key={task.id} className="crm-list-row">
                  <span className="crm-icon"><CheckCircle2 size={16} /></span>
                  <div><strong><ClampedText lines={2}>{task.title}</ClampedText></strong><p><Clock3 size={13} /> {task.dueAt ? shortDate(task.dueAt) : 'No due date'}{task.dealTitle ? ` · ${task.dealTitle}` : ''}</p></div>
                  <CrmBadge tone={task.isOverdue ? 'danger' : task.priority === 'high' || task.priority === 'urgent' ? 'warn' : 'neutral'}>{task.isOverdue ? 'Overdue' : task.priority ?? 'normal'}</CrmBadge>
                </article>
              )) : <CrmEmpty title="No open account tasks">Create the next account-level action or attach work from a deal record.</CrmEmpty>}
            </div>
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="Notes" description="Manual account context, decisions, blockers, and customer comments." />
            <CompanyNoteComposer companyId={company.id} onSaved={mutateNotes} />
            <div className="crm-stack">
              {notes.length ? notes.map((note: any) => (
                <article key={note.id} className="crm-note-row">
                  <strong>{note.createdAt ? shortDate(note.createdAt) : 'Note'}</strong>
                  <p>{note.body}</p>
                </article>
              )) : <CrmEmpty title="No notes yet">Add the first account note so the company record becomes useful over time.</CrmEmpty>}
            </div>
          </CrmPanel>
        </main>
        <aside className="crm-record-side">
          <CrmPanel>
            <CrmSectionHeader title="Account work" description="Manual CRM actions first." />
            <div className="crm-stack">
              <CrmButton href="/deals?quick=deal" tone="primary"><Plus size={16} /> Add deal</CrmButton>
              <CrmButton onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `Find stale work, missing stakeholders, and next actions for the ${company.name} account.` } }))}>Find account gaps</CrmButton>
              <CrmButton onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `Draft a concise account follow-up for ${company.name} using saved CRM context only.` } }))}>Draft follow-up</CrmButton>
            </div>
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="Account quality" description="What would make this record more useful." />
            <div className="crm-stack">
              <QualityRow label="Domain" ok={Boolean(company.domain)} help="Add the website/domain so imports and people can match cleanly." />
              <QualityRow label="People" ok={people.length > 0} help="Add at least one buyer, champion, or working contact." />
              <QualityRow label="Next action" ok={Boolean(company.nextAction || tasks.length)} help="Create a dated account task or save the next step." />
              <QualityRow label="Notes" ok={notes.length > 0} help="Add account context so future AI reads have evidence." />
            </div>
          </CrmPanel>
        </aside>
      </div>
    </CrmPage>
  )
}

function CompanyDetailsForm({ company, peopleCount, taskCount, onSaved }: { company: any; peopleCount: number; taskCount: number; onSaved: () => void }) {
  const [draft, setDraft] = useState({
    name: company.name ?? '',
    domain: company.domain ?? '',
    website: company.website ?? '',
    industry: company.industry ?? '',
    sizeLabel: company.sizeLabel ?? '',
    description: company.description ?? '',
  })
  const [saving, setSaving] = useState(false)
  const changed = draft.name !== (company.name ?? '')
    || draft.domain !== (company.domain ?? '')
    || draft.website !== (company.website ?? '')
    || draft.industry !== (company.industry ?? '')
    || draft.sizeLabel !== (company.sizeLabel ?? '')
    || draft.description !== (company.description ?? '')

  function update(field: keyof typeof draft, value: string) {
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.name.trim() || !changed) return
    setSaving(true)
    try {
      await fetch('/api/crm/companies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: company.id,
          name: draft.name,
          domain: draft.domain || null,
          website: draft.website || null,
          industry: draft.industry || null,
          sizeLabel: draft.sizeLabel || null,
          description: draft.description || null,
        }),
      })
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="crm-record-edit-form" onSubmit={submit}>
      <div className="crm-record-edit-grid">
        <label className="wide">Company name<input className="crm-input" value={draft.name} onChange={event => update('name', event.target.value)} required /></label>
        <label>Domain<input className="crm-input" value={draft.domain} onChange={event => update('domain', event.target.value)} placeholder="company.com" /></label>
        <label>Website<input className="crm-input" value={draft.website} onChange={event => update('website', event.target.value)} placeholder="https://company.com" /></label>
        <label>Industry<input className="crm-input" value={draft.industry} onChange={event => update('industry', event.target.value)} placeholder="SaaS" /></label>
        <label>Size<input className="crm-input" value={draft.sizeLabel} onChange={event => update('sizeLabel', event.target.value)} placeholder="11-50" /></label>
        <label className="full">Description<textarea className="crm-textarea compact" value={draft.description} onChange={event => update('description', event.target.value)} placeholder="What does this account do, and why does it matter?" /></label>
      </div>
      <div className="crm-record-edit-footer">
        <div className="crm-fact-grid compact">
          <div className="crm-fact"><small>Open deals</small><strong>{company.openDeals ?? 0}</strong></div>
          <div className="crm-fact"><small>People</small><strong>{peopleCount}</strong></div>
          <div className="crm-fact"><small>Open tasks</small><strong>{taskCount}</strong></div>
          <div className="crm-fact"><small>Last activity</small><strong>{company.lastActivityAt ? shortDate(company.lastActivityAt) : 'No activity'}</strong></div>
        </div>
        <CrmButton type="submit" tone="primary" disabled={saving || !draft.name.trim() || !changed}>{saving ? 'Saving...' : changed ? 'Save account' : 'Saved'}</CrmButton>
      </div>
    </form>
  )
}

function CompanyTaskComposer({ companyId, onSaved }: { companyId: string; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, title: title.trim(), dueAt: dueAt || null, priority: 'normal' }),
      })
      setTitle('')
      setDueAt('')
      onSaved()
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className="crm-inline-task-form" onSubmit={submit}>
      <input className="crm-input" value={title} onChange={event => setTitle(event.target.value)} placeholder="Add account task..." />
      <input className="crm-input" type="date" value={dueAt} onChange={event => setDueAt(event.target.value)} />
      <CrmButton type="submit" tone="primary" disabled={saving || !title.trim()}>{saving ? 'Adding...' : 'Add task'}</CrmButton>
    </form>
  )
}

function QualityRow({ label, ok, help }: { label: string; ok: boolean; help: string }) {
  return (
    <article className="crm-quality-row">
      <CheckCircle2 size={16} />
      <div><strong>{label}</strong><p>{help}</p></div>
      <CrmBadge tone={ok ? 'good' : 'warn'}>{ok ? 'Set' : 'Missing'}</CrmBadge>
    </article>
  )
}

function CompanyNoteComposer({ companyId, onSaved }: { companyId: string; onSaved: () => void }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!note.trim()) return
    setSaving(true)
    try {
      await fetch('/api/crm/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, note: note.trim() }),
      })
      setNote('')
      onSaved()
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className="crm-note-composer" onSubmit={submit}>
      <textarea className="crm-textarea compact" value={note} onChange={event => setNote(event.target.value)} placeholder="Add account note..." />
      <CrmButton type="submit" tone="primary" disabled={saving || !note.trim()}>{saving ? 'Saving...' : 'Save note'}</CrmButton>
    </form>
  )
}
