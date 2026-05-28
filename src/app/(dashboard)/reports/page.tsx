'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { BarChart3, Bot, CheckCircle2, Database, ListChecks, TrendingUp } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import {
  ClampedText,
  CrmBadge,
  CrmButton,
  CrmEmpty,
  CrmPage,
  CrmPanel,
  CrmRiskBadge,
  CrmSectionHeader,
  CrmSkeleton,
  CrmStat,
  ObjectWorkspaceHeader,
  WorkspaceBriefing,
  money,
} from '@/components/crm/CrmShell'

export const dynamic = 'force-dynamic'

type AttentionItem = {
  id: string
  kind: string
  title: string
  reason: string
  href: string
  risk?: string | null
  badge?: string
  tone?: 'neutral' | 'good' | 'warn' | 'danger'
}

export default function ReportsPage() {
  const { data: pipelineData, isLoading: loadingPipeline } = useSWR('/api/crm/pipeline', fetcher, { revalidateOnFocus: false })
  const { data: companiesData, isLoading: loadingCompanies } = useSWR('/api/crm/companies', fetcher, { revalidateOnFocus: false })
  const { data: peopleData, isLoading: loadingPeople } = useSWR('/api/crm/contacts', fetcher, { revalidateOnFocus: false })
  const { data: tasksData, isLoading: loadingTasks } = useSWR('/api/crm/tasks?status=todo', fetcher, { revalidateOnFocus: false })

  const deals = useMemo(() => pipelineData?.data?.deals ?? [], [pipelineData])
  const stages = useMemo(() => pipelineData?.data?.stages ?? [], [pipelineData])
  const companies = useMemo(() => companiesData?.data ?? [], [companiesData])
  const people = useMemo(() => peopleData?.data ?? [], [peopleData])
  const tasks = useMemo(() => tasksData?.data ?? [], [tasksData])
  const loading = loadingPipeline || loadingCompanies || loadingPeople || loadingTasks
  const report = useMemo(() => buildReport({ deals, stages, companies, people, tasks }), [companies, deals, people, stages, tasks])

  return (
    <CrmPage wide>
      <ObjectWorkspaceHeader
        object="Reports"
        title="Operating report"
        description="Pipeline health, execution risk, relationship coverage, and CRM data quality in one calm workspace. This is the owner view every SME CRM needs."
        actions={<>
          <CrmButton href="/deals" tone="primary"><BarChart3 size={16} /> Open deals</CrmButton>
          <CrmButton onClick={() => askHalvex('Give me an executive CRM operating report: pipeline, stale deals, overdue tasks, data quality gaps, and the next three actions.') }><Bot size={16} /> Ask Halvex</CrmButton>
        </>}
        stats={<>
          <CrmStat label="Open pipeline" value={money(report.openValue)} />
          <CrmStat label="Win-weighted" value={money(report.weightedValue)} />
          <CrmStat label="At risk" value={report.atRisk.length} />
          <CrmStat label="Data quality" value={`${report.qualityScore}%`} />
        </>}
      />

      <WorkspaceBriefing items={[
        { label: 'JTBD', title: 'Know where revenue stands', text: 'Owners need an immediate read on pipeline value, stage concentration, likely closers, and weak records.' },
        { label: 'Competitor parity', title: 'Report without spreadsheet work', text: 'HubSpot, Pipedrive, Attio, and Notion CRM setups all offer views into activity, pipeline, tasks, and data quality. Halvex brings that into one CRM-native report.' },
        { label: 'AI assist', title: 'Turn diagnosis into action', text: 'Halvex can explain risk, list missing fields, suggest follow-ups, and convert recommendations into tasks from the record workflow.' },
      ]} />

      <div className="crm-report-grid">
        <CrmPanel className="crm-report-main">
          <CrmSectionHeader title="Pipeline by stage" description="Where open value sits today. Use this to spot stuck value, thin stages, and over-optimistic close plans." action={<CrmButton href="/deals?view=pipeline">Pipeline</CrmButton>} />
          {loading ? <CrmSkeleton rows={5} /> : report.stageRows.length ? (
            <div className="crm-report-stage-list">
              {report.stageRows.map(stage => (
                <article key={stage.id} className="crm-report-stage-row">
                  <div>
                    <strong>{stage.name}</strong>
                    <p>{stage.count} deal{stage.count === 1 ? '' : 's'} · {money(stage.value)}</p>
                  </div>
                  <div className="crm-report-bar"><span style={{ width: `${stage.share}%` }} /></div>
                  <small>{stage.share}%</small>
                </article>
              ))}
            </div>
          ) : <CrmEmpty title="No pipeline yet">Create deals to start reporting on pipeline health.</CrmEmpty>}
        </CrmPanel>

        <CrmPanel>
          <CrmSectionHeader title="CRM health" description="The everyday quality checks that make a CRM trustworthy." />
          {loading ? <CrmSkeleton rows={4} /> : (
            <div className="crm-health-checks">
              <HealthCheck icon={<TrendingUp size={16} />} label="Open deals with value" value={report.valueCoverage} />
              <HealthCheck icon={<ListChecks size={16} />} label="Open deals with next step" value={report.nextStepCoverage} />
              <HealthCheck icon={<Database size={16} />} label="Companies with domain" value={report.companyCoverage} />
              <HealthCheck icon={<CheckCircle2 size={16} />} label="People with company" value={report.peopleCoverage} />
            </div>
          )}
        </CrmPanel>
      </div>

      <div className="crm-report-grid lower">
        <CrmPanel>
          <CrmSectionHeader title="Attention queue" description="Deals and tasks that need owner judgement before the forecast is trusted." action={<CrmButton href="/tasks">Tasks</CrmButton>} />
          {loading ? <CrmSkeleton rows={5} /> : report.attention.length ? (
            <div className="crm-stack">
              {report.attention.map(item => (
                <Link key={item.id} href={item.href} className="crm-report-attention-row">
                  <span>{item.kind}</span>
                  <div>
                    <strong><ClampedText lines={1}>{item.title}</ClampedText></strong>
                    <p><ClampedText lines={2}>{item.reason}</ClampedText></p>
                  </div>
                  {item.risk ? <CrmRiskBadge risk={item.risk} /> : <CrmBadge tone={item.tone ?? 'neutral'}>{item.badge}</CrmBadge>}
                </Link>
              ))}
            </div>
          ) : <CrmEmpty title="No urgent work">No at-risk deals, stale activity, or overdue work is visible from current CRM data.</CrmEmpty>}
        </CrmPanel>

        <CrmPanel>
          <CrmSectionHeader title="AI operating read" description="Evidence-based recommendations that stay advisory until a user acts." action={<CrmButton onClick={() => askHalvex('What are the top CRM risks and what should I do next? Include evidence and suggested tasks.')}>Analyse</CrmButton>} />
          {loading ? <CrmSkeleton rows={4} /> : (
            <div className="crm-report-ai-list">
              <AiRead title="Forecast confidence" text={report.forecastRead} action="Open the weakest high-value records and confirm close date, buyer, and next step." />
              <AiRead title="Data quality" text={report.dataRead} action="Complete missing value, close date, company domain, and stakeholder fields before relying on reports." />
              <AiRead title="Execution" text={report.executionRead} action="Convert stale or missing next steps into dated tasks owned by the seller." />
            </div>
          )}
        </CrmPanel>
      </div>

      <CrmPanel>
        <CrmSectionHeader title="CRM jobs covered" description="A practical coverage map for the jobs a small business expects from a modern CRM." />
        <div className="crm-jtbd-grid">
          {[
            ['Capture records', 'Companies, people, deals, manual notes, tasks, and quick-create flows.'],
            ['Progress pipeline', 'Deal list, pipeline board, stages, value, close dates, probability, owners, next steps, and risk.'],
            ['Manage relationships', 'Company and person records with linked context and relationship notes.'],
            ['Execute work', 'Task board, overdue/upcoming views, linked records, completion, snooze, and cancel actions.'],
            ['Understand performance', 'Pipeline value, weighted value, stage distribution, data quality, and attention queue.'],
            ['Use AI safely', 'On-demand analysis, missing buyer info, note extraction, follow-up drafts, evidence, confidence, and user-controlled actions.'],
          ].map(([title, text]) => <article key={title}><strong>{title}</strong><p>{text}</p></article>)}
        </div>
      </CrmPanel>
    </CrmPage>
  )
}

