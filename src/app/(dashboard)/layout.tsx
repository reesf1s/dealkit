'use client'

import Sidebar from '@/components/layout/Sidebar'
import TopNav from '@/components/layout/TopNav'
import AiChatSidebar from '@/components/layout/AiChatSidebar'
import CommandPalette from '@/components/shared/CommandPalette'
import { SidebarProvider, useSidebar } from '@/components/layout/SidebarContext'

function LayoutShell({ children }: { children: React.ReactNode }) {
  const { sidebarWidth, aiSidebarWidth } = useSidebar()

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #07050F 0%, #0B0716 40%, #080512 100%)',
      position: 'relative',
    }}>
      <div style={{
        position: 'fixed', top: '-120px', left: '-80px',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: '-120px', right: `${Math.max(aiSidebarWidth - 80, 0)}px`,
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
        filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)',
        filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0,
      }} />

      <Sidebar />
      <TopNav />
      <CommandPalette />
      <main style={{
        flex: 1,
        minWidth: 0,
        marginLeft: `${sidebarWidth}px`,
        marginRight: `${aiSidebarWidth}px`,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1,
        paddingTop: '56px',
        transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1), margin-right 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ flex: 1, padding: '24px', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
          {children}
        </div>
      </main>

      <AiChatSidebar />

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
