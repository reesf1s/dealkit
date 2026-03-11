import Sidebar from '@/components/layout/Sidebar'
import TopNav from '@/components/layout/TopNav'
import CommandPalette from '@/components/shared/CommandPalette'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #07050F 0%, #0B0716 40%, #080512 100%)',
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
        background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
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
        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />
      {/* Center blob */}
      <div style={{
        position: 'fixed',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <Sidebar />
      <TopNav />
      <CommandPalette />
      <main style={{
        flex: 1,
        marginLeft: '220px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1,
        paddingTop: '56px',
      }}>
        <div style={{ flex: 1, padding: '32px', maxWidth: '960px', width: '100%' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
