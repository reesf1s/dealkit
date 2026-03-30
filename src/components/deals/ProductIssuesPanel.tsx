'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, Loader2, Plus, Sparkles, X } from 'lucide-react'
import { useToast } from '@/components/shared/Toast'

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

interface DealLinksResponse {
  data: DealLinearLink[]
  meta?: {
    mode?: string
    reviewPrompt?: string
  }
}

interface McpResponse {
  data?: {
    mcpApiKey?: string | null
  }
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(typeof json?.error === 'string' ? json.error : 'Fetch failed')
  }
  return res.json()
}

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'High', color: '#dc2626' }
  if (score >= 70) return { label: 'Med', color: '#d97706' }
  return { label: 'Low', color: '#64748b' }
}

interface Props {
  dealId: string
}

export function ProductIssuesPanel({ dealId }: Props) {
  const { toast } = useToast()
  const [linkInput, setLinkInput] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedStory, setExpandedStory] = useState<string | null>(null)

  const { data: mcpData, error: mcpError } = useSWR<McpResponse>('/api/workspace/mcp-api-key', fetcher, {
    revalidateOnFocus: false,
  })

  const {
    data: linksData,
    error: linksError,
    mutate: mutateLinks,
  } = useSWR<DealLinksResponse>(`/api/deals/${dealId}/linear-links`, fetcher, {
    revalidateOnFocus: false,
  })

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

  const allLinks = linksData?.data ?? []
  const visibleLinks = allLinks.filter(link => link.status !== 'dismissed')
  const confirmed = visibleLinks.filter(link => link.status === 'confirmed' || link.status === 'in_cycle' || link.status === 'deployed')
  const suggested = visibleLinks.filter(link => link.status === 'suggested')
  const reviewPrompt = linksData?.meta?.reviewPrompt
  const loadingLinks = !linksData && !linksError
  const mcpReady = Boolean(mcpData?.data?.mcpApiKey)

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(248,250,255,0.64) 100%)',
        border: '1px solid rgba(255,255,255,0.78)',
        borderRadius: '24px',
        overflow: 'hidden',
        marginBottom: '16px',
        boxShadow: '0 18px 50px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '18px 18px 16px',
          borderBottom: visibleLinks.length > 0 || showLinkInput || loadingLinks || Boolean(linksError) ? '1px solid rgba(148,163,184,0.14)' : undefined,
          background: 'rgba(255,255,255,0.45)',
        }}
      >
        <div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>
            Linked product issues
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', lineHeight: 1.6 }}>
            Claude reviews externally, then saves only the relevant blockers back into Halvex.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {reviewPrompt && (
            <button
              onClick={handleCopyReviewPrompt}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#0f172a',
                background: '#fff',
                border: '1px solid rgba(148,163,184,0.18)',
                borderRadius: '999px',
                cursor: 'pointer',
                padding: '8px 12px',
              }}
            >
              <Copy size={12} />
              Copy Claude prompt
            </button>
          )}
          <button
            onClick={() => setShowLinkInput(v => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#fff',
              background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.88))',
              border: 'none',
              borderRadius: '999px',
              cursor: 'pointer',
              padding: '8px 12px',
            }}
          >
            <Plus size={12} />
            Add issue ID
          </button>
        </div>
      </div>

      {mcpError && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(148,163,184,0.14)', background: 'rgba(245,158,11,0.08)', color: '#92400e', fontSize: '12px', lineHeight: 1.7 }}>
          Halvex could not verify MCP setup right now. Saved links still work, but you may need to revisit setup if Claude cannot write new links back.
        </div>
      )}

      {linksError && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(148,163,184,0.14)', background: 'rgba(239,68,68,0.08)', color: '#b91c1c', fontSize: '12px', lineHeight: 1.7 }}>
          Halvex could not load saved issue links for this deal. You can still review setup or add a known issue manually below.
        </div>
      )}

      {loadingLinks && (
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(148,163,184,0.14)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
          Loading saved links...
        </div>
      )}

      {showLinkInput && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(148,163,184,0.14)', display: 'flex', gap: '8px' }}>
          <input
            value={linkInput}
            onChange={e => setLinkInput(e.target.value)}
            placeholder="Issue ID (e.g. ENG-36)"
            onKeyDown={e => { if (e.key === 'Enter') handleManualLink() }}
            style={{
              flex: 1,
              fontSize: '12px',
              padding: '11px 14px',
              border: '1px solid rgba(148,163,184,0.18)',
              borderRadius: '14px',
              background: '#fff',
              color: '#0f172a',
            }}
          />
          <button
            onClick={handleManualLink}
            disabled={actionLoading === 'new' || !linkInput.trim()}
            style={{
              minWidth: '88px',
              fontSize: '12px',
              fontWeight: 700,
              padding: '0 14px',
              background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.88))',
              color: '#fff',
              border: 'none',
              borderRadius: '14px',
              cursor: 'pointer',
              opacity: !linkInput.trim() ? 0.5 : 1,
            }}
          >
            {actionLoading === 'new' ? <Loader2 size={13} style={{ margin: '0 auto', animation: 'spin 1s linear infinite' }} /> : 'Link'}
          </button>
        </div>
      )}

      {visibleLinks.length === 0 && !showLinkInput && !loadingLinks && !linksError ? (
        <div style={{ padding: '18px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px',
              background: 'rgba(255,255,255,0.72)',
              border: '1px solid rgba(255,255,255,0.82)',
              borderRadius: '22px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.88))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#fff',
              }}
            >
              <Sparkles size={15} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                No issue links saved yet
              </div>
              <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.75 }}>
                Ask Claude to review this deal with Halvex MCP and its own Linear access, then save any high-confidence blockers back here. You can still link a known issue manually if you already know the ID.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link
              href="/connections"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#0f172a',
                textDecoration: 'none',
                padding: '10px 14px',
                borderRadius: '999px',
                background: '#fff',
                border: '1px solid rgba(148,163,184,0.18)',
              }}
            >
              {mcpReady ? 'Review MCP setup' : 'Set up Claude MCP'}
            </Link>
            {reviewPrompt && (
              <button
                onClick={handleCopyReviewPrompt}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#fff',
                  padding: '10px 14px',
                  borderRadius: '999px',
                  background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.88))',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Copy size={12} />
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
              <div key={link.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px', opacity: isLoading ? 0.6 : 1 }}>
                  <span style={{ fontSize: '14px', color: isDeployed ? '#10b981' : isInCycle ? '#4f46e5' : isConfirmed ? '#0f172a' : '#64748b', flexShrink: 0, lineHeight: 1 }}>
                    {isDeployed ? '🚀' : isInCycle ? '↻' : isConfirmed ? '●' : '○'}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {link.linearIssueUrl ? (
                        <a href={link.linearIssueUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', fontWeight: 800, color: '#334155', background: 'rgba(15,23,42,0.06)', border: '1px solid rgba(148,163,184,0.14)', borderRadius: '999px', padding: '4px 8px', textDecoration: 'none', letterSpacing: '0.02em' }}>
                          {link.linearIssueId}
                        </a>
                      ) : (
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#334155', background: 'rgba(15,23,42,0.06)', border: '1px solid rgba(148,163,184,0.14)', borderRadius: '999px', padding: '4px 8px', letterSpacing: '0.02em' }}>
                          {link.linearIssueId}
                        </span>
                      )}

                      {link.addressesRisk && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#b45309', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: '999px', padding: '4px 8px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={link.addressesRisk}>
                          {link.addressesRisk}
                        </span>
                      )}

                      <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {link.linearTitle ?? link.linearIssueId}
                      </span>

                      {isConfirmed && !isInCycle && !isDeployed && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px', background: 'rgba(16,185,129,0.10)', color: '#047857', letterSpacing: '0.02em' }}>
                          CONFIRMED
                        </span>
                      )}
                      {isInCycle && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px', background: 'rgba(79,70,229,0.10)', color: '#4338ca', letterSpacing: '0.02em' }}>
                          IN CYCLE
                        </span>
                      )}
                      {isDeployed && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px', background: 'rgba(16,185,129,0.10)', color: '#047857', letterSpacing: '0.02em' }}>
                          SHIPPED
                        </span>
                      )}
                      {isDeployed && link.hasReleaseEmail && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px', background: 'rgba(15,23,42,0.06)', color: '#334155', letterSpacing: '0.02em' }}>
                          EMAIL READY
                        </span>
                      )}
                      {isInCycle && link.assigneeName && (
                        <span style={{ fontSize: '11px', color: '#64748b', flexShrink: 0 }}>
                          {link.assigneeName}
                        </span>
                      )}
                    </div>
                  </div>

                  <span style={{ fontSize: '11px', color, flexShrink: 0, fontWeight: 700 }}>{label}</span>

                  {hasUserStory && (
                    <button onClick={() => setExpandedStory(isExpanded ? null : link.id)} title={isExpanded ? 'Hide user story' : 'Show user story'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', flexShrink: 0, padding: '2px' }}>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  )}

                  {link.linearIssueUrl && (
                    <a href={link.linearIssueUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#64748b', flexShrink: 0 }}>
                      <ExternalLink size={12} />
                    </a>
                  )}

                  {link.status === 'suggested' && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => handleConfirm(link)} disabled={isLoading} title="Confirm link" style={{ width: '28px', height: '28px', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: '10px', cursor: 'pointer', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={11} />
                      </button>
                      <button onClick={() => handleDismiss(link)} disabled={isLoading} title="Dismiss suggestion" style={{ width: '28px', height: '28px', background: 'rgba(148,163,184,0.10)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: '10px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={11} />
                      </button>
                    </div>
                  )}
                </div>

                {isExpanded && link.scopedUserStory && (
                  <div style={{ padding: '10px 18px 14px 44px', background: 'rgba(79,70,229,0.04)', borderTop: '1px solid rgba(148,163,184,0.12)' }}>
                    {link.addressesRisk && (
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', lineHeight: 1.5, fontStyle: 'italic' }}>
                        Addresses “{link.addressesRisk}”
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.7 }}>
                      {link.scopedUserStory}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {suggested.length > 0 && (
            <div style={{ padding: '10px 18px 14px', fontSize: '11px', color: '#64748b', lineHeight: 1.7 }}>
              Suggested links were saved for review. Confirm the ones Claude validated and dismiss the rest.
            </div>
          )}
        </>
      )}
    </div>
  )
}
