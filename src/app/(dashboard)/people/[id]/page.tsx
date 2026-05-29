'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Bot, BriefcaseBusiness, CheckCircle2, Clock3, Plus } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ClampedText, CrmBadge, CrmButton, CrmEmpty, CrmPage, CrmPanel, CrmRiskBadge, CrmSectionHeader, CrmSkeleton, CrmStat, ObjectWorkspaceHeader, RecordAssistantPanel, money, shortDate } from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

export default function PersonPage() {
  const params = useParams<{ id: string }>()
  const { data, isLoading, mutate: mutatePeople } = useSWR('/api/crm/contacts', fetcher, { revalidateOnFocus: false })
  const { data: pipelineData } = useSWR('/api/crm/pipeline', fetcher, { revalidateOnFocus: false })
  const { data: tasksData, mutate: mutateTasks } = useSWR('/api/crm/tasks?status=todo', fetcher, { revalidateOnFocus: false })
  const { data: notesData, mutate: mutateNotes } = useSWR(params?.id ? `/api/crm/notes?contactId=${params.id}` : null, fetcher, { revalidateOnFocus: false })
  const person = (data?.data ?? []).find((item: any) => item.id === params.id)
  const deals = (pipelineData?.data?.deals ?? []).filter((deal: any) => (deal.people ?? []).some((linked: any) => linked.contactId === params.id || linked.id === params.id))
  const tasks = (tasksData?.data ?? []).filter((task: any) => task.contactId === params.id || deals.some((deal: any) => deal.id === task.dealId))
  const notes = notesData?.data ?? []

  if (isLoading) return <CrmPage wide><CrmSkeleton rows={6} /></CrmPage>
  if (!person) return <CrmPage><CrmEmpty title="Person not found" /></CrmPage>

  return (
    <CrmPage wide>
      <ObjectWorkspaceHeader
        object="Person"
        title={person.fullName}
        actions={<><CrmButton href="/deals?quick=deal" tone="primary"><Plus size={16} /> Create deal</CrmButton><CrmButton onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `Summarise ${person.fullName}: company, role, linked deals, open tasks, notes, and suggested next touch.` } }))}><Bot size={16} /> Analyse</CrmButton></>}
        stats={<>
          <CrmStat label="Company" value={person.companyName ?? 'Missing'} />
          <CrmStat label="Role" value={person.jobTitle ?? 'Missing'} />
          <CrmStat label="Open deals" value={deals.length} />
          <CrmStat label="Open tasks" value={tasks.length} />
          <CrmStat label="Last touch" value={person.lastContactedAt ? shortDate(person.lastContactedAt) : 'None'} />
        </>}
      />
      <div className="crm-record-layout">
        <main className="crm-record-main">
          <CrmPanel>
            <CrmSectionHeader title="Profile" />
            <PersonDetailsForm person={person} dealCount={deals.length} taskCount={tasks.length} onSaved={mutatePeople} />
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="Linked deals" />
            <div className="crm-stack">
              {deals.length ? deals.map((deal: any) => (
                <Link key={deal.id} href={`/deals/${deal.id}`} className="crm-list-row">
                  <span className="crm-icon"><BriefcaseBusiness size={16} /></span>
                  <div><strong><ClampedText lines={1}>{deal.title}</ClampedText></strong><p>{deal.companyName ?? 'No company'} · {deal.stageName ?? 'No stage'} · {money(deal.valueAmount)}</p></div>
                  <CrmRiskBadge risk={deal.aiRiskLevel} />
                </Link>
              )) : <CrmEmpty title="No linked deals" />}
            </div>
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="Open work" />
            <PersonTaskComposer contactId={person.id} onSaved={mutateTasks} />
            <div className="crm-stack">
              {tasks.length ? tasks.map((task: any) => (
                <article key={task.id} className="crm-list-row">
                  <span className="crm-icon"><CheckCircle2 size={16} /></span>
                  <div><strong><ClampedText lines={2}>{task.title}</ClampedText></strong><p><Clock3 size={13} /> {task.dueAt ? shortDate(task.dueAt) : 'No due date'}{task.dealTitle ? ` · ${task.dealTitle}` : ''}</p></div>
                  <CrmBadge tone={task.isOverdue ? 'danger' : task.priority === 'high' || task.priority === 'urgent' ? 'warn' : 'neutral'}>{task.isOverdue ? 'Overdue' : task.priority ?? 'normal'}</CrmBadge>
                </article>
              )) : <CrmEmpty title="No open tasks" />}
            </div>
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="Notes" />
            <PersonNoteComposer contactId={person.id} onSaved={mutateNotes} />
            <div className="crm-stack">
              {notes.length ? notes.map((note: any) => (
                <article key={note.id} className="crm-note-row">
                  <strong>{note.createdAt ? shortDate(note.createdAt) : 'Note'}</strong>
                  <p>{note.body}</p>
                </article>
              )) : <CrmEmpty title="No notes yet" />}
            </div>
          </CrmPanel>
        </main>
        <aside className="crm-record-side">
          <RecordAssistantPanel
            title="Relationship analyst"
            description=""
            recordName={person.fullName}
            notePayload={{ contactId: person.id }}
            taskPayload={{ contactId: person.id }}
            onChanged={async () => { await Promise.all([mutateNotes(), mutateTasks()]) }}
            prompts={[
              { label: 'Relationship read', primary: true, prompt: `Summarise ${person.fullName}: company, role, linked deals, open tasks, notes, evidence, missing CRM fields, and suggested next touch.` },
              { label: 'Find buyer gaps', prompt: `Find missing buyer information for ${person.fullName}: role in deal, champion/economic buyer status, decision influence, urgency, objections, and evidence.` },
              { label: 'Draft follow-up', prompt: `Draft a concise follow-up to ${person.fullName} using saved CRM context only.` },
            ]}
          />
        </aside>
      </div>
    </CrmPage>
  )
}

