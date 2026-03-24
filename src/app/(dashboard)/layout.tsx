'use client'

import dynamic from 'next/dynamic'
import Sidebar from '@/components/layout/Sidebar'
import TopNav from '@/components/layout/TopNav'
import CommandPalette from '@/components/shared/CommandPalette'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import { SidebarProvider, useSidebar } from '@/components/layout/SidebarContext'

// Lazy-load CopilotPanel — it's heavy and not needed on initial render
const CopilotPanel = dynamic(() => import('@/components/ai/CopilotPanel'), { ssr: false })

function LayoutShell({ children }: { children: React.ReactNode }) {
  const { sidebarWidth } = useSidebar()

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'transparent',
      position: 'relative',
    }}>

      <Sidebar />
      <TopNav />
      <CommandPalette />
      <main style={{
        flex: 1,
        minWidth: 0,
        marginLeft: `${sidebarWidth}px`,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1,
        paddingTop: '52px',
        transition: 'margin-left 0.18s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ flex: 1, padding: '22px 24px', width: '100%', boxSizing: 'border-box' }}>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>

      <CopilotPanel />

      <style>{`
        @media (max-width: 900px) {
          main { margin-left: 0 !important; margin-right: 0 !important; }
          main > div { padding: 16px !important; }
        }
      `}</style>
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
