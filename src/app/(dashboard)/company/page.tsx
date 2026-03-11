'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import { CompanyForm } from '@/components/company/CompanyForm'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import SetupBanner from '@/components/shared/SetupBanner'
import { fetcher, isDbNotConfigured } from '@/lib/fetcher'
import type { CompanyProfile } from '@/types'
import { Building2, Sparkles } from 'lucide-react'

export default function CompanyPage() {
  const { data, isLoading, error, mutate } = useSWR<{ data: CompanyProfile | null }>(
    '/api/company',
    fetcher,
  )

  const dbError = isDbNotConfigured(error)

  return (
    <div style={{ maxWidth: '760px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{ width: '32px', height: '32px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={15} color="#818CF8" />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#EBEBEB', letterSpacing: '-0.03em', margin: 0 }}>
            Company Profile
          </h1>
        </div>
        <p style={{ fontSize: '13px', color: '#555', margin: 0, paddingLeft: '42px', lineHeight: '1.6' }}>
          This is the foundation of your AI-generated collateral. The more detail you add, the better the output.
        </p>
      </div>

      {/* AI tip */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '10px', marginBottom: '24px' }}>
        <Sparkles size={14} color="#818CF8" style={{ marginTop: '1px', flexShrink: 0 }} />
        <p style={{ fontSize: '12px', color: '#818CF8', margin: 0, lineHeight: '1.6' }}>
          <strong>AI tip:</strong> Fill in your value propositions, differentiators, and common objections to get the most targeted battlecards and email sequences. The AI uses every field here.
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
        <div style={{ padding: '14px 18px', borderRadius: '10px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: '13px' }}>
          Failed to load company profile. Please refresh the page.
        </div>
      )}

      {!isLoading && !error && (
        <CompanyForm
          initialData={data?.data ?? null}
          onSave={(profile) => mutate({ data: profile }, false)}
        />
      )}
    </div>
  )
}
