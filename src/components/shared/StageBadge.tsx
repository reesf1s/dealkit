'use client'

/**
 * StageBadge — pill badge for deal stages.
 * Uses the HALVEX stage colour tokens.
 */

interface StageConfig {
  bg: string
  text: string
  label: string
}

const STAGE_MAP: Record<string, StageConfig> = {
  lead:         { bg: '#f3f4f6', text: '#555555', label: 'Lead' },
  prospecting:  { bg: '#f3f4f6', text: '#555555', label: 'Prospecting' },
  qualified:    { bg: '#dbeafe', text: '#1d4ed8', label: 'Qualified' },
  qualification:{ bg: '#dbeafe', text: '#1d4ed8', label: 'Qualification' },
  discovery:    { bg: '#ede9fe', text: '#5b21b6', label: 'Discovery' },
  proposal:     { bg: '#fef3c7', text: '#92400e', label: 'Proposal' },
  negotiation:  { bg: '#d1fae5', text: '#065f46', label: 'Negotiation' },
  closed_won:   { bg: '#d1fae5', text: '#065f46', label: 'Won' },
  closed_lost:  { bg: '#fee2e2', text: '#991b1b', label: 'Lost' },
}

interface StageBadgeProps {
  stage: string
}

export function StageBadge({ stage }: StageBadgeProps) {
  const config = STAGE_MAP[stage] ?? { bg: '#f3f4f6', text: '#555555', label: stage }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3.5px 11px',
        borderRadius: 99,
        fontSize: 11.5,
        fontWeight: 500,
        background: config.bg,
        color: config.text,
        whiteSpace: 'nowrap',
        lineHeight: 1.3,
      }}
    >
      {config.label}
    </span>
  )
}
