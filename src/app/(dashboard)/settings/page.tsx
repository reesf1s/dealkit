'use client'

import { Suspense, useEffect, useState } from 'react'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import { Building2, CalendarDays, Check, Copy, CreditCard, Import, Loader2, Settings, UsersRound } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { ActionCard, ButtonV2, EmptyStateV2, HeroPanel, PanelV2, SectionHeader } from '@/components/v2/V2DesignSystem'

export const dynamic = 'force-dynamic'

const sections = [
  { key: 'workspace', label: 'Workspace' },
  { key: 'members', label: 'Members' },
  { key: 'pipelines', label: 'Pipelines' },
  { key: 'imports', label: 'Imports' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'billing', label: 'Billing' },
] as const

type SettingsSection = typeof sections[number]['key']

async function postJson(url: string, body?: unknown, method = 'POST') {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? 'Request failed')
  return payload
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<EmptyStateV2 title="Loading settings">Preparing workspace controls.</EmptyStateV2>}>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const search = useSearchParams()
  const requestedSection = search.get('section')
  const active = sections.some(section => section.key === requestedSection) ? requestedSection as SettingsSection : 'workspace'
  const { data: googleData } = useSWR('/api/integrations/google/status', fetcher, { revalidateOnFocus: false })
  const googleConnected = Boolean(googleData?.data?.connected)

  return (
    <div className="v2-page">
      <HeroPanel
        eyebrow="Settings"
        title="Settings"
        actions={googleConnected ? <ButtonV2 href="/calendar">Open Calendar</ButtonV2> : <ButtonV2 tone="dark" href="/api/integrations/google/auth"><CalendarDays size={16} /> Connect Google Calendar</ButtonV2>}
        aside={<div className="v2-glass-card"><strong>Live controls</strong><span>Workspace, members, pipeline, imports, integrations, and billing are now actionable from here.</span></div>}
      >
        Quiet controls for the CRM. Nothing here should feel like a dead card.
      </HeroPanel>

      <PanelV2>
        <div className="v2-settings-tabs">
          {sections.map(section => (
            <a key={section.key} href={`/settings?section=${section.key}`} className={active === section.key ? 'active' : ''}>{section.label}</a>
          ))}
        </div>
      </PanelV2>

      {active === 'workspace' ? <WorkspaceSection /> : null}
      {active === 'members' ? <MembersSection /> : null}
      {active === 'pipelines' ? <PipelinesSection /> : null}
      {active === 'imports' ? <ImportsSection /> : null}
      {active === 'integrations' ? <IntegrationsSection googleConnected={googleConnected} /> : null}
      {active === 'billing' ? <BillingSection /> : null}
    </div>
  )
}

function WorkspaceSection() {
  const { data, mutate, isLoading } = useSWR('/api/workspaces', fetcher, { revalidateOnFocus: false })
  const workspace = data?.data
  const role = data?.role
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (workspace?.name) setName(workspace.name)
  }, [workspace?.name])

  async function save() {
    setMessage('')
    await postJson('/api/workspaces', { name }, 'PATCH')
    await mutate()
    setMessage('Workspace updated.')
  }

  return (
    <PanelV2>
      <SectionHeader title="Workspace" icon={<Settings size={18} />}>
        Rename the workspace and check the current plan. Admin-only changes stay protected.
      </SectionHeader>
      {isLoading ? <EmptyStateV2 title="Loading workspace">Reading workspace settings.</EmptyStateV2> : (
        <div className="v2-settings-form">
          <label>
            <span>Workspace name</span>
            <input value={name} onChange={event => setName(event.target.value)} placeholder="Workspace name" />
          </label>
          <div className="v2-setting-row">
            <ActionCard title="Current plan" reason={`${workspace?.plan ?? 'free'} plan. Top plan unlocks premium GPT-5.5 reasoning for heavier deal intelligence.`} source="Billing" />
            <ActionCard title="Your access" reason={`You are ${role ?? 'member'} in this workspace.`} source="Membership" />
          </div>
          <div className="v2-settings-actions">
            <ButtonV2 tone="dark" onClick={save} disabled={!name.trim() || name === workspace?.name}>Save workspace</ButtonV2>
            {message ? <span>{message}</span> : null}
          </div>
        </div>
      )}
    </PanelV2>
  )
}

