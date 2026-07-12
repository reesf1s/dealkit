import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/privacy',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/terms',
  '/api/webhooks/stripe',
])

// If Clerk keys are missing, skip auth middleware so the landing page works
const clerkConfigured =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY

export default clerkConfigured
  ? clerkMiddleware(async (auth, request) => {
      if (request.nextUrl.pathname.startsWith('/api')) {
        return NextResponse.next()
      }

      if (!isPublicRoute(request)) {
        await auth.protect({
          unauthenticatedUrl: new URL('/sign-in', request.url).toString(),
        })
      }
    })
  : () => {
      return NextResponse.next()
    }

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
