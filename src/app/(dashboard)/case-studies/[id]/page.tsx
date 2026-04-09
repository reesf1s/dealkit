'use client'
export const dynamic = 'force-dynamic'

import { useParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CaseStudyForm } from '@/components/case-studies/CaseStudyForm'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { useToast } from '@/components/shared/Toast'
import type { CaseStudy } from '@/types'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

export default function CaseStudyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const { data, isLoading, error, mutate } = useSWR<{ data: CaseStudy }>(
    `/api/case-studies/${id}`,
    fetcher,
  )

  const caseStudy = data?.data

  async function handleSave(payload: Partial<CaseStudy>) {
    const res = await fetch(`/api/case-studies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error ?? 'Save failed')
    }
    const json = await res.json()
    await mutate(json, false)
    toast('Case study saved', 'success')
  }

  async function handleGenerateDocument() {
    const res = await fetch('/api/collateral/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'case_study_doc', sourceCaseStudyId: id }),
    })
    if (!res.ok) throw new Error('Failed')
    toast('Case study document generation started', 'success')
  }

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto', background: '#ffffff', minHeight: '100%' }}>
      <Link
        href="/case-studies"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#9b9a97', textDecoration: 'none', marginBottom: '20px' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#9b9a97' }}
      >
        <ArrowLeft size={14} strokeWidth={2} />
        Back to case studies
      </Link>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={4} showHeader={false} />)}
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(224,62,62,0.08)', border: '1px solid rgba(224,62,62,0.20)', color: '#e03e3e', fontSize: '13px' }}>
          Failed to load case study. Please refresh.
        </div>
      )}

      {!isLoading && !error && caseStudy && (
        <>
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: '4px' }}>
              {caseStudy.customerName}
            </h1>
            {caseStudy.customerIndustry && (
              <p style={{ fontSize: '13px', color: '#787774', margin: 0 }}>{caseStudy.customerIndustry}</p>
            )}
          </div>

          <CaseStudyForm
            initialData={caseStudy}
            onSubmit={handleSave}
            onGenerateDocument={handleGenerateDocument}
            submitLabel="Save changes"
          />

          {/* Generated narrative */}
          {caseStudy.generatedNarrative && (
            <div style={{ marginTop: '24px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.09)', borderRadius: '8px', padding: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                Generated narrative
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                {caseStudy.generatedNarrative}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
