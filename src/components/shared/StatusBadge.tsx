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
    color: '#0f7b6c',
    bg: 'rgba(15, 123, 108, 0.08)',
  },
  stale: {
    label: 'Stale',
    color: '#cb6c2c',
    bg: 'rgba(203, 108, 44, 0.08)',
  },
  generating: {
    label: 'Generating',
    color: '#1DB86A',
    bg: 'rgba(29, 184, 106, 0.08)',
  },
  archived: {
    label: 'Archived',
    color: '#787774',
    bg: '#f5f5f5',
  },
  won: {
    label: 'Won',
    color: '#0f7b6c',
    bg: 'rgba(15, 123, 108, 0.08)',
  },
  lost: {
    label: 'Lost',
    color: '#e03e3e',
    bg: 'rgba(224, 62, 62, 0.08)',
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
