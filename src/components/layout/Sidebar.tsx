'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import useSWR from 'swr'
import {
  LayoutDashboard,
  Kanban,
  Users,
  MessageSquare,
  BarChart3,
  Building2,
  Bot,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Sun,
  Moon,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'
import { identify } from '@/lib/analytics'
import { fetcher } from '@/lib/fetcher'

interface NavItemDef {
  href: string
  label: string
  icon: React.ElementType
  matchPaths?: string[]
}

const PRIMARY_NAV: NavItemDef[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, matchPaths: ['/dashboard'] },
  { href: '/pipeline', label: 'Pipeline', icon: Kanban, matchPaths: ['/pipeline'] },
  { href: '/contacts', label: 'Contacts', icon: Users, matchPaths: ['/contacts'] },
  { href: '/connections', label: 'Activity', icon: MessageSquare, matchPaths: ['/connections', '/chat'] },
  { href: '/analytics', label: 'Reports', icon: BarChart3, matchPaths: ['/analytics'] },
]

const OPERATIONS_NAV: NavItemDef[] = [
  { href: '/company', label: 'Company', icon: Building2, matchPaths: ['/company', '/onboarding'] },
  { href: '/automations', label: 'Automations', icon: Bot, matchPaths: ['/automations', '/intelligence', '/workflows'] },
  { href: '/settings', label: 'Settings', icon: Settings, matchPaths: ['/settings'] },
]

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return null
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--text-muted)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      padding: '14px 10px 6px',
      userSelect: 'none',
    }}>
      {label}
    </div>
  )
}

