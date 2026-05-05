'use client'

// Re-exports next-themes so the rest of the codebase can import from this
// file without changes, while dark mode is powered by next-themes under the hood.

export { useTheme } from 'next-themes'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  )
}
