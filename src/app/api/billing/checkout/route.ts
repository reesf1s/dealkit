import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getStripe } from '@/lib/stripe/client'
import type { Plan } from '@/types'

// POST /api/billing/checkout — creates a Stripe Checkout session
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe not configured. Add STRIPE_SECRET_KEY to enable billing.' },
      { status: 501 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return NextResponse.json(
      { error: 'Missing NEXT_PUBLIC_APP_URL environment variable.' },
      { status: 501 },
    )
  }

  const body = await req.json() as { plan: Plan }
  const { plan } = body

  if (plan !== 'starter' && plan !== 'pro') {
    return NextResponse.json({ error: 'Invalid plan. Must be "starter" or "pro".' }, { status: 400 })
  }

  const priceIdMap: Record<'starter' | 'pro', string | undefined> = {
    starter: process.env.STARTER_PRICE_ID,
    pro: process.env.PRO_PRICE_ID,
  }

  const priceId = priceIdMap[plan]
  if (!priceId) {
    return NextResponse.json(
      { error: 'Stripe not configured. Add STRIPE_SECRET_KEY to enable billing.' },
      { status: 501 },
    )
  }

  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings?upgraded=1`,
    cancel_url: `${appUrl}/settings`,
    metadata: { clerkUserId: userId },
    ...(user.stripeCustomerId
      ? { customer: user.stripeCustomerId }
      : { customer_email: user.email ?? undefined }),
  })

  return NextResponse.json({ url: session.url })
}
