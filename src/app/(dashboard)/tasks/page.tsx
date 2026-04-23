'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Suspense, startTransition, useDeferredValue, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Filter,
  Loader2,
  Search,
  Sparkles,
  Target,
} from 'lucide-react'
import { useToast } from '@/components/shared/Toast'
import { fetcher } from '@/lib/fetcher'
import {
  stageLabelFor,
  type PipelineConfigLike,
} from '@/lib/pipeline-presentation'
import { formatContextualDate, formatCurrencyGBP, formatRelativeTime } from '@/lib/presentation'

type DealTodo = {
  id: string
  text: string
  done: boolean
  source?: 'manual' | 'ai'
  priority?: 'low' | 'normal' | 'high'
  createdAt?: string
  dueDate?: string | null
}

type SuccessCriterion = {
  id: string
  text: string
  achieved?: boolean
  category?: string
}

type ProjectPlanTask = {
  id: string
  text: string
  status?: 'not_started' | 'in_progress' | 'complete'
  dueDate?: string | null
  owner?: string | null
}

type DealRecord = {
  id: string
  dealName: string
  prospectCompany: string
  stage: string
  conversionScore?: number | null
  dealValue?: number | null
  updatedAt?: string
  todos?: DealTodo[] | null
  successCriteriaTodos?: SuccessCriterion[] | null
  projectPlan?: {
    phases?: Array<{
      id: string
      name: string
      tasks?: ProjectPlanTask[]
    }>
  } | null
}

type WorkItem = {
  id: string
  dealId: string
  dealLabel: string
  stage: string
  kind: 'task' | 'project' | 'criterion'
  text: string
  meta: string
  dueDate?: string | null
  updatedAt?: string
  done: boolean
  priorityScore: number
  priorityLabel: 'critical' | 'high' | 'medium' | 'low'
  priorityReason: string
  sortDate: number
}

type PipelineConfigResponse = {
  data?: PipelineConfigLike
}

const STAGE_WEIGHTS: Record<string, number> = {
  negotiation: 26,
  proposal: 22,
  discovery: 14,
  qualification: 10,
  prospecting: 6,
}

const PRIORITY_WEIGHTS: Record<string, number> = {
  high: 34,
  normal: 20,
  low: 8,
}

const KIND_WEIGHTS: Record<WorkItem['kind'], number> = {
  task: 22,
  project: 16,
  criterion: 14,
}

function compactMoney(value: number | null | undefined) {
  return formatCurrencyGBP(value, { compact: true })
}

function scorePriorityLabel(score: number): WorkItem['priorityLabel'] {
  if (score >= 82) return 'critical'
  if (score >= 62) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

function dueDateWeight(dueDate?: string | null) {
  if (!dueDate) return 0
  const target = new Date(dueDate)
  if (Number.isNaN(target.getTime())) return 0
  const diffDays = Math.floor((target.getTime() - Date.now()) / 86_400_000)
  if (diffDays < 0) return 28
  if (diffDays <= 3) return 22
  if (diffDays <= 7) return 16
  if (diffDays <= 14) return 8
  return 2
}

function describePriority(score: number, stage: string, dueDate?: string | null, source?: string, value?: number | null) {
  const parts: string[] = []
  if (dueDateWeight(dueDate) >= 22) {
    parts.push(dueDate && new Date(dueDate).getTime() < Date.now() ? 'Overdue' : 'Due soon')
  }
  if (['proposal', 'negotiation'].includes(stage)) {
    parts.push('Late-stage deal')
  }
  if (value && value >= 100_000) {
    parts.push('High-value opportunity')
  }
  if (source === 'ai') {
    parts.push('AI surfaced')
  }
  if (score < 40) {
    parts.push('Needs intervention')
  }
  return parts[0] ?? 'Queued for follow-up'
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error((json as { error?: string }).error ?? 'Request failed')
  }
  return json as T
}

function itemKindLabel(kind: WorkItem['kind']) {
  if (kind === 'criterion') return 'Success criteria'
  if (kind === 'project') return 'Project plan'
  return 'Task'
}

