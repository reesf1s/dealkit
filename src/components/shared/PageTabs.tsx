'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface PageTab {
  label: string
  href: string
  icon?: React.ElementType
  /** Extra paths that should also activate this tab */
  matchPaths?: string[]
}

export function PageTabs({ tabs }: { tabs: PageTab[] }) {
  const pathname = usePathname()

  const isTabActive = (tab: PageTab) => {
    const paths = tab.matchPaths ? [tab.href, ...tab.matchPaths] : [tab.href]
    return paths.some(p => pathname === p || pathname.startsWith(p + '/'))
  }

  return (
    <div style={{
      display: 'flex',
      gap: '2px',
      marginBottom: '24px',
      padding: '3px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: '10px',
      width: 'fit-content',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      {tabs.map(tab => {
        const active = isTabActive(tab)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px',
              borderRadius: '7px',
              fontSize: '12px',
              fontWeight: active ? '600' : '500',
              color: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.42)',
              background: active ? 'rgba(124,58,237,0.22)' : 'transparent',
              textDecoration: 'none',
              border: active ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent',
              transition: 'all 0.12s ease',
              whiteSpace: 'nowrap',
              boxShadow: active ? '0 0 12px rgba(124,58,237,0.15)' : 'none',
            }}
            onMouseEnter={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)'
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.42)'
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              }
            }}
          >
            {Icon && <Icon size={12} color={active ? '#A78BFA' : 'currentColor'} strokeWidth={2} />}
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
