'use client'

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
          height: '30px', borderRadius: '7px',
          marginBottom: '1px', textDecoration: 'none',
          fontSize: '13px',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
          background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
          transition: 'background 0.08s ease, color 0.08s ease',
          position: 'relative', flexShrink: 0,
          width: collapsed ? '30px' : undefined,
          margin: collapsed ? '0 auto 2px' : undefined,
        }}
        onMouseEnter={e => { if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
        }}}
        onMouseLeave={e => { if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
        }}}
      >
        <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon
            size={14}
            style={{
              color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
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
            color: '#FF453A',
            background: 'rgba(255,69,58,0.12)',
            padding: '1px 5px', borderRadius: '100px',
          }}>{badge.count}</span>
        )}
      </Link>
    )
  }

  function Divider() {
    return <div style={{ height: '1px', background: 'var(--border)', margin: '6px 0' }} />
  }

  function SectionLabel({ children }: { children: string }) {
    if (collapsed) return <div style={{ height: '10px' }} />
    return (
      <div style={{
        padding: '8px 8px 3px',
        fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)',
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
      background: 'var(--sidebar-bg)',
      backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      borderRight: '1px solid var(--border)',
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
              background: 'linear-gradient(135deg, #7C6AF5 0%, #9B6DFF 100%)',
              borderRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 0 14px rgba(124,106,245,0.40)',
            }}>
              <Brain size={12} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{
              fontWeight: '600', fontSize: '14px',
              letterSpacing: '-0.025em',
              color: 'var(--text-primary)',
            }}>SellSight</span>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: '24px', height: '24px',
            background: 'linear-gradient(135deg, #7C6AF5 0%, #9B6DFF 100%)',
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
            color: 'var(--text-tertiary)', cursor: 'pointer',
            padding: '3px', borderRadius: '5px', display: 'flex',
            transition: 'color 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
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
              width: '100%', height: '28px', borderRadius: '7px',
              background: 'var(--surface)',
              border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px',
              transition: 'background 0.08s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--surface)'
            }}
          >
            <Search size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'left' }}>Search</span>
            <span style={{
              fontSize: '10px', color: 'var(--text-tertiary)',
              background: 'rgba(255,255,255,0.06)', padding: '1px 4px',
              borderRadius: '4px', border: 'none',
              letterSpacing: '0.02em',
            }}>⌘P</span>
          </button>
        ) : (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            style={{
              width: '30px', height: '28px', borderRadius: '7px',
              background: 'var(--surface)', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Search size={11} style={{ color: 'var(--text-tertiary)' }} />
          </button>
        )}
      </div>

      {/* ── Ask AI ── */}
      <div style={{ padding: collapsed ? '0 0 8px' : '0 8px 8px', display: 'flex', justifyContent: 'center' }}>
        {!collapsed ? (
          <button
            onClick={toggleCopilot}
            style={{
              width: '100%', height: '30px', borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(124,106,245,0.12), rgba(155,109,255,0.08))',
              border: '1px solid rgba(124,106,245,0.22)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', padding: '0 9px',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(124,106,245,0.20), rgba(155,109,255,0.14))'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,106,245,0.40)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(124,106,245,0.12), rgba(155,109,255,0.08))'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,106,245,0.22)'
            }}
          >
            <MessageSquare size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--accent-text)', textAlign: 'left', letterSpacing: '-0.01em' }}>
              Ask AI
            </span>
            <span style={{
              fontSize: '10px', color: 'var(--text-tertiary)',
              background: 'rgba(0,0,0,0.2)', padding: '1px 5px',
              borderRadius: '4px', border: 'none',
            }}>⌘K</span>
          </button>
        ) : (
          <button
            onClick={toggleCopilot}
            title="Ask AI (⌘K)"
            style={{
              width: '30px', height: '28px', borderRadius: '7px',
              background: 'linear-gradient(135deg, rgba(124,106,245,0.12), rgba(155,109,255,0.08))',
              border: '1px solid rgba(124,106,245,0.22)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MessageSquare size={11} style={{ color: 'var(--accent)' }} />
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
            badge={item.href === '/pipeline' && urgentCount > 0 ? { count: urgentCount, color: '#FF453A' } : undefined}
          />
        ))}

        <SectionLabel>Insights</SectionLabel>
        {INTEL_ITEMS.map(item => <NavItem key={item.href} {...item} />)}

        <Divider />

        <NavItem href="/settings" icon={Settings} label="Settings" />

        {/* Theme toggle */}
        {!collapsed ? (
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '0 8px', height: '30px', borderRadius: '7px',
              marginBottom: '1px', border: 'none',
              fontSize: '13px', fontWeight: 500, letterSpacing: '-0.01em',
              color: 'var(--text-secondary)',
              background: 'transparent',
              cursor: 'pointer', width: '100%', textAlign: 'left',
              transition: 'background 0.08s ease, color 0.08s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
            }}
          >
            {theme === 'light'
              ? <Moon size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              : <Sun  size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />}
            <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </button>
        ) : (
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '30px', width: '30px', borderRadius: '7px',
              border: 'none', background: 'transparent',
              color: 'var(--text-tertiary)', cursor: 'pointer',
              margin: '0 auto 2px',
            }}
          >
            {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
          </button>
        )}
      </nav>

      {/* ── Brain status + user footer ── */}
      <div style={{ borderTop: '1px solid var(--border)', padding: collapsed ? '8px 4px' : '8px', flexShrink: 0 }}>

        {/* Brain indicator */}
        {!collapsed && brainAgeInfo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '5px 8px', marginBottom: '6px', borderRadius: '7px',
            background: brainAgeInfo.bg,
            border: 'none',
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
              background: brainAgeInfo.color,
              boxShadow: `0 0 5px ${brainAgeInfo.glow}`,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {urgentCount > 0 ? `${urgentCount} deals need attention` : 'AI ready'}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
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
              width: '30px', height: '30px', borderRadius: '7px',
              background: 'var(--surface)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-tertiary)', margin: '0 auto',
              transition: 'color 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
          >
            <LogOut size={12} />
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 8px', borderRadius: '8px',
            background: 'var(--surface)',
            border: 'none',
          }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #7C6AF5, #9B6DFF)',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: 700, color: '#fff',
            }}>
              {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '12px', fontWeight: 500, letterSpacing: '-0.01em',
                color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Account'}
              </div>
              <div style={{
                fontSize: '10px', color: 'var(--text-tertiary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px',
              }}>
                {user?.emailAddresses?.[0]?.emailAddress ?? ''}
              </div>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              style={{
                background: 'none', border: 'none', padding: '3px',
                color: 'var(--text-tertiary)', borderRadius: '4px',
                display: 'flex', alignItems: 'center', cursor: 'pointer',
                transition: 'color 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
              title="Sign out"
            >
              <LogOut size={11} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )

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
      <style>{`
        .desktop-sidebar { display: block; }
        .mobile-sidebar  { display: none; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none; }
          .mobile-sidebar  { display: block; }
        }
      `}</style>
    </>
  )
}
