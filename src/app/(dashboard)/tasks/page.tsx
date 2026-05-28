'use client'

import type { FormEvent } from 'react'
import { Suspense, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Clock3, Plus, Search, SlidersHorizontal, XCircle } from 'lucide-react'
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
  ObjectStartState,
  ObjectWorkspaceHeader,
  SavedViewBar,
  ViewTabs,
  WorkspaceBriefing,
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
  companyId?: string | null
  contactId?: string | null
  dealTitle?: string | null
  companyName?: string | null
}

type TaskView = 'today' | 'upcoming' | 'overdue' | 'completed'
type TaskPriorityFilter = 'all' | 'urgent' | 'high' | 'normal'
type TaskLinkFilter = 'all' | 'linked' | 'unlinked'

type TaskSavedView = {
  id: string
  label: string
  view: TaskView
  query: string
  priorityFilter: TaskPriorityFilter
  linkFilter: TaskLinkFilter
}

const TASK_SAVED_VIEWS_KEY = 'halvex-task-saved-views'

export default function TasksPage() {
  return (
    <Suspense fallback={<CrmPage><CrmSkeleton rows={6} /></CrmPage>}>
      <TasksContent />
    </Suspense>
  )
}

function TasksContent() {
  const router = useRouter()
  const search = useSearchParams()
  const [quickAddOpen, setQuickAddOpen] = useState(search.get('quick') === 'task')
  const [query, setQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityFilter>('all')
  const [linkFilter, setLinkFilter] = useState<TaskLinkFilter>('all')
  const [savedViews, setSavedViews] = useState<TaskSavedView[]>([])
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [now] = useState(() => Date.now())
  const rawView = search.get('view')
  const view: TaskView = rawView === 'upcoming' || rawView === 'overdue' || rawView === 'completed' ? rawView : 'today'
  const { data: todoData, isLoading, mutate: mutateTodo } = useSWR('/api/crm/tasks?status=todo', fetcher, { revalidateOnFocus: false })
  const { data: doneData, mutate: mutateDone } = useSWR('/api/crm/tasks?status=done', fetcher, { revalidateOnFocus: false })
  const todoTasks: Task[] = useMemo(() => todoData?.data ?? [], [todoData])
  const doneTasks: Task[] = useMemo(() => doneData?.data ?? [], [doneData])

  useEffect(() => {
    if (search.get('quick') === 'task') setQuickAddOpen(true)
  }, [search])

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(TASK_SAVED_VIEWS_KEY) || '[]')
      if (Array.isArray(parsed)) setSavedViews(parsed.filter(Boolean).slice(0, 8))
    } catch {
      setSavedViews([])
    }
  }, [])

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
      const hasLinkedRecord = Boolean(task.dealId || task.companyId || task.contactId)
      if (linkFilter === 'linked' && !hasLinkedRecord) return false
      if (linkFilter === 'unlinked' && hasLinkedRecord) return false
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

  function persistSavedViews(next: TaskSavedView[]) {
    setSavedViews(next)
    window.localStorage.setItem(TASK_SAVED_VIEWS_KEY, JSON.stringify(next))
  }

  function applySavedView(savedView: TaskSavedView) {
    setQuery(savedView.query)
    setPriorityFilter(savedView.priorityFilter)
    setLinkFilter(savedView.linkFilter)
    if (savedView.view !== view) router.push(`/tasks?view=${savedView.view}`)
  }

  function deleteSavedView(id: string) {
    persistSavedViews(savedViews.filter(savedView => savedView.id !== id))
  }

  function saveCurrentView(label: string) {
    const nextView: TaskSavedView = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `view-${Date.now()}`,
      label,
      view,
      query,
      priorityFilter,
      linkFilter,
    }
    persistSavedViews([nextView, ...savedViews.filter(savedView => savedView.label.toLowerCase() !== label.toLowerCase())].slice(0, 8))
    setSaveViewOpen(false)
  }

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
    <CrmPage wide>
      <ObjectWorkspaceHeader
        object="Tasks"
        title="Execution board"
        description="A focused work system for customer commitments across deals, companies, and people. Halvex can recommend tasks, but the list stays user-owned."
        actions={<><CrmButton onClick={() => setQuickAddOpen(true)} tone="primary"><Plus size={16} /> Add task</CrmButton><CrmButton href="/deals">Deals</CrmButton></>}
        stats={<>
        <CrmStat label="Due today" value={today} />
        <CrmStat label="Overdue" value={overdue} />
        <CrmStat label="Upcoming" value={upcoming} />
        <CrmStat label="Completed" value={doneTasks.length} />
        </>}
      />

      <WorkspaceBriefing items={[
        { label: 'Today', title: 'Work from due commitments', text: 'Overdue and today lanes make the next customer action obvious without needing a dashboard.' },
        { label: 'Context', title: 'Open linked records', text: 'Tasks tied to deals should be handled from the record so the follow-up uses current notes and buyer context.' },
        { label: 'AI assist', title: 'Convert recommendations deliberately', text: 'Deal insights can become tasks only when accepted, keeping the work list clean and trustworthy.' },
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
          <SavedViewBar
            views={[
              { label: 'Today', active: view === 'today' && priorityFilter === 'all' && linkFilter === 'all' && !query, onClick: () => { router.push('/tasks?view=today'); setPriorityFilter('all'); setLinkFilter('all'); setQuery('') }, count: today },
              { label: 'Overdue', active: view === 'overdue' && priorityFilter === 'all' && linkFilter === 'all' && !query, onClick: () => { router.push('/tasks?view=overdue'); setPriorityFilter('all'); setLinkFilter('all'); setQuery('') }, count: overdue },
              { label: 'Upcoming', active: view === 'upcoming' && priorityFilter === 'all' && linkFilter === 'all' && !query, onClick: () => { router.push('/tasks?view=upcoming'); setPriorityFilter('all'); setLinkFilter('all'); setQuery('') }, count: upcoming },
              { label: 'High priority', active: priorityFilter === 'high', onClick: () => setPriorityFilter('high'), count: todoTasks.filter(task => task.priority === 'high').length },
              { label: 'Unlinked', active: linkFilter === 'unlinked', onClick: () => setLinkFilter('unlinked'), count: todoTasks.filter(task => !(task.dealId || task.companyId || task.contactId)).length },
              ...savedViews.map(savedView => ({ label: savedView.label, active: isTaskSavedViewActive(savedView, { view, query, priorityFilter, linkFilter }), onClick: () => applySavedView(savedView) })),
            ]}
          >
            <button type="button" className="crm-saved-view-save" onClick={() => setSaveViewOpen(prev => !prev)}><SlidersHorizontal size={14} /> Save view</button>
          </SavedViewBar>
          {saveViewOpen ? (
            <TaskSaveViewPanel
              onSave={saveCurrentView}
              onCancel={() => setSaveViewOpen(false)}
              savedViews={savedViews}
              onDelete={deleteSavedView}
              current={{ view, query, priorityFilter, linkFilter }}
            />
          ) : null}
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
          {!isLoading && !visibleTasks.length ? (
            query || priorityFilter !== 'all' || linkFilter !== 'all' ? (
              <CrmEmpty title="No matching tasks" action={<CrmButton onClick={() => { setQuery(''); setPriorityFilter('all'); setLinkFilter('all') }}>Clear filters</CrmButton>}>Try another search or reset the current task lens.</CrmEmpty>
            ) : (
              <ObjectStartState
                label="First commitment"
                title="Create the next action before the CRM becomes memory."
                description="Tasks turn records into motion. Add one concrete follow-up, give it a due date, and link it to the deal, company, or person it belongs to."
                primaryAction={<CrmButton onClick={() => setQuickAddOpen(true)} tone="primary">Add task</CrmButton>}
                secondaryAction={<CrmButton href="/deals?quick=deal">Create deal</CrmButton>}
                steps={[
                  { label: 'Action', title: 'Write the customer commitment', text: 'Use a verb: follow up, send pricing, book demo, confirm buyer, or chase signature.' },
                  { label: 'Date', title: 'Give it a due date', text: 'Today, overdue, and upcoming views only work when commitments are dated.' },
                  { label: 'Context', title: 'Link the record', text: 'Attach the task to a deal, company, or person so the work has full CRM context.' },
                ]}
              />
            )
          ) : null}
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

function TaskSaveViewPanel({ onSave, onCancel, savedViews, onDelete, current }: {
  onSave: (label: string) => void
  onCancel: () => void
  savedViews: TaskSavedView[]
  onDelete: (id: string) => void
  current: Pick<TaskSavedView, 'view' | 'query' | 'priorityFilter' | 'linkFilter'>
}) {
  const [label, setLabel] = useState('')
  return (
    <div className="crm-save-view-panel">
      <form onSubmit={(event) => { event.preventDefault(); if (label.trim()) onSave(label.trim()) }}>
        <div>
          <strong>Save this task view</strong>
          <p>Stores the current task lane, search, priority, and linked-record filter for repeatable execution.</p>
        </div>
        <input className="crm-input" value={label} onChange={event => setLabel(event.target.value)} placeholder="e.g. Unlinked urgent work" autoFocus />
        <CrmButton type="submit" tone="primary" disabled={!label.trim()}>Save view</CrmButton>
        <CrmButton onClick={onCancel}>Cancel</CrmButton>
      </form>
      <div className="crm-save-view-summary">
        <span>Current lens</span>
        <p>{describeTaskView(current)}</p>
      </div>
      {savedViews.length ? (
        <div className="crm-save-view-list">
          {savedViews.map(savedView => (
            <article key={savedView.id}>
              <div><strong>{savedView.label}</strong><p>{describeTaskView(savedView)}</p></div>
              <button type="button" onClick={() => onDelete(savedView.id)}>Remove</button>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function isTaskSavedViewActive(savedView: TaskSavedView, current: Pick<TaskSavedView, 'view' | 'query' | 'priorityFilter' | 'linkFilter'>) {
  return savedView.view === current.view
    && savedView.query === current.query
    && savedView.priorityFilter === current.priorityFilter
    && savedView.linkFilter === current.linkFilter
}

function describeTaskView(view: Pick<TaskSavedView, 'view' | 'query' | 'priorityFilter' | 'linkFilter'>) {
  return [
    `${view.view} tasks`,
    view.priorityFilter !== 'all' ? `${view.priorityFilter} priority` : null,
    view.linkFilter !== 'all' ? `${view.linkFilter} records` : null,
    view.query ? `search "${view.query}"` : null,
  ].filter(Boolean).join(' · ')
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
