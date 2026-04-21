'use client'

import { usePathname } from 'next/navigation'
import { ArrowRight, Ellipsis, Menu, PanelLeftClose, PanelLeftOpen, Send, Share2 } from 'lucide-react'
import { useSidebar } from './SidebarContext'

const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Enterprise Pipeline',
  '/deals': 'Pipeline',
  '/pipeline': 'Pipeline',
  '/analytics': 'Intelligence',
  '/intelligence': 'Intelligence',
  '/connections': 'Conversations',
  '/contacts': 'Contacts',
  '/company': 'Accounts',
  '/automations': 'Automations',
  '/tasks': 'Tasks',
  '/workflows': 'Automations',
  '/settings': 'Settings',
  '/calendar': 'Calendar',
}

type TopNavProps = {
  variant?: 'global' | 'workspace'
}

export default function TopNav({ variant = 'global' }: TopNavProps) {
  const pathname = usePathname()
  const { activeDeal, collapsed, isMobile, openMobile, sendToCopilot, toggleCollapsed } = useSidebar()
  const isDealPage = pathname.startsWith('/deals/')

  if (variant === 'global' && isDealPage) return null

  const base = Object.entries(PAGE_LABELS).find(([route]) => pathname === route || pathname.startsWith(`${route}/`))
  const breadcrumb =
    variant === 'workspace' && activeDeal
      ? ['Deals', 'Enterprise Pipeline', activeDeal.company]
      : ['Halvex', base?.[1] ?? 'Workspace']

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

      <div className="crumbs">
        {breadcrumb.map((crumb, index) => (
          <div key={`${crumb}-${index}`} style={{ display: 'contents' }}>
            {index > 0 ? <span className="crumb-sep">/</span> : null}
            <span className={index === breadcrumb.length - 1 ? 'crumb-current' : undefined}>{crumb}</span>
          </div>
        ))}
      </div>

      <div className="topbar-actions">
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
          className="icon-btn"
          onClick={() => sendToCopilot(`Summarise what matters most on ${activeDeal?.name ?? 'this page'}.`)}
          aria-label="More"
        >
          <Ellipsis size={14} strokeWidth={1.8} />
        </button>
        <button className="btn" onClick={() => sendToCopilot(`Log activity for ${activeDeal?.name ?? 'this account'}.`)}>
          <Send size={13} strokeWidth={2} />
          {variant === 'workspace' ? 'Log activity' : 'Ask Halvex'}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => sendToCopilot(`Advance ${activeDeal?.name ?? 'this deal'} to the next best action.`)}
        >
          <ArrowRight size={13} strokeWidth={2} />
          {variant === 'workspace' ? 'Advance stage' : 'Next action'}
        </button>
      </div>
    </header>
  )
}
