'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Send, Sparkles, Square,
  FileText, Sword, Building2, Zap, CheckCircle2,
  PlusCircle, RefreshCw, BookOpen, AlertTriangle,
  BarChart2, Mail, ChevronDown, ChevronUp, X,
} from 'lucide-react'
import { mutate as globalMutate } from 'swr'
import { useSidebar } from './SidebarContext'
import type { ActionCard } from '@/app/api/chat/route'

function invalidateCaches(actions: ActionCard[]) {
  setTimeout(() => globalMutate('/api/brain'), 2000)
  for (const action of actions) {
    if (action.type === 'todos_updated' || action.type === 'deal_updated' || action.type === 'deal_created') {
      globalMutate('/api/deals')
      globalMutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/deals/'), undefined, { revalidate: true })
    }
    if (action.type === 'competitor_created') {
      globalMutate('/api/competitors')
    }
    if (action.type === 'company_updated') {
      globalMutate('/api/company')
      globalMutate('/api/company-profile')
    }
    if (action.type === 'collateral_generating') {
      globalMutate('/api/collateral')
    }
    if (action.type === 'case_study_created') {
      globalMutate('/api/case-studies')
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

const QUICK_PROMPTS = [
  { icon: BarChart2, color: '#22C55E', label: "What's my pipeline?", prompt: "What's my pipeline looking like? Give me a full overview." },
  { icon: FileText, color: '#6366F1', label: 'Paste meeting notes', prompt: 'Here are my meeting notes from today:\n\n' },
  { icon: Sword, color: '#EC4899', label: 'Competitor battlecard', prompt: 'Create a battlecard for competitor: ' },
  { icon: Mail, color: '#06B6D4', label: 'Risk follow-up emails', prompt: 'For my top 3 open deals, identify the biggest risk per deal and draft a short personalised follow-up email with subject line addressing it directly.' },
  { icon: Zap, color: '#F59E0B', label: 'Generate collateral', prompt: 'Generate a ' },
  { icon: BookOpen, color: '#A855F7', label: 'Focus today', prompt: 'What should I focus on today across my pipeline? Give me the top 3 actions.' },
]

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: '5px', height: '5px', borderRadius: '50%', background: '#6366F1',
          animation: `typingBounce 1.2s ease-in-out ${i * 0.16}s infinite`,
        }} />
      ))}
    </div>
  )
}

