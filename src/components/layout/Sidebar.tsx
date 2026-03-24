'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import {
  LayoutDashboard, Building2, Swords,
  FileText, Settings, LogOut, Search,
  ChevronLeft, ChevronRight,
  X, Brain, Zap, Activity, MessageSquare, Home, BookOpen, CalendarDays,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'
import { useTheme } from './ThemeContext'
import { identify } from '@/lib/analytics'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const CORE_ITEMS = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Today',      matchPaths: ['/dashboard'] },
  { href: '/pipeline',   icon: Home,            label: 'Pipeline',   matchPaths: ['/pipeline', '/deals'] },
  { href: '/calendar',   icon: CalendarDays,    label: 'Calendar',   matchPaths: ['/calendar'] },
  { href: '/models',     icon: Brain,           label: 'Models',     matchPaths: ['/models'] },
  { href: '/playbook',   icon: BookOpen,        label: 'Playbook',   matchPaths: ['/playbook'] },
  { href: '/collateral', icon: Zap,             label: 'Collateral', matchPaths: ['/collateral'] },
]

const INTEL_ITEMS = [
  { href: '/competitors', icon: Swords,    label: 'Intelligence', matchPaths: ['/competitors', '/case-studies', '/product-gaps'] },
  { href: '/company',     icon: Building2, label: 'Company',      matchPaths: ['/company', '/onboarding'] },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile, toggleCopilot } = useSidebar()
  const { theme } = useTheme()
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
  const w = collapsed ? '52px' : '210px'

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
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: collapsed ? '0' : '0 9px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          height: '32px', borderRadius: '8px',
          marginBottom: '2px', textDecoration: 'none',
          fontSize: '13px',
          fontWeight: active ? 600 : 500,
          letterSpacing: '-0.01em',
          color: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.50)',
          background: active
            ? 'rgba(124, 58, 237, 0.25)'
            : 'transparent',
          border: active
            ? '1px solid rgba(124, 58, 237, 0.35)'
            : '1px solid transparent',
          boxShadow: active ? '0 0 12px rgba(124,58,237,0.20), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
          backdropFilter: active ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: active ? 'blur(12px)' : 'none',
          transition: 'all 0.15s ease',
          position: 'relative', flexShrink: 0,
          width: collapsed ? '32px' : undefined,
          margin: collapsed ? '0 auto 2px' : undefined,
        }}
        onMouseEnter={e => { if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'
          ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)'
        }}}
        onMouseLeave={e => { if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.50)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
        }}}
      >
        <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon
            size={14}
            style={{
              color: active ? 'rgba(167,139,250,0.95)' : 'rgba(255,255,255,0.40)',
              display: 'block',
              transition: 'color 0.15s ease',
            }}
          />
          {badge && badge.count > 0 && (
            <div style={{
              position: 'absolute', top: '-3px', right: '-4px',
              width: '5px', height: '5px', borderRadius: '50%',
              background: badge.color,
              boxShadow: `0 0 5px ${badge.color}88`,
            }} />
          )}
        </div>
        {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
        {!collapsed && badge && badge.count > 0 && (
          <span style={{
            fontSize: '10px', fontWeight: 600,
            color: '#ef4444',
            background: 'rgba(239,68,68,0.15)',
            padding: '1px 6px', borderRadius: '100px',
          }}>{badge.count}</span>
        )}
      </Link>
    )
  }

  function Divider() {
    return <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />
  }

  function SectionLabel({ children }: { children: string }) {
    if (collapsed) return <div style={{ height: '10px' }} />
    return (
      <div style={{
        padding: '8px 9px 4px',
        fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.28)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        {children}
      </div>
    )
  }

  const brainAgeInfo = brain?.updatedAt
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(brain.updatedAt).getTime()) / 60000)
        const label = mins < 1 ? 'live' : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`
        const color = mins < 60 ? '#10b981' : mins < 1440 ? '#f59e0b' : '#ef4444'
        const glow = mins < 60 ? 'rgba(16,185,129,0.5)' : mins < 1440 ? 'rgba(245,158,11,0.5)' : 'rgba(239,68,68,0.6)'
        const bg = mins < 60 ? 'rgba(16,185,129,0.07)' : mins < 1440 ? 'rgba(245,158,11,0.07)' : 'rgba(239,68,68,0.07)'
        const border = mins < 60 ? 'rgba(16,185,129,0.18)' : mins < 1440 ? 'rgba(245,158,11,0.20)' : 'rgba(239,68,68,0.18)'
        return { label, color, glow, bg, border }
      })()
    : null
  const brainAge = brainAgeInfo?.label ?? null

  const SidebarContent = (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: w,
      background: 'rgba(8, 12, 26, 0.82)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', flexDirection: 'column', zIndex: 40,
      transition: 'width 0.18s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
      boxShadow: '4px 0 32px rgba(0,0,0,0.4)',
    }}>

      {/* ── Logo row ── */}
      <div style={{
        padding: collapsed ? '14px 0 10px' : '14px 10px 10px',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        flexShrink: 0,
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{
              width: '26px', height: '26px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 0 16px rgba(124,58,237,0.50), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}>
              <Brain size={13} color="#fff" strokeWidth={2.5} />
            </div>
            <span className="font-brand-wordmark" style={{
              color: 'rgba(255,255,255,0.90)',
              letterSpacing: '3px',
              fontSize: '12px',
            }}>HALVEX</span>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: '26px', height: '26px',
            background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(124,58,237,0.50)',
          }}>
            <Brain size={13} color="#fff" strokeWidth={2.5} />
          </div>
        )}
        <button
          onClick={() => { mobileOpen ? closeMobile() : toggleCollapsed() }}
          style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.28)', cursor: 'pointer',
            padding: '4px', borderRadius: '6px', display: 'flex',
            transition: 'color 0.12s, background 0.12s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)'
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.28)'
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
              width: '100%', height: '30px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.09)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', padding: '0 10px',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.09)'
            }}
          >
            <Search size={11} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '12px', color: 'rgba(255,255,255,0.35)', textAlign: 'left' }}>Search</span>
            <span style={{
              fontSize: '10px', color: 'rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.07)', padding: '1px 5px',
              borderRadius: '4px', letterSpacing: '0.02em',
            }}>⌘P</span>
          </button>
        ) : (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            style={{
              width: '32px', height: '30px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.09)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s ease',
            }}
          >
            <Search size={11} style={{ color: 'rgba(255,255,255,0.35)' }} />
          </button>
        )}
      </div>

      {/* ── Ask AI ── */}
      <div style={{ padding: collapsed ? '0 0 8px' : '0 8px 8px', display: 'flex', justifyContent: 'center' }}>
        {!collapsed ? (
          <button
            onClick={toggleCopilot}
            style={{
              width: '100%', height: '32px', borderRadius: '8px',
              background: 'rgba(124, 58, 237, 0.18)',
              border: '1px solid rgba(124, 58, 237, 0.30)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px',
              transition: 'all 0.12s ease',
              boxShadow: '0 0 12px rgba(124,58,237,0.10)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.26)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.45)'
              ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(124,58,237,0.20)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.18)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.30)'
              ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 12px rgba(124,58,237,0.10)'
            }}
          >
            <MessageSquare size={12} style={{ color: '#a78bfa', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#c4b5fd', textAlign: 'left', letterSpacing: '-0.01em' }}>
              Ask AI
            </span>
            <span style={{
              fontSize: '10px', color: 'rgba(167,139,250,0.60)',
              background: 'rgba(124,58,237,0.20)', padding: '1px 5px',
              borderRadius: '4px',
            }}>⌘K</span>
          </button>
        ) : (
          <button
            onClick={toggleCopilot}
            title="Ask AI (⌘K)"
            style={{
              width: '32px', height: '30px', borderRadius: '8px',
              background: 'rgba(124,58,237,0.18)',
              border: '1px solid rgba(124,58,237,0.30)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s ease',
            }}
          >
            <MessageSquare size={12} style={{ color: '#a78bfa' }} />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: collapsed ? '0 4px' : '0 6px', overflowY: 'auto', overflowX: 'hidden' }}>
        <SectionLabel>Navigate</SectionLabel>
        {CORE_ITEMS.map(item => (
          <NavItem
            key={item.href}
            {...item}
            badge={item.href === '/pipeline' && urgentCount > 0 ? { count: urgentCount, color: '#ef4444' } : undefined}
          />
        ))}

        <SectionLabel>Insights</SectionLabel>
        {INTEL_ITEMS.map(item => <NavItem key={item.href} {...item} />)}

        <Divider />

        <NavItem
          href="/settings"
          icon={Settings}
          label="Settings"
          badge={unmatchedEmailCount > 0 ? { count: unmatchedEmailCount, color: '#f59e0b' } : undefined}
        />
      </nav>

      {/* ── Brain status + user footer ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: collapsed ? '8px 4px' : '8px', flexShrink: 0 }}>

        {/* Brain indicator */}
        {!collapsed && brainAgeInfo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '6px 9px', marginBottom: '6px', borderRadius: '8px',
            background: brainAgeInfo.bg,
            border: `1px solid ${brainAgeInfo.border}`,
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
              background: brainAgeInfo.color,
              boxShadow: `0 0 6px ${brainAgeInfo.glow}`,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>
                {urgentCount > 0 ? `${urgentCount} deals need attention` : 'AI ready'}
              </div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.32)', marginTop: '1px' }}>
                Updated {brainAge}
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
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.09)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.35)', margin: '0 auto',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
            }}
          >
            <LogOut size={12} />
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 9px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 700, color: '#fff',
              boxShadow: '0 0 8px rgba(124,58,237,0.40)',
            }}>
              {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '12px', fontWeight: 600, letterSpacing: '-0.01em',
                color: 'rgba(255,255,255,0.90)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Account'}
              </div>
              <div style={{
                fontSize: '10px', color: 'rgba(255,255,255,0.32)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px',
              }}>
                {user?.emailAddresses?.[0]?.emailAddress ?? ''}
              </div>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              style={{
                background: 'none', border: 'none', padding: '3px',
                color: 'rgba(255,255,255,0.28)', borderRadius: '4px',
                display: 'flex', alignItems: 'center', cursor: 'pointer',
                transition: 'color 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.28)'}
              title="Sign out"
            >
              <LogOut size={11} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )

  const MOBILE_TABS = [
    { href: '/dashboard',  icon: LayoutDashboard, label: 'Today' },
    { href: '/pipeline',   icon: Home,            label: 'Pipeline' },
    { href: '/calendar',   icon: CalendarDays,    label: 'Calendar' },
    { href: '/deals',      icon: Building2,       label: 'Deals' },
  ]

  return (
    <>
      <div className="desktop-sidebar">{SidebarContent}</div>
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={closeMobile}
        />
      )}
      <div
        className="mobile-sidebar"
        style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 40,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.18s cubic-bezier(0.4,0,0.2,1)',
          width: '210px',
        }}
      >
        {SidebarContent}
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '56px',
        background: 'rgba(8,12,26,0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'none',
        alignItems: 'center', justifyContent: 'space-around',
        zIndex: 1000, padding: '0 8px',
      }}>
        {MOBILE_TABS.map(tab => {
          const active = isActive(tab.href, tab.href === '/pipeline' ? ['/pipeline', '/deals'] : [tab.href])
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
              <tab.icon size={16} style={{ color: active ? '#a78bfa' : 'rgba(255,255,255,0.40)' }} />
              <span style={{
                fontSize: '10px', fontWeight: active ? 600 : 500,
                color: active ? '#a78bfa' : 'rgba(255,255,255,0.40)',
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
          <MessageSquare size={16} style={{ color: '#a78bfa' }} />
          <span style={{ fontSize: '10px', fontWeight: 500, color: '#a78bfa', lineHeight: 1 }}>Ask AI</span>
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
