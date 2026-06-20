import type { ReactNode } from 'react'
import SmeDashboardShell from '@/components/sme/SmeDashboardShell'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <SmeDashboardShell>{children}</SmeDashboardShell>
}
