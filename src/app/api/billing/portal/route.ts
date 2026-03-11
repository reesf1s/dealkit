import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getStripe } from '@/lib/stripe/client'

// POST /api/billing/portal — creates a Stripe Customer Portal session
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!appUrl) {
    return NextResponse.json(
      { error: 'Missing NEXT_PUBLIC_APP_URL environment variable.' },
      { status: 501 },
    )
  }

  const { workspace } = await getWorkspaceContext(userId)

  if (!workspace.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 400 })
  }

  const stripe = getStripe()

  const session = await stripe.billingPortal.sessions.create({
    customer: workspace.stripeCustomerId,
    return_url: `${appUrl}/settings`,
  })

  return NextResponse.json({ url: session.url })
}
