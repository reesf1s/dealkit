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
  FileText,
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
  CrmEmpty,
  CrmPage,
  CrmPanel,
  CrmRiskBadge,
  CrmSkeleton,
  WorkspaceBriefing,
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
      <DealRecordHero
        deal={deal}
        context={context}
        health={health}
        onAddNote={() => setActiveTab('notes')}
        onAddTask={() => setActiveTab('tasks')}
      />

      <WorkspaceBriefing items={[
        { label: 'Record', title: 'Operate from saved fields', text: 'Stage, value, probability, close date, owner, people, notes, and tasks are usable without AI.' },
        { label: 'Evidence', title: 'Timeline tells the truth', text: 'Notes, task changes, and activity create the evidence layer behind every risk or next-step recommendation.' },
        { label: 'Analyst', title: 'Ask precise sales questions', text: 'Analyse risk, find missing buyer info, extract note updates, explain score, or draft a follow-up from this deal context.' },
      ]} />

      <div className="crm-record2-tabs" aria-label="Deal record sections">
        {tabs.map(tab => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="crm-record2-layout">
        <main className="crm-record2-main">
          {activeTab === 'overview' ? (
            <OverviewTab context={context} deal={deal} stages={stages} health={health} onUpdate={updateDeal} onTab={setActiveTab} />
          ) : null}
          {activeTab === 'tasks' ? <TasksTab context={context} onChanged={mutate} /> : null}
          {activeTab === 'notes' ? <NotesTab deal={deal} activities={context.latestActivities ?? []} onSaved={mutate} /> : null}
          {activeTab === 'people' ? <PeopleTab context={context} /> : null}
          {activeTab === 'activity' ? <ActivityTab activities={context.latestActivities ?? []} completedTasks={context.completedTasks ?? []} /> : null}
        </main>

        <aside className="crm-record2-side">
          <RecordContextPanel context={context} deal={deal} health={health} onTab={setActiveTab} />
          <DealAnalystPanel context={context} health={health} onChanged={mutate} onRefresh={refreshHealth} />
        </aside>
      </div>
    </CrmPage>
  )
}

