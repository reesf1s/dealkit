'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import {
  Settings, LogOut, Search,
  ChevronLeft, ChevronRight,
  X, Brain, MessageSquare,
  Home, Swords, BookOpen,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'
import { useTheme } from './ThemeContext'
import { identify } from '@/lib/analytics'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── 4 primary nav items ───────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/pipeline',   icon: Home,    label: 'Pipeline',      matchPaths: ['/pipeline', '/deals', '/dashboard', '/calendar'] },
  { href: '/competitors', icon: Swords,  label: 'Intelligence',  matchPaths: ['/competitors', '/case-studies', '/product-gaps', '/models'] },
  { href: '/playbook',   icon: BookOpen, label: 'Playbook',      matchPaths: ['/playbook', '/collateral', '/company', '/onboarding'] },
  { href: '/settings',   icon: Settings, label: 'Settings',      matchPaths: ['/settings'] },
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
  const w = collapsed ? '60px' : '220px'

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
          display: 'flex', alignItems: 'center', gap: '11px',
          padding: collapsed ? '0' : '0 12px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          height: '42px', borderRadius: '12px',
          marginBottom: '4px', textDecoration: 'none',
          fontSize: '14px',
          fontWeight: active ? 600 : 500,
          letterSpacing: '-0.01em',
          color: active ? '#6366f1' : '#6e6e73',
          background: active
            ? 'rgba(99, 102, 241, 0.12)'
            : 'transparent',
          border: active
            ? '1px solid rgba(99, 102, 241, 0.20)'
            : '1px solid transparent',
          boxShadow: active ? '0 2px 8px rgba(99, 102, 241, 0.10)' : 'none',
          backdropFilter: active ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: active ? 'blur(12px)' : 'none',
          transition: 'all 0.15s ease',
          position: 'relative', flexShrink: 0,
          width: collapsed ? '42px' : undefined,
          margin: collapsed ? '0 auto 4px' : undefined,
        }}
        onMouseEnter={e => { if (!active) {
          ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.55)'
          ;(e.currentTarget as HTMLElement).style.color = '#1d1d1f'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.60)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'
        }}}
        onMouseLeave={e => { if (!active) {
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = '#6e6e73'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
          ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
        }}}
      >
        <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon
            size={18}
            style={{
              color: active ? '#6366f1' : '#aeaeb2',
              display: 'block',
              transition: 'color 0.15s ease',
            }}
          />
          {badge && badge.count > 0 && (
            <div style={{
              position: 'absolute', top: '-3px', right: '-4px',
              width: '6px', height: '6px', borderRadius: '50%',
              background: badge.color,
            }} />
          )}
        </div>
        {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
        {!collapsed && badge && badge.count > 0 && (
          <span style={{
            fontSize: '10px', fontWeight: 600,
            color: '#ef4444',
            background: 'rgba(239,68,68,0.10)',
            padding: '2px 7px', borderRadius: '100px',
          }}>{badge.count}</span>
        )}
      </Link>
    )
  }

  const brainAgeInfo = brain?.updatedAt
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(brain.updatedAt).getTime()) / 60000)
        const label = mins < 1 ? 'live' : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`
        const color = mins < 60 ? '#10b981' : mins < 1440 ? '#f59e0b' : '#ef4444'
        const bg = mins < 60 ? 'rgba(16,185,129,0.08)' : mins < 1440 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)'
        const border = mins < 60 ? 'rgba(16,185,129,0.18)' : mins < 1440 ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)'
        return { label, color, bg, border }
      })()
    : null
  const brainAge = brainAgeInfo?.label ?? null

  const SidebarContent = (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: w,
      background: 'rgba(255, 255, 255, 0.55)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderRight: '1px solid rgba(255, 255, 255, 0.45)',
      display: 'flex', flexDirection: 'column', zIndex: 40,
      transition: 'width 0.20s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
      boxShadow: '2px 0 24px rgba(99, 102, 241, 0.06)',
    }}>

      {/* ── Logo row ── */}
      <div style={{
        padding: collapsed ? '18px 0 14px' : '18px 14px 14px',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        flexShrink: 0,
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '30px', height: '30px',
              background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
            }}>
              <Brain size={15} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{
              color: '#1d1d1f',
              letterSpacing: '3px',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}>HALVEX</span>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: '30px', height: '30px',
            background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
          }}>
            <Brain size={15} color="#fff" strokeWidth={2.5} />
          </div>
        )}
        <button
          onClick={() => { mobileOpen ? closeMobile() : toggleCollapsed() }}
          style={{
            background: 'none', border: 'none',
            color: '#aeaeb2', cursor: 'pointer',
            padding: '5px', borderRadius: '8px', display: 'flex',
            transition: 'color 0.12s, background 0.12s',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.color = '#6e6e73'
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.color = '#aeaeb2'
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
        >
          {mobileOpen ? <X size={14} /> : collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* ── Ask AI ── */}
      <div style={{ padding: collapsed ? '0 9px 14px' : '0 12px 14px', display: 'flex', justifyContent: 'center' }}>
        {!collapsed ? (
          <button
            onClick={toggleCopilot}
            style={{
              width: '100%', height: '38px', borderRadius: '12px',
              background: 'rgba(99, 102, 241, 0.10)',
              border: '1px solid rgba(99, 102, 241, 0.22)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', padding: '0 14px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.18)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.32)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.10)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.22)'
            }}
          >
            <MessageSquare size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#6366f1', textAlign: 'left', letterSpacing: '-0.01em' }}>
              Ask AI
            </span>
            <span style={{
              fontSize: '10px', color: 'rgba(99,102,241,0.55)',
              background: 'rgba(99,102,241,0.10)', padding: '2px 6px',
              borderRadius: '5px',
            }}>⌘K</span>
          </button>
        ) : (
          <button
            onClick={toggleCopilot}
            title="Ask AI (⌘K)"
            style={{
              width: '42px', height: '38px', borderRadius: '12px',
              background: 'rgba(99,102,241,0.10)',
              border: '1px solid rgba(99,102,241,0.22)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <MessageSquare size={14} style={{ color: '#6366f1' }} />
          </button>
        )}
      </div>

      {/* ── Search ── */}
      <div style={{ padding: collapsed ? '0 9px 14px' : '0 12px 14px', display: 'flex', justifyContent: 'center' }}>
        {!collapsed ? (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            style={{
              width: '100%', height: '34px', borderRadius: '10px',
              background: 'rgba(0,0,0,0.04)',
              border: '1px solid rgba(0,0,0,0.06)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.70)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.80)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.06)'
            }}
          >
            <Search size={12} style={{ color: '#aeaeb2', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '12px', color: '#aeaeb2', textAlign: 'left' }}>Search</span>
            <span style={{
              fontSize: '10px', color: '#aeaeb2',
              background: 'rgba(0,0,0,0.05)', padding: '1px 5px',
              borderRadius: '4px', letterSpacing: '0.02em',
            }}>⌘P</span>
          </button>
        ) : (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            style={{
              width: '42px', height: '34px', borderRadius: '10px',
              background: 'rgba(0,0,0,0.04)',
              border: '1px solid rgba(0,0,0,0.06)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s ease',
            }}
          >
            <Search size={12} style={{ color: '#aeaeb2' }} />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: collapsed ? '0 9px' : '0 10px', overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV_ITEMS.map(item => (
          <NavItem
            key={item.href}
            {...item}
            badge={
              item.href === '/pipeline' && urgentCount > 0
                ? { count: urgentCount, color: '#ef4444' }
                : item.href === '/settings' && unmatchedEmailCount > 0
                  ? { count: unmatchedEmailCount, color: '#f59e0b' }
                  : undefined
            }
          />
        ))}
      </nav>

      {/* ── Brain status + user footer ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.40)', padding: collapsed ? '10px 9px' : '10px 12px', flexShrink: 0 }}>

        {/* Brain indicator */}
        {!collapsed && brainAgeInfo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px', marginBottom: '8px', borderRadius: '10px',
            background: brainAgeInfo.bg,
            border: `1px solid ${brainAgeInfo.border}`,
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
              background: brainAgeInfo.color,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#6e6e73' }}>
                {urgentCount > 0 ? `${urgentCount} deals need attention` : 'AI ready'}
              </div>
              <div style={{ fontSize: '10px', color: '#aeaeb2', marginTop: '1px' }}>
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
              width: '42px', height: '38px', borderRadius: '10px',
              background: 'rgba(0,0,0,0.04)',
              border: '1px solid rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#aeaeb2', margin: '0 auto',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.color = '#6e6e73'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.07)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.color = '#aeaeb2'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'
            }}
          >
            <LogOut size={13} />
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 10px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.55)',
            border: '1px solid rgba(255,255,255,0.60)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: '#fff',
              boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
            }}>
              {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em',
                color: '#1d1d1f',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Account'}
              </div>
              <div style={{
                fontSize: '10px', color: '#aeaeb2',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px',
              }}>
                {user?.emailAddresses?.[0]?.emailAddress ?? ''}
              </div>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              style={{
                background: 'none', border: 'none', padding: '4px',
                color: '#aeaeb2', borderRadius: '6px',
                display: 'flex', alignItems: 'center', cursor: 'pointer',
                transition: 'color 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#6e6e73'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#aeaeb2'}
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )

  const MOBILE_TABS = [
    { href: '/pipeline',    icon: Home,    label: 'Pipeline' },
    { href: '/competitors', icon: Swords,  label: 'Intel' },
    { href: '/playbook',    icon: BookOpen, label: 'Playbook' },
  ]

  return (
    <>
      <div className="desktop-sidebar">{SidebarContent}</div>
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)' }}
          onClick={closeMobile}
        />
      )}
      <div
        className="mobile-sidebar"
        style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 40,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.20s cubic-bezier(0.4,0,0.2,1)',
          width: '220px',
        }}
      >
        {SidebarContent}
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '60px',
        background: 'rgba(255,255,255,0.80)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderTop: '1px solid rgba(255,255,255,0.60)',
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
                gap: '4px', textDecoration: 'none', padding: '6px 14px', borderRadius: '10px',
                minWidth: '52px', minHeight: '48px',
              }}
            >
              <tab.icon size={18} style={{ color: active ? '#6366f1' : '#aeaeb2' }} />
              <span style={{
                fontSize: '10px', fontWeight: active ? 600 : 500,
                color: active ? '#6366f1' : '#aeaeb2',
                lineHeight: 1,
              }}>{tab.label}</span>
            </Link>
          )
        })}
        <button
          onClick={toggleCopilot}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '4px', background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 14px', borderRadius: '10px',
            minWidth: '52px', minHeight: '48px',
          }}
        >
          <MessageSquare size={18} style={{ color: '#6366f1' }} />
          <span style={{ fontSize: '10px', fontWeight: 500, color: '#6366f1', lineHeight: 1 }}>Ask AI</span>
        </button>
      </nav>

      <style>{`
        .desktop-sidebar { display: block; }
        .mobile-sidebar  { display: none; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-sidebar  { display: block; }
          .mobile-bottom-nav { display: flex !important; }
          main { margin-left: 0 !important; padding-bottom: 68px !important; }
        }
      `}</style>
    </>
  )
}
