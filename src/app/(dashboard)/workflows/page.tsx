'use client'
export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import useSWR from 'swr'
import {
  Zap, Plus, Clock, ArrowRight, GitBranch, ChevronDown,
} from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ─── Integration chip colours ────────────────────────────────────────────────

const INTEGRATION_CHIPS: Record<string, { label: string; color: string; bg: string }> = {
  linear:       { label: '@linear',       color: '#818cf8', bg: 'rgba(129,140,248,0.14)' },
  cyclecurrent: { label: '@cyclecurrent', color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  hubspot:      { label: '@hubspot',      color: '#fb923c', bg: 'rgba(251,146,60,0.14)'  },
  slack:        { label: '@slack',        color: '#4ade80', bg: 'rgba(74,222,128,0.14)'  },
  deals:        { label: '@deals',        color: '#38bdf8', bg: 'rgba(56,189,248,0.14)'  },
}

const MENTION_TRIGGERS = Object.keys(INTEGRATION_CHIPS)

const TRIGGERS = [
  'Every day at 8am',
  'When a deal score drops',
  'When a Linear issue ships',
  'When a deal is updated',
  'Manually',
]

const ACTIONS = [
  'Notify me in Today tab',
  'Send Slack DM',
  'Update HubSpot',
  'Create Linear issue',
  'Draft release email',
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkflowChip {
  type: 'mention'
  key: string
}
type WorkflowToken = string | WorkflowChip

interface Workflow {
  id: string
  title: string
  trigger: string
  action: string
  active: boolean
  isTemplate?: boolean
  tokens?: WorkflowToken[]
}

// ─── Pre-built templates ──────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: Workflow[] = [
  {
    id: 'daily-linked-issues',
    title: 'Daily sprint briefing',
    trigger: 'Every day at 8am',
    action: 'Show in Today tab: @linear issues in @cyclecurrent linked to deals',
    active: true,
    isTemplate: true,
    tokens: [
      'Show in Today tab: ',
      { type: 'mention', key: 'linear' },
      ' issues in ',
      { type: 'mention', key: 'cyclecurrent' },
      ' linked to ',
      { type: 'mention', key: 'deals' },
    ],
  },
  {
    id: 'deal-risk-alerts',
    title: 'Deal score alert',
    trigger: 'When a deal score drops below 40',
    action: 'Send Slack DM with risk factors and suggested action',
    active: true,
    isTemplate: true,
    tokens: [
      'Send ',
      { type: 'mention', key: 'slack' },
      ' DM with risk factors and suggested action',
    ],
  },
  {
    id: 'release-loop',
    title: 'Release loop',
    trigger: 'When a Linear issue linked to a deal ships',
    action: 'Draft release email for linked deal and notify via @slack',
    active: false,
    isTemplate: true,
    tokens: [
      'Draft release email for linked ',
      { type: 'mention', key: 'deals' },
      ' and notify via ',
      { type: 'mention', key: 'slack' },
    ],
  },
]

// ─── @ mention autocomplete textarea ─────────────────────────────────────────

function MentionInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownQuery, setDropdownQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const filtered = MENTION_TRIGGERS.filter(k =>
    k.startsWith(dropdownQuery.toLowerCase())
  )

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    onChange(v)
    const cursor = e.target.selectionStart ?? v.length
    const before = v.slice(0, cursor)
    const match = before.match(/@(\w*)$/)
    if (match) {
      setDropdownQuery(match[1])
      setShowDropdown(true)
      setSelectedIdx(0)
    } else {
      setShowDropdown(false)
    }
  }

  const insertMention = (key: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const cursor = ta.selectionStart ?? value.length
    const before = value.slice(0, cursor)
    const after = value.slice(cursor)
    const matchStart = before.lastIndexOf('@')
    const newValue = before.slice(0, matchStart) + `@${key}` + ' ' + after
    onChange(newValue)
    setShowDropdown(false)
    ta.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      if (filtered[selectedIdx]) insertMention(filtered[selectedIdx])
    }
    if (e.key === 'Escape') setShowDropdown(false)
  }

  const renderTokens = (): React.ReactNode[] => {
    const parts = value.split(/(@\w+)/g)
    return parts.map((part, i) => {
      const key = part.replace('@', '')
      const chip = INTEGRATION_CHIPS[key]
      if (chip) {
        return (
          <span key={i} style={{
            display: 'inline-block',
            background: chip.bg, color: chip.color,
            borderRadius: '4px', padding: '0 4px',
            fontSize: '12px', fontWeight: 600, lineHeight: '1.5',
          }}>
            {chip.label}
          </span>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', inset: 0,
        padding: '8px 10px', fontSize: '12px', lineHeight: '1.6',
        color: 'transparent', pointerEvents: 'none',
        wordBreak: 'break-word', whiteSpace: 'pre-wrap', userSelect: 'none',
      }}>
        {renderTokens()}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={2}
        style={{
          width: '100%', resize: 'none',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px', padding: '8px 10px',
          fontSize: '12px', lineHeight: '1.6',
          color: 'rgba(255,255,255,0.70)',
          outline: 'none', caretColor: 'rgba(255,255,255,0.80)',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.40)')}
        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; setShowDropdown(false) }}
      />
      {showDropdown && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100,
          background: '#0d0f1a', border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: '10px', padding: '4px', minWidth: '180px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.60)',
        }}>
          {filtered.map((key, idx) => {
            const chip = INTEGRATION_CHIPS[key]
            return (
              <div
                key={key}
                onMouseDown={e => { e.preventDefault(); insertMention(key) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '7px 10px', borderRadius: '7px', cursor: 'pointer',
                  background: idx === selectedIdx ? 'rgba(99,102,241,0.12)' : 'transparent',
                }}
              >
                <span style={{
                  background: chip.bg, color: chip.color,
                  borderRadius: '4px', padding: '1px 6px',
                  fontSize: '11px', fontWeight: 700,
                }}>
                  {chip.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Select dropdown ──────────────────────────────────────────────────────────

function SelectField({
  label, options, value, onChange
}: {
  label: string; options: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', appearance: 'none',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', padding: '8px 32px 8px 12px',
            fontSize: '13px', color: '#94a3b8',
            outline: 'none', cursor: 'pointer',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.40)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
        >
          <option value="" style={{ background: '#0d0f1a' }}>Select…</option>
          {options.map(o => (
            <option key={o} value={o} style={{ background: '#0d0f1a' }}>{o}</option>
          ))}
        </select>
        <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
      </div>
    </div>
  )
}

// ─── Workflow card ────────────────────────────────────────────────────────────

function WorkflowCard({ workflow, onToggle }: { workflow: Workflow; onToggle: (id: string, active: boolean) => void }) {
  const renderTokens = (tokens?: WorkflowToken[], fallback?: string) => {
    if (!tokens) return <span style={{ fontSize: '12px', color: '#64748b' }}>{fallback}</span>
    return (
      <span style={{ fontSize: '12px', lineHeight: 1.6 }}>
        {tokens.map((t, i) => {
          if (typeof t === 'string') return <span key={i} style={{ color: '#94a3b8' }}>{t}</span>
          const chip = INTEGRATION_CHIPS[t.key]
          if (!chip) return null
          return (
            <span key={i} style={{
              display: 'inline-block',
              background: chip.bg, color: chip.color,
              borderRadius: '4px', padding: '0 5px',
              fontSize: '11px', fontWeight: 700, margin: '0 1px',
            }}>
              {chip.label}
            </span>
          )
        })}
      </span>
    )
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(59,130,246,0.04), transparent)',
      border: `1px solid ${workflow.active ? 'rgba(99,102,241,0.20)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '14px', padding: '16px 20px',
      transition: 'all 0.15s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{workflow.title}</span>
            {workflow.isTemplate && (
              <span style={{
                fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em',
                padding: '1px 6px', borderRadius: '10px',
                background: 'rgba(99,102,241,0.12)', color: '#818cf8',
              }}>TEMPLATE</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Clock size={10} style={{ color: '#334155', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#475569' }}>{workflow.trigger}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <ArrowRight size={10} style={{ color: '#334155', flexShrink: 0, marginTop: '3px' }} />
            <div>{renderTokens(workflow.tokens, workflow.action)}</div>
          </div>
        </div>
        {/* Toggle */}
        <button
          onClick={() => onToggle(workflow.id, !workflow.active)}
          style={{
            width: '36px', height: '20px', borderRadius: '10px', border: 'none',
            background: workflow.active ? '#6366f1' : 'rgba(255,255,255,0.10)',
            cursor: 'pointer', position: 'relative', flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <div style={{
            width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
            position: 'absolute', top: '3px',
            left: workflow.active ? '19px' : '3px',
            transition: 'left 0.2s',
            boxShadow: workflow.active ? '0 0 6px rgba(99,102,241,0.50)' : 'none',
          }} />
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const { data: mcpActionsRes } = useSWR('/api/mcp-actions/recent?limit=5', fetcher, { revalidateOnFocus: false })
  const recentActions: any[] = mcpActionsRes?.data ?? []

  const [workflows, setWorkflows] = useState<Workflow[]>(DEFAULT_TEMPLATES)
  const [showNewForm, setShowNewForm] = useState(false)
  const [selectedTrigger, setSelectedTrigger] = useState('')
  const [selectedAction, setSelectedAction] = useState('')
  const [newTrigger, setNewTrigger] = useState('')
  const [newAction, setNewAction] = useState('')

  const handleToggle = (id: string, active: boolean) => {
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, active } : w))
  }

  const handleAddWorkflow = () => {
    const trigger = selectedTrigger || newTrigger.trim()
    const action = selectedAction || newAction.trim()
    if (!trigger || !action) return
    setWorkflows(prev => [...prev, {
      id: `custom-${Date.now()}`,
      title: 'Custom workflow',
      trigger,
      action,
      active: true,
    }])
    setSelectedTrigger(''); setSelectedAction(''); setNewTrigger(''); setNewAction('')
    setShowNewForm(false)
  }

  const activeCount = workflows.filter(w => w.active).length

  const card: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(59,130,246,0.04), transparent)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px',
    padding: '20px 24px',
  }

  return (
    <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px rgba(99,102,241,0.20)',
          }}>
            <Zap size={18} color="#818cf8" />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.02em', margin: 0 }}>
            Workflows
          </h1>
          <span style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
            padding: '2px 8px', borderRadius: '10px',
            background: 'rgba(99,102,241,0.12)', color: '#818cf8',
          }}>
            {activeCount} active
          </span>
        </div>
        <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
          Automate actions across integrations. Type <strong style={{ color: '#818cf8' }}>@</strong> to reference integrations.
        </p>
      </div>

      {/* Create a workflow */}
      {!showNewForm ? (
        <button
          onClick={() => setShowNewForm(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '14px 18px', borderRadius: '12px',
            background: 'rgba(99,102,241,0.06)', border: '1px dashed rgba(99,102,241,0.25)',
            color: '#818cf8', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', width: '100%', textAlign: 'left',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(99,102,241,0.10)'
            el.style.borderColor = 'rgba(99,102,241,0.40)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(99,102,241,0.06)'
            el.style.borderColor = 'rgba(99,102,241,0.25)'
          }}
        >
          <Plus size={16} />
          Create a workflow
        </button>
      ) : (
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(59,130,246,0.06), transparent)',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: '16px', padding: '20px',
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', margin: '0 0 16px' }}>
            Create a workflow
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
            <SelectField
              label="Trigger"
              options={TRIGGERS}
              value={selectedTrigger}
              onChange={v => { setSelectedTrigger(v); if (v) setNewTrigger('') }}
            />
            {!selectedTrigger && (
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }}>
                  Or describe your trigger
                </label>
                <MentionInput
                  value={newTrigger}
                  onChange={setNewTrigger}
                  placeholder="e.g. Every morning at 8am, or when a deal health drops…"
                />
              </div>
            )}

            <SelectField
              label="Action"
              options={ACTIONS}
              value={selectedAction}
              onChange={v => { setSelectedAction(v); if (v) setNewAction('') }}
            />
            {!selectedAction && (
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }}>
                  Or describe your action — type @ to mention integrations
                </label>
                <MentionInput
                  value={newAction}
                  onChange={setNewAction}
                  placeholder="e.g. Show in Today tab: @linear issues in @cyclecurrent linked to @deals"
                />
                <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {Object.entries(INTEGRATION_CHIPS).map(([key, chip]) => (
                    <span key={key} style={{
                      background: chip.bg, color: chip.color,
                      borderRadius: '4px', padding: '1px 6px',
                      fontSize: '10px', fontWeight: 700, cursor: 'default',
                    }}>
                      {chip.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleAddWorkflow}
              style={{
                padding: '8px 18px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                border: '1px solid rgba(99,102,241,0.40)',
                color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 0 14px rgba(99,102,241,0.25)',
              }}
            >
              Add workflow
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              style={{
                padding: '8px 14px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#64748b', fontSize: '13px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pre-built templates */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
          Workflows
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {workflows.map(w => (
            <WorkflowCard key={w.id} workflow={w} onToggle={handleToggle} />
          ))}
        </div>
      </div>

      {/* Recent MCP actions */}
      {recentActions.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <GitBranch size={13} style={{ color: '#475569' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Recent AI actions
            </span>
          </div>
          {recentActions.map((action: any) => {
            const timeAgo = action.createdAt ? (() => {
              const diff = Date.now() - new Date(action.createdAt).getTime()
              const mins = Math.floor(diff / 60000)
              if (mins < 60) return `${mins}m ago`
              const hrs = Math.floor(mins / 60)
              if (hrs < 24) return `${hrs}h ago`
              return `${Math.floor(hrs / 24)}d ago`
            })() : ''
            return (
              <div key={action.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '12px', color: '#94a3b8' }}>
                  {action.label}
                  {action.dealName && <span style={{ color: '#475569' }}> · {action.dealName}</span>}
                </span>
                <span style={{ fontSize: '10px', color: '#334155', flexShrink: 0 }}>{timeAgo}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
