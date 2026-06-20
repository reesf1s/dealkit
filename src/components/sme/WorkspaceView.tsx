'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Gauge,
  Linkedin,
  Mail,
  MessageCircle,
  Pencil,
  PhoneCall,
  PlugZap,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Trash2,
  TrendingUp,
  Users,
  Workflow,
} from 'lucide-react'

import type { ChannelId, CrmLeadDto, CrmWorkspacePayload } from '@/lib/sme-crm'
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
import { classifyRecoveryIntent, type RecoveryInsight } from '@/lib/recovery-intelligence'

type WorkspaceViewName = 'dashboard' | 'inbox' | 'deals' | 'accounts' | 'tasks' | 'meetings' | 'team' | 'forecast' | 'reports' | 'coach' | 'channels'

type WorkspaceAction = {
  selectLead: (leadId: string) => void
  refresh: () => Promise<void>
}

type LeadFormState = {
  companyName: string
  primaryPersonName: string
  owner: string
  status: string
  stage: string
  valueAmount: string
  probability: string
  expectedCloseDate: string
  risk: CrmLeadDto['risk']
  channel: ChannelId
  nextStep: string
  description: string
}

type CrmViewFilters = {
  query?: string
  stage?: string
  owner?: string
  risk?: CrmLeadDto['risk']
  channel?: ChannelId
  minProbability?: number
}

type CrmSavedView = {
  id: string
  name: string
  description: string
  scope: 'system' | 'workspace'
  filters: CrmViewFilters
  createdAt: string
}

const CHANNEL_ICONS: Record<ChannelId, typeof Mail> = {
  mail: Mail,
  linkedin: Linkedin,
  webchat: MessageCircle,
  meetings: CalendarClock,
}

const OPERATING_TOOLS = [
  {
    href: '/import',
    title: 'Import pipeline',
    detail: 'Validate spreadsheet deals before they enter forecast.',
    icon: FileSpreadsheet,
  },
  {
    href: '/call-review',
    title: 'Review a call',
    detail: 'Turn transcripts into risk, objections, tasks, and deal activity.',
    icon: PhoneCall,
  },
  {
    href: '/automations',
    title: 'Run workflows',
    detail: 'Create follow-up tasks from stale deals and missing proof.',
    icon: Workflow,
  },
  {
    href: '/reports',
    title: 'Readout',
    detail: 'Inspect funnel quality, risk concentration, and coverage.',
    icon: FileText,
  },
  {
    href: '/channels',
    title: 'Channels',
    detail: 'Manage the inbox sources feeding the workspace.',
    icon: PlugZap,
  },
  {
    href: '/settings',
    title: 'Workspace admin',
    detail: 'Export data, audit activity, billing, and team controls.',
    icon: ShieldAlert,
  },
]

