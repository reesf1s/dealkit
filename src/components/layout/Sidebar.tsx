'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import {
  LayoutDashboard, Building2, Swords, BookOpen,
  ClipboardList, FileText, Settings, LogOut, Search,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/company',      icon: Building2,       label: 'Company' },
  { href: '/competitors',  icon: Swords,          label: 'Competitors' },
  { href: '/case-studies', icon: BookOpen,        label: 'Case Studies' },
  { href: '/deals',        icon: ClipboardList,   label: 'Deal Log' },
  { href: '/collateral',   icon: FileText,        label: 'Collateral' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: '220px',
      background: '#0A0A0A',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column', zIndex: 40,
    }}>

      {/* Logo */}
      <div style={{ padding: '18px 14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 8px', borderRadius: '8px' }}>
          <div style={{
            width: '28px', height: '28px',
            background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 0 12px rgba(99,102,241,0.4)',
          }}>
            <FileText size={13} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '14px', letterSpacing: '-0.03em', color: '#EBEBEB', lineHeight: 1 }}>DealKit</div>
            <div style={{ fontSize: '10px', color: '#444', marginTop: '2px', letterSpacing: '0.02em' }}>Sales Intelligence</div>
          </div>
        </div>
      </div>

      {/* Search button */}
      <div style={{ padding: '0 10px 10px' }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
          style={{
            width: '100%', height: '32px', borderRadius: '7px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', padding: '0 10px',
            transition: 'background 0.1s, border-color 0.1s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.055)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'
          }}
        >
          <Search size={12} color="#444" strokeWidth={2} />
          <span style={{ flex: 1, fontSize: '12px', color: '#444', textAlign: 'left' }}>Search...</span>
          <span style={{ fontSize: '10px', color: '#333', background: 'rgba(255,255,255,0.05)', padding: '2px 5px', borderRadius: '4px', letterSpacing: '0.02em' }}>⌘K</span>
        </button>
      </div>

      {/* Nav section label */}
      <div style={{ padding: '0 18px 6px' }}>
        <span style={{ fontSize: '10px', color: '#333', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Main</span>
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
                padding: '0 10px', height: '34px', borderRadius: '7px',
                marginBottom: '2px', textDecoration: 'none',
                fontSize: '13px', fontWeight: active ? '500' : '400',
                color: active ? '#EBEBEB' : '#555',
                background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                transition: 'all 0.1s',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {active && (
                <div style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: '3px', height: '16px', background: 'linear-gradient(180deg, #6366F1, #818CF8)',
                  borderRadius: '0 2px 2px 0', boxShadow: '0 0 6px rgba(99,102,241,0.6)',
                }} />
              )}
              <Icon size={14} style={{ flexShrink: 0, marginLeft: active ? '3px' : 0 }} />
              {label}
            </Link>
          )
        })}

        <div style={{ margin: '10px 2px', height: '1px', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ padding: '0 10px 4px' }}>
          <span style={{ fontSize: '10px', color: '#2A2A2A', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Account</span>
        </div>

        <Link
          href="/settings"
          style={{
            display: 'flex', alignItems: 'center', gap: '9px',
            padding: '0 10px', height: '34px', borderRadius: '7px',
            textDecoration: 'none', fontSize: '13px',
            color: isActive('/settings') ? '#EBEBEB' : '#555',
            background: isActive('/settings') ? 'rgba(255,255,255,0.07)' : 'transparent',
            position: 'relative',
          }}
        >
          {isActive('/settings') && (
            <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '3px', height: '16px', background: 'linear-gradient(180deg, #6366F1, #818CF8)', borderRadius: '0 2px 2px 0', boxShadow: '0 0 6px rgba(99,102,241,0.6)' }} />
          )}
          <Settings size={14} style={{ marginLeft: isActive('/settings') ? '3px' : 0 }} />
          Settings
        </Link>
      </nav>

      {/* User */}
      <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          padding: '8px 10px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: '700', color: '#fff',
          }}>
            {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#EBEBEB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Account'}
            </div>
            <div style={{ fontSize: '10px', color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
              {user?.emailAddresses?.[0]?.emailAddress ?? ''}
            </div>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            style={{
              background: 'none', border: 'none', padding: '4px', color: '#333',
              borderRadius: '5px', display: 'flex', alignItems: 'center', cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#888'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#333'}
            title="Sign out"
          >
            <LogOut size={12} />
          </button>
        </div>
      </div>
    </aside>
  )
}
