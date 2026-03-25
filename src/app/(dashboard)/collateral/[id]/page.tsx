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
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <Link
        href="/collateral"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-tertiary)', textDecoration: 'none', marginBottom: '20px' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
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
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--danger)', fontSize: '13px' }}>
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
              <h1 className="font-brand" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.01em', margin: 0, marginBottom: '4px' }}>
                {item.title}
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
                Generated {formatDate(item.generatedAt)}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={handleRegenerate}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', backgroundColor: 'var(--surface-hover)', border: '1px solid var(--surface-hover)', cursor: 'pointer', transition: 'background-color 0.1s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--border-strong)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)' }}
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
                  color: deleteConfirm ? '#fff' : 'var(--danger)',
                  backgroundColor: deleteConfirm ? 'var(--danger)' : 'rgba(239,68,68,0.08)',
                  border: deleteConfirm ? '1px solid var(--danger)' : '1px solid rgba(239,68,68,0.25)',
                  opacity: deleting ? 0.6 : 1,
                }}
                onMouseEnter={(e) => { if (!deleteConfirm) e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)' }}
                onMouseLeave={(e) => { if (!deleteConfirm) e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; setDeleteConfirm(false) }}
              >
                <Trash2 size={13} strokeWidth={2} />
                {deleting ? 'Deleting…' : deleteConfirm ? 'Confirm delete' : 'Delete'}
              </button>

              {/* Share button with popover */}
              <div ref={shareRef} style={{ position: 'relative' }}>
                <button
                  onClick={handleShare}
                  disabled={shareLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: item.isShared ? 'var(--accent)' : 'var(--text-primary)', backgroundColor: item.isShared ? 'var(--accent-subtle)' : 'var(--surface-hover)', border: item.isShared ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--surface-hover)', cursor: shareLoading ? 'not-allowed' : 'pointer', opacity: shareLoading ? 0.6 : 1, transition: 'background-color 0.1s ease' }}
                  onMouseEnter={(e) => { if (!shareLoading) e.currentTarget.style.backgroundColor = item.isShared ? 'rgba(255,255,255,0.08)' : 'var(--border-strong)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = item.isShared ? 'var(--accent-subtle)' : 'var(--surface-hover)' }}
                >
                  <Share2 size={13} strokeWidth={2} />
                  {shareLoading ? 'Sharing…' : item.isShared ? 'Shared' : 'Share'}
                </button>

                {sharePopoverOpen && item.isShared && (
                  <div
                    style={{ position: 'absolute', top: '40px', right: 0, width: '320px', zIndex: 100, background: 'var(--glass)', backdropFilter: 'blur(20px)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', boxShadow: 'var(--shadow-lg)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>Share link</p>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                      <code
                        style={{ flex: 1, fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--input-bg)', border: '1px solid var(--surface-hover)', borderRadius: '5px', padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                      >
                        {shareUrl}
                      </code>
                      <button
                        onClick={handleCopyLink}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '32px', padding: '0 10px', borderRadius: '5px', fontSize: '12px', fontWeight: 600, color: copied ? 'var(--success)' : 'var(--text-primary)', backgroundColor: copied ? 'rgba(34,197,94,0.1)' : 'var(--surface-hover)', border: '1px solid var(--surface-hover)', cursor: 'pointer', flexShrink: 0, transition: 'background-color 0.1s ease' }}
                      >
                        {copied ? <Check size={11} strokeWidth={2} /> : <Copy size={11} strokeWidth={2} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <button
                      onClick={handleStopSharing}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', color: 'var(--danger)', cursor: 'pointer', opacity: 0.8 }}
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
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#fff', backgroundColor: 'var(--accent)', textDecoration: 'none', transition: 'background-color 0.1s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-hover)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)' }}
                >
                  <Download size={13} strokeWidth={2} />
                  Export
                </a>
              )}
            </div>
          </div>

          {/* Generating state */}
          {item.status === 'generating' && (
            <div style={{ padding: '32px', textAlign: 'center', background: 'var(--surface)', backdropFilter: 'blur(12px)', border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
                <RefreshCw size={16} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Generating content…</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>This usually takes 10-30 seconds. Page will update automatically.</p>
            </div>
          )}

          {/* Content viewer */}
          {item.status === 'ready' && item.content && (
            <CollateralViewer content={item.content} />
          )}

          {item.status === 'stale' && (
            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--warning)', margin: 0 }}>
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
