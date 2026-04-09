'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import useSWR from 'swr'
import {
  LayoutDashboard, Radio, MessageSquare, Target, Users, BarChart2, // Users/BarChart2 kept — may be used elsewhere
  Settings, LogOut, Search, ChevronLeft, ChevronRight,
  X, Handshake, UserCheck, Clock, Snowflake, Sun, Moon,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'
import { identify } from '@/lib/analytics'
import { fetcher } from '@/lib/fetcher'

/* ── Nav structure ─────────────────────────────────────────────────────── */

const CORE_ITEMS = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Today',          matchPaths: ['/dashboard'] },
  { href: '/deals',        icon: Target,          label: 'Deals',          matchPaths: ['/deals', '/pipeline'] },
  { href: '/intelligence', icon: Radio,           label: 'Intelligence',   matchPaths: ['/intelligence', '/competitors', '/case-studies', '/models', '/collateral', '/playbook', '/analytics'] },
  { href: '/connections',  icon: MessageSquare,   label: 'Integrations',   matchPaths: ['/connections', '/contacts'] },
]

const FOCUS_ZONES = [
  { id: 'ready_to_close',    icon: Handshake,  label: 'Ready to Close',    href: '/deals?focus=ready_to_close' },
  { id: 'engaged_recently',  icon: UserCheck,  label: 'Engaged Recently',  href: '/deals?focus=engaged_recently' },
  { id: 'waiting_on_reply',  icon: Clock,      label: 'Waiting on Reply',  href: '/deals?focus=waiting_on_reply' },
  { id: 'cold',              icon: Snowflake,  label: 'Cold',              href: '/deals?focus=cold' },
]

/* ── Sub-components ────────────────────────────────────────────────────── */

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return null
  return (
    <div style={{
      fontSize: 10.5,
      fontWeight: 600,
      color: 'var(--text-tertiary)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      padding: '20px 10px 6px',
      userSelect: 'none',
    }}>
      {label}
    </div>
  )
}

function NavItem({
  href, icon: Icon, label, badge, count, collapsed, onClick, active,
}: {
  href: string
  icon: React.ElementType
  label: string
  badge?: boolean
  count?: number
  collapsed: boolean
  onClick?: () => void
  active: boolean
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: collapsed ? '0 10px' : '0 10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        height: 36,
        borderRadius: 8,
        marginBottom: 1,
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        letterSpacing: '-0.005em',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: active ? 'var(--surface-active)' : 'transparent',
        transition: 'background 100ms ease, color 100ms ease',
        position: 'relative',
        flexShrink: 0,
        width: collapsed ? 32 : undefined,
        margin: collapsed ? '0 auto 1px' : '0 0 1px 0',
      }}
      onMouseEnter={e => {
        if (!active) {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'var(--surface-2)'
          el.style.color = 'var(--text-primary)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'transparent'
          el.style.color = 'var(--text-secondary)'
        }
      }}
    >
      <Icon
        size={16}
        style={{
          color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
          flexShrink: 0,
          strokeWidth: active ? 2 : 1.4,
          transition: 'color 100ms ease',
        }}
      />

      {!collapsed && <span style={{ flex: 1, lineHeight: 1 }}>{label}</span>}

      {!collapsed && count != null && count > 0 && (
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-muted)',
        }}>
          {count}
        </span>
      )}

      {/* Urgent dot (collapsed only) */}
      {badge && collapsed && (
        <div style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#ef4444',
          border: '1.5px solid var(--sidebar-bg)',
        }} />
      )}
    </Link>
  )
}

/* ── Main Sidebar ──────────────────────────────────────────────────────── */

