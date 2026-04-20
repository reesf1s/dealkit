'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import {
  ArrowRight,
  Ellipsis,
  Menu,
  Search,
  Send,
  Share2,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'

const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Enterprise Pipeline',
  '/deals': 'Deals',
  '/analytics': 'Signals',
  '/connections': 'Conversations',
  '/contacts': 'Contacts',
  '/company': 'Accounts',
  '/automations': 'Automations',
  '/settings': 'Settings',
  '/calendar': 'Calendar',
}

export default function TopNav() {
  const pathname = usePathname()
  const { sidebarWidth, openMobile, activeDeal, sendToCopilot } = useSidebar()

  const breadcrumb = useMemo(() => {
    const base = Object.entries(PAGE_LABELS).find(([route]) => pathname === route || pathname.startsWith(`${route}/`))
    if (pathname.startsWith('/deals/') && activeDeal) {
      return ['Deals', 'Enterprise Pipeline', activeDeal.company]
    }
    return ['Halvex', base?.[1] ?? 'Workspace']
  }, [activeDeal, pathname])

  const isDealPage = pathname.startsWith('/deals/')

  return (
    <header
      className="surface-glass-heavy"
      style={{
        position: 'fixed',
        top: 0,
        left: sidebarWidth,
        right: 0,
        zIndex: 25,
        padding: '12px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: '1px solid rgba(20, 17, 10, 0.06)',
        transition: 'left 0.16s ease',
      }}
    >
      <button
        onClick={openMobile}
        className="topnav-mobile"
        style={{
          display: 'none',
          width: 28,
          height: 28,
          borderRadius: 6,
          border: '1px solid rgba(255, 255, 255, 0.72)',
          background: 'rgba(255, 255, 255, 0.48)',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        aria-label="Open sidebar"
      >
        <Menu size={14} strokeWidth={1.8} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {breadcrumb.map((crumb, index) => (
          <div key={`${crumb}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {index > 0 && (
              <span style={{ color: 'var(--ink-4)', fontSize: 12.5 }}>/</span>
            )}
            <span
              style={{
                fontSize: 12.5,
                color: index === breadcrumb.length - 1 ? 'var(--ink)' : 'var(--ink-3)',
                fontWeight: index === breadcrumb.length - 1 ? 500 : 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {crumb}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid transparent',
            background: 'transparent',
            display: 'grid',
            placeItems: 'center',
          }}
          aria-label="Open command palette"
        >
          <Search size={14} strokeWidth={1.8} />
        </button>
        <button
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid transparent',
            background: 'transparent',
            display: 'grid',
            placeItems: 'center',
          }}
          onClick={async () => {
            await navigator.clipboard.writeText(window.location.href)
          }}
          aria-label="Share"
        >
          <Share2 size={14} strokeWidth={1.8} />
        </button>
        <button
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid transparent',
            background: 'transparent',
            display: 'grid',
            placeItems: 'center',
          }}
          onClick={() => sendToCopilot(`Summarise what matters most on ${activeDeal?.name ?? 'this page'}.`)}
          aria-label="More"
        >
          <Ellipsis size={14} strokeWidth={1.8} />
        </button>
        <button className="btn-glass" onClick={() => sendToCopilot(`Log activity for ${activeDeal?.name ?? 'this account'}.`)}>
          <Send size={13} strokeWidth={2} />
          {isDealPage ? 'Log activity' : 'Ask Halvex'}
        </button>
        <button
          className="btn-primary"
          onClick={() => sendToCopilot(`Advance ${activeDeal?.name ?? 'this deal'} to the next best action.`)}
        >
          <ArrowRight size={13} strokeWidth={2} />
          {isDealPage ? 'Advance stage' : 'Next action'}
        </button>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .topnav-mobile {
            display: inline-flex !important;
          }
        }
      `}</style>
    </header>
  )
}
