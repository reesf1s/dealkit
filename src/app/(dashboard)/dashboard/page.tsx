'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import {
  Sparkles, RefreshCw, AlertTriangle, ArrowUpRight,
  GitBranch, Send, Brain, TrendingUp, Zap, CheckCircle2,
} from 'lucide-react'
import { getScoreColor } from '@/lib/deal-context'
import { generateAlerts } from '@/lib/alerts'
import { track, Events } from '@/lib/analytics'
import { useUser } from '@clerk/nextjs'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type ChatMessage = { role: 'user' | 'assistant'; content: string }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function DashboardPage() {
  const { user } = useUser()

  const { data: overviewRes, isLoading: overviewLoading } = useSWR('/api/dashboard/ai-overview', fetcher, { revalidateOnFocus: false })
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const { data: dealsRes } = useSWR('/api/deals', fetcher, { revalidateOnFocus: false })
  const { data: mcpActionsRes } = useSWR('/api/mcp-actions/recent?limit=3', fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 })
  const { data: inCycleRes } = useSWR('/api/deals/in-cycle', fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 })
  const [regenerating, setRegenerating] = useState(false)

  // Multi-turn chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const overview = overviewRes?.data
  const brain = brainRes?.data
  const deals: any[] = dealsRes?.data ?? []
  const activeDeals = deals.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
  const closedDeals = deals.filter((d: any) => d.stage === 'closed_won' || d.stage === 'closed_lost')
  const wonDeals = deals.filter((d: any) => d.stage === 'closed_won')
  const winRate = closedDeals.length > 0 ? Math.round((wonDeals.length / closedDeals.length) * 100) : null
  const inCycleItems: any[] = inCycleRes?.data ?? []
  const recentActions: any[] = mcpActionsRes?.data ?? []

  const dealsAtRisk = brain?.urgentDeals?.length ?? 0
  const inCycleCount = inCycleItems.length

  // Urgent deals (score < 40, active)
  const urgentDeals = deals
    .filter((d: any) => !['closed_won', 'closed_lost'].includes(d.stage) && (d.conversionScore ?? 0) > 0 && (d.conversionScore ?? 0) < 40)
    .slice(0, 3)

  const greeting = (() => {
    const h = new Date().getHours()
    const name = user?.firstName || ''
    const base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
    return name ? `${base}, ${name}.` : `${base}.`
  })()

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const regenerate = async () => {
    setRegenerating(true)
    try {
      await fetch('/api/dashboard/ai-overview', { method: 'POST' })
      await mutate('/api/dashboard/ai-overview')
      track(Events.AI_BRIEFING_GENERATED, { dealCount: activeDeals.length })
    } finally { setRegenerating(false) }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    const q = inputText.trim()
    if (!q || chatLoading) return
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: q }]
    setMessages(newMessages)
    setInputText('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const json = await res.json()
      const reply = json.reply ?? json.message ?? json.data?.reply ?? 'No response'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to get a response. Try again.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const actionEmoji: Record<string, string> = {
    link_created: '🔗', link_confirmed: '✅',
    issue_scoped_to_cycle: '🔄', release_email_generated: '✉️',
    all_issues_deployed_notification: '🚀', hubspot_email_logged: '📤',
    follow_up_reminder: '⏰', link_dismissed: '✕',
  }

  const colHeight = 'calc(100vh - 96px)'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '25% 45% 30%',
      gap: '0',
      height: colHeight,
      overflow: 'hidden',
      margin: '-22px -24px',
    }}>

      {/* ═══════════════════════════════════════════════════════════
          LEFT COLUMN — Pipeline Overview (gradient)
      ═══════════════════════════════════════════════════════════ */}
      <div style={{
        background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 25%, #4c1d95 55%, #5b21b6 85%, #6d28d9 100%)',
        padding: '32px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        overflowY: 'auto',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
      }}>
        {/* Subtle radial overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 10%, rgba(167,139,250,0.18) 0%, transparent 60%)', pointerEvents: 'none' }} />

        {/* Date */}
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '16px', position: 'relative' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>

        {/* Greeting */}
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 18px', position: 'relative' }}>
          {greeting}
        </h1>

        {/* LLM summary */}
        {overviewLoading && !overview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {[85, 100, 65, 90].map((w, i) => (
              <div key={i} style={{ height: '13px', width: `${w}%`, borderRadius: '6px', background: 'rgba(255,255,255,0.12)', animation: 'sk 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : overview?.summary ? (
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.75, margin: '0 0 20px', position: 'relative' }}>
            {overview.summary}
          </p>
        ) : (
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.40)', lineHeight: 1.75, margin: '0 0 20px', position: 'relative' }}>
            {activeDeals.length > 0
              ? `You have ${activeDeals.length} active deal${activeDeals.length !== 1 ? 's' : ''} in pipeline.`
              : 'Add your first deal to get started.'}
          </p>
        )}

        {/* Refresh briefing */}
        <button
          onClick={regenerate}
          disabled={regenerating}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '6px 12px', borderRadius: '8px', width: 'fit-content',
            background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)',
            color: 'rgba(255,255,255,0.70)', fontSize: '11px', fontWeight: 500,
            cursor: regenerating ? 'not-allowed' : 'pointer',
            opacity: regenerating ? 0.6 : 1,
            marginBottom: '28px', position: 'relative',
          }}
        >
          <RefreshCw size={10} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
          {regenerating ? 'Refreshing…' : 'Refresh briefing'}
        </button>

        {/* Stat chips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
          {[
            { icon: <AlertTriangle size={14} />, label: 'Deals at risk', value: String(dealsAtRisk || 0), color: dealsAtRisk > 0 ? '#f87171' : '#34d399', href: '/deals' },
            { icon: <GitBranch size={14} />, label: 'Issues in cycle', value: String(inCycleCount), color: '#a78bfa', href: '/deals' },
            { icon: <TrendingUp size={14} />, label: 'Win rate', value: winRate != null ? `${winRate}%` : '—', color: '#34d399', href: '/intelligence' },
          ].map((chip, i) => (
            <Link key={i} href={chip.href} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '13px 16px', borderRadius: '14px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.13)',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.13)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }}
              >
                <span style={{ color: chip.color }}>{chip.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: '-0.03em' }}>{chip.value}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.48)', marginTop: '2px' }}>{chip.label}</div>
                </div>
                <ArrowUpRight size={13} style={{ color: 'rgba(255,255,255,0.28)' }} />
              </div>
            </Link>
          ))}
        </div>

        {/* View pipeline link */}
        <div style={{ marginTop: 'auto', paddingTop: '24px', position: 'relative' }}>
          <Link href="/pipeline" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '11px 16px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)',
            textDecoration: 'none', color: 'rgba(255,255,255,0.82)',
            fontSize: '13px', fontWeight: 600,
            transition: 'all 0.12s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.16)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)' }}
          >
            View full pipeline <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MIDDLE COLUMN — Ask Halvex Chat
      ═══════════════════════════════════════════════════════════ */}
      <div style={{
        background: '#0d0f1a',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        height: '100%',
      }}>
        {/* Chat header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: '12px',
          background: 'rgba(255,255,255,0.01)',
          flexShrink: 0,
        }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Brain size={17} color="#818cf8" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.02em' }}>Ask Halvex</span>
              <span style={{
                display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%',
                background: '#34d399', animation: 'pulse-dot 2.4s ease-in-out infinite',
              }} />
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.32)', marginTop: '1px' }}>Ask about deals, scope issues, check on a deployment</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '20px 22px',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          {messages.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '28px', marginBottom: '14px' }}>🧠</div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.48)', marginBottom: '6px', fontWeight: 600 }}>Your pipeline intelligence, on demand</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.26)', lineHeight: 1.7, marginBottom: '24px' }}>
                Try asking about a specific deal, your win rate, or which issues are in the current cycle.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {[
                  'Which deals need attention this week?',
                  'What are our top win patterns?',
                  'Summarise the pipeline health',
                ].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => { setInputText(prompt); inputRef.current?.focus() }}
                    style={{
                      padding: '9px 14px', borderRadius: '9px', textAlign: 'left',
                      background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.16)',
                      color: 'rgba(255,255,255,0.55)', fontSize: '12px', cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.13)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.07)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)' }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '84%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #4f46e5, #6366f1)'
                    : 'rgba(255,255,255,0.05)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  fontSize: '13px',
                  color: msg.role === 'user' ? '#fff' : 'rgba(255,255,255,0.82)',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                  backdropFilter: msg.role === 'assistant' ? 'blur(20px)' : undefined,
                  WebkitBackdropFilter: msg.role === 'assistant' ? 'blur(20px)' : undefined,
                }}>
                  {msg.content}
                </div>
              </div>
            ))
          )}

          {chatLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8', animation: `bounce 1.2s ${delay}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '14px 20px 18px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(13,15,26,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          flexShrink: 0,
        }}>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Ask about a deal, scope issues, check on a deployment..."
              rows={2}
              disabled={chatLoading}
              style={{
                flex: 1, resize: 'none', padding: '10px 14px',
                borderRadius: '12px', fontSize: '13px', lineHeight: 1.5,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.85)', outline: 'none',
                caretColor: '#818cf8', fontFamily: 'inherit',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.40)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
            />
            <button
              type="submit"
              disabled={chatLoading || !inputText.trim()}
              style={{
                width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                border: '1px solid rgba(99,102,241,0.50)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: chatLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
                opacity: chatLoading || !inputText.trim() ? 0.5 : 1,
                transition: 'all 0.12s',
              }}
            >
              {chatLoading
                ? <RefreshCw size={16} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                : <Send size={16} color="#fff" />}
            </button>
          </form>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          RIGHT COLUMN — Today / Morning Update
      ═══════════════════════════════════════════════════════════ */}
      <div style={{
        background: '#0d0f1a',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.01)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>Today</h2>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Morning Briefing — workflow outputs / in-cycle items */}
          <div style={{ borderRadius: '12px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.14)', overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px 9px', borderBottom: '1px solid rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={11} color="#a78bfa" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Morning Briefing</span>
              </div>
              <Link href="/workflows" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.30)', textDecoration: 'none' }}>Manage →</Link>
            </div>
            <div style={{ padding: '10px 14px 12px' }}>
              {inCycleItems.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {inCycleItems.slice(0, 5).map((item: any) => (
                    <div key={item.id} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.62)', padding: '6px 8px', borderRadius: '7px', background: 'rgba(255,255,255,0.025)', lineHeight: 1.4 }}>
                      {item.linearIssueId && <span style={{ color: '#a78bfa', fontWeight: 600, marginRight: '5px' }}>{item.linearIssueId}</span>}
                      {item.linearTitle ?? item.dealName ?? 'In-cycle issue'}
                      {item.dealName && item.linearTitle && (
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '1px' }}>→ {item.dealName}</div>
                      )}
                    </div>
                  ))}
                  {inCycleItems.length > 5 && (
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', textAlign: 'center', padding: '2px 0' }}>+{inCycleItems.length - 5} more</div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.28)', lineHeight: 1.6 }}>
                    Your morning briefing will appear here once workflows run
                  </div>
                  <Link href="/workflows" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '10px', padding: '6px 12px', borderRadius: '7px', background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.20)', color: '#a78bfa', fontSize: '11px', fontWeight: 600, textDecoration: 'none' }}>
                    <Zap size={10} /> Go to Workflows
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Urgent deals */}
          {urgentDeals.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '9px' }}>
                <AlertTriangle size={10} style={{ color: '#f87171' }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Urgent</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {urgentDeals.map((deal: any) => (
                  <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                    <div
                      style={{
                        padding: '10px 12px', borderRadius: '10px',
                        background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.14)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.09)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.05)' }}
                    >
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                          {deal.prospectCompany ?? deal.dealName ?? 'Deal'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)', marginTop: '1px' }}>
                          Score: {deal.conversionScore ?? '—'} · {deal.stage?.replace('_', ' ')}
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: 'rgba(248,113,113,0.15)', color: '#f87171', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Review
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Recent MCP Activity */}
          {recentActions.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '9px' }}>
                <Sparkles size={10} style={{ color: 'rgba(255,255,255,0.35)' }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Recent MCP Activity</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {recentActions.map((action: any) => {
                  const emoji = actionEmoji[action.actionType] ?? '🤖'
                  const ago = action.createdAt ? timeAgo(action.createdAt) : ''
                  return (
                    <div
                      key={action.id}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                        padding: '7px 10px', borderRadius: '8px',
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                        cursor: action.dealId ? 'pointer' : 'default',
                        transition: 'background 0.12s',
                      }}
                      onClick={() => { if (action.dealId) window.location.href = `/deals/${action.dealId}` }}
                      onMouseEnter={e => { if (action.dealId) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
                    >
                      <span style={{ fontSize: '11px', flexShrink: 0, marginTop: '1px' }}>{emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.60)' }}>{action.label}</span>
                        {action.dealName && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginLeft: '5px' }}>· {action.dealName}</span>}
                        {action.linearIssueTitle && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.20)', marginLeft: '4px', fontStyle: 'italic' }}>&quot;{action.linearIssueTitle}&quot;</span>}
                      </div>
                      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.20)' }}>{ago}</span>
                        {action.dealId && <ArrowUpRight size={9} style={{ color: 'rgba(255,255,255,0.20)' }} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* All clear empty state */}
          {urgentDeals.length === 0 && recentActions.length === 0 && inCycleItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: '36px 16px', margin: 'auto' }}>
              <CheckCircle2 size={26} style={{ color: '#34d399', marginBottom: '12px' }} />
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.48)', fontWeight: 600 }}>Pipeline looks healthy</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.26)', marginTop: '5px', lineHeight: 1.6 }}>
                No urgent items. Run a workflow to see your morning briefing here.
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes sk { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.75); } }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }
      `}</style>
    </div>
  )
}
