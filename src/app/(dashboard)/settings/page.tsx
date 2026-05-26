'use client'

import useSWR from 'swr'
import { useState } from 'react'
import { CalendarClock, Database, Upload, Users } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { OperatorHeader, OperatorPage, OperatorPanel } from '@/components/shared/OperatorUI'

export const dynamic = 'force-dynamic'

type GoogleStatus = {
  connected: boolean
  connection: null | {
    googleAccountEmail: string | null
    lastCalendarSyncAt: string | null
    syncError: string | null
  }
}

type BackfillValidation = {
  legacyDeals: number
  nativeDeals: number
  mappedLegacyDeals: number
  unmappedLegacyDeals: number
  nativeDealsMissingCompany: number
  nativeDealsWrongWorkspace: number
  activities: number
  tasks: number
  contacts: number
  companies: number
  readyForCutover: boolean
  issues: string[]
}

type ImportPreview = {
  headers: string[]
  mapping: Record<string, string>
  totalRows: number
  validRows: number
  failedRows: number
  sampleRows: Array<{ rowNumber: number; valid: boolean; errors: string[] }>
  importedRows?: number
  failed?: Array<{ rowNumber: number; errors: string[] }>
}

type Member = {
  userId: string
  email: string
  role: string
  appRole: string
}

type Invite = {
  id: string
  email: string
  role: string
  token: string
  expiresAt: string
}

