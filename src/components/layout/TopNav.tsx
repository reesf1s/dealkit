'use client'

import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import {
  LayoutDashboard, Kanban, ClipboardList, FileText,
  AlertTriangle, Building2, Swords, BookOpen, Settings,
  Search, Sparkles, Menu, MessageSquare, Brain, GitBranch, Plug,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const PAGE_MAP: Record<string, { label: string; Icon: React.ElementType }> = {
  '/dashboard':    { label: 'Today',             Icon: LayoutDashboard },
  '/pipeline':     { label: 'Pipeline',          Icon: GitBranch },
  '/deals':        { label: 'Deal Intelligence', Icon: ClipboardList },
  '/collateral':   { label: 'Collateral',        Icon: FileText },
  '/product-gaps': { label: 'Product Gaps',      Icon: AlertTriangle },
  '/company':      { label: 'Integrations',      Icon: Plug },
  '/workflows':    { label: 'Automation',          Icon: Sparkles },
  '/intelligence': { label: 'Intelligence',      Icon: Brain  },
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
      height: '50px',
      zIndex: 30,
      background: 'rgba(7, 5, 18, 0.75)',
      backdropFilter: 'blur(24px) saturate(200%)',
      WebkitBackdropFilter: 'blur(24px) saturate(200%)',
      borderBottom: '1px solid rgba(255,255,255,0.055)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: '12px',
      justifyContent: 'space-between',
      transition: 'left 0.18s cubic-bezier(0.4,0,0.2,1)',
      boxShadow: '0 1px 0 rgba(255,255,255,0.02)',
    }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <button
          onClick={openMobile}
          className="mobile-menu-btn"
          style={{
            display: 'none', width: '30px', height: '30px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Menu size={14} style={{ color: 'rgba(255,255,255,0.45)' }} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.18)', fontWeight: 400, letterSpacing: '-0.01em' }}>
            Halvex
          </span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.10)' }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Icon size={12} style={{ color: 'rgba(167,139,250,0.75)', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.80)', letterSpacing: '-0.025em' }}>
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

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
        style={{
          width: '260px',
          height: '30px',
          background: 'rgba(255,255,255,0.035)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '0 12px',
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'rgba(255,255,255,0.055)'
          el.style.borderColor = 'rgba(255,255,255,0.11)'
          el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.20)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'rgba(255,255,255,0.035)'
          el.style.borderColor = 'rgba(255,255,255,0.07)'
          el.style.boxShadow = 'none'
        }}
      >
        <Search size={11} style={{ color: 'rgba(255,255,255,0.22)', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.22)', flex: 1, textAlign: 'left', letterSpacing: '-0.01em' }}>
          Search anything...
        </span>
        <span style={{
          fontSize: '10px', color: 'rgba(255,255,255,0.16)',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.07)',
          padding: '1px 5px', borderRadius: '4px',
          letterSpacing: '0.02em', flexShrink: 0,
        }}>⌘P</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {brainAge && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px', borderRadius: '20px',
            background: urgentCount > 0
              ? 'rgba(248,113,113,0.08)'
              : 'linear-gradient(90deg, rgba(139,92,246,0.10) 0%, rgba(52,211,153,0.08) 100%)',
            border: `1px solid ${urgentCount > 0 ? 'rgba(248,113,113,0.18)' : 'rgba(139,92,246,0.20)'}`,
          }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
              background: urgentCount > 0 ? '#f87171' : '#a78bfa',
              boxShadow: urgentCount > 0 ? '0 0 8px rgba(248,113,113,0.60)' : '0 0 8px rgba(167,139,250,0.70)',
            }} />
            <span style={{
              fontSize: '11px', fontWeight: 500, letterSpacing: '-0.01em',
              color: urgentCount > 0 ? '#f87171' : 'rgba(167,139,250,0.90)',
              whiteSpace: 'nowrap',
            }}>
              {urgentCount > 0 ? `${urgentCount} need attention` : `Intelligence live · ${brainAge}`}
            </span>
          </div>
        )}

        <button
          onClick={toggleCopilot}
          style={{
            height: '30px', padding: '0 12px',
            display: 'flex', alignItems: 'center', gap: '6px',
            borderRadius: '20px', fontSize: '12px', fontWeight: 500,
            letterSpacing: '-0.01em', cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.22) 0%, rgba(99,102,241,0.18) 100%)',
            border: '1px solid rgba(139,92,246,0.30)',
            color: 'rgba(196,181,253,0.95)',
            transition: 'all 0.15s', flexShrink: 0,
            boxShadow: '0 1px 8px rgba(139,92,246,0.12)',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.32) 0%, rgba(99,102,241,0.28) 100%)'
            el.style.borderColor = 'rgba(139,92,246,0.45)'
            el.style.boxShadow = '0 2px 12px rgba(139,92,246,0.22)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.22) 0%, rgba(99,102,241,0.18) 100%)'
            el.style.borderColor = 'rgba(139,92,246,0.30)'
            el.style.boxShadow = '0 1px 8px rgba(139,92,246,0.12)'
          }}
        >
          <MessageSquare size={11} style={{ color: 'rgba(196,181,253,0.90)', flexShrink: 0 }} />
          Ask AI
          <span style={{
            fontSize: '10px', color: 'rgba(196,181,253,0.40)',
            background: 'rgba(139,92,246,0.15)', padding: '1px 4px',
            borderRadius: '4px',
          }}>⌘K</span>
        </button>

        <div style={{
          width: '30px', height: '30px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.14)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.90)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.10)',
          cursor: 'default', flexShrink: 0, letterSpacing: '-0.01em',
        }}>
          {avatarLetter}
        </div>
      </div>
    </header>
  )
}
