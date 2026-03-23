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
  iconColor: string
  iconBg: string
  sub?: string
}

function StatCard({ label, value, icon: Icon, iconColor, iconBg, sub }: StatCardProps) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          backgroundColor: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={15} strokeWidth={2} style={{ color: iconColor }} />
      </div>

      <div>
        <div
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#EBEBEB',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: '12px', color: '#888888', marginTop: '4px' }}>{label}</div>
        {sub && (
          <div
            style={{
              fontSize: '11px',
              color: '#555',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '12px',
      }}
    >
      <StatCard
        label="Competitors tracked"
        value={String(totalCompetitors)}
        icon={Users}
        iconColor="#F59E0B"
        iconBg="rgba(245, 158, 11, 0.12)"
      />
      <StatCard
        label="Case studies"
        value={String(totalCaseStudies)}
        icon={BookOpen}
        iconColor="#22C55E"
        iconBg="rgba(34, 197, 94, 0.12)"
      />
      <StatCard
        label="Deals logged"
        value={String(totalDeals)}
        icon={FileText}
        iconColor="#6366F1"
        iconBg="rgba(99, 102, 241, 0.12)"
      />
      <StatCard
        label="Win rate"
        value={winRate !== null ? `${Math.round(winRate)}%` : '—'}
        icon={TrendingUp}
        iconColor="#22C55E"
        iconBg="rgba(34, 197, 94, 0.12)"
        sub={totalDeals > 0 ? `${totalDeals} deals total` : undefined}
      />
      <StatCard
        label="Top objection"
        value={topObjection ? '1 flagged' : '—'}
        icon={MessageSquare}
        iconColor="#EF4444"
        iconBg="rgba(239, 68, 68, 0.12)"
        sub={topObjection ?? undefined}
      />
    </div>
  )
}
