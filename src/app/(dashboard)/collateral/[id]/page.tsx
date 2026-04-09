'use client'
export const dynamic = 'force-dynamic'

import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
import { ArrowLeft, RefreshCw, Download, Share2, Copy, Check, Trash2 } from 'lucide-react'
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
  const router = useRouter()
  const { toast } = useToast()
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
      // PATCH regenerates the existing record in-place — no new record, no plan limit check
      const res = await fetch(`/api/collateral/${id}`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Failed')
      await mutate()
      toast('Regeneration started — updates in ~30 seconds', 'success')
    } catch {
      toast('Failed to regenerate', 'error')
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleting(true)
    try {
      const res = await fetch(`/api/collateral/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast('Collateral deleted', 'success')
      router.push('/collateral')
    } catch {
      toast('Failed to delete', 'error')
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto', background: 'var(--surface-1)', minHeight: '100%' }}>
      <Link
        href="/collateral"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#9b9a97', textDecoration: 'none', marginBottom: '20px' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#9b9a97' }}
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
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(224,62,62,0.08)', border: '1px solid rgba(224,62,62,0.20)', color: '#e03e3e', fontSize: '13px' }}>
          Failed to load collateral. Please refresh.
        </div>
      )}

      {!isLoading && !error && item && (
        <>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <CollateralTypeBadge type={item.type} customTypeName={item.customTypeName} />
                <StatusBadge status={item.status as 'ready' | 'stale' | 'generating' | 'archived'} />
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: '4px' }}>
                {item.title}
              </h1>
              <p style={{ fontSize: '12px', color: '#9b9a97', margin: 0 }}>
                Generated {formatDate(item.generatedAt)}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={handleRegenerate}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', backgroundColor: 'rgba(55,53,47,0.06)', border: '1px solid rgba(55,53,47,0.12)', cursor: 'pointer', transition: 'background-color 0.1s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(55,53,47,0.10)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(55,53,47,0.06)' }}
              >
                <RefreshCw size={13} strokeWidth={2} />
                Regenerate
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px',
                  fontSize: '13px', fontWeight: 500, cursor: deleting ? 'not-allowed' : 'pointer', transition: 'all 0.1s ease',
                  color: deleteConfirm ? '#fff' : '#e03e3e',
                  backgroundColor: deleteConfirm ? '#e03e3e' : 'rgba(224,62,62,0.08)',
                  border: deleteConfirm ? '1px solid #e03e3e' : '1px solid rgba(224,62,62,0.20)',
                  opacity: deleting ? 0.6 : 1,
                }}
                onMouseEnter={(e) => { if (!deleteConfirm) e.currentTarget.style.backgroundColor = 'rgba(224,62,62,0.14)' }}
                onMouseLeave={(e) => { if (!deleteConfirm) e.currentTarget.style.backgroundColor = 'rgba(224,62,62,0.08)'; setDeleteConfirm(false) }}
              >
                <Trash2 size={13} strokeWidth={2} />
                {deleting ? 'Deleting…' : deleteConfirm ? 'Confirm delete' : 'Delete'}
              </button>

              {/* Share button with popover */}
              <div ref={shareRef} style={{ position: 'relative' }}>
                <button
                  onClick={handleShare}
                  disabled={shareLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: item.isShared ? '#5e6ad2' : '#37352f', backgroundColor: item.isShared ? 'rgba(94,106,210,0.08)' : 'rgba(55,53,47,0.06)', border: item.isShared ? '1px solid rgba(94,106,210,0.25)' : '1px solid rgba(55,53,47,0.12)', cursor: shareLoading ? 'not-allowed' : 'pointer', opacity: shareLoading ? 0.6 : 1, transition: 'background-color 0.1s ease' }}
                  onMouseEnter={(e) => { if (!shareLoading) e.currentTarget.style.backgroundColor = item.isShared ? 'rgba(94,106,210,0.14)' : 'rgba(55,53,47,0.10)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = item.isShared ? 'rgba(94,106,210,0.08)' : 'rgba(55,53,47,0.06)' }}
                >
                  <Share2 size={13} strokeWidth={2} />
                  {shareLoading ? 'Sharing…' : item.isShared ? 'Shared' : 'Share'}
                </button>

                {sharePopoverOpen && item.isShared && (
                  <div
                    style={{ position: 'absolute', top: '40px', right: 0, width: '320px', zIndex: 100, background: 'var(--surface-1)', border: '1px solid rgba(55,53,47,0.12)', borderRadius: '10px', padding: '14px', boxShadow: '0 8px 24px rgba(55,53,47,0.12)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>Share link</p>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                      <code
                        style={{ flex: 1, fontSize: '11px', color: '#787774', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.09)', borderRadius: '5px', padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                      >
                        {shareUrl}
                      </code>
                      <button
                        onClick={handleCopyLink}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '32px', padding: '0 10px', borderRadius: '5px', fontSize: '12px', fontWeight: 600, color: copied ? '#0f7b6c' : '#37352f', backgroundColor: copied ? 'rgba(15,123,108,0.08)' : 'rgba(55,53,47,0.06)', border: copied ? '1px solid rgba(15,123,108,0.20)' : '1px solid rgba(55,53,47,0.12)', cursor: 'pointer', flexShrink: 0, transition: 'background-color 0.1s ease' }}
                      >
                        {copied ? <Check size={11} strokeWidth={2} /> : <Copy size={11} strokeWidth={2} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <button
                      onClick={handleStopSharing}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', color: '#e03e3e', cursor: 'pointer', opacity: 0.8 }}
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
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#fff', backgroundColor: '#37352f', textDecoration: 'none', transition: 'opacity 0.1s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                >
                  <Download size={13} strokeWidth={2} />
                  Export
                </a>
              )}
            </div>
          </div>

          {/* Generating state */}
          {item.status === 'generating' && (
            <div style={{ padding: '32px', textAlign: 'center', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.09)', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
                <RefreshCw size={16} style={{ color: '#5e6ad2', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Generating content…</span>
              </div>
              <p style={{ fontSize: '13px', color: '#787774', margin: 0 }}>This usually takes 10-30 seconds. Page will update automatically.</p>
            </div>
          )}

          {/* Content viewer */}
          {item.status === 'ready' && item.content && (
            <CollateralViewer content={item.content} />
          )}

          {item.status === 'stale' && (
            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(203,108,44,0.08)', border: '1px solid rgba(203,108,44,0.20)', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', color: '#cb6c2c', margin: 0 }}>
                This collateral is stale because your source data has changed. Click &quot;Regenerate&quot; to get fresh content.
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
