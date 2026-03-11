'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Loader2, User, Bot, RotateCcw, X } from 'lucide-react'

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
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${msg}` }])
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

  return (
    <div style={{
      width: '280px',
      minWidth: '280px',
      height: '100vh',
      position: 'fixed',
      right: 0,
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(10,8,18,0.95)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      zIndex: 40,
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
        {messages.length > 0 && (
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
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px' }}>
            <p style={{ fontSize: '11px', color: '#444', margin: '0 0 4px', textAlign: 'center' }}>
              Ask about your deals, competitors, or objections
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
            placeholder="Ask anything… (Enter to send)"
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

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
