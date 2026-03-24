'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Zap, Plus, Clock, ToggleLeft, ToggleRight, Trash2, CheckCircle } from 'lucide-react'
import { useToast } from '@/components/shared/Toast'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const card: React.CSSProperties = {
  position: 'relative',
  background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(59,130,246,0.05) 50%, rgba(139,92,246,0.07) 100%)',
  backdropFilter: 'blur(24px) saturate(200%)',
  WebkitBackdropFilter: 'blur(24px) saturate(200%)',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.40)',
}

const TRIGGERS = [
  { value: 'morning_8am',        label: 'Every morning at 8am' },
  { value: 'health_drop_10',     label: 'When a deal health drops more than 10 points' },
  { value: 'feature_linked',     label: 'When a new feature is linked to a deal' },
  { value: 'linear_issue_ships', label: 'When a Linear issue linked to a deal ships' },
]

const ACTIONS = [
  { value: 'slack_dm_me',         label: 'Send me a Slack DM with a summary' },
  { value: 'slack_dm_owner',      label: 'Send the deal owner a Slack DM' },
  { value: 'draft_release_email', label: 'Draft a release email', triggerOnly: 'linear_issue_ships' },
]

const TEMPLATES = [
  {
    name: 'Morning pipeline briefing',
    description: 'Every morning, get a summary of deal health changes overnight',
    trigger: 'morning_8am',
    action: 'slack_dm_me',
  },
  {
    name: 'Deal at-risk alert',
    description: 'Get notified instantly when a deal health drops',
    trigger: 'health_drop_10',
    action: 'slack_dm_me',
  },
  {
    name: 'Feature shipped → release email',
    description: 'When a product fix ships, Halvex drafts the customer email',
    trigger: 'linear_issue_ships',
    action: 'draft_release_email',
  },
]

function triggerLabel(value: string) {
  return TRIGGERS.find(t => t.value === value)?.label ?? value
}

function actionLabel(value: string) {
  return ACTIONS.find(a => a.value === value)?.label ?? value
}

function formatRunAt(ts: string | null) {
  if (!ts) return 'Never run'
  const d = new Date(ts)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export default function WorkflowsPage() {
  const { toast } = useToast()
  const { data, isLoading } = useSWR('/api/workflows', fetcher, { revalidateOnFocus: false })
  const workflowList: any[] = data?.data ?? []

  const [trigger, setTrigger] = useState('')
  const [action, setAction] = useState('')
  const [notify, setNotify] = useState('')
  const [saving, setSaving] = useState(false)

  const availableActions = action && trigger === 'linear_issue_ships'
    ? ACTIONS
    : ACTIONS.filter(a => !a.triggerOnly)

  async function handleSave() {
    if (!trigger || !action) { toast('Choose a trigger and action', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerType: trigger, actionType: action, config: { notify } }),
      })
      if (!res.ok) { toast('Failed to save workflow', 'error'); return }
      await mutate('/api/workflows')
      setTrigger(''); setAction(''); setNotify('')
      toast('Workflow saved', 'success')
    } finally { setSaving(false) }
  }

  async function toggleWorkflow(id: string, enabled: boolean) {
    await fetch(`/api/workflows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    })
    await mutate('/api/workflows')
  }

  async function deleteWorkflow(id: string) {
    await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
    await mutate('/api/workflows')
    toast('Workflow deleted', 'success')
  }

  return (
    <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.025em', marginBottom: '6px' }}>Workflows</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.38)' }}>Automated tasks Halvex runs for you.</p>
      </div>

      {/* ── Active workflows ── */}
      <section>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>Active workflows</h2>
        {isLoading ? (
          <div style={{ ...card, padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.28)', fontSize: '13px' }}>Loading…</div>
        ) : workflowList.length === 0 ? (
          <div style={{ ...card, padding: '28px 24px', textAlign: 'center' }}>
            <Zap size={24} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 10px' }} />
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.40)', margin: 0 }}>No workflows set up yet</p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.24)', marginTop: '4px' }}>Create your first workflow below.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {workflowList.map((wf: any) => (
              <div key={wf.id} style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: '3px' }}>{wf.name}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)', lineHeight: 1.4 }}>
                    When: {triggerLabel(wf.triggerType)} · Then: {actionLabel(wf.actionType)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <Clock size={10} style={{ color: 'rgba(255,255,255,0.25)' }} />
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>{formatRunAt(wf.lastRunAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleWorkflow(wf.id, wf.enabled)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: wf.enabled ? '#818cf8' : 'rgba(255,255,255,0.25)', padding: '4px', display: 'flex', alignItems: 'center' }}
                  title={wf.enabled ? 'Disable' : 'Enable'}
                >
                  {wf.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <button
                  onClick={() => deleteWorkflow(wf.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.18)', padding: '4px', display: 'flex', alignItems: 'center', transition: 'color 0.12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#f87171'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.18)'}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Create a workflow ── */}
      <section>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>Create a workflow</h2>
        <div style={{ ...card, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          <FormField label="When this happens…">
            <select
              value={trigger}
              onChange={e => { setTrigger(e.target.value); setAction('') }}
              style={selectStyle}
            >
              <option value="">Choose a trigger…</option>
              {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>

          <FormField label="Do this:">
            <select
              value={action}
              onChange={e => setAction(e.target.value)}
              style={{ ...selectStyle, opacity: trigger ? 1 : 0.5 }}
              disabled={!trigger}
            >
              <option value="">Choose an action…</option>
              {(trigger === 'linear_issue_ships' ? ACTIONS : ACTIONS.filter(a => !a.triggerOnly)).map(a =>
                <option key={a.value} value={a.value}>{a.label}</option>
              )}
            </select>
          </FormField>

          <FormField label="Notify (Slack user or channel):">
            <input
              type="text"
              value={notify}
              onChange={e => setNotify(e.target.value)}
              placeholder="e.g. @rees or #sales-alerts"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '9px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.85)', fontSize: '13px', outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </FormField>

          <div style={{ paddingTop: '4px' }}>
            <button
              onClick={handleSave}
              disabled={saving || !trigger || !action}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '10px 22px', borderRadius: '10px',
                background: trigger && action ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${trigger && action ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.08)'}`,
                color: trigger && action ? '#818cf8' : 'rgba(255,255,255,0.30)',
                fontSize: '13px', fontWeight: 600, cursor: trigger && action ? 'pointer' : 'not-allowed',
                opacity: saving ? 0.6 : 1, transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (trigger && action && !saving) (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.30)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = trigger && action ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.06)' }}
            >
              <Plus size={14} />
              {saving ? 'Saving…' : 'Save workflow'}
            </button>
          </div>
        </div>
      </section>

      {/* ── Templates ── */}
      <section style={{ paddingBottom: '40px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>What&apos;s possible</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {TEMPLATES.map((t, i) => (
            <div
              key={i}
              style={{
                ...card,
                padding: '18px 22px',
                display: 'flex', alignItems: 'center', gap: '16px',
                cursor: 'pointer',
                transition: 'border-color 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.30)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)'}
              onClick={() => { setTrigger(t.trigger); setAction(t.action) }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={14} style={{ color: '#818cf8' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.82)', marginBottom: '3px' }}>{t.name}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', lineHeight: 1.4 }}>{t.description}</div>
              </div>
              <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 500, flexShrink: 0 }}>Use →</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '9px',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
  color: 'rgba(255,255,255,0.85)', fontSize: '13px', outline: 'none',
  fontFamily: 'inherit', cursor: 'pointer',
  appearance: 'auto',
}
