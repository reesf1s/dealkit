'use client'
export const dynamic = 'force-dynamic'

import { useMemo, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import { Building2, Cog, Globe2, Shield, Users } from 'lucide-react'
import { useToast } from '@/components/shared/Toast'

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Failed to fetch')
  return r.json()
})

type DbUser = {
  id: string
  email: string
  plan: 'free' | 'starter' | 'pro'
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  role: 'owner' | 'admin' | 'member'
}

type Workspace = {
  id: string
  name: string
  emailDigestEnabled: boolean
}

type Member = {
  id: string
  userId: string
  email: string
  role: 'owner' | 'admin' | 'member'
  appRole: 'sales' | 'product' | 'admin'
}

type PipelineConfig = {
  currency?: string
  valueDisplay?: 'arr' | 'mrr'
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="notion-panel" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon size={14} style={{ color: 'var(--brand)' }} />
        <div>
          <h2 style={{ margin: 0, textTransform: 'none', fontSize: 15, letterSpacing: 0, color: 'var(--text-primary)' }}>{title}</h2>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-tertiary)' }}>{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

export default function SettingsPage() {
  const { user } = useUser()
  const { toast } = useToast()

  const { data: userRes } = useSWR<{ data: DbUser }>('/api/user', fetcher)
  const { data: workspaceRes, mutate: mutateWorkspace } = useSWR<{ data: Workspace, role: DbUser['role'] }>('/api/workspaces', fetcher)
  const { data: membersRes, mutate: mutateMembers } = useSWR<{ data: Member[] }>('/api/workspaces/members', fetcher)
  const { data: configRes, mutate: mutateConfig } = useSWR<{ data: PipelineConfig }>('/api/pipeline-config', fetcher)
  const { data: consentRes, mutate: mutateConsent } = useSWR<{ consented: boolean }>('/api/global/consent', fetcher)

  const dbUser = userRes?.data
  const workspace = workspaceRes?.data
  const members = membersRes?.data ?? []

  const [workspaceName, setWorkspaceName] = useState('')
  const [currency, setCurrency] = useState(configRes?.data?.currency ?? '£')
  const [valueDisplay, setValueDisplay] = useState<'arr' | 'mrr'>(configRes?.data?.valueDisplay ?? 'arr')
  const [savingWorkspace, setSavingWorkspace] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [savingPolicy, setSavingPolicy] = useState(false)

  const isAdmin = dbUser?.role === 'owner' || dbUser?.role === 'admin'

  useMemo(() => {
    if (workspace?.name && !workspaceName) setWorkspaceName(workspace.name)
  }, [workspace?.name, workspaceName])

  useMemo(() => {
    if (configRes?.data?.currency) setCurrency(configRes.data.currency)
    if (configRes?.data?.valueDisplay) setValueDisplay(configRes.data.valueDisplay)
  }, [configRes?.data?.currency, configRes?.data?.valueDisplay])

  async function saveWorkspaceName() {
    if (!workspaceName.trim()) return
    setSavingWorkspace(true)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: workspaceName.trim() }),
      })
      if (!res.ok) throw new Error('Could not save workspace')
      await mutateWorkspace()
      toast('Workspace updated', 'success')
    } catch {
      toast('Failed to save workspace name', 'error')
    } finally {
      setSavingWorkspace(false)
    }
  }

  async function savePipelineConfig() {
    setSavingConfig(true)
    try {
      const res = await fetch('/api/pipeline-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency, valueDisplay }),
      })
      if (!res.ok) throw new Error('Could not save defaults')
      await mutateConfig()
      toast('Commercial defaults updated', 'success')
    } catch {
      toast('Failed to save commercial defaults', 'error')
    } finally {
      setSavingConfig(false)
    }
  }

  async function setGlobalConsent(consented: boolean) {
    if (!dbUser?.workspaceId) return
    setSavingPolicy(true)
    try {
      const res = await fetch('/api/global/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: dbUser.workspaceId, consented }),
      })
      if (!res.ok) throw new Error('Could not update policy')
      await mutateConsent()
      toast('Intelligence policy updated', 'success')
    } catch {
      toast('Failed to update policy', 'error')
    } finally {
      setSavingPolicy(false)
    }
  }

  async function setEmailDigest(enabled: boolean) {
    setSavingPolicy(true)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailDigestEnabled: enabled }),
      })
      if (!res.ok) throw new Error('Could not update digest')
      await mutateWorkspace()
      toast('Digest policy updated', 'success')
    } catch {
      toast('Failed to update digest policy', 'error')
    } finally {
      setSavingPolicy(false)
    }
  }

  async function setAppRole(targetUserId: string, appRole: Member['appRole']) {
    try {
      const res = await fetch('/api/workspaces/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, appRole }),
      })
      if (!res.ok) throw new Error('Could not update role')
      await mutateMembers()
      toast('Member role updated', 'success')
    } catch {
      toast('Failed to update role', 'error')
    }
  }

  async function removeMember(targetUserId: string) {
    try {
      const res = await fetch('/api/workspaces/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      })
      if (!res.ok) throw new Error('Could not remove member')
      await mutateMembers()
      toast('Member removed', 'success')
    } catch {
      toast('Failed to remove member', 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 980 }}>
      <section className="notion-panel" style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--text-tertiary)' }}>
          Workspace Administration
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 22, letterSpacing: 0 }}>Enterprise controls and governance</h1>
        <p style={{ margin: '7px 0 0', color: 'var(--text-secondary)', fontSize: 13.5, maxWidth: 860 }}>
          Manage the workspace identity, commercial defaults, team access, and how global intelligence features are allowed to learn from your account.
        </p>
      </section>

      <Section icon={Building2} title="Workspace" description="Identity and billing context">
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'grid', gap: 5 }}>
            Workspace name
            <input
              value={workspaceName}
              onChange={e => setWorkspaceName(e.target.value)}
              style={{ height: 34, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 10px', outline: 'none' }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
            <div className="notion-kpi" style={{ padding: '10px 12px' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Plan</div>
              <div style={{ marginTop: 3, color: 'var(--text-primary)', fontWeight: 700 }}>{dbUser?.plan ?? '—'}</div>
            </div>
            <div className="notion-kpi" style={{ padding: '10px 12px' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Role</div>
              <div style={{ marginTop: 3, color: 'var(--text-primary)', fontWeight: 700 }}>{dbUser?.role ?? '—'}</div>
            </div>
            <div className="notion-kpi" style={{ padding: '10px 12px' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Workspace</div>
              <div style={{ marginTop: 3, color: 'var(--text-primary)', fontWeight: 700 }}>{workspace?.name ?? dbUser?.workspaceName ?? '—'}</div>
            </div>
          </div>

          <button
            onClick={saveWorkspaceName}
            disabled={!isAdmin || savingWorkspace}
            style={{
              height: 32,
              width: 170,
              borderRadius: 8,
              border: '1px solid var(--brand-border)',
              background: 'var(--brand-bg)',
              color: 'var(--brand)',
              fontSize: 12,
              fontWeight: 700,
              opacity: !isAdmin ? 0.5 : 1,
            }}
          >
            {savingWorkspace ? 'Saving…' : 'Save workspace'}
          </button>
        </div>
      </Section>

      <Section icon={Cog} title="Commercial Defaults" description="How pipeline value is shown across the app">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'grid', gap: 5 }}>
            Currency
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              style={{ height: 34, minWidth: 120, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 10px', outline: 'none' }}
            >
              {['£', '$', '€', '¥', 'A$', 'C$', 'CHF', 'kr', 'R', '₹'].map(symbol => (
                <option key={symbol} value={symbol}>{symbol}</option>
              ))}
            </select>
          </label>

          <label style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'grid', gap: 5 }}>
            Recurring value mode
            <select
              value={valueDisplay}
              onChange={e => setValueDisplay(e.target.value as 'arr' | 'mrr')}
              style={{ height: 34, minWidth: 130, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 10px', outline: 'none' }}
            >
              <option value="arr">ARR</option>
              <option value="mrr">MRR</option>
            </select>
          </label>

          <button
            onClick={savePipelineConfig}
            disabled={!isAdmin || savingConfig}
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid var(--brand-border)',
              background: 'var(--brand-bg)',
              color: 'var(--brand)',
              fontSize: 12,
              fontWeight: 700,
              opacity: !isAdmin ? 0.5 : 1,
            }}
          >
            {savingConfig ? 'Saving…' : 'Save defaults'}
          </button>
        </div>
      </Section>

      <Section icon={Globe2} title="Intelligence Policy" description="Global learning and digest behavior">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 700 }}>Contribute anonymized outcomes to global intelligence</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Improves benchmark quality across all tenants.</div>
            </div>
            <button
              onClick={() => setGlobalConsent(!(consentRes?.consented ?? false))}
              disabled={!isAdmin || savingPolicy}
              style={{
                width: 86,
                height: 30,
                borderRadius: 999,
                border: (consentRes?.consented ?? false) ? '1px solid rgba(74, 222, 128, 0.36)' : '1px solid var(--border-default)',
                background: (consentRes?.consented ?? false) ? 'rgba(74, 222, 128, 0.16)' : 'var(--surface-2)',
                color: (consentRes?.consented ?? false) ? '#4ade80' : 'var(--text-secondary)',
                fontSize: 11.5,
                fontWeight: 700,
                opacity: !isAdmin ? 0.5 : 1,
              }}
            >
              {(consentRes?.consented ?? false) ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 700 }}>Daily email digest</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Send daily pipeline summary to workspace members.</div>
            </div>
            <button
              onClick={() => setEmailDigest(!(workspace?.emailDigestEnabled ?? true))}
              disabled={!isAdmin || savingPolicy}
              style={{
                width: 86,
                height: 30,
                borderRadius: 999,
                border: (workspace?.emailDigestEnabled ?? true) ? '1px solid rgba(74, 222, 128, 0.36)' : '1px solid var(--border-default)',
                background: (workspace?.emailDigestEnabled ?? true) ? 'rgba(74, 222, 128, 0.16)' : 'var(--surface-2)',
                color: (workspace?.emailDigestEnabled ?? true) ? '#4ade80' : 'var(--text-secondary)',
                fontSize: 11.5,
                fontWeight: 700,
                opacity: !isAdmin ? 0.5 : 1,
              }}
            >
              {(workspace?.emailDigestEnabled ?? true) ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </Section>

      <Section icon={Users} title="Team Access" description="Workspace membership and app-level role controls">
        <div style={{ display: 'grid', gap: 8 }}>
          {members.map(member => {
            const isMe = member.userId === user?.id
            return (
              <div key={member.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 90px', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.email}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{member.role}{isMe ? ' · you' : ''}</div>
                </div>

                <select
                  value={member.appRole}
                  onChange={e => setAppRole(member.userId, e.target.value as Member['appRole'])}
                  disabled={!isAdmin}
                  style={{ height: 30, borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 8px', outline: 'none', opacity: !isAdmin ? 0.5 : 1 }}
                >
                  <option value="sales">Sales</option>
                  <option value="product">Product</option>
                  <option value="admin">Admin</option>
                </select>

                <button
                  onClick={() => removeMember(member.userId)}
                  disabled={!isAdmin || isMe}
                  style={{
                    height: 30,
                    borderRadius: 8,
                    border: '1px solid rgba(251, 113, 133, 0.38)',
                    background: 'rgba(251, 113, 133, 0.14)',
                    color: '#fb7185',
                    fontSize: 11.5,
                    fontWeight: 700,
                    opacity: !isAdmin || isMe ? 0.4 : 1,
                  }}
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      </Section>

      <Section icon={Shield} title="Security Note" description="Principle of least privilege">
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.6 }}>
          Keep only operations staff on `admin` app-role. Sales users should remain on `sales` and operate through core CRM pages; this reduces accidental policy drift in production.
        </p>
      </Section>
    </div>
  )
}
