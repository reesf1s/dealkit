'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useChat, type Message } from 'ai/react'
import { Sparkles, X, Maximize2, Minimize2, Send, Square } from 'lucide-react'
import { useSidebar } from '@/components/layout/SidebarContext'
import MarkdownRenderer from './MarkdownRenderer'
import ToolCallCard from './ToolCallCard'

// ── Quick action chips — context-aware ──────────────────────────────────────
interface QuickAction {
  label: string
  prompt: string
  partial?: boolean
}

function getQuickActions(activeDealCompany?: string, currentPage?: string): QuickAction[] {
  if (activeDealCompany) {
    return [
      { label: 'Summarize this deal', prompt: `Give me a complete briefing on the ${activeDealCompany} deal — score, contacts, risks, todos, and what to do next.` },
      { label: 'Draft follow-up email', prompt: `Draft a follow-up email for ${activeDealCompany} addressing the biggest risk in this deal.` },
      { label: 'Review todos', prompt: `Review and clean up the todos for ${activeDealCompany}. Remove anything stale.` },
      { label: 'Generate one-pager', prompt: `Generate a one-pager for ${activeDealCompany}`, partial: true },
    ]
  }
  if (currentPage?.includes('/pipeline') || currentPage === '/') {
    return [
      { label: 'Pipeline health check', prompt: "What's my pipeline looking like? Give me a full overview with what to focus on." },
      { label: 'What needs attention?', prompt: 'Which deals need attention right now? Flag anything at risk or stale.' },
      { label: 'Forecast this quarter', prompt: 'Give me a forecast for this quarter based on current pipeline stages and win probabilities.' },
    ]
  }
  return [
    { label: 'Process deal update', prompt: 'Here are my latest notes:\n\n', partial: true },
    { label: 'Add competitor', prompt: 'Add a new competitor: ', partial: true },
    { label: 'Create deal', prompt: 'Create a new deal for ', partial: true },
  ]
}

// ── Stage badge color map ───────────────────────────────────────────────────
function stageBadgeColor(stage: string): { bg: string; text: string; border: string } {
  const s = stage.toLowerCase()
  if (s.includes('close') || s.includes('won')) return { bg: 'rgba(16,185,129,0.12)', text: '#6EE7B7', border: 'rgba(16,185,129,0.25)' }
  if (s.includes('negot')) return { bg: 'rgba(245,158,11,0.12)', text: '#FCD34D', border: 'rgba(245,158,11,0.25)' }
  if (s.includes('lost') || s.includes('churn')) return { bg: 'rgba(239,68,68,0.12)', text: '#FCA5A5', border: 'rgba(239,68,68,0.25)' }
  return { bg: 'rgba(99,102,241,0.12)', text: '#A5B4FC', border: 'rgba(99,102,241,0.25)' }
}

