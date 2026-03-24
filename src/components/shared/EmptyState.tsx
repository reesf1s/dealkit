import type { ComponentType } from 'react'

interface EmptyStateProps {
  icon: ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '64px 24px',
        gap: '16px',
      }}
    >
      {/* Icon container */}
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '12px',
          background: 'rgba(99, 102, 241, 0.10)',
          border: '1px solid rgba(99, 102, 241, 0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} strokeWidth={1.5} style={{ color: '#6366f1' }} />
      </div>

      {/* Text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '320px' }}>
        <h3
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#1d1d1f',
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: '13px',
            color: '#6e6e73',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {description}
        </p>
      </div>

      {/* CTA */}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            height: '34px',
            padding: '0 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#fff',
            background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
            border: '1px solid rgba(99,102,241,0.40)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.35)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.25)'
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
