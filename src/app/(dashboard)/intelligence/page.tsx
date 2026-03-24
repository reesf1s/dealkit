'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Brain, TrendingUp, TrendingDown, Layers, BarChart2, ArrowUpRight, ChevronRight, BookOpen, Save, Lock } from 'lucide-react'
import { formatCurrency } from '@/lib/format'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const card: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(59,130,246,0.05), transparent)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '1rem',
  padding: '20px 24px',
  boxShadow: '0 2px 20px rgba(0,0,0,0.40)',
}

// ─── Inline Playbook Tab Panel ────────────────────────────────────────────────

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

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[1, 2, 3].map(i => <div key={i} style={{ height: '80px', borderRadius: '12px' }} className="skeleton" />)}
      </div>
    )
  }

  if (!hasEnoughData) {
    const needed = Math.max(0, 10 - totalDeals)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Progress card */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>Building your playbook…</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#818cf8' }}>{totalDeals} / 10</span>
          </div>
          <div style={{ width: '100%', height: '8px', borderRadius: '100px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (totalDeals / 10) * 100)}%`, background: '#6366f1', borderRadius: '100px', transition: 'width 0.3s ease' }} />
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', lineHeight: 1.6 }}>
            {needed > 0 ? `${needed} more closed deal${needed !== 1 ? 's' : ''} needed to activate.` : 'Almost there — close more deals to unlock.'}
          </p>
        </div>
        {/* Locked previews */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {[
            { title: 'Your Winning Formula', desc: 'Top 5 signals that predict a won deal in your pipeline.', icon: '#34d399' },
            { title: 'Your Losing Pattern', desc: 'Top 5 signals that predict a lost deal.', icon: '#f87171' },
            { title: 'Per-Competitor Playbook', desc: 'What conditions you win under vs each rival.', icon: '#fbbf24' },
            { title: 'Objection Effectiveness', desc: 'Which objections your team handles well and which kill deals.', icon: '#818cf8' },
          ].map(item => (
            <div key={item.title} style={{ ...card, opacity: 0.65 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{item.title}</span>
                <Lock size={13} style={{ color: item.icon, flexShrink: 0, marginTop: '2px' }} />
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function FactorBar({ label, importance, direction }: { label: string; importance: number; direction: string }) {
    const color = direction === 'helps' ? '#34d399' : '#f87171'
    const pct = Math.min(100, importance * 100 * 5)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</span>
          <span style={{ fontSize: '11px', color, fontWeight: 600 }}>{(importance * 100).toFixed(1)}%</span>
        </div>
        <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.3s ease' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Win stats strip */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {[
          { label: 'Win rate', value: `${wl?.winRate ?? 0}%`, color: '#34d399' },
          { label: 'Avg close time', value: wl?.avgDaysToClose ? `${Math.round(wl.avgDaysToClose)}d` : '—', color: '#818cf8' },
          { label: 'Avg won value', value: wl?.avgWonValue ? formatCurrency(Math.round(wl.avgWonValue)) : '—', color: '#a5b4fc' },
          { label: 'Closed deals', value: String(totalDeals), color: '#64748b' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '12px 16px', minWidth: '110px' }}>
            <div style={{ fontSize: '20px', fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        {/* Winning Formula */}
        {winFactors.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <TrendingUp size={15} style={{ color: '#34d399' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Your Winning Formula</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {winFactors.map((f: any, i: number) => (
                <FactorBar key={i} label={f.label ?? f.feature} importance={f.importance} direction="helps" />
              ))}
            </div>
          </div>
        )}

        {/* Losing Pattern */}
        {lossFactors.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <TrendingDown size={15} style={{ color: '#f87171' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Your Losing Pattern</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lossFactors.map((f: any, i: number) => (
                <FactorBar key={i} label={f.label ?? f.feature} importance={f.importance} direction="hurts" />
              ))}
            </div>
          </div>
        )}

        {/* Objection Win Map */}
        {objectionMap.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <BookOpen size={15} style={{ color: '#818cf8' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Objection Effectiveness</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {objectionMap.slice(0, 5).map((obj: any, i: number) => {
                const wr = typeof obj.winRate === 'number' ? Math.round(obj.winRate * 100) : null
                const color = wr != null ? (wr >= 60 ? '#34d399' : wr >= 40 ? '#fbbf24' : '#f87171') : '#64748b'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ flex: 1, fontSize: '12px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obj.objection ?? obj.theme ?? `Objection ${i + 1}`}</span>
                    {wr != null && <span style={{ fontSize: '11px', fontWeight: 700, color, flexShrink: 0 }}>{wr}%</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Competitive Patterns */}
        {competitivePatterns.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <BarChart2 size={15} style={{ color: '#fbbf24' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Competitive Win Rates</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {competitivePatterns.slice(0, 5).map((p: any, i: number) => {
                const wr = typeof p.winRate === 'number' ? p.winRate : null
                const color = wr != null ? (wr >= 60 ? '#34d399' : wr >= 40 ? '#fbbf24' : '#f87171') : '#64748b'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ flex: 1, fontSize: '12px', color: '#94a3b8' }}>vs {p.competitor}</span>
                    {wr != null && <span style={{ fontSize: '11px', fontWeight: 700, color, flexShrink: 0 }}>{wr}% win</span>}
                    {p.topWinCondition && <span style={{ fontSize: '10px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{p.topWinCondition}</span>}
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

export default function IntelligencePage() {
  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data
  const { data: kbRes, mutate: mutateKb } = useSWR('/api/workspace/knowledge-base', fetcher, { revalidateOnFocus: false })
  const [kbText, setKbText] = useState('')
  const [kbSaving, setKbSaving] = useState(false)
  const [kbSaved, setKbSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'playbook'>('overview')

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

  // Win signals — top 3 positive
  const winSignals: any[] = (brain?.winPatterns ?? brain?.objectionWinMap ?? []).slice(0, 3)
  // Risk signals — top 3
  const riskSignals: any[] = (brain?.dealRiskPatterns ?? brain?.riskPatterns ?? []).slice(0, 3)
  // Feature gaps blocking revenue
  const productGaps: any[] = (brain?.productGapSignals ?? []).slice(0, 4)
  // ML accuracy
  const mlAccuracy = brain?.mlAccuracy ?? brain?.modelAccuracy ?? null
  const mlDealCount = brain?.mlTrainingCount ?? brain?.dealCount ?? null

  const tabStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 16px', borderRadius: '7px',
    fontSize: '12px', fontWeight: active ? 600 : 500,
    color: active ? '#818cf8' : 'rgba(255,255,255,0.45)',
    background: active ? 'rgba(99,102,241,0.14)' : 'transparent',
    border: active ? '1px solid rgba(99,102,241,0.22)' : '1px solid transparent',
    textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'all 0.12s ease',
  })

  function SkeletonLine({ w = '100%', h = '14px' }: { w?: string; h?: string }) {
    return <div style={{ width: w, height: h, borderRadius: '6px' }} className="skeleton" />
  }

  return (
    <div style={{ maxWidth: '960px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Tabs — Overview + Playbook inline; others navigate to their routes */}
      <div style={{
        display: 'flex', gap: '2px', padding: '3px',
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px', width: 'fit-content',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
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
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >{tab.label}</Link>
        ))}
      </div>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
          background: 'rgba(99,102,241,0.15)',
          border: '1px solid rgba(99,102,241,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 14px rgba(99,102,241,0.20)',
        }}>
          <Brain size={18} color="#818cf8" />
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.02em', margin: 0 }}>
            {activeTab === 'playbook' ? 'Win Playbook' : 'Intelligence'}
          </h1>
          <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
            {activeTab === 'playbook' ? 'Auto-generated from your closed deal history' : 'Patterns and signals extracted from your deals'}
          </p>
        </div>
      </div>

      {/* Playbook tab content */}
      {activeTab === 'playbook' && (
        <PlaybookPanel brain={brain} isLoading={isLoading} />
      )}

      {/* Overview tab content */}
      {activeTab === 'overview' && <>

      {/* 4-section grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>

        {/* WHY WE WIN */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <TrendingUp size={16} style={{ color: '#34d399' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
              Why we win
            </span>
          </div>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2,3].map(i => <SkeletonLine key={i} h="40px" />)}
            </div>
          ) : winSignals.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {winSignals.map((sig: any, i: number) => (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(52,211,153,0.06)',
                  border: '1px solid rgba(52,211,153,0.15)',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#34d399', marginBottom: '2px' }}>
                    {sig.objection ?? sig.pattern ?? sig.signal ?? `Win signal ${i + 1}`}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {sig.winRate != null ? `${Math.round(sig.winRate * 100)}% win rate when present` : sig.description ?? sig.insight ?? ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
                Win signals appear as you log more deals.
              </p>
              <Link href="/deals" style={{ fontSize: '12px', color: '#818cf8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                Add deals <ArrowUpRight size={11} />
              </Link>
            </div>
          )}
        </div>

        {/* WHY WE LOSE */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <TrendingDown size={16} style={{ color: '#f87171' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
              Why we lose
            </span>
          </div>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2,3].map(i => <SkeletonLine key={i} h="40px" />)}
            </div>
          ) : riskSignals.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {riskSignals.map((sig: any, i: number) => (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(248,113,113,0.06)',
                  border: '1px solid rgba(248,113,113,0.15)',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f87171', marginBottom: '2px' }}>
                    {sig.pattern ?? sig.signal ?? sig.riskFactor ?? `Risk signal ${i + 1}`}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {sig.dealCount != null ? `Seen in ${sig.dealCount} deal${sig.dealCount !== 1 ? 's' : ''}` : sig.description ?? sig.insight ?? ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: '#475569', margin: 0, padding: '24px 0', textAlign: 'center' }}>
              Loss patterns appear after logging closed lost deals.
            </p>
          )}
        </div>

        {/* FEATURES BLOCKING REVENUE */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Layers size={16} style={{ color: '#fbbf24' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
              Features blocking revenue
            </span>
          </div>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2].map(i => <SkeletonLine key={i} h="44px" />)}
            </div>
          ) : productGaps.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {productGaps.map((gap: any, i: number) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(251,191,36,0.05)',
                  border: '1px solid rgba(251,191,36,0.15)',
                }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, color: '#fbbf24',
                    background: 'rgba(251,191,36,0.12)', padding: '2px 8px', borderRadius: '100px',
                    flexShrink: 0,
                  }}>
                    {gap.dealCount ?? gap.count ?? '?'}× blocked
                  </span>
                  <span style={{ fontSize: '13px', color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {gap.feature ?? gap.title ?? gap.pattern ?? 'Feature gap'}
                  </span>
                  {gap.linkedIssues || gap.linearIssue ? (
                    <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 600, flexShrink: 0 }}>✓ Linear</span>
                  ) : (
                    <Link href="/product-gaps" style={{ fontSize: '10px', color: '#475569', textDecoration: 'none', flexShrink: 0 }}>
                      Link →
                    </Link>
                  )}
                </div>
              ))}
              <Link href="/product-gaps" style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '12px', color: '#818cf8', textDecoration: 'none', marginTop: '4px',
              }}>
                All feature gaps <ChevronRight size={12} />
              </Link>
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: '#475569', margin: 0, padding: '24px 0', textAlign: 'center' }}>
              Feature gap signals appear from deal notes analysis.
            </p>
          )}
        </div>

        {/* MODEL ACCURACY */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <BarChart2 size={16} style={{ color: '#818cf8' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
              Model accuracy
            </span>
          </div>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SkeletonLine h="56px" />
              <SkeletonLine w="70%" h="14px" />
            </div>
          ) : (
            <div>
              <div style={{
                padding: '20px', borderRadius: '12px',
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.15)',
                marginBottom: '12px',
              }}>
                {mlAccuracy != null ? (
                  <div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: '#a5b4fc', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {Math.round(mlAccuracy * 100)}%
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: 1.5 }}>
                      Halvex predicts deal outcomes with <strong style={{ color: '#94a3b8' }}>{Math.round(mlAccuracy * 100)}% accuracy</strong>
                      {mlDealCount != null ? `, trained on ${mlDealCount} deal${mlDealCount !== 1 ? 's' : ''}` : ''}.
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
                    The AI model improves as you log more deals. Score 5+ closed deals to enable predictive scoring.
                  </div>
                )}
              </div>
              <Link href="/models" style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '12px', color: '#818cf8', textDecoration: 'none',
              }}>
                View model details <ArrowUpRight size={11} />
              </Link>
            </div>
          )}
        </div>

      </div>

      {/* KNOWLEDGE BASE */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={16} style={{ color: '#818cf8' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
              Company Knowledge Base
            </span>
          </div>
          <button
            onClick={saveKb}
            disabled={kbSaving}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
              background: kbSaved ? 'rgba(52,211,153,0.12)' : 'rgba(99,102,241,0.12)',
              border: `1px solid ${kbSaved ? 'rgba(52,211,153,0.25)' : 'rgba(99,102,241,0.25)'}`,
              color: kbSaved ? '#34d399' : '#818cf8',
              cursor: kbSaving ? 'not-allowed' : 'pointer',
              opacity: kbSaving ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
          >
            <Save size={11} />
            {kbSaved ? 'Saved!' : kbSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 12px', lineHeight: 1.6 }}>
          Describe your company, product, ICP, and competitive positioning. This context is fed into every AI operation in your workspace.
        </p>
        <textarea
          value={kbText}
          onChange={e => setKbText(e.target.value)}
          placeholder="e.g. We are Halvex, a B2B sales intelligence platform targeting mid-market SaaS companies. Our ICP is a VP of Sales at a 50-500 person company. We compete against Gong, Clari, and HubSpot Insights. Our key differentiators are..."
          rows={8}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px', padding: '12px 14px',
            fontSize: '13px', lineHeight: 1.7, color: 'rgba(255,255,255,0.80)',
            outline: 'none', caretColor: '#818cf8',
            fontFamily: 'inherit',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.35)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
        />
        <div style={{ fontSize: '11px', color: '#334155', marginTop: '8px' }}>
          {kbText.length} characters
        </div>
      </div>

      </> /* end Overview tab */}

    </div>
  )
}
