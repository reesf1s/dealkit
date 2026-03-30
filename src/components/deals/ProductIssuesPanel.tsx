'use client'

/**
 * ProductIssuesPanel
 *
 * Shows Linear issues linked to a deal — confirmed (●) and suggested (○).
 * Reps can confirm or dismiss suggestions.
 * Non-breaking: renders nothing if Linear isn't connected for the workspace.
 *
 * ┌─────────────────────────────────────────────────────┐
 * │ Product Issues                            [+ Link]  │
 * ├─────────────────────────────────────────────────────┤
 * │ ● #36  Bulk CSV Export          High  · In Cycle ↗  │
 * │ ○ #279 API Rate Limit Increase  Med   · Backlog      │
 * └─────────────────────────────────────────────────────┘
 */

import Link from 'next/link'
import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { ExternalLink, Plus, Check, X, Loader2, ChevronDown, ChevronUp, Copy, Sparkles } from 'lucide-react'
import { useToast } from '@/components/shared/Toast'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DealLinearLink {
  id: string
  linearIssueId: string
  linearIssueUrl: string | null
  linearTitle: string | null
  relevanceScore: number
  linkType: string
  status: 'suggested' | 'confirmed' | 'dismissed' | 'in_cycle' | 'deployed'
  hasReleaseEmail?: boolean
  scopedUserStory: string | null
  addressesRisk: string | null
  cycleId: string | null
  assigneeName: string | null
  createdAt: string
}

interface LinearStatus {
  connected: boolean
  degraded?: boolean
  syncError?: string | null
  issueCount?: number
  teamName?: string | null
  matchingMode?: string
  matchingSummary?: string
}

interface DealLinksResponse {
  data: DealLinearLink[]
  meta?: {
    mode?: string
    reviewPrompt?: string
  }
}

const fetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error('Fetch failed')
    return r.json()
  })

// ─────────────────────────────────────────────────────────────────────────────
// Priority label helpers
// ─────────────────────────────────────────────────────────────────────────────

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'High', color: 'var(--red, #EF4444)' }
  if (score >= 70) return { label: 'Med', color: 'var(--yellow, #F59E0B)' }
  return { label: 'Low', color: 'var(--text-tertiary, #888)' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  dealId: string
}

