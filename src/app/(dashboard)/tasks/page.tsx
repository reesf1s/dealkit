'use client'

import type { FormEvent } from 'react'
import { Suspense, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Clock3, Plus, Search, XCircle } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import {
  CrmBadge,
  CrmButton,
  ClampedText,
  CrmEmpty,
  FilterBar,
  CrmPage,
  CrmPanel,
  CrmSectionHeader,
  CrmSegmentedFilters,
  CrmSkeleton,
  CrmStat,
  PageIntent,
  ScenicPanel,
  ViewTabs,
  shortDate,
} from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

type Task = {
  id: string
  title: string
  dueAt?: string | null
  status: 'todo' | 'done' | 'cancelled'
  priority?: 'low' | 'normal' | 'high' | 'urgent' | null
  dealId?: string | null
  dealTitle?: string | null
  companyName?: string | null
}

export default function TasksPage() {
  return (
    <Suspense fallback={<CrmPage><CrmSkeleton rows={6} /></CrmPage>}>
      <TasksContent />
    </Suspense>
  )
}

function TasksContent() {
  const search = useSearchParams()
  const [quickAddOpen, setQuickAddOpen] = useState(search.get('quick') === 'task')
  const [query, setQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'urgent' | 'high' | 'normal'>('all')
  const [linkFilter, setLinkFilter] = useState<'all' | 'linked' | 'unlinked'>('all')
  const [now] = useState(() => Date.now())
  const view = search.get('view') ?? 'today'
  const { data: todoData, isLoading, mutate: mutateTodo } = useSWR('/api/crm/tasks?status=todo', fetcher, { revalidateOnFocus: false })
  const { data: doneData, mutate: mutateDone } = useSWR('/api/crm/tasks?status=done', fetcher, { revalidateOnFocus: false })
  const todoTasks: Task[] = useMemo(() => todoData?.data ?? [], [todoData])
  const doneTasks: Task[] = useMemo(() => doneData?.data ?? [], [doneData])

  useEffect(() => {
    if (search.get('quick') === 'task') setQuickAddOpen(true)
  }, [search])

  async function refresh() {
    await Promise.all([mutateTodo(), mutateDone()])
  }

  const visibleTasks = useMemo(() => {
    const q = query.trim().toLowerCase()
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)
    const upcomingEnd = new Date(now + 14 * 86_400_000)
    const source = view === 'completed' ? doneTasks : todoTasks
    return source.filter(task => {
      const haystack = [task.title, task.dealTitle, task.companyName, task.priority].filter(Boolean).join(' ').toLowerCase()
      if (q && !haystack.includes(q)) return false
      if (priorityFilter !== 'all' && (task.priority ?? 'normal') !== priorityFilter) return false
      if (linkFilter === 'linked' && !task.dealId) return false
      if (linkFilter === 'unlinked' && task.dealId) return false
      const dueAt = task.dueAt ? new Date(task.dueAt).getTime() : null
      if (view === 'overdue') return Boolean(dueAt && dueAt < now)
      if (view === 'upcoming') return Boolean(dueAt && dueAt >= now && dueAt <= upcomingEnd.getTime())
      if (view === 'completed') return true
      return !dueAt || dueAt <= todayEnd.getTime()
    })
  }, [doneTasks, linkFilter, now, priorityFilter, query, todoTasks, view])

  const overdue = todoTasks.filter(task => task.dueAt && new Date(task.dueAt).getTime() < now).length
  const today = todoTasks.filter(task => !task.dueAt || new Date(task.dueAt).getTime() <= endOfToday(now)).length
  const upcoming = todoTasks.filter(task => task.dueAt && new Date(task.dueAt).getTime() >= now).length

  async function act(taskId: string, action: 'complete' | 'cancel' | 'snooze' | 'edit', patch: Partial<Task> = {}) {
    const dueAt = action === 'snooze' ? new Date(now + 3 * 86_400_000).toISOString() : undefined
    await fetch('/api/crm/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, action, dueAt, ...patch }),
    })
    await refresh()
  }

  return (
    <CrmPage>
      <ScenicPanel
        eyebrow="Tasks"
        title="What work needs finishing?"
        description="A clean execution list for follow-ups, reminders, and customer commitments across every record."
        actions={<><CrmButton onClick={() => setQuickAddOpen(true)} tone="primary"><Plus size={16} /> Add task</CrmButton><CrmButton href="/deals">Deals</CrmButton></>}
        compact
      >
        <CrmStat label="Due today" value={today} />
        <CrmStat label="Overdue" value={overdue} />
        <CrmStat label="Upcoming" value={upcoming} />
        <CrmStat label="Completed" value={doneTasks.length} />
      </ScenicPanel>

      <PageIntent items={[
        { label: 'Focus', title: 'Do the next customer action', text: 'Tasks are manual commitments, not AI-created noise. Complete the real work and keep old imported tasks tidy.' },
        { label: 'Context', title: 'Open the linked record', text: 'When a task belongs to a deal or company, open it before acting so the follow-up is grounded.' },
        { label: 'Control', title: 'Snooze or cancel stale work', text: 'If an old task is no longer true, remove it from today instead of letting it pollute priorities.' },
      ]} />

      {quickAddOpen ? <QuickAddTask onCancel={() => setQuickAddOpen(false)} onCreated={async () => { setQuickAddOpen(false); await refresh() }} /> : null}

      <div className="crm-task-workspace">
        <CrmPanel className="crm-task-sidebar">
          <CrmSectionHeader title="Views" description="Keep the day’s execution tight." />
          <ViewTabs tabs={[
            { href: '/tasks?view=today', label: 'Today', active: view === 'today' },
            { href: '/tasks?view=upcoming', label: 'Upcoming', active: view === 'upcoming' },
            { href: '/tasks?view=overdue', label: 'Overdue', active: view === 'overdue' },
            { href: '/tasks?view=completed', label: 'Completed', active: view === 'completed' },
          ]} />
          <div className="crm-task-help">
            <strong>CRM task rules</strong>
            <p>Tasks are manual. Halvex can suggest next steps, but users decide what belongs on the work list.</p>
          </div>
        </CrmPanel>

        <CrmPanel className="crm-task-main">
          <CrmSectionHeader
            title="Tasks"
            description="Create, complete, snooze, cancel, and open the linked deal when work belongs to an opportunity."
            action={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary"><Plus size={16} /> Add task</CrmButton>}
          />
          <FilterBar>
            <label className="crm-search-button"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search tasks, deals, companies, priorities..." /></label>
            <CrmSegmentedFilters
              label="Priority"
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'urgent', label: 'Urgent' },
                { value: 'high', label: 'High' },
                { value: 'normal', label: 'Normal' },
              ]}
            />
            <CrmSegmentedFilters
              label="Linked records"
              value={linkFilter}
              onChange={setLinkFilter}
              options={[
                { value: 'all', label: 'All records' },
                { value: 'linked', label: 'Linked' },
                { value: 'unlinked', label: 'Unlinked' },
              ]}
            />
          </FilterBar>
          {isLoading ? <CrmSkeleton rows={6} /> : null}
          {!isLoading && !visibleTasks.length ? <CrmEmpty title={query ? 'No matching tasks' : 'No tasks here'} action={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary">Add task</CrmButton>}>{query ? 'Try a different search.' : 'Create the next action from a deal, meeting, or follow-up.'}</CrmEmpty> : null}
          {!isLoading && visibleTasks.length ? (
            view === 'today' && !query.trim() && priorityFilter === 'all' && linkFilter === 'all'
              ? <TaskExecutionBoard tasks={todoTasks} now={now} onAction={act} />
              : <div className="crm-task-list">{visibleTasks.map(task => <TaskRow key={task.id} task={task} now={now} onAction={act} />)}</div>
          ) : null}
        </CrmPanel>
      </div>
    </CrmPage>
  )
}

