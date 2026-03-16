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
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '9px',
      width: 'fit-content',
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
              padding: '5px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: active ? '600' : '400',
              color: active ? '#E5E7EB' : '#4B5563',
              background: active ? 'rgba(255,255,255,0.09)' : 'transparent',
              textDecoration: 'none',
              border: active ? '1px solid rgba(255,255,255,0.09)' : '1px solid transparent',
              transition: 'all 0.12s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = '#9CA3AF'
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = '#4B5563'
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
