'use client'

import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import {
  LayoutDashboard, ClipboardList, FileText, BarChart2,
  AlertTriangle, Swords, BookOpen, Settings,
  Search, Sparkles, Menu, MessageSquare, Brain, GitBranch, Plug, Zap, Users,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'
import { fetcher } from '@/lib/fetcher'

const PAGE_MAP: Record<string, { label: string; Icon: React.ElementType }> = {
  '/dashboard':    { label: 'Overview',          Icon: LayoutDashboard },
  '/pipeline':     { label: 'Pipeline Map',      Icon: GitBranch },
  '/deals':        { label: 'Opportunities',     Icon: GitBranch },
  '/collateral':   { label: 'Collateral',        Icon: FileText },
  '/product-gaps': { label: 'Product Gaps',      Icon: AlertTriangle },
  '/company':      { label: 'Integrations',      Icon: Plug },
  '/contacts':     { label: 'Contacts',           Icon: Users },
  '/connections':  { label: 'Conversations',     Icon: MessageSquare },
  '/workflows':    { label: 'Sequences',         Icon: Zap },
  '/intelligence': { label: 'Signals',           Icon: Brain },
  '/analytics':    { label: 'Analytics',          Icon: BarChart2 },
  '/competitors':  { label: 'Competitors',       Icon: Swords },
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

  const { data: brainRes, error: brainError } = useSWR('/api/brain', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
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

  const showIntelligenceChip = Boolean(brainAge) || Boolean(brainError)
  const intelligenceText = brainError
    ? 'Intelligence degraded'
    : urgentCount > 0
      ? `${urgentCount} need attention`
      : `Intelligence live · ${brainAge}`

  const intelligenceColor = brainError
    ? '#f59e0b'
    : urgentCount > 0
      ? '#ef4444'
      : '#1DB86A'

  const intelligenceBg = brainError
    ? 'var(--color-amber-bg)'
    : urgentCount > 0
      ? 'var(--color-red-bg)'
      : 'var(--color-green-bg)'

  const intelligenceBorder = brainError
    ? 'rgba(251,191,36,0.30)'
    : urgentCount > 0
      ? 'rgba(248,113,113,0.30)'
      : 'rgba(29,184,106,0.24)'

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: `${sidebarWidth}px`,
      right: 0,
      height: '45px',
      zIndex: 30,
      background: 'var(--surface-1)',
      borderBottom: '1px solid var(--border-default)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '10px',
      justifyContent: 'space-between',
      transition: 'left 0.15s cubic-bezier(0.4,0,0.2,1)',
    }}>

      {/* ── Left: Mobile menu + breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <button
          onClick={openMobile}
          className="mobile-menu-btn"
          style={{
            display: 'none',
            width: '28px',
            height: '28px',
            borderRadius: '5px',
            background: 'var(--surface-2)',
            border: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 80ms',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#eeeeee'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
        >
          <Menu size={14} style={{ color: '#666666' }} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
          <span style={{
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            fontWeight: 400,
            flexShrink: 0,
          }}>
            Halvex
          </span>
          <span style={{ fontSize: '12px', color: 'var(--border-default)', flexShrink: 0 }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
            <Icon size={12} style={{ color: '#1DB86A', flexShrink: 0 }} />
            <span style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
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

      {/* ── Center: Search ── */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
        style={{
          flex: '0 1 300px',
          height: '28px',
          background: 'var(--surface-2)',
          border: '1px solid transparent',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '0 10px',
          cursor: 'pointer',
          transition: 'background 80ms, border-color 80ms',
          flexShrink: 1,
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'rgba(26,26,26,0.08)'
          el.style.borderColor = 'var(--border-default)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'var(--surface-2)'
          el.style.borderColor = 'transparent'
        }}
      >
        <Search size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <span style={{
          fontSize: '12px',
          color: 'var(--text-tertiary)',
          flex: 1,
          textAlign: 'left',
          letterSpacing: '-0.005em',
        }}>
          Search or ask anything…
        </span>
        <span style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-default)',
          padding: '1px 4px',
          borderRadius: '3px',
          flexShrink: 0,
        }}>⌘P</span>
      </button>

      {/* ── Right: chips + avatar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {showIntelligenceChip && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 9px',
            borderRadius: '100px',
            background: intelligenceBg,
            border: `1px solid ${intelligenceBorder}`,
          }}>
            <div style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              flexShrink: 0,
              background: intelligenceColor,
            }} />
            <span style={{
              fontSize: '11.5px',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              color: intelligenceColor,
              whiteSpace: 'nowrap',
            }}>
              {intelligenceText}
            </span>
          </div>
        )}

        <button
          onClick={toggleCopilot}
          style={{
            height: '28px',
            padding: '0 11px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            cursor: 'pointer',
            background: 'rgba(29, 184, 106, 0.09)',
            border: '1px solid rgba(29, 184, 106, 0.20)',
            color: '#1DB86A',
            transition: 'background 80ms, border-color 80ms',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(29, 184, 106, 0.14)'
            el.style.borderColor = 'rgba(29, 184, 106, 0.32)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(29, 184, 106, 0.09)'
            el.style.borderColor = 'rgba(29, 184, 106, 0.20)'
          }}
        >
          <MessageSquare size={11} style={{ color: '#1DB86A', flexShrink: 0 }} />
          Ask AI
          <span style={{
            fontSize: '10px',
            color: 'rgba(29, 184, 106, 0.50)',
            background: 'rgba(29, 184, 106, 0.10)',
            padding: '1px 4px',
            borderRadius: '3px',
          }}>⌘K</span>
        </button>

        <div style={{
          width: '26px',
          height: '26px',
          borderRadius: '5px',
          background: '#1DB86A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: 700,
          color: '#ffffff',
          cursor: 'default',
          flexShrink: 0,
          letterSpacing: '-0.01em',
        }}>
          {avatarLetter}
        </div>
      </div>
    </header>
  )
}
