'use client'
export const dynamic = 'force-dynamic'

import useSWR, { mutate as globalMutate } from 'swr'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowLeft, Sparkles, CheckSquare, Square, Plus, Target, Loader2,
  FileText, Clipboard, ChevronDown, TrendingUp, DollarSign, Calendar,
  Building2, User, Edit, Trash2, MoreHorizontal, CheckCircle, X
} from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const STAGE_COLORS: Record<string, string> = {
  prospecting: '#6B7280', qualification: '#3B82F6', discovery: '#8B5CF6',
  proposal: '#F59E0B', negotiation: '#EF4444', closed_won: '#22C55E', closed_lost: '#6B7280',
}

function MeetingNotesTab({ dealId, deal, onUpdate }: { dealId: string; deal: any; onUpdate: () => void }) {
  const [notes, setNotes] = useState(deal?.meetingNotes ?? '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const analyze = async () => {
    if (!notes.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/analyze-notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingNotes: notes }),
      })
      const data = await res.json()
      setResult(data.data)
      onUpdate()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clipboard size={14} color="#818CF8" />
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#EBEBEB' }}>Meeting Notes</span>
          </div>
          <button onClick={analyze} disabled={loading || !notes.trim()} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
            background: loading ? 'rgba(99,102,241,0.2)' : 'linear-gradient(135deg, #6366F1, #7C3AED)',
            boxShadow: loading ? 'none' : '0 0 16px rgba(99,102,241,0.3)',
            border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600',
            cursor: loading || !notes.trim() ? 'not-allowed' : 'pointer',
          }}>
            {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
            {loading ? 'Analyzing...' : 'Analyze with AI'}
          </button>
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Paste your meeting notes here — AI will extract action items, score conversion probability, and identify product gaps..."
          rows={10}
          style={{
            width: '100%', resize: 'vertical', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px',
            color: '#EBEBEB', fontSize: '13px', lineHeight: '1.6', padding: '12px',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
          onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)'}
          onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}
        />
      </div>

      {/* AI Results */}
      {(result || deal?.aiSummary) && (
        <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Sparkles size={14} color="#818CF8" />
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#818CF8' }}>AI Analysis</span>
            {deal?.conversionScore != null && (
              <span style={{ marginLeft: 'auto', fontSize: '20px', fontWeight: '800', color: deal.conversionScore >= 70 ? '#22C55E' : deal.conversionScore >= 40 ? '#F59E0B' : '#EF4444' }}>
                {deal.conversionScore}%
              </span>
            )}
          </div>
          {deal?.aiSummary && (
            <p style={{ fontSize: '13px', color: '#888', lineHeight: '1.6', margin: '0 0 12px' }}>{deal.aiSummary}</p>
          )}
          {deal?.conversionInsights?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(deal.conversionInsights as string[]).map((insight: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: '#888' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6366F1', flexShrink: 0, marginTop: '5px' }} />
                  {insight}
                </div>
              ))}
            </div>
          )}
          {result?.productGaps?.length > 0 && (
            <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#EF4444', fontWeight: '600', marginBottom: '4px' }}>
                {result.productGaps.length} product gap{result.productGaps.length > 1 ? 's' : ''} detected
              </div>
              {result.productGaps.map((g: any) => (
                <div key={g.id} style={{ fontSize: '12px', color: '#888', marginTop: '3px' }}>• {g.title}</div>
              ))}
              <Link href="/product-gaps" style={{ fontSize: '11px', color: '#EF4444', textDecoration: 'none', display: 'inline-block', marginTop: '6px' }}>
                View in Product Gaps →
              </Link>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function MeetingPrepTab({ dealId }: { dealId: string }) {
  const [prep, setPrep] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/meeting-prep`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      const data = await res.json()
      setPrep(data.data?.prep ?? '')
      setGenerated(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {!generated ? (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ width: '52px', height: '52px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 0 24px rgba(99,102,241,0.15)' }}>
            <Sparkles size={22} color="#6366F1" />
          </div>
          <div style={{ fontSize: '15px', fontWeight: '600', color: '#EBEBEB', marginBottom: '6px' }}>Meeting Prep</div>
          <div style={{ fontSize: '13px', color: '#555', lineHeight: '1.6', marginBottom: '20px', maxWidth: '320px', margin: '0 auto 20px' }}>
            Generate a personalized prep brief with talking points, objection handlers, competitive intel, and questions to ask.
          </div>
          <button onClick={generate} disabled={loading} style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px',
            background: 'linear-gradient(135deg, #6366F1, #7C3AED)', boxShadow: '0 0 20px rgba(99,102,241,0.3)',
            border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}>
            {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : <><Sparkles size={14} /> Generate Meeting Prep</>}
          </button>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={14} color="#818CF8" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#EBEBEB' }}>Meeting Prep Brief</span>
            </div>
            <button onClick={generate} style={{ fontSize: '12px', color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}>Regenerate</button>
          </div>
          <div style={{ fontSize: '13px', color: '#888', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{prep}</div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function TodosTab({ dealId, deal, onUpdate }: { dealId: string; deal: any; onUpdate: () => void }) {
  const [newTodo, setNewTodo] = useState('')
  const todos: any[] = deal?.todos ?? []

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

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodo.trim()) return
    await saveTodos([...todos, { id: crypto.randomUUID(), text: newTodo.trim(), done: false, createdAt: new Date().toISOString() }])
    setNewTodo('')
  }

  const deleteTodo = (id: string) => saveTodos(todos.filter((t: any) => t.id !== id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <form onSubmit={addTodo} style={{ display: 'flex', gap: '8px' }}>
        <input
          value={newTodo}
          onChange={e => setNewTodo(e.target.value)}
          placeholder="Add action item..."
          style={{
            flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', padding: '9px 12px', color: '#EBEBEB', fontSize: '13px', outline: 'none',
          }}
          onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)'}
          onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}
        />
        <button type="submit" disabled={!newTodo.trim()} style={{
          padding: '0 14px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: '8px', color: '#818CF8', cursor: 'pointer', display: 'flex', alignItems: 'center',
        }}>
          <Plus size={14} />
        </button>
      </form>

      {todos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#444', fontSize: '13px' }}>
          No action items yet. Analyze meeting notes to auto-generate them.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {todos.map((todo: any) => (
            <div key={todo.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px',
            }}>
              <button onClick={() => toggleTodo(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: todo.done ? '#22C55E' : '#333' }}>
                {todo.done ? <CheckCircle size={15} color="#22C55E" /> : <Square size={15} color="#333" />}
              </button>
              <span style={{ flex: 1, fontSize: '13px', color: todo.done ? '#444' : '#EBEBEB', textDecoration: todo.done ? 'line-through' : 'none' }}>
                {todo.text}
              </span>
              <button onClick={() => deleteTodo(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: '2px', display: 'flex', borderRadius: '4px' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#EF4444'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#333'}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: '11px', color: '#444', textAlign: 'right', paddingTop: '4px' }}>
        {todos.filter((t: any) => t.done).length}/{todos.length} completed
      </div>
    </div>
  )
}

const STAGES_OPTS = ['prospecting','qualification','discovery','proposal','negotiation','closed_won','closed_lost'] as const

function EditDealModal({ deal, dealId, open, onOpenChange, onSaved }: {
  deal: any; dealId: string; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void
}) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // sync form state when deal or open changes
  useEffect(() => {
    if (open && deal) {
      setForm({
        dealName: deal.dealName ?? '',
        prospectCompany: deal.prospectCompany ?? '',
        prospectName: deal.prospectName ?? '',
        prospectTitle: deal.prospectTitle ?? '',
        dealValue: deal.dealValue != null ? String(deal.dealValue) : '',
        stage: deal.stage ?? 'proposal',
        competitors: Array.isArray(deal.competitors) ? deal.competitors.join(', ') : '',
        notes: deal.notes ?? '',
        nextSteps: deal.nextSteps ?? '',
        lostReason: deal.lostReason ?? '',
      })
    }
  }, [open, deal])

  const u = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inputStyle: React.CSSProperties = {
    width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px',
    background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)',
    color: '#EBEBEB', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, color: '#666',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px',
  }

  const save = async () => {
    setSaving(true)
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealName: form.dealName,
          prospectCompany: form.prospectCompany,
          prospectName: form.prospectName || null,
          prospectTitle: form.prospectTitle || null,
          dealValue: form.dealValue ? Number(form.dealValue) : null,
          stage: form.stage,
          competitors: form.competitors.split(',').map((s: string) => s.trim()).filter(Boolean),
          notes: form.notes || null,
          nextSteps: form.nextSteps || null,
          lostReason: form.lostReason || null,
        }),
      })
      onSaved()
      onOpenChange(false)
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
          background: 'rgba(14,10,26,0.98)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '14px', padding: '24px', outline: 'none',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <Dialog.Title style={{ fontSize: '15px', fontWeight: 700, color: '#F1F1F3', margin: 0 }}>Edit deal</Dialog.Title>
            <Dialog.Close asChild>
              <button style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '5px' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EBEBEB')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Deal name</label>
                <input style={inputStyle} value={form.dealName ?? ''} onChange={e => u('dealName', e.target.value)}
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
              </div>
              <div>
                <label style={labelStyle}>Company</label>
                <input style={inputStyle} value={form.prospectCompany ?? ''} onChange={e => u('prospectCompany', e.target.value)}
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Contact name</label>
                <input style={inputStyle} value={form.prospectName ?? ''} onChange={e => u('prospectName', e.target.value)} placeholder="Jane Smith"
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
              </div>
              <div>
                <label style={labelStyle}>Contact title</label>
                <input style={inputStyle} value={form.prospectTitle ?? ''} onChange={e => u('prospectTitle', e.target.value)} placeholder="VP of Engineering"
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Deal value ($)</label>
                <input style={inputStyle} type="number" value={form.dealValue ?? ''} onChange={e => u('dealValue', e.target.value)} placeholder="50000"
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
              </div>
              <div>
                <label style={labelStyle}>Stage</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.stage ?? ''} onChange={e => u('stage', e.target.value)}>
                  {STAGES_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Competitors (comma-separated)</label>
              <input style={inputStyle} value={form.competitors ?? ''} onChange={e => u('competitors', e.target.value)} placeholder="Competitor A, Competitor B"
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
            </div>
            {form.stage === 'closed_lost' && (
              <div>
                <label style={labelStyle}>Lost reason</label>
                <input style={inputStyle} value={form.lostReason ?? ''} onChange={e => u('lostReason', e.target.value)} placeholder="e.g. Price too high"
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }}
                rows={3} value={form.notes ?? ''} onChange={e => u('notes', e.target.value)}
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
            </div>
            <div>
              <label style={labelStyle}>Next steps</label>
              <input style={inputStyle} value={form.nextSteps ?? ''} onChange={e => u('nextSteps', e.target.value)} placeholder="Schedule follow-up call"
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
              <Dialog.Close asChild>
                <button style={{ height: '34px', padding: '0 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 500, color: '#888', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </Dialog.Close>
              <button onClick={save} disabled={saving} style={{
                height: '34px', padding: '0 18px', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                color: '#fff', background: saving ? '#333' : 'linear-gradient(135deg, #6366F1, #7C3AED)',
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

export default function DealDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const { data, mutate } = useSWR(id ? `/api/deals/${id}` : null, fetcher)
  const deal = data?.data ?? data

  const [activeTab, setActiveTab] = useState<'overview' | 'meeting-notes' | 'prep' | 'todos'>('overview')
  const [editOpen, setEditOpen] = useState(false)

  if (!deal && data !== undefined) {
    return (
      <div style={{ textAlign: 'center', padding: '80px', color: '#555' }}>
        Deal not found. <Link href="/deals" style={{ color: '#6366F1' }}>Back to deals</Link>
      </div>
    )
  }

  const stageColor = STAGE_COLORS[deal?.stage] ?? '#6B7280'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Back + header */}
      <div>
        <Link href="/deals" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#555', fontSize: '13px', textDecoration: 'none', marginBottom: '14px' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#EBEBEB'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#555'}
        >
          <ArrowLeft size={13} /> Back to deals
        </Link>

        {deal ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.03em', color: '#F1F1F3', margin: 0 }}>
                  {deal.prospectCompany}
                </h1>
                <span style={{
                  fontSize: '11px', padding: '3px 10px', borderRadius: '100px', fontWeight: '600',
                  background: `${stageColor}18`, color: stageColor, border: `1px solid ${stageColor}35`,
                }}>
                  {deal.stage?.replace('_', ' ')}
                </span>
                {deal.conversionScore != null && (
                  <span style={{
                    fontSize: '12px', padding: '3px 10px', borderRadius: '100px', fontWeight: '700',
                    background: deal.conversionScore >= 70 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                    color: deal.conversionScore >= 70 ? '#22C55E' : '#F59E0B',
                    border: `1px solid ${deal.conversionScore >= 70 ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    <Target size={10} /> {deal.conversionScore}% conversion
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#555' }}>
                {deal.prospectName && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={11} />{deal.prospectName}</span>}
                {deal.dealValue && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#22C55E', fontWeight: '600' }}><DollarSign size={11} />${deal.dealValue.toLocaleString()}</span>}
                {deal.closeDate && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} />Close {new Date(deal.closeDate).toLocaleDateString()}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditOpen(true)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', color: '#EBEBEB', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              }}>
                <Edit size={13} /> Edit
              </button>
              <Link href={`/collateral?dealId=${id}`} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                background: 'linear-gradient(135deg, #6366F1, #7C3AED)', boxShadow: '0 0 16px rgba(99,102,241,0.3)',
                border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none',
              }}>
                <Sparkles size={13} /> Generate Collateral
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ height: '40px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', width: '300px', animation: 'pulse 1.5s infinite' }} />
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0' }}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'meeting-notes', label: 'Meeting Notes + AI' },
          { id: 'prep', label: 'Meeting Prep' },
          { id: 'todos', label: `To-Dos ${deal?.todos?.length > 0 ? `(${deal.todos.filter((t: any) => !t.done).length})` : ''}` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{
            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
            color: activeTab === tab.id ? '#EBEBEB' : '#555',
            borderBottom: activeTab === tab.id ? '2px solid #6366F1' : '2px solid transparent',
            marginBottom: '-1px', transition: 'color 0.1s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Edit deal modal */}
      <EditDealModal deal={deal} dealId={id} open={editOpen} onOpenChange={setEditOpen} onSaved={() => mutate()} />

      {/* Tab content */}
      {!deal ? (
        <div style={{ height: '200px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }} />
      ) : (
        <div>
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {[
                { label: 'Deal Name', value: deal.dealName },
                { label: 'Company', value: deal.prospectCompany },
                { label: 'Contact', value: deal.prospectName },
                { label: 'Title', value: deal.prospectTitle },
                { label: 'Stage', value: deal.stage?.replace('_', ' ') },
                { label: 'Deal Value', value: deal.dealValue ? `$${deal.dealValue.toLocaleString()}` : null },
                { label: 'Competitors', value: (deal.competitors as string[])?.join(', ') },
                { label: 'Notes', value: deal.notes },
                { label: 'Next Steps', value: deal.nextSteps },
              ].filter(f => f.value).map(({ label, value }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div style={{ fontSize: '13px', color: '#EBEBEB', fontWeight: '500' }}>{value}</div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'meeting-notes' && (
            <MeetingNotesTab dealId={id} deal={deal} onUpdate={() => mutate()} />
          )}
          {activeTab === 'prep' && <MeetingPrepTab dealId={id} />}
          {activeTab === 'todos' && (
            <TodosTab dealId={id} deal={deal} onUpdate={() => mutate()} />
          )}
        </div>
      )}
    </div>
  )
}
