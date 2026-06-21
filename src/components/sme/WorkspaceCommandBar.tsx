'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Bot, Building2, CalendarClock, CheckSquare, MessageCircle, Plus, Search, Send, Users } from 'lucide-react'

import type { ChannelId, CrmLeadDto, CrmWorkspacePayload } from '@/lib/sme-crm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { pillInsetClass, pillSurfaceClass } from '@/components/sme/halvex-system'
import { cn } from '@/lib/utils'

type SearchResult = {
  id: string
  type: 'deal' | 'account' | 'message' | 'task' | 'activity'
  title: string
  detail: string
  href: string
  leadId?: string
}

type LeadForm = {
  companyName: string
  primaryPersonName: string
  owner: string
  stage: string
  valueAmount: string
  probability: string
  expectedCloseDate: string
  channel: ChannelId
  risk: CrmLeadDto['risk']
  description: string
  nextStep: string
}

type TaskForm = {
  leadId: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  dueAt: string
}

type ActivityForm = {
  leadId: string
  type: string
  title: string
  body: string
}

function defaultCloseDateInput() {
  const closeDate = new Date()
  closeDate.setDate(closeDate.getDate() + 14)
  return closeDate.toISOString().slice(0, 10)
}

const emptyLeadForm: LeadForm = {
  companyName: '',
  primaryPersonName: '',
  owner: '',
  stage: 'Discovery',
  valueAmount: '',
  probability: '35',
  expectedCloseDate: defaultCloseDateInput(),
  channel: 'mail',
  risk: 'new',
  description: '',
  nextStep: '',
}

function defaultDueDateInput() {
  const due = new Date()
  due.setDate(due.getDate() + 1)
  return due.toISOString().slice(0, 10)
}

function leadOptionLabel(lead: CrmLeadDto) {
  return `${lead.companyName ?? lead.title ?? 'Untitled deal'} · ${lead.primaryPersonName ?? 'No buyer'}`
}

function resultIcon(type: SearchResult['type']) {
  const className = 'size-4'
  switch (type) {
    case 'deal': return <Users className={className} />
    case 'account': return <Building2 className={className} />
    case 'message': return <MessageCircle className={className} />
    case 'task': return <CheckSquare className={className} />
    case 'activity': return <CalendarClock className={className} />
  }
}

async function fetchWorkspace() {
  const response = await fetch('/api/crm/workspace', { headers: { Accept: 'application/json' } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? `Workspace request failed: ${response.status}`)
  return payload as CrmWorkspacePayload
}

async function createLead(form: LeadForm) {
  const response = await fetch('/api/crm/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      title: form.companyName,
      companyName: form.companyName,
      primaryPersonName: form.primaryPersonName,
      owner: form.owner || 'Sales owner',
      stage: form.stage,
      valueAmount: Number(form.valueAmount || 0),
      probability: Number(form.probability || 0),
      expectedCloseDate: form.expectedCloseDate,
      channel: form.channel,
      risk: form.risk,
      description: form.description,
      nextStep: form.nextStep,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? 'Unable to create deal')
  return payload as { lead: CrmLeadDto }
}

async function apiJson<T>(path: string, init: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? `Request failed: ${response.status}`)
  return payload as T
}

function buildIndex(workspace: CrmWorkspacePayload | null): SearchResult[] {
  if (!workspace) return []
  const results: SearchResult[] = []

  for (const lead of workspace.leads) {
    results.push({
      id: `deal-${lead.id}`,
      type: 'deal',
      title: lead.companyName ?? lead.title ?? 'Untitled deal',
      detail: `${lead.primaryPersonName ?? 'No contact'} · ${lead.stageName ?? lead.stage ?? 'No stage'} · ${lead.nextStep ?? 'No next step'}`,
      href: '/deals',
      leadId: lead.id,
    })
    results.push({
      id: `account-${lead.id}`,
      type: 'account',
      title: lead.companyName ?? lead.title ?? 'Untitled account',
      detail: `${lead.owner ?? 'No owner'} · ${lead.primaryPersonName ?? 'No contact'}`,
      href: '/accounts',
      leadId: lead.id,
    })
  }

  for (const messages of Object.values(workspace.messages)) {
    for (const message of messages) {
      const lead = workspace.leads.find(candidate => candidate.id === message.leadId)
      results.push({
        id: `message-${message.id}`,
        type: 'message',
        title: lead?.companyName ?? 'Message',
        detail: message.text,
        href: '/inbox',
        leadId: message.leadId,
      })
    }
  }

  for (const task of workspace.tasks) {
    results.push({
      id: `task-${task.id}`,
      type: 'task',
      title: task.title ?? 'Task',
      detail: `${task.companyName ?? 'No account'} · ${task.description ?? ''}`,
      href: '/tasks',
    })
  }

  for (const activity of workspace.activities) {
    results.push({
      id: `activity-${activity.id}`,
      type: 'activity',
      title: activity.title ?? 'Activity',
      detail: `${activity.companyName ?? 'No account'} · ${activity.body ?? ''}`,
      href: activity.type === 'meeting' || activity.type === 'call' ? '/meetings' : '/deals',
    })
  }

  return results
}

