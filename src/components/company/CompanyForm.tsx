'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useToast } from '@/components/shared/Toast'
import type { CompanyProfile, Product } from '@/types'

interface CompanyFormProps {
  initialData: CompanyProfile | null
  onSave?: (profile: CompanyProfile) => void
}

// ─── Reusable primitives ───────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: '12px',
        fontWeight: 500,
        color: '#888888',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        marginBottom: '6px',
      }}
    >
      {children}
    </label>
  )
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        height: '34px',
        padding: '0 10px',
        borderRadius: '6px',
        backgroundColor: '#0A0A0A',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#EBEBEB',
        fontSize: '13px',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 150ms ease',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.6)'
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
      }}
    />
  )
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%',
        padding: '8px 10px',
        borderRadius: '6px',
        backgroundColor: '#0A0A0A',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#EBEBEB',
        fontSize: '13px',
        outline: 'none',
        resize: 'vertical',
        boxSizing: 'border-box',
        lineHeight: 1.6,
        transition: 'border-color 150ms ease',
        fontFamily: 'inherit',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.6)'
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
      }}
    />
  )
}

function SectionCard({
  title,
  children,
  collapsible = false,
}: {
  title: string
  children: React.ReactNode
  collapsible?: boolean
}) {
  const [open, setOpen] = useState(true)

  return (
    <div
      style={{
        backgroundColor: '#141414',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => collapsible && setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: collapsible ? 'pointer' : 'default',
          borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#EBEBEB' }}>{title}</span>
        {collapsible &&
          (open ? (
            <ChevronUp size={14} style={{ color: '#888' }} />
          ) : (
            <ChevronDown size={14} style={{ color: '#888' }} />
          ))}
      </button>
      {open && <div style={{ padding: '16px' }}>{children}</div>}
    </div>
  )
}

function StringListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
}) {
  const add = () => onChange([...items, ''])
  const update = (i: number, v: string) => {
    const next = [...items]
    next[i] = v
    onChange(next)
  }
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <Input value={item} onChange={(v) => update(i, v)} placeholder={placeholder} />
          </div>
          <button
            onClick={() => remove(i)}
            style={{
              width: '32px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              color: '#555',
              flexShrink: 0,
              transition: 'color 150ms ease, background-color 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#EF4444'
              e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#555'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <Trash2 size={12} strokeWidth={2} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: '30px',
          padding: '0 10px',
          width: 'fit-content',
          borderRadius: '6px',
          backgroundColor: 'transparent',
          border: '1px dashed rgba(255,255,255,0.12)',
          cursor: 'pointer',
          color: '#888',
          fontSize: '12px',
          transition: 'border-color 150ms ease, color 150ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#6366F1'
          e.currentTarget.style.color = '#6366F1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
          e.currentTarget.style.color = '#888'
        }}
      >
        <Plus size={12} strokeWidth={2.5} />
        Add item
      </button>
    </div>
  )
}

// ─── Product editor ────────────────────────────────────────────────────────────

