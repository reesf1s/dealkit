'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import * as Dialog from '@radix-ui/react-dialog'
import Link from 'next/link'
import {
  Plus, X, ClipboardList, Kanban, ArrowUpRight, AlertTriangle,
} from 'lucide-react'
import { DealForm } from '@/components/deals/DealForm'
import { useToast } from '@/components/shared/Toast'
import SetupBanner from '@/components/shared/SetupBanner'
import { fetcher, isDbNotConfigured } from '@/lib/fetcher'
import { getScoreColor } from '@/lib/deal-context'
import type { DealLog } from '@/types'

// Health score circle
function ScoreCircle({ score, size = 44 }: { score: number; size?: number }) {
  const color = score >= 66 ? '#34d399' : score >= 41 ? '#fbbf24' : '#f87171'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <div style={{
        width: size - 8, height: size - 8, borderRadius: '50%',
        background: '#0d0f1a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: size > 40 ? '13px' : '11px', fontWeight: 700, color }}>{score}</span>
      </div>
    </div>
  )
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    prospecting: 'Prospecting', qualification: 'Qualification', discovery: 'Discovery',
    proposal: 'Proposal', trial: 'Trial', negotiation: 'Negotiation',
    closed_won: 'Won', closed_lost: 'Lost',
  }
  return labels[stage] ?? stage
}

function StageBadge({ stage }: { stage: string }) {
  const isWon = stage === 'closed_won'
  const isLost = stage === 'closed_lost'
  return (
    <span style={{
      fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '100px',
      background: isWon ? 'rgba(52,211,153,0.12)' : isLost ? 'rgba(248,113,113,0.10)' : 'rgba(255,255,255,0.07)',
      color: isWon ? '#34d399' : isLost ? '#f87171' : 'rgba(255,255,255,0.55)',
      border: `1px solid ${isWon ? 'rgba(52,211,153,0.20)' : isLost ? 'rgba(248,113,113,0.16)' : 'rgba(255,255,255,0.10)'}`,
      whiteSpace: 'nowrap',
    }}>
      {stageLabel(stage)}
    </span>
  )
}

