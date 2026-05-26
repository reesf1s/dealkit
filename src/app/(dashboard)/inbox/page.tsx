'use client'

import useSWR from 'swr'
import { Inbox, Link2, Sparkles } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ActionCard, ButtonV2, EmptyStateV2, HeroPanel, PanelV2, SectionHeader } from '@/components/v2/V2DesignSystem'

export const dynamic = 'force-dynamic'

export default function InboxPage() {
  const { data: todayData } = useSWR('/api/crm/today', fetcher, { revalidateOnFocus: false })
  const { data: activityData } = useSWR('/api/crm/activity', fetcher, { revalidateOnFocus: false })
  const priorities = todayData?.data?.priorities ?? []
  const activity = activityData?.data ?? []
  const missingData = [
    ...(todayData?.data?.atRiskDeals ?? []),
    ...(todayData?.data?.staleDeals ?? []),
  ].filter((deal: any, index: number, all: any[]) => all.findIndex(item => item.id === deal.id) === index)

  return (
    <div className="v2-page">
      <HeroPanel
        eyebrow="Inbox"
        title="Triage"
        actions={<><ButtonV2 tone="dark"><Sparkles size={16} /> Review suggestions</ButtonV2><ButtonV2 href="/calendar">Open Calendar</ButtonV2></>}
        aside={<div className="v2-glass-card"><strong>Triage loop</strong><span>Attach, update, create follow-up, or dismiss. Halvex proposes; you approve.</span></div>}
      >
        New notes, missing fields, follow-ups, and AI suggestions become reviewed CRM updates here.
      </HeroPanel>

      <div className="v2-grid-2">
        <PanelV2>
          <SectionHeader title="Needs review" icon={<Inbox size={18} />}>
            Approve the updates that matter. Dismiss noise.
          </SectionHeader>
          <div className="v2-stack">
            {priorities.length ? priorities.map((item: any) => (
              <ActionCard
                key={item.id}
                href={item.dealId ? `/deals/${item.dealId}` : undefined}
                title={item.title}
                reason={`${item.reason} Suggested action: ${item.suggestedAction}`}
                source={item.linkedType}
                action={<Link2 size={17} />}
              />
            )) : <EmptyStateV2 title="Inbox is clear">When Calendar, tasks, emails, or missing CRM data need review, they will appear here.</EmptyStateV2>}
          </div>
        </PanelV2>

        <PanelV2>
          <SectionHeader title="Suggested cleanup" icon={<Sparkles size={18} />}>
            Missing data and risky context that should be reviewed by a human.
          </SectionHeader>
          <div className="v2-stack">
            {missingData.slice(0, 6).map((deal: any) => (
              <ActionCard
                key={deal.id}
                href={`/deals/${deal.id}`}
                title={deal.title}
                reason={deal.aiNextAction ?? 'Review missing next step, value, close date, or risk context.'}
                source={deal.companyName ?? 'Deal'}
              />
            ))}
            {!missingData.length ? <EmptyStateV2 title="No cleanup suggestions">Halvex has not found stale or risky records yet.</EmptyStateV2> : null}
          </div>
        </PanelV2>
      </div>

      <PanelV2>
        <SectionHeader title="Recent CRM memory">
          Activity is no longer a standalone product page. It is evidence for records and triage for Inbox.
        </SectionHeader>
        <div className="v2-stack">
          {activity.slice(0, 8).map((item: any) => (
            <ActionCard key={item.id} href={item.dealId ? `/deals/${item.dealId}` : undefined} title={item.title} reason={item.summary || item.body || 'No extra detail saved.'} source={item.source} />
          ))}
          {!activity.length ? <EmptyStateV2 title="No activity yet">Import records, add updates, or connect Calendar to start building memory.</EmptyStateV2> : null}
        </div>
      </PanelV2>
    </div>
  )
}
