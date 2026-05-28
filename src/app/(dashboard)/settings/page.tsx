'use client'

import type { ReactNode } from 'react'
import { Suspense, useEffect, useState } from 'react'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import { Building2, CalendarDays, Check, Copy, CreditCard, Loader2, Settings, UsersRound } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { CrmBadge, CrmButton, CrmEmpty, CrmPage, CrmPanel, CrmSectionHeader, CrmSkeleton, CrmStat, PageIntent, ScenicPanel } from '@/components/crm/CrmShell'

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
    <Suspense fallback={<CrmPage><CrmSkeleton rows={6} /></CrmPage>}>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const search = useSearchParams()
  const requested = search.get('section')
  const active = sections.some(section => section.key === requested) ? requested as SettingsSection : 'workspace'
  const { data: googleData } = useSWR('/api/integrations/google/status', fetcher, { revalidateOnFocus: false })
  const googleConnected = Boolean(googleData?.data?.connected)
  const googleConfigured = googleData?.data?.configured !== false

  return (
    <CrmPage>
      <ScenicPanel
        eyebrow="Settings"
        title="Keep the CRM configured."
        description="Workspace, team, pipeline, imports, integrations, and billing controls without cluttering daily sales work."
        actions={googleConnected ? <CrmButton href="/calendar">Open Calendar</CrmButton> : <CrmButton tone="primary" href={googleConfigured ? '/api/integrations/google/auth' : '/settings?section=integrations'}><CalendarDays size={16} /> {googleConfigured ? 'Connect Google Calendar' : 'Set up Calendar'}</CrmButton>}
        compact
      >
        <CrmStat label="Calendar" value={googleConnected ? 'Connected' : 'Not connected'} />
        <CrmStat label="Sections" value={sections.length} />
        <CrmStat label="AI model" value="5.4 mini" hint="Pro can use 5.5" />
      </ScenicPanel>

      <PageIntent items={[
        { label: 'Workspace', title: 'Keep setup out of sales work', text: 'Settings holds admin actions so Home, Deals, Tasks, and Calendar stay focused.' },
        { label: 'Team', title: 'Control access deliberately', text: 'Members and invites should be obvious, auditable, and separate from daily CRM use.' },
        { label: 'Integrations', title: 'Connect only what adds context', text: 'Calendar and imports improve the CRM, but the product still works manually first.' },
      ]} />

      <CrmPanel>
        <div className="crm-view-tabs">
          {sections.map(section => (
            <a key={section.key} href={`/settings?section=${section.key}`} className={active === section.key ? 'active' : ''}>{section.label}</a>
          ))}
        </div>
      </CrmPanel>

      {active === 'workspace' ? <WorkspaceSection /> : null}
      {active === 'members' ? <MembersSection /> : null}
      {active === 'pipelines' ? <PipelinesSection /> : null}
      {active === 'imports' ? <ImportsSection /> : null}
      {active === 'integrations' ? <IntegrationsSection googleConnected={googleConnected} googleConfigured={googleConfigured} /> : null}
      {active === 'billing' ? <BillingSection /> : null}
    </CrmPage>
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
    <CrmPanel>
      <CrmSectionHeader title="Workspace" description="Rename the workspace and check the current plan. Admin-only changes stay protected." />
      {isLoading ? <CrmSkeleton rows={4} /> : (
        <div className="crm-form-grid">
          <label>Workspace name<input className="crm-input" value={name} onChange={event => setName(event.target.value)} placeholder="Workspace name" /></label>
          <InfoRow icon={<Settings size={16} />} title="Current plan" text={`${workspace?.plan ?? 'free'} plan. Pro unlocks premium GPT-5.5 reasoning for heavier deal intelligence.`} />
          <InfoRow icon={<UsersRound size={16} />} title="Your access" text={`You are ${role ?? 'member'} in this workspace.`} />
          <div className="crm-form-actions">
            <CrmButton tone="primary" onClick={save} disabled={!name.trim() || name === workspace?.name}>Save workspace</CrmButton>
            {message ? <CrmBadge tone="good">{message}</CrmBadge> : null}
          </div>
        </div>
      )}
    </CrmPanel>
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
    <div className="crm-grid-2">
      <CrmPanel>
        <CrmSectionHeader title="Invite teammate" description="Create a workspace invite and share the link." />
        <div className="crm-form-grid">
          <label>Email address<input className="crm-input" value={email} onChange={event => setEmail(event.target.value)} placeholder="teammate@company.com" /></label>
          <label>Role<select className="crm-select" value={role} onChange={event => setRole(event.target.value as 'member' | 'admin')}><option value="member">Member</option><option value="admin">Admin</option></select></label>
          <div className="crm-form-actions">
            <CrmButton tone="primary" onClick={invite} disabled={!email.includes('@')}>Create invite</CrmButton>
            {message ? <CrmBadge tone="good">{message}</CrmBadge> : null}
          </div>
          {inviteUrl ? <div className="crm-list-row"><span className="crm-icon"><Copy size={16} /></span><div><strong>Invite link</strong><p>{inviteUrl}</p></div><CrmButton onClick={() => navigator.clipboard.writeText(inviteUrl)}>Copy</CrmButton></div> : null}
        </div>
      </CrmPanel>

      <CrmPanel>
        <CrmSectionHeader title="Team access" description="Current members and pending invites." />
        <div className="crm-stack">
          {members.map((member: any) => (
            <div key={member.id} className="crm-list-row">
              <span className="crm-icon"><UsersRound size={16} /></span>
              <div><strong>{member.email}</strong><p>{member.role} workspace role</p></div>
              <div className="crm-form-actions">
                <select className="crm-select" value={member.appRole} onChange={event => updateAppRole(member.userId, event.target.value)}>
                  <option value="sales">Sales</option>
                  <option value="product">Product</option>
                  <option value="admin">Admin</option>
                </select>
                <CrmButton onClick={() => remove(member.userId)} tone="danger">Remove</CrmButton>
              </div>
            </div>
          ))}
          {invites.map((invite: any) => (
            <div key={invite.id} className="crm-list-row">
              <span className="crm-icon"><Copy size={16} /></span>
              <div><strong>{invite.email}</strong><p>Pending {invite.role} invite</p></div>
              <CrmButton onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/crm/invites/accept?token=${invite.token}`)}>Copy invite</CrmButton>
            </div>
          ))}
          {!members.length && !invites.length ? <CrmEmpty title="No members found">Invite a teammate to start collaborating.</CrmEmpty> : null}
        </div>
      </CrmPanel>
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
    <CrmPanel>
      <CrmSectionHeader title="Pipeline settings" description="Rename stages and adjust default probabilities. Stage movement happens in Deals." action={<CrmButton href="/deals?view=pipeline">Open Deals</CrmButton>} />
      {isLoading ? <CrmSkeleton rows={5} /> : (
        <div className="crm-stack">
          {stages.map((stage: any) => {
            const count = deals.filter((deal: any) => deal.stageId === stage.id).length
            return (
              <div key={stage.id} className="crm-list-row">
                <span className="crm-icon"><Building2 size={16} /></span>
                <label>Name<input className="crm-input" defaultValue={stage.name} onBlur={event => event.currentTarget.value !== stage.name ? saveStage(stage.id, 'name', event.currentTarget.value) : undefined} /></label>
                <div className="crm-form-actions">
                  <input className="crm-input" type="number" min={0} max={100} defaultValue={stage.probability} onBlur={event => Number(event.currentTarget.value) !== stage.probability ? saveStage(stage.id, 'probability', event.currentTarget.value) : undefined} />
                  <CrmBadge>{count} deals</CrmBadge>
                </div>
              </div>
            )
          })}
          {!stages.length ? <CrmEmpty title="No pipeline stages">Open Deals once and Halvex will create the default pipeline.</CrmEmpty> : null}
        </div>
      )}
    </CrmPanel>
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
    <CrmPanel>
      <CrmSectionHeader title="Imports" description="Paste CSV for companies, people, or deals. Preview first, then import valid rows." />
      <div className="crm-form-grid">
        <label>Import type<select className="crm-select" value={type} onChange={event => setType(event.target.value)}><option value="deals">Deals</option><option value="contacts">People</option><option value="companies">Companies</option></select></label>
        <label>CSV<textarea className="crm-textarea" value={csv} onChange={event => setCsv(event.target.value)} /></label>
        <div className="crm-form-actions">
          <CrmButton onClick={() => runImport(true)} disabled={loading || !csv.trim()}>{loading ? <Loader2 size={16} /> : null} Preview</CrmButton>
          <CrmButton tone="primary" onClick={() => runImport(false)} disabled={loading || !csv.trim()}>Import valid rows</CrmButton>
        </div>
        {result ? <InfoRow icon={<Check size={16} />} title="Import result" text={`${result.validRows ?? 0} valid rows · ${result.failedRows ?? result.failed?.length ?? 0} failed · ${result.importedRows ?? 0} imported`} /> : null}
      </div>
    </CrmPanel>
  )
}

function IntegrationsSection({ googleConnected, googleConfigured }: { googleConnected: boolean; googleConfigured: boolean }) {
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
    <CrmPanel>
      <CrmSectionHeader title="Integrations" description="Google Calendar powers meeting visibility. Prep and drafts stay optional." />
      <div className="crm-stack">
        <InfoRow
          icon={<CalendarDays size={16} />}
          title="Google Calendar"
          text={googleConnected ? 'Connected. Upcoming meetings appear in Home, Calendar, and linked deal records.' : googleConfigured ? 'Not connected. Connect it to make the CRM meeting-led.' : 'OAuth credentials are missing in production. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel.'}
        />
        <div className="crm-form-actions">
          {googleConnected ? <CrmButton tone="primary" onClick={sync}>Sync now</CrmButton> : <CrmButton tone="primary" href={googleConfigured ? '/api/integrations/google/auth' : '/settings?section=integrations'}>{googleConfigured ? 'Connect Google' : 'Waiting for credentials'}</CrmButton>}
          {googleConnected ? <CrmButton onClick={disconnect}>Disconnect</CrmButton> : null}
          {message ? <CrmBadge tone="good">{message}</CrmBadge> : null}
        </div>
      </div>
    </CrmPanel>
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
    <CrmPanel>
      <CrmSectionHeader title="Billing" description="Starter uses GPT-5.4 mini by default. Pro unlocks premium GPT-5.5 reasoning for heavier intelligence." />
      <div className="crm-grid-3">
        <InfoRow icon={<CreditCard size={16} />} title="Current plan" text={`You are currently on ${plan}.`} />
        <InfoRow icon={<CreditCard size={16} />} title="Starter" text="CRM core, Calendar, assistant, deal health, and default GPT-5.4 mini." action={<CrmButton onClick={() => checkout('starter')} disabled={loading === 'starter'}>Choose Starter</CrmButton>} />
        <InfoRow icon={<CreditCard size={16} />} title="Pro" text="Everything in Starter plus premium GPT-5.5 reasoning for heavier deal intelligence." action={<CrmButton tone="primary" onClick={() => checkout('pro')} disabled={loading === 'pro'}>Choose Pro</CrmButton>} />
      </div>
      <div className="crm-form-actions" style={{ marginTop: 14 }}>
        <CrmButton onClick={portal} disabled={loading === 'portal'}>Manage billing</CrmButton>
      </div>
    </CrmPanel>
  )
}

function InfoRow({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="crm-list-row">
      <span className="crm-icon">{icon}</span>
      <div><strong>{title}</strong><p>{text}</p></div>
      {action}
    </div>
  )
}
