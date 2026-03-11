import Sidebar from '@/components/layout/Sidebar'
import CommandPalette from '@/components/shared/CommandPalette'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #050508 0%, #0A0810 50%, #080510 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Purple blob top-left */}
      <div style={{
        position: 'fixed',
        top: '-120px',
        left: '-80px',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />
      {/* Purple blob bottom-right */}
      <div style={{
        position: 'fixed',
        bottom: '-120px',
        right: '-80px',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />
      {/* Indigo blob top-right */}
      <div style={{
        position: 'fixed',
        top: '20%',
        right: '10%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <Sidebar />
      <CommandPalette />
      <main style={{
        flex: 1,
        marginLeft: '220px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ flex: 1, padding: '32px', maxWidth: '960px', width: '100%' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
