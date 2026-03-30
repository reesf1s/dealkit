'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useState } from 'react'
import useSWR from 'swr'
import {
  Plug, CheckCircle2, Copy, RefreshCw, Eye, EyeOff, ChevronDown, ChevronUp, Loader2,
  Zap, Database, Sparkles, ArrowUpRight,
} from 'lucide-react'
import { useToast } from '@/components/shared/Toast'

async function fetcher(url: string) {
  const res = await fetch(url)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof json?.error === 'string' ? json.error : 'Request failed')
  }
  return json
}

const card: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '1rem',
  padding: '24px',
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

function McpSection({ mcpApiKey, showMcpKey, setShowMcpKey, regenerating, regenerateMcpKey, copyToClipboard }: {
  mcpApiKey: string | null
  showMcpKey: boolean
  setShowMcpKey: (v: (prev: boolean) => boolean) => void
  regenerating: boolean
  regenerateMcpKey: () => void
  copyToClipboard: (text: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={card}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '14px' }}>🤖</span>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>Claude MCP</span>
              <StatusBadge connected={mcpApiKey != null} />
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>AI Interface — power users</p>
          </div>
        </div>
        {open ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
      </button>

      {open && (
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {mcpApiKey ? (showMcpKey ? mcpApiKey : '••••••••••••••••••••••••••••••••') : 'No key yet — click Generate to create one'}
            </div>
            {mcpApiKey && (
              <>
                <button onClick={() => setShowMcpKey(v => !v)} style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer' }}>
                  {showMcpKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button onClick={() => copyToClipboard(mcpApiKey)} style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer' }}>
                  <Copy size={13} />
                </button>
              </>
            )}
            <button onClick={regenerateMcpKey} disabled={regenerating} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 12px', height: '34px', borderRadius: '8px', background: mcpApiKey ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.06)', border: `1px solid ${mcpApiKey ? 'rgba(248,113,113,0.18)' : 'rgba(255,255,255,0.10)'}`, color: mcpApiKey ? '#f87171' : 'rgba(255,255,255,0.70)', fontSize: '11px', fontWeight: 600, cursor: regenerating ? 'not-allowed' : 'pointer', opacity: regenerating ? 0.6 : 1 }}>
              <RefreshCw size={11} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
              {mcpApiKey ? 'Regenerate' : 'Generate key'}
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 16px' }}>Add this key to your Claude MCP configuration to enable AI-native deal workflows.</p>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Endpoint URL</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, padding: '7px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>
                https://halvex.ai/api/mcp
              </div>
              <button onClick={() => copyToClipboard('https://halvex.ai/api/mcp')} style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer' }}>
                <Copy size={13} />
              </button>
            </div>
          </div>
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
                <div key={t.name} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.70)', whiteSpace: 'nowrap', flexShrink: 0 }}>{t.name}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{t.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ConnectionsPage() {
  const { toast } = useToast()
  const { data: hubspotRes, error: hubspotError, mutate: mutateHubspot } = useSWR('/api/integrations/hubspot/status', fetcher, { revalidateOnFocus: false })
  const { data: linearRes, error: linearError, mutate: mutateLinear } = useSWR('/api/integrations/linear/status', fetcher, { revalidateOnFocus: false })
  const { data: slackRes, error: slackError, mutate: mutateSlack } = useSWR('/api/integrations/slack/status', fetcher, { revalidateOnFocus: false })
  const { data: mcpKeyRes, error: mcpError, mutate: mutateMcpKey } = useSWR('/api/workspace/mcp-api-key', fetcher, { revalidateOnFocus: false })

  const hubspotConnected: boolean | null = hubspotRes ? (hubspotRes?.data?.connected === true) : null
  const linearConnected: boolean | null = linearRes ? (linearRes?.data?.connected === true) : null
  const slackConnected: boolean | null = slackRes ? (slackRes?.data?.connected === true) : null

  const hubspotData = hubspotRes?.data
  const linearData = linearRes?.data
  const slackData = slackRes?.data
  const mcpApiKey: string | null = mcpKeyRes?.data?.mcpApiKey ?? null
  const connectionErrors = [
    slackError ? 'Slack status is unavailable.' : null,
    linearError ? 'Linear status is unavailable.' : null,
    hubspotError ? 'HubSpot status is unavailable.' : null,
    mcpError ? 'Claude MCP status is unavailable.' : null,
  ].filter(Boolean) as string[]

  const [hubspotToken, setHubspotToken] = useState('')
  const [hubspotConnecting, setHubspotConnecting] = useState(false)
  const [hubspotSyncing, setHubspotSyncing] = useState(false)
  const [hubspotDisconnecting, setHubspotDisconnecting] = useState(false)
  const [linearDisconnecting, setLinearDisconnecting] = useState(false)
  const [linearSyncing, setLinearSyncing] = useState(false)
  const [slackDisconnecting, setSlackDisconnecting] = useState(false)
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
      const res = await fetch('/api/integrations/hubspot/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: hubspotToken.trim() }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Connection failed')
      toast('HubSpot connected!', 'success')
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
      toast(`Synced ${json.data?.synced ?? json.data?.issuesSynced ?? json.data?.count ?? 0} issues from Linear`, 'success')
      mutateLinear()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : 'Sync failed', 'error') }
    finally { setLinearSyncing(false) }
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

  const actionBtn = (color: string, borderColor: string) => ({
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '6px 14px', borderRadius: '8px',
    background: `rgba(${color},0.12)`, border: `1px solid rgba(${color},0.22)`,
    color: `rgb(${color})`, fontSize: '12px', fontWeight: 600 as const,
    cursor: 'pointer' as const, fontFamily: 'inherit',
  })

  return (
    <div style={{ maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {connectionErrors.length > 0 && (
        <div style={{
          padding: '14px 16px',
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.18)',
          borderRadius: '12px',
          color: '#fde68a',
          fontSize: '12px',
          lineHeight: 1.7,
        }}>
          Some connection health data could not be loaded right now. {connectionErrors.join(' ')}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, background: 'linear-gradient(135deg, rgba(99,102,241,0.20), rgba(59,130,246,0.10))', border: '1px solid rgba(99,102,241,0.24)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={18} color="rgba(255,255,255,0.85)" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.03em', margin: '0 0 6px' }}>
            Connected issue intelligence
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: 1.7, maxWidth: '720px' }}>
            Halvex syncs your product and revenue data, then Claude reviews the context through Halvex MCP and saves only the issue links that matter back into the workspace.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
        <div style={{
          ...card,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(15,23,42,0.9))',
          borderColor: 'rgba(99,102,241,0.18)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(191,219,254,0.92)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Recommended flow
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {[
              'Sync Linear so Halvex has live issue context and status.',
              'Connect Claude to Halvex MCP once per workspace.',
              'Ask Claude to review a deal and save the relevant issue links back into Halvex.',
              'Track confirmed links and shipped outcomes inside Halvex.',
            ].map((step, index) => (
              <div key={step} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: '#e2e8f0',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {index + 1}
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6 }}>{step}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Current mode
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px' }}>
            Claude-assisted issue linking
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.7, margin: '0 0 14px' }}>
            Halvex owns the deal intelligence layer. Claude owns the judgment call on which Linear issues are genuinely relevant, then saves those links back into Halvex for the team.
          </p>
          <Link
            href="/chat"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: '#e2e8f0',
              textDecoration: 'none',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Open Ask AI
            <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      {/* Status strip */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px' }}>
        {[
          { label: 'Slack', connected: slackConnected },
          { label: 'Linear', connected: linearConnected },
          { label: 'HubSpot', connected: hubspotConnected },
          { label: 'MCP', connected: mcpApiKey != null },
        ].map(({ label, connected }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <StatusDot connected={connected} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── 1. Slack — Your Revenue Interface ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(74,144,226,0.12)', border: '1px solid rgba(74,144,226,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '14px' }}>💬</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>Slack</span>
              <StatusBadge connected={slackConnected} />
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Your Revenue Interface — rep-facing</p>
          </div>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 0' }}>Ask about deals, review linked product work, and get notified when customer blockers ship without leaving your workflow.</p>

        {slackConnected ? (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {slackData?.slackTeamName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#34d399' }}>
                <CheckCircle2 size={12} /> Connected to <strong>{slackData.slackTeamName}</strong>
              </div>
            )}
            <button onClick={handleSlackDisconnect} disabled={slackDisconnecting} style={{ ...actionBtn('248,113,113', '248,113,113'), cursor: slackDisconnecting ? 'not-allowed' : 'pointer', opacity: slackDisconnecting ? 0.6 : 1, width: 'fit-content' }}>
              {slackDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: '16px' }}>
            <a
              href="/api/integrations/slack/install"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(74,144,226,0.30)',
                color: '#60a5fa', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
              }}
            >
              <Zap size={14} /> Connect Slack
            </a>
          </div>
        )}
      </div>

      {/* ── 2. Linear — Your Product Interface ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '14px' }}>🔷</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>Linear</span>
              <StatusBadge connected={linearConnected} />
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Your Product Interface — PM-facing</p>
          </div>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 0' }}>
          Linear stays synced in Halvex. Claude reviews deal context against your Linear workspace and saves the chosen issue links back into Halvex.
        </p>

        {linearConnected ? (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {linearData?.teamName && <div style={{ fontSize: '12px', color: '#475569' }}>Team: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{linearData.teamName}</span></div>}
            {linearData?.workspaceName && <div style={{ fontSize: '12px', color: '#475569' }}>Workspace: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{linearData.workspaceName}</span></div>}
            {typeof linearData?.issueCount === 'number' && <div style={{ fontSize: '12px', color: '#475569' }}>Issues synced: <span style={{ color: '#94a3b8' }}>{linearData.issueCount}</span></div>}
            {linearData?.lastSyncAt && <div style={{ fontSize: '12px', color: '#475569' }}>Last sync: <span style={{ color: '#94a3b8' }}>{new Date(linearData.lastSyncAt).toLocaleString()}</span></div>}
            {linearData?.syncError && (
              <div style={{
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.16)',
                fontSize: '12px',
                color: '#fde68a',
                lineHeight: 1.6,
              }}>
                Linear is connected, but the latest sync reported a problem. Saved links may still work while some backlog data is stale.
              </div>
            )}
            {linearData?.matchingSummary && (
              <div style={{
                marginTop: '4px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.14)',
                fontSize: '12px',
                color: '#cbd5e1',
                lineHeight: 1.6,
              }}>
                {linearData.matchingSummary}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
              <button onClick={handleLinearSync} disabled={linearSyncing} style={{ ...actionBtn('255,255,255', '255,255,255'), cursor: linearSyncing ? 'not-allowed' : 'pointer', opacity: linearSyncing ? 0.6 : 1 }}>
                <RefreshCw size={11} style={{ animation: linearSyncing ? 'spin 1s linear infinite' : 'none' }} />
                {linearSyncing ? 'Syncing…' : 'Sync issues'}
              </button>
              <button onClick={handleLinearDisconnect} disabled={linearDisconnecting} style={{ ...actionBtn('248,113,113', '248,113,113'), cursor: linearDisconnecting ? 'not-allowed' : 'pointer', opacity: linearDisconnecting ? 0.6 : 1 }}>
                {linearDisconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '16px' }}>
            <a
              href="/api/integrations/linear/install"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.70)', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
              }}
            >
              <Database size={14} /> Connect Linear
            </a>
          </div>
        )}
      </div>

      {/* ── 3. HubSpot — Deal Source (optional) ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '14px' }}>🟠</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>HubSpot</span>
              <StatusBadge connected={hubspotConnected} />
              <span style={{ fontSize: '10px', color: '#64748b', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>Optional</span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Deal Source — sync your CRM pipeline</p>
          </div>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 0' }}>Sync deals, contacts, and activities from your CRM.</p>

        {hubspotConnected ? (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {hubspotData?.portalId && <div style={{ fontSize: '12px', color: '#475569' }}>Portal: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{hubspotData.portalId}</span></div>}
            {hubspotData?.syncCount != null && <div style={{ fontSize: '12px', color: '#475569' }}>{hubspotData.syncCount} deals synced</div>}
            {hubspotData?.lastSync && <div style={{ fontSize: '12px', color: '#475569' }}>Last sync: {new Date(hubspotData.lastSync).toLocaleString()}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={handleHubspotSync} disabled={hubspotSyncing} style={{ ...actionBtn('251,146,60', '251,146,60'), cursor: hubspotSyncing ? 'not-allowed' : 'pointer', opacity: hubspotSyncing ? 0.6 : 1 }}>
                <RefreshCw size={11} style={{ animation: hubspotSyncing ? 'spin 1s linear infinite' : 'none' }} />
                {hubspotSyncing ? 'Syncing…' : 'Sync deals'}
              </button>
              <button onClick={handleHubspotDisconnect} disabled={hubspotDisconnecting} style={{ ...actionBtn('248,113,113', '248,113,113'), cursor: hubspotDisconnecting ? 'not-allowed' : 'pointer', opacity: hubspotDisconnecting ? 0.6 : 1 }}>
                {hubspotDisconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '16px' }}>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px' }}>
              Enter your HubSpot Private App access token.{' '}
              <a href="https://developers.hubspot.com/docs/api/private-apps" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.70)', textDecoration: 'none' }}>Get a token →</a>
            </p>
            <form onSubmit={handleHubspotConnect} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="password"
                value={hubspotToken}
                onChange={e => setHubspotToken(e.target.value)}
                placeholder="pat-na1-..."
                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: '#e2e8f0', outline: 'none', fontFamily: 'monospace' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.14)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
              <button type="submit" disabled={hubspotConnecting || !hubspotToken.trim()} style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.30)', color: '#fb923c', fontSize: '12px', fontWeight: 600, cursor: hubspotConnecting || !hubspotToken.trim() ? 'not-allowed' : 'pointer', opacity: hubspotConnecting || !hubspotToken.trim() ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '5px' }}>
                {hubspotConnecting && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                {hubspotConnecting ? 'Connecting…' : 'Connect'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── 4. Claude MCP (collapsed) ── */}
      <McpSection
        mcpApiKey={mcpApiKey}
        showMcpKey={showMcpKey}
        setShowMcpKey={setShowMcpKey}
        regenerating={regenerating}
        regenerateMcpKey={regenerateMcpKey}
        copyToClipboard={copyToClipboard}
      />
    </div>
  )
}
