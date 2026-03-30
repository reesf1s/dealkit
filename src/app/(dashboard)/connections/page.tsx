'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { useToast } from '@/components/shared/Toast'

const DAILY_PROMPT =
  'Check my Halvex pipeline, review my product work, and save any relevant issue links back into the right deals.'

async function fetcher(url: string) {
  const res = await fetch(url)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof json?.error === 'string' ? json.error : 'Request failed')
  }
  return json
}

const card: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(11,10,28,0.92) 0%, rgba(9,8,24,0.86) 100%)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '28px',
  padding: '26px',
  boxShadow: '0 24px 60px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const mutedText = 'rgba(255,255,255,0.52)'
const faintText = 'rgba(255,255,255,0.34)'

function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: 'ready' | 'partial' | 'idle' | 'loading'
}) {
  const styles = {
    ready: {
      background: 'rgba(16,185,129,0.12)',
      border: '1px solid rgba(16,185,129,0.18)',
      color: '#86efac',
    },
    partial: {
      background: 'rgba(245,158,11,0.12)',
      border: '1px solid rgba(245,158,11,0.18)',
      color: '#fde68a',
    },
    idle: {
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.66)',
    },
    loading: {
      background: 'rgba(59,130,246,0.12)',
      border: '1px solid rgba(59,130,246,0.18)',
      color: '#bfdbfe',
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
        padding: '6px 10px',
        letterSpacing: '0.02em',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '999px',
          background: 'currentColor',
          opacity: 0.9,
        }}
      />
      {label}
    </span>
  )
}

function StepItem({
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
          width: '30px',
          height: '30px',
          borderRadius: '999px',
          background: 'rgba(139,92,246,0.14)',
          border: '1px solid rgba(139,92,246,0.22)',
          color: 'rgba(255,255,255,0.90)',
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
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.92)', marginBottom: '4px' }}>
          {title}
        </div>
        <div style={{ fontSize: '13px', color: mutedText, lineHeight: 1.7 }}>
          {body}
        </div>
      </div>
    </div>
  )
}