export default function DealsPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<'intelligence' | 'pipeline'>('intelligence')
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)

  const { data, isLoading, error, mutate } = useSWR<{ data: DealLog[] }>('/api/deals', fetcher)
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const { data: configData } = useSWR('/api/pipeline-config', fetcher, { revalidateOnFocus: false })

  const deals: DealLog[] = data?.data ?? []
  const brain = brainRes?.data
  const dbError = isDbNotConfigured(error)
  const currencySymbol: string = configData?.data?.currency ?? '£'

  // Active deals sorted by health score ascending (worst first)
  const activeDeals = deals
    .filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    .sort((a, b) => ((a as any).conversionScore ?? 50) - ((b as any).conversionScore ?? 50))

  const urgentMap: Record<string, string> = {}
  for (const u of (brain?.urgentDeals ?? [])) urgentMap[u.dealId] = u.reason

  const atRiskCount = activeDeals.filter(d => ((d as any).conversionScore ?? 50) < 41).length
  const atRiskValue = activeDeals
    .filter(d => ((d as any).conversionScore ?? 50) < 41)
    .reduce((sum, d) => sum + ((d as any).dealValue ?? 0), 0)

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast('Failed to delete deal', 'error'); return }
      await mutate()
      toast('Deal deleted', 'success')
    } catch { toast('Failed to delete deal', 'error') }
  }

  async function handleAdd(payload: Partial<DealLog>) {
    setAddLoading(true)
    try {
      const res = await fetch('/api/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Failed to log deal', 'error'); return }
      await mutate()
      setAddOpen(false)
      toast('Deal logged', 'success')
    } finally { setAddLoading(false) }
  }

  const glassCard: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(59,130,246,0.05) 50%, rgba(139,92,246,0.07) 100%)',
    backdropFilter: 'blur(24px) saturate(200%)',
    WebkitBackdropFilter: 'blur(24px) saturate(200%)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.10)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.40)',
  }

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em', marginBottom: '4px' }}>Deals</h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.38)' }}>{deals.length} deals total</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px', height: '36px', padding: '0 18px',
            borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: '#fff',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.80) 0%, rgba(139,92,246,0.70) 100%)',
            border: '1px solid rgba(99,102,241,0.40)', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(99,102,241,0.30)', transition: 'all 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(99,102,241,0.50)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(99,102,241,0.30)'}
        >
          <Plus size={14} strokeWidth={2.5} />
          Log Deal
        </button>
      </div>

      {dbError && <SetupBanner context="Add a DATABASE_URL to start logging deals and tracking your win rate." />}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: '11px', padding: '4px', width: 'fit-content' }}>
        {[
          { id: 'intelligence' as const, label: 'Intelligence', icon: <ClipboardList size={13} /> },
          { id: 'pipeline' as const,     label: 'Pipeline',     icon: <Kanban size={13} /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => {
              if (t.id === 'pipeline') { window.location.href = '/pipeline'; return }
              setTab(t.id)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
              background: tab === t.id ? 'rgba(99,102,241,0.18)' : 'transparent',
              border: `1px solid ${tab === t.id ? 'rgba(99,102,241,0.30)' : 'transparent'}`,
              color: tab === t.id ? '#818cf8' : 'rgba(255,255,255,0.45)',
              cursor: 'pointer', transition: 'all 0.12s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Intelligence tab */}
      {tab === 'intelligence' && (
        <div>
          {/* Summary banner */}
          {atRiskCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px', borderRadius: '11px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.16)', marginBottom: '16px' }}>
              <AlertTriangle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>
                <span style={{ fontWeight: 700, color: '#f87171' }}>{atRiskCount} deal{atRiskCount > 1 ? 's' : ''}</span>{' '}
                need your attention
                {atRiskValue > 0 && <> · <span style={{ fontWeight: 600, color: '#fbbf24' }}>{currencySymbol}{Math.round(atRiskValue / 1000)}k</span> total at risk</>}
              </span>
            </div>
          )}

          {isLoading ? (
            <div style={{ ...glassCard, padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.30)', fontSize: '13px' }}>Loading deals…</div>
          ) : activeDeals.length === 0 ? (
            <div style={{ ...glassCard, padding: '48px 24px', textAlign: 'center' }}>
              <ClipboardList size={32} style={{ color: 'rgba(255,255,255,0.12)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.40)', marginBottom: '8px' }}>No active deals yet</p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.24)', marginBottom: '20px' }}>Log your first deal to start tracking health and AI intelligence.</p>
              <button onClick={() => setAddOpen(true)} style={{ padding: '8px 20px', borderRadius: '8px', background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.24)', color: '#818cf8', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Log a deal
              </button>
            </div>
          ) : (
            <div style={{ ...glassCard, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 120px 1fr 40px', gap: '16px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Company', 'Value', 'Health', 'Stage', 'Halvex insight', ''].map((h, i) => (
                  <span key={i} style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i === 1 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>

              {activeDeals.map((deal: any, i) => {
                const score = deal.conversionScore ?? 50
                const reason = urgentMap[deal.id] || deal.aiRiskSignal || deal.lastNoteSummary || null
                const daysInStage = deal.updatedAt ? Math.floor((Date.now() - new Date(deal.updatedAt).getTime()) / 86400000) : null

                return (
                  <div
                    key={deal.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 80px 60px 120px 1fr 40px', gap: '16px',
                      padding: '14px 20px', alignItems: 'center',
                      borderBottom: i < activeDeals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      transition: 'background 0.12s', cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    onClick={() => window.location.href = `/deals/${deal.id}`}
                  >
                    {/* Company */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, background: 'linear-gradient(135deg, rgba(99,102,241,0.40), rgba(139,92,246,0.30))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.70)' }}>
                        {(deal.prospectCompany || deal.dealName || '?')[0]?.toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.prospectCompany || deal.dealName}</div>
                        {deal.dealName && deal.dealName !== deal.prospectCompany && (
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.dealName}</div>
                        )}
                      </div>
                    </div>

                    {/* Value */}
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.65)', textAlign: 'right' }}>
                      {deal.dealValue ? `${currencySymbol}${Math.round(deal.dealValue / 1000)}k` : '—'}
                    </div>

                    {/* Health score */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <ScoreCircle score={score} size={40} />
                    </div>

                    {/* Stage */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <StageBadge stage={deal.stage} />
                      {daysInStage !== null && (
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', paddingLeft: '2px' }}>{daysInStage}d in stage</span>
                      )}
                    </div>

                    {/* Risk signal */}
                    <div style={{ fontSize: '12px', color: score < 41 ? 'rgba(248,113,113,0.80)' : 'rgba(255,255,255,0.42)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {reason ?? '—'}
                    </div>

                    {/* Arrow */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <ArrowUpRight size={14} style={{ color: 'rgba(255,255,255,0.25)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add deal modal */}
      <Dialog.Root open={addOpen} onOpenChange={setAddOpen}>
        <Dialog.Portal>
          <Dialog.Overlay style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 500 }} />
          <Dialog.Content style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 501, width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', background: 'rgba(13,15,26,0.97)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '28px', boxShadow: '0 24px 80px rgba(0,0,0,0.60)', outline: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <Dialog.Title style={{ fontSize: '16px', fontWeight: 700, color: 'rgba(255,255,255,0.92)', margin: 0, letterSpacing: '-0.02em' }}>Log a deal</Dialog.Title>
              <Dialog.Close asChild>
                <button style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '7px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', transition: 'all 0.12s' }}>
                  <X size={14} strokeWidth={2} />
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
