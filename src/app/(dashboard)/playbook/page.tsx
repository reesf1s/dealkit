'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  BookOpen, TrendingUp, TrendingDown, Target, AlertTriangle,
  ArrowUpRight, Users, Clock, Award, Lock, Info,
  CheckCircle, BarChart3, Zap, Shield, ChevronRight, Swords, Brain,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { PageTabs } from '@/components/shared/PageTabs'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-zinc-300 shadow-xl">
          {text}
        </div>
      )}
    </span>
  )
}

// ── AnimatedBar ───────────────────────────────────────────────────────────────
function AnimatedBar({ pct, color = 'var(--accent)', height = 6 }: { pct: number; color?: string; height?: number }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 80)
    return () => clearTimeout(t)
  }, [pct])
  return (
    <div style={{ width: '100%', height, borderRadius: 100, background: 'var(--border)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${width}%`, background: color, borderRadius: 100, transition: 'width 0.1s ease' }} />
    </div>
  )
}

// ── ProgressBar (empty state) ─────────────────────────────────────────────────
function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, (current / total) * 100)
  return <AnimatedBar pct={pct} color="var(--accent)" height={8} />
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({
  icon, title, subtitle, tooltip, children
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  tooltip?: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--glass-card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--glass-card-border)', borderRadius: '12px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', borderBottom: '1px solid var(--glass-card-border)' }}>
        <div style={{ color: 'var(--accent)' }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</h2>
            {tooltip && (
              <Tooltip text={tooltip}>
                <span style={{ cursor: 'help', color: 'var(--text-tertiary)' }}>
                  <Info size={13} />
                </span>
              </Tooltip>
            )}
          </div>
          {subtitle && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

// ── FactorRow ─────────────────────────────────────────────────────────────────
function FactorRow({ rank, label, value, direction, detail, importance }: {
  rank: number
  label: string
  value?: string | number
  direction: 'positive' | 'negative' | 'neutral'
  detail?: string
  importance?: number
}) {
  const rankColor = rank <= 2 ? 'var(--accent)' : 'var(--text-tertiary)'
  const lineColor = direction === 'positive' ? 'var(--success)' : direction === 'negative' ? 'var(--danger)' : 'var(--text-secondary)'
  const barColor = direction === 'positive' ? 'var(--success)' : direction === 'negative' ? 'var(--danger)' : 'var(--text-secondary)'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', background: 'var(--glass-card-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid var(--glass-card-border)', borderRadius: '10px' }}>
      <div style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '6px', background: `color-mix(in srgb, ${rankColor} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${rankColor} 25%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: rankColor }}>
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{label}</div>
          {value != null && (
            <span style={{ fontSize: '11px', fontWeight: '600', color: lineColor, background: `color-mix(in srgb, ${lineColor} 10%, transparent)`, padding: '2px 7px', borderRadius: '100px' }}>
              {typeof value === 'number' ? `${value}%` : value}
            </span>
          )}
        </div>
        {importance != null && (
          <div style={{ marginBottom: '6px' }}>
            <AnimatedBar pct={Math.min(100, importance * 100 * 5)} color={barColor} height={4} />
          </div>
        )}
        {detail && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{detail}</div>}
      </div>
    </div>
  )
}

// ── LockedCard ────────────────────────────────────────────────────────────────
function LockedCard({ title, description, unlockText, iconColor, bgTint }: {
  title: string
  description: string
  unlockText: string
  iconColor: string
  bgTint: string
}) {
  return (
    <div style={{
      padding: '20px',
      borderRadius: '12px',
      border: '1px solid var(--glass-card-border)',
      background: 'var(--glass-card-bg)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{title}</div>
        <Lock size={15} style={{ color: iconColor, flexShrink: 0, marginTop: '1px', opacity: 0.7 }} />
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{description}</div>
      <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
        <span style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: iconColor, opacity: 0.8 }}>
          {unlockText}
        </span>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ height: '80px', borderRadius: '8px', background: 'var(--skeleton-from)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ height: '20px', width: '40%', borderRadius: '6px', background: 'var(--skeleton-from)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: '80px', borderRadius: '10px', background: 'var(--skeleton-from)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      ))}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
interface RecentDeal { name: string; company: string; stage: string; lastUpdated: string }

function EmptyState({ totalDeals, winCount, lossCount, recentDeals }: { totalDeals: number; winCount: number; lossCount: number; recentDeals: RecentDeal[] }) {
  const needed = Math.max(0, 10 - totalDeals)
  // For a balanced model we want at least 4 wins and 3 losses out of 10
  const winsNeeded = Math.max(0, 4 - winCount)
  const lossesNeeded = Math.max(0, 3 - lossCount)
  const requireParts: string[] = []
  if (winsNeeded > 0) requireParts.push(`at least ${winsNeeded} win${winsNeeded !== 1 ? 's' : ''}`)
  if (lossesNeeded > 0) requireParts.push(`${lossesNeeded} loss${lossesNeeded !== 1 ? 'es' : ''}`)
  const thresholdMsg = needed > 0
    ? `Need ${needed} more${requireParts.length > 0 ? `, including ${requireParts.join(' and ')}` : ''}.`
    : 'Almost there — rebuild the brain to activate.'

  // Build the encouraging first-deal message
  const firstDeal = recentDeals[0]
  const hasFirstDeal = totalDeals >= 1 && firstDeal

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '800px' }}>
      <PageTabs tabs={[
        { label: 'Overview',     href: '/intelligence', icon: Brain         },
        { label: 'Competitors',  href: '/competitors',  icon: Swords        },
        { label: 'Case Studies', href: '/case-studies', icon: BookOpen      },
        { label: 'Feature Gaps', href: '/product-gaps', icon: AlertTriangle },
        { label: 'Playbook',     href: '/playbook',     icon: TrendingUp    },
        { label: 'Models',       href: '/models',       icon: Brain         },
      ]} />
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '500', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 1.1 }} className="font-brand">
              Your Win Playbook
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Your personalised playbook auto-generates from your closed deal history.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '20px', borderRadius: '8px', background: 'var(--card-bg)', border: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Building your playbook...</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent)' }} className="font-mono">{totalDeals} / 10</span>
          </div>
          <ProgressBar current={totalDeals} total={10} />
          {hasFirstDeal ? (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.6 }}>
              {totalDeals === 1 ? (
                <span>Your first closed deal (<strong style={{ color: 'var(--text-primary)' }}>{firstDeal.name || firstDeal.company}</strong> — {firstDeal.stage === 'closed_won' ? 'won' : 'lost'}) is now training data. Every deal you close — won or lost — makes your playbook smarter.</span>
              ) : (
                <span>Most recent: <strong style={{ color: 'var(--text-primary)' }}>{firstDeal.name || firstDeal.company}</strong> — {firstDeal.stage === 'closed_won' ? 'won' : 'lost'}. Every deal you close — won or lost — makes your playbook smarter.</span>
              )}
              <br />
              <span>{thresholdMsg}</span>
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              {thresholdMsg}
            </p>
          )}
        </div>
      </div>

      {/* What's coming */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
          WHAT YOUR PLAYBOOK WILL CONTAIN:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <LockedCard
            title="Your Winning Formula"
            description="The top 5 factors that predict a won deal in YOUR pipeline."
            unlockText="Unlocks at 10 deals"
            iconColor="rgb(99,102,241)"
            bgTint="rgba(79,70,229,0.05)"
          />
          <LockedCard
            title="Your Losing Pattern"
            description="The top 5 signals that predict a lost deal. Know what to watch for early."
            unlockText="Unlocks at 10 deals"
            iconColor="rgb(220,38,38)"
            bgTint="rgba(220,38,38,0.05)"
          />
          <LockedCard
            title="Per-Competitor Playbook"
            description="What conditions you win under vs each rival. Specific to YOUR data."
            unlockText="Unlocks at 20 deals"
            iconColor="rgb(217,119,6)"
            bgTint="rgba(217,119,6,0.05)"
          />
          <LockedCard
            title="Objection Effectiveness"
            description="Which objections your team handles well and which kill deals. With champion lift analysis."
            unlockText="Unlocks at 10 deals"
            iconColor="rgb(5,150,105)"
            bgTint="rgba(5,150,105,0.05)"
          />
          <LockedCard
            title="Optimal Deal Velocity"
            description="The ideal pace for deal progression based on your wins. Benchmarks per stage."
            unlockText="Unlocks at 20 deals"
            iconColor="rgb(14,165,233)"
            bgTint="rgba(14,165,233,0.05)"
          />
          <LockedCard
            title="Forecast Calibration"
            description="How accurate your ML predictions are, with monthly tracking."
            unlockText="Unlocks at 30 deals"
            iconColor="rgb(139,92,246)"
            bgTint="rgba(139,92,246,0.05)"
          />
        </div>
      </div>

      {/* Encouragement */}
      <div style={{ padding: '20px', borderRadius: '8px', background: 'color-mix(in srgb, var(--accent) 5%, transparent)', border: 'none' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
          Every deal you close — won or lost — makes your playbook more accurate. The fastest way to build it: paste meeting notes for your existing deals, then mark them as won or lost.
        </p>
        <Link
          href="/pipeline"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '10px', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}
        >
          Log a closed deal <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PlaybookPage() {
  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data

  if (isLoading) return <Skeleton />

  const wl = brain?.winLossIntel
  const ml = brain?.mlModel
  const patterns: any[] = brain?.competitivePatterns ?? []
  const archetypes: any[] = brain?.dealArchetypes ?? []
  const objectionMap: any[] = brain?.objectionWinMap ?? []
  const objectionConditional: any[] = brain?.objectionConditionalWins ?? []
  const stageVel = brain?.stageVelocityIntel
  const mlTrends = brain?.mlTrends
  const calibrationTimeline: any[] = brain?.calibrationTimeline ?? []

  // Feature importance — the "winning formula"
  const features: any[] = ml?.featureImportance
    ? [...ml.featureImportance].sort((a: any, b: any) => b.importance - a.importance)
    : []
  const winFactors = features.filter((f: any) => f.direction === 'helps').slice(0, 5)
  const lossFactors = features.filter((f: any) => f.direction === 'hurts').slice(0, 5)

  const totalDeals = (wl?.winCount ?? 0) + (wl?.lossCount ?? 0)
  const hasEnoughData = totalDeals >= 10 || winFactors.length > 0

  // Recent closed deals for empty state messaging
  const recentClosedDeals: RecentDeal[] = brain?.deals
    ? (brain.deals as { stage: string; name: string; company: string; lastUpdated: string }[])
        .filter((d) => d.stage === 'closed_won' || d.stage === 'closed_lost')
        .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
        .slice(0, 3)
    : []

  if (!hasEnoughData) {
    return <EmptyState totalDeals={totalDeals} winCount={wl?.winCount ?? 0} lossCount={wl?.lossCount ?? 0} recentDeals={recentClosedDeals} />
  }

  // Calibration data
  const latestCalibration = calibrationTimeline.length > 0
    ? calibrationTimeline[calibrationTimeline.length - 1]
    : null
  const highScoreWinRate = wl?.scoreCalibration?.highScoreWinRate

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', maxWidth: '800px' }}>

      {/* ── Header ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'color-mix(in srgb, var(--success) 12%, transparent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={20} style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '500', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 1.1 }} className="font-brand">
              Win Playbook
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Auto-generated from {totalDeals} closed deals · {wl?.winRate ?? 0}% win rate · Updates automatically
            </p>
          </div>
        </div>
      </div>

      {/* ── Win Stats Strip ── */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {[
          { label: 'Win rate', value: `${wl?.winRate ?? 0}%`, color: 'var(--success)' },
          { label: 'Avg close time', value: wl?.avgDaysToClose ? `${Math.round(wl.avgDaysToClose)} days` : '—', color: 'var(--data-accent)' },
          { label: 'Avg won value', value: wl?.avgWonValue ? formatCurrency(Math.round(wl.avgWonValue)) : '—', color: 'var(--accent)' },
          { label: 'Closed deals', value: String(totalDeals), color: 'var(--text-secondary)' },
        ].map(s => (
          <div key={s.label} style={{ padding: '12px 16px', background: 'var(--glass-card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--glass-card-border)', borderRadius: '12px', minWidth: '110px' }}>
            <div style={{ fontSize: '20px', fontWeight: '600', color: s.color, lineHeight: 1 }} className="font-mono">{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Winning Formula ── */}
      {winFactors.length > 0 && (
        <Section
          icon={<TrendingUp size={18} style={{ color: 'var(--success)' }} />}
          title="Your Winning Formula"
          subtitle="Top signals that predict a won deal in your pipeline, ranked by ML feature importance"
          tooltip="These factors were identified by training a logistic regression model on your closed deal history. Higher weight = stronger predictor of winning."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {winFactors.map((f: any, i: number) => {
              const pct = (f.importance * 100).toFixed(1)
              const label = f.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
              return (
                <FactorRow
                  key={i}
                  rank={i + 1}
                  label={label}
                  value={`${pct}%`}
                  direction="positive"
                  detail={`${i + 1}. ${label} (${pct}%) — When present, this factor strongly predicts a win.`}
                  importance={f.importance}
                />
              )
            })}
          </div>
        </Section>
      )}

      {/* ── Loss Pattern ── */}
      {lossFactors.length > 0 && (
        <Section
          icon={<TrendingDown size={18} style={{ color: 'var(--danger)' }} />}
          title="Your Losing Pattern"
          subtitle="Signals that most consistently predict a lost deal — watch for these as early warning signs"
          tooltip="These are the factors that, when present, increase the probability of losing. Use them as an early warning checklist on active deals."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lossFactors.map((f: any, i: number) => {
              const pct = (f.importance * 100).toFixed(1)
              const label = f.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
              return (
                <FactorRow
                  key={i}
                  rank={i + 1}
                  label={label}
                  value={`${pct}%`}
                  direction="negative"
                  detail={`${i + 1}. ${label} (${pct}%) — When present, this factor increases loss probability.`}
                  importance={f.importance}
                />
              )
            })}
          </div>
          {wl?.topLossReasons && wl.topLossReasons.length > 0 && (
            <div style={{ padding: '14px 16px', background: 'color-mix(in srgb, var(--danger) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--danger)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top loss reasons from your deals</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {wl.topLossReasons.slice(0, 6).map((r: string, i: number) => (
                  <span key={i} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '100px', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)' }}>
                    {String(r)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── Per-Competitor Playbook ── */}
      <Section
        icon={<Target size={18} style={{ color: 'rgb(217,119,6)' }} />}
        title="Per-Competitor Playbook"
        subtitle="Conditions under which you win or lose against each competitor — derived from your closed deals"
        tooltip="Each competitor card is built from your historical win/loss data when that competitor was mentioned. The larger the sample, the more reliable the patterns."
      >
        {patterns.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {patterns.map((p: any, i: number) => {
              const winColor = p.winRate >= 60 ? 'var(--success)' : p.winRate >= 40 ? 'var(--warning)' : 'var(--danger)'
              const winConditions: string[] = p.winConditions ?? (p.topWinCondition ? [p.topWinCondition] : [])
              const lossConditions: string[] = p.lossConditions ?? (p.topLossRisk ? [p.topLossRisk] : [])
              return (
                <div key={i} style={{ padding: '16px', background: 'var(--glass-card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--glass-card-border)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>vs {p.competitor}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{p.totalDeals} deals</div>
                      <div style={{ fontSize: '22px', fontWeight: '700', color: winColor }} className="font-mono">{p.winRate}%</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ padding: '10px 12px', background: 'color-mix(in srgb, var(--success) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 15%, transparent)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>You win when</div>
                      {winConditions.length > 0 ? (
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {winConditions.slice(0, 3).map((c, ci) => (
                            <li key={ci} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', gap: '5px' }}>
                              <span style={{ color: 'var(--success)', flexShrink: 0 }}>·</span> {String(c)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>More data needed</div>
                      )}
                    </div>
                    <div style={{ padding: '10px 12px', background: 'color-mix(in srgb, var(--danger) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>You lose when</div>
                      {lossConditions.length > 0 ? (
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {lossConditions.slice(0, 3).map((c, ci) => (
                            <li key={ci} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', gap: '5px' }}>
                              <span style={{ color: 'var(--danger)', flexShrink: 0 }}>·</span> {String(c)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>More data needed</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{ textAlign: 'right' }}>
              <Link href="/competitors" style={{ fontSize: '12px', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                View full competitive intel <ArrowUpRight size={11} />
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', background: 'var(--surface)', border: 'none', borderRadius: '10px' }}>
            <Target size={24} style={{ color: 'var(--text-tertiary)', margin: '0 auto 8px', display: 'block' }} />
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Mention competitors in your meeting notes to start tracking. E.g. "We&apos;re competing against Salesforce on this one."
            </p>
          </div>
        )}
      </Section>

      {/* ── Objection Effectiveness ── */}
      <Section
        icon={<Shield size={18} style={{ color: 'var(--success)' }} />}
        title="Objection Effectiveness"
        subtitle="Risk themes your team encounters — showing win rate and champion lift per objection type"
        tooltip="Win rate shows how often you close deals when this objection arises. Champion lift shows the extra win rate boost from having an internal champion when facing this objection."
      >
        {objectionMap.length > 0 ? (
          <div style={{ borderRadius: '10px', border: 'none', overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px', gap: '0', padding: '8px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Objection theme</div>
              <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Frequency</div>
              <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Win rate</div>
              <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Champion lift</div>
            </div>
            {[...objectionMap]
              .sort((a: any, b: any) => (b.dealsWithTheme ?? b.count ?? 0) - (a.dealsWithTheme ?? a.count ?? 0))
              .slice(0, 8)
              .map((o: any, i: number, arr: any[]) => {
                const winRate = o.winRateWithTheme ?? o.winRate ?? 0
                const winColor = winRate >= 60 ? 'var(--success)' : winRate >= 40 ? 'var(--warning)' : 'var(--danger)'
                const freq = o.dealsWithTheme ?? o.count ?? o.dealCount ?? '—'
                // Look up champion lift from objectionConditionalWins
                const conditional = objectionConditional.find((c: any) => c.theme === o.theme)
                const champLift = conditional?.championLiftAvg
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px', gap: '0', padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{String(o.theme ?? o.risk ?? o.objection ?? `Objection ${i + 1}`)}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'right' }} className="font-mono">{freq} deals</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: winColor, textAlign: 'right' }} className="font-mono">{winRate}%</div>
                    <div style={{ fontSize: '13px', color: champLift != null ? (champLift > 0 ? 'var(--success)' : 'var(--text-tertiary)') : 'var(--text-tertiary)', textAlign: 'right', fontWeight: champLift != null && champLift > 0 ? '700' : '400' }} className="font-mono">
                      {champLift != null ? `+${Math.round(champLift)}%` : '—'}
                    </div>
                  </div>
                )
              })}
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', background: 'var(--surface)', border: 'none', borderRadius: '10px' }}>
            <Shield size={24} style={{ color: 'var(--text-tertiary)', margin: '0 auto 8px', display: 'block' }} />
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              No objection data yet. Risk themes extracted from your meeting notes will appear here once enough deals are closed.
            </p>
          </div>
        )}
      </Section>

      {/* ── Deal Archetypes ── */}
      {archetypes.length > 0 && (
        <Section
          icon={<Award size={18} />}
          title="Deal Archetypes"
          subtitle="Natural deal patterns discovered by ML — each type has distinct close velocity and win conditions"
          tooltip="These clusters were identified by grouping your closed deals by similar characteristics. Understanding which archetype a deal belongs to helps predict outcome."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {archetypes.sort((a: any, b: any) => b.winRate - a.winRate).map((a: any, i: number) => {
              const winColor = a.winRate >= 60 ? 'var(--success)' : a.winRate >= 40 ? 'var(--warning)' : 'var(--danger)'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '14px 16px', background: 'var(--surface)', border: 'none', borderRadius: '10px' }}>
                  <div style={{ flexShrink: 0, width: '48px', height: '48px', borderRadius: '10px', background: `color-mix(in srgb, ${winColor} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${winColor} 20%, transparent)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: winColor, lineHeight: 1 }} className="font-mono">{a.winRate}%</div>
                    <div style={{ fontSize: '9px', color: winColor, marginTop: '1px' }}>win</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{a.label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{String(a.winningCharacteristic)}</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--border)', padding: '2px 7px', borderRadius: '4px' }}>{a.dealCount} closed deals</span>
                      {a.openDealIds?.length > 0 && <span style={{ fontSize: '10px', color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '2px 7px', borderRadius: '4px' }}>{a.openDealIds.length} active</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* ── Optimal Velocity ── */}
      {(stageVel || mlTrends?.dealVelocity) && (
        <Section
          icon={<Clock size={18} style={{ color: 'rgb(14,165,233)' }} />}
          title="Optimal Deal Velocity"
          subtitle="Stage-by-stage timing benchmarks derived from your won deals"
          tooltip="Based on your historical wins, these are the pacing benchmarks for each stage. Deals that move faster than the benchmark have higher win rates."
        >
          <div style={{ padding: '16px 20px', background: 'var(--card-bg)', border: 'none', borderRadius: '8px' }}>
            {stageVel && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {mlTrends?.dealVelocity && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Median days to close</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Based on your win history</div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--data-accent)' }} className="font-mono">
                      {Math.round(stageVel.medianDaysToClose ?? mlTrends.dealVelocity.recentAvgDays)} days
                    </div>
                  </div>
                )}
                {/* Stage breakdown if available */}
                {stageVel.stageStats && stageVel.stageStats.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Per-stage benchmarks</div>
                    {stageVel.stageStats.map((s: any, i: number) => {
                      const isOver = s.currentAgeDays > s.p75GapDays
                      const statusColor = isOver ? 'var(--warning)' : 'var(--success)'
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: 'var(--surface)', border: 'none', borderRadius: '8px' }}>
                          <ChevronRight size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                          <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{s.stage}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            optimal <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{s.p50GapDays}–{s.p75GapDays} days</span>
                          </div>
                          {isOver ? (
                            <AlertTriangle size={13} style={{ color: statusColor, flexShrink: 0 }} />
                          ) : (
                            <CheckCircle size={13} style={{ color: statusColor, flexShrink: 0 }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {stageVel.stageAlerts?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Deals currently outside the optimal window:</div>
                    {stageVel.stageAlerts.slice(0, 3).map((a: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                        <AlertTriangle size={12} style={{ color: a.severity === 'critical' ? 'var(--danger)' : 'var(--warning)', flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)' }}>{a.company}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{a.stage} · {a.currentAgeDays}d / {a.expectedMaxDays}d max</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Forecast Calibration ── */}
      <Section
        icon={<BarChart3 size={18} style={{ color: 'rgb(139,92,246)' }} />}
        title="Forecast Calibration"
        subtitle="How well your ML win predictions match actual outcomes over time"
        tooltip="Calibration measures whether deals scored at 70%+ actually close 70% of the time. A well-calibrated model gives you reliable pipeline forecasts."
      >
        {(highScoreWinRate != null || latestCalibration != null) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {highScoreWinRate != null && (
              <div style={{ padding: '16px 20px', background: 'var(--card-bg)', border: 'none', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Deals scored 70%+ that actually closed</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>High-confidence prediction accuracy</div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: highScoreWinRate >= 60 ? 'var(--success)' : highScoreWinRate >= 40 ? 'var(--warning)' : 'var(--danger)' }} className="font-mono">
                    {Math.round(highScoreWinRate)}%
                  </div>
                </div>
                <AnimatedBar pct={highScoreWinRate} color={highScoreWinRate >= 60 ? 'var(--success)' : highScoreWinRate >= 40 ? 'var(--warning)' : 'var(--danger)'} />
              </div>
            )}
            {wl?.scoreCalibration && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {wl.scoreCalibration.avgScoreOnWins != null && (
                  <div style={{ padding: '12px 14px', background: 'color-mix(in srgb, var(--success) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 15%, transparent)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Avg score on wins</div>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--success)' }} className="font-mono">{Math.round(wl.scoreCalibration.avgScoreOnWins)}%</div>
                  </div>
                )}
                {wl.scoreCalibration.avgScoreOnLosses != null && (
                  <div style={{ padding: '12px 14px', background: 'color-mix(in srgb, var(--danger) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Avg score on losses</div>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--danger)' }} className="font-mono">{Math.round(wl.scoreCalibration.avgScoreOnLosses)}%</div>
                  </div>
                )}
              </div>
            )}
            {calibrationTimeline.length > 0 && (
              <div style={{ padding: '14px 16px', background: 'var(--surface)', border: 'none', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Monthly calibration history</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {calibrationTimeline.slice(-6).map((c: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', width: '56px', flexShrink: 0 }}>{c.month ?? c.date ?? `Month ${i + 1}`}</div>
                      <div style={{ flex: 1 }}>
                        <AnimatedBar
                          pct={c.aucRoc != null ? c.aucRoc * 100 : (c.accuracy ?? 0)}
                          color="rgb(139,92,246)"
                          height={5}
                        />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', width: '40px', textAlign: 'right', flexShrink: 0 }} className="font-mono">
                        {c.aucRoc != null ? `${(c.aucRoc * 100).toFixed(0)}%` : (c.accuracy != null ? `${c.accuracy}%` : '—')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', background: 'var(--surface)', border: 'none', borderRadius: '10px' }}>
            <BarChart3 size={24} style={{ color: 'var(--text-tertiary)', margin: '0 auto 8px', display: 'block' }} />
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Calibration data will appear after more deals close. It tracks how accurately the ML model scores deals over time.
            </p>
          </div>
        )}
      </Section>

    </div>
  )
}
