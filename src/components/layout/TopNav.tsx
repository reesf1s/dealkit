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
      height: '52px',
      zIndex: 30,
      background: 'var(--topnav-bg)',
      backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: '12px',
      justifyContent: 'space-between',
      transition: 'left 0.18s cubic-bezier(0.4,0,0.2,1)',
    }}>

      {/* Left: Mobile hamburger + page label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <button
          onClick={openMobile}
          className="mobile-menu-btn"
          style={{
            display: 'none', width: '30px', height: '30px', borderRadius: '7px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Menu size={14} style={{ color: 'var(--text-secondary)' }} />
        </button>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 400, letterSpacing: '-0.01em' }}>
            Halvex
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', opacity: 0.5 }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Icon size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
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
          width: '260px',
          height: '30px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '0 10px',
          cursor: 'pointer',
          transition: 'border-color 0.12s, background 0.12s',
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
        <Search size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', flex: 1, textAlign: 'left', letterSpacing: '-0.01em' }}>
          Search anything...
        </span>
        <span style={{
          fontSize: '10px', color: 'var(--text-tertiary)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
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
            background: urgentCount > 0 ? 'rgba(255,69,58,0.07)' : 'rgba(48,209,88,0.07)',
            border: `1px solid ${urgentCount > 0 ? 'rgba(255,69,58,0.18)' : 'rgba(48,209,88,0.18)'}`,
          }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
              background: urgentCount > 0 ? '#FF453A' : '#30D158',
              boxShadow: urgentCount > 0 ? '0 0 5px rgba(255,69,58,0.6)' : '0 0 5px rgba(48,209,88,0.5)',
            }} />
            <span style={{
              fontSize: '11px', fontWeight: 500, letterSpacing: '-0.01em',
              color: urgentCount > 0 ? '#FF6961' : '#30D158',
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
            height: '30px', padding: '0 10px',
            display: 'flex', alignItems: 'center', gap: '6px',
            borderRadius: '7px', fontSize: '12px', fontWeight: 500,
            letterSpacing: '-0.01em', cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(124,106,245,0.14), rgba(155,109,255,0.09))',
            border: '1px solid rgba(124,106,245,0.25)',
            color: 'var(--accent-text)',
            transition: 'all 0.12s', flexShrink: 0,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(124,106,245,0.22), rgba(155,109,255,0.15))'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,106,245,0.45)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(124,106,245,0.14), rgba(155,109,255,0.09))'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,106,245,0.25)'
          }}
        >
          <MessageSquare size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          Ask AI
          <span style={{
            fontSize: '10px', color: 'var(--text-tertiary)',
            background: 'rgba(0,0,0,0.2)', padding: '1px 4px',
            borderRadius: '3px', border: '1px solid var(--border)',
          }}>⌘K</span>
        </button>

        {/* Avatar */}
        <div style={{
          width: '30px', height: '30px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #7C6AF5, #9B6DFF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 700, color: '#fff',
          boxShadow: '0 0 10px rgba(124,106,245,0.35)',
          cursor: 'default', flexShrink: 0, letterSpacing: '-0.01em',
        }}>
          {avatarLetter}
        </div>
      </div>
    </header>
  )
}
