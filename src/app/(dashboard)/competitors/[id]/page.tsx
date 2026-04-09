'use client'
export const dynamic = 'force-dynamic'

import { useParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CompetitorDetail } from '@/components/competitors/CompetitorDetail'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { useToast } from '@/components/shared/Toast'
import type { Competitor, Collateral, DealLog } from '@/types'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

export default function CompetitorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const { data: compRes, isLoading: loadingComp, mutate: mutateComp } = useSWR<{ data: Competitor }>(
    `/api/competitors/${id}`,
    fetcher,
  )
  const { data: collRes, isLoading: loadingColl, mutate: mutateColl } = useSWR<{ data: Collateral[] }>(
    '/api/collateral',
    fetcher,
  )
  const { data: dealsRes, isLoading: loadingDeals } = useSWR<{ data: DealLog[] }>(
    '/api/deals',
    fetcher,
  )

  const competitor = compRes?.data
  const collateral = collRes?.data ?? []
  const deals = dealsRes?.data ?? []

  // Deals that list this competitor in their competitors array
  const linkedDeals = deals.filter(
    (d) => d.competitors.includes(competitor?.name ?? '') && (d.stage === 'closed_won' || d.stage === 'closed_lost'),
  )

  async function handleSave(data: Partial<Competitor>) {
    const res = await fetch(`/api/competitors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error ?? 'Failed to save')
    }
    await mutateComp()
  }

  async function handleGenerateBattlecard() {
    // If a battlecard already exists for this competitor (stale or generating), PATCH it
    // instead of creating a duplicate. Only POST if none exists yet.
    const existingBattlecard = collateral.find(
      c => c.type === 'battlecard' && c.sourceCompetitorId === id
    )

    let res: Response
    if (existingBattlecard) {
      res = await fetch(`/api/collateral/${existingBattlecard.id}`, { method: 'PATCH' })
    } else {
      res = await fetch('/api/collateral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'battlecard', competitorId: id }),
      })
    }
    if (!res.ok) throw new Error('Failed to start generation')
    await mutateColl()
  }

  const isLoading = loadingComp || loadingColl || loadingDeals

  return (
    <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto', background: '#ffffff', minHeight: '100%' }}>
      {/* Back nav */}
      <Link
        href="/competitors"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#9b9a97', textDecoration: 'none', marginBottom: '20px' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#9b9a97' }}
      >
        <ArrowLeft size={14} strokeWidth={2} />
        Back to competitors
      </Link>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SkeletonCard lines={3} showHeader />
          <SkeletonCard lines={5} showHeader={false} />
        </div>
      ) : !competitor ? (
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(224,62,62,0.08)', border: '1px solid rgba(224,62,62,0.20)', color: '#e03e3e', fontSize: '13px' }}>
          Competitor not found.
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: '4px' }}>
              {competitor.name}
            </h1>
            {competitor.website && (
              <a href={competitor.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#5e6ad2', textDecoration: 'none' }}>
                {competitor.website}
              </a>
            )}
          </div>

          <CompetitorDetail
            competitor={competitor}
            collateral={collateral}
            linkedDeals={linkedDeals}
            onSave={handleSave}
            onGenerateBattlecard={handleGenerateBattlecard}
          />
        </>
      )}
    </div>
  )
}
