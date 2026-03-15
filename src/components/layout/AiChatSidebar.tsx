'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Send, Sparkles, User, Bot, RotateCcw, Square, MessageSquare, ChevronRight, ChevronLeft, FileText, Sword, Building2, Zap, CheckCircle2, PlusCircle, RefreshCw, BookOpen, AlertTriangle, BarChart2, Mail } from 'lucide-react'
import { mutate as globalMutate } from 'swr'
import { useSidebar } from './SidebarContext'
import type { ActionCard } from '@/app/api/chat/route'

function invalidateCaches(actions: ActionCard[]) {
  // Every action rebuilds the brain in the background — revalidate brain cache after a short delay
  // so sidebar badges and dashboard Pipeline Focus update
  setTimeout(() => globalMutate('/api/brain'), 2000)

  for (const action of actions) {
    if (action.type === 'todos_updated' || action.type === 'deal_updated' || action.type === 'deal_created') {
      globalMutate('/api/deals')
      globalMutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/deals/'), undefined, { revalidate: true })
    }
    if (action.type === 'competitor_created') {
      globalMutate('/api/competitors')
      globalMutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/competitors/'), undefined, { revalidate: true })
    }
    if (action.type === 'company_updated') {
      globalMutate('/api/company')
      globalMutate('/api/company-profile')
      globalMutate('/api/onboarding/parse')
    }
    if (action.type === 'collateral_generating') {
      globalMutate('/api/collateral')
    }
    if (action.type === 'case_study_created') {
      globalMutate('/api/case-studies')
      globalMutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/case-studies/'), undefined, { revalidate: true })
    }
    if (action.type === 'gaps_logged') {
      globalMutate('/api/product-gaps')
    }
  }
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  actions?: ActionCard[]
}

// ── Capability cards shown in empty state ──────────────────────────────────────

const CAPABILITIES = [
  {
    icon: FileText,
    color: '#6366F1',
    bg: 'rgba(99,102,241,0.1)',
    border: 'rgba(99,102,241,0.2)',
    title: 'Meeting Notes',
    desc: 'Paste notes → auto-update todos & deals',
    prompt: 'Here are my meeting notes from today:\n\n[Paste your meeting notes here]',
  },
  {
    icon: Sword,
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.1)',
    border: 'rgba(236,72,153,0.2)',
    title: 'Competitor Intel',
    desc: 'Add competitor → auto-generate battlecard',
    prompt: 'Create a battlecard for competitor: ',
  },
  {
    icon: Building2,
    color: '#10B981',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.2)',
    title: 'Company Profile',
    desc: 'Update products, value props & more',
    prompt: 'Update our company profile: ',
  },
  {
    icon: Zap,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.2)',
    title: 'Generate Collateral',
    desc: 'Create battlecards, one-pagers, email sequences',
    prompt: 'Generate a ',
  },
  {
    icon: BarChart2,
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.2)',
    title: 'Top 5 Deals & Risks',
    desc: 'Ranked pipeline with key risks per deal',
    prompt: 'Show me my top 5 deals ranked by priority, with the biggest risk for each.',
  },
  {
    icon: Mail,
    color: '#06B6D4',
    bg: 'rgba(6,182,212,0.1)',
    border: 'rgba(6,182,212,0.2)',
    title: 'Risk Outreach Emails',
    desc: 'Write emails addressing the top risk per deal',
    prompt: 'My top 3 open deals by priority — for each, identify the biggest risk or blocker and draft a short personalised follow-up email (with subject line) that addresses it directly.',
  },
]

