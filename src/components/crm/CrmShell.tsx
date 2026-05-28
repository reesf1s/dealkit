'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { DetailsHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Command,
  FileText,
  Home,
  LayoutGrid,
  Loader2,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react'

type Tone = 'default' | 'primary' | 'ghost' | 'tertiary' | 'danger'
type BadgeTone = 'neutral' | 'good' | 'warn' | 'danger'

const nav = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/deals', label: 'Deals', icon: LayoutGrid },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/people', label: 'People', icon: UsersRound },
  { href: '/tasks', label: 'Tasks', icon: CheckCircle2 },
  { href: '/activity', label: 'Activity', icon: FileText },
  { href: '/assistant', label: 'AI Assistant', icon: Bot },
]

type AssistantProposedAction = {
  id: string
  type: string
  label: string
  description: string
  record?: { type: string; id?: string; label: string; href?: string }
  params: Record<string, unknown>
  before?: Array<{ label: string; value: string }>
  after?: Array<{ label: string; value: string }>
  requiresConfirmation: boolean
}

type AssistantMessage = {
  role: 'user' | 'assistant'
  text: string
  links?: Array<{ label: string; href: string }>
  proposedActions?: AssistantProposedAction[]
}

function active(pathname: string, href: string) {
  if (href === '/home') return pathname === '/home'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function CrmShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [contextDealId, setContextDealId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathDealId = pathname.match(/^\/deals\/([^/?#]+)/)?.[1] ?? null
  const effectiveDealId = contextDealId ?? pathDealId

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ query?: string; dealId?: string | null }>).detail
      setContextDealId(detail?.dealId ?? pathDealId)
      setAssistantOpen(true)
      if (detail?.query) window.dispatchEvent(new CustomEvent('crm-assistant-query', { detail }))
    }
    window.addEventListener('openHalvexAssistant', onOpen)
    return () => window.removeEventListener('openHalvexAssistant', onOpen)
  }, [pathDealId])

  useEffect(() => {
    setContextDealId(pathDealId)
  }, [pathDealId])

  useEffect(() => {
    const saved = window.localStorage.getItem('halvex-crm-sidebar')
    if (saved === 'collapsed') setSidebarCollapsed(true)
  }, [])

  function toggleSidebar() {
    setSidebarCollapsed(prev => {
      const next = !prev
      window.localStorage.setItem('halvex-crm-sidebar', next ? 'collapsed' : 'expanded')
      return next
    })
  }

  return (
    <div className={`crm-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="crm-sidebar">
        <div className="crm-brand-row">
          <Link href="/home" className="crm-brand" aria-label="Halvex home">
            <span>H</span>
            <div>
              <strong>Halvex</strong>
              <small>SME CRM</small>
            </div>
          </Link>
          <button type="button" className="crm-sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        <button type="button" className="crm-workspace-switcher" onClick={() => router.push('/settings?section=workspace')}>
          <span className="crm-avatar">R</span>
          <div>
            <strong>Workspace</strong>
            <small>Sales team</small>
          </div>
        </button>

        <nav className="crm-nav" aria-label="Primary navigation">
          {nav.map(item => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className={active(pathname, item.href) ? 'active' : ''} title={item.label}>
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="crm-sidebar-footer">
          <Link href="/settings" className={active(pathname, '/settings') ? 'active' : ''} title="Settings">
            <Settings size={17} />
            <span>Settings</span>
          </Link>
          <button type="button" onClick={() => router.push('/settings?section=workspace')} className="crm-profile-button">
            <span className="crm-avatar">R</span>
            <span>
              <strong>Workspace</strong>
              <small>Sales team</small>
            </span>
          </button>
        </div>
      </aside>

      <div className="crm-main">
        <header className="crm-topbar">
          <button type="button" className="crm-search-button" onClick={() => setCommandOpen(true)}>
            <Search size={16} />
            <span>Search deals, people, companies, tasks...</span>
            <kbd>⌘K</kbd>
          </button>
        </header>
        <main className="crm-content">{children}</main>
      </div>

      <nav className="crm-mobile-nav" aria-label="Mobile navigation">
        {nav.slice(0, 5).map(item => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className={active(pathname, item.href) ? 'active' : ''}>
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <button
        type="button"
        className={`crm-assistant-orb ${assistantOpen ? 'open' : ''}`}
        onClick={() => setAssistantOpen(true)}
        aria-label="Open Halvex assistant"
      >
        <Sparkles size={24} />
      </button>
      <CrmAssistantDrawer open={assistantOpen} onClose={() => setAssistantOpen(false)} contextDealId={effectiveDealId} />
      <CrmCommandMenu open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  )
}

function CrmCommandMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const matches = useMemo(() => nav.filter(item => item.label.toLowerCase().includes(query.toLowerCase())), [query])
  const actions = [
    { label: 'Add deal', href: '/deals?quick=deal', icon: Plus },
    { label: 'Add task', href: '/tasks?quick=task', icon: CheckCircle2 },
    { label: 'Import data', href: '/settings?section=imports', icon: LayoutGrid },
    { label: 'Open AI Assistant', href: '/assistant', icon: Bot },
  ]
  if (!open) return null
  return (
    <div className="crm-modal-backdrop" onMouseDown={onClose}>
      <div className="crm-command-menu" onMouseDown={event => event.stopPropagation()}>
        <label>
          <Command size={17} />
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Jump to a page, create something, or ask Halvex..."
            onKeyDown={event => {
              if (event.key === 'Escape') onClose()
              if (event.key === 'Enter' && query.trim().length > 2) {
                window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query } }))
                onClose()
              }
            }}
          />
        </label>
        <div>
          {!query.trim() ? actions.map(item => {
            const Icon = item.icon
            return (
              <button key={item.href} type="button" onClick={() => { router.push(item.href); onClose() }}>
                <Icon size={16} />
                <span>{item.label}</span>
                <ChevronRight size={15} />
              </button>
            )
          }) : null}
          {matches.map(item => {
            const Icon = item.icon
            return (
              <button key={item.href} type="button" onClick={() => { router.push(item.href); onClose() }}>
                <Icon size={16} />
                <span>{item.label}</span>
                <ChevronRight size={15} />
              </button>
            )
          })}
          {query.trim().length > 2 ? (
            <button type="button" onClick={() => { window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query } })); onClose() }}>
              <Bot size={16} />
              <span>Ask Halvex: {query}</span>
              <ChevronRight size={15} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CrmAssistantDrawer({ open, onClose, contextDealId }: { open: boolean; onClose: () => void; contextDealId?: string | null }) {
  const router = useRouter()
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { role: 'assistant', text: 'I can search, explain, draft, and prepare CRM changes. Anything that edits records waits for your confirmation.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, open])

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
      const payload = await response.json().catch(() => ({}))
      const text = payload?.data?.answer || payload?.error || 'I could not answer that yet.'
      setMessages(prev => [...prev, {
        role: 'assistant',
        text,
        links: payload?.data?.links ?? [],
        proposedActions: payload?.data?.proposedActions ?? [],
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'I could not reach the assistant. Try again in a moment.' }])
    } finally {
      setLoading(false)
    }
  }, [contextDealId, input, loading])

  const confirmAction = useCallback(async (action: AssistantProposedAction) => {
    setConfirmingId(action.id)
    try {
      const response = await fetch('/api/crm/assistant/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, confirmed: true }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error ?? 'Could not complete that action')
      const message = payload?.data?.message ?? 'Done.'
      const href = payload?.data?.href
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: message,
        links: href ? [{ label: 'Open record', href }] : [],
      }])
      window.dispatchEvent(new CustomEvent('halvex-crm-mutated'))
      router.refresh()
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: err instanceof Error ? err.message : 'Could not complete that action.' }])
    } finally {
      setConfirmingId(null)
    }
  }, [router])

  useEffect(() => {
    const onQuery = (event: Event) => {
      const detail = (event as CustomEvent<{ query?: string; dealId?: string | null }>).detail
      if (detail?.query) submit(detail.query, detail.dealId)
    }
    window.addEventListener('crm-assistant-query', onQuery)
    return () => window.removeEventListener('crm-assistant-query', onQuery)
  }, [submit])

  if (!open) return null
  return (
    <aside className="crm-assistant-drawer" aria-label="Halvex assistant">
      <header>
        <div>
          <small>Halvex assistant</small>
          <h2>Ask, prepare, confirm.</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close assistant"><X size={20} /></button>
      </header>
      <div className="crm-assistant-context">
        <span>Chat</span>
        {contextDealId ? <Link href={`/deals/${contextDealId}`}>Current deal</Link> : <span>Workspace context</span>}
        <span>Confirm before changes</span>
      </div>
      <div className="crm-assistant-prompts">
        {['Which tasks are overdue?', 'Move BOE to proposal', 'Create a task for BOE to follow up Friday', 'Draft a follow-up'].map(prompt => (
          <button key={prompt} type="button" onClick={() => submit(prompt)}>{prompt}</button>
        ))}
      </div>
      <div className="crm-assistant-body" ref={bodyRef}>
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`crm-message ${message.role}`}>
            <p>{message.text}</p>
            {message.links?.length ? (
              <div className="crm-message-links">
                {message.links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}
              </div>
            ) : null}
            {message.proposedActions?.length ? (
              <div className="crm-confirmation-stack">
                {message.proposedActions.map(action => (
                  <article key={action.id} className="crm-confirmation-card">
                    <div>
                      <small>Pending confirmation</small>
                      <strong>{action.label}</strong>
                      <p>{action.description}</p>
                    </div>
                    {action.record ? <Link href={action.record.href ?? '#'}>{action.record.label}</Link> : null}
                    {action.before?.length || action.after?.length ? (
                      <dl>
                        {action.before?.map(item => (
                          <div key={`before-${item.label}`}><dt>Before {item.label}</dt><dd>{item.value}</dd></div>
                        ))}
                        {action.after?.map(item => (
                          <div key={`after-${item.label}`}><dt>After {item.label}</dt><dd>{item.value}</dd></div>
                        ))}
                      </dl>
                    ) : null}
                    <div className="crm-confirmation-actions">
                      <button type="button" onClick={() => confirmAction(action)} disabled={confirmingId === action.id}>
                        {confirmingId === action.id ? <Loader2 size={14} className="crm-spin" /> : null}
                        Confirm
                      </button>
                      <button type="button" onClick={() => setMessages(prev => [...prev, { role: 'assistant', text: `Cancelled: ${action.label}.` }])} disabled={confirmingId === action.id}>Cancel</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {loading ? <div className="crm-message assistant loading"><Loader2 size={15} className="crm-spin" /> Reading CRM context...</div> : null}
      </div>
      <form onSubmit={event => { event.preventDefault(); submit() }} className="crm-assistant-form">
        <textarea value={input} onChange={event => setInput(event.target.value)} placeholder="Ask Halvex..." />
        <button type="submit" disabled={loading || !input.trim()} aria-label="Send"><Send size={18} /></button>
      </form>
    </aside>
  )
}

export function CrmPage({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`crm-page ${wide ? 'wide' : ''}`}>{children}</div>
}

export function CrmHeader({ eyebrow, title, description, actions, meta }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <section className="crm-header">
      <div>
        {eyebrow ? <small>{eyebrow}</small> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {meta ? <div className="crm-header-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="crm-header-actions">{actions}</div> : null}
    </section>
  )
}

export function ScenicHero({ eyebrow, title, description, actions, children, compact: isCompact = false, className = '' }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; children?: ReactNode; compact?: boolean; className?: string }) {
  return (
    <section className={`crm-scenic-hero ${isCompact ? 'compact' : ''} ${className}`}>
      <div className="crm-scenic-copy">
        {eyebrow ? <small>{eyebrow}</small> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {actions ? <div className="crm-scenic-actions">{actions}</div> : null}
      </div>
      {children ? <div className="crm-scenic-value">{children}</div> : null}
    </section>
  )
}

export function ScenicPanel(props: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; children?: ReactNode; compact?: boolean; className?: string }) {
  return <ScenicHero {...props} />
}

export function RecordBanner({ eyebrow, title, description, meta, actions }: { eyebrow?: string; title: string; description?: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <ScenicHero eyebrow={eyebrow} title={title} description={description} actions={actions} compact>
      {meta ? <div className="crm-hero-chip-grid">{meta}</div> : null}
    </ScenicHero>
  )
}

export function PageValueStrip({ children, columns = 4 }: { children: ReactNode; columns?: 2 | 3 | 4 }) {
  return <div className={`crm-value-strip columns-${columns}`}>{children}</div>
}

export function PageIntent({ items }: { items: Array<{ label: string; title: string; text: string; action?: ReactNode }> }) {
  return (
    <section className="crm-page-intent" aria-label="Page workflow">
      {items.map(item => (
        <article key={item.title}>
          <small>{item.label}</small>
          <strong>{item.title}</strong>
          <p>{item.text}</p>
          {item.action ? <div className="crm-page-intent-action">{item.action}</div> : null}
        </article>
      ))}
    </section>
  )
}

export function CrmWorkspaceLayout({ children, rail }: { children: ReactNode; rail?: ReactNode }) {
  return <div className={`crm-workspace-layout ${rail ? 'with-rail' : ''}`}><div className="crm-workspace-main">{children}</div>{rail ? <aside className="crm-workspace-rail">{rail}</aside> : null}</div>
}

export function PrimaryActionBar({ children }: { children: ReactNode }) {
  return <div className="crm-primary-action-bar">{children}</div>
}

export function DataWorkspace({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <div className={`crm-data-workspace ${aside ? 'with-aside' : ''}`}><div>{children}</div>{aside ? <aside>{aside}</aside> : null}</div>
}

export function RecordSummaryHeader({ eyebrow, title, description, meta, actions }: { eyebrow?: string; title: string; description?: string; meta?: ReactNode; actions?: ReactNode }) {
  return <ScenicHero eyebrow={eyebrow} title={title} description={description} actions={actions} compact className="record-summary">{meta ? <div className="crm-hero-chip-grid">{meta}</div> : null}</ScenicHero>
}

export function ViewTabs({ tabs }: { tabs: Array<{ href: string; label: string; active?: boolean; icon?: ReactNode }> }) {
  return (
    <div className="crm-view-tabs">
      {tabs.map(tab => (
        <Link key={tab.href} href={tab.href} className={tab.active ? 'active' : ''}>{tab.icon}{tab.label}</Link>
      ))}
    </div>
  )
}

export function RecordTabs({ tabs }: { tabs: Array<{ href: string; label: string; active?: boolean }> }) {
  return (
    <nav className="crm-record-tabs" aria-label="Record sections">
      {tabs.map(tab => <a key={tab.href} href={tab.href} className={tab.active ? 'active' : ''}>{tab.label}</a>)}
    </nav>
  )
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="crm-filter-bar">{children}</div>
}

export function CrmSegmentedFilters<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string; count?: number }>; onChange: (value: T) => void; label?: string }) {
  return (
    <div className="crm-filter-chips" aria-label={label ?? 'Filters'}>
      {options.map(option => (
        <button key={option.value} type="button" className={value === option.value ? 'active' : ''} onClick={() => onChange(option.value)}>
          <span>{option.label}</span>
          {typeof option.count === 'number' ? <small>{option.count}</small> : null}
        </button>
      ))}
    </div>
  )
}

export function LinkedRecordChip({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="crm-linked-chip">{children}</Link>
}

export function ClampedText({ children, lines = 2, className = '', title }: { children: ReactNode; lines?: 1 | 2 | 3; className?: string; title?: string }) {
  return <span className={`crm-clamped lines-${lines} ${className}`.trim()} title={title}>{children}</span>
}

export function MiniTimeline({ items }: { items: Array<{ id: string; title: string; body?: string | null; summary?: string | null; occurredAt?: string | Date | null; source?: string | null; type?: string | null }> }) {
  if (!items.length) return <CrmEmpty title="No activity yet">Notes, emails, meetings, tasks, and field changes will appear here.</CrmEmpty>
  return (
    <div className="crm-mini-timeline">
      {items.map(item => (
        <article key={item.id}>
          <span />
          <div>
            <strong>{item.title}</strong>
            <p>{compact(item.summary || item.body || 'No extra detail saved.', 260)}</p>
            <small>{item.occurredAt ? `${shortDate(item.occurredAt)} · ` : ''}{item.source ?? item.type ?? 'manual'}</small>
          </div>
        </article>
      ))}
    </div>
  )
}

export function DataTable({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`crm-table-wrap ${className}`}>{children}</div>
}

export function CrmPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`crm-panel ${className}`}>{children}</section>
}

export function CrmSectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="crm-section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function CrmButton({ children, href, onClick, tone = 'default', type = 'button', disabled = false, form }: { children: ReactNode; href?: string; onClick?: () => void; tone?: Tone; type?: 'button' | 'submit'; disabled?: boolean; form?: string }) {
  const className = `crm-button ${tone}`
  if (href) return <Link href={href} className={className}>{children}</Link>
  return <button type={type} className={className} onClick={onClick} disabled={disabled} form={form}>{children}</button>
}

export function CrmInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`crm-input ${props.className ?? ''}`.trim()} />
}

export function CrmSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`crm-select ${props.className ?? ''}`.trim()} />
}

export function CrmTable({ children }: { children: ReactNode }) {
  return <DataTable><table className="crm-table">{children}</table></DataTable>
}

export function CrmListRow({ children, href }: { children: ReactNode; href?: string }) {
  if (href) return <Link href={href} className="crm-list-row">{children}</Link>
  return <article className="crm-list-row">{children}</article>
}

export function CrmOverflowActions({ label = 'More', children, ...props }: { label?: string; children: ReactNode } & DetailsHTMLAttributes<HTMLDetailsElement>) {
  return (
    <details {...props} className={`crm-overflow-actions ${props.className ?? ''}`.trim()}>
      <summary>{label}</summary>
      <div>{children}</div>
    </details>
  )
}

export function RecordContextRail({ items }: { items: Array<{ label: string; value: ReactNode; href?: string; tone?: BadgeTone }> }) {
  return (
    <div className="crm-context-rail">
      {items.map(item => (
        <div key={item.label} className="crm-context-item">
          <small>{item.label}</small>
          {item.href ? <Link href={item.href}>{item.value}</Link> : <strong>{item.value}</strong>}
          {item.tone ? <CrmBadge tone={item.tone}>{item.label}</CrmBadge> : null}
        </div>
      ))}
    </div>
  )
}

export function CompactTaskCard({ task, actions }: { task: any; actions?: ReactNode }) {
  const title = String(task.title ?? 'Untitled task')
  return (
    <article className="crm-compact-task-card">
      <div>
        <strong><ClampedText lines={2} title={title}>{title}</ClampedText></strong>
        <p>
          {task.dueAt ? shortDate(task.dueAt) : 'No due date'}
          {task.companyName ? ` · ${task.companyName}` : ''}
          {task.dealTitle ? ` · ${task.dealTitle}` : ''}
        </p>
      </div>
      {actions ? <div className="crm-card-actions">{actions}</div> : null}
    </article>
  )
}

export function CompactPipelineCard({ deal, stages, onMove, moving }: { deal: any; stages?: any[]; onMove?: (dealId: string, stageId: string) => void; moving?: boolean }) {
  const router = useRouter()
  const next = deal.aiNextAction || deal.intelligence?.riskDrivers?.[0] || 'Set next step.'
  return (
    <article
      className="crm-pipeline-card"
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/deals/${deal.id}`)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') router.push(`/deals/${deal.id}`)
      }}
      aria-label={`Open ${deal.title}`}
    >
      <div className="crm-pipeline-card-title">
        <strong><ClampedText lines={2} title={deal.title}>{deal.title}</ClampedText></strong>
        <span className={!deal.companyName ? 'muted' : ''}>{deal.companyName ?? 'Company missing'}</span>
      </div>
      <div className="crm-deal-card-meta">
        <span className={!deal.valueAmount ? 'muted' : ''}>{money(deal.valueAmount)}</span>
        <span className={!deal.expectedCloseDate ? 'muted' : ''}>{shortDate(deal.expectedCloseDate) ?? 'Close missing'}</span>
        <CrmRiskBadge risk={deal.aiRiskLevel} />
      </div>
      <p className="crm-card-next"><span>Next action</span><ClampedText lines={2} title={next}>{next}</ClampedText></p>
      <div className="crm-pipeline-card-actions" onClick={event => event.stopPropagation()}>
        {stages?.length && onMove ? (
          <select className="crm-select" value={deal.stageId ?? ''} disabled={moving} onChange={event => onMove(deal.id, event.target.value)} aria-label={`Move ${deal.title}`}>
            {stages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
        ) : null}
        <CrmButton href={`/deals/${deal.id}`} tone="ghost">Open</CrmButton>
      </div>
    </article>
  )
}