export function ProductIssuesPanel({ dealId }: Props) {
  const { toast } = useToast()
  const [linkInput, setLinkInput] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null) // linkId being acted on
  const [expandedStory, setExpandedStory] = useState<string | null>(null) // linkId with expanded user story

  // Check if Linear is connected for this workspace
  const { data: statusData, error: statusError } = useSWR<{ data: LinearStatus }>(
    '/api/integrations/linear/status',
    fetcher,
    { revalidateOnFocus: false },
  )

  // Fetch links for this deal
  const {
    data: linksData,
    error: linksError,
    mutate: mutateLinks,
  } = useSWR<DealLinksResponse>(
    statusData?.data?.connected ? `/api/deals/${dealId}/linear-links` : null,
    fetcher,
  )

  const handleConfirm = useCallback(async (link: DealLinearLink) => {
    setActionLoading(link.id)
    try {
      const res = await fetch(`/api/deals/${dealId}/linear-links/${link.id}/confirm`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to confirm')
      await mutateLinks()
      toast(`${link.linearIssueId} linked to this deal`, 'success')
    } catch {
      toast('Could not confirm link', 'error')
    } finally {
      setActionLoading(null)
    }
  }, [dealId, mutateLinks, toast])

  const handleDismiss = useCallback(async (link: DealLinearLink) => {
    setActionLoading(link.id)
    try {
      const res = await fetch(`/api/deals/${dealId}/linear-links/${link.id}/dismiss`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to dismiss')
      await mutateLinks()
    } catch {
      toast('Could not dismiss link', 'error')
    } finally {
      setActionLoading(null)
    }
  }, [dealId, mutateLinks, toast])

  const handleManualLink = useCallback(async () => {
    const issueId = linkInput.trim()
    if (!issueId) return
    setActionLoading('new')
    try {
      const res = await fetch(`/api/deals/${dealId}/linear-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linearIssueId: issueId }),
      })
      if (!res.ok) throw new Error('Failed to link')
      await mutateLinks()
      setLinkInput('')
      setShowLinkInput(false)
      toast(`${issueId} linked to this deal`, 'success')
    } catch {
      toast('Could not link issue', 'error')
    } finally {
      setActionLoading(null)
    }
  }, [dealId, linkInput, mutateLinks, toast])

  const handleCopyReviewPrompt = useCallback(async () => {
    const prompt = linksData?.meta?.reviewPrompt
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      toast('Claude review prompt copied', 'success')
    } catch {
      toast('Could not copy prompt', 'error')
    }
  }, [linksData?.meta?.reviewPrompt, toast])

  const loadingStatus = !statusData && !statusError

  if (loadingStatus) {
    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: 'var(--text-tertiary)',
        fontSize: '12px',
      }}>
        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
        Checking Linear and MCP issue-linking status...
      </div>
    )
  }

  if (statusError) {
    return (
      <div style={{
        background: 'rgba(239,68,68,0.05)',
        border: '1px solid rgba(239,68,68,0.18)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#fca5a5', marginBottom: '4px' }}>
          Product issue linking is unavailable right now
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          Halvex could not verify your Linear connection status. Retry in a moment or check the Integrations page.
        </div>
      </div>
    )
  }

  if (!statusData?.data?.connected) {
    return (
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
          Connect Linear to unlock product issue review
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.7, marginBottom: '12px' }}>
          Halvex needs a live Linear sync before Claude can review the deal against your product backlog and save relevant issue links back here.
        </div>
        <Link
          href="/connections"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            textDecoration: 'none',
            padding: '8px 10px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          Open Integrations
        </Link>
      </div>
    )
  }

  const allLinks = linksData?.data ?? []
  const visibleLinks = allLinks.filter(l => l.status !== 'dismissed')
  const confirmed = visibleLinks.filter(l => l.status === 'confirmed' || l.status === 'in_cycle' || l.status === 'deployed')
  const suggested = visibleLinks.filter(l => l.status === 'suggested')
  const reviewPrompt = linksData?.meta?.reviewPrompt
  const loadingLinks = !linksData && !linksError

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: '12px',
      overflow: 'hidden',
      marginBottom: '16px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: visibleLinks.length > 0 || showLinkInput || loadingLinks || !!linksError ? '1px solid var(--border)' : undefined,
        background: 'var(--surface)',
      }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Product Issues
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            Claude reviews and saves issue links back into Halvex
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          {reviewPrompt && (
            <button
              onClick={handleCopyReviewPrompt}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', color: 'rgba(255,255,255,0.78)', background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
                cursor: 'pointer', padding: '4px 9px',
              }}
            >
              <Copy size={11} />
              Copy Claude prompt
            </button>
          )}
          <button
            onClick={() => setShowLinkInput(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', color: 'var(--accent)', background: 'none',
              border: 'none', cursor: 'pointer', padding: '2px 4px',
            }}
          >
            <Plus size={12} />
            Link
          </button>
        </div>
      </div>

      {linksError && (
        <div style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(239,68,68,0.04)',
          color: '#fca5a5',
          fontSize: '11px',
          lineHeight: 1.6,
        }}>
          Halvex could not load saved issue links for this deal. You can still open Integrations to verify the Claude MCP setup or add a known issue manually below.
        </div>
      )}

      {statusData?.data?.degraded && (
        <div style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(245,158,11,0.05)',
          color: '#fcd34d',
          fontSize: '11px',
          lineHeight: 1.6,
        }}>
          Linear is connected, but the latest sync reported a problem. Saved links are still available, but backlog context may be stale.
          {statusData.data.syncError ? ` ${statusData.data.syncError}` : ''}
        </div>
      )}

      {loadingLinks && (
        <div style={{
          padding: '14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '11px',
          color: 'var(--text-tertiary)',
        }}>
          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
          Loading linked issues...
        </div>
      )}

      {/* Manual link input */}
      {showLinkInput && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
          <input
            value={linkInput}
            onChange={e => setLinkInput(e.target.value)}
            placeholder="Issue ID (e.g. ENG-36)"
            onKeyDown={e => { if (e.key === 'Enter') handleManualLink() }}
            style={{
              flex: 1, fontSize: '12px', padding: '5px 8px',
              border: '1px solid var(--border)', borderRadius: '4px',
              background: 'var(--input-bg, var(--surface))', color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={handleManualLink}
            disabled={actionLoading === 'new' || !linkInput.trim()}
            style={{
              fontSize: '11px', padding: '5px 10px',
              background: 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
              opacity: !linkInput.trim() ? 0.5 : 1,
            }}
          >
            {actionLoading === 'new' ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Link'}
          </button>
        </div>
      )}

      {/* Issue rows */}
      {visibleLinks.length === 0 && !showLinkInput && !loadingLinks && !linksError ? (
        <div style={{ padding: '16px 14px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '12px',
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.14)',
            borderRadius: '10px',
            marginBottom: '10px',
          }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '8px',
              background: 'rgba(99,102,241,0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Sparkles size={13} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                No issue links saved yet
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
                Review this deal in Claude with your Halvex MCP connection, then save the relevant Linear issues back here. You can still link an issue manually if you already know the ID.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link
              href="/connections"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                textDecoration: 'none',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Connect Claude MCP
            </Link>
            {reviewPrompt && (
              <button
                onClick={handleCopyReviewPrompt}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--accent)',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.16)',
                  cursor: 'pointer',
                }}
              >
                <Copy size={11} />
                Copy review prompt
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {[...confirmed, ...suggested].map(link => {
            const isConfirmed = link.status !== 'suggested'
            const isInCycle = link.status === 'in_cycle'
            const isDeployed = link.status === 'deployed'
            const { label, color } = scoreLabel(link.relevanceScore)
            const isLoading = actionLoading === link.id
            const isExpanded = expandedStory === link.id
            const hasUserStory = Boolean(link.scopedUserStory)

            return (
              <div key={link.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 14px',
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {/* Confirmed/Suggested indicator */}
                  <span style={{
                    fontSize: '14px',
                    color: isDeployed ? '#10B981' : isInCycle ? 'var(--accent)' : isConfirmed ? 'var(--accent)' : 'var(--text-tertiary)',
                    flexShrink: 0,
                    lineHeight: 1,
                  }}>
                    {isDeployed ? '🚀' : isInCycle ? '🔄' : isConfirmed ? '●' : '○'}
                  </span>

                  {/* Issue ID + title */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {/* Indigo pill identifier */}
                      {link.linearIssueUrl ? (
                        <a
                          href={link.linearIssueUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.70)',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.10)',
                            borderRadius: '4px', padding: '1px 6px',
                            flexShrink: 0, textDecoration: 'none',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {link.linearIssueId}
                        </a>
                      ) : (
                        <span style={{
                          fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.70)',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.10)',
                          borderRadius: '4px', padding: '1px 6px',
                          flexShrink: 0, letterSpacing: '0.02em',
                        }}>
                          {link.linearIssueId}
                        </span>
                      )}
                      {/* addressesRisk amber tag */}
                      {link.addressesRisk && (
                        <span style={{
                          fontSize: '9px', fontWeight: 600, color: '#f59e0b',
                          background: 'rgba(245,158,11,0.10)',
                          border: '1px solid rgba(245,158,11,0.20)',
                          borderRadius: '4px', padding: '1px 5px',
                          flexShrink: 0, maxWidth: '120px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }} title={link.addressesRisk}>
                          risk: {link.addressesRisk}
                        </span>
                      )}
                      <span style={{
                        fontSize: '12px', color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {link.linearTitle ?? link.linearIssueId}
                      </span>
                      {/* Matched badge (confirmed but not in_cycle/deployed) */}
                      {isConfirmed && !isInCycle && !isDeployed && (
                        <span style={{
                          fontSize: '9px', fontWeight: 600,
                          padding: '1px 5px', borderRadius: '10px',
                          background: 'rgba(52,211,153,0.12)',
                          color: '#34d399',
                          flexShrink: 0,
                          letterSpacing: '0.02em',
                        }}>
                          MATCHED
                        </span>
                      )}
                      {/* In-cycle badge */}
                      {isInCycle && (
                        <span style={{
                          fontSize: '9px', fontWeight: 600,
                          padding: '1px 5px', borderRadius: '10px',
                          background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                          color: 'var(--accent)',
                          flexShrink: 0,
                          letterSpacing: '0.02em',
                        }}>
                          IN CYCLE
                        </span>
                      )}
                      {/* Deployed badge */}
                      {isDeployed && (
                        <span style={{
                          fontSize: '9px', fontWeight: 600,
                          padding: '1px 5px', borderRadius: '10px',
                          background: 'color-mix(in srgb, #10B981 15%, transparent)',
                          color: '#10B981',
                          flexShrink: 0,
                          letterSpacing: '0.02em',
                        }}>
                          DEPLOYED
                        </span>
                      )}
                      {/* Release email sent badge */}
                      {isDeployed && link.hasReleaseEmail && (
                        <span style={{
                          fontSize: '9px', fontWeight: 600,
                          padding: '1px 5px', borderRadius: '10px',
                          background: 'rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.70)',
                          flexShrink: 0,
                          letterSpacing: '0.02em',
                        }}>
                          EMAIL SENT
                        </span>
                      )}
                      {isInCycle && link.assigneeName && (
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                          → {link.assigneeName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score label */}
                  <span style={{ fontSize: '10px', color, flexShrink: 0 }}>{label}</span>

                  {/* User story expand toggle */}
                  {hasUserStory && (
                    <button
                      onClick={() => setExpandedStory(isExpanded ? null : link.id)}
                      title={isExpanded ? 'Hide user story' : 'Show user story'}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-tertiary)', flexShrink: 0, padding: '2px',
                      }}
                    >
                      {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  )}

                  {/* External link */}
                  {link.linearIssueUrl && (
                    <a
                      href={link.linearIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
                    >
                      <ExternalLink size={11} />
                    </a>
                  )}

                  {/* Confirm/dismiss buttons for suggested links */}
                  {link.status === 'suggested' && (
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleConfirm(link)}
                        disabled={isLoading}
                        title="Confirm link"
                        style={{
                          background: 'none', border: '1px solid var(--border)',
                          borderRadius: '3px', padding: '2px 4px',
                          cursor: 'pointer', color: 'var(--accent)',
                        }}
                      >
                        <Check size={10} />
                      </button>
                      <button
                        onClick={() => handleDismiss(link)}
                        disabled={isLoading}
                        title="Dismiss suggestion"
                        style={{
                          background: 'none', border: '1px solid var(--border)',
                          borderRadius: '3px', padding: '2px 4px',
                          cursor: 'pointer', color: 'var(--text-tertiary)',
                        }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                </div>

                {/* User story + objection expand panel */}
                {isExpanded && link.scopedUserStory && (
                  <div style={{
                    padding: '8px 14px 10px 36px',
                    background: 'color-mix(in srgb, var(--accent) 4%, transparent)',
                    borderTop: '1px solid var(--border)',
                  }}>
                    {link.addressesRisk && (
                      <div style={{
                        fontSize: '10px', color: 'var(--text-tertiary)',
                        marginBottom: '4px', lineHeight: 1.4,
                        fontStyle: 'italic',
                      }}>
                        → addresses &ldquo;{link.addressesRisk}&rdquo;
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {link.scopedUserStory}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Footer note for suggested links */}
          {suggested.length > 0 && (
            <div style={{ padding: '6px 14px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
              Suggested links were saved for review. Confirm the ones Claude has validated.
            </div>
          )}
        </>
      )}
    </div>
  )
}
