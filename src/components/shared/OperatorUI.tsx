import type { ComponentType, CSSProperties, ReactNode } from 'react'
import Link from 'next/link'

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties }>

export function OperatorPage({ children, maxWidth }: { children: ReactNode; maxWidth?: number | string }) {
  return (
    <div className="operator-page" style={maxWidth ? { maxWidth } : undefined}>
      {children}
    </div>
  )
}

export function OperatorHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="operator-header">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          {eyebrow && <div className="operator-eyebrow">{eyebrow}</div>}
          <h1 className="operator-title">{title}</h1>
          {description && <p className="operator-subtitle">{description}</p>}
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
      </div>
    </section>
  )
}

export function OperatorPanel({
  title,
  description,
  icon: Icon,
  children,
  action,
  style,
}: {
  title?: ReactNode
  description?: ReactNode
  icon?: IconComponent
  children: ReactNode
  action?: ReactNode
  style?: CSSProperties
}) {
  return (
    <section className="notion-panel" style={{ padding: 14, ...style }}>
      {(title || description || Icon || action) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
            {Icon && <Icon size={14} style={{ color: 'var(--text-tertiary)', marginTop: 2, flexShrink: 0 }} />}
            <div style={{ minWidth: 0 }}>
              {title && <h2 style={{ margin: 0, textTransform: 'none', fontSize: 14, letterSpacing: 0, color: 'var(--text-primary)' }}>{title}</h2>}
              {description && <p style={{ margin: '2px 0 0', color: 'var(--text-tertiary)', fontSize: 11.5, lineHeight: 1.45 }}>{description}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function OperatorKpi({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: IconComponent
}) {
  return (
    <article className="notion-kpi" style={{ padding: '12px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span className="operator-eyebrow">{label}</span>
        {Icon && <Icon size={13} style={{ color: 'var(--text-tertiary)' }} />}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0, lineHeight: 1.1, color: 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</div>}
    </article>
  )
}

export function OperatorButton({
  children,
  primary,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button className={`operator-button${primary ? ' operator-button-primary' : ''}`} style={style} {...props}>
      {children}
    </button>
  )
}

export function OperatorLinkButton({
  children,
  primary,
  style,
  href,
}: {
  children: ReactNode
  primary?: boolean
  style?: CSSProperties
  href: string
}) {
  return (
    <Link className={`operator-button${primary ? ' operator-button-primary' : ''}`} href={href} style={style}>
      {children}
    </Link>
  )
}
