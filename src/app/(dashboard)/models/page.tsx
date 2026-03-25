'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Brain, TrendingUp, Target, Zap, Star, BarChart3, Award, AlertTriangle,
  CheckCircle, Clock, ArrowUpRight, ChevronRight, Lock, Info, Activity,
  Database, Cpu, Shield, GitBranch, Users, Swords, BookOpen,
} from 'lucide-react'
import { PageTabs } from '@/components/shared/PageTabs'

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

const fetcher = (url: string) => fetch(url).then(r => r.json())

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
          background: '#18181b', border: '1px solid #3f3f46',
          padding: '8px 12px', fontSize: '12px', color: '#d4d4d8',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
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
function BarChart({ value, max, color = 'var(--accent)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.6s ease-out' }} />
    </div>
  )
}

// ── Accuracy ring ─────────────────────────────────────────────────────────────
function AccuracyRing({ pct }: { pct: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const color = pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
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
        <div style={{ position: 'absolute', left: '16px', right: '16px', height: '2px', background: 'var(--border)', top: '16px' }} />
        {/* Progress fill */}
        <div style={{
          position: 'absolute', left: '16px', height: '2px',
          background: 'var(--success)', top: '16px',
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
                  background: isPast ? 'var(--success)' : 'var(--card-bg)',
                  border: `2px solid ${isPast ? 'var(--success)' : isCurrent ? 'var(--accent)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.1s ease',
                  flexShrink: 0,
                }}>
                  {isPast && idx > 0
                    ? <CheckCircle size={14} style={{ color: '#fff' }} />
                    : idx === 0
                      ? <span style={{ fontSize: '10px', fontWeight: '600', color: trainingSize >= 10 ? '#fff' : 'var(--accent)' }}>{trainingSize}</span>
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
              borderRadius: '10px',
              background: isCurrent ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : isPast ? 'color-mix(in srgb, var(--success) 6%, transparent)' : 'var(--surface)',
              border: `1px solid ${isCurrent ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : isPast ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'var(--border)'}`,
              opacity: (!isCurrent && !isPast) ? 0.6 : 1,
            }}>
              <div style={{ fontSize: '10px', fontWeight: '600', color: isCurrent ? 'var(--accent)' : isPast ? 'var(--success)' : 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                {m.label}
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
                {m.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {m.bullets.map((b, bi) => (
                  <div key={bi} style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <span style={{ color: isCurrent ? 'var(--accent)' : isPast ? 'var(--success)' : 'var(--text-tertiary)', marginTop: '1px' }}>•</span>
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
        const dotColor = status === 'active' ? 'var(--success)' : status === 'warming' ? 'var(--warning)' : 'var(--border)'
        const statusText = status === 'active' ? 'Active' : status === 'warming' ? 'Warming Up' : `Locked`
        const statusColor = status === 'active' ? 'var(--success)' : status === 'warming' ? 'var(--warning)' : 'var(--text-tertiary)'
        return (
          <div key={i} style={{
            padding: '14px',
            borderRadius: '12px',
            background: 'var(--glass-card-bg)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid var(--glass-card-border)`,
            opacity: status === 'locked' ? 0.65 : 1,
            transition: 'opacity 0.1s ease',
            boxShadow: status === 'active'
              ? '0 0 16px var(--glass-glow-success, rgba(60,203,127,0.12))'
              : status === 'warming'
                ? '0 0 16px var(--glass-glow-warning, rgba(245,158,11,0.08))'
                : 'var(--glow-grey, 0 0 8px rgba(255,255,255,0.02))',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ color: status === 'active' ? 'var(--accent)' : 'var(--text-tertiary)' }}>
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
        <div style={{ fontSize: '11px', color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)', borderRadius: '6px', padding: '6px 10px', marginBottom: '4px' }}>
          Example — unlocks with your data at 10+ closed deals
        </div>
      )}
      {features.map((f, i) => {
        const tooltip = FEATURE_TOOLTIPS[f.name] ?? f.name
        const barWidth = mounted ? Math.min(100, f.pct) : 0
        const isPositive = f.direction !== 'negative'
        const barColor = isPlaceholder
          ? 'rgba(255,255,255,0.25)'
          : isPositive ? '#34d399' : '#f87171'
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '160px', fontSize: '12px', fontWeight: '500', color: isPlaceholder ? 'var(--text-secondary)' : 'var(--text-primary)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {f.name}
              <InfoButton text={tooltip} />
            </div>
            <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${barWidth}%`,
                background: barColor,
                borderRadius: '4px',
                transition: 'width 0.6s ease-out',
              }} />
            </div>
            <div style={{ width: '40px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: isPlaceholder ? 'var(--text-secondary)' : barColor, flexShrink: 0, fontFamily: 'var(--font-mono, monospace)' }}>
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
            <div style={{ flex: 1, position: 'relative', height: '20px', borderRadius: '4px', background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${barPct}%`, background: 'color-mix(in srgb, var(--accent) 20%, transparent)', transition: 'width 0.6s ease-out' }} />
              <div style={{ position: 'absolute', inset: 0, width: `${wonPct}%`, background: b.predicted > 0 ? 'var(--accent)' : 'transparent', opacity: 0.9, transition: 'width 0.6s ease-out' }} />
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
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
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
        <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke="var(--border)" strokeWidth="1" />
        <path d={toPath(predictedYs)} fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={toPath(actualYs)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xs[i]} cy={predictedYs[i]} r="3" fill="var(--card-bg)" stroke="var(--text-tertiary)" strokeWidth="1.5" />
            <circle cx={xs[i]} cy={actualYs[i]} r="3" fill="var(--accent)" />
          </g>
        ))}
        {[0, Math.floor((points.length - 1) / 2), points.length - 1]
          .filter((idx, pos, arr) => arr.indexOf(idx) === pos && idx < points.length)
          .map(idx => (
            <text key={idx} x={xs[idx]} y={h} textAnchor="middle" fontSize="9" fill="var(--text-tertiary)">
              {points[idx].month}
            </text>
          ))}
      </svg>
      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <div style={{ width: '20px', height: '2px', background: 'var(--text-tertiary)', borderTop: '2px dashed var(--text-tertiary)' }} />
          Avg predicted score
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <div style={{ width: '20px', height: '2px', background: 'var(--accent)' }} />
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
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--border)" strokeWidth="1" />
      <path d={pathD} fill="none" stroke="var(--data-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={p.val >= 0 ? 'var(--success)' : 'var(--danger)'} />
      ))}
    </svg>
  )
}

