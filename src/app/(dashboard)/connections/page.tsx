'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Workflow,
  Database,
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

const panel: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.74) 0%, rgba(247,248,255,0.62) 100%)',
  border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: '28px',
  padding: '26px',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  boxShadow: '0 18px 60px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.75)',
}

function StatusPill({ label, tone }: { label: string; tone: 'ready' | 'partial' | 'idle' }) {
  const styles = {
    ready: {
      background: 'rgba(16,185,129,0.10)',
      border: '1px solid rgba(16,185,129,0.18)',
      color: '#047857',
    },
    partial: {
      background: 'rgba(245,158,11,0.10)',
      border: '1px solid rgba(245,158,11,0.20)',
      color: '#b45309',
    },
    idle: {
      background: 'rgba(148,163,184,0.12)',
      border: '1px solid rgba(148,163,184,0.18)',
      color: '#475569',
    },
  }[tone]

  return (
    <span
      style={{
        ...styles,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        fontWeight: 700,
        borderRadius: '999px',
        padding: '5px 10px',
        letterSpacing: '0.01em',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '999px',
          background: 'currentColor',
          opacity: 0.8,
        }}
      />
      {label}
    </span>
  )
}

function SetupItem({
  step,
  title,
  body,
}: {
  step: string
  title: string
  body: string
}) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '999px',
          background: 'rgba(15,23,42,0.86)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {step}
      </div>
      <div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
          {title}
        </div>
        <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.65 }}>
          {body}
        </div>
      </div>
    </div>
  )
}

