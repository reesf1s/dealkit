import type { Metadata } from 'next'
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import Script from 'next/script'
import CookieBanner from '@/components/shared/CookieBanner'
import { ThemeProvider } from '@/components/layout/ThemeContext'
import AmbientBackground from '@/components/layout/AmbientBackground'
import { Toaster } from '@/components/shared/Toast'
import './globals.css'

const interTight = Inter_Tight({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

const instrumentSerif = Instrument_Serif({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: ['400'],
})

const jetBrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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
      <html
        lang="en"
        className={`${interTight.variable} ${instrumentSerif.variable} ${jetBrainsMono.variable}`}
        suppressHydrationWarning
      >
        <body>
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
            <AmbientBackground />
            <Toaster>{children}</Toaster>
            <CookieBanner />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
