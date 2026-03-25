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

function riskDotColor(score: number | null): string {
  if (!score || score <= 0) return 'rgba(226,232,240,0.20)'
  if (score >= 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
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
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '2px' }}>
          <AlertCircle size={12} color="var(--accent-warning)" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Signal</span>
          {signals.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 600, color: '#f59e0b', background: 'rgba(245,158,11,0.10)', padding: '1px 6px', borderRadius: '100px' }}>
              {signals.length}
            </span>
          )}
        </div>
        <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>
          {isLoading ? 'Loading…' : signals.length > 0
            ? `${signals.length} deal${signals.length !== 1 ? 's' : ''} with unactioned gaps`
            : 'No unactioned gaps'}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px' }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: '64px', borderRadius: '6px' }} className="skeleton" />)}
          </div>
        ) : signals.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {signals.map((deal: any) => (
              <div key={deal.id} style={{
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '2px solid #f59e0b',
              }}>
                {/* Row: dot + company + value */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: riskDotColor(deal.conversionScore), flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {deal.company}
                    </span>
                  </Link>
                  {deal.dealValue && (
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(deal.dealValue)}
                    </span>
                  )}
                </div>
                {/* Stage + CTA inline */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>
                    {deal.suggestedCount} gap{deal.suggestedCount !== 1 ? 's' : ''} · {deal.stage?.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => handleStartLoop(deal.id)}
                    disabled={startingLoop === deal.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '3px 10px', borderRadius: '5px',
                      background: 'rgba(124,109,245,0.08)', border: '1px solid rgba(124,109,245,0.22)',
                      color: '#00c8d4', fontSize: '10.5px', fontWeight: 500,
                      cursor: startingLoop === deal.id ? 'not-allowed' : 'pointer',
                      opacity: startingLoop === deal.id ? 0.55 : 1,
                      fontFamily: 'inherit', flexShrink: 0,
                    }}
                  >
                    <Zap size={9} />
                    {startingLoop === deal.id ? 'Starting…' : 'Start Loop'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 16px', margin: 'auto' }}>
            <CheckCircle2 size={20} style={{ color: 'var(--accent-success)', marginBottom: '10px' }} />
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>No signals yet</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', lineHeight: 1.6 }}>
              Add a deal to get started. Halvex will find matching Linear issues automatically.
            </div>
            <Link href="/deals" style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              marginTop: '12px', padding: '5px 12px', borderRadius: '5px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-default)',
              fontSize: '11px', color: 'var(--text-secondary)', textDecoration: 'none',
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
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {[1, 2].map(i => <div key={i} style={{ height: '52px', borderRadius: '6px' }} className="skeleton" />)}
      </div>
    )
  }
  if (inFlight.length === 0) {
    return (
      <div style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>No loops in flight yet</div>
      </div>
    )
  }

  const loopStageLabel: Record<string, { label: string; color: string }> = {
    awaiting_approval: { label: 'Awaiting PM approval', color: '#f59e0b' },
    in_cycle:          { label: 'In cycle', color: '#60a5fa' },
  }

  return (
    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {inFlight.map((deal: any) => {
        const stage = loopStageLabel[deal.loopStage] ?? loopStageLabel.in_cycle
        return (
          <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '7px 10px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderLeft: `2px solid ${stage.color}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {deal.company}
                  </div>
                  <div style={{ marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 500, color: stage.color }}>
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
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      height: '100%',
    }}>
      {/* In-Flight section at top */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Zap size={12} color="#60a5fa" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            In-Flight
          </span>
          {inFlight.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '100px', background: 'rgba(96,165,250,0.10)', color: '#60a5fa' }}>
              {inFlight.length}
            </span>
          )}
        </div>
        <InFlightSection inFlight={inFlight} isLoading={loopLoading} />
      </div>

      {/* Ask Halvex header */}
      <div style={{
        padding: '12px 16px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: '10px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '6px',
          background: 'rgba(124,109,245,0.07)', border: '1px solid rgba(124,109,245,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Brain size={13} color="#00c8d4" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Ask Halvex</span>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-success)', animation: 'pulse-dot 2.4s ease-in-out infinite' }} />
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '1px' }}>Ask about deals, competitors, or pipeline</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '20px 12px', maxWidth: '320px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>Your pipeline intelligence</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.65, marginBottom: '14px' }}>
              Ask about deals, win patterns, or what&apos;s blocking revenue.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {suggestedPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => { setInputText(prompt); inputRef.current?.focus() }}
                  style={{
                    padding: '6px 10px', borderRadius: '5px', textAlign: 'left',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
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
                maxWidth: '86%', padding: '8px 12px',
                borderRadius: msg.role === 'user' ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
                background: msg.role === 'user' ? '#111520' : 'rgba(255,255,255,0.03)',
                border: msg.role === 'user' ? '1px solid rgba(124,109,245,0.20)' : '1px solid rgba(255,255,255,0.06)',
                fontSize: '12.5px',
                color: msg.role === 'user' ? 'var(--text-primary)' : 'var(--text-secondary)',
                lineHeight: 1.65, whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))
        )}

        {chatLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '8px 12px', borderRadius: '10px 10px 10px 3px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#00c8d4', animation: `bounce 1.2s ${delay}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {intent && (
        <div style={{ padding: '0 16px 6px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ fontSize: '10.5px', color: '#00c8d4', background: 'rgba(124,109,245,0.07)', border: '1px solid rgba(124,109,245,0.18)', padding: '2px 9px', borderRadius: '100px' }}>
            {intent}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '8px 14px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '7px', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Ask anything about your pipeline..."
            rows={2}
            disabled={chatLoading}
            style={{
              flex: 1, resize: 'none', padding: '8px 11px',
              borderRadius: '6px', fontSize: '12.5px', lineHeight: 1.5,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              color: 'var(--text-primary)', outline: 'none',
              caretColor: '#00c8d4', fontFamily: 'inherit',
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(124,109,245,0.35)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.07)')}
          />
          <button
            type="submit"
            disabled={chatLoading || !inputText.trim()}
            style={{
              width: '34px', height: '34px', borderRadius: '6px', flexShrink: 0,
              background: chatLoading || !inputText.trim() ? 'rgba(255,255,255,0.04)' : 'rgba(124,109,245,0.14)',
              border: '1px solid ' + (chatLoading || !inputText.trim() ? 'rgba(255,255,255,0.07)' : 'rgba(124,109,245,0.28)'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: chatLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {chatLoading
              ? <RefreshCw size={13} color="rgba(226,232,240,0.35)" style={{ animation: 'spin 1s linear infinite' }} />
              : <Send size={13} color={inputText.trim() ? '#00c8d4' : 'rgba(226,232,240,0.25)'} />}
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
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '2px' }}>
          <CheckCircle2 size={12} color="var(--accent-success)" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Closed Loops</span>
          {closedCount > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '100px', background: 'rgba(16,185,129,0.10)', color: '#10b981' }}>
              {closedCount}
            </span>
          )}
        </div>
        <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>
          {isLoading ? 'Loading…' : closedCount > 0
            ? `${closedCount} loop${closedCount !== 1 ? 's' : ''} closed this week`
            : 'No loops closed this week'}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px' }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: '56px', borderRadius: '6px' }} className="skeleton" />)}
          </div>
        ) : closedLoops.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {closedLoops.map((loop: any) => (
              <Link key={loop.id} href={`/deals/${loop.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '8px 10px', borderRadius: '6px',
                  background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.14)',
                  borderLeft: '2px solid #10b981',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {loop.company}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#10b981', marginTop: '2px' }}>
                        {loop.issueCount} issue{loop.issueCount !== 1 ? 's' : ''} shipped
                      </div>
                    </div>
                    {loop.deployedAt && (
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        {timeAgo(loop.deployedAt)}
                      </span>
                    )}
                  </div>
                  {loop.dealValue && (
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(loop.dealValue)} at stake
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 16px', margin: 'auto' }}>
            <div style={{ fontSize: '20px', marginBottom: '10px', opacity: 0.4 }}>↻</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>No closed loops yet</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', lineHeight: 1.6 }}>
              When Linear issues ship and link back to deals, they appear here.
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
      /* Extra radial depth layer — main gradient visible through glass columns */
      background: 'radial-gradient(ellipse 60% 50% at 20% 40%, rgba(124,109,245,0.12), transparent)',
    }}>
      <SignalColumn />
      <AskHalvexColumn />
      <ClosedLoopsColumn />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  )
}
