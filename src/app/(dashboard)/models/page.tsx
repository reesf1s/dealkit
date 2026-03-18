'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Brain, TrendingUp, Target, Zap, Star, BarChart3, Award, AlertTriangle, CheckCircle, Clock, ArrowUpRight, ChevronRight } from 'lucide-react'

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

// ── Calibration bucket chart (horizontal bars) ────────────────────────────────
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
              {/* Count bar (light background) */}
              <div style={{ position: 'absolute', inset: 0, width: `${barPct}%`, background: 'color-mix(in srgb, var(--accent) 20%, transparent)', transition: 'width 0.6s ease-out' }} />
              {/* Actual win rate fill */}
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
        {/* Baseline */}
        <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke="var(--border)" strokeWidth="1" />
        {/* Predicted score line (dashed) */}
        <path d={toPath(predictedYs)} fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Actual win rate line (solid accent) */}
        <path d={toPath(actualYs)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xs[i]} cy={predictedYs[i]} r="3" fill="var(--card-bg)" stroke="var(--text-tertiary)" strokeWidth="1.5" />
            <circle cx={xs[i]} cy={actualYs[i]} r="3" fill="var(--accent)" />
          </g>
        ))}
        {/* Month labels — show first, middle, last */}
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
function CalibrationChart({ points }: { points: any[] }) {
  if (!points?.length) return null
  const h = 80, w = 280, pad = 12
  const maxDisc = Math.max(...points.map((p: any) => Math.abs(p.discrimination ?? 0)), 20)
  const pts = points.map((p: any, i: number) => ({
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

export default function ModelsPage() {
  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data
  const [selectedArchetype, setSelectedArchetype] = useState<number | null>(null)
  const { data: forecastRes } = useSWR<{ data: ForecastAccuracy }>('/api/models/forecast-accuracy', fetcher, { revalidateOnFocus: false })
  const forecastData = forecastRes?.data

  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '16px',
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
        {[1,2,3].map(i => (
          <div key={i} style={{ ...cardStyle, height: '160px', background: 'var(--skeleton-from)' }}>
            <div style={{ width: '60%', height: '16px', borderRadius: '8px', background: 'var(--skeleton-mid)' }} />
            <div style={{ width: '40%', height: '40px', borderRadius: '8px', background: 'var(--skeleton-mid)' }} />
          </div>
        ))}
      </div>
    )
  }

  const ml = brain?.mlModel
  const archetypes: any[] = brain?.dealArchetypes ?? []
  const patterns: any[] = brain?.competitivePatterns ?? []
  const calibration: any[] = brain?.calibrationTimeline ?? []
  const wl = brain?.winLossIntel
  const mlTrends = brain?.mlTrends
  const stageVel = brain?.stageVelocityIntel
  const accuracy = ml ? Math.round(ml.looAccuracy * 100) : null

  // Feature importance: top features sorted by importance
  const features: any[] = ml?.featureImportance
    ? [...ml.featureImportance].sort((a: any, b: any) => b.importance - a.importance).slice(0, 8)
    : []
  const maxImportance = features[0]?.importance ?? 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '960px' }}>

      {/* ── Header ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-subtle)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.1 }} className="text-display">
              Your ML Model
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Private models trained exclusively on your closed deals — gets smarter every month
            </p>
          </div>
        </div>
      </div>

      {/* ── Row 1: Model Accuracy + Training Health ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Accuracy Ring */}
        <div style={cardStyle}>
          <div style={labelStyle}>Prediction Accuracy</div>
          {accuracy != null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <AccuracyRing pct={accuracy} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }} className="font-mono">{accuracy}%</div>
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
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              <Brain size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
              Close 10+ deals to activate your private ML model
            </div>
          )}
        </div>

        {/* Training Health */}
        <div style={cardStyle}>
          <div style={labelStyle}>Training Data Health</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ textAlign: 'center', flex: 1, padding: '12px', background: 'color-mix(in srgb, var(--success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)', borderRadius: '10px' }}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--success)', lineHeight: 1 }} className="font-mono">{wl?.winCount ?? 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Wins</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1, padding: '12px', background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)', borderRadius: '10px' }}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--danger)', lineHeight: 1 }} className="font-mono">{wl?.lossCount ?? 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Losses</div>
              </div>
            </div>
            {/* Milestone progress */}
            {(() => {
              const total = (wl?.winCount ?? 0) + (wl?.lossCount ?? 0)
              const milestones = [{ n: 10, label: 'ML unlocks' }, { n: 20, label: 'Playbook' }, { n: 50, label: 'Per-competitor models' }, { n: 100, label: 'Full calibration' }]
              const next = milestones.find(m => total < m.n) ?? milestones[milestones.length - 1]
              const prev = milestones[milestones.indexOf(next) - 1]
              const start = prev?.n ?? 0
              const pct = next ? Math.min(100, ((total - start) / (next.n - start)) * 100) : 100
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{total} deals total</div>
                    {total < 100 && <div style={{ fontSize: '11px', color: 'var(--accent)' }}>Next: {next.label} at {next.n}</div>}
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent), var(--data-accent))', borderRadius: '3px', transition: 'width 0.6s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    {milestones.map(m => (
                      <div key={m.n} style={{ fontSize: '9px', color: total >= m.n ? 'var(--success)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        {total >= m.n ? <CheckCircle size={8} /> : <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1px solid var(--border)' }} />}
                        {m.n}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ── Feature Importance ── */}
      {features.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={labelStyle}>Feature Importance</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Which factors matter most for winning deals in YOUR pipeline
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Unique to your workspace</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {features.map((f: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '180px', fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', flexShrink: 0 }}>
                  {f.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
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
                  {f.direction === 'helps' ? <TrendingUp size={12} style={{ color: 'var(--success)' }} /> : <TrendingUp size={12} style={{ color: 'var(--danger)', transform: 'scaleY(-1)' }} />}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
            Green = helps win. Red = associated with losses. Updates automatically as more deals close.
          </div>
        </div>
      )}

      {/* ── Deal Archetypes ── */}
      {archetypes.length > 0 && (
        <div style={cardStyle}>
          <div>
            <div style={labelStyle}>Deal Archetypes</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Natural clusters in your pipeline, discovered by ML — each archetype has distinct win conditions
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {archetypes.map((a: any) => {
              const isSelected = selectedArchetype === a.id
              const winColor = a.winRate >= 60 ? 'var(--success)' : a.winRate >= 40 ? 'var(--warning)' : 'var(--danger)'
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedArchetype(isSelected ? null : a.id)}
                  style={{
                    textAlign: 'left', padding: '16px', borderRadius: '12px', cursor: 'pointer',
                    background: isSelected ? 'var(--accent-subtle)' : 'var(--surface)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1.3 }}>{a.label}</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: winColor, lineHeight: 1 }} className="font-mono">{a.winRate}%</div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>{a.winningCharacteristic}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--border)', padding: '2px 6px', borderRadius: '4px' }}>
                      {a.dealCount} deals
                    </span>
                    {a.openDealIds?.length > 0 && (
                      <span style={{ fontSize: '10px', color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '2px 6px', borderRadius: '4px' }}>
                        {a.openDealIds.length} active
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
            <div style={labelStyle}>Competitive Intelligence</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Win/loss rates and conditions derived from your actual deal history — per competitor
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            {patterns.map((p: any, i: number) => {
              const winColor = p.winRate >= 60 ? 'var(--success)' : p.winRate >= 40 ? 'var(--warning)' : 'var(--danger)'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', background: 'var(--card-bg)', borderBottom: i < patterns.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', width: '120px', flexShrink: 0 }}>{p.competitor}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: winColor, flexShrink: 0 }} className="font-mono">{p.winRate}%</div>
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
              <div style={labelStyle}>Score Calibration</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                How well the model&apos;s predictions match actual outcomes over time. As discrimination rises, the model is learning.
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--data-accent)' }} className="font-mono">
                {calibration[calibration.length - 1]?.discrimination?.toFixed(1) ?? '—'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>discrimination score</div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <CalibrationChart points={calibration} />
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {calibration.slice(-3).map((p: any, i: number) => (
              <div key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>{p.month}: </span>
                {p.actualWinRate?.toFixed(0)}% actual • {p.avgMlOnWins?.toFixed(0)}% predicted on wins
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Prediction Accuracy ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={labelStyle}>Prediction Accuracy</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              How SellSight&apos;s deal score predictions compare to actual close outcomes.
            </div>
          </div>
          {forecastData && forecastData.totalPredictions >= 5 && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: forecastData.accuracy >= 0.7 ? 'var(--success)' : forecastData.accuracy >= 0.5 ? 'var(--warning)' : 'var(--danger)' }} className="font-mono">
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
            {/* Summary stats */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ textAlign: 'center', flex: 1, padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }} className="font-mono">{forecastData.totalPredictions}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Predictions logged</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1, padding: '12px', background: 'color-mix(in srgb, var(--success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)', borderRadius: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--success)', lineHeight: 1 }} className="font-mono">{forecastData.correctPredictions}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Correct predictions</div>
              </div>
            </div>

            {/* Score bucket chart */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '10px' }}>Win Rate by Score Bucket</div>
              <CalibrationBucketChart buckets={forecastData.byScoreBucket} />
            </div>

            {/* Monthly calibration line chart */}
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
          <div style={labelStyle}>Stage Velocity Alerts</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {stageVel.stageAlerts.slice(0, 5).map((a: any, i: number) => (
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

      {/* ── Pipeline Trends ── */}
      {mlTrends && (
        <div style={cardStyle}>
          <div style={labelStyle}>ML Trends</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
            {mlTrends.winRate && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Win rate (recent)</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }} className="font-mono">
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
                <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }} className="font-mono">
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
                <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }}>
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

      {/* ── Empty state ── */}
      {!ml && !wl && archetypes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <Brain size={48} style={{ margin: '0 auto 16px', display: 'block', color: 'var(--text-tertiary)' }} />
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Building your ML model</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 24px', lineHeight: 1.6 }}>
            As you close deals (wins AND losses), SellSight trains private ML models on your data.
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
