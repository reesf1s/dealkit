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

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { ExternalLink, Plus, Check, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
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
  cycleId: string | null
  assigneeName: string | null
  createdAt: string
}

interface LinearStatus {
  connected: boolean
  teamName?: string | null
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
  const { data: statusData } = useSWR<{ data: LinearStatus }>(
    '/api/integrations/linear/status',
    fetcher,
    { revalidateOnFocus: false },
  )

  // Fetch links for this deal
  const {
    data: linksData,
    mutate: mutateLinks,
  } = useSWR<{ data: DealLinearLink[] }>(
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

  // Don't render if Linear isn't connected
  if (!statusData?.data?.connected) return null

  const allLinks = linksData?.data ?? []
  const visibleLinks = allLinks.filter(l => l.status !== 'dismissed')
  const confirmed = visibleLinks.filter(l => l.status === 'confirmed' || l.status === 'in_cycle' || l.status === 'deployed')
  const suggested = visibleLinks.filter(l => l.status === 'suggested')

  if (visibleLinks.length === 0 && !showLinkInput) {
    // Show empty state only if we've loaded
    if (!linksData) return null
  }

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: '8px',
      overflow: 'hidden',
      marginBottom: '16px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: visibleLinks.length > 0 || showLinkInput ? '1px solid var(--border)' : undefined,
        background: 'var(--surface)',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Product Issues
        </span>
        <span className="ml-2 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-full px-2 py-0.5 font-medium">MCP</span>
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
      {visibleLinks.length === 0 && !showLinkInput ? (
        <div style={{ padding: '10px 14px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          No linked issues yet
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
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        #{link.linearIssueId}
                      </span>
                      <span style={{
                        fontSize: '12px', color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {link.linearTitle ?? link.linearIssueId}
                      </span>
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

                {/* User story expand panel */}
                {isExpanded && link.scopedUserStory && (
                  <div style={{
                    padding: '8px 14px 10px 36px',
                    background: 'color-mix(in srgb, var(--accent) 4%, transparent)',
                    borderTop: '1px solid var(--border)',
                  }}>
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
              Suggested by Halvex based on deal signals
            </div>
          )}
        </>
      )}
    </div>
  )
}
