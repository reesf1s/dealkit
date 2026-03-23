import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/stripe',
  '/share(.*)',
])

// ── Clerk Production Keys ────────────────────────────────────────────
// TODO: Switch to Clerk production keys before going live:
//   1. Go to Vercel → Settings → Environment Variables
//   2. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to pk_live_... (from Clerk dashboard → Production)
//   3. Set CLERK_SECRET_KEY to sk_live_... (from Clerk dashboard → Production)
//   4. Redeploy the app
// Also update .env.local for local development if needed.
// ─────────────────────────────────────────────────────────────────────

// If Clerk keys are missing, skip auth middleware so the landing page works
const clerkConfigured =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY

export default clerkConfigured
  ? clerkMiddleware(async (auth, request) => {
      if (!isPublicRoute(request)) {
        await auth.protect()
      }
    })
  : () => NextResponse.next()

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
