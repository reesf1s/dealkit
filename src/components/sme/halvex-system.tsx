import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type BrandMarkProps = {
  href?: string
  label?: string
  className?: string
}

export const pillSurfaceClass = 'rounded-[28px] border border-white/10 bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
export const pillInsetClass = 'rounded-[22px] border border-white/10 bg-black/20'
export const pillButtonClass = 'rounded-full border-white/10 bg-white/[0.06] text-zinc-100 hover:bg-white/[0.1]'
export const tableRowClass = 'rounded-full border border-white/10 bg-white/[0.045] px-4 py-3 text-sm transition hover:bg-white/[0.075]'

export function BrandMark({ href = '/', label = 'Halvex', className }: BrandMarkProps) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-3', className)}>
      <span className="grid size-9 place-items-center rounded-full bg-white text-sm font-black text-black shadow-[0_10px_30px_rgba(255,255,255,0.08)]">
        H
      </span>
      <span className="font-title text-sm font-semibold text-white">{label}</span>
    </Link>
  )
}

export function SystemPill({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: 'neutral' | 'blue' | 'green' | 'yellow'
}) {
  return (
    <span
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium',
        tone === 'neutral' && 'border-white/10 bg-white/[0.055] text-zinc-200',
        tone === 'blue' && 'border-blue-400/25 bg-blue-400/10 text-blue-100',
        tone === 'green' && 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
        tone === 'yellow' && 'border-yellow-300/25 bg-yellow-300/10 text-yellow-100',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function PublicNav() {
  return (
    <nav className="fixed left-0 right-0 top-0 z-40 px-3 py-3 sm:px-6">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 rounded-full border border-white/10 bg-black/55 px-3 shadow-[0_18px_70px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <BrandMark />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="h-10 rounded-full px-4 text-sm text-zinc-200 hover:bg-white/[0.08] hover:text-white">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild className="h-10 rounded-full bg-white px-5 text-sm text-black hover:bg-zinc-200">
            <Link href="/sign-up">
              Start free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  )
}

export function PublicBackdrop({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn('relative min-h-screen overflow-hidden bg-[#050607] text-white', className)}>
      <div className="fixed inset-0 z-0 bg-[linear-gradient(90deg,rgba(3,7,12,0.78),rgba(3,7,12,0.5)_48%,rgba(3,7,12,0.2)),url('/images/halvex-mountain-bg.jpg')] bg-cover bg-center" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_18%_24%,rgba(64,160,255,0.16),transparent_28%),linear-gradient(180deg,rgba(5,6,7,0),rgba(5,6,7,0.78)_82%)]" />
      <div className="relative z-10">
        {children}
      </div>
    </main>
  )
}

export function MetricRail({ items }: { items: Array<{ label: string; value: string; detail: string }> }) {
  return (
    <div className="grid gap-2 rounded-[30px] border border-white/10 bg-black/42 p-2 backdrop-blur-xl md:grid-cols-3">
      {items.map(item => (
        <div key={item.label} className="rounded-full border border-white/10 bg-white/[0.045] px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-zinc-400">{item.label}</span>
            <strong className="font-title text-2xl font-semibold text-white">{item.value}</strong>
          </div>
          <p className="mt-1 truncate text-xs text-zinc-500">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}

export function TabularShowcase({
  rows,
}: {
  rows: Array<{ label: string; value: string; detail: string }>
}) {
  return (
    <div className={cn(pillSurfaceClass, 'p-3')}>
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 pb-2 text-[11px] uppercase text-zinc-500">
        <span>System</span>
        <span>Signal</span>
        <span>Status</span>
      </div>
      <div className="grid gap-2">
        {rows.map(row => (
          <div key={row.label} className={cn(tableRowClass, 'grid grid-cols-[1fr_auto_auto] items-center gap-3')}>
            <span className="min-w-0 truncate font-medium text-zinc-100">{row.label}</span>
            <span className="font-title text-sm text-white">{row.value}</span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] text-emerald-100">
              {row.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <PublicBackdrop>
      <div className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <section className="hidden lg:block">
            <BrandMark />
            <h1 className="mt-8 max-w-xl font-title text-5xl font-semibold leading-tight">
              Revenue work, rounded into one calm operating table.
            </h1>
            <div className="mt-8 grid max-w-xl gap-2">
              {['Unified conversations', 'Deal risk and next step rows', 'AI drafts grounded in CRM context'].map(item => (
                <div key={item} className={cn(tableRowClass, 'flex items-center gap-3')}>
                  <CheckCircle2 className="size-4 text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto grid w-full max-w-[520px] gap-5">
            <BrandMark className="mx-auto lg:hidden" />
            <div className={cn(pillSurfaceClass, 'p-3')}>
              <div className="px-4 py-5 text-center">
                <SystemPill tone="blue" className="mx-auto">
                  <Sparkles className="size-3.5" />
                  Halvex workspace
                </SystemPill>
                <h2 className="mt-5 font-title text-3xl font-semibold">{title}</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-400">{description}</p>
              </div>
              <div className="min-h-[430px] px-3 pb-3">
                {children}
              </div>
            </div>
            <div className="text-center text-sm text-zinc-400">{footer}</div>
          </section>
        </div>
      </div>
    </PublicBackdrop>
  )
}

export function AuthWidgetSkeleton() {
  return (
    <div className={cn(pillInsetClass, 'grid gap-4 p-5')}>
      <Skeleton className="mx-auto h-5 w-48 rounded-full bg-white/10" />
      <Skeleton className="mx-auto h-4 w-64 rounded-full bg-white/10" />
      <Skeleton className="h-11 rounded-full bg-white/10" />
      <Skeleton className="h-px rounded-full bg-white/10" />
      <Skeleton className="h-11 rounded-full bg-white/10" />
      <Skeleton className="h-11 rounded-full bg-white/10" />
      <Skeleton className="h-11 rounded-full bg-white/20" />
    </div>
  )
}

export const authAppearance = {
  variables: {
    colorPrimary: '#ffffff',
    colorBackground: '#121417',
    colorInputBackground: '#090b0d',
    colorInputText: '#f4f4f5',
    colorText: '#f4f4f5',
    colorTextSecondary: '#a1a1aa',
    colorNeutral: '#a1a1aa',
    borderRadius: '24px',
    fontFamily: 'var(--font-body), Inter, sans-serif',
  },
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full shadow-none rounded-[26px] overflow-hidden bg-transparent',
    card: 'w-full rounded-[26px] border border-white/10 bg-white/[0.045] shadow-none',
    headerTitle: 'font-title text-white',
    headerSubtitle: 'text-zinc-400',
    socialButtonsBlockButton: 'rounded-full border-white/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]',
    dividerLine: 'bg-white/10',
    dividerText: 'text-zinc-500',
    formFieldLabel: 'text-zinc-200',
    formFieldInput: 'rounded-full border-white/10 bg-black/25 text-zinc-100 placeholder:text-zinc-500',
    formButtonPrimary: 'rounded-full bg-white text-black hover:bg-zinc-200',
    footer: 'hidden',
    footerAction: 'hidden',
    footerActionLink: 'text-white',
  },
}
