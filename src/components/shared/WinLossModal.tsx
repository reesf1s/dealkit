'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, ChevronDown } from 'lucide-react'

interface WinLossModalProps {
  deal: { id: string; prospectCompany: string; dealName?: string; stage?: string }
  outcome: 'closed_won' | 'closed_lost'
  onSubmit: (data: WinLossData) => void
  onSkip?: () => void
}

export interface WinLossData {
  primaryReason: string
  competitor: string
  hardestObjection: string
  championPresent: 'yes' | 'no' | 'unknown'
  notes: string
}

const WIN_REASONS = [
  'Best product fit', 'Price / value', 'Strong champion', 'Speed of sales process',
  'Better support / service', 'Integration fit', 'Existing relationship', 'Other',
]

const LOSS_REASONS = [
  'Lost to competitor', 'Budget cut / no budget', 'No champion / no internal sponsor',
  'Went with status quo (no decision)', 'Too slow / lost momentum', 'Product gaps',
  'Price too high', 'Other',
]

const COMMON_COMPETITORS = [
  'None', 'Salesforce', 'HubSpot', 'Pipedrive', 'Lightfield', 'Gong', 'Clari', 'Other',
]

const COMMON_OBJECTIONS = [
  'None', 'Price / budget', 'Need for more features', 'Integration concerns',
  'Security / compliance', 'Competitor evaluation', 'Internal buy-in', 'Timing', 'Other',
]

export default function WinLossModal({ deal, outcome, onSubmit, onSkip }: WinLossModalProps) {
  const isWon = outcome === 'closed_won'
  const [data, setData] = useState<WinLossData>({
    primaryReason: '',
    competitor: '',
    hardestObjection: '',
    championPresent: 'unknown',
    notes: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const primaryReasonMissing = submitted && !data.primaryReason
  const competitorMissing = submitted && !isWon && data.primaryReason === 'Lost to competitor' && !data.competitor

  const accentColor = isWon ? 'var(--success)' : 'var(--danger)'
  const accentBg = isWon ? 'color-mix(in srgb, var(--success) 8%, transparent)' : 'color-mix(in srgb, var(--danger) 8%, transparent)'

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    background: 'var(--input-bg)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    appearance: 'none', cursor: 'pointer',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: accentBg, border: `1px solid ${accentColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isWon ? <CheckCircle size={20} style={{ color: accentColor }} /> : <XCircle size={20} style={{ color: accentColor }} />}
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {isWon ? '🎉 Deal Won!' : 'Deal Lost'}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {deal.prospectCompany} — help improve your ML model
              </p>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, padding: '10px 14px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', margin: 0 }}>
          Quick answers train your private ML model. The more deals you capture, the more accurate your win predictions become.
        </p>

        {/* Primary reason — required */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: primaryReasonMissing ? 'var(--danger)' : 'var(--text-secondary)', marginBottom: '6px' }}>
            Primary reason for {isWon ? 'winning' : 'losing'} <span style={{ color: 'var(--danger)' }}>*</span>
            {primaryReasonMissing && <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: '500' }}>Required</span>}
          </label>
          <div style={{ position: 'relative' }}>
            <select value={data.primaryReason} onChange={e => setData(d => ({ ...d, primaryReason: e.target.value }))} style={{ ...selectStyle, borderColor: primaryReasonMissing ? 'var(--danger)' : undefined }}>
              <option value="">Select a reason…</option>
              {(isWon ? WIN_REASONS : LOSS_REASONS).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown size={13} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Competitor — required when loss reason is "Lost to competitor" */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: competitorMissing ? 'var(--danger)' : 'var(--text-secondary)', marginBottom: '6px' }}>
            Which competitor was in the running?
            {data.primaryReason === 'Lost to competitor' && !isWon && <span style={{ color: 'var(--danger)' }}> *</span>}
            {competitorMissing && <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: '500' }}>Required when lost to competitor</span>}
          </label>
          <div style={{ position: 'relative' }}>
            <select value={data.competitor} onChange={e => setData(d => ({ ...d, competitor: e.target.value }))} style={{ ...selectStyle, borderColor: competitorMissing ? 'var(--danger)' : undefined }}>
              <option value="">Select…</option>
              {COMMON_COMPETITORS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={13} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Hardest objection */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Hardest objection to handle
          </label>
          <div style={{ position: 'relative' }}>
            <select value={data.hardestObjection} onChange={e => setData(d => ({ ...d, hardestObjection: e.target.value }))} style={selectStyle}>
              <option value="">Select…</option>
              {COMMON_OBJECTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronDown size={13} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Champion present */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Was there an internal champion?
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['yes', 'no', 'unknown'] as const).map(v => (
              <button
                key={v}
                onClick={() => setData(d => ({ ...d, championPresent: v }))}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid', transition: 'all 0.12s',
                  background: data.championPresent === v ? accentBg : 'var(--surface)',
                  color: data.championPresent === v ? accentColor : 'var(--text-secondary)',
                  borderColor: data.championPresent === v ? accentColor : 'var(--border)',
                }}
              >
                {v === 'yes' ? 'Yes' : v === 'no' ? 'No' : 'Unsure'}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Anything else? (optional)
          </label>
          <textarea
            value={data.notes}
            onChange={e => setData(d => ({ ...d, notes: e.target.value }))}
            placeholder="Key learnings, what you'd do differently…"
            rows={2}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              setSubmitted(true)
              if (!data.primaryReason) return
              if (!isWon && data.primaryReason === 'Lost to competitor' && !data.competitor) return
              onSubmit(data)
            }}
            style={{ flex: 1, padding: '10px', borderRadius: '9px', background: accentColor, border: 'none', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
          >
            Save & close deal
          </button>
        </div>
      </div>
    </div>
  )
}