function SecretField({
  label,
  value,
  hidden,
  loading,
  onToggle,
  onCopy,
}: {
  label: string
  value: string | null
  hidden?: boolean
  loading?: boolean
  onToggle?: () => void
  onCopy?: () => void
}) {
  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '20px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 800, color: faintText, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minHeight: '44px',
          borderRadius: '16px',
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.78)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {loading
            ? 'Loading…'
            : value
              ? hidden
                ? '••••••••••••••••••••••••••••••••'
                : value
              : 'Not available yet'}
        </div>
        {onToggle && value && (
          <button
            onClick={onToggle}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.70)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {hidden ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
        )}
        {onCopy && value && (
          <button
            onClick={onCopy}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.70)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Copy size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

function IntegrationCard({
  icon,
  title,
  eyebrow,
  children,
}: {
  icon: React.ReactNode
  title: string
  eyebrow: string
  children: React.ReactNode
}) {
  return (
    <div style={{ ...card, padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em' }}>{title}</div>
          <div style={{ fontSize: '12px', color: faintText }}>{eyebrow}</div>
        </div>
      </div>
      {children}
    </div>
  )
}

export default function ConnectionsPage() {
  const { toast } = useToast()

  const { data: hubspotRes, error: hubspotError, mutate: mutateHubspot } = useSWR('/api/integrations/hubspot/status', fetcher, {
    revalidateOnFocus: false,
  })
  const { data: slackRes, error: slackError, mutate: mutateSlack } = useSWR('/api/integrations/slack/status', fetcher, {
    revalidateOnFocus: false,
  })
  const { data: mcpKeyRes, error: mcpError, mutate: mutateMcpKey } = useSWR('/api/workspace/mcp-api-key', fetcher, {
    revalidateOnFocus: false,
  })

  const slackConnected: boolean | null = slackRes ? slackRes?.data?.connected === true : null
  const hubspotConnected: boolean | null = hubspotRes ? hubspotRes?.data?.connected === true : null
  const slackData = slackRes?.data
  const hubspotData = hubspotRes?.data
  const mcpApiKey: string | null = mcpKeyRes?.data?.mcpApiKey ?? null

  const connectionErrors = useMemo(
    () =>
      [
        slackError ? 'Slack status is unavailable.' : null,
        hubspotError ? 'CRM status is unavailable.' : null,
        mcpError ? 'MCP credentials are unavailable.' : null,
      ].filter(Boolean) as string[],
    [hubspotError, mcpError, slackError],
  )

  const [hubspotToken, setHubspotToken] = useState('')
  const [hubspotConnecting, setHubspotConnecting] = useState(false)
  const [hubspotSyncing, setHubspotSyncing] = useState(false)
  const [hubspotDisconnecting, setHubspotDisconnecting] = useState(false)
  const [slackDisconnecting, setSlackDisconnecting] = useState(false)
  const [showMcpKey, setShowMcpKey] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  async function copyToClipboard(text: string, label = 'Copied to clipboard') {
    try {
      await navigator.clipboard.writeText(text)
      toast(label, 'success')
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

  const slackTone = slackConnected === null ? (slackError ? 'partial' : 'loading') : slackConnected ? 'ready' : 'idle'
  const crmTone = hubspotConnected === null ? (hubspotError ? 'partial' : 'loading') : hubspotConnected ? 'ready' : 'idle'
  const mcpTone = mcpError ? 'partial' : mcpApiKey ? 'ready' : mcpKeyRes ? 'idle' : 'loading'

  return (
    <div style={{ maxWidth: '1120px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 960px) {
          .connections-hero,
          .connections-grid,
          .connections-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {connectionErrors.length > 0 && (
        <div
          style={{
            padding: '15px 18px',
            borderRadius: '18px',
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.18)',
            color: '#fde68a',
            fontSize: '12px',
            lineHeight: 1.7,
          }}
        >
          Some workspace health data is degraded right now. {connectionErrors.join(' ')}
        </div>
      )}

      <div className="connections-hero" style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '18px' }}>
        <div style={{ ...card, padding: '30px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '999px',
              background: 'rgba(139,92,246,0.10)',
              border: '1px solid rgba(139,92,246,0.16)',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: 'rgba(196,181,253,0.88)',
              textTransform: 'uppercase',
              marginBottom: '18px',
            }}
          >
            <Sparkles size={12} />
            Workspace setup
          </div>

          <h1 style={{ fontSize: '36px', lineHeight: 1.02, letterSpacing: '-0.05em', fontWeight: 800, color: 'rgba(255,255,255,0.96)', margin: '0 0 12px' }}>
            Keep Halvex focused on deal intelligence.
          </h1>
          <p style={{ fontSize: '15px', color: mutedText, lineHeight: 1.8, margin: '0 0 22px', maxWidth: '680px' }}>
            Halvex should own revenue context, operating rhythm, and visibility. Claude does the cross-tool review outside the product, then writes confirmed issue context back into the right deals through Halvex MCP.
          </p>

          <div style={{ display: 'grid', gap: '14px' }}>
            <StepItem
              step="1"
              title="Bring your team conversations into Halvex"
              body="Connect Slack so reps can stay close to alerts, follow-ups, and the questions they ask every day."
            />
            <StepItem
              step="2"
              title="Keep CRM data current"
              body="Sync your CRM so Halvex reflects the real pipeline, active notes, and current deal values instead of stale exports."
            />
            <StepItem
              step="3"
              title="Add Halvex MCP to Claude once"
              body="Claude should already have the product context it needs on your side. Halvex only needs to expose the deal intelligence layer."
            />
            <StepItem
              step="4"
              title="Run the same Claude review every day"
              body="Ask Claude to review the pipeline, inspect the product work externally, and save the blockers that matter back into the relevant deals."
            />
          </div>
        </div>

        <div style={{ ...card, padding: '30px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(191,219,254,0.84)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
            Workspace readiness
          </div>
          <div style={{ fontSize: '24px', lineHeight: 1.1, fontWeight: 800, color: 'rgba(255,255,255,0.96)', letterSpacing: '-0.04em', marginBottom: '12px' }}>
            One clean operating rhythm
          </div>
          <p style={{ fontSize: '14px', color: mutedText, lineHeight: 1.8, margin: '0 0 18px' }}>
            The product should feel calm: live CRM data, a working Slack surface, and a single Claude workflow that enriches deals instead of asking reps to babysit issue matching.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
            <StatusPill label={slackConnected ? 'Slack live' : slackConnected === null ? 'Slack loading' : 'Slack optional'} tone={slackTone} />
            <StatusPill label={hubspotConnected ? 'CRM live' : hubspotConnected === null ? 'CRM loading' : 'CRM needed'} tone={crmTone} />
            <StatusPill label={mcpApiKey ? 'MCP ready' : mcpKeyRes ? 'MCP setup needed' : 'MCP loading'} tone={mcpTone} />
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {[
              'No Halvex-owned issue matching in the primary workflow',
              'Claude reviews externally and writes back only the deal-relevant context',
              'Halvex stays responsible for revenue intelligence, workflow, and shipped outcomes',
            ].map(item => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  padding: '12px 14px',
                  borderRadius: '18px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.80)',
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
              color: 'rgba(255,255,255,0.92)',
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

      <div style={{ ...card, padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.24), rgba(99,102,241,0.18))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.92)',
                flexShrink: 0,
                border: '1px solid rgba(139,92,246,0.22)',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'rgba(255,255,255,0.96)', letterSpacing: '-0.03em', margin: 0 }}>
                  Halvex MCP
                </h2>
                <StatusPill label={mcpApiKey ? 'Workspace ready' : 'Needs setup'} tone={mcpApiKey ? 'ready' : 'idle'} />
              </div>
              <p style={{ fontSize: '14px', color: mutedText, lineHeight: 1.7, margin: 0, maxWidth: '640px' }}>
                Add this endpoint and workspace key to Claude once. After that, the whole workflow becomes a single daily prompt instead of another admin surface reps have to maintain.
              </p>
            </div>
          </div>
          <button
            onClick={regenerateMcpKey}
            disabled={regenerating}
            style={{
              height: '40px',
              padding: '0 14px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.88)',
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

        <div className="connections-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '16px' }}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <SecretField
              label="MCP endpoint"
              value="https://halvex.ai/api/mcp"
              onCopy={() => copyToClipboard('https://halvex.ai/api/mcp', 'Endpoint copied')}
            />
            <SecretField
              label="API key"
              value={mcpApiKey}
              hidden={!showMcpKey}
              loading={!mcpKeyRes && !mcpError}
              onToggle={mcpApiKey ? () => setShowMcpKey(v => !v) : undefined}
              onCopy={mcpApiKey ? () => copyToClipboard(mcpApiKey, 'MCP key copied') : undefined}
            />
          </div>

          <div
            style={{
              padding: '18px',
              borderRadius: '22px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(139,92,246,0.06) 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 800, color: faintText, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
              Daily Claude prompt
            </div>
            <div style={{ fontSize: '14px', lineHeight: 1.8, color: 'rgba(255,255,255,0.88)' }}>
              “{DAILY_PROMPT}”
            </div>
            <div style={{ marginTop: '14px', fontSize: '12px', lineHeight: 1.7, color: mutedText }}>
              Halvex stores the resulting deal context, linked blockers, and shipped outcomes. Claude remains the cross-tool reviewer.
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
              <button
                onClick={() => copyToClipboard(DAILY_PROMPT, 'Claude prompt copied')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '40px',
                  padding: '0 14px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.92)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Copy size={13} />
                Copy prompt
              </button>
              <Link
                href="/dashboard"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '40px',
                  padding: '0 14px',
                  borderRadius: '999px',
                  background: 'rgba(139,92,246,0.16)',
                  border: '1px solid rgba(139,92,246,0.22)',
                  color: 'rgba(255,255,255,0.94)',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                Open dashboard
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="connections-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '18px' }}>
        <IntegrationCard
          icon={<MessageSquare size={18} color="#93c5fd" />}
          title="Slack"
          eyebrow="Rep-facing workspace"
        >
          <p style={{ fontSize: '13px', color: mutedText, lineHeight: 1.7, margin: '0 0 16px' }}>
            Keep alerts, prompts, and follow-ups where the team already works. Slack is optional, but it makes Halvex feel much more alive day to day.
          </p>
          {slackConnected ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.76)', lineHeight: 1.7 }}>
                Connected to <strong>{slackData?.slackTeamName ?? 'your workspace'}</strong>
              </div>
              <button
                onClick={handleSlackDisconnect}
                disabled={slackDisconnecting}
                style={{
                  height: '40px',
                  borderRadius: '14px',
                  border: '1px solid rgba(239,68,68,0.18)',
                  background: 'rgba(239,68,68,0.10)',
                  color: '#fecaca',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: slackDisconnecting ? 'not-allowed' : 'pointer',
                  opacity: slackDisconnecting ? 0.7 : 1,
                }}
              >
                {slackDisconnecting ? 'Disconnecting…' : 'Disconnect Slack'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: mutedText, lineHeight: 1.7 }}>
                {slackError ? 'Slack status is unavailable right now.' : 'No Slack workspace connected yet.'}
              </div>
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
                  background: 'rgba(139,92,246,0.18)',
                  border: '1px solid rgba(139,92,246,0.22)',
                  color: 'rgba(255,255,255,0.94)',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                <MessageSquare size={14} />
                Connect Slack
              </a>
            </div>
          )}
        </IntegrationCard>

        <IntegrationCard
          icon={<Database size={18} color="#fdba74" />}
          title="CRM sync"
          eyebrow="Pipeline source of truth"
        >
          <p style={{ fontSize: '13px', color: mutedText, lineHeight: 1.7, margin: '0 0 16px' }}>
            Keep revenue context fresh so Claude reviews the live pipeline, not screenshots or stale exports.
          </p>
          {hubspotConnected ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.76)', lineHeight: 1.7 }}>
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
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.88)',
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
                  {hubspotSyncing ? 'Syncing…' : 'Sync deals'}
                </button>
                <button
                  onClick={handleHubspotDisconnect}
                  disabled={hubspotDisconnecting}
                  style={{
                    height: '40px',
                    padding: '0 14px',
                    borderRadius: '14px',
                    border: '1px solid rgba(239,68,68,0.18)',
                    background: 'rgba(239,68,68,0.10)',
                    color: '#fecaca',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: hubspotDisconnecting ? 'not-allowed' : 'pointer',
                    opacity: hubspotDisconnecting ? 0.7 : 1,
                  }}
                >
                  {hubspotDisconnecting ? 'Disconnecting…' : 'Disconnect'}
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
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.92)',
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
                  border: '1px solid rgba(139,92,246,0.22)',
                  background: 'rgba(139,92,246,0.18)',
                  color: 'rgba(255,255,255,0.94)',
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
                {hubspotConnecting ? 'Connecting…' : 'Connect CRM'}
              </button>
            </form>
          )}
        </IntegrationCard>

        <IntegrationCard
          icon={<Workflow size={18} color="#c4b5fd" />}
          title="Claude review"
          eyebrow="Daily operator workflow"
        >
          <p style={{ fontSize: '13px', color: mutedText, lineHeight: 1.7, margin: '0 0 16px' }}>
            Claude already owns the cross-tool reasoning. Halvex only needs to make the pipeline legible and accept the linked issue context Claude saves back.
          </p>
          <div
            style={{
              padding: '14px',
              borderRadius: '18px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: '12px',
              color: mutedText,
              lineHeight: 1.7,
            }}
          >
            Recommended daily prompt:
            <div style={{ marginTop: '8px', color: 'rgba(255,255,255,0.92)', fontWeight: 600 }}>
              {DAILY_PROMPT}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
            <button
              onClick={() => copyToClipboard(DAILY_PROMPT, 'Claude prompt copied')}
              style={{
                height: '40px',
                padding: '0 14px',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.92)',
                fontSize: '12px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <Copy size={13} />
              Copy prompt
            </button>
            <Link
              href="/workflows"
              style={{
                height: '40px',
                padding: '0 14px',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.82)',
                fontSize: '12px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
              }}
            >
              Review outcomes
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </IntegrationCard>
      </div>
    </div>
  )
}