const VIEW_COPY: Record<WorkspaceViewName, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: 'Command center',
    title: 'Command center',
    description: 'A tighter operating room for the deals, conversations, and workflows that change the week.',
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
  accounts: {
    eyebrow: 'Accounts',
    title: 'Account directory',
    description: 'Company and contact coverage tied to pipeline value, engagement, and open work.',
  },
  tasks: {
    eyebrow: 'Execution',
    title: 'Task queue',
    description: 'The rep workbench for follow-ups, next steps, due work, and deal-linked activity.',
  },
  meetings: {
    eyebrow: 'Call intelligence',
    title: 'Meetings',
    description: 'Customer conversations, transcript-style notes, decision signals, objections, and follow-up capture.',
  },
  team: {
    eyebrow: 'Team',
    title: 'Owner performance',
    description: 'Pipeline ownership, workload, risk, activity, and forecast coverage by seller.',
  },
  forecast: {
    eyebrow: 'Forecast',
    title: 'Weighted forecast',
    description: 'Understand committed value, stage mix, and the gaps that change the number.',
  },
  reports: {
    eyebrow: 'Reports',
    title: 'Revenue intelligence',
    description: 'Funnel, risk concentration, activity coverage, and channel quality for management review.',
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

function dateInputValue(value?: string | Date | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
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
    status: lead.status ?? 'open',
    stage: lead.stageName || lead.stage || 'New',
    valueAmount: String(lead.valueAmount ?? 0),
    probability: String(lead.probability ?? 0),
    expectedCloseDate: dateInputValue(lead.expectedCloseDate),
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

function leadMatchesFilters(lead: CrmLeadDto, filters: CrmViewFilters) {
  if (filters.stage && filters.stage !== 'All' && (lead.stageName || lead.stage) !== filters.stage) return false
  if (filters.owner && filters.owner !== 'All' && lead.owner !== filters.owner) return false
  if (filters.risk && lead.risk !== filters.risk) return false
  if (filters.channel && lead.channel !== filters.channel) return false
  if (filters.minProbability && Number(lead.probability ?? 0) < filters.minProbability) return false
  if (filters.query && !`${lead.companyName} ${lead.primaryPersonName} ${lead.owner} ${lead.nextStep}`.toLowerCase().includes(filters.query.toLowerCase())) return false
  return true
}

async function fetchSavedViews() {
  const response = await fetch('/api/crm/views', { headers: { Accept: 'application/json' } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? `Saved views request failed: ${response.status}`)
  return payload as { views: CrmSavedView[] }
}

function useAccounts(workspace: CrmWorkspacePayload) {
  return useMemo(() => {
    return workspace.leads.map(lead => {
      const messages = leadMessages(workspace, lead.id)
      const tasks = workspace.tasks.filter(task => task.companyName === lead.companyName || task.personName === lead.primaryPersonName)
      const activities = workspace.activities.filter(activity => activity.companyName === lead.companyName || activity.personName === lead.primaryPersonName)
      const latestDates = [
        lead.latestActivityAt,
        ...messages.map(message => message.sentAt),
        ...activities.map(activity => activity.occurredAt),
      ].filter(Boolean).map(value => new Date(value as string | Date).getTime()).filter(Number.isFinite)

      return {
        id: lead.id,
        companyName: lead.companyName ?? lead.title ?? 'Untitled account',
        primaryPersonName: lead.primaryPersonName ?? 'Primary contact',
        owner: lead.owner,
        stage: lead.stageName || lead.stage || 'New',
        valueAmount: Number(lead.valueAmount ?? 0),
        probability: Number(lead.probability ?? 0),
        weightedValue: Math.round((Number(lead.valueAmount ?? 0) * Number(lead.probability ?? 0)) / 100),
        risk: lead.risk,
        channel: lead.channel,
        openTasks: tasks.length,
        messages: messages.length,
        activities: activities.length,
        latestAt: latestDates.length ? new Date(Math.max(...latestDates)).toISOString() : lead.latestActivityAt,
      }
    }).sort((a, b) => b.weightedValue - a.weightedValue)
  }, [workspace])
}

function useOwners(workspace: CrmWorkspacePayload) {
  return useMemo(() => {
    const owners = new Map<string, {
      owner: string
      deals: CrmLeadDto[]
      tasks: number
      activities: number
      pipeline: number
      weighted: number
      atRisk: number
      won: number
    }>()

    for (const lead of workspace.leads) {
      const owner = lead.owner || 'Unassigned'
      const current = owners.get(owner) ?? { owner, deals: [], tasks: 0, activities: 0, pipeline: 0, weighted: 0, atRisk: 0, won: 0 }
      current.deals.push(lead)
      current.pipeline += Number(lead.valueAmount ?? 0)
      current.weighted += Math.round((Number(lead.valueAmount ?? 0) * Number(lead.probability ?? 0)) / 100)
      current.atRisk += lead.risk === 'hot' || Number(lead.probability ?? 0) < 45 ? 1 : 0
      current.won += lead.status === 'won' ? Number(lead.valueAmount ?? 0) : 0
      owners.set(owner, current)
    }

    for (const task of workspace.tasks) {
      const lead = workspace.leads.find(candidate => candidate.companyName === task.companyName || candidate.primaryPersonName === task.personName)
      const owner = lead?.owner || 'Unassigned'
      const current = owners.get(owner) ?? { owner, deals: [], tasks: 0, activities: 0, pipeline: 0, weighted: 0, atRisk: 0, won: 0 }
      current.tasks += 1
      owners.set(owner, current)
    }

    for (const activity of workspace.activities) {
      const lead = activityLead(workspace, activity)
      const owner = lead?.owner || 'Unassigned'
      const current = owners.get(owner) ?? { owner, deals: [], tasks: 0, activities: 0, pipeline: 0, weighted: 0, atRisk: 0, won: 0 }
      current.activities += 1
      owners.set(owner, current)
    }

    return [...owners.values()].sort((a, b) => b.weighted - a.weighted)
  }, [workspace])
}

function useReports(workspace: CrmWorkspacePayload, now: number) {
  return useMemo(() => {
    const leads = workspace.leads
    const totalPipeline = leads.reduce((sum, lead) => sum + Number(lead.valueAmount ?? 0), 0)
    const weightedPipeline = leads.reduce((sum, lead) => sum + Math.round((Number(lead.valueAmount ?? 0) * Number(lead.probability ?? 0)) / 100), 0)
    const activeLeads = leads.filter(lead => lead.status !== 'won' && lead.status !== 'lost')
    const riskyLeads = activeLeads.filter(lead => lead.risk === 'hot' || Number(lead.probability ?? 0) < 45)
    const staleLeads = activeLeads.filter(lead => {
      if (!lead.latestActivityAt) return true
      if (!now) return false
      return now - new Date(lead.latestActivityAt).getTime() > 7 * 86_400_000
    })
    const commit = activeLeads.filter(lead => Number(lead.probability ?? 0) >= 70)
    const bestCase = activeLeads.filter(lead => Number(lead.probability ?? 0) >= 45 && Number(lead.probability ?? 0) < 70)
    const openPipeline = activeLeads.filter(lead => Number(lead.probability ?? 0) < 45)
    const messages = Object.values(workspace.messages).flat()

    const stageRows = [...leads.reduce((map, lead) => {
      const stage = lead.stageName || lead.stage || 'Unstaged'
      const current = map.get(stage) ?? { stage, deals: 0, pipeline: 0, weighted: 0, risk: 0, probability: 0 }
      current.deals += 1
      current.pipeline += Number(lead.valueAmount ?? 0)
      current.weighted += Math.round((Number(lead.valueAmount ?? 0) * Number(lead.probability ?? 0)) / 100)
      current.risk += lead.risk === 'hot' || Number(lead.probability ?? 0) < 45 ? 1 : 0
      current.probability += Number(lead.probability ?? 0)
      map.set(stage, current)
      return map
    }, new Map<string, { stage: string; deals: number; pipeline: number; weighted: number; risk: number; probability: number }>()).values()]
      .map(row => ({ ...row, avgProbability: Math.round(row.probability / Math.max(row.deals, 1)) }))
      .sort((a, b) => b.pipeline - a.pipeline)

    const channelRows = workspace.channels.map(channel => {
      const channelLeads = leads.filter(lead => lead.channel === channel.id)
      const channelMessages = workspace.messages[channel.id] ?? []
      const pipeline = channelLeads.reduce((sum, lead) => sum + Number(lead.valueAmount ?? 0), 0)
      const weighted = channelLeads.reduce((sum, lead) => sum + Math.round((Number(lead.valueAmount ?? 0) * Number(lead.probability ?? 0)) / 100), 0)
      return {
        id: channel.id,
        name: channel.name,
        connected: channel.connected,
        deals: channelLeads.length,
        messages: channelMessages.length,
        pipeline,
        weighted,
      }
    }).sort((a, b) => b.pipeline - a.pipeline)

    const coverageRows = activeLeads.map(lead => {
      const leadMessagesCount = leadMessages(workspace, lead.id).length
      const leadTasks = workspace.tasks.filter(task => task.companyName === lead.companyName || task.personName === lead.primaryPersonName).length
      const leadActivities = workspace.activities.filter(activity => activity.companyName === lead.companyName || activity.personName === lead.primaryPersonName).length
      const coverage = leadMessagesCount + leadTasks + leadActivities
      return { lead, messages: leadMessagesCount, tasks: leadTasks, activities: leadActivities, coverage }
    }).sort((a, b) => a.coverage - b.coverage)

    return {
      totalPipeline,
      weightedPipeline,
      riskyLeads,
      staleLeads,
      commit,
      bestCase,
      openPipeline,
      messages,
      stageRows,
      channelRows,
      coverageRows,
    }
  }, [workspace, now])
}

function activityLead(workspace: CrmWorkspacePayload, activity: CrmWorkspacePayload['activities'][number]) {
  return workspace.leads.find(lead => lead.companyName === activity.companyName || lead.primaryPersonName === activity.personName)
}

function isMeetingActivity(activity: CrmWorkspacePayload['activities'][number]) {
  const text = `${activity.type ?? ''} ${activity.title ?? ''} ${activity.body ?? ''}`.toLowerCase()
  return ['call', 'meeting', 'demo', 'decision', 'competitor', 'gong', 'security', 'budget', 'legal'].some(term => text.includes(term))
}

function signalTone(text: string) {
  const lower = text.toLowerCase()
  if (['risk', 'legal', 'security', 'competitor', 'gong', 'budget'].some(term => lower.includes(term))) return 'border-red-400/25 bg-red-400/10 text-red-100'
  if (['decision', 'owner', 'timeline', 'friday'].some(term => lower.includes(term))) return 'border-yellow-300/25 bg-yellow-300/10 text-yellow-100'
  return 'border-blue-300/20 bg-blue-300/10 text-blue-100'
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

  const refresh = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true)
    setError(null)
    try {
      setWorkspace(await loadWorkspace())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load workspace')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh(true)
  }, [refresh])

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

      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardHeader className="md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Operating system</CardTitle>
            <CardDescription>Supporting modules for data intake, call intelligence, automation, reporting, and workspace control.</CardDescription>
          </div>
          <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
            <Link href="/settings">
              Admin
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {OPERATING_TOOLS.map(tool => {
            const Icon = tool.icon
            return (
              <Link key={tool.href} href={tool.href} className={cn(pillInsetClass, 'group grid gap-4 p-4 transition hover:bg-white/[0.07]')}>
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-zinc-200">
                    <Icon className="size-4" />
                  </span>
                  <ArrowUpRight className="size-4 text-zinc-600 transition group-hover:text-zinc-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{tool.title}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">{tool.detail}</p>
                </div>
              </Link>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function DealsView({ workspace, actions }: { workspace: CrmWorkspacePayload; actions: WorkspaceAction }) {
  const stages = ['All', ...new Set(workspace.leads.map(lead => lead.stageName || lead.stage))]
  const owners = ['All', ...new Set(workspace.leads.map(lead => lead.owner || 'Unassigned'))]
  const [stageFilter, setStageFilter] = useState('All')
  const [ownerFilter, setOwnerFilter] = useState('All')
  const [riskFilter, setRiskFilter] = useState<'all' | CrmLeadDto['risk']>('all')
  const [channelFilter, setChannelFilter] = useState<'all' | ChannelId>('all')
  const [minProbability, setMinProbability] = useState('0')
  const [query, setQuery] = useState('')
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null)
  const [savedViews, setSavedViews] = useState<CrmSavedView[]>([])
  const [viewName, setViewName] = useState('')
  const [viewNotice, setViewNotice] = useState<string | null>(null)
  const [viewBusy, setViewBusy] = useState(false)
  const activeFilters: CrmViewFilters = {
    query: query.trim() || undefined,
    stage: stageFilter !== 'All' ? stageFilter : undefined,
    owner: ownerFilter !== 'All' ? ownerFilter : undefined,
    risk: riskFilter !== 'all' ? riskFilter : undefined,
    channel: channelFilter !== 'all' ? channelFilter : undefined,
    minProbability: Number(minProbability) > 0 ? Number(minProbability) : undefined,
  }
  const filteredLeads = workspace.leads.filter(lead => {
    return leadMatchesFilters(lead, activeFilters)
  })
  const pipelineStages = ['Discovery', 'Evaluation', 'Proposal', 'Negotiation', 'Commit']
  const openFilteredLeads = filteredLeads.filter(lead => lead.status !== 'won' && lead.status !== 'lost')
  const closedFilteredLeads = filteredLeads.filter(lead => lead.status === 'won' || lead.status === 'lost')
  const pipelineValue = openFilteredLeads.reduce((sum, lead) => sum + Number(lead.valueAmount ?? 0), 0)
  const weightedValue = openFilteredLeads.reduce((sum, lead) => sum + Math.round((Number(lead.valueAmount ?? 0) * Number(lead.probability ?? 0)) / 100), 0)
  const riskLeads = openFilteredLeads
    .filter(lead => lead.risk === 'hot' || Number(lead.probability ?? 0) < 45)
    .sort((a, b) => Number(b.valueAmount ?? 0) - Number(a.valueAmount ?? 0))
    .slice(0, 3)
  const closingSoon = [...openFilteredLeads]
    .filter(lead => lead.expectedCloseDate)
    .sort((a, b) => new Date(a.expectedCloseDate ?? 0).getTime() - new Date(b.expectedCloseDate ?? 0).getTime())
    .slice(0, 3)

  useEffect(() => {
    let active = true
    fetchSavedViews()
      .then(payload => {
        if (active) setSavedViews(payload.views)
      })
      .catch(() => {
        if (active) setSavedViews([])
      })
    return () => {
      active = false
    }
  }, [])

  function applyView(view: CrmSavedView) {
    setQuery(view.filters.query ?? '')
    setStageFilter(view.filters.stage ?? 'All')
    setOwnerFilter(view.filters.owner ?? 'All')
    setRiskFilter(view.filters.risk ?? 'all')
    setChannelFilter(view.filters.channel ?? 'all')
    setMinProbability(String(view.filters.minProbability ?? 0))
    setViewNotice(`${view.name} applied`)
  }

  async function saveCurrentView() {
    if (!viewName.trim()) {
      setViewNotice('Name the view first')
      return
    }
    setViewBusy(true)
    setViewNotice(null)
    try {
      await apiJson('/api/crm/views', {
        method: 'POST',
        body: JSON.stringify({
          name: viewName,
          description: `${filteredLeads.length} matching deals`,
          filters: activeFilters,
        }),
      })
      const payload = await fetchSavedViews()
      setSavedViews(payload.views)
      setViewName('')
      setViewNotice('View saved')
    } finally {
      setViewBusy(false)
    }
  }

  async function patchLead(lead: CrmLeadDto, data: Partial<{ stage: string; status: string; probability: number; risk: CrmLeadDto['risk'] }>) {
    setBusyLeadId(lead.id)
    try {
      await apiJson(`/api/crm/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          companyName: lead.companyName,
          primaryPersonName: lead.primaryPersonName,
          owner: lead.owner,
          valueAmount: Number(lead.valueAmount ?? 0),
          channel: lead.channel,
          nextStep: lead.nextStep,
          description: lead.description,
          ...data,
        }),
      })
      await actions.refresh()
    } finally {
      setBusyLeadId(null)
    }
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card className={cn(pillSurfaceClass, 'overflow-hidden bg-[#101316]')}>
          <CardHeader className="border-b border-white/8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Pipeline cockpit</CardTitle>
                <CardDescription>Filtered health, forecast weight, and close pressure before you touch the board.</CardDescription>
              </div>
              <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{filteredLeads.length} matching deals</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 md:grid-cols-4">
            <div className={cn(pillInsetClass, 'p-4')}>
              <p className="text-xs text-zinc-500">Open value</p>
              <p className="mt-2 text-2xl font-semibold text-white">{money(pipelineValue)}</p>
              <p className="mt-3 text-xs leading-5 text-zinc-500">{openFilteredLeads.length} open · {closedFilteredLeads.length} closed in view.</p>
            </div>
            <div className={cn(pillInsetClass, 'p-4')}>
              <p className="text-xs text-zinc-500">Weighted</p>
              <p className="mt-2 text-2xl font-semibold text-white">{money(weightedValue)}</p>
              <p className="mt-3 text-xs leading-5 text-zinc-500">{pipelineValue ? Math.round((weightedValue / pipelineValue) * 100) : 0}% blended confidence.</p>
            </div>
            <div className={cn(pillInsetClass, 'p-4')}>
              <p className="text-xs text-zinc-500">Risk pocket</p>
              <p className="mt-2 text-2xl font-semibold text-white">{riskLeads.length}</p>
              <p className="mt-3 text-xs leading-5 text-zinc-500">{money(riskLeads.reduce((sum, lead) => sum + Number(lead.valueAmount ?? 0), 0))} needs proof or next-step control.</p>
            </div>
            <div className={cn(pillInsetClass, 'p-4')}>
              <p className="text-xs text-zinc-500">Next close</p>
              <p className="mt-2 text-2xl font-semibold text-white">{closingSoon[0] ? shortDate(closingSoon[0].expectedCloseDate) : 'None'}</p>
              <p className="mt-3 text-xs leading-5 text-zinc-500">{closingSoon[0]?.companyName ?? 'No dated close in this view.'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Deal pressure</CardTitle>
            <CardDescription>What the pipeline manager should inspect first.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <div className={cn(pillInsetClass, 'p-4')}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">At risk</p>
                <Badge variant="outline" className="border-red-300/20 bg-red-300/10 text-red-100">{riskLeads.length}</Badge>
              </div>
              <div className="mt-3 grid gap-2">
                {riskLeads.map(lead => (
                  <button key={lead.id} type="button" onClick={() => actions.selectLead(lead.id)} className="flex items-center justify-between gap-3 rounded-full border border-white/8 bg-black/20 px-3 py-2 text-left transition hover:bg-white/[0.06]">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-zinc-200">{lead.companyName}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-zinc-600">{lead.nextStep}</span>
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400">{money(Number(lead.valueAmount ?? 0))}</span>
                  </button>
                ))}
                {!riskLeads.length ? <p className="text-xs text-zinc-500">No risky deals in this filtered view.</p> : null}
              </div>
            </div>

            <div className={cn(pillInsetClass, 'p-4')}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">Closing soon</p>
                <Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100">{closingSoon.length}</Badge>
              </div>
              <div className="mt-3 grid gap-2">
                {closingSoon.map(lead => (
                  <button key={lead.id} type="button" onClick={() => actions.selectLead(lead.id)} className="flex items-center justify-between gap-3 rounded-full border border-white/8 bg-black/20 px-3 py-2 text-left transition hover:bg-white/[0.06]">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-zinc-200">{lead.companyName}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-zinc-600">{lead.stageName}</span>
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400">{shortDate(lead.expectedCloseDate)}</span>
                  </button>
                ))}
                {!closingSoon.length ? <p className="text-xs text-zinc-500">Add close dates to make this queue useful.</p> : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardHeader>
          <CardTitle>Pipeline board</CardTitle>
          <CardDescription>Move opportunities through the sales process and close outcomes without leaving the pipeline.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-5">
          {pipelineStages.map(stage => {
            const stageLeads = openFilteredLeads.filter(lead => (lead.stageName || lead.stage) === stage)
            const stageValue = stageLeads.reduce((sum, lead) => sum + Number(lead.valueAmount ?? 0), 0)
            return (
              <div key={stage} className={cn(pillInsetClass, 'grid content-start gap-3 p-3')}>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{stage}</p>
                    <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{stageLeads.length}</Badge>
                  </div>
                  <p className="text-xs text-zinc-500">{money(stageValue)} open · {stageLeads.filter(lead => lead.risk === 'hot').length} hot</p>
                </div>
                {stageLeads.map(lead => {
                  const currentIndex = pipelineStages.indexOf(stage)
                  const nextStage = pipelineStages[Math.min(pipelineStages.length - 1, currentIndex + 1)]
                  return (
                    <div key={lead.id} className="rounded-[20px] border border-white/10 bg-black/20 p-3">
                      <button type="button" onClick={() => actions.selectLead(lead.id)} className="block w-full text-left">
                        <p className="truncate text-sm font-medium text-white">{lead.companyName}</p>
                        <p className="mt-1 truncate text-xs text-zinc-500">{lead.primaryPersonName}</p>
                      </button>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-zinc-200">{money(Number(lead.valueAmount ?? 0))}</span>
                        <Badge variant="outline" className={riskTone(lead.risk)}>{lead.risk}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={busyLeadId === lead.id || nextStage === stage} onClick={() => void patchLead(lead, { stage: nextStage, probability: Math.min(90, Number(lead.probability ?? 0) + 10) })} className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                          Move next
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" size="sm" disabled={busyLeadId === lead.id} onClick={() => void patchLead(lead, { status: 'won', stage: 'Closed Won', probability: 100, risk: 'hot' })} className="rounded-full bg-emerald-300 text-black hover:bg-emerald-200">Won</Button>
                          <Button type="button" size="sm" variant="outline" disabled={busyLeadId === lead.id} onClick={() => void patchLead(lead, { status: 'lost', stage: 'Closed Lost', probability: 0, risk: 'new' })} className="rounded-full border-red-300/20 bg-red-300/10 text-red-100">Lost</Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {!stageLeads.length ? (
                  <div className="rounded-[20px] border border-dashed border-white/10 bg-black/10 p-4 text-xs leading-5 text-zinc-600">
                    No deals in this lane for the current filters.
                  </div>
                ) : null}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardHeader className="gap-4">
          <div>
            <CardTitle>Deal table</CardTitle>
            <CardDescription>Built for scanning, editing, notes, next steps, and follow-up work.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedViews.map(view => (
              <Button
                key={view.id}
                type="button"
                variant="outline"
                onClick={() => applyView(view)}
                className={cn(
                  'rounded-full border-white/10 bg-white/[0.04] text-zinc-100',
                  view.scope === 'system' && 'border-blue-300/20 bg-blue-300/10 text-blue-100',
                )}
              >
                {view.name}
              </Button>
            ))}
          </div>
          <div className="grid gap-2 lg:grid-cols-[minmax(180px,1.2fr)_repeat(4,minmax(130px,0.75fr))]">
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search deals..."
              className="h-10 rounded-full border-white/10 bg-black/20 text-zinc-100 placeholder:text-zinc-600"
            />
            <select
              value={stageFilter}
              onChange={event => setStageFilter(event.target.value)}
              className="h-10 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none"
            >
              {stages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
            </select>
            <select value={ownerFilter} onChange={event => setOwnerFilter(event.target.value)} className="h-10 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none">
              {owners.map(owner => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}
            </select>
            <select value={riskFilter} onChange={event => setRiskFilter(event.target.value as 'all' | CrmLeadDto['risk'])} className="h-10 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none">
              <option value="all">All risk</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="new">New</option>
            </select>
            <select value={channelFilter} onChange={event => setChannelFilter(event.target.value as 'all' | ChannelId)} className="h-10 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none">
              <option value="all">All channels</option>
              <option value="mail">Email</option>
              <option value="linkedin">LinkedIn</option>
              <option value="webchat">Web chat</option>
              <option value="meetings">Calls & meetings</option>
            </select>
          </div>
          <div className={cn(pillInsetClass, 'grid gap-2 p-3 md:grid-cols-[1fr_140px_auto] md:items-center')}>
            <Input value={viewName} onChange={event => setViewName(event.target.value)} placeholder="Name this view..." className="h-10 rounded-full border-white/10 bg-black/20 text-zinc-100 placeholder:text-zinc-600" />
            <select value={minProbability} onChange={event => setMinProbability(event.target.value)} className="h-10 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none">
              <option value="0">Any prob.</option>
              <option value="25">25%+</option>
              <option value="50">50%+</option>
              <option value="70">70%+</option>
            </select>
            <Button type="button" onClick={() => void saveCurrentView()} disabled={viewBusy} className="rounded-full bg-white text-black hover:bg-zinc-200">
              <Save className="size-4" />
              {viewBusy ? 'Saving...' : 'Save view'}
            </Button>
            {viewNotice ? <p className="text-xs text-zinc-500 md:col-span-3">{viewNotice}</p> : null}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-500">Account</TableHead>
                <TableHead className="text-zinc-500">Stage</TableHead>
                <TableHead className="text-zinc-500">Status</TableHead>
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
                  <TableCell><Badge variant="outline" className={lead.status === 'won' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : lead.status === 'lost' ? 'border-red-300/20 bg-red-300/10 text-red-100' : 'border-white/10 bg-white/[0.04] text-zinc-300'}>{lead.status}</Badge></TableCell>
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
    </div>
  )
}

function InboxView({ workspace, actions }: { workspace: CrmWorkspacePayload; actions: WorkspaceAction }) {
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [reply, setReply] = useState('')
  const [busyInbox, setBusyInbox] = useState<'draft' | 'send' | 'task' | null>(null)
  const [inboxNotice, setInboxNotice] = useState<string | null>(null)
  const allMessages = Object.entries(workspace.messages).flatMap(([channel, messages]) =>
    messages.map(message => ({ ...message, channel: channel as ChannelId })),
  ).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
  const conversationRows = workspace.leads
    .map(lead => {
      const messages = leadMessages(workspace, lead.id).sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
      const lastMessage = messages.at(-1)
      const lastBuyerMessage = [...messages].reverse().find(message => message.from === 'customer')
      const needsReply = lastMessage?.from === 'customer'
      return {
        lead,
        messages,
        lastMessage,
        lastBuyerMessage,
        needsReply,
        priority: (needsReply ? 100 : 0) + (lead.risk === 'hot' ? 40 : 0) + Math.round(Number(lead.valueAmount ?? 0) / 1000),
      }
    })
    .filter(row => row.lastMessage)
    .sort((a, b) => b.priority - a.priority || new Date(b.lastMessage?.sentAt ?? 0).getTime() - new Date(a.lastMessage?.sentAt ?? 0).getTime())
  const needsReplyRows = conversationRows.filter(row => row.needsReply)
  const hotConversationRows = conversationRows.filter(row => row.lead.risk === 'hot')
  const inboxValue = conversationRows.reduce((sum, row) => sum + Number(row.lead.valueAmount ?? 0), 0)
  const selectedLead = workspace.leads.find(lead => lead.id === selectedLeadId) ?? conversationRows[0]?.lead ?? workspace.leads.find(lead => lead.id === allMessages[0]?.leadId) ?? workspace.leads[0]
  const thread = selectedLead ? leadMessages(workspace, selectedLead.id).sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()) : []

  useEffect(() => {
    if (!selectedLeadId && selectedLead?.id) setSelectedLeadId(selectedLead.id)
  }, [selectedLead?.id, selectedLeadId])

  async function draftReply() {
    if (!selectedLead) return
    setBusyInbox('draft')
    setInboxNotice(null)
    try {
      const payload = await apiJson<{ draft: string }>('/api/ai/draft', {
        method: 'POST',
        body: JSON.stringify({
          leadId: selectedLead.id,
          channel: selectedLead.channel,
          instruction: `Reply from the inbox. Keep it concise and move this next step forward: ${selectedLead.nextStep}`,
        }),
      })
      setReply(payload.draft)
      setInboxNotice(`Draft ready for ${selectedLead.companyName}`)
    } finally {
      setBusyInbox(null)
    }
  }

  async function sendReply() {
    if (!selectedLead || !reply.trim()) return
    setBusyInbox('send')
    setInboxNotice(null)
    try {
      await apiJson('/api/crm/messages', {
        method: 'POST',
        body: JSON.stringify({
          leadId: selectedLead.id,
          channel: selectedLead.channel,
          from: 'rep',
          text: reply.trim(),
        }),
      })
      setReply('')
      await actions.refresh()
      setInboxNotice(`Reply sent to ${selectedLead.companyName}`)
    } finally {
      setBusyInbox(null)
    }
  }

  async function createInboxTask() {
    if (!selectedLead) return
    setBusyInbox('task')
    setInboxNotice(null)
    try {
      await apiJson('/api/crm/tasks', {
        method: 'POST',
        body: JSON.stringify({
          leadId: selectedLead.id,
          title: `Follow up: ${selectedLead.companyName}`,
          description: selectedLead.nextStep || 'Follow up from the conversation queue.',
          priority: selectedLead.risk === 'hot' ? 'high' : 'medium',
          companyName: selectedLead.companyName,
          personName: selectedLead.primaryPersonName,
        }),
      })
      await actions.refresh()
      setInboxNotice(`Task created for ${selectedLead.companyName}`)
    } finally {
      setBusyInbox(null)
    }
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Conversations" value={`${conversationRows.length}`} detail={`${allMessages.length} captured messages across channels.`} icon={MessageCircle} />
        <StatCard label="Needs reply" value={`${needsReplyRows.length}`} detail="Threads where the latest message came from the buyer." icon={Send} />
        <StatCard label="Hot threads" value={`${hotConversationRows.length}`} detail="Conversation streams attached to hot-risk deals." icon={ShieldAlert} />
        <StatCard label="Pipeline in inbox" value={money(inboxValue)} detail="Open value represented in current conversations." icon={TrendingUp} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[300px_minmax(0,0.9fr)_minmax(360px,0.9fr)]">
        <div className="grid content-start gap-3">
          <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
            <CardHeader>
              <CardTitle>Channel health</CardTitle>
              <CardDescription>Sources feeding the revenue inbox.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {workspace.channels.map(channel => {
                const Icon = CHANNEL_ICONS[channel.id]
                const count = workspace.messages[channel.id]?.length ?? 0
                return (
                  <div key={channel.id} className={cn(pillInsetClass, 'flex items-center justify-between gap-3 p-3')}>
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-zinc-200"><Icon className="size-4" /></span>
                      <div>
                        <p className="text-sm font-medium text-white">{channel.name}</p>
                        <p className="text-xs text-zinc-500">{count} messages</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={channel.connected ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-zinc-500/20 bg-zinc-500/10 text-zinc-300'}>
                      {channel.connected ? 'Live' : 'Pending'}
                    </Badge>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
            <CardHeader>
              <CardTitle>Reply pressure</CardTitle>
              <CardDescription>Buyer-led threads that should not go cold.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {needsReplyRows.slice(0, 4).map(row => (
                <button key={row.lead.id} type="button" onClick={() => setSelectedLeadId(row.lead.id)} className="flex items-center justify-between gap-3 rounded-full border border-white/8 bg-black/20 px-3 py-2 text-left transition hover:bg-white/[0.06]">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-zinc-200">{row.lead.companyName}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-zinc-600">{row.lastBuyerMessage?.text}</span>
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">{shortDate(row.lastMessage?.sentAt)}</span>
                </button>
              ))}
              {!needsReplyRows.length ? <p className="text-xs leading-5 text-zinc-500">No buyer-led replies are waiting.</p> : null}
            </CardContent>
          </Card>
        </div>

      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardHeader>
          <CardTitle>Conversation triage</CardTitle>
          <CardDescription>Grouped by deal, weighted by buyer reply, risk, and pipeline value.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {conversationRows.map(row => {
            const lead = row.lead
            const message = row.lastMessage
            const Icon = CHANNEL_ICONS[lead.channel]
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => setSelectedLeadId(lead.id)}
                className={cn(
                  pillInsetClass,
                  'grid gap-3 p-4 text-left transition hover:bg-white/[0.07] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start',
                  selectedLead?.id === lead.id && 'border-blue-300/30 bg-blue-300/10',
                )}
              >
                <span className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-zinc-300"><Icon className="size-4" /></span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">{lead.companyName}</p>
                    {row.needsReply ? <Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100">buyer replied</Badge> : null}
                    <Badge variant="outline" className={riskTone(lead.risk)}>{lead.risk}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{channelLabel(lead.channel)} · {message?.from === 'rep' ? 'You' : message?.from} · {money(Number(lead.valueAmount ?? 0))}</p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-300">{message?.text}</p>
                </div>
                <span className="text-xs text-zinc-500">{shortDate(message?.sentAt)}</span>
              </button>
            )
          })}
        </CardContent>
      </Card>

      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardHeader className="gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate">{selectedLead?.companyName ?? 'Select a conversation'}</CardTitle>
              <CardDescription>{selectedLead ? `${selectedLead.primaryPersonName} · ${channelLabel(selectedLead.channel)} · ${selectedLead.stageName}` : 'Choose a thread to reply.'}</CardDescription>
            </div>
            {selectedLead ? <Badge variant="outline" className={riskTone(selectedLead.risk)}>{selectedLead.risk}</Badge> : null}
          </div>
          {selectedLead ? (
            <div className={cn(pillInsetClass, 'grid gap-2 p-3 text-xs text-zinc-500')}>
              <p className="text-zinc-300">{selectedLead.nextStep}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{money(Number(selectedLead.valueAmount ?? 0))}</Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{selectedLead.probability}% probability</Badge>
              </div>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-4">
          {inboxNotice ? <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">{inboxNotice}</div> : null}

          <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1">
            {thread.map(message => (
              <div key={message.id} className={cn('max-w-[88%] rounded-[22px] border p-4', message.from === 'rep' || message.from === 'ai' ? 'ml-auto border-blue-300/20 bg-blue-300/10' : 'border-white/10 bg-white/[0.04]')}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-zinc-400">{message.from === 'rep' ? 'You' : message.from === 'ai' ? 'AI draft' : selectedLead?.primaryPersonName ?? 'Buyer'}</p>
                  <span className="text-[11px] text-zinc-600">{shortDate(message.sentAt)}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-200">{message.text}</p>
              </div>
            ))}
            {!thread.length ? <div className="py-12 text-center text-sm text-zinc-500">No messages in this thread yet.</div> : null}
          </div>

          <div className="grid gap-3">
            <Textarea value={reply} onChange={event => setReply(event.target.value)} placeholder="Write a reply grounded in this deal..." className="min-h-36 rounded-[24px] border-white/10 bg-black/20 text-sm leading-6 text-white placeholder:text-zinc-600" />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void draftReply()} disabled={!selectedLead || busyInbox !== null} className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                <Bot className="size-4" />
                {busyInbox === 'draft' ? 'Drafting...' : 'Draft reply'}
              </Button>
              <Button type="button" onClick={() => void sendReply()} disabled={!selectedLead || !reply.trim() || busyInbox !== null} className="rounded-full bg-white text-black hover:bg-zinc-200">
                <Send className="size-4" />
                {busyInbox === 'send' ? 'Sending...' : 'Send reply'}
              </Button>
              <Button type="button" variant="outline" onClick={() => void createInboxTask()} disabled={!selectedLead || busyInbox !== null} className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                <ClipboardList className="size-4" />
                {busyInbox === 'task' ? 'Creating...' : 'Create task'}
              </Button>
              {selectedLead ? (
                <Button type="button" variant="outline" onClick={() => actions.selectLead(selectedLead.id)} className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                  Open deal
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
      </section>
    </div>
  )
}

function AccountsView({ workspace, actions }: { workspace: CrmWorkspacePayload; actions: WorkspaceAction }) {
  const accounts = useAccounts(workspace)
  const [query, setQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState<'all' | CrmLeadDto['risk']>('all')
  const filteredAccounts = accounts.filter(account => {
    const matchesRisk = riskFilter === 'all' || account.risk === riskFilter
    const matchesQuery = `${account.companyName} ${account.primaryPersonName} ${account.owner} ${account.stage}`.toLowerCase().includes(query.toLowerCase())
    return matchesRisk && matchesQuery
  })

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Accounts" value={`${accounts.length}`} detail="Companies with open commercial motion." icon={Building2} />
        <StatCard label="Contacts" value={`${new Set(accounts.map(account => account.primaryPersonName)).size}`} detail="Primary buyer contacts on active deals." icon={MessageCircle} />
        <StatCard label="Weighted value" value={money(accounts.reduce((sum, account) => sum + account.weightedValue, 0))} detail="Forecast-weighted account value." icon={Gauge} />
        <StatCard label="Open work" value={`${accounts.reduce((sum, account) => sum + account.openTasks, 0)}`} detail="Tasks connected to active accounts." icon={ClipboardList} />
      </div>

      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Accounts and contacts</CardTitle>
            <CardDescription>HubSpot-style account coverage: who owns it, who matters, what is open, and when it moved.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search accounts..."
              className="h-10 w-56 rounded-full border-white/10 bg-black/20 text-zinc-100 placeholder:text-zinc-600"
            />
            <select
              value={riskFilter}
              onChange={event => setRiskFilter(event.target.value as 'all' | CrmLeadDto['risk'])}
              className="h-10 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none"
            >
              <option value="all">All risk</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="new">New</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-500">Account</TableHead>
                <TableHead className="text-zinc-500">Primary contact</TableHead>
                <TableHead className="text-zinc-500">Owner</TableHead>
                <TableHead className="text-zinc-500">Stage</TableHead>
                <TableHead className="text-zinc-500">Engagement</TableHead>
                <TableHead className="text-zinc-500">Weighted</TableHead>
                <TableHead className="text-zinc-500">Last touch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map(account => (
                <TableRow key={account.id} className="border-white/8 hover:bg-white/[0.04]">
                  <TableCell>
                    <button type="button" onClick={() => actions.selectLead(account.id)} className="flex items-center gap-3 text-left">
                      <DealAvatar value={account.companyName} />
                      <div>
                        <p className="font-medium text-white">{account.companyName}</p>
                        <p className="text-xs text-zinc-500">{channelLabel(account.channel)}</p>
                      </div>
                    </button>
                  </TableCell>
                  <TableCell className="text-zinc-300">{account.primaryPersonName}</TableCell>
                  <TableCell className="text-zinc-400">{account.owner}</TableCell>
                  <TableCell className="text-zinc-300">{account.stage}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{account.messages} msgs</Badge>
                      <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{account.openTasks} tasks</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-300">{money(account.weightedValue)}</TableCell>
                  <TableCell className="text-zinc-500">{daysAgo(account.latestAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  )
}

function TasksView({ workspace, actions }: { workspace: CrmWorkspacePayload; actions: WorkspaceAction }) {
  const [query, setQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [leadId, setLeadId] = useState(workspace.leads[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const leadByCompany = new Map(workspace.leads.map(lead => [lead.companyName, lead]))
  const sortedTasks = [...workspace.tasks].sort((a, b) => new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime())
  const filteredTasks = sortedTasks.filter(task => {
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
    const matchesQuery = `${task.title} ${task.description} ${task.companyName} ${task.personName}`.toLowerCase().includes(query.toLowerCase())
    return matchesPriority && matchesQuery
  })
  const overdue = sortedTasks.filter(task => task.dueAt && new Date(task.dueAt).getTime() < Date.now()).length
  const high = sortedTasks.filter(task => task.priority === 'high').length

  async function createQueueTask() {
    if (!title.trim()) return
    const lead = workspace.leads.find(candidate => candidate.id === leadId)
    setBusy(true)
    setNotice(null)
    try {
      await apiJson('/api/crm/tasks', {
        method: 'POST',
        body: JSON.stringify({
          leadId,
          title,
          description,
          priority: lead?.risk === 'hot' ? 'high' : 'medium',
          companyName: lead?.companyName,
          personName: lead?.primaryPersonName,
        }),
      })
      setTitle('')
      setDescription('')
      setNotice('Task created')
      await actions.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function completeTask(taskId: string) {
    setCompletingTaskId(taskId)
    setNotice(null)
    try {
      await apiJson(`/api/crm/tasks/${taskId}`, { method: 'DELETE' })
      setNotice('Task completed')
      await actions.refresh()
    } finally {
      setCompletingTaskId(null)
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Open tasks" value={`${sortedTasks.length}`} detail="All current rep work items." icon={ClipboardList} />
          <StatCard label="High priority" value={`${high}`} detail="Work tied to hot or late-stage deals." icon={ShieldAlert} />
          <StatCard label="Due now" value={`${overdue}`} detail="Past-due or due-today follow-up pressure." icon={CalendarClock} />
        </div>

        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Rep work queue</CardTitle>
              <CardDescription>Every task stays connected to the account and the deal record.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search tasks..."
                className="h-10 w-56 rounded-full border-white/10 bg-black/20 text-zinc-100 placeholder:text-zinc-600"
              />
              <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)} className="h-10 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none">
                <option value="all">All priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {filteredTasks.map(task => {
              const lead = task.companyName ? leadByCompany.get(task.companyName) : undefined
              return (
                <div
                  key={task.id}
                  className={cn(pillInsetClass, 'grid gap-3 p-4 transition hover:bg-white/[0.04] md:grid-cols-[minmax(0,1fr)_auto] md:items-center')}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{task.title}</p>
                      <Badge variant="outline" className={task.priority === 'high' ? 'border-red-400/25 bg-red-400/10 text-red-100' : 'border-white/10 bg-white/[0.04] text-zinc-300'}>
                        {task.priority ?? 'medium'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{task.companyName ?? 'No account'} · {task.personName ?? 'No contact'}</p>
                    <p className="mt-3 text-sm leading-6 text-zinc-300">{task.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <div className="min-w-24 text-right text-xs text-zinc-500">
                      <p>Due {shortDate(task.dueAt)}</p>
                      {lead ? <p className="mt-2 text-zinc-300">{money(Number(lead.valueAmount ?? 0))}</p> : null}
                    </div>
                    {lead ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => actions.selectLead(lead.id)} className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                        Open deal
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" onClick={() => void completeTask(task.id)} disabled={completingTaskId === task.id} className="rounded-full bg-white text-black hover:bg-zinc-200">
                      <CheckCircle2 className="size-3.5" />
                      {completingTaskId === task.id ? 'Completing...' : 'Complete'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <Card className={cn(pillSurfaceClass, 'h-fit bg-[#101316]')}>
        <CardHeader>
          <CardTitle>Create task</CardTitle>
          <CardDescription>Add a next action against an active deal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {notice ? <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">{notice}</div> : null}
          <select value={leadId} onChange={event => setLeadId(event.target.value)} className="h-10 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none">
            {workspace.leads.map(lead => <option key={lead.id} value={lead.id}>{lead.companyName}</option>)}
          </select>
          <Input value={title} onChange={event => setTitle(event.target.value)} placeholder="Task title" className="rounded-full border-white/10 bg-black/20 text-white placeholder:text-zinc-600" />
          <Textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Task detail..." className="min-h-28 rounded-[22px] border-white/10 bg-black/20 text-white placeholder:text-zinc-600" />
          <Button type="button" onClick={() => void createQueueTask()} disabled={busy || !title.trim()} className="rounded-full bg-white text-black hover:bg-zinc-200">
            <Plus className="size-4" />
            {busy ? 'Creating...' : 'Create task'}
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}

function ActivityComposer({
  workspace,
  actions,
  defaultLeadId,
  compact = false,
}: {
  workspace: CrmWorkspacePayload
  actions: WorkspaceAction
  defaultLeadId?: string
  compact?: boolean
}) {
  const [leadId, setLeadId] = useState(defaultLeadId ?? workspace.leads[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState('meeting')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (defaultLeadId) setLeadId(defaultLeadId)
  }, [defaultLeadId])

  async function logActivity() {
    if (!title.trim()) return
    const lead = workspace.leads.find(candidate => candidate.id === leadId)
    setBusy(true)
    setNotice(null)
    try {
      await apiJson('/api/crm/activities', {
        method: 'POST',
        body: JSON.stringify({
          leadId,
          title,
          body,
          type,
          companyName: lead?.companyName,
          personName: lead?.primaryPersonName,
        }),
      })
      setTitle('')
      setBody('')
      setNotice('Activity logged')
      await actions.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={cn(pillSurfaceClass, 'bg-[#101316]', compact && 'border-white/8')}>
      <CardHeader>
        <CardTitle>{compact ? 'Log activity' : 'Log meeting'}</CardTitle>
        <CardDescription>{compact ? 'Capture the latest customer signal.' : 'Add call notes, objections, decision criteria, and next steps.'}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {notice ? <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">{notice}</div> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <select value={leadId} onChange={event => setLeadId(event.target.value)} className="h-10 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none">
            {workspace.leads.map(lead => <option key={lead.id} value={lead.id}>{lead.companyName}</option>)}
          </select>
          <select value={type} onChange={event => setType(event.target.value)} className="h-10 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none">
            <option value="meeting">Meeting</option>
            <option value="call">Call</option>
            <option value="intent">Decision signal</option>
            <option value="risk">Risk</option>
            <option value="note">Note</option>
          </select>
        </div>
        <Input value={title} onChange={event => setTitle(event.target.value)} placeholder="Meeting title or signal" className="rounded-full border-white/10 bg-black/20 text-white placeholder:text-zinc-600" />
        <Textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Notes, objections, competitor mentions, next steps..." className="min-h-28 rounded-[22px] border-white/10 bg-black/20 text-white placeholder:text-zinc-600" />
        <Button type="button" onClick={() => void logActivity()} disabled={busy || !title.trim()} className="w-fit rounded-full bg-white text-black hover:bg-zinc-200">
          <Plus className="size-4" />
          {busy ? 'Logging...' : 'Log activity'}
        </Button>
      </CardContent>
    </Card>
  )
}

function MeetingsView({ workspace, actions }: { workspace: CrmWorkspacePayload; actions: WorkspaceAction }) {
  const meetingActivities = workspace.activities.filter(isMeetingActivity)
  const meetingMessages = workspace.messages.meetings
  const riskSignals = meetingActivities.filter(activity => signalTone(`${activity.title} ${activity.body}`) === 'border-red-400/25 bg-red-400/10 text-red-100')
  const decisionSignals = meetingActivities.filter(activity => `${activity.title} ${activity.body}`.toLowerCase().includes('decision'))
  const objectionSignals = meetingActivities.filter(activity => `${activity.title} ${activity.body}`.toLowerCase().match(/objection|concern|security|legal|competitor|gong|price|budget/))
  const evidenceLeads = meetingActivities
    .map(activity => activityLead(workspace, activity))
    .filter((lead): lead is CrmLeadDto => Boolean(lead))
  const evidenceValue = evidenceLeads.reduce((sum, lead) => sum + Number(lead.valueAmount ?? 0), 0)
  const weakEvidenceDeals = workspace.leads
    .filter(lead => !meetingActivities.some(activity => activity.companyName === lead.companyName || activity.personName === lead.primaryPersonName))
    .sort((a, b) => Number(b.valueAmount ?? 0) - Number(a.valueAmount ?? 0))
    .slice(0, 4)

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Meetings" value={`${meetingActivities.length}`} detail="Logged calls, demos, and customer conversations." icon={CalendarClock} />
          <StatCard label="Transcript notes" value={`${meetingMessages.length}`} detail="Meeting-channel messages feeding deal context." icon={MessageCircle} />
          <StatCard label="Risk signals" value={`${riskSignals.length}`} detail="Competitor, budget, legal, or security mentions." icon={ShieldAlert} />
          <StatCard label="Decision signals" value={`${decisionSignals.length}`} detail="Owner, deadline, or close-window signals." icon={CheckCircle2} />
        </div>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle>Call evidence cockpit</CardTitle>
                  <CardDescription>How much pipeline is backed by call evidence, and where the story is still thin.</CardDescription>
                </div>
                <Button asChild className="rounded-full bg-white text-black hover:bg-zinc-200">
                  <Link href="/call-review">
                    <PhoneCall className="size-4" />
                    Review transcript
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className={cn(pillInsetClass, 'p-4')}>
                <p className="text-xs text-zinc-500">Evidence-backed value</p>
                <p className="mt-2 text-2xl font-semibold text-white">{money(evidenceValue)}</p>
                <p className="mt-3 text-xs leading-5 text-zinc-500">{new Set(evidenceLeads.map(lead => lead.id)).size} deals have call context.</p>
              </div>
              <div className={cn(pillInsetClass, 'p-4')}>
                <p className="text-xs text-zinc-500">Objection load</p>
                <p className="mt-2 text-2xl font-semibold text-white">{objectionSignals.length}</p>
                <p className="mt-3 text-xs leading-5 text-zinc-500">Security, legal, price, competitor, or budget pressure found in notes.</p>
              </div>
              <div className={cn(pillInsetClass, 'p-4')}>
                <p className="text-xs text-zinc-500">Coverage gaps</p>
                <p className="mt-2 text-2xl font-semibold text-white">{weakEvidenceDeals.length}</p>
                <p className="mt-3 text-xs leading-5 text-zinc-500">High-value deals without meeting evidence in this workspace.</p>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
            <CardHeader>
              <CardTitle>Evidence gaps</CardTitle>
              <CardDescription>Deals that need a call note, transcript, or decision record.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {weakEvidenceDeals.map(lead => (
                <button key={lead.id} type="button" onClick={() => actions.selectLead(lead.id)} className="grid gap-2 rounded-[18px] border border-white/10 bg-black/20 p-3 text-left transition hover:bg-white/[0.06]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-white">{lead.companyName}</p>
                    <span className="text-xs text-zinc-400">{money(Number(lead.valueAmount ?? 0))}</span>
                  </div>
                  <p className="truncate text-xs text-zinc-500">{lead.stageName} · {lead.nextStep}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Call intelligence feed</CardTitle>
            <CardDescription>Meeting notes ranked as revenue evidence, tied directly back to the deal record.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {meetingActivities.map(activity => {
              const lead = activityLead(workspace, activity)
              const tone = signalTone(`${activity.title} ${activity.body}`)
              return (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => lead ? actions.selectLead(lead.id) : undefined}
                  className={cn(pillInsetClass, 'grid gap-3 p-4 text-left transition hover:bg-white/[0.07] md:grid-cols-[minmax(0,1fr)_auto] md:items-start')}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={tone}>{activity.type ?? 'meeting'}</Badge>
                      <p className="font-medium text-white">{activity.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{activity.companyName ?? 'No account'} · {activity.personName ?? 'No contact'}</p>
                    <p className="mt-3 text-sm leading-6 text-zinc-300">{activity.body}</p>
                    {lead?.nextStep ? <p className="mt-3 text-xs text-zinc-500">Next: {lead.nextStep}</p> : null}
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    <p>{shortDate(activity.occurredAt)}</p>
                    {lead ? <p className="mt-2 text-zinc-300">{money(Number(lead.valueAmount ?? 0))}</p> : null}
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid content-start gap-4">
        <ActivityComposer workspace={workspace} actions={actions} />
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Meeting-channel transcript</CardTitle>
            <CardDescription>Recent meeting-linked conversation snippets.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {meetingMessages.slice(-5).reverse().map(message => {
              const lead = workspace.leads.find(candidate => candidate.id === message.leadId)
              return (
                <button key={message.id} type="button" onClick={() => lead ? actions.selectLead(lead.id) : undefined} className={cn(pillInsetClass, 'p-4 text-left transition hover:bg-white/[0.07]')}>
                  <p className="text-sm font-semibold text-white">{lead?.companyName ?? 'Meeting'}</p>
                  <p className="mt-1 text-xs text-zinc-500">{message.from === 'rep' ? 'Rep' : 'Buyer'} · {shortDate(message.sentAt)}</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{message.text}</p>
                </button>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function TeamView({ workspace, actions }: { workspace: CrmWorkspacePayload; actions: WorkspaceAction }) {
  const owners = useOwners(workspace)
  const totalPipeline = owners.reduce((sum, owner) => sum + owner.pipeline, 0)
  const totalWeighted = owners.reduce((sum, owner) => sum + owner.weighted, 0)
  const totalTasks = owners.reduce((sum, owner) => sum + owner.tasks, 0)
  const totalAtRisk = owners.reduce((sum, owner) => sum + owner.atRisk, 0)

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Owners" value={`${owners.length}`} detail="Sellers with active pipeline or work." icon={Users} />
        <StatCard label="Pipeline" value={money(totalPipeline)} detail="Total owner-assigned open value." icon={TrendingUp} />
        <StatCard label="Weighted" value={money(totalWeighted)} detail="Forecast-weighted owner rollup." icon={Gauge} />
        <StatCard label="Open work" value={`${totalTasks}`} detail={`${totalAtRisk} risky owner-owned deals.`} icon={ClipboardList} />
      </div>

      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardHeader>
          <CardTitle>Owner scorecards</CardTitle>
          <CardDescription>Manager view for pipeline, forecast, risk, activity, and follow-up load.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {owners.map(owner => (
            <div key={owner.owner} className={cn(pillInsetClass, 'grid gap-4 p-4 xl:grid-cols-[280px_minmax(0,1fr)]')}>
              <div>
                <div className="flex items-center gap-3">
                  <DealAvatar value={owner.owner} />
                  <div>
                    <p className="font-semibold text-white">{owner.owner}</p>
                    <p className="text-xs text-zinc-500">{owner.deals.length} deals · {owner.tasks} tasks · {owner.activities} activities</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-[18px] border border-white/10 bg-black/20 p-3">
                    <p className="text-zinc-500">Pipeline</p>
                    <p className="mt-1 font-semibold text-white">{money(owner.pipeline)}</p>
                  </div>
                  <div className="rounded-[18px] border border-white/10 bg-black/20 p-3">
                    <p className="text-zinc-500">Weighted</p>
                    <p className="mt-1 font-semibold text-white">{money(owner.weighted)}</p>
                  </div>
                  <div className="rounded-[18px] border border-white/10 bg-black/20 p-3">
                    <p className="text-zinc-500">At risk</p>
                    <p className="mt-1 font-semibold text-white">{owner.atRisk}</p>
                  </div>
                  <div className="rounded-[18px] border border-white/10 bg-black/20 p-3">
                    <p className="text-zinc-500">Won</p>
                    <p className="mt-1 font-semibold text-white">{money(owner.won)}</p>
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="grid gap-2">
                  {owner.deals.slice(0, 4).map(lead => (
                    <button key={lead.id} type="button" onClick={() => actions.selectLead(lead.id)} className="grid gap-2 rounded-[18px] border border-white/10 bg-black/20 p-3 text-left transition hover:bg-white/[0.06] md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{lead.companyName}</p>
                        <p className="mt-1 truncate text-xs text-zinc-500">{lead.stageName} · {lead.nextStep}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={riskTone(lead.risk)}>{lead.risk}</Badge>
                        <span className="text-sm font-semibold text-zinc-200">{money(Number(lead.valueAmount ?? 0))}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}

function ForecastView({ workspace, actions }: { workspace: CrmWorkspacePayload; actions: WorkspaceAction }) {
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null)
  const [forecastNotice, setForecastNotice] = useState<string | null>(null)
  const metrics = useWorkspaceMetrics(workspace)
  const maxValue = Math.max(...metrics.stages.map(stage => stage.value), 1)
  const commit = workspace.leads.filter(lead => Number(lead.probability ?? 0) >= 70)
  const bestCase = workspace.leads.filter(lead => Number(lead.probability ?? 0) >= 45 && Number(lead.probability ?? 0) < 70)
  const pipeline = workspace.leads.filter(lead => Number(lead.probability ?? 0) < 45)
  const bandValue = (leads: CrmLeadDto[]) => leads.reduce((sum, lead) => sum + Number(lead.valueAmount ?? 0), 0)
  const activeLeads = workspace.leads.filter(lead => lead.status !== 'won' && lead.status !== 'lost')
  const commitValue = bandValue(commit)
  const bestCaseValue = bandValue(bestCase)
  const pipelineValue = bandValue(pipeline)
  const commitTarget = Math.round(metrics.total * 0.6)
  const commitGap = Math.max(0, commitTarget - commitValue)
  const missingCloseDates = activeLeads.filter(lead => !lead.expectedCloseDate)
  const datedRisk = activeLeads.filter(lead => {
    if (!lead.expectedCloseDate) return false
    const daysToClose = Math.ceil((new Date(lead.expectedCloseDate).getTime() - Date.now()) / 86_400_000)
    return daysToClose <= 14 && (lead.risk === 'hot' || Number(lead.probability ?? 0) < 60)
  })
  const slippageCandidates = [...activeLeads]
    .filter(lead => lead.risk === 'hot' || Number(lead.probability ?? 0) < 45 || !lead.expectedCloseDate)
    .sort((a, b) => Number(b.valueAmount ?? 0) - Number(a.valueAmount ?? 0))
    .slice(0, 4)
  const ownerForecastRows = useOwners(workspace).slice(0, 4)

  async function patchForecast(lead: CrmLeadDto, data: Partial<{ stage: string; status: string; probability: number; risk: CrmLeadDto['risk'] }>) {
    setBusyLeadId(lead.id)
    setForecastNotice(null)
    try {
      await apiJson(`/api/crm/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          companyName: lead.companyName,
          primaryPersonName: lead.primaryPersonName,
          owner: lead.owner,
          valueAmount: Number(lead.valueAmount ?? 0),
          channel: lead.channel,
          nextStep: lead.nextStep,
          description: lead.description,
          ...data,
        }),
      })
      setForecastNotice(`${lead.companyName} moved to ${data.stage ?? 'updated forecast'}`)
      await actions.refresh()
    } finally {
      setBusyLeadId(null)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total pipeline" value={money(metrics.total)} detail="All open value." icon={TrendingUp} />
        <StatCard label="Weighted" value={money(Math.round(metrics.weighted))} detail="Probability adjusted." icon={Gauge} />
        <StatCard label="Open tasks" value={`${metrics.tasks}`} detail="Execution work tied to deals." icon={CheckCircle2} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Commit" value={money(commitValue)} detail={`${commit.length} deals at 70%+ probability.`} icon={CheckCircle2} />
        <StatCard label="Best case" value={money(bestCaseValue)} detail={`${bestCase.length} deals that can still land.`} icon={ShieldAlert} />
        <StatCard label="Pipeline" value={money(pipelineValue)} detail={`${pipeline.length} early or weak-intent deals.`} icon={Gauge} />
      </div>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Forecast confidence</CardTitle>
                <CardDescription>Commit coverage, close-date hygiene, and slippage risk before the manager call.</CardDescription>
              </div>
              <Badge variant="outline" className={commitGap ? 'border-yellow-300/20 bg-yellow-300/10 text-yellow-100' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'}>
                {commitGap ? `${money(commitGap)} commit gap` : 'Commit covered'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className={cn(pillInsetClass, 'p-4')}>
              <p className="text-xs text-zinc-500">Commit coverage</p>
              <p className="mt-2 text-2xl font-semibold text-white">{metrics.total ? Math.round((commitValue / metrics.total) * 100) : 0}%</p>
              <p className="mt-3 text-xs leading-5 text-zinc-500">{money(commitValue)} committed against a {money(commitTarget)} management target.</p>
            </div>
            <div className={cn(pillInsetClass, 'p-4')}>
              <p className="text-xs text-zinc-500">Close-date risk</p>
              <p className="mt-2 text-2xl font-semibold text-white">{datedRisk.length}</p>
              <p className="mt-3 text-xs leading-5 text-zinc-500">Closing inside 14 days with low confidence or hot risk.</p>
            </div>
            <div className={cn(pillInsetClass, 'p-4')}>
              <p className="text-xs text-zinc-500">Missing close dates</p>
              <p className="mt-2 text-2xl font-semibold text-white">{missingCloseDates.length}</p>
              <p className="mt-3 text-xs leading-5 text-zinc-500">Rows that need hygiene before a reliable readout.</p>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Slippage watch</CardTitle>
            <CardDescription>Biggest open deals that can distort the number.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {slippageCandidates.map(lead => (
              <button key={lead.id} type="button" onClick={() => actions.selectLead(lead.id)} className="grid gap-2 rounded-[18px] border border-white/10 bg-black/20 p-3 text-left transition hover:bg-white/[0.06]">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-white">{lead.companyName}</p>
                  <Badge variant="outline" className={riskTone(lead.risk)}>{lead.risk}</Badge>
                </div>
                <p className="truncate text-xs text-zinc-500">{shortDate(lead.expectedCloseDate)} · {lead.probability}% · {lead.nextStep}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </section>
      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardHeader>
          <CardTitle>Owner forecast rollup</CardTitle>
          <CardDescription>Who owns the number, how much is weighted, and where risk sits.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ownerForecastRows.map(owner => (
            <button key={owner.owner} type="button" onClick={() => owner.deals[0] ? actions.selectLead(owner.deals[0].id) : undefined} className={cn(pillInsetClass, 'p-4 text-left transition hover:bg-white/[0.07]')}>
              <div className="flex items-center gap-3">
                <DealAvatar value={owner.owner} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{owner.owner}</p>
                  <p className="text-xs text-zinc-500">{owner.deals.length} deals · {owner.atRisk} risky</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-[16px] border border-white/8 bg-black/20 p-3">
                  <p className="text-zinc-500">Pipeline</p>
                  <p className="mt-1 font-semibold text-white">{money(owner.pipeline)}</p>
                </div>
                <div className="rounded-[16px] border border-white/8 bg-black/20 p-3">
                  <p className="text-zinc-500">Weighted</p>
                  <p className="mt-1 font-semibold text-white">{money(owner.weighted)}</p>
                </div>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
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
      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Forecast inspection</CardTitle>
              <CardDescription>Deal-level forecast rows with manager controls for commit, upside, pipeline, won, and lost.</CardDescription>
            </div>
            {forecastNotice ? <Badge variant="outline" className="rounded-full border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-emerald-100">{forecastNotice}</Badge> : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-zinc-500">Deal</TableHead>
                  <TableHead className="text-zinc-500">Category</TableHead>
                  <TableHead className="text-zinc-500">Value</TableHead>
                  <TableHead className="text-zinc-500">Weighted</TableHead>
                  <TableHead className="text-zinc-500">Close</TableHead>
                  <TableHead className="text-zinc-500">Next action</TableHead>
                  <TableHead className="min-w-[300px] text-zinc-500">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...workspace.leads].sort((a, b) => Number(b.valueAmount ?? 0) - Number(a.valueAmount ?? 0)).map(lead => {
                  const probability = Number(lead.probability ?? 0)
                  const category = probability >= 70 ? 'Commit' : probability >= 45 ? 'Best case' : 'Pipeline'
                  const isClosed = lead.status === 'won' || lead.status === 'lost'
                  return (
                    <TableRow key={lead.id} className="border-white/8 hover:bg-white/[0.04]">
                      <TableCell>
                        <button type="button" onClick={() => actions.selectLead(lead.id)} className="flex min-w-64 items-center gap-3 text-left">
                          <DealAvatar value={lead.companyName} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">{lead.companyName}</p>
                            <p className="truncate text-xs text-zinc-500">{lead.stageName}</p>
                          </div>
                        </button>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-300">{lead.status === 'won' ? 'Won' : lead.status === 'lost' ? 'Lost' : category}</Badge></TableCell>
                      <TableCell className="text-zinc-300">{money(Number(lead.valueAmount ?? 0))}</TableCell>
                      <TableCell className="text-zinc-300">{money(Math.round((Number(lead.valueAmount ?? 0) * probability) / 100))}</TableCell>
                      <TableCell className="text-zinc-500">{shortDate(lead.expectedCloseDate)}</TableCell>
                      <TableCell className="max-w-sm truncate text-zinc-400">{lead.nextStep}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" disabled={busyLeadId === lead.id || (category === 'Commit' && !isClosed)} onClick={() => void patchForecast(lead, { stage: 'Commit', status: 'qualified', probability: 80, risk: lead.risk === 'hot' ? 'hot' : 'warm' })} className="h-8 rounded-full border-emerald-300/20 bg-emerald-300/10 px-3 text-xs text-emerald-100 hover:bg-emerald-300/15">
                            Commit
                          </Button>
                          <Button type="button" size="sm" variant="outline" disabled={busyLeadId === lead.id || (category === 'Best case' && !isClosed)} onClick={() => void patchForecast(lead, { stage: 'Proposal', status: 'open', probability: 60, risk: 'warm' })} className="h-8 rounded-full border-blue-300/20 bg-blue-300/10 px-3 text-xs text-blue-100 hover:bg-blue-300/15">
                            Best case
                          </Button>
                          <Button type="button" size="sm" variant="outline" disabled={busyLeadId === lead.id || (category === 'Pipeline' && !isClosed)} onClick={() => void patchForecast(lead, { stage: 'Discovery', status: 'open', probability: 35, risk: 'new' })} className="h-8 rounded-full border-white/10 bg-white/[0.04] px-3 text-xs text-zinc-200 hover:bg-white/[0.08]">
                            Pipeline
                          </Button>
                          <Button type="button" size="sm" disabled={busyLeadId === lead.id || lead.status === 'won'} onClick={() => void patchForecast(lead, { stage: 'Closed Won', status: 'won', probability: 100, risk: 'hot' })} className="h-8 rounded-full bg-white px-3 text-xs text-black hover:bg-zinc-200">
                            Won
                          </Button>
                          <Button type="button" size="sm" variant="outline" disabled={busyLeadId === lead.id || lead.status === 'lost'} onClick={() => void patchForecast(lead, { stage: 'Closed Lost', status: 'lost', probability: 0, risk: 'new' })} className="h-8 rounded-full border-red-300/20 bg-red-300/10 px-3 text-xs text-red-100 hover:bg-red-300/15">
                            Lost
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReportsView({ workspace, actions }: { workspace: CrmWorkspacePayload; actions: WorkspaceAction }) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    setNow(Date.now())
  }, [])
  const reports = useReports(workspace, now)
  const maxStage = Math.max(...reports.stageRows.map(row => row.pipeline), 1)
  const valueOf = (leads: CrmLeadDto[]) => leads.reduce((sum, lead) => sum + Number(lead.valueAmount ?? 0), 0)

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Pipeline coverage" value={money(reports.totalPipeline)} detail={`${reports.stageRows.length} active stages in management review.`} icon={TrendingUp} />
        <StatCard label="Weighted number" value={money(reports.weightedPipeline)} detail="Probability-adjusted revenue confidence." icon={Gauge} />
        <StatCard label="Risk concentration" value={money(valueOf(reports.riskyLeads))} detail={`${reports.riskyLeads.length} deals with low confidence or hot risk.`} icon={ShieldAlert} />
        <StatCard label="Activity coverage" value={`${reports.messages.length + workspace.activities.length}`} detail={`${workspace.tasks.length} open tasks tied to sales execution.`} icon={MessageCircle} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Funnel report</CardTitle>
            <CardDescription>Stage quality, conversion proxy, weighted value, and risk concentration.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {reports.stageRows.map(row => (
              <div key={row.stage} className={cn(pillInsetClass, 'p-4')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{row.stage}</p>
                    <p className="mt-1 text-xs text-zinc-500">{row.deals} deals · {row.avgProbability}% average probability · {row.risk} risky</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{money(row.pipeline)}</p>
                    <p className="mt-1 text-xs text-zinc-500">{money(row.weighted)} weighted</p>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.max(8, (row.pipeline / maxStage) * 100)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Forecast quality</CardTitle>
            <CardDescription>Manager-ready view of commit, upside, and pipeline hygiene.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              { label: 'Commit', leads: reports.commit, tone: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' },
              { label: 'Best case', leads: reports.bestCase, tone: 'border-yellow-300/20 bg-yellow-300/10 text-yellow-100' },
              { label: 'Pipeline', leads: reports.openPipeline, tone: 'border-blue-300/20 bg-blue-300/10 text-blue-100' },
              { label: 'Stale', leads: reports.staleLeads, tone: 'border-red-300/20 bg-red-300/10 text-red-100' },
            ].map(item => (
              <div key={item.label} className={cn(pillInsetClass, 'flex items-center justify-between gap-3 p-4')}>
                <div>
                  <Badge variant="outline" className={item.tone}>{item.label}</Badge>
                  <p className="mt-3 text-sm text-zinc-400">{item.leads.length} deals</p>
                </div>
                <p className="text-lg font-semibold text-white">{money(valueOf(item.leads))}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Channel performance</CardTitle>
            <CardDescription>Revenue channels only: email, LinkedIn, web chat, and meetings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-zinc-500">Channel</TableHead>
                  <TableHead className="text-zinc-500">Deals</TableHead>
                  <TableHead className="text-zinc-500">Messages</TableHead>
                  <TableHead className="text-zinc-500">Pipeline</TableHead>
                  <TableHead className="text-zinc-500">Weighted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.channelRows.map(row => (
                  <TableRow key={row.id} className="border-white/8 hover:bg-white/[0.04]">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={row.connected ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-zinc-500/20 bg-zinc-500/10 text-zinc-300'}>
                          {row.connected ? 'Live' : 'Pending'}
                        </Badge>
                        <span className="font-medium text-white">{row.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-300">{row.deals}</TableCell>
                    <TableCell className="text-zinc-300">{row.messages}</TableCell>
                    <TableCell className="text-zinc-300">{money(row.pipeline)}</TableCell>
                    <TableCell className="text-zinc-300">{money(row.weighted)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Coverage gaps</CardTitle>
            <CardDescription>Deals with the thinnest evidence, activity, and task coverage.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {reports.coverageRows.slice(0, 6).map(row => (
              <button key={row.lead.id} type="button" onClick={() => actions.selectLead(row.lead.id)} className={cn(pillInsetClass, 'grid gap-3 p-4 text-left transition hover:bg-white/[0.07] md:grid-cols-[minmax(0,1fr)_auto] md:items-center')}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{row.lead.companyName}</p>
                  <p className="mt-1 truncate text-xs text-zinc-500">{row.lead.nextStep}</p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{row.messages} msgs</Badge>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{row.activities} acts</Badge>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{row.tasks} tasks</Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function CoachView({ workspace, actions }: { workspace: CrmWorkspacePayload; actions: WorkspaceAction }) {
  const [busyCoachAction, setBusyCoachAction] = useState<string | null>(null)
  const [coachNotice, setCoachNotice] = useState<string | null>(null)
  const [draftLead, setDraftLead] = useState<CrmLeadDto | null>(null)
  const [draftText, setDraftText] = useState('')
  const rankedLeads = [...workspace.leads]
    .sort((a, b) => (
      Number(b.valueAmount ?? 0) * (100 - Number(b.probability ?? 0)) + Number(b.openTaskCount ?? 0) * 2500
    ) - (
      Number(a.valueAmount ?? 0) * (100 - Number(a.probability ?? 0)) + Number(a.openTaskCount ?? 0) * 2500
    ))
    .slice(0, 5)
  const relatedLeads = (item: RecoveryInsight) => {
    const matches = workspace.leads.filter(lead => lead.status !== 'won' && classifyRecoveryIntent(lead) === item.intentId)
    return (matches.length ? matches : rankedLeads).slice(0, Math.max(1, Math.min(item.count || 3, 4)))
  }
  const taskExists = (lead: CrmLeadDto, title: string) => workspace.tasks.some(task => (
    task.companyName === lead.companyName && (task.title ?? '').trim().toLowerCase() === title.trim().toLowerCase()
  ))
  const actionableLeads = (item: RecoveryInsight) => relatedLeads(item).filter(lead => !taskExists(lead, item.title))

  async function createRecommendationTasks(item: RecoveryInsight) {
    const targets = actionableLeads(item)
    if (!targets.length) {
      setCoachNotice('Those coaching tasks already exist')
      return
    }
    setBusyCoachAction(`tasks:${item.id}`)
    setCoachNotice(null)
    try {
      await Promise.all(targets.map(lead => apiJson('/api/crm/tasks', {
        method: 'POST',
        body: JSON.stringify({
          leadId: lead.id,
          title: item.title,
          description: `${item.body}\n\nNext step: ${lead.nextStep || 'Confirm the next milestone.'}`,
          priority: item.priority === 'high' ? 'high' : item.priority === 'medium' ? 'medium' : 'low',
          companyName: lead.companyName,
          personName: lead.primaryPersonName,
        }),
      })))
      await actions.refresh()
      setCoachNotice(`${targets.length} coaching task${targets.length === 1 ? '' : 's'} created`)
    } finally {
      setBusyCoachAction(null)
    }
  }

  async function draftFollowUp(lead: CrmLeadDto) {
    setBusyCoachAction(`draft:${lead.id}`)
    setCoachNotice(null)
    try {
      const payload = await apiJson<{ draft: string }>('/api/ai/draft', {
        method: 'POST',
        body: JSON.stringify({
          leadId: lead.id,
          channel: lead.channel,
          instruction: `Use the coaching context and focus on the next step: ${lead.nextStep}`,
        }),
      })
      setDraftLead(lead)
      setDraftText(payload.draft)
      setCoachNotice(`Draft ready for ${lead.companyName}`)
    } finally {
      setBusyCoachAction(null)
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardHeader>
          <CardTitle>Recommended actions</CardTitle>
          <CardDescription>AI belongs here: ranked work, evidence, and a clear reason to act.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {coachNotice ? <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">{coachNotice}</div> : null}
          {workspace.intelligence.recommendations.map(item => {
            const related = relatedLeads(item)
            const actionable = actionableLeads(item)
            return (
              <div key={item.id} className={cn(pillInsetClass, 'p-4')}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100">{item.priority}</Badge>
                    <h2 className="mt-3 text-base font-semibold text-white">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{item.body}</p>
                    <p className="mt-3 text-xs text-zinc-500">{related.map(lead => lead.companyName).join(' · ')}</p>
                  </div>
                  <p className="text-sm font-semibold text-white">{money(item.estimatedValue)}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => void createRecommendationTasks(item)} disabled={busyCoachAction === `tasks:${item.id}` || !actionable.length} className="rounded-full bg-white text-black hover:bg-zinc-200 disabled:bg-white/20 disabled:text-zinc-500">
                    <ClipboardList className="size-3.5" />
                    {busyCoachAction === `tasks:${item.id}` ? 'Creating...' : actionable.length ? `Create ${actionable.length} task${actionable.length === 1 ? '' : 's'}` : 'Tasks exist'}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => actions.selectLead(related[0].id)} disabled={!related[0]} className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                    Open top deal
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid content-start gap-4">
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Deal coaching queue</CardTitle>
            <CardDescription>Open a record, draft a reply, save notes, or create a task.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {rankedLeads.map(lead => (
              <div key={lead.id} className={cn(pillInsetClass, 'p-4')}>
                <button type="button" onClick={() => actions.selectLead(lead.id)} className="block w-full text-left">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{lead.companyName}</p>
                    <Badge variant="outline" className={riskTone(lead.risk)}>{lead.risk}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">{lead.nextStep}</p>
                  <p className="mt-3 text-xs text-zinc-400">{money(Number(lead.valueAmount ?? 0))} · {Number(lead.probability ?? 0)}% probability</p>
                </button>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void draftFollowUp(lead)} disabled={busyCoachAction === `draft:${lead.id}`} className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                    <Bot className="size-3.5" />
                    {busyCoachAction === `draft:${lead.id}` ? 'Drafting...' : 'Draft reply'}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => actions.selectLead(lead.id)} className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {draftLead ? (
          <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
            <CardHeader>
              <CardTitle>Draft follow-up</CardTitle>
              <CardDescription>{draftLead.companyName} · {channelLabel(draftLead.channel)}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Textarea value={draftText} onChange={event => setDraftText(event.target.value)} className="min-h-52 rounded-[24px] border-white/10 bg-black/20 text-sm leading-6 text-white" />
              <Button type="button" onClick={() => actions.selectLead(draftLead.id)} className="w-fit rounded-full bg-white text-black hover:bg-zinc-200">
                Open deal to send
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
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
  onArchived,
}: {
  workspace: CrmWorkspacePayload
  lead: CrmLeadDto | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh: () => Promise<void>
  onArchived: () => void
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
          status: activeForm.status,
          valueAmount: Number(activeForm.valueAmount),
          probability: Number(activeForm.probability),
          expectedCloseDate: activeForm.expectedCloseDate,
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

  async function completeTask(taskId: string) {
    setBusy(`complete:${taskId}`)
    setNotice(null)
    try {
      await apiJson(`/api/crm/tasks/${taskId}`, { method: 'DELETE' })
      await onRefresh()
      setNotice('Task completed')
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

  async function archiveDeal() {
    if (!window.confirm(`Archive ${activeLead.companyName}? This removes the deal and its linked CRM activity from the workspace.`)) return
    setBusy('archive')
    setNotice(null)
    try {
      await apiJson(`/api/crm/leads/${leadId}`, { method: 'DELETE' })
      await onRefresh()
      onArchived()
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
              <Button type="button" variant="outline" onClick={() => void archiveDeal()} disabled={busy === 'archive'} className="h-8 rounded-full border-red-300/20 bg-red-300/10 px-3 text-xs text-red-100 hover:bg-red-300/15">
                <Trash2 className="size-3.5" />
                {busy === 'archive' ? 'Archiving...' : 'Archive'}
              </Button>
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
                  <DetailField label="Status">
                    <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} className="h-9 rounded-full border border-white/10 bg-black/40 px-3 text-sm text-white outline-none">
                      <option value="open">Open</option>
                      <option value="qualified">Qualified</option>
                      <option value="discovery">Discovery</option>
                      <option value="qualification">Qualification</option>
                      <option value="won">Won</option>
                      <option value="lost">Lost</option>
                    </select>
                  </DetailField>
                  <DetailField label="Value">
                    <Input value={form.valueAmount} type="number" onChange={event => setForm({ ...form, valueAmount: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" />
                  </DetailField>
                  <DetailField label="Probability">
                    <Input value={form.probability} type="number" min={0} max={100} onChange={event => setForm({ ...form, probability: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" />
                  </DetailField>
                  <DetailField label="Close date">
                    <Input value={form.expectedCloseDate} type="date" onChange={event => setForm({ ...form, expectedCloseDate: event.target.value })} className="rounded-full border-white/10 bg-black/20 text-white" />
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
              <ActivityComposer workspace={workspace} actions={{ selectLead: () => undefined, refresh: onRefresh }} defaultLeadId={leadId} compact />
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
                      <div key={task.id} className={cn(pillInsetClass, 'flex flex-wrap items-start justify-between gap-3 p-4')}>
                        <div>
                          <p className="text-sm font-semibold text-white">{task.title}</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">{task.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{shortDate(task.dueAt)}</Badge>
                          <Button type="button" size="sm" onClick={() => void completeTask(task.id)} disabled={busy === `complete:${task.id}`} className="rounded-full bg-white text-black hover:bg-zinc-200">
                            <CheckCircle2 className="size-3.5" />
                            {busy === `complete:${task.id}` ? 'Completing...' : 'Complete'}
                          </Button>
                        </div>
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
      {view === 'accounts' ? <AccountsView workspace={workspace} actions={actions} /> : null}
      {view === 'tasks' ? <TasksView workspace={workspace} actions={actions} /> : null}
      {view === 'meetings' ? <MeetingsView workspace={workspace} actions={actions} /> : null}
      {view === 'team' ? <TeamView workspace={workspace} actions={actions} /> : null}
      {view === 'forecast' ? <ForecastView workspace={workspace} actions={actions} /> : null}
      {view === 'reports' ? <ReportsView workspace={workspace} actions={actions} /> : null}
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
        onArchived={() => setSelectedLeadId(null)}
      />
    </div>
  )
}
