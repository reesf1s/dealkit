'use client'

/**
 * HealthDot — 7px solid circle with soft glow halo.
 * health: 'green' | 'amber' | 'red' | 'grey'
 */

const COLORS: Record<string, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  red:   '#ef4444',
  grey:  '#aaaaaa',
}

interface HealthDotProps {
  health: 'green' | 'amber' | 'red' | 'grey'
  size?: number
}

export function HealthDot({ health, size = 7 }: HealthDotProps) {
  const color = COLORS[health] ?? COLORS.grey

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        boxShadow: `0 0 0 2.5px ${color}22`,
      }}
      title={health}
    />
  )
}
