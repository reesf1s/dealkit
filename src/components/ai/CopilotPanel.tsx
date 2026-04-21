'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useChat, type Message } from 'ai/react'
import { Sparkles, X, Maximize2, Minimize2, Send, Square } from 'lucide-react'
import { useSidebar } from '@/components/layout/SidebarContext'
import { track, Events } from '@/lib/analytics'
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
      { label: 'What should I focus on?', prompt: `Give me a complete briefing on the ${activeDealCompany} deal using the latest meeting notes and uploaded notes. Summarise score, contacts, risks, momentum, and the best next move.` },
      { label: 'What\'s blocking progress?', prompt: `Analyze the ${activeDealCompany} deal — what are the blockers, objections, and risks preventing this from closing? Check the ML intelligence and suggest specific actions to unblock it.` },
      { label: 'How is this deal trending?', prompt: `Show me the score history and health trend for the ${activeDealCompany} deal. Is it improving or declining? What changed and when?` },
      { label: 'How does this compare to wins?', prompt: `Compare the ${activeDealCompany} deal to similar deals we've won. What did those deals have that this one is missing? What patterns led to wins?` },
      { label: 'Help me write a follow-up', prompt: `Draft a follow-up email for ${activeDealCompany} addressing the biggest risk in this deal.` },
      { label: 'What changed recently?', prompt: `Review the latest notes and meetings for ${activeDealCompany}. What changed, what still matters, and what needs follow-up?` },
    ]
  }
  if (currentPage?.includes('/deals') || currentPage?.includes('/pipeline') || currentPage === '/') {
    return [
      { label: 'How does my pipeline look?', prompt: "What's my pipeline looking like? Give me a full overview with what to focus on." },
      { label: 'What needs my attention?', prompt: 'Which deals need attention right now? Flag anything at risk or stale.' },
      { label: 'Which deals are trending up or down?', prompt: 'Show me which deals are trending up vs down. Which deals have improved or declined the most recently?' },
      { label: 'Give me a forecast', prompt: 'Give me a forecast for this quarter based on current pipeline stages and win probabilities.' },
    ]
  }
  return [
    { label: 'Process deal update', prompt: 'Here are my latest notes:\n\n', partial: true },
    { label: 'Add competitor', prompt: 'Add a new competitor: ', partial: true },
    { label: 'Create deal', prompt: 'Create a new deal for ', partial: true },
  ]
}

// ── Context-aware follow-up suggestions based on conversation content ────────

const CONTENT_TOOLS = new Set(['generate_content'])
const DEAL_MUTATION_TOOLS = new Set(['update_deal'])
const INFO_TOOLS = new Set(['search_deals', 'get_deal', 'answer_question'])

type ConversationIntent = 'content' | 'deal_update' | 'information' | 'generic'

type ToolInvocationLike = {
  toolName: string
  args: Record<string, unknown>
  state: 'partial-call' | 'call' | 'result'
  result?: unknown
  toolCallId?: string
}

type MessagePartLike = {
  type?: string
  text?: string
  toolInvocation?: ToolInvocationLike
}

type MessageWithMetadata = Message & {
  parts?: MessagePartLike[]
  toolInvocations?: ToolInvocationLike[]
}

function getMessageParts(message: Message | null | undefined): MessagePartLike[] {
  const parts = (message as MessageWithMetadata | null | undefined)?.parts
  return Array.isArray(parts) ? parts : []
}

function getMessageText(message: Message | null | undefined): string {
  if (!message) return ''
  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content
  }

  return getMessageParts(message)
    .filter((part): part is MessagePartLike & { type: 'text'; text: string } => part?.type === 'text' && typeof part?.text === 'string')
    .map(part => part.text)
    .join('\n')
    .trim()
}

function getMessageToolInvocations(message: Message | null | undefined): ToolInvocationLike[] {
  if (!message) return []
  const legacyInvocations = Array.isArray((message as MessageWithMetadata).toolInvocations)
    ? (message as MessageWithMetadata).toolInvocations ?? []
    : []

  const partInvocations = getMessageParts(message)
    .filter((part): part is MessagePartLike & { type: 'tool-invocation'; toolInvocation: ToolInvocationLike } => part?.type === 'tool-invocation' && !!part.toolInvocation)
    .map(part => part.toolInvocation)

  const merged = [...legacyInvocations, ...partInvocations].filter(
    (inv): inv is ToolInvocationLike =>
      Boolean(inv?.toolName) &&
      (inv?.state === 'partial-call' || inv?.state === 'call' || inv?.state === 'result'),
  )

  const deduped = new Map<string, ToolInvocationLike>()
  for (const invocation of merged) {
    const id = invocation.toolCallId
      ?? `${invocation.toolName}:${invocation.state}:${JSON.stringify(invocation.args ?? {})}`
    deduped.set(id, invocation)
  }
  return Array.from(deduped.values())
}