// ── Typing dots ─────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '6px 2px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'rgba(165,180,252,0.5)',
          animation: `copilotTypingBounce 1.2s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  )
}

// ── Main CopilotPanel ───────────────────────────────────────────────────────
export default function CopilotPanel() {
  const pathname = usePathname()
  const { copilotOpen, toggleCopilot, setCopilotOpen, activeDeal } = useSidebar()

  const [chatError, setChatError] = useState<string | null>(null)

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
    setMessages,
    stop,
    error,
  } = useChat({
    api: '/api/agent',
    body: { activeDealId: activeDeal?.id ?? null, currentPage: pathname },
    onError: (err) => {
      console.error('[CopilotPanel] Chat error:', err)
      setChatError(err.message || 'Something went wrong. Please try again.')
    },
    onResponse: () => {
      setChatError(null)
    },
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const isWide = useRef(false)
  const [panelWidth, setPanelWidth] = useState(420)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (copilotOpen) scrollToBottom()
  }, [messages, copilotOpen, scrollToBottom])

  // Focus input when panel opens
  useEffect(() => {
    if (copilotOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [copilotOpen])

  // Cmd+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggleCopilot()
      }
      if (e.key === 'Escape' && copilotOpen) {
        setCopilotOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleCopilot, copilotOpen, setCopilotOpen])

  const toggleWidth = () => {
    isWide.current = !isWide.current
    setPanelWidth(isWide.current ? 640 : 420)
  }

  const clearChat = () => {
    setMessages([])
    setInput('')
  }

  const quickActions = getQuickActions(activeDeal?.company, pathname || '/')

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    handleSubmit(e)
  }

  const handleQuickAction = (action: QuickAction) => {
    if (action.partial) {
      setInput(action.prompt)
      inputRef.current?.focus()
    } else {
      setInput(action.prompt)
      // Submit on next tick so the input is set
      setTimeout(() => {
        const form = inputRef.current?.closest('form')
        if (form) form.requestSubmit()
      }, 0)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const form = inputRef.current?.closest('form')
      if (form && input.trim()) form.requestSubmit()
    }
  }

  // Check if a message has tool invocations
  const hasToolCalls = (msg: Message) => {
    return (msg as any).toolInvocations && (msg as any).toolInvocations.length > 0
  }

  const getToolInvocations = (msg: Message) => {
    return (msg as any).toolInvocations ?? []
  }

  return (
    <>
      <style>{`
        @keyframes copilotTypingBounce { 0%,60%,100% { transform: translateY(0) } 30% { transform: translateY(-6px) } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes copilotFadeIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes copilotSlideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes copilotPulse {
          0%, 100% { box-shadow: 0 2px 16px rgba(99,102,241,0.2), 0 0 0 0 rgba(99,102,241,0.1); }
          50% { box-shadow: 0 2px 16px rgba(99,102,241,0.3), 0 0 0 6px rgba(99,102,241,0); }
        }
        .copilot-messages::-webkit-scrollbar { width: 3px; }
        .copilot-messages::-webkit-scrollbar-track { background: transparent; }
        .copilot-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        .copilot-msg-row { animation: copilotFadeIn 0.18s ease-out; }
      `}</style>

      {/* ── Floating trigger pill (when closed) ── */}
      {!copilotOpen && (
        <button
          onClick={toggleCopilot}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            background: 'linear-gradient(145deg, rgba(99,102,241,0.9), rgba(124,58,237,0.85))',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '100px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
            animation: 'copilotPulse 3s ease-in-out infinite',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'
            e.currentTarget.style.boxShadow = '0 6px 28px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.15)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 24px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)'
          }}
        >
          <Sparkles size={14} />
          <span style={{ letterSpacing: '0.01em' }}>
            <span style={{ opacity: 0.7, fontSize: '11px', fontWeight: 500, marginRight: '4px' }}>&#8984;K</span>
            Ask Brain
          </span>
        </button>
      )}

      {/* ── Backdrop overlay (click to close) ── */}
      {copilotOpen && (
        <div
          onClick={() => setCopilotOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 299,
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(2px)',
            transition: 'opacity 0.2s',
          }}
        />
      )}

      {/* ── Slide-over panel ── */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: `${panelWidth}px`,
          maxWidth: '100vw',
          zIndex: 301,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(7, 5, 15, 0.95)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderLeft: '1px solid rgba(99,102,241,0.15)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5), -2px 0 16px rgba(99,102,241,0.08)',
          transform: copilotOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1), width 0.2s ease',
          pointerEvents: copilotOpen ? 'auto' : 'none',
        }}
      >
        {/* ── Header bar ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '16px 18px',
          borderBottom: '1px solid rgba(99,102,241,0.1)',
          flexShrink: 0,
        }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '9px',
            background: 'linear-gradient(145deg, rgba(120,110,255,0.24), rgba(100,80,220,0.14))',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 1px 8px rgba(99,102,241,0.18), inset 0 1px 0 rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Sparkles size={13} color="#A5B4FC" />
          </div>
          <span style={{
            fontSize: '13.5px', fontWeight: 700, color: 'rgba(200,196,255,0.9)',
            letterSpacing: '0.01em', flex: 1,
          }}>
            SellSight Brain
          </span>

          {/* Clear chat */}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              title="Clear conversation"
              style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#6B7280', cursor: 'pointer', transition: 'all 140ms', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#F87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            >
              Clear
            </button>
          )}

          {/* Expand/collapse width toggle */}
          <button
            onClick={toggleWidth}
            title={isWide.current ? 'Narrow panel' : 'Widen panel'}
            style={{
              width: '30px', height: '30px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '8px', cursor: 'pointer', color: '#4B5563', transition: 'all 140ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(130,120,255,0.3)'; e.currentTarget.style.color = '#A5B4FC'; e.currentTarget.style.background = 'rgba(99,102,241,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#4B5563'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
          >
            {isWide.current ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Close */}
          <button
            onClick={() => setCopilotOpen(false)}
            title="Close (Esc)"
            style={{
              width: '30px', height: '30px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '8px', cursor: 'pointer', color: '#4B5563', transition: 'all 140ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = '#F87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#4B5563'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Context ribbon ── */}
        <div style={{
          padding: '8px 18px',
          borderBottom: '1px solid rgba(99,102,241,0.08)',
          flexShrink: 0,
        }}>
          {activeDeal ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '12px', color: '#A5B4FC',
            }}>
              <div style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: '#6366F1', flexShrink: 0,
                boxShadow: '0 0 6px rgba(99,102,241,0.5)',
              }} />
              <span style={{ color: '#9CA3AF' }}>Viewing:</span>
              <span style={{ color: '#C7D2FE', fontWeight: 600 }}>{activeDeal.company}</span>
              <span style={{
                fontSize: '10px', fontWeight: 600,
                padding: '2px 8px', borderRadius: '100px',
                background: stageBadgeColor(activeDeal.stage).bg,
                color: stageBadgeColor(activeDeal.stage).text,
                border: `1px solid ${stageBadgeColor(activeDeal.stage).border}`,
              }}>
                {activeDeal.stage}
              </span>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '12px', color: '#6B7280',
            }}>
              <span style={{ fontSize: '13px' }}>&#128202;</span>
              <span>
                {pathname?.includes('/pipeline') ? 'Pipeline View' :
                 pathname?.includes('/competitors') ? 'Competitors' :
                 pathname?.includes('/collateral') ? 'Collateral' :
                 pathname?.includes('/settings') ? 'Settings' :
                 'Dashboard'}
              </span>
            </div>
          )}
        </div>

        {/* ── Messages area ── */}
        <div
          className="copilot-messages"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 18px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Empty state — suggestions */}
          {messages.length === 0 && !isLoading && (
            <div style={{ paddingTop: '16px' }}>
              {activeDeal && (
                <div style={{
                  fontSize: '11.5px', color: '#A5B4FC',
                  marginBottom: '14px',
                  padding: '9px 14px', borderRadius: '10px',
                  background: 'rgba(99,102,241,0.06)',
                  border: '1px solid rgba(99,102,241,0.15)',
                  display: 'flex', alignItems: 'center', gap: '7px',
                  lineHeight: '1.6',
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366F1', flexShrink: 0 }} />
                  <span>
                    Full context loaded for <strong style={{ color: '#C7D2FE' }}>{activeDeal.company}</strong> — contacts, todos, notes, risks, and project plan.
                  </span>
                </div>
              )}

              <div style={{
                fontSize: '12px', color: '#4B5563', marginBottom: '14px',
                textAlign: 'center', letterSpacing: '0.01em',
              }}>
                {activeDeal ? `What should the brain do for ${activeDeal.company}?` : 'The brain has full context on your pipeline'}
              </div>

              {/* Quick action chips */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '6px',
              }}>
                {quickActions.map(action => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                      background: 'rgba(15, 12, 30, 0.8)',
                      border: '1px solid rgba(99,102,241,0.12)',
                      color: '#9CA3AF', fontSize: '12.5px', fontWeight: 500,
                      transition: 'all 140ms', textAlign: 'left',
                      fontFamily: 'inherit', width: '100%',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(99,102,241,0.08)'
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'
                      e.currentTarget.style.color = '#C7D2FE'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(15, 12, 30, 0.8)'
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.12)'
                      e.currentTarget.style.color = '#9CA3AF'
                    }}
                  >
                    <Sparkles size={12} color="#6366F1" style={{ flexShrink: 0 }} />
                    {action.label}
                    {action.partial && (
                      <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#4B5563' }}>&#8594; edit</span>
                    )}
                  </button>
                ))}
              </div>

              <div style={{
                marginTop: '16px',
                padding: '10px 14px',
                background: 'rgba(99,102,241,0.04)',
                border: '1px solid rgba(99,102,241,0.1)',
                borderRadius: '10px',
                fontSize: '11px',
                color: '#4B5563',
                lineHeight: '1.7',
              }}>
                <span style={{ color: '#6366F1', fontWeight: 600 }}>Ask anything:</span>{' '}
                pipeline overview &middot; deal analysis &middot; competitor intel &middot; generate assets &middot; manage todos &middot; process updates &middot; update deals
              </div>
            </div>
          )}

          {/* Rendered messages */}
          {messages.map((msg, i) => (
            <div key={msg.id ?? i} className="copilot-msg-row">
              {msg.role === 'user' ? (
                /* User message — right aligned purple bubble */
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: '14px 14px 4px 14px',
                    background: 'rgba(99,102,241,0.12)',
                    border: '1px solid rgba(99,102,241,0.22)',
                  }}>
                    <p style={{
                      fontSize: '13.5px', color: '#C7D2FE', margin: 0,
                      lineHeight: '1.6', whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                    </p>
                  </div>
                </div>
              ) : (
                /* Assistant message — left aligned dark glass bubble */
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '24px', height: '24px', flexShrink: 0, marginTop: '2px',
                    background: 'linear-gradient(145deg, rgba(120,110,255,0.2), rgba(100,80,220,0.12))',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Sparkles size={11} color="#A5B4FC" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Tool call cards */}
                    {hasToolCalls(msg) && (
                      <div style={{ marginBottom: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {getToolInvocations(msg).map((inv: any, j: number) => (
                          <ToolCallCard key={j} invocation={inv} />
                        ))}
                      </div>
                    )}
                    {/* Message content */}
                    {msg.content && (
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: '4px 14px 14px 14px',
                        background: 'rgba(15, 12, 30, 0.8)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <MarkdownRenderer content={msg.content} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading / streaming indicator */}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="copilot-msg-row" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{
                width: '24px', height: '24px', flexShrink: 0, marginTop: '2px',
                background: 'linear-gradient(145deg, rgba(120,110,255,0.2), rgba(100,80,220,0.12))',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={11} color="#A5B4FC" />
              </div>
              <div style={{
                padding: '10px 14px',
                borderRadius: '4px 14px 14px 14px',
                background: 'rgba(15, 12, 30, 0.8)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <TypingDots />
              </div>
            </div>
          )}

          {/* Proactive suggestions after assistant response */}
          {messages.length > 0 && !isLoading && messages[messages.length - 1]?.role === 'assistant' && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '6px',
              paddingTop: '4px',
            }}>
              {quickActions.slice(0, 3).map(action => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action)}
                  style={{
                    padding: '5px 12px', borderRadius: '100px', cursor: 'pointer',
                    background: 'rgba(99,102,241,0.06)',
                    border: '1px solid rgba(99,102,241,0.15)',
                    color: '#6B7280', fontSize: '11px', fontWeight: 500,
                    transition: 'all 140ms', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(99,102,241,0.12)'
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'
                    e.currentTarget.style.color = '#A5B4FC'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(99,102,241,0.06)'
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.15)'
                    e.currentTarget.style.color = '#6B7280'
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Error display */}
          {(chatError || error) && (
            <div style={{
              margin: '8px 0',
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px',
              color: '#FCA5A5',
              fontSize: '12px',
              lineHeight: '1.5',
            }}>
              <strong>Error:</strong> {chatError || error?.message || 'Something went wrong'}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input area ── */}
        <form
          onSubmit={onSubmit}
          style={{
            padding: '12px 18px 16px',
            borderTop: '1px solid rgba(99,102,241,0.1)',
            flexShrink: 0,
          }}
        >
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-end',
          }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask the brain anything..."
                rows={1}
                style={{
                  width: '100%',
                  resize: 'none',
                  background: 'rgba(20, 16, 40, 0.9)',
                  border: '1px solid rgba(99,102,241,0.15)',
                  borderRadius: '12px',
                  color: '#E5E7EB',
                  fontSize: '13.5px',
                  lineHeight: '1.5',
                  padding: '10px 14px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.08)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.15)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Send / Stop button */}
            {isLoading ? (
              <button
                type="button"
                onClick={() => stop()}
                style={{
                  width: '38px', height: '38px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.22)',
                  borderRadius: '10px', cursor: 'pointer', transition: 'all 140ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
              >
                <Square size={12} color="#F87171" fill="#F87171" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                style={{
                  width: '38px', height: '38px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: input.trim()
                    ? 'linear-gradient(145deg, rgba(99,102,241,0.9), rgba(124,58,237,0.85))'
                    : 'rgba(255,255,255,0.04)',
                  border: input.trim()
                    ? '1px solid rgba(255,255,255,0.18)'
                    : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  cursor: input.trim() ? 'pointer' : 'default',
                  boxShadow: input.trim()
                    ? '0 2px 14px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15)'
                    : 'none',
                  transition: 'all 180ms cubic-bezier(0.4,0,0.2,1)',
                }}
                onMouseEnter={e => {
                  if (input.trim()) {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 4px 18px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.15)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = input.trim()
                    ? '0 2px 14px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15)'
                    : 'none'
                }}
              >
                <Send size={14} color={input.trim() ? '#fff' : '#444'} />
              </button>
            )}
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: '6px', padding: '0 2px',
          }}>
            <span style={{ fontSize: '10px', color: '#374151' }}>
              Shift+Enter for new line
            </span>
            <span style={{ fontSize: '10px', color: '#374151' }}>
              Esc to close
            </span>
          </div>
        </form>
      </div>
    </>
  )
}
