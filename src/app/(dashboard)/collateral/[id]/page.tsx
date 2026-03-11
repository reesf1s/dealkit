'use client'
export const dynamic = 'force-dynamic'

import { useParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
import { ArrowLeft, RefreshCw, Download, Share2, Copy, Check } from 'lucide-react'
import { CollateralViewer } from '@/components/collateral/CollateralViewer'
import { CollateralTypeBadge } from '@/components/collateral/CollateralTypeBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { useToast } from '@/components/shared/Toast'
import type { Collateral } from '@/types'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

function formatDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function CollateralDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error, mutate } = useSWR<{ data: Collateral }>(
    `/api/collateral/${id}`,
    fetcher,
    { refreshInterval: (data) => data?.data?.status === 'generating' ? 3000 : 0 },
  )

  const item = data?.data

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setSharePopoverOpen(false)
      }
    }
    if (sharePopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [sharePopoverOpen])

  async function handleShare() {
    if (!item) return
    if (item.isShared) {
      setSharePopoverOpen((v) => !v)
      return
    }
    setShareLoading(true)
    try {
      const res = await fetch(`/api/collateral/${id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: true }),
      })
      if (!res.ok) throw new Error('Failed')
      await mutate()
      setSharePopoverOpen(true)
    } catch {
      toast('Failed to create share link', 'error')
    } finally {
      setShareLoading(false)
    }
  }

  async function handleStopSharing() {
    if (!item) return
    try {
      await fetch(`/api/collateral/${id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: false }),
      })
      await mutate()
      setSharePopoverOpen(false)
      toast('Sharing disabled', 'success')
    } catch {
      toast('Failed to disable sharing', 'error')
    }
  }

  function handleCopyLink() {
    if (!item?.shareToken) return
    const shareUrl = `${window.location.origin}/share/${item.shareToken}`
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const shareUrl = item?.shareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${item.shareToken}` : ''

  async function handleRegenerate() {
    if (!item) return
    try {
      const res = await fetch('/api/collateral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: item.type,
          sourceCompetitorId: item.sourceCompetitorId,
          sourceCaseStudyId: item.sourceCaseStudyId,
          sourceDealLogId: item.sourceDealLogId,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      await mutate()
      toast('Regeneration started', 'success')
    } catch {
      toast('Failed to regenerate', 'error')
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <Link
        href="/collateral"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888', textDecoration: 'none', marginBottom: '20px' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#EBEBEB' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#888' }}
      >
        <ArrowLeft size={14} strokeWidth={2} />
        Back to collateral
      </Link>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SkeletonCard lines={2} showHeader />
          <SkeletonCard lines={5} showHeader={false} />
          <SkeletonCard lines={4} showHeader={false} />
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: '13px' }}>
          Failed to load collateral. Please refresh.
        </div>
      )}

      {!isLoading && !error && item && (
        <>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <CollateralTypeBadge type={item.type} />
                <StatusBadge status={item.status as 'ready' | 'stale' | 'generating' | 'archived'} />
              </div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#EBEBEB', letterSpacing: '-0.03em', margin: 0, marginBottom: '4px' }}>
                {item.title}
              </h1>
              <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>
                Generated {formatDate(item.generatedAt)}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={handleRegenerate}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: '#EBEBEB', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'background-color 150ms ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
              >
                <RefreshCw size={13} strokeWidth={2} />
                Regenerate
              </button>

              {/* Share button with popover */}
              <div ref={shareRef} style={{ position: 'relative' }}>
                <button
                  onClick={handleShare}
                  disabled={shareLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: item.isShared ? '#6366F1' : '#EBEBEB', backgroundColor: item.isShared ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.06)', border: item.isShared ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.08)', cursor: shareLoading ? 'not-allowed' : 'pointer', opacity: shareLoading ? 0.6 : 1, transition: 'background-color 150ms ease' }}
                  onMouseEnter={(e) => { if (!shareLoading) e.currentTarget.style.backgroundColor = item.isShared ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = item.isShared ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.06)' }}
                >
                  <Share2 size={13} strokeWidth={2} />
                  {shareLoading ? 'Sharing…' : item.isShared ? 'Shared' : 'Share'}
                </button>

                {sharePopoverOpen && item.isShared && (
                  <div
                    style={{ position: 'absolute', top: '40px', right: 0, width: '320px', zIndex: 100, backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#EBEBEB', margin: '0 0 8px' }}>Share link</p>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                      <code
                        style={{ flex: 1, fontSize: '11px', color: '#888', backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                      >
                        {shareUrl}
                      </code>
                      <button
                        onClick={handleCopyLink}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '32px', padding: '0 10px', borderRadius: '5px', fontSize: '12px', fontWeight: 600, color: copied ? '#22C55E' : '#EBEBEB', backgroundColor: copied ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', flexShrink: 0, transition: 'background-color 150ms ease' }}
                      >
                        {copied ? <Check size={11} strokeWidth={2} /> : <Copy size={11} strokeWidth={2} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <button
                      onClick={handleStopSharing}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', color: '#EF4444', cursor: 'pointer', opacity: 0.8 }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8' }}
                    >
                      Stop sharing
                    </button>
                  </div>
                )}
              </div>

              {item.status === 'ready' && (
                <a
                  href={`/api/collateral/${id}/export`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#fff', backgroundColor: '#6366F1', textDecoration: 'none', transition: 'background-color 150ms ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4F46E5' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#6366F1' }}
                >
                  <Download size={13} strokeWidth={2} />
                  Export
                </a>
              )}
            </div>
          </div>

          {/* Generating state */}
          {item.status === 'generating' && (
            <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
                <RefreshCw size={16} style={{ color: '#6366F1', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#EBEBEB' }}>Generating content…</span>
              </div>
              <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>This usually takes 10-30 seconds. Page will update automatically.</p>
            </div>
          )}

          {/* Content viewer */}
          {item.status === 'ready' && item.content && (
            <CollateralViewer content={item.content} />
          )}

          {item.status === 'stale' && (
            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', color: '#F59E0B', margin: 0 }}>
                This collateral is stale because your source data has changed. Click "Regenerate" to get fresh content.
              </p>
            </div>
          )}

          {item.status === 'stale' && item.content && (
            <div style={{ opacity: 0.5 }}>
              <CollateralViewer content={item.content} />
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