function detectConversationIntent(messages: Message[]): ConversationIntent {
  // Look at ALL assistant messages for tool invocations
  const toolNames = new Set<string>()
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue
    const invocations = getMessageToolInvocations(msg)
    for (const inv of invocations) {
      if (inv.toolName) toolNames.add(inv.toolName)
    }
  }

  if (toolNames.size === 0) {
    // No tools called — check user's last message for intent
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    if (lastUser) {
      const lower = getMessageText(lastUser).toLowerCase()
      if (lower.match(/send .+ (talking points|deck|doc|email|one-pager|battlecard|proposal)/) ||
          lower.match(/(draft|write|create|generate|build) .+ (email|doc|deck|points|battlecard|one-pager|proposal|brief)/)) {
        return 'content'
      }
    }
    return 'generic'
  }

  // Content tools take priority
  for (const t of toolNames) {
    if (CONTENT_TOOLS.has(t)) return 'content'
  }
  // Deal mutations
  for (const t of toolNames) {
    if (DEAL_MUTATION_TOOLS.has(t)) return 'deal_update'
  }
  // Pure info queries
  for (const t of toolNames) {
    if (INFO_TOOLS.has(t)) return 'information'
  }

  return 'generic'
}

function getFollowUpActions(intent: ConversationIntent, activeDealCompany?: string): QuickAction[] {
  const dealRef = activeDealCompany ? ` for ${activeDealCompany}` : ''
  switch (intent) {
    case 'content':
      return [
        { label: 'Draft a follow-up email', prompt: `Draft a follow-up email${dealRef}` },
        { label: 'Generate talking points', prompt: `Generate internal buy-in talking points${dealRef}` },
        { label: 'Create a one-pager', prompt: `Create a one-pager${dealRef}` },
      ]
    case 'deal_update':
      return [
        { label: 'What should I do next?', prompt: `What are my next steps${dealRef}? What should I prioritise?` },
        { label: 'Check deal health', prompt: `How is${dealRef ? ' the' + dealRef.slice(4) + ' deal' : ' my pipeline'} looking? Give me the ML analysis.` },
        { label: 'Review recent context', prompt: `Review the latest notes${dealRef} and tell me what changed, what is blocked, and what follow-up matters most.` },
      ]
    case 'information':
      // No follow-up buttons for pure information queries — the answer IS the response
      return []
    default:
      return []
  }
}

// ── Stage badge color map ───────────────────────────────────────────────────
function stageBadgeColor(stage: string): { bg: string; text: string; border: string } {
  const s = stage.toLowerCase()
  if (s.includes('close') || s.includes('won')) return { bg: 'rgba(15,123,108,0.08)', text: '#0f7b6c', border: 'rgba(15,123,108,0.20)' }
  if (s.includes('negot')) return { bg: 'rgba(203,108,44,0.08)', text: '#cb6c2c', border: 'rgba(203,108,44,0.20)' }
  if (s.includes('lost') || s.includes('churn')) return { bg: 'rgba(224,62,62,0.08)', text: '#e03e3e', border: 'rgba(224,62,62,0.20)' }
  return { bg: 'var(--surface-2)', text: 'var(--text-secondary)', border: 'var(--border-default)' }
}