function format(value: string | null | undefined) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export default function SettingsPage() {
  const { data, mutate } = useSWR<{ data: GoogleStatus }>('/api/integrations/google/status', fetcher, { revalidateOnFocus: false })
  const { data: validationData, mutate: mutateValidation } = useSWR<{ data: BackfillValidation }>('/api/crm/backfill/validate', fetcher, { revalidateOnFocus: false })
  const { data: membersData } = useSWR<{ data: Member[] }>('/api/workspace/members', fetcher, { revalidateOnFocus: false })
  const { data: invitesData, mutate: mutateInvites } = useSWR<{ data: Invite[] }>('/api/crm/invites', fetcher, { revalidateOnFocus: false })
  const [runningBackfill, setRunningBackfill] = useState(false)
  const [importType, setImportType] = useState<'companies' | 'contacts' | 'deals'>('contacts')
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importing, setImporting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [inviteMessage, setInviteMessage] = useState('')
  const google = data?.data
  const validation = validationData?.data
  const members = membersData?.data ?? []
  const invites = invitesData?.data ?? []

  async function sync() {
    await fetch('/api/integrations/google/sync', { method: 'POST' })
    mutate()
  }

  async function backfill() {
    setRunningBackfill(true)
    try {
      await fetch('/api/crm/backfill', { method: 'POST' })
      await mutateValidation()
    } finally {
      setRunningBackfill(false)
    }
  }

  async function handleCsvFile(file?: File | null) {
    if (!file) return
    const text = await file.text()
    setCsv(text)
    setPreview(null)
  }

  async function runImport(dryRun: boolean) {
    if (!csv.trim()) return
    setImporting(true)
    try {
      const res = await fetch('/api/crm/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: importType, csv, dryRun }),
      })
      const json = await res.json()
      if (!res.ok) {
        setPreview({
          headers: [],
          mapping: {},
          totalRows: 0,
          validRows: 0,
          failedRows: 1,
          sampleRows: [{ rowNumber: 0, valid: false, errors: [json.error ?? 'Import failed'] }],
        })
        return
      }
      setPreview(json.data)
    } finally {
      setImporting(false)
    }
  }

  async function createInvite(event: React.FormEvent) {
    event.preventDefault()
    if (!inviteEmail.trim()) return
    const res = await fetch('/api/crm/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    const json = await res.json()
    if (!res.ok) {
      setInviteMessage(json.error ?? 'Invite failed')
      return
    }
    setInviteEmail('')
    setInviteRole('member')
    setInviteMessage(`Invite ready: ${json.data.acceptUrl}`)
    mutateInvites()
  }

  return (
    <OperatorPage>
      <OperatorHeader eyebrow="Settings" title="Workspace settings" description="Keep the CRM clean, connected, and safely migrated." />

      <div style={{ display: 'grid', gap: 16 }}>
        <OperatorPanel title="Google Calendar" description="Sync upcoming meetings and link them to contacts, companies, and open deals." icon={CalendarClock}>
          <div className="crm-settings-row">
            <div>
              <strong>{google?.connected ? google.connection?.googleAccountEmail ?? 'Connected' : 'Not connected'}</strong>
              <p>{google?.connected ? `Last sync: ${format(google.connection?.lastCalendarSyncAt)}` : 'Connect Google Calendar to populate Today with meeting prep.'}</p>
              {google?.connection?.syncError && <p style={{ color: 'var(--color-red)' }}>{google.connection.syncError}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {google?.connected ? (
                <button className="operator-button" onClick={sync}>Sync now</button>
              ) : (
                <a className="operator-button operator-button-primary" href="/api/integrations/google/auth">Connect</a>
              )}
            </div>
          </div>
        </OperatorPanel>

        <OperatorPanel title="Data migration" description="Legacy deal data is shadow-backfilled into native CRM tables without deleting old records." icon={Database}>
          <div className="crm-settings-row">
            <div>
              <strong>Native CRM backfill</strong>
              <p>
                {validation
                  ? validation.readyForCutover
                    ? `${validation.mappedLegacyDeals}/${validation.legacyDeals} legacy deals mapped. Cutover checks are clear.`
                    : `${validation.mappedLegacyDeals}/${validation.legacyDeals} legacy deals mapped. ${validation.issues[0] ?? 'Review migration issues.'}`
                  : 'Run validation before route cutover or after new legacy imports.'}
              </p>
            </div>
            <button className="operator-button" onClick={backfill} disabled={runningBackfill}>
              {runningBackfill ? 'Running...' : 'Run backfill'}
            </button>
          </div>
          {validation && (
            <div className="crm-validation-grid">
              <span>Native deals <strong>{validation.nativeDeals}</strong></span>
              <span>Companies <strong>{validation.companies}</strong></span>
              <span>Contacts <strong>{validation.contacts}</strong></span>
              <span>Activities <strong>{validation.activities}</strong></span>
              <span>Tasks <strong>{validation.tasks}</strong></span>
              <span>Status <strong>{validation.readyForCutover ? 'Ready' : 'Needs review'}</strong></span>
            </div>
          )}
        </OperatorPanel>

        <OperatorPanel title="CSV import" description="Bring in companies, contacts, or deals without relying on integrations." icon={Upload}>
          <div className="crm-import-panel">
            <div className="crm-record-form compact">
              <select className="crm-select" value={importType} onChange={event => { setImportType(event.target.value as typeof importType); setPreview(null) }}>
                <option value="contacts">Contacts</option>
                <option value="companies">Companies</option>
                <option value="deals">Deals</option>
              </select>
              <input className="crm-input" type="file" accept=".csv,text/csv" onChange={event => handleCsvFile(event.target.files?.[0])} />
              <button className="operator-button" type="button" disabled={!csv || importing} onClick={() => runImport(true)}>
                {importing ? 'Checking...' : 'Preview'}
              </button>
              <button className="operator-button operator-button-primary" type="button" disabled={!preview || preview.validRows === 0 || importing} onClick={() => runImport(false)}>
                Import valid rows
              </button>
            </div>
            {preview && (
              <div className="crm-validation-grid">
                <span>Total rows <strong>{preview.totalRows}</strong></span>
                <span>Ready <strong>{preview.validRows}</strong></span>
                <span>Failed <strong>{preview.failedRows}</strong></span>
                <span>Imported <strong>{preview.importedRows ?? 0}</strong></span>
                <span>Columns <strong>{preview.headers.length}</strong></span>
                <span>Mapped fields <strong>{Object.keys(preview.mapping).length}</strong></span>
              </div>
            )}
            {preview?.sampleRows.some(row => !row.valid) && (
              <div className="crm-import-errors">
                {preview.sampleRows.filter(row => !row.valid).slice(0, 3).map(row => (
                  <p key={row.rowNumber}>Row {row.rowNumber}: {row.errors.join(' ')}</p>
                ))}
              </div>
            )}
          </div>
        </OperatorPanel>

        <OperatorPanel title="Members" description="Invite teammates and review who has access to this workspace." icon={Users}>
          <form onSubmit={createInvite} className="crm-record-form compact">
            <input className="crm-input" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="teammate@company.com" />
            <select className="crm-select" value={inviteRole} onChange={event => setInviteRole(event.target.value as typeof inviteRole)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button className="operator-button operator-button-primary" type="submit">Create invite</button>
          </form>
          {inviteMessage && <div className="crm-copy-line">{inviteMessage}</div>}
          <div className="crm-member-list">
            {members.map(member => (
              <div key={member.userId} className="crm-member-row">
                <strong>{member.email}</strong>
                <span>{member.role} · {member.appRole}</span>
              </div>
            ))}
            {invites.map(invite => (
              <div key={invite.id} className="crm-member-row">
                <strong>{invite.email}</strong>
                <span>Pending {invite.role} · expires {format(invite.expiresAt)}</span>
              </div>
            ))}
            {members.length === 0 && invites.length === 0 && <div className="empty-state">No members loaded yet.</div>}
          </div>
        </OperatorPanel>
      </div>
    </OperatorPage>
  )
}
