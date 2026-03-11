'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import {
  LayoutDashboard, Building2, Swords, BookOpen,
  ClipboardList, FileText, Settings, LogOut, Search,
  Kanban, AlertTriangle, Sparkles,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/pipeline',      icon: Kanban,          label: 'Pipeline' },
  { href: '/deals',         icon: ClipboardList,   label: 'Deal Log' },
  { href: '/collateral',    icon: FileText,        label: 'Collateral' },
  { href: '/product-gaps',  icon: AlertTriangle,   label: 'Product Gaps' },
  { href: '/company',       icon: Building2,       label: 'Company' },
  { href: '/competitors',   icon: Swords,          label: 'Competitors' },
  { href: '/case-studies',  icon: BookOpen,        label: 'Case Studies' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: '220px',
      background: 'rgba(9,6,18,0.95)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(139,92,246,0.1)',
      display: 'flex', flexDirection: 'column', zIndex: 40,
    }}>

      {/* Logo */}
      <div style={{ padding: '18px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 8px', borderRadius: '10px' }}>
          <div style={{
            width: '30px', height: '30px',
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            borderRadius: '9px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 0 16px rgba(99,102,241,0.5), 0 2px 8px rgba(0,0,0,0.4)',
          }}>
            <FileText size={14} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '14px', letterSpacing: '-0.03em', color: '#F0EEFF', lineHeight: 1 }}>DealKit</div>
            <div style={{ fontSize: '10px', color: '#4B5563', marginTop: '2px', letterSpacing: '0.04em' }}>Sales Intelligence</div>
          </div>
        </div>

        {/* Thin divider */}
        <div style={{ height: '1px', background: 'rgba(139,92,246,0.1)', marginTop: '12px', marginLeft: '8px', marginRight: '8px' }} />
      </div>

      {/* Search / ⌘K button */}
      <div style={{ padding: '0 10px 10px' }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
          style={{
            width: '100%', height: '33px', borderRadius: '100px',
            backgroundColor: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', padding: '0 10px',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.08)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.2)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'
          }}
        >
          <Search size={12} color="#4B5563" strokeWidth={2} />
          <span style={{ flex: 1, fontSize: '12px', color: '#4B5563', textAlign: 'left' }}>Search...</span>
          <span style={{ fontSize: '10px', color: '#4B5563', background: 'rgba(255,255,255,0.06)', padding: '2px 5px', borderRadius: '4px', letterSpacing: '0.02em', border: '1px solid rgba(255,255,255,0.06)' }}>⌘K</span>
        </button>
      </div>

      {/* MENU section label */}
      <div style={{ padding: '0 18px 6px' }}>
        <span style={{ fontSize: '10px', color: '#4B5563', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Menu</span>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '0 8px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex', alignItems: 'center', gap: '9px',
                padding: '0 10px', height: '36px', borderRadius: '9px',
                marginBottom: '2px', textDecoration: 'none',
                fontSize: '13px', fontWeight: active ? '500' : '400',
                color: active ? '#A78BFA' : '#9CA3AF',
                background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
                backdropFilter: active ? 'blur(8px)' : 'none',
                WebkitBackdropFilter: active ? 'blur(8px)' : 'none',
                border: active ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                transition: 'all 0.15s',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!active) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.07)'
                ;(e.currentTarget as HTMLElement).style.color = '#F0EEFF'
              }}}
              onMouseLeave={e => { if (!active) {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = '#9CA3AF'
              }}}
            >
              {active && (
                <>
                  <div style={{
                    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                    width: '3px', height: '18px', background: 'linear-gradient(180deg, #6366F1, #8B5CF6)',
                    borderRadius: '0 3px 3px 0', boxShadow: '0 0 8px rgba(99,102,241,0.7)',
                  }} />
                  {/* Pulsing dot */}
                  <div style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: '#8B5CF6',
                    boxShadow: '0 0 6px rgba(139,92,246,0.8)',
                    animation: 'pulse-glow 2s ease-in-out infinite',
                  }} />
                </>
              )}
              <Icon size={14} color={active ? '#A78BFA' : 'currentColor'} style={{ flexShrink: 0, marginLeft: active ? '3px' : 0 }} />
              {label}
            </Link>
          )
        })}

        {/* Divider */}
        <div style={{ margin: '10px 2px', height: '1px', background: 'rgba(139,92,246,0.08)' }} />

        {/* AI Setup pill */}
        <Link href="/onboarding" style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          padding: '0 10px', height: '33px', borderRadius: '100px', marginBottom: '10px',
          textDecoration: 'none', fontSize: '12px', fontWeight: '600', color: '#A78BFA',
          background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(139,92,246,0.25)',
          transition: 'all 0.15s',
          boxShadow: '0 0 16px rgba(124,58,237,0.1)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.2)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(124,58,237,0.2)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.12)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px rgba(124,58,237,0.1)'
        }}
        >
          <Sparkles size={12} color="#A78BFA" />
          AI Setup
        </Link>

        {/* OTHER section label */}
        <div style={{ padding: '0 10px 6px' }}>
          <span style={{ fontSize: '10px', color: '#4B5563', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Other</span>
        </div>

        {/* Settings */}
        <Link
          href="/settings"
          style={{
            display: 'flex', alignItems: 'center', gap: '9px',
            padding: '0 10px', height: '36px', borderRadius: '9px',
            textDecoration: 'none', fontSize: '13px',
            fontWeight: isActive('/settings') ? '500' : '400',
            color: isActive('/settings') ? '#A78BFA' : '#9CA3AF',
            background: isActive('/settings') ? 'rgba(99,102,241,0.18)' : 'transparent',
            border: isActive('/settings') ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
            position: 'relative',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!isActive('/settings')) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.07)'
            ;(e.currentTarget as HTMLElement).style.color = '#F0EEFF'
          }}}
          onMouseLeave={e => { if (!isActive('/settings')) {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#9CA3AF'
          }}}
        >
          {isActive('/settings') && (
            <>
              <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '3px', height: '18px', background: 'linear-gradient(180deg, #6366F1, #8B5CF6)', borderRadius: '0 3px 3px 0', boxShadow: '0 0 8px rgba(99,102,241,0.7)' }} />
              <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '6px', height: '6px', borderRadius: '50%', background: '#8B5CF6', boxShadow: '0 0 6px rgba(139,92,246,0.8)' }} />
            </>
          )}
          <Settings size={14} color={isActive('/settings') ? '#A78BFA' : 'currentColor'} style={{ marginLeft: isActive('/settings') ? '3px' : 0 }} />
          Settings
        </Link>
      </nav>

      {/* User card */}
      <div style={{ padding: '10px', borderTop: '1px solid rgba(139,92,246,0.08)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          padding: '9px 10px', borderRadius: '10px',
          background: 'rgba(18,12,32,0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(124,58,237,0.18)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: '700', color: '#fff',
            boxShadow: '0 0 10px rgba(99,102,241,0.4)',
          }}>
            {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#F0EEFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Account'}
            </div>
            <div style={{ fontSize: '10px', color: '#4B5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
              {user?.emailAddresses?.[0]?.emailAddress ?? ''}
            </div>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            style={{
              background: 'none', border: 'none', padding: '4px', color: '#4B5563',
              borderRadius: '5px', display: 'flex', alignItems: 'center', cursor: 'pointer',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#A78BFA'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#4B5563'}
            title="Sign out"
          >
            <LogOut size={12} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(139,92,246,0.8); }
          50% { opacity: 0.5; box-shadow: 0 0 12px rgba(139,92,246,0.4); }
        }
      `}</style>
    </aside>
  )
}
