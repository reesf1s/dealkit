import type { Metadata } from 'next'
import { Inter, Poppins, Source_Code_Pro } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const titleFont = Poppins({
  variable: '--font-title',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

const bodyFont = Inter({
  variable: '--font-body',
  subsets: ['latin'],
})

const monoFont = Source_Code_Pro({
  variable: '--font-code',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Halvex',
  description: 'An LLM-first sales CRM for SME teams with a unified inbox and conversational intelligence.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/home"
      signUpFallbackRedirectUrl="/home"
      localization={{
        signIn: {
          start: {
            title: 'Sign in to Halvex',
            subtitle: 'Use your workspace account to continue.',
          },
        },
        signUp: {
          start: {
            title: 'Create your Halvex account',
            subtitle: 'Start with a workspace login.',
          },
        },
      }}
    >
      <html lang="en" className={`${titleFont.variable} ${bodyFont.variable} ${monoFont.variable}`} suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        </head>
        <body className="antialiased">
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
