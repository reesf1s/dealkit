'use client'

import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import type { DealContact, DealLog, DealStage } from '@/types'

type DealFormSeed = {
  dealName?: string | null
  prospectCompany?: string | null
  prospectName?: string | null
  prospectTitle?: string | null
  contacts?: Array<{ name: string; title?: string | null; email?: string | null }> | null
  description?: string | null
  dealValue?: number | null
  stage?: string | DealStage | null
  dealType?: 'one_off' | 'recurring' | null
  recurringInterval?: 'monthly' | 'quarterly' | 'annual' | null
  competitors?: string[] | null
  nextSteps?: string | null
  lostReason?: string | null
  assignedRepId?: string | null
  engagementType?: string | null
  forecastCategory?: '' | 'commit' | 'upside' | 'pipeline' | 'omit' | null
  closeDate?: string | Date | null
  wonDate?: string | Date | null
  lostDate?: string | Date | null
  contractEndDate?: string | Date | null
}

interface DealFormProps {
  onSubmit: (data: Partial<DealLog>) => Promise<void>
  loading?: boolean
  initialData?: DealFormSeed | null
  submitLabel?: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)',
      letterSpacing: '0.08em', textTransform: 'uppercase',
      marginBottom: '10px', paddingBottom: '6px',
      borderBottom: '1px solid rgba(55,53,47,0.07)',
    }}>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', fontSize: '11px', fontWeight: 600,
      color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase',
      marginBottom: '5px',
    }}>
      {children}
    </label>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px',
        background: 'rgba(55,53,47,0.04)', border: '1px solid rgba(55,53,47,0.12)',
        color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
        boxSizing: 'border-box', transition: 'border-color 150ms ease',
      }}
      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(94,106,210,0.35)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(94,106,210,0.10)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(55,53,47,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%', padding: '8px 10px', borderRadius: '6px',
        background: 'rgba(55,53,47,0.04)', border: '1px solid rgba(55,53,47,0.12)',
        color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
        resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6,
        transition: 'border-color 150ms ease', fontFamily: 'inherit',
      }}
      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(94,106,210,0.35)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(94,106,210,0.10)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(55,53,47,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
    />
  )
}

const STAGES_LIST = [
  { id: 'prospecting',   label: 'Prospecting',   color: '#94a3b8' },
  { id: 'qualification', label: 'Qualification', color: '#3b82f6' },
  { id: 'discovery',     label: 'Discovery',     color: '#8b5cf6' },
  { id: 'proposal',      label: 'Proposal',      color: '#f59e0b' },
  { id: 'negotiation',   label: 'Negotiation',   color: '#ef4444' },
  { id: 'closed_won',    label: 'Won',           color: '#10b981' },
  { id: 'closed_lost',   label: 'Lost',          color: '#e03e3e' },
] as const

const EMPTY_CONTACT: DealContact = { name: '', title: '', email: '' }

interface WorkspaceMember {
  userId: string
  email: string
  role: string
  appRole: string
}

interface FormState {
  dealName: string
  prospectCompany: string
  description: string
  dealValue: string
  stage: DealStage
  dealType: 'one_off' | 'recurring'
  recurringInterval: 'monthly' | 'quarterly' | 'annual'
  competitors: string
  nextSteps: string
  lostReason: string
  assignedRepId: string
  closeDate: string
  engagementType: string
  forecastCategory: '' | 'commit' | 'upside' | 'pipeline' | 'omit'
  contractEndDate: string
}

function toDateInputValue(value?: string | Date | null) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function buildSeedContacts(initialData?: DealFormSeed | null): DealContact[] {
  if (initialData?.contacts?.length) {
    return initialData.contacts.map(contact => ({
      name: contact.name ?? '',
      title: contact.title ?? '',
      email: contact.email ?? '',
    }))
  }

  if (initialData?.prospectName?.trim()) {
    return [{
      name: initialData.prospectName,
      title: initialData.prospectTitle ?? '',
      email: '',
    }]
  }

  return []
}

function buildFormState(initialData?: DealFormSeed | null): FormState {
  const seededStage = STAGES_LIST.some(stage => stage.id === initialData?.stage)
    ? (initialData?.stage as DealStage)
    : 'proposal'

  return {
    dealName: initialData?.dealName ?? '',
    prospectCompany: initialData?.prospectCompany ?? '',
    description: initialData?.description ?? '',
    dealValue: initialData?.dealValue != null ? String(initialData.dealValue) : '',
    stage: seededStage,
    dealType: initialData?.dealType ?? 'one_off',
    recurringInterval: initialData?.recurringInterval ?? 'annual',
    competitors: (initialData?.competitors ?? []).join(', '),
    nextSteps: initialData?.nextSteps ?? '',
    lostReason: initialData?.lostReason ?? '',
    assignedRepId: initialData?.assignedRepId ?? '',
    closeDate: toDateInputValue(initialData?.closeDate),
    engagementType: initialData?.engagementType ?? '',
    forecastCategory: initialData?.forecastCategory ?? '',
    contractEndDate: toDateInputValue(initialData?.contractEndDate),
  }
}

