'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Swords, BookOpen, TrendingUp,
  FileText, Building2, Settings, Plus, Zap,
  Sparkles, ArrowRight, CornerDownLeft, Loader2,
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

type PaletteMode = 'nav' | 'ai'

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [mode, setMode] = useState<PaletteMode>('nav')

  // AI response state
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiDone, setAiDone] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const answerRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim() === ''
    ? ALL_ITEMS
    : ALL_ITEMS.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase())
      )

  // Group filtered items by section, preserving order
  const navigateItems = filtered.filter(i => i.section === 'navigate')
  const actionItems   = filtered.filter(i => i.section === 'actions')
  const navFlat = [...navigateItems, ...actionItems]

  // "Ask AI" synthetic item — shown when query has content and isn't a perfect nav match
  const showAskAI = query.trim().length > 2

  // In nav mode: nav items + ask AI row
  const totalItems = navFlat.length + (showAskAI ? 1 : 0)
  const askAIIndex = navFlat.length // always last in nav mode

  const openPalette = useCallback(() => {
    setOpen(true)
    setQuery('')
    setActiveIndex(0)
    setMode('nav')
    setAiAnswer('')
    setAiDone(false)
    setAiLoading(false)
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
    setMode('nav')
    setAiAnswer('')
    setAiDone(false)
    setAiLoading(false)
    abortRef.current?.abort()
  }, [])

  const selectNavItem = useCallback((item: CommandItem) => {
    router.push(item.href)
    closePalette()
  }, [router, closePalette])

  // Ask the AI and stream response
  const askAI = useCallback(async (question: string) => {
    if (!question.trim()) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setMode('ai')
    setAiLoading(true)
    setAiAnswer('')
    setAiDone(false)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: question }],
          currentPage: typeof window !== 'undefined' ? window.location.pathname : '/',
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        setAiAnswer('Sorry, something went wrong. Try again.')
        setAiDone(true)
        setAiLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const payload = JSON.parse(line.slice(6))
            if (payload.t) {
              setAiAnswer(prev => prev + payload.t)
              // Auto-scroll answer
              requestAnimationFrame(() => {
                if (answerRef.current) {
                  answerRef.current.scrollTop = answerRef.current.scrollHeight
                }
              })
            }
            if (payload.done) {
              setAiDone(true)
              setAiLoading(false)
            }
          } catch { /* skip malformed */ }
        }
      }
      setAiDone(true)
      setAiLoading(false)
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setAiAnswer('Something went wrong. Please try again.')
        setAiDone(true)
      }
      setAiLoading(false)
    }
  }, [])

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
      if (e.key === 'Escape') closePalette()
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
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  // Arrow key navigation inside palette (nav mode only)
  useEffect(() => {
    if (!open || mode === 'ai') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(prev => (prev + 1) % Math.max(totalItems, 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(prev => (prev - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (showAskAI && activeIndex === askAIIndex) {
          askAI(query)
        } else if (navFlat[activeIndex]) {
          selectNavItem(navFlat[activeIndex])
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, mode, navFlat, activeIndex, selectNavItem, showAskAI, askAIIndex, query, askAI, totalItems])

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Reset activeIndex when query changes
  useEffect(() => { setActiveIndex(0) }, [query])

  // When entering AI mode, reset to nav mode if query is cleared
  useEffect(() => {
    if (mode === 'ai' && query.trim() === '') {
      setMode('nav')
      setAiAnswer('')
      setAiDone(false)
      setAiLoading(false)
      abortRef.current?.abort()
    }
  }, [query, mode])

  if (!open) return null

  const renderNavSection = (label: string, items: CommandItem[], offset: number) => {
    if (items.length === 0) return null
    return (
      <div key={label}>
        <div style={{
          fontSize: '11px', color: '#555', fontWeight: 700,
          letterSpacing: '0.06em', textTransform: 'uppercase',
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
              onClick={() => selectNavItem(item)}
              onMouseEnter={() => setActiveIndex(globalIndex)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                height: '40px', padding: '0 12px',
                cursor: 'pointer', borderRadius: '6px', margin: '0 6px',
                backgroundColor: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                transition: 'background-color 0.05s',
              }}
            >
              <Icon size={16} color="#666" strokeWidth={1.5} />
              <span style={{ flex: 1, fontSize: '13px', color: '#EBEBEB', letterSpacing: '-0.01em' }}>
                {item.label}
              </span>
              {item.shortcut && (
                <span style={{ fontSize: '11px', color: '#555' }}>{item.shortcut}</span>
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
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '600px',
          maxHeight: mode === 'ai' ? '580px' : '480px',
          background: 'rgba(10,8,20,0.98)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          boxShadow: '0 40px 100px rgba(0,0,0,0.9), 0 0 0 1px rgba(99,102,241,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'max-height 0.2s ease',
        }}
      >
        {/* Search input */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {/* Icon */}
          <div style={{
            position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
            color: mode === 'ai' ? '#818CF8' : '#555',
            display: 'flex', alignItems: 'center',
            transition: 'color 0.15s',
          }}>
            {aiLoading
              ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
              : <Sparkles size={16} />
            }
          </div>
          <input
            ref={inputRef}
            data-cp-input
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              // If in AI mode and user changes query, go back to nav
              if (mode === 'ai' && !aiLoading) {
                setMode('nav')
                setAiAnswer('')
                setAiDone(false)
              }
            }}
            onKeyDown={e => {
              // Prevent arrow keys from moving cursor in AI mode
              if (mode === 'ai' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault()
              }
            }}
            placeholder="Ask anything or jump to..."
            style={{
              width: '100%', height: '52px',
              fontSize: '15px', color: '#EBEBEB',
              backgroundColor: 'transparent',
              border: 'none', outline: 'none',
              padding: '0 16px 0 42px',
              letterSpacing: '-0.02em',
              boxSizing: 'border-box',
              caretColor: '#6366F1',
            }}
          />
          {/* Ask AI hint */}
          {mode === 'nav' && showAskAI && (
            <div style={{
              position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', color: '#555',
            }}>
              <CornerDownLeft size={11} />
              ask AI
            </div>
          )}
          {/* "New question" button in AI mode */}
          {mode === 'ai' && aiDone && (
            <button
              onClick={() => { setMode('nav'); setAiAnswer(''); setAiDone(false); setQuery(''); requestAnimationFrame(() => inputRef.current?.focus()) }}
              style={{
                position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '11px', color: '#818CF8', background: 'none', border: 'none', cursor: 'pointer',
                letterSpacing: '-0.01em',
              }}
            >
              New question
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

        {/* AI response area */}
        {mode === 'ai' && (
          <div
            ref={answerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 18px',
              minHeight: '80px',
            }}
          >
            {aiLoading && !aiAnswer && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '13px', color: '#555',
              }}>
                <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite', color: '#818CF8' }} />
                Thinking…
              </div>
            )}
            {aiAnswer && (
              <div style={{
                fontSize: '13px', color: '#E2E0F0',
                lineHeight: '1.65',
                letterSpacing: '-0.01em',
                whiteSpace: 'pre-wrap',
              }}>
                {/* Render basic markdown: **bold**, bullet points */}
                {renderMarkdown(aiAnswer)}
                {!aiDone && (
                  <span style={{
                    display: 'inline-block', width: '8px', height: '14px',
                    background: '#6366F1', borderRadius: '1px',
                    animation: 'blink 0.8s step-end infinite',
                    verticalAlign: 'text-bottom', marginLeft: '2px',
                  }} />
                )}
              </div>
            )}
          </div>
        )}

        {/* Nav results (only in nav mode) */}
        {mode === 'nav' && (
          <div
            ref={listRef}
            style={{ flex: 1, overflowY: 'auto', padding: '6px 0 8px' }}
          >
            {navFlat.length === 0 && !showAskAI ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '80px', fontSize: '13px', color: '#555',
              }}>
                No results
              </div>
            ) : (
              <>
                {renderNavSection('Navigate', navigateItems, 0)}
                {renderNavSection('Actions', actionItems, navigateItems.length)}

                {/* Ask AI row */}
                {showAskAI && (
                  <div>
                    {navFlat.length > 0 && (
                      <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '6px 12px' }} />
                    )}
                    <div
                      data-index={askAIIndex}
                      onClick={() => askAI(query)}
                      onMouseEnter={() => setActiveIndex(askAIIndex)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        height: '44px', padding: '0 12px',
                        cursor: 'pointer', borderRadius: '8px', margin: '0 6px',
                        backgroundColor: activeIndex === askAIIndex
                          ? 'rgba(99,102,241,0.12)'
                          : 'transparent',
                        border: activeIndex === askAIIndex
                          ? '1px solid rgba(99,102,241,0.2)'
                          : '1px solid transparent',
                        transition: 'all 0.05s',
                      }}
                    >
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '7px',
                        background: 'rgba(99,102,241,0.15)',
                        border: '1px solid rgba(99,102,241,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Sparkles size={13} color="#818CF8" />
                      </div>
                      <span style={{ flex: 1, fontSize: '13px', color: '#E2E0F0', letterSpacing: '-0.01em' }}>
                        Ask AI: <span style={{ color: '#A5B4FC' }}>{query}</span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ArrowRight size={13} color="#555" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '11px', color: '#333', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{ fontSize: '10px', color: '#444', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '1px 5px' }}>↑↓</kbd>
              navigate
            </span>
            <span style={{ fontSize: '11px', color: '#333', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{ fontSize: '10px', color: '#444', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '1px 5px' }}>↵</kbd>
              {mode === 'ai' ? 'ask' : 'select'}
            </span>
            <span style={{ fontSize: '11px', color: '#333', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{ fontSize: '10px', color: '#444', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '1px 5px' }}>esc</kbd>
              close
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#2D2A40', letterSpacing: '-0.01em' }}>
            DealKit AI
          </div>
        </div>
      </div>

      <style>{`
        input[data-cp-input]::placeholder { color: rgba(255,255,255,0.2); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  )
}

// Minimal markdown renderer: bold, bullets, line breaks
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const key = i
    // Bullet point
    if (/^[•\-\*] /.test(line)) {
      const content = line.replace(/^[•\-\*] /, '')
      return (
        <div key={key} style={{ display: 'flex', gap: '8px', marginBottom: '3px' }}>
          <span style={{ color: '#6366F1', flexShrink: 0, marginTop: '1px' }}>•</span>
          <span>{renderInline(content)}</span>
        </div>
      )
    }
    // Heading (## or ###)
    if (/^##+ /.test(line)) {
      const content = line.replace(/^##+ /, '')
      return (
        <div key={key} style={{ fontWeight: '700', color: '#F0EEFF', marginTop: i > 0 ? '12px' : '0', marginBottom: '4px', fontSize: '12px', letterSpacing: '0.02em', textTransform: 'uppercase', color: '#818CF8' }}>
          {content}
        </div>
      )
    }
    // Blank line
    if (line.trim() === '') return <div key={key} style={{ height: '6px' }} />
    // Regular line
    return <div key={key} style={{ marginBottom: '2px' }}>{renderInline(line)}</div>
  })
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#F0EEFF', fontWeight: '600' }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}
