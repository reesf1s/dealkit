'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Send, Sparkles, Square, FileText, Sword, Building2, Zap,
  CheckCircle2, PlusCircle, RefreshCw, BookOpen, AlertTriangle,
  BarChart2, Mail, ChevronDown, ChevronUp, X, Check,
} from 'lucide-react'
import { mutate as globalMutate } from 'swr'
import { useSidebar } from './SidebarContext'
import type { ActionCard, PendingAction } from '@/app/api/chat/route'

function invalidateCaches(actions: ActionCard[]) {
  setTimeout(() => globalMutate('/api/brain'), 2000)
  for (const action of actions) {
    if (action.type === 'todos_updated' || action.type === 'deal_updated' || action.type === 'deal_created') {
      globalMutate('/api/deals')
      globalMutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/deals/'), undefined, { revalidate: true })
    }
    if (action.type === 'competitor_created') globalMutate('/api/competitors')
    if (action.type === 'company_updated') { globalMutate('/api/company'); globalMutate('/api/company-profile') }
    if (action.type === 'collateral_generating') globalMutate('/api/collateral')
    if (action.type === 'case_study_created') globalMutate('/api/case-studies')
    if (action.type === 'gaps_logged') globalMutate('/api/product-gaps')
  }
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  actions?: ActionCard[]
  confirmationRequired?: boolean
  pendingAction?: PendingAction
}

// ── Quick prompts — context-aware based on active deal ───────────────────────
function getQuickPrompts(activeDealCompany?: string) {
  if (activeDealCompany) {
    return [
      { icon: BarChart2, color: '#22C55E', label: 'Deal overview', prompt: `Give me a full overview of the ${activeDealCompany} deal — score, risks, todos, and next steps.` },
      { icon: FileText, color: '#6366F1', label: 'Paste meeting notes', prompt: 'Here are my meeting notes:\n\n', partial: true },
      { icon: Mail, color: '#06B6D4', label: 'Risk email', prompt: `Draft a follow-up email addressing the biggest risk in the ${activeDealCompany} deal.` },
      { icon: Zap, color: '#F59E0B', label: 'Generate collateral', prompt: `Generate a one-pager for ${activeDealCompany}`, partial: true },
      { icon: CheckCircle2, color: '#10B981', label: 'Review todos', prompt: `Review and clean up the todos for ${activeDealCompany}. Remove anything stale.` },
      { icon: BookOpen, color: '#A855F7', label: 'Win conditions', prompt: `What does it take to win the ${activeDealCompany} deal? What are the key objections and how do I handle them?` },
    ]
  }
  return [
    { icon: BarChart2, color: '#22C55E', label: "Pipeline health", prompt: "What's my pipeline looking like? Give me a full overview with what to focus on." },
    { icon: FileText, color: '#6366F1', label: 'Paste meeting notes', prompt: 'Here are my meeting notes:\n\n', partial: true },
    { icon: Sword, color: '#EC4899', label: 'Competitor battlecard', prompt: 'Create a battlecard for: ', partial: true },
    { icon: Mail, color: '#06B6D4', label: 'Risk follow-ups', prompt: 'For my top 3 open deals, draft a short personalised follow-up email addressing the biggest risk in each.' },
    { icon: Zap, color: '#F59E0B', label: 'Generate asset', prompt: 'Generate a ', partial: true },
    { icon: BookOpen, color: '#A855F7', label: 'Today\'s focus', prompt: 'What should I focus on today? Give me the top 3 actions across my pipeline with specific reasons.' },
  ]
}

