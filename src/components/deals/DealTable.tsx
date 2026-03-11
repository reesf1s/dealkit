'use client'

import { useState } from 'react'
import { FileText, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { DealLog } from '@/types'

interface DealTableProps {
  deals: DealLog[]
  onAdd?: () => void
  onDelete?: (id: string) => void
}

type SortField = 'dealName' | 'stage' | 'prospectCompany' | 'createdAt'
type FilterOutcome = 'all' | 'won' | 'lost' | 'open'

function formatDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function stageBadge(stage: string) {
  if (stage === 'closed_won') return <StatusBadge status="won" />
  if (stage === 'closed_lost') return <StatusBadge status="lost" />
  return (
    <span style={{ fontSize: '11px', color: '#888', backgroundColor: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '9999px', textTransform: 'capitalize' }}>
      {stage.replace('_', ' ')}
    </span>
  )
}

function SortIcon({ field, active, direction }: { field: string; active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) return <ChevronUp size={12} style={{ color: '#333' }} />
  return direction === 'asc' ? <ChevronUp size={12} style={{ color: '#6366F1' }} /> : <ChevronDown size={12} style={{ color: '#6366F1' }} />
}

export function DealTable({ deals, onAdd, onDelete }: DealTableProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filter, setFilter] = useState<FilterOutcome>('all')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const filtered = deals.filter((d) => {
    if (filter === 'won') return d.stage === 'closed_won'
    if (filter === 'lost') return d.stage === 'closed_lost'
    if (filter === 'open') return d.stage !== 'closed_won' && d.stage !== 'closed_lost'
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let valA: string | number = ''
    let valB: string | number = ''

    if (sortField === 'dealName') { valA = a.dealName; valB = b.dealName }
    else if (sortField === 'stage') { valA = a.stage; valB = b.stage }
    else if (sortField === 'prospectCompany') { valA = a.prospectCompany; valB = b.prospectCompany }
    else if (sortField === 'createdAt') {
      valA = new Date(a.createdAt).getTime()
      valB = new Date(b.createdAt).getTime()
    }

    if (valA < valB) return sortDir === 'asc' ? -1 : 1
    if (valA > valB) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  if (deals.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No deals logged"
        description="Start logging won and lost deals to track win rates and uncover patterns."
        action={onAdd ? { label: 'Log your first deal', onClick: onAdd } : undefined}
      />
    )
  }

  const FILTER_TABS: { key: FilterOutcome; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'won', label: 'Won' },
    { key: 'lost', label: 'Lost' },
    { key: 'open', label: 'Open' },
  ]

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              height: '28px',
              padding: '0 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              color: filter === tab.key ? '#EBEBEB' : '#888',
              backgroundColor: filter === tab.key ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: filter === tab.key ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            {tab.label}
          </button>
        ))}
        <span style={{ fontSize: '12px', color: '#555', lineHeight: '28px', marginLeft: '8px' }}>
          {sorted.length} deal{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 120px 1fr 120px 120px 32px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { label: 'Deal / Prospect', field: 'dealName' as SortField },
            { label: 'Company', field: 'prospectCompany' as SortField },
            { label: 'Outcome', field: 'stage' as SortField },
            { label: 'Competitor', field: null },
            { label: 'Value', field: null },
            { label: 'Date', field: 'createdAt' as SortField },
          ].map(({ label, field }) => (
            <button
              key={label}
              onClick={() => field && toggleSort(field)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#555', letterSpacing: '0.05em', textTransform: 'uppercase', background: 'none', border: 'none', cursor: field ? 'pointer' : 'default', padding: 0, textAlign: 'left' }}
            >
              {label}
              {field && <SortIcon field={field} active={sortField === field} direction={sortDir} />}
            </button>
          ))}
          <div />
        </div>

        {/* Data rows */}
        {sorted.map((deal) => (
          <div
            key={deal.id}
            style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 120px 1fr 120px 120px 32px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', transition: 'background-color 100ms ease' }}
            onMouseEnter={() => setHoveredId(deal.id)}
            onMouseLeave={() => { setHoveredId(null); setConfirmId(null) }}
          >
            {/* Deal name */}
            <div>
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#EBEBEB', margin: 0, marginBottom: '1px' }}>{deal.dealName}</p>
              {deal.prospectName && (
                <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>{deal.prospectName}{deal.prospectTitle ? `, ${deal.prospectTitle}` : ''}</p>
              )}
            </div>

            {/* Company */}
            <span style={{ fontSize: '13px', color: '#888' }}>{deal.prospectCompany}</span>

            {/* Outcome */}
            <div>{stageBadge(deal.stage)}</div>

            {/* Competitor */}
            <span style={{ fontSize: '12px', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {deal.competitors.length > 0 ? deal.competitors.join(', ') : '—'}
            </span>

            {/* Value */}
            <span style={{ fontSize: '13px', color: '#888', fontVariantNumeric: 'tabular-nums' }}>
              {deal.dealValue != null ? `$${deal.dealValue.toLocaleString()}` : '—'}
            </span>

            {/* Date */}
            <span style={{ fontSize: '12px', color: '#555', fontVariantNumeric: 'tabular-nums' }}>
              {formatDate(deal.createdAt)}
            </span>

            {/* Delete */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {onDelete && hoveredId === deal.id && (
                confirmId === deal.id ? (
                  <button
                    onClick={() => { onDelete(deal.id); setConfirmId(null) }}
                    style={{ fontSize: '10px', fontWeight: 600, color: '#fff', backgroundColor: '#ef4444', border: 'none', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Confirm
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmId(deal.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '2px', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'color 100ms' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#555' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
