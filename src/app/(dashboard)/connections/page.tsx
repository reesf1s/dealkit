'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import Link from 'next/link'
import { useState } from 'react'
import { CheckCircle2, ExternalLink, Copy, Check, GitBranch, MessageSquare, Database, Brain } from 'lucide-react'
import { useToast } from '@/components/shared/Toast'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const card: React.CSSProperties = {
  position: 'relative',
  background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(59,130,246,0.05) 50%, rgba(139,92,246,0.07) 100%)',
  backdropFilter: 'blur(24px) saturate(200%)',
  WebkitBackdropFilter: 'blur(24px) saturate(200%)',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.40)',
  padding: '24px 28px',
}

function StatusBadge({ connected, loading }: { connected: boolean | null; loading: boolean }) {
  if (loading || connected === null) {
    return <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', background: 'rgba(255,255,255,0.06)', padding: '3px 10px', borderRadius: '100px' }}>Checking…</span>
  }
  if (connected) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: '#34d399', background: 'rgba(52,211,153,0.10)', padding: '4px 12px', borderRadius: '100px', border: '1px solid rgba(52,211,153,0.20)' }}>
        <CheckCircle2 size={11} /> Connected
      </span>
    )
  }
  return (
    <span style={{ fontSize: '11px', fontWeight: 600, color: '#f87171', background: 'rgba(248,113,113,0.08)', padding: '4px 12px', borderRadius: '100px', border: '1px solid rgba(248,113,113,0.18)' }}>
      Not connected
    </span>
  )
}

function ConnectButton({ href, label = 'Connect' }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '8px 18px', borderRadius: '9px',
        background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.28)',
        color: '#818cf8', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.22)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.14)'}
    >
      {label} <ExternalLink size={11} />
    </Link>
  )
}

