'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import {
  LayoutDashboard, Building2, Swords,
  FileText, Settings, LogOut, Search,
  Kanban, ChevronLeft, ChevronRight,
  X, Brain, Zap, Activity, MessageSquare, Sun, Moon, Home, BookOpen,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'
import { useTheme } from './ThemeContext'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// Nav: AI-first — Today (command centre) + visual board + collateral + intel
const CORE_ITEMS = [
  { href: '/pipeline',   icon: Home,            label: 'Today',        matchPaths: ['/pipeline', '/deals', '/dashboard'] },
  { href: '/models',     icon: Brain,           label: 'Models',       matchPaths: ['/models'] },
  { href: '/playbook',   icon: BookOpen,        label: 'Playbook',     matchPaths: ['/playbook'] },
  { href: '/collateral', icon: Zap,             label: 'Collateral',   matchPaths: ['/collateral'] },
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
  const staleCount = brain?.staleDeals?.length ?? 0

  const isActive = (href: string, matchPaths?: string[]) => {
    const paths = matchPaths ? [href, ...matchPaths] : [href]
    return paths.some(p => pathname === p || pathname.startsWith(p + '/'))
  }
  const w = collapsed ? '56px' : '216px'

  const brainAge = brain?.updatedAt
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(brain.updatedAt).getTime()) / 60000)
        if (mins < 1) return 'just now'
        if (mins < 60) return `${mins}m ago`
        const hrs = Math.floor(mins / 60)
        return `${hrs}h ago`
      })()
    : null

  function NavItem({ href, icon: Icon, label, badge, matchPaths }: { href: string; icon: React.ElementType; label: string; badge?: { count: number; color: string }; matchPaths?: string[] }) {
    const active = isActive(href, matchPaths)
    return (
      <Link
        href={href}
        onClick={() => closeMobile()}
        title={collapsed ? label : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          padding: '0 10px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          height: '32px', borderRadius: '7px',
          marginBottom: '1px', textDecoration: 'none',
          fontSize: '13px', fontWeight: active ? '500' : '400',
          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
          background: active ? 'var(--accent-subtle)' : 'transparent',
          transition: 'all 0.1s',
          position: 'relative',
        }}
        onMouseEnter={e => { if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
        }}}
        onMouseLeave={e => { if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
        }}}
      >
        {active && !collapsed && (
          <div style={{
            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
            width: '2px', height: '14px', background: 'var(--accent)',
            borderRadius: '0 2px 2px 0',
          }} />
        )}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Icon size={14} color={active ? 'var(--accent)' : 'currentColor'} style={{ display: 'block', marginLeft: active && !collapsed ? '2px' : 0 }} />
          {badge && badge.count > 0 && !collapsed && (
            <div style={{
              position: 'absolute', top: '-4px', right: '-6px',
              width: '6px', height: '6px', borderRadius: '50%',
              background: badge.color,
            }} />
          )}
          {badge && badge.count > 0 && collapsed && (
            <div style={{
              position: 'absolute', top: '-3px', right: '-3px',
              width: '6px', height: '6px', borderRadius: '50%',
              background: badge.color,
            }} />
          )}
        </div>
        {!collapsed && (
          <span style={{ flex: 1 }}>{label}</span>
        )}
        {!collapsed && badge && badge.count > 0 && (
          <span style={{
            fontSize: '10px', fontWeight: 700,
            color: badge.color === '#EF4444' ? '#FCA5A5' : '#FDE68A',
            background: badge.color === '#EF4444' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)',
            padding: '1px 5px', borderRadius: '100px',
          }}>{badge.count}</span>
        )}
      </Link>
    )
  }

  function SectionLabel({ children }: { children: string }) {
    if (collapsed) return <div style={{ height: '16px' }} />
    return (
      <div style={{ padding: '10px 10px 4px', fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </div>
    )
  }

  const SidebarContent = (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: w,
      background: 'var(--sidebar-bg)',
      backdropFilter: 'blur(var(--glass-blur))', WebkitBackdropFilter: 'blur(var(--glass-blur))',
      borderRight: '1px solid var(--border)',
      boxShadow: 'var(--shadow)',
      display: 'flex', flexDirection: 'column', zIndex: 40,
      transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>

      {/* Logo */}
      <div style={{ padding: collapsed ? '14px 0 10px' : '14px 12px 10px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '26px', height: '26px',
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              borderRadius: '7px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 0 12px rgba(99,102,241,0.35)',
            }}>
              <Brain size={13} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: '700', fontSize: '14px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>SellSight</span>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: '26px', height: '26px',
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            borderRadius: '7px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(99,102,241,0.35)',
          }}>
            <Brain size={13} color="#fff" strokeWidth={2.5} />
          </div>
        )}
        <button
          onClick={() => { mobileOpen ? closeMobile() : toggleCollapsed() }}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '5px', display: 'flex' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
        >
          {mobileOpen ? <X size={13} /> : collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Search */}
      {!collapsed ? (
        <div style={{ padding: '0 8px 8px' }}>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            style={{
              width: '100%', height: '30px', borderRadius: '7px',
              backgroundColor: 'var(--surface-hover)',
              border: '1px solid var(--border)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--border)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'}
          >
            <Search size={11} color="var(--text-tertiary)" strokeWidth={2} />
            <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'left' }}>Search</span>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--surface-hover)', padding: '1px 4px', borderRadius: '3px', border: '1px solid var(--border)' }}>⌘P</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '8px' }}>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            style={{ width: '30px', height: '30px', borderRadius: '7px', background: 'var(--surface-hover)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Search size={12} color="var(--text-tertiary)" />
          </button>
        </div>
      )}

      {/* Ask Brain CTA */}
      {!collapsed ? (
        <div style={{ padding: '0 8px 6px' }}>
          <button
            onClick={toggleCopilot}
            style={{
              width: '100%', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(79,70,229,0.10), rgba(139,92,246,0.07))',
              border: '1px solid rgba(79,70,229,0.20)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', padding: '0 10px',
              transition: 'all 0.15s',
              color: 'var(--accent-text)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(79,70,229,0.18), rgba(139,92,246,0.12))'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(79,70,229,0.4)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(79,70,229,0.10), rgba(139,92,246,0.07))'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(79,70,229,0.20)'
            }}
          >
            <MessageSquare size={12} color="var(--accent)" strokeWidth={2} />
            <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, textAlign: 'left' }}>Ask AI</span>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--surface-hover)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--border)' }}>⌘K</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '6px' }}>
          <button
            onClick={toggleCopilot}
            title="Ask AI (⌘K)"
            style={{ width: '30px', height: '30px', borderRadius: '7px', background: 'linear-gradient(135deg, rgba(79,70,229,0.10), rgba(139,92,246,0.07))', border: '1px solid rgba(79,70,229,0.20)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <MessageSquare size={12} color="var(--accent)" />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 6px', overflowY: 'auto', overflowX: 'hidden' }}>

        <SectionLabel>Navigate</SectionLabel>
        {CORE_ITEMS.map(item => (
          <NavItem
            key={item.href}
            {...item}
            badge={
              item.href === '/pipeline' && urgentCount > 0 ? { count: urgentCount, color: '#EF4444' } :
              undefined
            }
          />
        ))}

        <SectionLabel>Insights</SectionLabel>
        {INTEL_ITEMS.map(item => <NavItem key={item.href} {...item} />)}

        <div style={{ margin: '8px 4px', height: '1px', background: 'var(--border)' }} />

        <NavItem href="/settings" icon={Settings} label="Settings" />

        {/* Theme toggle */}
        {!collapsed ? (
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex', alignItems: 'center', gap: '9px',
              padding: '0 10px', height: '32px', borderRadius: '7px',
              marginBottom: '1px', border: 'none',
              fontSize: '13px', fontWeight: '400',
              color: 'var(--text-secondary)',
              background: 'transparent',
              cursor: 'pointer', width: '100%',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
            }}
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </button>
        ) : (
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '32px', width: '100%', borderRadius: '7px',
              border: 'none', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        )}
      </nav>

      {/* Brain status + user */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 8px 10px' }}>
        {/* Brain health indicator — pulsing when active */}
        {!collapsed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 10px', marginBottom: '6px', borderRadius: '8px',
            background: urgentCount > 0
              ? 'rgba(239,68,68,0.06)'
              : 'rgba(99,102,241,0.06)',
            border: `1px solid ${urgentCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)'}`,
          }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: brainAge
                ? (urgentCount > 0 ? '#EF4444' : '#22C55E')
                : 'var(--text-tertiary)',
              boxShadow: brainAge
                ? (urgentCount > 0 ? '0 0 6px rgba(239,68,68,0.6)' : '0 0 6px rgba(34,197,94,0.5)')
                : 'none',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '10px', color: brainAge ? 'var(--text-secondary)' : 'var(--text-tertiary)', fontWeight: 600 }}>
                {brainAge ? 'AI ready' : 'AI idle'}
              </div>
              {(urgentCount > 0 || staleCount > 0) && (
                <div style={{ fontSize: '9px', color: '#EF4444', marginTop: '1px' }}>
                  {urgentCount + staleCount} deal{urgentCount + staleCount !== 1 ? 's' : ''} need attention
                </div>
              )}
            </div>
          </div>
        )}

        {collapsed ? (
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            title="Sign out"
            style={{
              width: '100%', height: '32px', borderRadius: '7px',
              background: 'var(--surface-hover)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-secondary)',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
          >
            <LogOut size={12} />
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 8px', borderRadius: '8px',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
          }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: '700', color: '#fff',
            }}>
              {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Account'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                {user?.emailAddresses?.[0]?.emailAddress ?? ''}
              </div>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              style={{ background: 'none', border: 'none', padding: '3px', color: 'var(--text-tertiary)', borderRadius: '4px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,0.7)' }} onClick={closeMobile} />
      )}
      <div
        className="mobile-sidebar"
        style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 40,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
          width: '216px',
        }}
      >
        {SidebarContent}
      </div>
      <style>{`
        .desktop-sidebar { display: block; }
        .mobile-sidebar { display: none; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none; }
          .mobile-sidebar { display: block; }
        }
      `}</style>
    </>
  )
}
