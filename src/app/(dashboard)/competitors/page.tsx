'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, RefreshCw, Swords, BookOpen, AlertTriangle, TrendingUp, Brain } from 'lucide-react'
import { PageTabs } from '@/components/shared/PageTabs'
import { CompetitorTable } from '@/components/competitors/CompetitorTable'
import { CompetitorForm } from '@/components/competitors/CompetitorForm'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { useToast } from '@/components/shared/Toast'
import type { Competitor, Collateral } from '@/types'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

export default function CompetitorsPage() {
  const { toast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)

  const { data: compRes, isLoading: loadingComp, mutate: mutateComp } = useSWR<{ data: Competitor[] }>('/api/competitors', fetcher)
  const { data: collRes, isLoading: loadingColl, mutate: mutateColl } = useSWR<{ data: Collateral[] }>('/api/collateral', fetcher)

  const competitors = compRes?.data ?? []
  const collateral = collRes?.data ?? []

  // Auto-poll every 4s while any battlecard is generating
  const hasGenerating = collateral.some(c => c.status === 'generating')
  const staleCount = collateral.filter(c => c.status === 'stale' && c.type === 'battlecard').length
  useEffect(() => {
    if (!hasGenerating) return
    const t = setInterval(() => mutateColl(), 4000)
    return () => clearInterval(t)
  }, [hasGenerating, mutateColl])

  async function handleRegenAll() {
    try {
      const res = await fetch('/api/collateral/regenerate-stale', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Failed', 'error'); return }
      await mutateColl()
      toast(`Regenerating ${json.data?.queued ?? staleCount} battlecards — refreshing automatically`, 'success')
    } catch {
      toast('Failed to start bulk regeneration', 'error')
    }
  }

  async function handleAdd(data: Partial<Competitor>) {
    setAddLoading(true)
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error ?? 'Failed to add competitor', 'error')
        return
      }
      await mutateComp()
      setAddOpen(false)
      toast('Competitor added', 'success')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/competitors/${id}`, { method: 'DELETE' })
      await mutateComp()
      toast('Competitor deleted', 'success')
    } catch {
      toast('Failed to delete', 'error')
    }
  }

  async function handleGenerateBattlecard(competitorId: string) {
    try {
      const res = await fetch('/api/collateral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'battlecard', competitorId }),
      })
      if (!res.ok) throw new Error('Failed')
      await mutateColl()
      toast('Battlecard generation started', 'success')
    } catch {
      toast('Failed to start generation', 'error')
    }
  }

  const INTEL_TABS = [
    { label: 'Overview',      href: '/intelligence',  icon: Brain         },
    { label: 'Competitors',   href: '/competitors',   icon: Swords        },
    { label: 'Case Studies',  href: '/case-studies',  icon: BookOpen      },
    { label: 'Feature Gaps',  href: '/product-gaps',  icon: AlertTriangle },
    { label: 'Playbook',      href: '/playbook',      icon: TrendingUp    },
    { label: 'Models',        href: '/models',        icon: Brain         },
  ]

  return (
    <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto', background: '#ffffff', minHeight: '100%' }}>
      {/* Intelligence tabs */}
      <PageTabs tabs={INTEL_TABS} />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ width: '32px', height: '32px', background: 'rgba(94,106,210,0.08)', border: '1px solid rgba(94,106,210,0.20)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Swords size={15} color="#5e6ad2" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Competitors
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: '#9b9a97', margin: 0, paddingLeft: '42px' }}>
            {competitors.length} tracked • AI-powered battlecards
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {staleCount > 0 && (
            <button
              onClick={handleRegenAll}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#cb6c2c', backgroundColor: 'rgba(203,108,44,0.08)', border: '1px solid rgba(203,108,44,0.20)', cursor: 'pointer', transition: 'all 0.1s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(203,108,44,0.14)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(203,108,44,0.08)' }}
            >
              <RefreshCw size={13} strokeWidth={2.5} />
              Regen All ({staleCount})
            </button>
          )}
          <button
            onClick={() => setAddOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#ffffff', background: '#37352f', border: 'none', cursor: 'pointer', transition: 'opacity 0.1s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Add Competitor
          </button>
        </div>
      </div>

      {(loadingComp || loadingColl) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={1} showHeader />)}
        </div>
      ) : (
        <CompetitorTable
          competitors={competitors}
          collateral={collateral}
          onDelete={handleDelete}
          onGenerateBattlecard={handleGenerateBattlecard}
        />
      )}

      {/* Add modal */}
      <Dialog.Root open={addOpen} onOpenChange={setAddOpen}>
        <Dialog.Portal>
          <Dialog.Overlay style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(55,53,47,0.4)', zIndex: 500 }} />
          <Dialog.Content style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 501, width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', background: '#ffffff', border: '1px solid rgba(55,53,47,0.12)', borderRadius: '8px', padding: '24px', boxShadow: '0 8px 32px rgba(55,53,47,0.12)', outline: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <Dialog.Title style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Add competitor
              </Dialog.Title>
              <Dialog.Close asChild>
                <button style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#9b9a97' }}>
                  <X size={14} strokeWidth={2} />
                </button>
              </Dialog.Close>
            </div>
            <CompetitorForm onSubmit={handleAdd} loading={addLoading} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
