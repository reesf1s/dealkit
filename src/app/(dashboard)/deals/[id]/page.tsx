'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import useSWR from 'swr'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Target,
  Trash2,
  WandSparkles,
  Zap,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { useToast } from '@/components/shared/Toast'
import { MiniBarChart } from '@/components/shared/MiniBarChart'
import type { DealContact, DealLink, DealLinkType } from '@/types'
import { buildDealSnapshot } from '@/lib/deal-snapshot'

type DealStage =
  | 'prospecting'
  | 'qualification'
  | 'discovery'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost'

type ForecastCategory = 'commit' | 'upside' | 'pipeline' | 'omit' | null

type TodoItem = {
  id?: string
  text?: string
  done?: boolean
  source?: 'table' | 'legacy' | 'ai' | string
  priority?: 'low' | 'normal' | 'high'
  createdAt?: string
}

type ScoreHistoryPoint = {
  score?: number
  date?: string
}

type DealRecord = {
  id: string
  dealName: string
  prospectCompany: string
  prospectName?: string | null
  prospectTitle?: string | null
  stage: DealStage
  dealValue?: number | null
  forecastCategory?: ForecastCategory
  closeDate?: string | null
  nextSteps?: string | null
  notes?: string | null
  meetingNotes?: string | null
  aiSummary?: string | null
  conversionScore?: number | null
  conversionInsights?: string[] | null
  dealRisks?: string[] | null
  competitors?: string[] | null
  contacts?: DealContact[] | null
  links?: DealLink[] | null
  todos?: TodoItem[] | null
  scoreHistory?: ScoreHistoryPoint[] | null
  updatedAt: string
  createdAt: string
}

type PipelineStage = {
  id: string
  label: string
  color?: string
  isHidden?: boolean
}

type PipelineConfig = {
  stages?: PipelineStage[]
}

type FormState = {
  dealName: string
  prospectCompany: string
  prospectName: string
  prospectTitle: string
  stage: DealStage
  dealValue: string
  forecastCategory: ForecastCategory
  closeDate: string
  nextSteps: string
  contacts: DealContact[]
  links: DealLink[]
}

const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'prospecting', label: 'Prospecting', color: '#64748b' },
  { id: 'qualification', label: 'Qualification', color: '#60a5fa' },
  { id: 'discovery', label: 'Discovery', color: '#a78bfa' },
  { id: 'proposal', label: 'Proposal', color: '#fbbf24' },
  { id: 'negotiation', label: 'Negotiation', color: '#fb7185' },
  { id: 'closed_won', label: 'Closed Won', color: '#4ade80' },
  { id: 'closed_lost', label: 'Closed Lost', color: '#f87171' },
]

const LINK_TYPES: DealLinkType[] = [
  'proposal',
  'contract',
  'deck',
  'document',
  'sharepoint',
  'google',
  'salesforce',
  'notion',
  'figma',
  'github',
  'other',
]

