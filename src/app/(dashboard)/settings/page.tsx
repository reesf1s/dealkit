'use client'
export const dynamic = 'force-dynamic'

import { useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import { useState, useEffect } from 'react'
import { Check, CheckCircle, AlertTriangle, ExternalLink, Download, Trash2, Copy, LogOut, RefreshCw, Plug, Unplug, Mail, Key, Inbox, Loader2 } from 'lucide-react'
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
  createdAt: string
}

const PLAN_DETAILS: Record<Plan, { name: string; price: string; color: string; bg: string; features: string[] }> = {
  free: {
    name: 'Free', price: '$0/mo', color: '#888', bg: 'rgba(136,136,136,0.08)',
    features: ['1 product', '1 competitor', '2 case studies', '5 deal logs', '3 AI collateral pieces'],
  },
  starter: {
    name: 'Starter', price: '$79/mo', color: '#6366F1', bg: 'var(--accent-subtle)',
    features: ['5 products', '15 competitors', 'Unlimited case studies', 'Unlimited deals', 'Unlimited collateral', 'AI meeting prep', '.docx export'],
  },
  pro: {
    name: 'Pro', price: '$149/mo', color: '#22C55E', bg: 'rgba(34,197,94,0.08)',
    features: ['Everything in Starter', 'Unlimited everything', 'AI deal scoring', 'PDF export', 'Priority support', 'Early access'],
  },
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--card-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid var(--card-border)', borderRadius: '8px', overflow: 'hidden',
      boxShadow: 'var(--shadow)',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: description ? '3px' : 0 }}>{title}</h2>
        {description && <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>{description}</p>}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

