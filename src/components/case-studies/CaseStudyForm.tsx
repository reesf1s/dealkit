'use client'

import { useState } from 'react'
import { Plus, Trash2, Sparkles } from 'lucide-react'
import type { CaseStudy, CaseStudyMetric } from '@/types'

interface CaseStudyFormProps {
  initialData?: Partial<CaseStudy>
  onSubmit: (data: Partial<CaseStudy>) => Promise<void>
  onGenerateDocument?: () => Promise<void>
  submitLabel?: string
  loading?: boolean
  generating?: boolean
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>
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
      style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#EBEBEB', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms ease' }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#EBEBEB', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, transition: 'border-color 150ms ease', fontFamily: 'inherit' }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
    />
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#EBEBEB' }}>{title}</span>
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )
}

interface FormState {
  customerName: string
  customerIndustry: string
  customerSize: string
  challenge: string
  solution: string
  results: string
  metrics: CaseStudyMetric[]
  isPublic: boolean
}

function toState(d?: Partial<CaseStudy>): FormState {
  return {
    customerName: d?.customerName ?? '',
    customerIndustry: d?.customerIndustry ?? '',
    customerSize: d?.customerSize ?? '',
    challenge: d?.challenge ?? '',
    solution: d?.solution ?? '',
    results: d?.results ?? '',
    metrics: d?.metrics ?? [],
    isPublic: d?.isPublic ?? false,
  }
}

export function CaseStudyForm({ initialData, onSubmit, onGenerateDocument, submitLabel = 'Save case study', loading = false, generating = false }: CaseStudyFormProps) {
  const [form, setForm] = useState<FormState>(() => toState(initialData))

  const u = (patch: Partial<FormState>) => setForm((p) => ({ ...p, ...patch }))

  const addMetric = () => u({ metrics: [...form.metrics, { label: '', value: '' }] })
  const updateMetric = (i: number, metric: CaseStudyMetric) => {
    const next = [...form.metrics]; next[i] = metric; u({ metrics: next })
  }
  const removeMetric = (i: number) => u({ metrics: form.metrics.filter((_, idx) => idx !== i) })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customerName.trim()) return
    await onSubmit({
      customerName: form.customerName,
      customerIndustry: form.customerIndustry || null,
      customerSize: form.customerSize || null,
      challenge: form.challenge,
      solution: form.solution,
      results: form.results,
      metrics: form.metrics.filter((m) => m.label && m.value),
      isPublic: form.isPublic,
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Customer info */}
      <SectionCard title="Customer info">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Label>Customer name *</Label>
            <Input value={form.customerName} onChange={(v) => u({ customerName: v })} placeholder="Acme Corp" />
          </div>
          <div>
            <Label>Industry</Label>
            <Input value={form.customerIndustry} onChange={(v) => u({ customerIndustry: v })} placeholder="SaaS" />
          </div>
          <div>
            <Label>Company size</Label>
            <Input value={form.customerSize} onChange={(v) => u({ customerSize: v })} placeholder="200-500 employees" />
          </div>
        </div>
      </SectionCard>

      {/* The story */}
      <SectionCard title="The story">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <Label>Challenge *</Label>
            <Textarea
              value={form.challenge}
              onChange={(v) => u({ challenge: v })}
              placeholder="What problem was the customer facing before using your product?"
              rows={3}
            />
          </div>
          <div>
            <Label>Solution *</Label>
            <Textarea
              value={form.solution}
              onChange={(v) => u({ solution: v })}
              placeholder="How did your product solve their challenge?"
              rows={3}
            />
          </div>
          <div>
            <Label>Results *</Label>
            <Textarea
              value={form.results}
              onChange={(v) => u({ results: v })}
              placeholder="What measurable outcomes did the customer achieve?"
              rows={3}
            />
          </div>
        </div>
      </SectionCard>

      {/* Metrics */}
      <SectionCard title={`Key metrics (${form.metrics.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {form.metrics.map((metric, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 32px', gap: '6px', alignItems: 'center' }}>
              <Input value={metric.label} onChange={(v) => updateMetric(i, { ...metric, label: v })} placeholder="Metric label" />
              <Input value={metric.value} onChange={(v) => updateMetric(i, { ...metric, value: v })} placeholder="100" />
              <Input value={metric.unit ?? ''} onChange={(v) => updateMetric(i, { ...metric, unit: v })} placeholder="%" />
              <button
                type="button"
                onClick={() => removeMetric(i)}
                style={{ height: '34px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', color: '#555' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#555' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          {form.metrics.length === 0 && (
            <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>
              Add quantifiable results (e.g. &quot;50% reduction in onboarding time&quot;)
            </p>
          )}

          <button
            type="button"
            onClick={addMetric}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '30px', padding: '0 10px', width: 'fit-content', borderRadius: '6px', backgroundColor: 'transparent', border: '1px dashed rgba(255,255,255,0.12)', cursor: 'pointer', color: '#888', fontSize: '12px' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = 'rgba(255,255,255,0.80)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#888' }}
          >
            <Plus size={12} strokeWidth={2.5} />
            Add metric
          </button>
        </div>
      </SectionCard>

      {/* Visibility */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          onClick={() => u({ isPublic: !form.isPublic })}
          style={{
            width: '36px',
            height: '20px',
            borderRadius: '9999px',
            backgroundColor: form.isPublic ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.1)',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background-color 200ms ease',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '2px',
              left: form.isPublic ? '18px' : '2px',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              transition: 'left 200ms ease',
            }}
          />
        </button>
        <span style={{ fontSize: '13px', color: '#EBEBEB' }}>Make public</span>
        <span style={{ fontSize: '12px', color: '#555' }}>Allow this case study to appear in shareable links</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
        {onGenerateDocument && (
          <button
            type="button"
            onClick={onGenerateDocument}
            disabled={generating || !form.customerName.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#EBEBEB', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', cursor: generating ? 'not-allowed' : 'pointer', transition: 'background-color 150ms ease' }}
            onMouseEnter={(e) => { if (!generating) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
          >
            <Sparkles size={13} strokeWidth={2} style={{ color: 'rgba(255,255,255,0.80)' }} />
            {generating ? 'Generating…' : 'Generate Document'}
          </button>
        )}

        <button
          type="submit"
          disabled={loading || !form.customerName.trim()}
          style={{ height: '34px', padding: '0 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#0a0b0f', backgroundColor: loading || !form.customerName.trim() ? '#333' : 'rgba(255,255,255,0.90)', border: 'none', cursor: loading || !form.customerName.trim() ? 'not-allowed' : 'pointer', transition: 'background-color 150ms ease' }}
          onMouseEnter={(e) => { if (!loading && form.customerName.trim()) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.80)' }}
          onMouseLeave={(e) => { if (!loading && form.customerName.trim()) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.90)' }}
        >
          {loading ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
