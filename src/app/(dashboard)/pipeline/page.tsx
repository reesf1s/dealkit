'use client'
export const dynamic = 'force-dynamic'

import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useSidebar } from '@/components/layout/SidebarContext'
import {
  Plus, TrendingUp, Sparkles,
  Target, Zap,
  Star, AlertTriangle, Clock, Calendar,
  Settings, Edit, X, Trash2, Check,
  Kanban, List, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, Send, Home,
  BarChart3, Brain,
  Info, TrendingDown, Users, DollarSign,
  CheckCircle, XCircle, ArrowUp, ArrowDown, Minus,
  Lock, MessageSquare,
} from 'lucide-react'
import WinLossModal, { type WinLossData } from '@/components/shared/WinLossModal'

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
  currencySymbol = '£',
  mlPrediction,
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
  mlPrediction?: { winProbability?: number; churnRisk?: number }
  allStages?: { id: string; label: string; color: string }[]
}) {
  const score = deal.conversionScore ?? 0
  const scoreColor = score >= 70 ? '#30D158' : score >= 40 ? '#FFD60A' : score > 0 ? '#FF453A' : 'rgba(255,255,255,0.15)'
  const scoreBg = score >= 70 ? 'rgba(48,209,88,0.12)' : score >= 40 ? 'rgba(255,214,10,0.10)' : score > 0 ? 'rgba(255,69,58,0.12)' : 'rgba(255,255,255,0.05)'

  const value = deal.dealValue ?? 0
  const valueLabel = value >= 1_000_000
    ? `${currencySymbol}${(value / 1_000_000).toFixed(1)}m`
    : value >= 1_000
      ? `${currencySymbol}${(value / 1_000).toFixed(0)}k`
      : value > 0 ? `${currencySymbol}${value}` : null

  const isUrgent = !!urgentReason
  const isStale = staleDays != null && staleDays > 0

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', deal.id)
        requestAnimationFrame(() => { onDragStart(deal.id) })
      }}
      onDragEnd={() => { onDragEnd() }}
      onClick={() => { window.location.href = `/deals/${deal.id}` }}
      style={{
        background: 'var(--card-bg)',
        border: `1px solid ${isUrgent ? 'color-mix(in srgb, var(--danger) 30%, var(--card-border))' : 'var(--card-border)'}`,
        borderRadius: '10px',
        padding: '12px 13px',
        cursor: 'pointer',
        opacity: isDragging ? 0.4 : 1,
        transition: 'box-shadow 0.12s, border-color 0.12s',
        boxShadow: 'var(--shadow-sm)',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow)'
        ;(e.currentTarget as HTMLElement).style.borderColor = isUrgent
          ? 'color-mix(in srgb, var(--danger) 40%, transparent)'
          : 'var(--border-strong)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'
        ;(e.currentTarget as HTMLElement).style.borderColor = isUrgent
          ? 'color-mix(in srgb, var(--danger) 30%, var(--card-border))'
          : 'var(--card-border)'
      }}
    >
      {/* Top row: company name + score circle */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div title={deal.prospectCompany} style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {deal.prospectCompany}
          </div>
          {deal.dealName && deal.dealName !== deal.prospectCompany && (
            <div title={deal.dealName} style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {deal.dealName}
            </div>
          )}
          {deal.engagementType && (
            <span style={{
              display: 'inline-block', marginTop: '3px',
              fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '100px',
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}>
              {deal.engagementType}
            </span>
          )}
        </div>
        {score > 0 && (
          <div style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%', background: scoreBg, border: `1.5px solid ${scoreColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: scoreColor, lineHeight: 1 }}>{score}</span>
          </div>
        )}
      </div>

      {/* Bottom row: value + days in stage + momentum dot + alert badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {valueLabel && (
          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>{valueLabel}</span>
        )}
        {daysInStage != null && daysInStage > 0 && (
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: valueLabel ? '2px' : 0 }}>{daysInStage}d</span>
        )}
        <div style={{ flex: 1 }} />
        {momentum === 'hot' && (
          <div title="Hot deal" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#059669', boxShadow: '0 0 5px rgba(5,150,105,0.5)', flexShrink: 0 }} />
        )}
        {momentum === 'cooling' && (
          <div title="Cooling" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#D97706', flexShrink: 0 }} />
        )}
        {(isUrgent || isStale) && (
          <div
            title={urgentReason ?? `${staleDays}d without update`}
            style={{
              fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '4px',
              background: isUrgent ? 'color-mix(in srgb, var(--danger) 12%, transparent)' : 'color-mix(in srgb, var(--warning) 12%, transparent)',
              color: isUrgent ? 'var(--danger)' : 'var(--warning)',
              border: `1px solid ${isUrgent ? 'color-mix(in srgb, var(--danger) 25%, transparent)' : 'color-mix(in srgb, var(--warning) 25%, transparent)'}`,
            }}
          >
            {isUrgent ? '!' : `${staleDays}d`}
          </div>
        )}
      </div>
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
  const [editingColorId, setEditingColorId] = useState<string | null>(null)

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

  const updateColor = async (id: string, color: string) => {
    await fetch('/api/pipeline-config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updateStageColor: { id, color } }),
    })
    setEditingColorId(null)
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
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px',
                opacity: s.isHidden ? 0.4 : 1,
              }}>
                <button
                  onClick={() => setEditingColorId(editingColorId === s.id ? null : s.id)}
                  title="Click to change colour"
                  style={{
                    width: '14px', height: '14px', borderRadius: '4px', background: s.color, flexShrink: 0,
                    border: editingColorId === s.id ? '2px solid #fff' : '2px solid transparent',
                    cursor: 'pointer', padding: 0, transition: 'transform 0.1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                />
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
              {/* Inline colour picker */}
              {editingColorId === s.id && (
                <div style={{ display: 'flex', gap: '5px', padding: '6px 12px', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => updateColor(s.id, c)} style={{
                      width: '22px', height: '22px', borderRadius: '5px', background: c, padding: 0,
                      border: s.color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer',
                      transform: 'scale(1)', transition: 'transform 0.1s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                    />
                  ))}
                </div>
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


// ── Inline Tooltip helper ─────────────────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ background: 'none', border: 'none', padding: '1px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)' }}
      >
        <Info size={11} />
      </button>
      {show && (
        <div style={{
          position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
          padding: '8px 10px', fontSize: '11px', color: '#d1d5db', lineHeight: 1.5,
          width: '220px', zIndex: 100, pointerEvents: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>
          {text}
        </div>
      )}
    </div>
  )
}

// ── Animated number counter ───────────────────────────────────────────────────
function AnimatedNumber({ target, duration = 300, format = false }: { target: number; duration?: number; format?: boolean }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (target === 0) return
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(target * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return <>{format ? val.toLocaleString('en-GB') : val}</>
}

// ── Animated progress bar ─────────────────────────────────────────────────────
function AnimatedBar({ pct, color }: { pct: number; color: string }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 50)
    return () => clearTimeout(t)
  }, [pct])
  return (
    <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${width}%`, background: color, borderRadius: '3px', transition: 'width 500ms ease-out' }} />
    </div>
  )
}

// ── Mini SVG Sparkline ────────────────────────────────────────────────────────
function Sparkline({ points, color = '#6366f1', w = 100, h = 28 }: { points: number[]; color?: string; w?: number; h?: number }) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const step = w / (points.length - 1)
  const coords = points.map((p, i) => `${(i * step).toFixed(1)},${(h - ((p - min) / range) * (h - 4) - 2).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Insights View ─────────────────────────────────────────────────────────────
function InsightsView({ brainData, deals, currencySymbol, onAsk }: {
  brainData: any; deals: any[]; currencySymbol: string
  onAsk: (q: string) => void
}) {
  if (!brainData) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
        AI insights are loading — check back in a moment.
      </div>
    )
  }

  const wl = brainData.winLossIntel
  const phiObj = brainData.pipelineHealthIndex
  const phiScore: number | undefined = phiObj?.score
  const rfArr: any[] = brainData.revenueForecasts ?? []
  const ml = brainData.mlModel
  const archetypes: any[] = brainData.dealArchetypes ?? []
  const scoreTrends: any[] = brainData.scoreTrendAlerts ?? []
  const mlTrends = brainData.mlTrends
  const stageVelocityIntel = brainData.stageVelocityIntel
  const objectionWinMap: any[] = brainData.objectionWinMap ?? []
  // Use competitivePatterns (ML-derived) if available, otherwise fall back to
  // winLossIntel.competitorRecord which has a much lower threshold (1+ closed deal)
  const rawCompetitivePatterns: any[] = brainData.competitivePatterns ?? []
  const fallbackCompRecord: any[] = (brainData.winLossIntel?.competitorRecord ?? []).map((c: any) => ({
    competitor: c.name,
    totalDeals: c.wins + c.losses,
    wins: c.wins,
    losses: c.losses,
    winRate: c.winRate,
  }))
  const competitivePatterns: any[] = rawCompetitivePatterns.length > 0 ? rawCompetitivePatterns : fallbackCompRecord

  const openDeals = deals.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

  // Probability-weighted forecast from open deals
  const weightedForecast = openDeals.reduce((sum: number, d: any) => sum + ((d.dealValue ?? 0) * ((d.conversionScore ?? 0) / 100)), 0)

  // Score history for PHI sparkline
  const phiHistory: number[] = (() => {
    const cal = brainData.calibrationTimeline
    if (cal && cal.length >= 2) return cal.slice(-12).map((p: any) => p.score ?? phiScore ?? 50)
    return []
  })()

  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--card-border)', borderRadius: '16px', padding: '18px 20px',
    display: 'flex', flexDirection: 'column', gap: '12px',
    transition: 'border-color 0.15s',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '10px', fontWeight: '700', color: 'var(--text-tertiary)',
    letterSpacing: '0.08em', textTransform: 'uppercase',
  }
  const fmtCurrency = (n: number) => `${currencySymbol}${Math.round(n).toLocaleString()}`
  const scoreColor = (s: number) => s >= 70 ? '#30D158' : s >= 40 ? '#FFD60A' : s > 0 ? '#FF453A' : 'rgba(255,255,255,0.15)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '4px' }}>
          ML Insights
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Predictive intelligence, win/loss patterns, and pipeline forecasts
        </p>
      </div>

      {/* Row 1: Pipeline Health + Win/Loss Record + ML Model */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>

        {/* Pipeline Health Index */}
        {phiScore != null && (
          <div
            style={cardStyle}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={labelStyle}>Pipeline Health</div>
              <InfoTooltip text="A composite 0–100 score based on stage depth, deal velocity, ML win probability, and deal momentum." />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{
                fontSize: '42px', fontWeight: '800', lineHeight: 1,
                color: phiScore >= 70 ? 'var(--success)' : phiScore >= 40 ? 'var(--warning)' : 'var(--danger)',
              }}>
                <AnimatedNumber target={phiScore} />
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingBottom: '4px' }}>/100</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: phiScore >= 70 ? 'var(--success)' : phiScore >= 40 ? 'var(--warning)' : 'var(--danger)', paddingBottom: '4px', marginLeft: '4px' }}>
                {phiObj?.interpretation ?? ''}
              </div>
            </div>
            <AnimatedBar pct={phiScore} color={phiScore >= 70 ? 'var(--success)' : phiScore >= 40 ? 'var(--warning)' : 'var(--danger)'} />
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {phiObj?.keyInsight ?? (phiScore >= 70 ? 'Pipeline is healthy and on track' : phiScore >= 40 ? 'Some areas need attention' : 'Pipeline needs significant work')}
            </div>
            {phiHistory.length >= 2 ? (
              <div style={{ marginTop: '4px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Last {phiHistory.length} data points</div>
                <Sparkline points={phiHistory} color={phiScore >= 70 ? '#059669' : phiScore >= 40 ? '#D97706' : '#DC2626'} w={120} h={28} />
              </div>
            ) : (
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                Trend builds as you add deals
              </div>
            )}
          </div>
        )}

        {/* Win/Loss Record */}
        {wl ? (
          <div
            style={cardStyle}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
          >
            <div style={labelStyle}>Win / Loss Record</div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--success)', lineHeight: 1 }}>{wl.winCount ?? 0}W</div>
                {wl.avgWonValue ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>avg {fmtCurrency(wl.avgWonValue)}</div>
                ) : null}
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--danger)', lineHeight: 1 }}>{wl.lossCount ?? 0}L</div>
              </div>
            </div>
            {wl.winRate != null && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {wl.winRate}% win rate
                {wl.avgDaysToClose != null && (
                  <span style={{ marginLeft: '8px', color: 'var(--text-tertiary)' }}>&middot; avg {Math.round(wl.avgDaysToClose)} days to close</span>
                )}
              </div>
            )}
            {(wl.lossCount ?? 0) === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                Log your first lost deal to unlock competitive loss analysis
              </div>
            ) : wl.topLossReasons?.length > 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                Top loss reason: {String(wl.topLossReasons[0])}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ML Model accuracy */}
        {ml && (
          <div
            style={cardStyle}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
          >
            <div style={labelStyle}>ML Model</div>
            {ml.looAccuracy != null && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--accent)', lineHeight: 1 }}>
                  <AnimatedNumber target={Math.round(ml.looAccuracy * 100)} />%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingBottom: '4px' }}>accuracy</div>
              </div>
            )}
            {ml.trainingSize != null && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Trained on {ml.trainingSize} deals
              </div>
            )}
            {ml.usingGlobalPrior && (
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                Bayesian blend with global prior
              </div>
            )}
          </div>
        )}
      </div>

      {/* Row 2: Deal Score Distribution (full width) */}
      <div
        style={cardStyle}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={labelStyle}>Deal Score Distribution</div>
          <InfoTooltip text="Scores are calculated using text signals from your meeting notes and your private ML model (when activated)." />
        </div>
        {openDeals.length < 3 ? (
          <div style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            Add more deals to see your score distribution
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...openDeals]
              .sort((a: any, b: any) => (b.conversionScore ?? 0) - (a.conversionScore ?? 0))
              .map((deal: any) => {
                const s = deal.conversionScore ?? 0
                const c = scoreColor(s)
                const name = (deal.dealName || deal.prospectCompany || 'Deal').slice(0, 22)
                const stageLabel = STAGES.find((st: any) => st.id === deal.stage)?.label ?? deal.stage ?? ''
                return (
                  <div key={deal.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '140px', fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {name}
                      </div>
                      <AnimatedBar pct={s === 0 ? 2 : s} color={c} />
                      <div style={{ width: '42px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: c, flexShrink: 0 }}>
                        {s === 0 ? <span style={{ fontSize: '10px', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>No data</span> : `${s}%`}
                      </div>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: '150px', marginTop: '1px' }}>{stageLabel}</div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* Row 3: Stage Velocity + Top Objections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>

        {/* Stage Velocity */}
        <div
          style={cardStyle}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={labelStyle}>Stage Velocity</div>
            <InfoTooltip text="Stage velocity shows how long deals typically take at each stage based on your won deals. Deals exceeding the average may be stalling." />
          </div>
          {(() => {
            const stageStats: any[] = stageVelocityIntel?.stageStats ?? []
            const hasHistory = stageStats.length > 0
            const openStages = STAGES.filter((s: any) => s.id !== 'closed_won' && s.id !== 'closed_lost')
            const rows = openStages.map((s: any) => {
              const count = openDeals.filter((d: any) => d.stage === s.id).length
              const stat = stageStats.find((st: any) => st.stage === s.id)
              return { id: s.id, label: s.label, color: s.color, count, avgDays: stat?.p50Days ?? null }
            }).filter((r: any) => r.count > 0 || r.avgDays != null)
            if (rows.length === 0) return (
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                Add deals to see stage velocity data
              </div>
            )
            return (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {rows.map((r: any) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>{r.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.count} deal{r.count !== 1 ? 's' : ''}</div>
                      {r.avgDays != null ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>avg {r.avgDays}d</div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {!hasHistory && (
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                    Close 5+ deals to see velocity benchmarks
                  </div>
                )}
              </>
            )
          })()}
        </div>

        {/* Top Objections */}
        <div
          style={cardStyle}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={labelStyle}>Top Objections</div>
            <InfoTooltip text="SellSight detects objection themes from your meeting notes and tracks whether deals with each objection type tend to close." />
          </div>
          {objectionWinMap.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 8px', color: 'var(--text-tertiary)' }}>
              <MessageSquare size={18} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
              <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', margin: '0 0 4px' }}>No objections tracked yet</p>
              <p style={{ fontSize: '11px', margin: 0 }}>Paste meeting notes to start tracking objections automatically.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {objectionWinMap.slice(0, 5).map((o: any, i: number) => {
                const wr = o.winRateWithTheme ?? 0
                const wrColor = wr >= 60 ? '#059669' : wr >= 40 ? '#D97706' : '#DC2626'
                return (
                  <div key={i} style={{ padding: '8px 10px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', flex: 1 }}>{o.theme}</div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: wrColor, flexShrink: 0 }}>{wr}% win rate</div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {o.dealsWithTheme ?? 0} deal{(o.dealsWithTheme ?? 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Competitor Win Rates + Revenue Forecast */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>

        {/* Competitor Win Rates */}
        <div
          style={cardStyle}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={labelStyle}>Competitor Win Rates</div>
            <InfoTooltip text="Updated automatically when deals close. Shows your historical record against each competitor." />
          </div>
          {competitivePatterns.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              Add competitors to your deals or mention them in meeting notes to track win rates automatically. Need 5 closed deals per competitor to activate per-competitor predictions.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {competitivePatterns.slice(0, 6).map((p: any, i: number) => {
                const wr = p.winRate ?? 0
                const wrColor = wr >= 60 ? '#059669' : wr >= 40 ? '#D97706' : '#DC2626'
                // wins/losses may come from winLossIntel fallback or be derived from ML pattern
                const wins = p.wins != null ? p.wins : Math.round((p.totalDeals ?? 0) * (wr / 100))
                const losses = p.losses != null ? p.losses : (p.totalDeals ?? 0) - wins
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{p.competitor}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{wins}W {losses}L</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '50px', height: '5px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${wr}%`, background: wrColor, borderRadius: '3px', transition: 'width 500ms ease-out' }} />
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: wrColor, width: '32px', textAlign: 'right' }}>{wr}%</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {competitivePatterns.length > 0 && (
            <button
              onClick={() => onAsk('Analyse our competitive win/loss patterns and give me specific recommendations for how to beat each competitor we face.')}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--accent)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
            >
              <Sparkles size={10} /> Competitive Strategy
            </button>
          )}
        </div>

        {/* Revenue Forecast */}
        <div
          style={cardStyle}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={labelStyle}>Revenue Forecast</div>
            <InfoTooltip text="Each deal's value is multiplied by its ML win probability to give an honest forecast — not a gut-feel number." />
          </div>
          {weightedForecast > 0 ? (
            <>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Weighted forecast</div>
                <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>
                  {currencySymbol}<AnimatedNumber target={Math.round(weightedForecast)} format={true} />
                </div>
              </div>
              {rfArr.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                  {rfArr.slice(0, 4).map((r: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{r.month}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{fmtCurrency(r.expectedRevenue)}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{r.dealCount} deal{r.dealCount !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              )}
              {(() => {
                const cutoff = Date.now() - 90 * 86_400_000
                const recentWon = deals.filter((d: any) => d.stage === 'closed_won' && new Date(d.wonDate ?? d.updatedAt).getTime() > cutoff)
                const closedRev = recentWon.reduce((s: number, d: any) => s + (d.dealValue ?? 0), 0)
                if (closedRev <= 0) return null
                return (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Closed (last 90 days): <strong style={{ color: 'var(--success)' }}>{fmtCurrency(closedRev)}</strong>
                  </div>
                )
              })()}
            </>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              Set close dates on your deals to see a probability-weighted revenue forecast
            </div>
          )}
        </div>
      </div>

      {/* Score Trend Alerts */}
      {scoreTrends.length > 0 && (
        <div
          style={cardStyle}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <TrendingUp size={14} style={{ color: 'var(--accent)' }} />
            <div style={labelStyle}>Score Trends</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {scoreTrends.map((t: any, i: number) => {
              const isDown = t.trend === 'declining' || (t.delta ?? 0) < 0
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {isDown ? <TrendingDown size={13} style={{ color: 'var(--danger)', flexShrink: 0 }} /> : <TrendingUp size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{t.company ?? t.dealName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(t.message ?? (isDown ? 'Win probability declining' : 'Engagement strengthening'))}</div>
                  </div>
                  {t.delta != null && (
                    <div style={{ fontSize: '12px', fontWeight: '700', color: isDown ? 'var(--danger)' : 'var(--success)', flexShrink: 0 }}>
                      {t.delta > 0 ? '+' : ''}{Math.round(t.delta)}
                    </div>
                  )}
                  <button
                    onClick={() => onAsk(`The ${t.dealName} deal score is ${isDown ? 'declining' : 'improving'}: ${t.message ?? ''}. Review the deal and tell me what's driving this and what I should do now.`)}
                    style={{ flexShrink: 0, padding: '4px 10px', borderRadius: '6px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--accent)', fontSize: '10px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Ask AI
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Deal Archetypes — needs data message when < 20 deals */}
      {archetypes.length === 0 && (ml?.trainingSize ?? 0) < 20 && (
        <div
          style={cardStyle}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Star size={14} style={{ color: 'var(--accent)' }} />
            <div style={labelStyle}>Deal Archetypes</div>
            <InfoTooltip text="Archetypes are natural groupings discovered by the ML model from your closed deal patterns." />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            {(() => {
              const current = ml?.trainingSize ?? 0
              const needed = Math.max(0, 20 - current)
              return `Deal archetypes form after 20+ deals. Currently ${current} deal${current !== 1 ? 's' : ''}. ${needed} more needed to discover your natural deal types.`
            })()}
          </div>
        </div>
      )}

      {/* Deal Archetypes — only if ML trained on 10+ deals */}
      {archetypes.length > 0 && (ml?.trainingSize ?? 0) >= 10 && (
        <div
          style={cardStyle}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Star size={14} style={{ color: 'var(--accent)' }} />
            <div style={labelStyle}>Deal Archetypes</div>
            <InfoTooltip text="Archetypes are natural groupings discovered by the ML model from your closed deal patterns." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {archetypes.slice(0, 6).map((a: any, i: number) => (
              <div key={i} style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ flexShrink: 0, width: '22px', height: '22px', borderRadius: '6px', background: 'var(--accent-subtle)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--accent)' }}>{i + 1}</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>{a.label ?? a.name ?? `Archetype ${i + 1}`}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {a.winRate != null && <div style={{ fontSize: '11px', color: 'var(--success)' }}>{a.winRate}% win rate</div>}
                  {a.dealCount != null && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{a.dealCount} deals</div>}
                  {a.avgDealValue != null && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>avg {fmtCurrency(a.avgDealValue)}</div>}
                  {a.avgDaysToClose != null && <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>avg {Math.round(a.avgDaysToClose)} days</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ML Pipeline Trends */}
      {mlTrends && (
        <div
          style={cardStyle}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={14} style={{ color: 'var(--accent)' }} />
            <div style={labelStyle}>Pipeline Trends</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {mlTrends.dealVelocity?.recentAvgDays != null && (
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Avg deal cycle</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>{Math.round(mlTrends.dealVelocity.recentAvgDays)}d</div>
                {mlTrends.dealVelocity.direction !== 'stable' && (
                  <div style={{ fontSize: '10px', color: mlTrends.dealVelocity.direction === 'faster' ? 'var(--success)' : 'var(--warning)' }}>
                    {mlTrends.dealVelocity.direction === 'faster' ? '\u2191 Faster' : '\u2193 Slower'} vs prior
                  </div>
                )}
              </div>
            )}
            {mlTrends.winRate?.recentPct != null && (
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Win rate (recent)</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>{Math.round(mlTrends.winRate.recentPct)}%</div>
                {mlTrends.winRate.direction !== 'stable' && (
                  <div style={{ fontSize: '10px', color: mlTrends.winRate.direction === 'improving' ? 'var(--success)' : 'var(--danger)' }}>
                    {mlTrends.winRate.direction === 'improving' ? '\u2191 Improving' : '\u2193 Declining'}
                  </div>
                )}
              </div>
            )}
            {mlTrends.winRate?.slopePctPerMonth != null && Math.abs(mlTrends.winRate.slopePctPerMonth) >= 1 && (
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Win rate trend</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: mlTrends.winRate.slopePctPerMonth >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {mlTrends.winRate.slopePctPerMonth >= 0 ? '+' : ''}{mlTrends.winRate.slopePctPerMonth.toFixed(1)}%/mo
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => onAsk("Analyse my pipeline trends and tell me what's changed, what the data says about where my revenue will come from this quarter, and what I should do differently.")}
            style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.10))', border: '1px solid rgba(99,102,241,0.25)', color: 'var(--accent)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
          >
            <Sparkles size={10} /> Deep Analysis
          </button>
        </div>
      )}

      {/* Empty state */}
      {!wl && !phiScore && !rfArr.length && !ml && archetypes.length === 0 && scoreTrends.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>&#x1F9E0;</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Building your ML model</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Insights appear as you add deals and the AI analyses your pipeline patterns.</div>
        </div>
      )}
    </div>
  )
}


// ── Calendar helpers ──────────────────────────────────────────────────────────
function cleanSnippet(text: string): string {
  return text
    .replace(/^#+\s*/gm, '')  // strip markdown headers
    .replace(/\n+/g, ' ')      // collapse newlines
    .trim()
    .slice(0, 80)
}

// ── Calendar View ────────────────────────────────────────────────────────────
type CalEvent = {
  id: string
  title: string
  subtitle: string
  date: Date
  dealId: string
  type: 'close' | 'contract_start' | 'contract_end' | 'follow_up' | 'urgent' | 'task' | 'phase' | 'mention' | 'meeting' | 'demo' | 'deadline' | 'decision' | 'predicted_close'
  description?: string
  snippet?: string
  source?: string
  time?: string | null
  isPast?: boolean
}

// Extract dates mentioned in free-form text (meeting notes, descriptions, todos, etc.)
function extractDatesFromText(text: string, currentYear: number): { date: Date; snippet: string }[] {
  if (!text) return []
  const results: { date: Date; snippet: string }[] = []
  const seen = new Set<string>()
  const MONTHS: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  }
  const push = (day: number, monthIdx: number, yr: number, idx: number) => {
    if (day < 1 || day > 31 || monthIdx < 0 || monthIdx > 11) return
    const d = new Date(yr, monthIdx, day)
    if (isNaN(d.getTime())) return
    // Only show dates within -60 to +365 days
    const now = Date.now()
    const diff = d.getTime() - now
    if (diff < -60 * 86_400_000 || diff > 365 * 86_400_000) return
    const key = d.toDateString()
    if (seen.has(key)) return
    seen.add(key)
    const start = Math.max(0, idx - 40)
    const end = Math.min(text.length, idx + 60)
    const snippet = text.slice(start, end).replace(/\s+/g, ' ').trim()
    results.push({ date: d, snippet: snippet.length > 80 ? snippet.slice(0, 77) + '…' : snippet })
  }
  // "19th March" / "19 March" / "19 March 2026"
  const p1 = /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?/gi
  let m: RegExpExecArray | null
  while ((m = p1.exec(text)) !== null)
    push(+m[1], MONTHS[m[2].toLowerCase()], m[3] ? +m[3] : currentYear, m.index)
  // "March 19th" / "March 19 2026"
  const p2 = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/gi
  while ((m = p2.exec(text)) !== null)
    push(+m[2], MONTHS[m[1].toLowerCase()], m[3] ? +m[3] : currentYear, m.index)
  return results
}

function CalendarView({ deals, brainData }: { deals: any[]; brainData: any }) {
  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [popoverEvent, setPopoverEvent] = useState<CalEvent | null>(null)

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
  // Project plan tasks and phase targets
  for (const deal of deals) {
    const plan = deal.projectPlan as any
    if (plan?.phases) {
      for (const phase of (plan.phases ?? [])) {
        // Phase target date
        if (phase.targetDate) {
          const d = new Date(phase.targetDate)
          if (!isNaN(d.getTime())) {
            events.push({
              id: `${deal.id}-phase-${phase.id ?? phase.name}`,
              title: deal.prospectCompany,
              subtitle: `📋 ${phase.name}`,
              date: d,
              dealId: deal.id,
              type: 'phase',
            })
          }
        }
        // Individual task due dates (non-complete only)
        for (const task of (phase.tasks ?? [])) {
          if (task.dueDate && task.status !== 'complete') {
            const d = new Date(task.dueDate)
            if (!isNaN(d.getTime())) {
              events.push({
                id: `${deal.id}-task-${task.id ?? task.text}`,
                title: deal.prospectCompany,
                subtitle: `✓ ${task.text}`,
                date: d,
                dealId: deal.id,
                type: 'task',
              })
            }
          }
        }
      }
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

  // Extract dates from free-form text fields (meeting notes, description, todos, success criteria)
  const currentYear = today.getFullYear()
  for (const deal of deals) {
    const textSources: string[] = [
      deal.meetingNotes ?? '',
      deal.description ?? '',
      deal.successCriteria ?? '',
      // todos is a jsonb array of {text, done} objects
      Array.isArray(deal.todos) ? deal.todos.map((t: any) => t.text ?? t ?? '').join(' ') : '',
      Array.isArray(deal.successCriteriaTodos) ? deal.successCriteriaTodos.map((t: any) => t.text ?? t ?? '').join(' ') : '',
    ]
    const combinedText = textSources.join('\n')
    const extracted = extractDatesFromText(combinedText, currentYear)
    for (const { date, snippet } of extracted) {
      events.push({
        id: `${deal.id}-mention-${date.toDateString().replace(/\s/g, '')}`,
        title: deal.prospectCompany,
        subtitle: snippet,
        date,
        dealId: deal.id,
        type: 'mention',
      })
    }
  }

  // Parse scheduled_events from note_signals_json
  const now = new Date()
  for (const deal of deals) {
    try {
      const signals = deal.note_signals_json ? JSON.parse(deal.note_signals_json) : null
      const scheduledEvts = signals?.scheduled_events ?? []
      for (const ev of scheduledEvts) {
        if (!ev.date) continue
        const evDate = new Date(ev.date)
        if (isNaN(evDate.getTime())) continue
        // Only show events within -7 to +90 days
        const diffDays = (evDate.getTime() - now.getTime()) / 86400000
        if (diffDays < -7 || diffDays > 90) continue
        const evType = (ev.type as CalEvent['type']) ?? 'meeting'
        const dealName = deal.prospectCompany || deal.dealName || 'Deal'
        const eventId = `${deal.id}-sched-${ev.type}-${ev.date}`
        // Avoid duplicate with same id
        if (events.find(e => e.id === eventId)) continue
        events.push({
          id: eventId,
          title: dealName,
          subtitle: ev.description ?? '',
          date: evDate,
          dealId: deal.id,
          type: evType,
          description: ev.description,
          source: ev.source_text,
          time: ev.time ?? null,
          isPast: evDate < now,
        })
      }
    } catch { /* malformed JSON — skip */ }
  }

  const eventColor = (type: CalEvent['type']): string => {
    switch (type) {
      case 'close': return '#EF4444'
      case 'urgent': return '#EF4444'
      case 'deadline': return '#EF4444'
      case 'follow_up': return '#EAB308'
      case 'mention': return '#F59E0B'
      case 'meeting': return '#3B82F6'
      case 'demo': return '#22C55E'
      case 'decision': return '#A855F7'
      case 'predicted_close': return '#6366F1'
      case 'contract_start': return '#22C55E'
      case 'contract_end': return '#22D3EE'
      case 'task': return '#8B5CF6'
      case 'phase': return '#06B6D4'
      default: return '#22D3EE'
    }
  }

  const eventTypeLabel = (type: CalEvent['type']): string => {
    switch (type) {
      case 'close': return 'Close Date'
      case 'urgent': return 'Urgent'
      case 'deadline': return 'Deadline'
      case 'follow_up': return 'Follow-up'
      case 'mention': return 'Date Mention'
      case 'meeting': return 'Meeting'
      case 'demo': return 'Demo'
      case 'decision': return 'Decision'
      case 'predicted_close': return 'Predicted Close'
      case 'contract_start': return 'Contract Start'
      case 'contract_end': return 'Contract End'
      case 'task': return 'Task'
      case 'phase': return 'Phase'
      default: return 'Event'
    }
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
              return <div key={`empty-${i}`} style={{ minHeight: '80px' }} />
            }
            const dayEvents = eventsOnDay(day)
            const todayCell = isToday(day)
            const selected = selectedDay === day
            return (
              <div
                key={day}
                onClick={() => setSelectedDay(selected ? null : day)}
                style={{
                  minHeight: '80px', borderRadius: '8px', padding: '6px',
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
                  lineHeight: 1, flexShrink: 0,
                }}>{day}</span>
                {dayEvents.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {dayEvents.slice(0, 2).map(ev => (
                      <div key={ev.id} style={{
                        display: 'flex', alignItems: 'center', gap: '3px',
                        background: eventColor(ev.type),
                        borderRadius: '3px', padding: '1px 4px',
                        height: '16px', overflow: 'hidden',
                        opacity: 0.9,
                      }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.8)', flexShrink: 0 }} />
                        <span style={{
                          fontSize: '10px', color: '#fff', fontWeight: 500,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          lineHeight: 1,
                        }}>
                          {ev.title.slice(0, 12)}{ev.title.length > 12 ? '…' : ''}
                        </span>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', paddingLeft: '2px' }}>+{dayEvents.length - 2} more</span>
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
              const evIsPast = ev.date < today && !(ev.date.getDate() === today.getDate() && ev.date.getMonth() === today.getMonth() && ev.date.getFullYear() === today.getFullYear())
              const dateStr = ev.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
              const displayText = ev.description || cleanSnippet(ev.subtitle)
              return (
                <div key={ev.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px',
                  background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid var(--card-border)', borderRadius: '10px',
                  opacity: evIsPast ? 0.5 : 1,
                  transition: 'opacity 0.1s',
                }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: eventColor(ev.type), flexShrink: 0 }} />
                  <div
                    style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                    onClick={() => setPopoverEvent(popoverEvent?.id === ev.id ? null : ev)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                      <span style={{
                        fontSize: '9px', fontWeight: '600', padding: '1px 5px', borderRadius: '10px',
                        background: eventColor(ev.type) + '22', color: eventColor(ev.type),
                        border: `1px solid ${eventColor(ev.type)}44`, flexShrink: 0,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{eventTypeLabel(ev.type)}</span>
                      {evIsPast && <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', flexShrink: 0 }}>(past)</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{dateStr}</div>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette', { detail: { query: `Prep me for ${ev.title} — ${displayText} on ${dateStr}. Review the deal and tell me what I need to know and do before this date.` } }))}
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
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#71717A' }}>
          <Calendar size={32} style={{ margin: '0 auto 12px', opacity: 0.4, display: 'block' }} />
          <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px', margin: '0 0 6px' }}>No scheduled events this month</p>
          <p style={{ fontSize: '12px', margin: 0 }}>Paste meeting notes with dates to populate your calendar automatically.</p>
        </div>
      )}

      {/* Event popover */}
      {popoverEvent && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          }}
          onClick={() => setPopoverEvent(null)}
        >
          <div
            style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: '14px', padding: '20px', maxWidth: '380px', width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>{popoverEvent.title}</div>
                <span style={{
                  fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '10px',
                  background: eventColor(popoverEvent.type) + '22', color: eventColor(popoverEvent.type),
                  border: `1px solid ${eventColor(popoverEvent.type)}44`,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{eventTypeLabel(popoverEvent.type)}</span>
              </div>
              <button
                onClick={() => setPopoverEvent(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px' }}
              >
                <X size={16} />
              </button>
            </div>

            {(popoverEvent.description || popoverEvent.subtitle) && (
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '10px' }}>
                {popoverEvent.description || cleanSnippet(popoverEvent.subtitle)}
              </div>
            )}

            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              {popoverEvent.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {popoverEvent.time && <span style={{ marginLeft: '6px', color: 'var(--text-tertiary)' }}>at {popoverEvent.time}</span>}
            </div>

            {popoverEvent.source && (
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: '14px', padding: '8px 10px', background: 'var(--surface)', borderRadius: '6px', borderLeft: `3px solid ${eventColor(popoverEvent.type)}` }}>
                &ldquo;{popoverEvent.source}&rdquo;
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <Link
                href={`/deals/${popoverEvent.dealId}`}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '8px 12px', borderRadius: '8px', textDecoration: 'none',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: '12px', fontWeight: '600',
                }}
                onClick={() => setPopoverEvent(null)}
              >
                View Deal
              </Link>
              <button
                onClick={() => {
                  const dateStr = popoverEvent.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                  const desc = popoverEvent.description || cleanSnippet(popoverEvent.subtitle)
                  window.dispatchEvent(new CustomEvent('openCommandPalette', { detail: { query: `Prep me for ${popoverEvent.title} — ${desc} on ${dateStr}. Review the deal and tell me what I need to know and do before this date.` } }))
                  setPopoverEvent(null)
                }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  padding: '8px 12px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.12))',
                  border: '1px solid rgba(99,102,241,0.3)',
                  color: 'var(--accent)', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                }}
              >
                <Sparkles size={11} />
                Prep for this
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── getDealAction: returns specific action for each deal ─────────────────────
function getDealAction(
  deal: any, brain: any, daysInStage: number, activeStages?: any[]
): { type: string; label: string; description: string; colour: string } {
  const score = deal.conversionScore ?? 0
  const stage = deal.stage ?? ''
  const now = Date.now()
  const stageLabel = (activeStages?.find((s: any) => s.id === stage)?.label ?? stage.replace(/_/g, ' ') ?? 'this stage')
  const stageIdx = activeStages ? activeStages.findIndex((s: any) => s.id === stage) : -1
  const totalStages = activeStages?.length ?? 5
  const isEarlyStage = stageIdx >= 0 && stageIdx <= Math.floor(totalStages * 0.4)
  const isLateStage  = stageIdx >= 0 && stageIdx >= Math.ceil(totalStages * 0.7)

  // 0. No meeting notes — no score yet
  if (score === 0 || deal.conversionScore == null) {
    return {
      type: 'data',
      label: 'Needs notes',
      description: `No meeting notes yet for ${deal.dealName || deal.prospectCompany}. Paste notes from your last call to start scoring this deal.`,
      colour: '#6B7280',
    }
  }

  // 1. Close window approaching (within 7 days)
  if (deal.closingDate || deal.closeDate) {
    const closeMs = new Date(deal.closingDate ?? deal.closeDate).getTime()
    const daysToClose = Math.round((closeMs - now) / 86_400_000)
    if (daysToClose >= 0 && daysToClose <= 7 && score > 60) {
      return {
        type: 'close',
        label: 'Close window approaching',
        description: `${deal.dealName || deal.prospectCompany} — close date in ${daysToClose} day${daysToClose !== 1 ? 's' : ''}, score is ${score}%. Push for a final commitment now.`,
        colour: '#30D158',
      }
    }
  }

  // 2. Stale — no update in 14+ days
  const daysSince = Math.floor((now - new Date(deal.updatedAt ?? deal.createdAt).getTime()) / 86_400_000)
  if (daysSince >= 14) {
    return {
      type: 'followup',
      label: `Stale — ${daysSince}d`,
      description: `${deal.dealName || deal.prospectCompany} hasn't been updated in ${daysSince} days. Risk of going cold — reach out to re-establish contact.`,
      colour: '#FFD60A',
    }
  }

  // 3. High score in late stage — push for close
  if (score >= 75 && isLateStage) {
    return {
      type: 'close',
      label: 'Push for close',
      description: `${deal.dealName || deal.prospectCompany} is at ${score}% in ${stageLabel} — strong signals. This deal is ready to close. Define the final step.`,
      colour: '#30D158',
    }
  }

  // 4. High score but early stage — advance
  if (score >= 78 && isEarlyStage) {
    return {
      type: 'advance',
      label: 'Ready to advance',
      description: `${deal.dealName || deal.prospectCompany} scores ${score}% at ${stageLabel}. Strong signals early — move this to the next stage.`,
      colour: '#7C6AF5',
    }
  }

  // 5. Has competitors and weak score
  const hasCompetitors = Array.isArray(deal.competitors) && deal.competitors.length > 0
  if (hasCompetitors && score < 55) {
    const comp = deal.competitors[0]?.name ?? deal.competitors[0] ?? 'a competitor'
    return {
      type: 'competitive',
      label: 'Competitive risk',
      description: `${deal.dealName || deal.prospectCompany} — score ${score}% with ${comp} in play. Sharpen your differentiation before this slips away.`,
      colour: '#FF453A',
    }
  }

  // 6. Deal stalling — days in stage exceeds benchmark
  const stageVel = brain?.stageVelocityIntel?.stageStats?.find((s: any) => s.stage === stage)
  const benchmark = stageVel?.p75Days ?? 21
  if (daysInStage > benchmark) {
    return {
      type: 'stalling',
      label: 'Stalling',
      description: `${deal.dealName || deal.prospectCompany} has been in ${stageLabel} for ${daysInStage} days (typical is ~${benchmark}d). Find the blocker.`,
      colour: '#FFD60A',
    }
  }

  // 7. Score-aware default — no more generic messages
  if (score >= 70) {
    return {
      type: 'maintain',
      label: 'Momentum strong',
      description: `${deal.dealName || deal.prospectCompany} at ${score}% — solid trajectory. Confirm the next concrete step to keep momentum.`,
      colour: '#30D158',
    }
  }
  if (score >= 45) {
    return {
      type: 'nurture',
      label: 'Needs nurturing',
      description: `${deal.dealName || deal.prospectCompany} at ${score}% — moderate signals. Identify what's unclear or unresolved and address it directly.`,
      colour: '#FFD60A',
    }
  }
  return {
    type: 'risk',
    label: 'Weak signals',
    description: `${deal.dealName || deal.prospectCompany} at ${score}% — low confidence. Review what's missing and consider whether this deal is progressing.`,
    colour: '#FF453A',
  }
}

export default function PipelinePage() {
  const { sidebarWidth, sendToCopilot } = useSidebar()
  const { data: dealsData, isLoading } = useSWR('/api/deals', fetcher)
  const deals: any[] = dealsData?.data ?? []
  const { urgentMap, staleMap, mlMap, daysInStageMap, momentumMap } = useDealFlags(deals)
  const { data: configData, mutate: mutateConfig } = useSWR('/api/pipeline-config', fetcher)
  const pipelineConfig = configData?.data
  const presets = configData?.presets ?? []
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })

  const [view, setView] = useState<'today' | 'board' | 'calendar' | 'insights'>('today')
  const [aiInput, setAiInput] = useState('')
  const aiInputRef = useRef<HTMLInputElement>(null)

  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [winLossModal, setWinLossModal] = useState<{ dealId: string; deal: any; outcome: 'closed_won' | 'closed_lost' } | null>(null)
  const [engagementFilter, setEngagementFilter] = useState<string>('')

  const moveStage = async (dealId: string, stage: string) => {
    // If moving to closed, show win/loss interview first
    if (stage === 'closed_won' || stage === 'closed_lost') {
      const deal = deals.find((d: any) => d.id === dealId)
      setWinLossModal({ dealId, deal, outcome: stage as 'closed_won' | 'closed_lost' })
      return
    }
    await doMoveStage(dealId, stage)
  }

  const doMoveStage = async (dealId: string, stage: string, winLossData?: WinLossData) => {
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
      body: JSON.stringify({ stage, winLossData }),
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
  const currencySymbol: string = pipelineConfig?.currency ?? '£'

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
  // ── Trend alerts: pipeline-level signals (declining win rate, stuck stages, etc.) ──
  const trendAlerts = (() => {
    if (!brainData) return []
    type TrendAlert = { headline: string; detail: string; severity: 'high' | 'medium' | 'low'; prompt: string }
    const alerts: TrendAlert[] = []

    // Score trend alerts — deals with improving/declining ML scores
    for (const t of (brainData.scoreTrendAlerts ?? []).slice(0, 2)) {
      const isDecline = t.trend === 'declining' || t.direction === 'down' || (t.change ?? 0) < 0
      alerts.push({
        headline: isDecline ? `${t.company ?? t.dealName} score declining` : `${t.company ?? t.dealName} improving`,
        detail: t.reason ?? t.detail ?? (isDecline ? 'Win probability falling' : 'Engagement strengthening'),
        severity: isDecline ? 'high' : 'low',
        prompt: `The ${t.dealName} deal score is ${isDecline ? 'declining' : 'improving'}. ${t.reason ?? ''}. Review the deal and tell me what's driving this change and what I should do now.`,
      })
    }

    // Stage velocity alerts — deals stuck in a stage too long
    for (const s of (brainData.stageVelocityIntel?.stageAlerts ?? []).slice(0, 2)) {
      alerts.push({
        headline: `${s.count ?? ''} deal${(s.count ?? 0) !== 1 ? 's' : ''} stuck in ${s.stageName ?? s.stage}`,
        detail: s.message ?? `Avg ${s.avgDays ?? '?'}d in stage (expected ${s.expectedDays ?? '?'}d)`,
        severity: 'medium',
        prompt: `${s.count ?? 'Several'} deals are stuck in the ${s.stageName ?? s.stage} stage longer than expected. Review them and tell me what's blocking progress and the best way to accelerate each one.`,
      })
    }

    // ML pipeline trend (overall win rate change)
    const trend = brainData.mlTrends
    const slopePct = trend?.winRate?.slopePctPerMonth
    if (slopePct != null && Math.abs(slopePct) >= 2) {
      const down = slopePct < 0
      alerts.push({
        headline: `Win rate ${down ? 'declining' : 'improving'} ${Math.abs(slopePct).toFixed(1)}%/mo`,
        detail: down ? 'Conversion rate falling vs prior period' : 'Pipeline momentum improving',
        severity: down ? 'high' : 'low',
        prompt: `Our win rate is ${down ? 'declining' : 'improving'} by ${Math.abs(slopePct).toFixed(1)}% per month. Analyse what's driving this and what we should change.`,
      })
    }

    return alerts.slice(0, 3)
  })()

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

    // 4. Brain recommendations — advance/unblock deals (never recommend stage moves)
    for (const r of (brainData.pipelineRecommendations ?? []).slice(0, 5)) {
      if (r.actionType === 'stage_change') continue  // stage moves are prospect-driven, not AI-driven
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

  const activeDeals = deals.filter((d: any) =>
    d.stage !== 'closed_won' && d.stage !== 'closed_lost' &&
    (!engagementFilter || d.engagementType === engagementFilter)
  )
  // Unique engagement types for filter dropdown
  const engagementTypes: string[] = [...new Set(deals.map((d: any) => d.engagementType).filter(Boolean))] as string[]

  const dispatchAI = (query: string) => {
    if (!query.trim()) return
    sendToCopilot(query)
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
          <button style={tabBtn(view === 'insights')} onClick={() => setView('insights')}>
            <Brain size={13} />
            Insights
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
              {(() => {
                const today = new Date()
                const todayMs = today.getTime()
                // Find the nearest upcoming deal by closingDate
                const nearestDeal = activeDeals
                  .filter((d: any) => d.closingDate || d.closeDate)
                  .map((d: any) => ({ deal: d, ms: new Date(d.closingDate ?? d.closeDate).getTime() }))
                  .filter(({ ms }) => ms >= todayMs && ms <= todayMs + 2 * 86_400_000)
                  .sort((a, b) => a.ms - b.ms)[0]?.deal
                const chips = [
                  'What should I prioritise today?',
                  'Which deals are at risk?',
                  'Summarise my pipeline',
                  nearestDeal
                    ? `Prep me for ${nearestDeal.prospectCompany}`
                    : actionQueue[0] ? `Help with ${actionQueue[0].company}` : 'Who should I chase this week?',
                ]
                return chips
              })().map(chip => (
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

          {/* C. Trend alerts */}
          {trendAlerts.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Pipeline signals
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {trendAlerts.map((alert, i) => {
                  const color = alert.severity === 'high' ? 'var(--danger)' : alert.severity === 'medium' ? 'var(--warning)' : 'var(--success)'
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                      background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid var(--card-border)',
                      borderLeft: `3px solid ${color}`,
                      borderRadius: '10px',
                    }}>
                      <AlertTriangle size={14} style={{ color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{alert.headline}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.detail}</div>
                      </div>
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette', { detail: { query: alert.prompt } }))}
                        style={{
                          flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '5px 10px', borderRadius: '7px',
                          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.10))',
                          border: '1px solid rgba(99,102,241,0.25)',
                          color: 'var(--accent)', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                        }}
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

          {/* D. Deals needing action — specific per-deal actions */}
          {activeDeals.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Deals needing action
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {activeDeals.slice(0, 5).map((deal: any, i: number) => {
                  const dias = daysInStageMap[deal.id] ?? 0
                  const action = getDealAction(deal, brainData, dias, activeStages)
                  const score = mlMap[deal.id]?.winProb ?? deal.conversionScore ?? 0
                  const stageLabel = configStages.find((s: any) => s.id === deal.stage)?.label ?? deal.stage ?? ''
                  const prompt = `For the ${deal.dealName || deal.prospectCompany} deal: ${action.description} Review everything about this deal and tell me the single most important next step.`
                  return (
                    <div key={deal.id} style={{
                      display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px',
                      background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid var(--card-border)',
                      borderLeft: `3px solid ${action.colour}`,
                      borderRadius: '10px',
                      transition: 'border-color 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'}
                    >
                      {/* Top row: name + badge + Ask AI */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {deal.dealName || deal.prospectCompany}
                            </span>
                            {deal.dealName && deal.prospectCompany && deal.dealName !== deal.prospectCompany && (
                              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{deal.prospectCompany}</span>
                            )}
                          </div>
                          {/* Action description */}
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                            {action.description}
                          </div>
                        </div>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            sendToCopilot(prompt)
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
                      {/* Bottom row: action badge + score + stage + days */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '100px',
                          background: `${action.colour}18`,
                          color: action.colour,
                          border: `1px solid ${action.colour}33`,
                        }}>
                          {action.label}
                        </span>
                        {score > 0 && (
                          <span style={{
                            fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '100px',
                            background: score >= 70 ? 'rgba(5,150,105,0.1)' : score >= 40 ? 'rgba(217,119,6,0.1)' : 'rgba(220,38,38,0.1)',
                            color: score >= 70 ? '#059669' : score >= 40 ? '#D97706' : '#DC2626',
                            border: `1px solid ${score >= 70 ? 'rgba(5,150,105,0.25)' : score >= 40 ? 'rgba(217,119,6,0.25)' : 'rgba(220,38,38,0.25)'}`,
                          }}>
                            {score}%
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{stageLabel}</span>
                        {dias > 0 && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>&middot; {dias}d in stage</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* E. Top picks — Highest Win Probability with days in stage */}
          {topDeals.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Highest win probability
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {topDeals.map((deal: any) => {
                  const topScore = mlMap[deal.id]?.winProb ?? deal.conversionScore ?? 0
                  const scoreColorVal = topScore >= 70 ? 'var(--success)' : topScore >= 40 ? 'var(--warning)' : 'var(--danger)'
                  const dias = daysInStageMap[deal.id] ?? 0
                  // TODO: Add direction indicator (↑/↓/→) once historical score tracking is available
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
                          {dias > 0 && (
                            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                              {dias}d in stage
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <div style={{ fontSize: '20px', fontWeight: '800', color: scoreColorVal, flexShrink: 0, lineHeight: 1 }}>
                            {topScore}%
                          </div>
                          {/* Direction: → stable (TODO: update when score history available) */}
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>&rarr; stable</div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* G. Recently Closed */}
          {(() => {
            const cutoff = Date.now() - 30 * 86_400_000
            const recentClosed = deals.filter((d: any) =>
              (d.stage === 'closed_won' || d.stage === 'closed_lost') &&
              new Date(d.wonDate ?? d.lostDate ?? d.updatedAt).getTime() > cutoff
            ).sort((a: any, b: any) => new Date(b.wonDate ?? b.lostDate ?? b.updatedAt).getTime() - new Date(a.wonDate ?? a.lostDate ?? a.updatedAt).getTime())
            if (recentClosed.length === 0) return null
            return (
              <div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Recently Closed
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {recentClosed.slice(0, 5).map((deal: any) => {
                    const isWon = deal.stage === 'closed_won'
                    const closeDate = new Date(deal.wonDate ?? deal.lostDate ?? deal.updatedAt)
                    const dateStr = closeDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    return (
                      <Link
                        key={deal.id}
                        href={`/deals/${deal.id}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                          background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                          border: `1px solid ${isWon ? 'rgba(5,150,105,0.2)' : 'var(--card-border)'}`,
                          borderRadius: '10px', textDecoration: 'none',
                          transition: 'border-color 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = isWon ? 'rgba(5,150,105,0.2)' : 'var(--card-border)'}
                      >
                        {isWon
                          ? <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                          : <XCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {deal.prospectCompany}
                          </div>
                          <div style={{ fontSize: '10px', color: isWon ? '#06B6D4' : '#06B6D4', marginTop: '1px' }}>
                            {isWon ? 'Contributing to ML training data' : "Loss patterns improving your model's risk detection"}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: isWon ? 'var(--success)' : 'var(--danger)' }}>
                            {isWon ? 'Won' : 'Lost'}
                            {deal.dealValue ? ` · ${currencySymbol}${Math.round(deal.dealValue).toLocaleString()}` : ''}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{dateStr}</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* H. Model Status */}
          {(() => {
            const ml = brainData?.mlModel
            // Use whichever source gives the higher count — mlModel.trainingSize may be stale
            // while winLossIntel correctly counts deals by both stage and outcome fields.
            const closedCount = Math.max(
              (brainData?.winLossIntel?.winCount ?? 0) + (brainData?.winLossIntel?.lossCount ?? 0),
              ml?.trainingSize ?? 0
            )
            const winCount  = brainData?.winLossIntel?.winCount ?? 0
            const lossCount = brainData?.winLossIntel?.lossCount ?? 0
            const hasBothWinsAndLosses = winCount > 0 && lossCount > 0
            const accuracy = ml?.looAccuracy != null ? Math.round(ml.looAccuracy * 100) : null
            let statusLabel = 'ML Model: Building'
            let statusColor = 'var(--text-tertiary)'
            let nextMilestone = ''
            if (closedCount === 0) {
              statusLabel = 'ML Model: Building'
              statusColor = 'var(--text-tertiary)'
              nextMilestone = 'Add your first closed deal to start building your model'
            } else if (closedCount >= 10 && hasBothWinsAndLosses) {
              statusLabel = 'ML Model: Active'
              statusColor = 'var(--success)'
              nextMilestone = accuracy != null ? `${accuracy}% prediction accuracy` : 'Predictions active'
            } else if (closedCount >= 10) {
              statusLabel = 'ML Model: Needs Loss Data'
              statusColor = 'var(--warning)'
              nextMilestone = 'Need both wins AND losses for ML predictions'
            } else if (closedCount >= 5) {
              statusLabel = 'ML Model: Warming Up'
              statusColor = 'var(--warning)'
              nextMilestone = `${10 - closedCount} more closed deal${(10 - closedCount) !== 1 ? 's' : ''} to activate velocity benchmarks`
            } else {
              statusLabel = 'ML Model: Warming Up'
              statusColor = 'var(--warning)'
              nextMilestone = `${5 - closedCount} more closed deal${(5 - closedCount) !== 1 ? 's' : ''} to activate deal similarity matching`
            }
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px',
                background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid var(--card-border)', borderRadius: '12px',
              }}>
                <Brain size={16} style={{ color: statusColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: statusColor }}>{statusLabel}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                    {closedCount} closed deal{closedCount !== 1 ? 's' : ''} &middot; {nextMilestone}
                  </div>
                </div>
                <Link href="/models" style={{
                  flexShrink: 0, fontSize: '11px', fontWeight: '600', color: 'var(--accent)',
                  textDecoration: 'none', padding: '4px 10px', borderRadius: '6px',
                  background: 'var(--accent-subtle)', border: '1px solid var(--border-strong)',
                }}>
                  View model
                </Link>
              </div>
            )
          })()}

          {/* F. Empty state */}
          {!isLoading && activeDeals.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>&#x1F680;</div>
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
              {totalPipeline > 0 && ` · ${dealValueLabel(totalPipeline, undefined, undefined, currencySymbol)} annualised pipeline`}
              {' · '}
              <span style={{ color: 'var(--text-tertiary)' }}>Drag cards to move stages</span>
            </p>
          </div>

          {/* Engagement type filter */}
          {engagementTypes.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Filter:</span>
              <button
                onClick={() => setEngagementFilter('')}
                style={{
                  fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '100px', cursor: 'pointer',
                  background: engagementFilter === '' ? 'var(--accent-subtle)' : 'transparent',
                  color: engagementFilter === '' ? 'var(--accent)' : 'var(--text-tertiary)',
                  border: `1px solid ${engagementFilter === '' ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >All</button>
              {engagementTypes.map(t => (
                <button
                  key={t}
                  onClick={() => setEngagementFilter(engagementFilter === t ? '' : t)}
                  style={{
                    fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '100px', cursor: 'pointer',
                    background: engagementFilter === t ? 'rgba(255,255,255,0.10)' : 'transparent',
                    color: engagementFilter === t ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    border: `1px solid ${engagementFilter === t ? 'rgba(255,255,255,0.20)' : 'var(--border)'}`,
                  }}
                >{t}</button>
              ))}
            </div>
          )}

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
                      padding: '10px 12px',
                      background: isDropTarget ? `rgba(${hexToRgb(stage.color)},0.06)` : 'var(--card-bg)',
                      border: isDropTarget ? `1px solid ${stage.color}33` : '1px solid var(--card-border)',
                      borderRadius: '10px',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', flex: 1 }}>{stage.label}</span>
                        <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: '100px' }}>{stageDeals.length}</span>
                      </div>
                      {stageValue > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                          {currencySymbol}{stageValue >= 1_000_000 ? `${(stageValue / 1_000_000).toFixed(1)}m` : stageValue >= 1_000 ? `${Math.round(stageValue / 1_000)}k` : stageValue.toLocaleString()} annualised
                        </div>
                      )}
                    </div>

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

      {/* ── INSIGHTS VIEW ───────────────────────────────────────────────────── */}
      {view === 'insights' && (
        <InsightsView brainData={brainData} deals={deals} currencySymbol={currencySymbol} onAsk={dispatchAI} />
      )}

      <PipelineSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={pipelineConfig}
        presets={presets}
        onUpdate={() => mutateConfig()}
      />

      {winLossModal && (
        <WinLossModal
          deal={winLossModal.deal}
          outcome={winLossModal.outcome}
          onSubmit={async (data) => {
            setWinLossModal(null)
            await doMoveStage(winLossModal.dealId, winLossModal.outcome, data)
          }}
          onSkip={() => {
            const { dealId, outcome } = winLossModal
            setWinLossModal(null)
            doMoveStage(dealId, outcome)
          }}
        />
      )}
    </div>
  )
}

// Utility: convert hex color to "r,g,b" string for rgba()
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '124,58,237'
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
}
