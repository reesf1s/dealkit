'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  Command,
  Home,
  Inbox,
  LayoutGrid,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react'

type Tone = 'neutral' | 'good' | 'watch' | 'risk' | 'dark'

const navItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/deals', label: 'Deals', icon: LayoutGrid },
  { href: '/people', label: 'People', icon: UsersRound },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/assistant', label: 'Assistant', icon: Bot },
]

const assistantSuggestions = [
  'What needs attention today?',
  'Which deals have no next step?',
  'Which deals are slipping?',
  'Prep me for my next meeting',
]

function isActive(pathname: string, href: string) {
  if (href === '/home') return pathname === '/home'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppShellV2({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [assistantContextDealId, setAssistantContextDealId] = useState<string | null>(null)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ query?: string; dealId?: string | null }>).detail
      setAssistantContextDealId(detail?.dealId ?? null)
      setAssistantOpen(true)
      if (detail?.query) {
        window.dispatchEvent(new CustomEvent('halvex-assistant-query', { detail }))
      }
    }
    window.addEventListener('openHalvexAssistant', handler)
    return () => window.removeEventListener('openHalvexAssistant', handler)
  }, [])

  return (
    <div className="v2-app">
      <aside className="v2-sidebar">
        <Link href="/home" className="v2-brand">
          <span className="v2-brand-mark">H</span>
          <span>
            <strong>Halvex</strong>
            <small>AI CRM</small>
          </span>
        </Link>

        <nav className="v2-nav" aria-label="Primary">
          {navItems.map(item => {
            const Icon = item.icon
            const active = isActive(pathname, item.href)
            return (
              <Link key={item.href} href={item.href} className={`v2-nav-item ${active ? 'active' : ''}`}>
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="v2-sidebar-bottom">
          <Link href="/settings" className={`v2-nav-item ${isActive(pathname, '/settings') ? 'active' : ''}`}>
            <Settings size={17} />
            <span>Settings</span>
          </Link>
          <button className="v2-sidebar-user" type="button" onClick={() => router.push('/settings')}>
            <span className="v2-user-dot">R</span>
            <span>
              <strong>Workspace</strong>
              <small>Sales team</small>
            </span>
          </button>
        </div>
      </aside>

      <div className="v2-main">
        <header className="v2-topbar">
          <button className="v2-command" type="button" onClick={() => setCommandOpen(true)}>
            <Search size={16} />
            <span>Search or ask Halvex...</span>
            <kbd>⌘K</kbd>
          </button>
          <button className="v2-assistant-button" type="button" onClick={() => setAssistantOpen(true)}>
            <Bot size={16} />
            Assistant
          </button>
        </header>
        <main className="v2-content">{children}</main>
      </div>

      <MobileNavV2 pathname={pathname} />
      <AssistantDrawer open={assistantOpen} onClose={() => setAssistantOpen(false)} contextDealId={assistantContextDealId} />
      <CommandMenuV2 open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  )
}

function MobileNavV2({ pathname }: { pathname: string }) {
  return (
    <nav className="v2-mobile-nav" aria-label="Mobile primary">
      {navItems.slice(0, 5).map(item => {
        const Icon = item.icon
        return (
          <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? 'active' : ''}>
            <Icon size={18} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function CommandMenuV2({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const items = useMemo(() => navItems.filter(item => item.label.toLowerCase().includes(query.toLowerCase())), [query])

  if (!open) return null
  return (
    <div className="v2-modal-backdrop" onMouseDown={onClose}>
      <div className="v2-command-menu" onMouseDown={event => event.stopPropagation()}>
        <div className="v2-command-input">
          <Command size={16} />
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search pages or ask Halvex..."
            onKeyDown={event => {
              if (event.key === 'Escape') onClose()
              if (event.key === 'Enter' && query.trim().length > 2) {
                window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query } }))
                onClose()
              }
            }}
          />
        </div>
        <div className="v2-command-list">
          {items.map(item => {
            const Icon = item.icon
            return (
              <button key={item.href} type="button" onClick={() => { router.push(item.href); onClose() }}>
                <Icon size={16} />
                <span>{item.label}</span>
                <ChevronRight size={15} />
              </button>
            )
          })}
          {query.trim().length > 2 && (
            <button type="button" onClick={() => { window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query } })); onClose() }}>
              <Sparkles size={16} />
              <span>Ask Halvex: {query}</span>
              <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AssistantDrawer({ open, onClose, contextDealId }: { open: boolean; onClose: () => void; contextDealId?: string | null }) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; links?: Array<{ label: string; href: string }> }>>([
    { role: 'assistant', text: 'I can prioritise your day, explain deal risk, prep meetings, draft follow-ups, or turn a raw note into proposed CRM updates.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = useCallback(async (value = input, dealIdOverride?: string | null) => {
    const message = value.trim()
    if (!message || loading) return
    setInput('')
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', text: message }])
    try {
      const response = await fetch('/api/crm/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, dealId: dealIdOverride ?? contextDealId ?? undefined }),
      })
      const payload = await response.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: payload?.data?.answer ?? payload?.error ?? 'I could not answer that yet.',
        links: payload?.data?.links ?? [],
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'I could not reach the CRM context. Try again in a moment.' }])
    } finally {
      setLoading(false)
    }
  }, [contextDealId, input, loading])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ query?: string; dealId?: string | null }>).detail
      const query = detail?.query
      if (query) {
        setInput(query)
        setTimeout(() => submit(query, detail?.dealId ?? contextDealId), 0)
      }
    }
    window.addEventListener('halvex-assistant-query', handler)
    return () => window.removeEventListener('halvex-assistant-query', handler)
  }, [contextDealId, submit])

  return (
    <aside className={`v2-assistant-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="v2-drawer-head">
        <div>
          <span>Halvex assistant</span>
          <strong>Ask, update, draft, reason.</strong>
        </div>
        <button type="button" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="v2-drawer-body">
        <div className="v2-assistant-suggestions">
          {assistantSuggestions.map(suggestion => (
            <button key={suggestion} type="button" disabled={loading} onClick={() => submit(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`v2-assistant-message ${message.role}`}>
            <p>{message.text}</p>
            {message.links?.length ? (
              <div className="v2-message-links">
                {message.links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}
              </div>
            ) : null}
          </div>
        ))}
        {loading ? (
          <div className="v2-assistant-message assistant thinking" aria-live="polite">
            <div className="v2-typing" aria-hidden="true"><span /><span /><span /></div>
            <p>Thinking through your CRM context. Larger workspaces can take a moment.</p>
          </div>
        ) : null}
      </div>
      <form className="v2-drawer-composer" onSubmit={event => { event.preventDefault(); submit() }}>
        <textarea value={input} disabled={loading} onChange={event => setInput(event.target.value)} placeholder={loading ? 'Halvex is working...' : 'Ask Halvex or paste an update...'} />
        <button type="submit" disabled={loading || !input.trim()}>{loading ? <span className="v2-mini-spinner" /> : <Send size={16} />}</button>
      </form>
    </aside>
  )
}

export function HeroPanel({
  eyebrow,
  title,
  children,
  actions,
  aside,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <section className="v2-hero">
      <div className="v2-hero-copy">
        <span className="v2-hero-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <div className="v2-hero-text">{children}</div>
        {actions ? <div className="v2-hero-actions">{actions}</div> : null}
      </div>
      {aside ? <div className="v2-hero-aside">{aside}</div> : null}
    </section>
  )
}

export function RecordHero({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  meta?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <section className="v2-record-hero">
      <div>
        <span className="v2-hero-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {meta ? <div className="v2-record-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="v2-record-actions">{actions}</div> : null}
    </section>
  )
}

export function ButtonV2({
  children,
  href,
  onClick,
  tone = 'neutral',
  type = 'button',
  disabled,
}: {
  children: React.ReactNode
  href?: string
  onClick?: () => void | Promise<void>
  tone?: Tone
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  const className = `v2-button ${tone}`
  if (href) return <Link href={href} className={className}>{children}</Link>
  return <button type={type} className={className} onClick={onClick} disabled={disabled}>{children}</button>
}

export function PanelV2({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`v2-panel ${className}`}>{children}</section>
}

export function SectionHeader({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="v2-section-head">
      <div>
        <h2>{icon}{title}</h2>
        {children ? <p>{children}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function EmptyStateV2({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="v2-empty">
      <Sparkles size={18} />
      <strong>{title}</strong>
      <p>{children}</p>
      {action ? <div>{action}</div> : null}
    </div>
  )
}

export function ActionCard({
  title,
  reason,
  href,
  source,
  action,
  tone = 'neutral',
  onClick,
}: {
  title: string
  reason: string
  href?: string
  source?: string
  action?: React.ReactNode
  tone?: Tone
  onClick?: () => void
}) {
  const content = (
    <>
      <div className="v2-card-icon"><Sparkles size={16} /></div>
      <div>
        <strong>{title}</strong>
        <p>{reason}</p>
        {source ? <span className="v2-source">{source}</span> : null}
      </div>
      {action ? <div className="v2-card-action">{action}</div> : null}
    </>
  )
  if (href) return <Link href={href} className={`v2-action-card ${tone}`}>{content}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={`v2-action-card ${tone}`}>{content}</button>
  return <div className={`v2-action-card ${tone}`}>{content}</div>
}

export function MeetingCard({ meeting, action }: { meeting: { title: string; startsAt?: string | Date | null; companyName?: string | null; dealTitle?: string | null; dealId?: string | null }; action?: React.ReactNode }) {
  const startsAt = meeting.startsAt ? new Date(meeting.startsAt) : null
  return (
    <div className="v2-meeting-card">
      <div className="v2-meeting-time">
        <span>{startsAt ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(startsAt) : 'TBC'}</span>
        <small>{startsAt ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(startsAt) : 'No date'}</small>
      </div>
      <div>
        <strong>{meeting.title}</strong>
        <p>{meeting.companyName ?? 'Company not matched'}{meeting.dealTitle ? ` · ${meeting.dealTitle}` : ''}</p>
        <span>AI prep uses the linked people, deal, and latest timeline context.</span>
      </div>
      {action}
    </div>
  )
}

export function DealCardV2({ deal }: { deal: any }) {
  const risk = normalizeRisk(deal.aiRiskLevel)
  return (
    <Link href={`/deals/${deal.id}`} className="v2-deal-card">
      <div className="v2-deal-card-top">
        <div>
          <strong>{deal.title}</strong>
          <p>{deal.companyName ?? 'Unknown company'}</p>
        </div>
        <RiskBadge risk={risk} />
      </div>
      <div className="v2-deal-facts">
        <span>{money(deal.valueAmount)}</span>
        <span>{shortDate(deal.expectedCloseDate) ?? 'Close date missing'}</span>
        <span>{deal.aiConfidence ? `${deal.aiConfidence}% confidence` : 'Confidence missing'}</span>
      </div>
      <p className="v2-deal-insight">{deal.aiNextAction || missingInsight(deal)}</p>
    </Link>
  )
}

export function IntelligencePanel({ deal, signals = [], reasons = [] }: { deal?: any; signals?: any[]; reasons?: string[] }) {
  const score = typeof deal?.aiScore === 'number' ? Math.min(deal.aiScore, deal.status === 'won' ? 100 : 92) : null
  const confidence = typeof deal?.aiConfidence === 'number' ? Math.min(deal.aiConfidence, deal.status === 'won' ? 100 : 88) : null
  const risk = normalizeRisk(deal?.aiRiskLevel)
  return (
    <PanelV2 className="v2-intelligence-panel">
      <SectionHeader title="Deal intelligence" icon={<Bot size={18} />}>
        Score, confidence, and risk are separate so Halvex never pretends weak evidence is certainty.
      </SectionHeader>
      <div className="v2-score-grid">
        <div><small>Score</small><strong>{score ?? '—'}</strong></div>
        <div><small>Confidence</small><strong>{confidence ? `${confidence}%` : '—'}</strong></div>
        <div><small>Risk</small><RiskBadge risk={risk} /></div>
      </div>
      <div className="v2-intel-list">
        {(reasons.length ? reasons : signals.map(signal => signal.explanation)).slice(0, 5).map((reason, index) => (
          <p key={`${reason}-${index}`}><Circle size={8} />{reason}</p>
        ))}
        {!reasons.length && !signals.length ? <p><Circle size={8} />Add recent activity to improve confidence.</p> : null}
      </div>
    </PanelV2>
  )
}

export function TimelineV2({ items }: { items: Array<{ id: string; title: string; body?: string | null; summary?: string | null; occurredAt?: string | Date; source?: string; type?: string }> }) {
  if (!items.length) return <EmptyStateV2 title="No timeline yet">Add an update, connect Calendar, or import history to build the deal memory.</EmptyStateV2>
  return (
    <div className="v2-timeline">
      {items.map(item => (
        <article key={item.id} className="v2-timeline-item">
          <div className="v2-timeline-dot" />
          <div>
            <div className="v2-timeline-head">
              <strong>{item.title}</strong>
              <SourceBadge source={item.source ?? item.type ?? 'manual'} />
            </div>
            <p>{item.summary || item.body || 'No extra detail saved.'}</p>
            {item.occurredAt ? <small>{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(item.occurredAt))}</small> : null}
          </div>
        </article>
      ))}
    </div>
  )
}

export function InlineEditableField({ label, value, onSave, type = 'text' }: { label: string; value: string; onSave: (value: string) => Promise<void> | void; type?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setSaving(true)
    setError('')
    try {
      await onSave(draft)
      setEditing(false)
    } catch {
      setError('Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`v2-inline-field ${saving ? 'saving' : ''}`}>
      <small>{label}</small>
      {editing ? (
        <form onSubmit={async event => { event.preventDefault(); await submit() }}>
          <input type={type} value={draft} disabled={saving} onChange={event => setDraft(event.target.value)} autoFocus />
          <button type="submit" disabled={saving}>{saving ? <span className="v2-mini-spinner dark" /> : <Check size={14} />}</button>
        </form>
      ) : (
        <button type="button" onClick={() => { setDraft(value); setEditing(true) }}>{value || 'Missing'}</button>
      )}
      {error ? <em>{error}</em> : null}
    </div>
  )
}

export function AddUpdateComposer({ dealId, onSaved }: { dealId: string; onSaved?: () => void }) {
  const [note, setNote] = useState('')
  const [proposed, setProposed] = useState<null | ProposedDealUpdate>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function review() {
    if (!note.trim()) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/crm/deals/${dealId}/updates/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? 'Could not review this update')
      setProposed(payload?.data ?? proposeChanges(note))
    } catch {
      setProposed(proposeChanges(note))
      setError('AI review was unavailable, so Halvex used its local deal rules instead.')
    } finally {
      setSaving(false)
    }
  }

  async function save(mode: 'note' | 'approved') {
    if (!note.trim()) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/crm/deals/${dealId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, proposedChanges: proposed, mode }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error ?? 'Could not save this update')
      setNote('')
      setProposed(null)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this update')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PanelV2 className="v2-composer-panel">
      <SectionHeader title="Add update" icon={<Plus size={18} />}>
        Feed Halvex a meeting note, blocker, customer update, or next step. Important changes are proposed first.
      </SectionHeader>
      <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Spoke to Darren. They like the product but are blocked on data alignment. Need to send revised requirements by Friday." />
      {proposed ? <SuggestedChangeReview changes={proposed} /> : null}
      {error ? <p className="v2-form-note">{error}</p> : null}
      <div className="v2-composer-actions">
        <ButtonV2 onClick={review} disabled={!note.trim() || saving}>Review changes</ButtonV2>
        <ButtonV2 onClick={() => save('note')} disabled={!note.trim() || saving}>Save as note only</ButtonV2>
        <ButtonV2 tone="dark" onClick={() => save('approved')} disabled={!proposed || saving}>Approve suggested update</ButtonV2>
      </div>
    </PanelV2>
  )
}

type ProposedDealUpdate = {
  blocker?: string | null
  risk?: string | null
  nextAction?: string | null
  task?: string | null
  summary: string
  confidence?: number | null
  evidence?: string[]
}

function SuggestedChangeReview({ changes }: { changes: ProposedDealUpdate }) {
  return (
    <div className="v2-review">
      <strong>Here is what Halvex thinks changed</strong>
      {changes.confidence ? <p><span>Confidence</span>{changes.confidence}% based on this note and linked deal context</p> : null}
      {changes.blocker ? <p><span>Blocker</span>{changes.blocker}</p> : null}
      {changes.risk ? <p><span>Risk</span>{changes.risk}</p> : null}
      {changes.nextAction ? <p><span>Next action</span>{changes.nextAction}</p> : null}
      {changes.task ? <p><span>Task</span>{changes.task}</p> : null}
      <p><span>Summary</span>{changes.summary}</p>
      {changes.evidence?.length ? <p><span>Evidence</span>{changes.evidence.slice(0, 2).join(' · ')}</p> : null}
    </div>
  )
}

export function RiskBadge({ risk }: { risk?: string | null }) {
  return <span className={`v2-badge risk-${normalizeRisk(risk)}`}>{normalizeRisk(risk)}</span>
}

export function ConfidenceBadge({ value }: { value?: number | null }) {
  const tone = !value ? 'unknown' : value >= 75 ? 'high' : value >= 50 ? 'medium' : 'low'
  return <span className={`v2-badge confidence-${tone}`}>{value ? `${value}% confidence` : 'confidence unknown'}</span>
}

export function SourceBadge({ source }: { source: string }) {
  return <span className="v2-source-badge">{source.replace(/_/g, ' ')}</span>
}

export function ObjectLinkChip({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="v2-object-chip">{children}</Link>
}

export function money(value?: number | null) {
  if (!value || value <= 0) return 'Value missing'
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `£${Math.round(value / 1_000)}k`
  return `£${value}`
}

export function shortDate(value?: string | Date | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(value))
}

export function normalizeRisk(value?: string | null) {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'unknown'
}

function missingInsight(deal: any) {
  if (!deal.valueAmount) return 'Value is missing. Add it to improve forecast confidence.'
  if (!deal.expectedCloseDate) return 'Close date is missing. Halvex will keep confidence limited.'
  if (!deal.aiNextAction) return 'No next step recorded. Add a concrete follow-up.'
  return 'Open deal. Add recent context to improve intelligence.'
}

function proposeChanges(note: string) {
  const lower = note.toLowerCase()
  const blocker = lower.includes('blocked') || lower.includes('concern') || lower.includes('issue') || lower.includes('alignment')
    ? 'Customer update contains a blocker or unresolved concern.'
    : null
  const task = extractTask(note)
  const nextAction = task ?? (lower.includes('follow') ? 'Follow up with the customer and confirm the next step.' : null)
  return {
    blocker,
    risk: blocker ? 'Medium risk until the blocker is resolved.' : 'No new risk detected from this note.',
    nextAction,
    task,
    summary: note.length > 180 ? `${note.slice(0, 177)}...` : note,
    confidence: blocker ? 62 : 52,
    evidence: [note.length > 180 ? `${note.slice(0, 177)}...` : note],
  }
}

function extractTask(note: string) {
  const lower = note.toLowerCase()
  if (lower.includes('need to ')) {
    const [, after] = note.split(/need to /i)
    return after?.replace(/\.$/, '').trim() || null
  }
  if (lower.includes('follow up')) return 'Follow up with the customer.'
  if (lower.includes('send ')) {
    const [, after] = note.split(/send /i)
    return after ? `Send ${after.replace(/\.$/, '').trim()}` : null
  }
  return null
}
