'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import {
  LayoutDashboard,
  Target,
  Kanban,
  Users,
  MessageSquare,
  BarChart3,
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
  '/dashboard': { label: 'Sales Overview', icon: LayoutDashboard },
  '/deals': { label: 'Deal Workspace', icon: Target },
  '/pipeline': { label: 'Pipeline Kanban', icon: Kanban },
  '/contacts': { label: 'Contacts', icon: Users },
  '/connections': { label: 'Activity', icon: MessageSquare },
  '/analytics': { label: 'Reports', icon: BarChart3 },
  '/company': { label: 'Company', icon: Building2 },
  '/intelligence': { label: 'Automations', icon: Bot },
  '/automations': { label: 'Automations', icon: Bot },
  '/settings': { label: 'Settings', icon: Settings },
}

function resolvePage(pathname: string): NavMeta {
  if (PAGE_MAP[pathname]) return PAGE_MAP[pathname]
  for (const [key, value] of Object.entries(PAGE_MAP)) {
    if (pathname.startsWith(`${key}/`)) return value
  }
  return { label: 'Halvex CRM', icon: LayoutDashboard }
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `£${Math.round(value / 1_000)}k`
  return `£${Math.round(value)}`
}

export default function TopNav() {
  const pathname = usePathname()
  const { sidebarWidth, openMobile, toggleCopilot } = useSidebar()

  const { data: dealsRes } = useSWR('/api/deals', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45000,
  })

  const { data: automationsRes } = useSWR('/api/automations', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45000,
  })

  const { label, icon: Icon } = resolvePage(pathname)

  const openDeals = useMemo(() => {
    const deals = dealsRes?.data
    if (!Array.isArray(deals)) return []
    return deals.filter((deal: { stage?: string }) => deal.stage !== 'closed_won' && deal.stage !== 'closed_lost')
  }, [dealsRes?.data])

  const pipelineValue = useMemo(() => openDeals.reduce((sum: number, deal: { dealValue?: number | null }) => sum + (deal.dealValue ?? 0), 0), [openDeals])

  const automationStats = useMemo(() => {
    const list = automationsRes?.data
    if (!Array.isArray(list)) return { enabled: 0, alerts: 0 }
    const enabled = list.filter((a: { enabled: boolean }) => a.enabled)
    const alerts = enabled.filter((a: { category?: string }) => a.category === 'alerts').length
    return { enabled: enabled.length, alerts }
  }, [automationsRes?.data])

  return (
	    <header style={{
	      position: 'fixed',
	      top: 0,
	      left: `${sidebarWidth}px`,
	      right: 0,
	      height: 46,
	      zIndex: 30,
	      background: 'var(--topnav-bg)',
	      backdropFilter: 'blur(16px)',
	      WebkitBackdropFilter: 'blur(16px)',
	      borderBottom: '1px solid var(--border-subtle)',
	      display: 'flex',
	      alignItems: 'center',
	      justifyContent: 'space-between',
      gap: 12,
      padding: '0 12px',
      transition: 'left 0.15s cubic-bezier(0.4,0,0.2,1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <button
          onClick={openMobile}
          className="mobile-menu-btn"
          style={{
            display: 'none',
            width: 28,
            height: 28,
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
          <Icon size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <span style={{
            fontSize: 12.5,
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
	          flex: '0 1 340px',
	          height: 27,
	          borderRadius: 7,
	          border: '1px solid var(--border-default)',
	          background: 'var(--surface-2)',
	          color: 'var(--text-tertiary)',
	          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '0 10px',
          cursor: 'pointer',
          minWidth: 180,
        }}
        aria-label="Open command palette"
      >
        <Search size={11} />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 11.5 }}>Search deals, contacts, or notes</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>⌘P</span>
      </button>

      <div className="topnav-status" style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <div className="notion-chip" style={{ color: 'var(--text-primary)' }}>
          {openDeals.length} open · {formatCurrency(pipelineValue)}
        </div>

        <div className="notion-chip">
          {automationStats.enabled} automations · {automationStats.alerts} alerts
        </div>

        <button
          onClick={toggleCopilot}
          style={{
            height: 27,
            padding: '0 11px',
            borderRadius: 7,
            border: '1px solid var(--border-default)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Bot size={11} />
          Assistant
        </button>
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
