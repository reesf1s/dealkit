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
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} strokeWidth={1.5} style={{ color: '#555555' }} />
      </div>

      {/* Text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '320px' }}>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#EBEBEB',
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: '13px',
            color: '#888888',
            lineHeight: 1.5,
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
            height: '32px',
            padding: '0 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#fff',
            backgroundColor: '#6366F1',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#4F46E5'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#6366F1'
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
