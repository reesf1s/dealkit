'use client'

import type { CollateralType } from '@/types'

interface CollateralTypeBadgeProps {
  type: CollateralType
  customTypeName?: string | null
}

const TYPE_CONFIG: Partial<Record<CollateralType, { label: string; color: string; bg: string }>> = {
  battlecard: {
    label: 'Battlecard',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.12)',
  },
  case_study_doc: {
    label: 'Case Study',
    color: '#22C55E',
    bg: 'rgba(34, 197, 94, 0.12)',
  },
  one_pager: {
    label: 'One-Pager',
    color: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.12)',
  },
  objection_handler: {
    label: 'Objection Handler',
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.12)',
  },
  talk_track: {
    label: 'Talk Track',
    color: '#06B6D4',
    bg: 'rgba(6, 182, 212, 0.12)',
  },
  email_sequence: {
    label: 'Email Sequence',
    color: '#8B5CF6',
    bg: 'rgba(139, 92, 246, 0.12)',
  },
}

export function CollateralTypeBadge({ type, customTypeName }: CollateralTypeBadgeProps) {
  const config = type === 'custom'
    ? { label: customTypeName || 'Custom', color: '#C4B5FD', bg: 'rgba(196, 181, 253, 0.12)' }
    : (TYPE_CONFIG[type] ?? { label: type, color: '#888888', bg: 'rgba(136, 136, 136, 0.12)' })

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: '20px',
        padding: '0 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        color: config.color,
        backgroundColor: config.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {config.label}
    </span>
  )
}
