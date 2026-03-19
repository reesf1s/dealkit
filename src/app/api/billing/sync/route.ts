export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { getStripe } from '@/lib/stripe/client'
import { planFromPriceId } from '@/lib/stripe/plans'
import type { Plan } from '@/types'

// POST /api/billing/sync — pull current subscription state from Stripe and update workspace plan
// Useful when webhooks may have been missed or delayed
export async function POST() {
  try {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 501 })
  }

  const { workspace } = await getWorkspaceContext(userId)
  const stripeCustomerId = workspace.stripeCustomerId
  const fromPlan = workspace.plan as Plan

  if (!stripeCustomerId) {
    // No Stripe account linked — ensure workspace plan is free (fixes stale pro state)
    if (fromPlan !== 'free') {
      await db.update(workspaces).set({ plan: 'free', updatedAt: new Date() }).where(eq(workspaces.id, workspace.id))
    }
    return NextResponse.json({ plan: 'free', fromPlan, synced: fromPlan !== 'free', reason: 'no_stripe_customer' })
  }

  const stripe = getStripe()

  // List active subscriptions for this customer
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'active',
    limit: 5,
  })

  let plan: Plan = 'free'

  if (subscriptions.data.length > 0) {
    // Use the most recent active subscription
    const sub = subscriptions.data[0]
    // cancel_at_period_end means the user downgraded — treat as free immediately
    // (Stripe keeps status 'active' until the period ends, but user intent is clear)
    if (!sub.cancel_at_period_end) {
      const priceId = sub.items.data[0]?.price.id
      if (priceId) {
        plan = planFromPriceId(priceId) ?? 'free'
      }
    }
  }
  // If no active subscription found, or subscription is set to cancel → plan stays 'free'

  if (fromPlan !== plan) {
    await db
      .update(workspaces)
      .set({ plan, updatedAt: new Date() })
      .where(eq(workspaces.id, workspace.id))
  }

  return NextResponse.json({ plan, fromPlan, synced: fromPlan !== plan })
  } catch (err) {
    console.error('[POST /api/billing/sync]', err)
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined },
      { status: 500 }
    )
  }
}
