'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bot,
  CheckCircle2,
  CreditCard,
  Database,
  Download,
  FileJson,
  Gauge,
  LockKeyhole,
  PlugZap,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react'

import type { AuditEventDto } from '@/lib/audit'
import type { CrmWorkspacePayload } from '@/lib/sme-crm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { pillInsetClass, pillSurfaceClass } from '@/components/sme/halvex-system'
import { cn } from '@/lib/utils'

type AuditPayload = {
  events: AuditEventDto[]
}

async function fetchJson<T>(path: string) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? `Request failed: ${response.status}`)
  return payload as T
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function money(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)
}

function auditLabel(type: string) {
  return type
    .replace(/^crm\./, '')
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
}

function metadataSummary(metadata: Record<string, unknown>) {
  const company = typeof metadata.companyName === 'string' ? metadata.companyName : null
  const title = typeof metadata.title === 'string' ? metadata.title : null
  const channel = typeof metadata.channel === 'string' ? metadata.channel : null
  const stage = typeof metadata.stage === 'string' ? metadata.stage : null
  const value = typeof metadata.valueAmount === 'number' ? `GBP${metadata.valueAmount.toLocaleString('en-GB')}` : null

  return [company, title, channel, stage, value].filter(Boolean).join(' · ') || 'Workspace event'
}

function eventTone(type: string) {
  if (type.includes('deleted') || type.includes('downgraded')) return 'border-red-300/20 bg-red-300/10 text-red-100'
  if (type.includes('automation') || type.includes('ai')) return 'border-blue-300/20 bg-blue-300/10 text-blue-100'
  if (type.includes('created') || type.includes('upgraded')) return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
  return 'border-white/10 bg-white/[0.04] text-zinc-300'
}

