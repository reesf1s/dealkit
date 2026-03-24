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
    <div style={{ padding: '36px 32px 32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* View toggle */}
      <PageTabs tabs={[
        { label: 'Board View', href: '/pipeline', icon: Kanban },
        { label: 'List View',  href: '/deals',    icon: List   },
      ]} />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '36px', height: '36px',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.22)',
              borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 4px 12px rgba(99,102,241,0.12)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}>
              <ClipboardList size={17} color="#6366f1" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.02em', margin: 0 }}>
              Deal Log
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: '#6e6e73', margin: 0, paddingLeft: '48px' }}>
            <span style={{ color: '#6366f1', fontWeight: 600 }}>{deals.length}</span>
            {' '}deals · Track wins and losses to improve closing
          </p>
        </div>

        <button
          onClick={() => setAddOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            height: '38px', padding: '0 20px',
            borderRadius: '12px', fontSize: '13px', fontWeight: 600,
            color: '#fff',
            background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
            border: '1px solid rgba(99, 102, 241, 0.40)',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(99,102,241,0.30)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.40)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.30)'
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
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
            backgroundColor: 'rgba(30, 35, 60, 0.35)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 500,
          }} />
          <Dialog.Content style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 501, width: '100%', maxWidth: '520px',
            maxHeight: '90vh', overflowY: 'auto',
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.80)',
            borderRadius: '20px', padding: '28px',
            boxShadow: '0 24px 64px rgba(99,102,241,0.16), 0 8px 24px rgba(0,0,0,0.10)',
            outline: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <Dialog.Title style={{ fontSize: '17px', fontWeight: 700, color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
                Log a deal
              </Dialog.Title>
              <Dialog.Close asChild>
                <button style={{
                  width: '30px', height: '30px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '9px',
                  backgroundColor: 'rgba(0,0,0,0.05)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  cursor: 'pointer', color: '#aeaeb2',
                  transition: 'all 0.12s',
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)'
                    e.currentTarget.style.color = '#6e6e73'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'
                    e.currentTarget.style.color = '#aeaeb2'
                  }}
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
