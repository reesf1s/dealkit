import React from 'react'

interface ScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function ScoreBadge({ score, size = 'md', showLabel = false }: ScoreBadgeProps) {
  const getColors = (s: number) => {
    if (s >= 70) return { bg: 'rgba(34,197,94,0.15)', text: '#22C55E', border: 'rgba(34,197,94,0.3)' }
    if (s >= 40) return { bg: 'rgba(234,179,8,0.15)', text: '#EAB308', border: 'rgba(234,179,8,0.3)' }
    return { bg: 'rgba(239,68,68,0.15)', text: '#EF4444', border: 'rgba(239,68,68,0.3)' }
  }

  const colors = getColors(score)
  const sizes = {
    sm: { padding: '2px 6px', fontSize: '11px', minWidth: '32px' },
    md: { padding: '3px 8px', fontSize: '13px', minWidth: '40px' },
    lg: { padding: '6px 12px', fontSize: '16px', minWidth: '52px', fontFamily: "'JetBrains Mono', monospace" }
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        fontWeight: 600,
        fontFamily: size === 'lg' ? "'JetBrains Mono', monospace" : 'inherit',
        ...sizes[size]
      }}
    >
      {score}%{showLabel && <span style={{ fontSize: '9px', marginLeft: '3px', opacity: 0.8 }}>win</span>}
    </span>
  )
}
