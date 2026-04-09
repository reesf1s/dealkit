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
      background: 'var(--surface-2)',
      border: '1px solid var(--border-default)',
      borderRadius: '8px',
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
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: active ? '600' : '500',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: active ? 'var(--surface-1)' : 'transparent',
              textDecoration: 'none',
              border: active ? '1px solid #eeeeee' : '1px solid transparent',
              boxShadow: active ? '0 1px 3px #f5f5f5' : 'none',
              transition: 'all 0.12s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = '#1a1a1a'
                ;(e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = '#787774'
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              }
            }}
          >
            {Icon && <Icon size={12} color={active ? 'var(--text-primary)' : 'currentColor'} strokeWidth={2} />}
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
