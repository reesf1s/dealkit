'use client'

import { useState, useCallback, useEffect } from 'react'
import useSWR from 'swr'
import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, Zap } from 'lucide-react'
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
  return `dealkit_actions_done_${generatedAt}`
}

export default function AIOverviewCard() {
  const [refreshing, setRefreshing] = useState(false)
  const [doneActions, setDoneActions] = useState<Record<number, boolean>>({})

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetch('/api/dashboard/ai-overview', { method: 'POST' })
      await mutate()
    } catch {
      // silent
    } finally {
      setRefreshing(false)
    }
  }, [mutate])

  // Auto-generate on first visit if no cached overview exists
  useEffect(() => {
    if (data && !data.data && !refreshing) {
      handleRefresh()
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
        background: 'linear-gradient(135deg, rgba(18,12,38,0.95) 0%, rgba(22,12,44,0.95) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 0 40px rgba(99,102,241,0.12), inset 0 1px 0 rgba(139,92,246,0.15)',
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '300px', height: '200px',
        background: 'radial-gradient(ellipse at top right, rgba(99,102,241,0.12), transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        borderBottom: '1px solid rgba(139,92,246,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
            border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(99,102,241,0.2)',
          }}>
            <Sparkles size={14} color="#A78BFA" />
          </div>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#F0EEFF', letterSpacing: '-0.01em' }}>
            AI Overview
          </span>
          {allDone && (
            <span style={{
              fontSize: '10px', color: '#22C55E',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.2)',
              padding: '2px 8px', borderRadius: '100px', fontWeight: '600',
            }}>
              All done ✓
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {overview?.generatedAt && (
            <span style={{ fontSize: '11px', color: '#555' }}>
              Updated {formatAge(overview.generatedAt)}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 11px', borderRadius: '7px',
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              color: refreshing ? '#555' : '#818CF8',
              fontSize: '11px', fontWeight: '600', cursor: refreshing ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              if (!refreshing) (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.14)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)'
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
                background: 'rgba(255,255,255,0.05)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !dbNotConnected && (
          <div style={{ fontSize: '13px', color: '#9CA3AF', padding: '4px 0' }}>
            Could not load AI overview. Hit refresh to try again.
          </div>
        )}

        {overview && (
          <>
            {/* Summary + Pipeline Health row */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: '13px', color: '#C4B5FD', lineHeight: '1.65',
                  margin: 0, fontWeight: '400',
                }}>
                  {overview.summary}
                </p>
              </div>

              <div style={{
                flexShrink: 0,
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: '10px',
                padding: '8px 12px',
                maxWidth: '200px',
              }}>
                <div style={{ fontSize: '10px', color: '#6366F1', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pipeline Health
                </div>
                <div style={{ fontSize: '12px', color: '#F0EEFF', fontWeight: '600', lineHeight: '1.3' }}>
                  {overview.pipelineHealth}
                </div>
              </div>
            </div>

            {/* Key Actions — tickable */}
            {overview.keyActions.length > 0 && (
              <div style={{
                background: 'rgba(99,102,241,0.05)',
                border: '1px solid rgba(99,102,241,0.12)',
                borderRadius: '10px',
                padding: '10px 14px',
              }}>
                <div style={{
                  fontSize: '10px', color: '#818CF8', fontWeight: '700',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  <Zap size={10} color="#818CF8" /> Actions for today
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
                          (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.07)'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = 'none'
                        }}
                      >
                        {/* Custom checkbox */}
                        <div style={{
                          width: '15px', height: '15px', borderRadius: '4px', flexShrink: 0,
                          marginTop: '1px',
                          border: done ? '1.5px solid #6366F1' : '1.5px solid rgba(99,102,241,0.35)',
                          background: done ? 'rgba(99,102,241,0.25)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {done && (
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                              <path d="M1 3.5L3.5 6L8 1" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span style={{
                          fontSize: '12px',
                          color: done ? '#4B5563' : '#E0D9FF',
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

            {/* Momentum + Top Risk row */}
            {(overview.momentum || overview.topRisk) && (
              <div style={{ display: 'flex', gap: '10px' }}>
                {overview.momentum && (
                  <div style={{
                    flex: 1,
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    background: 'rgba(34,197,94,0.05)',
                    border: '1px solid rgba(34,197,94,0.12)',
                    borderRadius: '9px', padding: '8px 12px',
                  }}>
                    <TrendingUp size={13} color="#22C55E" style={{ marginTop: '1px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '10px', color: '#22C55E', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                        Momentum
                      </div>
                      <div style={{ fontSize: '12px', color: '#D1FAE5', lineHeight: '1.4' }}>
                        {overview.momentum}
                      </div>
                    </div>
                  </div>
                )}
                {overview.topRisk && (
                  <div style={{
                    flex: 1,
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    background: 'rgba(239,68,68,0.05)',
                    border: '1px solid rgba(239,68,68,0.12)',
                    borderRadius: '9px', padding: '8px 12px',
                  }}>
                    <AlertTriangle size={13} color="#EF4444" style={{ marginTop: '1px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '10px', color: '#EF4444', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                        Top Risk
                      </div>
                      <div style={{ fontSize: '12px', color: '#FECACA', lineHeight: '1.4' }}>
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
