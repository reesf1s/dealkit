'use client'
export const dynamic = 'force-dynamic'

import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { useState, useRef } from 'react'
import { useSidebar } from '@/components/layout/SidebarContext'
import {
  Plus, TrendingUp, DollarSign, Sparkles,
  CheckSquare, MoreHorizontal, Target, Zap, ArrowUpRight,
  Star, AlertTriangle, Clock, Calendar,
  Settings, Edit, X, Trash2, Check,
  Kanban, List, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, Send, Home,
} from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── Brain-powered urgency/stale/ML lookup ──────────────────────────────────
function useDealFlags(deals: any[]) {
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data
  if (!brain) return {
    urgentMap: {} as Record<string, string>,
    staleMap: {} as Record<string, number>,
    mlMap: {} as Record<string, { churnRisk?: number; winProb?: number }>,
    daysInStageMap: {} as Record<string, number>,
    momentumMap: {} as Record<string, 'hot' | 'cooling' | null>,
  }
  const urgentMap: Record<string, string> = {}
  const staleMap: Record<string, number> = {}
  const mlMap: Record<string, { churnRisk?: number; winProb?: number }> = {}
  for (const u of (brain.urgentDeals ?? [])) urgentMap[u.dealId] = u.reason
  for (const s of (brain.staleDeals ?? [])) staleMap[s.dealId] = s.daysSinceUpdate
  for (const p of (brain.mlPredictions ?? [])) {
    mlMap[p.dealId] = {
      churnRisk: p.churnRisk,
      winProb: p.winProbability != null ? Math.round(p.winProbability * 100) : undefined,
    }
  }
  const daysInStageMap: Record<string, number> = {}
  const momentumMap: Record<string, 'hot' | 'cooling' | null> = {}
  for (const deal of deals) {
    const days = Math.floor((Date.now() - new Date(deal.updatedAt ?? deal.createdAt).getTime()) / 86_400_000)
    daysInStageMap[deal.id] = days
    const ml = mlMap[deal.id]
    const churnRisk = ml?.churnRisk ?? 0
    const winProb = ml?.winProb != null ? ml.winProb / 100 : 0
    if (churnRisk >= 65) {
      momentumMap[deal.id] = 'cooling'
    } else if (churnRisk < 30 && winProb >= 0.7) {
      momentumMap[deal.id] = 'hot'
    } else {
      momentumMap[deal.id] = null
    }
  }
  return { urgentMap, staleMap, mlMap, daysInStageMap, momentumMap }
}

// Annualise a deal's stored value so one-off and recurring are comparable
function annualizedValue(value: number, dealType?: string | null, recurringInterval?: string | null): number {
  if (!value) return 0
  if (dealType !== 'recurring') return value
  if (recurringInterval === 'monthly') return value * 12
  if (recurringInterval === 'quarterly') return value * 4
  return value
}

