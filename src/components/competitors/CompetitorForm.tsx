'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Competitor } from '@/types'

interface CompetitorFormProps {
  initialData?: Partial<Competitor>
  onSubmit: (data: Partial<Competitor>) => Promise<void>
  submitLabel?: string
  loading?: boolean
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#787774', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>
      {children}
    </label>
  )
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', background: 'rgba(55,53,47,0.04)', border: '1px solid rgba(55,53,47,0.12)', color: '#37352f', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms ease, box-shadow 150ms ease' }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(94,106,210,0.35)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(94,106,210,0.10)' }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(55,53,47,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
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
      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'rgba(55,53,47,0.04)', border: '1px solid rgba(55,53,47,0.12)', color: '#37352f', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, transition: 'border-color 150ms ease, box-shadow 150ms ease', fontFamily: 'inherit' }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(94,106,210,0.35)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(94,106,210,0.10)' }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(55,53,47,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
    />
  )
}

function TagListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  const add = () => onChange([...items, ''])
  const update = (i: number, v: string) => { const n = [...items]; n[i] = v; onChange(n) }
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <Input value={item} onChange={(v) => update(i, v)} placeholder={placeholder} />
          </div>
          <button onClick={() => remove(i)} style={{ width: '32px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid rgba(55,53,47,0.12)', cursor: 'pointer', color: '#9b9a97', flexShrink: 0 }} onMouseEnter={(e) => { e.currentTarget.style.color = '#e03e3e'; e.currentTarget.style.backgroundColor = 'rgba(224,62,62,0.08)'; e.currentTarget.style.borderColor = 'rgba(224,62,62,0.20)' }} onMouseLeave={(e) => { e.currentTarget.style.color = '#9b9a97'; e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'rgba(55,53,47,0.12)' }}>
            <Trash2 size={12} strokeWidth={2} />
          </button>
        </div>
      ))}
      <button onClick={add} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '30px', padding: '0 10px', width: 'fit-content', borderRadius: '6px', backgroundColor: 'transparent', border: '1px dashed rgba(55,53,47,0.16)', cursor: 'pointer', color: '#787774', fontSize: '12px' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(55,53,47,0.30)'; e.currentTarget.style.color = '#37352f' }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(55,53,47,0.16)'; e.currentTarget.style.color = '#787774' }}>
        <Plus size={12} strokeWidth={2.5} />
        Add
      </button>
    </div>
  )
}

interface FormState {
  name: string
  website: string
  description: string
  strengths: string[]
  weaknesses: string[]
  pricing: string
  targetMarket: string
  keyFeatures: string[]
  differentiators: string[]
  notes: string
}

function toState(d?: Partial<Competitor>): FormState {
  return {
    name: d?.name ?? '',
    website: d?.website ?? '',
    description: d?.description ?? '',
    strengths: d?.strengths?.length ? d.strengths : [''],
    weaknesses: d?.weaknesses?.length ? d.weaknesses : [''],
    pricing: d?.pricing ?? '',
    targetMarket: d?.targetMarket ?? '',
    keyFeatures: d?.keyFeatures?.length ? d.keyFeatures : [''],
    differentiators: d?.differentiators?.length ? d.differentiators : [''],
    notes: d?.notes ?? '',
  }
}

export function CompetitorForm({ initialData, onSubmit, submitLabel = 'Save competitor', loading = false }: CompetitorFormProps) {
  const [form, setForm] = useState<FormState>(() => toState(initialData))

  const u = (patch: Partial<FormState>) => setForm((p) => ({ ...p, ...patch }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    await onSubmit({
      name: form.name,
      website: form.website || null,
      description: form.description || null,
      strengths: form.strengths.filter(Boolean),
      weaknesses: form.weaknesses.filter(Boolean),
      pricing: form.pricing || null,
      targetMarket: form.targetMarket || null,
      keyFeatures: form.keyFeatures.filter(Boolean),
      differentiators: form.differentiators.filter(Boolean),
      notes: form.notes || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Basics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>Competitor name *</Label>
          <Input value={form.name} onChange={(v) => u({ name: v })} placeholder="e.g. Acme Competitor" />
        </div>
        <div>
          <Label>Website</Label>
          <Input value={form.website} onChange={(v) => u({ website: v })} placeholder="https://competitor.com" />
        </div>
        <div>
          <Label>Pricing</Label>
          <Input value={form.pricing} onChange={(v) => u({ pricing: v })} placeholder="e.g. $50-200/mo per seat" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(v) => u({ description: v })} placeholder="What does this competitor do?" rows={2} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>Target market</Label>
          <Input value={form.targetMarket} onChange={(v) => u({ targetMarket: v })} placeholder="e.g. Enterprise SaaS, 500+ employees" />
        </div>
      </div>

      {/* Strengths */}
      <div>
        <Label>Their strengths</Label>
        <TagListEditor items={form.strengths} onChange={(v) => u({ strengths: v })} placeholder="e.g. Strong brand recognition" />
      </div>

      {/* Weaknesses */}
      <div>
        <Label>Their weaknesses</Label>
        <TagListEditor items={form.weaknesses} onChange={(v) => u({ weaknesses: v })} placeholder="e.g. Complex onboarding process" />
      </div>

      {/* Key features */}
      <div>
        <Label>Their key features</Label>
        <TagListEditor items={form.keyFeatures} onChange={(v) => u({ keyFeatures: v })} placeholder="e.g. Native Slack integration" />
      </div>

      {/* Differentiators */}
      <div>
        <Label>How they differentiate</Label>
        <TagListEditor items={form.differentiators} onChange={(v) => u({ differentiators: v })} placeholder="e.g. Open-source with enterprise support" />
      </div>

      {/* Notes */}
      <div>
        <Label>Internal notes</Label>
        <Textarea value={form.notes} onChange={(v) => u({ notes: v })} placeholder="Any additional context, recent news, deal intel…" rows={3} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="submit"
          disabled={loading || !form.name.trim()}
          style={{ height: '34px', padding: '0 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#ffffff', backgroundColor: loading || !form.name.trim() ? 'rgba(55,53,47,0.25)' : '#37352f', border: 'none', cursor: loading || !form.name.trim() ? 'not-allowed' : 'pointer', transition: 'background-color 150ms ease' }}
          onMouseEnter={(e) => { if (!loading && form.name.trim()) e.currentTarget.style.backgroundColor = '#2b2925' }}
          onMouseLeave={(e) => { if (!loading && form.name.trim()) e.currentTarget.style.backgroundColor = '#37352f' }}
        >
          {loading ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