function HealthCheck({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  const tone = value >= 75 ? 'good' : value >= 45 ? 'warn' : 'danger'
  return (
    <article className="crm-health-check">
      <span>{icon}</span>
      <div>
        <strong>{value}%</strong>
        <p>{label}</p>
      </div>
      <CrmBadge tone={tone}>{tone === 'good' ? 'Healthy' : tone === 'warn' ? 'Review' : 'Weak'}</CrmBadge>
    </article>
  )
}

function AiRead({ title, text, action }: { title: string; text: string; action: string }) {
  return (
    <article className="crm-report-ai-read">
      <small>{title}</small>
      <p>{text}</p>
      <strong>{action}</strong>
    </article>
  )
}

function buildReport({ deals, stages, companies, people, tasks }: { deals: any[]; stages: any[]; companies: any[]; people: any[]; tasks: any[] }) {
  const now = Date.now()
  const staleCutoff = now - 14 * 86_400_000
  const openDeals = deals.filter(deal => !['won', 'lost', 'archived'].includes(deal.status))
  const openValue = openDeals.reduce((sum, deal) => sum + Number(deal.valueAmount ?? 0), 0)
  const weightedValue = openDeals.reduce((sum, deal) => sum + Number(deal.valueAmount ?? 0) * (Number(deal.probability ?? 0) / 100), 0)
  const atRisk = openDeals.filter(deal => deal.aiRiskLevel === 'high' || (deal.aiScore ?? 50) < 45)
  const staleDeals = openDeals.filter(deal => !deal.lastActivityAt || new Date(deal.lastActivityAt).getTime() < staleCutoff)
  const missingNext = openDeals.filter(deal => !deal.aiNextAction && !deal.nextStepDueAt)
  const overdueTasks = tasks.filter(task => task.dueAt && new Date(task.dueAt).getTime() < now)
  const valueCoverage = pct(openDeals.filter(deal => Number(deal.valueAmount ?? 0) > 0).length, openDeals.length)
  const nextStepCoverage = pct(openDeals.filter(deal => deal.aiNextAction || deal.nextStepDueAt).length, openDeals.length)
  const companyCoverage = pct(companies.filter(company => company.domain).length, companies.length)
  const peopleCoverage = pct(people.filter(person => person.companyName || person.companyId).length, people.length)
  const qualityScore = Math.round((valueCoverage + nextStepCoverage + companyCoverage + peopleCoverage) / 4) || 0
  const maxStageValue = Math.max(1, ...stages.map(stage => openDeals.filter(deal => deal.stageId === stage.id).reduce((sum, deal) => sum + Number(deal.valueAmount ?? 0), 0)))
  const stageRows = stages.map(stage => {
    const stageDeals = openDeals.filter(deal => deal.stageId === stage.id)
    const value = stageDeals.reduce((sum, deal) => sum + Number(deal.valueAmount ?? 0), 0)
    return { id: stage.id, name: stage.name, count: stageDeals.length, value, share: Math.max(4, Math.round((value / maxStageValue) * 100)) }
  }).filter(stage => stage.count || stage.value)
  const attention: AttentionItem[] = [
    ...atRisk.slice(0, 4).map(deal => ({ id: `risk-${deal.id}`, kind: 'Deal', title: deal.title, reason: deal.intelligence?.riskDrivers?.[0] ?? 'Deal is showing elevated risk.', href: `/deals/${deal.id}`, risk: deal.aiRiskLevel })),
    ...missingNext.slice(0, 3).map(deal => ({ id: `next-${deal.id}`, kind: 'Next step', title: deal.title, reason: 'Open deal has no saved next step or dated task.', href: `/deals/${deal.id}`, badge: 'Missing', tone: 'warn' as const })),
    ...staleDeals.slice(0, 3).map(deal => ({ id: `stale-${deal.id}`, kind: 'Stale', title: deal.title, reason: 'No activity in at least 14 days.', href: `/deals/${deal.id}`, badge: 'Stale', tone: 'warn' as const })),
    ...overdueTasks.slice(0, 3).map(task => ({ id: `task-${task.id}`, kind: 'Task', title: task.title, reason: `Overdue${task.dealTitle ? ` · ${task.dealTitle}` : ''}${task.companyName ? ` · ${task.companyName}` : ''}.`, href: task.dealId ? `/deals/${task.dealId}` : '/tasks?view=overdue', badge: 'Overdue', tone: 'danger' as const })),
  ].slice(0, 8)

  return {
    openValue,
    weightedValue,
    atRisk,
    stageRows,
    attention,
    qualityScore,
    valueCoverage,
    nextStepCoverage,
    companyCoverage,
    peopleCoverage,
    forecastRead: openDeals.length ? `${openDeals.length} open deals represent ${money(openValue)} of pipeline, with ${money(weightedValue)} weighted by probability. ${atRisk.length} deal${atRisk.length === 1 ? '' : 's'} need risk review.` : 'No open pipeline yet. Create deals before using forecast reporting.',
    dataRead: `Data quality is ${qualityScore}%. Value coverage ${valueCoverage}%, next-step coverage ${nextStepCoverage}%, company domain coverage ${companyCoverage}%, people-company coverage ${peopleCoverage}%.`,
    executionRead: overdueTasks.length || missingNext.length ? `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'} and ${missingNext.length} open deal${missingNext.length === 1 ? '' : 's'} without a next step need action.` : 'No overdue tasks or missing next steps are visible in current CRM data.',
  }
}

function pct(count: number, total: number) {
  if (!total) return 0
  return Math.round((count / total) * 100)
}

function askHalvex(query: string) {
  window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query } }))
}
