import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getStripe } from '@/lib/stripe/client'
import type { Plan } from '@/types'

// POST /api/billing/checkout — creates a Stripe Checkout session
export async function POST(req: NextRequest) {
  try {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe not configured. Add STRIPE_SECRET_KEY to enable billing.' },
      { status: 501 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
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
    starter: process.env.STRIPE_STARTER_PRICE_ID ?? process.env.STARTER_PRICE_ID,
    pro: process.env.STRIPE_PRO_PRICE_ID ?? process.env.PRO_PRICE_ID,
  }

  const priceId = priceIdMap[plan]
  if (!priceId) {
    return NextResponse.json(
      { error: 'Stripe not configured. Add STRIPE_SECRET_KEY to enable billing.' },
      { status: 501 },
    )
  }

  const { workspaceId, workspace } = await getWorkspaceContext(userId)

  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings?upgraded=1`,
    cancel_url: `${appUrl}/settings`,
    metadata: { workspaceId },
    allow_promotion_codes: true,
    ...(workspace.stripeCustomerId
      ? { customer: workspace.stripeCustomerId }
      : { customer_email: undefined }),
  })

  return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[POST /api/billing/checkout]', err)
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined },
      { status: 500 }
    )
  }
}
