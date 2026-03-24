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
          background: 'rgba(124, 58, 237, 0.12)',
          border: '1px solid rgba(124, 58, 237, 0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(124,58,237,0.12)',
        }}
      >
        <Icon size={20} strokeWidth={1.5} style={{ color: '#a78bfa' }} />
      </div>

      {/* Text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '320px' }}>
        <h3
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.88)',
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.42)',
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
            background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
            border: '1px solid rgba(124,58,237,0.50)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            boxShadow: '0 0 16px rgba(124,58,237,0.25)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.40)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 0 16px rgba(124,58,237,0.25)'
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
