'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { CheckCircle2, LayoutGrid, Plus } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import {
  CrmButton,
  ClampedText,
  CompactDealCard,
  CrmEmpty,
  CrmPage,
  CrmPanel,
  CrmSectionHeader,
  CrmSkeleton,
  CrmStat,
  ObjectWorkspaceHeader,
  money,
} from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

type HomeData = {
  priorities: Array<{ id: string; title: string; reason: string; linkedType: string; linkedId: string; dealId?: string | null; suggestedAction?: string | null; confidence?: string }>
  upcomingMeetings: Array<{ id: string; title: string; startsAt: string; dealId: string | null; dealTitle: string | null; companyName: string | null }>
  openPipelineValue: number
  likelyClosers: Array<any>
  atRiskDeals: Array<any>
  staleDeals: Array<any>
  dealIntelligence: Array<any>
}

export default function HomePage() {
  const { data, isLoading, mutate } = useSWR<{ data: HomeData }>('/api/crm/today', fetcher, { revalidateOnFocus: false })
  const [completingId, setCompletingId] = useState<string | null>(null)
  const home = data?.data
  const priorities = home?.priorities ?? []
  const activeDeals = [...(home?.likelyClosers ?? []), ...(home?.atRiskDeals ?? []), ...(home?.staleDeals ?? []), ...(home?.dealIntelligence ?? [])]
    .filter((deal, index, all) => all.findIndex(item => item.id === deal.id) === index)
    .slice(0, 6)
  const isEmptyWorkspace = !isLoading && priorities.length === 0 && activeDeals.length === 0 && Number(home?.openPipelineValue ?? 0) === 0

  async function completePriority(priority: HomeData['priorities'][number]) {
    if (priority.linkedType !== 'task') return
    setCompletingId(priority.id)
    try {
      await fetch('/api/crm/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: priority.linkedId, action: 'complete' }),
      })
      await mutate()
    } finally {
      setCompletingId(null)
    }
  }

  return (
    <CrmPage wide>
      <ObjectWorkspaceHeader
        object="Home"
        title="Home"
        actions={!isEmptyWorkspace ? <><CrmButton href="/tasks?quick=task" tone="primary"><Plus size={16} /> Add task</CrmButton><CrmButton href="/deals?quick=deal"><Plus size={16} /> Add deal</CrmButton></> : undefined}
        stats={!isEmptyWorkspace ? <>
        <CrmStat label="Tasks due" value={priorities.length} hint={priorities.length ? 'Review or complete' : 'Clear'} />
        <CrmStat label="Open pipeline" value={money(home?.openPipelineValue ?? 0)} />
        <CrmStat label="Likely closers" value={(home?.likelyClosers ?? []).length} />
        <CrmStat label="At risk" value={(home?.atRiskDeals ?? []).length} />
        </> : undefined}
      />

      {isEmptyWorkspace ? (
        <CrmPanel className="crm-record-workbench crm-home-empty">
          <CrmEmpty title="No records yet" action={<><CrmButton href="/companies?quick=company" tone="primary">Add company</CrmButton><CrmButton href="/deals?quick=deal">Add deal</CrmButton></>}>
          </CrmEmpty>
        </CrmPanel>
      ) : null}

      {!isEmptyWorkspace ? <div className="crm-home-desk">
        <CrmPanel className="crm-home-primary">
          <CrmSectionHeader title="Tasks due" action={<CrmButton href="/tasks">All tasks</CrmButton>} />
          <div className="crm-stack">
            {isLoading ? <CrmSkeleton rows={4} /> : priorities.length ? priorities.slice(0, 6).map(priority => (
              <article key={priority.id} className="crm-work-row">
                <span className="crm-icon"><CheckCircle2 size={17} /></span>
                <div>
                  <strong><ClampedText lines={2} title={priority.title}>{priority.title}</ClampedText></strong>
                  <p><ClampedText lines={2}>{priority.reason}</ClampedText></p>
                </div>
                <div className="crm-form-actions">
                  {priority.dealId ? <CrmButton href={`/deals/${priority.dealId}`} tone="ghost">Open</CrmButton> : null}
                  {priority.linkedType === 'task' ? <CrmButton onClick={() => completePriority(priority)} disabled={completingId === priority.id}>Done</CrmButton> : null}
                </div>
              </article>
            )) : (
              <CrmEmpty title="No tasks due" action={<CrmButton href="/tasks?quick=task" tone="primary">Add task</CrmButton>}>
              </CrmEmpty>
            )}
          </div>
        </CrmPanel>
      </div> : null}

      {!isEmptyWorkspace ? <CrmPanel className="crm-home-deals">
        <CrmSectionHeader title="Active deals" action={<CrmButton href="/deals"><LayoutGrid size={16} /> Deals</CrmButton>} />
        {isLoading ? <CrmSkeleton rows={5} /> : activeDeals.length ? (
          <div className="crm-grid-3">
            {activeDeals.map(deal => <CompactDealCard key={deal.id} deal={deal} />)}
          </div>
        ) : (
          <CrmEmpty title="No active deals" action={<CrmButton href="/deals?quick=deal" tone="primary">Add deal</CrmButton>}>
          </CrmEmpty>
        )}
      </CrmPanel> : null}

      {!isEmptyWorkspace ? <CrmPanel>
        <CrmSectionHeader title="Recent records" />
        {activeDeals.length ? (
          <div className="crm-continuation-strip">
            {activeDeals.slice(0, 5).map(deal => (
              <Link key={deal.id} href={`/deals/${deal.id}`} className="crm-continuation-card">
                <strong><ClampedText lines={1}>{deal.title}</ClampedText></strong>
                <p><ClampedText lines={1}>{deal.companyName ?? 'Unknown company'} · {deal.stageName ?? 'No stage'}</ClampedText></p>
              </Link>
            ))}
          </div>
        ) : <CrmEmpty title="No recent records" />}
      </CrmPanel> : null}
    </CrmPage>
  )
}