function McpSection({
  mcpApiKey,
  showMcpKey,
  setShowMcpKey,
  regenerating,
  regenerateMcpKey,
  copyToClipboard,
}: {
  mcpApiKey: string | null
  showMcpKey: boolean
  setShowMcpKey: (v: (prev: boolean) => boolean) => void
  regenerating: boolean
  regenerateMcpKey: () => void
  copyToClipboard: (text: string) => void
}) {
  const endpoint = 'https://halvex.ai/api/mcp'

  return (
    <div style={{ ...panel, padding: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,41,59,0.76))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
              boxShadow: '0 14px 24px rgba(15,23,42,0.16)',
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', margin: 0 }}>
                Claude MCP
              </h2>
              <StatusPill label={mcpApiKey ? 'Workspace ready' : 'Needs setup'} tone={mcpApiKey ? 'ready' : 'idle'} />
            </div>
            <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.7, margin: 0, maxWidth: '620px' }}>
              Halvex exposes deal intelligence through MCP. Claude already handles Linear on your side. Once this endpoint and key are in Claude, the daily workflow is just one prompt.
            </p>
          </div>
        </div>
        <button
          onClick={regenerateMcpKey}
          disabled={regenerating}
          style={{
            height: '38px',
            padding: '0 14px',
            borderRadius: '999px',
            border: '1px solid rgba(15,23,42,0.12)',
            background: '#fff',
            color: '#0f172a',
            fontSize: '12px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            cursor: regenerating ? 'not-allowed' : 'pointer',
            opacity: regenerating ? 0.7 : 1,
            flexShrink: 0,
          }}
        >
          <RefreshCw size={13} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
          {mcpApiKey ? 'Regenerate key' : 'Generate key'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '16px' }}>
        <div
          style={{
            padding: '18px',
            borderRadius: '22px',
            background: 'rgba(255,255,255,0.68)',
            border: '1px solid rgba(255,255,255,0.78)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
            MCP endpoint
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderRadius: '16px',
              padding: '14px 16px',
              background: '#f8fafc',
              border: '1px solid rgba(148,163,184,0.16)',
              marginBottom: '14px',
            }}
          >
            <div style={{ flex: 1, minWidth: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {endpoint}
            </div>
            <button
              onClick={() => copyToClipboard(endpoint)}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '12px',
                border: '1px solid rgba(148,163,184,0.18)',
                background: '#fff',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Copy size={13} />
            </button>
          </div>

          <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
            API key
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderRadius: '16px',
              padding: '14px 16px',
              background: '#f8fafc',
              border: '1px solid rgba(148,163,184,0.16)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {mcpApiKey ? (showMcpKey ? mcpApiKey : '••••••••••••••••••••••••••••••••') : 'Generate a workspace key to finish setup'}
            </div>
            {mcpApiKey && (
              <>
                <button
                  onClick={() => setShowMcpKey(v => !v)}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '12px',
                    border: '1px solid rgba(148,163,184,0.18)',
                    background: '#fff',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {showMcpKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                  onClick={() => copyToClipboard(mcpApiKey)}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '12px',
                    border: '1px solid rgba(148,163,184,0.18)',
                    background: '#fff',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Copy size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            padding: '18px',
            borderRadius: '22px',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.90) 100%)',
            color: '#e2e8f0',
            boxShadow: '0 18px 30px rgba(15,23,42,0.14)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(191,219,254,0.88)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Daily Claude prompt
          </div>
          <div style={{ fontSize: '14px', lineHeight: 1.8, color: 'rgba(226,232,240,0.88)' }}>
            “Check my Halvex pipeline, use your Linear access to identify blockers, and save any relevant issue links back to the right deals.”
          </div>
          <div style={{ marginTop: '14px', fontSize: '12px', lineHeight: 1.7, color: 'rgba(203,213,225,0.72)' }}>
            Halvex does not sync or match Linear itself anymore. Claude does the cross-system review. Halvex stores the linked issues, deal intelligence, and shipped outcomes.
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConnectionsPage() {
  const { toast } = useToast()

  const { data: hubspotRes, error: hubspotError, mutate: mutateHubspot } = useSWR('/api/integrations/hubspot/status', fetcher, { revalidateOnFocus: false })
  const { data: slackRes, error: slackError, mutate: mutateSlack } = useSWR('/api/integrations/slack/status', fetcher, { revalidateOnFocus: false })
  const { data: mcpKeyRes, error: mcpError, mutate: mutateMcpKey } = useSWR('/api/workspace/mcp-api-key', fetcher, { revalidateOnFocus: false })

  const slackConnected: boolean | null = slackRes ? (slackRes?.data?.connected === true) : null
  const hubspotConnected: boolean | null = hubspotRes ? (hubspotRes?.data?.connected === true) : null
  const slackData = slackRes?.data
  const hubspotData = hubspotRes?.data
  const mcpApiKey: string | null = mcpKeyRes?.data?.mcpApiKey ?? null

  const connectionErrors = useMemo(() => (
    [
      slackError ? 'Slack status is unavailable.' : null,
      hubspotError ? 'CRM status is unavailable.' : null,
      mcpError ? 'Claude MCP setup is unavailable.' : null,
    ].filter(Boolean) as string[]
  ), [hubspotError, mcpError, slackError])

  const [hubspotToken, setHubspotToken] = useState('')
  const [hubspotConnecting, setHubspotConnecting] = useState(false)
  const [hubspotSyncing, setHubspotSyncing] = useState(false)
  const [hubspotDisconnecting, setHubspotDisconnecting] = useState(false)
  const [slackDisconnecting, setSlackDisconnecting] = useState(false)
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
      toast('CRM connected', 'success')
      setHubspotToken('')
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
      toast(`Synced ${json.data?.dealsImported ?? 0} deals from HubSpot`, 'success')
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
      await fetch('/api/integrations/hubspot/disconnect', { method: 'DELETE' })
      toast('CRM disconnected', 'success')
      mutateHubspot()
    } catch {
      toast('Failed to disconnect', 'error')
    } finally {
      setHubspotDisconnecting(false)
    }
  }

  async function handleSlackDisconnect() {
    setSlackDisconnecting(true)
    try {
      await fetch('/api/integrations/slack/disconnect', { method: 'POST' })
      toast('Slack disconnected', 'success')
      mutateSlack()
    } catch {
      toast('Failed to disconnect', 'error')
    } finally {
      setSlackDisconnecting(false)
    }
  }

  async function regenerateMcpKey() {
    setRegenerating(true)
    try {
      const res = await fetch('/api/workspace/mcp-api-key', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to regenerate key')
      await mutateMcpKey()
      toast('MCP API key regenerated', 'success')
    } catch {
      toast('Failed to regenerate key', 'error')
    } finally {
      setRegenerating(false)
    }
  }

  const crmTone = hubspotConnected === null ? 'idle' : hubspotConnected ? 'ready' : 'partial'
  const slackTone = slackConnected === null ? 'idle' : slackConnected ? 'ready' : 'partial'

  return (
    <div style={{ maxWidth: '1120px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 960px) {
          .connections-grid,
          .connections-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {connectionErrors.length > 0 && (
        <div
          style={{
            padding: '15px 18px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.18)',
            borderRadius: '18px',
            color: '#fef3c7',
            fontSize: '12px',
            lineHeight: 1.7,
          }}
        >
          Some workspace health data could not be loaded right now. {connectionErrors.join(' ')}
        </div>
      )}

      <div className="connections-grid" style={{ display: 'grid', gridTemplateColumns: '1.08fr 0.92fr', gap: '18px' }}>
        <div style={{ ...panel, padding: '30px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '999px',
              background: 'rgba(15,23,42,0.06)',
              border: '1px solid rgba(15,23,42,0.08)',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#475569',
              textTransform: 'uppercase',
              marginBottom: '18px',
            }}
          >
            <Sparkles size={12} />
            Halvex setup
          </div>

          <h1 style={{ fontSize: '34px', lineHeight: 1.02, letterSpacing: '-0.05em', fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>
            Keep Halvex focused on deal intelligence, not issue matching.
          </h1>
          <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.8, margin: '0 0 20px', maxWidth: '680px' }}>
            Claude already knows how to work across tools. Halvex should own the CRM layer: deal context, linked blockers, shipped outcomes, and the automation around what revenue teams do next.
          </p>

          <div style={{ display: 'grid', gap: '14px' }}>
            <SetupItem
              step="1"
              title="Bring your deals into Halvex"
              body="Connect Slack and your CRM so Halvex becomes the live source of truth for pipeline state, notes, and action history."
            />
            <SetupItem
              step="2"
              title="Add Halvex MCP to Claude once"
              body="Claude uses Halvex MCP for deal intelligence, and its own Linear connection for backlog review. Halvex no longer needs a direct Linear integration in the user journey."
            />
            <SetupItem
              step="3"
              title="Run a daily Claude review"
              body="Ask Claude to review your Halvex pipeline, inspect Linear externally, and save the high-confidence issue links back into the right deals."
            />
            <SetupItem
              step="4"
              title="Work the outcomes inside Halvex"
              body="Reps and leaders stay in Halvex to review linked blockers, confirm what matters, and track shipped revenue-impacting work."
            />
          </div>
        </div>

        <div style={{ ...panel, padding: '30px', background: 'linear-gradient(180deg, rgba(15,23,42,0.90) 0%, rgba(30,41,59,0.88) 100%)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(191,219,254,0.84)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
            Workspace posture
          </div>
          <div style={{ fontSize: '24px', lineHeight: 1.1, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.04em', marginBottom: '12px' }}>
            A calmer, clearer deal intelligence workflow
          </div>
          <p style={{ fontSize: '14px', color: 'rgba(203,213,225,0.76)', lineHeight: 1.8, margin: '0 0 18px' }}>
            This workspace is now oriented around daily operating rhythm instead of setup complexity. Halvex surfaces context and outcomes. Claude does the judgment-heavy review.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
            <StatusPill label={slackConnected ? 'Slack live' : 'Slack recommended'} tone={slackTone} />
            <StatusPill label={hubspotConnected ? 'CRM live' : 'CRM optional'} tone={crmTone} />
            <StatusPill label={mcpApiKey ? 'MCP ready' : 'MCP setup needed'} tone={mcpApiKey ? 'ready' : 'partial'} />
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {[
              'No Halvex-owned Linear sync or rematching in the primary flow',
              'Claude reviews externally and writes back only the links that matter',
              'Halvex stays responsible for CRM intelligence, automation, and visibility',
            ].map(item => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  padding: '12px 14px',
                  borderRadius: '18px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(226,232,240,0.84)',
                  fontSize: '13px',
                  lineHeight: 1.6,
                }}
              >
                <CheckCircle2 size={14} style={{ marginTop: '2px', flexShrink: 0, color: '#93c5fd' }} />
                {item}
              </div>
            ))}
          </div>
          <Link
            href="/dashboard"
            style={{
              marginTop: '20px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: '#fff',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            Open dashboard
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      <McpSection
        mcpApiKey={mcpApiKey}
        showMcpKey={showMcpKey}
        setShowMcpKey={setShowMcpKey}
        regenerating={regenerating}
        regenerateMcpKey={regenerateMcpKey}
        copyToClipboard={copyToClipboard}
      />

      <div className="connections-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '18px' }}>
        <div style={{ ...panel, padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '14px', background: 'rgba(74,144,226,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={18} color="#2563eb" />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Slack</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Rep-facing workspace</div>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.7, margin: '0 0 16px' }}>
            Keep deal questions, alerts, and follow-ups in the place your team already works every day.
          </p>
          {slackConnected ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: '#0f766e', lineHeight: 1.6 }}>
                Connected to <strong>{slackData?.slackTeamName ?? 'your workspace'}</strong>
              </div>
              <button
                onClick={handleSlackDisconnect}
                disabled={slackDisconnecting}
                style={{
                  height: '40px',
                  borderRadius: '14px',
                  border: '1px solid rgba(239,68,68,0.18)',
                  background: 'rgba(239,68,68,0.08)',
                  color: '#dc2626',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: slackDisconnecting ? 'not-allowed' : 'pointer',
                  opacity: slackDisconnecting ? 0.7 : 1,
                }}
              >
                {slackDisconnecting ? 'Disconnecting...' : 'Disconnect Slack'}
              </button>
            </div>
          ) : (
            <a
              href="/api/integrations/slack/install"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                height: '42px',
                padding: '0 16px',
                borderRadius: '14px',
                background: '#0f172a',
                color: '#fff',
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              <MessageSquare size={14} />
              Connect Slack
            </a>
          )}
        </div>

        <div style={{ ...panel, padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '14px', background: 'rgba(251,146,60,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={18} color="#ea580c" />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>CRM sync</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Pipeline source of truth</div>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.7, margin: '0 0 16px' }}>
            Keep revenue context fresh so Claude reviews the real pipeline, not stale exports or one-off screenshots.
          </p>
          {hubspotConnected ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.7 }}>
                {hubspotData?.syncCount != null ? `${hubspotData.syncCount} deals synced` : 'CRM connected'}
                {hubspotData?.lastSync ? ` · Last sync ${new Date(hubspotData.lastSync).toLocaleString()}` : ''}
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleHubspotSync}
                  disabled={hubspotSyncing}
                  style={{
                    height: '40px',
                    padding: '0 14px',
                    borderRadius: '14px',
                    border: '1px solid rgba(15,23,42,0.12)',
                    background: '#fff',
                    color: '#0f172a',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: hubspotSyncing ? 'not-allowed' : 'pointer',
                    opacity: hubspotSyncing ? 0.7 : 1,
                  }}
                >
                  <RefreshCw size={13} style={{ animation: hubspotSyncing ? 'spin 1s linear infinite' : 'none' }} />
                  {hubspotSyncing ? 'Syncing...' : 'Sync deals'}
                </button>
                <button
                  onClick={handleHubspotDisconnect}
                  disabled={hubspotDisconnecting}
                  style={{
                    height: '40px',
                    padding: '0 14px',
                    borderRadius: '14px',
                    border: '1px solid rgba(239,68,68,0.18)',
                    background: 'rgba(239,68,68,0.08)',
                    color: '#dc2626',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: hubspotDisconnecting ? 'not-allowed' : 'pointer',
                    opacity: hubspotDisconnecting ? 0.7 : 1,
                  }}
                >
                  {hubspotDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleHubspotConnect} style={{ display: 'grid', gap: '10px' }}>
              <input
                type="password"
                value={hubspotToken}
                onChange={e => setHubspotToken(e.target.value)}
                placeholder="HubSpot private app token"
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '14px',
                  border: '1px solid rgba(148,163,184,0.18)',
                  background: '#fff',
                  color: '#0f172a',
                  padding: '0 14px',
                  fontSize: '12px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={hubspotConnecting || !hubspotToken.trim()}
                style={{
                  height: '42px',
                  borderRadius: '14px',
                  border: '1px solid rgba(15,23,42,0.12)',
                  background: '#0f172a',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: hubspotConnecting || !hubspotToken.trim() ? 'not-allowed' : 'pointer',
                  opacity: hubspotConnecting || !hubspotToken.trim() ? 0.7 : 1,
                }}
              >
                {hubspotConnecting && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                {hubspotConnecting ? 'Connecting...' : 'Connect CRM'}
              </button>
            </form>
          )}
        </div>

        <div style={{ ...panel, padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '14px', background: 'rgba(15,23,42,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Workflow size={18} color="#0f172a" />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Claude + Linear</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Runs outside Halvex</div>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.7, margin: '0 0 16px' }}>
            Halvex no longer asks you to connect Linear here. Claude should already have access to Linear in your own account, then use Halvex MCP to write links back.
          </p>
          <div
            style={{
              padding: '14px',
              borderRadius: '18px',
              background: 'rgba(15,23,42,0.04)',
              border: '1px solid rgba(15,23,42,0.06)',
              fontSize: '12px',
              color: '#475569',
              lineHeight: 1.7,
            }}
          >
            Daily habit:
            <div style={{ marginTop: '8px', color: '#0f172a', fontWeight: 600 }}>
              Review Halvex pipeline in Claude, inspect Linear there, and save confirmed issue links back into Halvex.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
