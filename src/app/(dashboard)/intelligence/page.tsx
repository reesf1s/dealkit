'use client'
export const dynamic = 'force-dynamic'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { AlertTriangle, Bot, CheckCircle2, Clock3, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { useToast } from '@/components/shared/Toast'
import type { DealLog } from '@/types'

interface AutomationItem {
  id: string
  name: string
  description: string
  category: 'intelligence' | 'alerts' | 'automation'
  enabled: boolean
  alwaysOn: boolean
}

interface AutomationResponse {
  data: AutomationItem[]
  meta?: {
    canEdit?: boolean
    role?: string
  }
}

const CATEGORY_META: Record<AutomationItem['category'], { label: string; color: string }> = {
  intelligence: { label: 'Intelligence', color: 'var(--brand)' },
  alerts: { label: 'Alerts', color: '#fbbf24' },
  automation: { label: 'Workflow', color: '#4ade80' },
}

function statusColor(item: AutomationItem): string {
  if (item.alwaysOn) return '#4ade80'
  return item.enabled ? 'var(--brand)' : 'var(--text-muted)'
}

export default function IntelligencePage() {
  const [savingId, setSavingId] = useState<string | null>(null)
  const { toast } = useToast()

  const { data: automationsRes, isLoading, mutate } = useSWR<AutomationResponse>('/api/automations', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const { data: dealsRes } = useSWR<{ data: DealLog[] }>('/api/deals', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 45_000,
  })

  const automations = automationsRes?.data ?? []
  const canEdit = automationsRes?.meta?.canEdit ?? true
  const deals = dealsRes?.data ?? []

  const openDeals = useMemo(
    () => deals.filter(deal => deal.stage !== 'closed_won' && deal.stage !== 'closed_lost'),
    [deals],
  )

  const staleDeals = useMemo(
    () => openDeals.filter(deal => (Date.now() - +new Date(deal.updatedAt)) / 86_400_000 >= 10).length,
    [openDeals],
  )

  const atRiskDeals = useMemo(
    () => openDeals.filter(deal => (deal.conversionScore ?? 100) < 40).length,
    [openDeals],
  )

  const enabledCount = automations.filter(a => a.enabled).length
  const alwaysOnCount = automations.filter(a => a.alwaysOn).length
  const alertsCount = automations.filter(a => a.category === 'alerts' && a.enabled).length

  const sortedAutomations = useMemo(
    () => [...automations].sort((a, b) => Number(b.alwaysOn) - Number(a.alwaysOn) || Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)),
    [automations],
  )

  async function toggleAutomation(item: AutomationItem) {
    if (item.alwaysOn || savingId) return
    if (!canEdit) {
      toast('Only workspace owners/admins can change automation policy.', 'warning')
      return
    }

    setSavingId(item.id)
    try {
      const res = await fetch('/api/automations', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationId: item.id, enabled: !item.enabled }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Unable to update automation')
      }
      await mutate()
      toast(`${item.name} ${item.enabled ? 'disabled' : 'enabled'}.`, 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to update automation', 'error')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <section className="notion-panel" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--text-tertiary)' }}>
              Automation Control
            </div>
            <h1 style={{ margin: '6px 0 0', fontSize: 22, letterSpacing: 0 }}>Silent deal intelligence engine</h1>
            <p style={{ margin: '7px 0 0', color: 'var(--text-secondary)', fontSize: 13.5, maxWidth: 860 }}>
              This layer runs in the background and should stay mostly invisible to reps. Use this page to control policy, alert noise, and governance while keeping frontline CRM workflows simple.
            </p>
          </div>
          <span className="notion-chip" style={{ alignSelf: 'flex-start' }}>
            <ShieldCheck size={12} /> Enterprise mode
          </span>
        </div>
      </section>

      <section className="intelligence-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {[
          { label: 'Active Automations', value: String(enabledCount), sub: `${alwaysOnCount} always-on`, icon: Bot },
          { label: 'Live Alerts', value: String(alertsCount), sub: 'Risk and decay watchers', icon: AlertTriangle },
          { label: 'At-Risk Deals', value: String(atRiskDeals), sub: 'Score under 40', icon: Zap },
          { label: 'Stale Deals', value: String(staleDeals), sub: 'No movement in 10+ days', icon: Clock3 },
        ].map(card => (
          <article key={card.label} className="notion-kpi" style={{ padding: '13px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)' }}>{card.label}</span>
              <card.icon size={13} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0, lineHeight: 1.1 }}>{card.value}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{card.sub}</div>
          </article>
        ))}
      </section>

      <section className="notion-panel" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0, textTransform: 'none', fontSize: 15, letterSpacing: 0, color: 'var(--text-primary)' }}>
            Automation policy
          </h2>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {canEdit ? 'Toggle only what should surface to reps' : 'Read-only: ask an owner/admin to edit policy'}
          </span>
        </div>

        {isLoading ? (
          <div className="skeleton" style={{ height: 220, borderRadius: 10 }} />
        ) : sortedAutomations.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>No automation templates found for this workspace.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {sortedAutomations.map(item => {
              const category = CATEGORY_META[item.category]
              const active = item.enabled
              const saving = savingId === item.id

              return (
                <article
                  key={item.id}
                  style={{
                    border: active ? '1px solid var(--brand-border)' : '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    background: active ? 'var(--surface-selected)' : 'var(--surface-1)',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 999,
                            color: category.color,
                            border: `1px solid ${category.color}44`,
                            background: `${category.color}1A`,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                          }}
                        >
                          {category.label}
                        </span>
                        {item.alwaysOn && (
                          <span className="notion-chip" style={{ color: '#4ade80' }}>
                            <CheckCircle2 size={11} /> Always on
                          </span>
                        )}
                      </div>

                      <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {item.description}
                      </p>
                    </div>

                    <button
                      onClick={() => toggleAutomation(item)}
                      disabled={item.alwaysOn || saving || !canEdit}
                      style={{
                        width: 86,
                        height: 30,
                        borderRadius: 999,
                        border: active ? '1px solid var(--brand-border)' : '1px solid var(--border-default)',
                        background: active ? 'var(--surface-2)' : 'var(--surface-1)',
                        color: statusColor(item),
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: item.alwaysOn || !canEdit ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {item.alwaysOn ? 'Locked' : active ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="notion-panel" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Sparkles size={14} style={{ color: 'var(--brand)' }} />
          <h2 style={{ margin: 0, textTransform: 'none', fontSize: 15, letterSpacing: 0, color: 'var(--text-primary)' }}>
            Operating model guidance
          </h2>
        </div>

        <div style={{ display: 'grid', gap: 6, color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.6 }}>
          <div>1. Keep scoring, decay monitoring, and signal detection on at all times.</div>
          <div>2. Limit front-line alert volume by only enabling notifications your team commits to actioning.</div>
          <div>3. Use this panel for admins and revops only; reps should work primarily from the deals and dashboard views.</div>
        </div>
      </section>

      <style>{`
        @media (max-width: 1120px) {
          .intelligence-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 760px) {
          .intelligence-kpis { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
