'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Bot, BriefcaseBusiness, CheckCircle2, Clock3, MailPlus, Plus, UsersRound } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ClampedText, CrmBadge, CrmButton, CrmEmpty, CrmPage, CrmPanel, CrmRiskBadge, CrmSectionHeader, CrmSkeleton, CrmStat, ObjectWorkspaceHeader, RecordAssistantPanel, WorkspaceBriefing, money, shortDate } from '@/components/crm/CrmShell'

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
  if (!person) return <CrmPage><CrmEmpty title="Person not found">This contact may not exist in this workspace.</CrmEmpty></CrmPage>

  return (
    <CrmPage wide>
      <ObjectWorkspaceHeader
        object="Person"
        title={person.fullName}
        description={`${person.jobTitle ?? 'Role unknown'}${person.companyName ? ` at ${person.companyName}` : ''}. Keep relationship context attached to the person, not scattered across notes.`}
        actions={<><CrmButton href="/deals?quick=deal" tone="primary"><Plus size={16} /> Create deal</CrmButton><CrmButton onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `Summarise ${person.fullName}: company, role, linked deals, open tasks, notes, and suggested next touch.` } }))}><Bot size={16} /> Relationship read</CrmButton></>}
        stats={<>
          <CrmStat label="Company" value={person.companyName ?? 'Missing'} />
          <CrmStat label="Role" value={person.jobTitle ?? 'Missing'} />
          <CrmStat label="Open deals" value={deals.length} />
          <CrmStat label="Open tasks" value={tasks.length} />
          <CrmStat label="Last touch" value={person.lastContactedAt ? shortDate(person.lastContactedAt) : 'None'} />
        </>}
      />
      <WorkspaceBriefing items={[
        { label: 'Relationship', title: 'Keep buyer context attached', text: 'Role, company, email, notes, and work history belong on the person record.' },
        { label: 'Action', title: 'Move from memory to work', text: 'Create a follow-up, open a linked deal, or draft a note from the record instead of jumping between pages.' },
        { label: 'AI', title: 'Ask for the next useful touch', text: 'Halvex can draft follow-ups or summarize context, but it should support the relationship record, not replace it.' },
      ]} />
      <div className="crm-record-layout">
        <main className="crm-record-main">
          <CrmPanel>
            <CrmSectionHeader title="Profile" description="The base CRM relationship record." />
            <PersonDetailsForm person={person} dealCount={deals.length} taskCount={tasks.length} onSaved={mutatePeople} />
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="Relationship work" description="Create the next manual step or start an opportunity from this person." />
            <div className="crm-grid-3">
              <CrmButton onClick={() => document.getElementById('person-task-title')?.focus()} tone="primary"><CheckCircle2 size={16} /> Add follow-up</CrmButton>
              <CrmButton href="/deals?quick=deal"><Plus size={16} /> Create deal</CrmButton>
              <CrmButton onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `Draft a concise follow-up to ${person.fullName}.` } }))}><MailPlus size={16} /> Draft email</CrmButton>
            </div>
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="Linked deals" description="Opportunities where this person is part of the buying context." />
            <div className="crm-stack">
              {deals.length ? deals.map((deal: any) => (
                <Link key={deal.id} href={`/deals/${deal.id}`} className="crm-list-row">
                  <span className="crm-icon"><BriefcaseBusiness size={16} /></span>
                  <div><strong><ClampedText lines={1}>{deal.title}</ClampedText></strong><p>{deal.companyName ?? 'No company'} · {deal.stageName ?? 'No stage'} · {money(deal.valueAmount)}</p></div>
                  <CrmRiskBadge risk={deal.aiRiskLevel} />
                </Link>
              )) : <CrmEmpty title="No linked deals">Create or link a deal so this relationship has revenue context.</CrmEmpty>}
            </div>
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="Open work" description="Follow-ups tied to this person or to deals where they are involved." />
            <PersonTaskComposer contactId={person.id} onSaved={mutateTasks} />
            <div className="crm-stack">
              {tasks.length ? tasks.map((task: any) => (
                <article key={task.id} className="crm-list-row">
                  <span className="crm-icon"><CheckCircle2 size={16} /></span>
                  <div><strong><ClampedText lines={2}>{task.title}</ClampedText></strong><p><Clock3 size={13} /> {task.dueAt ? shortDate(task.dueAt) : 'No due date'}{task.dealTitle ? ` · ${task.dealTitle}` : ''}</p></div>
                  <CrmBadge tone={task.isOverdue ? 'danger' : task.priority === 'high' || task.priority === 'urgent' ? 'warn' : 'neutral'}>{task.isOverdue ? 'Overdue' : task.priority ?? 'normal'}</CrmBadge>
                </article>
              )) : <CrmEmpty title="No open relationship tasks">Create a follow-up so this contact does not become passive CRM memory.</CrmEmpty>}
            </div>
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="Notes" description="Manual relationship context, preferences, commitments, and follow-up details." />
            <PersonNoteComposer contactId={person.id} onSaved={mutateNotes} />
            <div className="crm-stack">
              {notes.length ? notes.map((note: any) => (
                <article key={note.id} className="crm-note-row">
                  <strong>{note.createdAt ? shortDate(note.createdAt) : 'Note'}</strong>
                  <p>{note.body}</p>
                </article>
              )) : <CrmEmpty title="No notes yet">Add a relationship note to keep context attached to this person.</CrmEmpty>}
            </div>
          </CrmPanel>
        </main>
        <aside className="crm-record-side">
          <RecordAssistantPanel
            title="Relationship analyst"
            description="Read this person in context, then save useful output as relationship memory or a follow-up task."
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
          <CrmPanel>
            <CrmSectionHeader title="Relationship quality" description="What makes this person useful inside the CRM." />
            <div className="crm-stack">
              <QualityRow label="Company" ok={Boolean(person.companyName)} help="Link this person to an account so history rolls up." />
              <QualityRow label="Role" ok={Boolean(person.jobTitle)} help="Capture whether they are buyer, champion, evaluator, or blocker." />
              <QualityRow label="Email" ok={Boolean(person.email)} help="Save a reachable address before drafting follow-up." />
              <QualityRow label="Work" ok={Boolean(tasks.length || deals.length)} help="Attach a deal or task so the relationship has a next use." />
            </div>
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="Halvex" description="Optional sidecar help." />
            <div className="crm-stack">
              <CrmButton onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `What should I know about ${person.fullName}? Include evidence, missing CRM fields, and next touch.` } }))}><UsersRound size={16} /> Ask about this person</CrmButton>
              <CrmButton onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `Find missing buyer information for ${person.fullName}.` } }))}>Find buyer gaps</CrmButton>
              <CrmButton onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `Draft a concise follow-up to ${person.fullName} using saved CRM context only.` } }))}>Draft follow-up</CrmButton>
            </div>
          </CrmPanel>
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

function QualityRow({ label, ok, help }: { label: string; ok: boolean; help: string }) {
  return (
    <article className="crm-quality-row">
      <CheckCircle2 size={16} />
      <div><strong>{label}</strong><p>{help}</p></div>
      <CrmBadge tone={ok ? 'good' : 'warn'}>{ok ? 'Set' : 'Missing'}</CrmBadge>
    </article>
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
