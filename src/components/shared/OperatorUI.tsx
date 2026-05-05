import type { ComponentType, CSSProperties, ReactNode } from 'react'
import Link from 'next/link'

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties }>
type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue'

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
  meta,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}) {
  return (
    <section className="operator-header">
      <div className="operator-header-grid">
        <div className="operator-header-copy">
          {eyebrow && <div className="operator-eyebrow">{eyebrow}</div>}
          <h1 className="operator-title">{title}</h1>
          {description && <p className="operator-subtitle">{description}</p>}
          {meta && <div className="operator-header-meta">{meta}</div>}
        </div>
        {actions && <div className="operator-header-actions">{actions}</div>}
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
    <section className="notion-panel operator-panel" style={style}>
      {(title || description || Icon || action) && (
        <div className="operator-section-head">
          <div className="operator-section-title-wrap">
            {Icon && <Icon size={14} style={{ color: 'var(--text-tertiary)', marginTop: 2, flexShrink: 0 }} />}
            <div className="operator-section-copy">
              {title && <h2>{title}</h2>}
              {description && <p>{description}</p>}
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
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: IconComponent
  tone?: Tone
}) {
  return (
    <article className={`notion-kpi operator-kpi operator-tone-${tone}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span className="operator-eyebrow">{label}</span>
        {Icon && <Icon size={13} style={{ color: 'var(--text-tertiary)' }} />}
      </div>
      <div className="operator-kpi-value">{value}</div>
      {sub && <div className="operator-kpi-sub">{sub}</div>}
    </article>
  )
}

export function OperatorMetricGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`operator-metric-grid${className ? ` ${className}` : ''}`}>{children}</section>
}

export function OperatorSectionHeader({
  title,
  description,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="operator-section-head">
      <div className="operator-section-copy">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function OperatorInsightCard({
  title,
  children,
  meta,
  tone = 'neutral',
  href,
}: {
  title: ReactNode
  children?: ReactNode
  meta?: ReactNode
  tone?: Tone
  href?: string
}) {
  const content = (
    <div className={`operator-insight operator-tone-${tone}`}>
      <div className="operator-insight-main">
        <div className="operator-insight-title">{title}</div>
        {children && <div className="operator-insight-body">{children}</div>}
      </div>
      {meta && <div className="operator-insight-meta">{meta}</div>}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="operator-insight-link">
        {content}
      </Link>
    )
  }

  return content
}

export function OperatorSegmentedControl<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ id: T; label: string; icon?: IconComponent }>
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div className="operator-segmented" role="tablist">
      {items.map(item => {
        const Icon = item.icon
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? 'active' : undefined}
            onClick={() => onChange(item.id)}
          >
            {Icon && <Icon size={12} />}
            {item.label}
          </button>
        )
      })}
    </div>
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
