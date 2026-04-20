'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import useSWR from 'swr'
import { CheckCircle2, ChevronRight, Circle, ClipboardList, Sparkles } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { formatContextualDate, formatRelativeTime } from '@/lib/presentation'

type DealTodo = {
  id: string
  text: string
  done: boolean
  source?: 'manual' | 'ai'
  createdAt?: string
}

type SuccessCriterion = {
  id: string
  text: string
  achieved?: boolean
}

type ProjectPlanTask = {
  id: string
  text: string
  status?: 'not_started' | 'in_progress' | 'complete'
  dueDate?: string | null
}

type DealRecord = {
  id: string
  dealName: string
  prospectCompany: string
  stage: string
  conversionScore?: number | null
  updatedAt?: string
  todos?: DealTodo[] | null
  successCriteriaTodos?: SuccessCriterion[] | null
  projectPlan?: {
    phases?: Array<{
      name: string
      tasks?: ProjectPlanTask[]
    }>
  } | null
}

type WorkItem = {
  id: string
  dealId: string
  dealLabel: string
  kind: 'task' | 'project' | 'criterion'
  text: string
  meta: string
  done: boolean
  priorityScore: number
  updatedAt?: string
}

function stageLabel(stage?: string | null) {
  if (!stage) return 'Pipeline'
  return stage.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function buildWorkItems(deals: DealRecord[]): WorkItem[] {
  return deals.flatMap(deal => {
    const baseLabel = deal.dealName || deal.prospectCompany
    const score = deal.conversionScore ?? 50
    const projectItems = (deal.projectPlan?.phases ?? []).flatMap(phase =>
      (phase.tasks ?? []).map(task => ({
        id: task.id,
        dealId: deal.id,
        dealLabel: baseLabel,
        kind: 'project' as const,
        text: task.text,
        meta: `${phase.name}${task.dueDate ? ` · ${formatContextualDate(task.dueDate)}` : ''}`,
        done: task.status === 'complete',
        priorityScore: score,
        updatedAt: deal.updatedAt,
      })),
    )
    const todoItems = (deal.todos ?? []).map(todo => ({
      id: todo.id,
      dealId: deal.id,
      dealLabel: baseLabel,
      kind: 'task' as const,
      text: todo.text,
      meta: `${stageLabel(deal.stage)}${todo.createdAt ? ` · ${formatRelativeTime(todo.createdAt)}` : ''}${todo.source === 'ai' ? ' · AI' : ''}`,
      done: todo.done,
      priorityScore: score,
      updatedAt: deal.updatedAt,
    }))
    const criteriaItems = (deal.successCriteriaTodos ?? []).map(item => ({
      id: item.id,
      dealId: deal.id,
      dealLabel: baseLabel,
      kind: 'criterion' as const,
      text: item.text,
      meta: `${stageLabel(deal.stage)} · Success criteria`,
      done: Boolean(item.achieved),
      priorityScore: score,
      updatedAt: deal.updatedAt,
    }))
    return [...todoItems, ...projectItems, ...criteriaItems]
  })
}

export default function TasksPage() {
  const { data, isLoading } = useSWR<{ data: DealRecord[] }>('/api/deals', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45_000,
  })

  const items = buildWorkItems(data?.data ?? [])
  const openItems = items
    .filter(item => !item.done)
    .sort((left, right) => left.priorityScore - right.priorityScore)
  const doneItems = items
    .filter(item => item.done)
    .sort((left, right) => new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime())

  return (
    <div style={{ paddingTop: 4, maxWidth: 1120 }}>
      <style>{`
        @media (max-width: 900px) {
          .tasks-summary-grid,
          .tasks-page-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>Workspace</div>
          <h1 className="page-title" style={{ margin: 0 }}>Tasks</h1>
          <div className="page-subtitle">Every open action, milestone, and success check across the pipeline.</div>
        </div>
        <div className="notion-chip">
          <Sparkles size={12} strokeWidth={2} />
          {openItems.length} open across {new Set(openItems.map(item => item.dealId)).size} deals
        </div>
      </div>

      <div className="panel-section" style={{ padding: 20, marginBottom: 16 }}>
        <div className="tasks-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          {[
            { label: 'Open items', value: openItems.length },
            { label: 'Completed', value: doneItems.length },
            { label: 'Deals covered', value: new Set(items.map(item => item.dealId)).size },
            { label: 'AI generated', value: items.filter(item => item.meta.includes('AI')).length },
          ].map(stat => (
            <div key={stat.label} className="surface-glass-light" style={{ padding: 14, borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.04em', lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="tasks-page-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div className="panel-section" style={{ padding: 20 }}>
          <div className="manage-head">
            <div className="manage-title">
              <ClipboardList size={14} strokeWidth={2} />
              Open work
            </div>
          </div>
          {isLoading ? (
            <div className="skeleton" style={{ height: 220, borderRadius: 'var(--radius)' }} />
          ) : openItems.length === 0 ? (
            <div style={{ display: 'grid', placeItems: 'center', minHeight: 220, textAlign: 'center', color: 'var(--ink-3)' }}>
              <div>
                <CheckCircle2 size={22} style={{ color: 'var(--signal)', display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>No open tasks right now</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>The pipeline is clear or work is being tracked directly on each deal.</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {openItems.map(item => (
                <Link key={`${item.dealId}-${item.kind}-${item.id}`} href={`/deals/${item.dealId}?tab=manage`} style={{ textDecoration: 'none' }}>
                  <div className="surface-glass-light" style={{ padding: 14, borderRadius: 'var(--radius)', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center' }}>
                    <div className={`criteria-status ${item.kind === 'criterion' ? 'partial' : item.kind === 'project' ? 'met' : 'missing'}`}>
                      {item.kind === 'criterion' ? '!' : item.kind === 'project' ? <Circle size={10} strokeWidth={2} /> : null}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{item.text}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>
                        {item.dealLabel} · {item.meta}
                      </div>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--ink-4)' }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="panel-section" style={{ padding: 20 }}>
          <div className="manage-head">
            <div className="manage-title">
              <CheckCircle2 size={14} strokeWidth={2} />
              Recently completed
            </div>
          </div>
          {doneItems.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Completed items will show up here once the team closes out work.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {doneItems.slice(0, 8).map(item => (
                <Link key={`${item.dealId}-${item.kind}-${item.id}`} href={`/deals/${item.dealId}?tab=history`} style={{ textDecoration: 'none' }}>
                  <div className="surface-glass-light" style={{ padding: 12, borderRadius: 'var(--radius)' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{item.text}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>
                      {item.dealLabel} · {item.updatedAt ? formatRelativeTime(item.updatedAt) : 'Completed'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
