'use client'
export const dynamic = 'force-dynamic'

import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { useState } from 'react'
import { useSidebar } from '@/components/layout/SidebarContext'
import {
  Plus, TrendingUp, DollarSign, Sparkles,
  CheckSquare, MoreHorizontal, Target, Zap, ArrowUpRight,
  Star, AlertTriangle, Clock,
  Settings, Edit, X, Trash2, Check,
  Kanban, List, ChevronUp, ChevronDown,
} from 'lucide-react'
import { PageTabs } from '@/components/shared/PageTabs'

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
  const color = score >= 70 ? '#22C55E' : score >= 40 ? '#F59E0B' : '#EF4444'
  const bg = score >= 70 ? 'rgba(34,197,94,0.1)' : score >= 40 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'
  const border = score >= 70 ? 'rgba(34,197,94,0.25)' : score >= 40 ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'
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

      {/* Urgency / stale signals from brain */}
      {urgentReason && (
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '5px 8px', borderRadius: '6px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', marginBottom: '8px' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
          <span style={{ fontSize: '10px', color: '#FCA5A5', lineHeight: 1.4 }}>{urgentReason}</span>
        </div>
      )}
      {!urgentReason && staleDays !== undefined && staleDays >= 14 && (
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '5px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)', marginBottom: '8px' }}>
          <Clock size={9} color="#F59E0B" />
          <span style={{ fontSize: '10px', color: '#FDE68A' }}>{staleDays}d since last update</span>
        </div>
      )}
      {/* Churn risk — ML survival model signal */}
      {!urgentReason && churnRisk !== undefined && churnRisk >= 65 && (
        <div style={{
          display: 'flex', gap: '5px', alignItems: 'center',
          padding: '5px 8px', borderRadius: '6px',
          background: churnRisk >= 85 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.05)',
          border: churnRisk >= 85 ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(245,158,11,0.15)',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '10px' }}>🔇</span>
          <span style={{ fontSize: '10px', color: churnRisk >= 85 ? '#FCA5A5' : '#FDE68A' }}>
            {churnRisk}% going silent
          </span>
        </div>
      )}
      {/* Days in stage badge */}
      {daysInStage !== undefined && daysInStage > 0 && (
        <div style={{
          display: 'flex', gap: '5px', alignItems: 'center',
          padding: '4px 8px', borderRadius: '6px',
          background: 'rgba(107,114,128,0.08)',
          border: '1px solid rgba(107,114,128,0.18)',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '10px', color: '#9CA3AF' }}>⏱ {daysInStage}d in stage</span>
        </div>
      )}
      {/* Momentum: hot badge (cooling is already covered by churnRisk badge) */}
      {momentum === 'hot' && (
        <div style={{
          display: 'flex', gap: '5px', alignItems: 'center',
          padding: '4px 8px', borderRadius: '6px',
          background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.2)',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '10px', color: '#86EFAC' }}>🔥 Hot</span>
        </div>
      )}

      {/* AI Insights — filter out score-summary insights to avoid conflicting with ML % badge */}
      {(() => {
        const firstInsight = (deal.conversionInsights ?? []).find((ins: string) => !/\d+\s*\/\s*100/i.test(ins))
        return firstInsight ? (
          <div style={{
            background: 'rgba(124,58,237,0.08)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: '9px', padding: '8px 10px', marginBottom: '10px',
            display: 'flex', gap: '6px', alignItems: 'flex-start',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}>
            <Sparkles size={11} color="#A78BFA" style={{ marginTop: '1px', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#A78BFA', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{firstInsight}</span>
          </div>
        ) : null
      })()}

      {/* Deal value + todos */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {deal.dealValue ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '700', color: '#22C55E' }}>
            <DollarSign size={11} />
            {dealValueLabel(deal.dealValue, deal.dealType, deal.recurringInterval, currencySymbol)}
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
          background: 'rgba(12,8,24,0.98)', border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: '16px', padding: '24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#F0EEFF', margin: 0 }}>Pipeline Columns</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Industry Presets */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#555', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Industry Presets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {presets.map((p: any) => (
              <button key={p.id} onClick={() => applyPreset(p.id)} style={{
                padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                background: config?.industryPreset === p.id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${config?.industryPreset === p.id ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: config?.industryPreset === p.id ? '#818CF8' : '#888', cursor: 'pointer',
              }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Current Stages */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#555', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Stages</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {stages.map((s: any) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px',
                opacity: s.isHidden ? 0.4 : 1,
              }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: s.color, flexShrink: 0 }} />
                {editingId === s.id ? (
                  <form onSubmit={e => { e.preventDefault(); rename(s.id) }} style={{ flex: 1, display: 'flex', gap: '6px' }}>
                    <input autoFocus value={editLabel} onChange={e => setEditLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') setEditingId(null) }}
                      style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '5px', padding: '3px 8px', color: '#EBEBEB', fontSize: '12px', outline: 'none' }}
                    />
                    <button type="submit" style={{ background: 'none', border: 'none', color: '#22C55E', cursor: 'pointer', display: 'flex' }}><Check size={14} /></button>
                    <button type="button" onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
                  </form>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: '13px', color: '#EBEBEB', fontWeight: 500 }}>{s.label}</span>
                    {s.isDefault && <span style={{ fontSize: '9px', color: '#444', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', padding: '1px 5px' }}>default</span>}
                    {s.id !== 'closed_won' && s.id !== 'closed_lost' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginLeft: 'auto' }}>
                        <button onClick={() => moveStageOrder(s.id, 'up')}
                          style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '0', display: 'flex', lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#818CF8'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#444'}
                        ><ChevronUp size={12} /></button>
                        <button onClick={() => moveStageOrder(s.id, 'down')}
                          style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '0', display: 'flex', lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#818CF8'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#444'}
                        ><ChevronDown size={12} /></button>
                      </div>
                    )}
                    <button onClick={() => { setEditingId(s.id); setEditLabel(s.label) }} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', padding: '2px', display: 'flex' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#818CF8'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#333'}
                    ><Edit size={12} /></button>
                    <button onClick={() => toggleHide(s.id, s.isHidden)} style={{ background: 'none', border: 'none', color: s.isHidden ? '#818CF8' : '#333', cursor: 'pointer', padding: '2px', display: 'flex', fontSize: '11px' }}>
                      {s.isHidden ? 'Show' : 'Hide'}
                    </button>
                    {!s.isDefault && (
                      <button onClick={() => removeStage(s.id)} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', padding: '2px', display: 'flex' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#EF4444'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#333'}
                      ><Trash2 size={12} /></button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add Custom Stage */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#555', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Add Custom Stage</div>
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
              style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', padding: '8px 12px', color: '#EBEBEB', fontSize: '13px', outline: 'none' }}
            />
            <button type="submit" disabled={!newLabel.trim()} style={{
              padding: '8px 16px', background: !newLabel.trim() ? '#1A1A1A' : 'linear-gradient(135deg, #6366F1, #7C3AED)',
              border: 'none', borderRadius: '7px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: !newLabel.trim() ? 'not-allowed' : 'pointer',
            }}>Add</button>
          </form>
        </div>
      </div>
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
  // Brain's Top Picks: prefer ML win probability, fall back to conversion score
  const topDeals = deals
    .filter((d: any) => (mlMap[d.id]?.winProb || d.conversionScore) && d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    .sort((a: any, b: any) => {
      const aScore = mlMap[a.id]?.winProb ?? a.conversionScore ?? 0
      const bScore = mlMap[b.id]?.winProb ?? b.conversionScore ?? 0
      return bScore - aScore
    })
    .slice(0, 3)

  const urgentCount = Object.keys(urgentMap).length
  const staleCount = Object.keys(staleMap).length
  const churnCount = Object.values(mlMap).filter(m => (m.churnRisk ?? 0) >= 65).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%' }}>

      {/* View toggle */}
      <PageTabs tabs={[
        { label: 'Board View', href: '/pipeline', icon: Kanban },
        { label: 'List View',  href: '/deals',    icon: List   },
      ]} />

      {/* Brain focus bar */}
      {(urgentCount > 0 || staleCount > 0 || churnCount > 0) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
          background: '#0F0F0F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '11px', color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: '4px' }}>Focus</span>
          {urgentCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#FCA5A5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '4px', padding: '2px 8px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#EF4444' }} />
              {urgentCount} urgent
            </span>
          )}
          {staleCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#FDE68A', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)', borderRadius: '4px', padding: '2px 8px' }}>
              <Clock size={9} color="#F59E0B" />
              {staleCount} stale
            </span>
          )}
          {churnCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#FCA5A5', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: '4px', padding: '2px 8px' }}>
              🔇 {churnCount} going silent
            </span>
          )}
          <span style={{ fontSize: '11px', color: '#333', marginLeft: 'auto' }}>Flagged by Sales Brain · hover for detail</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.03em', color: '#F0EEFF', marginBottom: '4px' }}>
            Sales Pipeline
          </h1>
          <p style={{ fontSize: '13px', color: '#9CA3AF' }}>
            {deals.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length} active deals
            {totalPipeline > 0 && ` · ${dealValueLabel(totalPipeline, undefined, undefined, currencySymbol)} pipeline`}
            {' · '}
            <span style={{ color: '#6B7280' }}>Drag cards to move stages</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '9px', color: '#888', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
            }}
          >
            <Settings size={14} /> Columns
          </button>
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
      </div>

      {/* AI Top Picks */}
      {topDeals.length > 0 && (
        <div style={{ background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '14px', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '26px', height: '26px', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star size={12} color="#A78BFA" />
            </div>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>Brain&apos;s Top Picks</span>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Highest ML win probability</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {topDeals.map((deal: any) => {
              const pendingTodos: any[] = (deal.todos ?? []).filter((t: any) => !t.done)
              const urgentTodo = pendingTodos[0]
              // Detect risk signals from insights (look for negative/warning language)
              // Filter out score-summary insights (e.g. "rates X at 82/100") to avoid showing conflicting scores
              const riskInsight = (deal.conversionInsights ?? []).find((ins: string) =>
                /risk|danger|concern|warn|block|stall|compet|objection|overdue|miss|lost|slow|churn|cancel|threat/i.test(ins)
                && !/rates .+ at \d+\/100/i.test(ins)
                && !/\d+\/100/i.test(ins)
              )
              const topScore = mlMap[deal.id]?.winProb ?? deal.conversionScore ?? 0
              const scoreColor = topScore >= 70 ? '#22C55E' : topScore >= 40 ? '#F59E0B' : '#EF4444'

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
                        {configStages.find((s: any) => s.id === deal.stage)?.label ?? deal.stage}
                        {deal.dealValue && ` · ${dealValueLabel(deal.dealValue, deal.dealType, deal.recurringInterval, currencySymbol)}`}
                      </div>
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: '800', color: scoreColor, flexShrink: 0 }}>
                      {mlMap[deal.id]?.winProb ?? deal.conversionScore}%
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

      {/* AI Pipeline Recommendations */}
      {(() => {
        const recs = (brainRes?.data?.pipelineRecommendations ?? []).slice(0, 4)
        if (recs.length === 0) return null
        return (
          <div style={{ background: 'rgba(18,12,32,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '14px', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '26px', height: '26px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={12} color="#818CF8" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>AI Recommendations</span>
              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Actions to advance your pipeline</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recs.map((rec: any, i: number) => (
                <Link key={i} href={`/deals/${rec.dealId}`} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                  background: rec.priority === 'high' ? 'rgba(239,68,68,0.04)' : 'rgba(99,102,241,0.04)',
                  border: `1px solid ${rec.priority === 'high' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)'}`,
                  borderRadius: '9px', textDecoration: 'none',
                  transition: 'border-color 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = rec.priority === 'high' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = rec.priority === 'high' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)'}
                >
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    background: rec.priority === 'high' ? '#EF4444' : rec.priority === 'medium' ? '#F59E0B' : '#6B7280',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: '#EBEBEB', fontWeight: '500' }}>{rec.company}</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '1px' }}>{rec.recommendation}</div>
                  </div>
                  {rec.action && (
                    <span style={{
                      fontSize: '10px', padding: '3px 10px', borderRadius: '6px', flexShrink: 0,
                      background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818CF8', fontWeight: 600,
                    }}>
                      {rec.action}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )
      })()}

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
                    {currencySymbol}{stageValue.toLocaleString()} annualised
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
                  {val > 0 && <div style={{ fontSize: '18px', fontWeight: '700', color: s.color }}>{currencySymbol}{val.toLocaleString()}</div>}
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
