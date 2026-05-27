'use client'

import useSWR from 'swr'
import { useParams } from 'next/navigation'
import { Bot, CalendarDays, CheckCircle2, EyeOff, MailPlus, RefreshCw, Sparkles } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import {
  AddUpdateComposer,
  ButtonV2,
  ConfidenceBadge,
  EmptyStateV2,
  InlineEditableField,
  IntelligencePanel,
  money,
  ObjectLinkChip,
  PanelV2,
  RecordHero,
  RiskBadge,
  SectionHeader,
  shortDate,
  TimelineV2,
} from '@/components/v2/V2DesignSystem'

export const dynamic = 'force-dynamic'

export default function DealWorkspacePage() {
  const params = useParams<{ id: string }>()
  const { data, isLoading, mutate } = useSWR(params?.id ? `/api/crm/deals/${params.id}` : null, fetcher, { revalidateOnFocus: false })
  const context = data?.data
  const deal = context?.deal
  const concerns = trustReasons(context)
  const intelligence = context?.intelligence
  const displaySummary = intelligence?.summary || deal?.aiSummary
  const displayNextAction = intelligence?.nextAction || deal?.aiNextAction

  async function updateField(field: string, value: string) {
    await fetch(`/api/crm/deals/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    mutate()
  }

  async function refresh() {
    await fetch(`/api/crm/deals/${params.id}`, { method: 'POST' })
    mutate()
  }

  if (isLoading) return <EmptyStateV2 title="Loading deal workspace">Reading deal memory, timeline, and intelligence.</EmptyStateV2>
  if (!deal) return <EmptyStateV2 title="Deal not found">This deal may no longer exist or you may not have access.</EmptyStateV2>

  return (
    <div className="v2-page">
      <RecordHero
        eyebrow="Deal workspace"
        title={deal.title}
        subtitle={compactHeroInsight(displaySummary || intelligence?.nextAction || deal?.aiNextAction) || 'Add recent context and Halvex will keep the deal brief, risks, and next action current.'}
        meta={(
          <>
            <RiskBadge risk={intelligence?.riskLevel ?? concerns.risk ?? deal.aiRiskLevel} />
            <ConfidenceBadge value={intelligence?.confidence ?? concerns.confidence ?? deal.aiConfidence} />
            {context.company?.id ? <ObjectLinkChip href={`/companies/${context.company.id}`}>{context.company.name ?? 'Company'}</ObjectLinkChip> : null}
          </>
        )}
        actions={(
          <>
            <ButtonV2 tone="dark" onClick={() => document.getElementById('add-update')?.scrollIntoView({ behavior: 'smooth' })}><Sparkles size={16} /> Add update</ButtonV2>
            <ButtonV2 onClick={() => {
              window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `Summarise ${deal.title}`, dealId: deal.id } }))
            }}><Bot size={16} /> Ask Halvex</ButtonV2>
            <ButtonV2 onClick={() => {
              window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `Draft a concise follow-up for ${deal.title}`, dealId: deal.id } }))
            }}><MailPlus size={16} /> Draft follow-up</ButtonV2>
          </>
        )}
      />

      <PanelV2>
        <SectionHeader title="Editable deal facts">
          Update the deal directly here. Natural-language updates live below and can propose changes before saving.
        </SectionHeader>
        <div className="v2-grid-3">
          <InlineEditableField label="Value" value={deal.valueAmount ? String(deal.valueAmount) : ''} type="number" onSave={value => updateField('valueAmount', value)} />
          <InlineEditableField label="Close date" value={deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().slice(0, 10) : ''} type="date" onSave={value => updateField('expectedCloseDate', value)} />
          <InlineEditableField label="Next action" value={displayNextAction ?? ''} onSave={value => updateField('aiNextAction', value)} />
        </div>
      </PanelV2>

      <div className="v2-grid-2">
        <div className="v2-page">
          <PanelV2>
            <SectionHeader title="AI deal brief" icon={<Bot size={18} />}>
              A short answer to what happened, what it means, and what to do next.
            </SectionHeader>
            <div className="v2-brief">
              <p>{displaySummary || 'Context is limited. Add an update, meeting note, email, or task to generate a stronger brief.'}</p>
              {intelligence?.latestEvidence ? (
                <div className="v2-evidence-callout">
                  <strong>Latest useful evidence</strong>
                  <span>{intelligence.latestEvidence.text}</span>
                </div>
              ) : null}
              <div className="v2-deal-facts">
                <span>{money(deal.valueAmount)}</span>
                <span>{shortDate(deal.expectedCloseDate) ?? 'Close date missing'}</span>
                <span>{deal.stageName ?? 'Stage missing'}</span>
              </div>
            </div>
          </PanelV2>

          <IntelligenceReliability context={context} />

          <div id="add-update">
            <AddUpdateComposer dealId={deal.id} onSaved={mutate} />
          </div>

          <PanelV2>
            <SectionHeader title="Timeline">
              Meeting notes, imports, tasks, AI suggestions, and field changes become the evidence layer.
            </SectionHeader>
            <TimelineV2 items={context.latestActivities ?? []} />
          </PanelV2>
        </div>

        <div className="v2-page">
          <IntelligencePanel
            deal={{
              ...deal,
              aiScore: intelligence?.score ?? deal.aiScore,
              aiRiskLevel: intelligence?.riskLevel ?? concerns.risk ?? deal.aiRiskLevel,
              aiConfidence: intelligence?.confidence ?? concerns.confidence ?? deal.aiConfidence,
            }}
            signals={context.signals ?? []}
            reasons={concerns.reasons}
          />
          <PanelV2>
            <SectionHeader title="Next meetings" icon={<CalendarDays size={18} />} action={<ButtonV2 href="/calendar">Calendar</ButtonV2>}>
              Calendar context keeps the deal memory current.
            </SectionHeader>
            <div className="v2-stack">
              {(context.meetings ?? []).slice(0, 3).map((meeting: any) => (
                <div key={meeting.id} className="v2-action-card">
                  <div className="v2-card-icon"><CalendarDays size={16} /></div>
                  <div><strong>{meeting.title}</strong><p>{shortDate(meeting.startsAt) ?? 'No date'} · Prep from linked CRM context.</p></div>
                </div>
              ))}
              {!(context.meetings ?? []).length ? <EmptyStateV2 title="No linked meetings">Connect Calendar or attach a meeting from Inbox.</EmptyStateV2> : null}
            </div>
          </PanelV2>
          <PanelV2>
            <SectionHeader title="Recalculate" icon={<RefreshCw size={18} />}>
              Refresh signals after a material update, completed task, or newly linked meeting.
            </SectionHeader>
            <ButtonV2 onClick={refresh} tone="dark"><RefreshCw size={16} /> Recalculate intelligence</ButtonV2>
          </PanelV2>
        </div>
      </div>
    </div>
  )
}

function IntelligenceReliability({ context }: { context: any }) {
  const intelligence = context?.intelligence
  const evidence = intelligence?.evidence ?? []
  const ignored = intelligence?.ignoredEvidence ?? []
  const missing = intelligence?.missingData ?? []
  const steps = intelligence?.inferenceSteps ?? []
  const hasOverdueTaskSignal = (intelligence?.riskDrivers ?? []).some((reason: string) => /next action is overdue/i.test(reason))
  const improvementActions = [
    missing.includes('No substantive timeline evidence yet') ? 'Add a recent meeting note or customer email so Halvex has something real to reason from.' : null,
    missing.includes('No next action recorded') ? 'Set a dated next action, or create a follow-up task from the update composer.' : null,
    missing.includes('Value is missing') ? 'Add deal value so pipeline and score confidence are not guessing.' : null,
    missing.includes('Close date is missing') ? 'Add the expected close date so timing risk can be judged honestly.' : null,
    hasOverdueTaskSignal ? 'Complete or reschedule overdue tasks so old actions do not keep dragging this deal into Home priorities.' : null,
  ].filter(Boolean) as string[]

  return (
    <PanelV2>
      <SectionHeader title="How Halvex inferred this" icon={<Sparkles size={18} />}>
        A reliability check for the brief, score, confidence, and risk. This keeps legacy imports and generic edits from pretending to be fresh sales evidence.
      </SectionHeader>
      <div className="v2-reliability-grid">
        <div className="v2-reliability-card">
          <strong><CheckCircle2 size={16} /> Evidence used</strong>
          {evidence.length ? evidence.slice(0, 3).map((item: any) => (
            <p key={item.id}>{item.title}: {truncate(item.text, 180)}</p>
          )) : <p>No substantive timeline evidence is available yet.</p>}
        </div>
        <div className="v2-reliability-card muted">
          <strong><EyeOff size={16} /> Evidence ignored</strong>
          {ignored.length ? ignored.slice(0, 3).map((item: any) => (
            <p key={item.id}>{item.title}: {item.reason}</p>
          )) : <p>No generic or empty timeline rows were ignored.</p>}
        </div>
      </div>
      <div className="v2-inference-steps">
        {steps.map((step: string, index: number) => <p key={`${step}-${index}`}>{step}</p>)}
      </div>
      <div className="v2-improve-box">
        <strong>To improve the intelligence</strong>
        {improvementActions.length ? improvementActions.map((action: string, index: number) => (
          <span key={`${action}-${index}`}>{action}</span>
        )) : <span>The core deal facts are present. Add a fresh customer update when something changes.</span>}
      </div>
    </PanelV2>
  )
}

function truncate(value: string, max: number) {
  if (!value || value.length <= max) return value
  return `${value.slice(0, max - 3).trim()}...`
}

function compactHeroInsight(value?: string | null) {
  if (!value) return ''
  const cleaned = String(value)
    .replace(/^Latest evidence:\s*/i, '')
    .replace(/^Meaning:\s*/i, '')
    .replace(/^Next:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  return truncate(sentences.slice(0, 2).join(' '), 190)
}

function trustReasons(context: any) {
  const deal = context?.deal
  if (!deal) return { reasons: [] as string[], risk: null as string | null, confidence: null as number | null }
  if (context.intelligence) {
    const reasons = [
      ...(context.intelligence.riskDrivers ?? []),
      ...(context.intelligence.missingData ?? []).map((item: string) => `${item}, so confidence stays limited.`),
      ...(context.intelligence.positiveSignals ?? []).slice(0, 2).map((item: string) => `Positive signal: ${item}`),
    ].slice(0, 6)
    return {
      reasons,
      risk: context.intelligence.riskLevel,
      confidence: context.intelligence.confidence,
    }
  }
  const evidence = [
    deal.aiSummary,
    deal.aiNextAction,
    ...(context.latestActivities ?? []).flatMap((activity: any) => [activity.title, activity.summary, activity.body]),
    ...(context.signals ?? []).map((signal: any) => signal.explanation),
  ].filter(Boolean).join(' ').toLowerCase()

  const reasons: string[] = []
  if (!deal.valueAmount || deal.valueAmount <= 0) reasons.push('Value is missing, so forecast confidence stays limited.')
  if (!deal.expectedCloseDate) reasons.push('Close date is missing, so timing confidence stays limited.')
  if (!deal.aiNextAction && !(context.openTasks ?? []).length) reasons.push('No next action is recorded.')
  if (/(blocked|blocker|concern|procurement|legal|compliance|security|disagree|alignment|uncertain|issue|risk|delay)/.test(evidence)) {
    reasons.push('Recent evidence contains unresolved concern or blocker language.')
  }
  const confidence = reasons.length ? Math.min(deal.aiConfidence ?? 55, 68) : deal.aiConfidence
  const risk = reasons.length && deal.aiRiskLevel === 'low' ? 'medium' : null
  return { reasons, confidence, risk }
}
