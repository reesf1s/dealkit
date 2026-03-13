'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import type { DealContact, DealLog, DealStage } from '@/types'

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

const EMPTY_CONTACT: DealContact = { name: '', title: '', email: '' }

interface FormState {
  dealName: string
  prospectCompany: string
  description: string
  dealValue: string
  stage: DealStage
  dealType: 'one_off' | 'recurring'
  recurringInterval: 'monthly' | 'quarterly' | 'annual'
  competitors: string
  notes: string
  nextSteps: string
  lostReason: string
}

export function DealForm({ onSubmit, loading = false }: DealFormProps) {
  const [form, setForm] = useState<FormState>({
    dealName: '',
    prospectCompany: '',
    description: '',
    dealValue: '',
    stage: 'closed_won',
    dealType: 'one_off',
    recurringInterval: 'annual',
    competitors: '',
    notes: '',
    nextSteps: '',
    lostReason: '',
  })
  const [contacts, setContacts] = useState<DealContact[]>([{ ...EMPTY_CONTACT }])
  const [expanded, setExpanded] = useState(false)

  const u = (patch: Partial<FormState>) => setForm((p) => ({ ...p, ...patch }))

  const updateContact = (i: number, field: keyof DealContact, value: string) =>
    setContacts(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))

  const addContact = () => setContacts(prev => [...prev, { ...EMPTY_CONTACT }])

  const removeContact = (i: number) => setContacts(prev => prev.filter((_, idx) => idx !== i))

  const isWon = form.stage === 'closed_won'
  const isLost = form.stage === 'closed_lost'
  const isClosed = isWon || isLost

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.dealName.trim() || !form.prospectCompany.trim()) return

    // Filter out empty contacts
    const cleanContacts = contacts
      .map(c => ({ name: c.name.trim(), title: c.title?.trim() || undefined, email: c.email?.trim() || undefined }))
      .filter(c => c.name)

    const now = new Date()
    await onSubmit({
      dealName: form.dealName,
      prospectCompany: form.prospectCompany,
      description: form.description || null,
      // Keep prospectName/prospectTitle in sync with first contact for backward compat
      prospectName: cleanContacts[0]?.name ?? null,
      prospectTitle: cleanContacts[0]?.title ?? null,
      contacts: cleanContacts,
      dealValue: form.dealValue ? Number(form.dealValue) : null,
      stage: form.stage,
      dealType: form.dealType,
      recurringInterval: form.dealType === 'recurring' ? form.recurringInterval : null,
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

      {/* Outcome toggle */}
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
                flex: 1, height: '36px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                color: form.stage === stage ? color : '#555',
                backgroundColor: form.stage === stage ? bg : 'transparent',
                border: `2px solid ${form.stage === stage ? border : 'rgba(255,255,255,0.06)'}`,
                cursor: 'pointer', transition: 'all 150ms ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lost reason */}
      {isLost && (
        <div>
          <Label>Primary reason for loss</Label>
          <Input value={form.lostReason} onChange={(v) => u({ lostReason: v })} placeholder="e.g. Price too high, went with competitor" />
        </div>
      )}

      {/* Deal type */}
      <div>
        <Label>Deal type</Label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {([
            { type: 'one_off' as const, label: 'One-off' },
            { type: 'recurring' as const, label: 'Recurring' },
          ]).map(({ type, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => u({ dealType: type })}
              style={{
                flex: 1, height: '34px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
                color: form.dealType === type ? '#EBEBEB' : '#555',
                backgroundColor: form.dealType === type ? 'rgba(99,102,241,0.15)' : 'transparent',
                border: `1px solid ${form.dealType === type ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer', transition: 'all 150ms ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {form.dealType === 'recurring' && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            {(['monthly', 'quarterly', 'annual'] as const).map((interval) => (
              <button
                key={interval}
                type="button"
                onClick={() => u({ recurringInterval: interval })}
                style={{
                  flex: 1, height: '28px', borderRadius: '6px', fontSize: '11px', fontWeight: 500, textTransform: 'capitalize',
                  color: form.recurringInterval === interval ? '#EBEBEB' : '#666',
                  backgroundColor: form.recurringInterval === interval ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: `1px solid ${form.recurringInterval === interval ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
                  cursor: 'pointer', transition: 'all 150ms ease',
                }}
              >
                {interval}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Competitor */}
      <div>
        <Label>Competitor(s)</Label>
        <Input value={form.competitors} onChange={(v) => u({ competitors: v })} placeholder="Competitor A, Competitor B (comma-separated)" />
      </div>

      {/* Deal value */}
      <div>
        <Label>{form.dealType === 'recurring' ? `Deal value (${form.recurringInterval === 'monthly' ? 'MRR' : form.recurringInterval === 'quarterly' ? 'QRR' : 'ARR'} £)` : 'Deal value (£)'}</Label>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

          {/* Description */}
          <div>
            <Label>Deal description</Label>
            <Textarea
              value={form.description}
              onChange={(v) => u({ description: v })}
              placeholder="Overview of the opportunity, context, or key details…"
              rows={2}
            />
          </div>

          {/* Contacts */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Label>Contacts</Label>
              <button
                type="button"
                onClick={addContact}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '11px', color: '#6366F1', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, fontWeight: 600,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#818CF8' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#6366F1' }}
              >
                <Plus size={11} /> Add contact
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {contacts.map((contact, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '8px',
                    padding: '10px',
                    position: 'relative',
                  }}
                >
                  {contacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContact(i)}
                      style={{
                        position: 'absolute', top: '8px', right: '8px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#444', display: 'flex', alignItems: 'center', padding: '2px',
                        borderRadius: '4px',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#EF4444' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#444' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Name</label>
                      <Input value={contact.name} onChange={v => updateContact(i, 'name', v)} placeholder="Jane Smith" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Title</label>
                      <Input value={contact.title ?? ''} onChange={v => updateContact(i, 'title', v)} placeholder="VP of Engineering" />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Email</label>
                    <Input value={contact.email ?? ''} onChange={v => updateContact(i, 'email', v)} placeholder="jane@acme.com" type="email" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
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
