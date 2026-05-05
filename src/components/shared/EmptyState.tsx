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
          background: 'var(--surface-2)',
          border: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
      </div>

      {/* Text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '320px' }}>
        <h3
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: 0,
            margin: 0,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-tertiary)',
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
            background: 'var(--text-primary)',
            color: '#ffffff',
            border: '1px solid var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            boxShadow: 'var(--shadow-card)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--brand)'
            e.currentTarget.style.borderColor = 'var(--brand)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--text-primary)'
            e.currentTarget.style.borderColor = 'var(--text-primary)'
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
