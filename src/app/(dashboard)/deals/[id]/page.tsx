'use client'

import useSWR from 'swr'
import { useParams } from 'next/navigation'
import { Bot, CalendarDays, MailPlus, RefreshCw, Sparkles } from 'lucide-react'
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
        subtitle={deal.aiSummary || 'Add recent context and Halvex will keep the deal brief, risks, and next action current.'}
        meta={(
          <>
            <RiskBadge risk={concerns.risk ?? deal.aiRiskLevel} />
            <ConfidenceBadge value={concerns.confidence ?? deal.aiConfidence} />
            {context.company?.id ? <ObjectLinkChip href={`/companies/${context.company.id}`}>{context.company.name ?? 'Company'}</ObjectLinkChip> : null}
          </>
        )}
        actions={(
          <>
            <ButtonV2 tone="dark" onClick={() => document.getElementById('add-update')?.scrollIntoView({ behavior: 'smooth' })}><Sparkles size={16} /> Add update</ButtonV2>
            <ButtonV2 onClick={() => {
              window.dispatchEvent(new CustomEvent('openHalvexAssistant', { detail: { query: `Summarise ${deal.title}` } }))
            }}><Bot size={16} /> Ask Halvex</ButtonV2>
            <ButtonV2><MailPlus size={16} /> Draft follow-up</ButtonV2>
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
          <InlineEditableField label="Next action" value={deal.aiNextAction ?? ''} onSave={value => updateField('aiNextAction', value)} />
        </div>
      </PanelV2>

      <div className="v2-grid-2">
        <div className="v2-page">
          <PanelV2>
            <SectionHeader title="AI deal brief" icon={<Bot size={18} />}>
              A short answer to what happened, what it means, and what to do next.
            </SectionHeader>
            <div className="v2-brief">
              <p>{deal.aiSummary || 'Context is limited. Add an update, meeting note, email, or task to generate a stronger brief.'}</p>
              <div className="v2-deal-facts">
                <span>{money(deal.valueAmount)}</span>
                <span>{shortDate(deal.expectedCloseDate) ?? 'Close date missing'}</span>
                <span>{deal.stageName ?? 'Stage missing'}</span>
              </div>
            </div>
          </PanelV2>

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
          <IntelligencePanel deal={{ ...deal, aiRiskLevel: concerns.risk ?? deal.aiRiskLevel, aiConfidence: concerns.confidence ?? deal.aiConfidence }} signals={context.signals ?? []} reasons={concerns.reasons} />
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
              Refresh deterministic signals after a material update.
            </SectionHeader>
            <ButtonV2 onClick={refresh} tone="dark"><RefreshCw size={16} /> Recalculate intelligence</ButtonV2>
          </PanelV2>
        </div>
      </div>
    </div>
  )
}

function trustReasons(context: any) {
  const deal = context?.deal
  if (!deal) return { reasons: [] as string[], risk: null as string | null, confidence: null as number | null }
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
