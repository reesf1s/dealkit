'use client'

import {
  Trophy,
  UserPlus,
  FileText,
  BookOpen,
  Building2,
  X,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import type { Event, EventType } from '@/types'

interface ActivityFeedProps {
  events: Event[]
}

interface EventConfig {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>
  color: string
  bg: string
  label: (meta: Record<string, unknown>) => string
}

const EVENT_CONFIG: Partial<Record<EventType, EventConfig>> = {
  'deal_log.closed_won': {
    icon: Trophy,
    color: '#22C55E',
    bg: 'rgba(34, 197, 94, 0.12)',
    label: (m) => `Deal won: ${m.dealName ?? 'Unknown deal'}`,
  },
  'deal_log.closed_lost': {
    icon: X,
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    label: (m) => `Deal lost: ${m.dealName ?? 'Unknown deal'}`,
  },
  'deal_log.created': {
    icon: FileText,
    color: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.12)',
    label: (m) => `New deal logged: ${m.dealName ?? 'Unknown deal'}`,
  },
  'deal_log.updated': {
    icon: RefreshCw,
    color: '#888888',
    bg: 'rgba(136, 136, 136, 0.1)',
    label: (m) => `Deal updated: ${m.dealName ?? 'Unknown deal'}`,
  },
  'competitor.created': {
    icon: UserPlus,
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.12)',
    label: (m) => `Competitor added: ${m.name ?? 'Unknown'}`,
  },
  'competitor.updated': {
    icon: RefreshCw,
    color: '#888888',
    bg: 'rgba(136, 136, 136, 0.1)',
    label: (m) => `Competitor updated: ${m.name ?? 'Unknown'}`,
  },
  'competitor.deleted': {
    icon: Trash2,
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    label: () => 'Competitor deleted',
  },
  'collateral.generated': {
    icon: FileText,
    color: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.12)',
    label: (m) => `Collateral generated: ${m.title ?? m.collateralType ?? 'Unknown'}`,
  },
  'collateral.archived': {
    icon: Trash2,
    color: '#888888',
    bg: 'rgba(136, 136, 136, 0.1)',
    label: (m) => `Collateral archived: ${m.title ?? 'Unknown'}`,
  },
  'case_study.created': {
    icon: BookOpen,
    color: '#22C55E',
    bg: 'rgba(34, 197, 94, 0.12)',
    label: (m) => `Case study added: ${m.customerName ?? 'Unknown'}`,
  },
  'case_study.updated': {
    icon: RefreshCw,
    color: '#888888',
    bg: 'rgba(136, 136, 136, 0.1)',
    label: (m) => `Case study updated: ${m.customerName ?? 'Unknown'}`,
  },
  'case_study.deleted': {
    icon: Trash2,
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    label: () => 'Case study deleted',
  },
  'company_profile.updated': {
    icon: Building2,
    color: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.12)',
    label: (m) => `Company profile updated: ${m.companyName ?? ''}`,
  },
  'plan.upgraded': {
    icon: Trophy,
    color: '#22C55E',
    bg: 'rgba(34, 197, 94, 0.12)',
    label: (m) => `Plan upgraded to ${m.toPlan}`,
  },
  'plan.downgraded': {
    icon: RefreshCw,
    color: '#888888',
    bg: 'rgba(136, 136, 136, 0.1)',
    label: (m) => `Plan changed to ${m.toPlan}`,
  },
}

function fallbackConfig(): EventConfig {
  return {
    icon: FileText,
    color: '#888888',
    bg: 'rgba(136, 136, 136, 0.1)',
    label: () => 'Activity',
  }
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  const recent = events.slice(0, 10)

  if (recent.length === 0) {
    return (
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '10px',
          padding: '16px',
        }}
      >
        <p
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#EBEBEB',
            marginBottom: '16px',
            marginTop: 0,
          }}
        >
          Recent activity
        </p>
        <p style={{ fontSize: '13px', color: '#555', margin: 0, textAlign: 'center', padding: '24px 0' }}>
          No activity yet. Start by setting up your company profile.
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '10px',
        padding: '16px',
      }}
    >
      <p
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#EBEBEB',
          marginBottom: '12px',
          marginTop: 0,
        }}
      >
        Recent activity
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {recent.map((event) => {
          const config = EVENT_CONFIG[event.type] ?? fallbackConfig()
          const { icon: Icon, color, bg, label } = config
          const meta = event.metadata as Record<string, unknown>

          return (
            <div
              key={event.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px',
                borderRadius: '6px',
                transition: 'background-color 100ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={13} strokeWidth={2} style={{ color }} />
              </div>

              <span
                style={{
                  flex: 1,
                  fontSize: '13px',
                  color: '#EBEBEB',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {label(meta)}
              </span>

              <span
                style={{
                  fontSize: '11px',
                  color: '#555',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatRelativeTime(event.createdAt)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
