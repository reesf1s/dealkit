'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import CommandPalette from '@/components/shared/CommandPalette'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import Sidebar from '@/components/layout/Sidebar'
import TopNav from '@/components/layout/TopNav'
import { SidebarProvider, useSidebar } from '@/components/layout/SidebarContext'

const CopilotPanel = dynamic(() => import('@/components/ai/CopilotPanel'), { ssr: false })

function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { collapsed, isMobile, sidebarWidth } = useSidebar()
  const isDealDetail = pathname.startsWith('/deals/')

  return (
    <div
      className={`app${collapsed && !isMobile ? ' app-sidebar-collapsed' : ''}`}
      style={{ gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : `${sidebarWidth}px minmax(0, 1fr)` }}
    >
      <Sidebar />
      <CommandPalette />
      <main className="dashboard-root">
        <TopNav variant="global" />
        <div className={isDealDetail ? 'dashboard-page dashboard-page-deal' : 'dashboard-page'}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
      <CopilotPanel />
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <LayoutShell>{children}</LayoutShell>
    </SidebarProvider>
  )
}
