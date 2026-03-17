'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, Zap, Target } from 'lucide-react'
import { fetcher, isDbNotConfigured } from '@/lib/fetcher'
import type { AIOverview } from '@/app/api/dashboard/ai-overview/route'

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return 'today'
}

function getStorageKey(generatedAt: string) {
  return `sellsight_actions_done_${generatedAt}`
}

export default function AIOverviewCard() {
  const [refreshing, setRefreshing] = useState(false)
  const [autoFailed, setAutoFailed] = useState(false)
  const [doneActions, setDoneActions] = useState<Record<number, boolean>>({})
  // Prevent the auto-generate effect from looping if the first attempt fails
  const autoAttempted = useRef(false)

  const { data, error, mutate } = useSWR<{ data: AIOverview; cached: boolean }>(
    '/api/dashboard/ai-overview',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )

  const overview: AIOverview | null = data?.data ?? null

  // Load persisted tick state from localStorage when overview changes
  useEffect(() => {
    if (!overview?.generatedAt) return
    try {
      const stored = localStorage.getItem(getStorageKey(overview.generatedAt))
      setDoneActions(stored ? JSON.parse(stored) : {})
    } catch {
      setDoneActions({})
    }
  }, [overview?.generatedAt])

  const toggleAction = useCallback((index: number) => {
    if (!overview?.generatedAt) return
    setDoneActions(prev => {
      const next = { ...prev, [index]: !prev[index] }
      try {
        localStorage.setItem(getStorageKey(overview.generatedAt), JSON.stringify(next))
      } catch { /* storage full */ }
      return next
    })
  }, [overview?.generatedAt])

  const handleRefresh = useCallback(async (isAuto = false) => {
    setRefreshing(true)
    if (isAuto) setAutoFailed(false)
    try {
      const res = await fetch('/api/dashboard/ai-overview', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await mutate()
    } catch {
      if (isAuto) setAutoFailed(true)
    } finally {
      setRefreshing(false)
    }
  }, [mutate])

  // Auto-generate ONCE on first visit if no cached overview exists.
  // Uses a ref guard so a failed attempt never triggers a loop.
  useEffect(() => {
    if (data && !data.data && !autoAttempted.current) {
      autoAttempted.current = true
      handleRefresh(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const dbNotConnected = isDbNotConfigured(error)
  if (dbNotConnected) return null

  const isLoading = (!data && !error) || (refreshing && !overview)
  const allDone = overview && overview.keyActions.length > 0 &&
    overview.keyActions.every((_, i) => doneActions[i])

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--card-bg)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid var(--card-border)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '300px', height: '200px',
        background: 'radial-gradient(ellipse at top right, var(--accent-subtle), transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        borderBottom: '1px solid var(--accent-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'var(--accent-subtle)',
            border: '1px solid var(--accent-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px var(--accent-subtle)',
          }}>
            <Sparkles size={14} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Brain Briefing
          </span>
          {allDone && (
            <span style={{
              fontSize: '10px', color: 'var(--success)',
              background: 'color-mix(in srgb, var(--success) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)',
              padding: '2px 8px', borderRadius: '100px', fontWeight: '600',
            }}>
              All done ✓
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {overview?.generatedAt && (
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              Updated {formatAge(overview.generatedAt)}
            </span>
          )}
          <button
            onClick={() => handleRefresh()}
            disabled={refreshing || isLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 11px', borderRadius: '7px',
              background: 'var(--accent-subtle)',
              border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
              color: refreshing ? 'var(--text-tertiary)' : 'var(--accent)',
              fontSize: '11px', fontWeight: '600', cursor: refreshing ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              if (!refreshing) (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--accent) 14%, transparent)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--accent-subtle)'
            }}
          >
            <RefreshCw size={11} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Generating…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Loading skeleton */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[90, 70, 55].map((w, i) => (
              <div key={i} style={{
                height: '12px', borderRadius: '6px', width: `${w}%`,
                background: 'var(--accent-subtle)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        )}

        {/* Auto-generate failed (one-shot) — show prompt to retry manually */}
        {autoFailed && !overview && !refreshing && (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '4px 0' }}>
            Couldn&apos;t generate overview automatically. Hit <strong style={{ color: 'var(--accent)' }}>Refresh</strong> to try again.
          </div>
        )}

        {/* SWR fetch error */}
        {error && !dbNotConnected && (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '4px 0' }}>
            Could not load AI overview. Hit refresh to try again.
          </div>
        )}

        {overview && (
          <>
            {/* Summary + Pipeline Health row */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.65',
                  margin: 0, fontWeight: '400',
                }}>
                  {overview.summary}
                </p>
              </div>

              <div style={{
                flexShrink: 0,
                background: 'var(--accent-subtle)',
                border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                borderRadius: '10px',
                padding: '8px 12px',
                maxWidth: '200px',
              }}>
                <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {overview.briefingHealth && (
                    <span style={{
                      display: 'inline-block',
                      width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                      background: overview.briefingHealth === 'green' ? 'var(--success)' : overview.briefingHealth === 'amber' ? 'var(--warning)' : 'var(--danger)',
                      boxShadow: overview.briefingHealth === 'green'
                        ? '0 0 5px color-mix(in srgb, var(--success) 60%, transparent)'
                        : overview.briefingHealth === 'amber'
                        ? '0 0 5px color-mix(in srgb, var(--warning) 60%, transparent)'
                        : '0 0 5px color-mix(in srgb, var(--danger) 60%, transparent)',
                    }} />
                  )}
                  Pipeline Health
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600', lineHeight: '1.3' }}>
                  {overview.pipelineHealth}
                </div>
              </div>
            </div>

            {/* Key Actions — tickable */}
            {overview.keyActions.length > 0 && (
              <div style={{
                background: 'var(--accent-subtle)',
                border: '1px solid color-mix(in srgb, var(--accent) 12%, transparent)',
                borderRadius: '10px',
                padding: '10px 14px',
              }}>
                <div style={{
                  fontSize: '10px', color: 'var(--accent)', fontWeight: '700',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  <Zap size={10} style={{ color: 'var(--accent)' }} /> Actions for today
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {overview.keyActions.map((action, i) => {
                    const done = !!doneActions[i]
                    return (
                      <button
                        key={i}
                        onClick={() => toggleAction(i)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '9px',
                          background: 'none', border: 'none', padding: '3px 2px',
                          cursor: 'pointer', textAlign: 'left', width: '100%',
                          borderRadius: '6px',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--accent) 7%, transparent)'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = 'none'
                        }}
                      >
                        {/* Custom checkbox */}
                        <div style={{
                          width: '15px', height: '15px', borderRadius: '4px', flexShrink: 0,
                          marginTop: '1px',
                          border: done ? '1.5px solid var(--accent)' : '1.5px solid color-mix(in srgb, var(--accent) 35%, transparent)',
                          background: done ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {done && (
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                              <path d="M1 3.5L3.5 6L8 1" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span style={{
                          fontSize: '12px',
                          color: done ? 'var(--text-tertiary)' : 'var(--text-primary)',
                          lineHeight: '1.5',
                          textDecoration: done ? 'line-through' : 'none',
                          transition: 'all 0.15s',
                        }}>
                          {action}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Single Most Important Action */}
            {overview.singleMostImportantAction && (
              <div style={{
                borderLeft: '3px solid var(--accent)',
                paddingLeft: '12px',
                paddingTop: '6px',
                paddingBottom: '6px',
                paddingRight: '10px',
                background: 'var(--accent-subtle)',
                borderRadius: '0 8px 8px 0',
              }}>
                <div style={{
                  fontSize: '10px', color: 'var(--accent)', fontWeight: '700',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  <Target size={10} style={{ color: 'var(--accent)' }} /> Top priority
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', lineHeight: '1.45' }}>
                  {overview.singleMostImportantAction}
                </div>
              </div>
            )}

            {/* Needs Attention deals */}
            {overview.topAttentionDeals && overview.topAttentionDeals.length > 0 && (
              <div style={{
                background: 'color-mix(in srgb, var(--danger) 4%, transparent)',
                border: '1px solid color-mix(in srgb, var(--danger) 14%, transparent)',
                borderRadius: '10px',
                padding: '10px 14px',
              }}>
                <div style={{
                  fontSize: '10px', color: 'var(--danger)', fontWeight: '700',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  <AlertTriangle size={10} style={{ color: 'var(--danger)' }} /> Needs Attention
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {overview.topAttentionDeals.map((deal, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{
                        display: 'inline-block', flexShrink: 0, marginTop: '3px',
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: deal.urgency === 'high' ? 'var(--danger)' : 'var(--warning)',
                        boxShadow: deal.urgency === 'high' ? '0 0 4px color-mix(in srgb, var(--danger) 70%, transparent)' : '0 0 4px color-mix(in srgb, var(--warning) 70%, transparent)',
                      }} />
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600' }}>
                          {deal.dealName}
                        </span>
                        {deal.company && (
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: '5px' }}>
                            {deal.company}
                          </span>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '1px' }}>
                          {deal.reason}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Momentum + Top Risk row */}
            {(overview.momentum || overview.topRisk) && (
              <div style={{ display: 'flex', gap: '10px' }}>
                {overview.momentum && (
                  <div style={{
                    flex: 1,
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    background: 'color-mix(in srgb, var(--success) 5%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--success) 12%, transparent)',
                    borderRadius: '9px', padding: '8px 12px',
                  }}>
                    <TrendingUp size={13} style={{ color: 'var(--success)', marginTop: '1px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                        Momentum
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {overview.momentum}
                      </div>
                    </div>
                  </div>
                )}
                {overview.topRisk && (
                  <div style={{
                    flex: 1,
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    background: 'color-mix(in srgb, var(--danger) 5%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--danger) 12%, transparent)',
                    borderRadius: '9px', padding: '8px 12px',
                  }}>
                    <AlertTriangle size={13} style={{ color: 'var(--danger)', marginTop: '1px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                        Top Risk
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {overview.topRisk}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}
