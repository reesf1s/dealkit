'use client'
export const dynamic = 'force-dynamic'

import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { useState, useRef } from 'react'
import { useSidebar } from '@/components/layout/SidebarContext'
import {
  Plus, TrendingUp, DollarSign, ChevronRight, Sparkles,
  CheckSquare, Square, MoreHorizontal, Target, Zap, ArrowUpRight,
  AlertCircle, Star, GripVertical, AlertTriangle, Clock
} from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// Annualise a deal's stored value so one-off and recurring are comparable
function annualizedValue(value: number, dealType?: string | null, recurringInterval?: string | null): number {
  if (!value) return 0
  if (dealType !== 'recurring') return value
  if (recurringInterval === 'monthly') return value * 12
  if (recurringInterval === 'quarterly') return value * 4
  return value
}

// Short label for a deal's value (e.g. "$5k/mo", "$60k ARR", "$30k")
function dealValueLabel(value: number, dealType?: string | null, recurringInterval?: string | null): string {
  const fmt = (v: number) => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}m` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}k` : `$${v}`
  if (dealType !== 'recurring') return fmt(value)
  if (recurringInterval === 'monthly') return `${fmt(value)}/mo`
  if (recurringInterval === 'quarterly') return `${fmt(value)}/qtr`
  return `${fmt(value)} ARR`
}

const STAGES = [
  { id: 'prospecting',   label: 'Prospecting',   color: '#6B7280' },
  { id: 'qualification', label: 'Qualification',  color: '#3B82F6' },
  { id: 'discovery',     label: 'Discovery',      color: '#8B5CF6' },
  { id: 'proposal',      label: 'Proposal',       color: '#F59E0B' },
  { id: 'negotiation',   label: 'Negotiation',    color: '#EF4444' },
  { id: 'closed_won',    label: 'Closed Won',     color: '#22C55E' },
  { id: 'closed_lost',   label: 'Closed Lost',    color: '#6B7280' },
]

function ScoreBadge({ score }: { score?: number | null }) {
  if (!score && score !== 0) return null
  const color = score >= 70 ? '#22C55E' : score >= 40 ? '#F59E0B' : '#EF4444'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', fontWeight: '700', color,
    }}>
      <Target size={10} />
      {score}%
    </div>
  )
}

