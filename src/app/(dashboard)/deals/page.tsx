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
  { id: 'prospecting',   label: 'Prospecting',   color: '#6B7280' },
  { id: 'qualification', label: 'Qualification',  color: '#3B82F6' },
  { id: 'discovery',     label: 'Discovery',      color: '#8B5CF6' },
  { id: 'proposal',      label: 'Proposal',       color: '#F59E0B' },
  { id: 'negotiation',   label: 'Negotiation',    color: '#EF4444' },
  { id: 'closed_won',    label: 'Closed Won',     color: '#22C55E' },
]

const card: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(59,130,246,0.04), transparent)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '12px',
  boxShadow: '0 2px 20px rgba(0,0,0,0.30)',
}

function DealMiniCard({ deal, currencySymbol }: { deal: any; currencySymbol: string }) {
  const score = deal.conversionScore ?? 0
  const isClosed = deal.stage === 'closed_won' || deal.stage === 'closed_lost'
  const scoreColor = getScoreColor(score, isClosed)

  return (
    <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          padding: '10px 12px', borderRadius: '10px', marginBottom: '6px',
          background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
          cursor: 'pointer', transition: 'all 0.12s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {deal.prospectCompany ?? deal.dealName ?? 'Untitled'}
            </div>
            {deal.dealName && deal.dealName !== deal.prospectCompany && (
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {deal.dealName}
              </div>
            )}
          </div>
          {score > 0 && (
            <div style={{
              fontSize: '11px', fontWeight: 700, color: scoreColor, flexShrink: 0,
              padding: '2px 6px', borderRadius: '5px',
              background: `${scoreColor}22`,
            }}>
              {score}%
            </div>
          )}
        </div>
        {deal.dealValue > 0 && (
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.32)', marginTop: '4px' }}>
            {currencySymbol}{deal.dealValue >= 1000 ? `${(deal.dealValue / 1000).toFixed(0)}k` : deal.dealValue}
          </div>
        )}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Deals</h1>
          <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
            <span style={{ color: '#818cf8', fontWeight: 600 }}>{deals.length}</span> total ·{' '}
            <span style={{ color: 'rgba(255,255,255,0.50)' }}>{activeDeals.length} active</span>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Segmented control */}
          <div style={{
            display: 'flex', gap: '2px', padding: '3px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
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
                  padding: '6px 14px', borderRadius: '7px',
                  fontSize: '12px', fontWeight: mode === id ? 600 : 500,
                  color: mode === id ? '#818cf8' : 'rgba(255,255,255,0.45)',
                  background: mode === id ? 'rgba(99,102,241,0.14)' : 'transparent',
                  border: mode === id ? '1px solid rgba(99,102,241,0.22)' : '1px solid transparent',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                <Icon size={11} /> {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setAddOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              height: '36px', padding: '0 18px', borderRadius: '9px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              border: '1px solid rgba(99,102,241,0.50)',
              color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 0 20px rgba(99,102,241,0.30), 0 4px 12px rgba(0,0,0,0.30)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 0 28px rgba(99,102,241,0.45), 0 6px 20px rgba(0,0,0,0.35)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(99,102,241,0.30), 0 4px 12px rgba(0,0,0,0.30)' }}
          >
            <Plus size={14} strokeWidth={2.5} /> Log Deal
          </button>
        </div>
      </div>

      {dbError && <SetupBanner context="Add a DATABASE_URL to start logging deals and tracking your win rate." />}

      {/* ══ INTELLIGENCE MODE ══ */}
      {mode === 'intelligence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isLoading ? (
            <div style={{ height: '200px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', animation: 'sk 1.5s infinite' }} />
          ) : (
            <>
              {([
                { label: 'At Risk', subtitle: 'Score < 40 — needs immediate attention', deals: atRisk, color: '#f87171', bg: 'rgba(248,113,113,0.05)', border: 'rgba(248,113,113,0.18)', icon: <AlertTriangle size={13} /> },
                { label: 'Watch', subtitle: 'Score 40–70 — monitor closely', deals: watch, color: '#fbbf24', bg: 'rgba(251,191,36,0.05)', border: 'rgba(251,191,36,0.18)', icon: <Target size={13} /> },
                { label: 'Healthy', subtitle: 'Score 70+ — on track', deals: healthy, color: '#34d399', bg: 'rgba(52,211,153,0.05)', border: 'rgba(52,211,153,0.18)', icon: <TrendingUp size={13} /> },
              ]).map(band => (
                <div key={band.label} style={{ background: band.bg, border: `1px solid ${band.border}`, borderRadius: '14px', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <span style={{ color: band.color }}>{band.icon}</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: band.color }}>{band.label}</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>— {band.subtitle}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.30)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '100px' }}>
                      {band.deals.length}
                    </span>
                  </div>
                  {band.deals.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '10px 0' }}>No deals in this band</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px' }}>
                      {band.deals.map((deal: any) => <DealMiniCard key={deal.id} deal={deal} currencySymbol={currencySymbol} />)}
                    </div>
                  )}
                </div>
              ))}
              {unscored.length > 0 && (
                <div style={{ ...card, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>Not yet scored</span>
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '100px' }}>{unscored.length}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px' }}>
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
            <div style={{ display: 'flex', gap: '12px' }}>
              {STAGES.slice(0, 5).map((_, i) => (
                <div key={i} style={{ minWidth: '210px', height: '300px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', animation: 'sk 1.5s infinite' }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '12px', minWidth: `${STAGES.length * 230}px` }}>
              {STAGES.map(stage => (
                <div key={stage.id} style={{
                  minWidth: '210px', width: '210px', flexShrink: 0,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px', padding: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.72)' }}>{stage.label}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.04)', padding: '1px 7px', borderRadius: '100px' }}>
                      {(dealsByStage[stage.id] ?? []).length}
                    </span>
                  </div>
                  <div>
                    {(dealsByStage[stage.id] ?? []).map(deal => (
                      <DealMiniCard key={deal.id} deal={deal} currencySymbol={currencySymbol} />
                    ))}
                    {(dealsByStage[stage.id] ?? []).length === 0 && (
                      <div style={{ height: '60px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.20)' }}>empty</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', fontSize: '12px', color: 'rgba(255,255,255,0.50)', marginBottom: '4px' }}>
            Deals ranked by ML win probability. The model activates with 10+ closed deals. Feature importance breakdown per deal shows which signals are driving the score.
          </div>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ height: '58px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', animation: 'sk 1.5s infinite' }} />
            ))
          ) : mlRanked.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>
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
                <div key={deal.id} style={{ ...card, padding: '0', overflow: 'hidden' }}>
                  <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '12px 16px',
                        transition: 'background 0.12s', cursor: 'pointer',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#818cf8' }}>#{i + 1}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {deal.prospectCompany ?? deal.dealName ?? 'Untitled'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '1px' }}>
                          {deal.stage?.replace('_', ' ')}
                          {deal.dealValue ? ` · ${currencySymbol}${deal.dealValue >= 1000 ? `${(deal.dealValue / 1000).toFixed(0)}k` : deal.dealValue}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
                        {winProb != null ? (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: winProb >= 70 ? '#34d399' : winProb >= 40 ? '#fbbf24' : '#f87171', lineHeight: 1, letterSpacing: '-0.02em' }}>{winProb}%</div>
                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>win prob</div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.28)' }}>—</div>
                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.20)' }}>no prediction</div>
                          </div>
                        )}
                        {churnRisk != null && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: churnRisk >= 60 ? '#f87171' : 'rgba(255,255,255,0.45)', lineHeight: 1 }}>{churnRisk}%</div>
                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>churn risk</div>
                          </div>
                        )}
                        {score > 0 && (
                          <div style={{ fontSize: '13px', fontWeight: 700, color: scoreColor, padding: '3px 8px', borderRadius: '7px', background: `${scoreColor}22` }}>
                            {score}%
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                  {/* Feature importance bars */}
                  {features.length > 0 && (
                    <div style={{ padding: '10px 16px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {features.slice(0, 4).map((f, fi) => {
                        const isPositive = f.direction !== 'negative'
                        const barColor = isPositive ? '#34d399' : '#f87171'
                        const pct = Math.min(100, Math.round(f.importance * 100))
                        return (
                          <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '130px', fontSize: '10px', color: 'rgba(255,255,255,0.50)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                            <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '3px', transition: 'width 0.6s ease-out' }} />
                            </div>
                            <div style={{ width: '36px', textAlign: 'right', fontSize: '10px', fontWeight: 600, color: barColor, flexShrink: 0 }}>{pct}%</div>
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
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 500,
          }} />
          <Dialog.Content style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)', zIndex: 501,
            width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto',
            background: 'linear-gradient(135deg, rgba(13,15,26,0.98), rgba(8,10,16,0.98))',
            backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(99,102,241,0.20)', borderRadius: '20px', padding: '28px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.70)', outline: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <Dialog.Title style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Log a deal
              </Dialog.Title>
              <Dialog.Close asChild>
                <button style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '7px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer', color: 'rgba(255,255,255,0.45)' }}>
                  <X size={14} strokeWidth={2} />
                </button>
              </Dialog.Close>
            </div>
            <DealForm onSubmit={handleAdd} loading={addLoading} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <style>{`
        @keyframes sk { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  )
}
