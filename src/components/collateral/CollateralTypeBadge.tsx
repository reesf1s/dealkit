'use client'

import type { CollateralType } from '@/types'

interface CollateralTypeBadgeProps {
  type: CollateralType
  customTypeName?: string | null
}

const TYPE_CONFIG: Partial<Record<CollateralType, { label: string; color: string; bg: string }>> = {
  battlecard: {
    label: 'Battlecard',
    color: '#cb6c2c',
    bg: 'rgba(203, 108, 44, 0.08)',
  },
  case_study_doc: {
    label: 'Case Study',
    color: '#0f7b6c',
    bg: 'rgba(15, 123, 108, 0.08)',
  },
  one_pager: {
    label: 'One-Pager',
    color: 'var(--brand)',
    bg: 'rgba(94, 106, 210, 0.08)',
  },
  objection_handler: {
    label: 'Objection Handler',
    color: '#e03e3e',
    bg: 'rgba(224, 62, 62, 0.08)',
  },
  talk_track: {
    label: 'Talk Track',
    color: '#2e78c6',
    bg: 'rgba(46, 120, 198, 0.08)',
  },
  email_sequence: {
    label: 'Email Sequence',
    color: 'var(--brand)',
    bg: 'rgba(94, 106, 210, 0.08)',
  },
}

export function CollateralTypeBadge({ type, customTypeName }: CollateralTypeBadgeProps) {
  const config = type === 'custom'
    ? { label: customTypeName || 'Custom', color: '#787774', bg: 'rgba(55, 53, 47, 0.06)' }
    : (TYPE_CONFIG[type] ?? { label: type, color: '#787774', bg: 'rgba(55, 53, 47, 0.06)' })

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
