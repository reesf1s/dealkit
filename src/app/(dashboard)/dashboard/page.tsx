'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  AlertTriangle, ArrowUpRight, Brain, Send,
  RefreshCw, Zap, CheckCircle2, TrendingDown,
  GitBranch, Layers,
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

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `£${Math.round(n / 1_000)}k`
  return `£${Math.round(n)}`
}

const STAGE_LABELS: Record<string, string> = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
}

const RISK_COLORS: Record<string, string> = {
  high: 'var(--accent-danger)',
  medium: 'var(--accent-warning)',
  low: 'var(--accent-success)',
}

// ─── Left Column: Revenue at Risk ────────────────────────────────────────────
function RevenueAtRiskColumn() {
  const { data, isLoading } = useSWR('/api/dashboard/summary', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120000,
  })
  const summary = data?.data

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 20px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <TrendingDown size={14} color="var(--accent-danger)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Revenue at Risk</span>
        </div>
        {isLoading ? (
          <div style={{ height: '18px', width: '120px', borderRadius: '4px' }} className="skeleton" />
        ) : summary ? (
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent-danger)', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {formatCurrency(summary.revenueAtRisk)}
            <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '6px' }}>
              across {summary.dealsAtRisk} deal{summary.dealsAtRisk !== 1 ? 's' : ''}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>No open deals</div>
        )}
      </div>

      {/* Deal list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: '72px', borderRadius: '8px' }} className="skeleton" />
            ))}
          </div>
        ) : summary?.topDeals?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {summary.topDeals.map((deal: any) => (
              <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-glass)',
                    border: `1px solid var(--border-subtle)`,
                    borderLeft: `3px solid ${RISK_COLORS[deal.riskLevel]}`,
                    transition: 'background var(--transition-fast)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {deal.company ?? deal.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        {STAGE_LABELS[deal.stage] ?? deal.stage}
                        {deal.daysStale > 0 && ` · ${deal.daysStale}d stale`}
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(deal.value)}
                    </div>
                  </div>
                  {deal.primaryBlocker && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Missing: {deal.primaryBlocker}
                    </div>
                  )}
                  <div style={{
                    marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '2px 8px', borderRadius: '100px',
                    background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.20)',
                    fontSize: '11px', fontWeight: 500, color: '#818cf8',
                  }}>
                    {deal.topAction}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <CheckCircle2 size={24} style={{ color: 'var(--accent-success)', marginBottom: '10px' }} />
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Pipeline looks healthy</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>No at-risk deals detected</div>
            <Link href="/deals" style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              marginTop: '12px', padding: '6px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-glass)', border: '1px solid var(--border-default)',
              fontSize: '12px', color: 'var(--text-secondary)',
            }}>
              View deals <ArrowUpRight size={10} />
            </Link>
          </div>
        )}
      </div>

      {/* Focus bullets */}
      {!isLoading && summary?.focusBullets?.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '12px 16px',
          flexShrink: 0,
          background: 'var(--bg-hero)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            What to focus on
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {summary.focusBullets.map((bullet: string, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '1px' }}>•</span>
                {bullet}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Middle Column: Ask Halvex ────────────────────────────────────────────────
function AskHalvexColumn() {
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [intent, setIntent] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  // Dynamic suggested prompts from brain data
  const suggestedPrompts = (() => {
    const prompts: string[] = []
    const topComp = brain?.competitivePatterns?.[0]?.competitor
    if (topComp) prompts.push(`Why are we losing to ${topComp}?`)
    const topUrgent = brain?.urgentDeals?.[0]
    if (topUrgent) prompts.push(`What's blocking ${topUrgent.company}?`)
    prompts.push('Which deal is closest to closing?')
    prompts.push('Summarise our pipeline health')
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
      // Detect intent from response metadata
      if (json.intent) setIntent(json.intent)
      else setIntent(null)
      const reply = json.reply ?? json.message ?? json.data?.reply ?? 'No response'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
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
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--border-subtle)',
      height: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 22px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: '12px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-hero)',
          border: '1px solid rgba(99,102,241,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Brain size={16} color="var(--accent-primary)" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Ask Halvex</span>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--accent-success)',
              animation: 'pulse-dot 2.4s ease-in-out infinite',
            }} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>Ask about deals, competitors, or pipeline</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '32px 16px', maxWidth: '340px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Your pipeline intelligence</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.7, marginBottom: '20px' }}>
              Ask about deals, win patterns, or what&apos;s blocking revenue.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {suggestedPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => { setInputText(prompt); inputRef.current?.focus() }}
                  style={{
                    padding: '8px 14px', borderRadius: 'var(--radius-sm)', textAlign: 'left',
                    background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass)'
                    ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'
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
                maxWidth: '86%',
                padding: '9px 13px',
                borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-glass)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                fontSize: '13px',
                color: msg.role === 'user' ? '#fff' : 'var(--text-secondary)',
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                backdropFilter: msg.role === 'assistant' ? 'blur(16px)' : undefined,
              }}>
                {msg.content}
              </div>
            </div>
          ))
        )}

        {chatLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '9px 13px', borderRadius: '12px 12px 12px 3px',
              background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div key={i} style={{
                    width: '5px', height: '5px', borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    animation: `bounce 1.2s ${delay}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Intent chip */}
      {intent && (
        <div style={{
          padding: '0 20px 8px', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <div style={{
            fontSize: '11px', color: 'var(--accent-primary)',
            background: 'var(--bg-hero)', border: '1px solid rgba(99,102,241,0.20)',
            padding: '3px 10px', borderRadius: '100px',
          }}>
            {intent}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '12px 18px 16px',
        borderTop: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
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
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', outline: 'none',
              caretColor: 'var(--accent-primary)', fontFamily: 'inherit',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.40)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
          />
          <button
            type="submit"
            disabled={chatLoading || !inputText.trim()}
            style={{
              width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
              background: 'var(--accent-primary)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: chatLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
              opacity: chatLoading || !inputText.trim() ? 0.4 : 1,
              transition: 'opacity var(--transition-fast)',
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

// ─── Right Column: Product Signal ────────────────────────────────────────────
function ProductSignalColumn() {
  const { data, isLoading } = useSWR('/api/dashboard/product-signals', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120000,
  })
  const signals = data?.data

  return (
    <div style={{
      background: 'var(--bg-surface)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 18px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={14} color="var(--accent-warning)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Product Signal</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Gaps costing revenue</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Product Gaps */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Product Gaps
          </div>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: '56px', borderRadius: '8px' }} className="skeleton" />
              ))}
            </div>
          ) : signals?.gaps?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {signals.gaps.map((gap: any, i: number) => (
                <Link key={i} href="/product-gaps" style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '9px 12px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                    transition: 'background var(--transition-fast)',
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {gap.title}
                      </span>
                      {gap.linkedLinearIssueId ? (
                        <span style={{ fontSize: '10px', color: 'var(--accent-success)', flexShrink: 0, marginLeft: '8px' }}>● In cycle</span>
                      ) : (
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: '8px' }}>○ No issue</span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(gap.revenueAtRisk)} · {gap.dealsBlocked} deal{gap.dealsBlocked !== 1 ? 's' : ''}
                    </div>
                  </div>
                </Link>
              ))}
              <Link href="/product-gaps" style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px',
                fontSize: '11px', color: 'var(--accent-primary)',
              }}>
                All gaps <ArrowUpRight size={10} />
              </Link>
            </div>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <GitBranch size={18} style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }} />
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No gaps logged yet</div>
              <Link href="/product-gaps" style={{ fontSize: '11px', color: 'var(--accent-primary)', marginTop: '6px', display: 'inline-block' }}>
                Add product gap →
              </Link>
            </div>
          )}
        </div>

        {/* Loop Activity */}
        {!isLoading && signals?.recentLoops?.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Loop Activity
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {signals.recentLoops.map((loop: any) => (
                <div key={loop.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                }}>
                  <Zap size={11} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {loop.issueId && <span style={{ color: 'var(--accent-primary)', fontWeight: 600, marginRight: '4px' }}>{loop.issueId}</span>}
                      {loop.label}
                    </div>
                    {loop.dealName && (
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '1px' }}>→ {loop.dealName}</div>
                    )}
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {timeAgo(loop.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent AI Actions */}
        {!isLoading && signals?.recentActions?.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Recent AI Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {signals.recentActions.map((action: any) => (
                <div
                  key={action.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                    cursor: action.dealId ? 'pointer' : 'default',
                    transition: 'background var(--transition-fast)',
                  }}
                  onClick={() => { if (action.dealId) window.location.href = `/deals/${action.dealId}` }}
                  onMouseEnter={e => { if (action.dealId) (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass)' }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1 }}>{action.label}</span>
                  {action.dealName && (
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{action.dealName}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !signals?.gaps?.length && !signals?.recentLoops?.length && !signals?.recentActions?.length && (
          <div style={{ textAlign: 'center', padding: '40px 16px', margin: 'auto' }}>
            <Layers size={24} style={{ color: 'var(--text-tertiary)', marginBottom: '10px' }} />
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>No signals yet</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', lineHeight: 1.6 }}>
              Product gaps appear as you log deal notes.
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
      <RevenueAtRiskColumn />
      <AskHalvexColumn />
      <ProductSignalColumn />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }
      `}</style>
    </div>
  )
}
