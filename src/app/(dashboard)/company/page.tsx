'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import { CompanyForm } from '@/components/company/CompanyForm'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import type { CompanyProfile } from '@/types'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

export default function CompanyPage() {
  const { data, isLoading, error, mutate } = useSWR<{ data: CompanyProfile | null }>(
    '/api/company',
    fetcher,
  )

  return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#EBEBEB',
            letterSpacing: '-0.03em',
            margin: 0,
            marginBottom: '4px',
          }}
        >
          Company profile
        </h1>
        <p style={{ fontSize: '13px', color: '#888888', margin: 0 }}>
          This information powers all AI-generated collateral. Keep it accurate for best results.
        </p>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={3} showHeader={false} />
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#EF4444',
            fontSize: '13px',
          }}
        >
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