export function CompactIntelligenceCard({ title = 'Deal health', score, confidence, risk, reason, evidence, action }: { title?: string; score?: number | null; confidence?: number | null; risk?: string | null; reason?: string | null; evidence?: string | null; action?: ReactNode }) {
  return (
    <div className="crm-compact-intelligence">
      <div className="crm-compact-intelligence-head">
        <strong>{title}</strong>
        <CrmRiskBadge risk={risk} />
      </div>
      <div className="crm-compact-intelligence-score">
        <span><small>Score</small>{score ?? '—'}</span>
        <span><small>Confidence</small>{typeof confidence === 'number' ? `${confidence}%` : '—'}</span>
      </div>
      {reason ? <p>{compact(reason, 130)}</p> : null}
      {evidence ? <p className="muted">Evidence: {compact(evidence, 120)}</p> : null}
      {action ? <div className="crm-form-actions">{action}</div> : null}
    </div>
  )
}

export function CrmBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`crm-badge ${tone}`}>{children}</span>
}

export function CrmRiskBadge({ risk }: { risk?: string | null }) {
  const value = risk === 'high' || risk === 'medium' || risk === 'low' ? risk : 'unknown'
  const tone: BadgeTone = value === 'high' ? 'danger' : value === 'medium' ? 'warn' : value === 'low' ? 'good' : 'neutral'
  return <CrmBadge tone={tone}>{value === 'unknown' ? 'Unknown risk' : `${value} risk`}</CrmBadge>
}

