'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import {
  LayoutDashboard, GitBranch, Brain, Zap,
  Plug, Settings, LogOut, Search,
  ChevronLeft, ChevronRight,
  X, MessageSquare,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'
import { identify } from '@/lib/analytics'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// 6-item flat nav
const NAV_ITEMS = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Today',        matchPaths: ['/dashboard'] },
  { href: '/deals',        icon: GitBranch,       label: 'Deals',        matchPaths: ['/deals', '/pipeline'] },
  { href: '/intelligence', icon: Brain,           label: 'Intelligence', matchPaths: ['/intelligence', '/competitors', '/case-studies', '/product-gaps', '/models', '/collateral', '/playbook'] },
  { href: '/workflows',    icon: Zap,             label: 'Loops',        matchPaths: ['/workflows'] },
  { href: '/connections',  icon: Plug,            label: 'Integrations', matchPaths: ['/connections'] },
  { href: '/settings',     icon: Settings,        label: 'Settings',     matchPaths: ['/settings', '/company', '/onboarding'] },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile, toggleCopilot } = useSidebar()
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 })
  const brain = brainRes?.data
  const urgentCount = brain?.urgentDeals?.length ?? 0
  const { data: unmatchedRes } = useSWR('/api/ingest/email/unmatched', fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 })
  const unmatchedEmailCount = unmatchedRes?.pendingCount ?? 0

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

  const w = collapsed ? '52px' : '216px'

  // Brain age indicator
  const brainAgeInfo = brain?.updatedAt
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(brain.updatedAt).getTime()) / 60000)
        const label = mins < 1 ? 'live' : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`
        const color = mins < 60 ? '#10b981' : mins < 1440 ? '#f59e0b' : '#ef4444'
        return { label, color, mins }
      })()
    : null

  function NavItem({
    href, icon: Icon, label, badge, matchPaths
  }: {
    href: string; icon: React.ElementType; label: string
    badge?: { count: number; color: string }; matchPaths?: string[]
  }) {
    const active = isActive(href, matchPaths)

    return (
      <Link
        href={href}
        onClick={() => closeMobile()}
        title={collapsed ? label : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: collapsed ? '0' : '0 10px 0 11px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          height: '30px',
          borderRadius: '6px',
          marginBottom: '1px',
          textDecoration: 'none',
          fontSize: '12.5px',
          fontWeight: active ? 500 : 400,
          letterSpacing: '-0.01em',
          color: active ? 'var(--text-primary)' : 'rgba(226,232,240,0.40)',
          background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
          borderLeft: active && !collapsed ? '2px solid #7c6df5' : '2px solid transparent',
          transition: 'all 0.12s ease',
          position: 'relative',
          flexShrink: 0,
          width: collapsed ? '36px' : undefined,
          margin: collapsed ? '0 auto 1px' : undefined,
        }}
        onMouseEnter={e => {
          if (!active) {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(255,255,255,0.03)'
            el.style.color = 'rgba(226,232,240,0.65)'
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'transparent'
            el.style.color = 'rgba(226,232,240,0.40)'
          }
        }}
      >
        <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon
            size={14}
            style={{
              color: active ? '#7c6df5' : 'rgba(226,232,240,0.30)',
              display: 'block',
              transition: 'color 0.12s ease',
            }}
          />
          {badge && badge.count > 0 && (
            <div style={{
              position: 'absolute', top: '-3px', right: '-4px',
              width: '5px', height: '5px', borderRadius: '50%',
              background: badge.color,
            }} />
          )}
        </div>

        {!collapsed && <span style={{ flex: 1, lineHeight: 1 }}>{label}</span>}

        {!collapsed && badge && badge.count > 0 && (
          <span style={{
            fontSize: '10px', fontWeight: 600,
            color: badge.color === '#ef4444' ? '#f87171' : '#fbbf24',
            background: badge.color === '#ef4444' ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)',
            padding: '1px 5px', borderRadius: '100px',
          }}>{badge.count}</span>
        )}
      </Link>
    )
  }

  function Divider() {
    return <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)', margin: '5px 0' }} />
  }

  const SidebarContent = (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: w,
      background: 'rgba(8, 6, 20, 0.72)',
      backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', flexDirection: 'column', zIndex: 40,
      transition: 'width 0.18s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>

      {/* ── Logo row ── */}
      <div style={{
        padding: collapsed ? '14px 0 10px' : '14px 10px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        marginBottom: '6px',
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{
              width: '26px', height: '26px',
              background: 'rgba(124,109,245,0.10)',
              border: '1px solid rgba(124,109,245,0.25)',
              borderRadius: '7px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Brain size={13} color="#7c6df5" strokeWidth={1.8} />
            </div>
            <span style={{
              color: 'rgba(226,232,240,0.90)',
              letterSpacing: '3px',
              fontSize: '10.5px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}>HALVEX</span>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: '26px', height: '26px',
            background: 'rgba(124,109,245,0.10)',
            border: '1px solid rgba(124,109,245,0.25)',
            borderRadius: '7px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Brain size={13} color="#7c6df5" strokeWidth={1.8} />
          </div>
        )}

        <button
          onClick={() => { mobileOpen ? closeMobile() : toggleCollapsed() }}
          style={{
            background: 'none', border: 'none',
            color: 'rgba(226,232,240,0.20)', cursor: 'pointer',
            padding: '4px', borderRadius: '5px', display: 'flex',
            transition: 'color 0.12s, background 0.12s',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(226,232,240,0.50)'
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(226,232,240,0.20)'
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
        >
          {mobileOpen ? <X size={12} /> : collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* ── Search ── */}
      <div style={{ padding: collapsed ? '0 0 5px' : '0 8px 5px', display: 'flex', justifyContent: 'center' }}>
        {!collapsed ? (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            style={{
              width: '100%', height: '28px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', padding: '0 9px',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.09)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'
            }}
          >
            <Search size={11} style={{ color: 'rgba(226,232,240,0.25)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '11.5px', color: 'rgba(226,232,240,0.25)', textAlign: 'left' }}>Search</span>
            <span style={{
              fontSize: '10px', color: 'rgba(226,232,240,0.18)',
              background: 'rgba(255,255,255,0.04)', padding: '1px 5px',
              borderRadius: '4px', letterSpacing: '0.02em',
            }}>⌘P</span>
          </button>
        ) : (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            title="Search (⌘P)"
            style={{
              width: '32px', height: '28px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s ease',
            }}
          >
            <Search size={11} style={{ color: 'rgba(226,232,240,0.25)' }} />
          </button>
        )}
      </div>

      {/* ── Ask AI ── */}
      <div style={{ padding: collapsed ? '0 0 8px' : '0 8px 8px', display: 'flex', justifyContent: 'center' }}>
        {!collapsed ? (
          <button
            onClick={toggleCopilot}
            style={{
              width: '100%', height: '28px', borderRadius: '6px',
              background: 'rgba(124,109,245,0.07)',
              border: '1px solid rgba(124,109,245,0.18)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', padding: '0 9px',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(124,109,245,0.13)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,109,245,0.30)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(124,109,245,0.07)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,109,245,0.18)'
            }}
          >
            <MessageSquare size={11} style={{ color: '#7c6df5', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '11.5px', fontWeight: 500, color: '#7c6df5', textAlign: 'left', letterSpacing: '-0.01em' }}>
              Ask AI
            </span>
            <span style={{
              fontSize: '10px', color: 'rgba(124,109,245,0.40)',
              background: 'rgba(124,109,245,0.07)', padding: '1px 5px',
              borderRadius: '4px',
            }}>⌘K</span>
          </button>
        ) : (
          <button
            onClick={toggleCopilot}
            title="Ask AI (⌘K)"
            style={{
              width: '32px', height: '28px', borderRadius: '6px',
              background: 'rgba(124,109,245,0.07)',
              border: '1px solid rgba(124,109,245,0.18)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s ease',
            }}
          >
            <MessageSquare size={11} style={{ color: '#7c6df5' }} />
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: collapsed ? '0 4px' : '0 6px', overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV_ITEMS.map(item => (
          <NavItem
            key={item.href}
            {...item}
            badge={
              item.href === '/deals' && urgentCount > 0
                ? { count: urgentCount, color: '#ef4444' }
                : item.href === '/settings' && unmatchedEmailCount > 0
                ? { count: unmatchedEmailCount, color: '#f59e0b' }
                : undefined
            }
          />
        ))}
      </nav>

      {/* ── Footer: brain status + user ── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.04)',
        padding: collapsed ? '8px 4px' : '8px',
        flexShrink: 0,
      }}>

        {/* Brain status pill */}
        {!collapsed && brainAgeInfo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '5px 9px', marginBottom: '6px', borderRadius: '6px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
              background: brainAgeInfo.color,
              animation: brainAgeInfo.mins < 2 ? 'pulse-dot 2s ease-in-out infinite' : 'none',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(226,232,240,0.45)' }}>
                {urgentCount > 0 ? `${urgentCount} deals flagged` : 'Intelligence ready'}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(226,232,240,0.22)', marginTop: '1px' }}>
                Updated {brainAgeInfo.label}
              </div>
            </div>
          </div>
        )}

        {/* User row */}
        {collapsed ? (
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            title="Sign out"
            style={{
              width: '32px', height: '28px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(226,232,240,0.25)', margin: '0 auto',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.color = 'rgba(226,232,240,0.50)'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.color = 'rgba(226,232,240,0.25)'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'
            }}
          >
            <LogOut size={11} />
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 9px', borderRadius: '6px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.10)',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 600, color: 'rgba(226,232,240,0.70)',
            }}>
              {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '11.5px', fontWeight: 500, letterSpacing: '-0.01em',
                color: 'rgba(226,232,240,0.65)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Account'}
              </div>
              <div style={{
                fontSize: '10px', color: 'rgba(226,232,240,0.28)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px',
              }}>
                {user?.emailAddresses?.[0]?.emailAddress ?? ''}
              </div>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              style={{
                background: 'none', border: 'none', padding: '3px',
                color: 'rgba(226,232,240,0.22)', borderRadius: '4px',
                display: 'flex', alignItems: 'center', cursor: 'pointer',
                transition: 'color 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(226,232,240,0.50)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(226,232,240,0.22)'}
              title="Sign out"
            >
              <LogOut size={11} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )

  // Mobile bottom tab bar items
  const MOBILE_TABS = [
    { href: '/dashboard',   icon: LayoutDashboard, label: 'Today' },
    { href: '/deals',       icon: GitBranch,        label: 'Deals' },
    { href: '/intelligence', icon: Brain,           label: 'Intel' },
    { href: '/workflows',   icon: Zap,             label: 'Flows' },
  ]

  return (
    <>
      <div className="desktop-sidebar">{SidebarContent}</div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,0.75)' }}
          onClick={closeMobile}
        />
      )}

      {/* Mobile slide-out */}
      <div
        className="mobile-sidebar"
        style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 40,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.18s cubic-bezier(0.4,0,0.2,1)',
          width: '216px',
        }}
      >
        {SidebarContent}
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '56px',
        background: 'rgba(6, 4, 18, 0.80)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'none',
        alignItems: 'center', justifyContent: 'space-around',
        zIndex: 1000, padding: '0 8px',
      }}>
        {MOBILE_TABS.map(tab => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '3px', textDecoration: 'none', padding: '6px 12px', borderRadius: '7px',
                minWidth: '48px', minHeight: '44px',
              }}
            >
              <tab.icon size={20} style={{ color: active ? '#7c6df5' : 'rgba(226,232,240,0.30)' }} />
              <span style={{
                fontSize: '10px', fontWeight: active ? 500 : 400,
                color: active ? '#7c6df5' : 'rgba(226,232,240,0.30)',
                lineHeight: 1,
              }}>{tab.label}</span>
            </Link>
          )
        })}
        <button
          onClick={toggleCopilot}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '3px', background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 12px', borderRadius: '7px',
            minWidth: '48px', minHeight: '44px',
          }}
        >
          <MessageSquare size={20} style={{ color: '#7c6df5' }} />
          <span style={{ fontSize: '10px', fontWeight: 400, color: '#7c6df5', lineHeight: 1 }}>Ask AI</span>
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
