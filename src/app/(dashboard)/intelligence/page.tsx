'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Brain, TrendingUp, TrendingDown, Layers, BarChart2, ArrowUpRight, ChevronRight, BookOpen, Save } from 'lucide-react'
import { PageTabs } from '@/components/shared/PageTabs'

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

export default function IntelligencePage() {
  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data
  const { data: kbRes, mutate: mutateKb } = useSWR('/api/workspace/knowledge-base', fetcher, { revalidateOnFocus: false })
  const [kbText, setKbText] = useState('')
  const [kbSaving, setKbSaving] = useState(false)
  const [kbSaved, setKbSaved] = useState(false)

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

  const INTELLIGENCE_TABS = [
    { label: 'Overview',    href: '/intelligence' },
    { label: 'Competitors', href: '/competitors' },
    { label: 'Case Studies', href: '/case-studies' },
    { label: 'Feature Gaps', href: '/product-gaps' },
    { label: 'Playbook',    href: '/playbook' },
    { label: 'Models',      href: '/models' },
  ]

  function SkeletonLine({ w = '100%', h = '14px' }: { w?: string; h?: string }) {
    return <div style={{ width: w, height: h, borderRadius: '6px' }} className="skeleton" />
  }

  return (
    <div style={{ maxWidth: '960px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Tabs */}
      <PageTabs tabs={INTELLIGENCE_TABS} />

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
            Intelligence
          </h1>
          <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
            Patterns and signals extracted from your deals
          </p>
        </div>
      </div>

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

    </div>
  )
}
