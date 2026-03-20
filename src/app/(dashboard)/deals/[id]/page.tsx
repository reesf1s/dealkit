'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowLeft, Sparkles, Square, Plus, Target, Loader2,
  Clipboard, Banknote, Calendar,
  User, UserPlus, Edit, Trash2, CheckCircle, X, Link2, Check,
  Mail, Sword, Zap, Layers,
  Globe, FileText, Database, BookOpen, Github, Cloud,
  ExternalLink, ChevronDown, ChevronRight, PenTool,
  TrendingUp, ArrowUpRight, RefreshCw,
  FileCheck, BarChart2, File,
  ArrowUp, ArrowDown
} from 'lucide-react'
import type { DealContact, DealLink as DealLinkType, DealLinkType as LinkTypeEnum } from '@/types'
import { useSidebar } from '@/components/layout/SidebarContext'
import { getScoreColor, getScoreDisplay } from '@/lib/deal-context'

// ─── Signal highlighting helper ──────────────────────────────────────────────

const POSITIVE_SIGNALS: string[] = [
  'excited', 'committed', 'moving forward', 'approved', 'agreed', 'confirmed',
  'ready to', 'champion', 'sponsor', 'budget approved', 'budget allocated',
  'high priority', 'top priority', 'green light', 'sign off', 'signed off',
  'go ahead', 'great fit', 'love it', 'impressed', 'strong fit',
  'reference call', 'eager', 'enthusiastic', 'very interested',
  'contract signed', 'contracts signed', 'signed contract', 'fully executed',
  'purchase order', 'po issued', 'po received',
]

const NEGATIVE_SIGNALS: string[] = [
  'budget freeze', 'budget cut', 'no budget', 'not sure', 'reconsidering',
  'delay', 'postpone', 'no decision', 'on hold', 'not a priority',
  'too expensive', 'cost concern', 'roi unclear', 'no response', 'ghosted',
  'gone quiet', 'not responding', 'going with another', 'pushback',
  'blocker', 'legal hold', 'lost', 'cancelled', 'walking away',
  'no longer interested', 'competitor chosen',
]

const URGENCY_SIGNALS: string[] = [
  'urgent', 'asap', 'immediately', 'end of quarter', 'end of year',
  'eoy', 'eoq', 'deadline', 'must go live', 'launch date', 'go-live',
  'this month', 'this quarter', 'time sensitive', 'hard deadline',
]

const PRODUCT_GAP_KEYWORDS: string[] = [
  "gap", "missing", "doesn't have", "does not have", "wish", "would need",
  "lacks", "no feature", "feature request", "can't do", "cannot do",
]

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightSignals(text: string, competitors: string[]): string {
  let result = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const applyHighlight = (words: string[], cls: string) => {
    for (const word of words) {
      const pattern = new RegExp(`(${escapeRegex(word)})`, 'gi')
      result = result.replace(pattern, `<mark style="background:var(--highlight-${cls}-bg,#dcfce7);color:var(--highlight-${cls}-text,#166534);border-radius:2px;padding:0 2px">$1</mark>`)
    }
  }

  applyHighlight(POSITIVE_SIGNALS, 'positive')

  for (const word of NEGATIVE_SIGNALS) {
    const pattern = new RegExp(`(${escapeRegex(word)})`, 'gi')
    result = result.replace(pattern, `<mark style="background:#fee2e2;color:#991b1b;border-radius:2px;padding:0 2px">$1</mark>`)
  }

  for (const word of URGENCY_SIGNALS) {
    const pattern = new RegExp(`(${escapeRegex(word)})`, 'gi')
    result = result.replace(pattern, `<mark style="background:#fef3c7;color:#92400e;border-radius:2px;padding:0 2px">$1</mark>`)
  }

  for (const competitor of competitors) {
    if (!competitor.trim()) continue
    const pattern = new RegExp(`(${escapeRegex(competitor.trim())})`, 'gi')
    result = result.replace(pattern, `<mark style="background:#dbeafe;color:#1e40af;border-radius:2px;padding:0 2px">$1</mark>`)
  }

  for (const word of PRODUCT_GAP_KEYWORDS) {
    const pattern = new RegExp(`(${escapeRegex(word)})`, 'gi')
    result = result.replace(pattern, `<mark style="background:#fef3c7;color:#92400e;border-radius:2px;padding:0 2px">$1</mark>`)
  }

  return result
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ─── Workspace members hook ─────────────────────────────────────────────────

interface WorkspaceMember {
  id: string
  userId: string
  email: string
  role: string
}

function useWorkspaceMembers() {
  const { data } = useSWR<{ data: WorkspaceMember[] }>('/api/workspaces/members', fetcher)
  return data?.data ?? []
}

// ─── Assignee helpers ───────────────────────────────────────────────────────

function getInitials(name: string): string {
  if (!name) return '?'
  if (name.includes('@')) {
    return name.split('@')[0][0]?.toUpperCase() ?? '?'
  }
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0][0]?.toUpperCase() ?? '?'
}

function getDisplayName(assignee: string): string {
  if (!assignee) return ''
  if (assignee.includes('@')) return assignee.split('@')[0]
  return assignee
}

// ─── AssigneePicker component ───────────────────────────────────────────────

function AssigneePill({ assignee, onClick, size = 'sm' }: { assignee?: string; onClick: () => void; size?: 'sm' | 'md' }) {
  const isSm = size === 'sm'
  if (!assignee) {
    return (
      <button
        onClick={e => { e.stopPropagation(); onClick() }}
        style={{
          background: 'none', border: '1px dashed var(--border)', borderRadius: '12px',
          padding: isSm ? '1px 6px' : '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px',
          color: 'var(--text-tertiary)', fontSize: isSm ? '10px' : '11px', flexShrink: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)' }}
        title="Assign"
      >
        <UserPlus size={isSm ? 10 : 11} />
      </button>
    )
  }
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{
        background: 'var(--accent-subtle)', border: 'none', borderRadius: '12px',
        padding: isSm ? '1px 8px 1px 2px' : '2px 10px 2px 3px', cursor: 'pointer', display: 'flex',
        alignItems: 'center', gap: '4px', flexShrink: 0,
      }}
      title={assignee}
    >
      <div style={{
        width: isSm ? 16 : 18, height: isSm ? 16 : 18, borderRadius: '50%',
        background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: isSm ? '8px' : '9px', fontWeight: 700,
      }}>
        {getInitials(assignee)}
      </div>
      <span style={{ fontSize: isSm ? '10px' : '11px', color: 'var(--accent)', fontWeight: 500, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {getDisplayName(assignee)}
      </span>
    </button>
  )
}

function AssigneeDropdown({
  currentAssignee,
  members,
  onAssign,
  onClose,
  anchorRef,
}: {
  currentAssignee?: string
  members: WorkspaceMember[]
  onAssign: (assignee: string | null) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLDivElement | null>
}) {
  const [customName, setCustomName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleEscape) }
  }, [onClose, anchorRef])

  const filteredMembers = customName.trim()
    ? members.filter(m => m.email.toLowerCase().includes(customName.toLowerCase()))
    : members

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute', top: '100%', right: 0, marginTop: '4px', zIndex: 100,
        background: 'var(--card-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)', borderRadius: '10px', padding: '6px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)', minWidth: '220px', maxHeight: '280px', overflowY: 'auto',
      }}
    >
      <form onSubmit={e => { e.preventDefault(); if (customName.trim()) { onAssign(customName.trim()); onClose() } }}>
        <input
          ref={inputRef}
          value={customName}
          onChange={e => setCustomName(e.target.value)}
          placeholder="Type a name or email..."
          style={{
            width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)',
            borderRadius: '6px', padding: '6px 8px', color: 'var(--text-primary)',
            fontSize: '12px', outline: 'none', boxSizing: 'border-box', marginBottom: '4px',
          }}
          onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--accent)'}
          onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--border)'}
        />
      </form>

      {customName.trim() && !members.some(m => m.email.toLowerCase() === customName.toLowerCase().trim()) && (
        <button
          onClick={() => { onAssign(customName.trim()); onClose() }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px',
            background: 'none', border: 'none', borderRadius: '6px', cursor: 'pointer',
            color: 'var(--accent)', fontSize: '12px', textAlign: 'left',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
        >
          <UserPlus size={12} />
          <span>Assign to &quot;{customName.trim()}&quot;</span>
        </button>
      )}

      {filteredMembers.length > 0 && (
        <div style={{ borderTop: customName.trim() ? '1px solid var(--border)' : 'none', paddingTop: customName.trim() ? '4px' : 0, marginTop: customName.trim() ? '2px' : 0 }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 8px 2px' }}>
            Workspace Members
          </div>
          {filteredMembers.map(m => (
            <button
              key={m.userId}
              onClick={() => { onAssign(m.email); onClose() }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px',
                background: currentAssignee === m.email ? 'var(--accent-subtle)' : 'none',
                border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => { if (currentAssignee !== m.email) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)' }}
              onMouseLeave={e => { if (currentAssignee !== m.email) (e.currentTarget as HTMLElement).style.background = 'none' }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: currentAssignee === m.email ? 'var(--accent)' : 'var(--surface-hover)',
                color: currentAssignee === m.email ? '#fff' : 'var(--text-secondary)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, flexShrink: 0,
              }}>
                {getInitials(m.email)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email.split('@')[0]}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </div>
              </div>
              {currentAssignee === m.email && <Check size={12} color="var(--accent)" />}
            </button>
          ))}
        </div>
      )}

      {currentAssignee && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '4px', marginTop: '4px' }}>
          <button
            onClick={() => { onAssign(null); onClose() }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px',
              background: 'none', border: 'none', borderRadius: '6px', cursor: 'pointer',
              color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'left',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
          >
            <X size={12} />
            <span>Unassign</span>
          </button>
        </div>
      )}
    </div>
  )
}

function AssigneePicker({
  assignee,
  members,
  onAssign,
  size = 'sm',
}: {
  assignee?: string
  members: WorkspaceMember[]
  onAssign: (assignee: string | null) => void
  size?: 'sm' | 'md'
}) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={anchorRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <AssigneePill assignee={assignee} onClick={() => setOpen(v => !v)} size={size} />
      {open && (
        <AssigneeDropdown
          currentAssignee={assignee}
          members={members}
          onAssign={onAssign}
          onClose={() => setOpen(false)}
          anchorRef={anchorRef}
        />
      )}
    </div>
  )
}

const STAGE_COLORS: Record<string, string> = {
  prospecting: 'var(--text-tertiary)', qualification: '#3B82F6', discovery: '#8B5CF6',
  proposal: 'var(--warning)', negotiation: 'var(--danger)', closed_won: 'var(--success)', closed_lost: 'var(--text-tertiary)',
}

