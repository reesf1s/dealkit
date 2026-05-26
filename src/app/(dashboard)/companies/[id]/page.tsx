'use client'

import useSWR from 'swr'
import { useParams } from 'next/navigation'
import { Bot, Building2, Plus } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ActionCard, ButtonV2, EmptyStateV2, money, PanelV2, RecordHero, SectionHeader } from '@/components/v2/V2DesignSystem'

export const dynamic = 'force-dynamic'

export default function CompanyPage() {
  const params = useParams<{ id: string }>()
  const { data: companiesData, isLoading } = useSWR('/api/crm/companies', fetcher, { revalidateOnFocus: false })
  const { data: pipelineData } = useSWR('/api/crm/pipeline', fetcher, { revalidateOnFocus: false })
  const company = (companiesData?.data ?? []).find((item: any) => item.id === params.id)
  const deals = (pipelineData?.data?.deals ?? []).filter((deal: any) => deal.companyId === params.id)

  if (isLoading) return <EmptyStateV2 title="Loading company">Reading account memory.</EmptyStateV2>
  if (!company) return <EmptyStateV2 title="Company not found">This account may not exist in this workspace.</EmptyStateV2>

  return (
    <div className="v2-page">
      <RecordHero
        eyebrow="Company"
        title={company.name}
        subtitle={`${company.openDeals} open deals · ${money(company.pipelineValue)} pipeline. Company memory connects people, meetings, tasks, and deal risk.`}
        actions={<><ButtonV2 tone="dark"><Plus size={16} /> Add note</ButtonV2><ButtonV2 onClick={() => {
          window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `Summarise ${company.name}` } }))
        }}><Bot size={16} /> Ask Halvex</ButtonV2></>}
      />

      <div className="v2-grid-2">
        <PanelV2>
          <SectionHeader title="Company summary" icon={<Building2 size={18} />}>
            Halvex should explain relationship state, active opportunities, blockers, and the next recommended move.
          </SectionHeader>
          <ActionCard title="Account context" reason={company.lastActivityAt ? 'Recent CRM activity exists for this account.' : 'No recent activity is attached yet.'} source={company.domain ?? 'Company'} />
        </PanelV2>
        <PanelV2>
          <SectionHeader title="Linked deals">
            Opportunities attached to this company.
          </SectionHeader>
          <div className="v2-stack">
            {deals.map((deal: any) => <ActionCard key={deal.id} href={`/deals/${deal.id}`} title={deal.title} reason={deal.aiNextAction ?? 'Open deal. Review the workspace.'} source={money(deal.valueAmount)} />)}
            {!deals.length ? <EmptyStateV2 title="No linked deals">Create or link a deal to make this account actionable.</EmptyStateV2> : null}
          </div>
        </PanelV2>
      </div>
    </div>
  )
}
