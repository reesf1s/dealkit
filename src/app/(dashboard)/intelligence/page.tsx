'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Brain, TrendingUp, TrendingDown, Layers, BarChart2, ArrowUpRight, ChevronRight,
  BookOpen, Save, Target, Activity, Swords, BarChart3,
} from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type Tab = 'overview' | 'models' | 'competitors' | 'trends'

const card: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(59,130,246,0.05), transparent)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '1rem',
  padding: '20px 24px',
  boxShadow: '0 2px 20px rgba(0,0,0,0.40)',
}

function SkeletonLine({ w = '100%', h = '14px' }: { w?: string; h?: string }) {
  return (
    <div style={{ width: w, height: h, borderRadius: '6px', background: 'rgba(255,255,255,0.06)', animation: 'sk 1.5s ease-in-out infinite' }} />
  )
}

// ── Feature Importance Bar ─────────────────────────────────────────────────
function FeatureBar({ name, pct, direction }: { name: string; pct: number; direction?: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t) }, [])
  const isPositive = direction !== 'negative'
  const barColor = isPositive ? '#34d399' : '#f87171'
  const barW = mounted ? Math.min(100, pct) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: '160px', fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
      <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${barW}%`, background: barColor, borderRadius: '4px', transition: 'width 0.6s ease-out' }} />
      </div>
      <div style={{ width: '40px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: barColor, flexShrink: 0, fontFamily: 'monospace' }}>{pct}%</div>
    </div>
  )
}

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const { data: kbRes, mutate: mutateKb } = useSWR('/api/workspace/knowledge-base', fetcher, { revalidateOnFocus: false })
  const { data: competitorsRes } = useSWR('/api/competitors', fetcher, { revalidateOnFocus: false })
  const [kbText, setKbText] = useState('')
  const [kbSaving, setKbSaving] = useState(false)
  const [kbSaved, setKbSaved] = useState(false)

  useEffect(() => {
    if (kbRes?.data?.text != null && kbText === '') setKbText(kbRes.data.text)
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

  const brain = brainRes?.data
  const winSignals: any[] = (brain?.winPatterns ?? brain?.objectionWinMap ?? []).slice(0, 3)
  const riskSignals: any[] = (brain?.dealRiskPatterns ?? brain?.riskPatterns ?? []).slice(0, 3)
  const productGaps: any[] = (brain?.productGapSignals ?? []).slice(0, 4)
  const mlAccuracy = brain?.mlAccuracy ?? brain?.modelAccuracy ?? null
  const mlDealCount = brain?.mlTrainingCount ?? brain?.dealCount ?? null
  const competitors: any[] = competitorsRes?.data ?? []

  // Feature importance from brain
  const featureImportance: any[] = brain?.featureImportance ?? [
    { name: 'Champion Presence', pct: 23, direction: 'positive' },
    { name: 'Deal Value', pct: 18, direction: 'positive' },
    { name: 'Stage Velocity', pct: 15, direction: 'positive' },
    { name: 'Meeting Frequency', pct: 13, direction: 'positive' },
    { name: 'Competitor Present', pct: 11, direction: 'negative' },
  ]

  // Forecast accuracy data
  const forecastAccuracy = brain?.forecastAccuracy
  const totalPredictions = forecastAccuracy?.totalPredictions ?? 0
  const correctPredictions = forecastAccuracy?.correctPredictions ?? 0
  const accuracy = forecastAccuracy?.accuracy != null ? Math.round(forecastAccuracy.accuracy * 100) : null

  // Trend data
  const stageTrend = brain?.stageVelocity ?? []
  const winRateTrend = brain?.winRateTrend ?? []

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview', Icon: Activity },
    { id: 'models' as Tab, label: 'Models', Icon: Brain },
    { id: 'competitors' as Tab, label: 'Competitors', Icon: Swords },
    { id: 'trends' as Tab, label: 'Trends', Icon: BarChart3 },
  ]

  return (
    <div style={{ maxWidth: '960px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: '2px', padding: '3px',
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px', width: 'fit-content',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}>
        {tabs.map(({ id, label, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 16px', borderRadius: '7px',
                fontSize: '12px', fontWeight: active ? 600 : 500,
                color: active ? '#818cf8' : 'rgba(255,255,255,0.45)',
                background: active ? 'rgba(99,102,241,0.14)' : 'transparent',
                border: active ? '1px solid rgba(99,102,241,0.22)' : '1px solid transparent',
                cursor: 'pointer', transition: 'all 0.12s ease', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
            >
              <Icon size={12} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 14px rgba(99,102,241,0.20)',
        }}>
          <Brain size={18} color="#818cf8" />
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.02em', margin: 0 }}>
            Intelligence
          </h1>
          <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
            Patterns and signals extracted from your deals
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════
          OVERVIEW TAB
      ════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>

            {/* WHY WE WIN */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <TrendingUp size={16} style={{ color: '#34d399' }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>Why we win</span>
              </div>
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{[1,2,3].map(i => <SkeletonLine key={i} h="40px" />)}</div>
              ) : winSignals.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {winSignals.map((sig: any, i: number) => (
                    <div key={i} style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
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
                  <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>Win signals appear as you log more deals.</p>
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
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>Why we lose</span>
              </div>
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{[1,2,3].map(i => <SkeletonLine key={i} h="40px" />)}</div>
              ) : riskSignals.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {riskSignals.map((sig: any, i: number) => (
                    <div key={i} style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
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
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>Features blocking revenue</span>
              </div>
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{[1,2].map(i => <SkeletonLine key={i} h="44px" />)}</div>
              ) : productGaps.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {productGaps.map((gap: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.12)', padding: '2px 8px', borderRadius: '100px', flexShrink: 0 }}>
                        {gap.dealCount ?? gap.count ?? '?'}× blocked
                      </span>
                      <span style={{ fontSize: '13px', color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {gap.feature ?? gap.title ?? gap.pattern ?? 'Feature gap'}
                      </span>
                      {gap.linkedIssues || gap.linearIssue ? (
                        <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 600, flexShrink: 0 }}>✓ Linear</span>
                      ) : (
                        <Link href="/product-gaps" style={{ fontSize: '10px', color: '#475569', textDecoration: 'none', flexShrink: 0 }}>Link →</Link>
                      )}
                    </div>
                  ))}
                  <Link href="/product-gaps" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#818cf8', textDecoration: 'none', marginTop: '4px' }}>
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
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>Model accuracy</span>
              </div>
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <SkeletonLine h="56px" /><SkeletonLine w="70%" h="14px" />
                </div>
              ) : (
                <div>
                  <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', marginBottom: '12px' }}>
                    {mlAccuracy != null ? (
                      <div>
                        <div style={{ fontSize: '32px', fontWeight: 700, color: '#a5b4fc', letterSpacing: '-0.03em', lineHeight: 1 }}>
                          {Math.round(mlAccuracy * 100)}%
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: 1.5 }}>
                          Halvex predicts deal outcomes with{' '}
                          <strong style={{ color: '#94a3b8' }}>{Math.round(mlAccuracy * 100)}% accuracy</strong>
                          {mlDealCount != null ? `, trained on ${mlDealCount} deal${mlDealCount !== 1 ? 's' : ''}` : ''}.
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
                        The AI model improves as you log more deals. Score 5+ closed deals to enable predictive scoring.
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveTab('models')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    View model details <ArrowUpRight size={11} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* KNOWLEDGE BASE */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={16} style={{ color: '#818cf8' }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>Company Knowledge Base</span>
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
                  cursor: kbSaving ? 'not-allowed' : 'pointer', opacity: kbSaving ? 0.6 : 1,
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
              placeholder="e.g. We are Halvex, a B2B sales intelligence platform targeting mid-market SaaS companies. Our ICP is a VP of Sales at a 50-500 person company..."
              rows={8}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px', padding: '12px 14px',
                fontSize: '13px', lineHeight: 1.7, color: 'rgba(255,255,255,0.80)',
                outline: 'none', caretColor: '#818cf8', fontFamily: 'inherit',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.35)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
            />
            <div style={{ fontSize: '11px', color: '#334155', marginTop: '8px' }}>{kbText.length} characters</div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════
          MODELS TAB
      ════════════════════════════════════ */}
      {activeTab === 'models' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Forecast Accuracy */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Target size={16} style={{ color: '#818cf8' }} />
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>Forecast Accuracy</span>
            </div>
            {isLoading ? (
              <SkeletonLine h="80px" />
            ) : accuracy != null ? (
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ padding: '20px 24px', borderRadius: '12px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', minWidth: '160px' }}>
                  <div style={{ fontSize: '40px', fontWeight: 800, color: accuracy >= 70 ? '#34d399' : accuracy >= 50 ? '#fbbf24' : '#f87171', letterSpacing: '-0.04em', lineHeight: 1 }}>{accuracy}%</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Forecast accuracy</div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                    {correctPredictions} of {totalPredictions} correct
                  </div>
                </div>
                {forecastAccuracy?.byScoreBucket?.length > 0 && (
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.50)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>By score bucket</div>
                    {forecastAccuracy.byScoreBucket.map((b: any) => (
                      <div key={b.bucket} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <div style={{ width: '60px', fontSize: '11px', color: '#64748b', flexShrink: 0 }}>{b.bucket}</div>
                        <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.round(b.wonRate * 100)}%`, background: '#818cf8', borderRadius: '3px' }} />
                        </div>
                        <div style={{ width: '36px', textAlign: 'right', fontSize: '11px', color: '#818cf8', flexShrink: 0 }}>{Math.round(b.wonRate * 100)}%</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '24px', borderRadius: '12px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: 'rgba(255,255,255,0.20)', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '8px' }}>—</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Forecast accuracy unlocks after 10+ closed deals.</div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                  Track predictions vs outcomes to see accuracy here.
                </div>
              </div>
            )}
          </div>

          {/* Feature importance */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <BarChart2 size={16} style={{ color: '#818cf8' }} />
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>Feature Importance</span>
              {!brain?.featureImportance && (
                <span style={{ fontSize: '10px', color: '#fbbf24', background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.20)', borderRadius: '4px', padding: '1px 7px', marginLeft: '4px' }}>Example</span>
              )}
            </div>
            <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 16px', lineHeight: 1.6 }}>
              Which signals have the strongest correlation with win/loss outcomes.
              Green = positive for winning, red = negative (risk factor).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {featureImportance.map((f: any, i: number) => (
                <FeatureBar
                  key={i}
                  name={f.name}
                  pct={typeof f.pct === 'number' ? f.pct : Math.round((f.importance ?? 0) * 100)}
                  direction={f.direction}
                />
              ))}
            </div>
          </div>

          {/* ML model overview */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Brain size={16} style={{ color: '#a78bfa' }} />
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>Model Status</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {[
                { name: 'Win Probability', desc: 'Predicts likelihood of closing', activatesAt: 10 },
                { name: 'Text Signals', desc: 'Champion, risk, objection detection', activatesAt: null },
                { name: 'Momentum', desc: 'Sentiment trend across notes', activatesAt: null },
                { name: 'Deal Archetypes', desc: 'Natural deal clusters', activatesAt: 20 },
                { name: 'Competitive Intel', desc: 'Win/loss by competitor', activatesAt: 10 },
                { name: 'Forecast Model', desc: 'Weighted pipeline revenue', activatesAt: 10 },
              ].map((m, i) => {
                const trainSize = mlDealCount ?? 0
                const active = m.activatesAt === null || trainSize >= m.activatesAt
                const statusColor = active ? '#34d399' : '#fbbf24'
                return (
                  <div key={i} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', opacity: active ? 1 : 0.65 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>{m.name}</div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>{m.desc}</div>
                    {!active && m.activatesAt && (
                      <div style={{ fontSize: '10px', color: '#fbbf24', marginTop: '5px' }}>
                        Needs {m.activatesAt} closed deals ({m.activatesAt - (mlDealCount ?? 0)} more)
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════
          COMPETITORS TAB
      ════════════════════════════════════ */}
      {activeTab === 'competitors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {competitors.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
              <Swords size={28} style={{ color: '#475569', marginBottom: '12px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>No competitors added yet</div>
              <div style={{ fontSize: '13px', color: '#475569', marginBottom: '16px', lineHeight: 1.6 }}>Add competitor battlecards to track positioning and win rates.</div>
              <Link href="/competitors" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', color: '#818cf8', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                Manage competitors <ArrowUpRight size={11} />
              </Link>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {competitors.map((c: any) => (
                  <div key={c.id} style={{ ...card, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>{c.name}</div>
                        {c.website && <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{c.website}</div>}
                      </div>
                      <Link href="/competitors" style={{ fontSize: '10px', color: '#818cf8', textDecoration: 'none' }}>Details →</Link>
                    </div>
                    {c.strengths?.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Strengths</div>
                        {c.strengths.slice(0, 2).map((s: string, i: number) => (
                          <div key={i} style={{ fontSize: '11px', color: '#94a3b8', padding: '2px 0', display: 'flex', gap: '5px' }}>
                            <span style={{ color: '#34d399', flexShrink: 0 }}>+</span>{s}
                          </div>
                        ))}
                      </div>
                    )}
                    {c.weaknesses?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Weaknesses</div>
                        {c.weaknesses.slice(0, 2).map((w: string, i: number) => (
                          <div key={i} style={{ fontSize: '11px', color: '#94a3b8', padding: '2px 0', display: 'flex', gap: '5px' }}>
                            <span style={{ color: '#f87171', flexShrink: 0 }}>−</span>{w}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Link href="/competitors" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#818cf8', textDecoration: 'none' }}>
                Manage all competitors <ArrowUpRight size={11} />
              </Link>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════
          TRENDS TAB
      ════════════════════════════════════ */}
      {activeTab === 'trends' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>

            {/* Win rate trend */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <TrendingUp size={16} style={{ color: '#34d399' }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>Win Rate</span>
              </div>
              {isLoading ? <SkeletonLine h="60px" /> : brain?.winLossIntel ? (
                <div>
                  <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', letterSpacing: '-0.03em', lineHeight: 1 }}>
                        {brain.winLossIntel.winRate != null ? `${Math.round(brain.winLossIntel.winRate * 100)}%` : '—'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>overall win rate</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: '#818cf8', letterSpacing: '-0.03em', lineHeight: 1 }}>
                        {brain.winLossIntel.winCount ?? 0}
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>wins · {brain.winLossIntel.lossCount ?? 0} losses</div>
                    </div>
                  </div>
                  {brain.winLossIntel.avgDaysToClose != null && (
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Avg close time: <strong style={{ color: '#94a3b8' }}>{Math.round(brain.winLossIntel.avgDaysToClose)} days</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#475569', padding: '8px 0' }}>Win/loss data appears after logging closed deals.</div>
              )}
            </div>

            {/* Stage velocity */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Activity size={16} style={{ color: '#a78bfa' }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>Stage Velocity</span>
              </div>
              {isLoading ? <SkeletonLine h="80px" /> : stageTrend.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stageTrend.slice(0, 5).map((s: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '100px', fontSize: '11px', color: '#64748b', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.stage}</div>
                      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (s.avgDays / 30) * 100)}%`, background: '#a78bfa', borderRadius: '3px' }} />
                      </div>
                      <div style={{ width: '50px', textAlign: 'right', fontSize: '11px', color: '#a78bfa', flexShrink: 0 }}>{Math.round(s.avgDays)}d avg</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#475569', padding: '8px 0' }}>Stage velocity unlocks with deal history data.</div>
              )}
            </div>

            {/* Pipeline health summary */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <BarChart2 size={16} style={{ color: '#fbbf24' }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>Pipeline Health</span>
              </div>
              {isLoading ? <SkeletonLine h="80px" /> : brain ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'Urgent deals', value: brain.urgentDeals?.length ?? 0, color: '#f87171' },
                    { label: 'Stale deals', value: brain.staleDeals?.length ?? 0, color: '#fbbf24' },
                    { label: 'ML predictions', value: brain.mlPredictions?.length ?? 0, color: '#818cf8' },
                    { label: 'Score trend alerts', value: brain.scoreTrendAlerts?.length ?? 0, color: '#a78bfa' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{item.label}</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: item.value > 0 ? item.color : 'rgba(255,255,255,0.30)' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#475569', padding: '8px 0' }}>Pipeline health data loading…</div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes sk { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
