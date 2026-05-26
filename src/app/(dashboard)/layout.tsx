'use client'

import ErrorBoundary from '@/components/shared/ErrorBoundary'
import { AppShellV2 } from '@/components/v2/V2DesignSystem'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShellV2>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppShellV2>
  )
}