function buildWorkItems(deals: DealRecord[], pipelineConfig?: PipelineConfigLike): WorkItem[] {
  return deals.flatMap(deal => {
    const score = deal.conversionScore ?? 50
    const stageWeight = STAGE_WEIGHTS[deal.stage] ?? 4
    const valueWeight = (deal.dealValue ?? 0) >= 100_000 ? 10 : (deal.dealValue ?? 0) >= 50_000 ? 6 : 0
    const staleWeight = deal.updatedAt && Date.now() - new Date(deal.updatedAt).getTime() > 10 * 86_400_000 ? 8 : 0
    const dealLabel = deal.prospectCompany || deal.dealName

    const todoItems = (deal.todos ?? []).map(todo => {
      const priorityBase = PRIORITY_WEIGHTS[todo.priority ?? 'normal'] ?? PRIORITY_WEIGHTS.normal
      const scoreValue =
        KIND_WEIGHTS.task + priorityBase + stageWeight + valueWeight + staleWeight + dueDateWeight(todo.dueDate) + Math.max(0, 60 - score) / 2
      return {
        id: todo.id,
        dealId: deal.id,
        dealLabel,
        stage: deal.stage,
        kind: 'task' as const,
        text: todo.text,
        meta: `${stageLabelFor(deal.stage, pipelineConfig)}${todo.createdAt ? ` · ${formatRelativeTime(todo.createdAt)}` : ''}${todo.source === 'ai' ? ' · AI' : ''}`,
        dueDate: todo.dueDate,
        updatedAt: deal.updatedAt,
        done: todo.done,
        priorityScore: scoreValue,
        priorityLabel: scorePriorityLabel(scoreValue),
        priorityReason: describePriority(score, deal.stage, todo.dueDate, todo.source, deal.dealValue),
        sortDate: todo.dueDate ? new Date(todo.dueDate).getTime() : new Date(todo.createdAt ?? deal.updatedAt ?? Date.now()).getTime(),
      }
    })

    const projectItems = (deal.projectPlan?.phases ?? []).flatMap(phase =>
      (phase.tasks ?? []).map(task => {
        const scoreValue =
          KIND_WEIGHTS.project + 18 + stageWeight + valueWeight + staleWeight + dueDateWeight(task.dueDate) + Math.max(0, 60 - score) / 2
        return {
          id: task.id,
          dealId: deal.id,
          dealLabel,
          stage: deal.stage,
          kind: 'project' as const,
          text: task.text,
          meta: `${phase.name}${task.owner ? ` · ${task.owner}` : ''}`,
          dueDate: task.dueDate,
          updatedAt: deal.updatedAt,
          done: task.status === 'complete',
          priorityScore: scoreValue,
          priorityLabel: scorePriorityLabel(scoreValue),
          priorityReason: describePriority(score, deal.stage, task.dueDate, undefined, deal.dealValue),
          sortDate: task.dueDate ? new Date(task.dueDate).getTime() : new Date(deal.updatedAt ?? Date.now()).getTime(),
        }
      }),
    )

    const criteriaItems = (deal.successCriteriaTodos ?? []).map(item => {
      const scoreValue =
        KIND_WEIGHTS.criterion + 16 + stageWeight + valueWeight + staleWeight + Math.max(0, 60 - score) / 2
      return {
        id: item.id,
        dealId: deal.id,
        dealLabel,
        stage: deal.stage,
        kind: 'criterion' as const,
        text: item.text,
        meta: `${stageLabelFor(deal.stage, pipelineConfig)} · ${item.category ?? 'Success criteria'}`,
        dueDate: null,
        updatedAt: deal.updatedAt,
        done: Boolean(item.achieved),
        priorityScore: scoreValue,
        priorityLabel: scorePriorityLabel(scoreValue),
        priorityReason: describePriority(score, deal.stage, null, undefined, deal.dealValue),
        sortDate: new Date(deal.updatedAt ?? Date.now()).getTime(),
      }
    })

    return [...todoItems, ...projectItems, ...criteriaItems]
  })
}

function TasksPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const dealFilter = searchParams.get('deal') ?? 'all'
  const { data, isLoading, mutate } = useSWR<{ data: DealRecord[] }>('/api/deals', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45_000,
  })
  const { data: pipelineConfigRes } = useSWR<PipelineConfigResponse>('/api/pipeline-config', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
  })

  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<'all' | WorkItem['priorityLabel']>('all')
  const [savingItemKey, setSavingItemKey] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)
  const deals = useMemo(() => data?.data ?? [], [data?.data])
  const pipelineConfig = pipelineConfigRes?.data
  const dealById = useMemo(() => new Map(deals.map(deal => [deal.id, deal])), [deals])

  const items = useMemo(() => buildWorkItems(deals, pipelineConfig), [deals, pipelineConfig])

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (dealFilter !== 'all' && item.dealId !== dealFilter) return false
      if (priorityFilter !== 'all' && item.priorityLabel !== priorityFilter) return false
      if (!deferredSearch.trim()) return true
      const query = deferredSearch.trim().toLowerCase()
      return [item.text, item.meta, item.dealLabel].some(value => value.toLowerCase().includes(query))
    })
  }, [dealFilter, deferredSearch, items, priorityFilter])

  const openItems = useMemo(
    () =>
      filteredItems
        .filter(item => !item.done)
        .sort((left, right) => {
          if (right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore
          return left.sortDate - right.sortDate
        }),
    [filteredItems],
  )

  const doneItems = useMemo(
    () =>
      filteredItems
        .filter(item => item.done)
        .sort((left, right) => new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime()),
    [filteredItems],
  )

  const dealOptions = useMemo(() => {
    const counts = openItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.dealId] = (acc[item.dealId] ?? 0) + 1
      return acc
    }, {})

    return deals
      .map(deal => ({
        id: deal.id,
        label: deal.prospectCompany || deal.dealName,
        count: counts[deal.id] ?? 0,
        value: deal.dealValue ?? 0,
      }))
      .filter(option => option.count > 0 || option.id === dealFilter)
      .sort((left, right) => right.count - left.count || right.value - left.value)
  }, [dealFilter, deals, openItems])

  const summary = useMemo(() => {
    const allOpenItems = items.filter(item => !item.done)
    return {
      open: allOpenItems.length,
      critical: allOpenItems.filter(item => item.priorityLabel === 'critical').length,
      activeDeals: new Set(allOpenItems.map(item => item.dealId)).size,
      completed: items.filter(item => item.done).length,
    }
  }, [items])

  const topDeals = useMemo(() => dealOptions.slice(0, 5), [dealOptions])

  function updateDealFilter(nextValue: string) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextValue === 'all') params.delete('deal')
      else params.set('deal', nextValue)
      const nextQuery = params.toString()
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
    })
  }

  async function updateItemDone(item: WorkItem, done: boolean) {
    const itemKey = `${item.dealId}-${item.kind}-${item.id}`
    const targetDeal = dealById.get(item.dealId)

    if (!targetDeal) {
      toast('This deal could not be found. Refresh and try again.', 'error')
      return
    }

    setSavingItemKey(itemKey)
    try {
      if (item.kind === 'task') {
        const existingTodos = targetDeal.todos ?? []
        const hasTodo = existingTodos.some(todo => todo.id === item.id)
        if (!hasTodo) throw new Error('Task no longer exists on this deal.')

        const nextTodos = existingTodos.map(todo =>
          todo.id === item.id ? { ...todo, done } : todo,
        )

        await requestJson(`/api/deals/${item.dealId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ todos: nextTodos }),
        })
      } else if (item.kind === 'project') {
        await requestJson(`/api/deals/${item.dealId}/project-plan`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: item.id, status: done ? 'complete' : 'in_progress' }),
        })
      } else {
        await requestJson(`/api/deals/${item.dealId}/success-criteria`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ criterionId: item.id, achieved: done }),
        })
      }

      await mutate()
      toast(done ? 'Task marked done' : 'Task reopened', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update this task', 'error')
    } finally {
      setSavingItemKey(null)
    }
  }

  return (
    <div className="tasks-shell">
      <style>{`
        .tasks-shell {
          display: flex;
          flex-direction: column;
          gap: clamp(20px, 2.2vw, 26px);
          width: min(100%, 1240px);
        }
        .tasks-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }
        .tasks-title {
          font-size: 34px;
          line-height: 1.02;
          letter-spacing: -0.05em;
          color: var(--ink);
          font-weight: 600;
        }
        .tasks-eyebrow {
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-4);
          margin-bottom: 6px;
        }
        .tasks-subtitle {
          margin-top: 10px;
          font-size: 13px;
          color: var(--ink-3);
          max-width: 700px;
        }
        .tasks-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .tasks-summary-card {
          padding: 14px;
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.46);
          border: 1px solid rgba(255, 255, 255, 0.72);
        }
        .tasks-summary-label {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-4);
          margin-bottom: 4px;
          font-weight: 600;
        }
        .tasks-summary-value {
          font-size: 24px;
          line-height: 1;
          letter-spacing: -0.04em;
          color: var(--ink);
          font-weight: 600;
        }
        .tasks-summary-meta {
          margin-top: 6px;
          font-size: 11px;
          color: var(--ink-3);
        }
        .tasks-filter-card {
          padding: clamp(16px, 2vw, 18px);
        }
        .tasks-filter-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 220px auto;
          gap: 10px;
          align-items: center;
        }
        .tasks-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.74);
        }
        .tasks-search input {
          background: transparent;
          border: 0;
          width: 100%;
          color: var(--ink);
          outline: none;
        }
        .tasks-select {
          padding: 9px 12px;
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.74);
          color: var(--ink);
        }
        .tasks-priority-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .tasks-priority-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.42);
          border: 1px solid rgba(255, 255, 255, 0.72);
          font-size: 11px;
          color: var(--ink-3);
        }
        .tasks-priority-chip.active {
          background: var(--ink);
          color: var(--bg);
          border-color: var(--ink);
        }
        .tasks-page-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.85fr);
          gap: 16px;
        }
        .tasks-panel {
          padding: clamp(16px, 2vw, 18px);
          min-width: 0;
        }
        .tasks-list {
          display: grid;
          gap: 10px;
        }
        .tasks-item {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.46);
          border: 1px solid rgba(255, 255, 255, 0.72);
          transition: transform 0.16s ease, background 0.16s ease;
        }
        .tasks-item:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.56);
        }
        .tasks-rank {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: rgba(20, 17, 10, 0.06);
          color: var(--ink-2);
          font-size: 11px;
          font-weight: 700;
        }
        .tasks-copy {
          min-width: 0;
        }
        .tasks-link {
          display: block;
          min-width: 0;
          text-decoration: none;
          color: inherit;
        }
        .tasks-item-top {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 4px;
        }
        .tasks-item-title {
          font-size: 13px;
          color: var(--ink);
          font-weight: 600;
        }
        .tasks-item-body {
          font-size: 12px;
          color: var(--ink-2);
          line-height: 1.55;
        }
        .tasks-item-meta {
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          font-size: 11px;
          color: var(--ink-4);
        }
        .tasks-actions {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .tasks-complete-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 32px;
          padding: 0 11px;
          border-radius: 999px;
          border: 1px solid rgba(20, 17, 10, 0.1);
          background: rgba(255, 255, 255, 0.62);
          color: var(--ink);
          font-size: 11px;
          font-weight: 600;
          transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
        }
        .tasks-complete-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.82);
          border-color: rgba(20, 17, 10, 0.16);
          transform: translateY(-1px);
        }
        .tasks-complete-btn:disabled {
          opacity: 0.72;
          cursor: progress;
        }
        .tasks-open-link {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          color: var(--ink-4);
          border: 1px solid rgba(20, 17, 10, 0.08);
          background: rgba(255, 255, 255, 0.44);
          transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
        }
        .tasks-open-link:hover {
          background: rgba(255, 255, 255, 0.66);
          border-color: rgba(20, 17, 10, 0.12);
          transform: translateY(-1px);
        }
        .tasks-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          border-radius: 999px;
          font-size: 10px;
          color: var(--ink-3);
          background: rgba(20, 17, 10, 0.05);
        }
        .tasks-chip.priority-critical {
          background: rgba(178, 58, 58, 0.12);
          color: var(--risk);
        }
        .tasks-chip.priority-high {
          background: rgba(196, 98, 27, 0.12);
          color: var(--warn);
        }
        .tasks-chip.priority-medium {
          background: rgba(46, 90, 172, 0.1);
          color: var(--cool);
        }
        .tasks-chip.priority-low {
          background: rgba(29, 184, 106, 0.1);
          color: var(--signal);
        }
        .tasks-side-stack {
          display: grid;
          gap: 16px;
        }
        .tasks-focus-row,
        .tasks-done-row {
          display: grid;
          gap: 8px;
          padding: 12px 14px;
          border-radius: var(--radius);
          background: rgba(255, 255, 255, 0.46);
          border: 1px solid rgba(255, 255, 255, 0.72);
        }
        .tasks-focus-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .tasks-row-title {
          font-size: 13px;
          color: var(--ink);
          font-weight: 600;
        }
        .tasks-row-meta {
          font-size: 11px;
          color: var(--ink-4);
        }
        .tasks-empty {
          min-height: 180px;
          display: grid;
          place-items: center;
          text-align: center;
          color: var(--ink-3);
          font-size: 12px;
          line-height: 1.6;
        }
        @media (max-width: 1080px) {
          .tasks-shell {
            width: 100%;
          }
          .tasks-page-grid {
            grid-template-columns: 1fr;
          }
          .tasks-filter-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 720px) {
          .tasks-title {
            font-size: 28px;
          }
          .tasks-summary-grid {
            grid-template-columns: 1fr;
          }
          .tasks-item {
            grid-template-columns: auto minmax(0, 1fr);
          }
          .tasks-actions {
            grid-column: 2;
            justify-content: flex-start;
          }
          .tasks-header {
            align-items: flex-start;
          }
        }
      `}</style>

      <div className="tasks-header">
        <div>
          <div className="tasks-eyebrow">Workspace / Tasks</div>
          <div className="tasks-title">Tasks</div>
          <div className="tasks-subtitle">
            Every open task ranked by deal pressure, urgency, and timing so the team works the right accounts in the right order.
          </div>
        </div>
        <Link href="/deals" className="btn">
          <ArrowUpRight size={13} strokeWidth={2} />
          Browse deals
        </Link>
      </div>

      <div className="tasks-summary-grid">
        <div className="tasks-summary-card">
          <div className="tasks-summary-label">Open work</div>
          <div className="tasks-summary-value mono">{summary.open}</div>
          <div className="tasks-summary-meta">All active tasks and criteria</div>
        </div>
        <div className="tasks-summary-card">
          <div className="tasks-summary-label">Critical now</div>
          <div className="tasks-summary-value mono">{summary.critical}</div>
          <div className="tasks-summary-meta">Highest-priority items first</div>
        </div>
        <div className="tasks-summary-card">
          <div className="tasks-summary-label">Deals in motion</div>
          <div className="tasks-summary-value mono">{summary.activeDeals}</div>
          <div className="tasks-summary-meta">Accounts with open execution work</div>
        </div>
        <div className="tasks-summary-card">
          <div className="tasks-summary-label">Completed</div>
          <div className="tasks-summary-value mono">{summary.completed}</div>
          <div className="tasks-summary-meta">Recently closed out work</div>
        </div>
      </div>

      <section className="panel-section tasks-filter-card">
        <div className="section-head" style={{ marginBottom: 14 }}>
          <h2 className="section-title">Filter and focus</h2>
          <span className="section-action">
            <Filter size={12} />
            {dealFilter === 'all' ? 'All deals' : dealOptions.find(option => option.id === dealFilter)?.label ?? 'Deal filter'}
          </span>
        </div>

        <div className="tasks-filter-grid">
          <label className="tasks-search">
            <Search size={13} strokeWidth={2} style={{ color: 'var(--ink-4)' }} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tasks, deals, or context…" />
          </label>

          <select className="tasks-select" value={dealFilter} onChange={event => updateDealFilter(event.target.value)}>
            <option value="all">All deals</option>
            {dealOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>

          <div className="tasks-priority-row">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map(priority => (
              <button
                key={priority}
                className={`tasks-priority-chip${priorityFilter === priority ? ' active' : ''}`}
                onClick={() => setPriorityFilter(priority)}
              >
                {priority === 'all' ? <ClipboardList size={12} strokeWidth={2} /> : priority === 'critical' ? <Target size={12} strokeWidth={2} /> : priority === 'high' ? <Sparkles size={12} strokeWidth={2} /> : null}
                {priority === 'all' ? 'All priorities' : priority.charAt(0).toUpperCase() + priority.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="tasks-page-grid">
        <section className="panel-section tasks-panel">
          <div className="section-head">
            <h2 className="section-title">Priority queue</h2>
            <span className="section-action">{openItems.length} open</span>
          </div>

          {isLoading ? (
            <div className="skeleton" style={{ height: 260, borderRadius: 'var(--radius-lg)' }} />
          ) : openItems.length === 0 ? (
            <div className="tasks-empty">
              No open work matches the current filters. Try another deal filter or clear the search to see the full queue.
            </div>
          ) : (
            <div className="tasks-list">
              {openItems.map((item, index) => (
                <div key={`${item.dealId}-${item.kind}-${item.id}`} className="tasks-item">
                  <div className="tasks-rank">{String(index + 1).padStart(2, '0')}</div>
                  <Link href={`/deals/${item.dealId}?tab=manage`} className="tasks-link">
                    <div className="tasks-copy">
                      <div className="tasks-item-top">
                        <span className="tasks-item-title">{item.text}</span>
                        <span className={`tasks-chip priority-${item.priorityLabel}`}>{item.priorityLabel}</span>
                        <span className="tasks-chip">{itemKindLabel(item.kind)}</span>
                      </div>
                      <div className="tasks-item-body">{item.priorityReason}</div>
                      <div className="tasks-item-meta">
                        <span>{item.dealLabel}</span>
                        <span>·</span>
                        <span>{item.meta}</span>
                        {item.dueDate ? (
                          <>
                            <span>·</span>
                            <span>Due {formatContextualDate(item.dueDate)}</span>
                          </>
                        ) : null}
                        {dealById.get(item.dealId)?.dealValue ? (
                          <>
                            <span>·</span>
                            <span className="mono">{compactMoney(dealById.get(item.dealId)?.dealValue)}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                  <div className="tasks-actions">
                    <button
                      type="button"
                      className="tasks-complete-btn"
                      onClick={() => void updateItemDone(item, true)}
                      disabled={savingItemKey === `${item.dealId}-${item.kind}-${item.id}`}
                      aria-label={`Mark ${item.text} as done`}
                    >
                      {savingItemKey === `${item.dealId}-${item.kind}-${item.id}` ? (
                        <Loader2 size={12} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <CheckCircle2 size={13} strokeWidth={2} />
                      )}
                      Done
                    </button>
                    <Link
                      href={`/deals/${item.dealId}?tab=manage`}
                      className="tasks-open-link"
                      aria-label={`Open ${item.dealLabel} in the deal workspace`}
                    >
                      <ChevronRight size={14} strokeWidth={1.8} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="tasks-side-stack">
          <section className="panel-section tasks-panel">
            <div className="section-head">
              <h2 className="section-title">Focus by deal</h2>
              <span className="section-action">Filterable</span>
            </div>

            <div className="tasks-list">
              {topDeals.length === 0 ? (
                <div className="tasks-empty" style={{ minHeight: 120 }}>
                  Open work will cluster here by deal as execution starts to spread across the pipeline.
                </div>
              ) : (
                topDeals.map(option => (
                  <button
                    key={option.id}
                    className="tasks-focus-row"
                    onClick={() => updateDealFilter(option.id)}
                  >
                    <div className="tasks-focus-head">
                      <div className="tasks-row-title">{option.label}</div>
                      <div className="tasks-chip mono">{option.count} open</div>
                    </div>
                    <div className="tasks-row-meta">
                      {option.value ? `${compactMoney(option.value)} deal value` : 'Tracked in workspace'}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="panel-section tasks-panel">
            <div className="section-head">
              <h2 className="section-title">Recently completed</h2>
              <span className="section-action">{doneItems.length} done</span>
            </div>

            <div className="tasks-list">
              {doneItems.length === 0 ? (
                <div className="tasks-empty" style={{ minHeight: 120 }}>
                  Completed tasks will appear here once the team starts closing out execution work on deals.
                </div>
              ) : (
                doneItems.slice(0, 8).map(item => (
                  <div key={`${item.dealId}-${item.kind}-${item.id}`} className="tasks-done-row">
                    <div className="tasks-focus-head">
                      <div className="tasks-row-title">{item.text}</div>
                      <div className="tasks-actions">
                        <button
                          type="button"
                          className="tasks-complete-btn"
                          onClick={() => void updateItemDone(item, false)}
                          disabled={savingItemKey === `${item.dealId}-${item.kind}-${item.id}`}
                          aria-label={`Reopen ${item.text}`}
                        >
                          {savingItemKey === `${item.dealId}-${item.kind}-${item.id}` ? (
                            <Loader2 size={12} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <CheckCircle2 size={13} strokeWidth={2} />
                          )}
                          Undo
                        </button>
                        <Link
                          href={`/deals/${item.dealId}?tab=history`}
                          className="tasks-open-link"
                          aria-label={`Open ${item.dealLabel} history`}
                        >
                          <ChevronRight size={14} strokeWidth={1.8} />
                        </Link>
                      </div>
                    </div>
                    <div className="tasks-row-meta">
                      {item.dealLabel} · {item.updatedAt ? formatRelativeTime(item.updatedAt) : 'Completed'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function TasksPageFallback() {
  return (
    <div style={{ paddingTop: 4 }}>
      <div className="panel-section" style={{ padding: 24 }}>
        <div className="section-title">Tasks</div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>Loading task priorities…</div>
      </div>
    </div>
  )
}

export default function TasksPage() {
  return (
    <Suspense fallback={<TasksPageFallback />}>
      <TasksPageInner />
    </Suspense>
  )
}
