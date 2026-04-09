'use client'

import { useState } from 'react'
import { Sparkles, RefreshCw, ExternalLink } from 'lucide-react'
import { CompetitorForm } from './CompetitorForm'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/shared/Toast'
import type { Competitor, Collateral, DealLog } from '@/types'

interface CompetitorDetailProps {
  competitor: Competitor
  collateral: Collateral[]
  linkedDeals: DealLog[]
  onSave: (data: Partial<Competitor>) => Promise<void>
  onGenerateBattlecard: () => Promise<void>
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function CompetitorDetail({ competitor, collateral, linkedDeals, onSave, onGenerateBattlecard }: CompetitorDetailProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const battlecards = collateral
    .filter((c) => c.type === 'battlecard' && c.sourceCompetitorId === competitor.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const latestBattlecard = battlecards[0] ?? null

  async function handleSave(data: Partial<Competitor>) {
    setSaving(true)
    try {
      await onSave(data)
      toast('Competitor saved', 'success')
    } catch {
      toast('Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      await onGenerateBattlecard()
      toast('Battlecard generation started', 'success')
    } catch {
      toast('Failed to start generation', 'error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px', alignItems: 'start' }}>
      {/* Left: form */}
      <div>
        <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(55,53,47,0.12)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(55,53,47,0.06)', padding: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#37352f', margin: '0 0 16px' }}>
            Competitor details
          </h2>
          <CompetitorForm
            initialData={competitor}
            onSubmit={handleSave}
            submitLabel="Save changes"
            loading={saving}
          />
        </div>
      </div>

      {/* Right: battlecard + linked deals */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Battlecard card */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(55,53,47,0.12)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(55,53,47,0.06)', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#37352f' }}>Battlecard</span>
            {latestBattlecard && (
              <StatusBadge status={latestBattlecard.status as 'ready' | 'stale' | 'generating' | 'archived'} />
            )}
          </div>

          {latestBattlecard ? (
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', color: '#787774', margin: '0 0 4px' }}>Last generated</p>
              <p style={{ fontSize: '13px', color: '#37352f', margin: 0 }}>
                {latestBattlecard.generatedAt ? formatDate(latestBattlecard.generatedAt) : 'Never'}
              </p>
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: '#787774', margin: '0 0 12px' }}>
              No battlecard generated yet. Click below to create one using AI.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '32px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#ffffff', backgroundColor: generating ? 'rgba(55,53,47,0.25)' : '#5e6ad2', border: 'none', cursor: generating ? 'not-allowed' : 'pointer', transition: 'background-color 150ms ease' }}
              onMouseEnter={(e) => { if (!generating) e.currentTarget.style.backgroundColor = '#4f5ab8' }}
              onMouseLeave={(e) => { if (!generating) e.currentTarget.style.backgroundColor = '#5e6ad2' }}
            >
              {generating ? (
                <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
              ) : (
                <><Sparkles size={12} strokeWidth={2} /> {latestBattlecard ? 'Regenerate' : 'Generate'} Battlecard</>
              )}
            </button>

            {latestBattlecard && latestBattlecard.status === 'ready' && (
              <a
                href={`/collateral/${latestBattlecard.id}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '32px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: '#37352f', backgroundColor: 'rgba(55,53,47,0.06)', border: '1px solid rgba(55,53,47,0.12)', textDecoration: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(55,53,47,0.10)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(55,53,47,0.06)' }}
              >
                <ExternalLink size={12} /> View battlecard
              </a>
            )}
          </div>
        </div>

        {/* Linked deals */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(55,53,47,0.12)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(55,53,47,0.06)', padding: '16px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#37352f', display: 'block', marginBottom: '10px' }}>
            Linked deals ({linkedDeals.length})
          </span>

          {linkedDeals.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#787774', margin: 0 }}>
              No deals logged against this competitor yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {linkedDeals.slice(0, 5).map((deal) => (
                <div key={deal.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '6px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.09)' }}>
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 500, color: '#37352f', margin: 0 }}>{deal.dealName}</p>
                    <p style={{ fontSize: '11px', color: '#787774', margin: '2px 0 0' }}>{deal.prospectCompany}</p>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    color: deal.stage === 'closed_won' ? '#0f7b6c' : '#e03e3e',
                    backgroundColor: deal.stage === 'closed_won' ? 'rgba(15,123,108,0.08)' : 'rgba(224,62,62,0.08)',
                  }}>
                    {deal.stage === 'closed_won' ? 'Won' : 'Lost'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
