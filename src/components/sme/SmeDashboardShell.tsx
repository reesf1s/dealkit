'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CheckSquare,
  CreditCard,
  Building2,
  FileSpreadsheet,
  Home,
  MessagesSquare,
  PlugZap,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
} from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { pillButtonClass } from '@/components/sme/halvex-system'
import WorkspaceCommandBar from '@/components/sme/WorkspaceCommandBar'
import { cn } from '@/lib/utils'

type NavLink = {
  href: string
  label: string
  icon: 'home' | 'conversations' | 'pipeline' | 'accounts' | 'tasks' | 'meetings' | 'team' | 'forecast' | 'reports' | 'import' | 'automation' | 'coaching' | 'integrations' | 'settings' | 'billing'
}

const navigation: NavLink[] = [
  { href: '/home', label: 'Dashboard', icon: 'home' },
  { href: '/inbox', label: 'Inbox', icon: 'conversations' },
  { href: '/deals', label: 'Deals', icon: 'pipeline' },
  { href: '/accounts', label: 'Accounts', icon: 'accounts' },
  { href: '/tasks', label: 'Tasks', icon: 'tasks' },
  { href: '/meetings', label: 'Meetings', icon: 'meetings' },
  { href: '/team', label: 'Team', icon: 'team' },
  { href: '/forecast', label: 'Forecast', icon: 'forecast' },
  { href: '/reports', label: 'Reports', icon: 'reports' },
  { href: '/import', label: 'Import', icon: 'import' },
  { href: '/automations', label: 'Automations', icon: 'automation' },
  { href: '/coach', label: 'AI coach', icon: 'coaching' },
  { href: '/channels', label: 'Channels', icon: 'integrations' },
]

const secondaryNavigation: NavLink[] = [
  { href: '/settings', label: 'Settings', icon: 'settings' },
  { href: '/settings/billing', label: 'Billing', icon: 'billing' },
]

function NavIcon({ icon }: { icon: NavLink['icon'] }) {
  const props = { className: 'size-4', strokeWidth: 2 }
  switch (icon) {
    case 'home':
      return <Home {...props} />
    case 'conversations':
      return <MessagesSquare {...props} />
    case 'pipeline':
      return <Users {...props} />
    case 'accounts':
      return <Building2 {...props} />
    case 'tasks':
      return <CheckSquare {...props} />
    case 'meetings':
      return <CalendarDays {...props} />
    case 'team':
      return <Users {...props} />
    case 'forecast':
      return <BarChart3 {...props} />
    case 'reports':
      return <TrendingUp {...props} />
    case 'import':
      return <FileSpreadsheet {...props} />
    case 'automation':
      return <Workflow {...props} />
    case 'coaching':
      return <Bot {...props} />
    case 'integrations':
      return <PlugZap {...props} />
    case 'settings':
      return <Settings {...props} />
    case 'billing':
      return <CreditCard {...props} />
  }
}

function RailNavItem({ item }: { item: NavLink }) {
  const pathname = usePathname()
  const active = pathname === item.href || (item.href !== '/home' && pathname?.startsWith(item.href))

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          size="icon"
          className={cn(
            'size-9 rounded-full border border-transparent text-zinc-500 hover:border-white/10 hover:bg-white/8 hover:text-zinc-100',
            active && 'border-white/10 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
          )}
        >
          <Link href={item.href} aria-label={item.label} aria-current={active ? 'page' : undefined}>
            <NavIcon icon={item.icon} />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

export default function SmeDashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const currentLabel = navigation.find(item => item.href === pathname)?.label ?? secondaryNavigation.find(item => item.href === pathname)?.label ?? 'Workspace'

  return (
    <div className="min-h-screen overflow-hidden bg-[#080a0d] text-zinc-100">
      <div className="flex h-screen min-h-screen w-full overflow-hidden bg-[#050607]">
        <aside className="hidden w-16 shrink-0 flex-col items-center border-r border-white/8 bg-black py-4 md:flex">
          <Link
            href="/home"
            className="grid size-9 place-items-center rounded-full border border-white/10 bg-white text-sm font-black text-black shadow-[0_8px_28px_rgba(255,255,255,0.08)]"
            aria-label="Halvex home"
          >
            H
          </Link>

          <nav className="mt-8 flex flex-1 flex-col items-center gap-2" aria-label="Main navigation">
            {navigation.map(item => (
              <RailNavItem key={item.label} item={item} />
            ))}
          </nav>

          <nav className="flex flex-col items-center gap-2" aria-label="Workspace navigation">
            {secondaryNavigation.map(item => (
              <RailNavItem key={item.label} item={item} />
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-[#090b0d]">
          <header className="sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b border-white/8 bg-[#050607]/96 px-3 backdrop-blur-xl sm:gap-3 sm:px-4">
            <Link href="/home" className="flex items-center gap-2 md:hidden">
              <span className="grid size-9 place-items-center rounded-full bg-white text-sm font-black text-black">H</span>
            </Link>

            <Button
              variant="ghost"
              className={cn('hidden h-10 px-4 text-xs font-medium md:inline-flex', pillButtonClass)}
              asChild
            >
              <Link href={pathname || '/home'}>
                {currentLabel}
                <TrendingUp className="size-3.5" />
              </Link>
            </Button>

            <WorkspaceCommandBar />

            <Badge variant="secondary" className="hidden h-9 rounded-full border-white/8 bg-white/8 px-3 text-[11px] text-zinc-200 lg:inline-flex">
              <Sparkles className="size-3" />
              2 new
            </Badge>

            <Badge variant="outline" className="hidden h-9 gap-1 rounded-full border-white/8 bg-black/30 px-3 text-[11px] text-zinc-300 lg:inline-flex">
              <CalendarDays className="size-3" />
              Today, Jun 20
            </Badge>

            <Button variant="ghost" size="icon" className="size-9 rounded-full text-zinc-400 hover:bg-white/8 hover:text-white" aria-label="Notifications">
              <Bell className="size-4" />
            </Button>

            <div className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/8">
              <UserButton />
            </div>
          </header>

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#0b0d0f] p-3 sm:p-4 lg:p-5">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
