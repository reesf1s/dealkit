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
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 140px 180px',
            padding: '10px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {['Name', 'Last updated', 'Battlecard', 'Actions'].map((h) => (
            <span
              key={h}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#555',
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
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                alignItems: 'center',
                transition: 'background-color 100ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              {/* Name */}
              <div>
                <Link
                  href={`/competitors/${competitor.id}`}
                  style={{ fontSize: '13px', fontWeight: 500, color: '#EBEBEB', textDecoration: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.80)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#EBEBEB' }}
                >
                  {competitor.name}
                </Link>
                {competitor.website && (
                  <a
                    href={competitor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#555', textDecoration: 'none', marginLeft: '8px' }}
                  >
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>

              {/* Last updated */}
              <span style={{ fontSize: '12px', color: '#555', fontVariantNumeric: 'tabular-nums' }}>
                {formatDate(competitor.updatedAt)}
              </span>

              {/* Battlecard status */}
              <div>
                {battlecard ? (
                  <StatusBadge status={battlecard.status as 'ready' | 'stale' | 'generating' | 'archived'} />
                ) : (
                  <span style={{ fontSize: '11px', color: '#444' }}>None</span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Link
                  href={`/competitors/${competitor.id}`}
                  style={{ height: '28px', padding: '0 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: '#EBEBEB', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
                >
                  View
                </Link>

                <button
                  onClick={() => handleGenerateBattlecard(competitor.id)}
                  disabled={isGenerating}
                  title={battlecard ? 'Regenerate battlecard' : 'Generate battlecard'}
                  style={{ height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', cursor: isGenerating ? 'not-allowed' : 'pointer', color: 'rgba(255,255,255,0.80)' }}
                  onMouseEnter={(e) => { if (!isGenerating) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
                >
                  <Sparkles size={12} strokeWidth={2} style={{ animation: isGenerating ? 'spin 1s linear infinite' : 'none' }} />
                </button>

                <button
                  onClick={() => setDeleteId(competitor.id)}
                  title="Delete competitor"
                  style={{ height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', color: '#555' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.backgroundColor = 'transparent' }}
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
