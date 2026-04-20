'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, TrendingUp,
  Building2, Settings, Plus, Zap,
  Sparkles, CornerDownLeft, Loader2,
  BarChart2, Users, Brain, GitBranch, MessageSquare, Plug, Bot,
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
  { id: 'dashboard',    label: 'Overview',      section: 'navigate', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'deals',        label: 'Deals',         section: 'navigate', icon: TrendingUp,      href: '/deals' },
  { id: 'accounts',     label: 'Accounts',      section: 'navigate', icon: Building2,       href: '/company' },
  { id: 'contacts',     label: 'Contacts',      section: 'navigate', icon: Users,           href: '/contacts' },
  { id: 'signals',      label: 'Signals',       section: 'navigate', icon: Brain,           href: '/analytics' },
  { id: 'forecast',     label: 'Forecast',      section: 'navigate', icon: BarChart2,       href: '/dashboard' },
  { id: 'conversations',label: 'Conversations', section: 'navigate', icon: MessageSquare,   href: '/connections' },
  { id: 'automations',  label: 'Automations',   section: 'navigate', icon: Bot,             href: '/automations' },
  { id: 'calendar',     label: 'Calendar',      section: 'navigate', icon: GitBranch,       href: '/calendar', shortcut: '↩' },
  { id: 'integrations', label: 'Integrations',  section: 'navigate', icon: Plug,            href: '/company' },
  { id: 'settings',     label: 'Settings',      section: 'navigate', icon: Settings,        href: '/settings' },
  { id: 'log-deal',     label: 'Log deal',      section: 'actions',  icon: Plus,            href: '/deals' },
  { id: 'ask-ai',       label: 'Ask Halvex',    section: 'actions',  icon: Sparkles,        href: '/dashboard' },
  { id: 'run-auto',     label: 'Review automations', section: 'actions', icon: Zap,         href: '/automations' },
]

// ── Intent classifier ─────────────────────────────────────────────────────────
// Determines if the query is a question for AI or a navigation command.
// Rules are ordered by specificity — first match wins.
const AI_PREFIXES = [
  'how', 'why', 'what', 'when', 'which', 'who', 'where',
  'is ', 'are ', 'can ', 'should ', 'will ', 'do i', 'does',
  'help', 'tell ', 'explain', 'analyze', 'analyse', 'summarize',
  'show me', 'find my', 'give me', 'list my', 'compare',
  'battlecard', 'draft', 'write me', 'create a report',
]

