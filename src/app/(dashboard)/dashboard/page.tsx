'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Send, RefreshCw, Brain, Zap, CheckCircle2,
  ArrowUpRight, Clock, AlertCircle,
} from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type ChatMessage = { role: 'user' | 'assistant'; content: string }

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatCurrency(n: number | string | null): string {
  if (!n) return ''
  const v = Number(n)
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`
  return `$${Math.round(v)}`
}

// ─── Left Column: Signal ─────────────────────────────────────────────────────
function SignalColumn() {
  const { data, isLoading } = useSWR('/api/dashboard/loop-signals', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 60000,
  })
  const signals: any[] = data?.data?.signals ?? []
  const [startingLoop, setStartingLoop] = useState<string | null>(null)

  async function handleStartLoop(dealId: string) {
    setStartingLoop(dealId)
    try {
      await fetch(`/api/deals/${dealId}/start-loop`, { method: 'POST' })
    } finally {
      setStartingLoop(null)
    }
  }

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 20px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <AlertCircle size={14} color="var(--accent-warning)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Signal</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          {isLoading ? 'Loading…' : signals.length > 0
            ? `${signals.length} deal${signals.length !== 1 ? 's' : ''} with unactioned gaps`
            : 'No unactioned gaps'}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px' }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: '72px', borderRadius: '8px' }} className="skeleton" />)}
          </div>
        ) : signals.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {signals.map((deal: any) => (
              <div key={deal.id} style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-subtle)',
                borderLeft: '3px solid var(--accent-warning)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                  <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {deal.company}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      {deal.suggestedCount} matching issue{deal.suggestedCount !== 1 ? 's' : ''} · {deal.stage}
                    </div>
                  </Link>
                  {deal.dealValue && (
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
                      {formatCurrency(deal.dealValue)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleStartLoop(deal.id)}
                  disabled={startingLoop === deal.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                    color: 'var(--accent-primary)', fontSize: '11px', fontWeight: 600,
                    cursor: startingLoop === deal.id ? 'not-allowed' : 'pointer',
                    opacity: startingLoop === deal.id ? 0.6 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  <Zap size={10} />
                  {startingLoop === deal.id ? 'Starting…' : 'Start Loop'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 16px', margin: 'auto' }}>
            <CheckCircle2 size={24} style={{ color: 'var(--accent-success)', marginBottom: '10px' }} />
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>No signals yet</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', lineHeight: 1.6 }}>
              Add a deal to get started. Halvex will find matching Linear issues automatically.
            </div>
            <Link href="/deals" style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              marginTop: '12px', padding: '6px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-glass)', border: '1px solid var(--border-default)',
              fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none',
            }}>
              Add a deal <ArrowUpRight size={10} />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Middle Column: In-Flight + Ask Halvex ────────────────────────────────────
function InFlightSection({ inFlight, isLoading }: { inFlight: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[1, 2].map(i => <div key={i} style={{ height: '60px', borderRadius: '8px' }} className="skeleton" />)}
      </div>
    )
  }
  if (inFlight.length === 0) {
    return (
      <div style={{ padding: '16px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No loops in flight yet</div>
      </div>
    )
  }

  const loopStageLabel: Record<string, { label: string; color: string; bg: string }> = {
    awaiting_approval: { label: 'Awaiting PM approval', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
    in_cycle:          { label: 'In cycle', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)' },
  }

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {inFlight.map((deal: any) => {
        const stage = loopStageLabel[deal.loopStage] ?? loopStageLabel.in_cycle
        return (
          <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '9px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
              borderLeft: `3px solid ${stage.color}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {deal.company}
                  </div>
                  <div style={{ marginTop: '3px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 7px', borderRadius: '100px', background: stage.bg, fontSize: '10px', fontWeight: 600, color: stage.color }}>
                    {deal.loopStage === 'awaiting_approval' && <Clock size={9} />}
                    {stage.label}
                  </div>
                </div>
                {deal.pendingActionCreatedAt && (
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {timeAgo(deal.pendingActionCreatedAt)}
                  </span>
                )}
              </div>
              {deal.inCycleIssues?.length > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {deal.inCycleIssues.map((i: any) => i.linearIssueId).join(' · ')}
                </div>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function AskHalvexColumn() {
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data

  const { data: loopData, isLoading: loopLoading } = useSWR('/api/dashboard/loop-signals', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 60000,
  })
  const inFlight: any[] = loopData?.data?.inFlight ?? []

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [intent, setIntent] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const suggestedPrompts = (() => {
    const prompts: string[] = []
    const topComp = brain?.competitivePatterns?.[0]?.competitor
    if (topComp) prompts.push(`Why are we losing to ${topComp}?`)
    const topUrgent = brain?.urgentDeals?.[0]
    if (topUrgent) prompts.push(`What's blocking ${topUrgent.company}?`)
    prompts.push('Which deal is closest to closing?')
    prompts.push('Summarise pipeline health')
    return prompts.slice(0, 4)
  })()

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    const q = inputText.trim()
    if (!q || chatLoading) return
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setInputText('')
    setChatLoading(true)
    setIntent('Thinking…')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      })
      const json = await res.json()
      if (json.intent) setIntent(json.intent)
      else setIntent(null)
      setMessages(prev => [...prev, { role: 'assistant', content: json.reply ?? json.message ?? json.data?.reply ?? 'No response' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to get a response. Try again.' }])
    } finally {
      setChatLoading(false)
      setIntent(null)
    }
  }

  return (
    <div style={{
      background: 'var(--bg-surface)',
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border-subtle)',
      height: '100%',
    }}>
      {/* In-Flight section at top */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={13} color="#60a5fa" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
            In-Flight
            {inFlight.length > 0 && (
              <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '100px', background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                {inFlight.length}
              </span>
            )}
          </span>
        </div>
        <InFlightSection inFlight={inFlight} isLoading={loopLoading} />
      </div>

      {/* Ask Halvex header */}
      <div style={{
        padding: '14px 22px 10px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: '12px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-hero)', border: '1px solid rgba(99,102,241,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Brain size={14} color="var(--accent-primary)" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Ask Halvex</span>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-success)', animation: 'pulse-dot 2.4s ease-in-out infinite' }} />
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '1px' }}>Ask about deals, competitors, or pipeline</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '24px 16px', maxWidth: '340px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Your pipeline intelligence</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.7, marginBottom: '16px' }}>
              Ask about deals, win patterns, or what&apos;s blocking revenue.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {suggestedPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => { setInputText(prompt); inputRef.current?.focus() }}
                  style={{
                    padding: '7px 12px', borderRadius: 'var(--radius-sm)', textAlign: 'left',
                    background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
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
                maxWidth: '86%', padding: '9px 13px',
                borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-glass)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                fontSize: '13px',
                color: msg.role === 'user' ? '#fff' : 'var(--text-secondary)',
                lineHeight: 1.65, whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))
        )}

        {chatLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '9px 13px', borderRadius: '12px 12px 12px 3px', background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-primary)', animation: `bounce 1.2s ${delay}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {intent && (
        <div style={{ padding: '0 20px 8px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--accent-primary)', background: 'var(--bg-hero)', border: '1px solid rgba(99,102,241,0.20)', padding: '3px 10px', borderRadius: '100px' }}>
            {intent}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 18px 14px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Ask anything about your pipeline..."
            rows={2}
            disabled={chatLoading}
            style={{
              flex: 1, resize: 'none', padding: '9px 13px',
              borderRadius: 'var(--radius-sm)', fontSize: '13px', lineHeight: 1.5,
              background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', outline: 'none',
              caretColor: 'var(--accent-primary)', fontFamily: 'inherit',
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.40)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
          />
          <button
            type="submit"
            disabled={chatLoading || !inputText.trim()}
            style={{
              width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
              background: 'var(--accent-primary)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: chatLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
              opacity: chatLoading || !inputText.trim() ? 0.4 : 1,
            }}
          >
            {chatLoading
              ? <RefreshCw size={15} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
              : <Send size={15} color="#fff" />}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Right Column: Closed Loops ───────────────────────────────────────────────
function ClosedLoopsColumn() {
  const { data, isLoading } = useSWR('/api/dashboard/loop-signals', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 60000,
  })
  const closedLoops: any[] = data?.data?.closedLoops ?? []
  const closedCount: number = data?.data?.closedCount ?? 0

  return (
    <div style={{
      background: 'var(--bg-surface)',
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 18px 14px',
        borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <CheckCircle2 size={14} color="var(--accent-success)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Closed Loops</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          {isLoading ? 'Loading…' : closedCount > 0
            ? `${closedCount} loop${closedCount !== 1 ? 's' : ''} closed this week`
            : 'No loops closed this week'}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px' }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: '64px', borderRadius: '8px' }} className="skeleton" />)}
          </div>
        ) : closedLoops.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {closedLoops.map((loop: any) => (
              <Link key={loop.id} href={`/deals/${loop.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.18)',
                  borderLeft: '3px solid var(--accent-success)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {loop.company}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--accent-success)', marginTop: '2px' }}>
                        ✓ {loop.issueCount} issue{loop.issueCount !== 1 ? 's' : ''} shipped
                      </div>
                    </div>
                    {loop.deployedAt && (
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        {timeAgo(loop.deployedAt)}
                      </span>
                    )}
                  </div>
                  {loop.dealValue && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(loop.dealValue)} at stake
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 16px', margin: 'auto' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔄</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>No closed loops yet</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', lineHeight: 1.6 }}>
              When Linear issues ship and link back to deals, closed loops will appear here.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const colHeight = 'calc(100vh - 96px)'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '28% 44% 28%',
      height: colHeight,
      overflow: 'hidden',
      margin: '-22px -24px',
    }}>
      <SignalColumn />
      <AskHalvexColumn />
      <ClosedLoopsColumn />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  )
}
