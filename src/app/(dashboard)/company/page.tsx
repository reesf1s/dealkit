'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import { Brain, Building2, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { CompanyForm } from '@/components/company/CompanyForm'
import { fetcher } from '@/lib/fetcher'
import type { CompanyProfile } from '@/types'

export default function CompanyPage() {
  const [rebuilding, setRebuilding] = useState(false)

  const { data, isLoading, mutate } = useSWR<{ data: CompanyProfile | null }>('/api/company', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45_000,
  })

  const profile = data?.data ?? null

  const strengths = profile?.differentiators?.length ?? 0
  const objections = profile?.commonObjections?.length ?? 0
  const valueProps = profile?.valuePropositions?.length ?? 0
  const products = profile?.products?.length ?? 0

  async function handleRebuildBrain() {
    if (rebuilding) return
    setRebuilding(true)
    try {
      await fetch('/api/brain', { method: 'POST', credentials: 'include' })
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 980 }}>
      <section className="notion-panel" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--text-tertiary)' }}>
              Company Intelligence Layer
            </div>
            <h1 style={{ margin: '6px 0 0', fontSize: 22, letterSpacing: 0 }}>Operating profile for enterprise deals</h1>
            <p style={{ margin: '7px 0 0', color: 'var(--text-secondary)', fontSize: 13.5, maxWidth: 760 }}>
              This is the source of truth for how the product should sell. Better context here directly improves deal scoring, risk detection, and auto-generated messaging in the background.
            </p>
          </div>

          <button
            onClick={handleRebuildBrain}
            disabled={rebuilding}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 9,
              border: '1px solid var(--brand-border)',
              background: 'var(--brand-bg)',
              color: 'var(--brand)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 12.5,
              fontWeight: 700,
              opacity: rebuilding ? 0.7 : 1,
            }}
          >
            {rebuilding ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={13} />}
            {rebuilding ? 'Rebuilding…' : 'Rebuild Intelligence'}
          </button>
        </div>
      </section>

      <section className="company-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {[
          { label: 'Products', value: String(products), sub: 'Core offerings defined', icon: Building2 },
          { label: 'Value Props', value: String(valueProps), sub: 'Commercial hooks captured', icon: Sparkles },
          { label: 'Differentiators', value: String(strengths), sub: 'Reasons to win', icon: ShieldCheck },
          { label: 'Objection Library', value: String(objections), sub: 'Known pushback patterns', icon: Brain },
        ].map(card => (
          <article key={card.label} className="notion-kpi" style={{ padding: '13px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)' }}>{card.label}</span>
              <card.icon size={13} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0, lineHeight: 1.1 }}>{card.value}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{card.sub}</div>
          </article>
        ))}
      </section>

      <section className="notion-panel" style={{ padding: 16 }}>
        {isLoading ? (
          <div className="skeleton" style={{ height: 320, borderRadius: 10 }} />
        ) : (
          <CompanyForm
            initialData={profile}
            onSave={next => mutate({ data: next }, false)}
          />
        )}
      </section>

      <style>{`
        @media (max-width: 1120px) {
          .company-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 760px) {
          .company-kpis { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
