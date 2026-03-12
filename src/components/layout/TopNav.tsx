'use client'

import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import {
  LayoutDashboard, Kanban, ClipboardList, FileText,
  AlertTriangle, Building2, Swords, BookOpen, Settings,
  Search, Bell, Sparkles, Menu, MessageSquare,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'

const PAGE_MAP: Record<string, { label: string; Icon: React.ElementType }> = {
  '/dashboard':    { label: 'Dashboard',    Icon: LayoutDashboard },
  '/pipeline':     { label: 'Pipeline',     Icon: Kanban },
  '/deals':        { label: 'Deal Log',     Icon: ClipboardList },
  '/collateral':   { label: 'Collateral',   Icon: FileText },
  '/product-gaps': { label: 'Product Gaps', Icon: AlertTriangle },
  '/company':      { label: 'Company',      Icon: Building2 },
  '/competitors':  { label: 'Competitors',  Icon: Swords },
  '/case-studies': { label: 'Case Studies', Icon: BookOpen },
  '/settings':     { label: 'Settings',     Icon: Settings },
  '/onboarding':   { label: 'AI Setup',     Icon: Sparkles },
  '/chat':         { label: 'Ask AI',       Icon: MessageSquare },
}

function getPageInfo(pathname: string) {
  // Exact match first
  if (PAGE_MAP[pathname]) return PAGE_MAP[pathname]
  // Prefix match
  for (const [key, val] of Object.entries(PAGE_MAP)) {
    if (pathname.startsWith(key + '/')) return val
  }
  return { label: 'DealKit', Icon: LayoutDashboard }
}

export default function TopNav() {
  const pathname = usePathname()
  const { user } = useUser()
  const { sidebarWidth, aiSidebarWidth, openMobile } = useSidebar()

  const { label, Icon } = getPageInfo(pathname)
  const avatarLetter =
    user?.firstName?.[0] ??
    user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ??
    '?'

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: `${sidebarWidth}px`,
      right: `${aiSidebarWidth}px`,
      height: '56px',
      zIndex: 30,
      background: 'rgba(11,7,22,0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(139,92,246,0.12)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: '16px',
      justifyContent: 'space-between',
    }}>

      {/* Left: Mobile hamburger + Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={openMobile}
          className="mobile-menu-btn"
          style={{
            display: 'none', width: '34px', height: '34px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <Menu size={15} color="#9CA3AF" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#4B5563', fontWeight: '500' }}>Menu</span>
          <span style={{ fontSize: '12px', color: '#4B5563' }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon size={13} color="#A78BFA" strokeWidth={2} />
            <span style={{ fontSize: '13px', color: '#F0EEFF', fontWeight: '600' }}>{label}</span>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>

      {/* Center: Search pill */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
        style={{
          width: '280px',
          height: '34px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '100px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 14px',
          cursor: 'pointer',
          transition: 'background 0.15s, border-color 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,92,246,0.25)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'
        }}
      >
        <Search size={13} color="#4B5563" strokeWidth={2} />
        <span style={{ fontSize: '13px', color: '#4B5563', flex: 1, textAlign: 'left' }}>Search...</span>
        <span style={{
          fontSize: '10px', color: '#4B5563',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '2px 6px', borderRadius: '5px',
          letterSpacing: '0.02em',
        }}>⌘K</span>
      </button>

      {/* Right: Bell + Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button style={{
          width: '34px', height: '34px', borderRadius: '9px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.12)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
        >
          <Bell size={15} color="#9CA3AF" strokeWidth={2} />
        </button>

        <div style={{
          width: '34px', height: '34px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: '700', color: '#fff',
          boxShadow: '0 0 12px rgba(99,102,241,0.35)',
          cursor: 'default', flexShrink: 0,
        }}>
          {avatarLetter}
        </div>
      </div>
    </header>
  )
}
