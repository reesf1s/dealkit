'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import {
  CalendarCheck,
  Home,
  Target,
  Kanban,
  Users,
  Building2,
  Bot,
  Settings,
  Search,
  Menu,
} from 'lucide-react'
import { useSidebar } from './SidebarContext'
import { fetcher } from '@/lib/fetcher'

type NavMeta = { label: string; icon: React.ElementType }

const PAGE_MAP: Record<string, NavMeta> = {
  '/home': { label: 'Home', icon: Home },
  '/today': { label: 'Home', icon: Home },
  '/dashboard': { label: 'Home', icon: Home },
  '/calendar': { label: 'Calendar', icon: CalendarCheck },
  '/deals': { label: 'Deals', icon: Target },
  '/pipeline': { label: 'Pipeline', icon: Kanban },
  '/companies': { label: 'Companies', icon: Building2 },
  '/contacts': { label: 'Contacts', icon: Users },
  '/tasks': { label: 'Tasks', icon: Target },
  '/assistant': { label: 'Assistant', icon: Bot },
  '/settings': { label: 'Settings', icon: Settings },
}

function resolvePage(pathname: string): NavMeta {
  if (PAGE_MAP[pathname]) return PAGE_MAP[pathname]
  for (const [key, value] of Object.entries(PAGE_MAP)) {
    if (pathname.startsWith(`${key}/`)) return value
  }
  return { label: 'Halvex CRM', icon: CalendarCheck }
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `£${Math.round(value / 1_000)}k`
  return `£${Math.round(value)}`
}

export default function TopNav() {
  const pathname = usePathname()
  const { sidebarWidth, openMobile } = useSidebar()

  const { data: todayRes } = useSWR('/api/crm/today', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45000,
  })

  const { label, icon: Icon } = resolvePage(pathname)
  const today = todayRes?.data
  const pipelineValue = Number(today?.openPipelineValue ?? 0)
  const priorityCount = Array.isArray(today?.priorities) ? today.priorities.length : 0
  const riskCount = Array.isArray(today?.atRiskDeals) ? today.atRiskDeals.length : 0

  return (
	    <header style={{
	      position: 'fixed',
	      top: 0,
	      left: `${sidebarWidth}px`,
	      right: 0,
	      height: 52,
	      zIndex: 30,
	      background: 'var(--topnav-bg)',
	      backdropFilter: 'blur(16px)',
	      WebkitBackdropFilter: 'blur(16px)',
	      borderBottom: '1px solid var(--border-default)',
	      display: 'flex',
	      alignItems: 'center',
	      justifyContent: 'space-between',
      gap: 12,
      padding: '0 14px',
      transition: 'left 0.15s cubic-bezier(0.4,0,0.2,1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <button
          onClick={openMobile}
          className="mobile-menu-btn"
          style={{
            display: 'none',
            width: 30,
            height: 30,
            borderRadius: 7,
            border: '1px solid var(--border-default)',
            background: 'var(--surface-2)',
            color: 'var(--text-tertiary)',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Menu size={13} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-1)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={13} style={{ color: 'var(--text-secondary)' }} />
          </span>
          <span style={{
            fontSize: 12.75,
            fontWeight: 700,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {label}
          </span>
        </div>
      </div>

	      <button
	        onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
	        style={{
	          flex: '0 1 420px',
	          height: 32,
	          borderRadius: 7,
	          border: '1px solid var(--border-default)',
	          background: 'var(--surface-1)',
	          color: 'var(--text-tertiary)',
	          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '0 11px',
          cursor: 'pointer',
          minWidth: 180,
        }}
        aria-label="Open command palette"
      >
        <Search size={12} />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          Search deals, contacts, notes, commands
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>⌘P</span>
      </button>

      <div className="topnav-status" style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <div className="notion-chip" style={{ color: 'var(--text-primary)' }}>
          Pipeline {formatCurrency(pipelineValue)}
        </div>

        <div className="notion-chip">
          Priorities {priorityCount} · Risk {riskCount}
        </div>

        <Link
          href="/assistant"
          style={{
            height: 32,
            padding: '0 12px',
            borderRadius: 7,
            border: '1px solid var(--brand-border)',
            background: 'var(--brand-bg)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          <Bot size={11} />
          Assistant
        </Link>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .mobile-menu-btn { display: flex !important; }
          .topnav-status .notion-chip { display: none !important; }
          header > button[aria-label='Open command palette'] { flex: 1 1 auto !important; min-width: 120px !important; }
        }
      `}</style>
    </header>
  )
}
