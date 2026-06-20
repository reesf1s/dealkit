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
  LockKeyhole,
  PlugZap,
  RefreshCw,
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

export default function WorkspaceSettings() {
  const [workspace, setWorkspace] = useState<CrmWorkspacePayload | null>(null)
  const [events, setEvents] = useState<AuditEventDto[]>([])
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
    return {
      deals: leads.length,
      messages: messages.length,
      tasks: workspace?.tasks.length ?? 0,
      connected,
      channelCount: workspace?.channels.length ?? 0,
      pipeline,
    }
  }, [workspace])

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
          <CardHeader className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div>
              <CardTitle>Audit log</CardTitle>
              <CardDescription>Recent workspace changes captured from CRM write actions.</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={() => void refresh()} className="w-fit rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
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
                {events.slice(0, 12).map(event => (
                  <TableRow key={event.id} className="border-white/8 hover:bg-white/[0.04]">
                    <TableCell>
                      <Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100 capitalize">{auditLabel(event.type)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-zinc-300">{metadataSummary(event.metadata)}</TableCell>
                    <TableCell className="text-zinc-500">{event.actorId ? event.actorId.slice(0, 12) : 'system'}</TableCell>
                    <TableCell className="text-zinc-500">{shortDate(event.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {!events.length ? (
                  <TableRow className="border-white/8">
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-zinc-500">
                      {loading ? 'Loading audit events...' : 'No audit events yet.'}
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
