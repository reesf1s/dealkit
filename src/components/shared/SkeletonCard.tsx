interface SkeletonCardProps {
  lines?: number
  showHeader?: boolean
  className?: string
}

function SkeletonLine({ width = '100%', height = 12 }: { width?: string | number; height?: number }) {
  return (
    <div
      className="skeleton"
      style={{
        width,
        height,
        borderRadius: '4px',
      }}
    />
  )
}

export function SkeletonCard({ lines = 3, showHeader = true }: SkeletonCardProps) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: '10px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {showHeader && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          {/* Avatar / icon placeholder */}
          <div
            className="skeleton"
            style={{ width: 32, height: 32, borderRadius: '8px', flexShrink: 0 }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SkeletonLine width="60%" height={13} />
            <SkeletonLine width="40%" height={11} />
          </div>
        </div>
      )}

      {/* Body lines */}
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? '70%' : '100%'}
          height={12}
        />
      ))}
    </div>
  )
}

export function SkeletonGrid({ count = 6, cols = 3 }: { count?: number; cols?: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '16px',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
