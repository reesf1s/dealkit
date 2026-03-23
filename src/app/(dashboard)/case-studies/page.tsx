'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, BookOpen, Swords, AlertTriangle } from 'lucide-react'
import { PageTabs } from '@/components/shared/PageTabs'
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
      {/* Intelligence tabs */}
      <PageTabs tabs={[
        { label: 'Competitors',  href: '/competitors',  icon: Swords        },
        { label: 'Case Studies', href: '/case-studies', icon: BookOpen      },
        { label: 'Feature Gaps', href: '/product-gaps', icon: AlertTriangle },
      ]} />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ width: '32px', height: '32px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen size={15} color="var(--success)" />
            </div>
            <h1 className="font-brand" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.01em', margin: 0 }}>
              Case Studies
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0, paddingLeft: '42px' }}>
            {caseStudies.length} stories • Fuel AI-generated collateral
          </p>
        </div>

        <button
          onClick={() => setAddOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg, var(--accent-hover), #7C3AED)', border: 'none', cursor: 'pointer', boxShadow: '0 0 16px rgba(99,102,241,0.3)', transition: 'opacity 0.1s ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
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
          <Dialog.Content style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 501, width: '100%', maxWidth: '680px', maxHeight: '92vh', overflowY: 'auto', background: 'var(--glass)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: 'none', borderRadius: '8px', padding: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.9)', outline: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <Dialog.Title style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Add case study
              </Dialog.Title>
              <Dialog.Close asChild>
                <button style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
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
