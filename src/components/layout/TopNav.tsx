'use client'

import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import {
  LayoutDashboard, Kanban, ClipboardList, FileText,
  AlertTriangle, Building2, Swords, BookOpen, Settings,
  Search, Sparkles, Menu, MessageSquare, Brain,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const PAGE_MAP: Record<string, { label: string; Icon: React.ElementType }> = {
  '/dashboard':    { label: 'Brain',             Icon: Brain },
  '/pipeline':     { label: 'Pipeline',          Icon: Kanban },
  '/deals':        { label: 'Deal Intelligence', Icon: ClipboardList },
  '/collateral':   { label: 'Collateral',        Icon: FileText },
  '/product-gaps': { label: 'Product Gaps',      Icon: AlertTriangle },
  '/company':      { label: 'Company Profile',   Icon: Building2 },
  '/competitors':  { label: 'Intelligence',      Icon: Swords },
  '/case-studies': { label: 'Case Studies',      Icon: BookOpen },
  '/settings':     { label: 'Settings',          Icon: Settings },
  '/onboarding':   { label: 'Brain Setup',       Icon: Sparkles },
  '/chat':         { label: 'Ask AI',            Icon: MessageSquare },
}

function getPageInfo(pathname: string) {
  // Exact match first
  if (PAGE_MAP[pathname]) return PAGE_MAP[pathname]
  // Prefix match
  for (const [key, val] of Object.entries(PAGE_MAP)) {
    if (pathname.startsWith(key + '/')) return val
  }
  return { label: 'SellSight', Icon: LayoutDashboard }
}

export default function TopNav() {
  const pathname = usePathname()
  const { user } = useUser()
  const { sidebarWidth, openMobile } = useSidebar()

  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 })
  const brain = brainRes?.data
  const urgentCount = (brain?.urgentDeals?.length ?? 0) + (brain?.staleDeals?.length ?? 0)
  const brainAge = brain?.updatedAt
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(brain.updatedAt).getTime()) / 60000)
        if (mins < 2) return 'live'
        if (mins < 60) return `${mins}m`
        return `${Math.floor(mins / 60)}h`
      })()
    : null

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
      right: 0,
      height: '56px',
      zIndex: 30,
      background: 'var(--topnav-bg)',
      backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      borderBottom: '1px solid var(--border)',
      boxShadow: 'var(--shadow-sm)',
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
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: '500' }}>SellSight</span>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon size={13} color="var(--accent)" strokeWidth={2} />
            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{label}</span>
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
          background: 'var(--surface)',
          border: '1px solid var(--border)',
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
          (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'var(--surface)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
        }}
      >
        <Search size={13} color="var(--text-tertiary)" strokeWidth={2} />
        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', flex: 1, textAlign: 'left' }}>Search...</span>
        <span style={{
          fontSize: '10px', color: 'var(--text-tertiary)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          padding: '2px 6px', borderRadius: '5px',
          letterSpacing: '0.02em',
        }}>⌘P</span>
      </button>

      {/* Right: Brain status + Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

        {/* Brain status pill */}
        {brainAge && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '5px 11px', borderRadius: '100px',
            background: urgentCount > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(99,102,241,0.07)',
            border: `1px solid ${urgentCount > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(99,102,241,0.18)'}`,
          }}>
            <Brain size={11} color={urgentCount > 0 ? '#F87171' : '#818CF8'} />
            <span style={{ fontSize: '11px', color: urgentCount > 0 ? '#F87171' : '#818CF8', fontWeight: '600', whiteSpace: 'nowrap' }}>
              Brain · {brainAge}
            </span>
            {urgentCount > 0 && (
              <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: '700' }}>
                · {urgentCount} flagged
              </span>
            )}
          </div>
        )}

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
