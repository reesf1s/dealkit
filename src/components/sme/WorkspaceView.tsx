'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gauge,
  Linkedin,
  Mail,
  MessageCircle,
  Pencil,
  PlugZap,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react'

import type { ChannelId, CrmLeadDto, CrmMessageDto, CrmWorkspacePayload } from '@/lib/sme-crm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { pillInsetClass, pillSurfaceClass } from '@/components/sme/halvex-system'
import { cn } from '@/lib/utils'

type WorkspaceViewName = 'dashboard' | 'inbox' | 'deals' | 'forecast' | 'coach' | 'channels'

type WorkspaceAction = {
  selectLead: (leadId: string) => void
  refresh: () => Promise<void>
}

type LeadFormState = {
  companyName: string
  primaryPersonName: string
  owner: string
  stage: string
  valueAmount: string
  probability: string
  risk: CrmLeadDto['risk']
  channel: ChannelId
  nextStep: string
  description: string
}

const CHANNEL_ICONS: Record<ChannelId, typeof Mail> = {
  mail: Mail,
  linkedin: Linkedin,
  webchat: MessageCircle,
  meetings: CalendarClock,
}

const VIEW_COPY: Record<WorkspaceViewName, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: 'Command center',
    title: 'Revenue dashboard',
    description: 'A focused operating view for pipeline health, urgent work, and next actions.',
  },
  inbox: {
    eyebrow: 'Conversations',
    title: 'Unified inbox',
    description: 'Messages grouped by channel and deal, with the strongest buying signals surfaced first.',
  },
  deals: {
    eyebrow: 'Pipeline',
    title: 'Deals',
    description: 'A tabular view for scanning accounts, probability, value, risk, and next steps.',
  },
  forecast: {
    eyebrow: 'Forecast',
    title: 'Weighted forecast',
    description: 'Understand committed value, stage mix, and the gaps that change the number.',
  },
  coach: {
    eyebrow: 'AI coach',
    title: 'Next best actions',
    description: 'Prioritized recommendations grounded in deal state, activities, and open tasks.',
  },
  channels: {
    eyebrow: 'Integrations',
    title: 'Channels',
    description: 'Connection status for the conversation sources feeding Halvex.',
  },
}

function money(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)
}

function shortDate(value?: string | Date | null) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

