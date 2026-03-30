'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Sparkles,
} from 'lucide-react'

type Step = 'slack' | 'claude' | 'deal' | 'results'

const STAGE_OPTIONS = [
  { value: 'prospecting', label: 'Prospecting', score: 15 },
  { value: 'qualification', label: 'Qualification', score: 30 },
  { value: 'discovery', label: 'Discovery', score: 45 },
  { value: 'proposal', label: 'Proposal', score: 65 },
  { value: 'negotiation', label: 'Negotiation', score: 80 },
]

interface DiscoveredIssue {
  linearIssueId: string
  linearTitle: string | null
  linearIssueUrl: string | null
  relevanceScore: number
  linkType: string
  addressesRisk: string | null
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof json?.error === 'string' ? json.error : 'Request failed')
  }
  return json
}

function OnboardingInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialStep = parseInt(searchParams.get('step') ?? '1', 10)
  const stepMap: Record<number, Step> = { 1: 'slack', 2: 'claude', 3: 'deal', 4: 'results' }
  const initialStepValue = stepMap[isNaN(initialStep) ? 1 : Math.min(Math.max(initialStep, 1), 4)] ?? 'slack'

  const [step, setStep] = useState<Step>(initialStepValue)
  const [initializing, setInitializing] = useState(true)

  const [slackConnected, setSlackConnected] = useState(false)
  const [slackTeamName, setSlackTeamName] = useState<string | null>(null)

  const [mcpApiKey, setMcpApiKey] = useState<string | null>(null)
  const [mcpLoading, setMcpLoading] = useState(false)
  const [mcpError, setMcpError] = useState<string | null>(null)
  const [showMcpKey, setShowMcpKey] = useState(false)
  const [copied, setCopied] = useState<'endpoint' | 'key' | 'prompt' | null>(null)

  const [company, setCompany] = useState('')
  const [dealValue, setDealValue] = useState('')
  const [stage, setStage] = useState('discovery')
  const [waitingFor, setWaitingFor] = useState('')
  const [dealSaving, setDealSaving] = useState(false)

  const [dealScore, setDealScore] = useState<number | null>(null)
  const [discoveredIssues, setDiscoveredIssues] = useState<DiscoveredIssue[]>([])
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [savedDealId, setSavedDealId] = useState<string | null>(null)
  const [dealError, setDealError] = useState<string | null>(null)
  const [resultWarnings, setResultWarnings] = useState<string[]>([])
  const [reviewPrompt, setReviewPrompt] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const slackParam = searchParams.get('slack')

      if (slackParam === 'connected') {
        setSlackConnected(true)
        fetch('/api/integrations/slack/status')
          .then(r => r.json())
          .then(d => {
            if (d.data?.slackTeamName) setSlackTeamName(d.data.slackTeamName)
          })
          .catch(() => {})
        setInitializing(false)
        setTimeout(() => setStep('claude'), 1200)
        return
      }

      const slackRes = await fetchJson('/api/integrations/slack/status').catch(() => null)
      if (slackRes?.data?.connected) {
        setSlackConnected(true)
        setSlackTeamName(slackRes.data.slackTeamName ?? null)
        setStep(initialStepValue === 'slack' ? 'claude' : initialStepValue)
      }

      setInitializing(false)
    }

    init()
  }, [initialStepValue, searchParams])

  useEffect(() => {
    if (step !== 'claude' || mcpApiKey || mcpLoading) return

    async function loadMcp() {
      setMcpLoading(true)
      setMcpError(null)
      try {
        const data = await fetchJson('/api/workspace/mcp-api-key')
        setMcpApiKey(data.data?.mcpApiKey ?? null)
      } catch (err) {
        setMcpError(err instanceof Error ? err.message : 'Could not load MCP credentials.')
      } finally {
        setMcpLoading(false)
      }
    }

    loadMcp()
  }, [mcpApiKey, mcpLoading, step])

  async function copy(text: string, type: 'endpoint' | 'key' | 'prompt') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(prev => (prev === type ? null : prev)), 1800)
    } catch {
      setCopied(null)
    }
  }

  async function handleDealSave() {
    if (!company.trim() || dealSaving) return
    setDealError(null)
    setResultWarnings([])
    setReviewPrompt(null)
    setDealSaving(true)
    try {
      const data = await fetchJson('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealName: `${company.trim()} — New deal`,
          prospectCompany: company.trim(),
          dealValue: dealValue !== '' ? Number(dealValue.replace(/[^0-9.]/g, '')) : null,
          stage,
        }),
      })

      const dealId = data.data?.id
      setSavedDealId(dealId)

      const stageObj = STAGE_OPTIONS.find(s => s.value === stage)
      setDealScore(stageObj?.score ?? 40)

      setStep('results')
      setDiscoverLoading(true)

      const warnings: string[] = []

      if (dealId && waitingFor.trim()) {
        try {
          await fetchJson(`/api/deals/${dealId}/meeting-notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: waitingFor.trim() }),
          })
        } catch (err) {
          warnings.push(err instanceof Error ? `Deal notes could not be processed yet: ${err.message}` : 'Deal notes could not be processed yet.')
        }
      }

      if (dealId) {
        try {
          const result = await fetchJson(`/api/deals/${dealId}/discover-issues`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
          setDiscoveredIssues(Array.isArray(result.data?.links) ? result.data.links : [])
          setReviewPrompt(typeof result.data?.reviewPrompt === 'string' ? result.data.reviewPrompt : null)
        } catch (err) {
          warnings.push(err instanceof Error ? `Claude review context could not be prepared yet: ${err.message}` : 'Claude review context could not be prepared yet.')
        }
      }

      setResultWarnings(warnings)
    } catch (err) {
      setDealError(err instanceof Error ? err.message : 'Could not save the deal.')
    } finally {
      setDealSaving(false)
      setDiscoverLoading(false)
    }
  }

  const card: React.CSSProperties = {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(248,250,255,0.60) 100%)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.72)',
    borderRadius: '28px',
    padding: '26px',
    boxShadow: '0 20px 60px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.7)',
  }

  const input: React.CSSProperties = {
    width: '100%',
    height: '46px',
    padding: '0 14px',
    background: '#fff',
    border: '1px solid rgba(148,163,184,0.18)',
    borderRadius: '14px',
    color: '#0f172a',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  const focusBorder = 'rgba(99,102,241,0.35)'

  const primaryBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '13px 16px',
    borderRadius: '16px',
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.88))',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 700,
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
    textDecoration: 'none',
  }

  const secondaryBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '13px 16px',
    borderRadius: '16px',
    border: '1px solid rgba(148,163,184,0.16)',
    cursor: 'pointer',
    background: '#fff',
    color: '#0f172a',
    fontSize: '14px',
    fontWeight: 700,
    fontFamily: 'inherit',
    textDecoration: 'none',
  }

  const disabledBtn: React.CSSProperties = {
    ...primaryBtn,
    background: 'rgba(148,163,184,0.18)',
    color: 'rgba(15,23,42,0.35)',
    cursor: 'not-allowed',
  }

  const stepLabels = ['Slack', 'Claude MCP', 'First deal']
  const stepIndex: Record<Step, number> = { slack: 1, claude: 2, deal: 3, results: 3 }
  const currentStepNum = stepIndex[step]

  const stageLabel = useMemo(
    () => STAGE_OPTIONS.find(s => s.value === stage)?.label ?? stage,
    [stage],
  )

  const endpoint = 'https://halvex.ai/api/mcp'

  function SuccessBadge({ text }: { text: string }) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.16)',
          borderRadius: '14px',
          fontSize: '13px',
          color: '#047857',
          fontWeight: 600,
        }}
      >
        <CheckCircle size={15} />
        {text}
      </div>
    )
  }

  function FeatureList({ items }: { items: string[] }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map(text => (
          <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '999px', background: 'rgba(15,23,42,0.72)', marginTop: '7px', flexShrink: 0 }} />
            {text}
          </div>
        ))}
      </div>
    )
  }

  if (initializing) return null

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px', paddingTop: '8px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {step !== 'results' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0' }}>
          {stepLabels.map((label, i) => {
            const num = i + 1
            const active = num === currentStepNum
            const done = num < currentStepNum
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '999px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      flexShrink: 0,
                      background: done ? 'rgba(15,23,42,0.90)' : active ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.40)',
                      border: done ? '1px solid rgba(15,23,42,0.92)' : '1px solid rgba(255,255,255,0.8)',
                      color: done ? '#fff' : active ? '#0f172a' : '#64748b',
                    }}
                  >
                    {done ? '✓' : num}
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: active ? 700 : 500, color: active ? '#0f172a' : done ? '#334155' : '#64748b' }}>
                    {label}
                  </span>
                </div>
                {i < stepLabels.length - 1 && <div style={{ width: '28px', height: '1px', background: 'rgba(148,163,184,0.26)', margin: '0 10px' }} />}
              </div>
            )
          })}
        </div>
      )}

      {step === 'slack' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '58px', height: '58px', borderRadius: '20px', background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 14px 30px rgba(15,23,42,0.08)' }}>
              <MessageSquare size={24} color="#0f172a" />
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.05em', color: '#0f172a', marginBottom: '10px' }}>
              Connect Slack
            </h1>
            <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.75, maxWidth: '460px', margin: '0 auto' }}>
              Give reps one place to ask questions, receive alerts, and act on deal intelligence without leaving their normal workflow.
            </p>
          </div>

          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {slackConnected ? (
              <>
                <SuccessBadge text={slackTeamName ? `Connected to ${slackTeamName}` : 'Slack connected'} />
                <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                  Your workspace is ready for deal updates, rep alerts, and Ask AI conversations in Slack.
                </div>
              </>
            ) : (
              <>
                <FeatureList
                  items={[
                    'Ask “what is blocking this deal?” without opening another tool',
                    'Notify the team when linked blockers ship and a deal can move again',
                    'Keep follow-ups, updates, and approvals closer to the reps doing the work',
                  ]}
                />
                <a href="/api/integrations/slack/install?returnTo=/onboarding" style={primaryBtn}>
                  <MessageSquare size={15} />
                  Connect Slack
                </a>
              </>
            )}
          </div>

          {slackConnected && (
            <button onClick={() => setStep('claude')} style={primaryBtn}>
              Continue
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      )}

      {step === 'claude' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '58px', height: '58px', borderRadius: '20px', background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 14px 30px rgba(15,23,42,0.08)' }}>
              <Sparkles size={24} color="#0f172a" />
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.05em', color: '#0f172a', marginBottom: '10px' }}>
              Add Halvex to Claude
            </h1>
            <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.75, maxWidth: '500px', margin: '0 auto' }}>
              Claude should already have your product and issue context on its side. Halvex only needs to expose deal intelligence through MCP so Claude can review your pipeline and save linked blockers back into the CRM.
            </p>
          </div>

          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FeatureList
              items={[
                'Claude reads Halvex deal context through MCP',
                'Claude reviews product work externally from its own connected tools',
                'Halvex stores the links, revenue context, and shipped outcomes',
              ]}
            />

            {mcpError && (
              <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '14px', fontSize: '12px', color: '#b91c1c', lineHeight: 1.6 }}>
                {mcpError}
              </div>
            )}

            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ padding: '14px 16px', borderRadius: '18px', background: '#fff', border: '1px solid rgba(148,163,184,0.16)' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Endpoint
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {endpoint}
                  </div>
                  <button onClick={() => copy(endpoint, 'endpoint')} style={{ width: '36px', height: '36px', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.16)', background: '#fff', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Copy size={13} />
                  </button>
                </div>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: '18px', background: '#fff', border: '1px solid rgba(148,163,184,0.16)' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Workspace key
                </div>
                {mcpLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    Preparing key...
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mcpApiKey ? (showMcpKey ? mcpApiKey : '••••••••••••••••••••••••••••••••') : 'Unable to generate a key yet'}
                    </div>
                    <button onClick={() => setShowMcpKey(v => !v)} style={{ width: '36px', height: '36px', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.16)', background: '#fff', color: '#334155', cursor: 'pointer' }}>
                      {showMcpKey ? 'Hide' : 'Show'}
                    </button>
                    {mcpApiKey && (
                      <button onClick={() => copy(mcpApiKey, 'key')} style={{ width: '36px', height: '36px', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.16)', background: '#fff', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Copy size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '16px 18px', borderRadius: '20px', background: 'linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.90) 100%)', color: '#e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(191,219,254,0.88)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Daily Claude prompt
              </div>
              <div style={{ fontSize: '13px', lineHeight: 1.8 }}>
                “Check my Halvex pipeline, review my product work, and save any relevant issue links back into the right deals.”
              </div>
            </div>

            {(copied || mcpApiKey) && (
              <div style={{ fontSize: '12px', color: copied ? '#0f766e' : '#475569', lineHeight: 1.6 }}>
                {copied === 'endpoint' && 'Endpoint copied.'}
                {copied === 'key' && 'Key copied.'}
                {copied === 'prompt' && 'Prompt copied.'}
                {!copied && 'Paste the endpoint and key into Claude, then continue once it is set up.'}
              </div>
            )}
          </div>

          <button onClick={() => setStep('deal')} style={primaryBtn}>
            I’ve added this to Claude
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {step === 'deal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.05em', color: '#0f172a', marginBottom: '10px' }}>
              Add your first deal
            </h1>
            <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.75, maxWidth: '500px', margin: '0 auto' }}>
              Start with a real revenue opportunity. Halvex will store the commercial context, and Claude will use that context later when linking the right product blockers back into the deal.
            </p>
          </div>

          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {dealError && (
              <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '14px', fontSize: '12px', color: '#b91c1c', lineHeight: 1.6 }}>
                {dealError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Company name *
              </label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDealSave()}
                placeholder="e.g. Acme Corp"
                autoFocus
                style={input}
                onFocus={e => (e.target.style.borderColor = focusBorder)}
                onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,0.18)')}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Deal value
                </label>
                <input
                  type="text"
                  value={dealValue}
                  onChange={e => setDealValue(e.target.value)}
                  placeholder="e.g. 50000"
                  style={input}
                  onFocus={e => (e.target.style.borderColor = focusBorder)}
                  onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,0.18)')}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Stage
                </label>
                <select value={stage} onChange={e => setStage(e.target.value)} style={{ ...input, cursor: 'pointer' }}>
                  {STAGE_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                What are they waiting for?
              </label>
              <textarea
                value={waitingFor}
                onChange={e => setWaitingFor(e.target.value)}
                placeholder="e.g. Security review is blocked on SSO. Procurement wants a rollout plan. Their team needs a native API before they can buy."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#fff',
                  border: '1px solid rgba(148,163,184,0.18)',
                  borderRadius: '16px',
                  color: '#0f172a',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  minHeight: '92px',
                  transition: 'border-color 0.15s',
                  lineHeight: 1.6,
                }}
                onFocus={e => (e.target.style.borderColor = focusBorder)}
                onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,0.18)')}
              />
              <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
                This becomes the operating context Claude uses when it reviews the deal and decides which product issues genuinely matter.
              </div>
            </div>

            <button onClick={handleDealSave} disabled={!company.trim() || dealSaving} style={!company.trim() ? disabledBtn : { ...primaryBtn, cursor: dealSaving ? 'not-allowed' : 'pointer', opacity: dealSaving ? 0.8 : 1 }}>
              {dealSaving ? (
                <>
                  <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  Saving deal...
                </>
              ) : (
                <>
                  Save deal and prep Claude review
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {step === 'results' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.05em', color: '#0f172a', marginBottom: '10px' }}>
              {discoverLoading
                ? 'Preparing your deal workspace...'
                : discoveredIssues.length > 0
                  ? `Saved ${discoveredIssues.length} issue link${discoveredIssues.length === 1 ? '' : 's'} for ${company}`
                  : resultWarnings.length > 0
                    ? `Deal saved with follow-up needed for ${company}`
                    : `Deal saved for ${company}`}
            </h1>
            {!discoverLoading && (
              <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.75, maxWidth: '500px', margin: '0 auto' }}>
                {discoveredIssues.length > 0
                  ? 'Claude has already saved relevant issue links back into Halvex. You can review and confirm them from the deal.'
                  : resultWarnings.length > 0
                    ? 'The deal is saved, but one part of the AI-ready setup still needs attention.'
                    : 'Your deal is ready. The next move is to ask Claude to review the pipeline and save any relevant issue links back into Halvex.'}
              </p>
            )}
          </div>

          {dealScore != null && (
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 22px' }}>
              <div style={{ width: '54px', height: '54px', borderRadius: '18px', background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.88))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800, flexShrink: 0 }}>
                {dealScore}
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  Initial deal score
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Based on the {stageLabel} stage heuristic
                </div>
              </div>
            </div>
          )}

          {discoverLoading && (
            <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '34px', color: '#475569', fontSize: '13px' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Preparing Claude review context...
            </div>
          )}

          {!discoverLoading && resultWarnings.length > 0 && (
            <div style={{ ...card, padding: '16px 18px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', color: '#92400e', fontSize: '12px', lineHeight: 1.7 }}>
              {resultWarnings.map((warning, index) => (
                <div key={`${warning}-${index}`}>{warning}</div>
              ))}
            </div>
          )}

          {!discoverLoading && discoveredIssues.length > 0 && (
            <div style={{ ...card, padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148,163,184,0.14)', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Saved issue links
              </div>
              {discoveredIssues.slice(0, 5).map((issue, i) => (
                <div key={issue.linearIssueId} style={{ padding: '16px 20px', borderBottom: i < Math.min(discoveredIssues.length, 5) - 1 ? '1px solid rgba(148,163,184,0.12)' : 'none', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', padding: '4px 8px', background: 'rgba(15,23,42,0.06)', borderRadius: '999px', flexShrink: 0, marginTop: '1px' }}>
                    {issue.linearIssueId}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 700, lineHeight: 1.45 }}>
                      {issue.linearTitle ?? issue.linearIssueId}
                    </div>
                    {issue.addressesRisk && (
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', lineHeight: 1.5 }}>
                        Addresses: {issue.addressesRisk}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', flexShrink: 0, marginTop: '2px' }}>
                    {issue.relevanceScore}%
                  </div>
                </div>
              ))}
            </div>
          )}

          {!discoverLoading && discoveredIssues.length === 0 && (
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px 22px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                No saved issue links yet
              </div>
              <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.75 }}>
                That is expected for a new workspace. Ask Claude to review this deal through Halvex MCP and it can save the high-confidence blockers back here.
              </div>
              {reviewPrompt && (
                <div style={{ padding: '14px 16px', borderRadius: '18px', background: 'linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.90) 100%)', color: '#e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(191,219,254,0.88)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Suggested Claude prompt
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: 1.8 }}>
                    {reviewPrompt}
                  </div>
                </div>
              )}
            </div>
          )}

          {!discoverLoading && reviewPrompt && (
            <button onClick={() => copy(reviewPrompt, 'prompt')} style={secondaryBtn}>
              <Copy size={15} />
              {copied === 'prompt' ? 'Prompt copied' : 'Copy Claude prompt'}
            </button>
          )}

          {!discoverLoading && savedDealId && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={() => router.push(`/deals/${savedDealId}`)} style={{ ...primaryBtn, flex: '1 1 240px' }}>
                <ExternalLink size={15} />
                Open deal
              </button>
              <button onClick={() => router.push('/connections')} style={{ ...secondaryBtn, flex: '1 1 240px' }}>
                <Sparkles size={15} />
                Open setup
              </button>
            </div>
          )}

          {!discoverLoading && (
            <div style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={16} color="#334155" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.7 }}>
                Automation works best when reps keep deals updated and Claude is prompted daily to review the pipeline for newly blocking product work.
              </div>
            </div>
          )}

          {!discoverLoading && (
            <button onClick={() => router.push('/')} style={primaryBtn}>
              Go to dashboard
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  )
}
