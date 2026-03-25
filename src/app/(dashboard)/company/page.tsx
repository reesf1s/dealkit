'use client'
export const dynamic = 'force-dynamic'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { CompanyForm } from '@/components/company/CompanyForm'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import SetupBanner from '@/components/shared/SetupBanner'
import { fetcher, isDbNotConfigured } from '@/lib/fetcher'
import type { CompanyProfile } from '@/types'
import { Building2, Sparkles, Brain, RefreshCw, Check } from 'lucide-react'
import { PageTabs } from '@/components/shared/PageTabs'

export default function CompanyPage() {
  const { data, isLoading, error, mutate } = useSWR<{ data: CompanyProfile | null }>(
    '/api/company',
    fetcher,
  )

  const dbError = isDbNotConfigured(error)

  const [brainState, setBrainState] = useState<'idle' | 'rebuilding' | 'done' | 'error'>('idle')

  const handleRebuildBrain = useCallback(async () => {
    if (brainState === 'rebuilding') return
    setBrainState('rebuilding')
    try {
      const res = await fetch('/api/brain', { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      setBrainState('done')
      setTimeout(() => setBrainState('idle'), 3000)
    } catch {
      setBrainState('error')
      setTimeout(() => setBrainState('idle'), 3000)
    }
  }, [brainState])

  return (
    <div style={{ maxWidth: '760px' }}>
      {/* Company / AI Import tabs */}
      <PageTabs tabs={[
        { label: 'Company Profile', href: '/company',    icon: Building2 },
        { label: 'Brain Setup',     href: '/onboarding', icon: Sparkles  },
      ]} />
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--accent-subtle)', border: 'none', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={15} color="var(--accent)" />
            </div>
            <h1 className="font-brand" style={{ fontSize: '20px', fontWeight: '500', color: 'var(--text-primary)', letterSpacing: '0.01em', margin: 0 }}>
              Company Profile
            </h1>
          </div>
          <button
            onClick={handleRebuildBrain}
            disabled={brainState === 'rebuilding'}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px', border: 'none',
              background: brainState === 'done' ? 'rgba(34,197,94,0.1)' : brainState === 'error' ? 'rgba(239,68,68,0.1)' : 'var(--accent-subtle)',
              color: brainState === 'done' ? 'var(--success)' : brainState === 'error' ? 'var(--danger)' : 'var(--accent)',
              fontSize: '12px', fontWeight: 600, cursor: brainState === 'rebuilding' ? 'wait' : 'pointer',
              transition: 'all 0.1s ease', opacity: brainState === 'rebuilding' ? 0.7 : 1,
            }}
          >
            {brainState === 'rebuilding' ? (
              <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Rebuilding...</>
            ) : brainState === 'done' ? (
              <><Check size={13} /> Brain Updated</>
            ) : brainState === 'error' ? (
              <>Failed — try again</>
            ) : (
              <><Brain size={13} /> Rebuild Brain</>
            )}
          </button>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0, paddingLeft: '42px', lineHeight: '1.6' }}>
          This is how the brain learns your business. The more detail you add, the smarter it gets.
        </p>
      </div>

      {/* AI tip */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px', background: 'var(--accent-subtle)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', marginBottom: '24px' }}>
        <Sparkles size={14} color="var(--accent)" style={{ marginTop: '1px', flexShrink: 0 }} />
        <p style={{ fontSize: '12px', color: 'var(--accent)', margin: 0, lineHeight: '1.6' }}>
          <strong>Brain tip:</strong> Fill in your value propositions, differentiators, and common objections. The brain uses every field here to autonomously generate collateral and identify deal risks.
        </p>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={3} showHeader={false} />
          ))}
        </div>
      )}

      {dbError && (
        <SetupBanner context="Add a DATABASE_URL to save your company profile and power AI collateral generation." />
      )}

      {error && !dbError && (
        <div style={{ padding: '14px 18px', borderRadius: '10px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)', fontSize: '13px' }}>
          Failed to load company profile. Please refresh the page.
        </div>
      )}

      {!isLoading && !error && (
        <CompanyForm
          initialData={data?.data ?? null}
          onSave={(profile) => mutate({ data: profile }, false)}
        />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
