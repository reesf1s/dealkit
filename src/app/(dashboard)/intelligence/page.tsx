'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Brain, TrendingUp, TrendingDown, Layers, BarChart2,
  ArrowUpRight, ChevronRight, BookOpen, Save, Lock,
  AlertTriangle, Target, Clock, DollarSign, Shield,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ─── Stat card ───────────────────────────────────────────────────────────────
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

// ─── Playbook panel ───────────────────────────────────────────────────────────
function PlaybookPanel({ brain, isLoading }: { brain: any; isLoading: boolean }) {
  const wl = brain?.winLossIntel
  const ml = brain?.mlModel
  const objectionMap: any[] = brain?.objectionWinMap ?? []
  const competitivePatterns: any[] = brain?.competitivePatterns ?? []

  const features: any[] = ml?.featureImportance
    ? [...ml.featureImportance].sort((a: any, b: any) => b.importance - a.importance)
    : []
  const winFactors = features.filter((f: any) => f.direction === 'helps').slice(0, 5)
  const lossFactors = features.filter((f: any) => f.direction === 'hurts').slice(0, 5)

  const totalDeals = (wl?.winCount ?? 0) + (wl?.lossCount ?? 0)
  const hasEnoughData = totalDeals >= 10 || winFactors.length > 0

  const card: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '20px 22px',
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[1, 2, 3].map(i => <div key={i} style={{ height: '80px', borderRadius: '10px' }} className="skeleton" />)}
      </div>
    )
  }

  if (!hasEnoughData) {
    const needed = Math.max(0, 10 - totalDeals)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Building your playbook…</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)' }}>{totalDeals} / 10</span>
          </div>
          <div style={{ width: '100%', height: '6px', borderRadius: '100px', background: 'var(--border-subtle)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (totalDeals / 10) * 100)}%`, background: 'var(--accent-primary)', borderRadius: '100px' }} />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px', lineHeight: 1.6 }}>
            {needed > 0 ? `${needed} more closed deal${needed !== 1 ? 's' : ''} needed to activate.` : 'Almost there — close more deals to unlock.'}
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {[
            { title: 'Your Winning Formula', desc: 'Top 5 signals that predict a won deal.', color: 'var(--accent-success)' },
            { title: 'Your Losing Pattern', desc: 'Top 5 signals that predict a lost deal.', color: 'var(--accent-danger)' },
            { title: 'Per-Competitor Playbook', desc: 'Win conditions vs each rival.', color: 'var(--accent-warning)' },
            { title: 'Objection Effectiveness', desc: 'Which objections your team handles well.', color: 'var(--accent-primary)' },
          ].map(item => (
            <div key={item.title} style={{ ...card, opacity: 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>
                <Lock size={13} style={{ color: item.color, flexShrink: 0, marginTop: '2px' }} />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function FactorBar({ label, importance, direction }: { label: string; importance: number; direction: string }) {
    const color = direction === 'helps' ? 'var(--accent-success)' : 'var(--accent-danger)'
    const pct = Math.min(100, importance * 100 * 5)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
          <span style={{ fontSize: '11px', color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{(importance * 100).toFixed(1)}%</span>
        </div>
        <div style={{ height: '3px', borderRadius: '2px', background: 'var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {[
          { label: 'Win rate', value: `${wl?.winRate ?? 0}%`, color: 'var(--accent-success)' },
          { label: 'Avg close time', value: wl?.avgDaysToClose ? `${Math.round(wl.avgDaysToClose)}d` : '—', color: 'var(--accent-primary)' },
          { label: 'Avg won value', value: wl?.avgWonValue ? formatCurrency(Math.round(wl.avgWonValue)) : '—', color: 'var(--text-primary)' },
          { label: 'Closed deals', value: String(totalDeals), color: 'var(--text-secondary)' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '12px 16px', minWidth: '110px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        {winFactors.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <TrendingUp size={15} style={{ color: 'var(--accent-success)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Your Winning Formula</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {winFactors.map((f: any, i: number) => (
                <FactorBar key={i} label={f.name ?? f.label ?? f.feature} importance={f.importance} direction="helps" />
              ))}
            </div>
          </div>
        )}
        {lossFactors.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <TrendingDown size={15} style={{ color: 'var(--accent-danger)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Your Losing Pattern</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lossFactors.map((f: any, i: number) => (
                <FactorBar key={i} label={f.name ?? f.label ?? f.feature} importance={f.importance} direction="hurts" />
              ))}
            </div>
          </div>
        )}
        {objectionMap.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <BookOpen size={15} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Objection Effectiveness</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {objectionMap.slice(0, 5).map((obj: any, i: number) => {
                const wr = typeof obj.winRate === 'number' ? Math.round(obj.winRate * 100) : null
                const color = wr != null ? (wr >= 60 ? 'var(--accent-success)' : wr >= 40 ? 'var(--accent-warning)' : 'var(--accent-danger)') : 'var(--text-tertiary)'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {obj.objection ?? obj.theme ?? `Objection ${i + 1}`}
                    </span>
                    {wr != null && <span style={{ fontSize: '11px', fontWeight: 700, color, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{wr}%</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {competitivePatterns.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <BarChart2 size={15} style={{ color: 'var(--accent-warning)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Competitive Win Rates</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {competitivePatterns.slice(0, 5).map((p: any, i: number) => {
                const wr = typeof p.winRate === 'number' ? p.winRate : null
                const color = wr != null ? (wr >= 60 ? 'var(--accent-success)' : wr >= 40 ? 'var(--accent-warning)' : 'var(--accent-danger)') : 'var(--text-tertiary)'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-secondary)' }}>vs {p.competitor}</span>
                    {wr != null && <span style={{ fontSize: '11px', fontWeight: 700, color, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{wr}% win</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IntelligencePage() {
  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const { data: dealsRes } = useSWR('/api/deals', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data
  const { data: kbRes, mutate: mutateKb } = useSWR('/api/workspace/knowledge-base', fetcher, { revalidateOnFocus: false })
  const [kbText, setKbText] = useState('')
  const [kbSaving, setKbSaving] = useState(false)
  const [kbSaved, setKbSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'playbook'>('overview')

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

  // ── Computed stats ──
  const winRate = closedDeals.length > 0 ? Math.round((wonDeals.length / closedDeals.length) * 100) : null
  const wl = brain?.winLossIntel
  const avgVelocity = wl?.avgDaysToClose ? Math.round(wl.avgDaysToClose) : null

  // Revenue at risk = sum (1-score/100) * value for open deals
  const openDeals = deals.filter((d: any) => !['closed_won', 'closed_lost'].includes(d.stage))
  const revenueAtRisk = openDeals.reduce((sum: number, d: any) => {
    const p = d.conversionScore ? d.conversionScore / 100 : 0.5
    return sum + (1 - p) * (d.dealValue ?? 0)
  }, 0)

  const topBlocker = (brain?.productGapPriority ?? [])[0]?.title ?? null

  // Win signals — objectionWinMap has { theme, winsWithTheme, winRateWithTheme (0-100) }
  const winSignals: any[] = ((brain?.objectionWinMap ?? []) as any[])
    .map((s: any) => ({ ...s, objection: s.theme, winRate: typeof s.winRateWithTheme === 'number' ? s.winRateWithTheme / 100 : s.winRate }))
    .slice(0, 5)
  // Risk signals — keyPatterns has { label, dealIds, companies }
  const riskSignals: any[] = ((brain?.keyPatterns ?? []) as any[])
    .map((p: any) => ({ ...p, pattern: p.label, dealCount: p.dealIds?.length ?? 0 }))
    .slice(0, 5)
  const productGaps: any[] = (brain?.productGapPriority ?? []).slice(0, 5)
  // ML accuracy lives inside mlModel
  const mlAccuracy: number | null = brain?.mlModel?.looAccuracy ?? null
  const mlDealCount: number | null = brain?.mlModel?.trainingSize ?? null
  const competitivePatterns: any[] = brain?.competitivePatterns ?? []

  const tabStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '5px 14px', borderRadius: '6px',
    fontSize: '12px', fontWeight: active ? 600 : 500,
    color: active ? 'var(--accent-primary)' : 'var(--text-tertiary)',
    background: active ? 'rgba(99,102,241,0.10)' : 'transparent',
    border: active ? '1px solid rgba(99,102,241,0.20)' : '1px solid transparent',
    textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap' as const,
    transition: 'all var(--transition-fast)',
    fontFamily: 'inherit',
  })

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
    <div style={{ maxWidth: '1040px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '2px', padding: '3px',
        background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)', width: 'fit-content',
      }}>
        <button onClick={() => setActiveTab('overview')} style={tabStyle(activeTab === 'overview')}>Overview</button>
        <button onClick={() => setActiveTab('playbook')} style={tabStyle(activeTab === 'playbook')}>Playbook</button>
        {([
          { label: 'Competitors', href: '/competitors' },
          { label: 'Case Studies', href: '/case-studies' },
          { label: 'Feature Gaps', href: '/product-gaps' },
          { label: 'Models', href: '/models' },
        ] as { label: string; href: string }[]).map(tab => (
          <Link key={tab.href} href={tab.href} style={tabStyle(false)}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
              ;(e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >{tab.label}</Link>
        ))}
      </div>

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
            {activeTab === 'playbook' ? 'Win Playbook' : 'Intelligence'}
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
            {activeTab === 'playbook' ? 'Auto-generated from your closed deal history' : 'Revenue-to-Product intelligence for your workspace'}
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

      {/* Playbook tab */}
      {activeTab === 'playbook' && (
        <PlaybookPanel brain={brain} isLoading={isLoading} />
      )}

      {/* Overview tab */}
      {activeTab === 'overview' && <>

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
            sub={topBlocker ? `Product gap by revenue` : 'No gaps logged'}
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

        {/* Revenue at Risk by Feature Gap — table */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={15} style={{ color: 'var(--accent-warning)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Revenue at Risk by Feature Gap</span>
            </div>
            <Link href="/product-gaps" style={{ fontSize: '12px', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              All gaps <ChevronRight size={11} />
            </Link>
          </div>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2,3].map(i => <SkeletonLine key={i} h="36px" />)}
            </div>
          ) : productGaps.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Gap', 'Deals blocked', 'Revenue at risk', 'Status'].map(h => (
                    <th key={h} style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left', padding: '0 12px 8px 0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productGaps.map((gap: any, i: number) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {gap.title ?? gap.feature ?? gap.pattern ?? 'Gap'}
                    </td>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {gap.dealsBlocked ?? gap.dealCount ?? gap.count ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', fontWeight: 600, color: 'var(--accent-danger)', fontVariantNumeric: 'tabular-nums' }}>
                      {gap.revenueAtRisk ? formatCurrency(Math.round(gap.revenueAtRisk)) : '—'}
                    </td>
                    <td style={{ padding: '10px 0' }}>
                      {gap.linkedIssues || gap.linearIssue || gap.status === 'on_roadmap' || gap.status === 'shipped' ? (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-success)', display: 'inline-block' }} />
                          Linked
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-tertiary)', display: 'inline-block' }} />
                          No issue
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0, padding: '20px 0', textAlign: 'center' }}>
              Feature gap signals appear from deal notes analysis.
            </p>
          )}
        </div>

        {/* Competitive Landscape */}
        {competitivePatterns.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={15} style={{ color: 'var(--accent-info)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Competitive Landscape</span>
              </div>
              <Link href="/competitors" style={{ fontSize: '12px', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                All competitors <ChevronRight size={11} />
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {competitivePatterns.map((p: any, i: number) => {
                const wr = typeof p.winRate === 'number' ? p.winRate : null
                const color = wr != null ? (wr >= 60 ? 'var(--accent-success)' : wr >= 40 ? 'var(--accent-warning)' : 'var(--accent-danger)') : 'var(--text-tertiary)'
                return (
                  <Link key={i} href={`/competitors`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                      transition: 'background var(--transition-fast)',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass)'}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>vs {p.competitor}</div>
                      {wr != null ? (
                        <div style={{ fontSize: '18px', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{wr}%</div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No data yet</div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ML Model Accuracy */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={15} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Model accuracy</span>
            </div>
            <Link href="/models" style={{ fontSize: '12px', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Model details <ArrowUpRight size={10} />
            </Link>
          </div>
          {isLoading ? (
            <SkeletonLine h="56px" />
          ) : (
            <div style={{
              padding: '16px 18px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-hero)', border: '1px solid rgba(99,102,241,0.15)',
            }}>
              {mlAccuracy != null ? (
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(mlAccuracy * 100)}%
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
                    Win probability accuracy · trained on {mlDealCount ?? '?'} deal{(mlDealCount ?? 0) !== 1 ? 's' : ''}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                  The AI model improves as you log more deals. Close 5+ deals to enable predictive scoring.
                </div>
              )}
            </div>
          )}
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

      </>}
    </div>
  )
}
