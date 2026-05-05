'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import useSWR from 'swr'
import { useUser } from '@clerk/nextjs'
import { AlertTriangle, ArrowRight, Bot, CalendarClock, CheckCircle2, Clock3, PoundSterling, TrendingUp } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import type { DealLog } from '@/types'
import { OperatorHeader, OperatorKpi, OperatorPage } from '@/components/shared/OperatorUI'

interface SummaryDeal {
  id: string
  name: string
  company: string
  value: number
  stage: string
  urgencyScore: number
  topAction: string
  riskLevel: 'high' | 'medium' | 'low'
  daysStale: number
  primaryBlocker?: string | null
  latestSnapshot?: string | null
  previousSnapshot?: string | null
  latestAction?: string | null
  statusSummary?: string | null
  latestActivityAt?: string
}

interface DashboardSummary {
  revenueAtRisk: number
  dealsAtRisk: number
  staleDeals?: number
  executionGaps?: number
  topDeals: SummaryDeal[]
  focusBullets: string[]
  focusItems?: FocusItem[]
  dataQuality?: DataQuality
  hygieneQueue?: HygieneItem[]
  generatedAt?: string
}

interface DataQuality {
  missingNextStep: number
  missingCloseDate: number
  missingPrimaryContact: number
  missingDealValue: number
}

interface FocusItem {
  dealId: string
  company: string
  status?: string
  action: string
  blocker?: string | null
  latestSnapshot?: string | null
  previousSnapshot?: string | null
  why: string
  dueLabel: string
  riskLevel: 'high' | 'medium' | 'low'
  daysStale: number
  latestActivityAt?: string
}

interface HygieneItem {
  dealId: string
  company: string
  missing: string[]
  daysStale: number
  latestActivityAt: string
  value: number
}

interface ActivityEvent {
  id: string
  type: string
  metadata: Record<string, unknown>
  createdAt: string
  dealName?: string
}

interface AutomationItem {
  id: string
  name: string
  category: 'intelligence' | 'alerts' | 'automation'
  enabled: boolean
  alwaysOn: boolean
}

const CLOSED_STAGES = new Set(['closed_won', 'closed_lost'])
function cleanFocusLine(line: string): string {
  return line.replace(/^\s*[-*•\d.)]+\s*/, '').trim()
}

function currency(value: number | null | undefined): string {
  if (!value && value !== 0) return '—'
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `£${Math.round(value / 1_000)}k`
  return `£${Math.round(value)}`
}

function stageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function relTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(delta / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function eventLabel(event: ActivityEvent): string {
  const deal = String(event.metadata?.dealName ?? event.dealName ?? 'Deal')
  const stage = String(event.metadata?.value ?? event.metadata?.newStage ?? '').replace(/_/g, ' ')

  switch (event.type) {
    case 'deal_log.created':
    case 'deal_created':
      return `${deal} was added to the pipeline`
    case 'deal_log.closed_won':
    case 'deal_won':
      return `${deal} was marked closed won`
    case 'deal_log.closed_lost':
    case 'deal_lost':
      return `${deal} was marked closed lost`
    case 'deal_log.updated':
      if (event.metadata?.field === 'stage' && stage) return `${deal} moved to ${stage}`
      return `${deal} was updated`
    case 'note_added':
    case 'deal_log.note_added':
      return `Notes were added on ${deal}`
    case 'deal_log.ai_scored':
      return `Deal intelligence rescored ${deal}`
    default:
      return event.type.replace(/[_.]/g, ' ')
  }
}

function inferredDailyFocus(deals: DealLog[]): string[] {
  const open = deals.filter(d => !CLOSED_STAGES.has(d.stage))

  const stale = [...open]
    .sort((a, b) => +new Date(a.updatedAt) - +new Date(b.updatedAt))
    .slice(0, 2)
    .map(d => `Re-engage ${d.prospectCompany}; no recent movement and value ${currency(d.dealValue)}`)

  const noNext = open
    .filter(d => !d.nextSteps)
    .slice(0, 2)
    .map(d => `Define a concrete next step for ${d.dealName} to avoid stall risk`)

  const highValue = [...open]
    .sort((a, b) => (b.dealValue ?? 0) - (a.dealValue ?? 0))
    .slice(0, 1)
    .map(d => `Protect ${d.prospectCompany} (${currency(d.dealValue)}) with a same-day exec touchpoint`)

  return [...highValue, ...stale, ...noNext].slice(0, 4)
}

function riskColor(level: SummaryDeal['riskLevel']): string {
  if (level === 'high') return '#fb7185'
  if (level === 'medium') return '#fbbf24'
  return '#4ade80'
}

function stagePillColor(stage: string): string {
  switch (stage) {
    case 'negotiation': return 'rgba(251, 113, 133, 0.16)'
    case 'proposal': return 'rgba(251, 191, 36, 0.16)'
    case 'discovery': return 'rgba(167, 139, 250, 0.18)'
    case 'qualification': return 'rgba(96, 165, 250, 0.16)'
    default: return 'rgba(148, 163, 184, 0.16)'
  }
}

function focusRiskColor(level: FocusItem['riskLevel']): string {
  if (level === 'high') return '#fb7185'
  if (level === 'medium') return '#fbbf24'
  return '#60a5fa'
}

function focusRiskLabel(level: FocusItem['riskLevel']): string {
  if (level === 'high') return 'Priority'
  if (level === 'medium') return 'Important'
  return 'Monitor'
}

export default function DashboardPage() {
  const { user } = useUser()

  const { data: dealsRes, isLoading: dealsLoading } = useSWR<{ data: DealLog[] }>('/api/deals', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45_000,
  })

  const { data: summaryRes, isLoading: summaryLoading } = useSWR<{ data: DashboardSummary }>('/api/dashboard/summary', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  })

  const { data: activityRes, isLoading: activityLoading } = useSWR<{ data: ActivityEvent[] }>('/api/activity?limit=12', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const { data: automationsRes } = useSWR<{ data: AutomationItem[] }>('/api/automations', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45_000,
  })

  const deals = dealsRes?.data ?? []
  const openDeals = deals.filter(d => !CLOSED_STAGES.has(d.stage))
  const summary = summaryRes?.data
  const activity = activityRes?.data ?? []
  const automations = automationsRes?.data ?? []

  const pipelineValue = openDeals.reduce((sum, deal) => sum + (deal.dealValue ?? 0), 0)
  const staleDealsCount = summary?.staleDeals ?? 0
  const missingNextStepCount = summary?.executionGaps ?? 0
  const dataQuality = summary?.dataQuality
  const hygieneQueue = summary?.hygieneQueue ?? []
  const totalQualityGaps =
    (dataQuality?.missingNextStep ?? 0) +
    (dataQuality?.missingCloseDate ?? 0) +
    (dataQuality?.missingPrimaryContact ?? 0) +
    (dataQuality?.missingDealValue ?? 0)
  const focusBullets = (summary?.focusBullets?.length ? summary.focusBullets : inferredDailyFocus(deals))
    .map(cleanFocusLine)
    .filter(Boolean)
    .slice(0, 4)
  const focusItems = [...(summary?.focusItems ?? [])]
    .sort((a, b) => {
      const aTs = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : 0
      const bTs = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : 0
      if (aTs !== bTs) return bTs - aTs
      return a.daysStale - b.daysStale
    })
    .slice(0, 4)

  const enabledAutomations = automations.filter(item => item.enabled)
  const alwaysOnAutomations = automations.filter(item => item.alwaysOn)
  const alertAutomations = enabledAutomations.filter(item => item.category === 'alerts')

  const rawTopDeals = (summary?.topDeals?.length ? [...summary.topDeals] : [])
    .sort((a, b) => {
      const aTs = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : 0
      const bTs = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : 0
      if (aTs !== bTs) return bTs - aTs
      return a.daysStale - b.daysStale
    })
  const filteredTopDeals = rawTopDeals.filter(item =>
    item.riskLevel !== 'low' ||
    item.daysStale >= 7 ||
    item.value >= 100_000 ||
    Boolean(item.primaryBlocker),
  )
  const topRiskDeals = (filteredTopDeals.length > 0 ? filteredTopDeals : rawTopDeals).slice(0, 6)

  return (
    <OperatorPage>
      <OperatorHeader
        eyebrow="Revenue Command Center"
        title={user?.firstName ? `${user.firstName}, here is today's focus` : 'Today\'s commercial focus'}
        description="Latest customer activity first, with blockers and next interventions surfaced for action."
        actions={<div className="notion-chip"><CalendarClock size={12} /> Live view</div>}
      />

      <section className="dashboard-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {[
          { label: 'Open Pipeline', value: currency(pipelineValue), sub: `${openDeals.length} open deals`, icon: PoundSterling },
          { label: 'Revenue At Risk', value: currency(summary?.revenueAtRisk ?? 0), sub: `${summary?.dealsAtRisk ?? 0} deals flagged`, icon: AlertTriangle },
          { label: 'Stale Opportunities', value: String(staleDealsCount), sub: 'No movement in 10+ days', icon: Clock3 },
          { label: 'Execution Gaps', value: String(missingNextStepCount), sub: 'Deals missing explicit next step', icon: TrendingUp },
        ].map(card => (
          <OperatorKpi key={card.label} label={card.label} value={card.value} sub={card.sub} icon={card.icon} />
        ))}
      </section>

      <section className="dashboard-focus" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 8 }}>
        <article className="notion-panel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14, letterSpacing: 0, textTransform: 'none' }}>Today Execution Queue</h2>
            <Link href="/pipeline?view=kanban" style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Open pipeline <ArrowRight size={11} />
            </Link>
          </div>
	          {summaryLoading && dealsLoading ? (
	            <div className="skeleton" style={{ height: 112, borderRadius: 10 }} />
	          ) : focusItems.length > 0 ? (
	            <div style={{ display: 'grid', gap: 8 }}>
	              {focusItems.map((item, i) => (
                <Link key={`${item.dealId}-${i}`} href={`/deals/${item.dealId}`} style={{ textDecoration: 'none' }}>
                  <div style={{ border: '1px solid var(--border-default)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface-1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.company}</span>
                        <span style={{ fontSize: 10.5, color: focusRiskColor(item.riskLevel), fontWeight: 700, textTransform: 'uppercase' }}>{focusRiskLabel(item.riskLevel)}</span>
                      </div>
                      <span className="notion-chip">{item.dueLabel}</span>
                    </div>
	                    <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
	                      Latest: {item.latestSnapshot ?? 'No recent activity yet.'}
	                    </div>
	                    {item.blocker && (
	                      <div style={{ marginTop: 1, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
	                        Blocker: {item.blocker}
	                      </div>
	                    )}
	                    <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
	                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.daysStale > 0 ? `${item.daysStale}d idle` : 'updated today'}</span>
	                    </div>
	                  </div>
	                </Link>
	              ))}
	            </div>
          ) : focusBullets.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>Add deals to generate a structured daily execution plan.</p>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 10 }}>
              {focusBullets.map((item, i) => (
                <li key={`${item}-${i}`} style={{ color: 'var(--text-primary)', lineHeight: 1.5, fontSize: 12.5 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
                </li>
              ))}
            </ol>
          )}
          {summary?.generatedAt && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)' }}>
              Intelligence generated {relTime(summary.generatedAt)}.
            </div>
          )}
        </article>

        <article className="notion-panel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14, letterSpacing: 0, textTransform: 'none' }}>Silent Automations</h2>
            <Bot size={13} style={{ color: 'var(--text-secondary)' }} />
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              <span>Enabled</span>
              <strong style={{ color: 'var(--text-primary)' }}>{enabledAutomations.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              <span>Always-on intelligence</span>
              <strong style={{ color: 'var(--text-primary)' }}>{alwaysOnAutomations.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              <span>Live alerts</span>
              <strong style={{ color: 'var(--text-primary)' }}>{alertAutomations.length}</strong>
            </div>
          </div>

          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            {enabledAutomations.slice(0, 3).map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={12} style={{ color: '#4ade80', flexShrink: 0 }} />
                <span>{a.name}</span>
              </div>
            ))}
            {enabledAutomations.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>No optional automations enabled yet.</div>}
          </div>

          <Link href="/automations" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-secondary)' }}>
            Manage automation policy <ArrowRight size={11} />
          </Link>
        </article>
      </section>

      <section>
        <article className="notion-panel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14, letterSpacing: 0, textTransform: 'none' }}>
              CRM Hygiene Queue
            </h2>
            <span className="notion-chip">{totalQualityGaps} field gaps across open pipeline</span>
          </div>

          <div className="hygiene-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
            {[
              { label: 'Missing next step', value: dataQuality?.missingNextStep ?? 0 },
              { label: 'Missing close date', value: dataQuality?.missingCloseDate ?? 0 },
              { label: 'Missing primary contact', value: dataQuality?.missingPrimaryContact ?? 0 },
              { label: 'Missing deal value', value: dataQuality?.missingDealValue ?? 0 },
            ].map(item => (
              <div key={item.label} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--surface-1)', padding: '8px 10px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{item.value}</div>
                <div style={{ marginTop: 3, fontSize: 11.5, color: 'var(--text-secondary)' }}>{item.label}</div>
              </div>
            ))}
          </div>

          {summaryLoading ? (
            <div className="skeleton" style={{ height: 96, borderRadius: 10 }} />
          ) : hygieneQueue.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12.5 }}>
              Data hygiene is clean across open deals.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {hygieneQueue.slice(0, 5).map(item => (
                <Link key={item.dealId} href={`/deals/${item.dealId}`} style={{ textDecoration: 'none' }}>
                  <div style={{ border: '1px solid var(--border-default)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface-1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{item.company}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {item.daysStale > 0 ? `${item.daysStale}d idle` : 'updated today'}
                      </span>
                    </div>
                    <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {item.missing.map(field => (
                        <span key={`${item.dealId}-${field}`} className="notion-chip" style={{ fontSize: 10.5 }}>
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </article>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 8 }}>
        <article className="notion-panel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14, letterSpacing: 0, textTransform: 'none' }}>Risk Queue</h2>
            <span className="notion-chip">Top opportunities needing intervention</span>
          </div>

          {summaryLoading ? (
            <div className="skeleton" style={{ height: 180, borderRadius: 10 }} />
          ) : topRiskDeals.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>No risk signals yet. Your queue updates automatically as deals progress.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {topRiskDeals.map(item => (
                <Link key={item.id} href={`/deals/${item.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ border: '1px solid var(--border-default)', borderRadius: 9, padding: '8px 10px', background: 'var(--surface-1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
	                      <div style={{ minWidth: 0 }}>
	                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
	                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{item.company}</span>
	                          <span style={{ fontSize: 10.5, borderRadius: 999, padding: '2px 7px', color: 'var(--text-secondary)', background: stagePillColor(item.stage) }}>
	                            {stageLabel(item.stage)}
	                          </span>
	                          <span style={{ fontSize: 10.5, color: riskColor(item.riskLevel), fontWeight: 700, textTransform: 'uppercase' }}>{item.riskLevel}</span>
	                        </div>
	                        <div style={{ marginTop: 3, fontSize: 12.5, color: 'var(--text-secondary)' }}>
	                          Latest: {item.latestSnapshot ?? 'No recent activity yet.'}
	                        </div>
	                        {item.primaryBlocker && (
	                          <div style={{ marginTop: 1, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
	                            Blocker: {item.primaryBlocker}
	                          </div>
	                        )}
	                      </div>
	                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
	                        <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 700 }}>{currency(item.value)}</div>
	                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.daysStale}d stale</div>
	                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="notion-panel" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14, letterSpacing: 0, textTransform: 'none' }}>Execution Feed</h2>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{activity.length} events</span>
          </div>

          {activityLoading ? (
            <div className="skeleton" style={{ height: 180, borderRadius: 10 }} />
          ) : activity.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>Activity will appear as your team updates deals.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {activity.slice(0, 8).map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 5, background: 'var(--text-tertiary)', boxShadow: '0 0 0 4px var(--surface-2)' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{eventLabel(item)}</div>
                    <div style={{ marginTop: 1, fontSize: 11.5, color: 'var(--text-tertiary)' }}>{relTime(item.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <style>{`
        @media (max-width: 1120px) {
          .dashboard-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .dashboard-focus { grid-template-columns: 1fr !important; }
          .hygiene-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 900px) {
          .dashboard-kpis { grid-template-columns: 1fr !important; }
          .hygiene-kpis { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </OperatorPage>
  )
}
