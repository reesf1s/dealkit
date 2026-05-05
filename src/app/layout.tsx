import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from '@/components/shared/Toast'
import CookieBanner from '@/components/shared/CookieBanner'
import { ThemeProvider } from '@/components/layout/ThemeContext'
import Script from 'next/script'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Halvex',
  description: 'Autonomous sales intelligence',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        </head>
        <body className="antialiased">
          <Script
            id="mixpanel-lib"
            src="https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"
            strategy="afterInteractive"
          />
          <Script id="mixpanel-init" strategy="afterInteractive">{`
            if (window.mixpanel && typeof window.mixpanel.init === 'function') {
              window.mixpanel.init('4ddd35723e1b279d2c5f68363becac2f', {
                track_pageview: "url-with-path",
                persistence: "localStorage",
                record_sessions_percent: 10,
                record_block_selector: "[data-mp-block]",
              });
            }
          `}</Script>
          <ThemeProvider>
            <Toaster>
              {children}
            </Toaster>
            <CookieBanner />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
