'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { Plus, UsersRound } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ButtonV2, EmptyStateV2, HeroPanel, PanelV2, SectionHeader, shortDate } from '@/components/v2/V2DesignSystem'

export const dynamic = 'force-dynamic'

export default function PeoplePage() {
  const { data, isLoading } = useSWR('/api/crm/contacts', fetcher, { revalidateOnFocus: false })
  const people = data?.data ?? []

  return (
    <div className="v2-page">
      <HeroPanel
        eyebrow="People"
        title="People"
        actions={<><ButtonV2 tone="dark"><Plus size={16} /> Add person</ButtonV2><ButtonV2 href="/companies">Companies</ButtonV2></>}
        aside={<div className="v2-glass-card"><strong>People drive deals</strong><span>Meetings, notes, emails, and tasks should attach to the humans involved.</span></div>}
      >
        Who you are talking to, what they care about, and what the next touch should be.
      </HeroPanel>

      <PanelV2>
        <SectionHeader title="People" icon={<UsersRound size={18} />}>
          Contacts are relationship records, not rows in a spreadsheet.
        </SectionHeader>
        {isLoading ? <EmptyStateV2 title="Loading people">Reading contact records.</EmptyStateV2> : null}
        {!isLoading && !people.length ? <EmptyStateV2 title="No people yet" action={<ButtonV2 href="/settings?section=imports" tone="dark">Import people</ButtonV2>}>Import contacts or connect Calendar to match meeting attendees.</EmptyStateV2> : null}
        <div className="v2-grid-3">
          {people.map((person: any) => (
            <Link key={person.id} href={`/people/${person.id}`} className="v2-person-card">
              <div className="v2-card-icon"><UsersRound size={16} /></div>
              <div>
                <strong>{person.fullName}</strong>
                <p>{person.jobTitle ?? 'Role missing'} · {person.companyName ?? 'No company linked'}</p>
                <span className="v2-source">{person.lastContactedAt ? `Last touch ${shortDate(person.lastContactedAt)}` : 'No recent touch'}</span>
              </div>
            </Link>
          ))}
        </div>
      </PanelV2>
    </div>
  )
}