function NavItem({
  href,
  icon: Icon,
  label,
  collapsed,
  active,
  count,
  onClick,
}: {
  href: string
  icon: React.ElementType
  label: string
  collapsed: boolean
  active: boolean
  count?: number
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 32,
        padding: collapsed ? '0' : '0 10px 0 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 7,
        marginBottom: 3,
        textDecoration: 'none',
        fontSize: 11.5,
        fontWeight: active ? 700 : 550,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: active ? 'var(--surface-selected)' : 'transparent',
        border: active ? '1px solid var(--brand-border)' : '1px solid transparent',
        width: collapsed ? 36 : '100%',
        marginLeft: collapsed ? 'auto' : 0,
        marginRight: collapsed ? 'auto' : 0,
        transition: 'all 120ms ease',
      }}
      onMouseEnter={e => {
        if (!active) {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'var(--surface-hover)'
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
      {active && !collapsed && (
        <span style={{ position: 'absolute', left: 5, top: 8, bottom: 8, width: 2, borderRadius: 999, background: 'var(--brand)' }} />
      )}
      <Icon size={15} style={{ color: active ? 'var(--text-primary)' : 'var(--text-tertiary)', flexShrink: 0 }} />
      {!collapsed && <span style={{ flex: 1, minWidth: 0 }}>{label}</span>}
      {!collapsed && typeof count === 'number' && count > 0 && (
        <span style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          background: 'var(--surface-2)',
          borderRadius: 999,
          padding: '1px 7px',
          fontWeight: 700,
        }}>
          {count}
        </span>
      )}
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()
  const { theme, setTheme } = useTheme()
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile, toggleCopilot } = useSidebar()

  const { data: automationsRes } = useSWR('/api/automations', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45000,
  })

  const enabledAutomations = Array.isArray(automationsRes?.data)
    ? automationsRes.data.filter((a: { enabled: boolean }) => a.enabled).length
    : 0

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
    return paths.some(p => pathname === p || pathname.startsWith(`${p}/`))
  }

  const width = collapsed ? 54 : 216

  const sidebarBody = (
    <aside style={{
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      width,
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-sidebar)',
      zIndex: 40,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'width 0.15s cubic-bezier(0.4,0,0.2,1)',
    }}>
      <div style={{
        padding: collapsed ? '12px 8px 10px' : '12px 12px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: 8,
      }}>
        {!collapsed ? (
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', minWidth: 0 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: 'var(--text-primary)',
              border: '1px solid var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: 12,
            }}>
              H
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 760, color: 'var(--text-primary)', lineHeight: 1.1 }}>Halvex</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>Revenue workspace</div>
            </div>
          </Link>
        ) : (
          <div style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: 'var(--text-primary)',
            border: '1px solid var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: 12,
          }}>H</div>
        )}

        <button
          onClick={() => {
            if (mobileOpen) closeMobile()
            else toggleCollapsed()
          }}
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            border: '1px solid var(--border-default)',
            background: 'var(--surface-1)',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {mobileOpen ? <X size={11} /> : collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: '0 12px 8px' }}>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            style={{
              width: '100%',
              height: 30,
              borderRadius: 7,
              border: '1px solid var(--border-default)',
              background: 'var(--surface-1)',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 8px',
              cursor: 'pointer',
              fontSize: 11.5,
              fontWeight: 600,
            }}
          >
            <span>Find anything</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>⌘P</span>
          </button>
        </div>
      )}

      <nav style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '0 9px' : '0 12px' }}>
        <SectionLabel label="Sales" collapsed={collapsed} />
        {PRIMARY_NAV.map(item => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            collapsed={collapsed}
            active={isActive(item.href, item.matchPaths)}
            onClick={closeMobile}
          />
        ))}

        <SectionLabel label="Operations" collapsed={collapsed} />
        {OPERATIONS_NAV.map(item => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            collapsed={collapsed}
            active={isActive(item.href, item.matchPaths)}
            onClick={closeMobile}
            count={item.href === '/automations' ? enabledAutomations : undefined}
          />
        ))}
      </nav>

      <div style={{ padding: collapsed ? '9px' : '10px 12px', borderTop: '1px solid var(--border-subtle)' }}>
        {!collapsed ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 8px',
            borderRadius: 7,
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: 10.5,
              flexShrink: 0,
            }}>
              {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Account'}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.emailAddresses?.[0]?.emailAddress ?? ''}
              </div>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', display: 'flex', cursor: 'pointer', padding: 2 }}
            >
              {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
            </button>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              title="Sign out"
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', display: 'flex', cursor: 'pointer', padding: 2 }}
            >
              <LogOut size={12} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{ width: 32, height: 26, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
            </button>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              style={{ width: 32, height: 26, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title="Sign out"
            >
              <LogOut size={12} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )

  const mobileTabs = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/pipeline', label: 'Pipeline', icon: Kanban },
    { href: '/contacts', label: 'Contacts', icon: Users },
    { href: '/connections', label: 'Activity', icon: MessageSquare },
  ]

  return (
    <>
      <div className="desktop-sidebar">{sidebarBody}</div>

      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,0.32)' }}
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
          width: 216,
          zIndex: 40,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.15s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {sidebarBody}
      </div>

      <nav className="mobile-bottom-nav" style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: 58,
        background: 'var(--surface-1)',
        borderTop: '1px solid var(--border-default)',
        boxShadow: '0 -10px 28px rgba(16, 24, 40, 0.08)',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 1000,
      }}>
        {mobileTabs.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={closeMobile}
              style={{
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                minWidth: 56,
              }}
            >
              <tab.icon size={19} style={{ color: active ? 'var(--brand)' : 'var(--text-tertiary)' }} />
              <span style={{ fontSize: 10, color: active ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: active ? 600 : 500 }}>
                {tab.label}
              </span>
            </Link>
          )
        })}
        <button
          onClick={toggleCopilot}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 56 }}
        >
          <Bot size={19} style={{ color: 'var(--brand)' }} />
          <span style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 600 }}>Assistant</span>
        </button>
      </nav>

      <style>{`
        .desktop-sidebar { display: block; }
        .mobile-sidebar { display: none; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-sidebar { display: block; }
          .mobile-bottom-nav { display: flex !important; }
          main { margin-left: 0 !important; padding-bottom: 72px !important; }
        }
      `}</style>
    </>
  )
}
