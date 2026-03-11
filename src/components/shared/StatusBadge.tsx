export type BadgeStatus = 'ready' | 'stale' | 'generating' | 'archived' | 'won' | 'lost'

interface StatusConfig {
  label: string
  color: string
  bg: string
  dot?: boolean
}

const STATUS_CONFIG: Record<BadgeStatus, StatusConfig> = {
  ready: {
    label: 'Ready',
    color: '#22C55E',
    bg: 'rgba(34, 197, 94, 0.15)',
  },
  stale: {
    label: 'Stale',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.15)',
  },
  generating: {
    label: 'Generating',
    color: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.15)',
  },
  archived: {
    label: 'Archived',
    color: '#888888',
    bg: 'rgba(136, 136, 136, 0.15)',
  },
  won: {
    label: 'Won',
    color: '#22C55E',
    bg: 'rgba(34, 197, 94, 0.15)',
  },
  lost: {
    label: 'Lost',
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.15)',
  },
}

interface StatusBadgeProps {
  status: BadgeStatus
  className?: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        height: '20px',
        padding: '0 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 500,
        letterSpacing: '0.02em',
        fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
        color: config.color,
        backgroundColor: config.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {/* Dot indicator */}
      <span
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          backgroundColor: config.color,
          flexShrink: 0,
          ...(status === 'generating' && {
            animation: 'skeleton-pulse 1.5s ease-in-out infinite',
          }),
        }}
      />
      {config.label}
    </span>
  )
}
