'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bot, CheckCircle2, ClipboardList, Play, RefreshCw, ShieldAlert, Workflow } from 'lucide-react'

import type { CrmAutomationRecommendation, CrmAutomationRule } from '@/lib/crm-automations'
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

export default function WorkspaceAutomations() {
  const [rules, setRules] = useState<CrmAutomationRule[]>([])
  const [recommendations, setRecommendations] = useState<CrmAutomationRecommendation[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const payload = await apiJson<AutomationPayload>('/api/crm/automations')
      setRules(payload.rules)
      setRecommendations(payload.recommendations)
      setSelected(new Set(payload.recommendations.map(item => item.id)))
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
    try {
      const payload = await apiJson<{ created: number }>('/api/crm/automations', {
        method: 'POST',
        body: JSON.stringify({ recommendationIds: [...selected] }),
      })
      setNotice(`${payload.created} tasks created`)
      await refresh()
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Unable to run automations')
    } finally {
      setRunning(false)
    }
  }

  const selectedValue = useMemo(() => recommendations.filter(item => selected.has(item.id)).reduce((sum, item) => sum + item.estimatedValue, 0), [recommendations, selected])
  const ruleCoverage = useMemo(() => new Set(recommendations.map(item => item.ruleId)).size, [recommendations])

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

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className={cn(pillSurfaceClass, 'bg-[#101316]')}>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
            <CardDescription>Simple, auditable workflows for the current CRM state.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {rules.map(rule => (
              <div key={rule.id} className={cn(pillInsetClass, 'p-4')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{rule.name}</p>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">{rule.description}</p>
                  </div>
                  <Badge variant="outline" className={rule.priority === 'high' ? 'border-red-300/20 bg-red-300/10 text-red-100' : 'border-yellow-300/20 bg-yellow-300/10 text-yellow-100'}>{rule.priority}</Badge>
                </div>
                <p className="mt-3 text-xs text-zinc-500">{rule.cadence}</p>
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
                {recommendations.map(item => (
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
                {!recommendations.length ? (
                  <TableRow className="border-white/8">
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-zinc-500">
                      {loading ? 'Loading automation queue...' : 'No automation work is currently recommended.'}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
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
