'use client'

import useSWR from 'swr'
import { useState } from 'react'
import { Users } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { OperatorHeader, OperatorPage, OperatorPanel } from '@/components/shared/OperatorUI'

export const dynamic = 'force-dynamic'

type Contact = {
  id: string
  fullName: string
  email: string | null
  jobTitle: string | null
  companyName: string | null
  lastContactedAt: string | null
}

export default function ContactsPage() {
  const { data, isLoading, mutate } = useSWR<{ data: Contact[] }>('/api/crm/contacts', fetcher, { revalidateOnFocus: false })
  const [form, setForm] = useState({ fullName: '', companyName: '', email: '', jobTitle: '' })
  const contacts = data?.data ?? []

  async function addContact(event: React.FormEvent) {
    event.preventDefault()
    if (!form.fullName.trim()) return
    await fetch('/api/crm/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ fullName: '', companyName: '', email: '', jobTitle: '' })
    mutate()
  }

  return (
    <OperatorPage>
      <OperatorHeader eyebrow="Contacts" title="People" description="Contacts are first-class records and can participate in multiple deals." />
      <OperatorPanel icon={Users}>
        <form onSubmit={addContact} className="crm-record-form">
          <input className="crm-input" value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} placeholder="Full name" />
          <input className="crm-input" value={form.companyName} onChange={event => setForm({ ...form, companyName: event.target.value })} placeholder="Company" />
          <input className="crm-input" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="Email" />
          <input className="crm-input" value={form.jobTitle} onChange={event => setForm({ ...form, jobTitle: event.target.value })} placeholder="Title" />
          <button className="operator-button operator-button-primary" type="submit">Add</button>
        </form>
        <div className="crm-table contacts">
          <div className="crm-table-head"><span>Name</span><span>Company</span><span>Email</span><span>Title</span></div>
          {contacts.map(contact => (
            <div key={contact.id} className="crm-table-row">
              <span><strong>{contact.fullName}</strong></span>
              <span>{contact.companyName ?? '—'}</span>
              <span>{contact.email ?? '—'}</span>
              <span>{contact.jobTitle ?? '—'}</span>
            </div>
          ))}
          {!isLoading && contacts.length === 0 && <div className="empty-state">No contacts yet.</div>}
        </div>
      </OperatorPanel>
    </OperatorPage>
  )
}
