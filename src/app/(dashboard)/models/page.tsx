'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Brain, TrendingUp, Target, Zap, Star, BarChart3, Award, AlertTriangle,
  CheckCircle, Clock, ArrowUpRight, ChevronRight, Lock, Info, Activity,
  Database, Cpu, Shield, GitBranch, Users, Swords, BookOpen, Globe,
} from 'lucide-react'
import { PageTabs } from '@/components/shared/PageTabs'
import { fetcher } from '@/lib/fetcher'

// ── Forecast accuracy types ───────────────────────────────────────────────────
interface BucketData { bucket: string; predicted: number; wonRate: number }
interface CalibrationMonth { month: string; predicted: number; actual: number; count: number }
interface ForecastAccuracy {
  totalPredictions: number
  correctPredictions: number
  accuracy: number
  byScoreBucket: BucketData[]
  recentCalibration: CalibrationMonth[]
}

// ── Tooltip helper ────────────────────────────────────────────────────────────
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: '8px', zIndex: 50, width: '256px', borderRadius: '8px',
          background: '#37352f', border: '1px solid rgba(55,53,47,0.16)',
          padding: '8px 12px', fontSize: '12px', color: '#ffffff',
          boxShadow: '0 8px 24px rgba(55,53,47,0.16)',
        }}>
          {text}
        </div>
      )}
    </span>
  )
}

function InfoButton({ text }: { text: string }) {
  return (
    <Tooltip text={text}>
      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', verticalAlign: 'middle', display: 'inline-flex', alignItems: 'center' }}>
        <Info size={12} style={{ color: 'var(--text-tertiary)' }} />
      </button>
    </Tooltip>
  )
}

// ── Mini bar chart component ──────────────────────────────────────────────────
function BarChart({ value, max, color = '#5e6ad2' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(55,53,47,0.09)', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.6s ease-out' }} />
    </div>
  )
}

// ── Accuracy ring ─────────────────────────────────────────────────────────────
function AccuracyRing({ pct }: { pct: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const color = pct >= 70 ? '#0f7b6c' : pct >= 50 ? '#cb6c2c' : '#e03e3e'
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(55,53,47,0.09)" strokeWidth="8" />
      <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease-out' }} />
    </svg>
  )
}

// ── Animated count-up number ──────────────────────────────────────────────────
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const duration = 300
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(1, elapsed / duration)
      setValue(Math.round(target * progress))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target])
  return <>{value}{suffix}</>
}

