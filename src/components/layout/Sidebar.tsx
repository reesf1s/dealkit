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
  X, Brain, Zap, Activity, MessageSquare, Sun, Moon, Home, BookOpen, CalendarDays,
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
  const { theme, toggleTheme } = useTheme()
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 })
  const brain = brainRes?.data
  const urgentCount = brain?.urgentDeals?.length ?? 0
  const { data: unmatchedRes } = useSWR('/api/ingest/email/unmatched', fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 })
  const unmatchedEmailCount = unmatchedRes?.pendingCount ?? 0

  // Identify user in Mixpanel once auth loads
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
          padding: collapsed ? '0' : '0 8px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          height: '30px', borderRadius: '8px',
          marginBottom: '1px', textDecoration: 'none',
          fontSize: '13px',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          color: active ? 'var(--ds-text-1)' : 'var(--ds-text-2)',
          background: active ? 'var(--ds-glass-bg)' : 'transparent',
          border: active ? '1px solid var(--ds-glass-border)' : '1px solid transparent',
          boxShadow: active ? '0 0 8px var(--ds-glow-accent)' : 'none',
          backdropFilter: active ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: active ? 'blur(12px)' : 'none',
          transition: 'background 0.1s ease, color 0.1s ease, border-color 0.1s ease, box-shadow 0.1s ease',
          position: 'relative', flexShrink: 0,
          width: collapsed ? '30px' : undefined,
          margin: collapsed ? '0 auto 2px' : undefined,
        }}
        onMouseEnter={e => { if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'var(--ds-glass-hover)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--ds-text-1)'
        }}}
        onMouseLeave={e => { if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--ds-text-2)'
        }}}
      >
        <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon
            size={14}
            style={{
              color: active ? 'var(--ds-text-1)' : 'var(--ds-text-3)',
              display: 'block',
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
            fontSize: '10px', fontWeight: 500,
            color: 'var(--ds-red)',
            background: 'var(--ds-red-soft)',
            padding: '1px 5px', borderRadius: '100px',
          }}>{badge.count}</span>
        )}
      </Link>
    )
  }

  function Divider() {
    return <div style={{ height: '1px', background: 'var(--ds-border)', margin: '6px 0' }} />
  }

  function SectionLabel({ children }: { children: string }) {
    if (collapsed) return <div style={{ height: '10px' }} />
    return (
      <div style={{
        padding: '8px 8px 3px',
        fontSize: '10px', fontWeight: 500, color: 'var(--ds-text-3)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
      }}>
        {children}
      </div>
    )
  }

  const brainAgeInfo = brain?.updatedAt
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(brain.updatedAt).getTime()) / 60000)
        const label = mins < 1 ? 'live' : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`
        const color = mins < 60 ? '#30D158' : mins < 1440 ? '#FFD60A' : '#FF453A'
        const glow = mins < 60 ? 'rgba(48,209,88,0.5)' : mins < 1440 ? 'rgba(255,214,10,0.5)' : 'rgba(255,69,58,0.6)'
        const bg = mins < 60 ? 'rgba(48,209,88,0.06)' : mins < 1440 ? 'rgba(255,214,10,0.07)' : 'rgba(255,69,58,0.07)'
        const border = mins < 60 ? 'rgba(48,209,88,0.15)' : mins < 1440 ? 'rgba(255,214,10,0.20)' : 'rgba(255,69,58,0.15)'
        return { label, color, glow, bg, border }
      })()
    : null
  const brainAge = brainAgeInfo?.label ?? null

  const SidebarContent = (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: w,
      background: theme === 'dark' ? 'rgba(15,15,17,0.7)' : 'rgba(255,255,255,0.8)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRight: '1px solid var(--ds-glass-border)',
      display: 'flex', flexDirection: 'column', zIndex: 40,
      transition: 'width 0.18s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>

      {/* ── Logo row ── */}
      <div style={{
        padding: collapsed ? '12px 0 8px' : '12px 10px 8px',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        flexShrink: 0,
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '24px', height: '24px',
              background: 'linear-gradient(135deg, var(--ds-accent) 0%, var(--ds-accent-hover) 100%)',
              borderRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 0 10px rgba(91,91,214,0.35)',
            }}>
              <Brain size={12} color="#fff" strokeWidth={2.5} />
            </div>
            <span className="font-brand-wordmark" style={{
              color: 'var(--ds-text-1)',
            }}>HALVEX</span>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: '24px', height: '24px',
            background: 'linear-gradient(135deg, var(--ds-accent) 0%, var(--ds-accent-hover) 100%)',
            borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px rgba(124,106,245,0.40)',
          }}>
            <Brain size={12} color="#fff" strokeWidth={2.5} />
          </div>
        )}
        <button
          onClick={() => { mobileOpen ? closeMobile() : toggleCollapsed() }}
          style={{
            background: 'none', border: 'none',
            color: 'var(--ds-text-3)', cursor: 'pointer',
            padding: '3px', borderRadius: '4px', display: 'flex',
            transition: 'color 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--ds-text-1)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--ds-text-3)'}
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
              width: '100%', height: '28px', borderRadius: '6px',
              background: 'var(--surface)',
              border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px',
              transition: 'background 0.1s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--ds-bg-hover)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--surface)'
            }}
          >
            <Search size={11} style={{ color: 'var(--ds-text-3)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '12px', color: 'var(--ds-text-3)', textAlign: 'left' }}>Search</span>
            <span style={{
              fontSize: '10px', color: 'var(--ds-text-3)',
              background: 'rgba(255,255,255,0.06)', padding: '1px 4px',
              borderRadius: '4px', border: 'none',
              letterSpacing: '0.02em',
            }}>⌘P</span>
          </button>
        ) : (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            style={{
              width: '30px', height: '28px', borderRadius: '6px',
              background: 'var(--surface)', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Search size={11} style={{ color: 'var(--ds-text-3)' }} />
          </button>
        )}
      </div>

      {/* ── Ask AI ── */}
      <div style={{ padding: collapsed ? '0 0 8px' : '0 8px 8px', display: 'flex', justifyContent: 'center' }}>
        {!collapsed ? (
          <button
            onClick={toggleCopilot}
            style={{
              width: '100%', height: '30px', borderRadius: '6px',
              background: 'var(--ds-accent-soft)',
              border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', padding: '0 9px',
              transition: 'background 0.1s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(91,91,214,0.22)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--ds-accent-soft)'
            }}
          >
            <MessageSquare size={12} style={{ color: 'var(--ds-accent)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--ds-accent-hover)', textAlign: 'left', letterSpacing: '-0.01em' }}>
              Ask AI
            </span>
            <span style={{
              fontSize: '10px', color: 'var(--ds-text-3)',
              background: 'rgba(0,0,0,0.2)', padding: '1px 5px',
              borderRadius: '4px', border: 'none',
            }}>⌘K</span>
          </button>
        ) : (
          <button
            onClick={toggleCopilot}
            title="Ask AI (⌘K)"
            style={{
              width: '30px', height: '28px', borderRadius: '6px',
              background: 'var(--ds-accent-soft)',
              border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MessageSquare size={11} style={{ color: 'var(--ds-accent)' }} />
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
            badge={item.href === '/pipeline' && urgentCount > 0 ? { count: urgentCount, color: 'var(--ds-red)' } : undefined}
          />
        ))}

        <SectionLabel>Insights</SectionLabel>
        {INTEL_ITEMS.map(item => <NavItem key={item.href} {...item} />)}

        <Divider />

        <NavItem
          href="/settings"
          icon={Settings}
          label="Settings"
          badge={unmatchedEmailCount > 0 ? { count: unmatchedEmailCount, color: '#F59E0B' } : undefined}
        />

        {/* Theme toggle */}
        {!collapsed ? (
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '0 8px', height: '30px', borderRadius: '6px',
              marginBottom: '1px', border: 'none',
              fontSize: '13px', fontWeight: 500, letterSpacing: '-0.01em',
              color: 'var(--ds-text-2)',
              background: 'transparent',
              cursor: 'pointer', width: '100%', textAlign: 'left',
              transition: 'background 0.1s ease, color 0.1s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--ds-bg-hover)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--ds-text-1)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--ds-text-2)'
            }}
          >
            {theme === 'light'
              ? <Moon size={13} style={{ color: 'var(--ds-text-3)', flexShrink: 0 }} />
              : <Sun  size={13} style={{ color: 'var(--ds-text-3)', flexShrink: 0 }} />}
            <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </button>
        ) : (
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '30px', width: '30px', borderRadius: '6px',
              border: 'none', background: 'transparent',
              color: 'var(--ds-text-3)', cursor: 'pointer',
              margin: '0 auto 2px',
            }}
          >
            {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
          </button>
        )}
      </nav>

      {/* ── Brain status + user footer ── */}
      <div style={{ borderTop: '1px solid var(--ds-glass-border)', padding: collapsed ? '8px 4px' : '8px', flexShrink: 0 }}>

        {/* Brain indicator */}
        {!collapsed && brainAgeInfo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '5px 8px', marginBottom: '6px', borderRadius: '6px',
            background: brainAgeInfo.bg,
            border: 'none',
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
              background: brainAgeInfo.color,
              boxShadow: `0 0 5px ${brainAgeInfo.glow}`,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--ds-text-2)' }}>
                {urgentCount > 0 ? `${urgentCount} deals need attention` : 'AI ready'}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--ds-text-3)', marginTop: '1px' }}>
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
              width: '30px', height: '30px', borderRadius: '6px',
              background: 'var(--surface)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--ds-text-3)', margin: '0 auto',
              transition: 'color 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--ds-text-1)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--ds-text-3)'}
          >
            <LogOut size={12} />
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 8px', borderRadius: '6px',
            background: 'var(--surface)',
            border: 'none',
          }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--ds-accent), var(--ds-accent-hover))',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: 700, color: '#fff',
            }}>
              {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '12px', fontWeight: 500, letterSpacing: '-0.01em',
                color: 'var(--ds-text-1)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Account'}
              </div>
              <div style={{
                fontSize: '10px', color: 'var(--ds-text-3)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px',
              }}>
                {user?.emailAddresses?.[0]?.emailAddress ?? ''}
              </div>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              style={{
                background: 'none', border: 'none', padding: '3px',
                color: 'var(--ds-text-3)', borderRadius: '4px',
                display: 'flex', alignItems: 'center', cursor: 'pointer',
                transition: 'color 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--ds-text-1)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--ds-text-3)'}
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
          style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
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
        background: theme === 'dark' ? 'rgba(15,15,17,0.7)' : 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--ds-glass-border)',
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
                gap: '2px', textDecoration: 'none', padding: '6px 12px', borderRadius: '8px',
                minWidth: '48px', minHeight: '44px',
              }}
            >
              <tab.icon size={16} style={{ color: active ? 'var(--ds-text-1)' : 'var(--text-tertiary)' }} />
              <span style={{
                fontSize: '10px', fontWeight: active ? 600 : 500,
                color: active ? 'var(--ds-text-1)' : 'var(--text-tertiary)',
                lineHeight: 1,
              }}>{tab.label}</span>
            </Link>
          )
        })}
        <button
          onClick={toggleCopilot}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '2px', background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 12px', borderRadius: '8px',
            minWidth: '48px', minHeight: '44px',
          }}
        >
          <MessageSquare size={16} style={{ color: 'var(--accent, #7C6AF5)' }} />
          <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--accent, #7C6AF5)', lineHeight: 1 }}>Ask AI</span>
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
