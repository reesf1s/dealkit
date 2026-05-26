'use client'

import { Suspense } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Bot, LayoutGrid, Plus, Sparkles } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import {
  ActionCard,
  ButtonV2,
  DealCardV2,
  EmptyStateV2,
  HeroPanel,
  money,
  PanelV2,
  RiskBadge,
  SectionHeader,
  shortDate,
} from '@/components/v2/V2DesignSystem'

export const dynamic = 'force-dynamic'

export default function DealsPage() {
  return (
    <Suspense fallback={<EmptyStateV2 title="Loading deals">Preparing the sales workspace.</EmptyStateV2>}>
      <DealsContent />
    </Suspense>
  )
}

function DealsContent() {
  const search = useSearchParams()
  const view = search.get('view') ?? 'pipeline'
  const { data, isLoading } = useSWR('/api/crm/pipeline', fetcher, { revalidateOnFocus: false })
  const stages = data?.data?.stages ?? []
  const deals = data?.data?.deals ?? []
  const openValue = deals.filter((deal: any) => deal.status === 'open').reduce((sum: number, deal: any) => sum + (deal.valueAmount ?? 0), 0)
  const noNext = deals.filter((deal: any) => deal.status === 'open' && !deal.aiNextAction && !deal.nextStepDueAt)

  return (
    <div className="v2-page">
      <HeroPanel
        eyebrow="Deals"
        title="Deals"
        actions={<><ButtonV2 tone="dark"><Plus size={16} /> Add deal</ButtonV2><ButtonV2 onClick={() => {
          window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: 'Which deals are slipping?' } }))
        }}><Bot size={16} /> Ask Halvex</ButtonV2></>}
        aside={<div className="v2-glass-card"><strong>Pipeline read</strong><span>{money(openValue)} open · {noNext.length} missing next step · {deals.length} total deals</span></div>}
      >
        Pipeline, list, and intelligence in one workspace. Missing data and weak evidence stay visible.
      </HeroPanel>

      <PanelV2>
        <div className="v2-section-head">
          <div>
            <h2><LayoutGrid size={18} /> Workspace</h2>
            <p>Move from pipeline shape to evidence, risk, and next steps without changing products.</p>
          </div>
          <div className="v2-segmented">
            <Link className={view === 'pipeline' ? 'active' : ''} href="/deals?view=pipeline">Pipeline</Link>
            <Link className={view === 'list' ? 'active' : ''} href="/deals?view=list">List</Link>
            <Link className={view === 'intelligence' ? 'active' : ''} href="/deals?view=intelligence">Intelligence</Link>
          </div>
        </div>

        {isLoading ? <EmptyStateV2 title="Loading deals">Reading pipeline and intelligence context.</EmptyStateV2> : null}
        {!isLoading && !deals.length ? <EmptyStateV2 title="No deals yet" action={<ButtonV2 tone="dark">Add first deal</ButtonV2>}>Import or create opportunities and Halvex will start building deal memory.</EmptyStateV2> : null}
        {!isLoading && deals.length > 0 && view === 'pipeline' ? <PipelineView stages={stages} deals={deals} /> : null}
        {!isLoading && deals.length > 0 && view === 'list' ? <ListView deals={deals} /> : null}
        {!isLoading && deals.length > 0 && view === 'intelligence' ? <IntelligenceView deals={deals} /> : null}
      </PanelV2>
    </div>
  )
}

function PipelineView({ stages, deals }: { stages: any[]; deals: any[] }) {
  return (
    <div className="v2-pipeline">
      {stages.map(stage => {
        const stageDeals = deals.filter(deal => deal.stageId === stage.id)
        const value = stageDeals.reduce((sum, deal) => sum + (deal.valueAmount ?? 0), 0)
        return (
          <section key={stage.id} className="v2-stage">
            <div className="v2-stage-head">
              <div>
                <h3>{stage.name}</h3>
                <p>{stageDeals.length} deals · {money(value)}</p>
              </div>
            </div>
            {stageDeals.length ? stageDeals.map(deal => <DealCardV2 key={deal.id} deal={deal} />) : <EmptyStateV2 title="No deals here">This stage is clear.</EmptyStateV2>}
          </section>
        )
      })}
    </div>
  )
}

function ListView({ deals }: { deals: any[] }) {
  return (
    <table className="v2-table">
      <thead><tr><th>Deal</th><th>Company</th><th>Stage</th><th>Value</th><th>Close</th><th>Risk</th><th>Next action</th></tr></thead>
      <tbody>
        {deals.map(deal => (
          <tr key={deal.id}>
            <td><Link href={`/deals/${deal.id}`}>{deal.title}</Link></td>
            <td>{deal.companyName ?? 'Unknown company'}</td>
            <td>{deal.stageName ?? 'No stage'}</td>
            <td>{money(deal.valueAmount)}</td>
            <td>{shortDate(deal.expectedCloseDate) ?? 'Missing'}</td>
            <td><RiskBadge risk={deal.aiRiskLevel} /></td>
            <td>{deal.aiNextAction ?? 'No next step'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function IntelligenceView({ deals }: { deals: any[] }) {
  const groups = [
    { title: 'At risk', deals: deals.filter(deal => deal.aiRiskLevel === 'high' || (deal.aiScore ?? 50) < 45), reason: 'Risk or low momentum is visible.' },
    { title: 'No next step', deals: deals.filter(deal => !deal.aiNextAction && !deal.nextStepDueAt), reason: 'Open deals need a concrete next action.' },
    { title: 'Missing key data', deals: deals.filter(deal => !deal.valueAmount || !deal.expectedCloseDate), reason: 'Missing value or close date lowers forecast confidence.' },
    { title: 'Likely to close', deals: deals.filter(deal => (deal.aiScore ?? 0) >= 65 && deal.aiRiskLevel !== 'high'), reason: 'Good momentum, but still check evidence.' },
  ]
  return (
    <div className="v2-grid-2">
      {groups.map(group => (
        <PanelV2 key={group.title}>
          <SectionHeader title={group.title} icon={<Sparkles size={18} />}>{group.reason}</SectionHeader>
          <div className="v2-stack">
            {group.deals.slice(0, 5).map(deal => <ActionCard key={deal.id} href={`/deals/${deal.id}`} title={deal.title} reason={deal.aiNextAction ?? `${deal.companyName ?? 'Unknown company'} needs review.`} source={deal.companyName ?? 'Deal'} />)}
            {!group.deals.length ? <EmptyStateV2 title="Nothing here">Halvex has not flagged this pattern.</EmptyStateV2> : null}
          </div>
        </PanelV2>
      ))}
    </div>
  )
}
