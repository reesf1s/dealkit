'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { DealLog } from '@/types'

interface DealTableProps {
  deals: DealLog[]
  onAdd?: () => void
  onDelete?: (id: string) => void
  currencySymbol?: string
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
    <span style={{
      fontSize: '11px',
      color: 'rgba(255,255,255,0.80)',
      backgroundColor: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.10)',
      padding: '2px 8px',
      borderRadius: '9999px',
      textTransform: 'capitalize',
    }}>
      {stage.replace('_', ' ')}
    </span>
  )
}

function SortIcon({ field, active, direction }: { field: string; active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) return <ChevronUp size={12} style={{ color: '#d1d1d6' }} />
  return direction === 'asc'
    ? <ChevronUp size={12} style={{ color: 'rgba(255,255,255,0.80)' }} />
    : <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.80)' }} />
}

export function DealTable({ deals, onAdd, onDelete, currencySymbol = '£' }: DealTableProps) {
  const router = useRouter()
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
      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', alignItems: 'center' }}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              height: '30px',
              padding: '0 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: filter === tab.key ? 600 : 500,
              color: filter === tab.key ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.45)',
              backgroundColor: filter === tab.key ? 'rgba(255,255,255,0.06)' : 'transparent',
              border: filter === tab.key ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => {
              if (filter !== tab.key) {
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)'
                ;(e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'
              }
            }}
            onMouseLeave={e => {
              if (filter !== tab.key) {
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'
                ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
              }
            }}
          >
            {tab.label}
          </button>
        ))}
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.30)', lineHeight: '30px', marginLeft: '8px' }}>
          {sorted.length} deal{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 2px 20px rgba(0,0,0,0.40)',
      }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 120px 1fr 120px 110px 110px 120px 32px', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { label: 'Deal / Prospect', field: 'dealName' as SortField },
            { label: 'Company', field: 'prospectCompany' as SortField },
            { label: 'Outcome', field: 'stage' as SortField },
            { label: 'Competitor', field: null },
            { label: 'Value', field: null },
            { label: 'Contract Start', field: null },
            { label: 'Contract End', field: null },
            { label: 'Date', field: 'createdAt' as SortField },
          ].map(({ label, field }) => (
            <button
              key={label}
              onClick={() => field && toggleSort(field)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.30)',
                letterSpacing: '0.07em', textTransform: 'uppercase',
                background: 'none', border: 'none',
                cursor: field ? 'pointer' : 'default',
                padding: 0, textAlign: 'left',
                transition: 'color 0.12s',
              }}
              onMouseEnter={e => { if (field) (e.currentTarget as HTMLElement).style.color = '#6e6e73' }}
              onMouseLeave={e => { if (field) (e.currentTarget as HTMLElement).style.color = '#aeaeb2' }}
            >
              {label}
              {field && <SortIcon field={field} active={sortField === field} direction={sortDir} />}
            </button>
          ))}
          <div />
        </div>

        {/* Data rows */}
        {sorted.map((deal, i) => (
          <div
            key={deal.id}
            onClick={() => router.push(`/deals/${deal.id}`)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 120px 1fr 120px 110px 110px 120px 32px',
              padding: '13px 18px',
              borderBottom: i < sorted.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              alignItems: 'center',
              transition: 'background 0.12s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              setHoveredId(deal.id)
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
            }}
            onMouseLeave={(e) => {
              setHoveredId(null)
              setConfirmId(null)
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            {/* Deal name */}
            <div>
              <p style={{
                fontSize: '13px', fontWeight: 600,
                color: hoveredId === deal.id ? 'rgba(255,255,255,0.90)' : '#e2e8f0',
                margin: 0, marginBottom: '1px',
                transition: 'color 0.12s ease',
              }}>{deal.dealName}</p>
              {deal.prospectName && (
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                  {deal.prospectName}{deal.prospectTitle ? `, ${deal.prospectTitle}` : ''}
                </p>
              )}
            </div>

            {/* Company */}
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>{deal.prospectCompany}</span>

            {/* Outcome */}
            <div>{stageBadge(deal.stage)}</div>

            {/* Competitor */}
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {deal.competitors.length > 0 ? deal.competitors.join(', ') : '—'}
            </span>

            {/* Value */}
            <span style={{ fontSize: '13px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
              {deal.dealValue != null ? `${currencySymbol}${deal.dealValue.toLocaleString()}` : '—'}
            </span>

            {/* Contract Start */}
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', fontVariantNumeric: 'tabular-nums' }}>
              {formatDate((deal as any).contractStartDate)}
            </span>

            {/* Contract End */}
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', fontVariantNumeric: 'tabular-nums' }}>
              {formatDate((deal as any).contractEndDate)}
            </span>

            {/* Date */}
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', fontVariantNumeric: 'tabular-nums' }}>
              {formatDate(deal.createdAt)}
            </span>

            {/* Delete */}
            <div style={{ display: 'flex', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
              {onDelete && hoveredId === deal.id && (
                confirmId === deal.id ? (
                  <button
                    onClick={() => { onDelete(deal.id); setConfirmId(null) }}
                    style={{
                      fontSize: '10px', fontWeight: 600, color: '#fff',
                      backgroundColor: '#ef4444',
                      border: '1px solid rgba(239,68,68,0.40)',
                      borderRadius: '5px', padding: '2px 7px',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    Confirm
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmId(deal.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.30)', padding: '3px',
                      display: 'flex', alignItems: 'center', borderRadius: '5px',
                      transition: 'color 0.12s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.30)' }}
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
