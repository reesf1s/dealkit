'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import {
  Plug, CheckCircle2, Copy, RefreshCw, Eye, EyeOff, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'
import { useToast } from '@/components/shared/Toast'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const card: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: '24px',
  boxShadow: 'var(--shadow-card)',
}

function StatusDot({ connected }: { connected: boolean | null }) {
  if (connected === null) return <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#334155' }} />
  return (
    <div style={{
      width: '8px', height: '8px', borderRadius: '50%',
      background: connected ? '#34d399' : '#f87171',
      boxShadow: connected ? '0 0 6px #34d39980' : '0 0 6px #f8717180',
    }} />
  )
}

function StatusBadge({ connected }: { connected: boolean | null }) {
  if (connected === null) return <span style={{ fontSize: '11px', color: '#475569' }}>Checking…</span>
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px',
      background: connected ? 'rgba(52,211,153,0.10)' : 'rgba(248,113,113,0.10)',
      color: connected ? '#34d399' : '#f87171',
      border: `1px solid ${connected ? 'rgba(52,211,153,0.20)' : 'rgba(248,113,113,0.20)'}`,
    }}>
      {connected ? 'Connected' : 'Not connected'}
    </span>
  )
}

function ConfigSection({ children, label }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: '16px' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#818cf8', fontSize: '12px', fontWeight: 600, padding: 0,
        }}
      >
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {label ?? 'Configure'}
      </button>
      {open && (
        <div style={{
          marginTop: '12px', padding: '16px',
          background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.14)',
          borderRadius: '10px',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function ConnectionsPage() {
  const { toast } = useToast()
  const { data: hubspotRes, mutate: mutateHubspot } = useSWR('/api/integrations/hubspot/status', fetcher, { revalidateOnFocus: false })
  const { data: linearRes, mutate: mutateLinear } = useSWR('/api/integrations/linear/status', fetcher, { revalidateOnFocus: false })
  const { data: slackRes, mutate: mutateSlack } = useSWR('/api/integrations/slack/status', fetcher, { revalidateOnFocus: false })
  const { data: mcpKeyRes, mutate: mutateMcpKey } = useSWR('/api/workspace/mcp-api-key', fetcher, { revalidateOnFocus: false })

  const hubspotConnected: boolean | null = hubspotRes ? (hubspotRes?.data?.connected === true) : null
  const linearConnected: boolean | null = linearRes ? (linearRes?.data?.connected === true) : null
  const slackConnected: boolean | null = slackRes ? (slackRes?.data?.connected === true) : null

  const hubspotData = hubspotRes?.data
  const linearData = linearRes?.data
  const slackData = slackRes?.data
  const mcpApiKey: string | null = mcpKeyRes?.data?.mcpApiKey ?? null

  // HubSpot state
  const [hubspotToken, setHubspotToken] = useState('')
  const [hubspotConnecting, setHubspotConnecting] = useState(false)
  const [hubspotSyncing, setHubspotSyncing] = useState(false)
  const [hubspotDisconnecting, setHubspotDisconnecting] = useState(false)

  // Linear state
  const [linearApiKey, setLinearApiKey] = useState('')
  const [linearConnecting, setLinearConnecting] = useState(false)
  const [linearDisconnecting, setLinearDisconnecting] = useState(false)
  const [linearSyncing, setLinearSyncing] = useState(false)
  const [linearRematching, setLinearRematching] = useState(false)

  // Slack state
  const [slackDisconnecting, setSlackDisconnecting] = useState(false)

  // MCP state
  const [showMcpKey, setShowMcpKey] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  async function copyToClipboard(text: string) {
    try { await navigator.clipboard.writeText(text); toast('Copied to clipboard', 'success') }
    catch { toast('Failed to copy', 'error') }
  }

  async function handleHubspotConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!hubspotToken.trim()) return
    setHubspotConnecting(true)
    try {
      const res = await fetch('/api/integrations/hubspot/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: hubspotToken.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Connection failed')
      toast('HubSpot connected! Click "Sync deals" to import your pipeline.', 'success')
      setHubspotToken('')
      mutateHubspot()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : 'Connection failed', 'error') }
    finally { setHubspotConnecting(false) }
  }

  async function handleHubspotSync() {
    setHubspotSyncing(true)
    try {
      const res = await fetch('/api/integrations/hubspot/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Sync failed')
      toast(`Synced ${json.data?.dealsImported ?? 0} deals from HubSpot`, 'success')
      mutateHubspot()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : 'Sync failed', 'error') }
    finally { setHubspotSyncing(false) }
  }

  async function handleHubspotDisconnect() {
    setHubspotDisconnecting(true)
    try {
      await fetch('/api/integrations/hubspot/disconnect', { method: 'DELETE' })
      toast('HubSpot disconnected', 'success')
      mutateHubspot()
    } catch { toast('Failed to disconnect', 'error') }
    finally { setHubspotDisconnecting(false) }
  }

  async function handleLinearConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!linearApiKey.trim()) return
    setLinearConnecting(true)
    try {
      const res = await fetch('/api/integrations/linear/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: linearApiKey.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Connection failed')
      toast('Linear connected!', 'success')
      setLinearApiKey('')
      mutateLinear()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : 'Connection failed', 'error') }
    finally { setLinearConnecting(false) }
  }

  async function handleLinearDisconnect() {
    setLinearDisconnecting(true)
    try {
      await fetch('/api/integrations/linear/disconnect', { method: 'POST' })
      toast('Linear disconnected', 'success')
      mutateLinear()
    } catch { toast('Failed to disconnect', 'error') }
    finally { setLinearDisconnecting(false) }
  }

  async function handleLinearSync() {
    setLinearSyncing(true)
    try {
      const res = await fetch('/api/integrations/linear/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Sync failed')
      toast(`Synced ${json.data?.issuesSynced ?? json.data?.count ?? 0} issues from Linear`, 'success')
      mutateLinear()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : 'Sync failed', 'error') }
    finally { setLinearSyncing(false) }
  }

  async function handleLinearRematch() {
    setLinearRematching(true)
    try {
      const res = await fetch('/api/integrations/linear/rematch', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Rematch failed')
      const { matched = 0, deals = 0 } = json.data ?? {}
      toast(`Rematched ${matched} issues across ${deals} open deals`, 'success')
    } catch (e: unknown) { toast(e instanceof Error ? e.message : 'Rematch failed', 'error') }
    finally { setLinearRematching(false) }
  }

  async function handleSlackDisconnect() {
    setSlackDisconnecting(true)
    try {
      await fetch('/api/integrations/slack/disconnect', { method: 'POST' })
      toast('Slack disconnected', 'success')
      mutateSlack()
    } catch { toast('Failed to disconnect', 'error') }
    finally { setSlackDisconnecting(false) }
  }

  async function regenerateMcpKey() {
    setRegenerating(true)
    try {
      const res = await fetch('/api/workspace/mcp-api-key', { method: 'POST' })
      if (!res.ok) { toast('Failed to regenerate key', 'error'); return }
      await mutateMcpKey()
      toast('MCP API key regenerated', 'success')
    } catch { toast('Failed to regenerate key', 'error') }
    finally { setRegenerating(false) }
  }

  return (
    <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 14px rgba(99,102,241,0.20)',
        }}>
          <Plug size={18} color="#818cf8" />
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.02em', margin: 0 }}>
            Integrations
          </h1>
          <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
            Connect your tools to activate AI-powered workflows
          </p>
        </div>
      </div>

      {/* Connection status strip */}
      <div style={{
        display: 'flex', gap: '10px', flexWrap: 'wrap',
        padding: '14px 18px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '12px',
      }}>
        {[
          { label: 'HubSpot', connected: hubspotConnected },
          { label: 'Linear', connected: linearConnected },
          { label: 'Slack', connected: slackConnected },
          { label: 'MCP', connected: mcpApiKey != null },
        ].map(({ label, connected }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <StatusDot connected={connected} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* HubSpot */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '14px' }}>🟠</span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>HubSpot</span>
            <StatusBadge connected={hubspotConnected} />
          </div>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 0' }}>
          Sync deals, contacts, and activities from your CRM.
        </p>

        {hubspotConnected ? (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {hubspotData?.portalId && (
              <div style={{ fontSize: '12px', color: '#475569' }}>
                Portal: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{hubspotData.portalId}</span>
              </div>
            )}
            {hubspotData?.syncCount != null && (
              <div style={{ fontSize: '12px', color: '#475569' }}>{hubspotData.syncCount} deals synced</div>
            )}
            {hubspotData?.lastSync && (
              <div style={{ fontSize: '12px', color: '#475569' }}>Last sync: {new Date(hubspotData.lastSync).toLocaleString()}</div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={handleHubspotSync}
                disabled={hubspotSyncing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 14px', borderRadius: '8px',
                  background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.22)',
                  color: '#fb923c', fontSize: '12px', fontWeight: 600, cursor: hubspotSyncing ? 'not-allowed' : 'pointer',
                  opacity: hubspotSyncing ? 0.6 : 1,
                }}
              >
                <RefreshCw size={11} style={{ animation: hubspotSyncing ? 'spin 1s linear infinite' : 'none' }} />
                {hubspotSyncing ? 'Syncing…' : 'Sync deals'}
              </button>
              <button
                onClick={handleHubspotDisconnect}
                disabled={hubspotDisconnecting}
                style={{
                  padding: '6px 14px', borderRadius: '8px',
                  background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)',
                  color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: hubspotDisconnecting ? 'not-allowed' : 'pointer',
                  opacity: hubspotDisconnecting ? 0.6 : 1,
                }}
              >
                {hubspotDisconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        ) : (
          <ConfigSection label="Connect HubSpot">
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px' }}>
              Enter your HubSpot Private App access token to connect.{' '}
              <a href="https://developers.hubspot.com/docs/api/private-apps" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>
                Get a token →
              </a>
            </p>
            <form onSubmit={handleHubspotConnect} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="password"
                value={hubspotToken}
                onChange={e => setHubspotToken(e.target.value)}
                placeholder="pat-na1-..."
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '12px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
                  color: '#e2e8f0', outline: 'none', fontFamily: 'monospace',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.40)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
              <button
                type="submit"
                disabled={hubspotConnecting || !hubspotToken.trim()}
                style={{
                  padding: '8px 16px', borderRadius: '8px',
                  background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.30)',
                  color: '#fb923c', fontSize: '12px', fontWeight: 600,
                  cursor: hubspotConnecting || !hubspotToken.trim() ? 'not-allowed' : 'pointer',
                  opacity: hubspotConnecting || !hubspotToken.trim() ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}
              >
                {hubspotConnecting && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                {hubspotConnecting ? 'Connecting…' : 'Connect'}
              </button>
            </form>
          </ConfigSection>
        )}
      </div>

      {/* Linear */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '14px' }}>🔷</span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>Linear</span>
            <StatusBadge connected={linearConnected} />
          </div>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 0' }}>
          Link product issues to deals. Track sprint progress against pipeline.
        </p>

        {linearConnected ? (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {linearData?.teamName && (
              <div style={{ fontSize: '12px', color: '#475569' }}>
                Team: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{linearData.teamName}</span>
              </div>
            )}
            {linearData?.workspaceName && (
              <div style={{ fontSize: '12px', color: '#475569' }}>
                Workspace: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{linearData.workspaceName}</span>
              </div>
            )}
            {linearData?.lastSyncAt && (
              <div style={{ fontSize: '12px', color: '#475569' }}>
                Last sync: <span style={{ color: '#94a3b8' }}>{new Date(linearData.lastSyncAt).toLocaleString()}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
              <button
                onClick={handleLinearSync}
                disabled={linearSyncing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 14px', borderRadius: '8px',
                  background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.22)',
                  color: '#818cf8', fontSize: '12px', fontWeight: 600,
                  cursor: linearSyncing ? 'not-allowed' : 'pointer',
                  opacity: linearSyncing ? 0.6 : 1,
                }}
              >
                <RefreshCw size={11} style={{ animation: linearSyncing ? 'spin 1s linear infinite' : 'none' }} />
                {linearSyncing ? 'Syncing…' : 'Sync issues'}
              </button>
              <button
                onClick={handleLinearRematch}
                disabled={linearRematching}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 14px', borderRadius: '8px',
                  background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.20)',
                  color: '#a5b4fc', fontSize: '12px', fontWeight: 600,
                  cursor: linearRematching ? 'not-allowed' : 'pointer',
                  opacity: linearRematching ? 0.6 : 1,
                }}
              >
                {linearRematching ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                {linearRematching ? 'Rematching…' : 'Rematch to deals'}
              </button>
              <button
                onClick={handleLinearDisconnect}
                disabled={linearDisconnecting}
                style={{
                  padding: '6px 14px', borderRadius: '8px',
                  background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)',
                  color: '#f87171', fontSize: '12px', fontWeight: 600,
                  cursor: linearDisconnecting ? 'not-allowed' : 'pointer',
                  opacity: linearDisconnecting ? 0.6 : 1,
                }}
              >
                {linearDisconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        ) : (
          <ConfigSection label="Connect Linear">
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px' }}>
              Enter your Linear Personal API key.{' '}
              <a href="https://linear.app/settings/api" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>
                Get a key →
              </a>
            </p>
            <form onSubmit={handleLinearConnect} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="password"
                value={linearApiKey}
                onChange={e => setLinearApiKey(e.target.value)}
                placeholder="lin_api_..."
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '12px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
                  color: '#e2e8f0', outline: 'none', fontFamily: 'monospace',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.40)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
              <button
                type="submit"
                disabled={linearConnecting || !linearApiKey.trim()}
                style={{
                  padding: '8px 16px', borderRadius: '8px',
                  background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.30)',
                  color: '#818cf8', fontSize: '12px', fontWeight: 600,
                  cursor: linearConnecting || !linearApiKey.trim() ? 'not-allowed' : 'pointer',
                  opacity: linearConnecting || !linearApiKey.trim() ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}
              >
                {linearConnecting && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                {linearConnecting ? 'Connecting…' : 'Connect'}
              </button>
            </form>
          </ConfigSection>
        )}
      </div>

      {/* Slack */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '14px' }}>💬</span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>Slack</span>
            <StatusBadge connected={slackConnected} />
          </div>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 0' }}>
          Receive deal alerts, release notifications, and AI briefings in Slack.
        </p>

        {slackConnected ? (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {slackData?.teamName && (
              <div style={{ fontSize: '12px', color: '#475569' }}>
                Workspace: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{slackData.teamName}</span>
              </div>
            )}
            <div style={{ fontSize: '12px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CheckCircle2 size={12} /> Ready to send notifications
            </div>
            <div style={{ marginTop: '4px' }}>
              <button
                onClick={handleSlackDisconnect}
                disabled={slackDisconnecting}
                style={{
                  padding: '6px 14px', borderRadius: '8px',
                  background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)',
                  color: '#f87171', fontSize: '12px', fontWeight: 600,
                  cursor: slackDisconnecting ? 'not-allowed' : 'pointer',
                  opacity: slackDisconnecting ? 0.6 : 1,
                }}
              >
                {slackDisconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '16px' }}>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px' }}>
              Connect Slack via OAuth to get deal health alerts and release notifications.
            </p>
            <a
              href="/api/integrations/slack/install"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px',
                background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.20)',
                color: '#4ade80', fontSize: '12px', fontWeight: 600, textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: '14px' }}>💬</span>
              Connect with Slack
            </a>
          </div>
        )}
      </div>

      {/* Claude MCP */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '14px' }}>🤖</span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>Claude MCP</span>
            <StatusBadge connected={mcpApiKey != null} />
          </div>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 0' }}>
          Connect Halvex to Claude&apos;s Model Context Protocol for AI-native workflows.
        </p>

        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{
              flex: 1, padding: '8px 12px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {mcpApiKey
                ? (showMcpKey ? mcpApiKey : '••••••••••••••••••••••••••••••••')
                : 'No key yet — click Regenerate to generate one'}
            </div>
            {mcpApiKey && (
              <>
                <button
                  onClick={() => setShowMcpKey(v => !v)}
                  style={{
                    width: '34px', height: '34px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#64748b', cursor: 'pointer',
                  }}
                >
                  {showMcpKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                  onClick={() => copyToClipboard(mcpApiKey)}
                  style={{
                    width: '34px', height: '34px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#64748b', cursor: 'pointer',
                  }}
                >
                  <Copy size={13} />
                </button>
              </>
            )}
            <button
              onClick={regenerateMcpKey}
              disabled={regenerating}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '0 12px', height: '34px', borderRadius: '8px',
                background: mcpApiKey ? 'rgba(248,113,113,0.08)' : 'rgba(99,102,241,0.12)',
                border: `1px solid ${mcpApiKey ? 'rgba(248,113,113,0.18)' : 'rgba(99,102,241,0.25)'}`,
                color: mcpApiKey ? '#f87171' : '#818cf8',
                fontSize: '11px', fontWeight: 600, cursor: regenerating ? 'not-allowed' : 'pointer',
                opacity: regenerating ? 0.6 : 1,
              }}
            >
              <RefreshCw size={11} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
              {mcpApiKey ? 'Regenerate' : 'Generate key'}
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 16px' }}>
            Add this key to your Claude MCP configuration to enable AI-native deal workflows.
          </p>

          {/* Endpoint URL */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Endpoint URL</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                flex: 1, padding: '7px 12px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8',
              }}>
                https://halvex.ai/api/mcp
              </div>
              <button
                onClick={() => copyToClipboard('https://halvex.ai/api/mcp')}
                style={{
                  width: '34px', height: '34px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#64748b', cursor: 'pointer',
                }}
              >
                <Copy size={13} />
              </button>
            </div>
          </div>

          {/* Available tools */}
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Available tools (6)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { name: 'halvex_get_deal_health', desc: 'Health score, risks & recommendations for any deal' },
                { name: 'halvex_find_at_risk_deals', desc: 'All deals needing immediate attention this week' },
                { name: 'halvex_get_linked_issues', desc: 'Linear issues blocking or linked to a deal' },
                { name: 'halvex_get_win_loss_signals', desc: 'Workspace-level win rate, patterns & loss reasons' },
                { name: 'halvex_scope_issue', desc: 'Generate user story + ACs and push to Linear cycle' },
                { name: 'halvex_draft_release_email', desc: 'Draft a release notification for a prospect' },
              ].map(t => (
                <div key={t.name} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '8px 10px',
                  background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.10)',
                  borderRadius: '8px',
                }}>
                  <span style={{
                    fontFamily: 'monospace', fontSize: '11px', fontWeight: 600,
                    color: '#818cf8', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>{t.name}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{t.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
