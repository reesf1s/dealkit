'use client'
export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Zap, Mail, GitBranch, Brain, RefreshCw, Shield,
  Check, AlertTriangle, Clock, ArrowRight, ChevronRight,
  Target, Eye, TrendingDown, Swords, Calendar, Users,
  ToggleLeft, ToggleRight, Activity, Bell,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HubSpotStatus {
  connected: boolean
  lastSync?: string
  dealCount?: number
}

interface BrainData {
  data?: {
    staleDeals?: Array<{ dealId: string; company: string; daysSinceUpdate: number }>
    urgentDeals?: Array<{ dealId: string; company: string; reason: string }>
    updatedAt?: string
  }
  meta?: { lastRebuilt: string | null; isStale: boolean }
}

interface UnmatchedRes {
  pendingCount: number
  emails?: Array<{ id: string; subject: string; from: string; receivedAt: string }>
}

interface MonitorAlert {
  dealId: string
  dealName: string
  company: string
  type: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  suggestedAction: string
}

interface MonitorData {
  data: {
    alerts: MonitorAlert[]
    summary: {
      totalActive: number
      criticalCount: number
      warningCount: number
      healthyCount: number
    }
    generatedAt: string
  }
}

interface Automation {
  id: string
  name: string
  description: string
  category: string
  enabled: boolean
  alwaysOn: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(dateStr: string): string {
  const d = new Date(dateStr)
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 1440)}d ago`
}

const card: React.CSSProperties = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
}

const sectionLabel: React.CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 600,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  marginBottom: '10px',
}

const AUTOMATION_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  deal_scoring:           { icon: Brain, color: '#1DB86A' },
  stale_alerts:           { icon: Clock, color: '#f59e0b' },
  risk_detection:         { icon: AlertTriangle, color: '#ef4444' },
  email_ingestion:        { icon: Mail, color: '#3b82f6' },
  follow_up_reminders:    { icon: Bell, color: '#8b5cf6' },
  auto_stage_suggestions: { icon: TrendingDown, color: '#0ea5e9' },
  champion_tracking:      { icon: Users, color: '#ec4899' },
  deal_decay_alerts:      { icon: Activity, color: '#f97316' },
  competitor_alerts:      { icon: Swords, color: '#6366f1' },
  close_date_monitoring:  { icon: Calendar, color: '#14b8a6' },
}

const ALERT_SEVERITY_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  critical: { bg: 'var(--color-red-bg)', border: 'rgba(239,68,68,0.30)', color: 'var(--color-red)', label: 'Critical' },
  warning:  { bg: 'var(--color-amber-bg)', border: 'rgba(245,158,11,0.30)', color: 'var(--color-amber)', label: 'Warning' },
  info:     { bg: 'var(--color-blue-bg)', border: 'rgba(59,130,246,0.30)', color: '#3b82f6', label: 'Info' },
}

// ─── Integration Card ─────────────────────────────────────────────────────────

function IntegrationCard({
  icon: Icon, iconColor, name, description, connected, meta, href,
}: {
  icon: React.ElementType; iconColor: string; name: string
  description: string; connected: boolean; meta?: string; href: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        ...card,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        transition: 'border-color 80ms',
        cursor: 'pointer',
      }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'}
      >
        <div style={{
          width: '36px', height: '36px', borderRadius: '8px',
          background: `${iconColor}14`,
          border: `1px solid ${iconColor}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={17} style={{ color: iconColor }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
            {name}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>
            {meta ?? description}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px', borderRadius: '100px',
            background: connected ? 'rgba(29,184,106,0.08)' : 'var(--surface-2)',
            border: `1px solid ${connected ? 'rgba(29,184,106,0.20)' : 'var(--border-default)'}`,
          }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: connected ? '#1DB86A' : 'var(--text-muted)',
            }} />
            <span style={{ fontSize: '11px', fontWeight: 500, color: connected ? '#1DB86A' : 'var(--text-muted)' }}>
              {connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    </Link>
  )
}

// ─── Automation Toggle Row ───────────────────────────────────────────────────

