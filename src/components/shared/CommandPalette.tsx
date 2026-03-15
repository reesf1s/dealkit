'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Swords, BookOpen, TrendingUp,
  FileText, Building2, Settings, Plus, Zap,
} from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  section: 'navigate' | 'actions'
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>
  href: string
  shortcut?: string
}

const ALL_ITEMS: CommandItem[] = [
  { id: 'dashboard',      label: 'Dashboard',           section: 'navigate', icon: LayoutDashboard, href: '/dashboard',    shortcut: '↩' },
  { id: 'competitors',    label: 'Competitors',          section: 'navigate', icon: Swords,          href: '/competitors' },
  { id: 'case-studies',   label: 'Case Studies',         section: 'navigate', icon: BookOpen,         href: '/case-studies' },
  { id: 'deals',          label: 'Deal Log',             section: 'navigate', icon: TrendingUp,       href: '/deals' },
  { id: 'collateral',     label: 'Collateral',           section: 'navigate', icon: FileText,         href: '/collateral' },
  { id: 'company',        label: 'Company Profile',      section: 'navigate', icon: Building2,        href: '/company' },
  { id: 'settings',       label: 'Settings',             section: 'navigate', icon: Settings,         href: '/settings' },
  { id: 'add-competitor', label: 'Add competitor',       section: 'actions',  icon: Plus,             href: '/competitors' },
  { id: 'log-deal',       label: 'Log deal',             section: 'actions',  icon: Plus,             href: '/deals' },
  { id: 'add-case-study', label: 'Add case study',       section: 'actions',  icon: Plus,             href: '/case-studies' },
  { id: 'gen-collateral', label: 'Generate collateral',  section: 'actions',  icon: Zap,              href: '/collateral' },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim() === ''
    ? ALL_ITEMS
    : ALL_ITEMS.filter(item => item.label.toLowerCase().includes(query.toLowerCase()))

  // Group filtered items by section, preserving order
  const navigateItems = filtered.filter(i => i.section === 'navigate')
  const actionItems   = filtered.filter(i => i.section === 'actions')
  const flatItems = [...navigateItems, ...actionItems]

  const openPalette = useCallback(() => {
    setOpen(true)
    setQuery('')
    setActiveIndex(0)
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }, [])

  const selectItem = useCallback((item: CommandItem) => {
    router.push(item.href)
    closePalette()
  }, [router, closePalette])

  // Global keydown handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => {
          if (prev) { closePalette(); return false }
          openPalette(); return true
        })
      }
      if (e.key === 'Escape') {
        closePalette()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openPalette, closePalette])

  // Custom event listener
  useEffect(() => {
    const handler = () => openPalette()
    window.addEventListener('openCommandPalette', handler)
    return () => window.removeEventListener('openCommandPalette', handler)
  }, [openPalette])

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      // Use rAF to ensure DOM is ready
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Arrow key navigation inside palette
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(prev => (prev + 1) % (flatItems.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(prev => (prev - 1 + (flatItems.length || 1)) % (flatItems.length || 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (flatItems[activeIndex]) selectItem(flatItems[activeIndex])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, flatItems, activeIndex, selectItem])

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Reset activeIndex when query or filtered list changes
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  if (!open) return null

  const renderSection = (label: string, items: CommandItem[], offset: number) => {
    if (items.length === 0) return null
    return (
      <div key={label}>
        <div style={{
          fontSize: '11px',
          color: '#555',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '8px 12px 4px',
        }}>
          {label}
        </div>
        {items.map((item, i) => {
          const globalIndex = offset + i
          const isActive = globalIndex === activeIndex
          const Icon = item.icon
          return (
            <div
              key={item.id}
              data-index={globalIndex}
              onClick={() => selectItem(item)}
              onMouseEnter={() => setActiveIndex(globalIndex)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                height: '40px',
                padding: '0 12px',
                cursor: 'pointer',
                borderRadius: '6px',
                margin: '0 6px',
                backgroundColor: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                transition: 'background-color 0.05s',
              }}
            >
              <Icon size={16} color="#666" strokeWidth={1.5} />
              <span style={{
                flex: 1,
                fontSize: '13px',
                color: '#EBEBEB',
                letterSpacing: '-0.01em',
              }}>
                {item.label}
              </span>
              {item.shortcut && (
                <span style={{ fontSize: '11px', color: '#555' }}>
                  {item.shortcut}
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      onClick={closePalette}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '560px',
          maxHeight: '480px',
          background: 'rgba(10,8,20,0.98)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          boxShadow: '0 40px 100px rgba(0,0,0,0.9), 0 0 0 1px rgba(99,102,241,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <input
            ref={inputRef}
            data-cp-input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search or jump to..."
            style={{
              width: '100%',
              height: '52px',
              fontSize: '16px',
              color: '#EBEBEB',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              padding: '0 16px',
              letterSpacing: '-0.02em',
              boxSizing: 'border-box',
              caretColor: '#6366F1',
            }}
          />
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

        {/* Results */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '6px 0 8px',
          }}
        >
          {flatItems.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '80px',
              fontSize: '13px',
              color: '#555',
            }}>
              No results
            </div>
          ) : (
            <>
              {renderSection('Navigate', navigateItems, 0)}
              {renderSection('Actions', actionItems, navigateItems.length)}
            </>
          )}
        </div>
      </div>

      {/* Inline style to control placeholder color */}
      <style>{`
        input[data-cp-input]::placeholder {
          color: rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  )
}