// ── Typing indicator ───────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: '#6366F1',
            animation: `typingBounce 1.2s ease-in-out ${i * 0.16}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ── Action cards rendered below assistant messages ─────────────────────────────

function ActionCards({ actions }: { actions: ActionCard[] }) {
  if (!actions.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
      {actions.map((action, i) => {
        if (action.type === 'todos_updated') {
          return (
            <div key={i} style={{
              padding: '8px 10px', borderRadius: '8px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              display: 'flex', flexDirection: 'column', gap: '4px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={11} color="#10B981" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#10B981' }}>Todos updated — {action.dealName}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {action.added > 0 && <span style={{ fontSize: '10px', color: '#6EE7B7' }}>+{action.added} added</span>}
                {action.completed > 0 && <span style={{ fontSize: '10px', color: '#6EE7B7' }}>✓ {action.completed} done</span>}
                {action.removed > 0 && <span style={{ fontSize: '10px', color: '#6EE7B7' }}>✕ {action.removed} removed</span>}
              </div>
            </div>
          )
        }
        if (action.type === 'deal_updated') {
          return (
            <div key={i} style={{
              padding: '8px 10px', borderRadius: '8px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              display: 'flex', flexDirection: 'column', gap: '4px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={11} color="#10B981" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#10B981' }}>Deal updated — {action.dealName}</span>
              </div>
              {action.changes.slice(0, 3).map((c, ci) => (
                <div key={ci} style={{ fontSize: '10px', color: '#6EE7B7', paddingLeft: '17px' }}>• {c}</div>
              ))}
            </div>
          )
        }
        if (action.type === 'deal_created') {
          return (
            <div key={i} style={{
              padding: '8px 10px', borderRadius: '8px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <PlusCircle size={11} color="#10B981" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#10B981' }}>Deal created — {action.dealName}</span>
              {action.company && <span style={{ fontSize: '10px', color: '#6EE7B7' }}>({action.company})</span>}
            </div>
          )
        }
        if (action.type === 'competitor_created') {
          return (
            <div key={i} style={{
              padding: '8px 10px', borderRadius: '8px',
              background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.2)',
              display: 'flex', flexDirection: 'column', gap: '4px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sword size={11} color="#EC4899" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#EC4899' }}>
                  {action.names.length === 1 ? action.names[0] : `${action.names.length} competitors`} added
                </span>
              </div>
              {action.battlecardsStarted && (
                <div style={{ fontSize: '10px', color: '#F9A8D4', paddingLeft: '17px' }}>↳ Battlecard generation started</div>
              )}
            </div>
          )
        }
        if (action.type === 'company_updated') {
          return (
            <div key={i} style={{
              padding: '8px 10px', borderRadius: '8px',
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
              display: 'flex', flexDirection: 'column', gap: '4px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={11} color="#818CF8" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#818CF8' }}>Company profile updated</span>
              </div>
              {action.fields.slice(0, 4).map((f, fi) => (
                <div key={fi} style={{ fontSize: '10px', color: '#A5B4FC', paddingLeft: '17px' }}>• {f}</div>
              ))}
            </div>
          )
        }
        if (action.type === 'collateral_generating') {
          return (
            <div key={i} style={{
              padding: '8px 10px', borderRadius: '8px',
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <RefreshCw size={11} color="#F59E0B" style={{ animation: 'spin 1.5s linear infinite' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#F59E0B' }}>Generating {action.colType}</span>
                <span style={{ fontSize: '10px', color: '#FCD34D' }}>{action.title}</span>
              </div>
            </div>
          )
        }
        if (action.type === 'case_study_created') {
          return (
            <div key={i} style={{
              padding: '8px 10px', borderRadius: '8px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <BookOpen size={11} color="#10B981" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#10B981' }}>Case study created — {action.customerName}</span>
            </div>
          )
        }
        if (action.type === 'gaps_logged') {
          return (
            <div key={i} style={{
              padding: '8px 10px', borderRadius: '8px',
              background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
              display: 'flex', flexDirection: 'column', gap: '4px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={11} color="#FBBF24" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#FBBF24' }}>{action.count} product gap{action.count > 1 ? 's' : ''} logged</span>
              </div>
              {action.gaps.slice(0, 2).map((g, gi) => (
                <div key={gi} style={{ fontSize: '10px', color: '#FDE68A', paddingLeft: '17px' }}>• {g}</div>
              ))}
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

// ── Simple markdown renderer ───────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|_[^_]+_|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={i} style={{ color: '#F0EEFF', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
    }
    if ((part.startsWith('_') && part.endsWith('_') && part.length > 2) || (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**'))) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={i} style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontFamily: 'monospace', color: '#A5B4FC' }}>{part.slice(1, -1)}</code>
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      return <a key={i} href={linkMatch[2]} style={{ color: '#818CF8', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">{linkMatch[1]}</a>
    }
    return <span key={i}>{part}</span>
  })
}

function MarkdownLine({ text }: { text: string }) {
  return <>{renderInline(text)}</>
}

function MarkdownContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {blocks.map((block, bi) => {
        const trimmed = block.trim()
        if (!trimmed) return null
        if (trimmed.startsWith('### ')) return <p key={bi} style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#F0EEFF' }}><MarkdownLine text={trimmed.slice(4)} /></p>
        if (trimmed.startsWith('## ')) return <p key={bi} style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#F0EEFF' }}><MarkdownLine text={trimmed.slice(3)} /></p>
        if (trimmed.startsWith('# ')) return <p key={bi} style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#F0EEFF' }}><MarkdownLine text={trimmed.slice(2)} /></p>
        const lines = trimmed.split('\n')
        const isList = lines.some(l => /^[-•*+]\s/.test(l) || /^\d+\.\s/.test(l))
        if (isList) {
          return (
            <div key={bi} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {lines.map((line, li) => {
                const bulletMatch = line.match(/^[-•*+]\s(.+)/)
                const numMatch = line.match(/^\d+\.\s(.+)/)
                if (bulletMatch || numMatch) {
                  const text = bulletMatch ? bulletMatch[1] : numMatch![1]
                  return (
                    <div key={li} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{ color: '#6366F1', flexShrink: 0, marginTop: '1px', fontSize: '10px' }}>•</span>
                      <span style={{ fontSize: '12px', color: '#D1D5DB', lineHeight: '1.5' }}><MarkdownLine text={text} /></span>
                    </div>
                  )
                }
                if (line.trim()) return <p key={li} style={{ margin: 0, fontSize: '12px', color: '#D1D5DB', lineHeight: '1.6' }}><MarkdownLine text={line} /></p>
                return null
              })}
            </div>
          )
        }
        return (
          <p key={bi} style={{ margin: 0, fontSize: '12px', color: '#D1D5DB', lineHeight: '1.6' }}>
            {lines.map((line, li) => (
              <span key={li}><MarkdownLine text={line} />{li < lines.length - 1 && <br />}</span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AiChatSidebar() {
  const { aiCollapsed, toggleAiCollapsed, activeDeal } = useSidebar()
  const pathname = usePathname()
  const pageLabel = (() => {
    if (pathname.startsWith('/deals/') && pathname !== '/deals') return null // deal badge handles this
    if (pathname === '/dashboard') return 'Dashboard'
    if (pathname === '/pipeline') return 'Pipeline'
    if (pathname === '/deals') return 'All Deals'
    if (pathname === '/collateral') return 'Collateral'
    if (pathname === '/competitors') return 'Competitors'
    if (pathname === '/case-studies') return 'Case Studies'
    if (pathname === '/product-gaps') return 'Feature Gaps'
    if (pathname === '/company') return 'Company Profile'
    if (pathname === '/settings') return 'Settings'
    return null
  })()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-grow textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target
    setInput(el.value)
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [])

  const stop = () => {
    abortRef.current?.abort()
    setLoading(false)
  }

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    setLoading(true)
    abortRef.current = new AbortController()
    const timeoutId = setTimeout(() => abortRef.current?.abort(), 55000)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated, activeDealId: activeDeal?.id ?? null, currentPage: pageLabel }),
        signal: abortRef.current.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        actions: data.actions ?? [],
      }])
      // Revalidate SWR caches for any pages affected by the AI actions
      if (data.actions?.length) {
        invalidateCaches(data.actions)
      }
    } catch (e: unknown) {
      clearTimeout(timeoutId)
      if (e instanceof Error && e.name === 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Stopped.' }])
      } else {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + msg }])
      }
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const collapsedStrip = (
    <div style={{
      width: '48px', minWidth: '48px', height: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(10,8,18,0.97)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      paddingTop: '14px', gap: '10px',
    }}>
      <button onClick={toggleAiCollapsed} title="Expand AI assistant" style={{
        width: '32px', height: '32px', borderRadius: '8px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
        border: '1px solid rgba(99,102,241,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#818CF8', transition: 'all 150ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.3)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))' }}
      >
        <ChevronLeft size={14} />
      </button>
      <div style={{
        width: '28px', height: '28px', borderRadius: '8px',
        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Sparkles size={13} color="#818CF8" />
      </div>
      {messages.length > 0 && (
        <div style={{
          width: '20px', height: '20px', borderRadius: '50%',
          background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', color: '#818CF8', fontWeight: 700,
        }}>
          {messages.filter(m => m.role === 'assistant').length}
        </div>
      )}
    </div>
  )

  const expandedPanel = (
    <div style={{
      width: '340px', minWidth: '340px', height: '100vh',
      display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(10,8,18,0.98)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '9px',
        padding: '13px 14px 11px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px',
          background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 14px rgba(99,102,241,0.35)',
          flexShrink: 0,
        }}>
          <Sparkles size={14} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#F0EEFF', lineHeight: 1.2 }}>AI Assistant</div>
          {activeDeal ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
              <span style={{ fontSize: '10px', color: '#6EE7B7', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeDeal.company}
              </span>
              <span style={{ fontSize: '10px', color: '#333', flexShrink: 0 }}>· {activeDeal.stage.replace('_', ' ')}</span>
            </div>
          ) : pageLabel ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6366F1', flexShrink: 0 }} />
              <span style={{ fontSize: '10px', color: '#818CF8', fontWeight: 500 }}>{pageLabel}</span>
            </div>
          ) : (
            <div style={{ fontSize: '10px', color: '#444', marginTop: '1px' }}>Powered by Claude</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          {loading && (
            <button onClick={stop} title="Stop" style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              cursor: 'pointer', color: '#EF4444', padding: '3px 8px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 500,
              transition: 'background 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
            >
              <Square size={9} fill="#EF4444" /> Stop
            </button>
          )}
          {!loading && messages.length > 0 && (
            <button onClick={() => setMessages([])} title="New chat" style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
              cursor: 'pointer', color: '#666', padding: '5px 7px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', transition: 'all 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#EBEBEB'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)' }}
            >
              <RotateCcw size={12} />
            </button>
          )}
          <button onClick={toggleAiCollapsed} title="Collapse" style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
            cursor: 'pointer', color: '#888', padding: '5px 7px', borderRadius: '6px',
            display: 'flex', alignItems: 'center', transition: 'all 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#EBEBEB'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)' }}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Empty state */}
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
            {activeDeal ? (
              <>
                <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#4ADE80', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Deal context active</div>
                  <div style={{ fontSize: '12px', color: '#E5E7EB', fontWeight: 600 }}>{activeDeal.company}</div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>{activeDeal.name} · {activeDeal.stage.replace('_', ' ')}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {[
                    { icon: FileText, color: '#6366F1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.15)', title: 'Analyse notes', desc: 'Paste notes for this deal', prompt: `Analyse these meeting notes for ${activeDeal.company}:\n\n` },
                    { icon: Mail, color: '#06B6D4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.15)', title: 'Draft follow-up', desc: 'Address top risk with an email', prompt: `Draft a follow-up email for ${activeDeal.company} addressing the biggest risk in this deal.` },
                    { icon: Zap, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)', title: 'Generate collateral', desc: 'Email sequence, battlecard…', prompt: `Generate an email sequence for ${activeDeal.company} based on where we are in the deal.` },
                    { icon: BarChart2, color: '#22C55E', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.15)', title: 'Deal assessment', desc: 'What\'s the status & next step', prompt: `Give me a brief assessment of the ${activeDeal.company} deal — current status, top risk, and recommended next action.` },
                  ].map(cap => {
                    const Icon = cap.icon
                    return (
                      <button key={cap.title} onClick={() => { setInput(cap.prompt); inputRef.current?.focus() }}
                        style={{ padding: '9px 10px', borderRadius: '8px', textAlign: 'left', background: cap.bg, border: `1px solid ${cap.border}`, cursor: 'pointer', transition: 'opacity 150ms', display: 'flex', flexDirection: 'column', gap: '4px' }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                      >
                        <Icon size={13} color={cap.color} />
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#E5E7EB', lineHeight: 1.2 }}>{cap.title}</div>
                        <div style={{ fontSize: '10px', color: '#6B7280', lineHeight: 1.3 }}>{cap.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: '11px', color: '#444', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
                  Paste notes, ask about your pipeline,<br />or generate collateral.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {CAPABILITIES.map(cap => {
                    const Icon = cap.icon
                    return (
                      <button key={cap.title} onClick={() => { setInput(cap.prompt); inputRef.current?.focus() }}
                        style={{ padding: '9px 10px', borderRadius: '8px', textAlign: 'left', background: cap.bg, border: `1px solid ${cap.border}`, cursor: 'pointer', transition: 'opacity 150ms', display: 'flex', flexDirection: 'column', gap: '4px' }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                      >
                        <Icon size={13} color={cap.color} />
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#E5E7EB', lineHeight: 1.2 }}>{cap.title}</div>
                        <div style={{ fontSize: '10px', color: '#6B7280', lineHeight: 1.3 }}>{cap.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', gap: '8px', alignItems: 'flex-start',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
          }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #4F46E5, #7C3AED)'
                : 'rgba(99,102,241,0.12)',
              border: msg.role === 'assistant' ? '1px solid rgba(99,102,241,0.2)' : 'none',
              boxShadow: msg.role === 'user' ? '0 0 8px rgba(99,102,241,0.3)' : 'none',
            }}>
              {msg.role === 'user'
                ? <User size={11} color="#fff" />
                : <Bot size={11} color="#818CF8" />}
            </div>
            <div style={{ maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: '0' }}>
              <div style={{
                padding: '8px 11px',
                borderRadius: msg.role === 'user' ? '12px 3px 12px 12px' : '3px 12px 12px 12px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, rgba(79,70,229,0.22), rgba(124,58,237,0.22))'
                  : 'rgba(255,255,255,0.04)',
                border: msg.role === 'user'
                  ? '1px solid rgba(99,102,241,0.3)'
                  : '1px solid rgba(255,255,255,0.07)',
              }}>
                {msg.role === 'assistant'
                  ? <MarkdownContent content={msg.content} />
                  : <p style={{ margin: 0, fontSize: '12px', color: '#D1D5DB', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                }
              </div>
              {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                <ActionCards actions={msg.actions} />
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
            }}>
              <Bot size={11} color="#818CF8" />
            </div>
            <div style={{
              padding: '10px 12px', borderRadius: '3px 12px 12px 12px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ flexShrink: 0, padding: '10px 12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{
          display: 'flex', gap: '8px', alignItems: 'flex-end',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '12px', padding: '9px 10px',
          transition: 'border-color 150ms ease',
        }}
        onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.45)'}
        onBlurCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.09)'}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKey}
            placeholder={activeDeal ? `Ask about ${activeDeal.company}, paste notes…` : 'Ask anything or paste meeting notes…'}
            rows={1}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#E5E7EB', fontSize: '12px', lineHeight: '1.55',
              resize: 'none', fontFamily: 'inherit',
              minHeight: '20px', maxHeight: '120px', overflowY: 'auto',
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            style={{
              width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
              background: input.trim() && !loading
                ? 'linear-gradient(135deg, #4F46E5, #7C3AED)'
                : 'rgba(255,255,255,0.06)',
              boxShadow: input.trim() && !loading ? '0 0 12px rgba(99,102,241,0.45)' : 'none',
              border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <Send size={12} color={input.trim() && !loading ? '#fff' : '#333'} />
          </button>
        </div>
        <p style={{ margin: '5px 0 0', fontSize: '10px', color: '#333', textAlign: 'center' }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )

  return (
    <>
      <div className="ai-sidebar-desktop" style={{
        position: 'fixed', right: 0, top: 0, zIndex: 40,
        width: aiCollapsed ? '48px' : '340px',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
      }}>
        {aiCollapsed ? collapsedStrip : expandedPanel}
      </div>
      <div className="ai-sidebar-mobile">
        {!mobileOpen && (
          <button onClick={() => setMobileOpen(true)} style={{
            position: 'fixed', bottom: '20px', right: '20px', zIndex: 50,
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            boxShadow: '0 0 24px rgba(99,102,241,0.5)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageSquare size={20} color="#fff" />
          </button>
        )}
        {mobileOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={() => setMobileOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
            <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '340px' }}>{expandedPanel}</div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @media (min-width: 901px) { .ai-sidebar-mobile { display: none !important; } }
        @media (max-width: 900px) { .ai-sidebar-desktop { display: none !important; } }
      `}</style>
    </>
  )
}
