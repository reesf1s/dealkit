import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, events } from '@/lib/db/schema'
import { planFromPriceId } from '@/lib/stripe/plans'
import type { Plan } from '@/types'

// Initialise Stripe lazily so the route doesn't crash if the env var is missing at build time
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2026-02-25.clover' })
}

async function logEvent(userId: string, type: string, metadata: Record<string, unknown>) {
  await db.insert(events).values({ userId, type, metadata, createdAt: new Date() })
}

// POST /api/webhooks/stripe
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
      // ── checkout.session.completed ────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const clerkUserId = session.metadata?.clerkUserId
        const stripeCustomerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null

        if (!clerkUserId) {
          console.warn('[stripe-webhook] checkout.session.completed missing clerkUserId in metadata')
          break
        }

        // Resolve the plan from the line items' price ID
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
          .select({ plan: users.plan })
          .from(users)
          .where(eq(users.id, clerkUserId))
          .limit(1)

        const fromPlan = existing?.plan ?? 'free'

        await db
          .update(users)
          .set({
            plan,
            stripeCustomerId: stripeCustomerId ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(users.id, clerkUserId))

        await logEvent(clerkUserId, 'plan.upgraded', { fromPlan, toPlan: plan, stripeCustomerId })
        break
      }

      // ── customer.subscription.updated ─────────────────────────────────────
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const stripeCustomerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id

        const priceId = subscription.items.data[0]?.price.id
        const plan: Plan = priceId ? (planFromPriceId(priceId) ?? 'free') : 'free'

        const [user] = await db
          .select({ id: users.id, plan: users.plan })
          .from(users)
          .where(eq(users.stripeCustomerId, stripeCustomerId))
          .limit(1)

        if (!user) {
          console.warn(
            `[stripe-webhook] customer.subscription.updated: no user found for customer ${stripeCustomerId}`,
          )
          break
        }

        const fromPlan = user.plan

        await db
          .update(users)
          .set({ plan, updatedAt: new Date() })
          .where(eq(users.id, user.id))

        const eventType =
          ['free', 'starter', 'pro'].indexOf(plan) >
          ['free', 'starter', 'pro'].indexOf(fromPlan)
            ? 'plan.upgraded'
            : 'plan.downgraded'

        await logEvent(user.id, eventType, { fromPlan, toPlan: plan })
        break
      }

      // ── customer.subscription.deleted ─────────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const stripeCustomerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id

        const [user] = await db
          .select({ id: users.id, plan: users.plan })
          .from(users)
          .where(eq(users.stripeCustomerId, stripeCustomerId))
          .limit(1)

        if (!user) {
          console.warn(
            `[stripe-webhook] customer.subscription.deleted: no user found for customer ${stripeCustomerId}`,
          )
          break
        }

        const fromPlan = user.plan

        await db
          .update(users)
          .set({ plan: 'free', updatedAt: new Date() })
          .where(eq(users.id, user.id))

        await logEvent(user.id, 'plan.downgraded', { fromPlan, toPlan: 'free' })
        break
      }

      // ── invoice.payment_failed ─────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const stripeCustomerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null

        if (!stripeCustomerId) break

        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.stripeCustomerId, stripeCustomerId))
          .limit(1)

        if (!user) {
          console.warn(
            `[stripe-webhook] invoice.payment_failed: no user found for customer ${stripeCustomerId}`,
          )
          break
        }

        await logEvent(user.id, 'plan.downgraded', {
          reason: 'payment_failed',
          invoiceId: invoice.id,
          amountDue: invoice.amount_due,
          currency: invoice.currency,
        })
        break
      }

      default:
        // Unhandled event type — acknowledge receipt without error
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error handling event ${event.type}:`, err)
    return NextResponse.json({ error: 'Internal error handling webhook' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
