'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Target, BarChart3, GitBranch, ChevronRight, ExternalLink, Lightbulb, Layers } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function SkeletonLine({ w = '100%', h = '14px' }: { w?: string; h?: string }) {
  return <div style={{ width: w, height: h, borderRadius: '6px', background: 'rgba(255,255,255,0.07)', animation: 'skeleton-shimmer 1.5s ease-in-out infinite' }} />
}

// Luminous glass card style
const card: React.CSSProperties = {
  position: 'relative',
  background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(59,130,246,0.05) 50%, rgba(139,92,246,0.07) 100%)',
  backdropFilter: 'blur(24px) saturate(200%)',
  WebkitBackdropFilter: 'blur(24px) saturate(200%)',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.40)',
}

const STAGES = ['Discovery', 'Proposal', 'Trial', 'Negotiation'] as const
type Stage = typeof STAGES[number]

const STAGE_TACTICS: Record<Stage, string[]> = {
  Discovery: [
    'Ask about their current process before pitching — understand the pain first',
    'Identify the economic buyer in the first two calls',
    'Get a clear "what does success look like in 90 days?" answer before the demo',
    'Qualify budget range early — vague answers signal low urgency',
  ],
  Proposal: [
    'Send proposals within 24 hours of the last meeting — momentum decays fast',
    'Include a mutual success plan, not just a price sheet',
    'Personalise ROI numbers to their specific team size and use case',
    'Ask for feedback within 48 hours — silence usually means objections',
  ],
  Trial: [
    'Assign a dedicated success contact during trial — deals with a named CSM convert 2× more',
    'Schedule a mid-trial check-in at day 7 to catch early blockers',
    'Track which features they actually use — unused = at risk',
    'Get a written success criterion before trial starts',
  ],
  Negotiation: [
    'Never discount without getting something in return — timeline, case study, referral',
    'Anchor on value delivered, not list price, when pushback comes',
    'If procurement is involved, get an executive sponsor on your side first',
    'Set a clear close date together — open-ended negotiation almost never closes',
  ],
}

