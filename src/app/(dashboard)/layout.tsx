'use client'

import Sidebar from '@/components/layout/Sidebar'
import TopNav from '@/components/layout/TopNav'
import CopilotPanel from '@/components/ai/CopilotPanel'
import CommandPalette from '@/components/shared/CommandPalette'
import { SidebarProvider, useSidebar } from '@/components/layout/SidebarContext'

function LayoutShell({ children }: { children: React.ReactNode }) {
  const { sidebarWidth } = useSidebar()

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--bg)',
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
        paddingTop: '56px',
        transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ flex: 1, padding: '24px', width: '100%', boxSizing: 'border-box' }}>
          {children}
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