function ActionCards({ actions }: { actions: ActionCard[] }) {
  if (!actions.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '6px' }}>
      {actions.map((action, i) => {
        const base: React.CSSProperties = { padding: '7px 10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }
        if (action.type === 'todos_updated') return (
          <div key={i} style={{ ...base, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={11} color="#10B981" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#10B981' }}>Todos updated — {action.dealName}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const, paddingLeft: '17px' }}>
              {action.added > 0 && <span style={{ fontSize: '10px', color: '#6EE7B7' }}>+{action.added} added</span>}
              {action.completed > 0 && <span style={{ fontSize: '10px', color: '#6EE7B7' }}>✓ {action.completed} done</span>}
              {action.removed > 0 && <span style={{ fontSize: '10px', color: '#6EE7B7' }}>✕ {action.removed} removed</span>}
            </div>
          </div>
        )
        if (action.type === 'deal_updated') return (
          <div key={i} style={{ ...base, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={11} color="#10B981" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#10B981' }}>Updated — {action.dealName}</span>
            </div>
            {action.changes.slice(0, 3).map((c, ci) => (
              <div key={ci} style={{ fontSize: '10px', color: '#6EE7B7', paddingLeft: '17px' }}>• {c}</div>
            ))}
          </div>
        )
        if (action.type === 'deal_created') return (
          <div key={i} style={{ ...base, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', flexDirection: 'row', alignItems: 'center' }}>
            <PlusCircle size={11} color="#10B981" />
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#10B981', marginLeft: '6px' }}>Deal created — {action.dealName}</span>
          </div>
        )
        if (action.type === 'competitor_created') return (
          <div key={i} style={{ ...base, background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sword size={11} color="#EC4899" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#EC4899' }}>{action.names.join(', ')} added</span>
            </div>
            {action.battlecardsStarted && <div style={{ fontSize: '10px', color: '#F9A8D4', paddingLeft: '17px' }}>↳ Battlecard started</div>}
          </div>
        )
        if (action.type === 'company_updated') return (
          <div key={i} style={{ ...base, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={11} color="#818CF8" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#818CF8' }}>Company profile updated</span>
            </div>
            {action.fields.slice(0, 3).map((f, fi) => (
              <div key={fi} style={{ fontSize: '10px', color: '#A5B4FC', paddingLeft: '17px' }}>• {f}</div>
            ))}
          </div>
        )
        if (action.type === 'collateral_generating') return (
          <div key={i} style={{ ...base, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={11} color="#F59E0B" style={{ animation: 'spin 1.5s linear infinite', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#F59E0B' }}>Generating {action.colType}</div>
              <div style={{ fontSize: '10px', color: '#FCD34D' }}>{action.title}</div>
            </div>
          </div>
        )
        if (action.type === 'case_study_created') return (
          <div key={i} style={{ ...base, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={11} color="#22C55E" />
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#22C55E' }}>Case study saved — {action.customerName}</span>
          </div>
        )
        if (action.type === 'gaps_logged') return (
          <div key={i} style={{ ...base, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={11} color="#EF4444" />
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#EF4444' }}>{action.count} gap{action.count !== 1 ? 's' : ''} logged</span>
          </div>
        )
        return null
      })}
    </div>
  )
}

// Simple markdown renderer
function MsgContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div style={{ fontSize: '13px', color: '#D1D5DB', lineHeight: '1.65', wordBreak: 'break-word' }}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <div key={i} style={{ fontSize: '12px', fontWeight: 700, color: '#EBEBEB', marginTop: i > 0 ? '10px' : 0, marginBottom: '4px' }}>{line.slice(4)}</div>
        if (line.startsWith('## ')) return <div key={i} style={{ fontSize: '13px', fontWeight: 700, color: '#EBEBEB', marginTop: i > 0 ? '12px' : 0, marginBottom: '4px' }}>{line.slice(3)}</div>
        if (line.startsWith('# ')) return <div key={i} style={{ fontSize: '14px', fontWeight: 700, color: '#F1F1F3', marginTop: i > 0 ? '14px' : 0, marginBottom: '6px' }}>{line.slice(2)}</div>
        if (line.startsWith('- ') || line.startsWith('• ')) {
          const text = line.slice(2)
          return <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '2px' }}><span style={{ color: '#6366F1', flexShrink: 0, marginTop: '1px' }}>·</span><span>{renderInline(text)}</span></div>
        }
        if (/^\d+\.\s/.test(line)) {
          const num = line.match(/^(\d+)\.\s/)?.[1]
          const text = line.replace(/^\d+\.\s/, '')
          return <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '2px' }}><span style={{ color: '#6366F1', flexShrink: 0, fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>{num}.</span><span>{renderInline(text)}</span></div>
        }
        if (line.trim() === '') return <div key={i} style={{ height: '6px' }} />
        return <div key={i} style={{ marginBottom: '2px' }}>{renderInline(line)}</div>
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  // Use a single capture group (no nested groups) so split never produces undefined entries
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/)
  return parts.map((part, i) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ color: '#EBEBEB', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} style={{ background: 'rgba(99,102,241,0.15)', padding: '1px 5px', borderRadius: '3px', fontSize: '12px', color: '#A5B4FC' }}>{part.slice(1, -1)}</code>
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) return <Link key={i} href={linkMatch[2]} style={{ color: '#818CF8', textDecoration: 'underline' }}>{linkMatch[1]}</Link>
    return part
  })
}

export default function AiChatBar() {
  const pathname = usePathname()
  const { sidebarWidth, aiCollapsed, toggleAiCollapsed, activeDeal } = useSidebar()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isExpanded = !aiCollapsed

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (isExpanded) scrollToBottom()
  }, [messages, streamingText, isExpanded, scrollToBottom])

  // Auto-expand when user focuses the input
  const handleInputFocus = () => {
    if (aiCollapsed) toggleAiCollapsed()
  }

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || loading) return
    if (!overrideText) setInput('')

    // Expand if collapsed
    if (aiCollapsed) toggleAiCollapsed()

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)
    setStreaming(false)
    setStreamingText('')

    const currentPage = pathname || '/'

    try {
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, activeDealId: activeDeal?.id ?? null, currentPage }),
        signal: ctrl.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${(err as { error?: string }).error ?? res.statusText}` }])
        return
      }

      const ct = res.headers.get('content-type') ?? ''
      if (ct.includes('text/event-stream')) {
        // Streaming response
        setStreaming(true)
        const reader = res.body!.getReader()
        const dec = new TextDecoder()
        let accumulated = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = dec.decode(value)
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue
            try {
              const parsed = JSON.parse(line.slice(6))
              if (parsed.t) { accumulated += parsed.t; setStreamingText(accumulated) }
              if (parsed.done) break
            } catch { /* skip */ }
          }
        }
        setMessages(prev => [...prev, { role: 'assistant', content: accumulated }])
        setStreamingText('')
        setStreaming(false)
      } else {
        // JSON response with action cards
        const data = await res.json()
        const assistantMsg: Message = { role: 'assistant', content: data.reply ?? '', actions: data.actions ?? [] }
        setMessages(prev => [...prev, assistantMsg])
        if (data.actions?.length) invalidateCaches(data.actions)
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
      }
    } finally {
      setLoading(false)
      setStreaming(false)
      abortRef.current = null
    }
  }, [input, messages, loading, activeDeal, pathname, aiCollapsed, toggleAiCollapsed])

  const stopStreaming = () => {
    abortRef.current?.abort()
    setLoading(false)
    setStreaming(false)
    if (streamingText) {
      setMessages(prev => [...prev, { role: 'assistant', content: streamingText }])
      setStreamingText('')
    }
  }

  const clearChat = () => {
    setMessages([])
    setInput('')
    setStreamingText('')
  }

  const EXPANDED_HEIGHT = 460
  const COLLAPSED_HEIGHT = 56

  const barHeight = isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT

  return (
    <>
      <style>{`
        @keyframes typingBounce { 0%,60%,100% { transform: translateY(0) } 30% { transform: translateY(-5px) } }
        @keyframes spin { to { transform: rotate(360deg) } }
        .ai-bar-messages::-webkit-scrollbar { width: 3px }
        .ai-bar-messages::-webkit-scrollbar-track { background: transparent }
        .ai-bar-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px }
        .ai-msg-user { background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.22); }
        .ai-msg-assistant { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
        .ai-quick-chip:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.15) !important; color: #E5E7EB !important; }
      `}</style>

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: `${sidebarWidth}px`,
        right: 0,
        height: `${barHeight}px`,
        transition: 'height 0.28s cubic-bezier(0.4,0,0.2,1), left 0.22s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        /* Apple glass */
        background: 'rgba(10, 8, 20, 0.78)',
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        borderTop: '1px solid rgba(255,255,255,0.09)',
        boxShadow: isExpanded
          ? '0 -1px 0 rgba(255,255,255,0.04) inset, 0 -20px 60px rgba(0,0,0,0.55), 0 -1px 12px rgba(99,102,241,0.12)'
          : '0 -1px 0 rgba(255,255,255,0.04) inset, 0 -8px 24px rgba(0,0,0,0.35)',
      }}>

        {/* ── Header bar — always visible ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '0 14px',
          height: `${COLLAPSED_HEIGHT}px`,
          flexShrink: 0,
          borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}>
          {/* Glass icon pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: 'linear-gradient(145deg, rgba(120,110,255,0.22), rgba(100,80,220,0.14))',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 1px 6px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={12} color="#A5B4FC" />
            </div>
            {isExpanded && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(200,196,255,0.85)', letterSpacing: '0.01em' }}>
                DealKit AI
              </span>
            )}
          </div>

          {/* Active deal badge */}
          {activeDeal && isExpanded && (
            <div style={{
              fontSize: '10px', color: '#A5B4FC',
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: '100px', padding: '2px 8px', flexShrink: 0,
              backdropFilter: 'blur(8px)',
            }}>
              {activeDeal.company}
            </div>
          )}

          {/* Input */}
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={e => { handleInputFocus(); (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(130,120,255,0.45)'; (e.target as HTMLTextAreaElement).style.background = 'rgba(255,255,255,0.06)' }}
              onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.target as HTMLTextAreaElement).style.background = 'rgba(255,255,255,0.03)' }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              }}
              placeholder={activeDeal ? `Ask about ${activeDeal.company}…` : 'Ask anything… (Enter to send)'}
              rows={1}
              style={{
                width: '100%', resize: 'none',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '10px',
                color: '#E5E7EB', fontSize: '13px', lineHeight: '1.5',
                padding: '7px 12px', outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box', maxHeight: '80px', overflowY: 'auto',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            />
          </div>

          {/* Send / Stop */}
          {(loading || streaming) ? (
            <button onClick={stopStreaming} style={{
              width: '32px', height: '32px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '9px', cursor: 'pointer',
            }}>
              <Square size={11} color="#F87171" fill="#F87171" />
            </button>
          ) : (
            <button onClick={() => sendMessage()} disabled={!input.trim()} style={{
              width: '32px', height: '32px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: input.trim()
                ? 'linear-gradient(145deg, rgba(120,110,255,0.9), rgba(100,60,220,0.85))'
                : 'rgba(255,255,255,0.04)',
              border: input.trim() ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '9px', cursor: input.trim() ? 'pointer' : 'default',
              boxShadow: input.trim() ? '0 2px 12px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.18)' : 'none',
              transition: 'all 180ms cubic-bezier(0.4,0,0.2,1)',
            }}>
              <Send size={12} color={input.trim() ? '#fff' : '#444'} />
            </button>
          )}

          {/* Expand/collapse toggle */}
          <button
            onClick={toggleAiCollapsed}
            style={{
              width: '28px', height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '8px', cursor: 'pointer', color: '#4B5563', transition: 'all 140ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(130,120,255,0.3)'; e.currentTarget.style.color = '#A5B4FC'; e.currentTarget.style.background = 'rgba(99,102,241,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#4B5563'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
            title={isExpanded ? 'Collapse' : 'Expand chat'}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>

          {/* Clear */}
          {isExpanded && messages.length > 0 && (
            <button onClick={clearChat} style={{
              width: '24px', height: '24px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer', color: '#374151', transition: 'color 140ms',
            }}
              title="Clear conversation"
              onMouseEnter={e => (e.currentTarget.style.color = '#F87171')}
              onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* ── Conversation area — only visible when expanded ── */}
        {isExpanded && (
          <div
            className="ai-bar-messages"
            style={{
              flex: 1, overflowY: 'auto', padding: '10px 14px 4px',
              display: 'flex', flexDirection: 'column', gap: '8px',
            }}
          >
            {messages.length === 0 && !streaming && (
              <div style={{ paddingTop: '2px' }}>
                <div style={{ fontSize: '11px', color: '#4B5563', marginBottom: '8px', textAlign: 'center', letterSpacing: '0.01em' }}>
                  Ask anything or pick a quick action
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center' }}>
                  {QUICK_PROMPTS.map(qp => (
                    <button
                      key={qp.label}
                      className="ai-quick-chip"
                      onClick={() => {
                        setInput(qp.prompt)
                        inputRef.current?.focus()
                        if (qp.prompt.endsWith('\n\n') || qp.prompt.endsWith(': ') || qp.prompt.endsWith('a ')) return
                        sendMessage(qp.prompt)
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '4px 9px', borderRadius: '100px', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#6B7280', fontSize: '11px', fontWeight: 500,
                        transition: 'all 140ms',
                      }}
                    >
                      <qp.icon size={9} color="currentColor" />
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI avatar shared style */}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: '20px', height: '20px', flexShrink: 0, marginTop: '2px',
                    background: 'linear-gradient(145deg, rgba(120,110,255,0.2), rgba(100,80,220,0.12))',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Sparkles size={10} color="#A5B4FC" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={msg.role === 'user' ? 'ai-msg-user' : 'ai-msg-assistant'} style={{
                    borderRadius: '10px', padding: '7px 11px',
                    ...(msg.role === 'user' ? { marginLeft: '20px' } : {}),
                  }}>
                    {msg.role === 'user'
                      ? <p style={{ fontSize: '13px', color: '#C7D2FE', margin: 0, lineHeight: 1.55 }}>{msg.content}</p>
                      : <MsgContent content={msg.content} />
                    }
                  </div>
                  {msg.actions && msg.actions.length > 0 && <ActionCards actions={msg.actions} />}
                </div>
              </div>
            ))}

            {/* Streaming in progress */}
            {(loading || streaming) && (
              <div style={{ display: 'flex', gap: '7px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '20px', height: '20px', flexShrink: 0, marginTop: '2px',
                  background: 'linear-gradient(145deg, rgba(120,110,255,0.2), rgba(100,80,220,0.12))',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles size={10} color="#A5B4FC" />
                </div>
                <div className="ai-msg-assistant" style={{ flex: 1, borderRadius: '10px', padding: '7px 11px' }}>
                  {streamingText ? <MsgContent content={streamingText} /> : <TypingDots />}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </>
  )
}