function AutomationToggleRow({
  automation, onToggle, toggling,
}: {
  automation: Automation; onToggle: (id: string, enabled: boolean) => void; toggling: string | null
}) {
  const iconInfo = AUTOMATION_ICONS[automation.id] ?? { icon: Zap, color: '#1DB86A' }
  const Icon = iconInfo.icon
  const isToggling = toggling === automation.id

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      borderBottom: '1px solid var(--border-subtle)',
      transition: 'background 80ms',
    }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      <div style={{
        width: '32px', height: '32px', borderRadius: '7px',
        background: `color-mix(in srgb, ${iconInfo.color} 10%, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={14} style={{ color: iconInfo.color }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{automation.name}</div>
        <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{automation.description}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {automation.alwaysOn && (
          <span style={{
            fontSize: '10px', fontWeight: 600,
            padding: '2px 7px', borderRadius: '100px',
            background: 'rgba(29,184,106,0.08)',
            color: '#1DB86A',
            border: '1px solid rgba(29,184,106,0.20)',
          }}>Always on</span>
        )}
        <button
          onClick={() => !automation.alwaysOn && onToggle(automation.id, !automation.enabled)}
          disabled={automation.alwaysOn || isToggling}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: automation.alwaysOn ? 'default' : 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            opacity: isToggling ? 0.5 : 1,
          }}
        >
          {automation.enabled ? (
            <ToggleRight size={28} style={{ color: '#1DB86A' }} />
          ) : (
            <ToggleLeft size={28} style={{ color: 'var(--text-muted)' }} />
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Deal Monitor Card ───────────────────────────────────────────────────────

function DealMonitorCard() {
  const { data: monitorData, isLoading } = useSWR<MonitorData>('/api/deals/monitor', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 30000,
  })

  const alerts = monitorData?.data?.alerts ?? []
  const summary = monitorData?.data?.summary
  const topAlerts = alerts.slice(0, 8)

  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={14} style={{ color: '#1DB86A' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Deal Monitor</span>
          {summary && alerts.length > 0 && (
            <span style={{
              fontSize: '10.5px', fontWeight: 600,
              padding: '1px 7px', borderRadius: '100px',
              background: summary.criticalCount > 0 ? 'var(--color-red-bg)' : 'var(--color-amber-bg)',
              color: summary.criticalCount > 0 ? 'var(--color-red)' : 'var(--color-amber)',
              border: `1px solid ${summary.criticalCount > 0 ? 'rgba(239,68,68,0.30)' : 'rgba(245,158,11,0.30)'}`,
            }}>{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        {summary && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {[
              { label: 'Active', value: summary.totalActive, color: 'var(--text-primary)' },
              { label: 'Healthy', value: summary.healthyCount, color: '#1DB86A' },
              { label: 'At risk', value: summary.criticalCount + summary.warningCount, color: summary.criticalCount > 0 ? 'var(--color-red)' : 'var(--color-amber)' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '44px', borderRadius: '6px', background: 'var(--surface-2)' }} />
          ))}
        </div>
      ) : topAlerts.length === 0 ? (
        <div style={{ padding: '28px 18px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <Check size={18} style={{ color: '#1DB86A' }} />
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>All deals healthy</span>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No alerts at the moment</span>
        </div>
      ) : (
        <div>
          {topAlerts.map((alert, i) => {
            const sev = ALERT_SEVERITY_STYLES[alert.severity] ?? ALERT_SEVERITY_STYLES.info
            return (
              <Link key={`${alert.dealId}-${alert.type}-${i}`} href={`/deals/${alert.dealId}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{
                  padding: '10px 18px',
                  borderBottom: i < topAlerts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  transition: 'background 80ms',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: sev.color,
                    flexShrink: 0,
                    marginTop: '5px',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {alert.dealName || alert.company}
                      </span>
                      <span style={{
                        fontSize: '9.5px', fontWeight: 600,
                        padding: '1px 6px', borderRadius: '100px',
                        background: sev.bg,
                        color: sev.color,
                        border: `1px solid ${sev.border}`,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}>{sev.label}</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {alert.message}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px', fontStyle: 'italic' }}>
                      {alert.suggestedAction}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
          {alerts.length > 8 && (
            <div style={{ padding: '8px 18px', textAlign: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>
                +{alerts.length - 8} more alerts
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Intelligence Health Card ─────────────────────────────────────────────────

function IntelligenceHealthCard() {
  const { data: brainData, error, isLoading, mutate } = useSWR<BrainData>('/api/brain', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 30000,
  })
  const [rebuilding, setRebuilding] = useState(false)

  const brain = brainData?.data
  const meta = brainData?.meta
  const isStale = meta?.isStale ?? true
  const lastRebuilt = meta?.lastRebuilt
  const urgentCount = brain?.urgentDeals?.length ?? 0
  const staleCount = brain?.staleDeals?.length ?? 0

  async function rebuildBrain() {
    setRebuilding(true)
    try {
      await fetch('/api/brain', { method: 'POST' })
      await mutate()
    } finally {
      setRebuilding(false)
    }
  }

  const statusColor = error ? '#f59e0b' : isStale ? '#f59e0b' : '#1DB86A'
  const statusText = error ? 'Degraded' : isStale ? 'Stale' : 'Live'

  return (
    <div style={{ ...card, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Brain size={14} style={{ color: '#1DB86A' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>AI Intelligence Engine</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '10.5px', fontWeight: 500,
            padding: '2px 8px', borderRadius: '100px',
            background: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
            color: statusColor,
            border: `1px solid color-mix(in srgb, ${statusColor} 22%, transparent)`,
          }}>{statusText}</span>
          <button
            onClick={rebuildBrain}
            disabled={rebuilding}
            style={{
              background: 'transparent', border: '1px solid var(--border-default)',
              borderRadius: '5px', padding: '3px 9px',
              cursor: rebuilding ? 'not-allowed' : 'pointer',
              fontSize: '11px', color: 'var(--text-tertiary)',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px',
              opacity: rebuilding ? 0.5 : 1,
            }}
          >
            <RefreshCw size={11} style={{ animation: rebuilding ? 'spin 1s linear infinite' : 'none' }} />
            Rebuild
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        {[
          { label: 'Last rebuilt', value: lastRebuilt ? fmtTime(lastRebuilt) : '—' },
          { label: 'Urgent deals', value: `${urgentCount}`, color: urgentCount > 0 ? '#ef4444' : undefined },
          { label: 'Stale deals', value: `${staleCount}`, color: staleCount > 0 ? '#f59e0b' : undefined },
        ].map((stat, i) => (
          <div key={i} style={{
            padding: '10px 12px',
            background: 'var(--surface-2)',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ fontSize: '9.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: stat.color ?? 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Unmatched Emails Card ────────────────────────────────────────────────────

function UnmatchedEmailsCard() {
  const { data } = useSWR<UnmatchedRes>('/api/ingest/email/unmatched', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 30000,
  })
  const count = data?.pendingCount ?? 0
  const emails = data?.emails?.slice(0, 4) ?? []

  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: count > 0 ? '1px solid var(--border-subtle)' : 'none',
        background: 'var(--surface-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Mail size={13} style={{ color: '#1DB86A' }} />
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>Unmatched emails</span>
          {count > 0 && (
            <span style={{
              fontSize: '10.5px', fontWeight: 600,
              padding: '1px 7px', borderRadius: '100px',
              background: 'var(--color-amber-bg)', color: 'var(--color-amber)',
              border: '1px solid rgba(245,158,11,0.30)',
            }}>{count}</span>
          )}
        </div>
        {count > 0 && (
          <Link href="/settings/unmatched-emails" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '11.5px', color: '#1DB86A', fontWeight: 500 }}>Review all</span>
          </Link>
        )}
      </div>

      {count === 0 ? (
        <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={14} style={{ color: '#1DB86A' }} />
          <span style={{ fontSize: '12.5px', color: 'var(--text-tertiary)' }}>All emails matched to deals</span>
        </div>
      ) : (
        <div>
          {emails.map((email, i) => (
            <div key={email.id} style={{
              padding: '10px 16px',
              borderBottom: i < emails.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email.subject}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{email.from}</span>
                <span style={{ fontSize: '10px', color: 'var(--border-default)' }}>·</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmtTime(email.receivedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const { data: hubspotRes } = useSWR('/api/integrations/hubspot/status', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 60000,
  })
  const hubspot: HubSpotStatus = hubspotRes?.data ?? { connected: false }

  const { data: automationsRes, mutate: mutateAutomations } = useSWR<{ data: Automation[] }>('/api/automations', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 30000,
  })
  const automations = automationsRes?.data ?? []
  const [toggling, setToggling] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const intelligence = automations.filter(a => a.category === 'intelligence')
    const alerts = automations.filter(a => a.category === 'alerts')
    const automation = automations.filter(a => a.category === 'automation')
    return { intelligence, alerts, automation }
  }, [automations])

  async function handleToggle(id: string, enabled: boolean) {
    setToggling(id)
    try {
      await fetch('/api/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationId: id, enabled }),
      })
      await mutateAutomations()
    } finally {
      setToggling(null)
    }
  }

  const enabledCount = automations.filter(a => a.enabled).length

  return (
    <div style={{ maxWidth: '960px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Page header ── */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.04em' }}>
          Sequences & Automations
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>
          Your CRM intelligence layer — deals are scored, signals are detected, and actions are surfaced automatically.
          {enabledCount > 0 && (
            <span style={{ color: '#1DB86A', fontWeight: 500 }}> {enabledCount} automations active.</span>
          )}
        </p>
      </div>

      {/* ── Deal Monitor ── */}
      <div>
        <div style={sectionLabel}>Deal Monitor</div>
        <DealMonitorCard />
      </div>

      {/* ── Intelligence engine status ── */}
      <IntelligenceHealthCard />

      {/* ── Automations ── */}
      <div>
        <div style={sectionLabel}>Intelligence automations</div>
        <div style={{ ...card, overflow: 'hidden' }}>
          {grouped.intelligence.map(a => (
            <AutomationToggleRow key={a.id} automation={a} onToggle={handleToggle} toggling={toggling} />
          ))}
        </div>
      </div>

      <div>
        <div style={sectionLabel}>Alert automations</div>
        <div style={{ ...card, overflow: 'hidden' }}>
          {grouped.alerts.map(a => (
            <AutomationToggleRow key={a.id} automation={a} onToggle={handleToggle} toggling={toggling} />
          ))}
        </div>
      </div>

      <div>
        <div style={sectionLabel}>Workflow automations</div>
        <div style={{ ...card, overflow: 'hidden' }}>
          {grouped.automation.map(a => (
            <AutomationToggleRow key={a.id} automation={a} onToggle={handleToggle} toggling={toggling} />
          ))}
        </div>
      </div>

      {/* ── Integrations ── */}
      <div>
        <div style={sectionLabel}>Integrations</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <IntegrationCard
            icon={GitBranch}
            iconColor="#2563eb"
            name="HubSpot"
            description="Sync deals, contacts, and activities from your CRM"
            connected={Boolean(hubspot?.connected)}
            meta={hubspot?.connected ? `${hubspot.dealCount ?? 0} deals synced${hubspot.lastSync ? ' · ' + fmtTime(hubspot.lastSync) : ''}` : 'Connect to import your deal pipeline'}
            href="/company"
          />
        </div>
      </div>

      {/* ── Unmatched emails ── */}
      <div>
        <div style={sectionLabel}>Email intelligence</div>
        <UnmatchedEmailsCard />
      </div>

      {/* ── How it works ── */}
      <div>
        <div style={sectionLabel}>How the intelligence layer works</div>
        <div style={{
          ...card,
          padding: '16px 20px',
          background: 'var(--surface-2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', flexWrap: 'wrap' }}>
            {[
              { step: '1', label: 'Deal logged', sub: 'Via HubSpot sync, email, or manual entry' },
              { step: '2', label: 'AI scores deal', sub: 'ML pipeline assigns conversion probability' },
              { step: '3', label: 'Signals detected', sub: 'Risks, blockers, and patterns extracted' },
              { step: '4', label: 'Actions surfaced', sub: 'Prioritised in your daily briefing' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                <div style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#1DB86A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                    Step {item.step}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{item.label}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', maxWidth: '130px' }}>{item.sub}</div>
                </div>
                {i < 3 && (
                  <ArrowRight size={14} style={{ color: 'var(--border-default)', flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
