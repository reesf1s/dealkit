import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs'

// Derive Supabase hostname from env so connect-src covers the project URL.
// Falls back to a wildcard supabase.co pattern when the var is absent (e.g. CI).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
let supabaseHosts = '*.supabase.co'
try {
  if (supabaseUrl) {
    const { hostname } = new URL(supabaseUrl)
    supabaseHosts = `${hostname} wss://${hostname}`
  }
} catch { /* ignore malformed URL */ }

const csp = [
  "default-src 'self'",
  // Scripts: self + Clerk (uses eval for its own UI) + Mixpanel analytics + Stripe + Vercel insights
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.halvex.ai https://clerk.accounts.dev https://*.clerk.accounts.dev https://cdn.mxpnl.com https://js.stripe.com https://*.vercel-insights.com",
  // Styles: self + inline (needed for CSS-in-JS / Tailwind) + Google Fonts
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Images: self + data URIs + any HTTPS (avatars, logos)
  "img-src 'self' data: blob: https:",
  // Fonts: self + data URIs + Google Fonts CDN
  "font-src 'self' data: https://fonts.gstatic.com",
  // Connections: self + Supabase + Clerk (custom domain + accounts) + Stripe + Vercel analytics
  `connect-src 'self' ${supabaseHosts} https://*.supabase.co wss://*.supabase.co https://clerk.halvex.ai https://clerk.accounts.dev https://*.clerk.accounts.dev wss://ws.clerk.accounts.dev https://api.stripe.com https://vitals.vercel-insights.com https://*.vercel-insights.com`,
  // Frames: Clerk hosted pages only
  "frame-src https://accounts.clerk.dev https://*.clerk.accounts.dev https://clerk.halvex.ai https://js.stripe.com",
  // Workers: self
  "worker-src 'self' blob:",
].join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Content-Security-Policy', value: csp },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

// Wrap with Sentry only when SENTRY_DSN is present; otherwise export plain config.
// This means omitting the env var is safe and won't break builds.
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,          // suppress build output noise
      disableLogger: true,
      tunnelRoute: '/monitoring', // avoids ad-blocker interference
      sourcemaps: { disable: true },
    })
  : nextConfig
