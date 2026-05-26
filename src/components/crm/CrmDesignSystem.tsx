import type { ComponentType, CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Sparkles,
} from 'lucide-react'

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties; className?: string }>
type Tone = 'neutral' | 'good' | 'watch' | 'risk' | 'blue'

export function CrmPageShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className={`crm-reset-shell${wide ? ' wide' : ''}`}>
      {children}
    </main>
  )
}

export function CrmHero({
  eyebrow,
  title,
  brief,
  primary,
  secondary,
  meta,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  brief?: ReactNode
  primary?: ReactNode
  secondary?: ReactNode
  meta?: ReactNode
}) {
  return (
    <section className="crm-hero-panel">
      <div className="crm-hero-bg" aria-hidden="true" />
      <div className="crm-hero-content">
        {eyebrow && <div className="crm-kicker">{eyebrow}</div>}
        <h1>{title}</h1>
        {brief && <p>{brief}</p>}
        {(primary || secondary) && (
          <div className="crm-hero-actions">
            {primary}
            {secondary}
          </div>
        )}
      </div>
      {meta && <div className="crm-hero-meta">{meta}</div>}
    </section>
  )
}

export function CrmPanel({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title?: ReactNode
  description?: ReactNode
  icon?: IconComponent
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`crm-panel${className ? ` ${className}` : ''}`}>
      {(title || description || action) && (
        <header className="crm-panel-head">
          <div className="crm-panel-title">
            {Icon && <span><Icon size={15} /></span>}
            <div>
              {title && <h2>{title}</h2>}
              {description && <p>{description}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function CrmButton({
  href,
  children,
  variant = 'secondary',
  onClick,
  type = 'button',
}: {
  href?: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  const className = `crm-action-button ${variant}`
  if (href) return <Link href={href} className={className}>{children}</Link>
  return <button type={type} onClick={onClick} className={className}>{children}</button>
}

export function CrmEmptyAction({
  title,
  description,
  action,
  icon: Icon = Sparkles,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: IconComponent
}) {
  return (
    <div className="crm-empty-action">
      <span><Icon size={16} /></span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
        {action && <div>{action}</div>}
      </div>
    </div>
  )
}

export function CrmPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`crm-pill-reset ${tone}`}>{children}</span>
}

export function CrmScoreBadge({
  score,
  confidence,
  risk,
}: {
  score: number | null | undefined
  confidence?: number | null
  risk?: string | null
}) {
  const numeric = typeof score === 'number' ? score : null
  const tone: Tone = risk === 'high' || (numeric ?? 100) < 50 ? 'risk' : risk === 'medium' || (numeric ?? 100) < 75 ? 'watch' : 'good'
  const confidenceLabel =
    typeof confidence !== 'number' ? 'Confidence limited' :
    confidence >= 75 ? 'High confidence' :
    confidence >= 45 ? 'Medium confidence' :
    'Low confidence'

  return (
    <div className={`crm-score-badge ${tone}`}>
      <span>{numeric === null ? '—' : numeric}</span>
      <div>
        <strong>{risk ? `${risk} risk` : 'Risk unknown'}</strong>
        <small>{confidenceLabel}</small>
      </div>
    </div>
  )
}

export function CrmMeetingCard({
  title,
  time,
  company,
  dealHref,
  attendees,
  prep,
  connected = true,
}: {
  title: string
  time: string
  company?: string | null
  dealHref?: string | null
  attendees?: string
  prep?: string
  connected?: boolean
}) {
  const body = (
    <article className="crm-meeting-card">
      <div className="crm-meeting-time">
        <CalendarDays size={14} />
        <span>{time}</span>
      </div>
      <div className="crm-meeting-main">
        <strong>{title}</strong>
        <p>{company || attendees || 'Unlinked meeting'}</p>
        <small>{prep || (connected ? 'Ask Halvex for prep from linked CRM context.' : 'Connect Calendar to bring meetings into the CRM.')}</small>
      </div>
      <ArrowRight size={15} />
    </article>
  )
  if (dealHref) return <Link href={dealHref} className="crm-card-link">{body}</Link>
  return body
}

export function CrmPriorityCard({
  title,
  reason,
  action,
  href,
  tone = 'neutral',
  meta,
}: {
  title: string
  reason: string
  action: string
  href?: string
  tone?: Tone
  meta?: ReactNode
}) {
  const content = (
    <article className={`crm-priority-card ${tone}`}>
      <div>
        <div className="crm-priority-title">
          {tone === 'risk' ? <AlertTriangle size={14} /> : tone === 'good' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
          <strong>{title}</strong>
        </div>
        <p>{reason}</p>
        <small>{action}</small>
      </div>
      {meta && <span className="crm-priority-meta">{meta}</span>}
    </article>
  )
  if (href) return <Link href={href} className="crm-card-link">{content}</Link>
  return content
}

export function CrmTimeline({ children }: { children: ReactNode }) {
  return <div className="crm-record-timeline">{children}</div>
}

export function CrmTimelineItem({
  title,
  body,
  time,
  type,
}: {
  title: string
  body?: string | null
  time: string
  type?: string
}) {
  return (
    <article className="crm-record-timeline-item">
      <span aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        {body && <p>{body}</p>}
        <small>{type ? `${type} · ` : ''}{time}</small>
      </div>
    </article>
  )
}