// ── Typing animation ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '6px 2px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'rgba(165,180,252,0.5)',
          animation: `typingBounce 1.2s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  )
}

// ── Action cards ─────────────────────────────────────────────────────────────
function ActionCards({ actions }: { actions: ActionCard[] }) {
  if (!actions.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
      {actions.map((action, i) => {
        const base: React.CSSProperties = {
          padding: '8px 12px', borderRadius: '8px',
          display: 'flex', flexDirection: 'column', gap: '3px',
        }
        if (action.type === 'todos_updated') return (
          <div key={i} style={{ ...base, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <CheckCircle2 size={12} color="#10B981" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#10B981' }}>Todos updated — {action.dealName}</span>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' as const, paddingLeft: '19px' }}>
              {action.added > 0 && <span style={{ fontSize: '11px', color: '#6EE7B7' }}>+{action.added} added</span>}
              {action.completed > 0 && <span style={{ fontSize: '11px', color: '#6EE7B7' }}>✓ {action.completed} done</span>}
              {action.removed > 0 && <span style={{ fontSize: '11px', color: '#6EE7B7' }}>✕ {action.removed} removed</span>}
            </div>
          </div>
        )
        if (action.type === 'deal_updated') return (
          <div key={i} style={{ ...base, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <CheckCircle2 size={12} color="#10B981" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#10B981' }}>Updated — {action.dealName}</span>
            </div>
            {action.changes.slice(0, 3).map((c, ci) => (
              <div key={ci} style={{ fontSize: '11px', color: '#6EE7B7', paddingLeft: '19px' }}>· {c}</div>
            ))}
          </div>
        )
        if (action.type === 'deal_created') return (
          <div key={i} style={{ ...base, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={12} color="#10B981" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#10B981' }}>Deal created — {action.dealName}</span>
          </div>
        )
        if (action.type === 'competitor_created') return (
          <div key={i} style={{ ...base, background: 'rgba(236,72,153,0.07)', border: '1px solid rgba(236,72,153,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Sword size={12} color="#EC4899" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#EC4899' }}>{action.names.join(', ')} added</span>
            </div>
            {action.battlecardsStarted && <div style={{ fontSize: '11px', color: '#F9A8D4', paddingLeft: '19px' }}>↳ Battlecard generated</div>}
          </div>
        )
        if (action.type === 'company_updated') return (
          <div key={i} style={{ ...base, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Building2 size={12} color="#818CF8" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#818CF8' }}>Company profile updated</span>
            </div>
            {action.fields.slice(0, 3).map((f, fi) => (
              <div key={fi} style={{ fontSize: '11px', color: '#A5B4FC', paddingLeft: '19px' }}>· {f}</div>
            ))}
          </div>
        )
        if (action.type === 'collateral_generating') return (
          <div key={i} style={{ ...base, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
            <RefreshCw size={12} color="#F59E0B" style={{ animation: 'spin 1.5s linear infinite', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#F59E0B' }}>Generating {action.colType.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: '11px', color: '#FCD34D' }}>{action.title}</div>
            </div>
          </div>
        )
        if (action.type === 'case_study_created') return (
          <div key={i} style={{ ...base, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={12} color="#22C55E" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#22C55E' }}>Case study saved — {action.customerName}</span>
          </div>
        )
        if (action.type === 'gaps_logged') return (
          <div key={i} style={{ ...base, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={12} color="#EF4444" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#EF4444' }}>{action.count} gap{action.count !== 1 ? 's' : ''} logged</span>
          </div>
        )
        return null
      })}
    </div>
  )
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function MsgContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div style={{ fontSize: '13.5px', color: '#D1D5DB', lineHeight: '1.7', wordBreak: 'break-word' }}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <div key={i} style={{ fontSize: '12px', fontWeight: 700, color: '#EBEBEB', marginTop: i > 0 ? '12px' : 0, marginBottom: '4px', letterSpacing: '0.01em' }}>{line.slice(4)}</div>
        if (line.startsWith('## ')) return <div key={i} style={{ fontSize: '13px', fontWeight: 700, color: '#F1F1F3', marginTop: i > 0 ? '14px' : 0, marginBottom: '5px' }}>{line.slice(3)}</div>
        if (line.startsWith('# ')) return <div key={i} style={{ fontSize: '14px', fontWeight: 700, color: '#F8F8FA', marginTop: i > 0 ? '16px' : 0, marginBottom: '6px' }}>{line.slice(2)}</div>
        if (line.startsWith('- ') || line.startsWith('• ')) {
          const text = line.slice(2)
          return <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '3px' }}><span style={{ color: '#6366F1', flexShrink: 0, marginTop: '2px', fontSize: '10px' }}>▸</span><span>{renderInline(text)}</span></div>
        }
        if (/^\d+\.\s/.test(line)) {
          const num = line.match(/^(\d+)\.\s/)?.[1]
          const text = line.replace(/^\d+\.\s/, '')
          return <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '3px' }}><span style={{ color: '#6366F1', flexShrink: 0, fontSize: '11px', fontWeight: 700, marginTop: '2px', minWidth: '14px' }}>{num}.</span><span>{renderInline(text)}</span></div>
        }
        if (line.trim() === '') return <div key={i} style={{ height: '7px' }} />
        return <div key={i} style={{ marginBottom: '2px' }}>{renderInline(line)}</div>
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|~~[^~]+~~)/)
  return parts.map((part, i) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ color: '#EBEBEB', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} style={{ background: 'rgba(99,102,241,0.15)', padding: '1px 6px', borderRadius: '4px', fontSize: '12px', color: '#A5B4FC' }}>{part.slice(1, -1)}</code>
    if (part.startsWith('~~') && part.endsWith('~~')) return <span key={i} style={{ textDecoration: 'line-through', color: '#6B7280' }}>{part.slice(2, -2)}</span>
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) return <Link key={i} href={linkMatch[2]} style={{ color: '#818CF8', textDecoration: 'underline' }}>{linkMatch[1]}</Link>
    return part
  })
}

// ── Confirmation UI ───────────────────────────────────────────────────────────
function ConfirmationBar({
  pendingAction,
  onConfirm,
  onCancel,
}: {
  pendingAction: PendingAction
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div style={{
      marginTop: '10px', padding: '10px 12px',
      background: 'rgba(245,158,11,0.06)',
      border: '1px solid rgba(245,158,11,0.2)',
      borderRadius: '10px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
    }}>
      <span style={{ fontSize: '12px', color: '#FCD34D' }}>
        Apply these changes to <strong>{pendingAction.dealName}</strong>?
      </span>
      <div style={{ display: 'flex', gap: '7px', flexShrink: 0 }}>
        <button
          onClick={onCancel}
          style={{
            padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#9CA3AF', cursor: 'pointer', transition: 'all 140ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = '#F87171' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#9CA3AF' }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: '5px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
            background: 'linear-gradient(135deg, rgba(16,185,129,0.85), rgba(5,150,105,0.8))',
            border: '1px solid rgba(16,185,129,0.3)',
            color: '#fff', cursor: 'pointer', transition: 'all 140ms',
            display: 'flex', alignItems: 'center', gap: '5px',
            boxShadow: '0 2px 8px rgba(16,185,129,0.2)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(16,185,129,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(16,185,129,0.2)' }}
        >
          <Check size={11} />
          Confirm
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
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

  const handleInputFocus = () => {
    if (aiCollapsed) toggleAiCollapsed()
  }

  const sendMessage = useCallback(async (overrideText?: string, confirmAction?: PendingAction) => {
    const text = (overrideText ?? input).trim()
    if (!text || loading) return
    if (!overrideText) setInput('')

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

      const body: Record<string, unknown> = {
        messages: newMessages,
        activeDealId: activeDeal?.id ?? null,
        currentPage,
      }
      if (confirmAction) body.confirmAction = confirmAction

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${(err as { error?: string }).error ?? res.statusText}` }])
        return
      }

      const ct = res.headers.get('content-type') ?? ''
      if (ct.includes('text/event-stream')) {
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
        const data = await res.json()
        const assistantMsg: Message = {
          role: 'assistant',
          content: data.reply ?? '',
          actions: data.actions ?? [],
          confirmationRequired: data.confirmationRequired,
          pendingAction: data.pendingAction,
        }
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

  const handleConfirm = useCallback(async (pendingAction: PendingAction, msgIndex: number) => {
    // Remove the confirmation from the message
    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, confirmationRequired: false, pendingAction: undefined } : m
    ))
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          activeDealId: activeDeal?.id ?? null,
          currentPage: pathname,
          confirmAction: pendingAction,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const assistantMsg: Message = { role: 'assistant', content: data.reply ?? '', actions: data.actions ?? [] }
        setMessages(prev => [...prev, assistantMsg])
        if (data.actions?.length) invalidateCaches(data.actions)
      }
    } catch { /* non-fatal */ } finally {
      setLoading(false)
    }
  }, [activeDeal, pathname])

  const handleCancel = useCallback((msgIndex: number) => {
    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, confirmationRequired: false, pendingAction: undefined } : m
    ))
    setMessages(prev => [...prev, { role: 'assistant', content: 'Cancelled — no changes made.' }])
  }, [])

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

  const EXPANDED_HEIGHT = 580
  const COLLAPSED_HEIGHT = 60
  const barHeight = isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT

  const quickPrompts = getQuickPrompts(activeDeal?.company)

  return (
    <>
      <style>{`
        @keyframes typingBounce { 0%,60%,100% { transform: translateY(0) } 30% { transform: translateY(-6px) } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        .ai-bar-messages::-webkit-scrollbar { width: 3px }
        .ai-bar-messages::-webkit-scrollbar-track { background: transparent }
        .ai-bar-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px }
        .ai-msg-user { background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); }
        .ai-msg-assistant { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); }
        .ai-quick-chip:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.14) !important; color: #E5E7EB !important; }
        .ai-input:focus { border-color: rgba(130,120,255,0.45) !important; background: rgba(255,255,255,0.05) !important; }
        .ai-msg-row { animation: fadeInUp 0.18s ease-out; }
      `}</style>

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: `${sidebarWidth}px`,
        right: 0,
        height: `${barHeight}px`,
        transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1), left 0.22s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(9, 8, 19, 0.82)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        boxShadow: isExpanded
          ? '0 -1px 0 rgba(255,255,255,0.04) inset, 0 -24px 60px rgba(0,0,0,0.6), 0 -1px 16px rgba(99,102,241,0.1)'
          : '0 -1px 0 rgba(255,255,255,0.04) inset, 0 -8px 24px rgba(0,0,0,0.35)',
      }}>

        {/* ── Header bar — always visible ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '0 16px',
          height: `${COLLAPSED_HEIGHT}px`,
          flexShrink: 0,
          borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}>
          {/* AI pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '9px',
              background: 'linear-gradient(145deg, rgba(120,110,255,0.24), rgba(100,80,220,0.14))',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 1px 8px rgba(99,102,241,0.18), inset 0 1px 0 rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={13} color="#A5B4FC" />
            </div>
            {isExpanded && (
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'rgba(200,196,255,0.9)', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
                DealKit AI
              </span>
            )}
          </div>

          {/* Active deal pill */}
          {activeDeal && isExpanded && (
            <div style={{
              fontSize: '11px', color: '#A5B4FC',
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.22)',
              borderRadius: '100px', padding: '3px 10px', flexShrink: 0,
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6366F1' }} />
              {activeDeal.company}
            </div>
          )}

          {/* Input */}
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={handleInputFocus}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              }}
              placeholder={
                activeDeal
                  ? `Ask about ${activeDeal.company}, paste meeting notes, generate assets…`
                  : 'Ask anything, paste notes, create assets… (⏎ to send)'
              }
              rows={1}
              className="ai-input"
              style={{
                width: '100%', resize: 'none',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '11px',
                color: '#E5E7EB', fontSize: '13.5px', lineHeight: '1.5',
                padding: '9px 14px', outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box', maxHeight: '100px', overflowY: 'auto',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            />
          </div>

          {/* Send / Stop */}
          {(loading || streaming) ? (
            <button onClick={stopStreaming} style={{
              width: '34px', height: '34px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.22)',
              borderRadius: '10px', cursor: 'pointer', transition: 'all 140ms',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
            >
              <Square size={11} color="#F87171" fill="#F87171" />
            </button>
          ) : (
            <button onClick={() => sendMessage()} disabled={!input.trim()} style={{
              width: '34px', height: '34px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: input.trim()
                ? 'linear-gradient(145deg, rgba(120,110,255,0.92), rgba(100,60,220,0.88))'
                : 'rgba(255,255,255,0.04)',
              border: input.trim() ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px', cursor: input.trim() ? 'pointer' : 'default',
              boxShadow: input.trim() ? '0 2px 14px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : 'none',
              transition: 'all 180ms cubic-bezier(0.4,0,0.2,1)',
            }}
              onMouseEnter={e => { if (input.trim()) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.2)' } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = input.trim() ? '0 2px 14px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : 'none' }}
            >
              <Send size={13} color={input.trim() ? '#fff' : '#444'} />
            </button>
          )}

          {/* Expand/collapse toggle */}
          <button
            onClick={toggleAiCollapsed}
            style={{
              width: '30px', height: '30px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '9px', cursor: 'pointer', color: '#4B5563', transition: 'all 140ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(130,120,255,0.3)'; e.currentTarget.style.color = '#A5B4FC'; e.currentTarget.style.background = 'rgba(99,102,241,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#4B5563'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>

          {/* Clear */}
          {isExpanded && messages.length > 0 && (
            <button onClick={clearChat} style={{
              width: '26px', height: '26px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer', color: '#374151', transition: 'color 140ms',
            }}
              title="Clear conversation"
              onMouseEnter={e => (e.currentTarget.style.color = '#F87171')}
              onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* ── Conversation area — only visible when expanded ── */}
        {isExpanded && (
          <div
            className="ai-bar-messages"
            style={{
              flex: 1, overflowY: 'auto', padding: '12px 16px 8px',
              display: 'flex', flexDirection: 'column', gap: '10px',
            }}
          >
            {/* Empty state — quick prompts */}
            {messages.length === 0 && !streaming && (
              <div style={{ paddingTop: '4px' }}>
                {activeDeal && (
                  <div style={{
                    fontSize: '11px', color: '#6366F1', marginBottom: '10px',
                    padding: '7px 12px', borderRadius: '8px',
                    background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6366F1', flexShrink: 0 }} />
                    <span style={{ color: '#A5B4FC', fontSize: '11.5px' }}>
                      Context: <strong style={{ color: '#C7D2FE' }}>{activeDeal.company}</strong> — I know this deal. Ask anything about it.
                    </span>
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#374151', marginBottom: '10px', textAlign: 'center', letterSpacing: '0.01em' }}>
                  {activeDeal ? `What would you like to do with ${activeDeal.company}?` : 'Ask anything or pick a quick action'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                  {quickPrompts.map(qp => (
                    <button
                      key={qp.label}
                      className="ai-quick-chip"
                      onClick={() => {
                        if ((qp as any).partial) {
                          setInput(qp.prompt)
                          inputRef.current?.focus()
                        } else {
                          sendMessage(qp.prompt)
                        }
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '5px 11px', borderRadius: '100px', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#6B7280', fontSize: '11.5px', fontWeight: 500,
                        transition: 'all 140ms',
                      }}
                    >
                      <qp.icon size={10} color={qp.color} />
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, i) => (
              <div key={i} className="ai-msg-row" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: '22px', height: '22px', flexShrink: 0, marginTop: '3px',
                    background: 'linear-gradient(145deg, rgba(120,110,255,0.2), rgba(100,80,220,0.12))',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Sparkles size={11} color="#A5B4FC" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={msg.role === 'user' ? 'ai-msg-user' : 'ai-msg-assistant'} style={{
                    borderRadius: '11px', padding: '9px 13px',
                    ...(msg.role === 'user' ? { marginLeft: '24px' } : {}),
                  }}>
                    {msg.role === 'user'
                      ? <p style={{ fontSize: '13.5px', color: '#C7D2FE', margin: 0, lineHeight: 1.6 }}>{msg.content}</p>
                      : <MsgContent content={msg.content} />
                    }
                  </div>
                  {msg.actions && msg.actions.length > 0 && <ActionCards actions={msg.actions} />}
                  {msg.confirmationRequired && msg.pendingAction && (
                    <ConfirmationBar
                      pendingAction={msg.pendingAction}
                      onConfirm={() => handleConfirm(msg.pendingAction!, i)}
                      onCancel={() => handleCancel(i)}
                    />
                  )}
                </div>
              </div>
            ))}

            {/* Streaming in progress */}
            {(loading || streaming) && (
              <div className="ai-msg-row" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '22px', height: '22px', flexShrink: 0, marginTop: '3px',
                  background: 'linear-gradient(145deg, rgba(120,110,255,0.2), rgba(100,80,220,0.12))',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles size={11} color="#A5B4FC" />
                </div>
                <div className="ai-msg-assistant" style={{ flex: 1, borderRadius: '11px', padding: '9px 13px' }}>
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