export default function Sidebar() {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()
  const { theme, setTheme } = useTheme()
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile, toggleCopilot } = useSidebar()

  const { data: brainRes, error: brainError } = useSWR('/api/brain', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })
  const brain = brainRes?.data
  const urgentCount = brain?.urgentDeals?.length ?? 0

  const { data: unmatchedRes, error: unmatchedError } = useSWR('/api/ingest/email/unmatched', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  const unmatchedEmailCount = unmatchedRes?.pendingCount ?? 0
  const hasDegradedFeeds = Boolean(brainError || unmatchedError)

  useEffect(() => {
    if (user) {
      identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
        $created: user.createdAt,
      })
    }
  }, [user])

  const isActive = (href: string, matchPaths?: string[]) => {
    const paths = matchPaths ? [href, ...matchPaths] : [href]
    return paths.some(p => pathname === p || pathname.startsWith(p + '/'))
  }

  const isFocusActive = (href: string) => {
    try {
      const url = new URL(href, 'http://x')
      return pathname === url.pathname && typeof window !== 'undefined' && window.location.search === url.search
    } catch {
      return false
    }
  }

  const w = collapsed ? '64px' : '240px'

  const brainAgeInfo = brain?.updatedAt
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(brain.updatedAt).getTime()) / 60000)
        const label = mins < 1 ? 'live' : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`
        const color = mins < 60 ? '#22c55e' : mins < 1440 ? '#f59e0b' : '#ef4444'
        return { label, color, mins }
      })()
    : null

  const SidebarContent = (
    <aside style={{
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      width: w,
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--border-default)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 40,
      transition: 'width 0.15s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: collapsed ? '12px 0 8px' : '12px 12px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        flexShrink: 0,
      }}>
        {!collapsed && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            minWidth: 0,
          }}>
            {/* Logo */}
            <div style={{
              width: 30,
              height: 30,
              background: 'linear-gradient(135deg, #1DB86A, #15803d)',
              borderRadius: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.05em' }}>H</span>
            </div>
            <span style={{
              fontSize: 15.5,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.04em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              Halvex
            </span>
          </div>
        )}

        {collapsed && (
          <div style={{
            width: 30,
            height: 30,
            background: 'linear-gradient(135deg, #1DB86A, #15803d)',
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>H</span>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => { mobileOpen ? closeMobile() : toggleCollapsed() }}
          style={{
            width: 22,
            height: 22,
            border: '1px solid var(--border-default)',
            borderRadius: 5,
            background: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'color 100ms, border-color 100ms',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.color = 'var(--text-secondary)'
            el.style.borderColor = 'var(--border-default)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.color = 'var(--text-tertiary)'
            el.style.borderColor = 'var(--border-default)'
          }}
        >
          {mobileOpen ? <X size={12} /> : collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* ── Search ── */}
      <div style={{ padding: collapsed ? '0 8px 8px' : '0 12px 8px' }}>
        {!collapsed ? (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            style={{
              width: '100%',
              height: 32,
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid var(--border-default)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 10px',
              transition: 'border-color 100ms ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'
            }}
          >
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)', textAlign: 'left' }}>
              Search...
            </span>
            <span style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              background: 'var(--surface-2)',
              padding: '1px 5px',
              borderRadius: 4,
            }}>⌘P</span>
          </button>
        ) : (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            title="Search (⌘P)"
            style={{
              width: 36,
              height: 32,
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid var(--border-default)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              transition: 'border-color 100ms ease',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: collapsed ? '0 8px' : '0 10px', overflowY: 'auto', overflowX: 'hidden' }}>

        {CORE_ITEMS.map(item => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            badge={item.href === '/deals' && urgentCount > 0}
            collapsed={collapsed}
            onClick={closeMobile}
            active={isActive(item.href, item.matchPaths)}
          />
        ))}

        {/* FOCUS ZONES section */}
        <SectionLabel label="Focus Zones" collapsed={collapsed} />
        {FOCUS_ZONES.map(zone => {
          // Map brain signals to focus zone counts
          const urgentCount = brain?.urgentDeals?.length ?? 0
          const staleCount = brain?.staleDeals?.length ?? 0
          // ready_to_close = deals in negotiation or with high score (use urgentDeals as proxy)
          // waiting_on_reply = stale deals
          // cold = stale deals that have been silent a long time (use staleCount)
          const count =
            zone.id === 'ready_to_close' ? (urgentCount > 0 ? urgentCount : undefined)
            : zone.id === 'waiting_on_reply' ? (staleCount > 0 ? staleCount : undefined)
            : zone.id === 'cold' ? (staleCount > 0 ? staleCount : undefined)
            : undefined

          return (
            <NavItem
              key={zone.id}
              href={zone.href}
              icon={zone.icon}
              label={zone.label}
              count={count}
              collapsed={collapsed}
              onClick={closeMobile}
              active={isFocusActive(zone.href)}
            />
          )
        })}

        {/* Settings — bottom of nav */}
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
          <NavItem
            href="/settings"
            icon={Settings}
            label="Settings"
            badge={unmatchedEmailCount > 0}
            collapsed={collapsed}
            onClick={closeMobile}
            active={isActive('/settings', ['/settings', '/company', '/onboarding'])}
          />
        </div>
      </nav>

      {/* ── Ask AI ── */}
      <div style={{ padding: collapsed ? '8px' : '8px 10px', borderTop: '1px solid var(--border-default)' }}>
        {!collapsed ? (
          <button
            onClick={toggleCopilot}
            style={{
              width: '100%',
              height: 32,
              borderRadius: 8,
              background: 'var(--brand-bg)',
              border: '1px solid var(--brand-border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 10px',
              transition: 'background 100ms ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--brand-bg-hover)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--brand-bg)'
            }}
          >
            <MessageSquare size={13} style={{ color: '#1DB86A', flexShrink: 0 }} />
            <span style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 500,
              color: '#1DB86A',
              textAlign: 'left',
            }}>
              Ask AI
            </span>
            <span style={{
              fontSize: 10,
              color: 'rgba(29, 184, 106, 0.6)',
              background: 'rgba(29, 184, 106, 0.12)',
              padding: '1px 5px',
              borderRadius: 4,
            }}>⌘K</span>
          </button>
        ) : (
          <button
            onClick={toggleCopilot}
            title="Ask AI (⌘K)"
            style={{
              width: 36,
              height: 32,
              borderRadius: 8,
              background: 'var(--brand-bg)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
            }}
          >
            <MessageSquare size={14} style={{ color: '#1DB86A' }} />
          </button>
        )}
      </div>

      {/* ── User profile ── */}
      <div style={{
        borderTop: '1px solid var(--border-default)',
        padding: collapsed ? '8px' : '8px 10px',
        flexShrink: 0,
      }}>
        {/* Brain status indicator */}
        {!collapsed && (brainAgeInfo || hasDegradedFeeds) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 8px',
            marginBottom: 6,
            borderRadius: 7,
            background: hasDegradedFeeds ? 'var(--color-amber-bg)' : 'var(--brand-bg)',
            border: `1px solid ${hasDegradedFeeds ? 'var(--color-amber)' : 'var(--brand-border)'}`,
          }}>
            <div style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              flexShrink: 0,
              background: hasDegradedFeeds ? '#f59e0b' : brainAgeInfo?.color ?? '#22c55e',
              animation: brainAgeInfo && brainAgeInfo.mins < 2 ? 'pulse-dot 2s ease-in-out infinite' : 'none',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: hasDegradedFeeds ? '#92400e' : '#15803d' }}>
                {hasDegradedFeeds ? 'Intelligence degraded' : urgentCount > 0 ? `${urgentCount} deals flagged` : 'Intelligence live'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                {hasDegradedFeeds ? 'One or more feeds unavailable' : brainAgeInfo ? `Updated ${brainAgeInfo.label}` : 'Waiting for update'}
              </div>
            </div>
          </div>
        )}

        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            {/* Dark mode toggle — collapsed */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              style={{
                width: 36, height: 28, borderRadius: 7, background: 'transparent', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-tertiary)', margin: '0 auto', transition: 'background 100ms, color 100ms',
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text-secondary)'; el.style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text-tertiary)'; el.style.background = 'transparent' }}
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            title="Sign out"
            style={{
              width: 36,
              height: 32,
              borderRadius: 7,
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              margin: '0 auto',
              transition: 'background 100ms, color 100ms',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.color = 'var(--text-secondary)'
              el.style.background = 'var(--surface-2)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.color = 'var(--text-tertiary)'
              el.style.background = 'transparent'
            }}
          >
            <LogOut size={14} />
          </button>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 8px',
            borderRadius: 7,
            cursor: 'default',
            transition: 'background 100ms',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            {/* User avatar */}
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1DB86A, #15803d)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#ffffff',
            }}>
              {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12.5,
                fontWeight: 500,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Account'}
              </div>
              <div style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: 1,
              }}>
                {user?.emailAddresses?.[0]?.emailAddress ?? ''}
              </div>
            </div>
            {/* Dark mode toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                background: 'none',
                border: 'none',
                padding: 3,
                color: 'var(--text-muted)',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'color 100ms',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#777777'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#cccccc'}
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </button>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              style={{
                background: 'none',
                border: 'none',
                padding: 3,
                color: 'var(--text-muted)',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'color 100ms',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#777777'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#cccccc'}
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )

  /* ── Mobile bottom nav ── */
  const MOBILE_TABS = [
    { href: '/dashboard',    icon: LayoutDashboard, label: 'Overview' },
    { href: '/deals',        icon: Target,          label: 'Deals' },
    { href: '/intelligence', icon: Radio,           label: 'Signals' },
    { href: '/connections',  icon: MessageSquare,   label: 'Conversations' },
  ]

  return (
    <>
      <div className="desktop-sidebar">{SidebarContent}</div>

      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0, 0, 0, 0.25)' }}
          onClick={closeMobile}
        />
      )}

      <div
        className="mobile-sidebar"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 40,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.15s cubic-bezier(0.4,0,0.2,1)',
          width: '240px',
        }}
      >
        {SidebarContent}
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: 'var(--surface-1)',
        borderTop: '1px solid var(--border-default)',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 1000,
        padding: '0 4px',
      }}>
        {MOBILE_TABS.map(tab => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                textDecoration: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                minWidth: 52,
                minHeight: 44,
              }}
            >
              <tab.icon
                size={20}
                style={{ color: active ? 'var(--text-primary)' : 'var(--text-tertiary)', strokeWidth: active ? 2 : 1.5 }}
              />
              <span style={{
                fontSize: 10,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                lineHeight: 1,
              }}>
                {tab.label}
              </span>
            </Link>
          )
        })}
        <button
          onClick={toggleCopilot}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px 14px',
            borderRadius: 6,
            minWidth: 52,
            minHeight: 44,
          }}
        >
          <MessageSquare size={20} style={{ color: '#1DB86A' }} />
          <span style={{ fontSize: 10, fontWeight: 500, color: '#1DB86A', lineHeight: 1 }}>Ask AI</span>
        </button>
      </nav>

      <style>{`
        .desktop-sidebar { display: block; }
        .mobile-sidebar  { display: none; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-sidebar  { display: block; }
          .mobile-bottom-nav { display: flex !important; }
          main { margin-left: 0 !important; padding-bottom: 64px !important; }
        }
      `}</style>
    </>
  )
}