function DealCard({
  deal,
  onMoveStage,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  deal: any
  onMoveStage: (id: string, stage: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  isDragging: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const nextStages = STAGES.filter(s => s.id !== deal.stage && s.id !== 'closed_won' && s.id !== 'closed_lost')
  const stageConfig = STAGES.find(s => s.id === deal.stage)

  const todos: any[] = deal.todos ?? []
  const doneTodos = todos.filter((t: any) => t.done).length

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', deal.id)
        // small delay so the ghost image captures before opacity change
        requestAnimationFrame(() => {
          onDragStart(deal.id)
        })
      }}
      onDragEnd={() => {
        onDragEnd()
      }}
      style={{
        background: 'rgba(18,12,32,0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(124,58,237,0.18)',
        borderRadius: '14px',
        padding: '14px',
        position: 'relative',
        transition: 'border-color 0.2s, transform 0.15s, opacity 0.15s',
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        if (!isDragging) {
          ;(e.currentTarget as HTMLElement).style.borderColor = `${stageConfig?.color ?? '#8B5CF6'}55`
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.18)'
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/deals/${deal.id}`} style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {deal.prospectCompany}
          </Link>
          {deal.prospectName && (
            <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>{deal.prospectName}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
          <ScoreBadge score={deal.conversionScore} />
          <div style={{ position: 'relative' }}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '2px', display: 'flex', borderRadius: '4px' }}
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '22px', zIndex: 50,
                background: 'rgba(9,6,18,0.97)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(139,92,246,0.2)',
                borderRadius: '10px', padding: '6px', minWidth: '160px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(124,58,237,0.08)',
              }}
              onMouseLeave={() => setMenuOpen(false)}
              >
                <div style={{ fontSize: '10px', color: '#555', padding: '4px 8px 2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Move to</div>
                {nextStages.map(s => (
                  <button key={s.id} onClick={() => { onMoveStage(deal.id, s.id); setMenuOpen(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 8px', background: 'none', border: 'none', color: '#EBEBEB', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                  >
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    {s.label}
                  </button>
                ))}
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                <button onClick={() => { onMoveStage(deal.id, 'closed_won'); setMenuOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 8px', background: 'none', border: 'none', color: '#22C55E', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                >
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                  Close Won
                </button>
                <button onClick={() => { onMoveStage(deal.id, 'closed_lost'); setMenuOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 8px', background: 'none', border: 'none', color: '#EF4444', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                >
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                  Close Lost
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      {deal.conversionInsights?.[0] && (
        <div style={{
          background: 'rgba(124,58,237,0.08)',
          border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: '9px', padding: '8px 10px', marginBottom: '10px',
          display: 'flex', gap: '6px', alignItems: 'flex-start',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>
          <Sparkles size={11} color="#A78BFA" style={{ marginTop: '1px', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', color: '#A78BFA', lineHeight: '1.5' }}>{deal.conversionInsights[0]}</span>
        </div>
      )}

      {/* Deal value + todos */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {deal.dealValue ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '700', color: '#22C55E' }}>
            <DollarSign size={11} />
            {dealValueLabel(deal.dealValue, deal.dealType, deal.recurringInterval)}
          </div>
        ) : <div />}
        {todos.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#555' }}>
            <CheckSquare size={11} color={doneTodos === todos.length ? '#22C55E' : '#555'} />
            {doneTodos}/{todos.length}
          </div>
        )}
      </div>

      {/* Bottom: view link */}
      <Link href={`/deals/${deal.id}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '10px', fontSize: '11px', color: '#4B5563', textDecoration: 'none', borderTop: '1px solid rgba(124,58,237,0.1)', paddingTop: '8px', transition: 'color 0.1s' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#A78BFA'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#4B5563'}
      >
        Open deal <ArrowUpRight size={10} style={{ marginLeft: 'auto' }} />
      </Link>
    </div>
  )
}

export default function PipelinePage() {
  const { sidebarWidth, aiSidebarWidth } = useSidebar()
  const { data: dealsData, isLoading } = useSWR('/api/deals', fetcher)
  const deals: any[] = dealsData?.data ?? []

  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  const moveStage = async (dealId: string, stage: string) => {
    // Optimistic update
    mutate('/api/deals', (current: any) => {
      if (!current?.data) return current
      return {
        ...current,
        data: current.data.map((d: any) =>
          d.id === dealId ? { ...d, stage } : d
        ),
      }
    }, false)

    await fetch(`/api/deals/${dealId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
    mutate('/api/deals')
  }

  const handleDrop = (stageId: string) => {
    if (draggedId && draggedId !== '') {
      const deal = deals.find(d => d.id === draggedId)
      if (deal && deal.stage !== stageId) {
        moveStage(draggedId, stageId)
      }
    }
    setDraggedId(null)
    setDragOverStage(null)
  }

  const activeStages = STAGES.filter(s => s.id !== 'closed_won' && s.id !== 'closed_lost')
  const totalPipeline = deals
    .filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    .reduce((sum: number, d: any) => sum + annualizedValue(d.dealValue ?? 0, d.dealType, d.recurringInterval), 0)
  const topDeals = deals
    .filter((d: any) => d.conversionScore)
    .sort((a: any, b: any) => (b.conversionScore ?? 0) - (a.conversionScore ?? 0))
    .slice(0, 3)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0, width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.03em', color: '#F0EEFF', marginBottom: '4px' }}>
            Sales Pipeline
          </h1>
          <p style={{ fontSize: '13px', color: '#9CA3AF' }}>
            {deals.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length} active deals
            {totalPipeline > 0 && ` · $${totalPipeline.toLocaleString()} pipeline value`}
            {' · '}
            <span style={{ color: '#6B7280' }}>Drag cards to move stages</span>
          </p>
        </div>
        <Link href="/deals" style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px',
          background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
          boxShadow: '0 0 20px rgba(99,102,241,0.3)',
          borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none',
        }}>
          <Plus size={14} /> Add Deal
        </Link>
      </div>

      {/* AI Top Picks */}
      {topDeals.length > 0 && (
        <div style={{ background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '14px', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '26px', height: '26px', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star size={12} color="#A78BFA" />
            </div>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>AI Top Picks to Close</span>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Highest conversion probability</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {topDeals.map((deal: any) => {
              const pendingTodos: any[] = (deal.todos ?? []).filter((t: any) => !t.done)
              const urgentTodo = pendingTodos[0]
              // Detect risk signals from insights (look for negative/warning language)
              const riskInsight = (deal.conversionInsights ?? []).find((ins: string) =>
                /risk|danger|concern|warn|block|stall|compet|objection|overdue|miss|lost|slow|churn|cancel|threat/i.test(ins)
              )
              const scoreColor = deal.conversionScore >= 70 ? '#22C55E' : deal.conversionScore >= 40 ? '#F59E0B' : '#EF4444'

              return (
                <Link key={deal.id} href={`/deals/${deal.id}`} style={{
                  flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '8px',
                  padding: '12px 14px',
                  background: 'rgba(124,58,237,0.06)',
                  border: '1px solid rgba(124,58,237,0.15)',
                  borderRadius: '10px', textDecoration: 'none',
                  transition: 'border-color 0.1s',
                  minWidth: '200px',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.35)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.15)'}
                >
                  {/* Top: name + score */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.prospectCompany}</div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                        {STAGES.find(s => s.id === deal.stage)?.label}
                        {deal.dealValue && ` · ${dealValueLabel(deal.dealValue, deal.dealType, deal.recurringInterval)}`}
                      </div>
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: '800', color: scoreColor, flexShrink: 0 }}>
                      {deal.conversionScore}%
                    </div>
                  </div>

                  {/* Risk signal */}
                  {riskInsight && (
                    <div style={{
                      display: 'flex', gap: '5px', alignItems: 'flex-start',
                      padding: '6px 8px', borderRadius: '7px',
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
                    }}>
                      <AlertTriangle size={10} color="#EF4444" style={{ marginTop: '1px', flexShrink: 0 }} />
                      <span style={{ fontSize: '10px', color: '#FCA5A5', lineHeight: '1.4' }}>{riskInsight}</span>
                    </div>
                  )}

                  {/* Urgent to-do */}
                  {urgentTodo && (
                    <div style={{
                      display: 'flex', gap: '5px', alignItems: 'flex-start',
                      padding: '6px 8px', borderRadius: '7px',
                      background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)',
                    }}>
                      <Clock size={10} color="#F59E0B" style={{ marginTop: '1px', flexShrink: 0 }} />
                      <span style={{ fontSize: '10px', color: '#FDE68A', lineHeight: '1.4' }}>
                        {urgentTodo.text}
                        {pendingTodos.length > 1 && <span style={{ color: '#92400E', marginLeft: '4px' }}>+{pendingTodos.length - 1} more</span>}
                      </span>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div style={{ overflowX: 'auto', paddingBottom: '8px', maxWidth: `calc(100vw - ${sidebarWidth}px - ${aiSidebarWidth}px - 48px)` }}>
        <div style={{ display: 'flex', gap: '12px', minWidth: 'max-content' }}>
          {activeStages.map(stage => {
            const stageDeals = deals.filter((d: any) => d.stage === stage.id)
            const stageValue = stageDeals.reduce((s: number, d: any) => s + annualizedValue(d.dealValue ?? 0, d.dealType, d.recurringInterval), 0)
            const isDropTarget = dragOverStage === stage.id && draggedId !== null

            return (
              <div
                key={stage.id}
                style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '10px' }}
                onDragOver={e => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOverStage(stage.id)
                }}
                onDragLeave={e => {
                  // Only clear if leaving the column itself (not a child)
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  if (
                    e.clientX < rect.left || e.clientX > rect.right ||
                    e.clientY < rect.top || e.clientY > rect.bottom
                  ) {
                    setDragOverStage(null)
                  }
                }}
                onDrop={e => {
                  e.preventDefault()
                  handleDrop(stage.id)
                }}
              >
                {/* Column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                  background: isDropTarget ? `rgba(${hexToRgb(stage.color)},0.12)` : 'rgba(18,12,32,0.7)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: isDropTarget ? `1px solid ${stage.color}55` : '1px solid rgba(124,58,237,0.18)',
                  borderRadius: '12px',
                  borderTop: `3px solid ${stage.color}`,
                  transition: 'background 0.15s, border-color 0.15s',
                }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: stage.color, boxShadow: `0 0 8px ${stage.color}` }} />
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#F0EEFF', flex: 1 }}>{stage.label}</span>
                  <span style={{ fontSize: '11px', color: '#9CA3AF', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.15)', padding: '1px 7px', borderRadius: '100px' }}>{stageDeals.length}</span>
                </div>
                {stageValue > 0 && (
                  <div style={{ fontSize: '11px', color: '#9CA3AF', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={10} />
                    ${stageValue.toLocaleString()} annualised
                  </div>
                )}

                {/* Cards */}
                {isLoading ? (
                  <div style={{ height: '80px', background: 'rgba(18,12,32,0.4)', borderRadius: '10px', border: '1px solid rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#4B5563' }}>Loading...</div>
                  </div>
                ) : stageDeals.length === 0 ? (
                  <div style={{
                    height: '80px',
                    background: isDropTarget ? `rgba(${hexToRgb(stage.color)},0.06)` : 'rgba(18,12,32,0.3)',
                    border: isDropTarget ? `1px dashed ${stage.color}88` : '1px dashed rgba(124,58,237,0.12)',
                    borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}>
                    <span style={{ fontSize: '11px', color: isDropTarget ? stage.color : '#4B5563' }}>
                      {isDropTarget ? 'Drop here' : 'No deals'}
                    </span>
                  </div>
                ) : (
                  stageDeals.map((deal: any) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      onMoveStage={moveStage}
                      onDragStart={setDraggedId}
                      onDragEnd={() => { setDraggedId(null); setDragOverStage(null) }}
                      isDragging={draggedId === deal.id}
                    />
                  ))
                )}

                {/* Add to stage */}
                <Link href="/deals" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '9px', background: 'rgba(18,12,32,0.3)',
                  border: '1px dashed rgba(124,58,237,0.15)',
                  borderRadius: '9px', color: '#4B5563', fontSize: '12px', textDecoration: 'none',
                  transition: 'color 0.1s, border-color 0.1s, background 0.1s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = '#A78BFA'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.3)'
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.08)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = '#4B5563'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.15)'
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(18,12,32,0.3)'
                }}
                >
                  <Plus size={12} /> Add deal
                </Link>
              </div>
            )
          })}

          {/* Won/Lost summary columns */}
          <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {['closed_won', 'closed_lost'].map(stageId => {
              const s = STAGES.find(x => x.id === stageId)!
              const stageDeals = deals.filter((d: any) => d.stage === stageId)
              const val = stageDeals.reduce((sum: number, d: any) => sum + annualizedValue(d.dealValue ?? 0, d.dealType, d.recurringInterval), 0)
              const isDropTarget = dragOverStage === stageId && draggedId !== null

              return (
                <div
                  key={stageId}
                  style={{
                    padding: '14px',
                    background: isDropTarget ? `rgba(${hexToRgb(s.color)},0.1)` : 'rgba(18,12,32,0.7)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: isDropTarget ? `1px solid ${s.color}55` : `1px solid rgba(124,58,237,0.18)`,
                    borderRadius: '14px',
                    borderTop: `3px solid ${s.color}`,
                    transition: 'background 0.15s, border-color 0.15s',
                    flex: 1,
                  }}
                  onDragOver={e => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDragOverStage(stageId)
                  }}
                  onDragLeave={e => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    if (
                      e.clientX < rect.left || e.clientX > rect.right ||
                      e.clientY < rect.top || e.clientY > rect.bottom
                    ) {
                      setDragOverStage(null)
                    }
                  }}
                  onDrop={e => {
                    e.preventDefault()
                    handleDrop(stageId)
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#F0EEFF' }}>{s.label}</span>
                    <span style={{ fontSize: '11px', color: '#9CA3AF', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.15)', padding: '1px 7px', borderRadius: '100px', marginLeft: 'auto' }}>{stageDeals.length}</span>
                  </div>
                  {val > 0 && <div style={{ fontSize: '18px', fontWeight: '700', color: s.color }}>${val.toLocaleString()}</div>}
                  {stageDeals.length === 0 && (
                    <div style={{ fontSize: '11px', color: isDropTarget ? s.color : '#4B5563' }}>
                      {isDropTarget ? 'Drop to close' : 'No deals yet'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// Utility: convert hex color to "r,g,b" string for rgba()
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '124,58,237'
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
}
