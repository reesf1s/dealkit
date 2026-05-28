'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import useSWR from 'swr'
import { useParams } from 'next/navigation'
import { CheckCircle2, MailPlus, Plus, UsersRound } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { CrmButton, CrmEmpty, CrmPage, CrmPanel, CrmSectionHeader, CrmSkeleton, RecordBanner, shortDate } from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

export default function PersonPage() {
  const params = useParams<{ id: string }>()
  const { data, isLoading } = useSWR('/api/crm/contacts', fetcher, { revalidateOnFocus: false })
  const { data: notesData, mutate: mutateNotes } = useSWR(params?.id ? `/api/crm/notes?contactId=${params.id}` : null, fetcher, { revalidateOnFocus: false })
  const person = (data?.data ?? []).find((item: any) => item.id === params.id)
  const notes = notesData?.data ?? []

  if (isLoading) return <CrmPage><CrmSkeleton rows={6} /></CrmPage>
  if (!person) return <CrmPage><CrmEmpty title="Person not found">This contact may not exist in this workspace.</CrmEmpty></CrmPage>

  return (
    <CrmPage>
      <RecordBanner
        eyebrow="Person"
        title={person.fullName}
        description={`${person.jobTitle ?? 'Role unknown'}${person.companyName ? ` at ${person.companyName}` : ''}. Keep relationship context attached to the person, not scattered across notes.`}
        actions={<><CrmButton href="/deals?quick=deal" tone="primary"><Plus size={16} /> Create deal</CrmButton><CrmButton href="/tasks?quick=task"><CheckCircle2 size={16} /> Add task</CrmButton></>}
      />
      <div className="crm-record-layout">
        <main className="crm-record-main">
          <CrmPanel>
            <CrmSectionHeader title="Profile" description="The base CRM relationship record." />
            <div className="crm-fact-grid">
              <div className="crm-fact"><small>Email</small><strong>{person.email ?? 'Missing'}</strong></div>
              <div className="crm-fact"><small>Company</small><strong>{person.companyName ?? 'No company linked'}</strong></div>
              <div className="crm-fact"><small>Last touch</small><strong>{person.lastContactedAt ? shortDate(person.lastContactedAt) : 'No recent touch'}</strong></div>
            </div>
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="Relationship work" description="Create the next manual step or start an opportunity from this person." />
            <div className="crm-grid-3">
              <CrmButton href="/tasks?quick=task" tone="primary"><CheckCircle2 size={16} /> Add follow-up</CrmButton>
              <CrmButton href="/deals?quick=deal"><Plus size={16} /> Create deal</CrmButton>
              <CrmButton onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `Draft a concise follow-up to ${person.fullName}.` } }))}><MailPlus size={16} /> Draft email</CrmButton>
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
          <CrmPanel>
            <CrmSectionHeader title="Relationship notes" description="AI summary can help once meetings, notes, or emails are attached." />
            <p style={{ color: 'rgba(32,35,30,.62)', lineHeight: 1.5 }}>Use deals, tasks, and calendar notes to build this person&apos;s history. Halvex can summarize the record, but the CRM data stays primary.</p>
          </CrmPanel>
          <CrmPanel>
            <CrmSectionHeader title="Halvex" description="Optional sidecar help." />
            <CrmButton onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `What should I know about ${person.fullName}?` } }))}><UsersRound size={16} /> Ask about this person</CrmButton>
          </CrmPanel>
        </aside>
      </div>
    </CrmPage>
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
