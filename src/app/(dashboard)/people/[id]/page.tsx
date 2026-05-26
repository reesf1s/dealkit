'use client'

import useSWR from 'swr'
import { useParams } from 'next/navigation'
import { MailPlus, Plus, UsersRound } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ActionCard, ButtonV2, EmptyStateV2, PanelV2, RecordHero, SectionHeader } from '@/components/v2/V2DesignSystem'

export const dynamic = 'force-dynamic'

export default function PersonPage() {
  const params = useParams<{ id: string }>()
  const { data, isLoading } = useSWR('/api/crm/contacts', fetcher, { revalidateOnFocus: false })
  const person = (data?.data ?? []).find((item: any) => item.id === params.id)

  if (isLoading) return <EmptyStateV2 title="Loading person">Reading relationship memory.</EmptyStateV2>
  if (!person) return <EmptyStateV2 title="Person not found">This contact may not exist in this workspace.</EmptyStateV2>

  return (
    <div className="v2-page">
      <RecordHero
        eyebrow="Person"
        title={person.fullName}
        subtitle={`${person.jobTitle ?? 'Role unknown'}${person.companyName ? ` at ${person.companyName}` : ''}. Use this page to keep relationship context attached to the right person.`}
        actions={<><ButtonV2 tone="dark"><Plus size={16} /> Add note</ButtonV2><ButtonV2><MailPlus size={16} /> Draft email</ButtonV2></>}
      />

      <div className="v2-grid-2">
        <PanelV2>
          <SectionHeader title="Relationship summary" icon={<UsersRound size={18} />}>
            Halvex should explain what they care about, recent conversations, open asks, and next best action.
          </SectionHeader>
          <ActionCard title="Relationship memory is thin" reason="Add meeting notes or connect email/calendar context to build a useful summary." source="AI context" />
        </PanelV2>
        <PanelV2>
          <SectionHeader title="Actions">
            Keep updates attached to the person, company, and deal where possible.
          </SectionHeader>
          <div className="v2-stack">
            <ActionCard title="Create deal" reason="Start an opportunity connected to this person." />
            <ActionCard title="Link to company" reason={person.companyName ? `Already linked to ${person.companyName}.` : 'No company is linked yet.'} />
            <ActionCard title="Ask Halvex" reason="Ask about this person's history, tone, or next touch." />
          </div>
        </PanelV2>
      </div>
    </div>
  )
}
