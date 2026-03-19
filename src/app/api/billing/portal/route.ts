import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { getStripe } from '@/lib/stripe/client'

// POST /api/billing/portal — creates a Stripe Customer Portal session
export async function POST() {
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

  const { workspace } = await getWorkspaceContext(userId)
  const stripe = getStripe()

  let stripeCustomerId = workspace.stripeCustomerId

  // If no customer ID stored, try to find or create one via Stripe
  if (!stripeCustomerId) {
    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress

    if (email) {
      // Look up existing Stripe customer by email
      const existing = await stripe.customers.list({ email, limit: 1 })
      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id
      } else {
        // Create a new Stripe customer
        const customer = await stripe.customers.create({
          email,
          metadata: { workspaceId: workspace.id, clerkUserId: userId },
        })
        stripeCustomerId = customer.id
      }

      // Persist to workspace so future requests are fast
      await db
        .update(workspaces)
        .set({ stripeCustomerId, updatedAt: new Date() })
        .where(eq(workspaces.id, workspace.id))
    }
  }

  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: 'Could not find or create a billing account. Please contact support.' },
      { status: 400 },
    )
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${appUrl}/settings`,
  })

  return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[POST /api/billing/portal]', err)
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined },
      { status: 500 }
    )
  }
}
