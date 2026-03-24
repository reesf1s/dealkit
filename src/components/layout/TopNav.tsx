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
  '/dashboard':    { label: 'Today',             Icon: LayoutDashboard },
  '/pipeline':     { label: 'Pipeline',          Icon: Kanban },
  '/deals':        { label: 'Deal Intelligence', Icon: ClipboardList },
  '/collateral':   { label: 'Collateral',        Icon: FileText },
  '/product-gaps': { label: 'Product Gaps',      Icon: AlertTriangle },
  '/company':      { label: 'Company Profile',   Icon: Building2 },
  '/competitors':  { label: 'Intelligence',      Icon: Swords },
  '/case-studies': { label: 'Case Studies',      Icon: BookOpen },
  '/settings':     { label: 'Settings',          Icon: Settings },
  '/onboarding':   { label: 'Setup',             Icon: Sparkles },
  '/models':       { label: 'Models',            Icon: Brain },
  '/playbook':     { label: 'Playbook',          Icon: BookOpen },
  '/chat':         { label: 'Ask AI',            Icon: MessageSquare },
}

function getPageInfo(pathname: string) {
  if (PAGE_MAP[pathname]) return PAGE_MAP[pathname]
  for (const [key, val] of Object.entries(PAGE_MAP)) {
    if (pathname.startsWith(key + '/')) return val
  }
  return { label: 'Halvex', Icon: LayoutDashboard }
}

export default function TopNav() {
  const pathname = usePathname()
  const { user } = useUser()
  const { sidebarWidth, openMobile, toggleCopilot } = useSidebar()

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
      background: 'rgba(255, 255, 255, 0.60)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.50)',
      boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: '12px',
      justifyContent: 'space-between',
      transition: 'left 0.20s cubic-bezier(0.4,0,0.2,1)',
    }}>

      {/* Left: Mobile hamburger + page label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <button
          onClick={openMobile}
          className="mobile-menu-btn"
          style={{
            display: 'none', width: '30px', height: '30px', borderRadius: '7px',
            background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Menu size={14} style={{ color: '#6e6e73' }} />
        </button>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#aeaeb2', fontWeight: 400, letterSpacing: '-0.01em' }}>
            Halvex
          </span>
          <span style={{ fontSize: '13px', color: '#d1d1d6', fontWeight: 300 }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon size={13} style={{ color: '#6366f1', flexShrink: 0 }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.02em' }}>
              {label}
            </span>
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
          background: 'rgba(255,255,255,0.55)',
          border: '1px solid rgba(255,255,255,0.65)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 12px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
        onMouseEnter={e => {
          ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.80)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.85)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(99,102,241,0.08)'
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.55)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.65)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'
        }}
      >
        <Search size={12} style={{ color: '#aeaeb2', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: '#aeaeb2', flex: 1, textAlign: 'left', letterSpacing: '-0.01em' }}>
          Search anything...
        </span>
        <span style={{
          fontSize: '10px', color: '#aeaeb2',
          background: 'rgba(0,0,0,0.05)',
          border: '1px solid rgba(0,0,0,0.06)',
          padding: '1px 5px', borderRadius: '4px',
          letterSpacing: '0.02em', flexShrink: 0,
        }}>⌘P</span>
      </button>

      {/* Right: AI status + Ask AI + Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>

        {/* AI status — only show when brain has run */}
        {brainAge && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px', borderRadius: '7px',
            background: urgentCount > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
            border: `1px solid ${urgentCount > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(16,185,129,0.18)'}`,
          }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
              background: urgentCount > 0 ? '#ef4444' : '#10b981',
            }} />
            <span style={{
              fontSize: '11px', fontWeight: 500, letterSpacing: '-0.01em',
              color: urgentCount > 0 ? '#ef4444' : '#10b981',
              whiteSpace: 'nowrap',
            }}>
              {urgentCount > 0 ? `${urgentCount} flagged` : 'AI ready'}
            </span>
          </div>
        )}

        {/* Ask AI button */}
        <button
          onClick={toggleCopilot}
          style={{
            height: '34px', padding: '0 14px',
            display: 'flex', alignItems: 'center', gap: '7px',
            borderRadius: '10px', fontSize: '13px', fontWeight: 600,
            letterSpacing: '-0.01em', cursor: 'pointer',
            background: 'rgba(99, 102, 241, 0.10)',
            border: '1px solid rgba(99, 102, 241, 0.22)',
            color: '#6366f1',
            transition: 'all 0.15s', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(99,102,241,0.08)',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.18)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.35)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(99,102,241,0.18)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.10)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.22)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(99,102,241,0.08)'
          }}
        >
          <MessageSquare size={13} style={{ color: '#6366f1', flexShrink: 0 }} />
          Ask AI
          <span style={{
            fontSize: '10px', color: 'rgba(99,102,241,0.55)',
            background: 'rgba(99,102,241,0.10)', padding: '2px 5px',
            borderRadius: '4px',
          }}>⌘K</span>
        </button>

        {/* Avatar */}
        <div style={{
          width: '30px', height: '30px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #818cf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 700, color: '#fff',
          boxShadow: '0 2px 8px rgba(99,102,241,0.30)',
          cursor: 'default', flexShrink: 0, letterSpacing: '-0.01em',
        }}>
          {avatarLetter}
        </div>
      </div>
    </header>
  )
}