function TaskExecutionBoard({ tasks, now, onAction }: { tasks: Task[]; now: number; onAction: (taskId: string, action: 'complete' | 'cancel' | 'snooze' | 'edit', patch?: Partial<Task>) => Promise<void> }) {
  const todayEnd = endOfToday(now)
  const columns = [
    {
      title: 'Overdue',
      help: 'Clean these up first.',
      tasks: tasks.filter(task => task.dueAt && new Date(task.dueAt).getTime() < now),
    },
    {
      title: 'Today',
      help: 'Commitments due today.',
      tasks: tasks.filter(task => task.dueAt && new Date(task.dueAt).getTime() >= now && new Date(task.dueAt).getTime() <= todayEnd),
    },
    {
      title: 'No date',
      help: 'Decide a due date or remove.',
      tasks: tasks.filter(task => !task.dueAt),
    },
    {
      title: 'Upcoming',
      help: 'Next two weeks.',
      tasks: tasks.filter(task => task.dueAt && new Date(task.dueAt).getTime() > todayEnd).slice(0, 8),
    },
  ]

  return (
    <div className="crm-task-board" aria-label="Task execution board">
      {columns.map(column => (
        <section key={column.title} className="crm-task-column">
          <header>
            <div>
              <h3>{column.title}</h3>
              <p>{column.help}</p>
            </div>
            <CrmBadge tone={column.title === 'Overdue' && column.tasks.length ? 'danger' : 'neutral'}>{column.tasks.length}</CrmBadge>
          </header>
          <div className="crm-task-column-list">
            {column.tasks.length ? column.tasks.map(task => (
              <TaskRow key={task.id} task={task} now={now} onAction={onAction} compact />
            )) : <CrmEmpty title="Clear">No work in this lane.</CrmEmpty>}
          </div>
        </section>
      ))}
    </div>
  )
}

