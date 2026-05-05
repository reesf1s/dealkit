'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Trash2, Sparkles } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { EmptyState } from '@/components/shared/EmptyState'
import { Users } from 'lucide-react'
import type { Competitor, Collateral } from '@/types'

interface CompetitorTableProps {
  competitors: Competitor[]
  collateral: Collateral[]
  onDelete: (id: string) => Promise<void>
  onGenerateBattlecard: (competitorId: string) => Promise<void>
}

function formatDate(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function CompetitorTable({ competitors, collateral, onDelete, onGenerateBattlecard }: CompetitorTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  const getBattlecardStatus = (competitorId: string) => {
    const cards = collateral.filter(
      (c) => c.type === 'battlecard' && c.sourceCompetitorId === competitorId
    )
    if (cards.length === 0) return null
    // Return most recent
    return cards.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
  }

  const handleGenerateBattlecard = async (id: string) => {
    setGeneratingId(id)
    try {
      await onGenerateBattlecard(id)
    } finally {
      setGeneratingId(null)
    }
  }

  if (competitors.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No competitors tracked"
        description="Add your first competitor to start building battlecards and competitive intelligence."
      />
    )
  }

  return (
    <>
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid rgba(55,53,47,0.12)',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(55,53,47,0.06)',
          overflow: 'hidden',
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 140px 180px',
            padding: '10px 16px',
            background: '#f7f6f3',
            borderBottom: '1px solid rgba(55,53,47,0.09)',
          }}
        >
          {['Name', 'Last updated', 'Battlecard', 'Actions'].map((h) => (
            <span
              key={h}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#787774',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {competitors.map((competitor) => {
          const battlecard = getBattlecardStatus(competitor.id)
          const isGenerating = generatingId === competitor.id

          return (
            <div
              key={competitor.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 140px 140px 180px',
                padding: '12px 16px',
                borderBottom: '1px solid rgba(55,53,47,0.09)',
                alignItems: 'center',
                transition: 'background-color 100ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f7f6f3' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              {/* Name */}
              <div>
                <Link
                  href={`/competitors/${competitor.id}`}
                  style={{ fontSize: '13px', fontWeight: 500, color: '#37352f', textDecoration: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--brand)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#37352f' }}
                >
                  {competitor.name}
                </Link>
                {competitor.website && (
                  <a
                    href={competitor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#9b9a97', textDecoration: 'none', marginLeft: '8px' }}
                  >
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>

              {/* Last updated */}
              <span style={{ fontSize: '12px', color: '#787774', fontVariantNumeric: 'tabular-nums' }}>
                {formatDate(competitor.updatedAt)}
              </span>

              {/* Battlecard status */}
              <div>
                {battlecard ? (
                  <StatusBadge status={battlecard.status as 'ready' | 'stale' | 'generating' | 'archived'} />
                ) : (
                  <span style={{ fontSize: '11px', color: '#9b9a97' }}>None</span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Link
                  href={`/competitors/${competitor.id}`}
                  style={{ height: '28px', padding: '0 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: '#37352f', backgroundColor: 'rgba(55,53,47,0.06)', border: '1px solid rgba(55,53,47,0.12)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(55,53,47,0.10)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(55,53,47,0.06)' }}
                >
                  View
                </Link>

                <button
                  onClick={() => handleGenerateBattlecard(competitor.id)}
                  disabled={isGenerating}
                  title={battlecard ? 'Regenerate battlecard' : 'Generate battlecard'}
                  style={{ height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', backgroundColor: 'rgba(55,53,47,0.06)', border: '1px solid rgba(55,53,47,0.12)', cursor: isGenerating ? 'not-allowed' : 'pointer', color: '#787774' }}
                  onMouseEnter={(e) => { if (!isGenerating) e.currentTarget.style.backgroundColor = 'rgba(55,53,47,0.10)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(55,53,47,0.06)' }}
                >
                  <Sparkles size={12} strokeWidth={2} style={{ animation: isGenerating ? 'spin 1s linear infinite' : 'none' }} />
                </button>

                <button
                  onClick={() => setDeleteId(competitor.id)}
                  title="Delete competitor"
                  style={{ height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid rgba(55,53,47,0.09)', cursor: 'pointer', color: '#9b9a97' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#e03e3e'; e.currentTarget.style.backgroundColor = 'rgba(224,62,62,0.08)'; e.currentTarget.style.borderColor = 'rgba(224,62,62,0.20)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#9b9a97'; e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'rgba(55,53,47,0.09)' }}
                >
                  <Trash2 size={12} strokeWidth={2} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmModal
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        title="Delete competitor"
        description="This will permanently delete this competitor and any associated battlecards. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleteId) await onDelete(deleteId)
          setDeleteId(null)
        }}
      />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