function classifyIntent(q: string): 'ai' | 'nav' {
  if (!q.trim() || q.trim().length <= 2) return 'nav'
  const lower = q.toLowerCase().trim()

  // Explicit question marker — always AI
  if (lower.endsWith('?')) return 'ai'

  // Starts with known AI prefix
  if (AI_PREFIXES.some(p => lower.startsWith(p))) return 'ai'

  // 5+ word queries are almost certainly questions, not nav commands
  if (lower.split(/\s+/).length >= 5) return 'ai'

  // Nav match check — if any nav item label closely matches, prefer nav
  const hasStrongNavMatch = ALL_ITEMS.some(item =>
    item.label.toLowerCase().includes(lower) || lower.includes(item.label.toLowerCase().split(' ')[0])
  )
  // 3-4 word queries with no nav match → AI
  if (lower.split(/\s+/).length >= 3 && !hasStrongNavMatch) return 'ai'

  return 'nav'
}

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

  // Classify intent on every query change
  const intent = useMemo(() => classifyIntent(query), [query])

  const filtered = query.trim() === ''
    ? ALL_ITEMS
    : ALL_ITEMS.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase())
      )

  const navigateItems = filtered.filter(i => i.section === 'navigate')
  const actionItems   = filtered.filter(i => i.section === 'actions')

  // When intent is AI: show Ask AI row first, then any nav matches below
  // When intent is nav: show nav items first, Ask AI last
  const showAskAI = query.trim().length > 2

  // In AI-intent mode: Ask AI is index 0, nav items follow
  // In nav-intent mode: nav items first, Ask AI is last
  const askAIFirst = intent === 'ai' && showAskAI
  const navFlat = useMemo(() => [...navigateItems, ...actionItems], [navigateItems, actionItems])

  let totalItems: number
  let askAIIndex: number
  if (askAIFirst) {
    // AI row at top (index 0), nav items after
    askAIIndex = 0
    totalItems = 1 + navFlat.length
  } else {
    // Nav items first, AI row at end
    askAIIndex = navFlat.length
    totalItems = navFlat.length + (showAskAI ? 1 : 0)
  }

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

  // Ask the AI — hits the fast palette endpoint (brain snapshot only, ~1 DB query)
  const askAI = useCallback(async (question: string) => {
    if (!question.trim()) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setMode('ai')
    setAiLoading(true)
    setAiAnswer('')
    setAiDone(false)

    try {
      const res = await fetch('/api/chat/palette', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        setAiAnswer('Something went wrong. Try again.')
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
    } catch (err: unknown) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setAiAnswer('Something went wrong. Please try again.')
        setAiDone(true)
      }
      setAiLoading(false)
    }
  }, [])

  // Global keydown handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
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

  // Custom event listener — supports optional pre-loaded query
  // Usage: window.dispatchEvent(new CustomEvent('openCommandPalette', { detail: { query: '...' } }))
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { query?: string } | undefined
      if (detail?.query) {
        // Open and immediately fire the AI — no extra Enter needed
        setOpen(true)
        setQuery(detail.query)
        setActiveIndex(0)
        setAiAnswer('')
        setAiDone(false)
        setAiLoading(false)
        askAI(detail.query)
      } else {
        openPalette()
      }
    }
    window.addEventListener('openCommandPalette', handler)
    return () => window.removeEventListener('openCommandPalette', handler)
  }, [openPalette, askAI])

  // Auto-focus input when opened
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  // Arrow key navigation + Enter (nav mode only)
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
        } else {
          // Adjust nav item index based on whether AI row is first or not
          const navIndex = askAIFirst ? activeIndex - 1 : activeIndex
          if (navFlat[navIndex]) selectNavItem(navFlat[navIndex])
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, mode, navFlat, activeIndex, selectNavItem, showAskAI, askAIIndex, askAIFirst, query, askAI, totalItems])

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Auto-select Ask AI row when intent flips to 'ai'
  useEffect(() => {
    if (mode === 'nav' && intent === 'ai' && showAskAI) {
      setActiveIndex(0) // Ask AI is always index 0 in AI-intent mode
    }
  }, [intent, showAskAI, mode])

  // Reset activeIndex when query changes in nav mode
  useEffect(() => {
    if (mode === 'nav') {
      setActiveIndex(intent === 'ai' && showAskAI ? 0 : 0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // When in AI mode and user clears the query, go back to nav
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

  // Compute nav item's data-index offset based on whether Ask AI is first
  const navItemIndex = (i: number) => askAIFirst ? i + 1 : i

  const renderNavSection = (label: string, items: CommandItem[], offset: number) => {
    if (items.length === 0) return null
    return (
      <div key={label}>
        <div style={{
          fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 700,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '8px 12px 4px',
        }}>
          {label}
        </div>
        {items.map((item, i) => {
          const globalIndex = navItemIndex(offset + i)
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
                backgroundColor: isActive ? 'var(--surface-hover)' : 'transparent',
                transition: 'background-color 0.05s',
              }}
            >
              <Icon size={16} color="var(--text-tertiary)" strokeWidth={1.5} />
              <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                {item.label}
              </span>
              {item.shortcut && (
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{item.shortcut}</span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const AskAIRow = ({ atTop }: { atTop: boolean }) => {
    if (!showAskAI) return null
    const isActive = activeIndex === askAIIndex
    return (
      <div>
        {!atTop && navFlat.length > 0 && (
          <div style={{ height: '1px', background: 'var(--border)', margin: '6px 12px' }} />
        )}
        {atTop && (
          <div style={{
            fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '8px 12px 4px',
          }}>
            Ask AI
          </div>
        )}
        <div
          data-index={askAIIndex}
          onClick={() => askAI(query)}
          onMouseEnter={() => setActiveIndex(askAIIndex)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            height: '44px', padding: '0 12px',
            cursor: 'pointer', borderRadius: '8px', margin: '0 6px',
            backgroundColor: isActive ? 'rgba(29, 184, 106, 0.08)' : 'transparent',
            border: isActive ? '1px solid rgba(29, 184, 106, 0.18)' : '1px solid transparent',
            transition: 'all 0.05s',
          }}
        >
          <div style={{
            width: '26px', height: '26px', borderRadius: '7px',
            background: 'rgba(29, 184, 106, 0.10)',
            border: '1px solid rgba(29, 184, 106, 0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Sparkles size={13} color="#1DB86A" />
          </div>
          <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {atTop
              ? <><span style={{ color: 'var(--text-secondary)' }}>{query}</span></>
              : <>Ask AI: <span style={{ color: 'var(--text-secondary)' }}>{query}</span></>
            }
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
            <CornerDownLeft size={11} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={closePalette}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--border-default)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '600px',
          maxHeight: mode === 'ai' ? '580px' : '480px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          boxShadow: '0 8px 40px #dddddd, 0 2px 8px #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'max-height 0.2s ease',
        }}
      >
        {/* Search input */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
            color: mode === 'ai' || intent === 'ai' ? 'var(--accent)' : 'var(--text-tertiary)',
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
              if (mode === 'ai' && !aiLoading) {
                setMode('nav')
                setAiAnswer('')
                setAiDone(false)
              }
            }}
            onKeyDown={e => {
              if (mode === 'ai' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault()
              }
            }}
            placeholder="Ask anything or jump to..."
            style={{
              width: '100%', height: '52px',
              fontSize: '15px', color: 'var(--text-primary)',
              backgroundColor: 'transparent',
              border: 'none', outline: 'none',
              padding: '0 16px 0 42px',
              letterSpacing: '-0.02em',
              boxSizing: 'border-box',
              caretColor: 'var(--accent)',
            }}
          />
          {/* Intent hint */}
          {mode === 'nav' && showAskAI && (
            <div style={{
              position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', color: 'var(--text-tertiary)',
            }}>
              {intent === 'ai'
                ? <span style={{ color: 'var(--accent)' }}>↵ ask AI</span>
                : <><CornerDownLeft size={11} /> ask AI</>
              }
            </div>
          )}
          {/* New question button */}
          {mode === 'ai' && aiDone && (
            <button
              onClick={() => {
                setMode('nav')
                setAiAnswer('')
                setAiDone(false)
                setQuery('')
                requestAnimationFrame(() => inputRef.current?.focus())
              }}
              style={{
                position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer',
                letterSpacing: '-0.01em',
              }}
            >
              New question
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--border)', flexShrink: 0 }} />

        {/* AI response */}
        {mode === 'ai' && (
          <div
            ref={answerRef}
            style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', minHeight: '80px' }}
          >
            {aiLoading && !aiAnswer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--accent)' }} />
                Thinking…
              </div>
            )}
            {aiAnswer && (
              <div style={{
                fontSize: '13px', color: 'var(--text-primary)',
                lineHeight: '1.65', letterSpacing: '-0.01em', whiteSpace: 'pre-wrap',
              }}>
                {renderMarkdown(aiAnswer)}
                {!aiDone && (
                  <span style={{
                    display: 'inline-block', width: '8px', height: '14px',
                    background: 'var(--accent)', borderRadius: '1px',
                    animation: 'blink 0.8s step-end infinite',
                    verticalAlign: 'text-bottom', marginLeft: '2px',
                  }} />
                )}
              </div>
            )}
          </div>
        )}

        {/* Nav results */}
        {mode === 'nav' && (
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 0 8px' }}>
            {navFlat.length === 0 && !showAskAI ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '80px', fontSize: '13px', color: 'var(--text-tertiary)',
              }}>
                No results
              </div>
            ) : (
              <>
                {/* Ask AI first when intent is AI */}
                {askAIFirst && <AskAIRow atTop={true} />}

                {/* Nav items */}
                {navFlat.length > 0 && (
                  <>
                    {askAIFirst && navFlat.length > 0 && (
                      <div style={{ height: '1px', background: 'var(--border)', margin: '6px 12px' }} />
                    )}
                    {renderNavSection('Navigate', navigateItems, 0)}
                    {renderNavSection('Actions', actionItems, navigateItems.length)}
                  </>
                )}

                {/* Ask AI last when intent is nav */}
                {!askAIFirst && <AskAIRow atTop={false} />}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 5px' }}>↑↓</kbd>
              navigate
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 5px' }}>↵</kbd>
              {mode === 'ai' ? 'ask' : intent === 'ai' && showAskAI ? 'ask AI' : 'select'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 5px' }}>esc</kbd>
              close
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '-0.01em' }}>
            Halvex AI
          </div>
        </div>
      </div>

      <style>{`
        input[data-cp-input]::placeholder { color: #aaaaaa; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  )
}

// Minimal markdown renderer: bold, bullets, headings
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const key = i
    if (/^[•\-\*] /.test(line)) {
      const content = line.replace(/^[•\-\*] /, '')
      return (
        <div key={key} style={{ display: 'flex', gap: '8px', marginBottom: '3px' }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }}>•</span>
          <span>{renderInline(content)}</span>
        </div>
      )
    }
    if (/^##+ /.test(line)) {
      const content = line.replace(/^##+ /, '')
      return (
        <div key={key} style={{ fontWeight: '700', color: 'var(--accent)', marginTop: i > 0 ? '12px' : '0', marginBottom: '4px', fontSize: '12px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          {content}
        </div>
      )
    }
    if (line.trim() === '') return <div key={key} style={{ height: '6px' }} />
    return <div key={key} style={{ marginBottom: '2px' }}>{renderInline(line)}</div>
  })
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}