// ── Global Benchmarks Card ────────────────────────────────────────────────────
function GlobalBenchmarksCard({ winRate, avgClose, mlAccuracy }: { winRate: number | null; avgClose: number | null; mlAccuracy: number | null }) {
  const [showMsg, setShowMsg] = useState(false)

  return (
    <div style={{
      background: 'var(--card-bg)', border: 'none',
      borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Global Benchmarks
          </div>
          <InfoButton text="Compare your performance to similar B2B companies — opt in to contribute anonymous deal outcomes" />
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 8px' }}>
          Coming soon
        </div>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '520px' }}>
        Contribute anonymous deal outcomes to the global model. In return, see how your performance compares to similar companies. Your data is anonymised — no deal names, companies, or notes are shared.
      </div>
      {/* Blurred preview metrics */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {[
          { label: 'Your win rate', yours: winRate != null ? `${winRate}%` : '--%', benchmark: '52%' },
          { label: 'Avg close time', yours: avgClose != null ? `${avgClose} days` : '-- days', benchmark: '45 days' },
          { label: 'Model accuracy', yours: mlAccuracy != null ? `${mlAccuracy}%` : '--%', benchmark: '61%' },
        ].map((m, i) => (
          <div key={i} style={{
            flex: 1, minWidth: '140px', padding: '12px', borderRadius: '10px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>{m.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>{m.yours}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>vs</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)', filter: 'blur(4px)', userSelect: 'none' }}>{m.benchmark}</span>
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Benchmark: opt in to reveal</div>
          </div>
        ))}
      </div>
      <div>
        {showMsg ? (
          <div style={{ fontSize: '12px', color: 'var(--warning)', padding: '8px 12px', background: 'color-mix(in srgb, var(--warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)', borderRadius: '8px' }}>
            Coming soon — benchmarking will be available once global data accumulates.
          </div>
        ) : (
          <button
            onClick={() => setShowMsg(true)}
            style={{
              padding: '8px 18px', borderRadius: '8px',
              background: 'var(--accent-subtle)', border: '1px solid var(--accent)',
              color: 'var(--accent)', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            Enable Benchmarks
          </button>
        )}
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

  const cardStyle: React.CSSProperties = {
    background: 'var(--glass-card-bg)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--glass-card-border)',
    borderRadius: '12px',
    padding: '24px',
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
          <div key={i} style={{ ...cardStyle, height: i === 1 ? '200px' : '160px', background: 'var(--skeleton-from)' }}>
            <div style={{ width: '60%', height: '16px', borderRadius: '8px', background: 'var(--skeleton-mid)' }} />
            <div style={{ width: '40%', height: '40px', borderRadius: '8px', background: 'var(--skeleton-mid)' }} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, color-mix(in srgb, var(--success) 10%, transparent) 0%, color-mix(in srgb, var(--accent) 8%, transparent) 100%)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)' }}>
          <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '10px', background: 'color-mix(in srgb, var(--success) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={18} style={{ color: 'var(--success)' }} />
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
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--accent-subtle)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '500', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 1.1 }} className="font-brand">
              Your ML Model
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>
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
                    Your model correctly predicts deal outcomes <strong>{accuracy}%</strong> of the time on held-out deals.
                  </div>
                  {ml?.trainingSize && (
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      Trained on {ml.trainingSize} closed deals
                    </div>
                  )}
                  {ml?.usingGlobalPrior && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--data-accent)' }}>
                      <Zap size={10} /> Bayesian blend with global benchmarks active
                    </div>
                  )}
                </div>
              </div>
              {/* Calibration display */}
              {highScoreWinRate != null && (
                <div style={{ padding: '12px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score Calibration</div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Deals scored <strong style={{ color: 'var(--success)' }}>70+</strong>: <strong>{Math.round(highScoreWinRate)}%</strong> actually closed
                    </div>
                    {lowScoreWinRate != null && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Deals scored <strong style={{ color: 'var(--danger)' }}>30−</strong>: <strong>{Math.round(lowScoreWinRate)}%</strong> actually closed
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', padding: '16px 8px 8px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                <Lock size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
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
              <div style={{ textAlign: 'center', flex: 1, padding: '12px', background: 'color-mix(in srgb, var(--success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)', borderRadius: '10px' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--success)', lineHeight: 1 }} className="font-mono">{wl?.winCount ?? 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Wins</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1, padding: '12px', background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)', borderRadius: '10px' }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--danger)', lineHeight: 1 }} className="font-mono">{wl?.lossCount ?? 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Losses</div>
              </div>
            </div>

            {/* Ratio warning */}
            {totalClosed > 0 && (wl?.lossCount ?? 0) === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--warning)', padding: '8px 10px', background: 'color-mix(in srgb, var(--warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)', borderRadius: '8px', lineHeight: 1.5 }}>
                Your model needs loss data too. Log deals you&apos;ve lost to improve risk detection.
              </div>
            )}
            {totalClosed >= 5 && winPct != null && winPct > 80 && (wl?.lossCount ?? 0) > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--warning)', padding: '8px 10px', background: 'color-mix(in srgb, var(--warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)', borderRadius: '8px', lineHeight: 1.5 }}>
                Win-heavy data ({winPct}% wins). Adding more loss examples will sharpen risk detection.
              </div>
            )}
            {totalClosed >= 5 && winPct != null && winPct < 20 && (
              <div style={{ fontSize: '11px', color: 'var(--warning)', padding: '8px 10px', background: 'color-mix(in srgb, var(--warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)', borderRadius: '8px', lineHeight: 1.5 }}>
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
                    {totalClosed < 100 && <div style={{ fontSize: '11px', color: 'var(--accent)' }}>Next: {next.label} at {next.n}</div>}
                  </div>
                  {/* Bar with milestone tick marks */}
                  <div style={{ position: 'relative', height: '8px' }}>
                    <div style={{ height: '6px', marginTop: '1px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent), var(--data-accent))', borderRadius: '3px', transition: 'width 0.6s ease-out' }} />
                    </div>
                    {/* Milestone ticks at 10, 20, 50 — relative to segment */}
                    {[10, 20, 50].map(threshold => {
                      const tickPct = Math.min(100, (threshold / Math.max(next.n, threshold + 1)) * 100)
                      if (tickPct > 100) return null
                      return (
                        <div key={threshold} style={{
                          position: 'absolute', top: 0, left: `${tickPct}%`,
                          width: '1px', height: '8px', background: 'var(--border)',
                          transform: 'translateX(-50%)',
                        }} />
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                    {milestones.map(m => (
                      <div key={m.n} style={{ fontSize: '9px', color: totalClosed >= m.n ? 'var(--success)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        {totalClosed >= m.n ? <CheckCircle size={8} /> : <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1px solid var(--border)' }} />}
                        {m.n}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Recent training data */}
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
              {closedDeals.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontWeight: '600', marginBottom: '2px' }}>Recent training data:</span>
                  {closedDeals.slice(0, 3).map((d, i) => (
                    <div key={i} style={{ paddingLeft: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{d.name || d.company}</span>
                      {d.company && d.name ? <span> ({d.company})</span> : null}
                      {' — '}
                      <span style={{ color: d.stage === 'closed_won' ? 'var(--success)' : 'var(--danger)' }}>
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
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#D97706', background: 'rgba(217,119,6,0.10)', border: '1px solid rgba(217,119,6,0.25)', padding: '2px 8px', borderRadius: '100px' }}>
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
                    color={f.direction === 'helps' ? 'var(--success)' : 'var(--danger)'}
                  />
                  <div style={{ width: '60px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: f.direction === 'helps' ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }} className="font-mono">
                    {(f.importance * 100).toFixed(1)}%
                  </div>
                  <div style={{ width: '14px', flexShrink: 0 }}>
                    {f.direction === 'helps'
                      ? <TrendingUp size={12} style={{ color: 'var(--success)' }} />
                      : <TrendingUp size={12} style={{ color: 'var(--danger)', transform: 'scaleY(-1)' }} />
                    }
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
              Green = helps win. Red = associated with losses. Updates automatically as more deals close.
            </div>
          </>
        ) : (
          <>
            <FeatureImportanceChart features={PLACEHOLDER_FEATURES} isPlaceholder={true} />
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
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
              const winColor = a.winRate >= 60 ? 'var(--success)' : a.winRate >= 40 ? 'var(--warning)' : 'var(--danger)'
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedArchetype(isSelected ? null : a.id)}
                  style={{
                    textAlign: 'left', padding: '16px', borderRadius: '8px', cursor: 'pointer',
                    background: isSelected ? 'var(--accent-subtle)' : 'var(--surface)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1.3 }}>{a.label}</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: winColor, lineHeight: 1 }} className="font-mono">{a.winRate}%</div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>{a.winningCharacteristic}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--border)', padding: '2px 6px', borderRadius: '4px' }}>
                      {a.dealCount} deals
                    </span>
                    {(a.openDealIds?.length ?? 0) > 0 && (
                      <span style={{ fontSize: '10px', color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '2px 6px', borderRadius: '4px' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            {patterns.map((p, i) => {
              const winColor = p.winRate >= 60 ? 'var(--success)' : p.winRate >= 40 ? 'var(--warning)' : 'var(--danger)'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', background: 'var(--card-bg)', borderBottom: i < patterns.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', width: '120px', flexShrink: 0 }}>{p.competitor}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: winColor, flexShrink: 0 }} className="font-mono">{p.winRate}%</div>
                    <BarChart value={p.winRate} max={100} color={winColor} />
                  </div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', color: 'var(--success)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✓ {p.topWinCondition}</div>
                    <div style={{ fontSize: '11px', color: 'var(--danger)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✗ {p.topLossRisk}</div>
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
              <div style={{ fontSize: '22px', fontWeight: '600', color: 'var(--data-accent)' }} className="font-mono">
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
              <div style={{ fontSize: '22px', fontWeight: '600', color: forecastData.accuracy >= 0.7 ? 'var(--success)' : forecastData.accuracy >= 0.5 ? 'var(--warning)' : 'var(--danger)' }} className="font-mono">
                {Math.round(forecastData.accuracy * 100)}%
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>overall accuracy</div>
            </div>
          )}
        </div>

        {(!forecastData || forecastData.totalPredictions < 5) ? (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-tertiary)', fontSize: '13px', lineHeight: 1.6 }}>
            <Target size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3 }} />
            Not enough closed deals yet to show calibration. Predictions will appear here as deals close.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ textAlign: 'center', flex: 1, padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }} className="font-mono">{forecastData.totalPredictions}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Predictions logged</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1, padding: '12px', background: 'color-mix(in srgb, var(--success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)', borderRadius: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--success)', lineHeight: 1 }} className="font-mono">{forecastData.correctPredictions}</div>
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
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: a.severity === 'critical' ? 'color-mix(in srgb, var(--danger) 6%, transparent)' : 'var(--surface)', border: `1px solid ${a.severity === 'critical' ? 'color-mix(in srgb, var(--danger) 20%, transparent)' : 'var(--border)'}`, borderRadius: '8px' }}>
                <AlertTriangle size={14} style={{ color: a.severity === 'critical' ? 'var(--danger)' : 'var(--warning)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{a.company}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{a.stage} · {a.currentAgeDays}d (expected &lt;{a.expectedMaxDays}d)</div>
                </div>
                <Link href={`/deals`} style={{ fontSize: '11px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
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
                <div style={{ fontSize: '11px', marginTop: '4px', color: mlTrends.winRate.direction === 'improving' ? 'var(--success)' : mlTrends.winRate.direction === 'declining' ? 'var(--danger)' : 'var(--text-tertiary)' }}>
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
                <div style={{ fontSize: '11px', marginTop: '4px', color: mlTrends.dealVelocity.direction === 'faster' ? 'var(--success)' : mlTrends.dealVelocity.direction === 'slower' ? 'var(--danger)' : 'var(--text-tertiary)' }}>
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
                <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--danger)' }}>
                  {Math.round(mlTrends.competitorThreats[0].recentWinRatePct)}% recent win rate
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Row 5: Global Benchmarks ── */}
      <GlobalBenchmarksCard
        winRate={wl?.winRate ?? null}
        avgClose={wl?.avgDaysToClose ? Math.round(wl.avgDaysToClose) : null}
        mlAccuracy={accuracy}
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
          <Link href="/pipeline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '10px', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
            View Pipeline <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}