function daysAgo(value?: string | Date | null) {
  if (!value) return 'No activity'
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function initials(value?: string | null) {
  return (value ?? 'HV')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'HV'
}

function riskTone(risk: CrmLeadDto['risk']) {
  if (risk === 'hot') return 'border-red-400/25 bg-red-400/10 text-red-100'
  if (risk === 'warm') return 'border-yellow-300/25 bg-yellow-300/10 text-yellow-100'
  return 'border-blue-300/25 bg-blue-300/10 text-blue-100'
}

function channelLabel(channel: ChannelId) {
  if (channel === 'mail') return 'Email'
  if (channel === 'webchat') return 'Web chat'
  if (channel === 'meetings') return 'Calls & meetings'
  return 'LinkedIn'
}

async function loadWorkspace() {
  const response = await fetch('/api/crm/workspace', { headers: { Accept: 'application/json' } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? `Workspace request failed: ${response.status}`)
  return payload as CrmWorkspacePayload
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

function leadFormState(lead: CrmLeadDto): LeadFormState {
  return {
    companyName: lead.companyName ?? lead.title ?? 'Untitled account',
    primaryPersonName: lead.primaryPersonName ?? 'Primary contact',
    owner: lead.owner ?? 'Sales owner',
    stage: lead.stageName || lead.stage || 'New',
    valueAmount: String(lead.valueAmount ?? 0),
    probability: String(lead.probability ?? 0),
    risk: lead.risk,
    channel: lead.channel,
    nextStep: lead.nextStep ?? '',
    description: lead.description ?? '',
  }
}

function leadMessages(workspace: CrmWorkspacePayload, leadId: string) {
  return Object.values(workspace.messages)
    .flat()
    .filter(message => message.leadId === leadId)
    .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
}

function PageHeader({ view }: { view: WorkspaceViewName }) {
  const copy = VIEW_COPY[view]
  return (
    <section className={cn(pillSurfaceClass, 'grid gap-5 bg-[#101316] p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end')}>
      <div>
        <Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100">{copy.eyebrow}</Badge>
        <h1 className="mt-4 font-title text-3xl font-semibold tracking-normal text-white md:text-4xl">{copy.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{copy.description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="rounded-full bg-white text-black hover:bg-zinc-200">
          <Link href="/deals">
            Open deals
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
          <Link href="/coach">
            AI actions
            <Bot className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  )
}

function StatCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Gauge }) {
  return (
    <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-normal text-white">{value}</p>
          </div>
          <span className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-blue-200">
            <Icon className="size-4" />
          </span>
        </div>
        <p className="mt-4 text-xs leading-5 text-zinc-500">{detail}</p>
      </CardContent>
    </Card>
  )
}

function DealAvatar({ value }: { value?: string | null }) {
  return <span className="grid size-9 place-items-center rounded-full bg-white/[0.08] text-xs font-semibold text-zinc-200">{initials(value)}</span>
}

function useWorkspace() {
  const [workspace, setWorkspace] = useState<CrmWorkspacePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      setWorkspace(await loadWorkspace())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load workspace')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return { workspace, loading, error, refresh }
}

function WorkspaceSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-36 rounded-[28px]" />
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-28 rounded-[28px]" />
        <Skeleton className="h-28 rounded-[28px]" />
        <Skeleton className="h-28 rounded-[28px]" />
        <Skeleton className="h-28 rounded-[28px]" />
      </div>
      <Skeleton className="h-[520px] rounded-[28px]" />
    </div>
  )
}

function WorkspaceError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className={cn(pillSurfaceClass, 'max-w-2xl bg-[#101316]')}>
      <CardContent className="flex items-start gap-4 p-5">
        <span className="grid size-10 place-items-center rounded-full bg-red-400/10 text-red-200">
          <AlertCircle className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-white">Workspace unavailable</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{message}</p>
          <Button type="button" onClick={onRetry} className="mt-4 rounded-full">
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function useWorkspaceMetrics(workspace: CrmWorkspacePayload) {
  return useMemo(() => {
    const leads = workspace.leads
    const total = leads.reduce((sum, lead) => sum + Number(lead.valueAmount ?? 0), 0)
    const weighted = leads.reduce((sum, lead) => sum + (Number(lead.valueAmount ?? 0) * Number(lead.probability ?? 0)) / 100, 0)
    const risk = leads.filter(lead => lead.risk === 'hot' || Number(lead.probability ?? 0) < 45).length
    const tasks = workspace.tasks.length
    const connected = workspace.channels.filter(channel => channel.connected).length
    const messageCount = Object.values(workspace.messages).flat().length
    const stages = [...leads.reduce((map, lead) => {
      const stage = lead.stageName || lead.stage || 'Unstaged'
      const current = map.get(stage) ?? { stage, count: 0, value: 0, weighted: 0 }
      current.count += 1
      current.value += Number(lead.valueAmount ?? 0)
      current.weighted += (Number(lead.valueAmount ?? 0) * Number(lead.probability ?? 0)) / 100
      map.set(stage, current)
      return map
    }, new Map<string, { stage: string; count: number; value: number; weighted: number }>()).values()]

    return { total, weighted, risk, tasks, connected, messageCount, stages }
  }, [workspace])
}

function DashboardView({ workspace, actions }: { workspace: CrmWorkspacePayload; actions: WorkspaceAction }) {
  const metrics = useWorkspaceMetrics(workspace)
  const priorityDeals = [...workspace.leads].sort((a, b) => b.score - a.score).slice(0, 4)
  const recommendations = workspace.intelligence.recommendations.slice(0, 3)

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open pipeline" value={money(metrics.total)} detail={`${workspace.leads.length} active deals across all channels.`} icon={TrendingUp} />
        <StatCard label="Weighted forecast" value={money(Math.round(metrics.weighted))} detail="Probability-adjusted value currently in play." icon={Gauge} />
        <StatCard label="At-risk work" value={`${metrics.risk}`} detail="Deals needing attention, proof, or a clearer next step." icon={ShieldAlert} />
        <StatCard label="Live channels" value={`${metrics.connected}/${workspace.channels.length}`} detail={`${metrics.messageCount} captured messages feeding the workspace.`} icon={PlugZap} />
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Priority deals</CardTitle>
            <CardDescription>What should sit in the dashboard: the few deals that change the week.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {priorityDeals.map(lead => (
              <button
                key={lead.id}
                type="button"
                onClick={() => actions.selectLead(lead.id)}
                className={cn(pillInsetClass, 'grid gap-3 p-4 text-left transition hover:bg-white/[0.07] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center')}
              >
                <DealAvatar value={lead.companyName} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{lead.companyName}</p>
                  <p className="mt-1 truncate text-xs text-zinc-500">{lead.nextStep}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={riskTone(lead.risk)}>{lead.risk}</Badge>
                  <span className="text-sm font-medium text-white">{money(Number(lead.valueAmount ?? 0))}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Today’s operating queue</CardTitle>
            <CardDescription>Compact, opinionated, and action-oriented.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {recommendations.map(item => (
              <div key={item.id} className={cn(pillInsetClass, 'p-4')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">{item.body}</p>
                  </div>
                  <Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100">{money(item.estimatedValue)}</Badge>
                </div>
                <Button asChild variant="outline" size="sm" className="mt-4 rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                  <Link href="/coach">
                    Open action
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function DealsView({ workspace, actions }: { workspace: CrmWorkspacePayload; actions: WorkspaceAction }) {
  const stages = ['All', ...new Set(workspace.leads.map(lead => lead.stageName || lead.stage))]
  const [stageFilter, setStageFilter] = useState('All')
  const [query, setQuery] = useState('')
  const filteredLeads = workspace.leads.filter(lead => {
    const matchesStage = stageFilter === 'All' || (lead.stageName || lead.stage) === stageFilter
    const matchesQuery = `${lead.companyName} ${lead.primaryPersonName} ${lead.owner} ${lead.nextStep}`.toLowerCase().includes(query.toLowerCase())
    return matchesStage && matchesQuery
  })

  return (
    <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
      <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <CardTitle>Deal table</CardTitle>
          <CardDescription>Built for scanning, editing, notes, next steps, and follow-up work.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search deals..."
            className="h-10 w-56 rounded-full border-white/10 bg-black/20 text-zinc-100 placeholder:text-zinc-600"
          />
          <select
            value={stageFilter}
            onChange={event => setStageFilter(event.target.value)}
            className="h-10 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none"
          >
            {stages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-zinc-500">Account</TableHead>
              <TableHead className="text-zinc-500">Stage</TableHead>
              <TableHead className="text-zinc-500">Value</TableHead>
              <TableHead className="text-zinc-500">Prob.</TableHead>
              <TableHead className="text-zinc-500">Last</TableHead>
              <TableHead className="text-zinc-500">Next step</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.map(lead => (
              <TableRow key={lead.id} className="border-white/8 hover:bg-white/[0.04]">
                <TableCell>
                  <button type="button" onClick={() => actions.selectLead(lead.id)} className="flex items-center gap-3 text-left">
                    <DealAvatar value={lead.companyName} />
                    <div>
                      <p className="font-medium text-white">{lead.companyName}</p>
                      <p className="text-xs text-zinc-500">{lead.primaryPersonName}</p>
                    </div>
                  </button>
                </TableCell>
                <TableCell className="text-zinc-300">{lead.stageName}</TableCell>
                <TableCell className="text-zinc-300">{money(Number(lead.valueAmount ?? 0))}</TableCell>
                <TableCell>
                  <div className="flex min-w-28 items-center gap-2">
                    <Progress value={Number(lead.probability ?? 0)} className="h-1.5" />
                    <span className="w-9 text-xs text-zinc-500">{lead.probability}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-zinc-500">{daysAgo(lead.latestActivityAt)}</TableCell>
                <TableCell>
                  <button type="button" onClick={() => actions.selectLead(lead.id)} className="max-w-sm truncate text-left text-zinc-400 hover:text-white">
                    {lead.nextStep}
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function InboxView({ workspace, actions }: { workspace: CrmWorkspacePayload; actions: WorkspaceAction }) {
  const allMessages = Object.entries(workspace.messages).flatMap(([channel, messages]) =>
    messages.map(message => ({ ...message, channel: channel as ChannelId })),
  ).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())

  return (
    <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="grid content-start gap-3">
        {workspace.channels.map(channel => {
          const Icon = CHANNEL_ICONS[channel.id]
          const count = workspace.messages[channel.id]?.length ?? 0
          return (
            <Card key={channel.id} className={cn(pillSurfaceClass, 'bg-[#101316]')}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-zinc-200"><Icon className="size-4" /></span>
                  <div>
                    <p className="font-medium text-white">{channel.name}</p>
                    <p className="text-xs text-zinc-500">{count} messages</p>
                  </div>
                </div>
                <Badge variant="outline" className={channel.connected ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-zinc-500/20 bg-zinc-500/10 text-zinc-300'}>
                  {channel.connected ? 'Live' : 'Pending'}
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardHeader>
          <CardTitle>Latest conversations</CardTitle>
          <CardDescription>Every row should connect back to a deal and a next action.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {allMessages.map((message: CrmMessageDto) => {
            const lead = workspace.leads.find(item => item.id === message.leadId)
            const Icon = CHANNEL_ICONS[message.channel]
            return (
              <button
                key={message.id}
                type="button"
                onClick={() => lead ? actions.selectLead(lead.id) : undefined}
                className={cn(pillInsetClass, 'grid gap-3 p-4 text-left transition hover:bg-white/[0.07] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start')}
              >
                <span className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-zinc-300"><Icon className="size-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{lead?.companyName ?? 'Unknown account'}</p>
                  <p className="mt-1 text-xs text-zinc-500">{channelLabel(message.channel)} · {message.from === 'rep' ? 'You' : message.from}</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{message.text}</p>
                </div>
                <span className="text-xs text-zinc-500">{shortDate(message.sentAt)}</span>
              </button>
            )
          })}
        </CardContent>
      </Card>
    </section>
  )
}

function ForecastView({ workspace }: { workspace: CrmWorkspacePayload }) {
  const metrics = useWorkspaceMetrics(workspace)
  const maxValue = Math.max(...metrics.stages.map(stage => stage.value), 1)

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total pipeline" value={money(metrics.total)} detail="All open value." icon={TrendingUp} />
        <StatCard label="Weighted" value={money(Math.round(metrics.weighted))} detail="Probability adjusted." icon={Gauge} />
        <StatCard label="Open tasks" value={`${metrics.tasks}`} detail="Execution work tied to deals." icon={CheckCircle2} />
      </div>
      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardHeader>
          <CardTitle>Stage mix</CardTitle>
          <CardDescription>Forecast should answer where the number lives and what can move.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {metrics.stages.map(stage => (
            <div key={stage.stage} className={cn(pillInsetClass, 'p-4')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{stage.stage}</p>
                  <p className="mt-1 text-xs text-zinc-500">{stage.count} deals · {money(Math.round(stage.weighted))} weighted</p>
                </div>
                <p className="text-sm font-semibold text-white">{money(stage.value)}</p>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.max(8, (stage.value / maxValue) * 100)}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function CoachView({ workspace, actions }: { workspace: CrmWorkspacePayload; actions: WorkspaceAction }) {
  const rankedLeads = [...workspace.leads]
    .sort((a, b) => (
      Number(b.valueAmount ?? 0) * (100 - Number(b.probability ?? 0)) + Number(b.openTaskCount ?? 0) * 2500
    ) - (
      Number(a.valueAmount ?? 0) * (100 - Number(a.probability ?? 0)) + Number(a.openTaskCount ?? 0) * 2500
    ))
    .slice(0, 5)

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardHeader>
          <CardTitle>Recommended actions</CardTitle>
          <CardDescription>AI belongs here: ranked work, evidence, and a clear reason to act.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {workspace.intelligence.recommendations.map(item => (
            <div key={item.id} className={cn(pillInsetClass, 'p-4')}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100">{item.priority}</Badge>
                  <h2 className="mt-3 text-base font-semibold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{item.body}</p>
                </div>
                <p className="text-sm font-semibold text-white">{money(item.estimatedValue)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardHeader>
          <CardTitle>Deal coaching queue</CardTitle>
          <CardDescription>Open a record, draft a reply, save notes, or create a task.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {rankedLeads.map(lead => (
            <button key={lead.id} type="button" onClick={() => actions.selectLead(lead.id)} className={cn(pillInsetClass, 'p-4 text-left transition hover:bg-white/[0.07]')}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{lead.companyName}</p>
                <Badge variant="outline" className={riskTone(lead.risk)}>{lead.risk}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">{lead.nextStep}</p>
              <p className="mt-3 text-xs text-zinc-400">{money(Number(lead.valueAmount ?? 0))} · {Number(lead.probability ?? 0)}% probability</p>
            </button>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}

function ChannelsView({ workspace, actions }: { workspace: CrmWorkspacePayload; actions: WorkspaceAction }) {
  const [busyChannel, setBusyChannel] = useState<ChannelId | null>(null)

  async function toggleChannel(channel: ChannelId, connected: boolean) {
    setBusyChannel(channel)
    try {
      await apiJson(`/api/crm/channels/${channel}`, {
        method: 'PATCH',
        body: JSON.stringify({ connected: !connected }),
      })
      await actions.refresh()
    } finally {
      setBusyChannel(null)
    }
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {workspace.channels.map(channel => {
        const Icon = CHANNEL_ICONS[channel.id]
        const count = workspace.messages[channel.id]?.length ?? 0
        return (
          <Card key={channel.id} className={cn(pillSurfaceClass, 'bg-[#101316]')}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-zinc-200">
                  <Icon className="size-5" />
                </span>
                <Badge variant="outline" className={channel.connected ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-yellow-300/20 bg-yellow-300/10 text-yellow-100'}>
                  {channel.connected ? 'Connected' : 'Pending'}
                </Badge>
              </div>
              <h2 className="mt-5 text-lg font-semibold text-white">{channel.name}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{count} messages currently feeding deal context from {channelLabel(channel.id)}.</p>
              <Button
                type="button"
                variant="outline"
                className="mt-5 w-full rounded-full border-white/10 bg-white/[0.04] text-zinc-100"
                disabled={busyChannel === channel.id}
                onClick={() => void toggleChannel(channel.id, channel.connected)}
              >
                {busyChannel === channel.id ? 'Updating...' : channel.connected ? 'Pause connection' : 'Connect channel'}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-xs font-medium text-zinc-500">
      {label}
      {children}
    </label>
  )
}

function DealDetailSheet({
  workspace,
  lead,
  open,
  onOpenChange,
  onRefresh,
}: {
  workspace: CrmWorkspacePayload
  lead: CrmLeadDto | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh: () => Promise<void>
}) {
  const [form, setForm] = useState<LeadFormState | null>(lead ? leadFormState(lead) : null)
  const [notes, setNotes] = useState(lead?.notes ?? '')
  const [message, setMessage] = useState('')
  const [draftInstruction, setDraftInstruction] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setForm(lead ? leadFormState(lead) : null)
    setNotes(lead?.notes ?? '')
    setMessage('')
    setDraftInstruction('')
    setTaskTitle(lead?.nextStep ?? '')
    setTaskDescription('')
    setNotice(null)
  }, [lead])

  if (!lead || !form) return null

  const activeLead = lead
  const leadId = lead.id
  const activeForm = form
  const messages = leadMessages(workspace, lead.id)
  const tasks = workspace.tasks.filter(task => task.companyName === lead.companyName || task.personName === lead.primaryPersonName)
  const activities = workspace.activities.filter(activity => activity.companyName === lead.companyName || activity.personName === lead.primaryPersonName)
  const weightedValue = Math.round((Number(lead.valueAmount ?? 0) * Number(lead.probability ?? 0)) / 100)

  async function saveDeal() {
    setBusy('deal')
    setNotice(null)
    try {
      await apiJson(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...activeForm,
          title: activeForm.companyName,
          valueAmount: Number(activeForm.valueAmount),
          probability: Number(activeForm.probability),
        }),
      })
      await onRefresh()
      setNotice('Deal updated')
    } finally {
      setBusy(null)
    }
  }

  async function saveNotes() {
    setBusy('notes')
    setNotice(null)
    try {
      await apiJson(`/api/crm/leads/${leadId}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      })
      await onRefresh()
      setNotice('Notes saved')
    } finally {
      setBusy(null)
    }
  }

  async function createTask() {
    if (!taskTitle.trim()) return
    setBusy('task')
    setNotice(null)
    try {
      await apiJson('/api/crm/tasks', {
        method: 'POST',
        body: JSON.stringify({
          leadId,
          title: taskTitle,
          description: taskDescription,
          priority: activeLead.risk === 'hot' ? 'high' : 'medium',
          companyName: activeLead.companyName,
          personName: activeLead.primaryPersonName,
        }),
      })
      setTaskTitle('')
      setTaskDescription('')
      await onRefresh()
      setNotice('Task created')
    } finally {
      setBusy(null)
    }
  }

  async function generateDraft() {
    setBusy('draft')
    setNotice(null)
    try {
      const payload = await apiJson<{ draft: string }>('/api/ai/draft', {
        method: 'POST',
        body: JSON.stringify({ leadId, channel: activeForm.channel, instruction: draftInstruction, lead: activeLead }),
      })
      setMessage(payload.draft)
      setNotice('Draft ready')
    } finally {
      setBusy(null)
    }
  }

  async function sendMessage() {
    if (!message.trim()) return
    setBusy('message')
    setNotice(null)
    try {
      await apiJson('/api/crm/messages', {
        method: 'POST',
        body: JSON.stringify({ leadId, channel: activeForm.channel, text: message }),
      })
      setMessage('')
      await onRefresh()
      setNotice('Message sent')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-white/10 bg-[#080a0d] p-0 text-zinc-100 sm:max-w-4xl">
        <SheetHeader className="border-b border-white/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pr-8">
            <div>
              <SheetTitle className="font-title text-2xl text-white">{lead.companyName}</SheetTitle>
              <SheetDescription className="mt-2 text-zinc-400">
                {lead.primaryPersonName} · {lead.stageName} · {money(Number(lead.valueAmount ?? 0))} pipeline
              </SheetDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={riskTone(lead.risk)}>{lead.risk}</Badge>
              <Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100">{weightedValue ? `${money(weightedValue)} weighted` : 'No weighted value'}</Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="grid gap-4 p-4 md:p-6">
          {notice ? (
            <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">{notice}</div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Score" value={`${lead.score}`} detail="Halvex qualification score." icon={Gauge} />
            <StatCard label="Probability" value={`${lead.probability}%`} detail="Rep confidence on current close path." icon={TrendingUp} />
            <StatCard label="Open tasks" value={`${lead.openTaskCount}`} detail="Work still attached to this account." icon={ClipboardList} />
            <StatCard label="Last activity" value={daysAgo(lead.latestActivityAt)} detail={`Expected close ${shortDate(lead.expectedCloseDate)}.`} icon={CalendarClock} />
          </div>

          <Tabs defaultValue="overview" className="gap-4">
            <TabsList className="rounded-full border border-white/10 bg-black/30 p-1">
              {['overview', 'timeline', 'notes', 'tasks', 'ai'].map(tab => (
                <TabsTrigger key={tab} value={tab} className="rounded-full px-4 capitalize data-[state=active]:bg-white data-[state=active]:text-black">
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="grid gap-4">
              <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Pencil className="size-4" /> Deal fields</CardTitle>
                  <CardDescription>Edit the core CRM fields that drive forecast, risk, and next actions.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <DetailField label="Company">
                    <Input value={form.companyName} onChange={event => setForm({ ...form, companyName: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" />
                  </DetailField>
                  <DetailField label="Primary person">
                    <Input value={form.primaryPersonName} onChange={event => setForm({ ...form, primaryPersonName: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" />
                  </DetailField>
                  <DetailField label="Owner">
                    <Input value={form.owner} onChange={event => setForm({ ...form, owner: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" />
                  </DetailField>
                  <DetailField label="Stage">
                    <Input value={form.stage} onChange={event => setForm({ ...form, stage: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" />
                  </DetailField>
                  <DetailField label="Value">
                    <Input value={form.valueAmount} type="number" onChange={event => setForm({ ...form, valueAmount: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" />
                  </DetailField>
                  <DetailField label="Probability">
                    <Input value={form.probability} type="number" min={0} max={100} onChange={event => setForm({ ...form, probability: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" />
                  </DetailField>
                  <DetailField label="Risk">
                    <select value={form.risk} onChange={event => setForm({ ...form, risk: event.target.value as CrmLeadDto['risk'] })} className="h-9 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-white outline-none">
                      <option value="hot">Hot</option>
                      <option value="warm">Warm</option>
                      <option value="new">New</option>
                    </select>
                  </DetailField>
                  <DetailField label="Channel">
                    <select value={form.channel} onChange={event => setForm({ ...form, channel: event.target.value as ChannelId })} className="h-9 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-white outline-none">
                      <option value="mail">Email</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="webchat">Web chat</option>
                      <option value="meetings">Calls & meetings</option>
                    </select>
                  </DetailField>
                  <DetailField label="Next step">
                    <Textarea value={form.nextStep} onChange={event => setForm({ ...form, nextStep: event.target.value })} className="min-h-24 rounded-[22px] border-white/10 bg-black/20 text-white md:col-span-2" />
                  </DetailField>
                  <DetailField label="Description">
                    <Textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="min-h-28 rounded-[22px] border-white/10 bg-black/20 text-white md:col-span-2" />
                  </DetailField>
                  <div className="md:col-span-2">
                    <Button type="button" onClick={() => void saveDeal()} disabled={busy === 'deal'} className="rounded-full bg-white text-black hover:bg-zinc-200">
                      <Save className="size-4" />
                      {busy === 'deal' ? 'Saving...' : 'Save deal'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="grid gap-4">
              <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><MessageCircle className="size-4" /> Conversation history</CardTitle>
                  <CardDescription>Messages and events attached to this deal.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {[...messages.map(item => ({ id: item.id, title: item.from === 'rep' ? 'You' : item.from, body: item.text, date: item.sentAt, type: channelLabel(item.channel) })), ...activities.map(item => ({ id: item.id, title: item.title, body: item.body ?? '', date: item.occurredAt, type: item.type ?? 'activity' }))].map(item => (
                    <div key={item.id} className={cn(pillInsetClass, 'p-4')}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <span className="text-xs text-zinc-500">{shortDate(item.date)}</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">{item.type}</p>
                      <p className="mt-3 text-sm leading-6 text-zinc-300">{item.body}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="grid gap-4">
              <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileText className="size-4" /> Deal notes</CardTitle>
                  <CardDescription>Simple markdown-style account notes saved to the deal.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <Textarea value={notes} onChange={event => setNotes(event.target.value)} className="min-h-80 rounded-[24px] border-white/10 bg-black/20 font-mono text-sm text-white" />
                  <Button type="button" onClick={() => void saveNotes()} disabled={busy === 'notes'} className="w-fit rounded-full bg-white text-black hover:bg-zinc-200">
                    <Save className="size-4" />
                    {busy === 'notes' ? 'Saving...' : 'Save notes'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="grid gap-4">
              <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ClipboardList className="size-4" /> Tasks</CardTitle>
                  <CardDescription>Create the next item of work against this deal.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
                    <Input value={taskTitle} onChange={event => setTaskTitle(event.target.value)} placeholder="Task title" className="rounded-full border-white/10 bg-black/20 text-white placeholder:text-zinc-600" />
                    <Input value={taskDescription} onChange={event => setTaskDescription(event.target.value)} placeholder="Description" className="rounded-full border-white/10 bg-black/20 text-white placeholder:text-zinc-600" />
                    <Button type="button" onClick={() => void createTask()} disabled={busy === 'task' || !taskTitle.trim()} className="rounded-full bg-white text-black hover:bg-zinc-200">
                      <Plus className="size-4" />
                      Add
                    </Button>
                  </div>
                  <div className="grid gap-3">
                    {tasks.map(task => (
                      <div key={task.id} className={cn(pillInsetClass, 'flex items-start justify-between gap-3 p-4')}>
                        <div>
                          <p className="text-sm font-semibold text-white">{task.title}</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">{task.description}</p>
                        </div>
                        <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{shortDate(task.dueAt)}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai" className="grid gap-4">
              <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Bot className="size-4" /> AI follow-up</CardTitle>
                  <CardDescription>Generate a grounded reply, edit it, then send it into the conversation stream.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <Input value={draftInstruction} onChange={event => setDraftInstruction(event.target.value)} placeholder="Optional instruction, e.g. make it direct and mention security notes" className="rounded-full border-white/10 bg-black/20 text-white placeholder:text-zinc-600" />
                  <Textarea value={message} onChange={event => setMessage(event.target.value)} placeholder="Draft or write a message..." className="min-h-52 rounded-[24px] border-white/10 bg-black/20 text-white placeholder:text-zinc-600" />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => void generateDraft()} disabled={busy === 'draft'} className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                      <Bot className="size-4" />
                      {busy === 'draft' ? 'Drafting...' : 'Generate draft'}
                    </Button>
                    <Button type="button" onClick={() => void sendMessage()} disabled={busy === 'message' || !message.trim()} className="rounded-full bg-white text-black hover:bg-zinc-200">
                      <Send className="size-4" />
                      {busy === 'message' ? 'Sending...' : `Send via ${channelLabel(form.channel)}`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default function WorkspaceView({ view }: { view: WorkspaceViewName }) {
  const { workspace, loading, error, refresh } = useWorkspace()
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)

  if (loading) return <WorkspaceSkeleton />
  if (error || !workspace) return <WorkspaceError message={error ?? 'No workspace payload returned.'} onRetry={() => void refresh()} />

  const selectedLead = selectedLeadId ? workspace.leads.find(lead => lead.id === selectedLeadId) ?? null : null
  const actions: WorkspaceAction = {
    selectLead: setSelectedLeadId,
    refresh,
  }

  return (
    <div className="grid gap-4 text-zinc-100">
      <PageHeader view={view} />
      {view === 'dashboard' ? <DashboardView workspace={workspace} actions={actions} /> : null}
      {view === 'inbox' ? <InboxView workspace={workspace} actions={actions} /> : null}
      {view === 'deals' ? <DealsView workspace={workspace} actions={actions} /> : null}
      {view === 'forecast' ? <ForecastView workspace={workspace} /> : null}
      {view === 'coach' ? <CoachView workspace={workspace} actions={actions} /> : null}
      {view === 'channels' ? <ChannelsView workspace={workspace} actions={actions} /> : null}
      <DealDetailSheet
        workspace={workspace}
        lead={selectedLead}
        open={Boolean(selectedLead)}
        onOpenChange={open => {
          if (!open) setSelectedLeadId(null)
        }}
        onRefresh={refresh}
      />
    </div>
  )
}
