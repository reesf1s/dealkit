'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, ClipboardList, Kanban, List } from 'lucide-react'
import { PageTabs } from '@/components/shared/PageTabs'
import { DealTable } from '@/components/deals/DealTable'
import { DealForm } from '@/components/deals/DealForm'
import { DealInsights } from '@/components/deals/DealInsights'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { useToast } from '@/components/shared/Toast'
import SetupBanner from '@/components/shared/SetupBanner'
import { fetcher, isDbNotConfigured } from '@/lib/fetcher'
import type { DealLog } from '@/types'

export default function DealsPage() {
  const { toast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)

  const { data, isLoading, error, mutate } = useSWR<{ data: DealLog[] }>('/api/deals', fetcher)
  const deals = data?.data ?? []
  const dbError = isDbNotConfigured(error)
  const { data: configData } = useSWR('/api/pipeline-config', fetcher, { revalidateOnFocus: false })
  const currencySymbol: string = configData?.data?.currency ?? '£'

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast('Failed to delete deal', 'error'); return }
      await mutate()
      toast('Deal deleted', 'success')
    } catch {
      toast('Failed to delete deal', 'error')
    }
  }

  async function handleAdd(payload: Partial<DealLog>) {
    setAddLoading(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error ?? 'Failed to log deal', 'error')
        return
      }
      await mutate()
      setAddOpen(false)
      toast('Deal logged', 'success')
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* View toggle */}
      <PageTabs tabs={[
        { label: 'Board View', href: '/pipeline', icon: Kanban },
        { label: 'List View',  href: '/deals',    icon: List   },
      ]} />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ClipboardList size={15} color="var(--accent)" />
            </div>
            <h1 className="font-brand" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.01em', margin: 0 }}>
              Deal Log
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0, paddingLeft: '42px' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{deals.length}</span>
            {' '}deals · Track wins and losses to improve closing
          </p>
        </div>

        <button
          onClick={() => setAddOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            height: '36px', padding: '0 16px',
            borderRadius: '8px', fontSize: '13px', fontWeight: 600,
            color: '#fff',
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            border: '1px solid rgba(99,102,241,0.4)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow)',
            transition: 'opacity 0.1s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9'
            e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.boxShadow = 'var(--shadow)'
          }}
        >
          <Plus size={14} strokeWidth={2.5} />
          Log Deal
        </button>
      </div>

      {dbError && (
        <SetupBanner context="Add a DATABASE_URL to start logging deals and tracking your win rate." />
      )}

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} lines={1} showHeader />)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SkeletonCard lines={4} showHeader={false} />
            <SkeletonCard lines={3} showHeader={false} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', alignItems: 'start' }}>
          <DealTable deals={deals} onAdd={() => setAddOpen(true)} onDelete={handleDelete} currencySymbol={currencySymbol} />
          <DealInsights deals={deals} currencySymbol={currencySymbol} />
        </div>
      )}

      {/* Add modal */}
      <Dialog.Root open={addOpen} onOpenChange={setAddOpen}>
        <Dialog.Portal>
          <Dialog.Overlay style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 500,
          }} />
          <Dialog.Content style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 501, width: '100%', maxWidth: '520px',
            maxHeight: '90vh', overflowY: 'auto',
            background: 'var(--elevated)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--border-strong)',
            borderRadius: '8px', padding: '24px',
            boxShadow: 'var(--shadow-lg)',
            outline: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <Dialog.Title style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Log a deal
              </Dialog.Title>
              <Dialog.Close asChild>
                <button style={{
                  width: '28px', height: '28px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '6px',
                  backgroundColor: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer', color: 'var(--text-tertiary)',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--border-strong)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)' }}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </Dialog.Close>
            </div>
            <DealForm onSubmit={handleAdd} loading={addLoading} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
