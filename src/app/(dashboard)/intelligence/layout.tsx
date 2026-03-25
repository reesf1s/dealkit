'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { label: 'Overview', href: '/intelligence' },
  { label: 'Playbook', href: '/intelligence/playbook' },
  { label: 'Pipeline', href: '/intelligence/pipeline' },
  { label: 'Models', href: '/intelligence/models' },
]

export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div style={{ maxWidth: '1040px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {tabs.map(tab => {
          const isActive = tab.href === '/intelligence'
            ? pathname === '/intelligence'
            : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                color: isActive ? 'rgba(255,255,255,0.93)' : 'rgba(255,255,255,0.45)',
                borderBottom: isActive ? '2px solid rgba(139,124,248,0.8)' : '2px solid transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 500 : 400,
                marginBottom: '-1px',
                transition: 'color 0.15s ease',
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
      {children}
    </div>
  )
}
