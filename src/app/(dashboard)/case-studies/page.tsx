'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X } from 'lucide-react'
import { CaseStudyGrid } from '@/components/case-studies/CaseStudyGrid'
import { CaseStudyForm } from '@/components/case-studies/CaseStudyForm'
import { SkeletonGrid } from '@/components/shared/SkeletonCard'
import { useToast } from '@/components/shared/Toast'
import type { CaseStudy } from '@/types'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

export default function CaseStudiesPage() {
  const { toast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)

  const { data, isLoading, mutate } = useSWR<{ data: CaseStudy[] }>('/api/case-studies', fetcher)
  const caseStudies = data?.data ?? []

  async function handleAdd(payload: Partial<CaseStudy>) {
    setAddLoading(true)
    try {
      const res = await fetch('/api/case-studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error ?? 'Failed to add case study', 'error')
        return
      }
      await mutate()
      setAddOpen(false)
      toast('Case study added', 'success')
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#EBEBEB', letterSpacing: '-0.03em', margin: 0, marginBottom: '4px' }}>
            Case studies
          </h1>
          <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
            {caseStudies.length} stories • Used in AI-generated collateral
          </p>
        </div>

        <button
          onClick={() => setAddOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#fff', backgroundColor: '#6366F1', border: 'none', cursor: 'pointer', transition: 'background-color 150ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4F46E5' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#6366F1' }}
        >
          <Plus size={14} strokeWidth={2.5} />
          Add Case Study
        </button>
      </div>

      {isLoading ? (
        <SkeletonGrid count={6} cols={3} />
      ) : (
        <CaseStudyGrid caseStudies={caseStudies} onAdd={() => setAddOpen(true)} />
      )}

      {/* Add modal */}
      <Dialog.Root open={addOpen} onOpenChange={setAddOpen}>
        <Dialog.Portal>
          <Dialog.Overlay style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 500 }} />
          <Dialog.Content style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 501, width: '100%', maxWidth: '680px', maxHeight: '92vh', overflowY: 'auto', backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', boxShadow: '0 16px 48px rgba(0,0,0,0.8)', outline: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <Dialog.Title style={{ fontSize: '16px', fontWeight: 600, color: '#EBEBEB', margin: 0 }}>
                Add case study
              </Dialog.Title>
              <Dialog.Close asChild>
                <button style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#888' }}>
                  <X size={14} strokeWidth={2} />
                </button>
              </Dialog.Close>
            </div>
            <CaseStudyForm onSubmit={handleAdd} loading={addLoading} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
