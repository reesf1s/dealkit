'use client'

import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import { CrmShell } from '@/components/crm/CrmShell'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{
      dedupingInterval: 20_000,
      focusThrottleInterval: 30_000,
      keepPreviousData: true,
      shouldRetryOnError: false,
    }}>
      <CrmShell>
        <ErrorBoundary>{children}</ErrorBoundary>
      </CrmShell>
    </SWRConfig>
  )
}
