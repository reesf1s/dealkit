'use client'

import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  MailPlus,
  NotebookPen,
  Plus,
  RefreshCw,
  UserRound,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import {
  ClampedText,
  CrmButton,
  CrmBadge,
  CrmEmpty,
  CrmPage,
  CrmPanel,
  CrmRiskBadge,
  CrmSkeleton,
  LinkedRecordChip,
  compact,
  money,
  shortDate,
} from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

type DealTab = 'overview' | 'activity' | 'notes' | 'tasks' | 'people'
type DealInsight = {
  id: string
  type: string
  title: string
  explanation: string
  evidence: string
  suggestedAction: string
  confidence: number
  risk: 'low' | 'medium' | 'high'
}

type InlineAnalysis = {
  id: string
  label: string
  prompt: string
  answer: string
  links: Array<{ label: string; href: string }>
  createdAt: Date
}

const tabs: Array<{ id: DealTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'notes', label: 'Notes' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'people', label: 'People' },
]

export default function DealRecordPage() {
  const params = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<DealTab>('overview')
  const { data, isLoading, mutate } = useSWR(params?.id ? `/api/crm/deals/${params.id}` : null, fetcher, { revalidateOnFocus: false })
  const { data: pipelineData } = useSWR('/api/crm/pipeline', fetcher, { revalidateOnFocus: false })
  const context = data?.data
  const deal = context?.deal
  const stages = pipelineData?.data?.stages ?? []
  const health = useMemo(() => buildHealth(context), [context])

  async function updateDeal(patch: Record<string, unknown>) {
    await fetch(`/api/crm/deals/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    await mutate()
  }

  async function refreshHealth() {
    await fetch(`/api/crm/deals/${params.id}`, { method: 'POST' })
    await mutate()
  }

  if (isLoading) return <CrmPage wide><CrmSkeleton rows={8} /></CrmPage>
  if (!deal) return <CrmPage><CrmEmpty title="Deal not found">This deal may no longer exist or you may not have access.</CrmEmpty></CrmPage>

  return (
    <CrmPage wide>
      <div className="app-record-page">
        <DealRecordHero
          deal={deal}
          context={context}
          health={health}
          onAddNote={() => setActiveTab('notes')}
          onAddTask={() => setActiveTab('tasks')}
        />

        <div className="app-record-tabs" aria-label="Deal record sections">
          {tabs.map(tab => (
            <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="app-record-layout">
          <main className="app-record-main">
            {activeTab === 'overview' ? (
              <OverviewTab context={context} deal={deal} stages={stages} health={health} onUpdate={updateDeal} onTab={setActiveTab} />
            ) : null}
            {activeTab === 'tasks' ? <TasksTab context={context} onChanged={mutate} /> : null}
            {activeTab === 'notes' ? <NotesTab deal={deal} activities={context.latestActivities ?? []} onSaved={mutate} /> : null}
            {activeTab === 'people' ? <PeopleTab context={context} onChanged={mutate} /> : null}
            {activeTab === 'activity' ? <ActivityTab activities={context.latestActivities ?? []} completedTasks={context.completedTasks ?? []} /> : null}
          </main>

          <aside className="app-record-side">
            <DealAnalystPanel context={context} health={health} onChanged={mutate} onRefresh={refreshHealth} />
            <RecordContextPanel context={context} deal={deal} health={health} onTab={setActiveTab} />
          </aside>
        </div>
      </div>
    </CrmPage>
  )
}

function DealRecordHero({ deal, context, health, onAddNote, onAddTask }: { deal: any; context: any; health: ReturnType<typeof buildHealth>; onAddNote: () => void; onAddTask: () => void }) {
  const companyName = context.company?.name ?? deal.companyName ?? 'Unknown company'
  const summary = [
    companyName,
    deal.stageName ?? 'No stage',
    money(deal.valueAmount),
    deal.expectedCloseDate ? `Close ${shortDate(deal.expectedCloseDate)}` : 'Close date missing',
  ].filter(Boolean).join(' · ')
  return (
    <section className="app-record-hero">
      <div className="app-record-hero-copy">
        <small>Deal</small>
        <h1><ClampedText lines={2} title={deal.title}>{deal.title}</ClampedText></h1>
        <p>{summary}</p>
        <div className="crm-record2-actions">
          <CrmButton tone="primary" onClick={onAddNote}><NotebookPen size={16} /> Add note</CrmButton>
          <CrmButton onClick={onAddTask}><CheckCircle2 size={16} /> Add task</CrmButton>
          <CrmButton onClick={() => askHalvex(`Analyse ${deal.title}. Show risks, evidence, confidence, and the next best manual action.`, deal.id)}><Bot size={16} /> Analyse</CrmButton>
        </div>
      </div>
      <div className="app-record-facts">
        <Fact label="Value" value={money(deal.valueAmount)} empty={!deal.valueAmount} />
        <Fact label="Close date" value={deal.expectedCloseDate ? (shortDate(deal.expectedCloseDate) ?? 'Set close date') : 'Set close date'} empty={!deal.expectedCloseDate} />
        <Fact label="Probability" value={deal.probability ? `${deal.probability}%` : 'Not set'} empty={!deal.probability} />
        <div className="crm-record2-fact"><span>Risk</span><CrmRiskBadge risk={health.risk} /></div>
      </div>
    </section>
  )
}

function OverviewTab({ context, deal, stages, health, onUpdate, onTab }: { context: any; deal: any; stages: any[]; health: ReturnType<typeof buildHealth>; onUpdate: (patch: Record<string, unknown>) => Promise<void>; onTab: (tab: DealTab) => void }) {
  return (
    <div className="crm-record2-stack">
      <DealFieldsCard deal={deal} stages={stages} onUpdate={onUpdate} />
      <DealPerformancePanel context={context} deal={deal} health={health} onTab={onTab} />
      <NextStepCard deal={deal} health={health} onEdit={() => onTab('overview')} />
      <OverviewGrid context={context} onTab={onTab} />
      <RecentActivityCard activities={context.latestActivities ?? []} onOpen={() => onTab('activity')} />
    </div>
  )
}

function DealPerformancePanel({ context, deal, health, onTab }: { context: any; deal: any; health: ReturnType<typeof buildHealth>; onTab: (tab: DealTab) => void }) {
  const contacts = context.contacts ?? []
  const tasks = splitTasks(context.openTasks ?? []).active
  const value = Number(deal.valueAmount ?? 0)
  const probability = Number(deal.probability ?? 0)
  const weighted = Math.round(value * (probability / 100))
  const fields = [
    { label: 'Buyer', value: contacts.length ? contacts.length : 0, complete: contacts.length > 0 },
    { label: 'Value', value: value ? money(value) : 'Missing', complete: value > 0 },
    { label: 'Close', value: deal.expectedCloseDate ? shortDate(deal.expectedCloseDate) : 'Missing', complete: Boolean(deal.expectedCloseDate) },
    { label: 'Next', value: deal.aiNextAction ? 'Set' : 'Missing', complete: Boolean(deal.aiNextAction) },
  ]
  const completeCount = fields.filter(field => field.complete).length
  return (
    <CrmPanel className="deal-performance-panel">
      <div className="deal-performance-main">
        <div>
          <span>Deal model</span>
          <h2>{money(weighted)} weighted</h2>
          <p>{probability || 0}% probability · {health.confidence ? `${health.confidence}% AI confidence` : 'confidence pending'}</p>
        </div>
        <div className="deal-performance-path" style={{ '--complete': `${(completeCount / fields.length) * 100}%` } as any}>
          {fields.map(field => (
            <button key={field.label} type="button" className={field.complete ? 'complete' : ''} onClick={() => onTab(field.label === 'Buyer' ? 'people' : field.label === 'Next' ? 'tasks' : 'overview')}>
              <span>{field.label}</span>
              <strong>{field.value}</strong>
            </button>
          ))}
        </div>
      </div>
      <aside>
        <small>Work queue</small>
        <strong>{tasks.length ? `${tasks.length} open task${tasks.length === 1 ? '' : 's'}` : 'No task set'}</strong>
        <p>{tasks[0]?.title ?? health.nextAction ?? 'Create the next action before relying on AI recommendations.'}</p>
      </aside>
    </CrmPanel>
  )
}

function DealFieldsCard({ deal, stages, onUpdate }: { deal: any; stages: any[]; onUpdate: (patch: Record<string, unknown>) => Promise<void> }) {
  const initial = useMemo(() => ({
    title: deal.title ?? '',
    stageId: deal.stageId ?? '',
    status: deal.status ?? 'open',
    valueAmount: deal.valueAmount ? String(deal.valueAmount) : '',
    expectedCloseDate: toInputDate(deal.expectedCloseDate),
    nextAction: deal.aiNextAction ?? '',
  }), [deal])
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const changed = JSON.stringify(draft) !== JSON.stringify(initial)

  function setField(field: keyof typeof draft, value: string) {
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!changed || !draft.title.trim()) return
    setSaving(true)
    try {
      await onUpdate({
        title: draft.title.trim(),
        stageId: draft.stageId || null,
        status: draft.status,
        valueAmount: draft.valueAmount ? Number(draft.valueAmount) : null,
        expectedCloseDate: draft.expectedCloseDate || null,
        aiNextAction: draft.nextAction.trim() || null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <CrmPanel className="crm-record2-card">
      <div className="crm-record2-card-head">
        <div>
          <h2>Record fields</h2>
        </div>
        {changed ? <CrmButton form="deal-fields-form" type="submit" tone="primary" disabled={saving || !draft.title.trim()}>{saving ? 'Saving...' : 'Save changes'}</CrmButton> : <span className="crm-record2-saved">Saved</span>}
      </div>
      <form id="deal-fields-form" className="crm-record2-fields" onSubmit={save}>
        <label className="wide">Deal name<input className="crm-input" value={draft.title} onChange={event => setField('title', event.target.value)} /></label>
        <label>Stage<select className="crm-select" value={draft.stageId} onChange={event => setField('stageId', event.target.value)}>{stages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label>
        <label>Status<select className="crm-select" value={draft.status} onChange={event => setField('status', event.target.value)}><option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option><option value="archived">Archived</option></select></label>
        <label>Value<input className="crm-input" value={draft.valueAmount} onChange={event => setField('valueAmount', event.target.value)} type="number" placeholder="Add value" /></label>
        <label>Close date<input className="crm-input" value={draft.expectedCloseDate} onChange={event => setField('expectedCloseDate', event.target.value)} type="date" /></label>
        <label className="full">Next step<textarea className="crm-textarea compact" value={draft.nextAction} onChange={event => setField('nextAction', event.target.value)} placeholder="Book buyer call, confirm budget, send proposal..." /></label>
      </form>
    </CrmPanel>
  )
}

function NextStepCard({ deal, health, onEdit }: { deal: any; health: ReturnType<typeof buildHealth>; onEdit: () => void }) {
  const next = deal.aiNextAction || health.nextAction
  return (
    <CrmPanel className="crm-record2-next">
      <div className="crm-record2-next-icon"><Clock3 size={18} /></div>
      <div>
        <span>Next step</span>
        <strong>{next ? <ClampedText lines={2} title={next}>{next}</ClampedText> : 'No next step saved'}</strong>
      </div>
      <CrmButton onClick={onEdit}>{next ? 'Edit' : 'Add next step'}</CrmButton>
    </CrmPanel>
  )
}

function OverviewGrid({ context, onTab }: { context: any; onTab: (tab: DealTab) => void }) {
  const contacts = context.contacts ?? []
  const openTasks = splitTasks(context.openTasks ?? []).active
  return (
    <div className="crm-record2-overview-grid">
      <CrmPanel className="crm-record2-mini-card">
        <div className="crm-record2-mini-head">
          <BriefcaseBusiness size={18} />
          <h3>Company</h3>
        </div>
        <strong>{context.company?.name ?? 'Unknown company'}</strong>
        <p>{context.company?.domain ?? context.company?.website ?? 'Domain missing'}</p>
        {context.company?.id ? <CrmButton href={`/companies/${context.company.id}`}>Open company</CrmButton> : <CrmButton href="/companies">Companies</CrmButton>}
      </CrmPanel>
      <CrmPanel className="crm-record2-mini-card">
        <div className="crm-record2-mini-head">
          <UserRound size={18} />
          <h3>People</h3>
        </div>
        <strong>{contacts.length ? `${contacts.length} linked` : 'No people linked'}</strong>
        <p>{contacts[0]?.fullName ?? 'Buyer missing'}</p>
        <CrmButton onClick={() => onTab('people')}>View people</CrmButton>
      </CrmPanel>
      <CrmPanel className="crm-record2-mini-card">
        <div className="crm-record2-mini-head">
          <CheckCircle2 size={18} />
          <h3>Open tasks</h3>
        </div>
        <strong>{openTasks.length}</strong>
        <p>{openTasks.length ? 'Open work' : 'No active task'}</p>
        <CrmButton onClick={() => onTab('tasks')}>Manage tasks</CrmButton>
      </CrmPanel>
    </div>
  )
}

function RecentActivityCard({ activities, onOpen }: { activities: any[]; onOpen: () => void }) {
  const substantive = activities.filter(activity => !isGenericActivity(activity)).slice(0, 3)
  return (
    <CrmPanel className="crm-record2-card">
      <div className="crm-record2-card-head">
        <div>
          <h2>Recent activity</h2>
        </div>
        <CrmButton onClick={onOpen}>Full timeline</CrmButton>
      </div>
      <ActivityList activities={substantive.length ? substantive : activities.slice(0, 3)} compactMode />
    </CrmPanel>
  )
}

function TasksTab({ context, onChanged }: { context: any; onChanged: () => void }) {
  const { active, stale } = splitTasks(context.openTasks ?? [])
  return (
    <div className="crm-record2-stack">
      <TaskComposer dealId={context.deal.id} onChanged={onChanged} />
      <CrmPanel className="crm-record2-card">
        <div className="crm-record2-card-head">
          <div>
            <h2>Active tasks</h2>
          </div>
          <CrmButton href="/tasks">All tasks</CrmButton>
        </div>
        <TaskList tasks={active} onChanged={onChanged} empty="No active tasks." />
      </CrmPanel>
      {stale.length ? (
        <CrmPanel className="crm-record2-card muted">
          <div className="crm-record2-card-head">
            <div>
            <h2>Older tasks</h2>
            </div>
          </div>
          <TaskList tasks={stale} onChanged={onChanged} stale empty="" />
        </CrmPanel>
      ) : null}
    </div>
  )
}

function TaskComposer({ dealId, onChanged }: { dealId: string; onChanged: () => void }) {
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [priority, setPriority] = useState('normal')
  const [saving, setSaving] = useState(false)

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), dueAt: dueAt || null, priority, dealId }),
      })
      setTitle('')
      setDueAt('')
      setPriority('normal')
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  return (
    <CrmPanel className="crm-record2-card">
      <div className="crm-record2-card-head">
        <div>
          <h2>Add task</h2>
        </div>
      </div>
      <form className="crm-record2-task-compose" onSubmit={createTask}>
        <input className="crm-input" value={title} onChange={event => setTitle(event.target.value)} placeholder="Follow up with the buyer..." />
        <input className="crm-input" type="date" value={dueAt} onChange={event => setDueAt(event.target.value)} />
        <select className="crm-select" value={priority} onChange={event => setPriority(event.target.value)}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <CrmButton type="submit" tone="primary" disabled={saving || !title.trim()}><Plus size={16} /> Add task</CrmButton>
      </form>
    </CrmPanel>
  )
}

function TaskList({ tasks, onChanged, stale = false, empty }: { tasks: any[]; onChanged: () => void; stale?: boolean; empty: string }) {
  if (!tasks.length) return <CrmEmpty title="No tasks">{empty}</CrmEmpty>
  return (
    <div className="crm-record2-task-list">
      {tasks.map(task => <TaskRow key={task.id} task={task} onChanged={onChanged} stale={stale} />)}
    </div>
  )
}

function TaskRow({ task, onChanged, stale }: { task: any; onChanged: () => void; stale?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title ?? '')
  const [dueAt, setDueAt] = useState(toInputDate(task.dueAt))
  const [priority, setPriority] = useState(task.priority ?? 'normal')
  const [saving, setSaving] = useState(false)

  async function patch(action: 'complete' | 'snooze' | 'edit') {
    setSaving(true)
    try {
      await fetch('/api/crm/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          action,
          title: action === 'edit' ? title.trim() : undefined,
          dueAt: action === 'snooze' ? new Date(Date.now() + 3 * 86_400_000).toISOString() : (action === 'edit' ? dueAt || null : undefined),
          priority: action === 'edit' ? priority : undefined,
        }),
      })
      setEditing(false)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className={`crm-record2-task-row ${stale ? 'stale' : ''}`}>
      <button type="button" onClick={() => patch('complete')} aria-label="Mark task done" disabled={saving}><CheckCircle2 size={18} /></button>
      {editing ? (
        <div className="crm-record2-task-edit">
          <input className="crm-input" value={title} onChange={event => setTitle(event.target.value)} />
          <input className="crm-input" type="date" value={dueAt} onChange={event => setDueAt(event.target.value)} />
          <select className="crm-select" value={priority} onChange={event => setPriority(event.target.value)}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <CrmButton onClick={() => patch('edit')} tone="primary" disabled={saving || !title.trim()}>Save</CrmButton>
        </div>
      ) : (
        <>
          <div>
            <strong><ClampedText lines={2} title={task.title}>{task.title}</ClampedText></strong>
              <p>{task.dueAt ? `Due ${shortDate(task.dueAt)}` : 'No due date'} · {task.priority ?? 'normal'}</p>
          </div>
          <div className="crm-record2-row-actions">
            <CrmButton onClick={() => setEditing(true)}>Edit</CrmButton>
            <CrmButton onClick={() => patch('snooze')} disabled={saving}>Snooze</CrmButton>
          </div>
        </>
      )}
    </article>
  )
}

function NotesTab({ deal, activities, onSaved }: { deal: any; activities: any[]; onSaved: () => void }) {
  const notes = activities.filter(activity => ['note', 'meeting', 'call', 'email'].includes(activity.type) || activity.source === 'manual')
  return (
    <div className="crm-record2-stack">
      <NoteComposer dealId={deal.id} dealTitle={deal.title} onSaved={onSaved} />
      <CrmPanel className="crm-record2-card">
        <div className="crm-record2-card-head">
          <div>
            <h2>Notes history</h2>
          </div>
        </div>
        <ActivityList activities={notes} />
      </CrmPanel>
    </div>
  )
}

function NoteComposer({ dealId, dealTitle, onSaved }: { dealId: string; dealTitle: string; onSaved: () => void }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!note.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/crm/deals/${dealId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim(), mode: 'note' }),
      })
      setNote('')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <CrmPanel className="crm-record2-card">
      <div className="crm-record2-card-head">
        <div>
          <h2>Add note</h2>
        </div>
      </div>
      <form className="crm-record2-note-form" onSubmit={saveNote}>
        <textarea className="crm-textarea" value={note} onChange={event => setNote(event.target.value)} placeholder="Add meeting notes, customer context, blockers, or commitments..." />
        <div className="crm-record2-note-actions">
          <CrmButton type="submit" tone="primary" disabled={saving || !note.trim()}>{saving ? 'Saving...' : 'Save note'}</CrmButton>
          <CrmButton onClick={() => askHalvex(`Extract CRM updates from this note for ${dealTitle}. Suggest field changes, tasks, and notes without applying them: ${note}`, dealId)} disabled={!note.trim()}><Bot size={16} /> Extract updates</CrmButton>
        </div>
      </form>
    </CrmPanel>
  )
}

function PeopleTab({ context, onChanged }: { context: any; onChanged: () => void }) {
  const contacts = context.contacts ?? []
  const { data: peopleData } = useSWR('/api/crm/contacts', fetcher, { revalidateOnFocus: false })
  const people = peopleData?.data ?? []
  const linkedIds = new Set(contacts.map((contact: any) => contact.id))
  const candidates = people.filter((person: any) => !linkedIds.has(person.id))
  const [contactId, setContactId] = useState('')
  const [role, setRole] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)
  const [saving, setSaving] = useState(false)

  async function linkPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!contactId) return
    setSaving(true)
    try {
      await fetch(`/api/crm/deals/${context.deal.id}/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, role: role.trim() || null, isPrimary }),
      })
      setContactId('')
      setRole('')
      setIsPrimary(false)
      await onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function unlinkPerson(id: string) {
    setSaving(true)
    try {
      await fetch(`/api/crm/deals/${context.deal.id}/people`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: id }),
      })
      await onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function markPrimary(contact: any) {
    setSaving(true)
    try {
      await fetch(`/api/crm/deals/${context.deal.id}/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id, role: contact.role ?? null, isPrimary: true }),
      })
      await onChanged()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="crm-record2-stack">
      <CrmPanel className="crm-record2-card">
        <div className="crm-record2-card-head">
          <div>
            <h2>People</h2>
          </div>
          <CrmButton href="/people">People directory</CrmButton>
        </div>
        <form className="crm-link-person-form" onSubmit={linkPerson}>
          <select className="crm-select" value={contactId} onChange={event => setContactId(event.target.value)}>
            <option value="">{candidates.length ? 'Choose existing person' : 'No unlinked people available'}</option>
            {candidates.map((person: any) => <option key={person.id} value={person.id}>{person.fullName}{person.companyName ? ` · ${person.companyName}` : ''}</option>)}
          </select>
          <input className="crm-input" value={role} onChange={event => setRole(event.target.value)} placeholder="Role in deal, e.g. Champion" />
          <label className="crm-checkbox-row"><input type="checkbox" checked={isPrimary} onChange={event => setIsPrimary(event.target.checked)} /> Primary</label>
          <CrmButton type="submit" tone="primary" disabled={saving || !contactId}><Plus size={16} /> Link person</CrmButton>
          <CrmButton href="/people?quick=person">Add new person</CrmButton>
        </form>
        {contacts.length ? (
          <div className="crm-record2-people-grid">
            {contacts.map((contact: any) => (
              <article key={contact.id} className="crm-record2-person-card">
                <span><UserRound size={18} /></span>
                <Link href={`/people/${contact.id}`}><strong>{contact.fullName}</strong></Link>
                <p>{contact.jobTitle ?? contact.role ?? 'Role missing'}</p>
                <small>{contact.email ?? 'No email'}</small>
                <div className="crm-person-link-actions">
                  {contact.isPrimary ? <CrmBadge tone="good">Primary</CrmBadge> : <CrmButton onClick={() => markPrimary(contact)} disabled={saving}>Make primary</CrmButton>}
                  <CrmButton onClick={() => unlinkPerson(contact.id)} disabled={saving}>Unlink</CrmButton>
                </div>
              </article>
            ))}
          </div>
        ) : <CrmEmpty title="No people linked" />}
      </CrmPanel>
    </div>
  )
}

function ActivityTab({ activities, completedTasks }: { activities: any[]; completedTasks: any[] }) {
  return (
    <div className="crm-record2-stack">
      <CrmPanel className="crm-record2-card">
        <div className="crm-record2-card-head">
          <div>
            <h2>Timeline</h2>
          </div>
        </div>
        <ActivityList activities={activities} />
      </CrmPanel>
      {completedTasks?.length ? (
        <CrmPanel className="crm-record2-card muted">
          <div className="crm-record2-card-head">
            <div>
              <h2>Completed tasks</h2>
            </div>
          </div>
          <TaskList tasks={completedTasks} onChanged={() => {}} empty="" />
        </CrmPanel>
      ) : null}
    </div>
  )
}

function DealAnalystPanel({ context, health, onChanged, onRefresh }: { context: any; health: ReturnType<typeof buildHealth>; onChanged: () => void; onRefresh: () => void }) {
  const deal = context.deal
  const insights = buildInsights(context)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [analysis, setAnalysis] = useState<InlineAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  async function runAnalysis(label: string, prompt: string) {
    setAnalysisLoading(label)
    setAnalysisError(null)
    try {
      const response = await fetch('/api/crm/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, dealId: deal.id }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error ?? 'Halvex could not analyse this deal yet.')
      setAnalysis({
        id: `${Date.now()}`,
        label,
        prompt,
        answer: payload?.data?.answer || 'Halvex did not return a useful answer.',
        links: payload?.data?.links ?? [],
        createdAt: new Date(),
      })
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Halvex could not analyse this deal yet.')
    } finally {
      setAnalysisLoading(null)
    }
  }

  async function createTask(insight: DealInsight) {
    setBusyId(insight.id)
    try {
      await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: insight.suggestedAction,
          priority: insight.risk === 'high' ? 'high' : 'normal',
          dealId: deal.id,
        }),
      })
      await onChanged()
    } finally {
      setBusyId(null)
    }
  }

  async function createNote(insight: DealInsight, status: 'accepted' | 'dismissed' | 'noted') {
    setBusyId(insight.id)
    try {
      await fetch(`/api/crm/deals/${deal.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'note',
          note: [
            `AI insight ${status}: ${insight.title}`,
            insight.explanation,
            `Evidence: ${insight.evidence}`,
            `Suggested action: ${insight.suggestedAction}`,
            `Confidence: ${insight.confidence}%`,
          ].join('\n\n'),
        }),
      })
      if (status === 'dismissed') setDismissed(prev => new Set(prev).add(insight.id))
      await onChanged()
    } finally {
      setBusyId(null)
    }
  }

  async function saveAnalysisAsNote() {
    if (!analysis) return
    setBusyId(`analysis-note-${analysis.id}`)
    try {
      await fetch(`/api/crm/deals/${deal.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'note',
          note: [
            `Halvex ${analysis.label}`,
            analysis.answer,
            analysis.links.length ? `Linked records: ${analysis.links.map(link => `${link.label} (${link.href})`).join(', ')}` : null,
          ].filter(Boolean).join('\n\n'),
        }),
      })
      await onChanged()
    } finally {
      setBusyId(null)
    }
  }

  async function createTaskFromAnalysis() {
    if (!analysis) return
    const suggested = extractSuggestedAction(analysis.answer) || `Review ${deal.title} and update the next step`
    setBusyId(`analysis-task-${analysis.id}`)
    try {
      await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: suggested,
          priority: health.risk === 'high' ? 'high' : 'normal',
          dealId: deal.id,
        }),
      })
      await onChanged()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <CrmPanel className="crm-analyst-panel">
      <div className="crm-analyst-head">
        <div>
          <span>Contextual AI</span>
          <h2>Deal intelligence</h2>
        </div>
        <button type="button" onClick={onRefresh} aria-label="Refresh deal analysis"><RefreshCw size={16} /></button>
      </div>

      <div className="crm-analyst-score-grid">
        <div><span>Score</span><strong>{health.score ?? '—'}</strong></div>
        <div><span>Confidence</span><strong>{health.confidence ? `${health.confidence}%` : '—'}</strong></div>
        <div><span>Risk</span><CrmRiskBadge risk={health.risk} /></div>
      </div>

      <AnalystBrief context={context} health={health} />

      <div className="crm-analyst-actions">
        <CrmButton tone="primary" onClick={() => runAnalysis('Deal analysis', `Analyse ${deal.title}. Use only this deal record. Return sections exactly: What changed:, Risk:, Evidence:, Recommended action:. Include confidence limits when CRM evidence is thin. Do not use generic sales language.`)} disabled={Boolean(analysisLoading)}><Bot size={16} /> {analysisLoading === 'Deal analysis' ? 'Analysing...' : 'Analyse deal'}</CrmButton>
        <CrmButton onClick={() => runAnalysis('Next step', `Suggest the next step for ${deal.title}. Return sections exactly: Evidence:, Recommended action:, Confidence:. Make the action a concrete CRM task or field update.`)} disabled={Boolean(analysisLoading)}><CheckCircle2 size={16} /> Next step</CrmButton>
        <CrmButton onClick={() => runAnalysis('Follow-up draft', `Draft a concise follow-up for ${deal.title} based only on saved CRM context. Return Subject: and Body:. Do not invent names or commitments.`)} disabled={Boolean(analysisLoading)}><MailPlus size={16} /> Follow-up</CrmButton>
        <CrmButton onClick={() => runAnalysis('CRM extraction', `Extract CRM updates from the latest note on ${deal.title}. Return sections exactly: Field updates:, Tasks:, Notes:. Do not apply anything automatically.`)} disabled={Boolean(analysisLoading)}><NotebookPen size={16} /> Extract note</CrmButton>
      </div>

      {analysisError ? <div className="crm-analyst-error">{analysisError}</div> : null}
      {analysisLoading && !analysis ? <InlineAnalysisSkeleton label={analysisLoading} /> : null}
      {analysis ? (
        <InlineAnalysisResult
          analysis={analysis}
          busy={busyId}
          onSaveNote={saveAnalysisAsNote}
          onCreateTask={createTaskFromAnalysis}
          onOpenDrawer={() => askHalvex(analysis.prompt, deal.id)}
        />
      ) : null}

      <div className="crm-analyst-insights">
        {insights.length ? <div className="crm-analyst-insights-head"><strong>Recommended checks</strong><span>{insights.filter(insight => !dismissed.has(insight.id)).length}</span></div> : null}
        {insights.length ? insights.filter(insight => !dismissed.has(insight.id)).map(insight => (
          <article key={insight.id} className="crm-analyst-insight">
            <header>
              <div>
                <span>{insight.type}</span>
                <h3>{insight.title}</h3>
              </div>
              <div className="crm-analyst-insight-meta"><CrmRiskBadge risk={insight.risk} /><strong>{insight.confidence}%</strong></div>
            </header>
            <p>{insight.explanation}</p>
            <section>
              <h4>Evidence</h4>
              <p>{insight.evidence}</p>
            </section>
            <section>
              <h4>Suggested action</h4>
              <p>{insight.suggestedAction}</p>
            </section>
            <div className="crm-analyst-insight-actions">
              <CrmButton onClick={() => createTask(insight)} disabled={busyId === insight.id}>Make task</CrmButton>
              <CrmButton onClick={() => createNote(insight, 'noted')} disabled={busyId === insight.id}>Save note</CrmButton>
              <CrmButton onClick={() => createNote(insight, 'accepted')} disabled={busyId === insight.id}>Accept</CrmButton>
              <CrmButton onClick={() => createNote(insight, 'dismissed')} disabled={busyId === insight.id}>Dismiss</CrmButton>
            </div>
          </article>
        )) : (
          <CrmEmpty title="No active risks">Run analysis after adding notes or tasks if you want Halvex to review the record.</CrmEmpty>
        )}
        {insights.length > 0 && insights.every(insight => dismissed.has(insight.id)) ? <CrmEmpty title="No active analysis" /> : null}
      </div>
    </CrmPanel>
  )
}

function InlineAnalysisSkeleton({ label }: { label: string }) {
  return (
    <article className="crm-inline-analysis loading">
      <header>
        <div>
          <span>Running</span>
          <h3>{label}</h3>
        </div>
      </header>
      <p>Reading deal context.</p>
    </article>
  )
}

function AnalystBrief({ context, health }: { context: any; health: ReturnType<typeof buildHealth> }) {
  const brief = buildAnalystBrief(context, health)
  return (
    <section className="crm-analyst-brief">
      <span>{brief.label}</span>
      <h3>{brief.title}</h3>
      <p>{brief.body}</p>
      <div className="crm-analyst-brief-grid">
        <div>
          <small>Evidence</small>
          <strong>{brief.evidence}</strong>
        </div>
        <div>
          <small>Missing</small>
          <strong>{brief.missing}</strong>
        </div>
      </div>
      {brief.next ? <div className="crm-analyst-brief-next"><small>Next</small><p>{brief.next}</p></div> : null}
      {brief.questions.length ? (
        <div className="crm-analyst-brief-questions">
          <small>Ask next</small>
          {brief.questions.map(question => <p key={question}>{question}</p>)}
        </div>
      ) : null}
    </section>
  )
}

function InlineAnalysisResult({ analysis, busy, onSaveNote, onCreateTask, onOpenDrawer }: { analysis: InlineAnalysis; busy: string | null; onSaveNote: () => void; onCreateTask: () => void; onOpenDrawer: () => void }) {
  const sections = parseInlineAnalysisSections(analysis.answer)
  return (
    <article className="crm-inline-analysis">
      <header>
        <div>
          <span>Latest result · {shortDate(analysis.createdAt) ?? 'now'}</span>
          <h3>{analysis.label}</h3>
        </div>
        <CrmButton onClick={onOpenDrawer}>Open in drawer</CrmButton>
      </header>
      {sections.length ? (
        <div className="crm-inline-analysis-sections">
          {sections.map(section => (
            <section key={section.label}>
              <h4>{section.label}</h4>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      ) : <p>{analysis.answer}</p>}
      {analysis.links.length ? (
        <div className="crm-inline-analysis-links">
          {analysis.links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}
        </div>
      ) : null}
      <div className="crm-inline-analysis-actions">
        <CrmButton onClick={onCreateTask} disabled={busy === `analysis-task-${analysis.id}`}>Create task</CrmButton>
        <CrmButton onClick={onSaveNote} disabled={busy === `analysis-note-${analysis.id}`}>Save note</CrmButton>
      </div>
    </article>
  )
}

function ActivityList({ activities, compactMode = false }: { activities: any[]; compactMode?: boolean }) {
  if (!activities.length) return <CrmEmpty title="No activity yet" />
  return (
    <div className={`crm-record2-activity ${compactMode ? 'compact' : ''}`}>
      {activities.map(activity => {
        const generic = isGenericActivity(activity)
        return (
          <article key={activity.id} className={generic ? 'muted' : ''}>
            <span className="crm-record2-dot" />
            <div>
              <div className="crm-record2-activity-title">
                <strong>{activity.title}</strong>
                <small>{activity.occurredAt ? shortDate(activity.occurredAt) : 'No date'} · {activity.source ?? activity.type ?? 'manual'}</small>
              </div>
              <p><ClampedText lines={compactMode ? 2 : 3} title={activity.summary || activity.body || 'No extra detail saved.'}>{activity.summary || activity.body || 'No extra detail saved.'}</ClampedText></p>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function RecordContextPanel({ context, deal, health, onTab }: { context: any; deal: any; health: ReturnType<typeof buildHealth>; onTab: (tab: DealTab) => void }) {
  const contacts = context.contacts ?? []
  const openTasks = splitTasks(context.openTasks ?? []).active
  const lastActivity = context.latestActivities?.[0]
  return (
    <CrmPanel className="crm-record-context">
      <div className="crm-record-context-head">
        <h2>Context</h2>
        <CrmRiskBadge risk={health.risk} />
      </div>
      <div className="crm-record-context-row">
        <span><BriefcaseBusiness size={16} /></span>
        <div>
          <small>Company</small>
          {context.company?.id ? <Link href={`/companies/${context.company.id}`}>{context.company.name}</Link> : <strong>{context.company?.name ?? 'Unknown company'}</strong>}
        </div>
      </div>
      <div className="crm-record-context-row">
        <span><UserRound size={16} /></span>
        <div>
          <small>People</small>
          <strong>{contacts.length ? `${contacts.length} linked` : 'None linked'}</strong>
        </div>
      </div>
      {contacts.slice(0, 4).map((contact: any) => (
        <LinkedRecordChip key={contact.id} href={`/people/${contact.id}`}><UserRound size={14} /> {contact.fullName}</LinkedRecordChip>
      ))}
      <div className="crm-record-context-grid">
        <div><span>Value</span><strong>{money(deal.valueAmount)}</strong></div>
        <div><span>Close</span><strong>{shortDate(deal.expectedCloseDate) ?? 'Missing'}</strong></div>
        <div><span>Open tasks</span><strong>{openTasks.length}</strong></div>
        <div><span>Last activity</span><strong>{lastActivity?.occurredAt ? shortDate(lastActivity.occurredAt) : 'None'}</strong></div>
      </div>
      <section className="crm-record-context-next">
        <span>Next step</span>
        <p>{deal.aiNextAction || health.nextAction || '—'}</p>
      </section>
      <div className="crm-record-context-actions">
        <CrmButton onClick={() => onTab('notes')}>Add note</CrmButton>
        <CrmButton onClick={() => onTab('tasks')}>Add task</CrmButton>
      </div>
    </CrmPanel>
  )
}

function Fact({ label, value, empty }: { label: string; value: string; empty?: boolean }) {
  return <div className={`crm-record2-fact ${empty ? 'empty' : ''}`}><span>{label}</span><strong>{value}</strong></div>
}

function askHalvex(query: string, dealId: string) {
  window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query, dealId } }))
}

function parseInlineAnalysisSections(answer: string) {
  const sections: Array<{ label: string; body: string }> = []
  let current: { label: string; body: string } | null = null
  const knownLabels = new Set([
    'what happened',
    'what changed',
    'what it means',
    'risk',
    'next',
    'check',
    'evidence',
    'recommended action',
    'suggested action',
    'confidence',
    'field updates',
    'tasks',
    'notes',
    'subject',
    'body',
  ])

  for (const rawLine of answer.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      if (current?.body && !current.body.endsWith('\n')) current.body += '\n'
      continue
    }
    const match = line.match(/^([^:]{2,42}):\s*(.*)$/)
    const key = match?.[1]?.trim().toLowerCase()
    if (match && key && knownLabels.has(key)) {
      if (current) sections.push({ label: current.label, body: current.body.trim() })
      current = { label: sentenceLabel(match[1]), body: match[2]?.trim() ?? '' }
      continue
    }
    if (!current) current = { label: 'Answer', body: '' }
    current.body = [current.body, line].filter(Boolean).join(current.body.endsWith('\n') ? '' : '\n')
  }
  if (current) sections.push({ label: current.label, body: current.body.trim() })
  return sections.filter(section => section.body)
}

function extractSuggestedAction(answer: string) {
  const sections = parseInlineAnalysisSections(answer)
  const preferred = sections.find(section => /next|recommended action|suggested action|tasks/i.test(section.label))
  const source = preferred?.body || sections[0]?.body || answer
  const firstSentence = source.split(/\n|(?<=\.)\s+/).map(line => line.trim()).find(Boolean)
  return firstSentence ? compact(firstSentence.replace(/^[-•]\s*/, ''), 140) : null
}

function sentenceLabel(value: string) {
  const lower = value.trim().toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function toInputDate(value?: string | Date | null) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function daysSince(value?: string | Date | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000))
}

function daysUntil(value?: string | Date | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000)
}

function splitTasks(tasks: any[]) {
  const now = Date.now()
  return tasks.reduce<{ active: any[]; stale: any[] }>((groups, task) => {
    const dueAt = task.dueAt ? new Date(task.dueAt).getTime() : null
    const title = String(task.title ?? '')
    const oldByDate = dueAt != null && Number.isFinite(dueAt) && now - dueAt > 30 * 86_400_000
    const oldImported = /^\[\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\]/.test(title)
    if (oldByDate || oldImported) groups.stale.push(task)
    else groups.active.push(task)
    return groups
  }, { active: [], stale: [] })
}

function isGenericActivity(activity: any) {
  const title = String(activity.title ?? '').trim().toLowerCase()
  const body = String(activity.body || activity.summary || '').trim().toLowerCase()
  return activity.source === 'system_cleanup'
    || (title === 'updated deal facts' && (!body || body === 'deal facts were updated inline.'))
    || (/^legacy stage:/.test(title) && (!body || body === 'no extra detail saved.'))
    || title === 'deal imported from csv'
    || title === 'deal created'
}

function buildInsights(context: any): DealInsight[] {
  const deal = context?.deal ?? {}
  const intelligence = context?.intelligence ?? {}
  const contacts = context?.contacts ?? []
  const openTasks = splitTasks(context?.openTasks ?? []).active
  const latestEvidence = intelligence.latestEvidence?.text || context?.latestActivities?.[0]?.summary || context?.latestActivities?.[0]?.body || ''
  const confidence = clampConfidence(intelligence.confidence ?? deal.aiConfidence ?? 62)
  const insights: DealInsight[] = []

  if (intelligence.missingData?.includes?.('No current next action recorded') || !deal.aiNextAction) {
    insights.push({
      id: 'no-next-step',
      type: 'Next step',
      title: 'Next step is missing',
      explanation: 'The record does not have a concrete next action. That makes ownership, timing, and forecast confidence weaker even if the opportunity is real.',
      evidence: latestEvidence ? `Recent evidence reviewed: ${latestEvidence}` : 'No current task or next-step field is available on this deal.',
      suggestedAction: `Add a dated task for ${deal.companyName ?? 'this company'} and update the next-step field with the same action.`,
      confidence,
      risk: 'high',
    })
  }

  if (!contacts.length) {
    insights.push({
      id: 'no-buyer-linked',
      type: 'Buyer',
      title: 'No buyer linked',
      explanation: 'The deal has no linked person, so the record cannot show who owns the decision, who champions the work, or who should receive follow-up.',
      evidence: `Linked people: 0. Company: ${context?.company?.name ?? deal.companyName ?? 'unknown'}.`,
      suggestedAction: 'Link the main buyer or champion, then mark their role on the deal.',
      confidence: Math.max(70, confidence - 4),
      risk: 'high',
    })
  } else if (!contacts.some((contact: any) => contact.isPrimary || /buyer|decision|economic|owner|champion/i.test(`${contact.role ?? ''} ${contact.jobTitle ?? ''}`))) {
    insights.push({
      id: 'buyer-role-unclear',
      type: 'Buyer',
      title: 'Buyer role is unclear',
      explanation: 'People are linked, but the buying role is not explicit. Forecast quality improves when the champion, decision maker, or economic buyer is visible.',
      evidence: `Linked people: ${contacts.map((contact: any) => contact.fullName).filter(Boolean).join(', ') || contacts.length}. No primary buyer role is saved.`,
      suggestedAction: 'Mark the primary buyer or update a linked person role before the next sales activity.',
      confidence: Math.max(58, confidence - 8),
      risk: 'medium',
    })
  }

  if (!deal.valueAmount) {
    insights.push({
      id: 'value-missing',
      type: 'Forecast',
      title: 'Deal value is missing',
      explanation: 'The record can move through the pipeline manually, but pipeline totals and prioritisation will be unreliable until value is saved.',
      evidence: `Value field: ${money(deal.valueAmount)}. Stage: ${deal.stageName ?? 'no stage'}.`,
      suggestedAction: 'Add the expected value or mark it as unknown in a note if pricing is still being scoped.',
      confidence: 86,
      risk: 'medium',
    })
  }

  if (!deal.expectedCloseDate && deal.status === 'open') {
    insights.push({
      id: 'close-date-missing',
      type: 'Forecast',
      title: 'Close date is missing',
      explanation: 'Without an expected close date, the deal is hard to sequence against the rest of the pipeline.',
      evidence: `Close date: missing. Status: ${deal.status ?? 'open'}.`,
      suggestedAction: 'Set a realistic expected close date, or add a note explaining why timing is unknown.',
      confidence: 84,
      risk: 'medium',
    })
  }

  if (intelligence.riskDrivers?.length) {
    insights.push({
      id: 'risk-drivers',
      type: 'Risk',
      title: 'Risk needs attention',
      explanation: intelligence.riskDrivers.join(' '),
      evidence: latestEvidence ? `Most relevant recent evidence: ${latestEvidence}` : 'Risk was derived from saved CRM fields, tasks, signals, and recent activity.',
      suggestedAction: intelligence.nextAction || deal.aiNextAction || 'Update the next step or adjust the forecast fields.',
      confidence,
      risk: intelligence.riskLevel === 'high' ? 'high' : 'medium',
    })
  }

  if (deal.expectedCloseDate && deal.status === 'open') {
    const closeAt = new Date(deal.expectedCloseDate).getTime()
    const days = Number.isFinite(closeAt) ? Math.ceil((closeAt - Date.now()) / 86_400_000) : null
    if (days != null && days <= 14 && (deal.probability ?? 0) < 60) {
      insights.push({
        id: 'close-date-optimistic',
        type: 'Forecast',
        title: 'Close date may be optimistic',
        explanation: `The close date is within ${Math.max(days, 0)} days and probability is ${deal.probability ?? 0}%.`,
        evidence: `Close date: ${shortDate(deal.expectedCloseDate) ?? 'set'}. Probability: ${deal.probability ?? 'not set'}%. Stage: ${deal.stageName ?? 'no stage'}.`,
        suggestedAction: 'Confirm the decision process or update the close date.',
        confidence: Math.max(58, confidence - 8),
        risk: 'medium',
      })
    }
  }

  if ((deal.valueAmount ?? 0) >= 10000 && !context?.openTasks?.length) {
    insights.push({
      id: 'high-value-low-activity',
      type: 'Activity',
      title: 'High value deal has no open task',
      explanation: 'This deal has a material value and no open task attached.',
      evidence: `Deal value: ${money(deal.valueAmount)}. Open tasks: ${openTasks.length}. Last activity: ${deal.lastActivityAt ? shortDate(deal.lastActivityAt) : 'not recorded'}.`,
      suggestedAction: 'Add a task for the buying process, next meeting, or blocker.',
      confidence: Math.max(60, confidence - 5),
      risk: 'medium',
    })
  }

  if (deal.lastActivityAt && deal.status === 'open') {
    const daysIdle = daysSince(deal.lastActivityAt)
    if (daysIdle != null && daysIdle >= 14) {
      insights.push({
        id: 'stale-activity',
        type: 'Activity',
        title: 'Activity is stale',
        explanation: `The last recorded activity was ${daysIdle} days ago. Open opportunities need a visible follow-up rhythm to remain forecastable.`,
        evidence: `Last activity: ${shortDate(deal.lastActivityAt)}. Next step: ${deal.aiNextAction || 'missing'}.`,
        suggestedAction: 'Create a follow-up task for this week or update the stage if the opportunity has gone quiet.',
        confidence: Math.max(62, confidence - 6),
        risk: daysIdle >= 30 ? 'high' : 'medium',
      })
    }
  }

  if (intelligence.positiveSignals?.length && !intelligence.riskDrivers?.length) {
    insights.push({
      id: 'positive-fit-urgency',
      type: 'Opportunity',
      title: 'Fit is visible; urgency is not proven',
      explanation: intelligence.positiveSignals.join(' '),
      evidence: latestEvidence ? `Positive signal source: ${latestEvidence}` : 'Positive signals were found in saved deal context.',
      suggestedAction: intelligence.nextAction || 'Ask what happens if the customer does nothing this quarter and record the urgency driver.',
      confidence: Math.max(55, confidence - 10),
      risk: 'low',
    })
  }

  for (const summary of context?.previousAiSummaries ?? []) {
    if (!summary.content) continue
    insights.push({
      id: `summary-${summary.id}`,
      type: 'Previous analysis',
      title: summary.summaryType === 'deal_brief' ? 'Latest deal analysis' : 'Saved AI summary',
      explanation: summary.content,
      evidence: Array.isArray(summary.evidence) && summary.evidence.length ? `${summary.evidence.length} evidence item(s) were linked when this was generated.` : 'Generated from saved CRM context.',
      suggestedAction: deal.aiNextAction || intelligence.nextAction || 'Review this analysis and decide whether it should become a task or note.',
      confidence: clampConfidence(summary.confidence ?? confidence),
      risk: deal.aiRiskLevel === 'high' ? 'high' : deal.aiRiskLevel === 'medium' ? 'medium' : 'low',
    })
  }

  return dedupeInsights(insights).slice(0, 8)
}

function buildAnalystBrief(context: any, health: ReturnType<typeof buildHealth>) {
  const deal = context?.deal ?? {}
  const intelligence = context?.intelligence ?? {}
  const contacts = context?.contacts ?? []
  const openTasks = splitTasks(context?.openTasks ?? []).active
  const latestEvidence = intelligence.latestEvidence?.text
    || context?.latestActivities?.[0]?.summary
    || context?.latestActivities?.[0]?.body
    || ''
  const missing = [
    ...(intelligence.missingData ?? []),
    !contacts.length ? 'Buyer' : null,
    !deal.valueAmount ? 'Value' : null,
    !deal.expectedCloseDate ? 'Close date' : null,
    !deal.aiNextAction ? 'Next step' : null,
  ].filter(Boolean)
  const primaryRisk = health.reasons[0] || (missing.length ? `${missing[0]} is missing.` : '')
  const hasEvidence = Boolean(latestEvidence)
  const daysToClose = daysUntil(deal.expectedCloseDate)
  const questions = [
    !contacts.length ? 'Who is the buyer or champion?' : null,
    !deal.valueAmount ? 'What value should this deal carry in forecast?' : null,
    !deal.aiNextAction ? 'What exact action should happen next?' : null,
    daysToClose != null && daysToClose <= 14 && (deal.probability ?? 0) < 60 ? 'What has to be true for this to close on time?' : null,
    openTasks.length ? null : 'Which task keeps this deal moving this week?',
  ].filter(Boolean) as string[]
  const title = health.summary
    || (missing.length ? `${missing[0]} needs attention` : deal.status === 'won' ? 'Closed deal context is complete' : 'Record is ready for review')
  const body = primaryRisk
    ? compact(primaryRisk, 180)
    : openTasks.length
      ? `${openTasks.length} open task${openTasks.length === 1 ? '' : 's'} keep the deal moving. Review evidence before changing the forecast.`
      : 'Core fields look workable. Add fresh notes or tasks before asking Halvex for a deeper read.'
  return {
    label: health.risk === 'high' ? 'Needs review' : health.risk === 'medium' ? 'Watch' : 'Current read',
    title: compact(title, 118),
    body,
    evidence: hasEvidence ? compact(latestEvidence, 130) : 'No recent evidence saved',
    missing: missing.length ? missing.slice(0, 3).join(', ') : 'Nothing obvious',
    next: health.nextAction || deal.aiNextAction || (missing.length ? `Fill ${String(missing[0]).toLowerCase()} and add a dated follow-up.` : ''),
    questions: questions.slice(0, 3),
  }
}

function dedupeInsights(insights: DealInsight[]) {
  const seen = new Set<string>()
  return insights.filter(insight => {
    const key = insight.title.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function clampConfidence(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 60
  return Math.max(35, Math.min(96, Math.round(number)))
}

function buildHealth(context: any) {
  const deal = context?.deal
  const intelligence = context?.intelligence
  const reasons = [
    ...(intelligence?.riskDrivers ?? []),
    ...(intelligence?.missingData ?? []).map((item: string) => `${item}; confidence stays limited.`),
    ...(intelligence?.positiveSignals ?? []).slice(0, 1).map((item: string) => `Positive: ${item}`),
  ].filter(Boolean)
  const latest = intelligence?.latestEvidence?.text ? `Latest: ${compact(intelligence.latestEvidence.text, 180)}` : ''
  return {
    score: typeof intelligence?.score === 'number' ? Math.min(intelligence.score, deal?.status === 'won' ? 100 : 92) : deal?.aiScore,
    confidence: typeof intelligence?.confidence === 'number' ? Math.min(intelligence.confidence, deal?.status === 'won' ? 100 : 88) : deal?.aiConfidence,
    risk: intelligence?.riskLevel ?? deal?.aiRiskLevel ?? 'unknown',
    summary: compact(intelligence?.healthReadout || intelligence?.summary || deal?.aiSummary || latest, 220),
    nextAction: compact(intelligence?.nextAction || deal?.aiNextAction || '', 180),
    cleanupItems: Array.isArray(intelligence?.cleanupItems) ? intelligence.cleanupItems : [],
    evidenceFreshness: intelligence?.evidenceFreshness ?? 'unknown',
    reasons: reasons.map((reason: string) => compact(reason, 120)),
  }
}
