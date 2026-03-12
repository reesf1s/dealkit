'use client'
export const dynamic = 'force-dynamic'

import { useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import { useState } from 'react'
import { CheckCircle, AlertTriangle, ExternalLink, Download, Trash2, Copy, Users, LogOut } from 'lucide-react'
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
    name: 'Starter', price: '$79/mo', color: '#6366F1', bg: 'rgba(99,102,241,0.08)',
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
      background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#F1F1F3', margin: 0, marginBottom: description ? '3px' : 0 }}>{title}</h2>
        {description && <p style={{ fontSize: '11px', color: '#666', margin: 0 }}>{description}</p>}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: '12px', color: '#666' }}>{label}</span>
      <span style={{ fontSize: '12px', color: '#F1F1F3', fontWeight: 500 }}>{value}</span>
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

  const { data: userRes, isLoading: loadingUser } = useSWR<{ data: DbUser }>('/api/user', fetcher)
  const { data: membersRes, isLoading: loadingMembers, mutate: mutateMembers } = useSWR<{ data: Member[] }>('/api/workspaces/members', fetcher)
  const dbUser = userRes?.data
  const members = membersRes?.data ?? []

  async function handleExportData() {
    setExportLoading(true)
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) throw new Error('Failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dealkit-export-${new Date().toISOString().split('T')[0]}.json`
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

  const currentPlan = dbUser?.plan ?? 'free'
  const planDetail = PLAN_DETAILS[currentPlan]
  const isOwner = dbUser?.role === 'owner'

  return (
    <div style={{ padding: '24px 24px 24px 24px', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{
          fontSize: '20px', fontWeight: 800, letterSpacing: '-0.04em', margin: 0, marginBottom: '4px',
          background: 'linear-gradient(135deg, #F1F1F3 0%, #A5A5C0 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>Settings</h1>
        <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Manage your workspace, team, and billing</p>
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
                    color: '#F1F1F3', backgroundColor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)', textDecoration: 'none',
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
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#F1F1F3', margin: 0 }}>{dbUser?.workspaceName ?? 'My Workspace'}</p>
                  <p style={{ fontSize: '11px', color: '#555', margin: '2px 0 0' }}>Role: <span style={{ color: '#888', textTransform: 'capitalize' }}>{dbUser?.role}</span></p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>Join code</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <code style={{
                      fontSize: '12px', fontWeight: 600, color: '#818CF8',
                      background: 'rgba(99,102,241,0.12)', padding: '3px 8px', borderRadius: '6px',
                      border: '1px solid rgba(99,102,241,0.25)', fontFamily: 'monospace',
                    }}>
                      {dbUser?.workspaceSlug ?? '—'}
                    </code>
                    <button onClick={handleCopyJoinCode}
                      title="Copy join code"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '26px', height: '26px', borderRadius: '6px',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                        cursor: 'pointer', color: '#888',
                      }}>
                      <Copy size={11} />
                    </button>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '11px', color: '#555', margin: '0 0 10px' }}>
                Share the join code with teammates. They enter it at <strong style={{ color: '#888' }}>/settings</strong> → Join workspace.
              </p>

              {/* Members list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {members.map(m => (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700, color: '#818CF8',
                      }}>
                        {m.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', color: '#E5E7EB', margin: 0 }}>{m.email}</p>
                        <p style={{ fontSize: '10px', color: '#555', margin: 0, textTransform: 'capitalize' }}>{m.role}</p>
                      </div>
                    </div>
                    {isOwner && m.userId !== dbUser?.id && (
                      <button onClick={() => handleRemoveMember(m.userId, m.email)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px', borderRadius: '5px', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                    {m.userId === dbUser?.id && (
                      <span style={{ fontSize: '10px', color: '#555', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: '4px' }}>you</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Join another workspace */}
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <JoinWorkspaceForm onJoined={() => window.location.reload()} />
              </div>

              {!isOwner && (
                <button onClick={() => setLeaveOpen(true)}
                  style={{
                    marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '6px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                    color: '#EF4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
                    cursor: 'pointer',
                  }}>
                  <LogOut size={12} />
                  Leave workspace
                </button>
              )}
            </div>
          )}
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
                  <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0' }}>{planDetail.features.join(' · ')}</p>
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
                      background: isCurrent ? detail.bg : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isCurrent ? `${detail.color}44` : 'rgba(255,255,255,0.07)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: isCurrent ? detail.color : '#F1F1F3' }}>{detail.name}</span>
                        <span style={{ fontSize: '11px', color: '#666' }}>{detail.price}</span>
                      </div>
                      <ul style={{ margin: '0 0 10px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {detail.features.map(f => (
                          <li key={f} style={{ fontSize: '10px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                            color: isUpgrade ? '#fff' : '#888',
                            background: isUpgrade ? `linear-gradient(135deg, ${detail.color}, ${detail.color}cc)` : 'rgba(255,255,255,0.05)',
                            border: isUpgrade ? 'none' : '1px solid rgba(255,255,255,0.08)',
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
                <p style={{ fontSize: '11px', color: '#666', margin: 0 }}>
                  Manage invoices via the{' '}
                  <button onClick={handleBillingPortal} disabled={billingLoading === 'portal'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontSize: '11px', padding: 0 }}>
                    {billingLoading === 'portal' ? 'Redirecting…' : 'Stripe billing portal'}
                  </button>.
                </p>
              )}
              <p style={{ fontSize: '11px', color: '#555', margin: '8px 0 0' }}>
                Plan not reflecting a recent change?{' '}
                <button onClick={handleSyncPlan} disabled={billingLoading === 'sync'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontSize: '11px', padding: 0 }}>
                  {billingLoading === 'sync' ? 'Syncing…' : 'Sync from Stripe'}
                </button>
              </p>
            </div>
          )}
        </SectionCard>

        {/* Data */}
        <SectionCard title="Your data" description="Export or delete all workspace data">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 500, color: '#F1F1F3', margin: 0 }}>Export all data</p>
                <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0' }}>Download as JSON</p>
              </div>
              <button onClick={handleExportData} disabled={exportLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: '#F1F1F3', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', cursor: exportLoading ? 'not-allowed' : 'pointer', opacity: exportLoading ? 0.6 : 1 }}>
                <Download size={12} strokeWidth={2} />
                {exportLoading ? 'Exporting…' : 'Export'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 500, color: '#EF4444', margin: 0 }}>Delete account</p>
                <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0' }}>Permanently delete everything. Cannot be undone.</p>
              </div>
              <button onClick={() => setDeleteOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', cursor: 'pointer' }}>
                <Trash2 size={12} strokeWidth={2} />
                Delete
              </button>
            </div>
          </div>
        </SectionCard>

        <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}>
          <AlertTriangle size={13} strokeWidth={2} style={{ color: '#F59E0B', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '11px', color: '#888', margin: 0, lineHeight: 1.5 }}>
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
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
          color: '#F1F1F3', outline: 'none', fontFamily: 'inherit',
        }}
      />
      <button type="submit" disabled={loading || !slug.trim()}
        style={{
          height: '30px', padding: '0 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
          color: '#fff', background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
          border: 'none', cursor: loading || !slug.trim() ? 'not-allowed' : 'pointer',
          opacity: loading || !slug.trim() ? 0.6 : 1, whiteSpace: 'nowrap',
        }}>
        {loading ? 'Joining…' : 'Join workspace'}
      </button>
    </form>
  )
}