function ProductEditor({
  product,
  index,
  onChange,
  onRemove,
}: {
  product: Partial<Product>
  index: number
  onChange: (p: Partial<Product>) => void
  onRemove: () => void
}) {
  return (
    <div
      style={{
        backgroundColor: '#0A0A0A',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Product {index + 1}
        </span>
        <button
          onClick={onRemove}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#555',
            fontSize: '12px',
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#555' }}
        >
          <Trash2 size={11} strokeWidth={2} />
          Remove
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <Label>Product name *</Label>
          <Input
            value={product.name ?? ''}
            onChange={(v) => onChange({ ...product, name: v })}
            placeholder="e.g. Core Platform"
          />
        </div>
        <div>
          <Label>Pricing model</Label>
          <Input
            value={product.pricingModel ?? ''}
            onChange={(v) => onChange({ ...product, pricingModel: v })}
            placeholder="e.g. Per seat / month"
          />
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          value={product.description ?? ''}
          onChange={(v) => onChange({ ...product, description: v })}
          placeholder="Brief description of this product"
          rows={2}
        />
      </div>

      <div>
        <Label>Pricing details</Label>
        <Input
          value={product.pricingDetails ?? ''}
          onChange={(v) => onChange({ ...product, pricingDetails: v })}
          placeholder="e.g. $99/seat/month, volume discounts available"
        />
      </div>

      <div>
        <Label>Key features (comma-separated)</Label>
        <Input
          value={(product.keyFeatures ?? []).join(', ')}
          onChange={(v) =>
            onChange({
              ...product,
              keyFeatures: v
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="Feature A, Feature B, Feature C"
        />
      </div>

      <div>
        <Label>Target buyers (comma-separated)</Label>
        <Input
          value={(product.targetPersonas ?? []).join(', ')}
          onChange={(v) =>
            onChange({
              ...product,
              targetPersonas: v
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="CTO, VP of Engineering, IT Director"
        />
      </div>
    </div>
  )
}

// ─── Main form ─────────────────────────────────────────────────────────────────

interface FormState {
  companyName: string
  website: string
  industry: string
  description: string
  founded: string
  employeeCount: string
  targetMarket: string
  competitiveAdvantage: string
  valuePropositions: string[]
  differentiators: string[]
  commonObjections: string[]
  products: Partial<Product>[]
}

function toFormState(profile: CompanyProfile | null): FormState {
  if (!profile) {
    return {
      companyName: '',
      website: '',
      industry: '',
      description: '',
      founded: '',
      employeeCount: '',
      targetMarket: '',
      competitiveAdvantage: '',
      valuePropositions: [''],
      differentiators: [''],
      commonObjections: [''],
      products: [],
    }
  }
  return {
    companyName: profile.companyName,
    website: profile.website ?? '',
    industry: profile.industry ?? '',
    description: profile.description ?? '',
    founded: profile.founded != null ? String(profile.founded) : '',
    employeeCount: profile.employeeCount ?? '',
    targetMarket: profile.targetMarket ?? '',
    competitiveAdvantage: profile.competitiveAdvantage ?? '',
    valuePropositions: profile.valuePropositions.length > 0 ? profile.valuePropositions : [''],
    differentiators: profile.differentiators.length > 0 ? profile.differentiators : [''],
    commonObjections: profile.commonObjections.length > 0 ? profile.commonObjections : [''],
    products: profile.products,
  }
}

export function CompanyForm({ initialData, onSave }: CompanyFormProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<FormState>(() => toFormState(initialData))
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)

  // Reset when initialData arrives
  useEffect(() => {
    if (initialData) {
      setForm(toFormState(initialData))
    }
  }, [initialData?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (data: FormState) => {
    if (!data.companyName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          founded: data.founded ? Number(data.founded) : null,
          valuePropositions: data.valuePropositions.filter(Boolean),
          differentiators: data.differentiators.filter(Boolean),
          commonObjections: data.commonObjections.filter(Boolean),
          products: data.products.filter((p) => p.name),
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const json = await res.json()
      if (onSave && json.data) onSave(json.data)
      // Auto-regenerate any stale collateral in background
      fetch('/api/collateral/regenerate-stale', { method: 'POST' }).catch(() => {})
      toast('Saved ✓ — collateral regenerating', 'success')
    } catch {
      toast('Failed to save. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }, [onSave, toast])

  const update = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => save(next), 500)
      return next
    })
  }, [save])

  // Skip auto-save on first render
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
  }, [])

  const addProduct = () => {
    update({
      products: [
        ...form.products,
        { name: '', description: '', keyFeatures: [], targetPersonas: [], pricingModel: null, pricingDetails: null },
      ],
    })
  }

  const updateProduct = (i: number, p: Partial<Product>) => {
    const next = [...form.products]
    next[i] = p
    update({ products: next })
  }

  const removeProduct = (i: number) => {
    update({ products: form.products.filter((_, idx) => idx !== i) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Company basics */}
      <SectionCard title="Company basics">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Label>Company name *</Label>
            <Input
              value={form.companyName}
              onChange={(v) => update({ companyName: v })}
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <Label>Website</Label>
            <Input
              value={form.website}
              onChange={(v) => update({ website: v })}
              placeholder="https://acme.com"
            />
          </div>
          <div>
            <Label>Industry</Label>
            <Input
              value={form.industry}
              onChange={(v) => update({ industry: v })}
              placeholder="SaaS / B2B Software"
            />
          </div>
          <div>
            <Label>Founded (year)</Label>
            <Input
              value={form.founded}
              onChange={(v) => update({ founded: v })}
              placeholder="2018"
              type="number"
            />
          </div>
          <div>
            <Label>Company size</Label>
            <Input
              value={form.employeeCount}
              onChange={(v) => update({ employeeCount: v })}
              placeholder="50-200"
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(v) => update({ description: v })}
              placeholder="What does your company do? Be concise and specific."
              rows={3}
            />
          </div>
        </div>
      </SectionCard>

      {/* Products */}
      <SectionCard title={`Products (${form.products.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {form.products.map((product, i) => (
            <ProductEditor
              key={i}
              product={product}
              index={i}
              onChange={(p) => updateProduct(i, p)}
              onRemove={() => removeProduct(i)}
            />
          ))}

          <button
            onClick={addProduct}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '34px',
              padding: '0 12px',
              width: 'fit-content',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              border: '1px dashed rgba(255,255,255,0.12)',
              cursor: 'pointer',
              color: '#888',
              fontSize: '13px',
              transition: 'border-color 150ms ease, color 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#6366F1'
              e.currentTarget.style.color = '#6366F1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
              e.currentTarget.style.color = '#888'
            }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Add product
          </button>
        </div>
      </SectionCard>

      {/* Value propositions */}
      <SectionCard title="Value propositions">
        <p style={{ fontSize: '12px', color: '#555', margin: '0 0 10px' }}>
          Your top-level value props — what makes you worth buying?
        </p>
        <StringListEditor
          items={form.valuePropositions}
          onChange={(v) => update({ valuePropositions: v })}
          placeholder="e.g. Cut integration time from weeks to hours"
        />
      </SectionCard>

      {/* Differentiators */}
      <SectionCard title="Differentiators">
        <p style={{ fontSize: '12px', color: '#555', margin: '0 0 10px' }}>
          What makes you uniquely better than alternatives?
        </p>
        <StringListEditor
          items={form.differentiators}
          onChange={(v) => update({ differentiators: v })}
          placeholder="e.g. Only solution with native Salesforce bidirectional sync"
        />
      </SectionCard>

      {/* Common objections */}
      <SectionCard title="Common objections" collapsible>
        <p style={{ fontSize: '12px', color: '#555', margin: '0 0 10px' }}>
          Objections your team faces most often in deals.
        </p>
        <StringListEditor
          items={form.commonObjections}
          onChange={(v) => update({ commonObjections: v })}
          placeholder="e.g. Your pricing is too high vs. the competition"
        />
      </SectionCard>

      {/* Target market */}
      <SectionCard title="Target market">
        <Label>Describe your ideal customer profile</Label>
        <Textarea
          value={form.targetMarket}
          onChange={(v) => update({ targetMarket: v })}
          placeholder="Mid-market B2B SaaS companies (100-500 employees) in the US and Europe, particularly those running Salesforce with complex data integration needs…"
          rows={4}
        />
      </SectionCard>

      {/* Tone of voice / competitive advantage */}
      <SectionCard title="Competitive advantage & tone" collapsible>
        <Label>Competitive advantage</Label>
        <Textarea
          value={form.competitiveAdvantage}
          onChange={(v) => update({ competitiveAdvantage: v })}
          placeholder="Our AI-first architecture means…"
          rows={3}
        />
      </SectionCard>

      {/* Save status */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
        {saving && (
          <span style={{ fontSize: '12px', color: '#888' }}>Saving…</span>
        )}
        <button
          onClick={() => save(form)}
          disabled={saving || !form.companyName.trim()}
          style={{
            height: '34px',
            padding: '0 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#fff',
            backgroundColor: saving || !form.companyName.trim() ? '#333' : '#6366F1',
            border: 'none',
            cursor: saving || !form.companyName.trim() ? 'not-allowed' : 'pointer',
            transition: 'background-color 150ms ease',
          }}
          onMouseEnter={(e) => {
            if (!saving && form.companyName.trim()) e.currentTarget.style.backgroundColor = '#4F46E5'
          }}
          onMouseLeave={(e) => {
            if (!saving && form.companyName.trim()) e.currentTarget.style.backgroundColor = '#6366F1'
          }}
        >
          Save profile
        </button>
      </div>
    </div>
  )
}
