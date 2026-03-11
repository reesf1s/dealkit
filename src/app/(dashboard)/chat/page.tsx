'use client'
export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, Sparkles, Loader2, User, Bot, RotateCcw } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED = [
  '📋 Paste meeting notes here → I\'ll extract todos, blockers & opportunities',
  '⚔️ Create battlecards for [Competitor1, Competitor2, Competitor3]',
  '🎯 What deals are most likely to close this month?',
  '🔍 What product gaps are costing us the most revenue?',
  '🏆 How do we compare against our top competitor?',
  '📊 Summarize our win rate and key reasons for losses',
]

export default function ChatPage() {
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
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${e.message}` }])
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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px - 64px)', gap: '0', maxWidth: '760px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.03em', color: '#F0EEFF', marginBottom: '4px' }}>
            Ask AI
          </h1>
          <p style={{ fontSize: '13px', color: '#555' }}>
            Paste meeting notes · create battlecards · analyze deals · find product gaps
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#555', fontSize: '12px', cursor: 'pointer' }}
          >
            <RotateCcw size={12} /> New chat
          </button>
        )}
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '8px' }}>

        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px', gap: '24px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
              border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 40px rgba(99,102,241,0.2)',
            }}>
              <Sparkles size={28} color="#818CF8" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '17px', fontWeight: '700', color: '#F0EEFF', marginBottom: '6px' }}>Your AI deal conversion assistant</div>
              <div style={{ fontSize: '13px', color: '#555', lineHeight: '1.6' }}>Paste meeting notes, create battlecards, or ask anything about your deals &amp; competitors.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%' }}>
              {SUGGESTED.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  textAlign: 'left', padding: '12px 14px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '10px', color: '#9CA3AF', fontSize: '12px', lineHeight: '1.5',
                  cursor: 'pointer', transition: 'all 0.1s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.3)'
                  ;(e.currentTarget as HTMLElement).style.color = '#F0EEFF'
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.06)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'
                  ;(e.currentTarget as HTMLElement).style.color = '#9CA3AF'
                  ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'
                }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                : 'rgba(99,102,241,0.12)',
              border: msg.role === 'assistant' ? '1px solid rgba(99,102,241,0.2)' : 'none',
              boxShadow: msg.role === 'user' ? '0 0 10px rgba(99,102,241,0.3)' : 'none',
            }}>
              {msg.role === 'user'
                ? <User size={13} color="#fff" />
                : <Bot size={13} color="#818CF8" />
              }
            </div>
            <div style={{
              maxWidth: '80%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(124,58,237,0.25))'
                : 'rgba(255,255,255,0.04)',
              border: msg.role === 'user'
                ? '1px solid rgba(99,102,241,0.3)'
                : '1px solid rgba(255,255,255,0.07)',
              fontSize: '13px', color: '#E5E7EB', lineHeight: '1.7',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
            }}>
              <Bot size={13} color="#818CF8" />
            </div>
            <div style={{
              padding: '12px 16px', borderRadius: '4px 14px 14px 14px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <Loader2 size={14} color="#818CF8" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '13px', color: '#555' }}>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{
          display: 'flex', gap: '10px', alignItems: 'flex-end',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '10px 12px',
          transition: 'border-color 0.15s',
        }}
        onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)'}
        onBlurCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your competitors, deals, objections... (Enter to send)"
            rows={1}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#E5E7EB', fontSize: '13px', lineHeight: '1.6',
              resize: 'none', fontFamily: 'inherit',
              maxHeight: '120px', overflowY: 'auto',
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            style={{
              width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
              background: input.trim() && !loading ? 'linear-gradient(135deg, #6366F1, #7C3AED)' : 'rgba(255,255,255,0.06)',
              boxShadow: input.trim() && !loading ? '0 0 12px rgba(99,102,241,0.4)' : 'none',
              border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <Send size={13} color={input.trim() && !loading ? '#fff' : '#333'} />
          </button>
        </div>
        <div style={{ fontSize: '11px', color: '#333', textAlign: 'center', marginTop: '6px' }}>
          Powered by Claude · Knowledge base updates automatically as you add data
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
