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
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <Link
        href="/case-studies"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888', textDecoration: 'none', marginBottom: '20px' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#EBEBEB' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#888' }}
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
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: '13px' }}>
          Failed to load case study. Please refresh.
        </div>
      )}

      {!isLoading && !error && caseStudy && (
        <>
          <div style={{ marginBottom: '24px' }}>
            <h1 className="font-brand" style={{ fontSize: '22px', fontWeight: 500, color: '#EBEBEB', letterSpacing: '0.01em', margin: 0, marginBottom: '4px' }}>
              {caseStudy.customerName}
            </h1>
            {caseStudy.customerIndustry && (
              <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>{caseStudy.customerIndustry}</p>
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
            <div style={{ marginTop: '24px', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#6366F1', margin: '0 0 12px' }}>
                Generated narrative
              </h2>
              <p style={{ fontSize: '13px', color: '#EBEBEB', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                {caseStudy.generatedNarrative}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
