'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import { CheckCircle2, Zap, ArrowUpRight, CreditCard } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// Maps internal plan IDs to display names and prices
const PLAN_DISPLAY: Record<string, {
  name: string; price: number; color: string; description: string; features: string[]
}> = {
  free: {
    name: 'Free',
    price: 0,
    color: 'var(--text-tertiary)',
    description: 'Get started with the essentials.',
    features: [
      'Up to 5 deals',
      'MCP access (Claude Desktop)',
      'Basic intelligence',
      'Community support',
    ],
  },
  starter: {
    name: 'Growth',
    price: 69,
    color: 'var(--accent-primary)',
    description: 'For growing sales teams closing more deals.',
    features: [
      'Unlimited deals',
      'Slack + Linear + HubSpot integrations',
      'Full MCP access',
      'Win playbook & battlecards',
      'Revenue-to-Product loop',
      '1 workspace',
      'Email support',
    ],
  },
  pro: {
    name: 'Scale',
    price: 149,
    color: 'var(--accent-success)',
    description: 'For high-velocity teams that need everything.',
    features: [
      'Everything in Growth',
      'Multi-workspace',
      'Priority support',
      'Custom brain refresh cadence',
      'Advanced ML models',
      'Dedicated Slack channel',
      'Early access to new features',
    ],
  },
}

export default function BillingPage() {
  const { data: contextRes } = useSWR('/api/account', fetcher, { revalidateOnFocus: false })
  const [upgrading, setUpgrading] = useState<string | null>(null)

  const currentPlan: string = contextRes?.workspace?.plan ?? 'free'
  const display = PLAN_DISPLAY[currentPlan] ?? PLAN_DISPLAY.free

  async function upgrade(targetInternalPlan: 'starter' | 'pro') {
    setUpgrading(targetInternalPlan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: targetInternalPlan }),
      })
      const json = await res.json()
      if (json.url) {
        window.location.href = json.url
      } else {
        alert(json.error ?? 'Failed to create checkout session.')
      }
    } finally {
      setUpgrading(null)
    }
  }

  async function openPortal() {
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const json = await res.json()
    if (json.url) window.location.href = json.url
  }

  const card: React.CSSProperties = {
    background: 'var(--bg-glass)',
    backdropFilter: 'blur(16px)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '24px',
  }

  return (
    <div style={{ maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Billing
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
          Manage your plan and billing.
        </p>
      </div>

      {/* Current plan */}
      <div style={{
        ...card,
        background: 'var(--bg-hero)',
        border: '1px solid rgba(99,102,241,0.20)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              Current plan
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {display.name}
              </span>
              {display.price > 0 && (
                <span style={{
                  fontSize: '12px', color: display.color,
                  background: `${display.color}1a`, padding: '2px 10px',
                  borderRadius: '100px', border: `1px solid ${display.color}33`,
                  fontWeight: 600,
                }}>
                  ${display.price}/mo
                </span>
              )}
              {display.price === 0 && (
                <span style={{
                  fontSize: '12px', color: 'var(--text-tertiary)',
                  background: 'var(--bg-glass)', padding: '2px 10px',
                  borderRadius: '100px', border: '1px solid var(--border-subtle)',
                  fontWeight: 600,
                }}>
                  Free
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{display.description}</div>
          </div>
          {currentPlan !== 'free' && (
            <button
              onClick={openPortal}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-glass)', border: '1px solid var(--border-default)',
                fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
            >
              <CreditCard size={13} /> Manage billing
            </button>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
        {(['free', 'starter', 'pro'] as const).map(planId => {
          const plan = PLAN_DISPLAY[planId]
          const isCurrent = currentPlan === planId
          const isUpgrade = ['free', 'starter', 'pro'].indexOf(planId) > ['free', 'starter', 'pro'].indexOf(currentPlan)

          return (
            <div
              key={planId}
              style={{
                ...card,
                border: isCurrent ? `1px solid ${plan.color}40` : '1px solid var(--border-subtle)',
                background: isCurrent ? `${plan.color}0a` : 'var(--bg-glass)',
                position: 'relative',
              }}
            >
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: '12px', right: '12px',
                  fontSize: '10px', fontWeight: 600, color: plan.color,
                  background: `${plan.color}1a`, padding: '2px 8px', borderRadius: '100px',
                }}>
                  Current
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {plan.name}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: plan.color, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {plan.price === 0 ? 'Free' : `$${plan.price}`}
                  {plan.price > 0 && <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '4px' }}>/mo</span>}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{plan.description}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <CheckCircle2 size={13} style={{ color: plan.color, flexShrink: 0, marginTop: '1px' }} />
                    {f}
                  </div>
                ))}
              </div>

              {isUpgrade && planId !== 'free' && (
                <button
                  onClick={() => upgrade(planId as 'starter' | 'pro')}
                  disabled={upgrading === planId}
                  style={{
                    width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)',
                    background: plan.color, border: 'none',
                    color: '#fff', fontSize: '13px', fontWeight: 600,
                    cursor: upgrading === planId ? 'not-allowed' : 'pointer',
                    opacity: upgrading === planId ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    transition: 'opacity var(--transition-fast)',
                    fontFamily: 'inherit',
                  }}
                >
                  <Zap size={14} />
                  {upgrading === planId ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                </button>
              )}

              {isCurrent && planId !== 'free' && (
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  ✓ Active plan
                </div>
              )}

              {planId === 'free' && !isCurrent && (
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  Downgrade via billing portal
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Enterprise */}
      <div style={{
        ...card,
        display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Enterprise</div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Custom pricing · Multi-workspace · SSO · Dedicated support · Custom integrations
          </div>
        </div>
        <a
          href="mailto:hello@halvex.io?subject=Enterprise inquiry"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-glass)', border: '1px solid var(--border-default)',
            fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600,
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
        >
          Contact us <ArrowUpRight size={12} />
        </a>
      </div>

    </div>
  )
}
