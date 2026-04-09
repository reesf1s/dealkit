'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  MessageSquare, Search, FileText, ChevronRight, ArrowUpRight,
  Mail, Pencil,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Note {
  id: string
  dealId: string
  dealName: string
  prospectCompany: string
  stage: string
  date: string
  content: string
  source: string
}

type SourceFilter = 'all' | 'manual' | 'email'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function stageFmt(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function stageColor(stage: string): string {
  switch (stage) {
    case 'negotiation': case 'closed_won': return '#1DB86A'
    case 'proposal': return '#f59e0b'
    case 'closed_lost': return '#ef4444'
    case 'discovery': return '#8b5cf6'
    case 'qualified': case 'qualification': return '#3b82f6'
    default: return '#aaa'
  }
}

function sourceIcon(source: string) {
  if (source === 'email') return <Mail size={11} style={{ color: 'var(--text-tertiary)' }} />
  return <Pencil size={11} style={{ color: 'var(--text-tertiary)' }} />
}

function Skeleton() {
  return <div style={{ height: 90, borderRadius: 8 }} className="skeleton" />
}

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({ note }: { note: Note }) {
  const [expanded, setExpanded] = useState(false)
  const preview = note.content.length > 180 && !expanded
    ? note.content.slice(0, 180).trim() + '…'
    : note.content

  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--border-default)',
      borderRadius: 8,
      padding: '14px 16px',
      transition: 'border-color 80ms',
    }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {note.dealName}
            </span>
            <span style={{
              fontSize: 10.5, fontWeight: 500,
              color: stageColor(note.stage),
              background: `${stageColor(note.stage)}15`,
              borderRadius: 99, padding: '1px 6px',
              flexShrink: 0,
            }}>
              {stageFmt(note.stage)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{note.prospectCompany}</span>
            {note.date && (
              <>
                <span style={{ fontSize: 11, color: 'var(--border-default)' }}>·</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtDate(note.date)}</span>
              </>
            )}
            <span style={{ fontSize: 11, color: 'var(--border-default)' }}>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {sourceIcon(note.source)}
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{note.source}</span>
            </span>
          </div>
        </div>
        <Link
          href={`/deals/${note.dealId}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: '#1DB86A', textDecoration: 'none',
            padding: '3px 8px', borderRadius: 5,
            background: 'rgba(29,184,106,0.07)', border: '1px solid rgba(29,184,106,0.16)',
            flexShrink: 0, marginLeft: 8,
          }}
        >
          Open <ArrowUpRight size={10} />
        </Link>
      </div>

      {/* Content */}
      <p style={{
        fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6,
        margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {preview}
      </p>
      {note.content.length > 180 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 11.5, color: '#1DB86A', padding: '4px 0 0', fontWeight: 500,
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

  const { data, isLoading } = useSWR('/api/notes', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })
  const notes: Note[] = data?.data ?? []

  const filtered = notes.filter(n => {
    if (sourceFilter !== 'all' && n.source !== sourceFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        n.dealName.toLowerCase().includes(q) ||
        n.prospectCompany.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      )
    }
    return true
  })

  const tabs: Array<{ key: SourceFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'manual', label: 'Manual' },
    { key: 'email', label: 'Email' },
  ]

  return (
    <div style={{ paddingTop: 8 }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: 0 }}>
            Conversations
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '3px 0 0', letterSpacing: '-0.01em' }}>
            Meeting notes and conversations across all your deals.
          </p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {filtered.length} note{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Search + Filter Row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface-2)', border: '1px solid var(--border-default)', borderRadius: 7,
          padding: '0 12px', height: 34,
        }}>
          <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes, deals, companies…"
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 13, color: '#1a1a1a',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSourceFilter(tab.key)}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                cursor: 'pointer',
                border: sourceFilter === tab.key ? '1px solid var(--border-default)' : '1px solid transparent',
                background: sourceFilter === tab.key ? 'var(--surface-1)' : 'transparent',
                color: sourceFilter === tab.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                transition: 'all 80ms',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes List */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(5)].map((_, i) => <Skeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 0',
          border: '1px solid var(--border-subtle)', borderRadius: 10,
          background: 'var(--surface-2)',
        }}>
          <MessageSquare size={24} style={{ color: 'var(--text-muted)', display: 'block', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {search ? 'No matching notes' : 'No notes yet'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 16 }}>
            {search
              ? 'Try a different search term'
              : 'Add meeting notes to your deals to see them here'}
          </div>
          {!search && (
            <Link href="/deals" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12.5, fontWeight: 500, color: '#1DB86A', textDecoration: 'none',
              padding: '7px 16px', background: 'rgba(29,184,106,0.08)',
              border: '1px solid rgba(29,184,106,0.2)', borderRadius: 7,
            }}>
              <FileText size={12} />
              Go to Deals
              <ChevronRight size={11} />
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(note => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  )
}