export default function ConnectionsPage() {
  const { toast } = useToast()
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data: slackRes, isLoading: slackLoading } = useSWR('/api/integrations/slack/status', fetcher, { revalidateOnFocus: false })
  const { data: linearRes, isLoading: linearLoading } = useSWR('/api/integrations/linear/status', fetcher, { revalidateOnFocus: false })
  const { data: hubspotRes, isLoading: hubspotLoading } = useSWR('/api/integrations/hubspot/status', fetcher, { revalidateOnFocus: false })
  const { data: mcpKeyRes } = useSWR('/api/workspace/mcp-api-key', fetcher, { revalidateOnFocus: false })

  const slackConnected = slackRes?.data?.connected === true
  const linearConnected = linearRes?.data?.connected === true
  const hubspotConnected = hubspotRes?.data?.connected === true
  const mcpApiKey: string | null = mcpKeyRes?.key ?? mcpKeyRes?.data?.key ?? null

  function maskKey(key: string) {
    if (key.length < 12) return '••••••••'
    return key.slice(0, 8) + '•'.repeat(key.length - 12) + key.slice(-4)
  }

  async function copyKey() {
    if (!mcpApiKey) return
    await navigator.clipboard.writeText(mcpApiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast('API key copied', 'success')
  }

  const claudeConfig = mcpApiKey ? JSON.stringify({
    mcpServers: {
      halvex: {
        command: 'npx',
        args: ['-y', '@halvex/mcp'],
        env: { HALVEX_API_KEY: mcpApiKey },
      },
    },
  }, null, 2) : null

  return (
    <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.025em', marginBottom: '6px' }}>Connections</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.38)' }}>Connect your tools to Halvex.</p>
      </div>

      {/* ── HubSpot ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <IntegrationIcon color="rgba(255,122,0,0.90)" icon={<Database size={16} color="#fff" />} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'rgba(255,255,255,0.90)', marginBottom: '3px' }}>HubSpot</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>Sync your deals, contacts, and notes automatically</div>
            </div>
          </div>
          <StatusBadge connected={hubspotConnected} loading={hubspotLoading} />
        </div>
        {hubspotConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)' }}>
              {hubspotRes?.data?.lastSync ? `Last synced ${new Date(hubspotRes.data.lastSync).toLocaleDateString('en-GB')}` : 'Connected'}
            </span>
            <Link href="/settings/integrations" style={{ fontSize: '11px', color: '#818cf8', textDecoration: 'none' }}>Manage →</Link>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)', marginBottom: '12px', lineHeight: 1.6 }}>
              1. Go to Settings → Integrations<br />
              2. Paste your HubSpot API key or connect via OAuth<br />
              3. Halvex will automatically sync your pipeline
            </p>
            <ConnectButton href="/settings" label="Connect HubSpot" />
          </div>
        )}
      </div>

      {/* ── Linear ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <IntegrationIcon color="rgba(90,86,255,0.90)" icon={<GitBranch size={16} color="#fff" />} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'rgba(255,255,255,0.90)', marginBottom: '3px' }}>Linear</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>Link product issues to deals. Halvex finds these automatically.</div>
            </div>
          </div>
          <StatusBadge connected={linearConnected} loading={linearLoading} />
        </div>
        {linearConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)' }}>Connected</span>
            <Link href="/settings/integrations/linear" style={{ fontSize: '11px', color: '#818cf8', textDecoration: 'none' }}>Manage →</Link>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)', marginBottom: '12px', lineHeight: 1.6 }}>
              1. Go to Settings → Linear integration<br />
              2. Add your Linear API key<br />
              3. Halvex will start matching product issues to deal notes
            </p>
            <ConnectButton href="/settings/integrations/linear" label="Connect Linear" />
          </div>
        )}
      </div>

      {/* ── Slack ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <IntegrationIcon color="rgba(74,21,75,0.90)" icon={<MessageSquare size={16} color="#fff" />} glow="rgba(52,211,153,0.20)" />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'rgba(255,255,255,0.90)', marginBottom: '3px' }}>Slack</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>Get deal alerts and chat with Halvex about your pipeline</div>
            </div>
          </div>
          <StatusBadge connected={slackConnected} loading={slackLoading} />
        </div>
        {slackConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)' }}>
              {slackRes?.data?.teamName ? `Connected to ${slackRes.data.teamName}` : 'Connected'}
            </span>
            <Link href="/settings" style={{ fontSize: '11px', color: '#818cf8', textDecoration: 'none' }}>Manage →</Link>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)', marginBottom: '12px', lineHeight: 1.6 }}>
              1. Click &quot;Connect Slack&quot; below<br />
              2. Install the Halvex bot in your workspace<br />
              3. Halvex will send deal alerts and answer pipeline questions
            </p>
            <ConnectButton href="/api/integrations/slack/install" label="Connect Slack" />
          </div>
        )}
      </div>

      {/* ── Claude / MCP ── */}
      <div style={{ ...card, paddingBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <IntegrationIcon color="rgba(99,102,241,0.90)" icon={<Brain size={16} color="#fff" />} glow="rgba(99,102,241,0.35)" />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'rgba(255,255,255,0.90)', marginBottom: '3px' }}>Claude &amp; AI tools</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>Query your pipeline from Claude Desktop or any AI tool</div>
            </div>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#818cf8', background: 'rgba(99,102,241,0.10)', padding: '4px 12px', borderRadius: '100px', border: '1px solid rgba(99,102,241,0.20)', flexShrink: 0 }}>
            Always on
          </span>
        </div>

        {mcpApiKey ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* API key */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>Your MCP API key</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <code style={{ flex: 1, padding: '9px 14px', borderRadius: '9px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', color: 'rgba(255,255,255,0.70)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {showKey ? mcpApiKey : maskKey(mcpApiKey)}
                </code>
                <button
                  onClick={() => setShowKey(s => !s)}
                  style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.50)', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s', flexShrink: 0 }}
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={copyKey}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', color: '#818cf8', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s', flexShrink: 0 }}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Config snippet */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>Add to claude_desktop_config.json</div>
              <pre style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(0,0,0,0.30)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '11px', color: 'rgba(255,255,255,0.60)', overflow: 'auto', lineHeight: 1.6, margin: 0 }}>
                {claudeConfig}
              </pre>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, margin: 0 }}>
            Your MCP API key is being generated. Refresh the page in a moment.
          </p>
        )}
      </div>

      <style>{`
        @keyframes skeleton-shimmer {
          0%   { opacity: 1; }
          50%  { opacity: 0.45; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function IntegrationIcon({ color, icon, glow }: { color: string; icon: React.ReactNode; glow?: string }) {
  return (
    <div style={{
      width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
      background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: glow ? `0 0 16px ${glow}` : 'none',
    }}>
      {icon}
    </div>
  )
}
