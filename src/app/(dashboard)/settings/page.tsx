'use client'
export const dynamic = 'force-dynamic'

import { useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import { useState } from 'react'
import { CheckCircle, AlertTriangle, ExternalLink, Download, Trash2 } from 'lucide-react'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { useToast } from '@/components/shared/Toast'
import type { User, Plan } from '@/types'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

const PLAN_DETAILS: Record<Plan, { name: string; price: string; color: string; bg: string; features: string[] }> = {
  free: {
    name: 'Free',
    price: '$0/mo',
    color: '#888',
    bg: 'rgba(136,136,136,0.08)',
    features: ['1 product', '2 competitors', '5 case studies', '10 deal logs', '5 collateral items'],
  },
  starter: {
    name: 'Starter',
    price: '$79/mo',
    color: '#6366F1',
    bg: 'rgba(99,102,241,0.08)',
    features: ['3 products', '10 competitors', 'Unlimited case studies', 'Unlimited deals', 'Unlimited collateral', '.docx export', 'No watermark'],
  },
  pro: {
    name: 'Pro',
    price: '$149/mo',
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.08)',
    features: ['Everything in Starter', 'Unlimited products', 'Batch regenerate', 'Email sequences', 'AI meeting prep', 'Team features'],
  },
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#F1F1F3', margin: 0, marginBottom: description ? '4px' : 0 }}>{title}</h2>
        {description && <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{description}</p>}
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ fontSize: '13px', color: '#666' }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#F1F1F3', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser()
  const { toast } = useToast()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [billingLoading, setBillingLoading] = useState<Plan | 'portal' | null>(null)

  const { data: userRes, isLoading: loadingUser } = useSWR<{ data: User }>('/api/user', fetcher)
  const dbUser = userRes?.data

  async function handleExportData() {
    setExportLoading(true)
    try {
      const res = await fetch('/api/export/data')
      if (!res.ok) throw new Error('Failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dealkit-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast('Data exported successfully', 'success')
    } catch {
      toast('Failed to export data', 'error')
    } finally {
      setExportLoading(false)
    }
  }

  async function handleUpgrade(plan: Plan) {
    setBillingLoading(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error ?? 'Failed to start checkout', 'error')
        return
      }
      if (json.url) window.location.href = json.url
    } catch {
      toast('Stripe not configured. Add STRIPE_SECRET_KEY to enable billing.', 'error')
    } finally {
      setBillingLoading(null)
    }
  }

  async function handleBillingPortal() {
    setBillingLoading('portal')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error ?? 'Failed to open billing portal', 'error')
        return
      }
      if (json.url) window.location.href = json.url
    } catch {
      toast('Stripe not configured. Add STRIPE_SECRET_KEY to enable billing.', 'error')
    } finally {
      setBillingLoading(null)
    }
  }

  async function handleDeleteAccount() {
    try {
      const res = await fetch('/api/user', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast('Account deletion requested', 'info')
    } catch {
      toast('Failed to delete account. Please contact support.', 'error')
    }
  }

  const currentPlan = dbUser?.plan ?? 'free'
  const planDetail = PLAN_DETAILS[currentPlan]

  return (
    <div style={{ padding: '32px', maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          margin: 0,
          marginBottom: '5px',
          background: 'linear-gradient(135deg, #F1F1F3 0%, #A5A5C0 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Settings
        </h1>
        <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
          Manage your account and billing preferences
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Account section */}
        <SectionCard title="Account" description="Your Clerk account details">
          {!isLoaded || loadingUser ? (
            <SkeletonCard lines={3} showHeader={false} />
          ) : (
            <div>
              <FieldRow label="Name" value={user?.fullName ?? user?.firstName ?? '—'} />
              <FieldRow label="Email" value={user?.primaryEmailAddress?.emailAddress ?? '—'} />
              <FieldRow label="Member since" value={dbUser?.createdAt ? new Date(dbUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'} />

              <div style={{ marginTop: '16px' }}>
                <a
                  href="https://accounts.clerk.com/user"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    height: '32px', padding: '0 14px',
                    borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                    color: '#F1F1F3',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    textDecoration: 'none',
                    transition: 'background-color 150ms ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.10)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
                >
                  <ExternalLink size={12} strokeWidth={2} />
                  Manage account on Clerk
                </a>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Billing / Plan section */}
        <SectionCard title="Plan & billing" description="Your current plan and upgrade options">
          {loadingUser ? (
            <SkeletonCard lines={3} showHeader={false} />
          ) : (
            <div>
              {/* Current plan indicator */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px', borderRadius: '10px',
                background: planDetail.bg,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: `1px solid ${planDetail.color}33`,
                marginBottom: '20px',
                boxShadow: `0 0 20px ${planDetail.color}15`,
              }}>
                <CheckCircle size={18} strokeWidth={2} style={{ color: planDetail.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: planDetail.color, margin: 0 }}>
                    {planDetail.name} Plan
                  </p>
                  <p style={{ fontSize: '12px', color: '#666', margin: '2px 0 0' }}>
                    {planDetail.features.join(' · ')}
                  </p>
                </div>
                <span style={{ fontSize: '16px', fontWeight: 800, color: planDetail.color, letterSpacing: '-0.02em' }}>
                  {planDetail.price}
                </span>
              </div>

              {/* Plan cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {(Object.entries(PLAN_DETAILS) as [Plan, typeof PLAN_DETAILS[Plan]][]).map(([plan, detail]) => {
                  const isCurrent = currentPlan === plan
                  const isUpgrade = ['free', 'starter', 'pro'].indexOf(plan) > ['free', 'starter', 'pro'].indexOf(currentPlan)

                  return (
                    <div
                      key={plan}
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        background: isCurrent
                          ? detail.bg
                          : 'rgba(255,255,255,0.02)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: `1px solid ${isCurrent ? `${detail.color}44` : 'rgba(255,255,255,0.07)'}`,
                        boxShadow: isCurrent ? `0 0 20px ${detail.color}15` : 'none',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: isCurrent ? detail.color : '#F1F1F3' }}>
                          {detail.name}
                        </span>
                        <span style={{ fontSize: '12px', color: '#666' }}>{detail.price}</span>
                      </div>

                      <ul style={{ margin: '0 0 12px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {detail.features.map((f) => (
                          <li key={f} style={{ fontSize: '11px', color: '#666', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <CheckCircle size={10} strokeWidth={2} style={{ color: detail.color, flexShrink: 0 }} />
                            {f}
                          </li>
                        ))}
                      </ul>

                      {isCurrent ? (
                        <span style={{
                          display: 'block', textAlign: 'center',
                          fontSize: '11px', fontWeight: 600, color: detail.color,
                          padding: '5px 0',
                          background: `${detail.color}15`,
                          borderRadius: '5px',
                          border: `1px solid ${detail.color}30`,
                        }}>
                          Current plan
                        </span>
                      ) : (
                        <button
                          disabled={billingLoading === plan}
                          style={{
                            width: '100%',
                            height: '30px',
                            borderRadius: '7px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: isUpgrade ? '#fff' : '#888',
                            background: isUpgrade
                              ? `linear-gradient(135deg, ${detail.color}, ${detail.color}cc)`
                              : 'rgba(255,255,255,0.05)',
                            border: isUpgrade ? 'none' : '1px solid rgba(255,255,255,0.08)',
                            cursor: billingLoading === plan ? 'not-allowed' : 'pointer',
                            opacity: billingLoading === plan ? 0.6 : 1,
                            boxShadow: isUpgrade ? `0 0 16px ${detail.color}40` : 'none',
                            transition: 'opacity 150ms ease',
                          }}
                          onMouseEnter={(e) => { if (billingLoading !== plan) e.currentTarget.style.opacity = '0.85' }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = billingLoading === plan ? '0.6' : '1' }}
                          onClick={() => {
                            if (plan === 'free') {
                              handleBillingPortal()
                            } else {
                              handleUpgrade(plan as 'starter' | 'pro')
                            }
                          }}
                        >
                          {billingLoading === plan
                            ? 'Redirecting…'
                            : isUpgrade
                            ? `Upgrade to ${detail.name}`
                            : `Downgrade to ${detail.name}`}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {currentPlan !== 'free' && (
                <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                  Manage invoices and payment methods via the{' '}
                  <button
                    onClick={handleBillingPortal}
                    disabled={billingLoading === 'portal'}
                    style={{ background: 'none', border: 'none', cursor: billingLoading === 'portal' ? 'not-allowed' : 'pointer', color: '#6366F1', fontSize: '12px', padding: 0, opacity: billingLoading === 'portal' ? 0.6 : 1 }}
                  >
                    {billingLoading === 'portal' ? 'Redirecting…' : 'Stripe billing portal'}
                  </button>.
                </p>
              )}
            </div>
          )}
        </SectionCard>

        {/* Data section */}
        <SectionCard title="Your data" description="Export or delete all your DealKit data">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 500, color: '#F1F1F3', margin: 0 }}>Export all data</p>
                <p style={{ fontSize: '12px', color: '#666', margin: '2px 0 0' }}>Download all your data as a JSON file</p>
              </div>
              <button
                onClick={handleExportData}
                disabled={exportLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  height: '32px', padding: '0 14px',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                  color: '#F1F1F3',
                  backgroundColor: 'rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  cursor: exportLoading ? 'not-allowed' : 'pointer',
                  opacity: exportLoading ? 0.6 : 1,
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => { if (!exportLoading) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)' }}
              >
                <Download size={13} strokeWidth={2} />
                {exportLoading ? 'Exporting…' : 'Export'}
              </button>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.05)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(239,68,68,0.18)',
            }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 500, color: '#EF4444', margin: 0 }}>Delete account</p>
                <p style={{ fontSize: '12px', color: '#666', margin: '2px 0 0' }}>Permanently delete your account and all data. This cannot be undone.</p>
              </div>
              <button
                onClick={() => setDeleteOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  height: '32px', padding: '0 14px',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                  color: '#EF4444',
                  backgroundColor: 'rgba(239,68,68,0.10)',
                  border: '1px solid rgba(239,68,68,0.22)',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.18)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.10)' }}
              >
                <Trash2 size={13} strokeWidth={2} />
                Delete account
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Warning banner */}
        <div style={{
          display: 'flex', gap: '10px',
          padding: '12px 14px', borderRadius: '10px',
          background: 'rgba(245,158,11,0.06)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(245,158,11,0.18)',
        }}>
          <AlertTriangle size={15} strokeWidth={2} style={{ color: '#F59E0B', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '12px', color: '#888', margin: 0, lineHeight: 1.5 }}>
            Account deletion and data export can only be performed by the account owner. Deleting your account will cancel any active subscriptions and permanently remove all data.
          </p>
        </div>
      </div>

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete account"
        description="This will permanently delete your account, all your data (competitors, case studies, deals, collateral), and cancel any active subscriptions. This cannot be undone."
        confirmLabel="Delete my account"
        destructive
        onConfirm={handleDeleteAccount}
      />
    </div>
  )
}