// ── Milestone Roadmap ─────────────────────────────────────────────────────────
function MilestoneRoadmap({ trainingSize }: { trainingSize: number }) {
  const milestones = [
    {
      n: trainingSize,
      label: 'NOW',
      title: `${trainingSize} deals`,
      bullets: ['Training in progress', 'Text signals active', 'Momentum tracking'],
      current: true,
    },
    {
      n: 10,
      label: '10 deals',
      title: 'ML activates',
      bullets: ['Win probability scoring', 'Similar deal matching', 'Feature importance'],
    },
    {
      n: 20,
      label: '20 deals',
      title: 'Archetypes form',
      bullets: ['Deal archetype clusters', 'Per-competitor models', 'Playbook unlocks'],
    },
    {
      n: 50,
      label: '50 deals',
      title: 'Full suite',
      bullets: ['Trend detection', 'Calibrated forecast', 'Global benchmarks'],
    },
  ]

  const milestoneThresholds = [0, 10, 20, 50]

  return (
    <div style={{ marginTop: '20px' }}>
      {/* Track */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        {/* Background line */}
        <div style={{ position: 'absolute', left: '16px', right: '16px', height: '2px', background: 'rgba(55,53,47,0.09)', top: '16px' }} />
        {/* Progress fill */}
        <div style={{
          position: 'absolute', left: '16px', height: '2px',
          background: '#0f7b6c', top: '16px',
          width: `${Math.min(100, (trainingSize / 50) * 100)}%`,
          maxWidth: 'calc(100% - 32px)',
          transition: 'width 0.1s ease',
        }} />
        {/* Nodes */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', position: 'relative' }}>
          {milestoneThresholds.map((threshold, idx) => {
            const isPast = trainingSize >= threshold
            const isCurrent = idx === 0 || (trainingSize >= threshold && (idx === milestoneThresholds.length - 1 || trainingSize < milestoneThresholds[idx + 1]))
            return (
              <div key={threshold} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '32px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: isPast ? '#0f7b6c' : '#ffffff',
                  border: `2px solid ${isPast ? '#0f7b6c' : isCurrent ? '#5e6ad2' : 'rgba(55,53,47,0.16)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.1s ease',
                  flexShrink: 0,
                }}>
                  {isPast && idx > 0
                    ? <CheckCircle size={14} style={{ color: '#fff' }} />
                    : idx === 0
                      ? <span style={{ fontSize: '10px', fontWeight: '600', color: trainingSize >= 10 ? '#fff' : '#5e6ad2' }}>{trainingSize}</span>
                      : <Lock size={12} style={{ color: 'var(--text-tertiary)' }} />
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Milestone labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {milestones.map((m, idx) => {
          const isPast = idx > 0 && trainingSize >= m.n
          const isCurrent = idx === 0
          return (
            <div key={idx} style={{
              padding: '12px',
              borderRadius: '8px',
              background: isCurrent ? 'rgba(94,106,210,0.06)' : isPast ? 'rgba(15,123,108,0.06)' : '#f7f6f3',
              border: `1px solid ${isCurrent ? 'rgba(94,106,210,0.16)' : isPast ? 'rgba(15,123,108,0.16)' : 'rgba(55,53,47,0.09)'}`,
              opacity: (!isCurrent && !isPast) ? 0.6 : 1,
            }}>
              <div style={{ fontSize: '10px', fontWeight: '600', color: isCurrent ? '#5e6ad2' : isPast ? '#0f7b6c' : '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                {m.label}
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
                {m.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {m.bullets.map((b, bi) => (
                  <div key={bi} style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <span style={{ color: isCurrent ? '#5e6ad2' : isPast ? '#0f7b6c' : '#9b9a97', marginTop: '1px' }}>•</span>
                    {b}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Model Grid ────────────────────────────────────────────────────────────────
interface ModelDef {
  name: string
  description: string
  activatesAt: number | null
  icon: React.ReactNode
}

function ModelGrid({ trainingSize, brainData }: { trainingSize: number; brainData: Record<string, unknown> | null }) {
  const models: ModelDef[] = [
    { name: 'Win Probability', description: 'Predicts likelihood of closing each deal', activatesAt: 10, icon: <Target size={14} /> },
    { name: 'Similar Deals', description: 'Finds closed deals most similar to open ones', activatesAt: 10, icon: <GitBranch size={14} /> },
    { name: 'Stage Velocity', description: 'Tracks deal pace vs your historical benchmarks', activatesAt: 5, icon: <Activity size={14} /> },
    { name: 'Text Signals', description: 'Extracts champion, risk, objection signals from notes', activatesAt: null, icon: <Zap size={14} /> },
    { name: 'Momentum', description: 'Detects sentiment trend across meeting notes over time', activatesAt: null, icon: <TrendingUp size={14} /> },
    { name: 'Deal Archetypes', description: 'Clusters your deals into natural groups', activatesAt: 20, icon: <Users size={14} /> },
    { name: 'Competitive Intel', description: 'Tracks win/loss rates per competitor', activatesAt: 10, icon: <Shield size={14} /> },
    { name: 'Objection Map', description: 'Maps objection themes to close rates', activatesAt: 15, icon: <BarChart3 size={14} /> },
    { name: 'Forecast Model', description: 'Probability-weighted pipeline revenue', activatesAt: 10, icon: <Database size={14} /> },
  ]

  function getModelStatus(model: ModelDef): { status: 'active' | 'warming' | 'locked'; output: string } {
    const wlData = (brainData as { winLossIntel?: { winCount?: number; lossCount?: number } } | null)?.winLossIntel
    const currentWins = wlData?.winCount ?? 0
    const currentLosses = wlData?.lossCount ?? 0

    if (model.activatesAt === null) {
      return { status: 'active', output: 'Always active — no training required' }
    }
    if (trainingSize >= model.activatesAt) {
      if (model.name === 'Win Probability') {
        const predictions = (brainData as { mlPredictions?: unknown[] } | null)?.mlPredictions ?? []
        return { status: 'active', output: `Scoring ${predictions.length} open deals` }
      }
      if (model.name === 'Deal Archetypes') {
        const archetypes = (brainData as { dealArchetypes?: unknown[] } | null)?.dealArchetypes ?? []
        return { status: 'active', output: archetypes.length > 0 ? `${archetypes.length} clusters identified` : 'Active — building clusters' }
      }
      if (model.name === 'Competitive Intel') {
        const patterns = (brainData as { competitivePatterns?: unknown[] } | null)?.competitivePatterns ?? []
        return { status: 'active', output: patterns.length > 0 ? `Tracking ${patterns.length} competitors` : 'Active — accumulating data' }
      }
      return { status: 'active', output: 'Active — learning from your deals' }
    }
    if (trainingSize >= Math.floor(model.activatesAt * 0.6)) {
      const needed = model.activatesAt - trainingSize
      const lossesNeeded = Math.max(0, Math.round(model.activatesAt * 0.3) - currentLosses)
      const lossNote = lossesNeeded > 0 ? `, incl. ${lossesNeeded} loss${lossesNeeded !== 1 ? 'es' : ''}` : ''
      return { status: 'warming', output: `Warming up — need ${needed} more deal${needed !== 1 ? 's' : ''}${lossNote}` }
    }
    {
      const needed = Math.max(0, model.activatesAt - trainingSize)
      const winsRequired = Math.round(model.activatesAt * 0.4)
      const lossesRequired = Math.round(model.activatesAt * 0.3)
      const requireParts: string[] = []
      if (winsRequired > 0) requireParts.push(`${winsRequired}+ wins`)
      if (lossesRequired > 0) requireParts.push(`${lossesRequired}+ losses`)
      const requireDesc = requireParts.length > 0 ? requireParts.join(', ') : `${model.activatesAt}+ closed deals`
      return {
        status: 'locked',
        output: `Locked — ${needed} more closed deal${needed !== 1 ? 's' : ''} needed\nCurrently: ${currentWins} win${currentWins !== 1 ? 's' : ''}, ${currentLosses} loss${currentLosses !== 1 ? 'es' : ''}\nRequires: ${requireDesc}`,
      }
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
      {models.map((model, i) => {
        const { status, output } = getModelStatus(model)
        const dotColor = status === 'active' ? '#0f7b6c' : status === 'warming' ? '#cb6c2c' : 'rgba(55,53,47,0.16)'
        const statusText = status === 'active' ? 'Active' : status === 'warming' ? 'Warming Up' : `Locked`
        const statusColor = status === 'active' ? '#0f7b6c' : status === 'warming' ? '#cb6c2c' : '#9b9a97'
        return (
          <div key={i} style={{
            padding: '14px',
            borderRadius: '8px',
            background: 'var(--surface-1)',
            border: `1px solid rgba(55,53,47,0.12)`,
            boxShadow: status === 'active'
              ? '0 1px 3px rgba(55,53,47,0.06)'
              : '0 1px 3px rgba(55,53,47,0.04)',
            opacity: status === 'locked' ? 0.65 : 1,
            transition: 'opacity 0.1s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ color: status === 'active' ? '#5e6ad2' : '#9b9a97' }}>
                  {model.icon}
                </div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {model.name}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>
              {model.description}
            </div>
            <div style={{ fontSize: '10px', color: statusColor, fontWeight: '600' }}>
              {statusText}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
              {output}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Feature Importance Chart ──────────────────────────────────────────────────
const FEATURE_TOOLTIPS: Record<string, string> = {
  'Champion Presence': 'Whether a deal champion (internal advocate) was identified',
  'Deal Value': 'The monetary value of the deal',
  'Stage Velocity': 'How fast deals move through stages compared to your historical average',
  'Meeting Frequency': 'How often meetings/calls are happening',
  'Competitor Present': 'Whether a named competitor is involved',
  'Text Engagement': 'NLP composite score from meeting notes — sentiment, recency, and signal quality',
  'Stage Progress': 'How far through the sales funnel the deal is',
  'Pipeline Age': 'How long the deal has been in the pipeline',
  'Risk Intensity': 'How many active risk signals have been detected',
  'Todo Engagement': 'Ratio of completed to total action items',
}

const PLACEHOLDER_FEATURES = [
  { name: 'Champion Presence', pct: 23 },
  { name: 'Deal Value', pct: 18 },
  { name: 'Stage Velocity', pct: 15 },
  { name: 'Meeting Frequency', pct: 13 },
  { name: 'Competitor Present', pct: 11 },
]

function FeatureImportanceChart({ features, isPlaceholder }: { features: { name: string; pct: number; direction?: string }[]; isPlaceholder: boolean }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t) }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {isPlaceholder && (
        <div style={{ fontSize: '11px', color: '#cb6c2c', background: 'rgba(203,108,44,0.08)', border: '1px solid rgba(203,108,44,0.20)', borderRadius: '6px', padding: '6px 10px', marginBottom: '4px' }}>
          Example — unlocks with your data at 10+ closed deals
        </div>
      )}
      {features.map((f, i) => {
        const tooltip = FEATURE_TOOLTIPS[f.name] ?? f.name
        const barWidth = mounted ? Math.min(100, f.pct) : 0
        const isPositive = f.direction !== 'negative'
        const barColor = isPlaceholder
          ? 'rgba(55,53,47,0.15)'
          : isPositive ? '#0f7b6c' : '#e03e3e'
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '160px', fontSize: '12px', fontWeight: '500', color: isPlaceholder ? '#787774' : '#37352f', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {f.name}
              <InfoButton text={tooltip} />
            </div>
            <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'rgba(55,53,47,0.07)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${barWidth}%`,
                background: barColor,
                borderRadius: '4px',
                transition: 'width 0.6s ease-out',
              }} />
            </div>
            <div style={{ width: '40px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: isPlaceholder ? '#787774' : barColor, flexShrink: 0, fontFamily: 'var(--font-mono, monospace)' }}>
              {f.pct}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Calibration Bucket Chart ──────────────────────────────────────────────────
function CalibrationBucketChart({ buckets }: { buckets: BucketData[] }) {
  const hasCounts = buckets.some(b => b.predicted > 0)
  if (!hasCounts) return null
  const maxCount = Math.max(...buckets.map(b => b.predicted), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {buckets.map((b) => {
        const wonPct = Math.round(b.wonRate * 100)
        const barPct = maxCount > 0 ? Math.min(100, (b.predicted / maxCount) * 100) : 0
        return (
          <div key={b.bucket} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '52px', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', flexShrink: 0, fontFamily: 'var(--font-mono, monospace)' }}>
              {b.bucket}
            </div>
            <div style={{ flex: 1, position: 'relative', height: '20px', borderRadius: '4px', background: 'rgba(55,53,47,0.07)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${barPct}%`, background: 'rgba(94,106,210,0.15)', transition: 'width 0.6s ease-out' }} />
              <div style={{ position: 'absolute', inset: 0, width: `${wonPct}%`, background: b.predicted > 0 ? '#5e6ad2' : 'transparent', opacity: 0.9, transition: 'width 0.6s ease-out' }} />
            </div>
            <div style={{ width: '72px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', flexShrink: 0, fontFamily: 'var(--font-mono, monospace)' }}>
              {b.predicted > 0 ? `${wonPct}% won` : '—'}
            </div>
            <div style={{ width: '44px', textAlign: 'right', fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
              {b.predicted > 0 ? `n=${b.predicted}` : ''}
            </div>
          </div>
        )
      })}
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingTop: '4px', borderTop: '1px solid rgba(55,53,47,0.09)' }}>
        Bar width = deal count. Fill = actual win rate. Ideal: win rate rises with score bucket.
      </div>
    </div>
  )
}

// ── Monthly calibration line chart ────────────────────────────────────────────
function ForecastCalibrationChart({ points }: { points: CalibrationMonth[] }) {
  if (!points?.length) return null
  const h = 90, w = 320, padX = 16, padY = 12
  const innerW = w - padX * 2
  const innerH = h - padY * 2

  const normalize = (val: number) => Math.min(100, Math.max(0, val))

  const xs = points.map((_, i) => padX + (i / Math.max(points.length - 1, 1)) * innerW)
  const predictedYs = points.map(p => padY + innerH - (normalize(p.predicted) / 100) * innerH)
  const actualYs = points.map(p => padY + innerH - (normalize(p.actual) / 100) * innerH)

  const toPath = (ys: number[]) =>
    ys.map((y, i) => `${i === 0 ? 'M' : 'L'} ${xs[i].toFixed(1)} ${y.toFixed(1)}`).join(' ')

  return (
    <div>
      <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
        <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke="rgba(55,53,47,0.09)" strokeWidth="1" />
        <path d={toPath(predictedYs)} fill="none" stroke="#9b9a97" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={toPath(actualYs)} fill="none" stroke="#5e6ad2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xs[i]} cy={predictedYs[i]} r="3" fill="#ffffff" stroke="#9b9a97" strokeWidth="1.5" />
            <circle cx={xs[i]} cy={actualYs[i]} r="3" fill="#5e6ad2" />
          </g>
        ))}
        {[0, Math.floor((points.length - 1) / 2), points.length - 1]
          .filter((idx, pos, arr) => arr.indexOf(idx) === pos && idx < points.length)
          .map(idx => (
            <text key={idx} x={xs[idx]} y={h} textAnchor="middle" fontSize="9" fill="#9b9a97">
              {points[idx].month}
            </text>
          ))}
      </svg>
      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <div style={{ width: '20px', height: '2px', background: '#9b9a97', borderTop: '2px dashed #9b9a97' }} />
          Avg predicted score
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <div style={{ width: '20px', height: '2px', background: '#5e6ad2' }} />
          Actual win rate ×100
        </div>
      </div>
    </div>
  )
}

// ── Calibration timeline chart ────────────────────────────────────────────────
function CalibrationChart({ points }: { points: { discrimination?: number; month?: string }[] }) {
  if (!points?.length) return null
  const h = 80, w = 280, pad = 12
  const maxDisc = Math.max(...points.map(p => Math.abs(p.discrimination ?? 0)), 20)
  const pts = points.map((p, i: number) => ({
    x: pad + (i / Math.max(points.length - 1, 1)) * (w - pad * 2),
    y: h - pad - ((p.discrimination ?? 0) / maxDisc) * (h - pad * 2),
    val: p.discrimination ?? 0,
    month: p.month,
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="rgba(55,53,47,0.09)" strokeWidth="1" />
      <path d={pathD} fill="none" stroke="#5e6ad2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={p.val >= 0 ? '#0f7b6c' : '#e03e3e'} />
      ))}
    </svg>
  )
}

// ── Global Benchmarks Card ────────────────────────────────────────────────────
function GlobalBenchmarksCard({
  winPct, avgClose, avgDealValue, benchmarkRes,
}: {
  winPct: number | null
  avgClose: number | null
  avgDealValue: number | null
  benchmarkRes: { available: boolean; benchmarks?: { winRate: number; avgCycleLength: number; topRiskThemes: string[]; avgDealValue: number; poolSize: number; cachedAt: string } } | undefined
}) {
  if (!benchmarkRes || !benchmarkRes.available || !benchmarkRes.benchmarks) return null

  const b = benchmarkRes.benchmarks

  const fmtCurrency = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `$${Math.round(v / 1_000)}k`
    return `$${Math.round(v)}`
  }

  const rows: { label: string; yours: string | null; benchmark: string; delta: string | null; positive: boolean | null }[] = [
    {
      label: 'Win Rate',
      yours: winPct != null ? `${winPct}%` : null,
      benchmark: `${Math.round(b.winRate)}%`,
      delta: winPct != null ? `${winPct - Math.round(b.winRate) >= 0 ? '+' : ''}${winPct - Math.round(b.winRate)}pp` : null,
      positive: winPct != null ? winPct >= b.winRate : null,
    },
    {
      label: 'Avg Cycle Length',
      yours: avgClose != null ? `${avgClose} days` : null,
      benchmark: `${Math.round(b.avgCycleLength)} days`,
      delta: avgClose != null ? `${avgClose - Math.round(b.avgCycleLength) <= 0 ? '' : '+'}${avgClose - Math.round(b.avgCycleLength)} days` : null,
      positive: avgClose != null ? avgClose <= b.avgCycleLength : null,
    },
    {
      label: 'Avg Deal Value',
      yours: avgDealValue != null ? fmtCurrency(avgDealValue) : null,
      benchmark: fmtCurrency(b.avgDealValue),
      delta: avgDealValue != null ? `${avgDealValue >= b.avgDealValue ? '+' : '-'}${fmtCurrency(Math.abs(avgDealValue - b.avgDealValue))}` : null,
      positive: avgDealValue != null ? avgDealValue >= b.avgDealValue : null,
    },
  ]

  return (
    <div style={{
      background: 'var(--surface-1)', border: '1px solid rgba(55,53,47,0.12)',
      borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(55,53,47,0.06)',
      display: 'flex', flexDirection: 'column', gap: '16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={14} style={{ color: 'var(--text-tertiary)' }} />
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Industry Benchmarks
          </div>
          <InfoButton text="Compare your performance to anonymised industry averages from similar B2B workspaces" />
        </div>
      </div>

      {/* Comparison grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', padding: '0 12px 8px', borderBottom: '1px solid rgba(55,53,47,0.09)' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Metric</div>
          <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>You</div>
          <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Industry</div>
          <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Delta</div>
        </div>
        {rows.map((row, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px',
            padding: '10px 12px', borderBottom: i < rows.length - 1 ? '1px solid rgba(55,53,47,0.06)' : 'none',
          }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{row.label}</div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>
              {row.yours ?? '--'}
            </div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)' }}>
              {row.benchmark}
            </div>
            <div style={{
              fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-mono, monospace)',
              color: row.positive === null ? 'var(--text-tertiary)' : row.positive ? '#0f7b6c' : '#e03e3e',
            }}>
              {row.delta ?? '--'}
            </div>
          </div>
        ))}
      </div>

      {/* Pool size note */}
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        Based on {b.poolSize.toLocaleString()} anonymised workspaces
      </div>

      {/* Top risk themes */}
      {b.topRiskThemes.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Top Risk Themes (Industry)
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {b.topRiskThemes.map((theme, i) => (
              <span key={i} style={{
                fontSize: '11px', padding: '3px 10px', borderRadius: '6px',
                background: 'rgba(224,62,62,0.08)', border: '1px solid rgba(224,62,62,0.16)',
                color: '#e03e3e', fontWeight: '500',
              }}>
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Opt-in note */}
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        Manage benchmark participation in{' '}
        <Link href="/settings" style={{ color: '#5e6ad2', textDecoration: 'none', fontWeight: '500' }}>
          Settings &rarr; Industry Intelligence
        </Link>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ModelsPage() {
  const { data: brainRes, isLoading, mutate: refreshBrain } = useSWR('/api/brain', fetcher, {
    revalidateOnFocus: true,  // picks up brain rebuilt after closing a deal on the board
    refreshInterval: 0,
  })
  const brain = brainRes?.data
  const [selectedArchetype, setSelectedArchetype] = useState<number | null>(null)
  const { data: forecastRes } = useSWR<{ data: ForecastAccuracy }>('/api/models/forecast-accuracy', fetcher, { revalidateOnFocus: false })
  const forecastData = forecastRes?.data
  const { data: benchmarkRes } = useSWR<{ available: boolean; benchmarks?: { winRate: number; avgCycleLength: number; topRiskThemes: string[]; avgDealValue: number; poolSize: number; cachedAt: string } }>('/api/global/benchmarks', fetcher, { revalidateOnFocus: false })

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface-1)',
    border: '1px solid rgba(55,53,47,0.12)',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(55,53,47,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: '600', color: 'var(--text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ ...cardStyle, height: i === 1 ? '200px' : '160px', background: '#f7f6f3' }}>
            <div style={{ width: '60%', height: '16px', borderRadius: '8px', background: 'rgba(55,53,47,0.07)' }} />
            <div style={{ width: '40%', height: '40px', borderRadius: '8px', background: 'rgba(55,53,47,0.07)' }} />
          </div>
        ))}
      </div>
    )
  }

  const ml = brain?.mlModel
  const archetypes: { id: number; label: string; winRate: number; winningCharacteristic: string; dealCount: number; openDealIds?: string[] }[] = brain?.dealArchetypes ?? []
  const patterns: { competitor: string; winRate: number; topWinCondition: string; topLossRisk: string }[] = brain?.competitivePatterns ?? []
  const calibration: { discrimination?: number; month?: string; actualWinRate?: number; avgMlOnWins?: number }[] = brain?.calibrationTimeline ?? []
  const wl = brain?.winLossIntel
  const mlTrends = brain?.mlTrends
  const stageVel = brain?.stageVelocityIntel
  const accuracy = ml ? Math.round(ml.looAccuracy * 100) : null
  const trainingSize: number = ml?.trainingSize ?? (wl ? (wl.winCount ?? 0) + (wl.lossCount ?? 0) : 0)

  // Feature importance: top features sorted by importance
  const rawFeatures: { name: string; importance: number; direction?: string }[] = ml?.featureImportance
    ? [...ml.featureImportance].sort((a: { importance: number }, b: { importance: number }) => b.importance - a.importance).slice(0, 8)
    : []
  const maxImportance = rawFeatures[0]?.importance ?? 1

  const formattedFeatures = rawFeatures.map(f => ({
    name: f.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    pct: Math.round(f.importance * 100),
    direction: f.direction,
  }))

  // Score calibration data for benchmarks card
  const calibScore = wl?.scoreCalibration
  const highScoreWinRate = calibScore?.highScoreWinRate
  const lowScoreWinRate = calibScore ? (100 - (calibScore.highScoreWinRate ?? 50)) : null

  // Most recent closed deal
  const closedDeals = brain?.deals
    ? (brain.deals as { stage: string; name: string; company: string; lastUpdated: string }[])
        .filter((d) => d.stage === 'closed_won' || d.stage === 'closed_lost')
        .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    : []
  const totalClosed = (wl?.winCount ?? 0) + (wl?.lossCount ?? 0)
  const winPct = totalClosed > 0 ? Math.round(((wl?.winCount ?? 0) / totalClosed) * 100) : null

  // ── ML Milestone banner state ──────────────────────────────────────────────
  const [mlBannerDismissed, setMlBannerDismissed] = useState(true) // default hidden to avoid flash
  useEffect(() => {
    // Read localStorage only on the client after mount
    if (!window.localStorage.getItem('ml_milestone_dismissed')) {
      setMlBannerDismissed(false)
    }
  }, [])
  const showMlMilestoneBanner = !mlBannerDismissed
    && brain?.mlModel != null
    && totalClosed >= 10

  const dismissMlBanner = () => {
    setMlBannerDismissed(true)
    window.localStorage.setItem('ml_milestone_dismissed', '1')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '960px' }}>
      <PageTabs tabs={[
        { label: 'Overview',     href: '/intelligence', icon: Activity      },
        { label: 'Competitors',  href: '/competitors',  icon: Swords        },
        { label: 'Case Studies', href: '/case-studies', icon: BookOpen      },
        { label: 'Feature Gaps', href: '/product-gaps', icon: AlertTriangle },
        { label: 'Playbook',     href: '/playbook',     icon: TrendingUp    },
        { label: 'Models',       href: '/models',       icon: Brain         },
      ]} />

      {/* ── ML Milestone celebration banner ── */}
      {showMlMilestoneBanner && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', borderRadius: '8px', background: 'rgba(15,123,108,0.06)', border: '1px solid rgba(15,123,108,0.20)' }}>
          <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(15,123,108,0.10)', border: '1px solid rgba(15,123,108,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={18} style={{ color: '#0f7b6c' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>Your ML model is now active!</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Win probability predictions are now powered by your private data — {totalClosed} closed deals trained your model.</div>
          </div>
          <button
            onClick={dismissMlBanner}
            style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '18px', lineHeight: 1, padding: '4px', borderRadius: '6px' }}
            aria-label="Dismiss"
          >&#x2715;</button>
        </div>
      )}

      {/* ── Header ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(94,106,210,0.08)', border: '1px solid rgba(94,106,210,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={20} style={{ color: '#5e6ad2' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, margin: 0 }} className="font-brand">
              Your ML Model
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
              Nine private models training exclusively on your closed deals — gets smarter every month
            </p>
          </div>
        </div>
      </div>

      {/* ── Row 1: Prediction Accuracy + Training Health ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Prediction Accuracy */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={labelStyle}>Prediction Accuracy</div>
            <InfoButton text="This measures how well your private model predicts outcomes. It improves as you close more deals." />
          </div>
          {accuracy != null ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <AccuracyRing pct={accuracy} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }} className="font-mono">
                      <CountUp target={accuracy} suffix="%" />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>accurate</div>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Your model correctly predicts deal outcomes <strong style={{ color: 'var(--text-primary)' }}>{accuracy}%</strong> of the time on held-out deals.
                  </div>
                  {ml?.trainingSize && (
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      Trained on {ml.trainingSize} closed deals
                    </div>
                  )}
                  {ml?.usingGlobalPrior && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#2e78c6' }}>
                      <Zap size={10} /> Bayesian blend with global benchmarks active
                    </div>
                  )}
                </div>
              </div>
              {/* Calibration display */}
              {highScoreWinRate != null && (
                <div style={{ padding: '12px', background: '#f7f6f3', borderRadius: '8px', border: '1px solid rgba(55,53,47,0.09)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score Calibration</div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Deals scored <strong style={{ color: '#0f7b6c' }}>70+</strong>: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(highScoreWinRate)}%</strong> actually closed
                    </div>
                    {lowScoreWinRate != null && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Deals scored <strong style={{ color: '#e03e3e' }}>30−</strong>: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(lowScoreWinRate)}%</strong> actually closed
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', padding: '16px 8px 8px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                <Lock size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3, color: 'var(--text-tertiary)' }} />
                <div style={{ fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>Close 10+ deals to activate</div>
                <div style={{ fontSize: '11px' }}>
                  {(() => {
                    const needed = Math.max(0, 10 - trainingSize)
                    const lossesNeeded = Math.max(0, 4 - (wl?.lossCount ?? 0))
                    if (needed === 0) return 'Almost there — rebuild to activate'
                    return `Need ${needed} more closed deal${needed !== 1 ? 's' : ''}${lossesNeeded > 0 ? `, including at least ${lossesNeeded} loss${lossesNeeded !== 1 ? 'es' : ''}` : ''}`
                  })()}
                </div>
              </div>
              <MilestoneRoadmap trainingSize={trainingSize} />
            </>
          )}
        </div>

        {/* Training Data Health */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={labelStyle}>Training Data Health</div>
              <InfoButton text="The quality of your ML model depends on both win and loss data. A balanced mix produces more accurate predictions." />
            </div>
            <button
              onClick={() => refreshBrain()}
              style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
              title="Refresh model data"
            >
              ↻ Refresh
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ textAlign: 'center', flex: 1, padding: '12px', background: 'rgba(15,123,108,0.08)', border: '1px solid rgba(15,123,108,0.20)', borderRadius: '8px' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f7b6c', lineHeight: 1 }} className="font-mono">{wl?.winCount ?? 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Wins</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1, padding: '12px', background: 'rgba(224,62,62,0.08)', border: '1px solid rgba(224,62,62,0.20)', borderRadius: '8px' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#e03e3e', lineHeight: 1 }} className="font-mono">{wl?.lossCount ?? 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Losses</div>
              </div>
            </div>

            {/* Ratio warning */}
            {totalClosed > 0 && (wl?.lossCount ?? 0) === 0 && (
              <div style={{ fontSize: '11px', color: '#cb6c2c', padding: '8px 10px', background: 'rgba(203,108,44,0.08)', border: '1px solid rgba(203,108,44,0.20)', borderRadius: '8px', lineHeight: 1.5 }}>
                Your model needs loss data too. Log deals you&apos;ve lost to improve risk detection.
              </div>
            )}
            {totalClosed >= 5 && winPct != null && winPct > 80 && (wl?.lossCount ?? 0) > 0 && (
              <div style={{ fontSize: '11px', color: '#cb6c2c', padding: '8px 10px', background: 'rgba(203,108,44,0.08)', border: '1px solid rgba(203,108,44,0.20)', borderRadius: '8px', lineHeight: 1.5 }}>
                Win-heavy data ({winPct}% wins). Adding more loss examples will sharpen risk detection.
              </div>
            )}
            {totalClosed >= 5 && winPct != null && winPct < 20 && (
              <div style={{ fontSize: '11px', color: '#cb6c2c', padding: '8px 10px', background: 'rgba(203,108,44,0.08)', border: '1px solid rgba(203,108,44,0.20)', borderRadius: '8px', lineHeight: 1.5 }}>
                Loss-heavy data ({100 - winPct}% losses). Adding more wins will help the model learn success patterns.
              </div>
            )}

            {/* Progress bar with milestone markers */}
            {(() => {
              const milestones = [{ n: 10, label: 'ML' }, { n: 20, label: 'Arch' }, { n: 50, label: 'Full' }, { n: 100, label: '100' }]
              const next = milestones.find(m => totalClosed < m.n) ?? milestones[milestones.length - 1]
              const prev = milestones[milestones.indexOf(next) - 1]
              const start = prev?.n ?? 0
              const pct = next ? Math.min(100, ((totalClosed - start) / (next.n - start)) * 100) : 100
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{totalClosed} deals total</div>
                    {totalClosed < 100 && <div style={{ fontSize: '11px', color: '#5e6ad2' }}>Next: {next.label} at {next.n}</div>}
                  </div>
                  {/* Bar with milestone tick marks */}
                  <div style={{ position: 'relative', height: '8px' }}>
                    <div style={{ height: '6px', marginTop: '1px', borderRadius: '3px', background: 'rgba(55,53,47,0.09)', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #5e6ad2, #2e78c6)', borderRadius: '3px', transition: 'width 0.6s ease-out' }} />
                    </div>
                    {/* Milestone ticks at 10, 20, 50 — relative to segment */}
                    {[10, 20, 50].map(threshold => {
                      const tickPct = Math.min(100, (threshold / Math.max(next.n, threshold + 1)) * 100)
                      if (tickPct > 100) return null
                      return (
                        <div key={threshold} style={{
                          position: 'absolute', top: 0, left: `${tickPct}%`,
                          width: '1px', height: '8px', background: 'rgba(55,53,47,0.16)',
                          transform: 'translateX(-50%)',
                        }} />
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                    {milestones.map(m => (
                      <div key={m.n} style={{ fontSize: '9px', color: totalClosed >= m.n ? '#0f7b6c' : '#9b9a97', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        {totalClosed >= m.n ? <CheckCircle size={8} /> : <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1px solid rgba(55,53,47,0.16)' }} />}
                        {m.n}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Recent training data */}
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingTop: '8px', borderTop: '1px solid rgba(55,53,47,0.09)' }}>
              {closedDeals.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontWeight: '600', marginBottom: '2px' }}>Recent training data:</span>
                  {closedDeals.slice(0, 3).map((d, i) => (
                    <div key={i} style={{ paddingLeft: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{d.name || d.company}</span>
                      {d.company && d.name ? <span> ({d.company})</span> : null}
                      {' — '}
                      <span style={{ color: d.stage === 'closed_won' ? '#0f7b6c' : '#e03e3e' }}>
                        {d.stage === 'closed_won' ? 'Won' : 'Lost'}
                      </span>
                      {d.lastUpdated && (
                        <span> — {new Date(d.lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span>No closed deals yet</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: What Your Model Knows ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <div style={labelStyle}>What Your Model Knows</div>
          <InfoButton text="Nine private models run on your workspace data. Text Signals and Momentum are always active. Others unlock as you close more deals." />
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Nine models running exclusively on your pipeline data
        </div>
        <ModelGrid trainingSize={trainingSize} brainData={brain ?? null} />
      </div>

      {/* ── Row 4: Feature Importance ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={labelStyle}>Feature Importance</div>
            <InfoButton text="Which factors matter most for winning deals in YOUR pipeline. Updates automatically as more deals close." />
          </div>
          {formattedFeatures.length > 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Unique to your workspace</div>
          ) : (
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#cb6c2c', background: 'rgba(203,108,44,0.10)', border: '1px solid rgba(203,108,44,0.25)', padding: '2px 8px', borderRadius: '100px' }}>
              EXAMPLE DATA
            </span>
          )}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Which factors matter most for winning deals in YOUR pipeline
        </div>
        {formattedFeatures.length > 0 ? (
          <>
            <FeatureImportanceChart features={formattedFeatures} isPlaceholder={false} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rawFeatures.map((f: { name: string; importance: number; direction?: string }, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '180px', fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {f.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    <InfoButton text={FEATURE_TOOLTIPS[f.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())] ?? f.name} />
                  </div>
                  <BarChart
                    value={f.importance}
                    max={maxImportance}
                    color={f.direction === 'helps' ? '#0f7b6c' : '#e03e3e'}
                  />
                  <div style={{ width: '60px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: f.direction === 'helps' ? '#0f7b6c' : '#e03e3e', flexShrink: 0 }} className="font-mono">
                    {(f.importance * 100).toFixed(1)}%
                  </div>
                  <div style={{ width: '14px', flexShrink: 0 }}>
                    {f.direction === 'helps'
                      ? <TrendingUp size={12} style={{ color: '#0f7b6c' }} />
                      : <TrendingUp size={12} style={{ color: '#e03e3e', transform: 'scaleY(-1)' }} />
                    }
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingTop: '4px', borderTop: '1px solid rgba(55,53,47,0.09)' }}>
              Green = helps win. Red = associated with losses. Updates automatically as more deals close.
            </div>
          </>
        ) : (
          <>
            <FeatureImportanceChart features={PLACEHOLDER_FEATURES} isPlaceholder={true} />
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: '8px', borderTop: '1px solid rgba(55,53,47,0.09)' }}>
              Close 10+ deals to unlock your personalised feature importance rankings.
            </div>
          </>
        )}
      </div>

      {/* ── Deal Archetypes ── */}
      {archetypes.length > 0 && (
        <div style={cardStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={labelStyle}>Deal Archetypes</div>
              <InfoButton text="Natural clusters in your pipeline discovered by ML — each archetype has distinct win conditions." />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Natural clusters in your pipeline, discovered by ML — each archetype has distinct win conditions
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {archetypes.map((a) => {
              const isSelected = selectedArchetype === a.id
              const winColor = a.winRate >= 60 ? '#0f7b6c' : a.winRate >= 40 ? '#cb6c2c' : '#e03e3e'
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedArchetype(isSelected ? null : a.id)}
                  style={{
                    textAlign: 'left', padding: '16px', borderRadius: '8px', cursor: 'pointer',
                    background: isSelected ? 'rgba(94,106,210,0.06)' : '#f7f6f3',
                    border: `1px solid ${isSelected ? '#5e6ad2' : 'rgba(55,53,47,0.12)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1.3 }}>{a.label}</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: winColor, lineHeight: 1 }} className="font-mono">{a.winRate}%</div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>{a.winningCharacteristic}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'rgba(55,53,47,0.09)', padding: '2px 6px', borderRadius: '4px' }}>
                      {a.dealCount} deals
                    </span>
                    {(a.openDealIds?.length ?? 0) > 0 && (
                      <span style={{ fontSize: '10px', color: '#5e6ad2', background: 'rgba(94,106,210,0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                        {a.openDealIds?.length} active
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Per-Competitor Intelligence ── */}
      {patterns.length > 0 && (
        <div style={cardStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={labelStyle}>Competitive Intelligence</div>
              <InfoButton text="Win/loss rates and conditions derived from your actual deal history — per competitor." />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Win/loss rates and conditions derived from your actual deal history — per competitor
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(55,53,47,0.12)' }}>
            {patterns.map((p, i) => {
              const winColor = p.winRate >= 60 ? '#0f7b6c' : p.winRate >= 40 ? '#cb6c2c' : '#e03e3e'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', background: i % 2 === 1 ? 'rgba(55,53,47,0.02)' : '#ffffff', borderBottom: i < patterns.length - 1 ? '1px solid rgba(55,53,47,0.09)' : 'none' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', width: '120px', flexShrink: 0 }}>{p.competitor}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: winColor, flexShrink: 0 }} className="font-mono">{p.winRate}%</div>
                    <BarChart value={p.winRate} max={100} color={winColor} />
                  </div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', color: '#0f7b6c', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✓ {p.topWinCondition}</div>
                    <div style={{ fontSize: '11px', color: '#e03e3e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✗ {p.topLossRisk}</div>
                  </div>
                  <Link href={`/competitors`} style={{ flexShrink: 0 }}>
                    <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Score Calibration Timeline ── */}
      {calibration.length >= 2 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={labelStyle}>Score Calibration</div>
                <InfoButton text="How well the model's predictions match actual outcomes over time. As discrimination rises, the model is learning." />
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                How well the model&apos;s predictions match actual outcomes over time. As discrimination rises, the model is learning.
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '22px', fontWeight: '600', color: '#2e78c6' }} className="font-mono">
                {calibration[calibration.length - 1]?.discrimination?.toFixed(1) ?? '—'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>discrimination score</div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <CalibrationChart points={calibration} />
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {calibration.slice(-3).map((p, i: number) => (
              <div key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>{p.month}: </span>
                {p.actualWinRate?.toFixed(0)}% actual • {p.avgMlOnWins?.toFixed(0)}% predicted on wins
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Prediction Accuracy / Forecast ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={labelStyle}>Forecast Accuracy</div>
              <InfoButton text="How Halvex's deal score predictions compare to actual close outcomes. Tracked per prediction logged at close time." />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              How Halvex&apos;s deal score predictions compare to actual close outcomes.
            </div>
          </div>
          {forecastData && forecastData.totalPredictions >= 5 && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '22px', fontWeight: '600', color: forecastData.accuracy >= 0.7 ? '#0f7b6c' : forecastData.accuracy >= 0.5 ? '#cb6c2c' : '#e03e3e' }} className="font-mono">
                {Math.round(forecastData.accuracy * 100)}%
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>overall accuracy</div>
            </div>
          )}
        </div>

        {(!forecastData || forecastData.totalPredictions < 5) ? (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-tertiary)', fontSize: '13px', lineHeight: 1.6 }}>
            <Target size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3, color: 'var(--text-tertiary)' }} />
            Not enough closed deals yet to show calibration. Predictions will appear here as deals close.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ textAlign: 'center', flex: 1, padding: '12px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.09)', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }} className="font-mono">{forecastData.totalPredictions}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Predictions logged</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1, padding: '12px', background: 'rgba(15,123,108,0.08)', border: '1px solid rgba(15,123,108,0.20)', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f7b6c', lineHeight: 1 }} className="font-mono">{forecastData.correctPredictions}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Correct predictions</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px' }}>Win Rate by Score Bucket</div>
              <CalibrationBucketChart buckets={forecastData.byScoreBucket} />
            </div>

            {forecastData.recentCalibration.length >= 2 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px' }}>Monthly Calibration</div>
                <div style={{ overflowX: 'auto' }}>
                  <ForecastCalibrationChart points={forecastData.recentCalibration} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Stage Velocity ── */}
      {stageVel?.stageAlerts?.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={labelStyle}>Stage Velocity Alerts</div>
            <InfoButton text="Deals that are taking longer than your historical average to move through each stage." />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {stageVel.stageAlerts.slice(0, 5).map((a: { severity: string; company: string; stage: string; currentAgeDays: number; expectedMaxDays: number }, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: a.severity === 'critical' ? 'rgba(224,62,62,0.06)' : '#f7f6f3', border: `1px solid ${a.severity === 'critical' ? 'rgba(224,62,62,0.20)' : 'rgba(55,53,47,0.09)'}`, borderRadius: '8px' }}>
                <AlertTriangle size={14} style={{ color: a.severity === 'critical' ? '#e03e3e' : '#cb6c2c', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{a.company}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{a.stage} · {a.currentAgeDays}d (expected &lt;{a.expectedMaxDays}d)</div>
                </div>
                <Link href={`/deals`} style={{ fontSize: '11px', color: '#5e6ad2', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
                  View <ArrowUpRight size={10} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ML Trends ── */}
      {mlTrends && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={labelStyle}>ML Trends</div>
            <InfoButton text="OLS regression over your closed deal history — trend direction and velocity over recent months." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
            {mlTrends.winRate && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Win rate (recent)</div>
                <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1 }} className="font-mono">
                  {Math.round(mlTrends.winRate.recentPct)}%
                </div>
                <div style={{ fontSize: '11px', marginTop: '4px', color: mlTrends.winRate.direction === 'improving' ? '#0f7b6c' : mlTrends.winRate.direction === 'declining' ? '#e03e3e' : '#9b9a97' }}>
                  {mlTrends.winRate.direction === 'improving' ? '↑ Improving' : mlTrends.winRate.direction === 'declining' ? '↓ Declining' : '→ Stable'}
                </div>
              </div>
            )}
            {mlTrends.dealVelocity && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Avg close time</div>
                <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1 }} className="font-mono">
                  {Math.round(mlTrends.dealVelocity.recentAvgDays)}d
                </div>
                <div style={{ fontSize: '11px', marginTop: '4px', color: mlTrends.dealVelocity.direction === 'faster' ? '#0f7b6c' : mlTrends.dealVelocity.direction === 'slower' ? '#e03e3e' : '#9b9a97' }}>
                  {mlTrends.dealVelocity.direction === 'faster' ? '↑ Faster' : mlTrends.dealVelocity.direction === 'slower' ? '↓ Slower' : '→ Stable'}
                </div>
              </div>
            )}
            {mlTrends.competitorThreats?.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Rising threat</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1 }}>
                  {mlTrends.competitorThreats[0].name}
                </div>
                <div style={{ fontSize: '11px', marginTop: '4px', color: '#e03e3e' }}>
                  {Math.round(mlTrends.competitorThreats[0].recentWinRatePct)}% recent win rate
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Row 5: Industry Benchmarks ── */}
      <GlobalBenchmarksCard
        winPct={winPct}
        avgClose={wl?.avgDaysToClose ? Math.round(wl.avgDaysToClose) : null}
        avgDealValue={wl?.avgWonValue ? Math.round(wl.avgWonValue) : null}
        benchmarkRes={benchmarkRes}
      />

      {/* ── Empty state ── */}
      {!ml && !wl && archetypes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <Brain size={48} style={{ margin: '0 auto 16px', display: 'block', color: 'var(--text-tertiary)' }} />
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>Building your ML model</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 24px', lineHeight: 1.6 }}>
            As you close deals (wins AND losses), Halvex trains private ML models on your data.
            Close 10 deals to unlock predictions. Close 50 for per-competitor models.
          </p>
          <Link href="/deals?view=board" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px', background: '#37352f', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
            View Pipeline <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}