export default function IntelligencePage() {
  const { data: brainRes, isLoading: brainLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const { data: accuracyRes } = useSWR('/api/models/forecast-accuracy', fetcher, { revalidateOnFocus: false })
  const { data: insightsRes } = useSWR('/api/insights', fetcher, { revalidateOnFocus: false })
  const [activeStage, setActiveStage] = useState<Stage>('Discovery')

  const brain = brainRes?.data
  const accuracy = accuracyRes?.data
  const insights = insightsRes?.data

  // Win/loss reasons
  const winReasons: string[] = brain?.winPatterns?.slice(0, 5) ?? insights?.winReasons?.slice(0, 5) ?? []
  const lossReasons: string[] = brain?.lossPatterns?.slice(0, 5) ?? insights?.lossReasons?.slice(0, 5) ?? []
  const winRate: number | null = brain?.winRate ?? insights?.winRate ?? null

  // Product gap signals — features deals are asking for
  const productGaps: any[] = brain?.productGapSignals ?? brain?.dealRiskPatterns ?? []

  // AI accuracy
  const forecastAccuracy: number | null = accuracy?.accuracy ?? accuracy?.forecastAccuracy ?? null
  const trainedOn: number | null = accuracy?.trainedOnDeals ?? accuracy?.dealCount ?? null
  const lastTrained: string | null = accuracy?.lastTrainedAt ?? null
  const topFactors: string[] = accuracy?.topFactors ?? accuracy?.featureImportance ?? [
    'How quickly you respond to objections',
    'Number of stakeholders engaged during the deal',
    'Deal size compared to your average',
    'How recently you had a meaningful conversation',
    'Whether a champion was identified early',
  ]

  const lastTrainedLabel = lastTrained
    ? (() => {
        const days = Math.floor((Date.now() - new Date(lastTrained).getTime()) / 86400000)
        return days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`
      })()
    : null

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.025em', marginBottom: '6px' }}>Intelligence</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.38)', letterSpacing: '-0.01em' }}>
          Why deals win and lose, what your product team needs to know, and what works at each stage.
        </p>
      </div>

      {/* ── SECTION 1: Why we win and lose ── */}
      <section>
        <SectionHeader icon={<TrendingUp size={16} style={{ color: '#34d399' }} />} title="Why we win and lose" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {/* Win reasons */}
          <div style={{ ...card, padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.50)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>Why we win</span>
              {winRate !== null && (
                <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: '#34d399' }}>{Math.round(winRate * 100)}% win rate</span>
              )}
            </div>
            {brainLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{[1,2,3].map(i => <SkeletonLine key={i} w={`${70 + i * 8}%`} h="13px" />)}</div>
            ) : winReasons.length > 0 ? (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {winReasons.map((r, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: '#34d399', fontSize: '13px', flexShrink: 0, marginTop: '1px' }}>✓</span>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.32)', lineHeight: 1.6 }}>
                Close more deals to see patterns emerge. Halvex learns from every won deal.
              </p>
            )}
          </div>

          {/* Loss reasons */}
          <div style={{ ...card, padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f87171', boxShadow: '0 0 8px rgba(248,113,113,0.50)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>Why we lose</span>
            </div>
            {brainLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{[1,2,3].map(i => <SkeletonLine key={i} w={`${65 + i * 8}%`} h="13px" />)}</div>
            ) : lossReasons.length > 0 ? (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {lossReasons.map((r, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: '#f87171', fontSize: '13px', flexShrink: 0, marginTop: '1px' }}>✗</span>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.32)', lineHeight: 1.6 }}>
                Mark deals as lost and add a reason to start learning from them.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: Features deals are asking for ── */}
      <section>
        <SectionHeader
          icon={<GitBranch size={16} style={{ color: '#fbbf24' }} />}
          title="Features deals are asking for"
          label="For your product team"
        />
        <div style={{ ...card, padding: '0', overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px', gap: '12px', padding: '12px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Feature', 'Deals', 'ARR at risk', ''].map((h, i) => (
              <span key={i} style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>

          {brainLoading ? (
            <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1,2,3].map(i => <SkeletonLine key={i} h="36px" />)}
            </div>
          ) : productGaps.length > 0 ? (
            <div>
              {productGaps.slice(0, 8).map((gap: any, i: number) => {
                const dealCount = gap.dealCount ?? gap.count ?? 1
                const arrAtRisk = gap.totalArrAtRisk ?? gap.arrAtRisk ?? gap.dealValue ?? null
                const title = gap.feature || gap.title || gap.pattern || 'Unknown feature'
                return (
                  <div
                    key={i}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px', gap: '12px',
                      padding: '13px 22px', alignItems: 'center',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.80)', fontWeight: 500 }}>{title}</span>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', textAlign: 'right', fontWeight: 600 }}>{dealCount}</span>
                    <span style={{ fontSize: '13px', color: arrAtRisk ? '#fbbf24' : 'rgba(255,255,255,0.30)', textAlign: 'right', fontWeight: arrAtRisk ? 600 : 400 }}>
                      {arrAtRisk ? `£${Math.round(arrAtRisk / 1000)}k` : '—'}
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Link
                        href="/connections"
                        style={{ fontSize: '11px', color: '#818cf8', textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.18)' }}
                      >
                        Linear <ExternalLink size={9} />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ padding: '32px 22px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.40)', marginBottom: '8px' }}>No features identified yet</p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', lineHeight: 1.6 }}>
                Add deal notes mentioning product gaps and Halvex will automatically surface features your team needs to build.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 3: How accurate our AI is ── */}
      <section>
        <SectionHeader icon={<BarChart3 size={16} style={{ color: '#818cf8' }} />} title="How accurate our AI is" />
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px' }}>

          {/* Big accuracy number */}
          <div style={{ ...card, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '52px', fontWeight: 700, color: forecastAccuracy ? '#818cf8' : 'rgba(255,255,255,0.20)', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {forecastAccuracy ? `${Math.round(forecastAccuracy)}%` : '—'}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '6px', fontWeight: 500 }}>win prediction accuracy</div>
            {lastTrainedLabel && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: '4px' }}>Updated {lastTrainedLabel}</div>}
            {trainedOn && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>Based on {trainedOn} deals</div>}
          </div>

          {/* Top factors */}
          <div style={{ ...card, padding: '22px 24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>
              What predicts a win
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topFactors.slice(0, 5).map((factor: string, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                    background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.22)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#818cf8' }}>{i + 1}</span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.68)', lineHeight: 1.4 }}>{factor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: What works at each stage (Playbook) ── */}
      <section style={{ paddingBottom: '40px' }}>
        <SectionHeader icon={<Layers size={16} style={{ color: '#c084fc' }} />} title="What works at each stage" label="Playbook" />

        {/* Stage tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {STAGES.map(stage => (
            <button
              key={stage}
              onClick={() => setActiveStage(stage)}
              style={{
                padding: '7px 16px', borderRadius: '9px', fontSize: '13px', fontWeight: 500,
                border: `1px solid ${activeStage === stage ? 'rgba(192,132,252,0.35)' : 'rgba(255,255,255,0.08)'}`,
                background: activeStage === stage ? 'rgba(192,132,252,0.12)' : 'transparent',
                color: activeStage === stage ? '#c084fc' : 'rgba(255,255,255,0.45)',
                cursor: 'pointer', transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (activeStage !== stage) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.70)' }}
              onMouseLeave={e => { if (activeStage !== stage) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' }}
            >
              {stage}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {STAGE_TACTICS[activeStage].map((tactic, i) => (
            <div
              key={i}
              style={{
                ...card,
                padding: '16px 20px',
                display: 'flex', alignItems: 'flex-start', gap: '12px',
              }}
            >
              <div style={{
                width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
                background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Lightbulb size={12} style={{ color: '#c084fc' }} />
              </div>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, margin: 0 }}>
                {tactic}
              </p>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        @keyframes skeleton-shimmer {
          0%   { opacity: 1; }
          50%  { opacity: 0.45; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function SectionHeader({ icon, title, label }: { icon: React.ReactNode; title: string; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.015em', margin: 0 }}>{title}</h2>
      {label && (
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.30)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '100px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </span>
      )}
    </div>
  )
}
