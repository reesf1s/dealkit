'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { ChevronDown, ChevronUp, Copy, ExternalLink, Loader2, Sparkles } from 'lucide-react'
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
  if (score >= 90) return { label: 'High', color: '#e03e3e' }
  if (score >= 70) return { label: 'Med', color: '#cb6c2c' }
  return { label: 'Low', color: 'var(--text-tertiary)' }
}

interface Props {
  dealId: string
}

export function ProductIssuesPanel({ dealId }: Props) {
  const { toast } = useToast()
  const [expandedStory, setExpandedStory] = useState<string | null>(null)

  const { data: mcpData, error: mcpError } = useSWR<McpResponse>('/api/workspace/mcp-api-key', fetcher, {
    revalidateOnFocus: false,
  })

  const {
    data: linksData,
    error: linksError,
  } = useSWR<DealLinksResponse>(`/api/deals/${dealId}/linear-links`, fetcher, {
    revalidateOnFocus: false,
  })

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
        background: 'var(--surface-1)',
        border: '1px solid rgba(55,53,47,0.09)',
        borderRadius: '10px',
        overflow: 'hidden',
        marginBottom: '16px',
        boxShadow: '0 1px 3px rgba(55,53,47,0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '18px 18px 16px',
          borderBottom: visibleLinks.length > 0 || loadingLinks || Boolean(linksError) ? '1px solid rgba(55,53,47,0.09)' : undefined,
          background: '#f7f6f3',
        }}
      >
        <div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0 }}>
            Linked product issues
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', lineHeight: 1.6 }}>
            Halvex only visualises issue context Claude has already written back into this deal.
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
                color: 'var(--text-primary)',
                background: 'rgba(55,53,47,0.04)',
                border: '1px solid rgba(55,53,47,0.12)',
                borderRadius: '999px',
                cursor: 'pointer',
                padding: '8px 12px',
              }}
            >
              <Copy size={12} />
              Copy Claude prompt
            </button>
          )}
        </div>
      </div>

      {mcpError && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(55,53,47,0.09)', background: 'rgba(203,108,44,0.08)', color: '#cb6c2c', fontSize: '12px', lineHeight: 1.7 }}>
          Halvex could not verify MCP setup right now. Saved links still work, but you may need to revisit setup if Claude cannot write new links back.
        </div>
      )}

      {linksError && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(55,53,47,0.09)', background: 'rgba(224,62,62,0.08)', color: '#e03e3e', fontSize: '12px', lineHeight: 1.7 }}>
          Halvex could not load saved issue links for this deal. Re-run the Claude review after setup is healthy, or try again in a moment.
        </div>
      )}

      {loadingLinks && (
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(55,53,47,0.09)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
          Loading saved links...
        </div>
      )}

      {visibleLinks.length === 0 && !loadingLinks && !linksError ? (
        <div style={{ padding: '18px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px',
              background: '#f7f6f3',
              border: '1px solid rgba(55,53,47,0.09)',
              borderRadius: '10px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '14px',
                background: 'rgba(94,106,210,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--brand)',
              }}
            >
              <Sparkles size={15} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                No issue links saved yet
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.75 }}>
                Ask Claude to review this deal with Halvex MCP and save the blockers that matter back here. Halvex does not create or match links on its own.
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
                color: 'var(--text-primary)',
                textDecoration: 'none',
                padding: '10px 14px',
                borderRadius: '999px',
                background: 'rgba(55,53,47,0.04)',
                border: '1px solid rgba(55,53,47,0.12)',
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
                  color: '#ffffff',
                  padding: '10px 14px',
                  borderRadius: '999px',
                  background: 'var(--brand)',
                  border: '1px solid var(--brand-border)',
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
            const isExpanded = expandedStory === link.id
            const hasUserStory = Boolean(link.scopedUserStory)

            return (
              <div key={link.id} style={{ borderBottom: '1px solid rgba(55,53,47,0.09)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px' }}>
                  <span style={{ fontSize: '14px', color: isDeployed ? '#0f7b6c' : isInCycle ? '#2e78c6' : isConfirmed ? '#37352f' : '#9b9a97', flexShrink: 0, lineHeight: 1 }}>
                    {isDeployed ? '🚀' : isInCycle ? '↻' : isConfirmed ? '●' : '○'}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {link.linearIssueUrl ? (
                        <a href={link.linearIssueUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', background: 'rgba(55,53,47,0.04)', border: '1px solid rgba(55,53,47,0.12)', borderRadius: '999px', padding: '4px 8px', textDecoration: 'none', letterSpacing: '0.02em' }}>
                          {link.linearIssueId}
                        </a>
                      ) : (
                        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', background: 'rgba(55,53,47,0.04)', border: '1px solid rgba(55,53,47,0.12)', borderRadius: '999px', padding: '4px 8px', letterSpacing: '0.02em' }}>
                          {link.linearIssueId}
                        </span>
                      )}

                      {link.addressesRisk && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#cb6c2c', background: 'rgba(203,108,44,0.10)', border: '1px solid rgba(203,108,44,0.20)', borderRadius: '999px', padding: '4px 8px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={link.addressesRisk}>
                          {link.addressesRisk}
                        </span>
                      )}

                      <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {link.linearTitle ?? link.linearIssueId}
                      </span>

                      {isConfirmed && !isInCycle && !isDeployed && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px', background: 'rgba(15,123,108,0.10)', color: '#0f7b6c', letterSpacing: '0.02em' }}>
                          CONFIRMED
                        </span>
                      )}
                      {isInCycle && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px', background: 'rgba(46,120,198,0.10)', color: '#2e78c6', letterSpacing: '0.02em' }}>
                          IN CYCLE
                        </span>
                      )}
                      {isDeployed && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px', background: 'rgba(15,123,108,0.10)', color: '#0f7b6c', letterSpacing: '0.02em' }}>
                          SHIPPED
                        </span>
                      )}
                      {isDeployed && link.hasReleaseEmail && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px', background: 'rgba(55,53,47,0.04)', color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
                          EMAIL READY
                        </span>
                      )}
                      {!isConfirmed && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px', background: 'rgba(203,108,44,0.10)', color: '#cb6c2c', letterSpacing: '0.02em' }}>
                          REVIEW PENDING
                        </span>
                      )}
                      {isInCycle && link.assigneeName && (
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                          {link.assigneeName}
                        </span>
                      )}
                    </div>
                  </div>

                  <span style={{ fontSize: '11px', color, flexShrink: 0, fontWeight: 700 }}>{label}</span>

                  {hasUserStory && (
                    <button onClick={() => setExpandedStory(isExpanded ? null : link.id)} title={isExpanded ? 'Hide user story' : 'Show user story'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', flexShrink: 0, padding: '2px' }}>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  )}

                  {link.linearIssueUrl && (
                    <a href={link.linearIssueUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                {isExpanded && link.scopedUserStory && (
                  <div style={{ padding: '10px 18px 14px 44px', background: '#f7f6f3', borderTop: '1px solid rgba(55,53,47,0.09)' }}>
                    {link.addressesRisk && (
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '6px', lineHeight: 1.5, fontStyle: 'italic' }}>
                        Addresses “{link.addressesRisk}”
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {link.scopedUserStory}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {suggested.length > 0 && (
            <div style={{ padding: '10px 18px 14px', fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
              Claude has written review-state issue context into Halvex. Re-run the review in Claude if you want to tighten or refresh the set.
            </div>
          )}
        </>
      )}
    </div>
  )
}
