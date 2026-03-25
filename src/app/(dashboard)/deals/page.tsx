'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, Brain, Kanban, BarChart3, AlertTriangle, Target, TrendingUp } from 'lucide-react'
import { DealForm } from '@/components/deals/DealForm'
import { useToast } from '@/components/shared/Toast'
import SetupBanner from '@/components/shared/SetupBanner'
import { fetcher, isDbNotConfigured } from '@/lib/fetcher'
import { getScoreColor } from '@/lib/deal-context'
import type { DealLog } from '@/types'

type Mode = 'intelligence' | 'kanban' | 'ml'

const STAGES = [
  { id: 'prospecting',   label: 'Prospecting',   color: '#64748b' },
  { id: 'qualification', label: 'Qualification',  color: '#3B82F6' },
  { id: 'discovery',     label: 'Discovery',      color: '#8B5CF6' },
  { id: 'proposal',      label: 'Proposal',       color: '#F59E0B' },
  { id: 'negotiation',   label: 'Negotiation',    color: '#EF4444' },
  { id: 'closed_won',    label: 'Closed Won',     color: '#10b981' },
]

function riskDot(score: number) {
  if (score <= 0) return 'rgba(226,232,240,0.20)'
  if (score >= 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function daysSince(date: string | Date | null | undefined): string {
  if (!date) return ''
  const diff = Date.now() - new Date(date).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'today'
  if (d === 1) return '1d ago'
  return `${d}d ago`
}

function formatVal(v: number, sym: string): string {
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000) return `${sym}${Math.round(v / 1_000)}k`
  return `${sym}${v}`
}

// Enterprise-density deal row card
function DealMiniCard({ deal, currencySymbol }: { deal: any; currencySymbol: string }) {
  const score = deal.conversionScore ?? 0
  const isClosed = deal.stage === 'closed_won' || deal.stage === 'closed_lost'
  const scoreColor = getScoreColor(score, isClosed)
  const dotColor = riskDot(score)
  const lastActivity = daysSince(deal.updatedAt)

  return (
    <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          padding: '8px 10px',
          borderRadius: '8px',
          marginBottom: '4px',
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.09)',
          cursor: 'pointer',
          transition: 'background 0.12s, border-color 0.12s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.09)'
        }}
      >
        {/* Row 1: dot + company + score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: dotColor, flexShrink: 0,
          }} />
          <div style={{
            flex: 1, fontSize: '12px', fontWeight: 500,
            color: 'rgba(255,255,255,0.85)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {deal.prospectCompany ?? deal.dealName ?? 'Untitled'}
          </div>
          {score > 0 && (
            <span style={{
              fontSize: '10px', fontWeight: 700,
              color: scoreColor, flexShrink: 0,
            }}>{score}%</span>
          )}
        </div>
        {/* Row 2: value + last activity */}
        <div style={{
          display: 'flex', gap: '8px', marginTop: '3px',
          paddingLeft: '11px',
        }}>
          {deal.dealValue > 0 && (
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)', fontVariantNumeric: 'tabular-nums' }}>
              {formatVal(deal.dealValue, currencySymbol)}
            </span>
          )}
          {lastActivity && (
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.22)' }}>
              {lastActivity}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function DealsPage() {
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>('kanban')
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)

  const { data, isLoading, error, mutate } = useSWR<{ data: DealLog[] }>('/api/deals', fetcher)
  const { data: configData } = useSWR('/api/pipeline-config', fetcher, { revalidateOnFocus: false })
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })

  const deals = data?.data ?? []
  const dbError = isDbNotConfigured(error)
  const currencySymbol: string = configData?.data?.currency ?? '£'
  const brain = brainRes?.data
  const mlPredictions: any[] = brain?.mlPredictions ?? []

  const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

  // Intelligence mode — grouped by health score band
  const atRisk = activeDeals.filter(d => (d.conversionScore ?? 0) > 0 && (d.conversionScore ?? 0) < 40)
  const watch = activeDeals.filter(d => (d.conversionScore ?? 0) >= 40 && (d.conversionScore ?? 0) < 70)
  const healthy = activeDeals.filter(d => (d.conversionScore ?? 0) >= 70)
  const unscored = activeDeals.filter(d => !d.conversionScore || d.conversionScore === 0)

  // Kanban mode — grouped by stage
  const dealsByStage: Record<string, DealLog[]> = {}
  for (const s of STAGES) dealsByStage[s.id] = deals.filter(d => d.stage === s.id)

  // ML Insights mode — ranked by win probability
  const mlRanked = [...activeDeals].sort((a, b) => {
    const ap = mlPredictions.find((p: any) => p.dealId === a.id)?.winProbability ?? 0
    const bp = mlPredictions.find((p: any) => p.dealId === b.id)?.winProbability ?? 0
    return bp - ap
  })

  async function handleAdd(payload: Partial<DealLog>) {
    setAddLoading(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Failed to log deal', 'error'); return }
      await mutate()
      setAddOpen(false)
      toast('Deal logged', 'success')
    } finally { setAddLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px', letterSpacing: '-0.02em' }}>Deals</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
            {deals.length} total · {activeDeals.length} active
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Segmented control */}
          <div style={{
            display: 'flex', gap: '1px', padding: '2px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '7px',
          }}>
            {([
              { id: 'intelligence', Icon: Brain, label: 'Intelligence' },
              { id: 'kanban', Icon: Kanban, label: 'Kanban' },
              { id: 'ml', Icon: BarChart3, label: 'ML Insights' },
            ] as const).map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 12px', borderRadius: '5px',
                  fontSize: '11.5px', fontWeight: mode === id ? 500 : 400,
                  color: mode === id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  background: mode === id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: '1px solid ' + (mode === id ? 'rgba(255,255,255,0.10)' : 'transparent'),
                  cursor: 'pointer', transition: 'all 0.10s',
                }}
              >
                <Icon size={10} /> {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setAddOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              height: '32px', padding: '0 14px', borderRadius: '6px',
              background: '#111520',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(226,232,240,0.85)', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#1a1f2e'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#111520'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
            }}
          >
            <Plus size={13} strokeWidth={2} /> Log Deal
          </button>
        </div>
      </div>

      {dbError && <SetupBanner context="Add a DATABASE_URL to start logging deals and tracking your win rate." />}

      {/* ══ INTELLIGENCE MODE ══ */}
      {mode === 'intelligence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isLoading ? (
            <div style={{ height: '200px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }} className="skeleton" />
          ) : (
            <>
              {([
                { label: 'At Risk', subtitle: 'Score < 40', deals: atRisk, dotColor: '#ef4444', borderColor: 'rgba(239,68,68,0.15)', icon: <AlertTriangle size={12} /> },
                { label: 'Watch', subtitle: 'Score 40–70', deals: watch, dotColor: '#f59e0b', borderColor: 'rgba(245,158,11,0.15)', icon: <Target size={12} /> },
                { label: 'Healthy', subtitle: 'Score 70+', deals: healthy, dotColor: '#10b981', borderColor: 'rgba(16,185,129,0.15)', icon: <TrendingUp size={12} /> },
              ]).map(band => (
                <div key={band.label} style={{
                  background: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: `1px solid ${band.borderColor}`,
                  borderRadius: '8px', padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: band.dotColor, flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{band.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{band.subtitle}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.04)', padding: '1px 7px', borderRadius: '100px' }}>
                      {band.deals.length}
                    </span>
                  </div>
                  {band.deals.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>No deals in this band</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px' }}>
                      {band.deals.map((deal: any) => <DealMiniCard key={deal.id} deal={deal} currencySymbol={currencySymbol} />)}
                    </div>
                  )}
                </div>
              ))}
              {unscored.length > 0 && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(226,232,240,0.20)', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Not yet scored</span>
                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.04)', padding: '1px 7px', borderRadius: '100px' }}>{unscored.length}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px' }}>
                    {unscored.map((deal: any) => <DealMiniCard key={deal.id} deal={deal} currencySymbol={currencySymbol} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ KANBAN MODE ══ */}
      {mode === 'kanban' && (
        <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              {STAGES.slice(0, 5).map((_, i) => (
                <div key={i} style={{ minWidth: '200px', height: '280px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }} className="skeleton" />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', minWidth: `${STAGES.length * 215}px` }}>
              {STAGES.map(stage => (
                <div key={stage.id} style={{
                  minWidth: '200px', width: '200px', flexShrink: 0,
                  background: 'rgba(255,255,255,0.04)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px', padding: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(255,255,255,0.60)' }}>{stage.label}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '100px' }}>
                      {(dealsByStage[stage.id] ?? []).length}
                    </span>
                  </div>
                  <div>
                    {(dealsByStage[stage.id] ?? []).map(deal => (
                      <DealMiniCard key={deal.id} deal={deal} currencySymbol={currencySymbol} />
                    ))}
                    {(dealsByStage[stage.id] ?? []).length === 0 && (
                      <div style={{ height: '48px', borderRadius: '5px', border: '1px dashed rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)' }}>empty</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ ML INSIGHTS MODE ══ */}
      {mode === 'ml' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '11.5px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
            Deals ranked by ML win probability. Model activates with 10+ closed deals. Feature importance shows which signals drive each score.
          </div>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ height: '52px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)' }} className="skeleton" />
            ))
          ) : mlRanked.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)', fontSize: '12px' }}>
              No active deals to rank
            </div>
          ) : (
            mlRanked.map((deal: any, i: number) => {
              const ml = mlPredictions.find((p: any) => p.dealId === deal.id)
              const winProb = ml?.winProbability != null ? Math.round(ml.winProbability * 100) : null
              const churnRisk = ml?.churnRisk != null ? Math.round(ml.churnRisk) : null
              const score = deal.conversionScore ?? 0
              const scoreColor = getScoreColor(score, false)
              const features: Array<{ name: string; importance: number; direction: string }> = ml?.featureImportance ?? []
              return (
                <div key={deal.id} style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px', overflow: 'hidden',
                }}>
                  <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 14px',
                        transition: 'background 0.10s', cursor: 'pointer',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(226,232,240,0.50)' }}>#{i + 1}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {deal.prospectCompany ?? deal.dealName ?? 'Untitled'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                          {deal.stage?.replace('_', ' ')}
                          {deal.dealValue ? ` · ${currencySymbol}${deal.dealValue >= 1000 ? `${(deal.dealValue / 1000).toFixed(0)}k` : deal.dealValue}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0 }}>
                        {winProb != null ? (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: winProb >= 70 ? '#10b981' : winProb >= 40 ? '#f59e0b' : '#ef4444', lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{winProb}%</div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>win prob</div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>no data</div>
                          </div>
                        )}
                        {churnRisk != null && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: churnRisk >= 60 ? '#ef4444' : 'var(--text-tertiary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{churnRisk}%</div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>churn</div>
                          </div>
                        )}
                        {score > 0 && (
                          <div style={{ fontSize: '12px', fontWeight: 600, color: scoreColor, padding: '2px 7px', borderRadius: '5px', background: `${scoreColor}18` }}>
                            {score}%
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                  {/* Feature importance bars */}
                  {features.length > 0 && (
                    <div style={{ padding: '8px 14px 10px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {features.slice(0, 4).map((f, fi) => {
                        const isPositive = f.direction !== 'negative'
                        const barColor = isPositive ? '#10b981' : '#ef4444'
                        const pct = Math.min(100, Math.round(f.importance * 100))
                        return (
                          <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '120px', fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                            <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '2px', transition: 'width 0.5s ease-out' }} />
                            </div>
                            <div style={{ width: '32px', textAlign: 'right', fontSize: '10px', fontWeight: 600, color: barColor, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{pct}%</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Add Deal Modal */}
      <Dialog.Root open={addOpen} onOpenChange={setAddOpen}>
        <Dialog.Portal>
          <Dialog.Overlay style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 500,
          }} />
          <Dialog.Content style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)', zIndex: 501,
            width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto',
            background: 'rgba(18,6,42,0.80)',
            backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '24px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.70)', outline: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <Dialog.Title style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                Log a deal
              </Dialog.Title>
              <Dialog.Close asChild>
                <button style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: 'rgba(226,232,240,0.45)' }}>
                  <X size={13} strokeWidth={2} />
                </button>
              </Dialog.Close>
            </div>
            <DealForm onSubmit={handleAdd} loading={addLoading} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
