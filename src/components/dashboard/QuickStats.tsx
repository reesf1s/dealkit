'use client'

import { Users, BookOpen, FileText, TrendingUp, MessageSquare } from 'lucide-react'

interface QuickStatsProps {
  stats: {
    totalCompetitors: number
    totalCaseStudies: number
    totalDeals: number
    winRate: number | null
    topObjection: string | null
  }
}

interface StatCardProps {
  label: string
  value: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>
  accentColor: string
  accentRgb: string
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
}

function StatCard({ label, value, icon: Icon, accentColor, accentRgb, sub, trend }: StatCardProps) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, rgba(${accentRgb}, 0.06) 0%, var(--surface-1) 100%)`,
        border: `1px solid rgba(${accentRgb}, 0.14)`,
        borderRadius: '12px',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(-1px)'
        el.style.borderColor = `rgba(${accentRgb}, 0.28)`
        el.style.boxShadow = `0 4px 12px rgba(${accentRgb}, 0.12), 0 1px 3px rgba(55,53,47,0.06)`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(0)'
        el.style.borderColor = `rgba(${accentRgb}, 0.14)`
        el.style.boxShadow = 'none'
      }}
    >
      {/* Subtle top-right glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '80px', height: '80px',
        background: `radial-gradient(circle at top right, rgba(${accentRgb}, 0.10) 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Icon */}
      <div style={{
        width: '34px', height: '34px', borderRadius: '9px',
        background: `rgba(${accentRgb}, 0.12)`,
        border: `1px solid rgba(${accentRgb}, 0.20)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={15} strokeWidth={2} style={{ color: accentColor }} />
      </div>

      {/* Number + label */}
      <div>
        <div style={{
          fontSize: '26px',
          fontWeight: 700,
          color: '#37352f',
          letterSpacing: '-0.04em',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          marginBottom: '5px',
        }}>
          {value}
        </div>
        <div style={{
          fontSize: '11.5px',
          color: '#9b9a97',
          fontWeight: 400,
          letterSpacing: '-0.01em',
        }}>
          {label}
        </div>
        {sub && (
          <div style={{
            fontSize: '11px',
            color: `rgba(${accentRgb}, 0.70)`,
            marginTop: '5px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 500,
          }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}

export function QuickStats({ stats }: QuickStatsProps) {
  const { totalCompetitors, totalCaseStudies, totalDeals, winRate, topObjection } = stats

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: '10px',
    }}>
      <StatCard
        label="Competitors tracked"
        value={String(totalCompetitors)}
        icon={Users}
        accentColor="#cb6c2c"
        accentRgb="203,108,44"
      />
      <StatCard
        label="Case studies"
        value={String(totalCaseStudies)}
        icon={BookOpen}
        accentColor="#0f7b6c"
        accentRgb="15,123,108"
      />
      <StatCard
        label="Deals logged"
        value={String(totalDeals)}
        icon={FileText}
        accentColor="#5e6ad2"
        accentRgb="94,106,210"
      />
      <StatCard
        label="Win rate"
        value={winRate !== null ? `${Math.round(winRate)}%` : '—'}
        icon={TrendingUp}
        accentColor="#0f7b6c"
        accentRgb="15,123,108"
        sub={totalDeals > 0 ? `${totalDeals} deals total` : undefined}
      />
      <StatCard
        label="Top objection"
        value={topObjection ? '1 flagged' : '—'}
        icon={MessageSquare}
        accentColor="#e03e3e"
        accentRgb="224,62,62"
        sub={topObjection ?? undefined}
      />
    </div>
  )
}
