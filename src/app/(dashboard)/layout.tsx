'use client'

import dynamic from 'next/dynamic'
import CommandPalette from '@/components/shared/CommandPalette'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import Sidebar from '@/components/layout/Sidebar'
import TopNav from '@/components/layout/TopNav'
import { SidebarProvider, useSidebar } from '@/components/layout/SidebarContext'

const CopilotPanel = dynamic(() => import('@/components/ai/CopilotPanel'), { ssr: false })

function LayoutShell({ children }: { children: React.ReactNode }) {
  const { sidebarWidth } = useSidebar()

  return (
    <div className="app" style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <TopNav />
      <CommandPalette />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          marginLeft: sidebarWidth,
          minHeight: '100vh',
          paddingTop: 56,
          position: 'relative',
          zIndex: 1,
          transition: 'margin-left 0.16s ease',
        }}
      >
        <div
          style={{
            minHeight: 'calc(100vh - 56px)',
            padding: '0 0 32px',
            background: 'transparent',
          }}
        >
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