function DealRecordHero({ deal, context, health, onAddNote, onAddTask }: { deal: any; context: any; health: ReturnType<typeof buildHealth>; onAddNote: () => void; onAddTask: () => void }) {
  const companyName = context.company?.name ?? deal.companyName ?? 'Unknown company'
  return (
    <section className="crm-record2-hero">
      <div className="crm-record2-hero-copy">
        <small>Deal record</small>
        <h1><ClampedText lines={2} title={deal.title}>{deal.title}</ClampedText></h1>
        <p>{companyName} · {deal.stageName ?? 'No stage'} · {deal.status ?? 'open'}</p>
        <div className="crm-record2-actions">
          <CrmButton tone="primary" onClick={onAddNote}><NotebookPen size={16} /> Add note</CrmButton>
          <CrmButton onClick={onAddTask}><CheckCircle2 size={16} /> Add task</CrmButton>
          <CrmButton onClick={() => askHalvex(`Draft a concise follow-up for ${deal.title}`, deal.id)}><MailPlus size={16} /> Draft email</CrmButton>
          <CrmButton onClick={() => askHalvex(`Analyse ${deal.title}. Show risks, evidence, confidence, and the next best manual action.`, deal.id)}><Bot size={16} /> Analyse</CrmButton>
        </div>
      </div>
      <div className="crm-record2-hero-facts">
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
      <NextStepCard deal={deal} health={health} onEdit={() => onTab('overview')} />
      <OverviewGrid context={context} onTab={onTab} />
      <RecentActivityCard activities={context.latestActivities ?? []} onOpen={() => onTab('activity')} />
    </div>
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
          <h2>Deal details</h2>
          <p>Manual CRM fields. Halvex comments on them, but never owns them.</p>
        </div>
        {changed ? <CrmButton form="deal-fields-form" type="submit" tone="primary" disabled={saving || !draft.title.trim()}>{saving ? 'Saving...' : 'Save changes'}</CrmButton> : <span className="crm-record2-saved">Saved</span>}
      </div>
      <form id="deal-fields-form" className="crm-record2-fields" onSubmit={save}>
        <label className="wide">Deal name<input className="crm-input" value={draft.title} onChange={event => setField('title', event.target.value)} /></label>
        <label>Stage<select className="crm-select" value={draft.stageId} onChange={event => setField('stageId', event.target.value)}>{stages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label>
        <label>Status<select className="crm-select" value={draft.status} onChange={event => setField('status', event.target.value)}><option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option><option value="archived">Archived</option></select></label>
        <label>Value<input className="crm-input" value={draft.valueAmount} onChange={event => setField('valueAmount', event.target.value)} type="number" placeholder="Add value" /></label>
        <label>Close date<input className="crm-input" value={draft.expectedCloseDate} onChange={event => setField('expectedCloseDate', event.target.value)} type="date" /></label>
        <label className="full">Next step<textarea className="crm-textarea compact" value={draft.nextAction} onChange={event => setField('nextAction', event.target.value)} placeholder="Add the next concrete step..." /></label>
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
        <strong>{next ? <ClampedText lines={2} title={next}>{next}</ClampedText> : 'No next step set'}</strong>
        <p>{next ? 'This is a manual CRM field. Keep it short, concrete, and dated where possible.' : 'Add the next action so the deal is not just a record of old activity.'}</p>
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
        <p>{context.company?.domain ?? context.company?.website ?? 'No domain saved'}</p>
        {context.company?.id ? <CrmButton href={`/companies/${context.company.id}`}>Open company</CrmButton> : <CrmButton href="/companies">Companies</CrmButton>}
      </CrmPanel>
      <CrmPanel className="crm-record2-mini-card">
        <div className="crm-record2-mini-head">
          <UserRound size={18} />
          <h3>People</h3>
        </div>
        <strong>{contacts.length ? `${contacts.length} linked` : 'No people linked'}</strong>
        <p>{contacts[0]?.fullName ? `Primary context starts with ${contacts[0].fullName}.` : 'Link contacts so meetings and notes have relationship context.'}</p>
        <CrmButton onClick={() => onTab('people')}>View people</CrmButton>
      </CrmPanel>
      <CrmPanel className="crm-record2-mini-card">
        <div className="crm-record2-mini-head">
          <CheckCircle2 size={18} />
          <h3>Open tasks</h3>
        </div>
        <strong>{openTasks.length}</strong>
        <p>{openTasks.length ? 'Manual next steps attached to this deal.' : 'No active task is attached.'}</p>
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
          <p>Newest useful evidence first. Generic field-change records are kept out of the way.</p>
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
            <p>Manual next steps for this deal.</p>
          </div>
          <CrmButton href="/tasks">All tasks</CrmButton>
        </div>
        <TaskList tasks={active} onChanged={onChanged} empty="No active tasks. Add the next concrete step when you know it." />
      </CrmPanel>
      {stale.length ? (
        <CrmPanel className="crm-record2-card muted">
          <div className="crm-record2-card-head">
            <div>
              <h2>Old actions to review</h2>
              <p>These may be complete or stale. Confirm them before treating them as live work.</p>
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
          <p>Tasks are user-owned. Halvex can suggest, but only you create them.</p>
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
            <p>{task.dueAt ? `Due ${shortDate(task.dueAt)}` : 'No due date'} · {task.priority ?? 'normal'}{stale ? ' · needs review' : ''}</p>
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
            <p>Plain CRM history: meeting notes, blockers, customer comments, and commitments.</p>
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
          <p>Log the customer truth first. Ask for extraction only when you want suggested CRM updates.</p>
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

function PeopleTab({ context }: { context: any }) {
  const contacts = context.contacts ?? []
  return (
    <div className="crm-record2-stack">
      <CrmPanel className="crm-record2-card">
        <div className="crm-record2-card-head">
          <div>
            <h2>People</h2>
            <p>The relationship memory attached to this deal.</p>
          </div>
          <CrmButton href="/people">People directory</CrmButton>
        </div>
        {contacts.length ? (
          <div className="crm-record2-people-grid">
            {contacts.map((contact: any) => (
              <Link key={contact.id} href={`/people/${contact.id}`} className="crm-record2-person-card">
                <span><UserRound size={18} /></span>
                <strong>{contact.fullName}</strong>
                <p>{contact.jobTitle ?? contact.role ?? 'Role missing'}</p>
                <small>{contact.email ?? 'No email'}</small>
              </Link>
            ))}
          </div>
        ) : <CrmEmpty title="No people linked">Link contacts so notes, meetings, and follow-ups have real relationship context.</CrmEmpty>}
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
            <p>The evidence layer: notes, imports, stage changes, tasks, and saved recommendations.</p>
          </div>
        </div>
        <ActivityList activities={activities} />
      </CrmPanel>
      {completedTasks?.length ? (
        <CrmPanel className="crm-record2-card muted">
          <div className="crm-record2-card-head">
            <div>
              <h2>Completed tasks</h2>
              <p>Recently completed manual work.</p>
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

  return (
    <CrmPanel className="crm-analyst-panel">
      <div className="crm-analyst-head">
        <div>
          <span>Deal analyst</span>
          <h2>Optional intelligence</h2>
          <p>Run analysis only when useful. Recommendations stay advisory until you turn them into CRM work.</p>
        </div>
        <button type="button" onClick={onRefresh} aria-label="Refresh deal analysis"><RefreshCw size={16} /></button>
      </div>

      <div className="crm-analyst-score-grid">
        <div><span>Score</span><strong>{health.score ?? '—'}</strong></div>
        <div><span>Confidence</span><strong>{health.confidence ? `${health.confidence}%` : '—'}</strong></div>
        <div><span>Risk</span><CrmRiskBadge risk={health.risk} /></div>
      </div>

      <div className="crm-analyst-actions">
        <CrmButton tone="primary" onClick={() => askHalvex(`Analyse ${deal.title}. Include what changed, what is risky, what is missing, evidence, confidence, and recommended manual CRM updates.`, deal.id)}><Bot size={16} /> Analyse deal</CrmButton>
        <CrmButton onClick={() => askHalvex(`Suggest the next step for ${deal.title}. Explain why and what evidence supports it.`, deal.id)}><CheckCircle2 size={16} /> Suggest next step</CrmButton>
        <CrmButton onClick={() => askHalvex(`Summarise the record for ${deal.title}: fields, notes, tasks, people, risks, and current next step.`, deal.id)}><FileText size={16} /> Summarise record</CrmButton>
        <CrmButton onClick={() => askHalvex(`Extract CRM updates from the latest note on ${deal.title}. Suggest field changes, tasks, and notes without applying them.`, deal.id)}><NotebookPen size={16} /> Extract updates</CrmButton>
        <CrmButton onClick={() => askHalvex(`Draft a concise follow-up for ${deal.title} based only on saved CRM context.`, deal.id)}><MailPlus size={16} /> Draft follow-up</CrmButton>
        <CrmButton onClick={() => askHalvex(`Find missing buyer information for ${deal.title}: economic buyer, champion, decision process, urgency, and blockers.`, deal.id)}><UserRound size={16} /> Missing buyer info</CrmButton>
        <CrmButton onClick={() => askHalvex(`Explain the risk score for ${deal.title} using evidence and confidence.`, deal.id)}><RefreshCw size={16} /> Explain risk</CrmButton>
      </div>

      <div className="crm-analyst-insights">
        {insights.length ? insights.filter(insight => !dismissed.has(insight.id)).map(insight => (
          <article key={insight.id} className="crm-analyst-insight">
            <header>
              <div>
                <span>{insight.type}</span>
                <h3>{insight.title}</h3>
              </div>
              <strong>{insight.confidence}%</strong>
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
              <CrmButton onClick={() => createTask(insight)} disabled={busyId === insight.id}>Create task</CrmButton>
              <CrmButton onClick={() => createNote(insight, 'noted')} disabled={busyId === insight.id}>Save note</CrmButton>
              <CrmButton onClick={() => createNote(insight, 'accepted')} disabled={busyId === insight.id}>Accept</CrmButton>
              <CrmButton onClick={() => createNote(insight, 'dismissed')} disabled={busyId === insight.id}>Dismiss</CrmButton>
            </div>
          </article>
        )) : (
          <CrmEmpty title="No recommendations yet">Add notes, tasks, people, or deal fields, then run analysis when you want a second read.</CrmEmpty>
        )}
        {insights.length > 0 && insights.every(insight => dismissed.has(insight.id)) ? <CrmEmpty title="All recommendations dismissed">Run analysis again when the record changes.</CrmEmpty> : null}
      </div>
    </CrmPanel>
  )
}

function ActivityList({ activities, compactMode = false }: { activities: any[]; compactMode?: boolean }) {
  if (!activities.length) return <CrmEmpty title="No activity yet">Notes, tasks, and changes will appear here.</CrmEmpty>
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
        <h2>Record context</h2>
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
        <p>{deal.aiNextAction || health.nextAction || 'No next step set.'}</p>
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

function toInputDate(value?: string | Date | null) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
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
  const latestEvidence = intelligence.latestEvidence?.text || context?.latestActivities?.[0]?.summary || context?.latestActivities?.[0]?.body || ''
  const confidence = clampConfidence(intelligence.confidence ?? deal.aiConfidence ?? 62)
  const insights: DealInsight[] = []

  if (intelligence.missingData?.includes?.('No current next action recorded') || !deal.aiNextAction) {
    insights.push({
      id: 'no-next-step',
      type: 'Next step',
      title: 'No next step is clearly owned',
      explanation: 'The deal has no concrete next action saved on the record. That makes the opportunity hard to run manually and weakens any forecast or follow-up workflow.',
      evidence: latestEvidence ? `Recent evidence reviewed: ${latestEvidence}` : 'No current task or next-step field is available on this deal.',
      suggestedAction: `Create a dated follow-up task for ${deal.companyName ?? 'this company'} and write the expected customer action in the next-step field.`,
      confidence,
      risk: 'high',
    })
  }

  if (intelligence.riskDrivers?.length) {
    insights.push({
      id: 'risk-drivers',
      type: 'Risk',
      title: 'Deal risk needs owner review',
      explanation: intelligence.riskDrivers.join(' '),
      evidence: latestEvidence ? `Most relevant recent evidence: ${latestEvidence}` : 'Risk was derived from saved CRM fields, tasks, signals, and recent activity.',
      suggestedAction: intelligence.nextAction || deal.aiNextAction || 'Review the risk with the owner and capture a concrete next step.',
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
        explanation: `The close date is within ${Math.max(days, 0)} days, but probability is only ${deal.probability ?? 0}%. That combination usually needs stronger evidence or a forecast adjustment.`,
        evidence: `Close date: ${shortDate(deal.expectedCloseDate) ?? 'set'}. Probability: ${deal.probability ?? 'not set'}%. Stage: ${deal.stageName ?? 'no stage'}.`,
        suggestedAction: 'Confirm the decision process, identify what must happen before signature, or move the close date to a realistic date.',
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
      explanation: 'This is a meaningful opportunity, but there is no open task attached. High-value deals should have visible owner action even when the next customer step is uncertain.',
      evidence: `Deal value: ${money(deal.valueAmount)}. Open tasks: ${context?.openTasks?.length ?? 0}. Last activity: ${deal.lastActivityAt ? shortDate(deal.lastActivityAt) : 'not recorded'}.`,
      suggestedAction: 'Create an owner task to confirm the buying process, next meeting, or blocker.',
      confidence: Math.max(60, confidence - 5),
      risk: 'medium',
    })
  }

  if (intelligence.positiveSignals?.length && !intelligence.riskDrivers?.length) {
    insights.push({
      id: 'positive-fit-urgency',
      type: 'Opportunity',
      title: 'Fit looks positive; urgency still needs proof',
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
