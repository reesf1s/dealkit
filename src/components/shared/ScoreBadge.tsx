import React from 'react'

interface ScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function ScoreBadge({ score, size = 'md', showLabel = false }: ScoreBadgeProps) {
  const getColors = (s: number) => {
    if (s >= 70) return { bg: 'rgba(15,123,108,0.08)', text: '#0f7b6c', border: 'rgba(15,123,108,0.20)' }
    if (s >= 40) return { bg: 'rgba(203,108,44,0.08)', text: '#cb6c2c', border: 'rgba(203,108,44,0.20)' }
    return { bg: 'rgba(224,62,62,0.08)', text: '#e03e3e', border: 'rgba(224,62,62,0.20)' }
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
