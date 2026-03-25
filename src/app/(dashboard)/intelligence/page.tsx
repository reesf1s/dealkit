'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Brain, ArrowUpRight, BookOpen, Save,
  AlertTriangle, Target, Shield,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: '16px 18px',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: color ?? 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{sub}</div>
      )}
    </div>
  )
}

export default function IntelligencePage() {
  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const { data: dealsRes } = useSWR('/api/deals', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data
  const { data: kbRes, mutate: mutateKb } = useSWR('/api/workspace/knowledge-base', fetcher, { revalidateOnFocus: false })
  const [kbText, setKbText] = useState('')
  const [kbSaving, setKbSaving] = useState(false)
  const [kbSaved, setKbSaved] = useState(false)

  const deals: any[] = dealsRes?.data ?? []
  const dealCount = deals.length
  const closedDeals = deals.filter((d: any) => d.stage === 'closed_won' || d.stage === 'closed_lost')
  const wonDeals = deals.filter((d: any) => d.stage === 'closed_won')

  useEffect(() => {
    if (kbRes?.data?.text != null && kbText === '') {
      setKbText(kbRes.data.text)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbRes])

  async function saveKb() {
    setKbSaving(true)
    try {
      await fetch('/api/workspace/knowledge-base', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: kbText }),
      })
      await mutateKb()
      setKbSaved(true)
      setTimeout(() => setKbSaved(false), 2000)
    } finally { setKbSaving(false) }
  }

  const winRate = closedDeals.length > 0 ? Math.round((wonDeals.length / closedDeals.length) * 100) : null
  const wl = brain?.winLossIntel
  const avgVelocity = wl?.avgDaysToClose ? Math.round(wl.avgDaysToClose) : null
  const openDeals = deals.filter((d: any) => !['closed_won', 'closed_lost'].includes(d.stage))
  const revenueAtRisk = openDeals.reduce((sum: number, d: any) => {
    const p = d.conversionScore ? d.conversionScore / 100 : 0.5
    return sum + (1 - p) * (d.dealValue ?? 0)
  }, 0)
  const topBlocker = (brain?.productGapPriority ?? [])[0]?.title ?? null

  const winSignals: any[] = ((brain?.objectionWinMap ?? []) as any[])
    .map((s: any) => ({ ...s, objection: s.theme, winRate: typeof s.winRateWithTheme === 'number' ? s.winRateWithTheme / 100 : s.winRate }))
    .slice(0, 5)
  const riskSignals: any[] = ((brain?.keyPatterns ?? []) as any[])
    .map((p: any) => ({ ...p, pattern: p.label, dealCount: p.dealIds?.length ?? 0 }))
    .slice(0, 5)

  const card: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '20px 22px',
  }

  function SkeletonLine({ w = '100%', h = '14px' }: { w?: string; h?: string }) {
    return <div style={{ width: w, height: h, borderRadius: '4px' }} className="skeleton" />
  }

  return (
    <>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
          background: 'var(--bg-hero)',
          border: '1px solid rgba(99,102,241,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Brain size={16} color="var(--accent-primary)" />
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            Intelligence
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
            Revenue-to-Product intelligence for your workspace
          </p>
        </div>
      </div>

      {/* Deal count gate */}
      {dealCount < 3 && !isLoading && (
        <div style={{
          padding: '16px 20px',
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.20)',
          borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <AlertTriangle size={16} color="var(--accent-warning)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Add {3 - dealCount} more deal{3 - dealCount !== 1 ? 's' : ''} to unlock full intelligence
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              You have {dealCount} deal{dealCount !== 1 ? 's' : ''}. Intelligence improves significantly at 3+.
            </div>
          </div>
          <Link href="/deals" style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '6px 14px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)',
            fontSize: '12px', fontWeight: 600, color: 'var(--accent-warning)', flexShrink: 0,
          }}>
            Add deals <ArrowUpRight size={11} />
          </Link>
        </div>
      )}

      {/* Hero stats row */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <StatCard
          label="Win Rate (90d)"
          value={winRate != null ? `${winRate}%` : '—'}
          sub={`${wonDeals.length} won · ${closedDeals.length} closed`}
          color={winRate != null ? (winRate >= 50 ? 'var(--accent-success)' : winRate >= 30 ? 'var(--accent-warning)' : 'var(--accent-danger)') : 'var(--text-primary)'}
        />
        <StatCard
          label="Avg Deal Velocity"
          value={avgVelocity != null ? `${avgVelocity}d` : '—'}
          sub="Days from creation to close"
          color="var(--accent-primary)"
        />
        <StatCard
          label="Revenue at Risk"
          value={revenueAtRisk > 0 ? formatCurrency(Math.round(revenueAtRisk)) : '—'}
          sub={`${openDeals.length} open deal${openDeals.length !== 1 ? 's' : ''}`}
          color="var(--accent-danger)"
        />
        <StatCard
          label="Top Blocker"
          value={topBlocker ? topBlocker.slice(0, 18) : '—'}
          sub={topBlocker ? 'Product gap by revenue' : 'No gaps logged'}
          color="var(--accent-warning)"
        />
      </div>

      {/* Win Conditions + Lose Conditions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px' }}>
        {/* How you win */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={15} style={{ color: 'var(--accent-success)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>How you win</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Win conditions</span>
          </div>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2,3].map(i => <SkeletonLine key={i} h="38px" />)}
            </div>
          ) : winSignals.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {winSignals.map((sig: any, i: number) => (
                <div key={i} style={{
                  padding: '9px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(16,185,129,0.05)',
                  border: '1px solid rgba(16,185,129,0.14)',
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-success)', marginBottom: '2px' }}>
                    {sig.objection ?? sig.pattern ?? sig.signal ?? `Win condition ${i + 1}`}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    {sig.winRate != null ? `${Math.round((typeof sig.winRate === 'number' && sig.winRate <= 1 ? sig.winRate * 100 : sig.winRate))}% win rate when present` : sig.description ?? sig.insight ?? ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>Win signals appear as you log more deals.</p>
              <Link href="/deals" style={{ fontSize: '12px', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                Add deals <ArrowUpRight size={10} />
              </Link>
            </div>
          )}
        </div>

        {/* Why you lose */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={15} style={{ color: 'var(--accent-danger)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Why you lose</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Lose conditions</span>
          </div>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2,3].map(i => <SkeletonLine key={i} h="38px" />)}
            </div>
          ) : riskSignals.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {riskSignals.map((sig: any, i: number) => (
                <div key={i} style={{
                  padding: '9px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(239,68,68,0.05)',
                  border: '1px solid rgba(239,68,68,0.14)',
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-danger)', marginBottom: '2px' }}>
                    {sig.pattern ?? sig.signal ?? sig.riskFactor ?? `Loss condition ${i + 1}`}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    {sig.dealCount != null ? `Seen in ${sig.dealCount} deal${sig.dealCount !== 1 ? 's' : ''}` : sig.description ?? sig.insight ?? ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0, padding: '20px 0', textAlign: 'center' }}>
              Loss patterns appear after logging closed lost deals.
            </p>
          )}
        </div>
      </div>

      {/* Knowledge Base */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={15} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Company Knowledge Base</span>
          </div>
          <button
            onClick={saveKb}
            disabled={kbSaving}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600,
              background: kbSaved ? 'rgba(16,185,129,0.10)' : 'var(--bg-glass)',
              border: `1px solid ${kbSaved ? 'rgba(16,185,129,0.25)' : 'var(--border-default)'}`,
              color: kbSaved ? 'var(--accent-success)' : 'var(--text-secondary)',
              cursor: kbSaving ? 'not-allowed' : 'pointer',
              opacity: kbSaving ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            <Save size={11} />
            {kbSaved ? 'Saved!' : kbSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '0 0 10px', lineHeight: 1.6 }}>
          Describe your company, product, ICP, and competitive positioning. This context is fed into every AI operation.
        </p>
        <textarea
          value={kbText}
          onChange={e => setKbText(e.target.value)}
          placeholder="e.g. We are Halvex, a B2B sales intelligence platform targeting mid-market SaaS companies..."
          rows={7}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical',
            background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', padding: '10px 13px',
            fontSize: '13px', lineHeight: 1.7, color: 'var(--text-secondary)',
            outline: 'none', caretColor: 'var(--accent-primary)',
            fontFamily: 'inherit',
            transition: 'border-color var(--transition-fast)',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.35)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
        />
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
          {kbText.length} characters
        </div>
      </div>
    </>
  )
}
