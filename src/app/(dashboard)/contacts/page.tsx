'use client'
export const dynamic = 'force-dynamic'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Building2, Search, UserRound, Users, UserSquare2 } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { OperatorHeader, OperatorKpi, OperatorPage } from '@/components/shared/OperatorUI'

interface Contact {
  id: string
  name: string
  title: string | null
  company: string
  dealId: string
  dealName: string
  dealStage: string
  dealValue: number | null
  email: string | null
  phone: string | null
  source: 'primary' | 'secondary'
  updatedAt: string
}

function stageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function stagePill(stage: string): string {
  switch (stage) {
    case 'negotiation': return 'rgba(251, 113, 133, 0.2)'
    case 'proposal': return 'rgba(251, 191, 36, 0.2)'
    case 'discovery': return 'rgba(167, 139, 250, 0.2)'
    case 'qualification': return 'rgba(96, 165, 250, 0.2)'
    case 'closed_won': return 'rgba(74, 222, 128, 0.2)'
    case 'closed_lost': return 'rgba(251, 113, 133, 0.2)'
    default: return 'rgba(148, 163, 184, 0.2)'
  }
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - +new Date(iso)) / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function hasSeniority(title: string | null): boolean {
  if (!title) return false
  return /(head|director|vp|chief|cfo|ceo|cto|coo|founder|owner)/i.test(title)
}

export default function ContactsPage() {
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<'all' | 'open' | 'closed'>('open')

  const { data: contactsRes, isLoading } = useSWR<{ data: Contact[] }>('/api/contacts', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const contacts = contactsRes?.data ?? []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    return contacts
      .filter(contact => {
        if (stageFilter === 'open' && ['closed_won', 'closed_lost'].includes(contact.dealStage)) return false
        if (stageFilter === 'closed' && !['closed_won', 'closed_lost'].includes(contact.dealStage)) return false

        if (!q) return true
        return (
          contact.name.toLowerCase().includes(q) ||
          contact.company.toLowerCase().includes(q) ||
          (contact.title ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
  }, [contacts, query, stageFilter])

  const openAccounts = new Set(contacts.filter(c => !['closed_won', 'closed_lost'].includes(c.dealStage)).map(c => c.company)).size
  const staleContacts = contacts.filter(c => (Date.now() - +new Date(c.updatedAt)) / 86_400_000 >= 30).length
  const seniorCoverage = contacts.filter(c => hasSeniority(c.title)).length

  return (
    <OperatorPage>
      <OperatorHeader
        eyebrow="Relationship Coverage"
        title="Enterprise contact map"
        description="See stakeholder coverage across active deals and spot relationship decay before it costs momentum."
      />

      <section className="contacts-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {[
          { label: 'Contacts', value: String(contacts.length), sub: 'Unique stakeholders', icon: Users },
          { label: 'Open Accounts', value: String(openAccounts), sub: 'Companies with active opportunities', icon: Building2 },
          { label: 'Senior Stakeholders', value: String(seniorCoverage), sub: 'Director+ coverage', icon: UserSquare2 },
          { label: 'Stale Relationships', value: String(staleContacts), sub: 'No update in 30+ days', icon: UserRound },
        ].map(card => (
          <OperatorKpi key={card.label} label={card.label} value={card.value} sub={card.sub} icon={card.icon} />
        ))}
      </section>

      <section className="notion-panel" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, borderRadius: 9, border: '1px solid var(--border-default)', padding: '0 10px', background: 'var(--surface-2)', minWidth: 220 }}>
            <Search size={13} style={{ color: 'var(--text-tertiary)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search name, title, or company"
              style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            />
          </div>

          <div style={{ display: 'inline-flex', gap: 6, marginLeft: 'auto' }}>
            {([
              { id: 'open', label: 'Open Deals' },
              { id: 'all', label: 'All' },
              { id: 'closed', label: 'Closed' },
            ] as const).map(item => {
              const active = stageFilter === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setStageFilter(item.id)}
                  style={{
                    height: 32,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: active ? '1px solid var(--brand-border)' : '1px solid var(--border-default)',
                    background: active ? 'var(--brand-bg)' : 'var(--surface-2)',
                    color: active ? 'var(--brand)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 840 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 160px 1fr 110px 90px',
                gap: 8,
                padding: '8px 10px',
                borderBottom: '1px solid var(--border-default)',
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-tertiary)',
              }}
            >
              <div>Contact</div>
              <div>Deal Stage</div>
              <div>Account / Deal</div>
              <div>Source</div>
              <div style={{ textAlign: 'right' }}>Updated</div>
            </div>

            {isLoading ? (
              <div className="skeleton" style={{ height: 220, borderRadius: 10, marginTop: 8 }} />
            ) : filtered.length === 0 ? (
              <div style={{ padding: '30px 14px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                No contacts match this view.
              </div>
            ) : (
              filtered.map(contact => (
                <Link key={contact.id} href={`/deals/${contact.dealId}`} style={{ textDecoration: 'none' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 160px 1fr 110px 90px',
                      gap: 8,
                      padding: '11px 10px',
                      borderBottom: '1px solid var(--border-subtle)',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {contact.name}
                      </div>
                      <div style={{ marginTop: 1, fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {contact.title ?? 'No title captured'}
                      </div>
                    </div>

                    <div>
                      <span
                        style={{
                          fontSize: 10.5,
                          padding: '2px 7px',
                          borderRadius: 999,
                          background: stagePill(contact.dealStage),
                          color: 'var(--text-primary)',
                          fontWeight: 700,
                        }}
                      >
                        {stageLabel(contact.dealStage)}
                      </span>
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {contact.company}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {contact.dealName}
                      </div>
                    </div>

                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{contact.source}</div>

                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>{relativeTime(contact.updatedAt)}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 1120px) {
          .contacts-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 760px) {
          .contacts-kpis { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </OperatorPage>
  )
}
