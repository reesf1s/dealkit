'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import {
  Bot,
  BriefcaseBusiness,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Gauge,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { avatarGradientFromName, initialsFromName } from '@/lib/presentation'
import { useSidebar } from './SidebarContext'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  matchPaths?: string[]
  count?: number
  signal?: boolean
}

function sectionLabel(label: string, collapsed: boolean) {
  if (collapsed) return null
  return (
    <div
      style={{
        padding: '14px 8px 6px',
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--ink-4)',
      }}
    >
      {label}
    </div>
  )
}

function SidebarNavItem({
  item,
  collapsed,
  active,
  onClick,
}: {
  item: NavItem
  collapsed: boolean
  active: boolean
  onClick?: () => void
}) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 31,
        padding: collapsed ? '6px 8px' : '6px 8px',
        borderRadius: '6px',
        color: active ? 'var(--bg)' : 'var(--ink-2)',
        background: active ? 'var(--ink)' : 'transparent',
        fontSize: 13,
        fontWeight: 450,
        justifyContent: collapsed ? 'center' : 'flex-start',
        transition: 'all 0.16s ease',
      }}
      onMouseEnter={event => {
        if (active) return
        event.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)'
        event.currentTarget.style.color = 'var(--ink)'
      }}
      onMouseLeave={event => {
        if (active) return
        event.currentTarget.style.background = 'transparent'
        event.currentTarget.style.color = 'var(--ink-2)'
      }}
    >
      <Icon
        size={15}
        strokeWidth={1.8}
        style={{ color: active ? 'var(--bg)' : 'var(--ink-3)', flexShrink: 0 }}
      />
      {!collapsed && <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>}
      {!collapsed && item.count != null && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: active ? 'rgba(250, 250, 247, 0.75)' : 'var(--ink-4)',
          }}
        >
          {item.count}
        </span>
      )}
      {!collapsed && item.signal && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--signal)',
            boxShadow: '0 0 0 3px rgba(29, 184, 106, 0.18)',
            flexShrink: 0,
          }}
        />
      )}
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()
  const {
    collapsed,
    mobileOpen,
    closeMobile,
    sidebarWidth,
    toggleCollapsed,
  } = useSidebar()

  const { data: dealsRes } = useSWR('/api/deals', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45_000,
  })

  const { data: automationsRes } = useSWR('/api/automations', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45_000,
  })

  const deals = Array.isArray(dealsRes?.data) ? dealsRes.data : []
  const openDeals = deals.filter((deal: { stage?: string }) => !['closed_won', 'closed_lost'].includes(deal.stage ?? ''))
  const accountCount = new Set(
    deals.map((deal: { prospectCompany?: string | null }) => deal.prospectCompany).filter(Boolean)
  ).size
  const enabledAutomations = Array.isArray(automationsRes?.data)
    ? automationsRes.data.filter((item: { enabled?: boolean }) => item.enabled).length
    : 0

  const pipelineItems: NavItem[] = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/deals', label: 'Deals', icon: BriefcaseBusiness, count: openDeals.length, matchPaths: ['/deals', '/pipeline'] },
    { href: '/company', label: 'Accounts', icon: Target, count: accountCount, matchPaths: ['/company'] },
    { href: '/contacts', label: 'Contacts', icon: Users },
  ]

  const intelligenceItems: NavItem[] = [
    { href: '/analytics', label: 'Signals', icon: Sparkles, signal: enabledAutomations > 0, matchPaths: ['/analytics'] },
    { href: '/dashboard', label: 'Forecast', icon: Gauge, matchPaths: ['/dashboard'] },
    { href: '/connections', label: 'Conversations', icon: MessageSquare, count: 7, matchPaths: ['/connections', '/chat'] },
    { href: '/automations', label: 'Automations', icon: Bot, count: enabledAutomations, matchPaths: ['/automations', '/intelligence'] },
  ]

  const workspaceItems: NavItem[] = [
    { href: '/deals', label: 'Tasks', icon: CircleDashed },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]

  const isActive = (item: NavItem) => {
    const paths = item.matchPaths ? [item.href, ...item.matchPaths] : [item.href]
    return paths.some(path => pathname === path || pathname.startsWith(`${path}/`))
  }

  const sidebar = (
    <aside
      className="surface-glass-heavy"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: mobileOpen && sidebarWidth === 0 ? 232 : sidebarWidth,
        padding: collapsed ? '18px 10px' : '18px 14px',
        borderRight: '1px solid rgba(20, 17, 10, 0.06)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        overflowY: 'auto',
        transition: 'width 0.16s ease, transform 0.16s ease',
        transform: mobileOpen || sidebarWidth > 0 ? 'translateX(0)' : 'translateX(-100%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: collapsed ? '6px 4px 18px' : '6px 8px 18px',
          marginBottom: 6,
        }}
      >
        <Link
          href="/dashboard"
          onClick={closeMobile}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: 'var(--ink)',
              color: 'var(--bg)',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--font-serif)',
              fontSize: 16,
              fontStyle: 'italic',
              letterSpacing: '-0.02em',
              flexShrink: 0,
            }}
          >
            H
          </div>
          {!collapsed && (
            <>
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 19,
                  letterSpacing: '-0.02em',
                  color: 'var(--ink)',
                }}
              >
                Halvex
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 9.5,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-4)',
                  padding: '2px 6px',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                }}
              >
                Beta
              </span>
            </>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={mobileOpen ? closeMobile : toggleCollapsed}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: '1px solid rgba(255, 255, 255, 0.72)',
              background: 'rgba(255, 255, 255, 0.45)',
              display: 'grid',
              placeItems: 'center',
            }}
            aria-label="Collapse sidebar"
          >
            {mobileOpen ? <X size={14} strokeWidth={1.8} /> : <ChevronLeft size={14} strokeWidth={1.8} />}
          </button>
        )}
        {collapsed && !mobileOpen && (
          <button
            onClick={toggleCollapsed}
            style={{
              position: 'absolute',
              top: 20,
              right: 8,
              width: 22,
              height: 22,
              borderRadius: 6,
              border: '1px solid rgba(255, 255, 255, 0.72)',
              background: 'rgba(255, 255, 255, 0.45)',
              display: 'grid',
              placeItems: 'center',
            }}
            aria-label="Expand sidebar"
          >
            <ChevronRight size={13} strokeWidth={1.8} />
          </button>
        )}
      </div>

      <button
        onClick={() => {
          window.dispatchEvent(new CustomEvent('openCommandPalette'))
          closeMobile()
        }}
        className="surface-glass"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: collapsed ? '8px' : '8px 10px',
          borderRadius: 10,
          marginBottom: 10,
        }}
      >
        <Sparkles size={14} strokeWidth={2} style={{ color: 'var(--signal)', flexShrink: 0 }} />
        {!collapsed && (
          <>
            <span style={{ flex: 1, textAlign: 'left', color: 'var(--ink-3)', fontSize: 12.5 }}>
              Ask Halvex anything…
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                color: 'var(--ink-4)',
                padding: '1px 5px',
                borderRadius: 4,
                border: '1px solid rgba(20, 17, 10, 0.08)',
                background: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              ⌘K
            </span>
          </>
        )}
      </button>

      {sectionLabel('Pipeline', collapsed)}
      {pipelineItems.map(item => (
        <SidebarNavItem
          key={item.label}
          item={item}
          collapsed={collapsed}
          active={isActive(item)}
          onClick={closeMobile}
        />
      ))}

      {sectionLabel('Intelligence', collapsed)}
      {intelligenceItems.map(item => (
        <SidebarNavItem
          key={item.label}
          item={item}
          collapsed={collapsed}
          active={isActive(item)}
          onClick={closeMobile}
        />
      ))}

      {sectionLabel('Workspace', collapsed)}
      {workspaceItems.map(item => (
        <SidebarNavItem
          key={item.label}
          item={item}
          collapsed={collapsed}
          active={isActive(item)}
          onClick={closeMobile}
        />
      ))}

      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <button
          className="surface-glass-strong"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: collapsed ? '8px' : '10px',
            borderRadius: 14,
          }}
          onClick={() => signOut()}
          title={collapsed ? 'Sign out' : undefined}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              background: avatarGradientFromName(user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Halvex'),
              flexShrink: 0,
            }}
          >
            {initialsFromName(user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Halvex')}
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0, textAlign: 'left' }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}>
                {user?.fullName ?? 'Halvex user'}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>
                {user?.primaryEmailAddress?.emailAddress ?? 'Workspace'}
              </div>
            </div>
          )}
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {sidebar}
      {mobileOpen && (
        <button
          aria-label="Close sidebar"
          onClick={closeMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 17, 10, 0.18)',
            border: 'none',
            zIndex: 30,
            display: sidebarWidth === 0 ? 'block' : 'none',
          }}
        />
      )}
    </>
  )
}
