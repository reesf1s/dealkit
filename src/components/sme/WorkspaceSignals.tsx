'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bell, CalendarDays, CheckSquare, MessageCircle, ShieldAlert, Sparkles } from 'lucide-react'

import type { CrmWorkspacePayload } from '@/lib/sme-crm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

async function fetchWorkspace() {
  const response = await fetch('/api/crm/workspace', { headers: { Accept: 'application/json' } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? `Workspace request failed: ${response.status}`)
  return payload as CrmWorkspacePayload
}

function todayLabel() {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())
}

function taskDue(value?: string | Date | null) {
  if (!value) return false
  const due = new Date(value)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return due.getTime() <= today.getTime()
}

export default function WorkspaceSignals() {
  const [workspace, setWorkspace] = useState<CrmWorkspacePayload | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    fetchWorkspace()
      .then(payload => {
        if (active) {
          setWorkspace(payload)
          setError(false)
        }
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [])

  const signals = useMemo(() => {
    const tasks = workspace?.tasks ?? []
    const leads = workspace?.leads ?? []
    const messages = workspace ? Object.values(workspace.messages).flat() : []
    const dueTasks = tasks.filter(task => taskDue(task.dueAt))
    const riskyDeals = leads.filter(lead => lead.risk === 'hot' || Number(lead.probability ?? 0) < 45)
    const buyerMessages = messages.filter(message => message.from === 'customer')
    const count = dueTasks.length + riskyDeals.length + Math.min(3, buyerMessages.length)
    return {
      count,
      dueTasks,
      riskyDeals,
      buyerMessages: buyerMessages.slice(-3).reverse(),
    }
  }, [workspace])

  return (
    <>
      <Badge asChild variant="secondary" className="hidden h-9 rounded-full border-white/8 bg-white/8 px-3 text-[11px] text-zinc-200 lg:inline-flex">
        <Link href={signals.count ? '/coach' : '/home'}>
          <Sparkles className="size-3" />
          {workspace ? `${signals.count} signal${signals.count === 1 ? '' : 's'}` : error ? 'Offline' : 'Checking'}
        </Link>
      </Badge>

      <Badge variant="outline" className="hidden h-9 gap-1 rounded-full border-white/8 bg-black/30 px-3 text-[11px] text-zinc-300 lg:inline-flex">
        <CalendarDays className="size-3" />
        {todayLabel()}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative size-9 rounded-full text-zinc-400 hover:bg-white/8 hover:text-white" aria-label="Workspace signals">
            <Bell className="size-4" />
            {signals.count ? <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-blue-300" /> : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 border-white/10 bg-[#090b0d] p-2 text-zinc-100">
          <DropdownMenuLabel className="px-3 py-2 text-xs text-zinc-500">Workspace signals</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          {signals.dueTasks.slice(0, 3).map(task => (
            <DropdownMenuItem key={`task-${task.id}`} asChild className="rounded-[16px] p-0 focus:bg-white/[0.06]">
              <Link href="/tasks" className="flex items-start gap-3 p-3">
                <CheckSquare className="mt-0.5 size-4 text-blue-200" />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-white">{task.title}</span>
                  <span className="mt-1 block truncate text-xs text-zinc-500">{task.companyName ?? 'No account'}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          ))}
          {signals.riskyDeals.slice(0, 3).map(lead => (
            <DropdownMenuItem key={`deal-${lead.id}`} asChild className="rounded-[16px] p-0 focus:bg-white/[0.06]">
              <Link href="/forecast" className="flex items-start gap-3 p-3">
                <ShieldAlert className={cn('mt-0.5 size-4', lead.risk === 'hot' ? 'text-red-200' : 'text-yellow-200')} />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-white">{lead.companyName}</span>
                  <span className="mt-1 block truncate text-xs text-zinc-500">{lead.probability}% · {lead.nextStep}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          ))}
          {signals.buyerMessages.map(message => {
            const lead = workspace?.leads.find(candidate => candidate.id === message.leadId)
            return (
              <DropdownMenuItem key={`message-${message.id}`} asChild className="rounded-[16px] p-0 focus:bg-white/[0.06]">
                <Link href="/inbox" className="flex items-start gap-3 p-3">
                  <MessageCircle className="mt-0.5 size-4 text-emerald-200" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white">{lead?.companyName ?? 'Buyer message'}</span>
                    <span className="mt-1 block truncate text-xs text-zinc-500">{message.text}</span>
                  </span>
                </Link>
              </DropdownMenuItem>
            )
          })}
          {!signals.count ? (
            <div className="px-3 py-8 text-center text-sm text-zinc-500">
              {workspace ? 'No urgent workspace signals.' : error ? 'Unable to load workspace signals.' : 'Loading workspace signals...'}
            </div>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
