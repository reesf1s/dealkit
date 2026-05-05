'use client'

/**
 * GradientAvatar — deterministic gradient circle from initials.
 * Hash the initials string → pick one of 8 gradient pairs.
 */

const GRADIENT_PAIRS = [
  ['#8b5cf6', '#6d28d9'],  // purple/violet
  ['#f97316', '#dc2626'],  // orange/red
  ['#ef4444', '#fb7185'],  // red/rose
  ['#22c55e', '#10b981'],  // green/emerald
  ['#3b82f6', 'var(--brand)'],  // blue/indigo
  ['#eab308', '#f59e0b'],  // yellow/amber
  ['#14b8a6', '#06b6d4'],  // teal/cyan
  ['#ec4899', '#d946ef'],  // pink/fuchsia
]

function hashInitials(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface GradientAvatarProps {
  name: string
  size?: number
  fontSize?: number
}

export function GradientAvatar({ name, size = 34, fontSize }: GradientAvatarProps) {
  const initials = getInitials(name || '?')
  const idx = hashInitials(initials) % GRADIENT_PAIRS.length
  const [from, to] = GRADIENT_PAIRS[idx]
  const fSize = fontSize ?? Math.round(size * 0.35)

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${from}, ${to})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <span
        style={{
          fontSize: fSize,
          fontWeight: 600,
          color: '#ffffff',
          lineHeight: 1,
          letterSpacing: 0,
        }}
      >
        {initials}
      </span>
    </div>
  )
}
