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
import { humanizeActivityLabel } from '@/lib/presentation'

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
    color: '#0f7b6c',
    bg: 'rgba(15, 123, 108, 0.10)',
    label: (m) => `Deal won: ${m.dealName ?? 'Unknown deal'}`,
  },
  'deal_log.closed_lost': {
    icon: X,
    color: '#e03e3e',
    bg: 'rgba(224, 62, 62, 0.10)',
    label: (m) => `Deal lost: ${m.dealName ?? 'Unknown deal'}`,
  },
  'deal_log.created': {
    icon: FileText,
    color: '#5e6ad2',
    bg: 'rgba(94, 106, 210, 0.10)',
    label: (m) => `New deal logged: ${m.dealName ?? 'Unknown deal'}`,
  },
  'deal_log.updated': {
    icon: RefreshCw,
    color: '#787774',
    bg: 'rgba(55, 53, 47, 0.06)',
    label: (m) => `Deal updated: ${m.dealName ?? 'Unknown deal'}`,
  },
  'competitor.created': {
    icon: UserPlus,
    color: '#cb6c2c',
    bg: 'rgba(203, 108, 44, 0.10)',
    label: (m) => `Competitor added: ${m.name ?? 'Unknown'}`,
  },
  'competitor.updated': {
    icon: RefreshCw,
    color: '#787774',
    bg: 'rgba(55, 53, 47, 0.06)',
    label: (m) => `Competitor updated: ${m.name ?? 'Unknown'}`,
  },
  'competitor.deleted': {
    icon: Trash2,
    color: '#e03e3e',
    bg: 'rgba(224, 62, 62, 0.10)',
    label: () => 'Competitor deleted',
  },
  'collateral.generated': {
    icon: FileText,
    color: '#5e6ad2',
    bg: 'rgba(94, 106, 210, 0.10)',
    label: (m) => `Collateral generated: ${m.title ?? m.collateralType ?? 'Unknown'}`,
  },
  'collateral.archived': {
    icon: Trash2,
    color: '#787774',
    bg: 'rgba(55, 53, 47, 0.06)',
    label: (m) => `Collateral archived: ${m.title ?? 'Unknown'}`,
  },
  'case_study.created': {
    icon: BookOpen,
    color: '#0f7b6c',
    bg: 'rgba(15, 123, 108, 0.10)',
    label: (m) => `Case study added: ${m.customerName ?? 'Unknown'}`,
  },
  'case_study.updated': {
    icon: RefreshCw,
    color: '#787774',
    bg: 'rgba(55, 53, 47, 0.06)',
    label: (m) => `Case study updated: ${m.customerName ?? 'Unknown'}`,
  },
  'case_study.deleted': {
    icon: Trash2,
    color: '#e03e3e',
    bg: 'rgba(224, 62, 62, 0.10)',
    label: () => 'Case study deleted',
  },
  'company_profile.updated': {
    icon: Building2,
    color: '#5e6ad2',
    bg: 'rgba(94, 106, 210, 0.10)',
    label: (m) => `Company profile updated: ${m.companyName ?? ''}`,
  },
  'plan.upgraded': {
    icon: Trophy,
    color: '#0f7b6c',
    bg: 'rgba(15, 123, 108, 0.10)',
    label: (m) => `Plan upgraded to ${m.toPlan}`,
  },
  'plan.downgraded': {
    icon: RefreshCw,
    color: '#787774',
    bg: 'rgba(55, 53, 47, 0.06)',
    label: (m) => `Plan changed to ${m.toPlan}`,
  },
}

function fallbackConfig(): EventConfig {
  return {
    icon: FileText,
    color: '#787774',
    bg: 'rgba(55, 53, 47, 0.06)',
    label: (meta) => humanizeActivityLabel(String(meta.type ?? 'activity'), meta),
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
          background: 'var(--surface-1)',
          border: '1px solid rgba(55,53,47,0.09)',
          borderRadius: '10px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(55,53,47,0.06)',
        }}
      >
        <p
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#37352f',
            marginBottom: '16px',
            marginTop: 0,
          }}
        >
          Recent activity
        </p>
        <p style={{ fontSize: '13px', color: '#9b9a97', margin: 0, textAlign: 'center', padding: '24px 0' }}>
          No activity yet. Start by setting up your company profile.
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid rgba(55,53,47,0.09)',
        borderRadius: '10px',
        padding: '16px',
        boxShadow: '0 1px 3px rgba(55,53,47,0.06)',
      }}
    >
      <p
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#37352f',
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
          const meta = { ...(event.metadata as Record<string, unknown>), type: event.type }

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
                e.currentTarget.style.backgroundColor = '#f7f6f3'
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
                  color: '#37352f',
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
                  color: '#9b9a97',
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
