'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Gauge,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  PlugZap,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react'

import type { ChannelId, CrmLeadDto, CrmMessageDto, CrmWorkspacePayload } from '@/lib/sme-crm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { pillInsetClass, pillSurfaceClass } from '@/components/sme/halvex-system'
import { cn } from '@/lib/utils'

type WorkspaceViewName = 'dashboard' | 'inbox' | 'deals' | 'forecast' | 'coach' | 'channels'

const CHANNEL_ICONS: Record<ChannelId, typeof Mail> = {
  mail: Mail,
  instagram: Instagram,
  linkedin: Linkedin,
  webchat: MessageCircle,
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
  return channel === 'mail' ? 'Email' : channel === 'webchat' ? 'Web chat' : channel[0].toUpperCase() + channel.slice(1)
}

async function loadWorkspace() {
  const response = await fetch('/api/crm/workspace', { headers: { Accept: 'application/json' } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? `Workspace request failed: ${response.status}`)
  return payload as CrmWorkspacePayload
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

function DashboardView({ workspace }: { workspace: CrmWorkspacePayload }) {
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
              <Link key={lead.id} href="/deals" className={cn(pillInsetClass, 'grid gap-3 p-4 transition hover:bg-white/[0.07] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center')}>
                <DealAvatar value={lead.companyName} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{lead.companyName}</p>
                  <p className="mt-1 truncate text-xs text-zinc-500">{lead.nextStep}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={riskTone(lead.risk)}>{lead.risk}</Badge>
                  <span className="text-sm font-medium text-white">{money(Number(lead.valueAmount ?? 0))}</span>
                </div>
              </Link>
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
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function DealsView({ workspace }: { workspace: CrmWorkspacePayload }) {
  return (
    <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
      <CardHeader>
        <CardTitle>Deal table</CardTitle>
        <CardDescription>Built for scanning and repeated use, not a decorative card grid.</CardDescription>
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
            {workspace.leads.map(lead => (
              <TableRow key={lead.id} className="border-white/8 hover:bg-white/[0.04]">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <DealAvatar value={lead.companyName} />
                    <div>
                      <p className="font-medium text-white">{lead.companyName}</p>
                      <p className="text-xs text-zinc-500">{lead.primaryPersonName}</p>
                    </div>
                  </div>
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
                <TableCell className="max-w-sm truncate text-zinc-400">{lead.nextStep}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function InboxView({ workspace }: { workspace: CrmWorkspacePayload }) {
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
              <div key={message.id} className={cn(pillInsetClass, 'grid gap-3 p-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start')}>
                <span className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-zinc-300"><Icon className="size-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{lead?.companyName ?? 'Unknown account'}</p>
                  <p className="mt-1 text-xs text-zinc-500">{channelLabel(message.channel)} · {message.from === 'rep' ? 'You' : message.from}</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{message.text}</p>
                </div>
                <span className="text-xs text-zinc-500">{shortDate(message.sentAt)}</span>
              </div>
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

function CoachView({ workspace }: { workspace: CrmWorkspacePayload }) {
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
          <CardTitle>Coaching signals</CardTitle>
          <CardDescription>What the system is watching.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {workspace.intelligence.intents.slice(0, 5).map(intent => (
            <div key={intent.id} className={cn(pillInsetClass, 'p-4')}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{intent.label}</p>
                <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">{intent.count}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">{intent.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}

function ChannelsView({ workspace }: { workspace: CrmWorkspacePayload }) {
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
              <Button variant="outline" className="mt-5 w-full rounded-full border-white/10 bg-white/[0.04] text-zinc-100" disabled>
                {channel.connected ? 'Manage connection' : 'Connect soon'}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}

export default function WorkspaceView({ view }: { view: WorkspaceViewName }) {
  const { workspace, loading, error, refresh } = useWorkspace()

  if (loading) return <WorkspaceSkeleton />
  if (error || !workspace) return <WorkspaceError message={error ?? 'No workspace payload returned.'} onRetry={() => void refresh()} />

  return (
    <div className="grid gap-4 text-zinc-100">
      <PageHeader view={view} />
      {view === 'dashboard' ? <DashboardView workspace={workspace} /> : null}
      {view === 'inbox' ? <InboxView workspace={workspace} /> : null}
      {view === 'deals' ? <DealsView workspace={workspace} /> : null}
      {view === 'forecast' ? <ForecastView workspace={workspace} /> : null}
      {view === 'coach' ? <CoachView workspace={workspace} /> : null}
      {view === 'channels' ? <ChannelsView workspace={workspace} /> : null}
    </div>
  )
}
