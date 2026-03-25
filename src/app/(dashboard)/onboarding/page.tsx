'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, CheckCircle, Loader2, MessageSquare, Database, ExternalLink } from 'lucide-react'

type Step = 'slack' | 'linear' | 'deal' | 'results'

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

function OnboardingInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialStep = parseInt(searchParams.get('step') ?? '1', 10)
  const stepMap: Record<number, Step> = { 1: 'slack', 2: 'linear', 3: 'deal', 4: 'results' }
  const initialStepValue = stepMap[isNaN(initialStep) ? 1 : Math.min(Math.max(initialStep, 1), 4)] ?? 'slack'

  const [step, setStep] = useState<Step>(initialStepValue)
  const [initializing, setInitializing] = useState(true)

  // Slack state
  const [slackConnected, setSlackConnected] = useState(false)
  const [slackTeamName, setSlackTeamName] = useState<string | null>(null)

  // Linear state
  const [linearConnected, setLinearConnected] = useState(false)
  const [linearTeamName, setLinearTeamName] = useState<string | null>(null)
  const [linearSyncing, setLinearSyncing] = useState(false)
  const [linearIssueCount, setLinearIssueCount] = useState<number | null>(null)
  const [linearError, setLinearError] = useState<string | null>(null)
  const [linearConnecting, setLinearConnecting] = useState(false)

  // Deal state
  const [company, setCompany] = useState('')
  const [dealValue, setDealValue] = useState('')
  const [stage, setStage] = useState('discovery')
  const [waitingFor, setWaitingFor] = useState('')
  const [dealSaving, setDealSaving] = useState(false)

  // Results state (aha moment)
  const [dealScore, setDealScore] = useState<number | null>(null)
  const [discoveredIssues, setDiscoveredIssues] = useState<DiscoveredIssue[]>([])
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [savedDealId, setSavedDealId] = useState<string | null>(null)

  // Single init effect -- handles OAuth redirects and status pre-checks
  useEffect(() => {
    async function init() {
      const slackParam = searchParams.get('slack')
      const linearParam = searchParams.get('linear')

      if (slackParam === 'connected') {
        setSlackConnected(true)
        fetch('/api/integrations/slack/status')
          .then(r => r.json())
          .then(d => { if (d.data?.slackTeamName) setSlackTeamName(d.data.slackTeamName) })
          .catch(() => {})
        setInitializing(false)
        setTimeout(() => setStep('linear'), 1500)
        return
      }

      if (linearParam === 'connected') {
        setLinearConnected(true)
        setLinearSyncing(true)
        Promise.all([
          fetch('/api/integrations/slack/status').then(r => r.json()).catch(() => null),
          fetch('/api/integrations/linear/status').then(r => r.json()).catch(() => null),
        ]).then(([slackData, linearData]) => {
          if (slackData?.data?.connected) {
            setSlackConnected(true)
            setSlackTeamName(slackData.data.slackTeamName ?? null)
          }
          if (linearData?.data?.teamName) setLinearTeamName(linearData.data.teamName)
          if (linearData?.data?.issueCount != null) setLinearIssueCount(linearData.data.issueCount)
        })
        setInitializing(false)
        setTimeout(() => { setLinearSyncing(false); setStep('deal') }, 2500)
        return
      }

      // No OAuth params -- check existing connections (resuming onboarding)
      const [slackRes, linearRes] = await Promise.allSettled([
        fetch('/api/integrations/slack/status').then(r => r.json()),
        fetch('/api/integrations/linear/status').then(r => r.json()),
      ])

      let hasSlack = false
      let hasLinear = false

      if (slackRes.status === 'fulfilled' && slackRes.value?.data?.connected) {
        hasSlack = true
        setSlackConnected(true)
        setSlackTeamName(slackRes.value.data.slackTeamName ?? null)
      }
      if (linearRes.status === 'fulfilled' && linearRes.value?.data?.connected) {
        hasLinear = true
        setLinearConnected(true)
        setLinearTeamName(linearRes.value.data.teamName ?? null)
        if (linearRes.value.data.issueCount != null) setLinearIssueCount(linearRes.value.data.issueCount)
      }

      if (hasSlack && hasLinear) setStep('deal')
      else if (hasSlack) setStep('linear')

      setInitializing(false)
    }

    init()
  }, [searchParams])

  async function handleLinearConnect() {
    setLinearError(null)
    setLinearConnecting(true)
    const url = '/api/integrations/linear/install?returnTo=/onboarding'
    try {
      const res = await fetch(url, { redirect: 'manual' })
      if (res.type === 'opaqueredirect' || res.status === 0) {
        window.location.href = url
        return
      }
      const data = await res.json().catch(() => ({}))
      if (data.error) {
        setLinearError(data.error)
        setLinearConnecting(false)
        return
      }
      window.location.href = url
    } catch {
      window.location.href = url
    }
  }

  async function handleDealSave() {
    if (!company.trim() || dealSaving) return
    setDealSaving(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealName: `${company.trim()} — New deal`,
          prospectCompany: company.trim(),
          dealValue: dealValue ? Number(dealValue.replace(/[^0-9.]/g, '')) : null,
          stage,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save deal')

      const dealId = data.data?.id
      setSavedDealId(dealId)

      // Compute score from stage heuristic
      const stageObj = STAGE_OPTIONS.find(s => s.value === stage)
      setDealScore(stageObj?.score ?? 40)

      // Move to results view immediately
      setStep('results')
      setDiscoverLoading(true)

      // Fire both requests in parallel
      const promises: Promise<unknown>[] = []

      // 1. Meeting notes (gap analysis + Slack DM trigger)
      if (dealId && waitingFor.trim()) {
        promises.push(
          fetch(`/api/deals/${dealId}/meeting-notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: waitingFor.trim() }),
          }).catch(() => {})
        )
      }

      // 2. Discover matching Linear issues
      if (dealId) {
        promises.push(
          fetch(`/api/deals/${dealId}/discover-issues`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
            .then(r => r.json())
            .then(result => {
              if (result.data?.links) {
                setDiscoveredIssues(result.data.links)
              }
            })
            .catch(() => {})
        )
      }

      await Promise.allSettled(promises)
      setDiscoverLoading(false)
    } catch {
      setDealSaving(false)
    }
  }

  // ── Shared styles ──────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '14px',
    padding: '24px',
  }

  const input: React.CSSProperties = {
    width: '100%',
    height: '40px',
    padding: '0 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  const focusBorder = 'rgba(255,255,255,0.28)'

  const primaryBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.90)',
    color: '#0a0b0f',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
    textDecoration: 'none',
  }

  const disabledBtn: React.CSSProperties = {
    ...primaryBtn,
    background: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.35)',
    cursor: 'not-allowed',
  }

  const stepLabels = ['Connect Slack', 'Connect Linear', 'Add first deal']
  const stepIndex: Record<Step, number> = { slack: 1, linear: 2, deal: 3, results: 3 }
  const currentStepNum = stepIndex[step]

  function SuccessBadge({ text }: { text: string }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 14px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '8px',
        fontSize: '13px', color: 'rgba(255,255,255,0.80)', fontWeight: 500,
      }}>
        <CheckCircle size={14} style={{ color: 'rgba(255,255,255,0.60)' }} /> {text}
      </div>
    )
  }

  function FeatureList({ items }: { items: string[] }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map(text => (
          <div key={text} style={{
            display: 'flex', alignItems: 'flex-start', gap: '8px',
            fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.40)', marginTop: '1px', flexShrink: 0 }}>-</span>
            {text}
          </div>
        ))}
      </div>
    )
  }

  if (initializing) return null

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingTop: '8px' }}>

      {/* Progress indicator — white dots + lines */}
      {step !== 'results' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0' }}>
          {stepLabels.map((label, i) => {
            const num = i + 1
            const active = num === currentStepNum
            const done = num < currentStepNum
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700, flexShrink: 0,
                    background: done ? 'rgba(255,255,255,0.15)' : active ? 'rgba(255,255,255,0.12)' : 'transparent',
                    border: done ? '1px solid rgba(255,255,255,0.30)' : active ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.10)',
                    color: done ? 'rgba(255,255,255,0.80)' : active ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.25)',
                  }}>
                    {done ? '\u2713' : num}
                  </div>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: active ? 500 : 400,
                    color: active ? 'rgba(255,255,255,0.90)' : done ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)',
                  }}>
                    {label}
                  </span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div style={{ width: '24px', height: '1px', background: 'rgba(255,255,255,0.10)', margin: '0 8px' }} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Step 1: Connect Slack ──────────────────────────────────────────── */}
      {step === 'slack' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <MessageSquare size={22} color="rgba(255,255,255,0.70)" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Connect Slack
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto' }}>
              Halvex works in Slack. Ask about deals, get notified when issues ship, and close loops without leaving your workflow.
            </p>
          </div>

          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {slackConnected ? (
              <>
                <SuccessBadge text={slackTeamName ? `Connected to ${slackTeamName}` : 'Slack connected'} />
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  Check your Slack DMs -- Halvex just said hello.
                </div>
              </>
            ) : (
              <>
                <FeatureList items={[
                  'Get notified the moment your product ships a fix',
                  'Ask "what\'s the status on Acme?" in DM',
                  'Approve feature prioritization without a meeting',
                ]} />
                <a
                  href="/api/integrations/slack/install?returnTo=/onboarding"
                  style={primaryBtn}
                >
                  <MessageSquare size={14} /> Connect Slack
                </a>
              </>
            )}
          </div>

          {slackConnected && (
            <button onClick={() => setStep('linear')} style={primaryBtn}>
              Continue <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      {/* ── Step 2: Connect Linear ────────────────────────────────────────── */}
      {step === 'linear' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Database size={22} color="rgba(255,255,255,0.70)" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Connect Linear
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto' }}>
              Halvex matches your deals to open Linear issues so sales gaps become product priorities automatically.
            </p>
          </div>

          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {linearConnected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <SuccessBadge text={linearTeamName ? `Connected to ${linearTeamName}` : 'Linear connected'} />
                {linearSyncing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    Syncing issues in background...
                  </div>
                )}
                {!linearSyncing && linearIssueCount != null && linearIssueCount > 0 && (
                  <div style={{
                    fontSize: '13px', color: 'rgba(255,255,255,0.65)',
                    padding: '8px 14px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                  }}>
                    {linearIssueCount} issues synced and ready for matching
                  </div>
                )}
              </div>
            ) : (
              <>
                <FeatureList items={[
                  'Halvex syncs your Linear backlog automatically',
                  'Deals matched to relevant issues by AI similarity',
                  'Sales can request prioritization without pestering eng',
                ]} />
                <button
                  onClick={handleLinearConnect}
                  disabled={linearConnecting}
                  style={{
                    ...primaryBtn,
                    opacity: linearConnecting ? 0.7 : 1,
                    cursor: linearConnecting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {linearConnecting
                    ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Connecting...</>
                    : <><Database size={14} /> Connect Linear</>}
                </button>
                {linearError && (
                  <div style={{
                    padding: '10px 14px',
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.20)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'var(--accent-danger)',
                    lineHeight: 1.5,
                  }}>
                    {linearError}
                  </div>
                )}
              </>
            )}
          </div>

          {linearConnected && !linearSyncing && (
            <button onClick={() => setStep('deal')} style={primaryBtn}>
              Continue <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      {/* ── Step 3: Add first deal ────────────────────────────────────────── */}
      {step === 'deal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Add your first deal
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: '360px', margin: '0 auto' }}>
              Halvex will run a gap analysis and message you in Slack with matching Linear issues.
            </p>
          </div>

          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Deal value
                </label>
                <input
                  type="text"
                  value={dealValue}
                  onChange={e => setDealValue(e.target.value)}
                  placeholder="e.g. 50000"
                  style={input}
                  onFocus={e => (e.target.style.borderColor = focusBorder)}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Stage
                </label>
                <select
                  value={stage}
                  onChange={e => setStage(e.target.value)}
                  style={{ ...input, cursor: 'pointer' }}
                >
                  {STAGE_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                What are they waiting for?
              </label>
              <textarea
                value={waitingFor}
                onChange={e => setWaitingFor(e.target.value)}
                placeholder="e.g. They need SSO before they can buy. Procurement blocked on SOC 2. Eng team wants a native API..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  minHeight: '72px',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = focusBorder)}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                Halvex uses this to find matching Linear issues and kick off your first loop.
              </div>
            </div>

            <button
              onClick={handleDealSave}
              disabled={!company.trim() || dealSaving}
              style={!company.trim() ? disabledBtn : {
                ...primaryBtn,
                cursor: dealSaving ? 'not-allowed' : 'pointer',
                opacity: dealSaving ? 0.7 : 1,
              }}
            >
              {dealSaving
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing...</>
                : <>Save deal and discover issues <ArrowRight size={14} /></>}
            </button>
          </div>
        </div>
      )}

      {/* ── Results panel (aha moment) ────────────────────────────────────── */}
      {step === 'results' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              {discoverLoading
                ? 'Running gap analysis...'
                : discoveredIssues.length > 0
                  ? `Found ${discoveredIssues.length} issue${discoveredIssues.length === 1 ? '' : 's'} that could help close ${company}`
                  : `Deal saved — ${company}`}
            </h1>
            {!discoverLoading && (
              <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: '360px', margin: '0 auto' }}>
                {discoveredIssues.length > 0
                  ? 'These Linear issues match the blockers on this deal. Scope them to close the loop.'
                  : 'No matching issues found yet. You can discover issues later from the deal page.'}
              </p>
            )}
          </div>

          {/* Deal score card */}
          {dealScore != null && (
            <div style={{
              ...card,
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px 20px',
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)',
                flexShrink: 0,
              }}>
                {dealScore}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Initial deal score
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Based on {STAGE_OPTIONS.find(s => s.value === stage)?.label ?? stage} stage heuristic
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {discoverLoading && (
            <div style={{
              ...card,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '32px',
              color: 'var(--text-tertiary)',
              fontSize: '13px',
            }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Matching deal signals to Linear issues...
            </div>
          )}

          {/* Discovered issues list */}
          {!discoverLoading && discoveredIssues.length > 0 && (
            <div style={{ ...card, padding: '0', overflow: 'hidden' }}>
              <div style={{
                padding: '14px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Matching Linear issues
              </div>
              {discoveredIssues.slice(0, 5).map((issue, i) => (
                <div
                  key={issue.linearIssueId}
                  style={{
                    padding: '14px 20px',
                    borderBottom: i < Math.min(discoveredIssues.length, 5) - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <div style={{
                    fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.40)',
                    padding: '2px 6px',
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: '4px',
                    flexShrink: 0,
                    marginTop: '1px',
                  }}>
                    {issue.linearIssueId}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>
                      {issue.linearTitle ?? issue.linearIssueId}
                    </div>
                    {issue.addressesRisk && (
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', lineHeight: 1.4 }}>
                        Addresses: {issue.addressesRisk}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: '11px', color: 'rgba(255,255,255,0.35)',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}>
                    {issue.relevanceScore}%
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Scope CTA */}
          {!discoverLoading && discoveredIssues.length > 0 && savedDealId && (
            <button
              onClick={() => router.push(`/deals/${savedDealId}?tab=issues`)}
              style={{
                ...primaryBtn,
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <ExternalLink size={14} /> Scope these issues
            </button>
          )}

          {/* Slack nudge */}
          {!discoverLoading && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              fontSize: '13px', color: 'var(--text-tertiary)',
            }}>
              <MessageSquare size={16} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.40)' }} />
              Check Slack -- you should have a message from Halvex
            </div>
          )}

          {/* Go to dashboard */}
          {!discoverLoading && (
            <button
              onClick={() => router.push('/dashboard?onboarded=1')}
              style={primaryBtn}
            >
              Go to dashboard <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
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