export function DealForm({ onSubmit, loading = false, initialData = null, submitLabel = 'Log deal' }: DealFormProps) {
  const [form, setForm] = useState<FormState>(() => buildFormState(initialData))
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [contacts, setContacts] = useState<DealContact[]>(() => buildSeedContacts(initialData))
  const [contactsOpen, setContactsOpen] = useState(() => buildSeedContacts(initialData).length > 0)
  const [errors, setErrors] = useState<{ dealValue?: string; dealName?: string; prospectCompany?: string }>({})

  useEffect(() => {
    fetch('/api/workspace/members')
      .then(r => r.json())
      .then((d: { data?: WorkspaceMember[] }) => { if (d.data) setMembers(d.data) })
      .catch(() => {})
  }, [])

  const u = (patch: Partial<FormState>) => setForm(p => ({ ...p, ...patch }))

  const updateContact = (i: number, field: keyof DealContact, value: string) =>
    setContacts(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))

  const addContact = () => {
    setContacts(prev => [...prev, { ...EMPTY_CONTACT }])
    setContactsOpen(true)
  }

  const removeContact = (i: number) => setContacts(prev => prev.filter((_, idx) => idx !== i))

  const isWon = form.stage === 'closed_won'
  const isLost = form.stage === 'closed_lost'
  const isClosed = isWon || isLost

  const validateForm = () => {
    const newErrors: typeof errors = {}
    if (form.dealValue !== '' && form.dealValue !== '0' && Number(form.dealValue) < 0) {
      newErrors.dealValue = 'Deal value cannot be negative.'
    }
    if (!form.dealName || form.dealName.trim().length < 2) {
      newErrors.dealName = 'Deal name is required (min 2 characters)'
    }
    if (!form.prospectCompany?.trim()) {
      newErrors.prospectCompany = 'Company name is required'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const cleanContacts = contacts
      .map(c => ({ name: c.name.trim(), title: c.title?.trim() || undefined, email: c.email?.trim() || undefined }))
      .filter(c => c.name)

    const now = new Date()
    const existingWonDate = initialData?.wonDate ? new Date(initialData.wonDate) : null
    const existingLostDate = initialData?.lostDate ? new Date(initialData.lostDate) : null
    const existingCloseDate = initialData?.closeDate ? new Date(initialData.closeDate) : null

    await onSubmit({
      dealName: form.dealName,
      prospectCompany: form.prospectCompany,
      description: form.description || null,
      prospectName: cleanContacts[0]?.name ?? null,
      prospectTitle: cleanContacts[0]?.title ?? null,
      contacts: cleanContacts,
      dealValue: form.dealValue !== '' ? Number(form.dealValue) : null,
      stage: form.stage,
      dealType: form.dealType,
      recurringInterval: form.dealType === 'recurring' ? form.recurringInterval : null,
      competitors: form.competitors.split(',').map(s => s.trim()).filter(Boolean),
      nextSteps: form.nextSteps || null,
      lostReason: form.lostReason || null,
      assignedRepId: form.assignedRepId || null,
      engagementType: form.engagementType || null,
      forecastCategory: form.forecastCategory || null,
      wonDate: isWon ? existingWonDate ?? now : null,
      lostDate: isLost ? existingLostDate ?? now : null,
      closeDate: form.closeDate ? new Date(form.closeDate) : isClosed ? existingCloseDate ?? now : null,
      contractEndDate: form.contractEndDate ? new Date(form.contractEndDate) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Section 1: Basics ── */}
      <div>
        <SectionLabel>Deal basics</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          <div>
            <Label>Company *</Label>
            <Input
              value={form.prospectCompany}
              onChange={v => { u({ prospectCompany: v }); if (errors.prospectCompany) setErrors(p => ({ ...p, prospectCompany: undefined })) }}
              placeholder="Acme Corp"
            />
            {errors.prospectCompany && <p style={{ color: '#e03e3e', fontSize: '11px', marginTop: '4px', margin: '4px 0 0' }}>{errors.prospectCompany}</p>}
          </div>

          <div>
            <Label>Deal name *</Label>
            <Input
              value={form.dealName}
              onChange={v => { u({ dealName: v }); if (errors.dealName) setErrors(p => ({ ...p, dealName: undefined })) }}
              placeholder="Acme Corp — Q2 Expansion"
            />
            {errors.dealName && <p style={{ color: '#e03e3e', fontSize: '11px', marginTop: '4px', margin: '4px 0 0' }}>{errors.dealName}</p>}
          </div>

          {/* Stage selector — horizontal pills */}
          <div>
            <Label>Stage</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {STAGES_LIST.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => u({ stage: s.id as DealStage })}
                  style={{
                    padding: '4px 10px', borderRadius: '100px',
                    fontSize: '12px', fontWeight: form.stage === s.id ? 600 : 400,
                    color: form.stage === s.id ? '#ffffff' : 'rgba(55,53,47,0.60)',
                    background: form.stage === s.id ? s.color : 'rgba(55,53,47,0.05)',
                    border: `1px solid ${form.stage === s.id ? s.color : 'rgba(55,53,47,0.10)'}`,
                    cursor: 'pointer', transition: 'all 100ms ease',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Value ── */}
      <div>
        <SectionLabel>Value</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <Label>{form.dealType === 'recurring' ? `Value (${form.recurringInterval === 'monthly' ? 'MRR' : form.recurringInterval === 'quarterly' ? 'QRR' : 'ARR'})` : 'Deal value'}</Label>
              <input
                type="number"
                value={form.dealValue}
                onChange={e => { u({ dealValue: e.target.value }); if (errors.dealValue) setErrors(p => ({ ...p, dealValue: undefined })) }}
                placeholder="50000"
                style={{
                  width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px',
                  background: 'rgba(55,53,47,0.04)',
                  border: `1px solid ${errors.dealValue ? '#e03e3e' : 'rgba(55,53,47,0.12)'}`,
                  color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 150ms ease',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = errors.dealValue ? '#e03e3e' : 'rgba(94,106,210,0.35)' }}
                onBlur={e => { e.currentTarget.style.borderColor = errors.dealValue ? '#e03e3e' : 'rgba(55,53,47,0.12)' }}
              />
              {errors.dealValue && <p style={{ color: '#e03e3e', fontSize: '11px', margin: '4px 0 0' }}>{errors.dealValue}</p>}
            </div>

            <div>
              <Label>Close date</Label>
              <input
                type="date"
                value={form.closeDate}
                onChange={e => u({ closeDate: e.target.value })}
                style={{
                  width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px',
                  background: 'rgba(55,53,47,0.04)', border: '1px solid rgba(55,53,47,0.12)',
                  color: form.closeDate ? '#37352f' : '#9b9a97', fontSize: '13px', outline: 'none',
                  boxSizing: 'border-box', cursor: 'pointer', fontFamily: 'inherit',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(94,106,210,0.35)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(55,53,47,0.12)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <Label>Forecast category</Label>
              <select
                value={form.forecastCategory}
                onChange={e => u({ forecastCategory: e.target.value as FormState['forecastCategory'] })}
                style={{
                  width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px',
                  background: 'rgba(55,53,47,0.04)', border: '1px solid rgba(55,53,47,0.12)',
                  color: form.forecastCategory ? '#37352f' : '#9b9a97',
                  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(94,106,210,0.35)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(55,53,47,0.12)' }}
              >
                <option value="">Not set</option>
                <option value="pipeline">Pipeline</option>
                <option value="upside">Upside</option>
                <option value="commit">Commit</option>
                <option value="omit">Omit</option>
              </select>
            </div>

            <div>
              <Label>Renewal / contract date</Label>
              <input
                type="date"
                value={form.contractEndDate}
                onChange={e => u({ contractEndDate: e.target.value })}
                style={{
                  width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px',
                  background: 'rgba(55,53,47,0.04)', border: '1px solid rgba(55,53,47,0.12)',
                  color: form.contractEndDate ? '#37352f' : '#9b9a97', fontSize: '13px', outline: 'none',
                  boxSizing: 'border-box', cursor: 'pointer', fontFamily: 'inherit',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(94,106,210,0.35)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(55,53,47,0.12)' }}
              />
            </div>
          </div>

          {/* Deal type */}
          <div>
            <Label>Deal type</Label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {([
                { type: 'one_off' as const, label: 'One-off' },
                { type: 'recurring' as const, label: 'Recurring' },
              ]).map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => u({ dealType: type })}
                  style={{
                    flex: 1, height: '32px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500,
                    color: form.dealType === type ? '#37352f' : '#9b9a97',
                    backgroundColor: form.dealType === type ? 'rgba(55,53,47,0.08)' : 'transparent',
                    border: `1px solid ${form.dealType === type ? 'rgba(55,53,47,0.18)' : 'rgba(55,53,47,0.09)'}`,
                    cursor: 'pointer', transition: 'all 150ms ease',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {form.dealType === 'recurring' && (
              <div style={{ display: 'flex', gap: '5px', marginTop: '7px' }}>
                {(['monthly', 'quarterly', 'annual'] as const).map(interval => (
                  <button
                    key={interval}
                    type="button"
                    onClick={() => u({ recurringInterval: interval })}
                    style={{
                      flex: 1, height: '26px', borderRadius: '5px', fontSize: '11px', fontWeight: 500, textTransform: 'capitalize',
                      color: form.recurringInterval === interval ? '#37352f' : '#9b9a97',
                      backgroundColor: form.recurringInterval === interval ? 'rgba(55,53,47,0.08)' : 'transparent',
                      border: `1px solid ${form.recurringInterval === interval ? 'rgba(55,53,47,0.18)' : 'rgba(55,53,47,0.09)'}`,
                      cursor: 'pointer', transition: 'all 150ms ease',
                    }}
                  >
                    {interval}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Lost reason (conditional) ── */}
      {isLost && (
        <div>
          <Label>Primary reason for loss</Label>
          <Input value={form.lostReason} onChange={v => u({ lostReason: v })} placeholder="e.g. Price too high, went with competitor" />
        </div>
      )}

      {/* ── Section 3: Contact (collapsible) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: contactsOpen || contacts.length > 0 ? '10px' : '0' }}>
          <SectionLabel>Contact</SectionLabel>
          {contacts.length === 0 ? (
            <button
              type="button"
              onClick={addContact}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', color: '#5e6ad2', background: 'none', border: 'none',
                cursor: 'pointer', padding: '0 0 6px', fontWeight: 600,
                marginTop: '-4px',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#4a56c0' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#5e6ad2' }}
            >
              <Plus size={11} /> Add contact
            </button>
          ) : (
            <button
              type="button"
              onClick={addContact}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', color: '#5e6ad2', background: 'none', border: 'none',
                cursor: 'pointer', padding: '0 0 6px', fontWeight: 600,
                marginTop: '-4px',
              }}
            >
              <Plus size={11} /> Add another
            </button>
          )}
        </div>

        {contacts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {contacts.map((contact, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(55,53,47,0.03)',
                  border: '1px solid rgba(55,53,47,0.09)',
                  borderRadius: '8px',
                  padding: '10px',
                  position: 'relative',
                }}
              >
                <button
                  type="button"
                  onClick={() => removeContact(i)}
                  style={{
                    position: 'absolute', top: '8px', right: '8px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', padding: '2px',
                    borderRadius: '4px',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e03e3e' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)' }}
                >
                  <X size={12} />
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Name</label>
                    <Input value={contact.name} onChange={v => updateContact(i, 'name', v)} placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Title</label>
                    <Input value={contact.title ?? ''} onChange={v => updateContact(i, 'title', v)} placeholder="VP of Engineering" />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Email</label>
                  <Input value={contact.email ?? ''} onChange={v => updateContact(i, 'email', v)} placeholder="jane@acme.com" type="email" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 4: Context ── */}
      <div>
        <SectionLabel>Context</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={v => u({ description: v })}
              placeholder="Overview of the opportunity, meeting notes, context, or key details…"
              rows={3}
            />
          </div>

          <div>
            <Label>Competitor(s)</Label>
            <Input
              value={form.competitors}
              onChange={v => u({ competitors: v })}
              placeholder="Competitor A, Competitor B"
            />
          </div>

          <div>
            <Label>Deal motion</Label>
            <Input
              value={form.engagementType}
              onChange={v => u({ engagementType: v })}
              placeholder="Enterprise account, POC, renewal, upsell…"
            />
          </div>

          {!isClosed && (
            <div>
              <Label>Next steps</Label>
              <Input value={form.nextSteps} onChange={v => u({ nextSteps: v })} placeholder="Schedule follow-up call" />
            </div>
          )}

          {members.length > 0 && (
            <div>
              <Label>Assign rep</Label>
              <select
                value={form.assignedRepId}
                onChange={e => u({ assignedRepId: e.target.value })}
                style={{
                  width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px',
                  background: 'rgba(55,53,47,0.04)', border: '1px solid rgba(55,53,47,0.12)',
                  color: form.assignedRepId ? '#37352f' : '#9b9a97',
                  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(94,106,210,0.35)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(55,53,47,0.12)' }}
              >
                <option value="">Unassigned</option>
                {members.map(m => (
                  <option key={m.userId} value={m.userId}>{m.email}</option>
                ))}
              </select>
            </div>
          )}

        </div>
      </div>

      {/* ── Submit ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px', borderTop: '1px solid rgba(55,53,47,0.07)' }}>
        <button
          type="submit"
          disabled={loading}
          style={{
            height: '36px', padding: '0 22px', borderRadius: '6px',
            fontSize: '13px', fontWeight: 600, color: '#ffffff',
            backgroundColor: loading ? 'rgba(55,53,47,0.40)' : '#37352f',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 150ms ease',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#2d2b28' }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#37352f' }}
        >
          {loading ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
