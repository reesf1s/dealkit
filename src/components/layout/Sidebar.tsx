'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import {
  LayoutDashboard,
  Settings, LogOut, Search,
  ChevronLeft, ChevronRight,
  X, Brain, MessageSquare, GitBranch,
  Plug, Zap,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'
import { identify } from '@/lib/analytics'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// 5-item nav (Settings lives at bottom, separated by divider)
const NAV_ITEMS = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Today',        matchPaths: ['/dashboard'] },
  { href: '/deals',         icon: GitBranch,       label: 'Deals',        matchPaths: ['/deals', '/pipeline'] },
  { href: '/intelligence',  icon: Brain,           label: 'Intelligence', matchPaths: ['/intelligence', '/competitors', '/case-studies', '/product-gaps', '/models', '/collateral', '/playbook'] },
  { href: '/workflows',     icon: Zap,             label: 'Workflows',    matchPaths: ['/workflows'] },
  { href: '/connections',   icon: Plug,            label: 'Connections',  matchPaths: ['/connections', '/company', '/onboarding'] },
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

  const w = collapsed ? '56px' : '216px'

  // Brain age indicator
  const brainAgeInfo = brain?.updatedAt
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(brain.updatedAt).getTime()) / 60000)
        const label = mins < 1 ? 'live' : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`
        const color = mins < 60 ? '#34d399' : mins < 1440 ? '#fbbf24' : '#f87171'
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
          gap: '9px',
          padding: collapsed ? '0' : '0 10px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          height: '34px',
          borderRadius: '10px',
          marginBottom: '2px',
          textDecoration: 'none',
          fontSize: '13px',
          fontWeight: active ? 600 : 400,
          letterSpacing: '-0.01em',
          color: active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.42)',
          background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
          transition: 'all 0.15s ease',
          position: 'relative',
          flexShrink: 0,
          width: collapsed ? '36px' : undefined,
          margin: collapsed ? '0 auto 2px' : undefined,
          // Frost border via inline approach for active state
          boxShadow: active ? 'inset 0 0 0 1px rgba(255,255,255,0.10)' : 'none',
        }}
        onMouseEnter={e => {
          if (!active) {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(255,255,255,0.04)'
            el.style.color = 'rgba(255,255,255,0.70)'
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'transparent'
            el.style.color = 'rgba(255,255,255,0.42)'
          }
        }}
      >
        <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon
            size={15}
            style={{
              color: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
              display: 'block',
              transition: 'color 0.15s ease',
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
            color: badge.color === '#f87171' ? '#f87171' : '#fbbf24',
            background: badge.color === '#f87171' ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)',
            padding: '1px 6px', borderRadius: '100px',
          }}>{badge.count}</span>
        )}
      </Link>
    )
  }

  function SectionLabel({ children }: { children: string }) {
    if (collapsed) return <div style={{ height: '8px' }} />
    return (
      <div style={{
        padding: '10px 10px 4px',
        fontSize: '10px',
        fontWeight: 600,
        color: 'rgba(255,255,255,0.18)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        {children}
      </div>
    )
  }

  function Divider() {
    return <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
  }

  const SidebarContent = (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: w,
      background: 'rgba(8,10,16,0.95)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column', zIndex: 40,
      transition: 'width 0.18s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>

      {/* ── Logo row ── */}
      <div style={{
        padding: collapsed ? '16px 0 12px' : '16px 12px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        marginBottom: '8px',
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Logo mark — frost-border style */}
            <div style={{
              width: '28px', height: '28px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.80) 0%, rgba(139,92,246,0.70) 100%)',
              borderRadius: '9px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 0 1px rgba(255,255,255,0.12), 0 4px 12px rgba(99,102,241,0.30)',
            }}>
              <Brain size={14} color="rgba(255,255,255,0.90)" strokeWidth={2} />
            </div>
            <span style={{
              color: 'rgba(255,255,255,0.85)',
              letterSpacing: '3px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}>HALVEX</span>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: '28px', height: '28px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.80) 0%, rgba(139,92,246,0.70) 100%)',
            borderRadius: '9px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.12), 0 4px 12px rgba(99,102,241,0.30)',
          }}>
            <Brain size={14} color="rgba(255,255,255,0.90)" strokeWidth={2} />
          </div>
        )}

        <button
          onClick={() => { mobileOpen ? closeMobile() : toggleCollapsed() }}
          style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.20)', cursor: 'pointer',
            padding: '4px', borderRadius: '6px', display: 'flex',
            transition: 'color 0.12s, background 0.12s',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.50)'
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.20)'
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
        >
          {mobileOpen ? <X size={13} /> : collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* ── Search ── */}
      <div style={{ padding: collapsed ? '0 0 6px' : '0 8px 6px', display: 'flex', justifyContent: 'center' }}>
        {!collapsed ? (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            style={{
              width: '100%', height: '32px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'
            }}
          >
            <Search size={11} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '12px', color: 'rgba(255,255,255,0.25)', textAlign: 'left' }}>Search</span>
            <span style={{
              fontSize: '10px', color: 'rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)', padding: '1px 5px',
              borderRadius: '4px', letterSpacing: '0.02em',
            }}>⌘P</span>
          </button>
        ) : (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            title="Search (⌘P)"
            style={{
              width: '36px', height: '32px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s ease',
            }}
          >
            <Search size={11} style={{ color: 'rgba(255,255,255,0.25)' }} />
          </button>
        )}
      </div>

      {/* ── Ask AI ── */}
      <div style={{ padding: collapsed ? '0 0 10px' : '0 8px 10px', display: 'flex', justifyContent: 'center' }}>
        {!collapsed ? (
          <button
            onClick={toggleCopilot}
            style={{
              width: '100%', height: '32px', borderRadius: '10px',
              background: 'rgba(99,102,241,0.10)',
              border: '1px solid rgba(99,102,241,0.20)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.18)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.32)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.10)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.20)'
            }}
          >
            <MessageSquare size={12} style={{ color: '#818cf8', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: '#818cf8', textAlign: 'left', letterSpacing: '-0.01em' }}>
              Ask AI
            </span>
            <span style={{
              fontSize: '10px', color: 'rgba(129,140,248,0.45)',
              background: 'rgba(99,102,241,0.10)', padding: '1px 5px',
              borderRadius: '4px',
            }}>⌘K</span>
          </button>
        ) : (
          <button
            onClick={toggleCopilot}
            title="Ask AI (⌘K)"
            style={{
              width: '36px', height: '32px', borderRadius: '10px',
              background: 'rgba(99,102,241,0.10)',
              border: '1px solid rgba(99,102,241,0.20)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s ease',
            }}
          >
            <MessageSquare size={12} style={{ color: '#818cf8' }} />
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
                ? { count: urgentCount, color: '#f87171' }
                : item.href === '/connections' && unmatchedEmailCount > 0
                ? { count: unmatchedEmailCount, color: '#fbbf24' }
                : undefined
            }
          />
        ))}

        <Divider />

        <NavItem
          href="/settings"
          icon={Settings}
          label="Settings"
        />
      </nav>

      {/* ── Footer: brain status + user ── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: collapsed ? '8px 4px' : '8px',
        flexShrink: 0,
      }}>

        {/* Brain status pill */}
        {!collapsed && brainAgeInfo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '6px 10px', marginBottom: '6px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
              background: brainAgeInfo.color,
              boxShadow: `0 0 6px ${brainAgeInfo.color}`,
              animation: brainAgeInfo.mins < 2 ? 'pulse-dot 2s ease-in-out infinite' : 'none',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>
                {urgentCount > 0 ? `${urgentCount} deals flagged` : 'Intelligence ready'}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '1px' }}>
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
              width: '36px', height: '32px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.25)', margin: '0 auto',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
            }}
          >
            <LogOut size={12} />
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 10px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.80), rgba(139,92,246,0.70))',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.90)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.10)',
            }}>
              {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '12px', fontWeight: 500, letterSpacing: '-0.01em',
                color: 'rgba(255,255,255,0.75)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Account'}
              </div>
              <div style={{
                fontSize: '10px', color: 'rgba(255,255,255,0.28)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px',
              }}>
                {user?.emailAddresses?.[0]?.emailAddress ?? ''}
              </div>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              style={{
                background: 'none', border: 'none', padding: '3px',
                color: 'rgba(255,255,255,0.20)', borderRadius: '4px',
                display: 'flex', alignItems: 'center', cursor: 'pointer',
                transition: 'color 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.20)'}
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
    { href: '/dashboard',    icon: LayoutDashboard, label: 'Today' },
    { href: '/deals',        icon: GitBranch,        label: 'Deals' },
    { href: '/intelligence', icon: Brain,            label: 'Intel' },
    { href: '/workflows',    icon: Zap,              label: 'Flows' },
    { href: '/connections',  icon: Plug,             label: 'Connect' },
  ]

  return (
    <>
      <div className="desktop-sidebar">{SidebarContent}</div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(4px)' }}
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
        background: 'rgba(8,10,16,0.96)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
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
                gap: '3px', textDecoration: 'none', padding: '6px 12px', borderRadius: '8px',
                minWidth: '48px', minHeight: '44px',
              }}
            >
              <tab.icon size={16} style={{ color: active ? '#818cf8' : 'rgba(255,255,255,0.30)' }} />
              <span style={{
                fontSize: '10px', fontWeight: active ? 600 : 400,
                color: active ? '#818cf8' : 'rgba(255,255,255,0.30)',
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
            padding: '6px 12px', borderRadius: '8px',
            minWidth: '48px', minHeight: '44px',
          }}
        >
          <MessageSquare size={16} style={{ color: '#818cf8' }} />
          <span style={{ fontSize: '10px', fontWeight: 400, color: '#818cf8', lineHeight: 1 }}>Ask AI</span>
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