type HubspotStatus = {
  connected: boolean
  portalId?: string
  lastSyncAt?: string | null
  dealsImported?: number
  syncError?: string | null
  configured?: boolean
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser()
  const { toast } = useToast()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [billingLoading, setBillingLoading] = useState<Plan | 'portal' | 'sync' | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [hubspotSyncing, setHubspotSyncing] = useState(false)
  const [hubspotDisconnecting, setHubspotDisconnecting] = useState(false)
  const [hubspotConnecting, setHubspotConnecting] = useState(false)
  const [hubspotToken, setHubspotToken] = useState('')
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [globalConsent, setGlobalConsent] = useState<boolean | null>(null)
  const [consentLoading, setConsentLoading] = useState(false)
  const [eraseLoading, setEraseLoading] = useState(false)
  const [inboundEmailCopied, setInboundEmailCopied] = useState(false)
  const [regeneratingInbound, setRegeneratingInbound] = useState(false)
  const [apiKeyCopied, setApiKeyCopied] = useState(false)
  // Linear state
  const [linearApiKey, setLinearApiKey] = useState('')
  const [showLinearInput, setShowLinearInput] = useState(false)
  const [linearConnecting, setLinearConnecting] = useState(false)
  const [linearDisconnecting, setLinearDisconnecting] = useState(false)
  const [linearSyncing, setLinearSyncing] = useState(false)

  const { data: userRes, isLoading: loadingUser } = useSWR<{ data: DbUser }>('/api/user', fetcher)
  const { data: membersRes, isLoading: loadingMembers, mutate: mutateMembers } = useSWR<{ data: Member[] }>('/api/workspaces/members', fetcher)
  const { data: hubspotRes, mutate: mutateHubspot } = useSWR<{ data: HubspotStatus }>('/api/integrations/hubspot/status', fetcher, { revalidateOnFocus: false })
  const { data: configData, mutate: mutateConfig } = useSWR('/api/pipeline-config', fetcher, { revalidateOnFocus: false })
  const { data: consentRes } = useSWR<{ consented: boolean }>('/api/global/consent', fetcher, { revalidateOnFocus: false })
  const { data: inboundEmailRes, mutate: mutateInboundEmail } = useSWR<{ data: { email: string; token: string } }>('/api/workspace/inbound-email', fetcher, { revalidateOnFocus: false })
  const { data: apiKeyRes } = useSWR<{ data: { apiKey: string } }>('/api/workspace/api-key', fetcher, { revalidateOnFocus: false })
  const { data: linearRes, mutate: mutateLinear } = useSWR<{ data: { connected: boolean; teamName?: string | null; workspaceName?: string | null; lastSyncAt?: string | null; syncError?: string | null } }>('/api/integrations/linear/status', fetcher, { revalidateOnFocus: false })
  const hubspot = hubspotRes?.data
  const linear = linearRes?.data
  const dbUser = userRes?.data

  // Sync consent state from server
  useEffect(() => {
    if (consentRes && globalConsent === null) setGlobalConsent(consentRes.consented ?? false)
  }, [consentRes, globalConsent])

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
  const currentCurrency: string = configData?.data?.currency ?? '$'
  const currentDisplay: string = configData?.data?.valueDisplay ?? 'arr'

  // Show toast when redirected back from HubSpot OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hs = params.get('hubspot')
    if (hs === 'connected') {
      toast('HubSpot connected! Click "Sync deals" to import your pipeline.', 'success')
      mutateHubspot()
      window.history.replaceState({}, '', window.location.pathname)
    } else if (hs === 'error') {
      const reason = params.get('reason') ?? 'Unknown error'
      toast(`HubSpot connection failed: ${reason}`, 'error')
      window.history.replaceState({}, '', window.location.pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleHubspotConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!hubspotToken.trim()) return
    setHubspotConnecting(true)
    try {
      const res = await fetch('/api/integrations/hubspot/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: hubspotToken.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Connection failed')
      toast('HubSpot connected! Click "Sync deals" to import your pipeline.', 'success')
      setHubspotToken('')
      setShowTokenInput(false)
      mutateHubspot()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Connection failed', 'error')
    } finally {
      setHubspotConnecting(false)
    }
  }

  async function handleHubspotSync() {
    setHubspotSyncing(true)
    try {
      const res = await fetch('/api/integrations/hubspot/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Sync failed')
      toast(`Synced ${json.data.dealsImported} deals from HubSpot`, 'success')
      mutateHubspot()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Sync failed', 'error')
    } finally {
      setHubspotSyncing(false)
    }
  }

  async function handleHubspotDisconnect() {
    setHubspotDisconnecting(true)
    try {
      const res = await fetch('/api/integrations/hubspot/disconnect', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to disconnect')
      toast('HubSpot disconnected. Your imported deals remain in Halvex.', 'success')
      mutateHubspot()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to disconnect', 'error')
    } finally {
      setHubspotDisconnecting(false)
    }
  }

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
        // Reload to show new plan
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

  function handleCopyInboundEmail() {
    const email = inboundEmailRes?.data?.email
    if (!email) return
    navigator.clipboard.writeText(email)
    setInboundEmailCopied(true)
    toast('Inbound email address copied!', 'success')
    setTimeout(() => setInboundEmailCopied(false), 2000)
  }

  function handleCopyApiKey() {
    const key = apiKeyRes?.data?.apiKey
    if (!key) return
    navigator.clipboard.writeText(key)
    setApiKeyCopied(true)
    toast('API key copied!', 'success')
    setTimeout(() => setApiKeyCopied(false), 2000)
  }

  async function handleRegenerateInboundEmail() {
    if (!confirm('Regenerate your inbound email address? The old address will stop working immediately.')) return
    setRegeneratingInbound(true)
    try {
      const res = await fetch('/api/workspace/regenerate-inbound-email', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to regenerate')
      await mutateInboundEmail()
      toast('New inbound email address generated', 'success')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to regenerate', 'error')
    } finally {
      setRegeneratingInbound(false)
    }
  }

  const currentPlan = dbUser?.plan ?? 'free'
  const planDetail = PLAN_DETAILS[currentPlan]
  const isOwner = dbUser?.role === 'owner'

  return (
    <div style={{ padding: '24px 24px 24px 24px', maxWidth: '700px', margin: '0 auto' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      <div style={{ marginBottom: '20px' }}>
        <h1 className="font-brand" style={{
          fontSize: '20px', fontWeight: 500, letterSpacing: '0.01em', margin: 0, marginBottom: '4px',
          color: 'var(--text-primary)',
        }}>Settings</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Manage your workspace, team, and billing</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

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
                    color: 'var(--text-primary)', backgroundColor: 'var(--surface-hover)',
                    border: '1px solid var(--border-strong)', textDecoration: 'none',
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
                      fontSize: '12px', fontWeight: 600, color: 'var(--accent)',
                      background: 'var(--accent-subtle)', padding: '3px 8px', borderRadius: '6px',
                      border: '1px solid rgba(99,102,241,0.25)', fontFamily: 'monospace',
                    }}>
                      {dbUser?.workspaceSlug ?? '—'}
                    </code>
                    <button onClick={handleCopyJoinCode}
                      title="Copy join code"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '26px', height: '26px', borderRadius: '6px',
                        background: 'var(--surface-hover)', border: '1px solid var(--border-strong)',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {members.map(m => (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: '8px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700, color: 'var(--accent)',
                      }}>
                        {m.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0 }}>{m.email}</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', margin: 0, textTransform: 'capitalize' }}>{m.role}</p>
                      </div>
                    </div>
                    {isOwner && m.userId !== dbUser?.id && (
                      <button onClick={() => handleRemoveMember(m.userId, m.email)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px', borderRadius: '5px', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                    {m.userId === dbUser?.id && (
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--surface)', padding: '2px 7px', borderRadius: '4px' }}>you</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Join another workspace */}
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                <JoinWorkspaceForm onJoined={() => window.location.reload()} />
              </div>

              {!isOwner && (
                <button onClick={() => setLeaveOpen(true)}
                  style={{
                    marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '6px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                    color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
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
                        background: isActive ? 'var(--accent-subtle)' : 'var(--surface)',
                        border: isActive ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border)',
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
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
                        background: isActive ? 'var(--accent-subtle)' : 'var(--surface)',
                        border: isActive ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border)',
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                        cursor: savingDisplay ? 'not-allowed' : 'pointer',
                        transition: 'all 0.1s', display: 'flex', flexDirection: 'column', gap: '2px',
                      }}
                    >
                      <span>{label}</span>
                      <span style={{ fontSize: '10px', color: isActive ? 'var(--accent)' : 'var(--text-tertiary)', fontWeight: 400 }}>{desc}</span>
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
                borderRadius: '10px', background: planDetail.bg, border: `1px solid ${planDetail.color}33`,
                marginBottom: '16px', boxShadow: `0 0 20px ${planDetail.color}15`,
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
                      padding: '12px', borderRadius: '10px',
                      background: isCurrent ? detail.bg : 'var(--surface)',
                      border: `1px solid ${isCurrent ? `${detail.color}44` : 'var(--card-border)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: isCurrent ? detail.color : 'var(--text-primary)' }}>{detail.name}</span>
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
                        <span style={{ display: 'block', textAlign: 'center', fontSize: '10px', fontWeight: 600, color: detail.color, padding: '4px 0', background: `${detail.color}15`, borderRadius: '5px', border: `1px solid ${detail.color}30` }}>Current</span>
                      ) : (
                        <button disabled={billingLoading === plan} onClick={() => plan === 'free' ? handleBillingPortal() : handleUpgrade(plan as 'starter' | 'pro')}
                          style={{
                            width: '100%', height: '28px', borderRadius: '7px', fontSize: '11px', fontWeight: 600,
                            color: isUpgrade ? '#fff' : 'var(--text-secondary)',
                            background: isUpgrade ? `linear-gradient(135deg, ${detail.color}, ${detail.color}cc)` : 'var(--surface)',
                            border: isUpgrade ? 'none' : '1px solid var(--border)',
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
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '11px', padding: 0 }}>
                    {billingLoading === 'portal' ? 'Redirecting…' : 'Stripe billing portal'}
                  </button>.
                </p>
              )}
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '8px 0 0' }}>
                Plan not reflecting a recent change?{' '}
                <button onClick={handleSyncPlan} disabled={billingLoading === 'sync'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '11px', padding: 0 }}>
                  {billingLoading === 'sync' ? 'Syncing…' : 'Sync from Stripe'}
                </button>
              </p>
            </div>
          )}
        </SectionCard>

        {/* Integrations */}
        <SectionCard title="Integrations" description="Connect external CRMs to import your pipeline">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* HubSpot */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '14px', borderRadius: '10px', background: hubspot?.connected ? 'rgba(255,160,50,0.05)' : 'var(--surface)', border: `1px solid ${hubspot?.connected ? 'rgba(255,160,50,0.25)' : 'var(--border)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* HubSpot orange sprocket logo mark */}
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,122,0,0.12)', border: '1px solid rgba(255,122,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF7A00">
                    <path d="M18.164 7.932V5.4a2.297 2.297 0 0 0 1.326-2.067A2.297 2.297 0 0 0 17.194 1.04a2.297 2.297 0 0 0-2.297 2.294c0 .899.52 1.682 1.277 2.065v2.533a6.52 6.52 0 0 0-3.094 1.358L5.547 4.074a2.553 2.553 0 0 0 .086-.651 2.566 2.566 0 1 0-2.566 2.566c.463 0 .895-.126 1.267-.344l7.43 5.14a6.515 6.515 0 0 0 0 3.428L5.322 19.29a2.55 2.55 0 0 0-1.255-.33 2.566 2.566 0 1 0 2.566 2.566 2.554 2.554 0 0 0-.417-1.418l6.584-4.999a6.524 6.524 0 0 0 8.763-2.415 6.525 6.525 0 0 0-3.399-9.762zm-.97 9.634a3.31 3.31 0 1 1 0-6.62 3.31 3.31 0 0 1 0 6.62z"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    HubSpot CRM
                    {hubspot?.connected && (
                      <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--success)', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '100px', padding: '1px 7px' }}>Connected</span>
                    )}
                  </div>
                  {hubspot?.connected ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      Portal {hubspot.portalId} ·{' '}
                      {hubspot.lastSyncAt
                        ? `Last synced ${new Date(hubspot.lastSyncAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${hubspot.dealsImported} deals imported`
                        : 'Never synced — click "Sync deals" to import your pipeline'}
                      {hubspot.syncError && (
                        <div style={{ color: 'var(--danger)', marginTop: '4px' }}>⚠ Last sync error: {hubspot.syncError}</div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      Import your entire HubSpot pipeline — deals, stages, contacts, and values — directly into Halvex.
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {hubspot?.connected ? (
                  <>
                    <button
                      onClick={handleHubspotSync}
                      disabled={hubspotSyncing}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', backgroundColor: 'rgba(255,122,0,0.15)', border: '1px solid rgba(255,122,0,0.3)', cursor: hubspotSyncing ? 'not-allowed' : 'pointer', opacity: hubspotSyncing ? 0.6 : 1 }}
                    >
                      <RefreshCw size={11} style={{ animation: hubspotSyncing ? 'spin 1s linear infinite' : 'none' }} />
                      {hubspotSyncing ? 'Syncing…' : 'Sync deals'}
                    </button>
                    <button
                      onClick={handleHubspotDisconnect}
                      disabled={hubspotDisconnecting}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', cursor: hubspotDisconnecting ? 'not-allowed' : 'pointer', opacity: hubspotDisconnecting ? 0.6 : 1 }}
                    >
                      <Unplug size={11} />
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowTokenInput(t => !t)}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: '#fff', backgroundColor: 'rgba(255,122,0,0.8)', border: '1px solid rgba(255,122,0,0.5)', cursor: 'pointer' }}
                  >
                    <Plug size={11} />
                    Connect HubSpot
                  </button>
                )}
              </div>
            </div>

            {/* Token input — shown when user clicks Connect HubSpot */}
            {showTokenInput && !hubspot?.connected && (
              <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,122,0,0.04)', border: '1px solid rgba(255,122,0,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Connect via Private App token</p>
                  <a
                    href="https://app.hubspot.com/private-apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 500, color: '#FF7A00', textDecoration: 'none', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,122,0,0.1)', border: '1px solid rgba(255,122,0,0.25)' }}
                  >
                    <ExternalLink size={10} />
                    Open HubSpot Private Apps
                  </a>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  {[
                    { n: '1', text: 'Click the link above to open HubSpot Private Apps (or go to Settings → Integrations → Private Apps)' },
                    { n: '2', text: 'Click Create a private app, give it a name like "Halvex"' },
                    { n: '3', text: 'On the Scopes tab, enable these 3 read scopes:' },
                    { n: '4', text: 'Click Create app, then copy the access token and paste it below' },
                  ].map(({ n, text }) => (
                    <div key={n} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ flexShrink: 0, width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(255,122,0,0.15)', border: '1px solid rgba(255,122,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#FF7A00', marginTop: '1px' }}>{n}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{text}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', marginLeft: '26px', flexWrap: 'wrap' }}>
                  {['crm.objects.deals.read', 'crm.objects.contacts.read', 'crm.objects.companies.read'].map(scope => (
                    <code key={scope} style={{ fontSize: '10px', color: '#FF7A00', background: 'rgba(255,122,0,0.1)', border: '1px solid rgba(255,122,0,0.25)', borderRadius: '5px', padding: '2px 7px', fontFamily: 'monospace' }}>{scope}</code>
                  ))}
                </div>
                <form onSubmit={handleHubspotConnect} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    data-mp-block
                    type="password"
                    value={hubspotToken}
                    onChange={e => setHubspotToken(e.target.value)}
                    placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    autoComplete="off"
                    style={{
                      flex: 1, height: '32px', padding: '0 10px', borderRadius: '7px', fontSize: '12px',
                      background: 'var(--surface-hover)', border: '1px solid rgba(255,122,0,0.3)',
                      color: 'var(--text-primary)', outline: 'none', fontFamily: 'monospace',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={hubspotConnecting || !hubspotToken.trim()}
                    style={{
                      height: '32px', padding: '0 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
                      color: '#fff', background: hubspotConnecting || !hubspotToken.trim() ? 'rgba(255,122,0,0.4)' : 'rgba(255,122,0,0.85)',
                      border: '1px solid rgba(255,122,0,0.5)',
                      cursor: hubspotConnecting || !hubspotToken.trim() ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {hubspotConnecting ? 'Connecting…' : 'Save & connect'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowTokenInput(false); setHubspotToken('') }}
                    style={{ height: '32px', padding: '0 10px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: 'var(--text-tertiary)', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}

            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>
              More integrations coming — Salesforce, Pipedrive, and Close are on the roadmap.
            </p>
          </div>
        </SectionCard>

        {/* Email Forwarding */}
        <SectionCard title="Email Forwarding" description="Auto-link customer emails to deals by BCC'ing your unique inbound address">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* How it works — 3 steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { n: '1', text: 'BCC your unique address below when emailing customers or forward emails to it' },
                { n: '2', text: 'Halvex auto-matches emails to the right deal by contact email, company domain, or deal name in the subject' },
                { n: '3', text: 'Matched emails are appended to the deal\'s notes and trigger AI signal extraction — unmatched emails go to a review queue' },
              ].map(({ n, text }) => (
                <div key={n} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0, width: '18px', height: '18px', borderRadius: '50%', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--accent)', marginTop: '1px' }}>{n}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Address display */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Your inbound address</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  readOnly
                  value={inboundEmailRes?.data?.email ?? 'Loading\u2026'}
                  style={{
                    flex: 1, height: '32px', padding: '0 10px', borderRadius: '7px', fontSize: '12px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontFamily: 'monospace', outline: 'none',
                  }}
                />
                <button
                  onClick={handleCopyInboundEmail}
                  disabled={!inboundEmailRes?.data?.email}
                  title="Copy inbound email address"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                    color: inboundEmailCopied ? 'var(--success)' : 'var(--text-primary)',
                    background: inboundEmailCopied ? 'rgba(34,197,94,0.1)' : 'var(--surface-hover)',
                    border: inboundEmailCopied ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border-strong)',
                    cursor: !inboundEmailRes?.data?.email ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                >
                  <Copy size={11} />
                  {inboundEmailCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Unmatched emails count + review link */}
            <UnmatchedEmailsBanner />

            {/* Regenerate */}
            {(isOwner || dbUser?.role === 'admin') && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Regenerate address</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Creates a new address — the old one will stop working immediately</p>
                </div>
                <button
                  onClick={handleRegenerateInboundEmail}
                  disabled={regeneratingInbound}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                    color: 'var(--text-secondary)', background: 'var(--surface)', border: '1px solid var(--border-strong)',
                    cursor: regeneratingInbound ? 'not-allowed' : 'pointer', opacity: regeneratingInbound ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <RefreshCw size={11} style={{ animation: regeneratingInbound ? 'spin 1s linear infinite' : 'none' }} />
                  {regeneratingInbound ? 'Regenerating\u2026' : 'Regenerate'}
                </button>
              </div>
            )}

          </div>
        </SectionCard>

        {/* Linear Integration */}
        <SectionCard title="Linear" description="Link dying deals to Linear issues automatically">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {linear?.connected ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle size={14} style={{ color: 'var(--success, #22C55E)' }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      Connected — {linear.teamName ?? linear.workspaceName ?? 'Linear'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={async () => {
                        setLinearSyncing(true)
                        try {
                          const res = await fetch('/api/integrations/linear/sync', { method: 'POST' })
                          const j = await res.json()
                          if (res.ok) toast(`Sync complete — ${j.data?.synced ?? 0} issues synced`, 'success')
                          else toast(j.error ?? 'Sync failed', 'error')
                        } catch { toast('Sync failed', 'error') }
                        finally { setLinearSyncing(false); mutateLinear() }
                      }}
                      disabled={linearSyncing}
                      style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}
                    >
                      <RefreshCw size={11} style={linearSyncing ? { animation: 'spin 1s linear infinite' } : {}} />
                      {linearSyncing ? 'Syncing…' : 'Sync now'}
                    </button>
                    <button
                      onClick={async () => {
                        setLinearDisconnecting(true)
                        try {
                          await fetch('/api/integrations/linear/disconnect', { method: 'POST' })
                          mutateLinear()
                          toast('Linear disconnected', 'success')
                        } catch { toast('Disconnect failed', 'error') }
                        finally { setLinearDisconnecting(false) }
                      }}
                      disabled={linearDisconnecting}
                      style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '5px', cursor: 'pointer', color: 'var(--danger, #EF4444)', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Unplug size={11} />
                      Disconnect
                    </button>
                  </div>
                </div>
                {linear.lastSyncAt && (
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>
                    Last synced: {new Date(linear.lastSyncAt).toLocaleString()}
                  </p>
                )}
                {linear.syncError && (
                  <p style={{ fontSize: '11px', color: 'var(--danger, #EF4444)', margin: '4px 0 0' }}>
                    Sync error: {linear.syncError}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.6 }}>
                  Connect Linear to automatically match dying deals to relevant issues. Halvex will suggest links and update Linear issue descriptions with deal context.
                </p>
                {!showLinearInput ? (
                  <button
                    onClick={() => setShowLinearInput(true)}
                    style={{ fontSize: '12px', padding: '7px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plug size={13} />
                    Connect Linear
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.14)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Get your API key from <strong>Linear → Settings → API → Personal API keys</strong>. Create a key with read access to Issues.
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="password"
                        value={linearApiKey}
                        onChange={e => setLinearApiKey(e.target.value)}
                        placeholder="lin_api_xxxxxxxxxxxxxxxx"
                        style={{ flex: 1, height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace' }}
                      />
                      <button
                        onClick={async () => {
                          if (!linearApiKey.trim()) return
                          setLinearConnecting(true)
                          try {
                            const res = await fetch('/api/integrations/linear/connect', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ apiKey: linearApiKey.trim() }),
                            })
                            const j = await res.json()
                            if (res.ok) {
                              toast(`Linear connected! Team: ${j.data?.teamName}`, 'success')
                              setLinearApiKey('')
                              setShowLinearInput(false)
                              mutateLinear()
                              // Kick off initial sync
                              fetch('/api/integrations/linear/sync', { method: 'POST' })
                            } else {
                              toast(j.error ?? 'Connection failed', 'error')
                            }
                          } catch { toast('Connection failed', 'error') }
                          finally { setLinearConnecting(false) }
                        }}
                        disabled={linearConnecting || !linearApiKey.trim()}
                        style={{ height: '34px', padding: '0 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {linearConnecting ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={12} />}
                        {linearConnecting ? 'Connecting…' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setShowLinearInput(false); setLinearApiKey('') }}
                        style={{ height: '34px', padding: '0 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        {/* API & Integrations */}
        <SectionCard title="API &amp; Integrations" description="Push deals in from Zapier, Make, or any HTTP integration">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Explainer */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', borderRadius: '10px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.14)' }}>
              <Key size={14} strokeWidth={2} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }} />
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
                Use this key with Zapier, Make, or any HTTP integration to push deals into Halvex. Send it as <code style={{ fontFamily: 'monospace', fontSize: '11px', background: 'var(--surface)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border)' }}>apiKey</code> in the JSON body.
              </p>
            </div>

            {/* Webhook URL */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Webhook URL</p>
              <input
                readOnly
                value="https://app.halvex.ai/api/webhooks/zapier"
                style={{
                  width: '100%', height: '32px', padding: '0 10px', borderRadius: '7px', fontSize: '12px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* API Key */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Workspace API key</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  data-mp-block
                  readOnly
                  value={apiKeyRes?.data?.apiKey ?? 'Loading…'}
                  style={{
                    flex: 1, height: '32px', padding: '0 10px', borderRadius: '7px', fontSize: '12px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontFamily: 'monospace', outline: 'none',
                  }}
                />
                <button
                  onClick={handleCopyApiKey}
                  disabled={!apiKeyRes?.data?.apiKey}
                  title="Copy API key"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    height: '32px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                    color: apiKeyCopied ? 'var(--success)' : 'var(--text-primary)',
                    background: apiKeyCopied ? 'rgba(34,197,94,0.1)' : 'var(--surface-hover)',
                    border: apiKeyCopied ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border-strong)',
                    cursor: !apiKeyRes?.data?.apiKey ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                >
                  <Copy size={11} />
                  {apiKeyCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Usage note */}
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>
              Supported actions: <code style={{ fontFamily: 'monospace', fontSize: '11px' }}>create_deal</code>, <code style={{ fontFamily: 'monospace', fontSize: '11px' }}>update_deal</code>, <code style={{ fontFamily: 'monospace', fontSize: '11px' }}>log_note</code>.
            </p>
          </div>
        </SectionCard>

        {/* Data */}
        {/* ── Industry Intelligence ─────────────────────────────────────────── */}
        <SectionCard title="Industry Intelligence" description="Cross-workspace learning — powered by anonymised benchmarks">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Explainer */}
            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.14)' }}>
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
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: ok ? '#6EE7B7' : 'var(--text-tertiary)' }}>
                    <span style={{ fontSize: '10px', flexShrink: 0 }}>{ok ? '✓ shared' : '✗ never'}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Consent toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', background: 'var(--surface)', border: `1px solid ${globalConsent ? 'rgba(34,197,94,0.25)' : 'var(--border)'}` }}>
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
                  background: globalConsent ? 'var(--success)' : 'var(--border-strong)',
                  border: 'none', cursor: (consentLoading || (dbUser?.role !== 'owner' && dbUser?.role !== 'admin')) ? 'not-allowed' : 'pointer',
                  opacity: consentLoading ? 0.6 : 1, transition: 'background 0.1s ease', flexShrink: 0,
                }}
                title={dbUser?.role === 'member' ? 'Owner or admin required' : ''}
              >
                <span style={{
                  position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%',
                  background: '#fff', transition: 'left 0.1s ease', left: globalConsent ? '23px' : '3px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }} />
              </button>
            </div>

            {/* Erasure */}
            {dbUser?.role === 'owner' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.14)' }}>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--danger)', margin: 0 }}>Remove from global pool</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>GDPR Article 17 — erase all contributed records within 30 days</p>
                </div>
                <button onClick={handleGlobalErase} disabled={eraseLoading}
                  style={{ height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: 'var(--danger)', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', cursor: eraseLoading ? 'not-allowed' : 'pointer', opacity: eraseLoading ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
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
                <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '9px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{label}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Sub-processors */}
            <div style={{ padding: '12px 14px', borderRadius: '9px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
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
            <div style={{ padding: '10px 14px', borderRadius: '9px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <p style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, margin: '0 0 6px' }}>Your rights (GDPR / CCPA)</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Access, correct, export, or delete your data at any time using the buttons below, or email <a href="mailto:privacy@halvex.ai" style={{ color: 'var(--accent)' }}>privacy@halvex.ai</a>. We respond within 30 days.
              </p>
            </div>

            {/* Links */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href="/privacy" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: 'var(--accent)', backgroundColor: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.2)', textDecoration: 'none' }}>
                <ExternalLink size={11} />
                Privacy Policy
              </a>
              <a href="/terms" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none' }}>
                <ExternalLink size={11} />
                Terms of Service
              </a>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Your data" description="Export or delete all workspace data">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Export all data</p>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Download as JSON</p>
              </div>
              <button onClick={handleExportData} disabled={exportLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-strong)', cursor: exportLoading ? 'not-allowed' : 'pointer', opacity: exportLoading ? 0.6 : 1 }}>
                <Download size={12} strokeWidth={2} />
                {exportLoading ? 'Exporting…' : 'Export'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--danger)', margin: 0 }}>Delete account</p>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>Permanently delete everything. Cannot be undone.</p>
              </div>
              <button onClick={() => setDeleteOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: 'var(--danger)', backgroundColor: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', cursor: 'pointer' }}>
                <Trash2 size={12} strokeWidth={2} />
                Delete
              </button>
            </div>
          </div>
        </SectionCard>

        <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}>
          <AlertTriangle size={13} strokeWidth={2} style={{ color: '#F59E0B', flexShrink: 0, marginTop: '1px' }} />
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
          background: 'var(--surface)', border: '1px solid var(--border-strong)',
          color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
        }}
      />
      <button type="submit" disabled={loading || !slug.trim()}
        style={{
          height: '30px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
          color: '#fff', background: 'linear-gradient(135deg, var(--accent), #7C3AED)',
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
      padding: '10px 14px', borderRadius: '10px',
      background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.20)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Inbox size={14} style={{ color: '#F59E0B', flexShrink: 0 }} />
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
          color: '#F59E0B', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
          textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer',
        }}
      >
        Review
      </a>
    </div>
  )
}