// Short label for a deal's value (e.g. "£5k/mo", "£60k ARR", "£30k")
function dealValueLabel(value: number, dealType?: string | null, recurringInterval?: string | null, sym = '$'): string {
  const fmt = (v: number) => v >= 1_000_000 ? `${sym}${(v/1_000_000).toFixed(1)}m` : v >= 1_000 ? `${sym}${(v/1_000).toFixed(0)}k` : `${sym}${Math.round(v)}`
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
  const color = score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--danger)'
  const bg = score >= 70 ? 'color-mix(in srgb, var(--success) 10%, transparent)' : score >= 40 ? 'color-mix(in srgb, var(--warning) 10%, transparent)' : 'color-mix(in srgb, var(--danger) 10%, transparent)'
  const border = score >= 70 ? 'color-mix(in srgb, var(--success) 25%, transparent)' : score >= 40 ? 'color-mix(in srgb, var(--warning) 25%, transparent)' : 'color-mix(in srgb, var(--danger) 25%, transparent)'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '3px',
      padding: '3px 7px', borderRadius: '100px',
      background: bg, border: `1px solid ${border}`,
      fontSize: '11px', fontWeight: '700', color,
    }}>
      <Target size={9} />
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
  urgentReason,
  staleDays,
  churnRisk,
  daysInStage,
  momentum,
  currencySymbol = '$',
  allStages,
}: {
  deal: any
  onMoveStage: (id: string, stage: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  isDragging: boolean
  urgentReason?: string
  staleDays?: number
  churnRisk?: number
  daysInStage?: number
  momentum?: 'hot' | 'cooling' | null
  currencySymbol?: string
  allStages?: { id: string; label: string; color: string }[]
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const nextStages = (allStages ?? STAGES).filter(s => s.id !== deal.stage && s.id !== 'closed_won' && s.id !== 'closed_lost')
  const stageConfig = (allStages ?? STAGES).find(s => s.id === deal.stage)

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
        background: 'var(--card-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--card-border)',
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
          ;(e.currentTarget as HTMLElement).style.borderColor = `${stageConfig?.color ?? 'var(--accent)'}55`
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/deals/${deal.id}`} style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {deal.prospectCompany}
          </Link>
          {deal.prospectName && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>{deal.prospectName}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
          <ScoreBadge score={deal.conversionScore} />
          <div style={{ position: 'relative' }}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px', display: 'flex', borderRadius: '4px' }}
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '22px', zIndex: 50,
                background: 'var(--elevated)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid var(--border-strong)',
                borderRadius: '10px', padding: '6px', minWidth: '160px',
                boxShadow: 'var(--shadow-lg)',
              }}
              onMouseLeave={() => setMenuOpen(false)}
              >
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', padding: '4px 8px 2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Move to</div>
                {nextStages.map(s => (
                  <button key={s.id} onClick={() => { onMoveStage(deal.id, s.id); setMenuOpen(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 8px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                  >
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    {s.label}
                  </button>
                ))}
                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                <button onClick={() => { onMoveStage(deal.id, 'closed_won'); setMenuOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 8px', background: 'none', border: 'none', color: 'var(--success)', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--success) 8%, transparent)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                >
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                  Close Won
                </button>
                <button onClick={() => { onMoveStage(deal.id, 'closed_lost'); setMenuOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 8px', background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--danger) 8%, transparent)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                >
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
                  Close Lost
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Urgency / stale signals from brain */}
      {urgentReason && (
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '5px 8px', borderRadius: '6px', background: 'color-mix(in srgb, var(--danger) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)', marginBottom: '8px' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
          <span style={{ fontSize: '10px', color: 'var(--danger)', lineHeight: 1.4 }}>{urgentReason}</span>
        </div>
      )}
      {!urgentReason && staleDays !== undefined && staleDays >= 14 && (
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '5px 8px', borderRadius: '6px', background: 'color-mix(in srgb, var(--warning) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 12%, transparent)', marginBottom: '8px' }}>
          <Clock size={9} style={{ color: 'var(--warning)' }} />
          <span style={{ fontSize: '10px', color: 'var(--warning)' }}>{staleDays}d since last update</span>
        </div>
      )}
      {/* Churn risk — ML survival model signal */}
      {!urgentReason && churnRisk !== undefined && churnRisk >= 65 && (
        <div style={{
          display: 'flex', gap: '5px', alignItems: 'center',
          padding: '5px 8px', borderRadius: '6px',
          background: churnRisk >= 85 ? 'color-mix(in srgb, var(--danger) 8%, transparent)' : 'color-mix(in srgb, var(--warning) 5%, transparent)',
          border: churnRisk >= 85 ? '1px solid color-mix(in srgb, var(--danger) 20%, transparent)' : '1px solid color-mix(in srgb, var(--warning) 15%, transparent)',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '10px' }}>🔇</span>
          <span style={{ fontSize: '10px', color: churnRisk >= 85 ? 'var(--danger)' : 'var(--warning)' }}>
            {churnRisk}% going silent
          </span>
        </div>
      )}
      {/* Days in stage badge */}
      {daysInStage !== undefined && daysInStage > 0 && (
        <div style={{
          display: 'flex', gap: '5px', alignItems: 'center',
          padding: '4px 8px', borderRadius: '6px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>⏱ {daysInStage}d in stage</span>
        </div>
      )}
      {/* Momentum: hot badge (cooling is already covered by churnRisk badge) */}
      {momentum === 'hot' && (
        <div style={{
          display: 'flex', gap: '5px', alignItems: 'center',
          padding: '4px 8px', borderRadius: '6px',
          background: 'color-mix(in srgb, var(--success) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '10px', color: 'var(--success)' }}>🔥 Hot</span>
        </div>
      )}
      {/* Contract end date badge */}
      {deal.contractEndDate && (() => {
        const endDate = new Date(deal.contractEndDate)
        const now = new Date()
        const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000)
        const isExpiringSoon = daysUntilEnd >= 0 && daysUntilEnd <= 30
        const isExpired = daysUntilEnd < 0
        const badgeColor = isExpired ? 'var(--danger)' : isExpiringSoon ? 'var(--warning)' : 'var(--text-secondary)'
        const badgeBg = isExpired
          ? 'color-mix(in srgb, var(--danger) 8%, transparent)'
          : isExpiringSoon
            ? 'color-mix(in srgb, var(--warning) 8%, transparent)'
            : 'var(--surface)'
        const badgeBorder = isExpired
          ? 'color-mix(in srgb, var(--danger) 20%, transparent)'
          : isExpiringSoon
            ? 'color-mix(in srgb, var(--warning) 20%, transparent)'
            : 'var(--border)'
        const label = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        return (
          <div style={{
            display: 'flex', gap: '5px', alignItems: 'center',
            padding: '4px 8px', borderRadius: '6px',
            background: badgeBg,
            border: `1px solid ${badgeBorder}`,
            marginBottom: '8px',
          }}>
            <Calendar size={9} style={{ color: badgeColor, flexShrink: 0 }} />
            <span style={{ fontSize: '10px', color: badgeColor }}>
              {isExpired ? `Expired ${label}` : isExpiringSoon ? `Expires ${label}` : `Ends ${label}`}
            </span>
          </div>
        )
      })()}

      {/* AI Insights — filter out score-summary insights to avoid conflicting with ML % badge */}
      {(() => {
        const firstInsight = (deal.conversionInsights ?? []).find((ins: string) => !/\d+\s*\/\s*100/i.test(ins))
        return firstInsight ? (
          <div style={{
            background: 'var(--accent-subtle)',
            border: '1px solid var(--border-strong)',
            borderRadius: '9px', padding: '8px 10px', marginBottom: '10px',
            display: 'flex', gap: '6px', alignItems: 'flex-start',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}>
            <Sparkles size={11} style={{ color: 'var(--accent)', marginTop: '1px', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--accent)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{firstInsight}</span>
          </div>
        ) : null
      })()}

      {/* Deal value + todos */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {deal.dealValue ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '700', color: 'var(--success)' }}>
            <DollarSign size={11} />
            {dealValueLabel(deal.dealValue, deal.dealType, deal.recurringInterval, currencySymbol)}
          </div>
        ) : <div />}
        {todos.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
            <CheckSquare size={11} style={{ color: doneTodos === todos.length ? 'var(--success)' : 'var(--text-tertiary)' }} />
            {doneTodos}/{todos.length}
          </div>
        )}
      </div>

      {/* Bottom: view link */}
      <Link href={`/deals/${deal.id}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '10px', fontSize: '11px', color: 'var(--text-tertiary)', textDecoration: 'none', borderTop: '1px solid var(--border)', paddingTop: '8px', transition: 'color 0.1s' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
      >
        Open deal <ArrowUpRight size={10} style={{ marginLeft: 'auto' }} />
      </Link>
    </div>
  )
}