function MembersSection() {
  const { data: memberData, mutate: refreshMembers } = useSWR('/api/workspaces/members', fetcher, { revalidateOnFocus: false })
  const { data: inviteData, mutate: refreshInvites } = useSWR('/api/crm/invites', fetcher, { revalidateOnFocus: false })
  const members = memberData?.data ?? []
  const invites = inviteData?.data ?? []
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [inviteUrl, setInviteUrl] = useState('')
  const [message, setMessage] = useState('')

  async function invite() {
    setMessage('')
    const payload = await postJson('/api/crm/invites', { email, role })
    setInviteUrl(payload.data.acceptUrl)
    setEmail('')
    await refreshInvites()
  }

  async function updateAppRole(targetUserId: string, appRole: string) {
    await postJson('/api/workspaces/members', { targetUserId, appRole }, 'PATCH')
    await refreshMembers()
    setMessage('Member role updated.')
  }

  async function remove(targetUserId: string) {
    await postJson('/api/workspaces/members', { targetUserId }, 'DELETE')
    await refreshMembers()
    setMessage('Member removed.')
  }

  return (
    <div className="v2-grid-2">
      <PanelV2>
        <SectionHeader title="Members" icon={<UsersRound size={18} />}>
          Invite teammates, copy the invite link, and manage app access.
        </SectionHeader>
        <div className="v2-settings-form">
          <label>
            <span>Email address</span>
            <input value={email} onChange={event => setEmail(event.target.value)} placeholder="teammate@company.com" />
          </label>
          <label>
            <span>Workspace role</span>
            <select value={role} onChange={event => setRole(event.target.value as 'member' | 'admin')}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <div className="v2-settings-actions">
            <ButtonV2 tone="dark" onClick={invite} disabled={!email.includes('@')}>Create invite</ButtonV2>
            {message ? <span>{message}</span> : null}
          </div>
          {inviteUrl ? (
            <div className="v2-copy-box">
              <span>{inviteUrl}</span>
              <button type="button" onClick={() => navigator.clipboard.writeText(inviteUrl)}><Copy size={16} /> Copy</button>
            </div>
          ) : null}
        </div>
      </PanelV2>

      <PanelV2>
        <SectionHeader title="Team access">Current members and pending invites.</SectionHeader>
        <div className="v2-stack">
          {members.map((member: any) => (
            <div key={member.id} className="v2-setting-row-item">
              <div><strong>{member.email}</strong><p>{member.role} workspace role</p></div>
              <select value={member.appRole} onChange={event => updateAppRole(member.userId, event.target.value)}>
                <option value="sales">Sales</option>
                <option value="product">Product</option>
                <option value="admin">Admin</option>
              </select>
              <button type="button" onClick={() => remove(member.userId)}>Remove</button>
            </div>
          ))}
          {invites.map((invite: any) => (
            <div key={invite.id} className="v2-setting-row-item">
              <div><strong>{invite.email}</strong><p>Pending {invite.role} invite</p></div>
              <button type="button" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/crm/invites/accept?token=${invite.token}`)}>Copy invite</button>
            </div>
          ))}
          {!members.length && !invites.length ? <EmptyStateV2 title="No members found">Invite a teammate to start collaborating.</EmptyStateV2> : null}
        </div>
      </PanelV2>
    </div>
  )
}

function PipelinesSection() {
  const { data, mutate, isLoading } = useSWR('/api/crm/pipeline', fetcher, { revalidateOnFocus: false })
  const stages = data?.data?.stages ?? []
  const deals = data?.data?.deals ?? []

  async function saveStage(stageId: string, field: 'name' | 'probability', value: string) {
    await postJson(`/api/crm/pipeline/stages/${stageId}`, { [field]: field === 'probability' ? Number(value) : value }, 'PATCH')
    await mutate()
  }

  return (
    <PanelV2>
      <SectionHeader title="Pipeline settings" icon={<Building2 size={18} />} action={<ButtonV2 href="/deals?view=pipeline">Open Deals</ButtonV2>}>
        Rename stages and adjust default probabilities. Stage moves happen in Deals.
      </SectionHeader>
      {isLoading ? <EmptyStateV2 title="Loading pipeline">Reading stages.</EmptyStateV2> : (
        <div className="v2-stack">
          {stages.map((stage: any) => {
            const count = deals.filter((deal: any) => deal.stageId === stage.id).length
            return (
              <div key={stage.id} className="v2-setting-row-item">
                <input defaultValue={stage.name} onBlur={event => event.currentTarget.value !== stage.name ? saveStage(stage.id, 'name', event.currentTarget.value) : undefined} />
                <input type="number" min={0} max={100} defaultValue={stage.probability} onBlur={event => Number(event.currentTarget.value) !== stage.probability ? saveStage(stage.id, 'probability', event.currentTarget.value) : undefined} />
                <span>{count} deals</span>
              </div>
            )
          })}
          {!stages.length ? <EmptyStateV2 title="No pipeline stages">Open Deals once and Halvex will create the default pipeline.</EmptyStateV2> : null}
        </div>
      )}
    </PanelV2>
  )
}

function ImportsSection() {
  const [type, setType] = useState('deals')
  const [csv, setCsv] = useState('title,company,value,close date\nNew website rebuild,Finch Studio,12000,2026-06-30')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function runImport(dryRun: boolean) {
    setLoading(true)
    try {
      const payload = await postJson('/api/crm/import', { type, csv, dryRun })
      setResult(payload.data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PanelV2>
      <SectionHeader title="Imports" icon={<Import size={18} />}>
        Paste CSV for companies, people, or deals. Preview first, then import valid rows.
      </SectionHeader>
      <div className="v2-settings-form">
        <label>
          <span>Import type</span>
          <select value={type} onChange={event => setType(event.target.value)}>
            <option value="deals">Deals</option>
            <option value="contacts">People</option>
            <option value="companies">Companies</option>
          </select>
        </label>
        <label>
          <span>CSV</span>
          <textarea value={csv} onChange={event => setCsv(event.target.value)} />
        </label>
        <div className="v2-settings-actions">
          <ButtonV2 onClick={() => runImport(true)} disabled={loading || !csv.trim()}>{loading ? <Loader2 size={16} /> : null} Preview</ButtonV2>
          <ButtonV2 tone="dark" onClick={() => runImport(false)} disabled={loading || !csv.trim()}>Import valid rows</ButtonV2>
        </div>
        {result ? <ActionCard title="Import result" reason={`${result.validRows ?? 0} valid rows · ${result.failedRows ?? result.failed?.length ?? 0} failed · ${result.importedRows ?? 0} imported`} source="CSV" action={<Check size={17} />} /> : null}
      </div>
    </PanelV2>
  )
}

function IntegrationsSection({ googleConnected }: { googleConnected: boolean }) {
  const { mutate } = useSWR('/api/integrations/google/status', fetcher, { revalidateOnFocus: false })
  const [message, setMessage] = useState('')

  async function sync() {
    await fetch('/api/integrations/google/sync', { method: 'POST' })
    setMessage('Calendar sync started.')
  }

  async function disconnect() {
    await fetch('/api/integrations/google/disconnect', { method: 'DELETE' })
    await mutate()
    setMessage('Calendar disconnected.')
  }

  return (
    <PanelV2>
      <SectionHeader title="Integrations" icon={<CalendarDays size={18} />}>
        Google Calendar powers meetings, prep, and post-call updates in V2.
      </SectionHeader>
      <div className="v2-stack">
        <ActionCard title="Google Calendar" reason={googleConnected ? 'Connected. Sync upcoming meetings into Home, Calendar, and deal workspaces.' : 'Not connected. Connect it to make the CRM meeting-led.'} source={googleConnected ? 'Connected' : 'Not connected'} />
        <div className="v2-settings-actions">
          {googleConnected ? <ButtonV2 tone="dark" onClick={sync}>Sync now</ButtonV2> : <ButtonV2 tone="dark" href="/api/integrations/google/auth">Connect Google</ButtonV2>}
          {googleConnected ? <ButtonV2 onClick={disconnect}>Disconnect</ButtonV2> : null}
          {message ? <span>{message}</span> : null}
        </div>
      </div>
    </PanelV2>
  )
}

function BillingSection() {
  const { data } = useSWR('/api/workspaces', fetcher, { revalidateOnFocus: false })
  const plan = data?.data?.plan ?? 'free'
  const [loading, setLoading] = useState('')

  async function checkout(targetPlan: 'starter' | 'pro') {
    setLoading(targetPlan)
    try {
      const payload = await postJson('/api/billing/checkout', { plan: targetPlan })
      if (payload.url) window.location.href = payload.url
    } finally {
      setLoading('')
    }
  }

  async function portal() {
    setLoading('portal')
    try {
      const payload = await postJson('/api/billing/portal')
      if (payload.url) window.location.href = payload.url
    } finally {
      setLoading('')
    }
  }

  return (
    <PanelV2>
      <SectionHeader title="Billing" icon={<CreditCard size={18} />}>
        Upgrade paths are explicit. Pro unlocks premium GPT-5.5 reasoning for heavier intelligence.
      </SectionHeader>
      <div className="v2-grid-3">
        <ActionCard title="Current plan" reason={`You are currently on ${plan}.`} source="Workspace" />
        <ActionCard title="Starter" reason="Default GPT-5.4 mini AI, CRM core, Calendar, assistant, and deal intelligence." source="Upgrade" action={<ButtonV2 onClick={() => checkout('starter')} disabled={loading === 'starter'}>Choose Starter</ButtonV2>} />
        <ActionCard title="Pro" reason="Everything in Starter plus premium GPT-5.5 reasoning for heavier deal intelligence." source="Top plan" action={<ButtonV2 tone="dark" onClick={() => checkout('pro')} disabled={loading === 'pro'}>Choose Pro</ButtonV2>} />
      </div>
      <div className="v2-settings-actions">
        <ButtonV2 onClick={portal} disabled={loading === 'portal'}>Manage billing</ButtonV2>
      </div>
    </PanelV2>
  )
}
