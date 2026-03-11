import Sidebar from '@/components/layout/Sidebar'
import CommandPalette from '@/components/shared/CommandPalette'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0A0A0A' }}>
      <Sidebar />
      <CommandPalette />
      <main style={{ flex: 1, marginLeft: '220px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, padding: '32px', maxWidth: '960px', width: '100%' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