function QuickAddTask({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [priority, setPriority] = useState('normal')
  const [linkType, setLinkType] = useState<'none' | 'deal' | 'company' | 'person'>('none')
  const [linkedId, setLinkedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { data: pipelineData } = useSWR('/api/crm/pipeline', fetcher, { revalidateOnFocus: false })
  const { data: companiesData } = useSWR('/api/crm/companies', fetcher, { revalidateOnFocus: false })
  const { data: peopleData } = useSWR('/api/crm/contacts', fetcher, { revalidateOnFocus: false })
  const linkOptions = linkType === 'deal'
    ? (pipelineData?.data?.deals ?? []).map((deal: any) => ({ id: deal.id, label: `${deal.title} · ${deal.companyName ?? 'No company'}` }))
    : linkType === 'company'
      ? (companiesData?.data ?? []).map((company: any) => ({ id: company.id, label: company.name }))
      : linkType === 'person'
        ? (peopleData?.data ?? []).map((person: any) => ({ id: person.id, label: `${person.fullName}${person.companyName ? ` · ${person.companyName}` : ''}` }))
        : []

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          dueAt: dueAt || null,
          priority,
          dealId: linkType === 'deal' ? linkedId : null,
          companyId: linkType === 'company' ? linkedId : null,
          contactId: linkType === 'person' ? linkedId : null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error ?? 'Could not create task')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CrmPanel>
      <CrmSectionHeader title="Add task" description="Capture a concrete next action and link it to a deal, company, or person when useful." />
      <form className="crm-form-grid" onSubmit={submit}>
        <label style={{ gridColumn: 'span 2' }}>Task<input className="crm-input" value={title} onChange={event => setTitle(event.target.value)} placeholder="Follow up about requirements" required /></label>
        <label>Due<input className="crm-input" value={dueAt} onChange={event => setDueAt(event.target.value)} type="date" /></label>
        <label>Priority<select className="crm-select" value={priority} onChange={event => setPriority(event.target.value)}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        <label>Linked record<select className="crm-select" value={linkType} onChange={event => { setLinkType(event.target.value as typeof linkType); setLinkedId('') }}><option value="none">None</option><option value="deal">Deal</option><option value="company">Company</option><option value="person">Person</option></select></label>
        {linkType !== 'none' ? (
          <label style={{ gridColumn: 'span 2' }}>Choose record<select className="crm-select" value={linkedId} onChange={event => setLinkedId(event.target.value)} required>
            <option value="">Select {linkType}</option>
            {linkOptions.map((option: any) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select></label>
        ) : null}
        <div className="crm-form-actions">
          <CrmButton type="submit" tone="primary" disabled={saving || !title.trim() || (linkType !== 'none' && !linkedId)}>{saving ? 'Adding...' : 'Add task'}</CrmButton>
          <CrmButton onClick={onCancel} disabled={saving}>Cancel</CrmButton>
          {error ? <CrmBadge tone="danger">{error}</CrmBadge> : null}
        </div>
      </form>
    </CrmPanel>
  )
}

function TaskRow({ task, now, onAction, compact = false }: { task: Task; now: number; compact?: boolean; onAction: (taskId: string, action: 'complete' | 'cancel' | 'snooze' | 'edit', patch?: Partial<Task>) => Promise<void> }) {
  const overdue = task.status === 'todo' && task.dueAt && new Date(task.dueAt).getTime() < now
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [dueAt, setDueAt] = useState(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : '')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>((task.priority ?? 'normal') as 'low' | 'normal' | 'high' | 'urgent')
  async function saveEdit() {
    await onAction(task.id, 'edit', { title, dueAt: dueAt || null, priority })
    setEditing(false)
  }

  if (editing) {
    return (
      <article className="crm-task-row editing">
        <span className="crm-task-check"><Clock3 size={18} /></span>
        <div className="crm-task-edit-grid">
          <input className="crm-input" value={title} onChange={event => setTitle(event.target.value)} />
          <input className="crm-input" value={dueAt} onChange={event => setDueAt(event.target.value)} type="date" />
          <select className="crm-select" value={priority} onChange={event => setPriority(event.target.value as 'low' | 'normal' | 'high' | 'urgent')}>
            <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="crm-form-actions">
          <CrmButton onClick={saveEdit} tone="primary" disabled={!title.trim()}>Save</CrmButton>
          <CrmButton onClick={() => setEditing(false)}>Cancel</CrmButton>
        </div>
      </article>
    )
  }

  return (
    <article className={`crm-task-row ${compact ? 'compact' : ''}`}>
      <button type="button" className="crm-task-check" onClick={() => onAction(task.id, 'complete')} aria-label="Complete task"><CheckCircle2 size={18} /></button>
      <div>
        <strong><ClampedText lines={2} title={task.title}>{task.title}</ClampedText></strong>
        <p><Clock3 size={13} /> <ClampedText lines={1}>{task.dueAt ? shortDate(task.dueAt) : 'No due date'}{task.companyName ? ` · ${task.companyName}` : ''}{task.dealTitle ? ` · ${task.dealTitle}` : ''}</ClampedText></p>
      </div>
      <div className="crm-form-actions">
        {overdue ? <CrmBadge tone="danger">Overdue</CrmBadge> : null}
        <CrmBadge tone={task.priority === 'urgent' || task.priority === 'high' ? 'warn' : 'neutral'}>{task.priority ?? 'normal'}</CrmBadge>
        {task.dealId ? <CrmButton href={`/deals/${task.dealId}`} tone="ghost">Open deal</CrmButton> : null}
        {task.status === 'todo' && !compact ? <CrmButton onClick={() => setEditing(true)}>Edit</CrmButton> : null}
        {task.status === 'todo' ? <CrmButton onClick={() => onAction(task.id, 'snooze')}>Snooze</CrmButton> : null}
        {task.status === 'todo' && !compact ? <CrmButton onClick={() => onAction(task.id, 'cancel')}><XCircle size={14} /> Cancel</CrmButton> : null}
      </div>
    </article>
  )
}

function endOfToday(now: number) {
  const date = new Date(now)
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}
