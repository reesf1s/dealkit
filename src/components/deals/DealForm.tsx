'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { DealLog, DealStage } from '@/types'

interface DealFormProps {
  onSubmit: (data: Partial<DealLog>) => Promise<void>
  loading?: boolean
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>
      {children}
    </label>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', color: '#EBEBEB', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms ease' }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)' }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', color: '#EBEBEB', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, transition: 'border-color 150ms ease', fontFamily: 'inherit' }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)' }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
    />
  )
}

interface FormState {
  dealName: string
  prospectCompany: string
  prospectName: string
  prospectTitle: string
  dealValue: string
  stage: DealStage
  competitors: string
  notes: string
  nextSteps: string
  lostReason: string
}

export function DealForm({ onSubmit, loading = false }: DealFormProps) {
  const [form, setForm] = useState<FormState>({
    dealName: '',
    prospectCompany: '',
    prospectName: '',
    prospectTitle: '',
    dealValue: '',
    stage: 'closed_won',
    competitors: '',
    notes: '',
    nextSteps: '',
    lostReason: '',
  })
  const [expanded, setExpanded] = useState(false)

  const u = (patch: Partial<FormState>) => setForm((p) => ({ ...p, ...patch }))

  const isWon = form.stage === 'closed_won'
  const isLost = form.stage === 'closed_lost'
  const isClosed = isWon || isLost

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.dealName.trim() || !form.prospectCompany.trim()) return

    const now = new Date()
    await onSubmit({
      dealName: form.dealName,
      prospectCompany: form.prospectCompany,
      prospectName: form.prospectName || null,
      prospectTitle: form.prospectTitle || null,
      dealValue: form.dealValue ? Number(form.dealValue) : null,
      stage: form.stage,
      competitors: form.competitors
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      notes: form.notes || null,
      nextSteps: form.nextSteps || null,
      lostReason: form.lostReason || null,
      wonDate: isWon ? now : null,
      lostDate: isLost ? now : null,
      closeDate: isClosed ? now : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Deal name */}
      <div>
        <Label>Deal name *</Label>
        <Input value={form.dealName} onChange={(v) => u({ dealName: v })} placeholder="e.g. Acme Corp Q2 Expansion" />
      </div>

      {/* Prospect company */}
      <div>
        <Label>Prospect company *</Label>
        <Input value={form.prospectCompany} onChange={(v) => u({ prospectCompany: v })} placeholder="e.g. Acme Corp" />
      </div>

      {/* Outcome toggle — prominent */}
      <div>
        <Label>Outcome</Label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {([
            { stage: 'closed_won' as DealStage, label: '🏆 Won', color: '#22C55E', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)' },
            { stage: 'closed_lost' as DealStage, label: '✗ Lost', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
            { stage: 'proposal' as DealStage, label: 'In progress', color: '#888', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
          ] as const).map(({ stage, label, color, bg, border }) => (
            <button
              key={stage}
              type="button"
              onClick={() => u({ stage })}
              style={{
                flex: 1,
                height: '36px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: form.stage === stage ? color : '#555',
                backgroundColor: form.stage === stage ? bg : 'transparent',
                border: `2px solid ${form.stage === stage ? border : 'rgba(255,255,255,0.06)'}`,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lost reason — only when lost */}
      {isLost && (
        <div>
          <Label>Primary reason for loss</Label>
          <Input value={form.lostReason} onChange={(v) => u({ lostReason: v })} placeholder="e.g. Price too high, went with competitor" />
        </div>
      )}

      {/* Competitor */}
      <div>
        <Label>Competitor(s)</Label>
        <Input value={form.competitors} onChange={(v) => u({ competitors: v })} placeholder="Competitor A, Competitor B (comma-separated)" />
      </div>

      {/* Deal value */}
      <div>
        <Label>Deal value ($)</Label>
        <Input value={form.dealValue} onChange={(v) => u({ dealValue: v })} placeholder="50000" type="number" />
      </div>

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 'fit-content' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#EBEBEB' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#888' }}
      >
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {expanded ? 'Hide' : 'Show'} additional details
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <Label>Contact name</Label>
              <Input value={form.prospectName} onChange={(v) => u({ prospectName: v })} placeholder="Jane Smith" />
            </div>
            <div>
              <Label>Contact title</Label>
              <Input value={form.prospectTitle} onChange={(v) => u({ prospectTitle: v })} placeholder="VP of Engineering" />
            </div>
          </div>

          <div>
            <Label>Notes / learnings</Label>
            <Textarea value={form.notes} onChange={(v) => u({ notes: v })} placeholder="What did you learn from this deal?" rows={3} />
          </div>

          {!isClosed && (
            <div>
              <Label>Next steps</Label>
              <Input value={form.nextSteps} onChange={(v) => u({ nextSteps: v })} placeholder="Schedule follow-up call" />
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
        <button
          type="submit"
          disabled={loading || !form.dealName.trim() || !form.prospectCompany.trim()}
          style={{ height: '34px', padding: '0 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#fff', backgroundColor: loading || !form.dealName.trim() || !form.prospectCompany.trim() ? '#333' : '#6366F1', border: 'none', cursor: loading || !form.dealName.trim() || !form.prospectCompany.trim() ? 'not-allowed' : 'pointer', transition: 'background-color 150ms ease' }}
          onMouseEnter={(e) => { if (!loading && form.dealName.trim() && form.prospectCompany.trim()) e.currentTarget.style.backgroundColor = '#4F46E5' }}
          onMouseLeave={(e) => { if (!loading && form.dealName.trim() && form.prospectCompany.trim()) e.currentTarget.style.backgroundColor = '#6366F1' }}
        >
          {loading ? 'Logging…' : 'Log deal'}
        </button>
      </div>
    </form>
  )
}
