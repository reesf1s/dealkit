'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bot, CheckCircle2, ClipboardList, ListChecks, Play, RefreshCw, ShieldAlert, Workflow } from 'lucide-react'

import type { CrmAutomationRecommendation, CrmAutomationRule } from '@/lib/crm-automations'
import type { AuditEventDto } from '@/lib/audit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { pillInsetClass, pillSurfaceClass } from '@/components/sme/halvex-system'
import { cn } from '@/lib/utils'

type AutomationPayload = {
  rules: CrmAutomationRule[]
  recommendations: CrmAutomationRecommendation[]
}

type AutomationTask = {
  id: string
  title: string
  companyName?: string | null
  personName?: string | null
  priority?: string | null
}

type AuditPayload = {
  events: AuditEventDto[]
}

async function apiJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init?.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? `Request failed: ${response.status}`)
  return payload as T
}

function money(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function WorkspaceAutomations() {
  const [rules, setRules] = useState<CrmAutomationRule[]>([])
  const [recommendations, setRecommendations] = useState<CrmAutomationRecommendation[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEventDto[]>([])
  const [selectedRuleId, setSelectedRuleId] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [createdTasks, setCreatedTasks] = useState<AutomationTask[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [payload, auditPayload] = await Promise.all([
        apiJson<AutomationPayload>('/api/crm/automations'),
        apiJson<AuditPayload>('/api/crm/audit'),
      ])
      setRules(payload.rules)
      setRecommendations(payload.recommendations)
      setSelected(new Set(payload.recommendations.map(item => item.id)))
      setAuditEvents(auditPayload.events.filter(event => event.type === 'crm.automation.run'))
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load automations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function runSelected() {
    setRunning(true)
    setNotice(null)
    setError(null)
    setCreatedTasks([])
    try {
      const payload = await apiJson<{ created: number; tasks?: AutomationTask[]; recommendations?: CrmAutomationRecommendation[] }>('/api/crm/automations', {
        method: 'POST',
        body: JSON.stringify({ recommendationIds: [...selected] }),
      })
      setCreatedTasks(payload.tasks ?? [])
      setNotice(`${payload.created} tasks created`)
      await refresh()
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Unable to run automations')
    } finally {
      setRunning(false)
    }
  }

  const filteredRecommendations = useMemo(() => (
    selectedRuleId === 'all' ? recommendations : recommendations.filter(item => item.ruleId === selectedRuleId)
  ), [recommendations, selectedRuleId])
  const selectedValue = useMemo(() => recommendations.filter(item => selected.has(item.id)).reduce((sum, item) => sum + item.estimatedValue, 0), [recommendations, selected])
  const ruleCoverage = useMemo(() => new Set(recommendations.map(item => item.ruleId)).size, [recommendations])
  const ruleSummaries = useMemo(() => rules.map(rule => {
    const queue = recommendations.filter(item => item.ruleId === rule.id)
    const selectedCount = queue.filter(item => selected.has(item.id)).length
    return {
      rule,
      queue,
      selectedCount,
      value: queue.reduce((sum, item) => sum + item.estimatedValue, 0),
    }
  }), [recommendations, rules, selected])
  const toggleRule = (ruleId: string, checked: boolean) => {
    const next = new Set(selected)
    recommendations
      .filter(item => item.ruleId === ruleId)
      .forEach(item => {
        if (checked) next.add(item.id)
        else next.delete(item.id)
      })
    setSelected(next)
  }

  return (
    <div className="grid gap-4 text-zinc-100">
      <section className={cn(pillSurfaceClass, 'grid gap-5 bg-[#101316] p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end')}>
        <div>
          <Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100">Automations</Badge>
          <h1 className="mt-4 font-title text-3xl font-semibold tracking-normal text-white md:text-4xl">Workflow automation</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Convert stale activity, risk signals, and commit forecast state into task work your team can execute.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void refresh()} className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button type="button" onClick={() => void runSelected()} disabled={running || !selected.size} className="rounded-full bg-white text-black hover:bg-zinc-200">
            <Play className="size-4" />
            {running ? 'Running...' : 'Run selected'}
          </Button>
        </div>
      </section>

      {notice || error ? (
        <div className={cn('rounded-full border px-4 py-2 text-sm', error ? 'border-red-300/20 bg-red-300/10 text-red-100' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100')}>
          {error ?? notice}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Active rules', value: `${rules.length}`, detail: 'Automation rules configured', icon: Workflow },
          { label: 'Recommended work', value: `${recommendations.length}`, detail: 'Tasks ready to create', icon: ClipboardList },
          { label: 'Selected value', value: money(selectedValue), detail: 'Pipeline touched by selected work', icon: ShieldAlert },
          { label: 'Rules triggered', value: `${ruleCoverage}`, detail: 'Different automation types firing', icon: Bot },
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

      <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Rule control</CardTitle>
            <CardDescription>Choose which workflow is in scope, then run only the work that should become tasks.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <button
              type="button"
              onClick={() => setSelectedRuleId('all')}
              className={cn(pillInsetClass, 'p-4 text-left transition', selectedRuleId === 'all' ? 'border-blue-300/30 bg-blue-400/10' : 'hover:bg-white/[0.05]')}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-blue-200">
                  <ListChecks className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">All rules</p>
                  <p className="mt-1 text-xs text-zinc-500">{recommendations.length} recommendations · {money(recommendations.reduce((sum, item) => sum + item.estimatedValue, 0))}</p>
                </div>
              </div>
            </button>

            {ruleSummaries.map(summary => (
              <div key={summary.rule.id} className={cn(pillInsetClass, selectedRuleId === summary.rule.id && 'border-blue-300/30 bg-blue-400/10')}>
                <button type="button" onClick={() => setSelectedRuleId(summary.rule.id)} className="w-full p-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{summary.rule.name}</p>
                      <p className="mt-2 text-xs leading-5 text-zinc-500">{summary.rule.description}</p>
                    </div>
                    <Badge variant="outline" className={summary.rule.priority === 'high' ? 'border-red-300/20 bg-red-300/10 text-red-100' : 'border-yellow-300/20 bg-yellow-300/10 text-yellow-100'}>{summary.rule.priority}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-[16px] border border-white/8 bg-black/20 p-2">
                      <p className="text-zinc-500">Queued</p>
                      <p className="mt-1 font-semibold text-white">{summary.queue.length}</p>
                    </div>
                    <div className="rounded-[16px] border border-white/8 bg-black/20 p-2">
                      <p className="text-zinc-500">Selected</p>
                      <p className="mt-1 font-semibold text-white">{summary.selectedCount}</p>
                    </div>
                    <div className="rounded-[16px] border border-white/8 bg-black/20 p-2">
                      <p className="text-zinc-500">Value</p>
                      <p className="mt-1 font-semibold text-white">{money(summary.value)}</p>
                    </div>
                  </div>
                </button>
                <div className="border-t border-white/8 px-4 py-3">
                  <label className="flex items-center gap-3 text-xs text-zinc-400">
                    <Checkbox
                      checked={summary.queue.length > 0 && summary.selectedCount === summary.queue.length}
                      onCheckedChange={checked => toggleRule(summary.rule.id, Boolean(checked))}
                      aria-label={`Select all ${summary.rule.name} recommendations`}
                    />
                    Select all in rule · {summary.rule.cadence}
                  </label>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Automation queue</CardTitle>
              <CardDescription>Review recommended tasks before creating work for the team.</CardDescription>
            </div>
            <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
              <Link href="/tasks">Open tasks</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="w-10 text-zinc-500">Run</TableHead>
                  <TableHead className="text-zinc-500">Task</TableHead>
                  <TableHead className="text-zinc-500">Rule</TableHead>
                  <TableHead className="text-zinc-500">Value</TableHead>
                  <TableHead className="text-zinc-500">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecommendations.map(item => (
                  <TableRow key={item.id} className="border-white/8 hover:bg-white/[0.04]">
                    <TableCell>
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={checked => {
                          const next = new Set(selected)
                          if (checked) next.add(item.id)
                          else next.delete(item.id)
                          setSelected(next)
                        }}
                        aria-label={`Select ${item.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{item.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{item.companyName} · {item.personName}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="border-blue-300/20 bg-blue-300/10 text-blue-100">{item.ruleName}</Badge></TableCell>
                    <TableCell className="text-zinc-300">{money(item.estimatedValue)}</TableCell>
                    <TableCell className="max-w-xs text-zinc-500">{item.reason}</TableCell>
                  </TableRow>
                ))}
                {!filteredRecommendations.length ? (
                  <TableRow className="border-white/8">
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-zinc-500">
                      {loading ? 'Loading automation queue...' : 'No automation work is currently recommended for this scope.'}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Run result</CardTitle>
            <CardDescription>Tasks created by the latest automation run in this session.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {createdTasks.map(task => (
              <div key={task.id} className={cn(pillInsetClass, 'grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center')}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={task.priority === 'high' ? 'border-red-300/20 bg-red-300/10 text-red-100' : 'border-yellow-300/20 bg-yellow-300/10 text-yellow-100'}>{task.priority ?? 'task'}</Badge>
                    <p className="truncate text-sm font-semibold text-white">{task.title}</p>
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-500">{task.companyName ?? 'No account'} · {task.personName ?? 'No contact'}</p>
                </div>
                <Button asChild size="sm" variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
                  <Link href="/tasks">Open task queue</Link>
                </Button>
              </div>
            ))}
            {!createdTasks.length ? (
              <div className={cn(pillInsetClass, 'p-6 text-center text-sm text-zinc-500')}>Run selected automation work to see the created tasks here.</div>
            ) : null}
          </CardContent>
        </Card>

        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Automation audit</CardTitle>
            <CardDescription>Recent automation runs recorded in the workspace audit log.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {auditEvents.slice(0, 5).map(event => {
              const created = typeof event.metadata.created === 'number' ? event.metadata.created : 0
              const ruleIds = Array.isArray(event.metadata.ruleIds) ? event.metadata.ruleIds.filter(item => typeof item === 'string') : []
              return (
                <div key={event.id} className={cn(pillInsetClass, 'p-4')}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{created} tasks created</p>
                    <span className="text-xs text-zinc-500">{shortDate(event.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">{ruleIds.length ? ruleIds.join(' · ') : 'Automation run'}</p>
                </div>
              )
            })}
            {!auditEvents.length ? (
              <div className={cn(pillInsetClass, 'p-6 text-center text-sm text-zinc-500')}>No automation runs have been logged yet.</div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
              <CheckCircle2 className="size-4" />
            </span>
            <div>
              <p className="font-semibold text-white">Automation runs are auditable</p>
              <p className="mt-1 text-sm text-zinc-500">Each run records rule IDs, recommendation IDs, and task count in the workspace audit log.</p>
            </div>
          </div>
          <Button asChild variant="outline" className="w-fit rounded-full border-white/10 bg-white/[0.04] text-zinc-100">
            <Link href="/settings">Open audit log</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
