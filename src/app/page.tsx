import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowRight, Bot, MessagesSquare, Sparkles, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  BrandMark,
  MetricRail,
  PublicBackdrop,
  PublicNav,
  SystemPill,
  TabularShowcase,
  pillInsetClass,
  tableRowClass,
} from '@/components/sme/halvex-system'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Halvex - LLM-first sales CRM for SME teams',
  description: 'Run one sales cockpit for email, LinkedIn, web leads, meetings, tasks, forecast, and AI-assisted deal execution.',
  openGraph: {
    title: 'Halvex',
    description: 'One lightweight platform for sales messaging, insights, and conversion.',
    type: 'website',
    url: 'https://www.halvex.ai',
    siteName: 'Halvex',
  },
}

const metrics = [
  { label: 'Unified inbox', value: '4', detail: 'email, LinkedIn, web chat, meetings' },
  { label: 'AI recommendations', value: '21', detail: 'high-signal actions today' },
  { label: 'Reply quality', value: '89%', detail: 'draft acceptance rate' },
]

const rows = [
  { label: 'Paramount renewal', value: 'GBP180k', detail: 'High intent' },
  { label: 'Solstice Dental', value: 'GBP36k', detail: 'Next step' },
  { label: 'Orbit Logistics', value: 'GBP41k', detail: 'Warm' },
]

const workflow = [
  ['Inbox', 'Every revenue channel lands in one row-ready operating table.', MessagesSquare],
  ['Deal read', 'Risk, probability, owner, and evidence stay visible.', TrendingUp],
  ['AI next step', 'Drafts and coaching are grounded in the selected deal.', Bot],
]

export default async function LandingPage() {
  try {
    const { userId } = await auth()
    if (userId) redirect('/home')
  } catch {
    // Clerk may be unset in local static previews.
  }

  return (
    <PublicBackdrop>
      <PublicNav />

      <section className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 pb-8 pt-28 sm:px-6 lg:pb-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.72fr)] lg:items-center">
          <div className="pb-4">
            <SystemPill tone="blue">
              <Sparkles className="size-3.5" />
              LLM-first CRM for revenue teams
            </SystemPill>
            <h1 className="mt-7 max-w-3xl font-title text-6xl font-semibold leading-[0.96] text-white sm:text-7xl lg:text-8xl">
              Halvex
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-200">
              A polished sales workspace for SMEs that turns every conversation, deal signal, and AI-assisted next step into one rounded operating table.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full bg-white px-6 text-black hover:bg-zinc-200">
                <Link href="/sign-up">
                  Build my workspace
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]">
                <Link href="/sign-in">Open workspace</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            <TabularShowcase rows={rows} />
            <MetricRail items={metrics} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-16 sm:px-6 lg:grid-cols-[0.78fr_1.22fr]">
        <div className={cn(pillInsetClass, 'p-5')}>
          <BrandMark href="/" />
          <h2 className="mt-8 max-w-sm font-title text-3xl font-semibold leading-tight text-white">
            Built as a system, not a pile of screens.
          </h2>
          <p className="mt-4 text-sm leading-7 text-zinc-400">
            The core workspace is organized around pills, segmented choices, and tabular deal rows so teams can scan, compare, and act without wandering through card stacks.
          </p>
        </div>

        <div className="grid gap-2">
          {workflow.map(([title, body, Icon]) => (
            <div key={title as string} className={cn(tableRowClass, 'grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-[24px] py-4')}>
              <span className="grid size-11 place-items-center rounded-full bg-white/[0.06] text-blue-200">
                <Icon className="size-5" />
              </span>
              <span>
                <strong className="block font-title text-sm font-semibold text-white">{title as string}</strong>
                <span className="mt-1 block text-sm text-zinc-400">{body as string}</span>
              </span>
              <ArrowRight className="size-4 text-zinc-500" />
            </div>
          ))}
        </div>
      </section>
    </PublicBackdrop>
  )
}
