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
  const [form, setForm] = useState<LeadForm>(emptyLeadForm)
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
                onClick={() => setCreateOpen(true)}
                className={cn(pillInsetClass, 'flex items-center justify-between gap-3 p-3 text-left transition hover:bg-white/[0.07]')}
              >
                <span className="flex items-center gap-3 text-sm font-medium text-white">
                  <span className="grid size-8 place-items-center rounded-full bg-white text-black"><Plus className="size-4" /></span>
                  Create new deal
                </span>
                <Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100">New</Badge>
              </button>

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

      <Button type="button" onClick={() => setCreateOpen(true)} className="hidden rounded-full bg-white text-xs text-black hover:bg-zinc-200 md:inline-flex">
        <Plus className="size-4" />
        New deal
      </Button>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto border-white/10 bg-[#080a0d] p-0 text-zinc-100 sm:max-w-2xl">
          <SheetHeader className="border-b border-white/10 p-6">
            <SheetTitle className="font-title text-2xl text-white">Create deal</SheetTitle>
            <SheetDescription className="text-zinc-400">Add a new account, buyer, value, forecast signal, and next step.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 p-6">
            {notice ? <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">{notice}</div> : null}
            {error ? <div className="rounded-full border border-red-300/20 bg-red-300/10 px-4 py-2 text-sm text-red-100">{error}</div> : null}

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
              <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                <Link href="/coach"><Bot className="size-4" /> Coach</Link>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