function PersonDetailsForm({ person, dealCount, taskCount, onSaved }: { person: any; dealCount: number; taskCount: number; onSaved: () => void }) {
  const [draft, setDraft] = useState({
    fullName: person.fullName ?? '',
    email: person.email ?? '',
    phone: person.phone ?? '',
    companyName: person.companyName ?? '',
    jobTitle: person.jobTitle ?? '',
    linkedinUrl: person.linkedinUrl ?? '',
  })
  const [saving, setSaving] = useState(false)
  const changed = draft.fullName !== (person.fullName ?? '')
    || draft.email !== (person.email ?? '')
    || draft.phone !== (person.phone ?? '')
    || draft.companyName !== (person.companyName ?? '')
    || draft.jobTitle !== (person.jobTitle ?? '')
    || draft.linkedinUrl !== (person.linkedinUrl ?? '')

  function update(field: keyof typeof draft, value: string) {
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.fullName.trim() || !changed) return
    setSaving(true)
    try {
      await fetch('/api/crm/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: person.id,
          fullName: draft.fullName,
          email: draft.email || null,
          phone: draft.phone || null,
          companyName: draft.companyName || null,
          jobTitle: draft.jobTitle || null,
          linkedinUrl: draft.linkedinUrl || null,
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
        <label className="wide">Name<input className="crm-input" value={draft.fullName} onChange={event => update('fullName', event.target.value)} required /></label>
        <label>Email<input className="crm-input" value={draft.email} onChange={event => update('email', event.target.value)} type="email" placeholder="person@company.com" /></label>
        <label>Phone<input className="crm-input" value={draft.phone} onChange={event => update('phone', event.target.value)} placeholder="+44..." /></label>
        <label>Company<input className="crm-input" value={draft.companyName} onChange={event => update('companyName', event.target.value)} placeholder="Company name" /></label>
        <label>Role<input className="crm-input" value={draft.jobTitle} onChange={event => update('jobTitle', event.target.value)} placeholder="Economic buyer, champion..." /></label>
        <label className="wide">LinkedIn<input className="crm-input" value={draft.linkedinUrl} onChange={event => update('linkedinUrl', event.target.value)} placeholder="https://linkedin.com/in/..." /></label>
      </div>
      <div className="crm-record-edit-footer">
        <div className="crm-fact-grid compact">
          <div className="crm-fact"><small>Open deals</small><strong>{dealCount}</strong></div>
          <div className="crm-fact"><small>Open tasks</small><strong>{taskCount}</strong></div>
          <div className="crm-fact"><small>Last touch</small><strong>{person.lastContactedAt ? shortDate(person.lastContactedAt) : 'No recent touch'}</strong></div>
        </div>
        <CrmButton type="submit" tone="primary" disabled={saving || !draft.fullName.trim() || !changed}>{saving ? 'Saving...' : changed ? 'Save person' : 'Saved'}</CrmButton>
      </div>
    </form>
  )
}

function PersonTaskComposer({ contactId, onSaved }: { contactId: string; onSaved: () => void }) {
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
        body: JSON.stringify({ contactId, title: title.trim(), dueAt: dueAt || null, priority: 'normal' }),
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
      <input id="person-task-title" className="crm-input" value={title} onChange={event => setTitle(event.target.value)} placeholder="Add follow-up..." />
      <input className="crm-input" type="date" value={dueAt} onChange={event => setDueAt(event.target.value)} />
      <CrmButton type="submit" tone="primary" disabled={saving || !title.trim()}>{saving ? 'Adding...' : 'Add task'}</CrmButton>
    </form>
  )
}

function PersonNoteComposer({ contactId, onSaved }: { contactId: string; onSaved: () => void }) {
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
        body: JSON.stringify({ contactId, note: note.trim() }),
      })
      setNote('')
      onSaved()
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className="crm-note-composer" onSubmit={submit}>
      <textarea className="crm-textarea compact" value={note} onChange={event => setNote(event.target.value)} placeholder="Add relationship note..." />
      <CrmButton type="submit" tone="primary" disabled={saving || !note.trim()}>{saving ? 'Saving...' : 'Save note'}</CrmButton>
    </form>
  )
}
