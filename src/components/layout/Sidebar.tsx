'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import {
  LayoutDashboard, Building2, Swords, BookOpen,
  ClipboardList, FileText, Settings, LogOut, Search,
  Kanban, AlertTriangle, Sparkles, ChevronLeft, ChevronRight,
  X, Brain,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const CORE_ITEMS = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard'    },
  { href: '/pipeline',     icon: Kanban,          label: 'Pipeline'     },
  { href: '/deals',        icon: ClipboardList,   label: 'Deals'        },
  { href: '/collateral',   icon: FileText,        label: 'Collateral'   },
]

const INTEL_ITEMS = [
  { href: '/competitors',   icon: Swords,         label: 'Competitors'  },
  { href: '/case-studies',  icon: BookOpen,       label: 'Case Studies' },
  { href: '/product-gaps',  icon: AlertTriangle,  label: 'Feature Gaps' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useSidebar()
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 120000 })
  const brain = brainRes?.data
  const urgentCount = brain?.urgentDeals?.length ?? 0
  const staleCount = brain?.staleDeals?.length ?? 0

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
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

  function NavItem({ href, icon: Icon, label, badge }: { href: string; icon: React.ElementType; label: string; badge?: { count: number; color: string } }) {
    const active = isActive(href)
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
          color: active ? '#E5E7EB' : '#6B7280',
          background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
          transition: 'all 0.1s',
          position: 'relative',
        }}
        onMouseEnter={e => { if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
          ;(e.currentTarget as HTMLElement).style.color = '#D1D5DB'
        }}}
        onMouseLeave={e => { if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = '#6B7280'
        }}}
      >
        {active && !collapsed && (
          <div style={{
            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
            width: '2px', height: '14px', background: '#818CF8',
            borderRadius: '0 2px 2px 0',
          }} />
        )}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Icon size={14} color={active ? '#A78BFA' : 'currentColor'} style={{ display: 'block', marginLeft: active && !collapsed ? '2px' : 0 }} />
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
      <div style={{ padding: '10px 10px 4px', fontSize: '10px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </div>
    )
  }

  const SidebarContent = (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: w,
      background: '#0C0C0E',
      borderRight: '1px solid rgba(255,255,255,0.06)',
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
            }}>
              <FileText size={13} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: '700', fontSize: '14px', letterSpacing: '-0.02em', color: '#F0EEFF' }}>DealKit</span>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: '26px', height: '26px',
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            borderRadius: '7px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileText size={13} color="#fff" strokeWidth={2.5} />
          </div>
        )}
        <button
          onClick={() => { mobileOpen ? closeMobile() : toggleCollapsed() }}
          style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', padding: '4px', borderRadius: '5px', display: 'flex' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#9CA3AF'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#374151'}
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
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
          >
            <Search size={11} color="#4B5563" strokeWidth={2} />
            <span style={{ flex: 1, fontSize: '12px', color: '#4B5563', textAlign: 'left' }}>Search</span>
            <span style={{ fontSize: '10px', color: '#374151', background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.06)' }}>⌘K</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '8px' }}>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            style={{ width: '30px', height: '30px', borderRadius: '7px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Search size={12} color="#4B5563" />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 6px', overflowY: 'auto', overflowX: 'hidden' }}>

        <SectionLabel>Core</SectionLabel>
        {CORE_ITEMS.map(item => (
          <NavItem
            key={item.href}
            {...item}
            badge={
              item.href === '/pipeline' && urgentCount > 0 ? { count: urgentCount, color: '#EF4444' } :
              item.href === '/deals' && staleCount > 0 ? { count: staleCount, color: '#F59E0B' } :
              undefined
            }
          />
        ))}

        <SectionLabel>Intel</SectionLabel>
        {INTEL_ITEMS.map(item => <NavItem key={item.href} {...item} />)}

        <div style={{ margin: '8px 4px', height: '1px', background: 'rgba(255,255,255,0.05)' }} />

        {/* Company */}
        <NavItem href="/company" icon={Building2} label="Company" />

        {/* AI Setup */}
        {!collapsed ? (
          <Link href="/onboarding" onClick={() => closeMobile()} style={{
            display: 'flex', alignItems: 'center', gap: '9px',
            padding: '0 10px', height: '32px', borderRadius: '7px', marginTop: '2px',
            textDecoration: 'none', fontSize: '13px', fontWeight: '500', color: '#818CF8',
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.18)',
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.16)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.1)'}
          >
            <Sparkles size={13} color="#818CF8" />
            AI Setup
          </Link>
        ) : (
          <Link href="/onboarding" onClick={() => closeMobile()} title="AI Setup" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '32px', borderRadius: '7px', marginTop: '2px',
            textDecoration: 'none', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.18)',
          }}>
            <Sparkles size={13} color="#818CF8" />
          </Link>
        )}

        <div style={{ margin: '6px 4px', height: '1px', background: 'rgba(255,255,255,0.05)' }} />

        <NavItem href="/settings" icon={Settings} label="Settings" />
      </nav>

      {/* Brain status + user */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '8px 8px 10px' }}>
        {/* Brain health indicator */}
        {!collapsed && brainAge && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '5px 8px', marginBottom: '6px', borderRadius: '6px',
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
          }}>
            <Brain size={10} color="#6366F1" />
            <span style={{ fontSize: '10px', color: '#374151', flex: 1 }}>Brain updated {brainAge}</span>
            {(urgentCount > 0 || staleCount > 0) && (
              <span style={{ fontSize: '10px', color: '#EF4444' }}>{urgentCount + staleCount} flagged</span>
            )}
          </div>
        )}

        {collapsed ? (
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            title="Sign out"
            style={{
              width: '100%', height: '32px', borderRadius: '7px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#4B5563',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#9CA3AF'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#4B5563'}
          >
            <LogOut size={12} />
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 8px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
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
              <div style={{ fontSize: '12px', fontWeight: '500', color: '#D1D5DB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Account'}
              </div>
              <div style={{ fontSize: '10px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                {user?.emailAddresses?.[0]?.emailAddress ?? ''}
              </div>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              style={{ background: 'none', border: 'none', padding: '3px', color: '#374151', borderRadius: '4px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#9CA3AF'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#374151'}
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