/** Read-only panel showing emails/notes pulled from HubSpot on the last sync. */
function HubSpotActivityBlock({ deal, dealCompetitors }: { deal: any; dealCompetitors: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const raw: string = deal?.hubspotNotes ?? ''
  if (!raw.trim()) return null

  // Split on double-newline before a [date] marker
  const blocks = raw.split(/\n\n(?=\[)/).map((b: string) => b.trim()).filter(Boolean)

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={13} color="#FF7A59" />
          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-tertiary)' }}>HubSpot Activity</span>
          <span style={{ fontSize: '11px', color: '#FF7A59', background: 'rgba(255,122,89,0.1)', borderRadius: '4px', padding: '1px 6px', fontWeight: 600 }}>
            {blocks.length} entr{blocks.length === 1 ? 'y' : 'ies'}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>· updates on every sync</span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{expanded ? 'Hide ↑' : 'Show ↓'}</span>
      </button>
      {expanded && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '380px', overflowY: 'auto' }}>
          {blocks.map((entry: string, i: number) => {
            const dateMatch = entry.match(/^\[([^\]]+)\]/)
            const date = dateMatch?.[1] ?? ''
            const body = entry.slice(dateMatch?.[0].length ?? 0).trim()
            return (
              <div key={i} style={{ padding: '9px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                {date && (
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#FF7A59', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>{date}</div>
                )}
                <div
                  style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
                  dangerouslySetInnerHTML={{ __html: highlightSignals(body, dealCompetitors) }}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MeetingNotesTab({ dealId, deal, onUpdate, onSwitchToPrep }: { dealId: string; deal: any; onUpdate: () => void; onSwitchToPrep?: () => void }) {
  const dealCompetitors: string[] = deal?.competitors ?? []
  const { sendToCopilot } = useSidebar()
  const [updateText, setUpdateText] = useState('')
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  // AI memory correction
  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')
  const [resetAIConfirm, setResetAIConfirm] = useState(false)
  const [savingAI, setSavingAI] = useState(false)
  // Extraction confirmation state
  const [analysing, setAnalysing] = useState(false)
  const [lastExtraction, setLastExtraction] = useState<{ extraction: any; analysedAt: string } | null>(null)
  const [verifyingExtraction, setVerifyingExtraction] = useState(false)

  const patchDeal = async (payload: Record<string, unknown>) => {
    setSavingAI(true)
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      onUpdate()
    } finally {
      setSavingAI(false)
    }
  }

  const deleteRisk = (index: number) => {
    const current: string[] = deal?.dealRisks ?? []
    patchDeal({ dealRisks: current.filter((_: string, i: number) => i !== index) })
  }

  const deleteInsight = (index: number) => {
    const current: string[] = deal?.conversionInsights ?? []
    patchDeal({ conversionInsights: current.filter((_: string, i: number) => i !== index) })
  }

  const saveSummary = () => {
    patchDeal({ aiSummary: summaryDraft.trim() || null })
    setEditingSummary(false)
  }

  const resetAllAI = async () => {
    // conversionScorePinned: false — ensure pin is cleared so AI can re-score after reset
    await patchDeal({ aiSummary: null, conversionScore: null, conversionScorePinned: false, conversionInsights: [], dealRisks: [] })
    setResetAIConfirm(false)
  }

  const clearNotes = async () => {
    setClearing(true)
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingNotes: null }),
      })
      setClearConfirm(false)
      setHistoryExpanded(false)
      onUpdate()
    } finally {
      setClearing(false)
    }
  }

  // Direct note analysis — calls analyze-notes API and shows extraction confirmation card
  const analyseNotes = async () => {
    if (!updateText.trim()) return
    setAnalysing(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/analyze-notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingNotes: updateText.trim() }),
      })
      const json = await res.json()
      if (json.data) {
        const extraction = json.data.parsed
        // Try to read the note_signals_json from updated deal
        const signals = json.data.deal?.note_signals_json
          ? (typeof json.data.deal.note_signals_json === 'string' ? JSON.parse(json.data.deal.note_signals_json) : json.data.deal.note_signals_json)
          : null
        setLastExtraction({ extraction: { ...extraction, signals }, analysedAt: new Date().toISOString() })
        setUpdateText('')
        onUpdate()
      }
    } finally {
      setAnalysing(false)
    }
  }

  // Mark extraction as verified
  const confirmExtraction = async () => {
    if (!lastExtraction) return
    setVerifyingExtraction(true)
    try {
      // Store user_verified: true in note_signals_json
      const existing = deal?.note_signals_json
        ? (typeof deal.note_signals_json === 'string' ? JSON.parse(deal.note_signals_json) : deal.note_signals_json)
        : {}
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_signals_json: JSON.stringify({ ...existing, user_verified: true }) }),
      })
      setLastExtraction(null)
      onUpdate()
    } finally {
      setVerifyingExtraction(false)
    }
  }

  // Delete a single entry from the structured history
  const deleteEntry = async (entryIndex: number) => {
    if (!deal?.meetingNotes) return
    const blocks = (deal.meetingNotes as string).split(/\n---\n/).map((b: string) => b.trim()).filter(Boolean)
    const entries = blocks.filter((b: string) => /^\[/.test(b))
    const legacy = blocks.filter((b: string) => !/^\[/.test(b))
    const updatedEntries = entries.filter((_: string, i: number) => i !== entryIndex)
    const updated = [...legacy, ...updatedEntries].join('\n---\n') || null
    await fetch(`/api/deals/${dealId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingNotes: updated }),
    })
    onUpdate()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Empty state — no notes yet */}
      {!deal?.meetingNotes && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '12px', padding: '32px 24px',
          background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: '14px',
          textAlign: 'center',
        }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clipboard size={18} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>No meeting notes yet</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: '340px' }}>
              Paste your first meeting note or transcript below to get AI-powered insights, risk detection, and action items.
            </div>
          </div>
        </div>
      )}

      {/* Previous meeting history */}
      {deal?.meetingNotes && (() => {
        // Parse entries separated by --- with [date] headers
        const raw = (deal.meetingNotes as string)
        const blocks = raw.split(/\n---\n/).map((b: string) => b.trim()).filter(Boolean)
        const entries = blocks.filter((b: string) => /^\[/.test(b))
        const legacy = blocks.filter((b: string) => !/^\[/.test(b))
        return (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
            <button
              onClick={() => setHistoryExpanded(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clipboard size={13} color="var(--text-tertiary)" />
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-tertiary)' }}>Meeting History</span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--surface-hover)', borderRadius: '4px', padding: '1px 6px' }}>
                  {entries.length > 0 ? `${entries.length} meeting${entries.length > 1 ? 's' : ''}` : 'legacy notes'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {clearConfirm ? (
                  <>
                    <span style={{ fontSize: '11px', color: 'var(--danger)' }}>Clear all notes?</span>
                    <button
                      onClick={e => { e.stopPropagation(); clearNotes() }}
                      disabled={clearing}
                      style={{ fontSize: '11px', color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '2px 8px', borderRadius: '5px', cursor: 'pointer' }}
                    >{clearing ? 'Clearing…' : 'Yes, clear'}</button>
                    <button
                      onClick={e => { e.stopPropagation(); setClearConfirm(false) }}
                      style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >Cancel</button>
                  </>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setClearConfirm(true) }}
                    style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px' }}
                    title="Clear all notes for this deal"
                  >Clear all</button>
                )}
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{historyExpanded ? 'Hide ↑' : 'Show ↓'}</span>
              </div>
            </button>
            {historyExpanded && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
                {entries.length > 0 ? entries.map((entry: string, i: number) => {
                  const dateMatch = entry.match(/^\[([^\]]+)\]/)
                  const date = dateMatch?.[1] ?? ''
                  const body = entry.slice(dateMatch?.[0].length ?? 0).trim()
                  return (
                    <div key={i} style={{ padding: '9px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', position: 'relative' }}
                      onMouseEnter={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.entry-del') as HTMLElement | null; if (btn) btn.style.opacity = '1' }}
                      onMouseLeave={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.entry-del') as HTMLElement | null; if (btn) btn.style.opacity = '0' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{date}</div>
                        <button
                          className="entry-del"
                          onClick={() => deleteEntry(i)}
                          style={{ opacity: 0, fontSize: '10px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', borderRadius: '3px', transition: 'opacity 0.15s' }}
                          title="Remove this entry"
                        >✕ remove</button>
                      </div>
                      <div
                        style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}
                        dangerouslySetInnerHTML={{ __html: highlightSignals(body, dealCompetitors) }}
                      />
                    </div>
                  )
                }) : (
                  <div
                    style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: '1.7', margin: 0 }}
                    dangerouslySetInnerHTML={{ __html: highlightSignals(legacy.join('\n'), dealCompetitors) }}
                  />
                )}
              </div>
            )}
          </div>
        )
      })()}

      <HubSpotActivityBlock deal={deal} dealCompetitors={deal?.competitors ?? []} />

      {/* Add update */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Sparkles size={13} color="var(--accent)" />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {deal?.meetingNotes ? 'Add Update' : 'Log First Update'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>· AI extracts signals automatically</span>
        </div>
        <textarea
          value={updateText}
          onChange={e => setUpdateText(e.target.value)}
          placeholder="Paste meeting notes or describe what happened — AI will extract signals, risks, and next steps."
          rows={6}
          style={{
            width: '100%', resize: 'vertical', background: 'var(--input-bg)',
            border: '1px solid var(--border)', borderRadius: '8px',
            color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.6',
            padding: '12px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              analyseNotes()
            }
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => {
              if (!updateText.trim()) return
              sendToCopilot(`Update for ${deal?.prospectCompany ?? 'this deal'}:\n\n${updateText.trim()}`)
              setUpdateText('')
            }}
            disabled={!updateText.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 12px', borderRadius: '7px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500',
              cursor: updateText.trim() ? 'pointer' : 'not-allowed', opacity: updateText.trim() ? 1 : 0.5,
            }}
          >
            <Sparkles size={11} />
            Ask AI copilot
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>⌘↵ to analyse</span>
            <button
              onClick={analyseNotes}
              disabled={!updateText.trim() || analysing}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px',
                background: updateText.trim() && !analysing ? 'linear-gradient(135deg, #6366F1, #7C3AED)' : 'var(--surface)',
                border: updateText.trim() && !analysing ? 'none' : '1px solid var(--border)',
                color: updateText.trim() && !analysing ? '#fff' : 'var(--text-tertiary)',
                fontSize: '13px', fontWeight: '600', cursor: updateText.trim() && !analysing ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              {analysing ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Analysing…</> : <><Zap size={12} /> Analyse Notes</>}
            </button>
          </div>
        </div>
      </div>

      {/* Extraction confirmation card — shown after analyse-notes returns */}
      {lastExtraction && (() => {
        const ex = lastExtraction.extraction
        const signals = ex.signals
        const champStatus = ex.intentSignals?.championStatus ?? (signals?.champion_signal ? 'confirmed' : 'none')
        const budgetStatus = ex.intentSignals?.budgetStatus ?? signals?.budget_signal ?? 'not_mentioned'
        const timeline = ex.intentSignals?.decisionTimeline ?? signals?.decision_timeline ?? null
        const nextStep = signals?.next_step ?? null
        const competitors = (ex.competitors ?? []).length > 0 ? ex.competitors : (signals?.competitors_mentioned ?? [])
        const objections = signals?.objections ?? []
        const gaps = ex.productGaps ?? []
        const sentiment = signals?.sentiment_score ?? null
        const champLabel = champStatus === 'confirmed' ? '✓ Confirmed' : champStatus === 'suspected' ? '~ Likely' : '— Not detected'
        const champColor = champStatus === 'confirmed' ? 'var(--success)' : champStatus === 'suspected' ? 'var(--warning)' : 'var(--text-tertiary)'
        const budgetLabel = budgetStatus === 'approved' ? '✓ Confirmed' : budgetStatus === 'awaiting' ? '~ Awaiting approval' : budgetStatus === 'blocked' ? '⚠ Blocked' : '— Not discussed'
        const budgetColor = budgetStatus === 'approved' ? 'var(--success)' : budgetStatus === 'blocked' ? 'var(--danger)' : budgetStatus === 'awaiting' ? 'var(--warning)' : 'var(--text-tertiary)'
        return (
          <div style={{ background: 'color-mix(in srgb, var(--accent) 5%, var(--card-bg))', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <CheckCircle size={14} color="var(--accent)" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Note analysed</span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>— {new Date(lastExtraction.analysedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <button onClick={() => setLastExtraction(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '12px', padding: '2px 6px' }}>✕</button>
            </div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Extracted signals</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Champion</span>
                <span style={{ color: champColor, fontWeight: '600' }}>{champLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Budget</span>
                <span style={{ color: budgetColor, fontWeight: '600' }}>{budgetLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Timeline</span>
                <span style={{ color: timeline ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: '600' }}>{timeline ?? '— Not mentioned'}</span>
              </div>
              {nextStep && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Next step</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600', maxWidth: '200px', textAlign: 'right' }}>&ldquo;{nextStep}&rdquo;</span>
                </div>
              )}
              {competitors.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Competitors</span>
                  <span style={{ color: '#3B82F6', fontWeight: '600' }}>{competitors.join(', ')}</span>
                </div>
              )}
              {objections.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Objections</span>
                  <span style={{ color: 'var(--warning)', fontWeight: '600' }}>{objections.map((o: any) => o.theme).join(', ')} ({objections.length})</span>
                </div>
              )}
              {gaps.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Product gaps</span>
                  <span style={{ color: 'var(--danger)', fontWeight: '600' }}>{gaps.map((g: any) => g.title).join(', ')}</span>
                </div>
              )}
              {sentiment !== null && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Sentiment</span>
                  <span style={{ color: sentiment >= 0.6 ? 'var(--success)' : sentiment <= 0.4 ? 'var(--danger)' : 'var(--warning)', fontWeight: '600' }}>
                    {sentiment >= 0.6 ? 'Positive' : sentiment <= 0.4 ? 'Negative' : 'Neutral'} ({sentiment.toFixed(2)})
                  </span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={confirmExtraction}
                disabled={verifyingExtraction}
                style={{
                  flex: 2, padding: '8px 14px', borderRadius: '8px',
                  background: 'var(--accent)', border: 'none', color: '#fff',
                  fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                {verifyingExtraction ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><Check size={12} /> Confirm & mark verified</>}
              </button>
              <button
                onClick={() => setLastExtraction(null)}
                style={{ flex: 1, padding: '8px 14px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )
      })()}

      {/* AI Results */}
      {(deal?.aiSummary || (deal?.dealRisks as string[])?.length > 0) && (
        <div style={{ background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '16px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Sparkles size={14} color="var(--accent)" />
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent)' }}>AI Analysis</span>
            {/* Conversion score — with clear button */}
            {deal?.conversionScore != null && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '20px', fontWeight: '800', color: getScoreColor(deal.conversionScore ?? 0, false) }}>
                  {deal.conversionScore}%
                </span>
                <button
                  onClick={() => patchDeal({ conversionScore: null })}
                  title="Clear conversion score"
                  style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', lineHeight: 1 }}
                >✕</button>
              </div>
            )}
          </div>

          {/* Summary — inline editable */}
          {editingSummary ? (
            <div style={{ marginBottom: '12px' }}>
              <textarea
                value={summaryDraft}
                onChange={e => setSummaryDraft(e.target.value)}
                rows={4}
                style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--accent)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.6', padding: '10px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button onClick={saveSummary} disabled={savingAI} style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--accent-subtle)', border: '1px solid var(--accent)', borderRadius: '5px', color: 'var(--accent)', cursor: 'pointer' }}>
                  {savingAI ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditingSummary(false)} style={{ fontSize: '11px', padding: '4px 10px', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : deal?.aiSummary ? (
            <div style={{ marginBottom: '12px', position: 'relative' }}
              onMouseEnter={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.edit-summary') as HTMLElement | null; if (btn) btn.style.opacity = '1' }}
              onMouseLeave={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.edit-summary') as HTMLElement | null; if (btn) btn.style.opacity = '0' }}
            >
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0, paddingRight: '28px' }}>{deal.aiSummary}</p>
              <button
                className="edit-summary"
                onClick={() => { setSummaryDraft(deal.aiSummary); setEditingSummary(true) }}
                title="Edit AI summary"
                style={{ opacity: 0, position: 'absolute', top: 0, right: 0, fontSize: '10px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s', padding: '2px 4px' }}
              >✎ edit</button>
            </div>
          ) : null}

          {/* Insights — per-item delete (filter out score-summary insights to avoid conflicting scores) */}
          {deal?.conversionInsights?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
              {(deal.conversionInsights as string[]).filter((ins: string) => !/\d+\s*\/\s*100/i.test(ins)).map((insight: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.del-insight') as HTMLElement | null; if (btn) btn.style.opacity = '1' }}
                  onMouseLeave={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.del-insight') as HTMLElement | null; if (btn) btn.style.opacity = '0' }}
                >
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: '5px' }} />
                  <span style={{ flex: 1 }}>{insight}</span>
                  <button className="del-insight" onClick={() => deleteInsight(i)} style={{ opacity: 0, fontSize: '10px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s', padding: '0 2px' }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Risks — per-item delete */}
          {(() => {
            const risks: string[] = deal?.dealRisks ?? []
            if (!risks.length) return null
            return (
              <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ⚠ Deal Risks
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {risks.map((risk: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: 'var(--warning)' }}
                      onMouseEnter={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.del-risk') as HTMLElement | null; if (btn) btn.style.opacity = '1' }}
                      onMouseLeave={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.del-risk') as HTMLElement | null; if (btn) btn.style.opacity = '0' }}
                    >
                      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--warning)', flexShrink: 0, marginTop: '5px' }} />
                      <span style={{ flex: 1 }}>{risk}</span>
                      <button className="del-risk" onClick={() => deleteRisk(i)} style={{ opacity: 0, fontSize: '10px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s', padding: '0 2px' }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Reset all AI — nuclear option */}
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            {resetAIConfirm ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--danger)' }}>Reset all AI memory for this deal?</span>
                <button onClick={resetAllAI} disabled={savingAI} style={{ fontSize: '11px', color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '2px 8px', borderRadius: '5px', cursor: 'pointer' }}>
                  {savingAI ? 'Resetting…' : 'Yes, reset'}
                </button>
                <button onClick={() => setResetAIConfirm(false)} style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setResetAIConfirm(true)} style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Reset all AI inferences
              </button>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const STAGE_PLAYBOOK: Record<string, string[]> = {
  prospecting: [
    'Research recent news, funding rounds, and pain signals for this prospect',
    'Personalise your opening to their specific role and company context',
    'Focus on creating curiosity — avoid feature-dumping',
    'Goal: qualify fit and book a discovery call',
  ],
  qualification: [
    'Validate BANT: Budget, Authority, Need, and Timeline',
    'Ask who else is involved in the decision',
    'Identify current solution and what\'s driving them to look now',
    'Disqualify early and gracefully if not a genuine fit',
  ],
  discovery: [
    'Lead with open-ended questions — let them talk 70% of the time',
    'Map stakeholders, champions, and blockers',
    'Uncover the emotional cost of their problem, not just the functional one',
    'Confirm budget range and decision timeline before closing the call',
  ],
  proposal: [
    'Open by recapping their stated pains — show you were listening',
    'Lead with outcomes and ROI, then features as proof points',
    'Pre-handle likely objections before they surface',
    'Include a relevant win story or case study as social proof',
    'End with a clear mutual success plan and next step',
  ],
  negotiation: [
    'Know your walk-away point before entering',
    'Anchor on business value, not product features',
    'Lead concessions with non-monetary value (onboarding, success hours)',
    'Create urgency with a mutual close plan tied to their deadline',
    'Never discount without getting something in return',
  ],
  closed_won: [
    'Kick off with a success handoff to CS / implementation',
    'Confirm agreed outcomes and success metrics in writing',
    'Set a 30/60/90 day check-in cadence',
    'Ask for a referral or case study while goodwill is high',
  ],
}

// ─── Score Simulator ──────────────────────────────────────────────────────────
// Pure client-side what-if modelling: toggle signals and see how the score changes.
// Replicates computeTextSignalScore logic inline to avoid importing server-only modules.

function computeSimulatedTextScore(signals: {
  champion_identified: boolean
  budget_confirmed: boolean
  competitor_present: boolean
}): number {
  let score = 50
  if (signals.champion_identified) score += 8
  if (signals.budget_confirmed) score += 8
  if (signals.competitor_present) score -= 3
  return Math.max(0, Math.min(100, Math.round(score)))
}

function ScoreSimulator({ deal, mlPrediction, brainData }: { deal: any; mlPrediction: any; brainData: any }) {
  const baseScore: number = deal.conversionScore ?? 50

  // Detect current signal state from deal data and mlPrediction
  const detectChampion = (): boolean => {
    const stored = (deal.intentSignals as any)?.championStatus
    if (stored === 'confirmed' || stored === 'suspected') return true
    const notes: string = (deal.meetingNotes ?? '').toLowerCase()
    return /\bchampion\b|\bsponsor\b|\badvocate\b|\binternal champion\b/.test(notes)
  }
  const detectBudget = (): boolean => {
    const stored = (deal.intentSignals as any)?.budgetStatus
    if (stored === 'confirmed') return true
    const notes: string = (deal.meetingNotes ?? '').toLowerCase()
    return /budget (confirmed|approved|allocated|secured|signed off)|po raised|purchase order/.test(notes)
  }

  const [overrides, setOverrides] = useState({
    champion_identified: detectChampion(),
    budget_confirmed: detectBudget(),
    competitor_present: ((deal.competitors ?? deal.dealCompetitors ?? []) as string[]).length > 0,
  })

  const toggle = (key: keyof typeof overrides) => {
    setOverrides(o => ({ ...o, [key]: !o[key] }))
  }

  const simTextScore = computeSimulatedTextScore(overrides)

  // Compute composite: if ML active, blend with ML probability
  const mlProb = mlPrediction?.winProbability as number | undefined
  const trainingSize: number = brainData?.mlModel?.trainingSize ?? 0
  let simScore: number
  if (mlProb != null && trainingSize >= 10) {
    const mlWeight = Math.min(0.70, 0.14 * Math.log(Math.max(trainingSize, 1)))
    const momentumWeight = 0.05
    const textWeight = Math.max(0, 1.0 - mlWeight - momentumWeight)
    const momentumComponent = 50 // neutral if no override
    simScore = Math.max(0, Math.min(100, Math.round(
      simTextScore * textWeight + mlProb * 100 * mlWeight + momentumComponent * momentumWeight
    )))
  } else {
    simScore = Math.max(0, Math.min(100, Math.round(simTextScore * 0.70 + 50 * 0.25 + 50 * 0.05)))
  }

  const delta = simScore - baseScore

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    position: 'relative',
    width: '40px',
    height: '20px',
    borderRadius: '10px',
    background: active ? 'var(--accent)' : 'var(--border)',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.2s',
    padding: 0,
  })
  const knobStyle = (active: boolean): React.CSSProperties => ({
    position: 'absolute',
    top: '2px',
    left: active ? '22px' : '2px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: '#fff',
    transition: 'left 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  })

  const items = [
    { key: 'champion_identified' as const, label: 'Champion identified', inverted: false },
    { key: 'budget_confirmed' as const, label: 'Budget confirmed', inverted: false },
    { key: 'competitor_present' as const, label: 'Competitor present', inverted: true },
  ]

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Score Simulator</div>
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '14px' }}>See how toggling key signals affects this deal&apos;s score</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map(({ key, label, inverted }) => {
          const active = overrides[key]
          const isPositiveWhenOn = !inverted
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: active ? (isPositiveWhenOn ? 'var(--success)' : 'var(--danger)') : 'var(--border)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
              </div>
              <button onClick={() => toggle(key)} style={toggleStyle(active)} aria-label={`Toggle ${label}`}>
                <span style={knobStyle(active)} />
              </button>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Simulated score</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'monospace', color: getScoreColor(simScore, false), lineHeight: 1 }}>
            {simScore}%
          </span>
          {delta !== 0 && (
            <span style={{ fontSize: '12px', fontWeight: 600, color: delta > 0 ? 'var(--success)' : 'var(--danger)' }}>
              {delta > 0 ? '+' : ''}{delta}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function MeetingPrepTab({ dealId, deal, objectionWinMap = [], objectionConditionalWins = [], mlPrediction = null, brainData = null }: { dealId: string; deal: any; objectionWinMap?: any[]; objectionConditionalWins?: any[]; mlPrediction?: any; brainData?: any }) {
  const [prep, setPrep] = useState('')
  const [loading, setLoading] = useState(false)
  const [fullBriefShown, setFullBriefShown] = useState(false)

  const { data: compRes } = useSWR('/api/competitors', fetcher)
  const { data: csRes } = useSWR('/api/case-studies', fetcher)
  const { data: profileRes } = useSWR('/api/company', fetcher)

  const allCompetitors: any[] = compRes?.data ?? []
  const allCaseStudies: any[] = csRes?.data ?? []
  const profile: any = profileRes?.data

  const dealCompNames: string[] = deal?.competitors ?? []
  const matchedCompetitors = allCompetitors.filter(c =>
    dealCompNames.some((n: string) =>
      c.name.toLowerCase().includes(n.toLowerCase()) ||
      n.toLowerCase().includes(c.name.toLowerCase()),
    ),
  )

  const dealRisks: string[] = deal?.dealRisks ?? []
  const commonObjections: string[] = profile?.commonObjections ?? []
  const stage: string = deal?.stage ?? 'discovery'
  const playbook = STAGE_PLAYBOOK[stage] ?? STAGE_PLAYBOOK.discovery

  const generateFullBrief = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/meeting-prep`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      const data = await res.json()
      setPrep(data.data?.prep ?? '')
      setFullBriefShown(true)
    } finally {
      setLoading(false)
    }
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '16px',
  }
  const sectionTitle = (label: string, color = 'var(--text-secondary)') => (
    <div style={{ fontSize: '11px', fontWeight: 700, color, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '10px' }}>
      {label}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Score Simulator — only shown when deal has a score */}
      {deal.conversionScore != null && (
        <ScoreSimulator deal={deal} mlPrediction={mlPrediction} brainData={brainData} />
      )}

      {/* Stage playbook */}
      <div style={cardStyle}>
        {sectionTitle(`${stage.replace('_', ' ')} Playbook`, 'var(--accent)')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {playbook.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '10px', fontWeight: 700, color: 'var(--accent)', marginTop: '1px' }}>
                {i + 1}
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Competitive intel */}
      {matchedCompetitors.length > 0 && (
        <div style={cardStyle}>
          {sectionTitle('Competitive Intel', 'var(--warning)')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {matchedCompetitors.map(comp => (
              <div key={comp.id}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  vs {comp.name}
                </div>
                {(comp.weaknesses as string[])?.length > 0 && (
                  <div style={{ marginBottom: '5px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>Their weaknesses: </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                      {(comp.weaknesses as string[]).slice(0, 3).map((w: string, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--success)', flexShrink: 0, marginTop: '5px' }} />
                          {w}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(comp.differentiators as string[])?.length > 0 && (
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>Your differentiators: </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                      {(comp.differentiators as string[]).slice(0, 3).map((d: string, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: '5px' }} />
                          {d}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Objections you've beaten before — from closed deal history */}
      {objectionWinMap.filter((o: any) => o.winsWithTheme > 0).length > 0 && (
        <div style={cardStyle}>
          {sectionTitle('Objections You\'ve Beaten Before', 'var(--success)')}
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '10px', lineHeight: 1.5 }}>
            These objection types appeared in past deals that still closed — use this when they surface.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {objectionWinMap.filter((o: any) => o.winsWithTheme > 0).slice(0, 4).map((o: any, i: number) => {
              const color = o.winRateWithTheme >= 60 ? 'var(--success)' : o.winRateWithTheme >= 40 ? 'var(--warning)' : 'var(--danger)'
              const hasGlobal = typeof o.globalWinRate === 'number'
              const delta = hasGlobal ? o.winRateWithTheme - o.globalWinRate : 0
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: `${color}06`, border: `1px solid ${color}18`, borderRadius: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color, minWidth: '38px', textAlign: 'right', flexShrink: 0 }}>{o.winRateWithTheme}%</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>{o.theme.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                      {o.winsWithTheme}/{o.dealsWithTheme} deals closed despite this objection
                      {hasGlobal && (
                        <span style={{ marginLeft: '6px', color: delta >= 5 ? 'var(--success)' : delta <= -5 ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: 600 }}>
                          · {delta >= 5 ? `▲ ${delta}pts vs industry` : delta <= -5 ? `▼ ${Math.abs(delta)}pts vs industry` : `≈ industry avg (${o.globalWinRate}%)`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Per-objection × stage × champion conditional model */}
      {objectionConditionalWins.length > 0 && (() => {
        const currentStage: string = deal?.stage ?? ''
        // Find entries where we have data for this deal's current stage
        const relevant = objectionConditionalWins
          .map((entry: any) => {
            const sb = (entry.stageBreakdown ?? []).find((s: any) => s.stage === currentStage)
            return sb ? { ...entry, stageStat: sb } : null
          })
          .filter(Boolean)
          .slice(0, 4)
        if (relevant.length === 0) return null
        return (
          <div style={cardStyle}>
            {sectionTitle('Champion Effect on Your Objections', '#A78BFA')}
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '10px', lineHeight: 1.5 }}>
              In {currentStage.replace('_', ' ')} stage, having a champion changes the odds for each objection type.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {relevant.map((entry: any, i: number) => {
                const sb = entry.stageStat
                const lift = sb.championLift as number | null
                const liftColor = lift != null && lift >= 10 ? 'var(--success)' : lift != null && lift >= 0 ? '#A78BFA' : 'var(--danger)'
                const liftLabel = lift != null ? (lift >= 0 ? `+${lift}pts with champion` : `${lift}pts without champion`) : null
                return (
                  <div key={i} style={{ padding: '9px 12px', background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.12)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>{entry.theme}</span>
                      {liftLabel && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: liftColor }}>{liftLabel}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      {sb.winRateWithChampion != null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>With champion:</span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--success)' }}>{sb.winRateWithChampion}%</span>
                        </div>
                      )}
                      {sb.winRateNoChampion != null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Without:</span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--danger)' }}>{sb.winRateNoChampion}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Expected objections */}
      {(dealRisks.length > 0 || commonObjections.length > 0) && (
        <div style={cardStyle}>
          {sectionTitle('Likely Objections to Address', 'var(--danger)')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {dealRisks.map((risk, i) => (
              <div key={`risk-${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '8px 10px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '7px' }}>
                <span style={{ fontSize: '11px' }}>⚠</span>
                <span style={{ fontSize: '12px', color: 'var(--warning)', lineHeight: 1.5 }}>{risk}</span>
              </div>
            ))}
            {commonObjections.slice(0, 3).map((obj, i) => (
              <div key={`obj-${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--danger)', flexShrink: 0, marginTop: '5px' }} />
                {obj}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relevant win stories */}
      {allCaseStudies.length > 0 && (
        <div style={cardStyle}>
          {sectionTitle('Win Stories to Reference', 'var(--success)')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allCaseStudies.slice(0, 2).map((cs: any) => (
              <div key={cs.id} style={{ padding: '10px 12px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>{cs.customerName}</div>
                {cs.customerIndustry && <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>{cs.customerIndustry}{cs.customerSize ? ` · ${cs.customerSize}` : ''}</div>}
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{cs.results?.slice(0, 120)}{cs.results?.length > 120 ? '…' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI full brief */}
      {!fullBriefShown ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4px' }}>
          <button onClick={generateFullBrief} disabled={loading} style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px',
            background: loading ? 'var(--accent-subtle)' : 'linear-gradient(135deg, #6366F1, #7C3AED)',
            boxShadow: loading ? 'none' : 'var(--shadow)',
            border: loading ? '1px solid var(--accent)' : 'none',
            borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating full brief…</>
              : <><Sparkles size={14} /> Generate AI Full Brief</>}
          </button>
        </div>
      ) : (
        <div style={{ background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={14} color="var(--accent)" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>AI Full Brief</span>
            </div>
            <button onClick={generateFullBrief} disabled={loading} style={{ fontSize: '12px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
              {loading ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
            {prep.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <div key={i} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: i === 0 ? 0 : '16px', marginBottom: '6px' }}>{line.slice(3)}</div>
              if (line.startsWith('- ')) return <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '4px' }}><span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }}>·</span><span>{line.slice(2)}</span></div>
              if (line.trim() === '') return <div key={i} style={{ height: '4px' }} />
              return <div key={i} style={{ marginBottom: '4px' }}>{line}</div>
            })}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function TodosTab({ dealId, deal, onUpdate, members }: { dealId: string; deal: any; onUpdate: () => void; members: WorkspaceMember[] }) {
  const [newTodo, setNewTodo] = useState('')
  const [doneExpanded, setDoneExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const todos: any[] = deal?.todos ?? []
  const pending = todos.filter((t: any) => !t.done)
  const done = todos.filter((t: any) => t.done)

  // Strip redundant company name in parentheses from action text (Fix 4)
  const companyName = deal?.prospectCompany?.toLowerCase() ?? ''
  const stripCompanyParens = (text: string) => {
    if (!companyName) return text
    return text.replace(new RegExp(`\\s*\\(${companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'gi'), '')
  }

  const copyPending = () => {
    const text = `Open to-dos for ${deal?.dealName ?? 'deal'}:\n${pending.map((t: any, i: number) => `${i + 1}. ${t.text}`).join('\n')}`
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const saveTodos = async (updated: any[]) => {
    await fetch(`/api/deals/${dealId}/todos`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todos: updated }),
    })
    onUpdate()
  }

  const toggleTodo = (id: string) => {
    saveTodos(todos.map((t: any) => t.id === id ? { ...t, done: !t.done } : t))
  }

  const startEdit = (todo: any) => {
    setEditingId(todo.id)
    setEditText(todo.text)
  }

  const saveEdit = () => {
    if (!editingId || !editText.trim()) return
    saveTodos(todos.map((t: any) => t.id === editingId ? { ...t, text: editText.trim() } : t))
    setEditingId(null)
    setEditText('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodo.trim()) return
    // New items go to top of pending list — insert before first pending item
    const firstPendingIdx = todos.findIndex((t: any) => !t.done)
    const newItem = { id: crypto.randomUUID(), text: newTodo.trim(), done: false, createdAt: new Date().toISOString(), source: 'manual' as const }
    const updated = firstPendingIdx === -1
      ? [newItem, ...todos]
      : [...todos.slice(0, firstPendingIdx), newItem, ...todos.slice(firstPendingIdx)]
    await saveTodos(updated)
    setNewTodo('')
  }

  const moveTodoUp = (id: string) => {
    const idx = todos.findIndex((t: any) => t.id === id)
    if (idx <= 0) return
    // Swap with previous pending item
    const prevPendingIdx = todos.slice(0, idx).map((t: any, i: number) => ({ t, i })).filter(({ t }) => !t.done).pop()?.i
    if (prevPendingIdx == null) return
    const updated = [...todos].map((t: any) => t.id === id ? { ...t, reordered: true } : t)
    ;[updated[prevPendingIdx], updated[idx]] = [updated[idx], updated[prevPendingIdx]]
    saveTodos(updated)
  }

  const moveTodoDown = (id: string) => {
    const idx = todos.findIndex((t: any) => t.id === id)
    if (idx === -1) return
    const nextPendingIdx = todos.slice(idx + 1).map((t: any, i: number) => ({ t, i: idx + 1 + i })).find(({ t }) => !t.done)?.i
    if (nextPendingIdx == null) return
    const updated = [...todos].map((t: any) => t.id === id ? { ...t, reordered: true } : t)
    ;[updated[idx], updated[nextPendingIdx]] = [updated[nextPendingIdx], updated[idx]]
    saveTodos(updated)
  }

  const deleteTodo = (id: string) => saveTodos(todos.filter((t: any) => t.id !== id))

  const assignTodo = (id: string, assignee: string | null) => {
    saveTodos(todos.map((t: any) => t.id === id ? { ...t, assignee: assignee ?? undefined } : t))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{pending.length} open action{pending.length !== 1 ? 's' : ''}</span>
        {pending.length > 0 && (
          <button onClick={copyPending} style={{
            fontSize: '11px', color: copied ? 'var(--success)' : 'var(--text-tertiary)', background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0',
          }}>
            {copied ? '✓ Copied' : '⎘ Copy list'}
          </button>
        )}
      </div>
      <form onSubmit={addTodo} style={{ display: 'flex', gap: '8px' }}>
        <input
          value={newTodo}
          onChange={e => setNewTodo(e.target.value)}
          placeholder="Add action item..."
          style={{
            flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '9px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
          }}
          onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--accent)'}
          onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--border)'}
        />
        <button type="submit" disabled={!newTodo.trim()} style={{
          padding: '0 14px', background: 'var(--accent-subtle)', border: '1px solid var(--accent)',
          borderRadius: '8px', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center',
        }}>
          <Plus size={14} />
        </button>
      </form>

      {/* Pending todos */}
      {pending.length === 0 && done.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '10px', padding: '40px 24px',
          background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: '12px',
          textAlign: 'center',
        }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={16} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No action items yet</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: '300px' }}>
              Action items are automatically extracted when you add meeting notes and run AI analysis.
            </div>
          </div>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {pending.map((todo: any) => (
                <div key={todo.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px',
                }}>
                  <button onClick={() => toggleTodo(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
                    <Square size={15} color="var(--text-tertiary)" />
                  </button>
                  {editingId === todo.id ? (
                    <form onSubmit={e => { e.preventDefault(); saveEdit() }} style={{ flex: 1, display: 'flex', gap: '6px' }}>
                      <input
                        autoFocus
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
                        style={{
                          flex: 1, background: 'var(--input-bg)', border: '1px solid var(--accent)',
                          borderRadius: '6px', padding: '4px 8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                        }}
                      />
                      <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: 'var(--success)' }}>
                        <Check size={14} />
                      </button>
                      <button type="button" onClick={cancelEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: 'var(--text-tertiary)' }}>
                        <X size={14} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <span
                        onDoubleClick={() => startEdit(todo)}
                        style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', cursor: 'text' }}
                        title="Double-click to edit"
                      >{stripCompanyParens(todo.text)}</span>
                      <AssigneePicker
                        assignee={todo.assignee}
                        members={members}
                        onAssign={(a) => assignTodo(todo.id, a)}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
                        <button
                          onClick={() => moveTodoUp(todo.id)}
                          title="Move up"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '1px 2px', display: 'flex', borderRadius: '3px', lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
                        ><ArrowUp size={10} /></button>
                        <button
                          onClick={() => moveTodoDown(todo.id)}
                          title="Move down"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '1px 2px', display: 'flex', borderRadius: '3px', lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
                        ><ArrowDown size={10} /></button>
                      </div>
                      <button onClick={() => startEdit(todo)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px', display: 'flex', borderRadius: '4px', flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
                      >
                        <Edit size={11} />
                      </button>
                      <button onClick={() => deleteTodo(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px', display: 'flex', borderRadius: '4px', flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--danger)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Completed todos — collapsed by default */}
          {done.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              <button
                onClick={() => setDoneExpanded(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', color: 'var(--text-tertiary)', fontSize: '11px' }}
              >
                <CheckCircle size={11} color="var(--success)" />
                <span style={{ color: 'var(--success)', fontWeight: '600' }}>{done.length} completed</span>
                <span style={{ color: 'var(--text-tertiary)' }}>{doneExpanded ? '↑' : '↓'}</span>
              </button>
              {doneExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                  {done.map((todo: any) => (
                    <div key={todo.id} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
                      background: 'rgba(34,197,94,0.03)', border: '1px solid rgba(34,197,94,0.08)', borderRadius: '6px',
                    }}>
                      <button onClick={() => toggleTodo(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
                        <CheckCircle size={13} color="var(--success)" />
                      </button>
                      <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>{stripCompanyParens(todo.text)}</span>
                      {todo.assignee && (
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--surface-hover)', borderRadius: '10px', padding: '1px 6px' }}>
                          {getDisplayName(todo.assignee)}
                        </span>
                      )}
                      <button onClick={() => deleteTodo(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '1px', display: 'flex', borderRadius: '3px' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--danger)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const STAGES_OPTS = ['prospecting','qualification','discovery','proposal','negotiation','closed_won','closed_lost'] as const

function EditDealModal({ deal, dealId, open, onOpenChange, onSaved, onWon }: {
  deal: any; dealId: string; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void; onWon?: (deal: any) => void
}) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [contacts, setContacts] = useState<DealContact[]>([{ name: '', title: '', email: '' }])
  const [saving, setSaving] = useState(false)

  // sync form state when deal or open changes
  useEffect(() => {
    if (open && deal) {
      setForm({
        dealName: deal.dealName ?? '',
        prospectCompany: deal.prospectCompany ?? '',
        description: deal.description ?? '',
        dealValue: deal.dealValue != null ? String(deal.dealValue) : '',
        stage: deal.stage ?? 'proposal',
        dealType: deal.dealType ?? 'one_off',
        recurringInterval: deal.recurringInterval ?? 'annual',
        engagementType: deal.engagementType ?? '',
        competitors: Array.isArray(deal.competitors) ? deal.competitors.join(', ') : '',
        notes: deal.notes ?? '',
        nextSteps: deal.nextSteps ?? '',
        lostReason: deal.lostReason ?? '',
      })
      // Initialise contacts from saved array, fall back to legacy prospectName/Title
      const existing: DealContact[] = Array.isArray(deal.contacts) && deal.contacts.length > 0
        ? deal.contacts
        : deal.prospectName ? [{ name: deal.prospectName, title: deal.prospectTitle ?? '', email: '' }] : [{ name: '', title: '', email: '' }]
      setContacts(existing.map(c => ({ name: c.name ?? '', title: c.title ?? '', email: c.email ?? '' })))
    }
  }, [open, deal])

  const updateContact = (i: number, field: keyof DealContact, value: string) =>
    setContacts(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  const addContact = () => setContacts(prev => [...prev, { name: '', title: '', email: '' }])
  const removeContact = (i: number) => setContacts(prev => prev.filter((_, idx) => idx !== i))

  const u = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inputStyle: React.CSSProperties = {
    width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px',
    background: 'var(--input-bg)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px',
  }

  const save = async () => {
    setSaving(true)
    try {
      const wasWon = deal?.stage !== 'closed_won' && form.stage === 'closed_won'
      const cleanContacts = contacts
        .map(c => ({ name: c.name.trim(), title: c.title?.trim() || undefined, email: c.email?.trim() || undefined }))
        .filter(c => c.name)
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealName: form.dealName,
          prospectCompany: form.prospectCompany,
          description: form.description || null,
          prospectName: cleanContacts[0]?.name ?? null,
          prospectTitle: cleanContacts[0]?.title ?? null,
          contacts: cleanContacts,
          dealValue: form.dealValue ? Number(form.dealValue) : null,
          stage: form.stage,
          dealType: form.dealType ?? 'one_off',
          recurringInterval: form.dealType === 'recurring' ? (form.recurringInterval ?? 'annual') : null,
          engagementType: form.engagementType || null,
          competitors: form.competitors.split(',').map((s: string) => s.trim()).filter(Boolean),
          notes: form.notes || null,
          nextSteps: form.nextSteps || null,
          lostReason: form.lostReason || null,
        }),
      })
      onSaved()
      onOpenChange(false)
      if (wasWon) onWon?.({ ...form, dealId })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 500 }} />
        <Dialog.Content style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 501, width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--elevated)', border: '1px solid var(--border-strong)',
          borderRadius: '14px', padding: '24px', outline: 'none',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <Dialog.Title style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Edit deal</Dialog.Title>
            <Dialog.Close asChild>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '5px' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}>
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Deal name</label>
                <input style={inputStyle} value={form.dealName ?? ''} onChange={e => u('dealName', e.target.value)}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
              <div>
                <label style={labelStyle}>Company</label>
                <input style={inputStyle} value={form.prospectCompany ?? ''} onChange={e => u('prospectCompany', e.target.value)}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
            </div>
            {/* Description */}
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }}
                rows={2}
                value={form.description ?? ''}
                onChange={e => u('description', e.target.value)}
                placeholder="Overview of the opportunity, context, or key details…"
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Contacts */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={labelStyle}>Contacts</label>
                <button
                  type="button"
                  onClick={addContact}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-hover)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                >
                  <Plus size={11} /> Add contact
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {contacts.map((contact, i) => (
                  <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', position: 'relative' }}>
                    {contacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContact(i)}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '2px', borderRadius: '4px' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)' }}
                      >
                        <X size={12} />
                      </button>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ ...labelStyle, fontSize: '10px' }}>Name</label>
                        <input style={inputStyle} value={contact.name} onChange={e => updateContact(i, 'name', e.target.value)} placeholder="Jane Smith"
                          onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: '10px' }}>Title</label>
                        <input style={inputStyle} value={contact.title ?? ''} onChange={e => updateContact(i, 'title', e.target.value)} placeholder="VP of Engineering"
                          onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                      </div>
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '10px' }}>Email</label>
                      <input style={inputStyle} type="email" value={contact.email ?? ''} onChange={e => updateContact(i, 'email', e.target.value)} placeholder="jane@acme.com"
                        onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Deal type</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: form.dealType === 'recurring' ? '8px' : '0' }}>
                {(['one_off', 'recurring'] as const).map(type => (
                  <button key={type} type="button" onClick={() => u('dealType', type)} style={{
                    flex: 1, height: '32px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                    color: form.dealType === type ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    backgroundColor: form.dealType === type ? 'var(--accent-subtle)' : 'transparent',
                    border: `1px solid ${form.dealType === type ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer', transition: 'all 150ms ease',
                  }}>
                    {type === 'one_off' ? 'One-off' : 'Recurring'}
                  </button>
                ))}
              </div>
              {form.dealType === 'recurring' && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['monthly', 'quarterly', 'annual'] as const).map(interval => (
                    <button key={interval} type="button" onClick={() => u('recurringInterval', interval)} style={{
                      flex: 1, height: '26px', borderRadius: '5px', fontSize: '11px', fontWeight: 500, textTransform: 'capitalize',
                      color: form.recurringInterval === interval ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      backgroundColor: form.recurringInterval === interval ? 'var(--surface-hover)' : 'transparent',
                      border: `1px solid ${form.recurringInterval === interval ? 'var(--border-strong)' : 'var(--border)'}`,
                      cursor: 'pointer', transition: 'all 150ms ease',
                    }}>
                      {interval}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>
                  {form.dealType === 'recurring'
                    ? `Value (${form.recurringInterval === 'monthly' ? 'MRR' : form.recurringInterval === 'quarterly' ? 'QRR' : 'ARR'})`
                    : 'Deal value'}
                </label>
                <input style={inputStyle} type="number" value={form.dealValue ?? ''} onChange={e => u('dealValue', e.target.value)} placeholder="50000"
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
              <div>
                <label style={labelStyle}>Stage</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.stage ?? ''} onChange={e => u('stage', e.target.value)}>
                  {STAGES_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Competitors (comma-separated)</label>
                <input style={inputStyle} value={form.competitors ?? ''} onChange={e => u('competitors', e.target.value)} placeholder="Competitor A, Competitor B"
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
              <div>
                <label style={labelStyle}>Engagement type</label>
                <select
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  value={form.engagementType ?? ''}
                  onChange={e => u('engagementType', e.target.value)}
                >
                  <option value="">— None —</option>
                  {['POC', 'Pilot', 'Live', 'Expansion', 'Renewal', 'Upsell'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  {form.engagementType && !['POC','Pilot','Live','Expansion','Renewal','Upsell',''].includes(form.engagementType) && (
                    <option value={form.engagementType}>{form.engagementType}</option>
                  )}
                </select>
              </div>
            </div>
            {form.stage === 'closed_lost' && (
              <div>
                <label style={labelStyle}>Lost reason</label>
                <input style={inputStyle} value={form.lostReason ?? ''} onChange={e => u('lostReason', e.target.value)} placeholder="e.g. Price too high"
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }}
                rows={3} value={form.notes ?? ''} onChange={e => u('notes', e.target.value)}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
            </div>
            <div>
              <label style={labelStyle}>Next steps</label>
              <input style={inputStyle} value={form.nextSteps ?? ''} onChange={e => u('nextSteps', e.target.value)} placeholder="Schedule follow-up call"
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
              <Dialog.Close asChild>
                <button style={{ height: '34px', padding: '0 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--surface-hover)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </Dialog.Close>
              <button onClick={save} disabled={saving} style={{
                height: '34px', padding: '0 18px', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                color: '#fff', background: saving ? 'var(--surface)' : 'linear-gradient(135deg, #6366F1, #7C3AED)',
                border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function WinStoryPromptModal({ wonDeal, open, onOpenChange, currencySymbol = '£' }: {
  wonDeal: any; open: boolean; onOpenChange: (v: boolean) => void; currencySymbol?: string
}) {
  const [form, setForm] = useState({ customerName: '', customerIndustry: '', customerSize: '', challenge: '', solution: '', results: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open && wonDeal) {
      setForm({
        customerName: wonDeal.prospectCompany ?? '',
        customerIndustry: '',
        customerSize: '',
        challenge: wonDeal.notes ? `${wonDeal.notes.slice(0, 300)}` : '',
        solution: '',
        results: wonDeal.dealValue ? `Closed at ${currencySymbol}${Number(wonDeal.dealValue).toLocaleString()}` : '',
      })
      setSaved(false)
    }
  }, [open, wonDeal])

  const u = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px',
    background: 'var(--input-bg)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px',
  }
  const textareaStyle: React.CSSProperties = {
    ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical',
    fontFamily: 'inherit', lineHeight: '1.5',
  }

  const submit = async () => {
    if (!form.customerName || !form.challenge || !form.solution || !form.results) return
    setSaving(true)
    try {
      const res = await fetch('/api/case-studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, metrics: [] }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => onOpenChange(false), 1400)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 600 }} />
        <Dialog.Content style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 601, width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--elevated)', border: '1px solid var(--accent)',
          borderRadius: '14px', padding: '24px', outline: 'none',
          boxShadow: 'var(--shadow-lg)',
        }}>
          {saved ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🏆</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--success)', marginBottom: '4px' }}>Win story saved!</div>
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Added to your case study library for future collateral.</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '18px' }}>🏆</span>
                    <Dialog.Title style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Turn this win into a case study
                    </Dialog.Title>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
                    Capture the story now — it&apos;ll strengthen every future proposal and collateral piece.
                  </p>
                </div>
                <Dialog.Close asChild>
                  <button style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', padding: '4px', flexShrink: 0 }}>
                    <X size={15} />
                  </button>
                </Dialog.Close>
              </div>

              <div style={{ height: '1px', background: 'var(--border)', margin: '14px 0' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Customer name *</label>
                    <input style={inputStyle} value={form.customerName} onChange={e => u('customerName', e.target.value)}
                      onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                  </div>
                  <div>
                    <label style={labelStyle}>Industry</label>
                    <input style={inputStyle} value={form.customerIndustry} onChange={e => u('customerIndustry', e.target.value)} placeholder="e.g. SaaS, Retail"
                      onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Company size</label>
                  <input style={inputStyle} value={form.customerSize} onChange={e => u('customerSize', e.target.value)} placeholder="e.g. 50-200 employees, Series B"
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
                <div>
                  <label style={labelStyle}>Their challenge *</label>
                  <textarea style={textareaStyle} rows={3} value={form.challenge} onChange={e => u('challenge', e.target.value)}
                    placeholder="What problem were they trying to solve?"
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
                <div>
                  <label style={labelStyle}>How you solved it *</label>
                  <textarea style={textareaStyle} rows={2} value={form.solution} onChange={e => u('solution', e.target.value)}
                    placeholder="What did you implement or deliver?"
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
                <div>
                  <label style={labelStyle}>Measurable results *</label>
                  <textarea style={textareaStyle} rows={2} value={form.results} onChange={e => u('results', e.target.value)}
                    placeholder="e.g. Reduced onboarding time by 40%, saved 10h/week"
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')} onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                  <Dialog.Close asChild>
                    <button style={{ height: '34px', padding: '0 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 500, color: 'var(--text-tertiary)', background: 'var(--surface-hover)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                      Skip for now
                    </button>
                  </Dialog.Close>
                  <button
                    onClick={submit}
                    disabled={saving || !form.customerName || !form.challenge || !form.solution || !form.results}
                    style={{
                      height: '34px', padding: '0 18px', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                      color: '#fff', background: saving ? 'var(--surface)' : 'linear-gradient(135deg, #22C55E, #16A34A)',
                      border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {saving ? 'Saving…' : 'Save Win Story'}
                  </button>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ActivityLog({ dealId, deal, onUpdate }: { dealId: string; deal: any; onUpdate: () => void }) {
  const [entry, setEntry] = useState('')
  const [saving, setSaving] = useState(false)

  // Parse date-stamped entries from accumulated notes
  const entries: string[] = deal?.notes
    ? deal.notes.split('\n').filter((l: string) => l.trim().length > 0)
    : []

  const logActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entry.trim()) return
    setSaving(true)
    try {
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      const newEntry = `[${dateStr}] ${entry.trim()}`
      const updatedNotes = deal?.notes ? `${deal.notes}\n${newEntry}` : newEntry
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: updatedNotes }),
      })
      setEntry('')
      onUpdate()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <Clipboard size={13} color="var(--accent)" />
        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Activity Log</span>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>· manual entries + meeting summaries</span>
      </div>

      {/* Quick log input */}
      <form onSubmit={logActivity} style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderBottom: entries.length > 0 ? '1px solid var(--border)' : 'none' }}>
        <input
          value={entry}
          onChange={e => setEntry(e.target.value)}
          placeholder="Log an activity… e.g. 'Sent account access email to john@acme.com'"
          style={{
            flex: 1, height: '34px', padding: '0 10px', borderRadius: '7px',
            background: 'var(--input-bg)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
        <button type="submit" disabled={saving || !entry.trim()} style={{
          height: '34px', padding: '0 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600',
          color: '#fff', background: saving || !entry.trim() ? 'var(--surface)' : 'var(--accent)',
          border: '1px solid var(--accent)', cursor: saving || !entry.trim() ? 'not-allowed' : 'pointer',
          transition: 'background 150ms', whiteSpace: 'nowrap',
        }}>
          {saving ? '…' : 'Log'}
        </button>
      </form>

      {/* Timeline */}
      {entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', maxHeight: '240px', overflowY: 'auto' }}>
          {[...entries].reverse().map((e, i) => {
            const isDateStamped = e.startsWith('[')
            const dateMatch = e.match(/^\[([^\]]+)\]\s*(.*)/)
            const date = dateMatch?.[1] ?? ''
            const text = dateMatch?.[2] ?? e
            return (
              <div key={i} style={{
                display: 'flex', gap: '12px', padding: '9px 16px',
                borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ flexShrink: 0, marginTop: '4px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isDateStamped && <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>{date}</div>}
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{text}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {entries.length === 0 && (
        <div style={{ padding: '20px 16px', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
          No activity logged yet. Log meetings via the AI tab or add manual entries above.
        </div>
      )}
    </div>
  )
}

function SuccessCriteriaTab({ dealId, deal, onUpdate, members }: { dealId: string; deal: any; onUpdate: () => void; members: WorkspaceMember[] }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const isShared: boolean = deal?.successCriteriaIsShared ?? false
  const shareToken: string | null = deal?.successCriteriaShareToken ?? null
  const criteria: any[] = deal?.successCriteriaTodos ?? []

  const categories = [...new Set(criteria.map((c: any) => c.category ?? 'General'))]
  const achieved = criteria.filter((c: any) => c.achieved).length

  const extract = async () => {
    if (!text.trim()) return
    setLoading(true)
    setExtractError(null)
    try {
      const res = await fetch(`/api/deals/${dealId}/success-criteria`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setExtractError(data.error ?? 'Failed to extract criteria')
        return
      }
      setText('')
      onUpdate()
    } finally { setLoading(false) }
  }

  const toggle = async (criterionId: string, achieved: boolean) => {
    await fetch(`/api/deals/${dealId}/success-criteria`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criterionId, achieved }),
    })
    onUpdate()
  }

  const saveNote = async (criterionId: string) => {
    await fetch(`/api/deals/${dealId}/success-criteria`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criterionId, note: noteText }),
    })
    setEditingNote(null)
    onUpdate()
  }

  const remove = async (criterionId: string) => {
    await fetch(`/api/deals/${dealId}/success-criteria`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criterionId }),
    })
    onUpdate()
  }

  const assignCriterion = async (criterionId: string, assignee: string | null) => {
    await fetch(`/api/deals/${dealId}/success-criteria`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criterionId, assignee: assignee ?? '' }),
    })
    onUpdate()
  }

  const toggleShare = async () => {
    setShareLoading(true)
    try {
      await fetch(`/api/deals/${dealId}/success-criteria/share`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: !isShared }),
      })
      onUpdate()
    } finally { setShareLoading(false) }
  }

  const copyLink = async () => {
    if (!shareToken) return
    await navigator.clipboard.writeText(`${window.location.origin}/share/criteria/${shareToken}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Progress bar */}
      {criteria.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Progress</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: achieved === criteria.length ? 'var(--success)' : 'var(--text-primary)' }}>
              {achieved}/{criteria.length} met
            </span>
          </div>
          <div style={{ height: '6px', background: 'var(--surface-hover)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${criteria.length ? (achieved / criteria.length) * 100 : 0}%`, background: 'linear-gradient(90deg, #6366F1, #22C55E)', borderRadius: '3px', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Share controls */}
      {criteria.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={toggleShare}
            disabled={shareLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: isShared ? 'var(--accent-subtle)' : 'var(--surface)', border: `1px solid ${isShared ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '7px', color: isShared ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: shareLoading ? 'not-allowed' : 'pointer' }}
          >
            {shareLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Link2 size={12} />}
            {isShared ? 'Shared' : 'Share'}
          </button>
          {isShared && shareToken && (
            <button
              onClick={copyLink}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: copied ? 'rgba(34,197,94,0.1)' : 'var(--surface)', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, borderRadius: '7px', color: copied ? 'var(--success)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              {copied ? <Check size={12} /> : <Clipboard size={12} />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          )}
        </div>
      )}

      {/* Criteria list grouped by category */}
      {categories.map(cat => (
        <div key={cat} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>{cat}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {criteria.filter((c: any) => (c.category ?? 'General') === cat).map((c: any) => (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <button
                    onClick={() => toggle(c.id, !c.achieved)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '1px', flexShrink: 0, color: c.achieved ? 'var(--success)' : 'var(--text-tertiary)' }}
                  >
                    {c.achieved
                      ? <CheckCircle size={16} />
                      : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #444' }} />}
                  </button>
                  <span style={{ flex: 1, fontSize: '13px', color: c.achieved ? 'var(--text-tertiary)' : 'var(--text-primary)', lineHeight: 1.5, textDecoration: c.achieved ? 'line-through' : 'none' }}>
                    {c.text}
                  </span>
                  <AssigneePicker
                    assignee={c.assignee || undefined}
                    members={members}
                    onAssign={(a) => assignCriterion(c.id, a)}
                  />
                  <button onClick={() => { setEditingNote(c.id); setNoteText(c.note ?? '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: '11px', color: c.note ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                    {c.note ? '✎' : '+ note'}
                  </button>
                  <button onClick={() => remove(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--text-tertiary)' }}>
                    <X size={12} />
                  </button>
                </div>
                {c.note && editingNote !== c.id && (
                  <div style={{ marginLeft: '26px', fontSize: '11px', color: 'var(--accent)', background: 'var(--accent-subtle)', borderRadius: '6px', padding: '5px 8px' }}>
                    {c.note}
                  </div>
                )}
                {editingNote === c.id && (
                  <div style={{ marginLeft: '26px', display: 'flex', gap: '6px' }}>
                    <input
                      autoFocus
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveNote(c.id); if (e.key === 'Escape') setEditingNote(null) }}
                      placeholder="How was this achieved?"
                      style={{ flex: 1, background: 'var(--surface)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', padding: '5px 8px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                    />
                    <button onClick={() => saveNote(c.id)} style={{ padding: '5px 10px', background: 'var(--accent-subtle)', border: 'none', borderRadius: '6px', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingNote(null)} style={{ padding: '5px 8px', background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Paste new criteria */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>
          {criteria.length > 0 ? 'Add More Criteria' : 'Paste Success Criteria'}
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste the success criteria from your proposal, RFP, or stakeholder requirements — AI will extract individual testable items..."
          rows={5}
          style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={extract}
            disabled={loading || !text.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 18px', background: loading ? 'var(--accent-subtle)' : 'linear-gradient(135deg, #6366F1, #7C3AED)', border: loading ? '1px solid var(--accent)' : 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: loading || !text.trim() ? 'not-allowed' : 'pointer' }}
          >
            {loading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Extracting…</> : <><Sparkles size={13} /> Extract Criteria</>}
          </button>
          {extractError && (
            <span style={{ fontSize: '12px', color: 'var(--danger)' }}>{extractError}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function ProjectPlanTab({ dealId, deal, onUpdate, members }: { dealId: string; deal: any; onUpdate: () => void; members: WorkspaceMember[] }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTaskText, setNewTaskText] = useState<Record<string, string>>({})
  const plan = deal?.projectPlan as any
  const phases = plan?.phases ?? []
  const allTasks = phases.flatMap((p: any) => p.tasks ?? [])
  const totalTasks = allTasks.length
  const completeTasks = allTasks.filter((t: any) => t.status === 'complete').length
  const inProgressTasks = allTasks.filter((t: any) => t.status === 'in_progress').length

  const todos: any[] = deal?.todos ?? []

  const extract = async () => {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/deals/${dealId}/project-plan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to create project plan')
        return
      }
      setText('')
      onUpdate()
    } finally { setLoading(false) }
  }

  const updateTask = async (taskId: string, updates: Record<string, any>) => {
    await fetch(`/api/deals/${dealId}/project-plan`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, ...updates }),
    })
    onUpdate()
  }

  const addTask = async (phaseId: string) => {
    const taskText = newTaskText[phaseId]?.trim()
    if (!taskText) return
    await fetch(`/api/deals/${dealId}/project-plan`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phaseId, addTask: taskText }),
    })
    setNewTaskText(prev => ({ ...prev, [phaseId]: '' }))
    onUpdate()
  }

  const deleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/deals/${dealId}/project-plan`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteTaskId: taskId }),
      })
      if (!res.ok) console.error('Failed to delete task:', await res.text())
    } catch (e) { console.error('Failed to delete task:', e) }
    onUpdate()
  }

  const deletePhase = async (phaseId: string) => {
    try {
      const res = await fetch(`/api/deals/${dealId}/project-plan`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletePhaseId: phaseId }),
      })
      if (!res.ok) console.error('Failed to delete phase:', await res.text())
    } catch (e) { console.error('Failed to delete phase:', e) }
    onUpdate()
  }

  const statusColors: Record<string, { bg: string; border: string; text: string; label: string }> = {
    not_started: { bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', text: 'var(--text-secondary)', label: 'Not Started' },
    in_progress: { bg: 'var(--accent-subtle)', border: 'var(--accent)', text: 'var(--accent)', label: 'In Progress' },
    complete: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', text: 'var(--success)', label: 'Complete' },
  }

  const cycleStatus = (current: string) => {
    if (current === 'not_started') return 'in_progress'
    if (current === 'in_progress') return 'complete'
    return 'not_started'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Progress bar */}
      {totalTasks > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Plan Progress</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{totalTasks - completeTasks - inProgressTasks} pending</span>
              {inProgressTasks > 0 && <span style={{ fontSize: '11px', color: 'var(--accent)' }}>{inProgressTasks} in progress</span>}
              <span style={{ fontSize: '12px', fontWeight: 600, color: completeTasks === totalTasks ? 'var(--success)' : 'var(--text-primary)' }}>
                {completeTasks}/{totalTasks} done
              </span>
            </div>
          </div>
          <div style={{ height: '6px', background: 'var(--surface-hover)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ height: '100%', width: `${totalTasks ? (completeTasks / totalTasks) * 100 : 0}%`, background: 'linear-gradient(90deg, #6366F1, #22C55E)', borderRadius: '3px 0 0 3px', transition: 'width 0.3s' }} />
            <div style={{ height: '100%', width: `${totalTasks ? (inProgressTasks / totalTasks) * 100 : 0}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Phases */}
      {[...phases].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)).map((phase: any) => {
        const phaseTasks = phase.tasks ?? []
        const phaseComplete = phaseTasks.filter((t: any) => t.status === 'complete').length
        return (
          <div key={phase.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Phase header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <Layers size={13} color="var(--accent)" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', flex: 1 }}>{phase.name}</span>
              {phase.targetDate && (
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{new Date(phase.targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              )}
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--surface)', borderRadius: '4px', padding: '2px 8px' }}>
                {phaseComplete}/{phaseTasks.length}
              </span>
              <button onClick={() => deletePhase(phase.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px', display: 'flex' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--danger)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
              >
                <Trash2 size={12} />
              </button>
            </div>
            {phase.description && (
              <div style={{ padding: '8px 16px', fontSize: '11px', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>{phase.description}</div>
            )}

            {/* Tasks */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {phaseTasks.map((task: any) => {
                const sc = statusColors[task.status] ?? statusColors.not_started
                const linkedTodo = task.linkedTodoId ? todos.find((t: any) => t.id === task.linkedTodoId) : null
                return (
                  <div key={task.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <button
                      onClick={() => updateTask(task.id, { status: cycleStatus(task.status) })}
                      style={{
                        background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: '4px',
                        width: '20px', height: '20px', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0,
                      }}
                      title={`Click to change: ${sc.label}`}
                    >
                      {task.status === 'complete' && <Check size={12} color="var(--success)" />}
                      {task.status === 'in_progress' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '13px', color: task.status === 'complete' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        textDecoration: task.status === 'complete' ? 'line-through' : 'none',
                      }}>
                        {task.text}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '3px', alignItems: 'center' }}>
                        {task.owner && <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>👤 {task.owner}</span>}
                        {task.dueDate && <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>📅 {new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                        {linkedTodo && (
                          <span style={{ fontSize: '10px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Link2 size={9} /> Linked to-do{linkedTodo.done ? ' ✓' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <AssigneePicker
                      assignee={task.assignee || task.owner || undefined}
                      members={members}
                      onAssign={(a) => updateTask(task.id, { assignee: a ?? '' })}
                    />
                    <span style={{
                      fontSize: '10px', padding: '2px 8px', borderRadius: '4px',
                      background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text,
                    }}>
                      {sc.label}
                    </span>
                    <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px', display: 'flex' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--danger)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )
              })}

              {/* Add task to phase */}
              <form onSubmit={e => { e.preventDefault(); addTask(phase.id) }} style={{ display: 'flex', gap: '8px', padding: '8px 16px' }}>
                <input
                  value={newTaskText[phase.id] ?? ''}
                  onChange={e => setNewTaskText(prev => ({ ...prev, [phase.id]: e.target.value }))}
                  placeholder="Add task..."
                  style={{
                    flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '6px', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none',
                  }}
                />
                <button type="submit" disabled={!(newTaskText[phase.id]?.trim())} style={{
                  padding: '0 10px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: '6px', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                }}>
                  <Plus size={12} />
                </button>
              </form>
            </div>
          </div>
        )
      })}

      {/* Paste new plan */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>
          {phases.length > 0 ? 'Add More Phases' : 'Create Project Plan'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '10px', lineHeight: 1.6 }}>
          Paste a project plan, timeline, milestones table, or any structured text — AI will extract phases and tasks automatically.
          {phases.length > 0 && ' New phases will be appended to the existing plan.'}
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste your project plan, implementation timeline, POC milestones, or any structured task list..."
          rows={6}
          style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
          <button
            onClick={extract}
            disabled={loading || !text.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 18px', background: loading ? 'var(--accent-subtle)' : 'linear-gradient(135deg, #6366F1, #7C3AED)', border: loading ? '1px solid var(--accent)' : 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: loading || !text.trim() ? 'not-allowed' : 'pointer' }}
          >
            {loading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Parsing…</> : <><Sparkles size={13} /> Create Plan</>}
          </button>
          {error && <span style={{ fontSize: '12px', color: 'var(--danger)' }}>{error}</span>}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// External Links Section
// ─────────────────────────────────────────────────────────────────────────────

function detectLinkType(url: string): LinkTypeEnum {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host.includes('sharepoint') || host.includes('.sharepoint.com')) return 'sharepoint'
    if (host.includes('google.com') || host.includes('docs.google') || host.includes('drive.google') || host.includes('sheets.google') || host.includes('slides.google')) return 'google'
    if (host.includes('salesforce') || host.includes('.force.com') || host.includes('.lightning.force.com')) return 'salesforce'
    if (host.includes('notion.so') || host.includes('notion.site')) return 'notion'
    if (host.includes('figma.com')) return 'figma'
    if (host.includes('github.com') || host.includes('github.dev')) return 'github'
  } catch { /* invalid URL */ }
  return 'other'
}

function deriveLabelFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/$/, '')
    const segments = path.split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1] ?? ''
    const decoded = decodeURIComponent(lastSegment).replace(/[-_]/g, ' ')
    if (decoded && decoded.length < 80) return `${u.hostname.replace('www.', '')} — ${decoded}`
    return u.hostname.replace('www.', '')
  } catch {
    return url.slice(0, 60)
  }
}

const LINK_TYPE_ICON: Record<LinkTypeEnum, { icon: typeof Globe; color: string }> = {
  proposal:   { icon: FileText,  color: 'var(--accent)' },
  contract:   { icon: FileCheck, color: 'var(--success)' },
  deck:       { icon: BarChart2, color: 'var(--warning)' },
  document:   { icon: File,      color: 'var(--text-secondary)' },
  sharepoint: { icon: Cloud,     color: '#0078D4' },
  google:     { icon: FileText,  color: '#4285F4' },
  salesforce: { icon: Database,  color: '#00A1E0' },
  notion:     { icon: BookOpen,  color: 'var(--text-primary)' },
  figma:      { icon: PenTool,   color: '#A259FF' },
  github:     { icon: Github,    color: 'var(--text-primary)' },
  other:      { icon: Globe,     color: 'var(--text-tertiary)' },
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)  return `${days}d ago`
  if (weeks < 5) return `${weeks}w ago`
  return `${months}mo ago`
}

function LinksSection({ dealId, deal, onUpdate }: { dealId: string; deal: any; onUpdate: () => void }) {
  const rawLinks: DealLinkType[] = Array.isArray(deal.links) ? deal.links : []
  // Show newest first
  const links = [...rawLinks].sort((a, b) => new Date(b.addedAt ?? 0).getTime() - new Date(a.addedAt ?? 0).getTime())
  const [expanded, setExpanded] = useState(rawLinks.length > 0)
  const [adding, setAdding] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [labelInput, setLabelInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const patchLinks = async (newLinks: DealLinkType[]) => {
    setSaving(true)
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: newLinks }),
      })
      onUpdate()
    } finally {
      setSaving(false)
    }
  }

  const addLink = async () => {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    let url = trimmed
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    try { new URL(url) } catch { return }

    const type = detectLinkType(url)
    const label = labelInput.trim() || deriveLabelFromUrl(url)
    const newLink: DealLinkType = {
      id: crypto.randomUUID(),
      url,
      label,
      type,
      addedAt: new Date().toISOString(),
    }
    await patchLinks([...rawLinks, newLink])
    setUrlInput('')
    setLabelInput('')
    setAdding(false)
  }

  const deleteLink = (linkId: string) => {
    patchLinks(rawLinks.filter(l => l.id !== linkId))
  }

  const saveEditLabel = (linkId: string) => {
    const updated = rawLinks.map(l => l.id === linkId ? { ...l, label: editLabel.trim() || l.label } : l)
    patchLinks(updated)
    setEditingId(null)
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
          padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
        }}
      >
        {expanded ? <ChevronDown size={12} color="var(--text-tertiary)" /> : <ChevronRight size={12} color="var(--text-tertiary)" />}
        <Link2 size={13} color="var(--accent)" />
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          External Links{rawLinks.length > 0 ? ` (${rawLinks.length})` : ''}
        </span>
        {!adding && (
          <span
            onClick={e => { e.stopPropagation(); setAdding(true); setExpanded(true) }}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}
          >
            <Plus size={12} /> Add
          </span>
        )}
      </button>

      {expanded && (
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {links.length === 0 && !adding && (
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0, fontStyle: 'italic', padding: '4px 0' }}>
              No links yet — paste a SharePoint, Google Doc, or any URL
            </p>
          )}

          {links.map(link => {
            const { icon: Icon, color } = LINK_TYPE_ICON[link.type] ?? LINK_TYPE_ICON.other
            return (
              <div
                key={link.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px',
                  borderRadius: '6px', background: 'var(--card-bg)',
                  border: '1px solid var(--border)', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <Icon size={14} color={color} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === link.id ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEditLabel(link.id); if (e.key === 'Escape') setEditingId(null) }}
                        autoFocus
                        style={{
                          flex: 1, fontSize: '12px', padding: '2px 6px', background: 'var(--surface)',
                          border: '1px solid var(--accent)', borderRadius: '4px', color: 'var(--text-primary)',
                          outline: 'none', fontFamily: 'inherit',
                        }}
                      />
                      <button onClick={() => saveEditLabel(link.id)} style={{ fontSize: '10px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Check size={12} />
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                      onDoubleClick={() => { setEditingId(link.id); setEditLabel(link.label) }}
                      title="Double-click to rename"
                    >
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)',
                          textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          display: 'block', maxWidth: '100%',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                      >
                        {link.label}
                      </a>
                      <ExternalLink size={10} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '1px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {link.url}
                    </span>
                    {link.addedAt && (
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {relativeTime(link.addedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteLink(link.id)}
                  title="Remove link"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                    color: 'var(--text-tertiary)', borderRadius: '4px', flexShrink: 0, display: 'flex',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <X size={12} />
                </button>
              </div>
            )
          })}

          {adding && (
            <div style={{
              padding: '10px', borderRadius: '8px', background: 'var(--card-bg)',
              border: '1px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="Paste URL (SharePoint, Google Docs, Salesforce, ...)"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && urlInput.trim()) addLink(); if (e.key === 'Escape') { setAdding(false); setUrlInput(''); setLabelInput('') } }}
                style={{
                  width: '100%', fontSize: '12px', padding: '8px 10px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '6px', color: 'var(--text-primary)', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              <input
                type="text"
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                placeholder="Label (optional — auto-detected from URL)"
                onKeyDown={e => { if (e.key === 'Enter' && urlInput.trim()) addLink(); if (e.key === 'Escape') { setAdding(false); setUrlInput(''); setLabelInput('') } }}
                style={{
                  width: '100%', fontSize: '12px', padding: '8px 10px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '6px', color: 'var(--text-primary)', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              {urlInput.trim() && (
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {(() => {
                    const t = detectLinkType(urlInput.trim())
                    const { icon: TypeIcon, color } = LINK_TYPE_ICON[t]
                    return <><TypeIcon size={10} color={color} /> Detected: {t}</>
                  })()}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setAdding(false); setUrlInput(''); setLabelInput('') }}
                  style={{
                    fontSize: '11px', padding: '5px 12px', background: 'none',
                    border: '1px solid var(--border)', borderRadius: '6px',
                    color: 'var(--text-tertiary)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={addLink}
                  disabled={!urlInput.trim() || saving}
                  style={{
                    fontSize: '11px', padding: '5px 12px',
                    background: urlInput.trim() ? 'var(--accent)' : 'var(--surface-hover)',
                    border: 'none', borderRadius: '6px',
                    color: urlInput.trim() ? '#fff' : 'var(--text-tertiary)',
                    cursor: urlInput.trim() ? 'pointer' : 'default',
                    fontWeight: 600,
                  }}
                >
                  {saving ? 'Saving...' : 'Add Link'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Actions Tab (merged To-Dos + Project Plan + Success Criteria) ────────────

function ActionsTab({ dealId, deal, onUpdate, members }: { dealId: string; deal: any; onUpdate: () => void; members: WorkspaceMember[] }) {
  const [subTab, setSubTab] = useState<'todos' | 'project-plan' | 'success'>('todos')

  const openTodos = (deal?.todos ?? []).filter((t: any) => !t.done).length
  const openTasks = (deal?.projectPlan as any)?.phases?.flatMap((p: any) => p.tasks ?? []).filter((t: any) => t.status !== 'complete').length ?? 0
  const openCriteria = (deal?.successCriteriaTodos as any[])?.filter((c: any) => !c.achieved).length ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Sub-tab pill navigation */}
      <div style={{ display: 'flex', gap: '6px', padding: '3px', background: 'var(--surface)', borderRadius: '8px', width: 'fit-content' }}>
        {([
          { id: 'todos', label: `To-Dos${openTodos > 0 ? ` (${openTodos})` : ''}` },
          { id: 'project-plan', label: `Project Plan${openTasks > 0 ? ` (${openTasks})` : ''}` },
          { id: 'success', label: `Success Criteria${openCriteria > 0 ? ` (${openCriteria})` : ''}` },
        ] as const).map(st => (
          <button
            key={st.id}
            onClick={() => setSubTab(st.id)}
            style={{
              padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontSize: '12px', fontWeight: '600', transition: 'all 0.15s',
              background: subTab === st.id ? 'var(--card-bg)' : 'transparent',
              color: subTab === st.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
              boxShadow: subTab === st.id ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
            }}
          >
            {st.label}
          </button>
        ))}
      </div>

      {subTab === 'todos' && (
        <TodosTab dealId={dealId} deal={deal} onUpdate={onUpdate} members={members} />
      )}
      {subTab === 'project-plan' && (
        <ProjectPlanTab dealId={dealId} deal={deal} onUpdate={onUpdate} members={members} />
      )}
      {subTab === 'success' && (
        <SuccessCriteriaTab dealId={dealId} deal={deal} onUpdate={onUpdate} members={members} />
      )}
    </div>
  )
}

// ─── Collateral Tab ──────────────────────────────────────────────────────────

function CollateralTab({ dealId, deal }: { dealId: string; deal: any }) {
  const { data: collateralRes } = useSWR('/api/collateral', fetcher)
  const allCollateral: any[] = collateralRes?.data ?? []

  // Filter client-side: match by dealId reference in content, title, or metadata
  const dealName: string = deal?.dealName ?? ''
  const company: string = deal?.prospectCompany ?? ''
  const dealCollateral = allCollateral.filter((c: any) => {
    if (c.dealId === dealId) return true
    const content = [c.title ?? '', c.content ?? '', c.generationSource ?? ''].join(' ').toLowerCase()
    const terms = [dealId, dealName, company].filter(Boolean).map(s => s.toLowerCase())
    return terms.some(t => t.length > 3 && content.includes(t))
  })

  const typeLabels: Record<string, string> = {
    proposal: 'Proposal',
    case_study: 'Case Study',
    one_pager: 'One-Pager',
    email_sequence: 'Email Sequence',
    battle_card: 'Battle Card',
    roi_calculator: 'ROI Calculator',
    custom: 'Custom',
  }

  const typeBadgeColors: Record<string, { bg: string; text: string }> = {
    proposal: { bg: 'rgba(99,102,241,0.1)', text: 'var(--accent)' },
    case_study: { bg: 'rgba(34,197,94,0.1)', text: 'var(--success)' },
    one_pager: { bg: 'rgba(245,158,11,0.1)', text: 'var(--warning)' },
    email_sequence: { bg: 'rgba(167,139,250,0.1)', text: '#7C3AED' },
    battle_card: { bg: 'rgba(239,68,68,0.1)', text: 'var(--danger)' },
    roi_calculator: { bg: 'rgba(16,185,129,0.1)', text: '#059669' },
    custom: { bg: 'var(--surface-hover)', text: 'var(--text-secondary)' },
  }

  if (collateralRes === undefined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2].map(i => (
          <div key={i} style={{ height: '80px', background: 'var(--surface)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
          {dealCollateral.length > 0 ? `${dealCollateral.length} piece${dealCollateral.length !== 1 ? 's' : ''} of collateral` : 'No collateral yet for this deal'}
        </span>
        <Link
          href={`/collateral?dealId=${dealId}`}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
            background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
            borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600',
            textDecoration: 'none',
          }}
        >
          <Sparkles size={13} /> Generate New
        </Link>
      </div>

      {dealCollateral.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '16px', padding: '60px 24px',
          background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: '14px',
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={22} color="var(--accent)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>No documents uploaded</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: '320px' }}>
              Upload proposals, contracts, or decks to keep everything in one place — or generate AI-tailored collateral in seconds.
            </div>
          </div>
          <Link
            href={`/collateral?dealId=${dealId}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px',
              background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
              borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600',
              textDecoration: 'none', boxShadow: 'var(--shadow)',
            }}
          >
            <Sparkles size={14} /> Generate Collateral
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {dealCollateral.map((c: any) => {
            const badge = typeBadgeColors[c.type] ?? typeBadgeColors.custom
            const createdDate = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
            return (
              <div
                key={c.id}
                style={{
                  background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                  borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.title || typeLabels[c.type] || 'Collateral'}
                    </div>
                    {createdDate && (
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{createdDate}</div>
                    )}
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px',
                    background: badge.bg, color: badge.text, whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {typeLabels[c.type] ?? c.type}
                  </span>
                </div>

                {c.status === 'generating' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--accent)' }}>
                    <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                    Generating…
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  <Link
                    href={`/collateral/${c.id}`}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      padding: '7px 12px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: '7px', color: 'var(--accent)', fontSize: '12px', fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <ExternalLink size={11} /> View
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Score Breakdown Visual ──────────────────────────────────────────────────

function ScoreBreakdown({ deal, mlPrediction, brainData }: { deal: any; mlPrediction: any; brainData: any }) {
  const score = deal.conversionScore ?? 0
  const mlProb = mlPrediction ? Math.round(mlPrediction.winProbability * 100) : null
  const churnRisk = mlPrediction?.churnRisk ?? 50
  const momentumPct = Math.max(0, 100 - churnRisk)  // high churn = low momentum

  // Three layers: ML, text signals, momentum (all scale to the composite score)
  const mlContrib = mlProb != null ? Math.round(mlProb * 0.6) : null
  const textContrib = mlProb != null ? Math.max(0, score - mlContrib!) : score
  const momentumContrib = Math.round(momentumPct * 0.1)

  const scoreColor = getScoreColor(score, false)
  const scoreBg = `color-mix(in srgb, ${scoreColor} 8%, transparent)`
  const scoreBorder = `color-mix(in srgb, ${scoreColor} 20%, transparent)`

  const drivers: any[] = mlPrediction?.scoreDrivers ?? []
  const archetype = mlPrediction?.archetypeId != null
    ? (brainData?.dealArchetypes ?? []).find((a: any) => a.id === mlPrediction.archetypeId)
    : null

  const similarWins = mlPrediction?.similarWins ?? []
  const similarLosses = mlPrediction?.similarLosses ?? []

  const [showBreakdown, setShowBreakdown] = useState(false)

  // Compute detailed breakdown signals for the tooltip
  const intentSignals = deal.intentSignals as any ?? {}
  const notes: string = (deal.meetingNotes ?? '').toLowerCase()
  const contacts = (deal.contacts ?? []) as any[]
  const noteCount = deal.meetingNotes ? (deal.meetingNotes.match(/^## /gm) ?? []).length || (deal.meetingNotes.length > 50 ? 1 : 0) : 0
  const championStatus = intentSignals?.championStatus ?? (/\bchampion\b|\bsponsor\b|\badvocate\b/.test(notes) ? 'confirmed' : 'none')
  const budgetStatus = intentSignals?.budgetStatus ?? (/budget (confirmed|approved|allocated|secured)/.test(notes) ? 'confirmed' : 'not_mentioned')
  const nextMeeting = intentSignals?.nextMeetingDate ?? (/next (meeting|call|session|step)/.test(notes) ? 'booked' : null)
  const stakeholderCount = contacts.length
  const sentimentScore = (deal.intentSignals as any)?.sentimentScore ?? null
  const daysSinceLastNote = deal.updatedAt ? Math.floor((Date.now() - new Date(deal.updatedAt).getTime()) / 86400000) : null

  // Reconstruct the text signal score components
  const championPts = (championStatus === 'confirmed' || championStatus === 'suspected') ? 8 : 0
  const budgetPts = budgetStatus === 'confirmed' ? 8 : 0
  const nextMeetingPts = nextMeeting ? 5 : 0
  const stakeholderPts = Math.min(stakeholderCount * 2, 6)
  const sentimentPts = sentimentScore != null ? Math.round((sentimentScore - 0.5) * 10) : 0
  const engagementPts = noteCount >= 3 ? 4 : noteCount >= 1 ? 2 : 0

  // Compute weights based on ML state
  const trainingSize = brainData?.mlModel?.trainingSize ?? 0
  const mlActive = mlProb != null && trainingSize >= 10
  const textWeight = mlActive ? Math.max(0, 1.0 - Math.min(0.70, 0.14 * Math.log(Math.max(trainingSize, 1))) - 0.05) : 0.70
  const mlWeight = mlActive ? Math.min(0.70, 0.14 * Math.log(Math.max(trainingSize, 1))) : 0.25
  const momWeight = 0.05

  // Compute raw text signal score (baseline 50 + adjustments)
  const rawTextScore = 50 + championPts + budgetPts + nextMeetingPts + stakeholderPts + sentimentPts + engagementPts
  const clampedTextScore = Math.max(0, Math.min(100, rawTextScore))

  const mlScoreVal = mlActive ? (mlProb ?? 0) : 50 // global prior = 50 in cold start
  const momentumComponent = 50 + Math.max(-10, Math.min(10, momentumContrib))
  const rawTotal = clampedTextScore * textWeight + mlScoreVal * mlWeight + momentumComponent * momWeight

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Deal Score</div>
        {mlPrediction?.confidence && (
          <div style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', background: 'var(--accent-subtle)', color: 'var(--accent)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {mlPrediction.confidence} confidence
          </div>
        )}
      </div>

      {/* Main score + bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ flexShrink: 0, width: '64px', height: '64px', borderRadius: '14px', background: scoreBg, border: `1px solid ${scoreBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: '800', color: scoreColor, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: '9px', color: scoreColor, marginTop: '1px' }}>/100</div>
        </div>
        <div style={{ flex: 1 }}>
          {/* Stacked contribution bar — clickable to expand breakdown */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowBreakdown(b => !b)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowBreakdown(b => !b) } }}
            style={{ marginBottom: '8px', cursor: 'pointer' }}
            title="Click to see full score breakdown"
          >
            <div style={{ height: '8px', borderRadius: '4px', display: 'flex', overflow: 'hidden', gap: '1px', background: 'var(--border)' }}>
              {mlContrib != null && (
                <div style={{ width: `${mlContrib}%`, background: 'var(--accent)', borderRadius: '4px 0 0 4px', transition: 'width 0.5s' }} title={`ML model: ${mlContrib}pts`} />
              )}
              <div style={{ width: `${textContrib}%`, background: 'var(--data-accent)', transition: 'width 0.5s' }} title={`Text signals: ${textContrib}pts`} />
              {momentumContrib > 0 && (
                <div style={{ width: `${momentumContrib}%`, background: 'var(--success)', borderRadius: '0 4px 4px 0', transition: 'width 0.5s' }} title={`Momentum: ${momentumContrib}pts`} />
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px', alignItems: 'center' }}>
              {mlContrib != null && <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-tertiary)' }}><div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--accent)', flexShrink: 0 }} />ML {mlContrib}pt</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-tertiary)' }}><div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--data-accent)', flexShrink: 0 }} />Signals {textContrib}pt</div>
              {momentumContrib > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-tertiary)' }}><div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--success)', flexShrink: 0 }} />Momentum {momentumContrib}pt</div>}
              <ChevronDown size={10} style={{ color: 'var(--text-tertiary)', marginLeft: 'auto', transition: 'transform 150ms', transform: showBreakdown ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Score Breakdown Detail (expanded) */}
      {showBreakdown && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>{score} / 100 — Score breakdown</div>
          <div style={{ borderBottom: '1px solid var(--border)', marginBottom: '6px' }} />

          {/* Text signals section */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Text signals:</span>
            <span>{clampedTextScore} x {textWeight.toFixed(2)} = {(clampedTextScore * textWeight).toFixed(1)}</span>
          </div>
          <div style={{ paddingLeft: '12px', color: 'var(--text-tertiary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Champion: {championStatus === 'confirmed' ? '\u2713 confirmed' : championStatus === 'suspected' ? '~ suspected' : '\u2014 not detected'}</span>
              <span style={{ color: championPts > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>+{championPts}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Budget: {budgetStatus === 'confirmed' ? '\u2713 confirmed' : budgetStatus === 'awaiting' ? '~ awaiting' : '\u2014 not discussed'}</span>
              <span style={{ color: budgetPts > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>+{budgetPts}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Next meeting: {nextMeeting ? '\u2713 booked' : '\u2014 none'}</span>
              <span style={{ color: nextMeetingPts > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>+{nextMeetingPts}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Stakeholders: {stakeholderCount} identified</span>
              <span style={{ color: stakeholderPts > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>+{stakeholderPts}</span>
            </div>
            {sentimentScore != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Sentiment: {sentimentScore >= 0.6 ? 'positive' : sentimentScore <= 0.4 ? 'negative' : 'neutral'} {sentimentScore.toFixed(2)}</span>
                <span style={{ color: sentimentPts >= 0 ? 'var(--success)' : 'var(--danger)' }}>{sentimentPts >= 0 ? '+' : ''}{sentimentPts}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Engagement: {noteCount} note{noteCount !== 1 ? 's' : ''}{daysSinceLastNote != null ? ` / ${daysSinceLastNote}d ago` : ''}</span>
              <span style={{ color: engagementPts > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>+{engagementPts}</span>
            </div>
          </div>

          <div style={{ marginTop: '4px' }} />

          {/* ML or Global Prior */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{mlActive ? 'ML model:' : 'Global prior:'}</span>
            <span>{Math.round(mlScoreVal)} x {mlWeight.toFixed(2)} = {(mlScoreVal * mlWeight).toFixed(1)}</span>
          </div>

          {/* Momentum */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Momentum:</span>
            <span>{momentumComponent.toFixed(1)} x {momWeight.toFixed(2)} = {(momentumComponent * momWeight).toFixed(1)}</span>
          </div>

          <div style={{ borderBottom: '1px solid var(--border)', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)' }}>
            <span>Total:</span>
            <span>{rawTotal.toFixed(1)} → rounded to {score}</span>
          </div>
        </div>
      )}

      {/* Score Drivers */}
      {drivers.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Top Score Drivers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {drivers.slice(0, 5).map((d: any, i: number) => {
              const isPos = d.direction === 'positive'
              const barWidth = Math.min(100, Math.abs(d.contribution) * 200)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '130px', fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
                  <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barWidth}%`, background: isPos ? 'var(--success)' : 'var(--danger)', borderRadius: '2px', transition: 'width 0.4s' }} />
                  </div>
                  <div style={{ fontSize: '10px', color: isPos ? 'var(--success)' : 'var(--danger)', fontWeight: '600', width: '20px', textAlign: 'right', flexShrink: 0 }}>
                    {isPos ? '↑' : '↓'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Archetype */}
      {archetype && (
        <div style={{ padding: '10px 12px', background: 'var(--accent-subtle)', border: '1px solid rgba(79,70,229,0.15)', borderRadius: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>Deal Archetype</div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{archetype.label}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{archetype.winRate}% win rate for this type · {String(archetype.winningCharacteristic)}</div>
        </div>
      )}

      {/* Similar deals */}
      {(similarWins.length > 0 || similarLosses.length > 0) && (
        <div>
          <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Similar Deals</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {similarWins.slice(0, 2).map((w: any, i: number) => (
              <Link key={`w-${i}`} href={`/deals/${w.dealId}`} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', background: 'color-mix(in srgb, var(--success) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)', color: 'var(--success)', textDecoration: 'none', transition: 'opacity 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                ✓ {w.company}
              </Link>
            ))}
            {similarLosses.slice(0, 2).map((l: any, i: number) => (
              <Link key={`l-${i}`} href={`/deals/${l.dealId}`} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)', color: 'var(--danger)', textDecoration: 'none', transition: 'opacity 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                ✗ {l.company}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const LINK_TYPE_OPTIONS = [
  { value: 'proposal',  label: 'Proposal' },
  { value: 'contract',  label: 'Contract' },
  { value: 'deck',      label: 'Deck' },
  { value: 'document',  label: 'Document' },
  { value: 'other',     label: 'Other' },
] as const

function linkIcon(type: string) {
  switch (type) {
    case 'proposal':  return <FileText  size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
    case 'contract':  return <FileCheck size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
    case 'deck':      return <BarChart2 size={13} style={{ color: 'var(--warning)', flexShrink: 0 }} />
    case 'document':  return <File      size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
    default:          return <Link2     size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
  }
}

function DealLinksSection({ deal, patchDeal }: { deal: any; patchDeal: (payload: Record<string, unknown>) => Promise<void> }) {
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newType, setNewType] = useState<string>('document')
  const [saving, setSaving] = useState(false)

  const links: DealLinkType[] = Array.isArray(deal.links) ? deal.links : []

  const inputSt: React.CSSProperties = {
    height: '30px', padding: '0 8px', borderRadius: '6px',
    background: 'var(--input-bg)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box',
  }

  const addLink = async () => {
    if (!newLabel.trim() || !newUrl.trim()) return
    setSaving(true)
    try {
      let url = newUrl.trim()
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url
      const newLink: DealLinkType = {
        id: crypto.randomUUID(),
        url,
        label: newLabel.trim(),
        type: newType as LinkTypeEnum,
        addedAt: new Date().toISOString(),
      }
      await patchDeal({ links: [...links, newLink] })
      setNewLabel('')
      setNewUrl('')
      setNewType('document')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  const removeLink = async (id: string) => {
    await patchDeal({ links: links.filter(l => l.id !== id) })
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: links.length > 0 || adding ? '10px' : '0' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Links</div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Plus size={11} /> Add link
          </button>
        )}
      </div>

      {links.length === 0 && !adding && (
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No links yet</div>
      )}

      {links.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: adding ? '10px' : '0' }}>
          {links.map(link => (
            <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {linkIcon(link.type)}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
              >
                {link.label}
              </a>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px', flexShrink: 0 }}>
                {(() => { try { return new URL(link.url).hostname } catch { return link.url } })()}
              </span>
              {link.addedAt && (
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  {new Date(link.addedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              )}
              <button
                onClick={() => removeLink(link.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '2px', borderRadius: '4px', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: links.length > 0 ? '8px' : '0', borderTop: links.length > 0 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <input
              style={{ ...inputSt, width: '100%' }}
              placeholder="Title (e.g. Proposal v2)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
            <select
              style={{ ...inputSt, width: '100%', cursor: 'pointer' }}
              value={newType}
              onChange={e => setNewType(e.target.value)}
            >
              {LINK_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <input
            style={{ ...inputSt, width: '100%' }}
            placeholder="URL (https://...)"
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addLink() }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={addLink}
              disabled={saving || !newLabel.trim() || !newUrl.trim()}
              style={{
                height: '28px', padding: '0 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                background: saving || !newLabel.trim() || !newUrl.trim() ? 'var(--surface)' : 'var(--accent)',
                color: saving || !newLabel.trim() || !newUrl.trim() ? 'var(--text-tertiary)' : '#fff',
                border: 'none', cursor: saving || !newLabel.trim() || !newUrl.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
            <button
              onClick={() => { setAdding(false); setNewLabel(''); setNewUrl(''); setNewType('document') }}
              style={{ height: '28px', padding: '0 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, background: 'transparent', color: 'var(--text-tertiary)', border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Activity Tab (merged Notes + Actions) ──────────────────────────────────

function ActivityTab({ dealId, deal, onUpdate, members }: { dealId: string; deal: any; onUpdate: () => void; members: WorkspaceMember[] }) {
  const dealCompetitors: string[] = deal?.competitors ?? []
  const { sendToCopilot } = useSidebar()
  const [updateText, setUpdateText] = useState('')
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [lastExtraction, setLastExtraction] = useState<{ extraction: any; analysedAt: string } | null>(null)
  const [verifyingExtraction, setVerifyingExtraction] = useState(false)

  const clearNotes = async () => {
    setClearing(true)
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingNotes: null }),
      })
      setClearConfirm(false)
      onUpdate()
    } finally {
      setClearing(false)
    }
  }

  const analyseNotes = async () => {
    if (!updateText.trim()) return
    setAnalysing(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/analyze-notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingNotes: updateText.trim() }),
      })
      const json = await res.json()
      if (json.data) {
        const extraction = json.data.parsed
        const signals = json.data.deal?.note_signals_json
          ? (typeof json.data.deal.note_signals_json === 'string' ? JSON.parse(json.data.deal.note_signals_json) : json.data.deal.note_signals_json)
          : null
        setLastExtraction({ extraction: { ...extraction, signals }, analysedAt: new Date().toISOString() })
        setUpdateText('')
        onUpdate()
      }
    } finally {
      setAnalysing(false)
    }
  }

  const confirmExtraction = async () => {
    if (!lastExtraction) return
    setVerifyingExtraction(true)
    try {
      const existing = deal?.note_signals_json
        ? (typeof deal.note_signals_json === 'string' ? JSON.parse(deal.note_signals_json) : deal.note_signals_json)
        : {}
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_signals_json: JSON.stringify({ ...existing, user_verified: true }) }),
      })
      setLastExtraction(null)
      onUpdate()
    } finally {
      setVerifyingExtraction(false)
    }
  }

  const deleteEntry = async (entryIndex: number) => {
    if (!deal?.meetingNotes) return
    const blocks = (deal.meetingNotes as string).split(/\n---\n/).map((b: string) => b.trim()).filter(Boolean)
    const entries = blocks.filter((b: string) => /^\[/.test(b))
    const legacy = blocks.filter((b: string) => !/^\[/.test(b))
    const updatedEntries = entries.filter((_: string, i: number) => i !== entryIndex)
    const updated = [...legacy, ...updatedEntries].join('\n---\n') || null
    await fetch(`/api/deals/${dealId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingNotes: updated }),
    })
    onUpdate()
  }

  // State for controlling expanded meeting entries — first 3 expanded by default
  const [collapsedEntries, setCollapsedEntries] = useState<Set<number>>(new Set())

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* ── Meeting History — most recent 3 expanded by default ── */}
      {deal?.meetingNotes && (() => {
        const raw = (deal.meetingNotes as string)
        const blocks = raw.split(/\n---\n/).map((b: string) => b.trim()).filter(Boolean)
        const entries = blocks.filter((b: string) => /^\[/.test(b))
        const legacy = blocks.filter((b: string) => !/^\[/.test(b))
        return (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clipboard size={13} color="var(--text-tertiary)" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Meeting History</span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--surface-hover)', borderRadius: '4px', padding: '1px 6px' }}>
                  {entries.length > 0 ? `${entries.length} meeting${entries.length > 1 ? 's' : ''}` : 'legacy notes'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {clearConfirm ? (
                  <>
                    <span style={{ fontSize: '11px', color: 'var(--danger)' }}>Clear all notes?</span>
                    <button
                      onClick={clearNotes}
                      disabled={clearing}
                      style={{ fontSize: '11px', color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '2px 8px', borderRadius: '5px', cursor: 'pointer' }}
                    >{clearing ? 'Clearing\u2026' : 'Yes, clear'}</button>
                    <button
                      onClick={() => setClearConfirm(false)}
                      style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >Cancel</button>
                  </>
                ) : (
                  <button
                    onClick={() => setClearConfirm(true)}
                    style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px' }}
                    title="Clear all notes for this deal"
                  >Clear all</button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {entries.length > 0 ? entries.map((entry: string, i: number) => {
                const dateMatch = entry.match(/^\[([^\]]+)\]/)
                const date = dateMatch?.[1] ?? ''
                const body = entry.slice(dateMatch?.[0].length ?? 0).trim()
                // First 3 entries expanded by default, rest collapsed
                const isExpanded = i < 3 ? !collapsedEntries.has(i) : !collapsedEntries.has(i) && i < 3
                const isExpandedActual = i < 3 ? !collapsedEntries.has(i) : collapsedEntries.has(i)
                // Simplified: first 3 default expanded, rest default collapsed
                const defaultExpanded = i < 3
                const isShown = defaultExpanded ? !collapsedEntries.has(i) : collapsedEntries.has(i)

                // Extract signal badges from the note body
                const signalBadges: { label: string; color: string; bg: string }[] = []
                const bodyLower = body.toLowerCase()
                if (POSITIVE_SIGNALS.some(s => bodyLower.includes(s))) signalBadges.push({ label: 'Positive', color: 'var(--success)', bg: 'rgba(34,197,94,0.1)' })
                if (NEGATIVE_SIGNALS.some(s => bodyLower.includes(s))) signalBadges.push({ label: 'Risk', color: 'var(--danger)', bg: 'rgba(239,68,68,0.1)' })
                if (URGENCY_SIGNALS.some(s => bodyLower.includes(s))) signalBadges.push({ label: 'Urgent', color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)' })
                if (dealCompetitors.some(c => c.trim() && bodyLower.includes(c.trim().toLowerCase()))) signalBadges.push({ label: 'Competitor', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' })

                return (
                  <div key={i} style={{ padding: '9px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', position: 'relative' }}
                    onMouseEnter={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.entry-del') as HTMLElement | null; if (btn) btn.style.opacity = '1' }}
                    onMouseLeave={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.entry-del') as HTMLElement | null; if (btn) btn.style.opacity = '0' }}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setCollapsedEntries(prev => {
                          const next = new Set(prev)
                          if (defaultExpanded) {
                            if (next.has(i)) next.delete(i); else next.add(i)
                          } else {
                            if (next.has(i)) next.delete(i); else next.add(i)
                          }
                          return next
                        })
                      }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <ChevronRight size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0, transition: 'transform 150ms', transform: isShown ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{date}</div>
                        {signalBadges.map((badge, bi) => (
                          <span key={bi} style={{ fontSize: '9px', fontWeight: 600, padding: '1px 5px', borderRadius: '3px', background: badge.bg, color: badge.color }}>{badge.label}</span>
                        ))}
                      </div>
                      <button
                        className="entry-del"
                        onClick={e => { e.stopPropagation(); deleteEntry(i) }}
                        style={{ opacity: 0, fontSize: '10px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', borderRadius: '3px', transition: 'opacity 0.15s' }}
                        title="Remove this entry"
                      >\u2715 remove</button>
                    </div>
                    {isShown && (
                      <div
                        style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '6px', paddingLeft: '20px' }}
                        dangerouslySetInnerHTML={{ __html: highlightSignals(body, dealCompetitors) }}
                      />
                    )}
                  </div>
                )
              }) : legacy.length > 0 ? (
                <div
                  style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: '1.7', margin: 0 }}
                  dangerouslySetInnerHTML={{ __html: highlightSignals(legacy.join('\n'), dealCompetitors) }}
                />
              ) : null}
            </div>
          </div>
        )
      })()}

      {/* Empty state — no notes yet */}
      {!deal?.meetingNotes && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '12px', padding: '32px 24px',
          background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: '14px',
          textAlign: 'center',
        }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clipboard size={18} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>No meeting notes yet</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: '340px' }}>
              Paste your first meeting note or transcript below to get AI-powered insights, risk detection, and action items.
            </div>
          </div>
        </div>
      )}

      <HubSpotActivityBlock deal={deal} dealCompetitors={deal?.competitors ?? []} />

      {/* ── Add Update ── */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Sparkles size={13} color="var(--accent)" />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {deal?.meetingNotes ? 'Add Update' : 'Log First Update'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>\u00B7 AI extracts signals automatically</span>
        </div>
        <textarea
          value={updateText}
          onChange={e => setUpdateText(e.target.value)}
          placeholder="Paste meeting notes or describe what happened \u2014 AI will extract signals, risks, and next steps."
          rows={6}
          style={{
            width: '100%', resize: 'vertical', background: 'var(--input-bg)',
            border: '1px solid var(--border)', borderRadius: '8px',
            color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.6',
            padding: '12px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              analyseNotes()
            }
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => {
              if (!updateText.trim()) return
              sendToCopilot(`Update for ${deal?.prospectCompany ?? 'this deal'}:\n\n${updateText.trim()}`)
              setUpdateText('')
            }}
            disabled={!updateText.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 12px', borderRadius: '7px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500',
              cursor: updateText.trim() ? 'pointer' : 'not-allowed', opacity: updateText.trim() ? 1 : 0.5,
            }}
          >
            <Sparkles size={11} />
            Ask AI copilot
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>\u2318\u21B5 to analyse</span>
            <button
              onClick={analyseNotes}
              disabled={!updateText.trim() || analysing}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px',
                background: updateText.trim() && !analysing ? 'linear-gradient(135deg, #6366F1, #7C3AED)' : 'var(--surface)',
                border: updateText.trim() && !analysing ? 'none' : '1px solid var(--border)',
                color: updateText.trim() && !analysing ? '#fff' : 'var(--text-tertiary)',
                fontSize: '13px', fontWeight: '600', cursor: updateText.trim() && !analysing ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              {analysing ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Analysing\u2026</> : <><Zap size={12} /> Analyse Notes</>}
            </button>
          </div>
        </div>
      </div>

      {/* Extraction confirmation card */}
      {lastExtraction && (() => {
        const ex = lastExtraction.extraction
        const signals = ex.signals
        const champStatus = ex.intentSignals?.championStatus ?? (signals?.champion_signal ? 'confirmed' : 'none')
        const budgetStatus = ex.intentSignals?.budgetStatus ?? signals?.budget_signal ?? 'not_mentioned'
        const timeline = ex.intentSignals?.decisionTimeline ?? signals?.decision_timeline ?? null
        const nextStep = signals?.next_step ?? null
        const competitors = (ex.competitors ?? []).length > 0 ? ex.competitors : (signals?.competitors_mentioned ?? [])
        const objections = signals?.objections ?? []
        const gaps = ex.productGaps ?? []
        const sentiment = signals?.sentiment_score ?? null
        const champLabel = champStatus === 'confirmed' ? '\u2713 Confirmed' : champStatus === 'suspected' ? '~ Likely' : '\u2014 Not detected'
        const champColor = champStatus === 'confirmed' ? 'var(--success)' : champStatus === 'suspected' ? 'var(--warning)' : 'var(--text-tertiary)'
        const budgetLabel = budgetStatus === 'approved' ? '\u2713 Confirmed' : budgetStatus === 'awaiting' ? '~ Awaiting approval' : budgetStatus === 'blocked' ? '\u26A0 Blocked' : '\u2014 Not discussed'
        const budgetColor = budgetStatus === 'approved' ? 'var(--success)' : budgetStatus === 'blocked' ? 'var(--danger)' : budgetStatus === 'awaiting' ? 'var(--warning)' : 'var(--text-tertiary)'
        return (
          <div style={{ background: 'color-mix(in srgb, var(--accent) 5%, var(--card-bg))', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <CheckCircle size={14} color="var(--accent)" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Note analysed</span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>\u2014 {new Date(lastExtraction.analysedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <button onClick={() => setLastExtraction(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '12px', padding: '2px 6px' }}>\u2715</button>
            </div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Extracted signals</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Champion</span>
                <span style={{ color: champColor, fontWeight: '600' }}>{champLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Budget</span>
                <span style={{ color: budgetColor, fontWeight: '600' }}>{budgetLabel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Timeline</span>
                <span style={{ color: timeline ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: '600' }}>{timeline ?? '\u2014 Not mentioned'}</span>
              </div>
              {nextStep && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Next step</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600', maxWidth: '200px', textAlign: 'right' }}>&ldquo;{nextStep}&rdquo;</span>
                </div>
              )}
              {competitors.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Competitors</span>
                  <span style={{ color: '#3B82F6', fontWeight: '600' }}>{competitors.join(', ')}</span>
                </div>
              )}
              {objections.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Objections</span>
                  <span style={{ color: 'var(--warning)', fontWeight: '600' }}>{objections.map((o: any) => o.theme).join(', ')} ({objections.length})</span>
                </div>
              )}
              {gaps.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Product gaps</span>
                  <span style={{ color: 'var(--danger)', fontWeight: '600' }}>{gaps.map((g: any) => g.title).join(', ')}</span>
                </div>
              )}
              {sentiment !== null && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Sentiment</span>
                  <span style={{ color: sentiment >= 0.6 ? 'var(--success)' : sentiment <= 0.4 ? 'var(--danger)' : 'var(--warning)', fontWeight: '600' }}>
                    {sentiment >= 0.6 ? 'Positive' : sentiment <= 0.4 ? 'Negative' : 'Neutral'} ({sentiment.toFixed(2)})
                  </span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={confirmExtraction}
                disabled={verifyingExtraction}
                style={{
                  flex: 2, padding: '8px 14px', borderRadius: '8px',
                  background: 'var(--accent)', border: 'none', color: '#fff',
                  fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                {verifyingExtraction ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Saving\u2026</> : <><Check size={12} /> Confirm & mark verified</>}
              </button>
              <button
                onClick={() => setLastExtraction(null)}
                style={{ flex: 1, padding: '8px 14px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )
      })()}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function OverviewTab({ dealId, deal, dealGaps, onUpdate, currencySymbol = '£', mlPrediction = null, globalPrior = null, brainData = null, objectionWinMap = [], objectionConditionalWins = [] }: { dealId: string; deal: any; dealGaps: any[]; onUpdate: () => void; currencySymbol?: string; mlPrediction?: any; globalPrior?: any; brainData?: any; objectionWinMap?: any[]; objectionConditionalWins?: any[] }) {
  const router = useRouter()
  const [expandingType, setExpandingType] = useState<string | null>(null)
  const { data: allDealsRes } = useSWR('/api/deals', fetcher)
  const expansionDeals = (allDealsRes?.data ?? []).filter((d: any) => d.parentDealId === deal.id)
  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')
  const [resetAIConfirm, setResetAIConfirm] = useState(false)
  const [savingAI, setSavingAI] = useState(false)

  const patchDeal = async (payload: Record<string, unknown>) => {
    setSavingAI(true)
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      onUpdate()
    } finally {
      setSavingAI(false)
    }
  }

  const deleteRisk = (index: number) => {
    const current: string[] = deal?.dealRisks ?? []
    patchDeal({ dealRisks: current.filter((_: string, i: number) => i !== index) })
  }

  const deleteInsight = (index: number) => {
    const current: string[] = deal?.conversionInsights ?? []
    patchDeal({ conversionInsights: current.filter((_: string, i: number) => i !== index) })
  }

  const saveSummary = () => {
    patchDeal({ aiSummary: summaryDraft.trim() || null })
    setEditingSummary(false)
  }

  const resetAllAI = async () => {
    // conversionScorePinned: false — ensure pin is cleared so AI can re-score after reset
    await patchDeal({ aiSummary: null, conversionScore: null, conversionScorePinned: false, conversionInsights: [], dealRisks: [] })
    setResetAIConfirm(false)
  }

  const handleExpand = async (expansionType: string) => {
    setExpandingType(expansionType)
    try {
      const res = await fetch(`/api/deals/${dealId}/expand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expansionType }),
      })
      const result = await res.json()
      if (result?.data?.id) {
        router.push(`/deals/${result.data.id}`)
      }
    } finally {
      setExpandingType(null)
    }
  }

  const expansionTypeColors: Record<string, string> = {
    upsell: 'var(--accent)',
    cross_sell: '#A78BFA',
    renewal: 'var(--success)',
    expansion: 'var(--warning)',
  }

  const expansionTypeLabels: Record<string, string> = {
    upsell: 'Upsell',
    cross_sell: 'Cross-sell',
    renewal: 'Renewal',
    expansion: 'Expansion',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Grow This Account — shown for closed_won deals */}
      {deal.stage === 'closed_won' && (
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: '12px', overflow: 'hidden', backdropFilter: 'blur(20px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <TrendingUp size={14} color="var(--success)" />
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--success)' }}>Grow This Account</span>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Create an expansion opportunity to grow this customer relationship
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {([
                { type: 'upsell', label: 'Upsell', icon: <ArrowUpRight size={12} /> },
                { type: 'cross_sell', label: 'Cross-sell', icon: <Layers size={12} /> },
                { type: 'renewal', label: 'Renewal', icon: <RefreshCw size={12} /> },
                { type: 'expansion', label: 'Expansion', icon: <Plus size={12} /> },
              ] as const).map(({ type, label, icon }) => {
                const color = expansionTypeColors[type]
                const isLoading = expandingType === type
                return (
                  <button
                    key={type}
                    onClick={() => handleExpand(type)}
                    disabled={!!expandingType}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 14px', borderRadius: '100px',
                      background: `${color}14`, border: `1px solid ${color}30`,
                      color, fontSize: '12px', fontWeight: 600, cursor: expandingType ? 'not-allowed' : 'pointer',
                      opacity: expandingType && !isLoading ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { if (!expandingType) { e.currentTarget.style.background = `${color}25`; e.currentTarget.style.borderColor = `${color}50` } }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${color}14`; e.currentTarget.style.borderColor = `${color}30` }}
                  >
                    {isLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : icon}
                    {isLoading ? 'Creating...' : label}
                  </button>
                )
              })}
            </div>

            {/* Existing expansion deals */}
            {expansionDeals.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Expansion Deals ({expansionDeals.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {expansionDeals.map((ed: any) => {
                    const eColor = expansionTypeColors[ed.expansionType] ?? 'var(--text-tertiary)'
                    const eLabel = expansionTypeLabels[ed.expansionType] ?? ed.expansionType
                    const stColor = (STAGE_COLORS as any)[ed.stage] ?? 'var(--text-tertiary)'
                    return (
                      <Link
                        key={ed.id}
                        href={`/deals/${ed.id}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: '8px', textDecoration: 'none', transition: 'border-color 150ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ed.dealName}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px',
                          background: `${stColor}18`, color: stColor, border: `1px solid ${stColor}35`,
                        }}>
                          {ed.stage?.replace(/_/g, ' ')}
                        </span>
                        {ed.dealValue && (
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--success)' }}>
                            {currencySymbol}{Number(ed.dealValue).toLocaleString()}
                          </span>
                        )}
                        <span style={{
                          fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px',
                          background: `${eColor}14`, color: eColor, border: `1px solid ${eColor}30`,
                        }}>
                          {eLabel}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Score Breakdown Visual — shown when a conversion score exists (active deals only) */}
      {deal.conversionScore != null && deal.stage !== 'closed_lost' && deal.stage !== 'closed_won' && (
        <ScoreBreakdown deal={deal} mlPrediction={mlPrediction} brainData={brainData} />
      )}

      {/* AI Analysis card — shown first if any AI data exists */}
      {(deal.aiSummary || deal.conversionScore != null || (deal.conversionInsights as string[])?.length > 0 || (deal.dealRisks as string[])?.length > 0) && (
        <div style={{ background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Header row with score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
            <Sparkles size={14} color="var(--accent)" />
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)' }}>Deal Intelligence</span>
            {(() => {
              const isClosed = deal.stage === 'closed_won' || deal.stage === 'closed_lost'
              const scoreDisplay = getScoreDisplay({
                compositeScore: deal.conversionScore ?? 0,
                isClosed,
                outcome: deal.stage === 'closed_won' ? 'won' : deal.stage === 'closed_lost' ? 'lost' : null,
              })
              if (isClosed) return (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: '600', padding: '4px 10px', borderRadius: '6px',
                    background: `color-mix(in srgb, ${scoreDisplay.color} 15%, transparent)`,
                    color: scoreDisplay.color,
                  }}>
                    {scoreDisplay.text}
                    {deal.lostDate || deal.wonDate ? ` · ${new Date(deal.lostDate || deal.wonDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                  </span>
                </div>
              )
              if (deal.conversionScore != null) return (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: scoreDisplay.color }}>
                    {deal.conversionScore >= 70 ? 'High likelihood' : deal.conversionScore >= 40 ? 'Needs attention' : 'At risk'}
                  </span>
                  <span style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '-0.04em', color: scoreDisplay.color }}>
                    {scoreDisplay.text}
                  </span>
                  <button onClick={() => patchDeal({ conversionScore: null })} title="Clear score" style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>✕</button>
                </div>
              )
              return null
            })()}
          </div>

          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Summary */}
            {editingSummary ? (
              <div>
                <textarea
                  value={summaryDraft}
                  onChange={e => setSummaryDraft(e.target.value)}
                  rows={4}
                  style={{ width: '100%', background: 'var(--surface)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.6', padding: '10px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button onClick={saveSummary} disabled={savingAI} style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '5px', color: 'var(--accent)', cursor: 'pointer' }}>
                    {savingAI ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingSummary(false)} style={{ fontSize: '11px', padding: '4px 10px', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : deal.aiSummary ? (
              <div style={{ position: 'relative' }}
                onMouseEnter={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.edit-summary-ov') as HTMLElement | null; if (btn) btn.style.opacity = '1' }}
                onMouseLeave={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.edit-summary-ov') as HTMLElement | null; if (btn) btn.style.opacity = '0' }}
              >
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', margin: 0, paddingRight: '32px' }}>{deal.aiSummary}</p>
                <button className="edit-summary-ov" onClick={() => { setSummaryDraft(deal.aiSummary); setEditingSummary(true) }}
                  style={{ opacity: 0, position: 'absolute', top: 0, right: 0, fontSize: '10px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s', padding: '2px 4px' }}>✎ edit</button>
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0, fontStyle: 'italic' }}>No summary yet — add updates via the AI assistant to generate insights.</p>
            )}

            {/* Insights — filter out score-summary insights (e.g. "rates X at 82/100") to avoid conflicting with ML score */}
            {(deal.conversionInsights as string[])?.filter((ins: string) => !/\d+\s*\/\s*100/i.test(ins))?.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Insights</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(deal.conversionInsights as string[]).filter((ins: string) => !/\d+\s*\/\s*100/i.test(ins)).map((insight: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: 'var(--text-secondary)' }}
                      onMouseEnter={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.del-insight-ov') as HTMLElement | null; if (btn) btn.style.opacity = '1' }}
                      onMouseLeave={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.del-insight-ov') as HTMLElement | null; if (btn) btn.style.opacity = '0' }}
                    >
                      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: '5px' }} />
                      <span style={{ flex: 1 }}>{insight}</span>
                      <button className="del-insight-ov" onClick={() => deleteInsight(i)} style={{ opacity: 0, fontSize: '10px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s', padding: '0 2px' }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risks */}
            {(deal.dealRisks as string[])?.length > 0 && (
              <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>⚠ Deal Risks</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {(deal.dealRisks as string[]).map((risk: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: 'var(--warning)' }}
                      onMouseEnter={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.del-risk-ov') as HTMLElement | null; if (btn) btn.style.opacity = '1' }}
                      onMouseLeave={e => { const btn = (e.currentTarget as HTMLElement).querySelector('.del-risk-ov') as HTMLElement | null; if (btn) btn.style.opacity = '0' }}
                    >
                      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--warning)', flexShrink: 0, marginTop: '5px' }} />
                      <span style={{ flex: 1 }}>{risk}</span>
                      <button className="del-risk-ov" onClick={() => deleteRisk(i)} style={{ opacity: 0, fontSize: '10px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s', padding: '0 2px' }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ML Score Drivers — what's pushing this deal's win probability up or down */}
            {mlPrediction?.scoreDrivers?.length > 0 && (
              <div style={{ padding: '10px 14px', background: 'rgba(129,140,248,0.04)', border: '1px solid rgba(129,140,248,0.12)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Score Drivers
                  <span style={{ fontSize: '9px', fontWeight: 400, color: 'var(--text-tertiary)', textTransform: 'none', marginLeft: '6px' }}>factors behind the {deal.conversionScore ?? '?'}% score</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {mlPrediction.scoreDrivers.map((d: any, i: number) => {
                    const barWidth = Math.min(100, Math.round(Math.abs(d.contribution) * 60))
                    const isPos = d.direction === 'positive'
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', color: isPos ? 'var(--success)' : 'var(--danger)', width: '10px', textAlign: 'center', flexShrink: 0 }}>{isPos ? '↑' : '↓'}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1, minWidth: 0 }}>{d.label}</span>
                        <div style={{ width: '60px', height: '4px', background: 'var(--surface-hover)', borderRadius: '2px', flexShrink: 0 }}>
                          <div style={{ width: `${barWidth}%`, height: '100%', borderRadius: '2px', background: isPos ? 'var(--success)' : 'var(--danger)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Industry context — "teams like yours" global benchmark */}
            {globalPrior && globalPrior.usingPrior && globalPrior.trainingSize > 0 && (() => {
              const gwr = globalPrior.globalWinRate as number
              const p50 = globalPrior.stageVelocityP50 as number
              const p75 = globalPrior.stageVelocityP75 as number
              const dealDays = deal.createdAt
                ? Math.round((Date.now() - new Date(deal.createdAt).getTime()) / 86400000)
                : null
              const isOpen = deal.stage !== 'closed_won' && deal.stage !== 'closed_lost'
              const velocityStatus = isOpen && dealDays != null && p50 > 0
                ? dealDays > p75 ? 'slow' : dealDays > p50 ? 'moderate' : 'fast'
                : null
              const velocityColor = velocityStatus === 'slow' ? 'var(--danger)' : velocityStatus === 'moderate' ? 'var(--warning)' : 'var(--success)'
              return (
                <div style={{ padding: '10px 14px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                    Industry Context
                    <span style={{ fontSize: '9px', fontWeight: 400, color: 'var(--text-tertiary)', textTransform: 'none', letterSpacing: 0, marginLeft: '6px' }}>
                      {globalPrior.trainingSize.toLocaleString()} similar deals
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Industry win rate</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{gwr}%</span>
                    </div>
                    {velocityStatus && dealDays != null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Deal age vs industry</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: velocityColor }}>
                          {dealDays}d — {velocityStatus === 'slow' ? `over p75 (${p75}d)` : velocityStatus === 'moderate' ? `p50–p75 (${p50}–${p75}d)` : `under median (${p50}d)`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Churn survival model — P(deal goes silent) for open deals */}
            {mlPrediction && typeof mlPrediction.churnRisk === 'number' && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost' && mlPrediction.churnRisk >= 40 && (() => {
              const risk = mlPrediction.churnRisk as number
              const daysOverdue = mlPrediction.churnDaysOverdue as number ?? 0
              const color = risk >= 75 ? 'var(--danger)' : risk >= 55 ? '#F97316' : 'var(--warning)'
              const label = risk >= 75 ? 'High risk of silence' : risk >= 55 ? 'Moderate silence risk' : 'Approaching threshold'
              return (
                <div style={{ padding: '10px 14px', background: `${color}08`, border: `1px solid ${color}28`, borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Churn Risk
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color }}>{risk}%</div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {label}
                    {daysOverdue > 0
                      ? ` — ${daysOverdue}d past the safe follow-up window for ${deal.stage} stage`
                      : ` — approaching the silence threshold for ${deal.stage} stage`}
                    {(deal.dealRisks ?? []).length >= 3 ? '. Multiple active risks increase the probability.' : ''}
                  </div>
                  <div style={{ marginTop: '6px', height: '3px', background: 'var(--surface-hover)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${risk}%`, background: color, borderRadius: '2px' }} />
                  </div>
                </div>
              )
            })()}

            {/* What To Do Next — first 5 open actions */}
            {(() => {
              const openTodos = (deal?.todos ?? []).filter((t: any) => !t.done)
              const companyName = deal?.prospectCompany?.toLowerCase() ?? ''
              const stripCompanyParens = (text: string) => {
                if (!companyName) return text
                return text.replace(new RegExp(`\\s*\\(${companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'gi'), '')
              }
              if (openTodos.length === 0) return null
              return (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>What To Do Next</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {openTodos.slice(0, 5).map((todo: any, i: number) => (
                      <div key={todo.id ?? i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: '5px' }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>{stripCompanyParens(todo.text)}</span>
                      </div>
                    ))}
                    {openTodos.length > 5 && (
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingLeft: '13px', marginTop: '2px' }}>
                        +{openTodos.length - 5} more in Activity tab
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Intent Signals — extracted by AI from deal updates */}
            {deal.intentSignals && (() => {
              const is = deal.intentSignals as { championStatus?: string; budgetStatus?: string; decisionTimeline?: string | null; nextMeetingBooked?: boolean }
              const champColor = is.championStatus === 'confirmed' ? 'var(--success)' : is.championStatus === 'suspected' ? 'var(--warning)' : 'var(--text-tertiary)'
              const champLabel = is.championStatus === 'confirmed' ? '✓ Confirmed' : is.championStatus === 'suspected' ? '~ Suspected' : '— None'
              const budgetColor = is.budgetStatus === 'approved' ? 'var(--success)' : is.budgetStatus === 'awaiting' ? 'var(--warning)' : is.budgetStatus === 'blocked' ? 'var(--danger)' : 'var(--text-tertiary)'
              const budgetLabel = is.budgetStatus === 'approved' ? '✓ Approved' : is.budgetStatus === 'awaiting' ? '⏳ Awaiting' : is.budgetStatus === 'blocked' ? '✕ Blocked' : '— Not discussed'
              return (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Intent Signals</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    <div style={{ padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Champion</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: champColor }}>{champLabel}</div>
                    </div>
                    <div style={{ padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Budget</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: budgetColor }}>{budgetLabel}</div>
                    </div>
                    <div style={{ padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Decision Timeline</div>
                      <div style={{ fontSize: '12px', color: is.decisionTimeline ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: is.decisionTimeline ? 500 : 400 }}>{is.decisionTimeline ?? '— Not mentioned'}</div>
                    </div>
                    <div style={{ padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '3px' }}>Next Meeting</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: is.nextMeetingBooked ? 'var(--success)' : 'var(--text-tertiary)' }}>{is.nextMeetingBooked ? '✓ Booked' : '— Not set'}</div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Score Simulator — moved from Intelligence tab */}
            {deal.conversionScore != null && (
              <ScoreSimulator deal={deal} mlPrediction={mlPrediction} brainData={brainData} />
            )}

            {/* What to focus on — specific to this deal's data */}
            {deal.stage && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost' && (
              <div style={{ padding: '10px 14px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>What to focus on</div>
                {deal.conversionScore == null ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                    Add deal updates and run AI analysis to get a health score and specific recommendations for this deal.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {/* Next step from deal data */}
                    {deal.nextSteps && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', padding: '1px 6px', flexShrink: 0, marginTop: '1px', letterSpacing: '0.04em' }}>NEXT</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{deal.nextSteps}</span>
                      </div>
                    )}
                    {/* Top risk */}
                    {((deal.dealRisks as string[]) ?? []).length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--warning)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '1px 6px', flexShrink: 0, marginTop: '1px', letterSpacing: '0.04em' }}>RISK</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{(deal.dealRisks as string[])[0]}</span>
                      </div>
                    )}
                    {/* First insight if no risks — filter out score summaries */}
                    {((deal.dealRisks as string[]) ?? []).length === 0 && ((deal.conversionInsights as string[]) ?? []).filter((ins: string) => !/\d+\s*\/\s*100/i.test(ins)).length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', padding: '1px 6px', flexShrink: 0, marginTop: '1px', letterSpacing: '0.04em' }}>KEY</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{((deal.conversionInsights as string[]) ?? []).filter((ins: string) => !/\d+\s*\/\s*100/i.test(ins))[0]}</span>
                      </div>
                    )}
                    {/* Fallback when no specific data */}
                    {!deal.nextSteps && ((deal.dealRisks as string[]) ?? []).length === 0 && ((deal.conversionInsights as string[]) ?? []).filter((ins: string) => !/\d+\s*\/\s*100/i.test(ins)).length === 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                        {deal.conversionScore < 40
                          ? 'Score critically low — add next steps and update meeting notes to identify specific blockers.'
                          : deal.conversionScore < 70
                          ? 'Add next steps to the deal and log latest meeting notes to surface specific actions here.'
                          : 'Strong position. Add next steps to keep this deal on track to close.'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Similar Deals — semantic embedding similarity */}
            {(() => {
              // eslint-disable-next-line react-hooks/rules-of-hooks
              const { data: similarData } = useSWR(deal?.id ? `/api/deals/${deal.id}/similar` : null, (url: string) => fetch(url).then(r => r.json()), { revalidateOnFocus: false })
              const similarDeals = similarData?.data ?? []
              // eslint-disable-next-line react-hooks/rules-of-hooks
              const [expandedSimilar, setExpandedSimilar] = useState<string | null>(null)
              if (similarDeals.length === 0) return null

              const formatDate = (iso: string | null) => {
                if (!iso) return null
                const d = new Date(iso)
                return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              }

              const outcomeLabel = (sd: any) => {
                const isClosed = sd.stage === 'closed_won' || sd.stage === 'closed_lost'
                const o = sd.outcome ?? (sd.stage === 'closed_won' ? 'won' : sd.stage === 'closed_lost' ? 'lost' : null)
                if (o === 'won' || o === 'lost') {
                  const display = getScoreDisplay({ compositeScore: sd.conversionScore ?? 0, isClosed: true, outcome: o })
                  return { text: display.text, color: display.color, date: formatDate(o === 'won' ? sd.wonDate : sd.lostDate) }
                }
                return { text: sd.stage?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), color: getScoreColor(sd.conversionScore ?? 0, isClosed), date: null }
              }

              return (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Similar Deals</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {similarDeals.slice(0, 5).map((sd: any) => {
                      const isExpanded = expandedSimilar === sd.id
                      const oc = outcomeLabel(sd)
                      return (
                        <div key={sd.id} style={{ background: 'var(--surface)', border: `1px solid ${isExpanded ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', transition: 'border-color 150ms ease', overflow: 'hidden' }}>
                          {/* Clickable header row */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setExpandedSimilar(isExpanded ? null : sd.id)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedSimilar(isExpanded ? null : sd.id) } }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                              padding: '8px 10px', cursor: 'pointer', userSelect: 'none',
                            }}
                            onMouseEnter={e => { if (!isExpanded) e.currentTarget.parentElement!.style.borderColor = 'var(--accent)' }}
                            onMouseLeave={e => { if (!isExpanded) e.currentTarget.parentElement!.style.borderColor = 'var(--border)' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                              <ChevronRight size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0, transition: 'transform 150ms', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {sd.prospectCompany}
                                  </span>
                                  <span style={{ fontSize: '10px', color: oc.color, fontWeight: 600, flexShrink: 0 }}>
                                    {oc.text}{oc.date ? ` ${oc.date}` : ''}
                                  </span>
                                </div>
                                {!isExpanded && sd.reason && (
                                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {sd.reason}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span style={{
                              fontSize: '10px', fontWeight: 600,
                              color: sd.similarity >= 80 ? 'var(--success)' : sd.similarity >= 60 ? '#A78BFA' : 'var(--text-tertiary)',
                              background: sd.similarity >= 80 ? 'rgba(34,197,94,0.1)' : sd.similarity >= 60 ? 'rgba(167,139,250,0.1)' : 'var(--surface)',
                              border: `1px solid ${sd.similarity >= 80 ? 'rgba(34,197,94,0.2)' : sd.similarity >= 60 ? 'rgba(167,139,250,0.2)' : 'var(--border)'}`,
                              borderRadius: '4px', padding: '1px 5px', flexShrink: 0,
                            }}>
                              {sd.similarity}% match
                            </span>
                          </div>

                          {/* Expanded detail panel */}
                          {isExpanded && (
                            <div style={{ padding: '0 10px 10px 28px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border)' }}>
                              <div style={{ height: '8px' }} />
                              {/* Why similar */}
                              {sd.reason && (
                                <div>
                                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Why similar</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{sd.reason}</div>
                                </div>
                              )}

                              {/* Loss reason (only for lost deals) */}
                              {(sd.outcome === 'lost' || sd.stage === 'closed_lost') && (
                                <div>
                                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Why it was lost</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    {sd.lostReason || 'No loss reason recorded'}
                                  </div>
                                </div>
                              )}

                              {/* Overlapping risks */}
                              {sd.overlappingRisks?.length > 0 && (
                                <div>
                                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Overlapping risks</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {sd.overlappingRisks.map((r: string, i: number) => (
                                      <div key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                        <span style={{ color: 'var(--warning)', flexShrink: 0 }}>!</span> {r}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* What to do differently */}
                              {sd.advice && (
                                <div style={{ padding: '6px 10px', background: 'color-mix(in srgb, var(--accent) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 15%, transparent)', borderRadius: '6px' }}>
                                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>What to do differently</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{sd.advice}</div>
                                </div>
                              )}

                              {/* Link to deal */}
                              <Link
                                href={`/deals/${sd.id}`}
                                style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                                onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
                                onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
                              >
                                View deal <ArrowUpRight size={10} />
                              </Link>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Likely Objections — moved from Intelligence tab */}
            {(() => {
              const dealRisks: string[] = deal?.dealRisks ?? []
              const profileObjRes = typeof window !== 'undefined' ? null : null // profile from SWR in parent scope
              // Use objectionWinMap + risk text to generate suggested responses
              const getResponseApproach = (text: string): string => {
                const lower = text.toLowerCase()
                if (/declined|no response|ghosted|gone quiet|not responding/.test(lower)) return 'Suggested: Try a different channel or reframe the value proposition with a new stakeholder.'
                if (/competitor|alternative|going with another|chosen/.test(lower)) return 'Suggested: Differentiate on unique strengths — focus on what competitors cannot offer.'
                if (/no champion|no sponsor|no advocate|no internal/.test(lower)) return 'Suggested: Identify an internal advocate — find someone who benefits most from the solution.'
                if (/budget|cost|expensive|price|roi/.test(lower)) return 'Suggested: Reframe around ROI and business impact — quantify the cost of inaction.'
                if (/delay|postpone|on hold|not a priority/.test(lower)) return 'Suggested: Create urgency by tying the solution to an upcoming deadline or business event.'
                return 'Suggested: Address directly in next meeting — prepare specific evidence to counter this concern.'
              }
              if (dealRisks.length === 0) return null
              return (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Likely Objections</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {dealRisks.map((risk, i) => (
                      <div key={`obj-${i}`} style={{ padding: '8px 10px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '7px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '11px' }}>&#9888;</span>
                          <span style={{ fontSize: '12px', color: 'var(--warning)', lineHeight: 1.5 }}>{risk}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', paddingLeft: '19px', lineHeight: 1.5, fontStyle: 'italic' }}>
                          {getResponseApproach(risk)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Win Stories — moved from Intelligence tab */}
            {(() => {
              // eslint-disable-next-line react-hooks/rules-of-hooks
              const { data: csRes } = useSWR('/api/case-studies', fetcher)
              const allCaseStudies: any[] = csRes?.data ?? []
              // eslint-disable-next-line react-hooks/rules-of-hooks
              const { data: similarDataWin } = useSWR(deal?.id ? `/api/deals/${deal.id}/similar` : null, (url: string) => fetch(url).then(r => r.json()), { revalidateOnFocus: false })
              const similarDealsForMatch = similarDataWin?.data ?? []
              if (allCaseStudies.length === 0) return null
              return (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Win Stories</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {allCaseStudies.slice(0, 3).map((cs: any) => {
                      // Try to find a match reason from similar deals
                      const matchDeal = similarDealsForMatch.find((sd: any) =>
                        sd.prospectCompany?.toLowerCase() === cs.customerName?.toLowerCase() ||
                        (sd.outcome === 'won' || sd.stage === 'closed_won')
                      )
                      const matchReason = matchDeal?.reason ?? null
                      return (
                        <div key={cs.id} style={{ padding: '10px 12px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>{cs.customerName}</div>
                          {cs.customerIndustry && <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>{cs.customerIndustry}{cs.customerSize ? ` \u00B7 ${cs.customerSize}` : ''}</div>}
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{cs.results || cs.description || 'No details available'}</div>
                          {matchReason && (
                            <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '6px', fontStyle: 'italic' }}>
                              Why relevant: {matchReason}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Reset all AI */}
            <div style={{ paddingTop: '4px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              {resetAIConfirm ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--danger)' }}>Reset all AI memory?</span>
                  <button onClick={resetAllAI} disabled={savingAI} style={{ fontSize: '11px', color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '2px 8px', borderRadius: '5px', cursor: 'pointer' }}>
                    {savingAI ? 'Resetting…' : 'Yes, reset'}
                  </button>
                  <button onClick={() => setResetAIConfirm(false)} style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setResetAIConfirm(true)} style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Reset all AI inferences
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product gaps banner */}
      {dealGaps.length > 0 && (
        <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Product Gaps ({dealGaps.length})
            </div>
            <Link href="/product-gaps" style={{ fontSize: '11px', color: 'var(--danger)', textDecoration: 'none', opacity: 0.7 }}>View all →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {dealGaps.map((g: any) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: g.priority === 'critical' ? 'var(--danger)' : g.priority === 'high' ? 'var(--warning)' : 'var(--accent)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-primary)', flex: 1 }}>{g.title}</span>
                {g.roadmap && <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--surface)', borderRadius: '4px', padding: '1px 5px' }}>{g.roadmap}</span>}
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{g.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deal info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {[
          { label: 'Stage', value: deal.stage?.replace(/_/g, ' '), preWrap: false },
          { label: 'Deal Value', value: deal.dealValue ? `${currencySymbol}${Number(deal.dealValue).toLocaleString()}` : null, preWrap: false },
          { label: 'Close Date', value: deal.closeDate ? new Date(deal.closeDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null, preWrap: false },
          { label: 'Deal Type', value: deal.dealType === 'recurring' ? `Recurring (${deal.recurringInterval ?? ''})`.trim() : deal.dealType === 'one_off' ? 'One-off' : null, preWrap: false },
          { label: 'Engagement', value: deal.engagementType ?? null, preWrap: false },
          { label: 'Competitors', value: (deal.competitors as string[])?.join(', ') || null, preWrap: false },
          { label: 'Description', value: deal.description, preWrap: true },
          { label: 'Notes', value: deal.notes, preWrap: true },
          { label: 'Next Steps', value: deal.nextSteps, preWrap: true },
        ].filter(f => f.value).map(({ label, value, preWrap }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500', lineHeight: 1.5, whiteSpace: preWrap ? 'pre-wrap' : undefined }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Contract dates */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', minWidth: '200px' }}>
          <label style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, whiteSpace: 'nowrap' }}>Contract Start</label>
          <input
            type="date"
            value={deal.contractStartDate ? new Date(deal.contractStartDate).toISOString().split('T')[0] : ''}
            onChange={async (e) => {
              const val = e.target.value
              await patchDeal({ contractStartDate: val || null })
            }}
            style={{
              flex: 1, height: '30px', padding: '0 8px', borderRadius: '6px',
              background: 'var(--input-bg)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontSize: '12px', outline: 'none',
              boxSizing: 'border-box' as const, fontFamily: 'inherit',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '12px', flexShrink: 0 }}>&mdash;</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', minWidth: '200px' }}>
          <label style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, whiteSpace: 'nowrap' }}>Contract End</label>
          <input
            type="date"
            value={deal.contractEndDate ? new Date(deal.contractEndDate).toISOString().split('T')[0] : ''}
            onChange={async (e) => {
              const val = e.target.value
              await patchDeal({ contractEndDate: val || null })
            }}
            style={{
              flex: 1, height: '30px', padding: '0 8px', borderRadius: '6px',
              background: 'var(--input-bg)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontSize: '12px', outline: 'none',
              boxSizing: 'border-box' as const, fontFamily: 'inherit',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
      </div>

      {/* Contacts */}
      {Array.isArray(deal.contacts) && deal.contacts.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Contacts</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(deal.contacts as any[]).map((c: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' }}>
                <User size={12} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.name}</span>
                {c.title && <span style={{ color: 'var(--text-tertiary)' }}>· {c.title}</span>}
                {c.email && <a href={`mailto:${c.email}`} style={{ color: 'var(--accent)', marginLeft: 'auto', fontSize: '11px', textDecoration: 'none' }}>{c.email}</a>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document Links */}
      <DealLinksSection deal={deal} patchDeal={patchDeal} />

      {/* Activity log */}
      <ActivityLog dealId={dealId} deal={deal} onUpdate={onUpdate} />
    </div>
  )
}

export default function DealDetailPage() {
  const { id } = useParams() as { id: string }
  const { data, mutate } = useSWR(id ? `/api/deals/${id}` : null, fetcher)
  const deal = data?.data ?? data
  const { data: gapsData } = useSWR('/api/product-gaps', fetcher)
  const dealGaps: any[] = (gapsData?.data ?? []).filter((g: any) => (g.sourceDeals as string[] ?? []).includes(id))
  const { data: configData } = useSWR('/api/pipeline-config', fetcher, { revalidateOnFocus: false })
  const currencySymbol: string = configData?.data?.currency ?? '£'
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const mlPrediction = (brainRes?.data?.mlPredictions ?? []).find((p: any) => p.dealId === id) ?? null
  const objectionWinMap: any[] = brainRes?.data?.objectionWinMap ?? []
  const objectionConditionalWins: any[] = brainRes?.data?.objectionConditionalWins ?? []
  const globalPrior: any = brainRes?.data?.globalPrior ?? null
  const { setActiveDeal } = useSidebar()
  const workspaceMembers = useWorkspaceMembers()

  // Fetch parent deal if this is an expansion deal
  const { data: parentDealRes } = useSWR(
    deal?.parentDealId ? `/api/deals/${deal.parentDealId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )
  const parentDeal = parentDealRes?.data ?? parentDealRes

  const expansionTypeLabels: Record<string, string> = {
    upsell: 'Upsell',
    cross_sell: 'Cross-sell',
    renewal: 'Renewal',
    expansion: 'Expansion',
  }

  const expansionTypeColors: Record<string, string> = {
    upsell: 'var(--accent)',
    cross_sell: '#A78BFA',
    renewal: 'var(--success)',
    expansion: 'var(--warning)',
  }

  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'plans' | 'collateral'>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [winStoryOpen, setWinStoryOpen] = useState(false)
  const [wonDeal, setWonDeal] = useState<any>(null)

  // Register this deal as active context for the AI chat sidebar
  useEffect(() => {
    if (deal) {
      setActiveDeal({ id: deal.id, name: deal.dealName, company: deal.prospectCompany, stage: deal.stage })
    }
    return () => setActiveDeal(null)
  }, [deal?.id, deal?.dealName, deal?.prospectCompany, deal?.stage])

  // Auto-switch to Notes tab only if deal has no AI data at all AND no notes
  useEffect(() => {
    if (deal && !deal.meetingNotes && !deal.aiSummary && !deal.conversionScore) {
      setActiveTab('activity')
    }
  }, [deal?.id])

  if (!deal && data !== undefined) {
    return (
      <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-tertiary)' }}>
        Deal not found. <Link href="/deals" style={{ color: 'var(--accent)' }}>Back to deals</Link>
      </div>
    )
  }

  const stageColor = STAGE_COLORS[deal?.stage] ?? 'var(--text-tertiary)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Back + header */}
      <div>
        <Link href="/deals" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-tertiary)', fontSize: '13px', textDecoration: 'none', marginBottom: '14px' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
        >
          <ArrowLeft size={13} /> Back to deals
        </Link>

        {/* Parent deal breadcrumb for expansion deals */}
        {deal?.parentDealId && parentDeal && (() => {
          const eType = deal.expansionType as string | undefined
          const eColor = eType ? (expansionTypeColors[eType] ?? 'var(--text-tertiary)') : 'var(--text-tertiary)'
          const eLabel = eType ? (expansionTypeLabels[eType] ?? eType) : 'Expansion'
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px',
              fontSize: '12px', color: 'var(--text-tertiary)',
            }}>
              <span>Expansion from:</span>
              <Link
                href={`/deals/${deal.parentDealId}`}
                style={{
                  color: 'var(--accent)', textDecoration: 'none', fontWeight: 600,
                }}
                onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
                onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
              >
                {parentDeal.prospectCompany ?? parentDeal.dealName ?? 'Parent Deal'}
              </Link>
              <span style={{
                fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px',
                background: `${eColor}14`, color: eColor, border: `1px solid ${eColor}30`,
              }}>
                {eLabel}
              </span>
            </div>
          )
        })()}

        {deal ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0 }}>
                  {deal.prospectCompany}
                </h1>
                <span style={{
                  fontSize: '11px', padding: '3px 10px', borderRadius: '100px', fontWeight: '600',
                  background: `${stageColor}18`, color: stageColor, border: `1px solid ${stageColor}35`,
                }}>
                  {deal.stage?.replace('_', ' ')}
                </span>
                {deal.conversionScore != null && (() => {
                  const isClosed = deal.stage === 'closed_won' || deal.stage === 'closed_lost'
                  const c = getScoreColor(deal.conversionScore, isClosed)
                  return (
                    <span style={{
                      fontSize: '12px', padding: '3px 10px', borderRadius: '100px', fontWeight: '700',
                      background: `color-mix(in srgb, ${c} 10%, transparent)`,
                      color: c,
                      border: `1px solid color-mix(in srgb, ${c} 25%, transparent)`,
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                      <Target size={10} /> {deal.conversionScore}% win probability
                    </span>
                  )
                })()}
                {deal.engagementType && (
                  <span style={{
                    fontSize: '11px', padding: '3px 10px', borderRadius: '100px', fontWeight: '600',
                    background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}>
                    {deal.engagementType}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {deal.prospectName && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={11} />{deal.prospectName}</span>}
                {deal.dealValue && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontWeight: '600' }}><Banknote size={11} />{currencySymbol}{Number(deal.dealValue).toLocaleString()}</span>}
                {deal.closeDate && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} />Close {new Date(deal.closeDate).toLocaleDateString()}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditOpen(true)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                background: 'var(--surface-hover)', border: '1px solid var(--border-strong)',
                borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              }}>
                <Edit size={13} /> Edit
              </button>
              <Link href={`/collateral?dealId=${id}`} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                background: 'linear-gradient(135deg, #6366F1, #7C3AED)', boxShadow: 'var(--shadow)',
                border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none',
              }}>
                <Sparkles size={13} /> Generate Collateral
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ height: '40px', background: 'var(--surface)', borderRadius: '8px', width: '300px', animation: 'pulse 1.5s infinite' }} />
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'activity', label: 'Activity' },
          { id: 'plans', label: (() => {
            const openTodos = deal?.todos?.filter((t: any) => !t.done) ?? []
            const openTasks = (deal?.projectPlan as any)?.phases?.flatMap((p: any) => p.tasks ?? []).filter((t: any) => t.status !== 'complete') ?? []
            const openCriteria = (deal?.successCriteriaTodos as any[])?.filter((c: any) => !c.achieved) ?? []
            const total = openTodos.length + openTasks.length + openCriteria.length
            if (total === 0) return 'Plans'
            return `Plans (${total})`
          })() },
          { id: 'collateral', label: 'Collateral' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{
            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
            color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
            borderBottom: activeTab === tab.id ? '2px solid #6366F1' : '2px solid transparent',
            marginBottom: '-1px', transition: 'color 0.1s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Edit deal modal */}
      <EditDealModal
        deal={deal} dealId={id} open={editOpen} onOpenChange={setEditOpen}
        onSaved={() => mutate()}
        onWon={(data) => { setWonDeal(data); setWinStoryOpen(true) }}
      />
      {/* Win story capture */}
      <WinStoryPromptModal wonDeal={wonDeal} open={winStoryOpen} onOpenChange={setWinStoryOpen} currencySymbol={currencySymbol} />

      {/* Tab content */}
      {!deal ? (
        <div style={{ height: '200px', background: 'var(--surface)', borderRadius: '12px' }} />
      ) : (
        <div>
          {activeTab === 'overview' && (
            <OverviewTab dealId={id} deal={deal} dealGaps={dealGaps} onUpdate={() => mutate()} currencySymbol={currencySymbol} mlPrediction={mlPrediction} globalPrior={globalPrior} brainData={brainRes?.data} objectionWinMap={objectionWinMap} objectionConditionalWins={objectionConditionalWins} />
          )}
          {activeTab === 'activity' && (
            <ActivityTab dealId={id} deal={deal} onUpdate={() => mutate()} members={workspaceMembers} />
          )}
          {activeTab === 'plans' && (
            <ActionsTab dealId={id} deal={deal} onUpdate={() => mutate()} members={workspaceMembers} />
          )}
          {activeTab === 'collateral' && (
            <CollateralTab dealId={id} deal={deal} />
          )}
        </div>
      )}
    </div>
  )
}