export default function WorkspaceSettings() {
  const [workspace, setWorkspace] = useState<CrmWorkspacePayload | null>(null)
  const [events, setEvents] = useState<AuditEventDto[]>([])
  const [auditFilter, setAuditFilter] = useState<'all' | 'data' | 'automation' | 'billing' | 'security'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [workspacePayload, auditPayload] = await Promise.all([
        fetchJson<CrmWorkspacePayload>('/api/crm/workspace'),
        fetchJson<AuditPayload>('/api/crm/audit'),
      ])
      setWorkspace(workspacePayload)
      setEvents(auditPayload.events)
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const metrics = useMemo(() => {
    const leads = workspace?.leads ?? []
    const messages = workspace ? Object.values(workspace.messages).flat() : []
    const connected = workspace?.channels.filter(channel => channel.connected).length ?? 0
    const pipeline = leads.reduce((sum, lead) => sum + Number(lead.valueAmount ?? 0), 0)
    const noNextStep = leads.filter(lead => !lead.nextStep?.trim()).length
    const noCloseDate = leads.filter(lead => !lead.expectedCloseDate).length
    const stale = leads.filter(lead => {
      if (lead.status === 'won' || lead.status === 'lost') return false
      if (!lead.latestActivityAt) return true
      return Date.now() - new Date(lead.latestActivityAt).getTime() > 14 * 86_400_000
    }).length
    const risky = leads.filter(lead => lead.risk === 'hot' || Number(lead.probability ?? 0) < 45).length
    const dataIssues = noNextStep + noCloseDate + stale
    const qualityScore = leads.length ? Math.max(0, Math.round(100 - (dataIssues / (leads.length * 3)) * 100)) : 100
    return {
      deals: leads.length,
      messages: messages.length,
      tasks: workspace?.tasks.length ?? 0,
      connected,
      channelCount: workspace?.channels.length ?? 0,
      pipeline,
      noNextStep,
      noCloseDate,
      stale,
      risky,
      dataIssues,
      qualityScore,
    }
  }, [workspace])

  const auditGroups = useMemo(() => {
    const counts = {
      all: events.length,
      data: events.filter(event => event.type.includes('lead') || event.type.includes('task') || event.type.includes('activity') || event.type.includes('message')).length,
      automation: events.filter(event => event.type.includes('automation') || event.type.includes('ai')).length,
      billing: events.filter(event => event.type.includes('plan') || event.type.includes('billing')).length,
      security: events.filter(event => event.type.includes('channel') || event.type.includes('export')).length,
    }
    return counts
  }, [events])

  const filteredEvents = useMemo(() => {
    if (auditFilter === 'all') return events
    if (auditFilter === 'data') return events.filter(event => event.type.includes('lead') || event.type.includes('task') || event.type.includes('activity') || event.type.includes('message'))
    if (auditFilter === 'automation') return events.filter(event => event.type.includes('automation') || event.type.includes('ai'))
    if (auditFilter === 'billing') return events.filter(event => event.type.includes('plan') || event.type.includes('billing'))
    return events.filter(event => event.type.includes('channel') || event.type.includes('export'))
  }, [auditFilter, events])

  const settings = [
    {
      title: 'Revenue channels',
      description: 'Email, LinkedIn, web chat, and meetings feed the CRM workspace.',
      detail: `${metrics.connected}/${metrics.channelCount || 4} sources are currently connected.`,
      icon: PlugZap,
    },
    {
      title: 'AI defaults',
      description: 'Drafting and coaching stay grounded in deal evidence and current next steps.',
      detail: 'AI actions are recorded so managers can review what was generated.',
      icon: Bot,
    },
    {
      title: 'Security posture',
      description: 'Clerk protects workspace access and CRM APIs enforce signed-in access.',
      detail: 'Exports and audit logs are only available inside an authenticated workspace.',
      icon: ShieldCheck,
    },
  ]
  const governanceChecks = [
    {
      label: 'Deal hygiene',
      value: `${metrics.qualityScore}%`,
      detail: `${metrics.noNextStep} missing next steps · ${metrics.noCloseDate} missing close dates · ${metrics.stale} stale`,
      icon: Gauge,
      href: '/deals',
      cta: 'Review pipeline',
      tone: metrics.qualityScore >= 80 ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : metrics.qualityScore >= 60 ? 'border-yellow-300/20 bg-yellow-300/10 text-yellow-100' : 'border-red-300/20 bg-red-300/10 text-red-100',
    },
    {
      label: 'Risk posture',
      value: `${metrics.risky}`,
      detail: 'Deals with hot risk or low confidence that need manager attention.',
      icon: ShieldAlert,
      href: '/forecast',
      cta: 'Open forecast',
      tone: metrics.risky ? 'border-yellow-300/20 bg-yellow-300/10 text-yellow-100' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    },
    {
      label: 'Source readiness',
      value: `${metrics.connected}/${metrics.channelCount || 4}`,
      detail: 'Connected revenue sources feeding the inbox and evidence graph.',
      icon: PlugZap,
      href: '/channels',
      cta: 'Manage sources',
      tone: metrics.connected >= metrics.channelCount ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-blue-300/20 bg-blue-300/10 text-blue-100',
    },
    {
      label: 'Audit coverage',
      value: `${events.length}`,
      detail: 'Recent writes, automation runs, billing events, and admin changes.',
      icon: LockKeyhole,
      href: '/settings',
      cta: 'Refresh audit',
      tone: events.length ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-yellow-300/20 bg-yellow-300/10 text-yellow-100',
    },
  ]

  return (
    <div className="grid gap-4 text-zinc-100">
      <section className={cn(pillSurfaceClass, 'grid gap-5 bg-[#101316] p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end')}>
        <div>
          <Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100">Workspace control</Badge>
          <h1 className="mt-4 font-title text-3xl font-semibold tracking-normal text-white md:text-4xl">Settings</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Admin controls for revenue channels, exports, audit history, billing, and AI behavior.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="rounded-full bg-white text-black hover:bg-zinc-200">
            <a href="/api/crm/export?format=csv">
              <Download className="size-4" />
              Export CSV
            </a>
          </Button>
          <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
            <a href="/api/crm/export?format=json">
              <FileJson className="size-4" />
              Export JSON
            </a>
          </Button>
          <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
            <Link href="/settings/billing">
              <CreditCard className="size-4" />
              Billing
            </Link>
          </Button>
        </div>
      </section>

      {error ? (
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardContent className="flex items-center justify-between gap-3 p-5">
            <p className="text-sm text-red-100">{error}</p>
            <Button type="button" onClick={() => void refresh()} className="rounded-full bg-white text-black hover:bg-zinc-200">
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'CRM records', value: `${metrics.deals}`, detail: `${metrics.tasks} open tasks`, icon: Database },
          { label: 'Conversation evidence', value: `${metrics.messages}`, detail: 'Messages feeding deal context', icon: CheckCircle2 },
          { label: 'Pipeline data', value: money(metrics.pipeline), detail: 'Exportable active value', icon: Download },
          { label: 'Audit events', value: `${events.length}`, detail: 'Recent workspace changes', icon: LockKeyhole },
        ].map(item => {
          const Icon = item.icon
          return (
            <Card key={item.label} className={cn(pillSurfaceClass, 'bg-[#101316]')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-500">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-normal text-white">{loading ? '...' : item.value}</p>
                  </div>
                  <span className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-blue-200">
                    <Icon className="size-4" />
                  </span>
                </div>
                <p className="mt-4 text-xs leading-5 text-zinc-500">{item.detail}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {settings.map(item => {
          const Icon = item.icon
          return (
            <Card key={item.title} className={cn(pillSurfaceClass, 'bg-[#101316]')}>
              <CardContent className="p-5">
                <span className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-blue-200">
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-5 text-base font-semibold text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
                <p className={cn(pillInsetClass, 'mt-4 p-3 text-xs leading-5 text-zinc-500')}>{item.detail}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Governance cockpit</CardTitle>
            <CardDescription>Admin-grade checks for pipeline hygiene, risk, sources, and auditability.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {governanceChecks.map(item => {
              const Icon = item.icon
              return (
                <div key={item.label} className={cn(pillInsetClass, 'grid gap-4 p-4')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-zinc-500">{item.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{loading ? '...' : item.value}</p>
                    </div>
                    <span className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-blue-200">
                      <Icon className="size-4" />
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-zinc-500">{item.detail}</p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Badge variant="outline" className={item.tone}>{item.value === '0' ? 'clear' : 'active'}</Badge>
                    {item.href === '/settings' ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void refresh()} className="rounded-full border-white/10 bg-white/[0.04] text-xs text-zinc-100">
                        <RefreshCw className="size-3.5" />
                        {item.cta}
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-xs text-zinc-100">
                        <Link href={item.href}>{item.cta}</Link>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Export readiness</CardTitle>
            <CardDescription>What an admin can safely take out of the workspace today.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              { label: 'Deal rows', detail: `${metrics.deals} records in CSV export`, href: '/api/crm/export?format=csv', icon: Download },
              { label: 'Full workspace', detail: 'JSON export includes deals, messages, tasks, activities, and channels', href: '/api/crm/export?format=json', icon: FileJson },
              { label: 'Audit trail', detail: `${events.length} recent events visible to signed-in admins`, href: '/settings', icon: LockKeyhole },
            ].map(item => {
              const Icon = item.icon
              return (
                <div key={item.label} className={cn(pillInsetClass, 'flex items-center justify-between gap-3 p-3')}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-zinc-200"><Icon className="size-4" /></span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="mt-1 truncate text-xs text-zinc-500">{item.detail}</p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-xs text-zinc-100">
                    <a href={item.href}>{item.href === '/settings' ? 'View' : 'Export'}</a>
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div>
              <CardTitle>Audit log</CardTitle>
              <CardDescription>Recent workspace changes captured from CRM write actions.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All', count: auditGroups.all },
                { id: 'data', label: 'Data', count: auditGroups.data },
                { id: 'automation', label: 'Automation', count: auditGroups.automation },
                { id: 'billing', label: 'Billing', count: auditGroups.billing },
                { id: 'security', label: 'Security', count: auditGroups.security },
              ].map(item => (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAuditFilter(item.id as typeof auditFilter)}
                  className={cn(
                    'rounded-full border-white/10 bg-white/[0.04] text-xs text-zinc-100',
                    auditFilter === item.id && 'bg-white text-black hover:bg-zinc-200',
                  )}
                >
                  {item.label} {item.count}
                </Button>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => void refresh()} className="rounded-full border-white/10 bg-white/[0.04] text-xs text-zinc-100">
                <RefreshCw className="size-3.5" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-zinc-500">Event</TableHead>
                  <TableHead className="text-zinc-500">Record</TableHead>
                  <TableHead className="text-zinc-500">Actor</TableHead>
                  <TableHead className="text-zinc-500">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.slice(0, 12).map(event => (
                  <TableRow key={event.id} className="border-white/8 hover:bg-white/[0.04]">
                    <TableCell>
                      <Badge variant="outline" className={cn('capitalize', eventTone(event.type))}>{auditLabel(event.type)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-zinc-300">{metadataSummary(event.metadata)}</TableCell>
                    <TableCell className="text-zinc-500">{event.actorId ? event.actorId.slice(0, 12) : 'system'}</TableCell>
                    <TableCell className="text-zinc-500">{shortDate(event.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {!filteredEvents.length ? (
                  <TableRow className="border-white/8">
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-zinc-500">
                      {loading ? 'Loading audit events...' : 'No audit events in this filter yet.'}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
            <CardHeader>
              <CardTitle>Team access</CardTitle>
              <CardDescription>Owner performance, workload, and pipeline coverage live in the team workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                <Link href="/team">
                  <Users className="size-4" />
                  Open team workspace
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
            <CardHeader>
              <CardTitle>Data controls</CardTitle>
              <CardDescription>Exports are scoped to the signed-in workspace and generated on demand.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {['Deal table export', 'Full workspace JSON', 'CRM mutation audit', 'Authenticated API access'].map(item => (
                <div key={item} className={cn(pillInsetClass, 'flex items-center gap-3 p-3')}>
                  <CheckCircle2 className="size-4 text-emerald-200" />
                  <span className="text-sm text-zinc-300">{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
