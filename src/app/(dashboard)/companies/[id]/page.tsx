'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Building2, CheckCircle2, Plus } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { CrmButton, CrmEmpty, CrmPage, CrmPanel, CrmRiskBadge, CrmSectionHeader, CrmSkeleton, CrmStat, ObjectWorkspaceHeader, WorkspaceBriefing, money, shortDate } from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

export default function CompanyPage() {
  const params = useParams<{ id: string }>()
  const { data: companiesData, isLoading } = useSWR('/api/crm/companies', fetcher, { revalidateOnFocus: false })
  const { data: pipelineData } = useSWR('/api/crm/pipeline', fetcher, { revalidateOnFocus: false })
  const { data: notesData, mutate: mutateNotes } = useSWR(params?.id ? `/api/crm/notes?companyId=${params.id}` : null, fetcher, { revalidateOnFocus: false })
  const company = (companiesData?.data ?? []).find((item: any) => item.id === params.id)
  const deals = (pipelineData?.data?.deals ?? []).filter((deal: any) => deal.companyId === params.id)
  const notes = notesData?.data ?? []

  if (isLoading) return <CrmPage wide><CrmSkeleton rows={6} /></CrmPage>
  if (!company) return <CrmPage><CrmEmpty title="Company not found">This account may not exist in this workspace.</CrmEmpty></CrmPage>

  return (
    <CrmPage wide>
      <ObjectWorkspaceHeader
        object="Company"
        title={company.name}
        description={`${company.openDeals} open deals · ${money(company.pipelineValue)} pipeline. Account memory connects people, meetings, tasks, and deals.`}
        actions={<><CrmButton href="/deals?quick=deal" tone="primary"><Plus size={16} /> Add deal</CrmButton><CrmButton href="/tasks?quick=task"><CheckCircle2 size={16} /> Add task</CrmButton></>}
        stats={<>
          <CrmStat label="Open deals" value={company.openDeals ?? 0} />
          <CrmStat label="Pipeline" value={money(company.pipelineValue)} />
          <CrmStat label="Last activity" value={company.lastActivityAt ? shortDate(company.lastActivityAt) : 'None'} />
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
            <div className="crm-fact-grid">
              <div className="crm-fact"><small>Domain</small><strong>{company.domain ?? 'Missing'}</strong></div>
              <div className="crm-fact"><small>Open deals</small><strong>{company.openDeals ?? 0}</strong></div>
              <div className="crm-fact"><small>Last activity</small><strong>{company.lastActivityAt ? shortDate(company.lastActivityAt) : 'No activity'}</strong></div>
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
              <CrmButton href="/tasks?quick=task"><CheckCircle2 size={16} /> Add task</CrmButton>
              <CrmButton onClick={() => window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `Give me the account read for ${company.name}.` } }))}>Ask Halvex</CrmButton>
            </div>
          </CrmPanel>
        </aside>
      </div>
    </CrmPage>
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
