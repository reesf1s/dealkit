'use client'

/**
 * MiniBarChart — 12 bars, 4px wide, 2px gap, bottom-aligned.
 * Last 3 bars at 50% opacity. Orange bars by default.
 * Accepts an array of 12 values (0–9 scale → 2–18px height).
 */

interface MiniBarChartProps {
  values?: number[]
  color?: string
  maxHeight?: number
}

const DEFAULT_VALUES = [3, 5, 4, 6, 5, 7, 6, 8, 7, 6, 8, 9]

export function MiniBarChart({
  values = DEFAULT_VALUES,
  color = '#F97316',
  maxHeight = 18,
}: MiniBarChartProps) {
  const data = values.slice(-12)
  const max = Math.max(...data, 1)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '2px',
        height: maxHeight,
      }}
    >
      {data.map((val, i) => {
        const height = Math.max(2, Math.round((val / max) * maxHeight))
        const isRecent = i >= data.length - 3
        return (
          <div
            key={i}
            style={{
              width: 4,
              height,
              borderRadius: '1px',
              background: color,
              opacity: isRecent ? 0.5 : 1,
              flexShrink: 0,
            }}
          />
        )
      })}
    </div>
  )
}
