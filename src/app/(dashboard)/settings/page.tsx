'use client'
export const dynamic = 'force-dynamic'

import { useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import { useState, useEffect } from 'react'
import { Check, CheckCircle, AlertTriangle, ExternalLink, Download, Trash2, Copy, LogOut, RefreshCw, Plug, Unplug, Mail, Key, Inbox, Loader2, X } from 'lucide-react'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { useToast } from '@/components/shared/Toast'
import type { Plan } from '@/types'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

type DbUser = {
  id: string
  email: string
  createdAt: string
  plan: Plan
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  role: 'owner' | 'admin' | 'member'
}

type Member = {
  id: string
  userId: string
  email: string
  role: 'owner' | 'admin' | 'member'
  appRole: 'sales' | 'product' | 'admin'
  createdAt: string
}

const PLAN_DETAILS: Record<Plan, { name: string; price: string; color: string; bg: string; border: string; features: string[] }> = {
  free: {
    name: 'Free', price: '$0/mo', color: 'var(--text-secondary)', bg: 'rgba(55,53,47,0.06)', border: 'rgba(55,53,47,0.16)',
    features: ['1 product', '1 competitor', '2 case studies', '5 deal logs', '3 AI collateral pieces'],
  },
  starter: {
    name: 'Starter', price: '$79/mo', color: '#5e6ad2', bg: 'rgba(94,106,210,0.08)', border: 'rgba(94,106,210,0.25)',
    features: ['5 products', '15 competitors', 'Unlimited case studies', 'Unlimited deals', 'Unlimited collateral', 'AI meeting prep', '.docx export'],
  },
  pro: {
    name: 'Pro', price: '$149/mo', color: '#0f7b6c', bg: 'rgba(15,123,108,0.08)', border: 'rgba(15,123,108,0.20)',
    features: ['Everything in Starter', 'Unlimited everything', 'AI deal scoring', 'PDF export', 'Priority support', 'Early access'],
  },
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid rgba(55,53,47,0.12)',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(55,53,47,0.06)',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(55,53,47,0.09)', background: '#f7f6f3' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: description ? '3px' : 0 }}>{title}</h2>
        {description && <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>{description}</p>}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

const APP_ROLE_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  sales:   { label: 'Sales',   color: 'var(--text-secondary)', bg: 'rgba(55,53,47,0.06)', border: 'rgba(55,53,47,0.16)' },
  product: { label: 'Product', color: '#0f7b6c', bg: 'rgba(15,123,108,0.08)', border: 'rgba(15,123,108,0.20)' },
  admin:   { label: 'Admin',   color: '#cb6c2c', bg: 'rgba(203,108,44,0.08)', border: 'rgba(203,108,44,0.20)' },
}

function MembersList({
  members, currentUserId, isAdmin, onRemove, onRoleChange,
}: {
  members: Member[]
  currentUserId: string | undefined
  isAdmin: boolean
  onRemove: (userId: string, email: string) => void
  onRoleChange: () => void
}) {
  const { toast } = useToast()
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)

  async function handleAppRoleChange(targetUserId: string, appRole: string) {
    setUpdatingRole(targetUserId)
    try {
      const res = await fetch('/api/workspaces/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, appRole }),
      })
      if (!res.ok) throw new Error('Failed')
      toast(`Role updated to ${appRole}`, 'success')
      onRoleChange()
    } catch { toast('Failed to update role', 'error') }
    finally { setUpdatingRole(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {members.map(m => {
        const roleInfo = APP_ROLE_LABELS[m.appRole ?? 'sales'] ?? APP_ROLE_LABELS.sales
        const isMe = m.userId === currentUserId
        return (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 10px', borderRadius: '8px',
            background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.09)',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                background: 'rgba(94,106,210,0.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: '#5e6ad2',
              }}>
                {m.email[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', margin: 0, textTransform: 'capitalize' }}>{m.role}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {isAdmin ? (
                <select
                  value={m.appRole ?? 'sales'}
                  onChange={e => handleAppRoleChange(m.userId, e.target.value)}
                  disabled={updatingRole === m.userId}
                  style={{
                    padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                    background: roleInfo.bg, color: roleInfo.color,
                    border: `1px solid ${roleInfo.border}`,
                    cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
                    opacity: updatingRole === m.userId ? 0.6 : 1,
                  }}
                >
                  <option value="sales">Sales</option>
                  <option value="product">Product</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: roleInfo.bg, color: roleInfo.color, border: `1px solid ${roleInfo.border}` }}>
                  {roleInfo.label}
                </span>
              )}
              {isAdmin && !isMe && (
                <button onClick={() => onRemove(m.userId, m.email)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px', borderRadius: '5px', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#e03e3e')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9b9a97')}
                >
                  <Trash2 size={12} />
                </button>
              )}
              {isMe && (
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--surface-2)', border: '1px solid rgba(55,53,47,0.12)', padding: '2px 7px', borderRadius: '4px' }}>you</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(55,53,47,0.09)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}


export default function SettingsPage() {
  const { user, isLoaded } = useUser()
  const { toast } = useToast()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [billingLoading, setBillingLoading] = useState<Plan | 'portal' | 'sync' | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [globalConsent, setGlobalConsent] = useState<boolean | null>(null)
  const [consentLoading, setConsentLoading] = useState(false)
  const [eraseLoading, setEraseLoading] = useState(false)
  const [emailDigest, setEmailDigest] = useState<boolean | null>(null)
  const [digestLoading, setDigestLoading] = useState(false)

  const { data: userRes, isLoading: loadingUser } = useSWR<{ data: DbUser }>('/api/user', fetcher)
  const { data: membersRes, isLoading: loadingMembers, mutate: mutateMembers } = useSWR<{ data: Member[] }>('/api/workspaces/members', fetcher)
  const { data: configData, mutate: mutateConfig } = useSWR('/api/pipeline-config', fetcher, { revalidateOnFocus: false })
  const { data: consentRes } = useSWR<{ consented: boolean }>('/api/global/consent', fetcher, { revalidateOnFocus: false })
  const { data: workspaceRes, mutate: mutateWorkspace } = useSWR<{ data: { emailDigestEnabled: boolean } }>('/api/workspaces', fetcher, { revalidateOnFocus: false })
  const dbUser = userRes?.data

  // Sync consent state from server
  useEffect(() => {
    if (consentRes && globalConsent === null) setGlobalConsent(consentRes.consented ?? false)
  }, [consentRes, globalConsent])

  // Sync email digest state from server
  useEffect(() => {
    if (workspaceRes?.data && emailDigest === null) {
      setEmailDigest(workspaceRes.data.emailDigestEnabled ?? true)
    }
  }, [workspaceRes, emailDigest])

  const handleConsentToggle = async (value: boolean) => {
    if (!dbUser?.workspaceId) return
    setConsentLoading(true)
    try {
      const res = await fetch('/api/global/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consented: value, workspaceId: dbUser.workspaceId }),
      })
      if (res.ok) {
        setGlobalConsent(value)
        toast(value
          ? 'Industry Intelligence enabled — your anonymised deal outcomes will improve predictions for all users.'
          : 'Contribution disabled. Your data will be excluded from the next model update.',
          'success')
      } else {
        toast('Failed to update consent preference', 'error')
      }
    } catch { toast('Failed to update consent preference', 'error') }
    finally { setConsentLoading(false) }
  }

  const handleGlobalErase = async () => {
    if (!dbUser?.workspaceId) return
    setEraseLoading(true)
    try {
      const res = await fetch('/api/global/erase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: dbUser.workspaceId }),
      })
      const json = await res.json()
      if (res.ok) {
        setGlobalConsent(false)
        toast(json.message ?? 'Data erased from global pool.', 'success')
      } else {
        toast(json.error ?? 'Erasure failed', 'error')
      }
    } catch { toast('Erasure failed', 'error') }
    finally { setEraseLoading(false) }
  }
  const members = membersRes?.data ?? []
  const [savingCurrency, setSavingCurrency] = useState(false)
  const [savingDisplay, setSavingDisplay] = useState(false)
  const currentCurrency: string = configData?.data?.currency ?? '£'
  const currentDisplay: string = configData?.data?.valueDisplay ?? 'arr'


  async function handleExportData() {
    setExportLoading(true)
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) throw new Error('Failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `halvex-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast('Data exported successfully', 'success')
    } catch { toast('Failed to export data', 'error') }
    finally { setExportLoading(false) }
  }

  async function handleUpgrade(plan: Plan) {
    setBillingLoading(plan)
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }) })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Failed to start checkout', 'error'); return }
      if (json.url) window.location.href = json.url
    } catch { toast('Stripe not configured. Add STRIPE_SECRET_KEY to enable billing.', 'error') }
    finally { setBillingLoading(null) }
  }

  async function handleBillingPortal() {
    setBillingLoading('portal')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Failed to open billing portal', 'error'); return }
      if (json.url) window.location.href = json.url
    } catch { toast('Stripe not configured.', 'error') }
    finally { setBillingLoading(null) }
  }

  async function handleSyncPlan() {
    setBillingLoading('sync')
    try {
      const res = await fetch('/api/billing/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Sync failed', 'error'); return }
      if (json.synced) {
        toast(`Plan updated to ${json.plan}`, 'success')
        window.location.reload()
      } else {
        toast(`Plan is already ${json.plan} — no change needed`, 'success')
      }
    } catch { toast('Sync failed', 'error') }
    finally { setBillingLoading(null) }
  }

  async function handleCurrencyChange(symbol: string) {
    setSavingCurrency(true)
    try {
      const res = await fetch('/api/pipeline-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: symbol }),
      })
      if (!res.ok) throw new Error('Failed')
      await mutateConfig()
      toast(`Currency updated to ${symbol}`, 'success')
    } catch { toast('Failed to save currency', 'error') }
    finally { setSavingCurrency(false) }
  }

  async function handleDisplayChange(mode: string) {
    setSavingDisplay(true)
    try {
      const res = await fetch('/api/pipeline-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueDisplay: mode }),
      })
      if (!res.ok) throw new Error('Failed')
      await mutateConfig()
      toast(`Values now showing as ${mode.toUpperCase()}`, 'success')
    } catch { toast('Failed to save display preference', 'error') }
    finally { setSavingDisplay(false) }
  }

  async function handleDeleteAccount() {
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast('Account deleted successfully', 'success')
      window.location.href = '/'
    } catch { toast('Failed to delete account. Please contact support.', 'error') }
  }

  async function handleDigestToggle(value: boolean) {
    setDigestLoading(true)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailDigestEnabled: value }),
      })
      if (!res.ok) throw new Error('Failed')
      setEmailDigest(value)
      await mutateWorkspace()
      toast(value ? 'Weekly email digest enabled' : 'Email digest disabled', 'success')
    } catch { toast('Failed to update notification preference', 'error') }
    finally { setDigestLoading(false) }
  }

  async function handleLeaveWorkspace() {
    try {
      const res = await fetch('/api/workspaces/leave', { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      toast('Left workspace', 'success')
      window.location.href = '/dashboard'
    } catch { toast('Failed to leave workspace', 'error') }
  }

  async function handleRemoveMember(targetUserId: string, email: string) {
    if (!confirm(`Remove ${email} from the workspace?`)) return
    try {
      const res = await fetch('/api/workspaces/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      })
      if (!res.ok) throw new Error('Failed')
      toast(`${email} removed`, 'success')
      mutateMembers()
    } catch { toast('Failed to remove member', 'error') }
  }

  function handleCopyJoinCode() {
    if (!dbUser?.workspaceSlug) return
    navigator.clipboard.writeText(dbUser.workspaceSlug)
    toast('Join code copied!', 'success')
  }

  const currentPlan = dbUser?.plan ?? 'free'
  const planDetail = PLAN_DETAILS[currentPlan]
  const isOwner = dbUser?.role === 'owner'

  return (
    <div style={{ padding: '24px', maxWidth: '700px', margin: '0 auto', background: 'var(--surface-1)', minHeight: '100%' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontSize: '22px', fontWeight: 700, margin: 0, marginBottom: '4px',
          color: 'var(--text-primary)',
        }}>Settings</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>Manage your workspace, team, and billing</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Unmatched emails banner */}
        <UnmatchedEmailsBanner />

        {/* Account */}
        <SectionCard title="Account" description="Your Clerk account details">
          {!isLoaded || loadingUser ? <SkeletonCard lines={3} showHeader={false} /> : (
            <div>
              <FieldRow label="Name" value={user?.fullName ?? user?.firstName ?? '—'} />
              <FieldRow label="Email" value={user?.primaryEmailAddress?.emailAddress ?? '—'} />
              <FieldRow label="Member since" value={dbUser?.createdAt ? new Date(dbUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'} />
              <div style={{ marginTop: '14px' }}>
                <a href="https://accounts.clerk.com/user" target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                    color: 'var(--text-primary)', backgroundColor: 'rgba(55,53,47,0.06)',
                    border: '1px solid rgba(55,53,47,0.12)', textDecoration: 'none',
                  }}>
                  <ExternalLink size={11} strokeWidth={2} />
                  Manage on Clerk
                </a>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Team */}
        <SectionCard title="Team" description="Your workspace and join code for teammates">
          {loadingUser || loadingMembers ? <SkeletonCard lines={4} showHeader={false} /> : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{dbUser?.workspaceName ?? 'My Workspace'}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Role: <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{dbUser?.role}</span></p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>Join code</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <code style={{
                      fontSize: '12px', fontWeight: 600, color: '#5e6ad2',
                      background: 'rgba(94,106,210,0.08)', padding: '3px 8px', borderRadius: '6px',
                      border: '1px solid rgba(94,106,210,0.20)', fontFamily: 'monospace',
                    }}>
                      {dbUser?.workspaceSlug ?? '—'}
                    </code>
                    <button onClick={handleCopyJoinCode}
                      title="Copy join code"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '26px', height: '26px', borderRadius: '6px',
                        background: 'var(--surface-2)', border: '1px solid rgba(55,53,47,0.12)',
                        cursor: 'pointer', color: 'var(--text-secondary)',
                      }}>
                      <Copy size={11} />
                    </button>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '0 0 10px' }}>
                Share the join code with teammates. They enter it at <strong style={{ color: 'var(--text-secondary)' }}>/settings</strong> → Join workspace.
              </p>

              {/* Members list */}
              <MembersList
                members={members}
                currentUserId={dbUser?.id}
                isAdmin={isOwner || dbUser?.role === 'admin'}
                onRemove={handleRemoveMember}
                onRoleChange={mutateMembers}
              />

              {/* Join another workspace */}
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(55,53,47,0.09)' }}>
                <JoinWorkspaceForm onJoined={() => window.location.reload()} />
              </div>

              {!isOwner && (
                <button onClick={() => setLeaveOpen(true)}
                  style={{
                    marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '6px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                    color: '#e03e3e', background: 'rgba(224,62,62,0.08)', border: '1px solid rgba(224,62,62,0.20)',
                    cursor: 'pointer',
                  }}>
                  <LogOut size={12} />
                  Leave workspace
                </button>
              )}
            </div>
          )}
        </SectionCard>

        {/* Workspace preferences */}
        <SectionCard title="Preferences" description="Currency and display settings for your workspace">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Currency */}
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Currency symbol used across deal values, KPIs, and reports
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { symbol: '$', label: 'USD $' },
                  { symbol: '£', label: 'GBP £' },
                  { symbol: '€', label: 'EUR €' },
                  { symbol: '¥', label: 'JPY ¥' },
                  { symbol: 'A$', label: 'AUD A$' },
                  { symbol: 'C$', label: 'CAD C$' },
                  { symbol: '₹', label: 'INR ₹' },
                  { symbol: 'kr', label: 'SEK/NOK kr' },
                ].map(({ symbol, label }) => {
                  const isActive = currentCurrency === symbol
                  return (
                    <button
                      key={symbol}
                      onClick={() => handleCurrencyChange(symbol)}
                      disabled={savingCurrency}
                      style={{
                        height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12px', fontWeight: isActive ? '600' : '400',
                        background: isActive ? 'rgba(94,106,210,0.08)' : '#f7f6f3',
                        border: isActive ? '1px solid rgba(94,106,210,0.25)' : '1px solid rgba(55,53,47,0.12)',
                        color: isActive ? '#5e6ad2' : '#787774',
                        cursor: savingCurrency ? 'not-allowed' : 'pointer',
                        transition: 'all 0.1s',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ARR / MRR display */}
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                How recurring revenue is shown across the dashboard, pipeline, and reports
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
                ARR annualises monthly deals (e.g. £149/mo → £1,788/yr). MRR shows the monthly equivalent.
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { mode: 'arr', label: 'ARR  Annual', desc: '£149/mo → £1,788' },
                  { mode: 'mrr', label: 'MRR  Monthly', desc: '£149/mo → £149' },
                ].map(({ mode, label, desc }) => {
                  const isActive = currentDisplay === mode
                  return (
                    <button
                      key={mode}
                      onClick={() => handleDisplayChange(mode)}
                      disabled={savingDisplay}
                      style={{
                        height: '48px', padding: '0 16px', borderRadius: '7px', fontSize: '12px',
                        fontWeight: isActive ? '600' : '400', textAlign: 'left',
                        background: isActive ? 'rgba(94,106,210,0.08)' : '#f7f6f3',
                        border: isActive ? '1px solid rgba(94,106,210,0.25)' : '1px solid rgba(55,53,47,0.12)',
                        color: isActive ? '#5e6ad2' : '#787774',
                        cursor: savingDisplay ? 'not-allowed' : 'pointer',
                        transition: 'all 0.1s', display: 'flex', flexDirection: 'column', gap: '2px',
                      }}
                    >
                      <span>{label}</span>
                      <span style={{ fontSize: '10px', color: isActive ? '#5e6ad2' : '#9b9a97', fontWeight: 400 }}>{desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

          </div>
        </SectionCard>

        {/* Plan & billing */}
        <SectionCard title="Plan & billing" description="Your current plan and upgrade options">
          {loadingUser ? <SkeletonCard lines={3} showHeader={false} /> : (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '12px',
                borderRadius: '8px', background: planDetail.bg, border: `1px solid ${planDetail.border}`,
                marginBottom: '16px',
              }}>
                <CheckCircle size={16} strokeWidth={2} style={{ color: planDetail.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: planDetail.color, margin: 0 }}>{planDetail.name} Plan</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>{planDetail.features.join(' · ')}</p>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 800, color: planDetail.color }}>{planDetail.price}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
                {(Object.entries(PLAN_DETAILS) as [Plan, typeof PLAN_DETAILS[Plan]][]).map(([plan, detail]) => {
                  const isCurrent = currentPlan === plan
                  const isUpgrade = ['free', 'starter', 'pro'].indexOf(plan) > ['free', 'starter', 'pro'].indexOf(currentPlan)
                  return (
                    <div key={plan} style={{
                      padding: '12px', borderRadius: '8px',
                      background: isCurrent ? detail.bg : '#f7f6f3',
                      border: `1px solid ${isCurrent ? detail.border : 'rgba(55,53,47,0.12)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: isCurrent ? detail.color : '#37352f' }}>{detail.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{detail.price}</span>
                      </div>
                      <ul style={{ margin: '0 0 10px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {detail.features.map(f => (
                          <li key={f} style={{ fontSize: '10px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={9} strokeWidth={2} style={{ color: detail.color, flexShrink: 0 }} />{f}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <span style={{ display: 'block', textAlign: 'center', fontSize: '10px', fontWeight: 600, color: detail.color, padding: '4px 0', background: detail.bg, borderRadius: '5px', border: `1px solid ${detail.border}` }}>Current</span>
                      ) : (
                        <button disabled={billingLoading === plan} onClick={() => plan === 'free' ? handleBillingPortal() : handleUpgrade(plan as 'starter' | 'pro')}
                          style={{
                            width: '100%', height: '28px', borderRadius: '7px', fontSize: '11px', fontWeight: 600,
                            color: isUpgrade ? '#fff' : '#787774',
                            background: isUpgrade ? '#37352f' : 'rgba(55,53,47,0.06)',
                            border: isUpgrade ? 'none' : '1px solid rgba(55,53,47,0.12)',
                            cursor: billingLoading === plan ? 'not-allowed' : 'pointer',
                            opacity: billingLoading === plan ? 0.6 : 1,
                          }}>
                          {billingLoading === plan ? 'Redirecting…' : isUpgrade ? `Upgrade to ${detail.name}` : `Downgrade`}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {currentPlan !== 'free' && (
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>
                  Manage invoices via the{' '}
                  <button onClick={handleBillingPortal} disabled={billingLoading === 'portal'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5e6ad2', fontSize: '11px', padding: 0 }}>
                    {billingLoading === 'portal' ? 'Redirecting…' : 'Stripe billing portal'}
                  </button>.
                </p>
              )}
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '8px 0 0' }}>
                Plan not reflecting a recent change?{' '}
                <button onClick={handleSyncPlan} disabled={billingLoading === 'sync'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5e6ad2', fontSize: '11px', padding: 0 }}>
                  {billingLoading === 'sync' ? 'Syncing…' : 'Sync from Stripe'}
                </button>
              </p>
            </div>
          )}
        </SectionCard>

        {/* Notifications */}
        <SectionCard title="Notifications" description="Control how and when Halvex contacts you">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', background: 'var(--surface-2, #f7f6f3)', border: '1px solid var(--border-default, rgba(55,53,47,0.12))' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #37352f)', margin: 0 }}>Weekly email digest</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted, #9b9a97)', margin: 0, marginTop: '2px' }}>
                Receive a weekly summary of deal activity, stale deals, and win/loss trends
              </p>
            </div>
            <button
              onClick={() => handleDigestToggle(!(emailDigest ?? true))}
              disabled={digestLoading}
              style={{
                position: 'relative', width: '42px', height: '24px', borderRadius: '12px', border: 'none',
                cursor: digestLoading ? 'default' : 'pointer', flexShrink: 0, marginLeft: '16px',
                background: (emailDigest ?? true) ? '#0f7b6c' : 'rgba(55,53,47,0.20)',
                opacity: digestLoading ? 0.7 : 1, transition: 'background 0.15s ease',
              }}
            >
              <span style={{
                position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%',
                background: 'var(--surface-1)', transition: 'left 0.1s ease',
                left: (emailDigest ?? true) ? '21px' : '3px',
              }} />
            </button>
          </div>
        </SectionCard>

        {/* Industry Intelligence */}
        <SectionCard title="Industry Intelligence" description="Cross-workspace learning — powered by anonymised benchmarks">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Explainer */}
            <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(94,106,210,0.08)', border: '1px solid rgba(94,106,210,0.20)' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
                When enabled, Halvex contributes <strong style={{ color: 'var(--text-primary)' }}>10 anonymised behavioural signals</strong> per closed deal to a shared learning pool.
                In return, your predictions are benchmarked against industry data and new workspaces start with a pre-calibrated model instead of a 50/50 coin flip.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '10px' }}>
                {[
                  { ok: true,  label: 'Win/loss outcome' },
                  { ok: true,  label: '10 engagement signal floats' },
                  { ok: true,  label: 'Deal value bracket (5 bands)' },
                  { ok: true,  label: 'Risk category flags (7 booleans)' },
                  { ok: false, label: 'Deal names or company names' },
                  { ok: false, label: 'Meeting notes or AI summaries' },
                  { ok: false, label: 'Exact deal values' },
                  { ok: false, label: 'Contact info or loss reasons' },
                ].map(({ ok, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: ok ? '#0f7b6c' : '#9b9a97' }}>
                    <span style={{ fontSize: '10px', flexShrink: 0 }}>{ok ? '✓ shared' : '✗ never'}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Consent toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', background: '#f7f6f3', border: `1px solid ${globalConsent ? 'rgba(15,123,108,0.20)' : 'rgba(55,53,47,0.12)'}` }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Contribute to Industry Intelligence</p>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '3px 0 0' }}>
                  {globalConsent
                    ? 'Active — your anonymised outcomes are improving predictions for all users'
                    : 'Disabled — enable to unlock industry benchmarks and improve your predictions'}
                </p>
              </div>
              <button
                onClick={() => handleConsentToggle(!globalConsent)}
                disabled={consentLoading || (dbUser?.role !== 'owner' && dbUser?.role !== 'admin')}
                style={{
                  position: 'relative', width: '44px', height: '24px', borderRadius: '12px',
                  background: globalConsent ? '#0f7b6c' : 'rgba(55,53,47,0.20)',
                  border: 'none', cursor: (consentLoading || (dbUser?.role !== 'owner' && dbUser?.role !== 'admin')) ? 'not-allowed' : 'pointer',
                  opacity: consentLoading ? 0.6 : 1, transition: 'background 0.1s ease', flexShrink: 0,
                }}
                title={dbUser?.role === 'member' ? 'Owner or admin required' : ''}
              >
                <span style={{
                  position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%',
                  background: 'var(--surface-1)', transition: 'left 0.1s ease', left: globalConsent ? '23px' : '3px',
                  boxShadow: '0 1px 3px rgba(55,53,47,0.20)',
                }} />
              </button>
            </div>

            {/* Erasure */}
            {dbUser?.role === 'owner' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', background: 'rgba(224,62,62,0.06)', border: '1px solid rgba(224,62,62,0.16)' }}>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: '#e03e3e', margin: 0 }}>Remove from global pool</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>GDPR Article 17 — erase all contributed records within 30 days</p>
                </div>
                <button onClick={handleGlobalErase} disabled={eraseLoading}
                  style={{ height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: '#e03e3e', background: 'rgba(224,62,62,0.08)', border: '1px solid rgba(224,62,62,0.20)', cursor: eraseLoading ? 'not-allowed' : 'pointer', opacity: eraseLoading ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {eraseLoading ? 'Erasing…' : 'Erase my data'}
                </button>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Privacy & compliance" description="How Halvex handles your data">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Key facts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { icon: '🔒', label: 'Encryption in transit', sub: 'TLS on all connections' },
                { icon: '🏦', label: 'No card storage', sub: 'Payments via Stripe (PCI-DSS)' },
                { icon: '🚫', label: 'No data selling', sub: 'Your data is never sold' },
                { icon: '🤖', label: 'No AI training', sub: 'Identifiable data never trains models' },
                { icon: '✅', label: 'SOC 2 auth provider', sub: 'Clerk (SOC 2 Type II)' },
                { icon: '🌍', label: 'GDPR & CCPA ready', sub: 'EU/UK/California rights supported' },
              ].map(({ icon, label, sub }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.09)' }}>
                  <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{label}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Sub-processors */}
            <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.09)' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Sub-processors</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  ['Clerk', 'Auth & user management', 'US (SOC 2)'],
                  ['Supabase', 'Database hosting', 'AWS US-East-1'],
                  ['Anthropic', 'AI generation', 'US (DPA / SCCs)'],
                  ['Stripe', 'Payments', 'US/EU (PCI-DSS)'],
                  ['Vercel', 'Hosting & CDN', 'US/Global (SCCs)'],
                ].map(([name, purpose, location]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500, width: '80px', flexShrink: 0 }}>{name}</span>
                    <span style={{ color: 'var(--text-tertiary)', flex: 1 }}>{purpose}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '11px', textAlign: 'right' }}>{location}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rights */}
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(94,106,210,0.08)', border: '1px solid rgba(94,106,210,0.20)' }}>
              <p style={{ fontSize: '11px', color: '#5e6ad2', fontWeight: 600, margin: '0 0 6px' }}>Your rights (GDPR / CCPA)</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Access, correct, export, or delete your data at any time using the buttons below, or email <a href="mailto:privacy@halvex.ai" style={{ color: '#5e6ad2' }}>privacy@halvex.ai</a>. We respond within 30 days.
              </p>
            </div>

            {/* Links */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href="/privacy" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: '#5e6ad2', backgroundColor: 'rgba(94,106,210,0.08)', border: '1px solid rgba(94,106,210,0.20)', textDecoration: 'none' }}>
                <ExternalLink size={11} />
                Privacy Policy
              </a>
              <a href="/terms" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', backgroundColor: 'rgba(55,53,47,0.06)', border: '1px solid rgba(55,53,47,0.12)', textDecoration: 'none' }}>
                <ExternalLink size={11} />
                Terms of Service
              </a>
            </div>
          </div>
        </SectionCard>

        {/* Company Brain */}
        <CompanyBrainSection />

        <SectionCard title="Your data" description="Export or delete all workspace data">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.09)' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Export all data</p>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Download as JSON</p>
              </div>
              <button onClick={handleExportData} disabled={exportLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', backgroundColor: 'rgba(55,53,47,0.06)', border: '1px solid rgba(55,53,47,0.12)', cursor: exportLoading ? 'not-allowed' : 'pointer', opacity: exportLoading ? 0.6 : 1 }}>
                <Download size={12} strokeWidth={2} />
                {exportLoading ? 'Exporting…' : 'Export'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: 'rgba(224,62,62,0.06)', border: '1px solid rgba(224,62,62,0.16)' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 500, color: '#e03e3e', margin: 0 }}>Delete account</p>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Permanently delete everything. Cannot be undone.</p>
              </div>
              <button onClick={() => setDeleteOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: '#e03e3e', backgroundColor: 'rgba(224,62,62,0.08)', border: '1px solid rgba(224,62,62,0.20)', cursor: 'pointer' }}>
                <Trash2 size={12} strokeWidth={2} />
                Delete
              </button>
            </div>
          </div>
        </SectionCard>

        <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(203,108,44,0.06)', border: '1px solid rgba(203,108,44,0.16)' }}>
          <AlertTriangle size={13} strokeWidth={2} style={{ color: '#cb6c2c', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Account deletion removes your account, cancels subscriptions, and deletes all workspace data. Only the workspace owner can delete the workspace.
          </p>
        </div>
      </div>

      <ConfirmModal open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete account" description="This will permanently delete your account, all workspace data, and cancel any active subscriptions. This cannot be undone." confirmLabel="Delete my account" destructive onConfirm={handleDeleteAccount} />
      <ConfirmModal open={leaveOpen} onOpenChange={setLeaveOpen} title="Leave workspace" description="You will lose access to all shared data. You can rejoin later with the join code." confirmLabel="Leave workspace" destructive onConfirm={handleLeaveWorkspace} />
    </div>
  )
}

function CompanyBrainSection() {
  const { toast } = useToast()
  const { data: companyRes, mutate: mutateCompany, isLoading } = useSWR('/api/company', fetcher)
  const company = companyRes?.data
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    companyName: '',
    description: '',
    valuePropositions: '',
    differentiators: '',
    targetMarket: '',
    commonObjections: '',
  })

  useEffect(() => {
    if (company && !editing) {
      setForm({
        companyName: company.companyName ?? '',
        description: company.description ?? '',
        valuePropositions: Array.isArray(company.valuePropositions) ? company.valuePropositions.join('\n') : (company.valuePropositions ?? ''),
        differentiators: Array.isArray(company.differentiators) ? company.differentiators.join('\n') : (company.differentiators ?? ''),
        targetMarket: company.targetMarket ?? '',
        commonObjections: Array.isArray(company.commonObjections) ? company.commonObjections.join('\n') : (company.commonObjections ?? ''),
      })
    }
  }, [company, editing])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: form.companyName,
          description: form.description,
          valuePropositions: form.valuePropositions.split('\n').filter(Boolean),
          differentiators: form.differentiators.split('\n').filter(Boolean),
          targetMarket: form.targetMarket,
          commonObjections: form.commonObjections.split('\n').filter(Boolean),
        }),
      })
      if (!res.ok) { toast('Failed to save', 'error'); return }
      await mutateCompany()
      setEditing(false)
      toast('Company brain updated', 'success')
    } catch { toast('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '6px',
    background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.16)',
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    boxSizing: 'border-box',
  }

  const taStyle: React.CSSProperties = {
    ...inputStyle, resize: 'vertical', minHeight: '64px',
  }

  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid rgba(55,53,47,0.12)',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(55,53,47,0.06)',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(55,53,47,0.09)', background: '#f7f6f3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: '3px' }}>Company Brain</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>Your company&apos;s knowledge base — used to power AI briefings, battlecards, and deal intelligence</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: '6px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
              background: 'var(--surface-2)', border: '1px solid rgba(55,53,47,0.12)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            Edit
          </button>
        )}
      </div>
      <div style={{ padding: '16px 18px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: '14px', borderRadius: '6px' }} className="skeleton" />
            ))}
          </div>
        ) : editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { key: 'companyName', label: 'Company name', type: 'input' },
              { key: 'description', label: 'What you do', type: 'textarea' },
              { key: 'valuePropositions', label: 'Value propositions (one per line)', type: 'textarea' },
              { key: 'differentiators', label: 'Differentiators (one per line)', type: 'textarea' },
              { key: 'targetMarket', label: 'Target market', type: 'input' },
              { key: 'commonObjections', label: 'Common objections (one per line)', type: 'textarea' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' }}>
                  {label}
                </label>
                {type === 'input' ? (
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(94,106,210,0.40)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(55,53,47,0.16)')}
                  />
                ) : (
                  <textarea
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={taStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(94,106,210,0.40)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(55,53,47,0.16)')}
                  />
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '8px 16px', borderRadius: '8px',
                  background: '#37352f',
                  border: 'none',
                  color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                style={{
                  padding: '8px 14px', borderRadius: '8px',
                  background: 'var(--surface-2)', border: '1px solid rgba(55,53,47,0.12)',
                  color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : company ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {company.companyName && (
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{company.companyName}</div>
            )}
            {company.description && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{company.description}</div>
            )}
            {company.targetMarket && (
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Target: <span style={{ color: 'var(--text-secondary)' }}>{company.targetMarket}</span>
              </div>
            )}
            {!company.description && (
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>
                Add your company&apos;s context to improve AI deal intelligence.
              </p>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>
            Add your company&apos;s knowledge base to power AI briefings and battlecards.
          </p>
        )}
      </div>
    </div>
  )
}

function JoinWorkspaceForm({ onJoined }: { onJoined: () => void }) {
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!slug.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/workspaces/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: slug.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Failed to join', 'error'); return }
      toast('Joined workspace!', 'success')
      onJoined()
    } catch { toast('Failed to join workspace', 'error') }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleJoin} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <input
        value={slug}
        onChange={e => setSlug(e.target.value)}
        placeholder="Enter join code (e.g. crane-47)"
        style={{
          flex: 1, height: '30px', padding: '0 10px', borderRadius: '7px', fontSize: '12px',
          background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.16)',
          color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
        }}
      />
      <button type="submit" disabled={loading || !slug.trim()}
        style={{
          height: '30px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
          color: '#fff', background: '#37352f',
          border: 'none', cursor: loading || !slug.trim() ? 'not-allowed' : 'pointer',
          opacity: loading || !slug.trim() ? 0.6 : 1, whiteSpace: 'nowrap',
        }}>
        {loading ? 'Joining…' : 'Join workspace'}
      </button>
    </form>
  )
}

function UnmatchedEmailsBanner() {
  const { data } = useSWR<{ pendingCount: number }>('/api/ingest/email/unmatched', fetcher, { revalidateOnFocus: false })
  const count = data?.pendingCount ?? 0

  if (count === 0) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderRadius: '8px',
      background: 'rgba(203,108,44,0.08)', border: '1px solid rgba(203,108,44,0.20)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Inbox size={14} style={{ color: '#cb6c2c', flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
            {count} unmatched email{count !== 1 ? 's' : ''} pending review
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
            Emails that could not be auto-matched to a deal
          </p>
        </div>
      </div>
      <a
        href="/settings/unmatched-emails"
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
          color: '#cb6c2c', background: 'rgba(203,108,44,0.08)', border: '1px solid rgba(203,108,44,0.20)',
          textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer',
        }}
      >
        Review
      </a>
    </div>
  )
}
