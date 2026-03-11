'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Loader2, User, Bot, RotateCcw, X, Square, MessageSquare } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED = [
  'How do we compare vs our top competitor?',
  'What objections should I expect?',
  'Which deals need attention?',
  'What product gaps are hurting us?',
]

export default function AiChatSidebar() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false) // mobile toggle
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

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
    setLoading(true)
    abortRef.current = new AbortController()
    const timeoutId = setTimeout(() => abortRef.current?.abort(), 45000) // 45s timeout
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
        signal: abortRef.current.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (e: unknown) {
      clearTimeout(timeoutId)
      if (e instanceof Error && e.name === 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Stopped.' }])
      } else {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${msg}` }])
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

  const sidebarContent = (
    <div style={{
      width: '280px',
      minWidth: '280px',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(10,8,18,0.97)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '14px 14px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
        height: '56px',
      }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '8px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.25))',
          border: '1px solid rgba(99,102,241,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px rgba(99,102,241,0.2)',
        }}>
          <Sparkles size={13} color="#818CF8" />
        </div>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#F0EEFF', flex: 1 }}>Ask AI</span>
        {loading && (
          <button
            onClick={stop}
            title="Stop"
            style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              cursor: 'pointer', color: '#EF4444', padding: '3px 7px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px',
            }}
          >
            <Square size={10} /> Stop
          </button>
        )}
        {!loading && messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            title="New chat"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#555', padding: '4px', borderRadius: '6px',
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#888')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}
          >
            <RotateCcw size={13} />
          </button>
        )}
        {/* Mobile close */}
        <button
          onClick={() => setOpen(false)}
          className="ai-sidebar-close"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#555', padding: '4px', borderRadius: '6px',
            display: 'none', alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px' }}>
            <p style={{ fontSize: '11px', color: '#444', margin: '0 0 4px', textAlign: 'center' }}>
              Ask about your deals, paste meeting notes to auto-update records
            </p>
            {SUGGESTED.map(s => (
              <button key={s} onClick={() => send(s)} style={{
                textAlign: 'left', padding: '8px 10px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '8px', color: '#666', fontSize: '11px', lineHeight: '1.4',
                cursor: 'pointer', transition: 'all 0.1s', width: '100%',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.3)'
                ;(e.currentTarget as HTMLElement).style.color = '#C4C4E0'
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.06)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'
                ;(e.currentTarget as HTMLElement).style.color = '#666'
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'
              }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', gap: '8px', alignItems: 'flex-start',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
          }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                : 'rgba(99,102,241,0.12)',
              border: msg.role === 'assistant' ? '1px solid rgba(99,102,241,0.2)' : 'none',
            }}>
              {msg.role === 'user' ? <User size={10} color="#fff" /> : <Bot size={10} color="#818CF8" />}
            </div>
            <div style={{
              maxWidth: '85%', padding: '8px 10px',
              borderRadius: msg.role === 'user' ? '10px 3px 10px 10px' : '3px 10px 10px 10px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(124,58,237,0.2))'
                : 'rgba(255,255,255,0.04)',
              border: msg.role === 'user'
                ? '1px solid rgba(99,102,241,0.25)'
                : '1px solid rgba(255,255,255,0.06)',
              fontSize: '12px', color: '#D1D5DB', lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
            }}>
              <Bot size={10} color="#818CF8" />
            </div>
            <div style={{
              padding: '8px 10px', borderRadius: '3px 10px 10px 10px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <Loader2 size={11} color="#818CF8" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '11px', color: '#555' }}>Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        flexShrink: 0, padding: '10px 12px 12px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          display: 'flex', gap: '8px', alignItems: 'flex-end',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px', padding: '8px 10px',
        }}
        onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)'}
        onBlurCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything or paste meeting notes…"
            rows={1}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#E5E7EB', fontSize: '12px', lineHeight: '1.5',
              resize: 'none', fontFamily: 'inherit',
              maxHeight: '80px', overflowY: 'auto',
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            style={{
              width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
              background: input.trim() && !loading ? 'linear-gradient(135deg, #6366F1, #7C3AED)' : 'rgba(255,255,255,0.06)',
              boxShadow: input.trim() && !loading ? '0 0 10px rgba(99,102,241,0.4)' : 'none',
              border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <Send size={11} color={input.trim() && !loading ? '#fff' : '#333'} />
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @media (max-width: 900px) { .ai-sidebar-close { display: flex !important; } }`}</style>
    </div>
  )

  return (
    <>
      {/* Desktop: fixed right sidebar */}
      <div className="ai-sidebar-desktop" style={{
        position: 'fixed', right: 0, top: 0, zIndex: 40,
      }}>
        {sidebarContent}
      </div>

      {/* Mobile: floating button + slide-in panel */}
      <div className="ai-sidebar-mobile">
        {/* Floating button */}
        {!open && (
          <button
            onClick={() => setOpen(true)}
            style={{
              position: 'fixed', bottom: '20px', right: '20px', zIndex: 50,
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
              boxShadow: '0 0 24px rgba(99,102,241,0.5)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MessageSquare size={20} color="#fff" />
          </button>
        )}

        {/* Slide-in panel */}
        {open && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', justifyContent: 'flex-end',
          }}>
            {/* Backdrop */}
            <div
              onClick={() => setOpen(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
            />
            <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '320px' }}>
              {sidebarContent}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 901px) { .ai-sidebar-mobile { display: none !important; } }
        @media (max-width: 900px) { .ai-sidebar-desktop { display: none !important; } }
      `}</style>
    </>
  )
}