export default function WorkspaceCommandBar() {
  const [workspace, setWorkspace] = useState<CrmWorkspacePayload | null>(null)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [commandMode, setCommandMode] = useState<'deal' | 'task' | 'activity'>('deal')
  const [form, setForm] = useState<LeadForm>(emptyLeadForm)
  const [taskForm, setTaskForm] = useState<TaskForm>({ leadId: '', title: '', description: '', priority: 'medium', dueAt: defaultDueDateInput() })
  const [activityForm, setActivityForm] = useState<ActivityForm>({ leadId: '', type: 'note', title: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      setWorkspace(await fetchWorkspace())
    } catch {
      setWorkspace(null)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    const firstLeadId = workspace?.leads[0]?.id ?? ''
    if (firstLeadId && !taskForm.leadId) setTaskForm(current => ({ ...current, leadId: firstLeadId }))
    if (firstLeadId && !activityForm.leadId) setActivityForm(current => ({ ...current, leadId: firstLeadId }))
  }, [activityForm.leadId, taskForm.leadId, workspace])

  const index = useMemo(() => buildIndex(workspace), [workspace])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return index.slice(0, 8)
    return index
      .filter(item => `${item.type} ${item.title} ${item.detail}`.toLowerCase().includes(q))
      .slice(0, 10)
  }, [index, query])

  async function handleCreate() {
    if (!form.companyName.trim()) {
      setError('Company is required')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await createLead(form)
      setNotice(`${payload.lead.companyName ?? payload.lead.title} created`)
      setForm(emptyLeadForm)
      await refresh()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create deal')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateTask() {
    const lead = workspace?.leads.find(item => item.id === taskForm.leadId)
    if (!taskForm.title.trim()) {
      setError('Task title is required')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await apiJson('/api/crm/tasks', {
        method: 'POST',
        body: JSON.stringify({
          leadId: lead?.id,
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || 'Created from the command bar.',
          priority: taskForm.priority,
          dueAt: taskForm.dueAt ? new Date(`${taskForm.dueAt}T10:00:00.000Z`).toISOString() : undefined,
          companyName: lead?.companyName,
          personName: lead?.primaryPersonName,
        }),
      })
      setNotice(`Task created${lead?.companyName ? ` for ${lead.companyName}` : ''}`)
      setTaskForm({ leadId: lead?.id ?? workspace?.leads[0]?.id ?? '', title: '', description: '', priority: 'medium', dueAt: defaultDueDateInput() })
      await refresh()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create task')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogActivity() {
    const lead = workspace?.leads.find(item => item.id === activityForm.leadId)
    if (!activityForm.title.trim()) {
      setError('Activity title is required')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await apiJson('/api/crm/activities', {
        method: 'POST',
        body: JSON.stringify({
          leadId: lead?.id,
          title: activityForm.title.trim(),
          body: activityForm.body.trim() || 'Logged from the command bar.',
          type: activityForm.type,
          companyName: lead?.companyName,
          personName: lead?.primaryPersonName,
        }),
      })
      setNotice(`Activity logged${lead?.companyName ? ` for ${lead.companyName}` : ''}`)
      setActivityForm({ leadId: lead?.id ?? workspace?.leads[0]?.id ?? '', type: 'note', title: '', body: '' })
      await refresh()
    } catch (activityError) {
      setError(activityError instanceof Error ? activityError.message : 'Unable to log activity')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
        <Input
          aria-label="Search workspace"
          value={query}
          onChange={event => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 140)}
          placeholder="Search deals, accounts, messages, tasks..."
          className="h-10 rounded-full border-white/8 bg-white/[0.06] pl-9 text-xs text-zinc-100 placeholder:text-zinc-500 shadow-none focus-visible:ring-white/20"
        />
        {focused ? (
          <div className={cn(pillSurfaceClass, 'absolute left-0 right-0 top-12 z-50 max-h-[520px] overflow-hidden bg-[#090b0d] p-2 shadow-2xl')}>
            <div className="grid gap-1">
              <button
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  setCommandMode('deal')
                  setCreateOpen(true)
                }}
                className={cn(pillInsetClass, 'flex items-center justify-between gap-3 p-3 text-left transition hover:bg-white/[0.07]')}
              >
                <span className="flex items-center gap-3 text-sm font-medium text-white">
                  <span className="grid size-8 place-items-center rounded-full bg-white text-black"><Plus className="size-4" /></span>
                  Create new deal
                </span>
                <Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100">New</Badge>
              </button>
              <div className="grid gap-1 md:grid-cols-2">
                <button
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => {
                    setCommandMode('task')
                    setCreateOpen(true)
                  }}
                  className={cn(pillInsetClass, 'flex items-center gap-3 p-3 text-left transition hover:bg-white/[0.07]')}
                >
                  <span className="grid size-8 place-items-center rounded-full bg-white/[0.06] text-zinc-300"><CheckSquare className="size-4" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-white">Create task</span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">Assign follow-up work</span>
                  </span>
                </button>
                <button
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => {
                    setCommandMode('activity')
                    setCreateOpen(true)
                  }}
                  className={cn(pillInsetClass, 'flex items-center gap-3 p-3 text-left transition hover:bg-white/[0.07]')}
                >
                  <span className="grid size-8 place-items-center rounded-full bg-white/[0.06] text-zinc-300"><CalendarClock className="size-4" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-white">Log activity</span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">Capture evidence fast</span>
                  </span>
                </button>
              </div>

              {filtered.map(item => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(pillInsetClass, 'grid gap-2 p-3 transition hover:bg-white/[0.07]')}
                >
                  <span className="flex min-w-0 items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-full bg-white/[0.06] text-zinc-300">{resultIcon(item.type)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">{item.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-zinc-500">{item.detail}</span>
                      </span>
                    </span>
                    <ArrowUpRight className="size-3.5 shrink-0 text-zinc-500" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <Button type="button" onClick={() => {
        setCommandMode('deal')
        setCreateOpen(true)
      }} className="hidden rounded-full bg-white text-xs text-black hover:bg-zinc-200 md:inline-flex">
        <Plus className="size-4" />
        New
      </Button>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto border-white/10 bg-[#080a0d] p-0 text-zinc-100 sm:max-w-2xl">
          <SheetHeader className="border-b border-white/10 p-6">
            <SheetTitle className="font-title text-2xl text-white">Command drawer</SheetTitle>
            <SheetDescription className="text-zinc-400">Create pipeline, assign work, or capture deal evidence without leaving the current page.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 p-6">
            {notice ? <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">{notice}</div> : null}
            {error ? <div className="rounded-full border border-red-300/20 bg-red-300/10 px-4 py-2 text-sm text-red-100">{error}</div> : null}

            <Tabs value={commandMode} onValueChange={value => setCommandMode(value as typeof commandMode)} className="grid gap-4">
              <TabsList className="h-auto w-fit rounded-full border border-white/10 bg-white/[0.04] p-1">
                <TabsTrigger value="deal" className="rounded-full px-4 data-[state=active]:bg-white data-[state=active]:text-black">Deal</TabsTrigger>
                <TabsTrigger value="task" className="rounded-full px-4 data-[state=active]:bg-white data-[state=active]:text-black">Task</TabsTrigger>
                <TabsTrigger value="activity" className="rounded-full px-4 data-[state=active]:bg-white data-[state=active]:text-black">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="deal" className="mt-0 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Label className="grid gap-2 text-xs text-zinc-500">Company<Input value={form.companyName} onChange={event => setForm({ ...form, companyName: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" /></Label>
                  <Label className="grid gap-2 text-xs text-zinc-500">Primary buyer<Input value={form.primaryPersonName} onChange={event => setForm({ ...form, primaryPersonName: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" /></Label>
                  <Label className="grid gap-2 text-xs text-zinc-500">Owner<Input value={form.owner} onChange={event => setForm({ ...form, owner: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" /></Label>
                  <Label className="grid gap-2 text-xs text-zinc-500">Stage<Input value={form.stage} onChange={event => setForm({ ...form, stage: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" /></Label>
                  <Label className="grid gap-2 text-xs text-zinc-500">Value<Input type="number" value={form.valueAmount} onChange={event => setForm({ ...form, valueAmount: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" /></Label>
                  <Label className="grid gap-2 text-xs text-zinc-500">Probability<Input type="number" value={form.probability} onChange={event => setForm({ ...form, probability: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" /></Label>
                  <Label className="grid gap-2 text-xs text-zinc-500">Close date<Input type="date" value={form.expectedCloseDate} onChange={event => setForm({ ...form, expectedCloseDate: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" /></Label>
                  <Label className="grid gap-2 text-xs text-zinc-500">Channel<select value={form.channel} onChange={event => setForm({ ...form, channel: event.target.value as ChannelId })} className="h-9 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-white outline-none"><option value="mail">Email</option><option value="linkedin">LinkedIn</option><option value="webchat">Web chat</option><option value="meetings">Calls & meetings</option></select></Label>
                  <Label className="grid gap-2 text-xs text-zinc-500">Risk<select value={form.risk} onChange={event => setForm({ ...form, risk: event.target.value as CrmLeadDto['risk'] })} className="h-9 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-white outline-none"><option value="new">New</option><option value="warm">Warm</option><option value="hot">Hot</option></select></Label>
                </div>

                <Label className="grid gap-2 text-xs text-zinc-500">Description<Textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="min-h-24 rounded-[22px] border-white/10 bg-black/20 text-white" /></Label>
                <Label className="grid gap-2 text-xs text-zinc-500">Next step<Textarea value={form.nextStep} onChange={event => setForm({ ...form, nextStep: event.target.value })} className="min-h-24 rounded-[22px] border-white/10 bg-black/20 text-white" /></Label>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void handleCreate()} disabled={busy} className="rounded-full bg-white text-black hover:bg-zinc-200">
                    <Send className="size-4" />
                    {busy ? 'Creating...' : 'Create deal'}
                  </Button>
                  <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                    <Link href="/deals">Open pipeline</Link>
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="task" className="mt-0 grid gap-4">
                <Label className="grid gap-2 text-xs text-zinc-500">Deal<select value={taskForm.leadId} onChange={event => setTaskForm({ ...taskForm, leadId: event.target.value })} className="h-10 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-white outline-none">{workspace?.leads.map(lead => <option key={lead.id} value={lead.id}>{leadOptionLabel(lead)}</option>)}</select></Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <Label className="grid gap-2 text-xs text-zinc-500">Title<Input value={taskForm.title} onChange={event => setTaskForm({ ...taskForm, title: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" /></Label>
                  <Label className="grid gap-2 text-xs text-zinc-500">Due date<Input type="date" value={taskForm.dueAt} onChange={event => setTaskForm({ ...taskForm, dueAt: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" /></Label>
                  <Label className="grid gap-2 text-xs text-zinc-500">Priority<select value={taskForm.priority} onChange={event => setTaskForm({ ...taskForm, priority: event.target.value as TaskForm['priority'] })} className="h-9 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-white outline-none"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Label>
                </div>
                <Label className="grid gap-2 text-xs text-zinc-500">Description<Textarea value={taskForm.description} onChange={event => setTaskForm({ ...taskForm, description: event.target.value })} className="min-h-28 rounded-[22px] border-white/10 bg-black/20 text-white" /></Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void handleCreateTask()} disabled={busy || !workspace?.leads.length} className="rounded-full bg-white text-black hover:bg-zinc-200">
                    <CheckSquare className="size-4" />
                    {busy ? 'Creating...' : 'Create task'}
                  </Button>
                  <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100"><Link href="/tasks">Open tasks</Link></Button>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-0 grid gap-4">
                <Label className="grid gap-2 text-xs text-zinc-500">Deal<select value={activityForm.leadId} onChange={event => setActivityForm({ ...activityForm, leadId: event.target.value })} className="h-10 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-white outline-none">{workspace?.leads.map(lead => <option key={lead.id} value={lead.id}>{leadOptionLabel(lead)}</option>)}</select></Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <Label className="grid gap-2 text-xs text-zinc-500">Title<Input value={activityForm.title} onChange={event => setActivityForm({ ...activityForm, title: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" /></Label>
                  <Label className="grid gap-2 text-xs text-zinc-500">Type<select value={activityForm.type} onChange={event => setActivityForm({ ...activityForm, type: event.target.value })} className="h-9 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-white outline-none"><option value="note">Note</option><option value="call">Call</option><option value="meeting">Meeting</option><option value="risk">Risk</option><option value="intent">Decision signal</option></select></Label>
                </div>
                <Label className="grid gap-2 text-xs text-zinc-500">Notes<Textarea value={activityForm.body} onChange={event => setActivityForm({ ...activityForm, body: event.target.value })} className="min-h-36 rounded-[22px] border-white/10 bg-black/20 text-white" /></Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void handleLogActivity()} disabled={busy || !workspace?.leads.length} className="rounded-full bg-white text-black hover:bg-zinc-200">
                    <CalendarClock className="size-4" />
                    {busy ? 'Logging...' : 'Log activity'}
                  </Button>
                  <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100"><Link href="/meetings">Open meetings</Link></Button>
                  <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100"><Link href="/coach"><Bot className="size-4" /> Coach</Link></Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
