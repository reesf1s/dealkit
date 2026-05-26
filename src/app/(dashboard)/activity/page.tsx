'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { MessageSquare } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { OperatorHeader, OperatorPage, OperatorPanel } from '@/components/shared/OperatorUI'

export const dynamic = 'force-dynamic'

type Activity = {
  id: string
  type: string
  title: string
  summary: string | null
  body: string | null
  occurredAt: string
  source: string
  dealId: string | null
  dealTitle: string | null
  companyName: string | null
}

function when(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export default function ActivityPage() {
  const { data, isLoading } = useSWR<{ data: Activity[] }>('/api/crm/activity', fetcher, { revalidateOnFocus: false })
  const activity = data?.data ?? []

  return (
    <OperatorPage>
      <OperatorHeader eyebrow="Activity" title="Sales timeline" description="A workspace-wide timeline of imported, manual, calendar, task, and AI activity." />
      <OperatorPanel icon={MessageSquare}>
        <div className="crm-timeline">
          {activity.map(item => (
            <article key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.summary ?? item.body ?? item.type.replace(/_/g, ' ')}</p>
                {item.dealId && <Link href={`/deals/${item.dealId}`}>{item.companyName ?? item.dealTitle}</Link>}
              </div>
              <time>{when(item.occurredAt)}</time>
            </article>
          ))}
          {!isLoading && activity.length === 0 && <div className="empty-state">No activity yet.</div>}
        </div>
      </OperatorPanel>
    </OperatorPage>
  )
}
