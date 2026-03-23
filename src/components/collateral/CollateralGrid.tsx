'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Download, Eye, Trash2, RefreshCw, RotateCcw, Target } from 'lucide-react'
import { CollateralTypeBadge } from './CollateralTypeBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import type { Collateral, CollateralStatus } from '@/types'

interface CollateralGridProps {
  collateral: Collateral[]
  onGenerate?: () => void
  onExport?: (id: string) => void
  onDelete?: (id: string) => void
  onRegenerate?: (id: string) => void
  /** Map from dealLogId to deal display name, used to show linked deal */
  dealNameMap?: Record<string, string>
}

function formatDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** True when the item was regenerated (updated well after initial creation). */
function wasRegenerated(item: Collateral): boolean {
  if (!item.createdAt || !item.updatedAt) return false
  const created = new Date(item.createdAt).getTime()
  const updated = new Date(item.updatedAt).getTime()
  // Consider "regenerated" if updated > 30 seconds after creation
  return updated - created > 30_000
}

function CollateralCard({
  item,
  onExport,
  onDelete,
  onRegenerate,
  dealName,
}: {
  item: Collateral
  onExport?: (id: string) => void
  onDelete?: (id: string) => void
  onRegenerate?: (id: string) => void
  dealName?: string
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'border-color 150ms ease, background 150ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
    >
      {/* Top row: type badge + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <CollateralTypeBadge type={item.type} customTypeName={item.customTypeName} />
        <StatusBadge status={item.status as CollateralStatus & ('ready' | 'stale' | 'generating' | 'archived')} />
      </div>

      {/* Title */}
      <div>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#EBEBEB',
            margin: 0,
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
          }}
        >
          {item.title}
        </h3>
        {dealName && (
          <Link
            href={`/deals/${item.sourceDealLogId}`}
            onClick={e => e.stopPropagation()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              fontSize: '10px', fontWeight: 600,
              color: 'var(--accent, #6366F1)',
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.18)',
              borderRadius: '4px',
              padding: '1px 6px',
              textDecoration: 'none',
              marginTop: '3px',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <Target size={8} style={{ flexShrink: 0 }} />
            {dealName}
          </Link>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          <p style={{ fontSize: '12px', color: '#555', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            Generated {formatDate(item.generatedAt)}
          </p>
          {item.generationSource === 'proactive_brain' && (
            <span style={{
              fontSize: '10px',
              fontWeight: 500,
              color: '#A78BFA',
              background: 'rgba(167,139,250,0.1)',
              border: '1px solid rgba(167,139,250,0.2)',
              borderRadius: '4px',
              padding: '1px 5px',
              letterSpacing: '0.02em',
            }}>
              Auto-generated
            </span>
          )}
          {wasRegenerated(item) && item.status === 'ready' && (
            <span
              title={`Last updated ${formatDate(item.updatedAt)}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '10px',
                fontWeight: 500,
                color: '#6B7280',
                background: 'rgba(107,114,128,0.08)',
                border: '1px solid rgba(107,114,128,0.15)',
                borderRadius: '4px',
                padding: '1px 5px',
                letterSpacing: '0.02em',
              }}
            >
              <RotateCcw size={8} strokeWidth={2.5} />
              Updated
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
        <Link
          href={`/collateral/${item.id}`}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            height: '30px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#EBEBEB',
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            textDecoration: 'none',
            transition: 'background-color 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
        >
          <Eye size={11} strokeWidth={2} />
          View
        </Link>

        {item.status === 'stale' && onRegenerate && (
          <button
            onClick={() => onRegenerate(item.id)}
            title="Regenerate"
            style={{
              height: '30px',
              width: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              backgroundColor: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.25)',
              cursor: 'pointer',
              color: '#F59E0B',
              transition: 'background-color 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.1)' }}
          >
            <RefreshCw size={12} strokeWidth={2} />
          </button>
        )}

        {item.status === 'ready' && onExport && (
          <button
            onClick={() => onExport(item.id)}
            title="Export as PDF"
            style={{
              height: '30px',
              width: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              backgroundColor: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
              cursor: 'pointer',
              color: '#6366F1',
              transition: 'background-color 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.1)' }}
          >
            <Download size={12} strokeWidth={2} />
          </button>
        )}

        {onDelete && (
          confirming ? (
            <>
              <button
                onClick={() => { onDelete(item.id); setConfirming(false) }}
                title="Confirm delete"
                style={{
                  height: '30px',
                  padding: '0 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  cursor: 'pointer',
                  color: '#EF4444',
                  fontSize: '11px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.25)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)' }}
              >
                Delete
              </button>
              <button
                onClick={() => setConfirming(false)}
                title="Cancel"
                style={{
                  height: '30px',
                  width: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  color: '#888',
                  fontSize: '13px',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              title="Delete"
              style={{
                height: '30px',
                width: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                color: '#555',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'
                e.currentTarget.style.color = '#EF4444'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.color = '#555'
              }}
            >
              <Trash2 size={12} strokeWidth={2} />
            </button>
          )
        )}
      </div>
    </div>
  )
}

export function CollateralGrid({ collateral, onGenerate, onExport, onDelete, onRegenerate, dealNameMap }: CollateralGridProps) {
  if (collateral.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No collateral generated yet"
        description="Generate your first battlecard, one-pager, or email sequence using AI."
        action={onGenerate ? { label: 'Generate collateral', onClick: onGenerate } : undefined}
      />
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '12px',
      }}
    >
      {collateral.map((item) => (
        <CollateralCard
          key={item.id}
          item={item}
          onExport={onExport}
          onDelete={onDelete}
          onRegenerate={onRegenerate}
          dealName={item.sourceDealLogId && dealNameMap ? dealNameMap[item.sourceDealLogId] : undefined}
        />
      ))}
    </div>
  )
}
