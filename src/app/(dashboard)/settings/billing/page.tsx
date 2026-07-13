'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, CreditCard, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAllPlans } from '@/lib/stripe/plans'
import type { Plan } from '@/types'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

type BillingState = {
  plan: Plan
  syncing: boolean
  error: string | null
}

const plans = getAllPlans().filter(plan => plan.id !== 'free')

function callSync() {
  return fetch('/api/billing/sync', { method: 'POST' }).then(async response => {
    const payload = (await response.json().catch(() => ({}))) as { plan?: Plan; error?: string }
    if (!response.ok) throw new Error(payload.error ?? 'Failed to sync plan')
    return payload.plan ?? 'free'
  })
}

export default function BillingPage() {
  const [state, setState] = useState<BillingState>({ plan: 'free', syncing: true, error: null })

  useEffect(() => {
    void (async () => {
      try {
        const plan = await callSync()
        setState({ plan, syncing: false, error: null })
      } catch (error) {
        setState(prev => ({ ...prev, syncing: false, error: error instanceof Error ? error.message : 'Unable to check subscription' }))
      }
    })()
  }, [])

  async function openCheckout(plan: Plan) {
    setState(prev => ({ ...prev, syncing: true, error: null }))
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Unable to start checkout')
      if (!payload.url) throw new Error('Checkout did not return a session URL')
      window.location.href = payload.url
    } catch (error) {
      setState(prev => ({ ...prev, syncing: false, error: error instanceof Error ? error.message : 'Checkout failed' }))
    }
  }

  async function openPortal() {
    setState(prev => ({ ...prev, syncing: true, error: null }))
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' })
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Unable to open billing portal')
      if (!payload.url) throw new Error('Billing portal did not return a URL')
      window.location.href = payload.url
    } catch (error) {
      setState(prev => ({ ...prev, syncing: false, error: error instanceof Error ? error.message : 'Portal failed' }))
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <Card>
        <CardHeader className="px-5 pt-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Badge variant="secondary" className="mb-4 gap-1">
                <CreditCard className="size-3" />
                Billing
              </Badge>
              <CardTitle className="text-3xl tracking-normal">Plan and subscription</CardTitle>
              <CardDescription className="mt-3 max-w-2xl text-sm leading-6">
                Pick the plan that matches your pipeline volume. Billing is managed securely through Stripe.
              </CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href="/settings">
                <ArrowLeft className="size-4" />
                Back to settings
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-4">
            <span className="text-sm text-muted-foreground">Current plan</span>
            <Badge>{state.plan}</Badge>
            {state.syncing ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" strokeWidth={2.4} /> : null}
          </div>
        </CardContent>
      </Card>

      {state.error ? (
        <Alert variant="destructive">
          <ShieldCheck className="size-4" />
          <AlertTitle>Billing update failed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {plans.map(plan => {
          const active = plan.id === state.plan
          return (
            <Card key={plan.id} className={active ? 'border-primary/30 shadow-sm' : undefined}>
              <CardHeader className="px-5 pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription className="mt-2 text-sm leading-6">{plan.description}</CardDescription>
                  </div>
                  {active ? <Badge>Active</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 p-5">
                <div>
                  <span className="text-4xl font-semibold tracking-normal">£{plan.priceMonthly}</span>
                  <span className="text-sm text-muted-foreground"> / month</span>
                </div>
                <Separator />
                <ul className="grid gap-3">
                  {plan.features.slice(0, 5).map(feature => (
                    <li key={feature} className="flex gap-3 text-sm leading-6">
                      <Check className="mt-1 size-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  onClick={() => openCheckout(plan.id as Plan)}
                  disabled={state.syncing || active}
                >
                  {active ? 'Active plan' : 'Upgrade'}
                  <ArrowRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Stripe customer portal</h2>
            <p className="mt-1 text-sm text-muted-foreground">Update payment methods, invoices, and subscription details.</p>
          </div>
          <Button type="button" variant="outline" onClick={openPortal} disabled={state.syncing}>
            Manage subscription
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
