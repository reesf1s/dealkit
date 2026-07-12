'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  CreditCard,
  FileSpreadsheet,
  Home,
  MessagesSquare,
  PhoneCall,
  PlugZap,
  Settings,
  TrendingUp,
  Users,
  Workflow,
} from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import WorkspaceCommandBar from '@/components/sme/WorkspaceCommandBar'
import { cn } from '@/lib/utils'

type NavLink = {
  href: string
  label: string
  icon: typeof Home
}

const navigation: NavLink[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/deals', label: 'Deals', icon: TrendingUp },
  { href: '/inbox', label: 'Inbox', icon: MessagesSquare },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
]

const workspaceNavigation: NavLink[] = [
  { href: '/forecast', label: 'Forecast', icon: BarChart3 },
  { href: '/coach', label: 'Intelligence', icon: Bot },
  { href: '/accounts', label: 'Accounts', icon: Building2 },
  { href: '/meetings', label: 'Meetings', icon: CalendarDays },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/reports', label: 'Reports', icon: TrendingUp },
  { href: '/automations', label: 'Automations', icon: Workflow },
  { href: '/call-review', label: 'Call intelligence', icon: PhoneCall },
  { href: '/import', label: 'Import data', icon: FileSpreadsheet },
  { href: '/channels', label: 'Integrations', icon: PlugZap },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/settings/billing', label: 'Billing', icon: CreditCard },
]

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/home' && pathname.startsWith(href))
}

function PrimaryNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname()
  return (
    <nav className={cn('flex items-center', mobile ? 'gap-1' : 'gap-0.5')} aria-label="Primary navigation">
      {navigation.map(item => {
        const active = isActive(pathname, item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70',
              active && 'bg-white/[0.08] text-white',
            )}
          >
            <Icon className="size-3.5" />
            {item.label}
            {active ? <span className="absolute inset-x-3 -bottom-[15px] h-0.5 rounded-full bg-violet-400" /> : null}
          </Link>
        )
      })}
    </nav>
  )
}

function WorkspaceMenu() {
  const pathname = usePathname()
  const menuActive = workspaceNavigation.some(item => isActive(pathname, item.href))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'h-9 rounded-lg px-3 text-xs font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-white',
            menuActive && 'bg-white/[0.08] text-white',
          )}
        >
          Workspace
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[72vh] w-64 overflow-y-auto rounded-xl border-white/10 bg-[#11101a]/98 p-2 text-zinc-100 shadow-2xl backdrop-blur-xl">
        <DropdownMenuLabel className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">All areas</DropdownMenuLabel>
        <div className="grid gap-0.5">
          {workspaceNavigation.slice(0, 9).map(item => {
            const Icon = item.icon
            return (
              <DropdownMenuItem key={item.href} asChild className="rounded-lg p-0 focus:bg-white/[0.07] focus:text-white">
                <Link href={item.href} className="flex items-center gap-3 px-3 py-2.5">
                  <Icon className="size-4 text-zinc-500" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              </DropdownMenuItem>
            )
          })}
        </div>
        <DropdownMenuSeparator className="my-2 bg-white/8" />
        {workspaceNavigation.slice(9).map(item => {
          const Icon = item.icon
          return (
            <DropdownMenuItem key={item.href} asChild className="rounded-xl focus:bg-white/[0.07] focus:text-white">
              <Link href={item.href} className="gap-3 px-3 py-2.5 text-sm"><Icon className="size-4 text-zinc-500" />{item.label}</Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function SmeDashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#090811] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#090811]/90 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-3 sm:px-5 lg:gap-6">
          <Link href="/home" className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70" aria-label="Halvex overview">
            <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 via-violet-600 to-fuchsia-700 text-sm font-black text-white shadow-[0_10px_35px_rgba(139,92,246,0.3)]">
              H
              <span className="absolute inset-x-1 top-0 h-px bg-white/60" />
            </span>
            <span className="hidden xl:block">
              <span className="block font-title text-sm font-semibold leading-none text-white">Halvex</span>
              <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.18em] text-violet-300">Revenue OS</span>
            </span>
          </Link>

          <div className="hidden items-center lg:flex">
            <PrimaryNav />
            <WorkspaceMenu />
          </div>

          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 lg:max-w-[430px]">
            <WorkspaceCommandBar />
            <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] shadow-inner">
              <UserButton />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border-t border-white/[0.05] px-3 py-2 lg:hidden">
          <div className="flex min-w-max items-center gap-1">
            <PrimaryNav mobile />
            <WorkspaceMenu />
          </div>
        </div>
      </header>

      <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[radial-gradient(circle_at_10%_0%,rgba(124,58,237,0.11),transparent_30%),radial-gradient(circle_at_90%_20%,rgba(192,38,211,0.06),transparent_24%)]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative mx-auto w-full max-w-[1440px] p-3 sm:p-5 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