function PipelineSettings({
  open, onClose, config, presets, onUpdate
}: {
  open: boolean; onClose: () => void; config: any; presets: any[]; onUpdate: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('#8B5CF6')

  if (!open) return null

  const stages = config?.stages ?? []

  const rename = async (id: string) => {
    if (!editLabel.trim()) return
    await fetch('/api/pipeline-config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ renameStage: { id, label: editLabel } }),
    })
    setEditingId(null)
    onUpdate()
  }

  const addStage = async () => {
    if (!newLabel.trim()) return
    await fetch('/api/pipeline-config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addStage: { label: newLabel, color: newColor } }),
    })
    setNewLabel('')
    onUpdate()
  }

  const removeStage = async (id: string) => {
    await fetch('/api/pipeline-config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeStage: id }),
    })
    onUpdate()
  }

  const applyPreset = async (presetId: string) => {
    await fetch('/api/pipeline-config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applyPreset: presetId }),
    })
    onUpdate()
  }

  const toggleHide = async (id: string, isHidden: boolean) => {
    await fetch('/api/pipeline-config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isHidden ? { showStage: id } : { hideStage: id }),
    })
    onUpdate()
  }

  const moveStageOrder = async (stageId: string, direction: 'up' | 'down') => {
    const nonHidden = stages.filter((s: any) => !s.isHidden)
    const idx = stages.findIndex((s: any) => s.id === stageId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= stages.length) return
    // Don't swap past closed stages
    if (stages[swapIdx].id === 'closed_won' || stages[swapIdx].id === 'closed_lost') return
    if (stages[idx].id === 'closed_won' || stages[idx].id === 'closed_lost') return
    const newOrder = stages.map((s: any) => s.id)
    ;[newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]]
    await fetch('/api/pipeline-config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reorderStages: newOrder }),
    })
    onUpdate()
  }

  const PRESET_COLORS = ['#6B7280', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#22C55E', '#EC4899', '#14B8A6', '#F97316']

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '520px', maxHeight: '80vh', overflowY: 'auto',
          background: 'var(--elevated)', border: '1px solid var(--border-strong)',
          borderRadius: '16px', padding: '24px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Pipeline Columns</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Industry Presets */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Industry Presets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {presets.map((p: any) => (
              <button key={p.id} onClick={() => applyPreset(p.id)} style={{
                padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                background: config?.industryPreset === p.id ? 'var(--accent-subtle)' : 'var(--surface)',
                border: `1px solid ${config?.industryPreset === p.id ? 'var(--accent)' : 'var(--border)'}`,
                color: config?.industryPreset === p.id ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer',
              }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Current Stages */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Stages</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {stages.map((s: any) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px',
                opacity: s.isHidden ? 0.4 : 1,
              }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: s.color, flexShrink: 0 }} />
                {editingId === s.id ? (
                  <form onSubmit={e => { e.preventDefault(); rename(s.id) }} style={{ flex: 1, display: 'flex', gap: '6px' }}>
                    <input autoFocus value={editLabel} onChange={e => setEditLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') setEditingId(null) }}
                      style={{ flex: 1, background: 'var(--input-bg)', border: '1px solid var(--accent)', borderRadius: '5px', padding: '3px 8px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                    />
                    <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', display: 'flex' }}><Check size={14} /></button>
                    <button type="button" onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
                  </form>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{s.label}</span>
                    {s.isDefault && <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', background: 'var(--surface)', borderRadius: '3px', padding: '1px 5px' }}>default</span>}
                    {s.id !== 'closed_won' && s.id !== 'closed_lost' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginLeft: 'auto' }}>
                        <button onClick={() => moveStageOrder(s.id, 'up')}
                          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0', display: 'flex', lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
                        ><ChevronUp size={12} /></button>
                        <button onClick={() => moveStageOrder(s.id, 'down')}
                          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0', display: 'flex', lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
                        ><ChevronDown size={12} /></button>
                      </div>
                    )}
                    <button onClick={() => { setEditingId(s.id); setEditLabel(s.label) }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
                    ><Edit size={12} /></button>
                    <button onClick={() => toggleHide(s.id, s.isHidden)} style={{ background: 'none', border: 'none', color: s.isHidden ? 'var(--accent)' : 'var(--text-tertiary)', cursor: 'pointer', padding: '2px', display: 'flex', fontSize: '11px' }}>
                      {s.isHidden ? 'Show' : 'Hide'}
                    </button>
                    {!s.isDefault && (
                      <button onClick={() => removeStage(s.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--danger)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
                      ><Trash2 size={12} /></button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add Custom Stage */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Add Custom Stage</div>
          <form onSubmit={e => { e.preventDefault(); addStage() }} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setNewColor(c)} style={{
                  width: '20px', height: '20px', borderRadius: '4px', background: c, border: newColor === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', padding: 0,
                }} />
              ))}
            </div>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Stage name..."
              style={{ flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '7px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
            />
            <button type="submit" disabled={!newLabel.trim()} style={{
              padding: '8px 16px', background: !newLabel.trim() ? 'var(--surface)' : 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
              border: 'none', borderRadius: '7px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: !newLabel.trim() ? 'not-allowed' : 'pointer',
            }}>Add</button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Calendar View ────────────────────────────────────────────────────────────
type CalEvent = {
  id: string
  title: string
  subtitle: string
  date: Date
  dealId: string
  type: 'close' | 'contract_start' | 'contract_end' | 'follow_up' | 'urgent'
}

function CalendarView({ deals, brainData }: { deals: any[]; brainData: any }) {
  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // Build calendar events from deals
  const events: CalEvent[] = []
  for (const deal of deals) {
    if (deal.closeDate) {
      events.push({
        id: `${deal.id}-close`,
        title: deal.prospectCompany,
        subtitle: 'Close target',
        date: new Date(deal.closeDate),
        dealId: deal.id,
        type: 'close',
      })
    }
    if (deal.contractStartDate) {
      events.push({
        id: `${deal.id}-cstart`,
        title: deal.prospectCompany,
        subtitle: 'Contract starts',
        date: new Date(deal.contractStartDate),
        dealId: deal.id,
        type: 'contract_start',
      })
    }
    if (deal.contractEndDate) {
      events.push({
        id: `${deal.id}-cend`,
        title: deal.prospectCompany,
        subtitle: 'Contract renews',
        date: new Date(deal.contractEndDate),
        dealId: deal.id,
        type: 'contract_end',
      })
    }
  }
  for (const s of (brainData?.staleDeals ?? [])) {
    const deal = deals.find((d: any) => d.id === s.dealId)
    if (!deal) continue
    const baseDate = new Date(deal.updatedAt ?? deal.createdAt)
    const followUpDate = new Date(baseDate.getTime() + 14 * 86_400_000)
    events.push({
      id: `${deal.id}-stale`,
      title: deal.prospectCompany,
      subtitle: `Follow up (${s.daysSinceUpdate}d without update)`,
      date: followUpDate,
      dealId: deal.id,
      type: 'follow_up',
    })
  }
  for (const u of (brainData?.urgentDeals ?? [])) {
    events.push({
      id: `${u.dealId}-urgent`,
      title: u.company,
      subtitle: u.reason,
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      dealId: u.dealId,
      type: 'urgent',
    })
  }

  const eventColor = (type: CalEvent['type']) => {
    if (type === 'close') return 'var(--danger)'
    if (type === 'follow_up') return 'var(--warning)'
    if (type === 'urgent') return 'var(--danger)'
    if (type === 'contract_start') return 'var(--success)'
    if (type === 'contract_end') return 'var(--accent)'
    return 'var(--text-secondary)'
  }

  const year = month.getFullYear()
  const mon = month.getMonth()
  const firstDay = new Date(year, mon, 1).getDay()
  const daysInMonth = new Date(year, mon + 1, 0).getDate()

  // 6 rows × 7 cols = 42 cells
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length < 42) cells.push(null)

  const eventsThisMonth = events
    .filter(e => e.date.getFullYear() === year && e.date.getMonth() === mon)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const eventsOnDay = (day: number) =>
    events.filter(e => e.date.getFullYear() === year && e.date.getMonth() === mon && e.date.getDate() === day)

  const isToday = (day: number) =>
    day === today.getDate() && mon === today.getMonth() && year === today.getFullYear()

  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Calendar card */}
      <div style={{
        background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px',
      }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <button
            onClick={() => setMonth(new Date(year, mon - 1, 1))}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>{monthLabel}</span>
          <button
            onClick={() => setMonth(new Date(year, mon + 1, 1))}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
          {DOW.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} style={{ height: '52px' }} />
            }
            const dayEvents = eventsOnDay(day)
            const todayCell = isToday(day)
            const selected = selectedDay === day
            return (
              <div
                key={day}
                onClick={() => setSelectedDay(selected ? null : day)}
                style={{
                  height: '52px', borderRadius: '8px', padding: '6px',
                  background: todayCell
                    ? 'var(--accent-subtle)'
                    : selected
                      ? 'var(--surface)'
                      : 'transparent',
                  border: todayCell
                    ? '1px solid var(--accent)'
                    : selected
                      ? '1px solid var(--border-strong)'
                      : '1px solid transparent',
                  cursor: dayEvents.length > 0 ? 'pointer' : 'default',
                  transition: 'background 0.1s, border-color 0.1s',
                  display: 'flex', flexDirection: 'column', gap: '3px',
                }}
                onMouseEnter={e => { if (!todayCell) (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                onMouseLeave={e => { if (!todayCell && !selected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{
                  fontSize: '12px', fontWeight: todayCell ? '700' : '500',
                  color: todayCell ? 'var(--accent)' : 'var(--text-primary)',
                  lineHeight: 1,
                }}>{day}</span>
                {dayEvents.length > 0 && (
                  <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} style={{ width: '6px', height: '6px', borderRadius: '50%', background: eventColor(ev.type), flexShrink: 0 }} />
                    ))}
                    {dayEvents.length > 3 && (
                      <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>+{dayEvents.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Events this month */}
      {eventsThisMonth.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Events this month
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {eventsThisMonth.map(ev => {
              const isPast = ev.date < today && !(ev.date.getDate() === today.getDate() && ev.date.getMonth() === today.getMonth() && ev.date.getFullYear() === today.getFullYear())
              const dateStr = ev.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              return (
                <div key={ev.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px',
                  background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid var(--card-border)', borderRadius: '10px',
                  opacity: isPast ? 0.5 : 1,
                  transition: 'opacity 0.1s',
                }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: eventColor(ev.type), flexShrink: 0 }} />
                  <Link href={`/deals/${ev.dealId}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>{ev.subtitle}</div>
                  </Link>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{dateStr}</div>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette', { detail: { query: `Prep me for ${ev.title} — ${ev.subtitle} on ${dateStr}. Review the deal and tell me what I need to know and do before this date.` } }))}
                    style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '5px 10px', borderRadius: '6px',
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.10))',
                      border: '1px solid rgba(99,102,241,0.25)',
                      color: 'var(--accent)', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                    }}
                  >
                    <Sparkles size={10} />
                    Prep
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {eventsThisMonth.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
          No events this month. Add close dates, contract dates, or follow-ups to deals to see them here.
        </div>
      )}
    </div>
  )
}

export default function PipelinePage() {
  const { sidebarWidth } = useSidebar()
  const { data: dealsData, isLoading } = useSWR('/api/deals', fetcher)
  const deals: any[] = dealsData?.data ?? []
  const { urgentMap, staleMap, mlMap, daysInStageMap, momentumMap } = useDealFlags(deals)
  const { data: configData, mutate: mutateConfig } = useSWR('/api/pipeline-config', fetcher)
  const pipelineConfig = configData?.data
  const presets = configData?.presets ?? []
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })

  const [view, setView] = useState<'today' | 'board' | 'calendar'>('today')
  const [aiInput, setAiInput] = useState('')
  const aiInputRef = useRef<HTMLInputElement>(null)

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

  // Currency symbol from workspace config (default '$')
  const currencySymbol: string = pipelineConfig?.currency ?? '$'

  // Use custom pipeline config if available, otherwise use defaults
  const configStages = pipelineConfig?.stages ?? STAGES
  const activeStages = configStages.filter((s: any) => s.id !== 'closed_won' && s.id !== 'closed_lost' && !s.isHidden)
  const closedStages = configStages.filter((s: any) => s.id === 'closed_won' || s.id === 'closed_lost')
  const totalPipeline = deals
    .filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    .reduce((sum: number, d: any) => sum + annualizedValue(d.dealValue ?? 0, d.dealType, d.recurringInterval), 0)
  // Brain's Top Picks: stage-weighted ranking so later-stage deals rank higher than
  // early-stage deals with similar raw scores (Demo Phase shouldn't beat Verbal Commit).
  // Stage norm: 0 = earliest active stage → 1 = latest active stage before closed.
  const activeStageIds = activeStages.map((s: any) => s.id)
  function dealStageNorm(stage: string): number {
    const idx = activeStageIds.indexOf(stage)
    if (idx === -1) return 0.5
    return activeStageIds.length > 1 ? idx / (activeStageIds.length - 1) : 0.5
  }
  // compositeRank = rawScore × (0.5 + 0.5 × stageNorm)
  // A negotiation deal (norm=1) gets full score weight; prospecting (norm=0) is halved.
  function compositeRank(deal: any): number {
    const raw = mlMap[deal.id]?.winProb ?? deal.conversionScore ?? 0
    return raw * (0.5 + 0.5 * dealStageNorm(deal.stage))
  }
  const topDeals = deals
    .filter((d: any) => (mlMap[d.id]?.winProb || d.conversionScore) && d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    .sort((a: any, b: any) => compositeRank(b) - compositeRank(a))
    .slice(0, 3)

  const urgentCount = Object.keys(urgentMap).length
  const staleCount = Object.keys(staleMap).length
  const churnCount = Object.values(mlMap).filter(m => (m.churnRisk ?? 0) >= 65).length

  // ── Action Queue: merge stale/urgent/deteriorating/recs into one prioritised list ──────────
  // Each item has a specific Ask AI prompt so the user can act immediately.
  const brainData = brainRes?.data
  const actionQueue = (() => {
    if (!brainData) return []
    type ActionItem = {
      dealId: string; company: string; dealName: string
      headline: string; detail: string
      priority: 'high' | 'medium' | 'low'
      actionType: string; prompt: string
    }
    const items: ActionItem[] = []
    const seen = new Set<string>()

    // 1. Stale deals — most actionable: no one has touched these
    for (const s of (brainData.staleDeals ?? []).slice(0, 3)) {
      if (seen.has(s.dealId)) continue
      seen.add(s.dealId)
      const deal = deals.find((d: any) => d.id === s.dealId)
      const stageLabel = configStages.find((c: any) => c.id === deal?.stage)?.label ?? deal?.stage ?? 'unknown stage'
      items.push({
        dealId: s.dealId, company: s.company, dealName: s.dealName,
        headline: `Stale — ${s.daysSinceUpdate}d`,
        detail: `${s.company} · ${stageLabel} · no update in ${s.daysSinceUpdate} days`,
        priority: s.daysSinceUpdate >= 21 ? 'high' : 'medium',
        actionType: 'stale',
        prompt: `The ${s.dealName} deal with ${s.company} has had no update for ${s.daysSinceUpdate} days (currently at ${stageLabel} stage). Review everything we know about this deal and help me: 1) assess what's likely happening, 2) identify who I should be chasing and what their likely concern is, 3) draft a short follow-up message to get this deal moving again.`,
      })
    }

    // 2. Urgent deals — close dates, high-risk late-stage
    for (const u of (brainData.urgentDeals ?? []).slice(0, 3)) {
      if (seen.has(u.dealId)) continue
      seen.add(u.dealId)
      items.push({
        dealId: u.dealId, company: u.company, dealName: u.dealName,
        headline: 'Urgent',
        detail: `${u.company} · ${u.reason}`,
        priority: 'high',
        actionType: 'urgent',
        prompt: `The ${u.dealName} deal with ${u.company} needs urgent attention: ${u.reason}. Review the full deal history and tell me the single most important thing I should do right now, with a specific suggested action or message.`,
      })
    }

    // 3. Deterioration alerts — things quietly going wrong
    for (const d of (brainData.deteriorationAlerts ?? []).slice(0, 2)) {
      if (seen.has(d.dealId)) continue
      seen.add(d.dealId)
      items.push({
        dealId: d.dealId, company: d.company, dealName: d.dealName,
        headline: 'Signals declining',
        detail: `${d.company} · ${d.warning}`,
        priority: 'high',
        actionType: 'risk',
        prompt: `The ${d.dealName} deal with ${d.company} is showing declining signals — ${d.warning}. Review the full deal notes and context, identify what has changed and why it may be cooling, and suggest the best approach to re-engage or address the underlying concern.`,
      })
    }

    // 4. Brain recommendations — advance/unblock deals
    for (const r of (brainData.pipelineRecommendations ?? []).slice(0, 3)) {
      if (seen.has(r.dealId) || items.length >= 5) break
      seen.add(r.dealId)
      items.push({
        dealId: r.dealId, company: r.company, dealName: r.dealName,
        headline: r.action ?? 'Review',
        detail: `${r.company} · ${r.recommendation}`,
        priority: r.priority,
        actionType: r.actionType ?? 'custom',
        prompt: `For the ${r.dealName} deal with ${r.company}: ${r.recommendation}. Review everything you know about this deal and help me take the best action right now.`,
      })
    }

    return items.slice(0, 5)
  })()

  const activeDeals = deals.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

  const dispatchAI = (query: string) => {
    if (!query.trim()) return
    window.dispatchEvent(new CustomEvent('openCommandPalette', { detail: { query } }))
    setAiInput('')
  }

  // ── Tab bar ──────────────────────────────────────────────────────────────
  const tabBarStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '8px',
  }
  const tabGroupStyle: React.CSSProperties = {
    display: 'flex', gap: '4px',
  }
  const tabBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px', borderRadius: '8px',
    fontSize: '12px', fontWeight: '500',
    cursor: 'pointer', border: 'none', outline: 'none',
    background: active ? 'var(--accent)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text-secondary)',
    ...(active ? {} : { border: '1px solid var(--border)' }),
    transition: 'background 0.15s, color 0.15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%' }}>

      {/* Tab bar */}
      <div style={tabBarStyle}>
        <div style={tabGroupStyle}>
          <button style={tabBtn(view === 'today')} onClick={() => setView('today')}>
            <Home size={13} />
            Today
          </button>
          <button style={tabBtn(view === 'board')} onClick={() => setView('board')}>
            <Kanban size={13} />
            Board
          </button>
          <button style={tabBtn(view === 'calendar')} onClick={() => setView('calendar')}>
            <Calendar size={13} />
            Calendar
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '9px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
            }}
          >
            <Settings size={14} /> Columns
          </button>
          <Link href="/deals" style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none',
          }}>
            <Plus size={14} /> Add Deal
          </Link>
        </div>
      </div>

      {/* ── TODAY VIEW ──────────────────────────────────────────────────────── */}
      {view === 'today' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* A. Stats strip */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 12px', borderRadius: '100px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)',
            }}>
              <Kanban size={11} style={{ color: 'var(--accent)' }} />
              {activeDeals.length} active
            </div>
            {totalPipeline > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px', borderRadius: '100px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)',
              }}>
                <TrendingUp size={11} style={{ color: 'var(--success)' }} />
                {dealValueLabel(totalPipeline, undefined, undefined, currencySymbol)} pipeline
              </div>
            )}
            {urgentCount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px', borderRadius: '100px',
                background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)',
                fontSize: '12px', fontWeight: '600', color: 'var(--danger)',
              }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--danger)' }} />
                {urgentCount} urgent
              </div>
            )}
            {staleCount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px', borderRadius: '100px',
                background: 'color-mix(in srgb, var(--warning) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--warning) 15%, transparent)',
                fontSize: '12px', fontWeight: '600', color: 'var(--warning)',
              }}>
                <Clock size={11} />
                {staleCount} stale
              </div>
            )}
          </div>

          {/* B. AI Input Hero */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.06) 100%)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '16px', padding: '20px 22px',
          }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '100px',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.12))',
                border: '1px solid rgba(99,102,241,0.25)',
              }}>
                <Sparkles size={13} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.2 }}>Sales AI</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>Ask anything about your pipeline</div>
              </div>
            </div>

            {/* Input row */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                ref={aiInputRef}
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') dispatchAI(aiInput) }}
                placeholder="What should I focus on today? Draft a follow-up for Acme..."
                style={{
                  flex: 1, padding: '10px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: '10px',
                  color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                  backdropFilter: 'blur(8px)',
                }}
              />
              <button
                onClick={() => dispatchAI(aiInput)}
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 16px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                  border: 'none', color: '#fff', fontSize: '13px', fontWeight: '600',
                  cursor: 'pointer', boxShadow: 'var(--shadow-lg)',
                }}
              >
                <Send size={13} />
                Send
              </button>
            </div>

            {/* Quick-action chips */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
              {[
                'What should I prioritise today?',
                'Which deals are at risk?',
                'Summarise my pipeline',
                actionQueue[0] ? `Help with ${actionQueue[0].company}` : 'Who should I chase this week?',
              ].map(chip => (
                <button
                  key={chip}
                  onClick={() => dispatchAI(chip)}
                  style={{
                    padding: '5px 12px', borderRadius: '100px',
                    background: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    color: 'var(--accent)', fontSize: '11px', fontWeight: '500',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)'}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* C. Action items */}
          {actionQueue.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Needs your attention
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {actionQueue.map((item, i) => {
                  const isHigh = item.priority === 'high'
                  const isMedium = item.priority === 'medium'
                  const isStale = item.actionType === 'stale'
                  const isRisk = item.actionType === 'risk'
                  const leftBorderColor = isHigh ? 'var(--danger)' : isMedium ? 'var(--warning)' : 'var(--text-tertiary)'
                  const badgeBg = isHigh
                    ? 'color-mix(in srgb, var(--danger) 10%, transparent)'
                    : isStale
                      ? 'color-mix(in srgb, var(--warning) 10%, transparent)'
                      : 'var(--accent-subtle)'
                  const badgeColor = isHigh ? 'var(--danger)' : isStale ? 'var(--warning)' : 'var(--accent)'
                  const badgeBorder = isHigh
                    ? 'color-mix(in srgb, var(--danger) 20%, transparent)'
                    : isStale
                      ? 'color-mix(in srgb, var(--warning) 20%, transparent)'
                      : 'var(--border-strong)'
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px',
                      background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid var(--card-border)',
                      borderLeft: `3px solid ${leftBorderColor}`,
                      borderRadius: '10px',
                    }}>
                      {/* Number circle */}
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                        background: leftBorderColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: '700', color: '#fff',
                      }}>
                        {i + 1}
                      </div>

                      {/* Content */}
                      <Link href={`/deals/${item.dealId}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{item.company}</span>
                          <span style={{
                            fontSize: '10px', fontWeight: '600', padding: '1px 7px', borderRadius: '4px', flexShrink: 0,
                            background: badgeBg, color: badgeColor,
                            border: `1px solid ${badgeBorder}`,
                          }}>
                            {isRisk ? '⚠ ' : isStale ? '⏱ ' : ''}{item.headline}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.detail}
                        </div>
                      </Link>

                      {/* Ask AI button */}
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          window.dispatchEvent(new CustomEvent('openCommandPalette', { detail: { query: item.prompt } }))
                        }}
                        style={{
                          flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '6px 12px', borderRadius: '7px',
                          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.10))',
                          border: '1px solid rgba(99,102,241,0.25)',
                          color: 'var(--accent)', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.16))'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.10))'}
                      >
                        <Sparkles size={10} />
                        Ask AI
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* D. Top picks */}
          {topDeals.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Highest win probability
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {topDeals.map((deal: any) => {
                  const topScore = mlMap[deal.id]?.winProb ?? deal.conversionScore ?? 0
                  const scoreColor = topScore >= 70 ? 'var(--success)' : topScore >= 40 ? 'var(--warning)' : 'var(--danger)'
                  return (
                    <Link
                      key={deal.id}
                      href={`/deals/${deal.id}`}
                      style={{
                        flex: '1 1 200px', minWidth: '180px',
                        display: 'flex', flexDirection: 'column', gap: '6px',
                        padding: '14px 16px',
                        background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid var(--card-border)', borderRadius: '12px',
                        textDecoration: 'none', transition: 'border-color 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {deal.prospectCompany}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {configStages.find((s: any) => s.id === deal.stage)?.label ?? deal.stage}
                            {deal.dealValue && ` · ${dealValueLabel(deal.dealValue, deal.dealType, deal.recurringInterval, currencySymbol)}`}
                          </div>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: scoreColor, flexShrink: 0, lineHeight: 1 }}>
                          {topScore}%
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* E. Empty state */}
          {!isLoading && activeDeals.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚀</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Start building your pipeline</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Add your first deal to get AI-powered insights and recommendations.</div>
              <Link href="/deals" style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '10px 20px',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                borderRadius: '10px', color: '#fff', fontSize: '13px', fontWeight: '600',
                textDecoration: 'none', boxShadow: 'var(--shadow-lg)',
              }}>
                <Plus size={14} /> Add your first deal
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── BOARD VIEW ──────────────────────────────────────────────────────── */}
      {view === 'board' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header */}
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '4px' }}>
              Sales Pipeline
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {activeDeals.length} active deals
              {totalPipeline > 0 && ` · ${dealValueLabel(totalPipeline, undefined, undefined, currencySymbol)} pipeline`}
              {' · '}
              <span style={{ color: 'var(--text-tertiary)' }}>Drag cards to move stages</span>
            </p>
          </div>

          {/* Kanban board */}
          <div style={{ overflowX: 'auto', paddingBottom: '8px', maxWidth: `calc(100vw - ${sidebarWidth}px - 48px)` }}>
            <div style={{ display: 'flex', gap: '12px', minWidth: 'max-content' }}>
              {activeStages.map((stage: any) => {
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
                      background: isDropTarget ? `rgba(${hexToRgb(stage.color)},0.12)` : 'var(--card-bg)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border: isDropTarget ? `1px solid ${stage.color}55` : '1px solid var(--card-border)',
                      borderRadius: '12px',
                      borderTop: `3px solid ${stage.color}`,
                      transition: 'background 0.15s, border-color 0.15s',
                    }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: stage.color, boxShadow: `0 0 8px ${stage.color}` }} />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', flex: 1 }}>{stage.label}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--accent-subtle)', border: '1px solid var(--border)', padding: '1px 7px', borderRadius: '100px' }}>{stageDeals.length}</span>
                    </div>
                    {stageValue > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TrendingUp size={10} />
                        {currencySymbol}{stageValue.toLocaleString()} annualised
                      </div>
                    )}

                    {/* Cards */}
                    {isLoading ? (
                      <div style={{ height: '80px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Loading...</div>
                      </div>
                    ) : stageDeals.length === 0 ? (
                      <div style={{
                        height: '80px',
                        background: isDropTarget ? `rgba(${hexToRgb(stage.color)},0.06)` : 'var(--surface)',
                        border: isDropTarget ? `1px dashed ${stage.color}88` : '1px dashed var(--border)',
                        borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}>
                        <span style={{ fontSize: '11px', color: isDropTarget ? stage.color : 'var(--text-tertiary)' }}>
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
                          urgentReason={urgentMap[deal.id]}
                          staleDays={staleMap[deal.id]}
                          churnRisk={mlMap[deal.id]?.churnRisk}
                          daysInStage={daysInStageMap[deal.id]}
                          momentum={momentumMap[deal.id]}
                          currencySymbol={currencySymbol}
                          allStages={configStages}
                        />
                      ))
                    )}

                    {/* Add to stage */}
                    <Link href="/deals" style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      padding: '9px', background: 'var(--surface)',
                      border: '1px dashed var(--border)',
                      borderRadius: '9px', color: 'var(--text-tertiary)', fontSize: '12px', textDecoration: 'none',
                      transition: 'color 0.1s, border-color 0.1s, background 0.1s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--accent)'
                      ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'
                      ;(e.currentTarget as HTMLElement).style.background = 'var(--accent-subtle)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'
                      ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                      ;(e.currentTarget as HTMLElement).style.background = 'var(--surface)'
                    }}
                    >
                      <Plus size={12} /> Add deal
                    </Link>
                  </div>
                )
              })}

              {/* Won/Lost summary columns */}
              <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {closedStages.map((s: any) => {
                  const stageId = s.id
                  const stageDeals = deals.filter((d: any) => d.stage === stageId)
                  const val = stageDeals.reduce((sum: number, d: any) => sum + annualizedValue(d.dealValue ?? 0, d.dealType, d.recurringInterval), 0)
                  const isDropTarget = dragOverStage === stageId && draggedId !== null

                  return (
                    <div
                      key={stageId}
                      style={{
                        padding: '14px',
                        background: isDropTarget ? `rgba(${hexToRgb(s.color)},0.1)` : 'var(--card-bg)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: isDropTarget ? `1px solid ${s.color}55` : `1px solid var(--card-border)`,
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
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{s.label}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--accent-subtle)', border: '1px solid var(--border)', padding: '1px 7px', borderRadius: '100px', marginLeft: 'auto' }}>{stageDeals.length}</span>
                      </div>
                      {val > 0 && <div style={{ fontSize: '18px', fontWeight: '700', color: s.color }}>{currencySymbol}{val.toLocaleString()}</div>}
                      {stageDeals.length === 0 && (
                        <div style={{ fontSize: '11px', color: isDropTarget ? s.color : 'var(--text-tertiary)' }}>
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
      )}

      {/* ── CALENDAR VIEW ───────────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <CalendarView deals={deals} brainData={brainData} />
      )}

      <PipelineSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={pipelineConfig}
        presets={presets}
        onUpdate={() => mutateConfig()}
      />
    </div>
  )
}

// Utility: convert hex color to "r,g,b" string for rgba()
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '124,58,237'
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
}
