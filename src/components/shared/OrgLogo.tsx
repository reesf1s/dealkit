'use client'

/**
 * OrgLogo — deterministic colored rounded-square for organisation names.
 * White initial letter on a hashed solid background.
 */

const ORG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
  '#ef4444', '#64748b', '#f59e0b', '#10b981',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

interface OrgLogoProps {
  name: string
  size?: number
  fontSize?: number
}

export function OrgLogo({ name, size = 22, fontSize }: OrgLogoProps) {
  const letter = (name || '?').trim()[0].toUpperCase()
  const idx = hashString((name || '').toLowerCase()) % ORG_COLORS.length
  const bg = ORG_COLORS[idx]
  const fSize = fontSize ?? Math.round(size * 0.5)

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: bg,
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
          fontWeight: 700,
          color: '#ffffff',
          lineHeight: 1,
        }}
      >
        {letter}
      </span>
    </div>
  )
}
