import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces, events } from '@/lib/db/schema'
import { planFromPriceId } from '@/lib/stripe/plans'
import type { Plan } from '@/types'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2026-02-25.clover' })
}

async function logEvent(workspaceId: string, userId: string | null, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ workspaceId, userId, type, metadata, createdAt: new Date() })
}

export async function POST(req: NextRequest) {
  const stripe = getStripe()

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[stripe-webhook] Signature verification failed:', message)
    return NextResponse.json({ error: `Webhook signature invalid: ${message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const workspaceId = session.metadata?.workspaceId
        const stripeCustomerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null

        if (!workspaceId) {
          console.warn('[stripe-webhook] checkout.session.completed missing workspaceId in metadata')
          break
        }

        let plan: Plan = 'free'
        if (session.subscription) {
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const priceId = subscription.items.data[0]?.price.id
          if (priceId) {
            plan = planFromPriceId(priceId) ?? 'free'
          }
        }

        const [existing] = await db
          .select({ plan: workspaces.plan })
          .from(workspaces)
          .where(eq(workspaces.id, workspaceId))
          .limit(1)

        const fromPlan = existing?.plan ?? 'free'

        await db
          .update(workspaces)
          .set({ plan, stripeCustomerId: stripeCustomerId ?? undefined, updatedAt: new Date() })
          .where(eq(workspaces.id, workspaceId))

        await logEvent(workspaceId, null, 'plan.upgraded', { fromPlan, toPlan: plan, stripeCustomerId })
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const stripeCustomerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id

        const priceId = subscription.items.data[0]?.price.id

        // If subscription is canceled or pending cancellation at period end, immediately downgrade to free
        let plan: Plan
        if (subscription.status === 'canceled' || subscription.cancel_at_period_end) {
          plan = 'free'
        } else {
          plan = priceId ? (planFromPriceId(priceId) ?? 'free') : 'free'
        }

        const [workspace] = await db
          .select({ id: workspaces.id, plan: workspaces.plan })
          .from(workspaces)
          .where(eq(workspaces.stripeCustomerId, stripeCustomerId))
          .limit(1)

        if (!workspace) {
          console.warn(`[stripe-webhook] customer.subscription.updated: no workspace found for customer ${stripeCustomerId}`)
          break
        }

        const fromPlan = workspace.plan

        await db
          .update(workspaces)
          .set({ plan, updatedAt: new Date() })
          .where(eq(workspaces.id, workspace.id))

        const eventType =
          ['free', 'starter', 'pro'].indexOf(plan) > ['free', 'starter', 'pro'].indexOf(fromPlan)
            ? 'plan.upgraded'
            : 'plan.downgraded'

        await logEvent(workspace.id, null, eventType, { fromPlan, toPlan: plan, cancelAtPeriodEnd: subscription.cancel_at_period_end })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const stripeCustomerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id

        const [workspace] = await db
          .select({ id: workspaces.id, plan: workspaces.plan })
          .from(workspaces)
          .where(eq(workspaces.stripeCustomerId, stripeCustomerId))
          .limit(1)

        if (!workspace) {
          console.warn(`[stripe-webhook] customer.subscription.deleted: no workspace found for customer ${stripeCustomerId}`)
          break
        }

        const fromPlan = workspace.plan

        await db
          .update(workspaces)
          .set({ plan: 'free', updatedAt: new Date() })
          .where(eq(workspaces.id, workspace.id))

        await logEvent(workspace.id, null, 'plan.downgraded', { fromPlan, toPlan: 'free' })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const stripeCustomerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null

        if (!stripeCustomerId) break

        const [workspace] = await db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.stripeCustomerId, stripeCustomerId))
          .limit(1)

        if (!workspace) {
          console.warn(`[stripe-webhook] invoice.payment_failed: no workspace found for customer ${stripeCustomerId}`)
          break
        }

        await logEvent(workspace.id, null, 'plan.downgraded', {
          reason: 'payment_failed',
          invoiceId: invoice.id,
          amountDue: invoice.amount_due,
          currency: invoice.currency,
        })
        break
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error handling event ${event.type}:`, err)
    return NextResponse.json({ error: 'Internal error handling webhook' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
