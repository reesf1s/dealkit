'use client'
export const dynamic = 'force-dynamic'

import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { useState } from 'react'
import {
  Plus, TrendingUp, DollarSign, ChevronRight, Sparkles,
  CheckSquare, Square, MoreHorizontal, Target, Zap, ArrowUpRight,
  AlertCircle, Star
} from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

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

function DealCard({ deal, onMoveStage }: { deal: any; onMoveStage: (id: string, stage: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const nextStages = STAGES.filter(s => s.id !== deal.stage && s.id !== 'closed_won' && s.id !== 'closed_lost')
  const stageConfig = STAGES.find(s => s.id === deal.stage)

  const todos: any[] = deal.todos ?? []
  const doneTodos = todos.filter((t: any) => t.done).length

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      padding: '14px',
      position: 'relative',
      transition: 'border-color 0.2s, transform 0.15s',
      cursor: 'default',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.borderColor = `${stageConfig?.color ?? '#6366F1'}40`
      ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'
      ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
    }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/deals/${deal.id}`} style={{ fontSize: '13px', fontWeight: '600', color: '#F1F1F3', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {deal.prospectCompany}
          </Link>
          {deal.prospectName && (
            <div style={{ fontSize: '11px', color: '#666', marginTop: '1px' }}>{deal.prospectName}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
          <ScoreBadge score={deal.conversionScore} />
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '2px', display: 'flex', borderRadius: '4px' }}
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '22px', zIndex: 50,
                background: 'rgba(20,20,28,0.95)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px', padding: '6px', minWidth: '160px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
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
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.12)',
          borderRadius: '7px', padding: '8px 10px', marginBottom: '10px',
          display: 'flex', gap: '6px', alignItems: 'flex-start',
        }}>
          <Sparkles size={11} color="#818CF8" style={{ marginTop: '1px', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', color: '#818CF8', lineHeight: '1.5' }}>{deal.conversionInsights[0]}</span>
        </div>
      )}

      {/* Deal value + todos */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {deal.dealValue ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '700', color: '#22C55E' }}>
            <DollarSign size={11} />
            {(deal.dealValue / 100).toLocaleString()}
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
      <Link href={`/deals/${deal.id}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '10px', fontSize: '11px', color: '#444', textDecoration: 'none', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px', transition: 'color 0.1s' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6366F1'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#444'}
      >
        Open deal <ArrowUpRight size={10} style={{ marginLeft: 'auto' }} />
      </Link>
    </div>
  )
}

export default function PipelinePage() {
  const { data: deals, isLoading } = useSWR('/api/deals', fetcher)

  const moveStage = async (dealId: string, stage: string) => {
    await fetch(`/api/deals/${dealId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
    mutate('/api/deals')
  }

  const activeStages = STAGES.filter(s => s.id !== 'closed_won' && s.id !== 'closed_lost')
  const totalPipeline = (deals ?? [])
    .filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    .reduce((sum: number, d: any) => sum + (d.dealValue ?? 0), 0)
  const topDeals = (deals ?? [])
    .filter((d: any) => d.conversionScore)
    .sort((a: any, b: any) => (b.conversionScore ?? 0) - (a.conversionScore ?? 0))
    .slice(0, 3)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.03em', color: '#F1F1F3', marginBottom: '4px' }}>
            Sales Pipeline
          </h1>
          <p style={{ fontSize: '13px', color: '#555' }}>
            {(deals ?? []).filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length} active deals
            {totalPipeline > 0 && ` · $${(totalPipeline / 100).toLocaleString()} pipeline value`}
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
        <div style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: '12px', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '26px', height: '26px', background: 'rgba(99,102,241,0.12)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star size={12} color="#818CF8" />
            </div>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#EBEBEB' }}>AI Top Picks to Close</span>
            <span style={{ fontSize: '11px', color: '#555' }}>Highest conversion probability</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {topDeals.map((deal: any) => (
              <Link key={deal.id} href={`/deals/${deal.id}`} style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '9px', textDecoration: 'none',
                transition: 'border-color 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.3)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#EBEBEB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.prospectCompany}</div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>
                    {STAGES.find(s => s.id === deal.stage)?.label}
                    {deal.dealValue && ` · $${(deal.dealValue / 100).toLocaleString()}`}
                  </div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: deal.conversionScore >= 70 ? '#22C55E' : '#F59E0B' }}>
                  {deal.conversionScore}%
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '12px', minWidth: 'max-content' }}>
          {activeStages.map(stage => {
            const stageDeals = (deals ?? []).filter((d: any) => d.stage === stage.id)
            const stageValue = stageDeals.reduce((s: number, d: any) => s + (d.dealValue ?? 0), 0)
            return (
              <div key={stage.id} style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* Column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  borderTop: `3px solid ${stage.color}`,
                }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: stage.color, boxShadow: `0 0 6px ${stage.color}` }} />
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#EBEBEB', flex: 1 }}>{stage.label}</span>
                  <span style={{ fontSize: '11px', color: '#555', background: 'rgba(255,255,255,0.06)', padding: '1px 7px', borderRadius: '100px' }}>{stageDeals.length}</span>
                </div>
                {stageValue > 0 && (
                  <div style={{ fontSize: '11px', color: '#555', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={10} />
                    ${(stageValue / 100).toLocaleString()} value
                  </div>
                )}

                {/* Cards */}
                {isLoading ? (
                  <div style={{ height: '80px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#333' }}>Loading...</div>
                  </div>
                ) : stageDeals.length === 0 ? (
                  <div style={{ height: '80px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#333' }}>No deals</span>
                  </div>
                ) : (
                  stageDeals.map((deal: any) => (
                    <DealCard key={deal.id} deal={deal} onMoveStage={moveStage} />
                  ))
                )}

                {/* Add to stage */}
                <Link href="/deals" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '9px', background: 'rgba(255,255,255,0.01)',
                  border: '1px dashed rgba(255,255,255,0.06)',
                  borderRadius: '9px', color: '#333', fontSize: '12px', textDecoration: 'none',
                  transition: 'color 0.1s, border-color 0.1s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = '#6366F1'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.25)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = '#333'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'
                }}
                >
                  <Plus size={12} /> Add deal
                </Link>
              </div>
            )
          })}

          {/* Won/Lost summary */}
          <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {['closed_won', 'closed_lost'].map(stageId => {
              const s = STAGES.find(x => x.id === stageId)!
              const stageDeals = (deals ?? []).filter((d: any) => d.stage === stageId)
              const val = stageDeals.reduce((sum: number, d: any) => sum + (d.dealValue ?? 0), 0)
              return (
                <div key={stageId} style={{
                  padding: '14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${s.color}22`,
                  borderRadius: '12px',
                  borderTop: `3px solid ${s.color}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#EBEBEB' }}>{s.label}</span>
                    <span style={{ fontSize: '11px', color: '#555', background: 'rgba(255,255,255,0.06)', padding: '1px 7px', borderRadius: '100px', marginLeft: 'auto' }}>{stageDeals.length}</span>
                  </div>
                  {val > 0 && <div style={{ fontSize: '18px', fontWeight: '700', color: s.color }}>${(val / 100).toLocaleString()}</div>}
                  {stageDeals.length === 0 && <div style={{ fontSize: '11px', color: '#333' }}>No deals yet</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
