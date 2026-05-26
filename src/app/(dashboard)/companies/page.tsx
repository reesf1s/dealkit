'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ButtonV2, EmptyStateV2, HeroPanel, money, PanelV2, RiskBadge, SectionHeader, shortDate } from '@/components/v2/V2DesignSystem'

export const dynamic = 'force-dynamic'

export default function CompaniesPage() {
  const { data, isLoading } = useSWR('/api/crm/companies', fetcher, { revalidateOnFocus: false })
  const companies = data?.data ?? []

  return (
    <div className="v2-page">
      <HeroPanel
        eyebrow="Companies"
        title="Account memory that connects people, deals, and meetings."
        actions={<><ButtonV2 tone="dark"><Plus size={16} /> Add company</ButtonV2><ButtonV2 href="/people">People</ButtonV2></>}
        aside={<div className="v2-glass-card"><strong>Company context</strong><span>Open deals, risk, last activity, and next action belong together.</span></div>}
      >
        Companies are not a static directory. They are the shared memory for every account relationship.
      </HeroPanel>

      <PanelV2>
        <SectionHeader title="Companies" icon={<Building2 size={18} />}>
          Account records should show relationship state and active revenue.
        </SectionHeader>
        {isLoading ? <EmptyStateV2 title="Loading companies">Reading account records.</EmptyStateV2> : null}
        {!isLoading && !companies.length ? <EmptyStateV2 title="No companies yet" action={<ButtonV2 href="/settings?section=imports" tone="dark">Import companies</ButtonV2>}>Import accounts or add the first company from a deal.</EmptyStateV2> : null}
        <div className="v2-grid-3">
          {companies.map((company: any) => (
            <Link key={company.id} href={`/companies/${company.id}`} className="v2-company-card">
              <div className="v2-card-icon"><Building2 size={16} /></div>
              <div>
                <strong>{company.name}</strong>
                <p>{company.domain ?? 'No domain'} · {company.openDeals} open deals · {money(company.pipelineValue)}</p>
                <div className="v2-deal-facts">
                  <span>{company.lastActivityAt ? `Last ${shortDate(company.lastActivityAt)}` : 'No activity'}</span>
                  {company.riskCount ? <RiskBadge risk="high" /> : <RiskBadge risk="unknown" />}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </PanelV2>
    </div>
  )
}