// ── Typing dots ─────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '6px 2px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'rgba(29, 184, 106, 0.40)',
          animation: `copilotTypingBounce 1.2s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  )
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

// ── Main CopilotPanel ───────────────────────────────────────────────────────
export default function CopilotPanel() {
  const pathname = usePathname()
  const { copilotOpen, toggleCopilot, setCopilotOpen, activeDeal, copilotPrefill, clearCopilotPrefill, copilotAutoSend, clearCopilotAutoSend } = useSidebar()

  const [chatError, setChatError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID())

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    isLoading,
    setInput,
    setMessages,
    stop,
    error,
  } = useChat({
    api: '/api/agent',
    body: { activeDealId: activeDeal?.id ?? null, currentPage: pathname, conversationId },
    onError: (err) => {
      console.error('[CopilotPanel] Chat error:', err)
      const message = err.message || 'Something went wrong. Please try again.'
      if (/401|403|404|unauthori|signed.?out|session/i.test(message)) {
        setChatError('Your session may have expired. Refresh Halvex and try again.')
        return
      }
      if (/503|not configured|OPENAI_API_KEY|unavailable/i.test(message)) {
        setChatError('Ask AI is not configured. Add OPENAI_API_KEY to your environment variables.')
        return
      }
      if (/rate.?limit|too many/i.test(message)) {
        setChatError('Too many requests. Please wait a moment before trying again.')
        return
      }
      setChatError(message)
    },
    onResponse: () => {
      setChatError(null)
    },
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [isWide, setIsWide] = useState(false)
  const [panelWidth, setPanelWidth] = useState(420)
  const lastSubmittedRef = useRef<{ text: string; at: number } | null>(null)

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

  // Consume prefill from SidebarContext (fills input, user still hits send)
  useEffect(() => {
    if (copilotPrefill && copilotOpen) {
      setInput(copilotPrefill)
      clearCopilotPrefill()
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [copilotPrefill, copilotOpen, setInput, clearCopilotPrefill])

  // Auto-send messages routed from Updates+Notes or other in-page inputs
  useEffect(() => {
    if (copilotAutoSend && copilotOpen && !isLoading) {
      const text = copilotAutoSend
      clearCopilotAutoSend()
      // Small delay so panel is fully rendered before we submit
      setTimeout(() => {
        append({ role: 'user', content: text })
      }, 200)
    }
  }, [copilotAutoSend, copilotOpen, isLoading, clearCopilotAutoSend, append])

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
    setIsWide(prev => {
      const next = !prev
      setPanelWidth(next ? 640 : 420)
      return next
    })
  }

  const clearChat = () => {
    setMessages([])
    setInput('')
    setConversationId(crypto.randomUUID())
  }

  const quickActions = getQuickActions(activeDeal?.company, pathname || '/')

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const nextText = input.trim()
    if (!nextText || isLoading) return

    const lastSubmitted = lastSubmittedRef.current
    if (
      lastSubmitted &&
      compactWhitespace(lastSubmitted.text) === compactWhitespace(nextText) &&
      Date.now() - lastSubmitted.at < 1500
    ) {
      return
    }

    lastSubmittedRef.current = { text: nextText, at: Date.now() }
    track(Events.AI_CHAT_SENT, { dealId: activeDeal?.id ?? null, messageLength: nextText.length })
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
    return getMessageToolInvocations(msg).length > 0
  }

  const getToolInvocations = (msg: Message) => {
    return getMessageToolInvocations(msg)
  }

  return (
    <>
      <style>{`
        @keyframes copilotTypingBounce { 0%,60%,100% { transform: translateY(0) } 30% { transform: translateY(-6px) } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes copilotFadeIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes copilotSlideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes copilotPulse {
          0%, 100% { box-shadow: 0 4px 16px rgba(29, 184, 106, 0.30); }
          50% { box-shadow: 0 4px 20px rgba(29, 184, 106, 0.50); }
        }
        .copilot-messages::-webkit-scrollbar { width: 3px; }
        .copilot-messages::-webkit-scrollbar-track { background: transparent; }
        .copilot-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
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
            padding: '9px 16px',
            background: '#1DB86A',
            border: '1px solid rgba(29, 184, 106, 0.80)',
            borderRadius: '100px',
            color: '#ffffff',
            fontSize: '12.5px',
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(29, 184, 106, 0.35)',
            transition: 'transform 0.15s, box-shadow 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.background = '#17a55f'
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(29, 184, 106, 0.45)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.background = '#1DB86A'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(29, 184, 106, 0.35)'
          }}
        >
          <Sparkles size={13} />
          <span style={{ letterSpacing: '-0.01em' }}>
            Ask AI
            <span style={{ opacity: 0.65, fontSize: '11px', fontWeight: 500, marginLeft: '5px' }}>⌘K</span>
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
            background: 'rgba(26,26,26,0.15)',
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
          background: 'var(--surface-1)',
          borderLeft: '1px solid var(--border-default)',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.12)',
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
          borderBottom: '1px solid var(--border-default)',
          flexShrink: 0,
        }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '9px',
            background: 'rgba(29, 184, 106, 0.10)',
            border: '1px solid rgba(29, 184, 106, 0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Sparkles size={13} color="#1DB86A" />
          </div>
          <span style={{
            fontSize: '13.5px', fontWeight: 700, color: '#1a1a1a',
            letterSpacing: '-0.01em', flex: 1,
          }}>
            Ask AI
          </span>

          {/* Clear chat */}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              title="Clear conversation"
              style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                background: 'var(--surface)', border: '1px solid var(--border)',
                color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 140ms', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#F87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              Clear
            </button>
          )}

          {/* Expand/collapse width toggle */}
          <button
            onClick={toggleWidth}
            title={isWide ? 'Narrow panel' : 'Widen panel'}
            style={{
              width: '30px', height: '30px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '8px', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'all 140ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(130,120,255,0.3)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--accent-subtle)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'var(--surface)' }}
          >
            {isWide ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Close */}
          <button
            onClick={() => setCopilotOpen(false)}
            title="Close (Esc)"
            style={{
              width: '30px', height: '30px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '8px', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'all 140ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = '#F87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'var(--surface)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Context ribbon ── */}
        <div style={{
          padding: '8px 18px',
          borderBottom: '1px solid var(--border-default)',
          flexShrink: 0,
        }}>
          {activeDeal ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '12px', color: 'var(--text-secondary)',
            }}>
              <div style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: '#1DB86A', flexShrink: 0,
              }} />
              <span style={{ color: 'var(--text-secondary)' }}>Working on</span>
              <span style={{ color: '#1a1a1a', fontWeight: 600 }}>{activeDeal.company}</span>
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
              fontSize: '12px', color: 'var(--text-tertiary)',
            }}>
              <span style={{ fontSize: '13px' }}>&#128202;</span>
              <span>
                {pathname?.includes('/deals') || pathname?.includes('/pipeline') ? 'Pipeline View' :
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
                  fontSize: '11.5px', color: 'var(--text-secondary)',
                  marginBottom: '14px',
                  padding: '9px 14px', borderRadius: '10px',
                  background: 'rgba(29, 184, 106, 0.06)',
                  border: '1px solid rgba(29, 184, 106, 0.14)',
                  display: 'flex', alignItems: 'center', gap: '7px',
                  lineHeight: '1.6',
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1DB86A', flexShrink: 0 }} />
                  <span>
                    Ready — I know everything about <strong style={{ color: '#1a1a1a' }}>{activeDeal.company}</strong>
                  </span>
                </div>
              )}

              <div style={{
                fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '14px',
                textAlign: 'center', letterSpacing: '0.01em',
              }}>
                {activeDeal ? `How can I help with ${activeDeal.company}?` : 'What would you like to do?'}
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
                      padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                      background: 'rgba(26,26,26,0.03)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-secondary)', fontSize: '12.5px', fontWeight: 500,
                      transition: 'all 140ms', textAlign: 'left',
                      fontFamily: 'inherit', width: '100%',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(29, 184, 106, 0.06)'
                      e.currentTarget.style.borderColor = 'rgba(29, 184, 106, 0.18)'
                      e.currentTarget.style.color = '#1a1a1a'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(26,26,26,0.03)'
                      e.currentTarget.style.borderColor = 'var(--border-default)'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                    }}
                  >
                    <Sparkles size={12} color="#1DB86A" style={{ flexShrink: 0 }} />
                    {action.label}
                    {action.partial && (
                      <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-tertiary)' }}>&#8594; edit</span>
                    )}
                  </button>
                ))}
              </div>

              <div style={{
                marginTop: '16px',
                padding: '10px 14px',
                background: 'rgba(26,26,26,0.03)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                fontSize: '11px',
                color: 'var(--text-tertiary)',
                lineHeight: '1.7',
              }}>
                <span style={{ color: '#1DB86A', fontWeight: 600 }}>Ask anything:</span>{' '}
                pipeline overview &middot; deal analysis &middot; competitor intel &middot; generate assets &middot; process notes &middot; process updates &middot; update deals
              </div>
            </div>
          )}

          {/* Rendered messages */}
          {messages.map((msg, i) => (
            <div key={msg.id ?? i} className="copilot-msg-row">
              {msg.role === 'user' ? (
                /* User message — right aligned dark bubble */
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: '14px 14px 4px 14px',
                    background: '#1a1a1a',
                    border: '1px solid #f0f0f0',
                  }}>
                    <p style={{
                      fontSize: '13.5px', color: 'rgba(255,255,255,0.92)', margin: 0,
                      lineHeight: '1.6', whiteSpace: 'pre-wrap',
                    }}>
                      {getMessageText(msg)}
                    </p>
                  </div>
                </div>
              ) : (
                /* Assistant message — left aligned light bubble */
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '24px', height: '24px', flexShrink: 0, marginTop: '2px',
                    background: 'rgba(29, 184, 106, 0.10)',
                    border: '1px solid rgba(29, 184, 106, 0.18)', borderRadius: '7px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Sparkles size={11} color="#1DB86A" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Tool call cards */}
                    {hasToolCalls(msg) && (
                      <div style={{ marginBottom: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {getToolInvocations(msg).map((inv: ToolInvocationLike, j: number) => (
                          <ToolCallCard key={j} invocation={inv} />
                        ))}
                      </div>
                    )}
                    {/* Message content */}
                    {getMessageText(msg) && (
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: '4px 14px 14px 14px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-default)',
                      }}>
                        <MarkdownRenderer content={getMessageText(msg)} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading / streaming indicator — show during tool execution too (assistant msg exists but has no visible text yet) */}
          {isLoading && !(messages[messages.length - 1]?.role === 'assistant' && getMessageText(messages[messages.length - 1]).trim().length > 0) && (
            <div className="copilot-msg-row" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{
                width: '24px', height: '24px', flexShrink: 0, marginTop: '2px',
                background: 'rgba(29, 184, 106, 0.10)',
                border: '1px solid rgba(29, 184, 106, 0.18)', borderRadius: '7px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={11} color="#1DB86A" />
              </div>
              <div style={{
                padding: '10px 14px',
                borderRadius: '4px 14px 14px 14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border-default)',
              }}>
                <TypingDots />
              </div>
            </div>
          )}

          {/* Context-aware follow-up suggestions after assistant response */}
          {messages.length > 0 && !isLoading && messages[messages.length - 1]?.role === 'assistant' && (() => {
            const intent = detectConversationIntent(messages)
            const followUps = getFollowUpActions(intent, activeDeal?.company)
            // If intent-aware follow-ups exist, show those; otherwise skip (don't show generic buttons)
            if (followUps.length === 0) return null
            return (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '6px',
                paddingTop: '4px',
              }}>
                {followUps.map(action => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action)}
                    style={{
                      padding: '5px 12px', borderRadius: '100px', cursor: 'pointer',
                      background: 'rgba(29, 184, 106, 0.06)',
                      border: '1px solid rgba(29, 184, 106, 0.16)',
                      color: '#1DB86A', fontSize: '11px', fontWeight: 500,
                      transition: 'all 140ms', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(29, 184, 106, 0.12)'
                      e.currentTarget.style.borderColor = 'rgba(29, 184, 106, 0.25)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(29, 184, 106, 0.06)'
                      e.currentTarget.style.borderColor = 'rgba(29, 184, 106, 0.16)'
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )
          })()}

          {/* Error display — friendly message, no raw error details */}
          {(chatError || error) && (
            <div style={{
              margin: '8px 0',
              padding: '10px 14px',
              background: 'rgba(224,62,62,0.05)',
              border: '1px solid rgba(224,62,62,0.18)',
              borderRadius: '8px',
              color: '#e03e3e',
              fontSize: '12px',
              lineHeight: '1.5',
            }}>
              {chatError || 'Something went wrong with that request. Try again, or rephrase if the issue persists.'}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input area ── */}
        <form
          onSubmit={onSubmit}
          style={{
            padding: '12px 18px 16px',
            borderTop: '1px solid #eeeeee',
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
                placeholder="Ask anything..."
                rows={1}
                style={{
                  width: '100%',
                  resize: 'none',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  color: '#1a1a1a',
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
                  e.currentTarget.style.borderColor = 'rgba(29, 184, 106, 0.35)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29, 184, 106, 0.10)'
                  e.currentTarget.style.background = 'var(--surface-1)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'var(--border-default)'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.background = 'var(--surface-2)'
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
                  background: input.trim() ? '#1DB86A' : '#fafafa',
                  border: input.trim()
                    ? '1px solid rgba(29, 184, 106, 0.80)'
                    : '1px solid #eeeeee',
                  borderRadius: '10px',
                  cursor: input.trim() ? 'pointer' : 'default',
                  boxShadow: input.trim() ? '0 2px 8px rgba(29, 184, 106, 0.30)' : 'none',
                  transition: 'all 180ms cubic-bezier(0.4,0,0.2,1)',
                }}
                onMouseEnter={e => {
                  if (input.trim()) {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.background = '#17a55f'
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(29, 184, 106, 0.40)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.background = input.trim() ? '#1DB86A' : '#fafafa'
                  e.currentTarget.style.boxShadow = input.trim() ? '0 2px 8px rgba(29, 184, 106, 0.30)' : 'none'
                }}
              >
                <Send size={14} color={input.trim() ? '#ffffff' : '#aaaaaa'} />
              </button>
            )}
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: '6px', padding: '0 2px',
          }}>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
              Shift+Enter for new line
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
              Esc to close
            </span>
          </div>
        </form>
      </div>
    </>
  )
}
