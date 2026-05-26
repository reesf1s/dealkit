import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/stripe',
  '/api/webhooks/slack(.*)',
  '/share(.*)',
])

const legacyDashboardRedirects: Array<[RegExp, string]> = [
  [/^\/analytics(?:\/.*)?$/, '/today'],
  [/^\/automations(?:\/.*)?$/, '/settings'],
  [/^\/calendar(?:\/.*)?$/, '/today'],
  [/^\/case-studies(?:\/.*)?$/, '/companies'],
  [/^\/chat(?:\/.*)?$/, '/assistant'],
  [/^\/collateral(?:\/.*)?$/, '/deals'],
  [/^\/company(?:\/.*)?$/, '/companies'],
  [/^\/competitors(?:\/.*)?$/, '/assistant'],
  [/^\/connections(?:\/.*)?$/, '/settings'],
  [/^\/dashboard(?:\/.*)?$/, '/today'],
  [/^\/intelligence(?:\/.*)?$/, '/assistant'],
  [/^\/models(?:\/.*)?$/, '/assistant'],
  [/^\/onboarding(?:\/.*)?$/, '/today'],
  [/^\/playbook(?:\/.*)?$/, '/assistant'],
  [/^\/product-gaps(?:\/.*)?$/, '/assistant'],
  [/^\/settings\/unmatched-emails(?:\/.*)?$/, '/settings'],
  [/^\/workflows(?:\/.*)?$/, '/settings'],
]

function redirectedLegacyUrl(request: Request) {
  const url = new URL(request.url)
  const match = legacyDashboardRedirects.find(([pattern]) => pattern.test(url.pathname))
  if (!match) return null
  url.pathname = match[1]
  url.search = ''
  return url
}

// If Clerk keys are missing, skip auth middleware so the landing page works
const clerkConfigured =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY

export default clerkConfigured
  ? clerkMiddleware(async (auth, request) => {
      const redirectUrl = redirectedLegacyUrl(request)
      if (redirectUrl) return NextResponse.redirect(redirectUrl)
      if (!isPublicRoute(request)) {
        if (request.nextUrl.pathname.startsWith('/api')) {
          await auth.protect()
          return
        }
        await auth.protect({
          unauthenticatedUrl: new URL('/sign-in', request.url).toString(),
        })
      }
    })
  : (request: NextRequest) => {
      const redirectUrl = redirectedLegacyUrl(request)
      if (redirectUrl) return NextResponse.redirect(redirectUrl)
      return NextResponse.next()
    }

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
