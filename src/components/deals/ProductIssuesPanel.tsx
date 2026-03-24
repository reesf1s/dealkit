'use client'

/**
 * ProductIssuesPanel
 *
 * Shows Linear issues linked to a deal — confirmed (●) and suggested (○).
 * Reps can confirm or dismiss suggestions, and trigger discovery to find
 * matching issues from the Linear backlog.
 *
 * Non-breaking: renders nothing if Linear isn't connected for the workspace.
 *
 * ┌─────────────────────────────────────────────────────┐
 * │ Product Issues                [Discover] [+ Link]   │
 * ├─────────────────────────────────────────────────────┤
 * │ [ENG-36] Bulk CSV Export          · In Cycle  ↗    │
 * │ [ENG-279] API Rate Limit Increase · Backlog         │
 * │   → addresses "export performance"                  │
 * └─────────────────────────────────────────────────────┘
 */

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { ExternalLink, Plus, Check, X, Loader2, ChevronDown, ChevronUp, Search } from 'lucide-react'
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
  teamName?: string | null
}

const fetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error('Fetch failed')
    return r.json()
  })

// ─────────────────────────────────────────────────────────────────────────────
// Status badge helper
// ─────────────────────────────────────────────────────────────────────────────

function statusBadge(status: DealLinearLink['status'], cycleId: string | null): {
  label: string
  bg: string
  color: string
} {
  if (status === 'deployed') return { label: 'Deployed', bg: 'rgba(16,185,129,0.12)', color: '#10B981' }
  if (status === 'in_cycle') return { label: 'In Cycle', bg: 'rgba(34,197,94,0.12)', color: '#16A34A' }
  if (status === 'confirmed') return { label: 'Confirmed', bg: 'rgba(99,102,241,0.12)', color: '#6366F1' }
  return { label: 'Suggested', bg: 'rgba(100,116,139,0.10)', color: '#64748B' }
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
  const [actionLoading, setActionLoading] = useState<string | null>(null) // linkId or 'new' or 'discover'
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

  const handleDiscover = useCallback(async () => {
    setActionLoading('discover')
    try {
      const res = await fetch(`/api/deals/${dealId}/discover-issues`, { method: 'POST' })
      if (!res.ok) throw new Error('Discovery failed')
      const json = await res.json()
      await mutateLinks()
      const total = json?.data?.total ?? 0
      if (total > 0) {
        toast(`Found ${total} matching issue${total !== 1 ? 's' : ''}`, 'success')
      } else {
        toast('No new matches found — try syncing from Linear Settings', 'info')
      }
    } catch {
      toast('Could not run discovery', 'error')
    } finally {
      setActionLoading(null)
    }
  }, [dealId, mutateLinks, toast])

  // Don't render if Linear isn't connected
  if (!statusData?.data?.connected) return null

  const allLinks = linksData?.data ?? []
  const visibleLinks = allLinks.filter(l => l.status !== 'dismissed')
  const confirmed = visibleLinks.filter(l => l.status === 'confirmed' || l.status === 'in_cycle' || l.status === 'deployed')
  const suggested = visibleLinks.filter(l => l.status === 'suggested')

  if (visibleLinks.length === 0 && !showLinkInput && !linksData) return null

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Product Issues
          </span>
          <span style={{
            fontSize: '9px', fontWeight: 700, padding: '1px 5px',
            borderRadius: '10px', background: 'rgba(139,92,246,0.12)',
            color: '#8B5CF6', letterSpacing: '0.04em',
          }}>
            MCP
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Discover Issues button */}
          <button
            onClick={handleDiscover}
            disabled={actionLoading === 'discover'}
            title="Discover matching Linear issues from your backlog"
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              fontSize: '11px', color: 'var(--accent)', background: 'none',
              border: '1px solid var(--accent)', borderRadius: '4px',
              cursor: actionLoading === 'discover' ? 'not-allowed' : 'pointer',
              padding: '2px 7px', opacity: actionLoading === 'discover' ? 0.6 : 1,
            }}
          >
            {actionLoading === 'discover'
              ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
              : <Search size={10} />
            }
            Discover
          </button>
          {/* Manual link button */}
          <button
            onClick={() => setShowLinkInput(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', color: 'var(--text-tertiary)', background: 'none',
              border: 'none', cursor: 'pointer', padding: '2px 4px',
            }}
            title="Manually link an issue by ID"
          >
            <Plus size={12} />
            Link
          </button>
        </div>
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
      {visibleLinks.length === 0 ? (
        <div style={{ padding: '12px 14px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          No linked issues yet. Click <strong>Discover</strong> to find matching issues from your backlog.
        </div>
      ) : (
        <>
          {[...confirmed, ...suggested].map(link => {
            const isLoading = actionLoading === link.id
            const isExpanded = expandedStory === link.id
            const hasUserStory = Boolean(link.scopedUserStory)
            const badge = statusBadge(link.status, link.cycleId)
            const issueUrl = link.linearIssueUrl

            return (
              <div key={link.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    padding: '9px 14px',
                    opacity: isLoading ? 0.6 : 1,
                    cursor: issueUrl ? 'pointer' : 'default',
                  }}
                  onClick={() => { if (issueUrl) window.open(issueUrl, '_blank', 'noopener,noreferrer') }}
                >
                  {/* Identifier badge (indigo) */}
                  <span style={{
                    fontSize: '10px', fontWeight: 700,
                    padding: '2px 6px', borderRadius: '4px',
                    background: 'rgba(99,102,241,0.12)', color: '#6366F1',
                    flexShrink: 0, lineHeight: 1.5, letterSpacing: '0.02em',
                    cursor: issueUrl ? 'pointer' : 'default',
                    marginTop: '1px',
                  }}>
                    {link.linearIssueId}
                  </span>

                  {/* Title + badges column */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '12px', color: 'var(--text-primary)',
                      lineHeight: 1.4, fontWeight: 500,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                    }}>
                      {link.linearTitle ?? link.linearIssueId}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {/* Status badge */}
                      <span style={{
                        fontSize: '9px', fontWeight: 600, padding: '1px 5px',
                        borderRadius: '10px', background: badge.bg, color: badge.color,
                        letterSpacing: '0.03em',
                      }}>
                        {badge.label}
                      </span>

                      {/* Release email sent */}
                      {link.status === 'deployed' && link.hasReleaseEmail && (
                        <span style={{
                          fontSize: '9px', fontWeight: 600, padding: '1px 5px',
                          borderRadius: '10px', background: 'rgba(99,102,241,0.12)', color: '#818CF8',
                          letterSpacing: '0.03em',
                        }}>
                          Email sent
                        </span>
                      )}

                      {/* Assignee */}
                      {link.assigneeName && (
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          → {link.assigneeName}
                        </span>
                      )}
                    </div>

                    {/* Addresses risk — amber tag always visible when set */}
                    {link.addressesRisk && (
                      <div style={{
                        marginTop: '4px', fontSize: '10px',
                        color: '#92400E', background: 'rgba(251,191,36,0.12)',
                        borderRadius: '4px', padding: '2px 6px',
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        lineHeight: 1.4, maxWidth: '100%',
                      }}>
                        → addresses &ldquo;{link.addressesRisk.slice(0, 80)}{link.addressesRisk.length > 80 ? '…' : ''}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* Right-side controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    {/* User story expand toggle */}
                    {hasUserStory && (
                      <button
                        onClick={() => setExpandedStory(isExpanded ? null : link.id)}
                        title={isExpanded ? 'Hide user story' : 'Show user story'}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-tertiary)', padding: '2px',
                        }}
                      >
                        {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    )}

                    {/* External link */}
                    {issueUrl && (
                      <a
                        href={issueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
                        title="Open in Linear"
                      >
                        <ExternalLink size={11} />
                      </a>
                    )}

                    {/* Confirm/dismiss buttons for suggested links */}
                    {link.status === 'suggested' && (
                      <div style={{ display: 'flex', gap: '3px' }}>
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
                </div>

                {/* User story expand panel */}
                {isExpanded && link.scopedUserStory && (
                  <div style={{
                    padding: '8px 14px 10px 14px',
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
