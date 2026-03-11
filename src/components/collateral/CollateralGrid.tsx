'use client'

import Link from 'next/link'
import { FileText, Download, Eye, RefreshCw } from 'lucide-react'
import { CollateralTypeBadge } from './CollateralTypeBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import type { Collateral, CollateralType, CollateralStatus } from '@/types'

interface CollateralGridProps {
  collateral: Collateral[]
  onGenerate?: () => void
  onExport?: (id: string) => void
}

function formatDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CollateralCard({ item, onExport }: { item: Collateral; onExport?: (id: string) => void }) {
  return (
    <div
      style={{
        backgroundColor: '#141414',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'border-color 150ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
    >
      {/* Top row: type badge + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <CollateralTypeBadge type={item.type} />
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
        <p style={{ fontSize: '12px', color: '#555', margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
          Generated {formatDate(item.generatedAt)}
        </p>
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
      </div>
    </div>
  )
}

export function CollateralGrid({ collateral, onGenerate, onExport }: CollateralGridProps) {
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
        <CollateralCard key={item.id} item={item} onExport={onExport} />
      ))}
    </div>
  )
}
