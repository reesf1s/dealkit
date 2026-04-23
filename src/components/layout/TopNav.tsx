'use client'

import { usePathname } from 'next/navigation'
import { ArrowRight, Menu, PanelLeftClose, PanelLeftOpen, Send, Share2, Sparkles } from 'lucide-react'
import { useSidebar } from './SidebarContext'

type PageMeta = {
  match: string[]
  label: string
  context: string
  askLabel: string
  askPrompt: string
  actionLabel: string
  actionPrompt: string
}

const PAGE_META: PageMeta[] = [
  {
    match: ['/dashboard'],
    label: 'Overview',
    context: 'Daily operating view',
    askLabel: 'Ask Halvex',
    askPrompt: 'Summarise the current workspace, what changed most recently, and what the team should focus on first.',
    actionLabel: 'Plan my focus',
    actionPrompt: 'Turn the current overview into a ranked plan for today with the top 3 commercial moves.',
  },
  {
    match: ['/deals', '/pipeline'],
    label: 'Pipeline',
    context: 'Notes-first revenue workspace',
    askLabel: 'Ask Halvex',
    askPrompt: 'Summarise the current pipeline and identify the deals that deserve immediate attention.',
    actionLabel: 'Prioritise deals',
    actionPrompt: 'Rank the most important deals to work next and explain why each matters now.',
  },
  {
    match: ['/analytics', '/intelligence'],
    label: 'Intelligence',
    context: 'Signals and patterns',
    askLabel: 'Ask Halvex',
    askPrompt: 'Explain the strongest pattern, risk, or signal in this intelligence view.',
    actionLabel: 'Explain signal',
    actionPrompt: 'Tell me the single most important signal in the pipeline and how it should change my behaviour.',
  },
  {
    match: ['/tasks'],
    label: 'Tasks',
    context: 'Execution lane',
    askLabel: 'Ask Halvex',
    askPrompt: 'Review the current execution lane and explain which tasks are most commercially important.',
    actionLabel: 'Rank today',
    actionPrompt: 'Rank my open tasks in the best order to do them today and explain the tradeoffs.',
  },
  {
    match: ['/company'],
    label: 'Accounts',
    context: 'Customer context',
    askLabel: 'Ask Halvex',
    askPrompt: 'Summarise the most important account changes and commercial risks in this view.',
    actionLabel: 'Review accounts',
    actionPrompt: 'Tell me which accounts need attention next and what I should do with them.',
  },
  {
    match: ['/contacts', '/connections', '/automations', '/calendar', '/settings', '/workflows'],
    label: 'Workspace',
    context: 'Connected workspace',
    askLabel: 'Ask Halvex',
    askPrompt: 'Summarise what matters on this page and what I should pay attention to next.',
    actionLabel: 'Brief this page',
    actionPrompt: 'Turn this page into a concise action brief for the next 30 minutes.',
  },
]

type TopNavProps = {
  variant?: 'global' | 'workspace'
}

export default function TopNav({ variant = 'global' }: TopNavProps) {
  const pathname = usePathname()
  const { activeDeal, collapsed, isMobile, openMobile, sendToCopilot, toggleCollapsed } = useSidebar()
  const isDealPage = pathname.startsWith('/deals/')

  if (variant === 'global' && isDealPage) return null

  const pageMeta = PAGE_META.find(item =>
    item.match.some(route => pathname === route || pathname.startsWith(`${route}/`)),
  )
  const breadcrumb =
    variant === 'workspace' && activeDeal
      ? ['Deals', 'Enterprise Pipeline', activeDeal.company]
      : ['Halvex', pageMeta?.label ?? 'Workspace']
  const contextPill =
    variant === 'workspace'
      ? activeDeal?.stage?.replace(/_/g, ' ') ?? 'Live deal workspace'
      : pageMeta?.context ?? 'Connected workspace'

  return (
    <header className={variant === 'global' ? 'topbar topbar-global' : 'topbar'}>
      {isMobile ? (
        <button onClick={openMobile} className="icon-btn sidebar-mobile-toggle" aria-label="Open sidebar">
          <Menu size={14} strokeWidth={1.8} />
        </button>
      ) : (
        <button
          onClick={toggleCollapsed}
          className="icon-btn sidebar-desktop-toggle"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={14} strokeWidth={1.8} /> : <PanelLeftClose size={14} strokeWidth={1.8} />}
        </button>
      )}

      <div className="topbar-meta">
        <div className="crumbs">
          {breadcrumb.map((crumb, index) => (
            <div key={`${crumb}-${index}`} style={{ display: 'contents' }}>
              {index > 0 ? <span className="crumb-sep">/</span> : null}
              <span className={index === breadcrumb.length - 1 ? 'crumb-current' : undefined}>{crumb}</span>
            </div>
          ))}
        </div>
        <span className="topbar-context-pill">{contextPill}</span>
      </div>

      <div className="topbar-actions">
        {variant === 'workspace' ? (
          <>
            <button
              className="icon-btn"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href)
              }}
              aria-label="Share"
            >
              <Share2 size={14} strokeWidth={1.8} />
            </button>
            <button
              className="btn topbar-aux-action"
              onClick={() => sendToCopilot(`Summarise the current state of ${activeDeal?.name ?? 'this deal'} using the latest notes and tell me what matters most.`)}
            >
              <Sparkles size={13} strokeWidth={2} />
              Brief me
            </button>
            <button className="btn" onClick={() => sendToCopilot(`Log activity for ${activeDeal?.name ?? 'this account'}.`)}>
              <Send size={13} strokeWidth={2} />
              Log activity
            </button>
            <button
              className="btn btn-primary"
              onClick={() => sendToCopilot(`What is the single next best move on ${activeDeal?.name ?? 'this deal'} and why?`)}
            >
              <ArrowRight size={13} strokeWidth={2} />
              Next move
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => sendToCopilot(pageMeta?.askPrompt ?? 'Summarise what matters most on this page.')}>
              <Sparkles size={13} strokeWidth={2} />
              {pageMeta?.askLabel ?? 'Ask Halvex'}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => sendToCopilot(pageMeta?.actionPrompt ?? 'Turn this page into a ranked action plan.')}
            >
              <ArrowRight size={13} strokeWidth={2} />
              {pageMeta?.actionLabel ?? 'Next action'}
            </button>
          </>
        )}
      </div>
    </header>
  )
}
