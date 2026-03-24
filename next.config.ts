import type { NextConfig } from "next";

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
  // Scripts: self + Clerk (uses eval for its own UI) + Vercel Speed Insights
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.accounts.dev https://*.clerk.accounts.dev",
  // Styles: self + inline (needed for CSS-in-JS / Tailwind)
  "style-src 'self' 'unsafe-inline'",
  // Images: self + data URIs + any HTTPS (avatars, logos)
  "img-src 'self' data: blob: https:",
  // Fonts: self + data URIs
  "font-src 'self' data:",
  // Connections: self + Supabase + Clerk + Vercel analytics
  `connect-src 'self' ${supabaseHosts} https://clerk.accounts.dev https://*.clerk.accounts.dev https://vitals.vercel-insights.com https://*.vercel-insights.com`,
  // Frames: Clerk hosted pages only
  "frame-src https://accounts.clerk.dev https://*.clerk.accounts.dev",
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

export default nextConfig;
