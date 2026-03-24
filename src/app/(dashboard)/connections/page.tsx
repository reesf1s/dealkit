'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import {
  Plug, CheckCircle2, AlertCircle, Copy, RefreshCw, ExternalLink, Eye, EyeOff,
} from 'lucide-react'
import { useToast } from '@/components/shared/Toast'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const card: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(59,130,246,0.04), transparent)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '1rem',
  padding: '24px',
  boxShadow: '0 2px 20px rgba(0,0,0,0.40)',
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

export default function ConnectionsPage() {
  const { toast } = useToast()
  const { data: hubspotRes } = useSWR('/api/integrations/hubspot/status', fetcher, { revalidateOnFocus: false })
  const { data: linearRes } = useSWR('/api/integrations/linear/status', fetcher, { revalidateOnFocus: false })
  const { data: slackRes } = useSWR('/api/integrations/slack/status', fetcher, { revalidateOnFocus: false })
  const { data: workspaceRes } = useSWR('/api/workspace', fetcher, { revalidateOnFocus: false })

  const hubspotConnected: boolean | null = hubspotRes ? (hubspotRes?.data?.connected === true) : null
  const linearConnected: boolean | null = linearRes ? (linearRes?.data?.connected === true) : null
  const slackConnected: boolean | null = slackRes ? (slackRes?.data?.connected === true) : null

  const hubspotData = hubspotRes?.data
  const linearData = linearRes?.data
  const slackData = slackRes?.data
  const mcpApiKey: string | null = workspaceRes?.data?.mcpApiKey ?? null

  const [showMcpKey, setShowMcpKey] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast('Copied to clipboard', 'success')
    } catch {
      toast('Failed to copy', 'error')
    }
  }

  async function regenerateMcpKey() {
    setRegenerating(true)
    try {
      const res = await fetch('/api/workspace/mcp-key/regenerate', { method: 'POST' })
      if (!res.ok) { toast('Failed to regenerate key', 'error'); return }
      toast('MCP API key regenerated', 'success')
    } catch {
      toast('Failed to regenerate key', 'error')
    } finally {
      setRegenerating(false)
    }
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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '14px' }}>🟠</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>HubSpot</span>
              <StatusBadge connected={hubspotConnected} />
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Sync deals, contacts, and activities from your CRM.
            </p>
          </div>
        </div>

        {hubspotConnected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {hubspotData?.portalId && (
              <div style={{ fontSize: '12px', color: '#475569' }}>
                Portal: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{hubspotData.portalId}</span>
              </div>
            )}
            {hubspotData?.syncCount != null && (
              <div style={{ fontSize: '12px', color: '#475569' }}>
                {hubspotData.syncCount} deals synced
              </div>
            )}
            {hubspotData?.lastSync && (
              <div style={{ fontSize: '12px', color: '#475569' }}>
                Last sync: {new Date(hubspotData.lastSync).toLocaleString()}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '16px', background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.12)', borderRadius: '10px' }}>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 10px' }}>
              Connect HubSpot to automatically sync your CRM pipeline with Halvex.
            </p>
            <a
              href="/settings"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '8px 14px', borderRadius: '8px',
                background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.22)',
                color: '#fb923c', fontSize: '12px', fontWeight: 600, textDecoration: 'none',
              }}
            >
              Set up in Settings <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>

      {/* Linear */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '14px' }}>🔷</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>Linear</span>
              <StatusBadge connected={linearConnected} />
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Link product issues to deals. Track sprint progress against pipeline.
            </p>
          </div>
        </div>

        {linearConnected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
          </div>
        ) : (
          <div style={{ padding: '16px', background: 'rgba(129,140,248,0.05)', border: '1px solid rgba(129,140,248,0.12)', borderRadius: '10px' }}>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 10px' }}>
              Connect Linear to link product issues to your deals and track sprint impact.
            </p>
            <a
              href="/settings"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '8px 14px', borderRadius: '8px',
                background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.22)',
                color: '#818cf8', fontSize: '12px', fontWeight: 600, textDecoration: 'none',
              }}
            >
              Set up in Settings <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>

      {/* Slack */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '14px' }}>💬</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>Slack</span>
              <StatusBadge connected={slackConnected} />
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Receive deal alerts, release notifications, and AI briefings in Slack.
            </p>
          </div>
        </div>

        {slackConnected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {slackData?.teamName && (
              <div style={{ fontSize: '12px', color: '#475569' }}>
                Workspace: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{slackData.teamName}</span>
              </div>
            )}
            <div style={{ fontSize: '12px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CheckCircle2 size={12} /> Ready to send notifications
            </div>
          </div>
        ) : (
          <div style={{ padding: '16px', background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.10)', borderRadius: '10px' }}>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 10px' }}>
              Connect Slack to get deal health alerts and release notifications.
            </p>
            <a
              href="/settings"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '8px 14px', borderRadius: '8px',
                background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)',
                color: '#4ade80', fontSize: '12px', fontWeight: 600, textDecoration: 'none',
              }}
            >
              Set up in Settings <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>

      {/* Claude MCP */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '14px' }}>🤖</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>Claude MCP</span>
              <StatusBadge connected={mcpApiKey != null} />
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Connect Halvex to Claude&apos;s Model Context Protocol for AI-native workflows.
            </p>
          </div>
        </div>

        {mcpApiKey ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{
                flex: 1, padding: '8px 12px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {showMcpKey ? mcpApiKey : '••••••••••••••••••••••••••••••••'}
              </div>
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
              <button
                onClick={regenerateMcpKey}
                disabled={regenerating}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '0 12px', height: '34px', borderRadius: '8px',
                  background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)',
                  color: '#f87171', fontSize: '11px', fontWeight: 600, cursor: regenerating ? 'not-allowed' : 'pointer',
                  opacity: regenerating ? 0.6 : 1,
                }}
              >
                <RefreshCw size={11} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
                Regenerate
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
              Add this key to your Claude MCP configuration to enable AI-native deal workflows.
            </p>
          </div>
        ) : (
          <div style={{ padding: '16px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: '10px' }}>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 10px' }}>
              Generate an MCP API key to connect Claude directly to your Halvex workspace.
            </p>
            <a
              href="/settings"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '8px 14px', borderRadius: '8px',
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)',
                color: '#818cf8', fontSize: '12px', fontWeight: 600, textDecoration: 'none',
              }}
            >
              Generate key <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
