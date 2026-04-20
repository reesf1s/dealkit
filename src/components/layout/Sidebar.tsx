'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import {
  Bot,
  BriefcaseBusiness,
  Calendar,
  CircleDashed,
  Gauge,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { avatarGradientFromName, initialsFromName } from '@/lib/presentation'
import { useSidebar } from './SidebarContext'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  matchPaths?: string[]
  count?: number
  signal?: boolean
}

function SidebarNavItem({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onClick?: () => void
}) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`nav-item${active ? ' active' : ''}${collapsed ? ' collapsed' : ''}`}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
    >
      <Icon className="nav-icon" size={15} strokeWidth={1.8} />
      {!collapsed ? <span>{item.label}</span> : null}
      {item.count != null ? <span className={`nav-count${collapsed ? ' nav-count-collapsed' : ''}`}>{item.count}</span> : null}
      {item.signal ? <span className={`signal-dot${collapsed ? ' signal-dot-collapsed' : ''}`} /> : null}
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { signOut } = useClerk()
  const { user } = useUser()
  const { collapsed, isMobile, mobileOpen, closeMobile } = useSidebar()
  const compact = collapsed && !isMobile

  const { data: dealsRes } = useSWR('/api/deals', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45_000,
  })

  const { data: automationsRes } = useSWR('/api/automations', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45_000,
  })

  const deals = Array.isArray(dealsRes?.data) ? dealsRes.data : []
  const openDeals = deals.filter((deal: { stage?: string }) => !['closed_won', 'closed_lost'].includes(deal.stage ?? ''))
  const accountCount = new Set(
    deals.map((deal: { prospectCompany?: string | null }) => deal.prospectCompany).filter(Boolean)
  ).size
  const enabledAutomations = Array.isArray(automationsRes?.data)
    ? automationsRes.data.filter((item: { enabled?: boolean }) => item.enabled).length
    : 0
  const openTaskCount = deals.reduce((count: number, deal: { todos?: Array<{ done?: boolean }>; projectPlan?: { phases?: Array<{ tasks?: Array<{ status?: string }> }> }; successCriteriaTodos?: Array<{ achieved?: boolean }> }) => {
    const openTodos = deal.todos?.filter(todo => !todo.done).length ?? 0
    const openPlanTasks = deal.projectPlan?.phases?.flatMap(phase => phase.tasks ?? []).filter(task => task.status !== 'complete').length ?? 0
    const openCriteria = deal.successCriteriaTodos?.filter(item => !item.achieved).length ?? 0
    return count + openTodos + openPlanTasks + openCriteria
  }, 0)

  const pipelineItems: NavItem[] = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/deals', label: 'Deals', icon: BriefcaseBusiness, count: openDeals.length, matchPaths: ['/deals'] },
    { href: '/company', label: 'Accounts', icon: Target, count: accountCount, matchPaths: ['/company'] },
    { href: '/contacts', label: 'Contacts', icon: Users },
  ]

  const intelligenceItems: NavItem[] = [
    { href: '/analytics', label: 'Signals', icon: Sparkles, signal: enabledAutomations > 0, matchPaths: ['/analytics'] },
    { href: '/pipeline', label: 'Forecast', icon: Gauge, matchPaths: ['/pipeline'] },
    { href: '/connections', label: 'Conversations', icon: MessageSquare, count: 7, matchPaths: ['/connections', '/chat'] },
    { href: '/automations', label: 'Automations', icon: Bot, count: enabledAutomations, matchPaths: ['/automations'] },
  ]

  const workspaceItems: NavItem[] = [
    { href: '/tasks', label: 'Tasks', icon: CircleDashed, count: openTaskCount || undefined, matchPaths: ['/tasks'] },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]

  const isActive = (item: NavItem) => {
    const paths = item.matchPaths ? [item.href, ...item.matchPaths] : [item.href]
    return paths.some(path => pathname === path || pathname.startsWith(`${path}/`))
  }

  const fullName = user?.fullName ?? 'Halvex user'
  const orgLabel = user?.primaryEmailAddress?.emailAddress ?? 'Workspace'

  return (
    <>
      {isMobile && mobileOpen ? <button className="sidebar-overlay" onClick={closeMobile} aria-label="Close sidebar overlay" /> : null}
      <aside className={`sidebar${isMobile ? ' sidebar-mobile' : ''}${mobileOpen ? ' mobile-open' : ''}${compact ? ' collapsed' : ''}`}>
        <div className="brand">
          <Link href="/dashboard" onClick={closeMobile} style={{ display: 'contents' }}>
            <div className="brand-mark">H</div>
            {!compact ? (
              <>
                <div className="brand-name">Halvex</div>
                <span className="brand-badge">Beta</span>
              </>
            ) : null}
          </Link>
          {isMobile ? (
            <button className="icon-btn sidebar-close" onClick={closeMobile} aria-label="Close sidebar">
              <X size={14} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>

        <button
          className="ask-bar"
          aria-label="Ask Halvex"
          title={compact ? 'Ask Halvex' : undefined}
          onClick={() => {
            window.dispatchEvent(new CustomEvent('openCommandPalette'))
            closeMobile()
          }}
        >
          <Sparkles className="ask-spark" size={14} strokeWidth={2} />
          {!compact ? (
            <>
              <span className="ask-text">Ask Halvex anything…</span>
              <span className="ask-kbd">⌘K</span>
            </>
          ) : null}
        </button>

        {!compact ? <div className="nav-section">Pipeline</div> : null}
        {pipelineItems.map(item => (
          <SidebarNavItem key={item.label} item={item} active={isActive(item)} collapsed={compact} onClick={closeMobile} />
        ))}

        {!compact ? <div className="nav-section">Intelligence</div> : null}
        {intelligenceItems.map(item => (
          <SidebarNavItem key={item.label} item={item} active={isActive(item)} collapsed={compact} onClick={closeMobile} />
        ))}

        {!compact ? <div className="nav-section">Workspace</div> : null}
        {workspaceItems.map(item => (
          <SidebarNavItem key={item.label} item={item} active={isActive(item)} collapsed={compact} onClick={closeMobile} />
        ))}

        <button
          onClick={() => signOut({ redirectUrl: '/' })}
          className={`user-card${compact ? ' compact' : ''}`}
          title={compact ? fullName : undefined}
          aria-label={compact ? fullName : undefined}
        >
          <div className="user-avatar" style={{ background: avatarGradientFromName(fullName) }}>
            {initialsFromName(fullName)}
          </div>
          {!compact ? (
            <div style={{ minWidth: 0, textAlign: 'left' }}>
              <div className="user-name">{fullName}</div>
              <div className="user-org">{orgLabel}</div>
            </div>
          ) : null}
        </button>
      </aside>
    </>
  )
}