function toDateInput(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toCurrency(value?: number | null): string {
  if (value == null) return '—'
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `£${Math.round(value / 1_000)}k`
  return `£${Math.round(value)}`
}

function relTime(iso?: string | null): string {
  if (!iso) return '—'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function removeLatestMeetingEntry(meetingNotes?: string | null): string | null {
  const raw = (meetingNotes ?? '').replace(/\r/g, '').trim()
  if (!raw) return null

  const separatorEntries = raw
    .split(/\n---\n+/)
    .map(entry => entry.trim())
    .filter(Boolean)
  if (separatorEntries.length > 1) {
    return separatorEntries.slice(0, -1).join('\n---\n').trim() || null
  }

  const dateHeaders = [...raw.matchAll(/^\[(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\]\s*/gm)]
  if (dateHeaders.length > 1) {
    const lastIdx = dateHeaders[dateHeaders.length - 1]?.index ?? -1
    if (lastIdx > 0) {
      return raw.slice(0, lastIdx).trim() || null
    }
  }

  return null
}

function getRiskState(score: number, staleDays: number): { label: string; color: string } {
  if (staleDays >= 14) return { label: 'Stale', color: '#fb7185' }
  if (score >= 75) return { label: 'Healthy', color: '#4ade80' }
  if (score >= 45) return { label: 'Watch', color: '#fbbf24' }
  return { label: 'At Risk', color: '#fb7185' }
}

function normaliseContact(contact: DealContact): DealContact {
  return {
    name: contact.name?.trim() ?? '',
    title: contact.title?.trim() || undefined,
    email: contact.email?.trim() || undefined,
  }
}

function normaliseLink(link: DealLink): DealLink {
  return {
    ...link,
    label: link.label?.trim() ?? '',
    url: link.url?.trim() ?? '',
    type: link.type ?? 'other',
    addedAt: link.addedAt ?? new Date().toISOString(),
  }
}

function toFormState(deal: DealRecord): FormState {
  return {
    dealName: deal.dealName ?? '',
    prospectCompany: deal.prospectCompany ?? '',
    prospectName: deal.prospectName ?? '',
    prospectTitle: deal.prospectTitle ?? '',
    stage: deal.stage,
    dealValue: deal.dealValue != null ? String(deal.dealValue) : '',
    forecastCategory: deal.forecastCategory ?? null,
    closeDate: toDateInput(deal.closeDate),
    nextSteps: deal.nextSteps ?? '',
    contacts: (deal.contacts ?? []).map(normaliseContact),
    links: (deal.links ?? []).map(normaliseLink),
  }
}

function formFingerprint(form: FormState): string {
  return JSON.stringify({
    ...form,
    dealValue: form.dealValue.trim(),
    closeDate: form.closeDate || null,
    contacts: form.contacts.map(normaliseContact),
    links: form.links.map(normaliseLink),
  })
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0,
  color: 'var(--text-primary)',
  textTransform: 'none',
}

const sectionLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  letterSpacing: '0.01em',
  textTransform: 'none',
  fontWeight: 600,
  color: 'var(--text-tertiary)',
}

export default function DealDetailPage() {
  const params = useParams<{ id: string | string[] }>()
  const router = useRouter()
  const { toast } = useToast()

  const dealId = Array.isArray(params.id) ? params.id[0] : params.id

  const [form, setForm] = useState<FormState | null>(null)
  const [aiInput, setAiInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [regeneratingIntel, setRegeneratingIntel] = useState(false)
  const [resettingIntel, setResettingIntel] = useState(false)
  const [removingLatestUpdate, setRemovingLatestUpdate] = useState(false)
  const [newTodoText, setNewTodoText] = useState('')
  const [newTodoPriority, setNewTodoPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [todoSubmitting, setTodoSubmitting] = useState(false)
  const [todoSavingId, setTodoSavingId] = useState<string | null>(null)
  const [todoDeletingId, setTodoDeletingId] = useState<string | null>(null)
  const hydratedDealId = useRef<string | null>(null)
  const lastServerFingerprint = useRef<string>('')

  const { data: dealRes, isLoading, mutate } = useSWR<{ data: DealRecord }>(
    dealId ? `/api/deals/${dealId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const { data: pipelineConfigRes } = useSWR<{ data: PipelineConfig }>(
    '/api/pipeline-config',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  )

  const deal = dealRes?.data

  useEffect(() => {
    if (!deal) return
    const nextServerForm = toFormState(deal)
    const nextServerFingerprint = formFingerprint(nextServerForm)
    setForm(prev => {
      if (!prev || hydratedDealId.current !== deal.id) {
        hydratedDealId.current = deal.id
        lastServerFingerprint.current = nextServerFingerprint
        return nextServerForm
      }
      const currentForm = formFingerprint(prev)
      if (currentForm === lastServerFingerprint.current) {
        lastServerFingerprint.current = nextServerFingerprint
        return nextServerForm
      }
      return prev
    })
  }, [deal])

  const stages = useMemo(() => {
    const source = pipelineConfigRes?.data?.stages?.length
      ? pipelineConfigRes.data.stages
      : DEFAULT_STAGES
    return source.filter(stage => !stage.isHidden || stage.id.startsWith('closed_'))
  }, [pipelineConfigRes?.data?.stages])

  const chartValues = useMemo(() => {
    const source = deal?.scoreHistory ?? []
    const mapped = source
      .map(point => Math.max(1, Math.min(10, Math.round((point.score ?? 0) / 10))))
      .slice(-12)
    if (mapped.length === 0) {
      const current = Math.max(1, Math.min(10, Math.round((deal?.conversionScore ?? 45) / 10)))
      return [current, current, current, current, current, current]
    }
    return mapped
  }, [deal?.scoreHistory, deal?.conversionScore])

  const staleDays = useMemo(() => {
    if (!deal?.updatedAt) return 0
    return Math.floor((Date.now() - new Date(deal.updatedAt).getTime()) / 86_400_000)
  }, [deal?.updatedAt])

  const score = deal?.conversionScore ?? 0
  const risk = getRiskState(score, staleDays)
  const dealSnapshot = useMemo(
    () =>
      buildDealSnapshot({
        stage: deal?.stage,
        nextSteps: deal?.nextSteps,
        notes: deal?.notes,
        meetingNotes: deal?.meetingNotes,
        aiSummary: deal?.aiSummary,
        dealRisks: deal?.dealRisks,
      }),
    [
      deal?.stage,
      deal?.nextSteps,
      deal?.notes,
      deal?.meetingNotes,
      deal?.aiSummary,
      deal?.dealRisks,
    ],
  )
  const snapshotDateLabel = useMemo(() => {
    if (!dealSnapshot.latestDateLabel) return relTime(deal?.updatedAt)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dealSnapshot.latestDateLabel)) {
      const parsed = new Date(`${dealSnapshot.latestDateLabel}T00:00:00Z`)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      }
    }
    return dealSnapshot.latestDateLabel
  }, [deal?.updatedAt, dealSnapshot.latestDateLabel])

  const stageMeta = useMemo(() => {
    const stage = stages.find(item => item.id === deal?.stage)
    if (stage) return stage
    return DEFAULT_STAGES.find(item => item.id === deal?.stage) ?? DEFAULT_STAGES[0]
  }, [deal?.stage, stages])

  const hasChanges = useMemo(() => {
    if (!deal || !form) return false
    return formFingerprint(form) !== formFingerprint(toFormState(deal))
  }, [deal, form])

  const todos = useMemo(() => {
    return (deal?.todos ?? [])
      .filter(item => typeof item?.text === 'string' && item.text.trim().length > 0)
  }, [deal?.todos])

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => (prev ? { ...prev, [key]: value } : prev))
  }

  const saveDeal = async () => {
    if (!dealId || !form) return

    const parsedDealValue = form.dealValue.trim() === '' ? null : Number(form.dealValue.replace(/,/g, ''))
    if (parsedDealValue != null && Number.isNaN(parsedDealValue)) {
      toast('Deal value must be a number', 'error')
      return
    }

    if (!form.dealName.trim() || !form.prospectCompany.trim()) {
      toast('Deal name and company are required', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        dealName: form.dealName.trim(),
        prospectCompany: form.prospectCompany.trim(),
        prospectName: form.prospectName.trim() || null,
        prospectTitle: form.prospectTitle.trim() || null,
        stage: form.stage,
        dealValue: parsedDealValue,
        forecastCategory: form.forecastCategory,
        closeDate: form.closeDate || null,
        nextSteps: form.nextSteps.trim() || null,
        contacts: form.contacts
          .map(normaliseContact)
          .filter(contact => contact.name && contact.name.length > 0),
        links: form.links
          .map(normaliseLink)
          .filter(link => link.label && link.url)
          .map(link => ({
            ...link,
            id: link.id || crypto.randomUUID(),
            addedAt: link.addedAt || new Date().toISOString(),
          })),
      }

      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to save deal')
      }

      const json = await res.json()
      const updated = json?.data as DealRecord
      if (updated) setForm(toFormState(updated))
      await mutate()
      toast('Deal updated', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to save deal', 'error')
    } finally {
      setSaving(false)
    }
  }

  const deleteDeal = async () => {
    if (!dealId || !deal) return
    const ok = window.confirm(`Delete ${deal.prospectCompany} from pipeline? This cannot be undone.`)
    if (!ok) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to delete deal')
      }
      toast('Deal deleted', 'success')
      router.push('/pipeline?view=kanban')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to delete deal', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const regenerateInsights = async () => {
    if (!dealId) return
    const meetingNotes = aiInput.trim()
    if (!meetingNotes) {
      toast('Add a deal update first so AI has context to analyze', 'warning')
      return
    }

    setRegeneratingIntel(true)
    try {
      const analyzeRes = await fetch(`/api/deals/${dealId}/analyze-notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingNotes }),
      })
      if (!analyzeRes.ok) {
        const err = await analyzeRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to analyze latest notes')
      }

      const [briefResult] = await Promise.allSettled([
        fetch(`/api/deals/${dealId}/brief`, { credentials: 'include' }),
        fetch(`/api/deals/${dealId}/ai-tasks`, { method: 'POST', credentials: 'include' }),
      ])

      if (briefResult.status === 'fulfilled' && briefResult.value.ok) {
        const briefJson = await briefResult.value.json().catch(() => null)
        const brief = (briefJson?.data?.brief as string | undefined)?.trim()
        if (brief) {
          await fetch(`/api/deals/${dealId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aiSummary: brief }),
          })
        }
      }

      await mutate()
      setAiInput('')
      toast('Update added to workspace brain and deal narrative refreshed', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to regenerate intelligence', 'error')
    } finally {
      setRegeneratingIntel(false)
    }
  }

  const wipeDealIntelligence = async () => {
    if (!dealId || !deal) return

    const ok = window.confirm(
      'Clear AI meeting history and regenerate this deal from scratch? This removes AI notes, risks, insights, and AI-generated todos from this deal.'
    )
    if (!ok) return

    setResettingIntel(true)
    try {
      const retainedTodos = (deal.todos ?? []).filter(item => {
        const src = String(item?.source ?? '').toLowerCase()
        return src !== 'ai'
      })

      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingNotes: null,
          aiSummary: null,
          conversionScore: null,
          conversionScorePinned: false,
          conversionInsights: [],
          dealRisks: [],
          scheduledEvents: [],
          scoreHistory: [],
          todos: retainedTodos,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to clear AI context')
      }

      setAiInput('')
      await mutate()
      toast('AI context cleared. Workspace brain refresh is running.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to clear AI context', 'error')
    } finally {
      setResettingIntel(false)
    }
  }

  const removeLatestUpdate = async () => {
    if (!dealId || !deal) return
    const nextMeetingNotes = removeLatestMeetingEntry(deal.meetingNotes)

    if (nextMeetingNotes === null) {
      toast('No previous update to remove.', 'warning')
      return
    }

    setRemovingLatestUpdate(true)
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingNotes: nextMeetingNotes }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to remove latest update')
      }

      await mutate()
      toast('Latest update removed from this deal.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to remove latest update', 'error')
    } finally {
      setRemovingLatestUpdate(false)
    }
  }

  const persistTodos = async (nextTodos: TodoItem[]) => {
    if (!dealId) throw new Error('Deal not found')
    const res = await fetch(`/api/deals/${dealId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todos: nextTodos }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Failed to update tasks')
    }
    await mutate()
  }

  const addTodo = async () => {
    const text = newTodoText.trim()
    if (!text) {
      toast('Add a task description first', 'warning')
      return
    }

    setTodoSubmitting(true)
    try {
      const currentTodos = (deal?.todos ?? []).filter(item => item?.text?.trim())
      await persistTodos([
        ...currentTodos,
        {
          id: crypto.randomUUID(),
          text,
          done: false,
          source: 'manual',
          priority: newTodoPriority,
          createdAt: new Date().toISOString(),
        },
      ])
      setNewTodoText('')
      setNewTodoPriority('normal')
      toast('Task added', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to add task', 'error')
    } finally {
      setTodoSubmitting(false)
    }
  }

  const toggleTodoDone = async (todo: TodoItem, idx: number) => {
    const id = todo.id ?? `idx-${idx}`
    setTodoSavingId(id)
    try {
      const currentTodos = (deal?.todos ?? []).map((item, index) => {
        if (todo.id && item.id === todo.id) return { ...item, done: !todo.done }
        if (!todo.id && index === idx) return { ...item, done: !todo.done }
        return item
      })
      await persistTodos(currentTodos)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to update task', 'error')
    } finally {
      setTodoSavingId(null)
    }
  }

  const deleteTodo = async (todo: TodoItem, idx: number) => {
    const id = todo.id ?? `idx-${idx}`
    setTodoDeletingId(id)
    try {
      const currentTodos = (deal?.todos ?? []).filter((item, index) => {
        if (todo.id) return item.id !== todo.id
        return index !== idx
      })
      await persistTodos(currentTodos)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to delete task', 'error')
    } finally {
      setTodoDeletingId(null)
    }
  }

  if (isLoading || !form) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 128, borderRadius: 14 }} />
        <div className="skeleton" style={{ height: 380, borderRadius: 14 }} />
      </div>
    )
  }

  if (!deal) {
    return (
      <section className="notion-panel" style={{ padding: 18, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Deal not found</h1>
        <p style={{ marginTop: 6, color: 'var(--text-secondary)' }}>This deal may have been deleted or moved.</p>
        <Link href="/pipeline?view=kanban" style={{ display: 'inline-flex', marginTop: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>
          Back to pipeline
        </Link>
      </section>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <section className="notion-panel" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <Link
              href="/pipeline?view=kanban"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                marginBottom: 8,
              }}
            >
              <ArrowLeft size={13} /> Back to Pipeline
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 0 }}>{form.prospectCompany}</h1>
              <span className="notion-chip" style={{ borderColor: `${stageMeta.color ?? '#64748b'}66`, color: stageMeta.color ?? 'var(--text-secondary)' }}>
                {stageMeta.label}
              </span>
              <span className="notion-chip" style={{ color: risk.color }}>{risk.label}</span>
            </div>

	            <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 13.5 }}>
	              Keep this deal current with one update field, then let AI refresh the snapshot, next action, and blockers.
	            </p>
	          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Link
              href="/pipeline?view=kanban"
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid var(--border-default)',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <Target size={13} /> Open Kanban
            </Link>

            <button
              onClick={saveDeal}
              disabled={!hasChanges || saving}
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 8,
                border: '1px solid var(--border-default)',
                background: 'var(--surface-2)',
                color: hasChanges ? 'var(--text-primary)' : 'var(--text-tertiary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                fontWeight: 700,
              }}
            >
              {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
              Save
            </button>
          </div>
        </div>
      </section>

      <section className="deal-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {[
          { label: 'Pipeline Value', value: toCurrency(deal.dealValue), sub: 'Annualized opportunity', icon: Sparkles },
          { label: 'Win Probability', value: `${score}%`, sub: risk.label, icon: Target },
          { label: 'Next Step', value: form.nextSteps ? 'Defined' : 'Missing', sub: form.nextSteps ? 'Execution plan present' : 'No concrete action logged', icon: CalendarClock },
          { label: 'Last Activity', value: relTime(deal.updatedAt), sub: staleDays > 10 ? 'Needs rep attention' : 'Fresh movement', icon: Zap },
        ].map(metric => (
          <article key={metric.label} className="notion-kpi" style={{ padding: '13px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
	              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.01em', color: 'var(--text-tertiary)' }}>{metric.label}</span>
              <metric.icon size={13} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0, lineHeight: 1.1 }}>{metric.value}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{metric.sub}</div>
          </article>
        ))}
      </section>

      <section className="deal-layout" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <article className="notion-panel" style={{ padding: 14 }}>
	            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
	              <h2 style={sectionTitleStyle}>Deal details</h2>
	              <span className="notion-chip">Core CRM</span>
	            </div>

            <div className="deal-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700 }}>Deal Name</span>
                <input
                  value={form.dealName}
                  onChange={e => updateField('dealName', e.target.value)}
                  style={{ height: 34, borderRadius: 9, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 10px', fontSize: 13, outline: 'none' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700 }}>Company</span>
                <input
                  value={form.prospectCompany}
                  onChange={e => updateField('prospectCompany', e.target.value)}
                  style={{ height: 34, borderRadius: 9, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 10px', fontSize: 13, outline: 'none' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700 }}>Stage</span>
                <select
                  value={form.stage}
                  onChange={e => updateField('stage', e.target.value as DealStage)}
                  style={{ height: 34, borderRadius: 9, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 10px', fontSize: 13, outline: 'none' }}
                >
                  {stages.map(stage => (
                    <option key={stage.id} value={stage.id}>{stage.label}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700 }}>Forecast</span>
                <select
                  value={form.forecastCategory ?? ''}
                  onChange={e => updateField('forecastCategory', (e.target.value || null) as ForecastCategory)}
                  style={{ height: 34, borderRadius: 9, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 10px', fontSize: 13, outline: 'none' }}
                >
                  <option value="">Unset</option>
                  <option value="commit">Commit</option>
                  <option value="upside">Upside</option>
                  <option value="pipeline">Pipeline</option>
                  <option value="omit">Omit</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700 }}>Deal Value (£)</span>
                <input
                  value={form.dealValue}
                  onChange={e => updateField('dealValue', e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="75000"
                  style={{ height: 34, borderRadius: 9, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 10px', fontSize: 13, outline: 'none' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700 }}>Target Close</span>
                <input
                  type="date"
                  value={form.closeDate}
                  onChange={e => updateField('closeDate', e.target.value)}
                  style={{ height: 34, borderRadius: 9, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 10px', fontSize: 13, outline: 'none' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700 }}>Primary Contact</span>
                <input
                  value={form.prospectName}
                  onChange={e => updateField('prospectName', e.target.value)}
                  placeholder="Sarah Johnson"
                  style={{ height: 34, borderRadius: 9, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 10px', fontSize: 13, outline: 'none' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700 }}>Contact Title</span>
                <input
                  value={form.prospectTitle}
                  onChange={e => updateField('prospectTitle', e.target.value)}
                  placeholder="VP Security"
                  style={{ height: 34, borderRadius: 9, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 10px', fontSize: 13, outline: 'none' }}
                />
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700 }}>Next Step</span>
              <textarea
                value={form.nextSteps}
                onChange={e => updateField('nextSteps', e.target.value)}
                rows={2}
                placeholder="Define one concrete action and owner."
                style={{ borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '8px 10px', fontSize: 13, outline: 'none', resize: 'vertical' }}
              />
            </label>
          </article>

          <article className="notion-panel" style={{ padding: 14 }}>
	            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
	              <h2 style={sectionTitleStyle}>AI update</h2>
	              <span className="notion-chip"><Sparkles size={11} /> Adds to Workspace Brain</span>
	            </div>
	            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
	              Paste the most recent call, email, or internal update. AI will refresh this deal snapshot from that latest context.
	            </p>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              <textarea
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                rows={6}
                placeholder="Example: Spoke with Sarah Chen (CISO). Security review completed, legal redline due Tuesday, budget sign-off pending CFO approval."
                style={{ borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'vertical' }}
              />
              <button
                onClick={regenerateInsights}
                disabled={regeneratingIntel}
                style={{
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid var(--border-default)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {regeneratingIntel ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <WandSparkles size={13} />}
	                Analyze update and refresh snapshot
              </button>
              <button
                onClick={removeLatestUpdate}
                disabled={removingLatestUpdate}
                style={{
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid var(--border-default)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 11.5,
                  fontWeight: 700,
                }}
              >
                {removingLatestUpdate ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={12} />}
                Remove latest update only
              </button>
              <button
                onClick={wipeDealIntelligence}
                disabled={resettingIntel}
                style={{
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid rgba(251,113,133,0.36)',
                  background: 'transparent',
                  color: '#fb7185',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 11.5,
                  fontWeight: 700,
                }}
              >
                {resettingIntel ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={12} />}
	                Wipe AI context for this deal
              </button>
            </div>
          </article>

	          <article className="notion-panel" style={{ padding: 14 }}>
	            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
	              <h2 style={sectionTitleStyle}>Stakeholders</h2>
	              <button
                onClick={() => updateField('contacts', [...form.contacts, { name: '', title: '', email: '' }])}
                style={{
                  height: 26,
                  padding: '0 10px',
                  borderRadius: 7,
                  border: '1px solid var(--border-default)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <Plus size={12} /> Add Contact
              </button>
            </div>

            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {form.contacts.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No contacts added yet.</div>
              ) : (
                form.contacts.map((contact, idx) => (
                  <div key={`${contact.email ?? 'contact'}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6 }}>
                    <input
                      value={contact.name}
                      onChange={e => {
                        const next = [...form.contacts]
                        next[idx] = { ...contact, name: e.target.value }
                        updateField('contacts', next)
                      }}
                      placeholder="Name"
                      style={{ height: 32, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 9px', fontSize: 12.5, outline: 'none' }}
                    />
                    <input
                      value={contact.title ?? ''}
                      onChange={e => {
                        const next = [...form.contacts]
                        next[idx] = { ...contact, title: e.target.value }
                        updateField('contacts', next)
                      }}
                      placeholder="Title"
                      style={{ height: 32, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 9px', fontSize: 12.5, outline: 'none' }}
                    />
                    <input
                      value={contact.email ?? ''}
                      onChange={e => {
                        const next = [...form.contacts]
                        next[idx] = { ...contact, email: e.target.value }
                        updateField('contacts', next)
                      }}
                      placeholder="Email"
                      style={{ height: 32, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 9px', fontSize: 12.5, outline: 'none' }}
                    />
                    <button
                      onClick={() => updateField('contacts', form.contacts.filter((_, i) => i !== idx))}
                      style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(251,113,133,0.36)', background: 'rgba(251,113,133,0.14)', color: '#fb7185' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>

	          <article className="notion-panel" style={{ padding: 14 }}>
	            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
	              <h2 style={sectionTitleStyle}>Assets and links</h2>
	              <button
                onClick={() => updateField('links', [...form.links, {
                  id: crypto.randomUUID(),
                  label: '',
                  url: '',
                  type: 'other',
                  addedAt: new Date().toISOString(),
                }])}
                style={{
                  height: 26,
                  padding: '0 10px',
                  borderRadius: 7,
                  border: '1px solid var(--border-default)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <Plus size={12} /> Add Link
              </button>
            </div>

            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {form.links.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No linked assets yet.</div>
              ) : (
                form.links.map((link, idx) => (
                  <div key={link.id || idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 130px auto auto', gap: 6, alignItems: 'center' }}>
                    <input
                      value={link.label}
                      onChange={e => {
                        const next = [...form.links]
                        next[idx] = { ...link, label: e.target.value }
                        updateField('links', next)
                      }}
                      placeholder="Label"
                      style={{ height: 32, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 9px', fontSize: 12.5, outline: 'none' }}
                    />
                    <input
                      value={link.url}
                      onChange={e => {
                        const next = [...form.links]
                        next[idx] = { ...link, url: e.target.value }
                        updateField('links', next)
                      }}
                      placeholder="https://"
                      style={{ height: 32, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 9px', fontSize: 12.5, outline: 'none' }}
                    />
                    <select
                      value={link.type}
                      onChange={e => {
                        const next = [...form.links]
                        next[idx] = { ...link, type: e.target.value as DealLinkType }
                        updateField('links', next)
                      }}
                      style={{ height: 32, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 9px', fontSize: 12, outline: 'none' }}
                    >
                      {LINK_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <a
                      href={link.url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-default)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', pointerEvents: link.url ? 'auto' : 'none', opacity: link.url ? 1 : 0.4 }}
                    >
                      <ExternalLink size={12} />
                    </a>
                    <button
                      onClick={() => updateField('links', form.links.filter((_, i) => i !== idx))}
                      style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(251,113,133,0.36)', background: 'rgba(251,113,133,0.14)', color: '#fb7185' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
	          <article className="notion-panel" style={{ padding: 14 }}>
	            <h2 style={sectionTitleStyle}>Deal snapshot</h2>

	            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
	              <div style={{ padding: 10, borderRadius: 9, border: '1px solid var(--border-default)', background: 'var(--surface-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700 }}>Score Momentum</span>
	                  <span style={{ fontSize: 12, fontWeight: 700, color: risk.color }}>{score}%</span>
	                </div>
	                <MiniBarChart values={chartValues} color={risk.color} />
	              </div>

	              <div style={{ display: 'grid', gap: 8 }}>
	                <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}>
	                  <p style={sectionLabelStyle}>Latest update</p>
	                  <p style={{ marginTop: 2, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
	                    {dealSnapshot.latestUpdate ?? 'No recent update captured yet. Add one in the AI update box above.'}
	                  </p>
	                </div>
	                <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}>
	                  <p style={sectionLabelStyle}>Next action</p>
	                  <p style={{ marginTop: 2, fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.55, fontWeight: 600 }}>
	                    {dealSnapshot.nextAction ?? 'No explicit next action captured yet. Add it in the AI update input above.'}
	                  </p>
	                </div>
	                <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}>
	                  <p style={sectionLabelStyle}>Blocker</p>
	                  <p style={{ marginTop: 2, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
	                    {dealSnapshot.blocker ?? 'No blocker is currently flagged from the latest update.'}
	                  </p>
	                </div>
	              </div>
	              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
	                Latest update {snapshotDateLabel}.
	              </div>
	            </div>
	          </article>

	          <article className="notion-panel" style={{ padding: 14 }}>
	            <h2 style={sectionTitleStyle}>Action queue</h2>
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px auto', gap: 6 }}>
                <input
                  value={newTodoText}
                  onChange={e => setNewTodoText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void addTodo()
                    }
                  }}
                  placeholder="Add a concrete next action"
                  style={{ height: 32, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 9px', fontSize: 12.5, outline: 'none' }}
                />
                <select
                  value={newTodoPriority}
                  onChange={e => setNewTodoPriority(e.target.value as 'low' | 'normal' | 'high')}
                  style={{ height: 32, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 8px', fontSize: 12, outline: 'none' }}
                >
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
                <button
                  onClick={addTodo}
                  disabled={todoSubmitting}
                  style={{
                    height: 32,
                    borderRadius: 8,
                    border: '1px solid var(--border-default)',
                    background: 'var(--surface-2)',
                    color: 'var(--text-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '0 10px',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {todoSubmitting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />}
                  Add
                </button>
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                {todos.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No tasks yet. Generate from deal context or add one above.</div>
                ) : (
                  todos.slice(0, 10).map((todo, idx) => {
                    const todoKey = todo.id ?? `idx-${idx}`
                    const highPriority = todo.priority === 'high'
                    return (
                      <div
                        key={todo.id ?? `${idx}-${todo.text}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12.5,
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 8,
                          padding: '6px 8px',
                          background: 'var(--surface-1)',
                        }}
                      >
                        <button
                          onClick={() => void toggleTodoDone(todo, idx)}
                          disabled={todoSavingId === todoKey}
                          style={{ background: 'none', border: 'none', padding: 0, display: 'inline-flex', alignItems: 'center', color: todo.done ? '#4ade80' : 'var(--text-tertiary)' }}
                          aria-label={todo.done ? 'Mark todo as not done' : 'Mark todo as done'}
                        >
                          {todoSavingId === todoKey
                            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            : todo.done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        </button>
                        <span style={{ flex: 1, color: todo.done ? 'var(--text-tertiary)' : 'var(--text-secondary)', textDecoration: todo.done ? 'line-through' : 'none' }}>
                          {todo.text}
                        </span>
                        {todo.priority && (
                          <span className="notion-chip" style={{ fontSize: 10, color: highPriority ? '#f97316' : 'var(--text-secondary)' }}>
                            {todo.priority}
                          </span>
                        )}
                        <button
                          onClick={() => void deleteTodo(todo, idx)}
                          disabled={todoDeletingId === todoKey}
                          style={{ width: 24, height: 24, borderRadius: 7, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          aria-label="Delete todo"
                        >
                          {todoDeletingId === todoKey ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </article>

	          <article className="notion-panel" style={{ padding: 14, borderColor: 'rgba(251,113,133,0.34)' }}>
	            <h2 style={{ ...sectionTitleStyle, color: '#fb7185' }}>Danger zone</h2>
            <p style={{ margin: '8px 0 10px', color: 'var(--text-secondary)', fontSize: 12.5 }}>
              Delete this deal if it should be fully removed from CRM, forecasting, and automation history.
            </p>
            <button
              onClick={deleteDeal}
              disabled={deleting}
              style={{
                height: 32,
                borderRadius: 9,
                border: '1px solid rgba(251,113,133,0.46)',
                background: 'rgba(251,113,133,0.18)',
                color: '#fb7185',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {deleting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
              Delete Deal
            </button>
          </article>
        </div>
      </section>

      <style>{`
        @media (max-width: 1220px) {
          .deal-layout { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 980px) {
          .deal-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .deal-field-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 660px) {
          .deal-metrics { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