export function CrmStat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="crm-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  )
}

export function CrmEmpty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="crm-empty">
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  )
}

export function CrmSkeleton({ rows = 4 }: { rows?: number }) {
  return <div className="crm-skeleton">{Array.from({ length: rows }).map((_, index) => <i key={index} />)}</div>
}

export function CrmDealCard({ deal }: { deal: any }) {
  return (
    <Link href={`/deals/${deal.id}`} className="crm-deal-card">
      <div>
        <strong>{deal.title}</strong>
        <p>{deal.companyName ?? 'Unknown company'}</p>
      </div>
      <div className="crm-deal-card-meta">
        <span>{money(deal.valueAmount)}</span>
        <span>{shortDate(deal.expectedCloseDate) ?? 'No close date'}</span>
        <CrmRiskBadge risk={deal.aiRiskLevel} />
      </div>
      <p>{compact(deal.aiNextAction || deal.intelligence?.riskDrivers?.[0] || 'Set next step.', 64)}</p>
    </Link>
  )
}

export function CompactDealCard({ deal }: { deal: any }) {
  const next = deal.aiNextAction || deal.intelligence?.riskDrivers?.[0] || 'Set next step.'
  return (
    <Link href={`/deals/${deal.id}`} className="crm-compact-deal-card">
      <div className="crm-compact-deal-card-top">
        <div>
          <strong><ClampedText lines={2} title={deal.title}>{deal.title}</ClampedText></strong>
          <p><ClampedText lines={1}>{deal.companyName ?? 'Unknown company'}</ClampedText></p>
        </div>
        <CrmRiskBadge risk={deal.aiRiskLevel} />
      </div>
      <div className="crm-deal-card-meta">
        <span>{money(deal.valueAmount)}</span>
        <span>{shortDate(deal.expectedCloseDate) ?? 'No close date'}</span>
      </div>
      <p className="crm-card-next"><span>Next</span><ClampedText lines={2} title={next}>{next}</ClampedText></p>
    </Link>
  )
}

export function money(value?: number | null, currency = 'GBP') {
  if (value == null || Number.isNaN(Number(value))) return 'Value missing'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value))
}

export function shortDate(value?: string | Date | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)
}

export function compact(value: string, max = 120) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 3).trim()}...`
}
