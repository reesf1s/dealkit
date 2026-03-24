'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, CheckCircle, Zap, Database, Loader2, MessageSquare } from 'lucide-react'

type Step = 'slack' | 'linear' | 'deal' | 'done'

const STAGE_OPTIONS = [
  { value: 'prospecting', label: 'Prospecting' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
]

function OnboardingInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState<Step>('slack')

  // Slack state
  const [slackConnected, setSlackConnected] = useState(false)
  const [slackTeamName, setSlackTeamName] = useState<string | null>(null)

  // Linear state
  const [linearConnected, setLinearConnected] = useState(false)
  const [linearTeamName, setLinearTeamName] = useState<string | null>(null)
  const [linearSyncing, setLinearSyncing] = useState(false)

  // Deal state
  const [company, setCompany] = useState('')
  const [dealValue, setDealValue] = useState('')
  const [stage, setStage] = useState('discovery')
  const [waitingFor, setWaitingFor] = useState('')
  const [dealSaving, setDealSaving] = useState(false)

  // Single init effect — handles OAuth redirects and status pre-checks
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
        })
        setTimeout(() => { setLinearSyncing(false); setStep('deal') }, 2500)
        return
      }

      // No OAuth params — check existing connections (resuming onboarding)
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
      }

      if (hasSlack && hasLinear) setStep('deal')
      else if (hasSlack) setStep('linear')
    }

    init()
  }, [searchParams])

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
      // Fire gap analysis (non-blocking) — this is the Slack aha moment
      if (dealId && waitingFor.trim()) {
        fetch(`/api/deals/${dealId}/meeting-notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: waitingFor.trim() }),
        }).catch(() => {})
      }

      setStep('done')
    } catch {
      // surface no error — user can retry
    } finally {
      setDealSaving(false)
    }
  }

  // ── Shared styles ────────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '24px',
  }

  const input: React.CSSProperties = {
    width: '100%',
    height: '40px',
    padding: '0 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  }

  const primaryBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, var(--accent-primary), #7C3AED)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    boxShadow: '0 0 20px rgba(99,102,241,0.25)',
    fontFamily: 'inherit',
    transition: 'opacity 0.1s',
    textDecoration: 'none',
  }

  const stepLabels = ['Connect Slack', 'Connect Linear', 'Add first deal']
  const stepIndex: Record<Step, number> = { slack: 1, linear: 2, deal: 3, done: 4 }
  const currentStepNum = stepIndex[step]

  function SuccessBadge({ text }: { text: string }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 14px',
        background: 'rgba(16,185,129,0.08)',
        border: '1px solid rgba(16,185,129,0.25)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '13px', color: 'var(--accent-success)', fontWeight: 500,
      }}>
        <CheckCircle size={14} /> {text}
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
            <span style={{ color: 'var(--accent-primary)', marginTop: '1px', flexShrink: 0 }}>→</span>
            {text}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingTop: '8px' }}>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  background: done ? 'rgba(16,185,129,0.15)' : active ? 'rgba(99,102,241,0.2)' : 'transparent',
                  border: done ? '1px solid rgba(16,185,129,0.35)' : active ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border-subtle)',
                  color: done ? 'var(--accent-success)' : active ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                }}>
                  {done ? '✓' : num}
                </div>
                <span style={{
                  fontSize: '12px',
                  fontWeight: active ? 500 : 400,
                  color: active ? 'var(--text-primary)' : done ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                }}>
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div style={{ width: '24px', height: '1px', background: 'var(--border-subtle)', margin: '0 8px' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Connect Slack ──────────────────────────────────────────── */}
      {step === 'slack' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(74,144,226,0.15), rgba(99,102,241,0.1))',
              border: '1px solid rgba(74,144,226,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <MessageSquare size={22} color="#4A90E2" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Connect Slack
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto' }}>
              Halvex works in Slack. Ask about deals, get notified when issues ship, and close loops — without leaving your workflow.
            </p>
          </div>

          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {slackConnected ? (
              <SuccessBadge text={slackTeamName ? `Connected to ${slackTeamName}` : 'Slack connected — advancing…'} />
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
                  <Zap size={14} /> Connect Slack
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
              background: 'linear-gradient(135deg, rgba(82,25,214,0.2), rgba(99,102,241,0.1))',
              border: '1px solid rgba(82,25,214,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Database size={22} color="#5219D6" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Connect Linear
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto' }}>
              Halvex matches your deals to open Linear issues — so sales gaps become product priorities automatically.
            </p>
          </div>

          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {linearConnected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <SuccessBadge text={linearTeamName ? `Connected to ${linearTeamName}` : 'Linear connected'} />
                {linearSyncing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    Syncing issues in background…
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
                <a
                  href="/api/integrations/linear/install?returnTo=/onboarding"
                  style={primaryBtn}
                >
                  <Database size={14} /> Connect Linear
                </a>
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
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(99,102,241,0.1))',
              border: '1px solid rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '22px',
            }}>
              🎯
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Add your first deal
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto' }}>
              Halvex will run a gap analysis and message you in Slack with matching Linear issues. That message is the loop starting.
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
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-default)')}
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
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-default)')}
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
                placeholder="e.g. They need SSO before they can buy. Procurement blocked on SOC 2. Eng team wants a native API…"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  minHeight: '72px',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-default)')}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                Halvex uses this to find matching Linear issues and kick off your first loop.
              </div>
            </div>

            <button
              onClick={handleDealSave}
              disabled={!company.trim() || dealSaving}
              style={{
                ...primaryBtn,
                background: !company.trim() ? 'rgba(99,102,241,0.2)' : 'linear-gradient(135deg, var(--accent-primary), #7C3AED)',
                boxShadow: !company.trim() ? 'none' : '0 0 20px rgba(99,102,241,0.25)',
                cursor: !company.trim() || dealSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {dealSaving
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                : <>Save deal <ArrowRight size={14} /></>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Done — aha moment ─────────────────────────────────────── */}
      {step === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'center' }}>
          <div>
            <div style={{
              width: '64px', height: '64px', borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(99,102,241,0.1))',
              border: '1px solid rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 32px rgba(16,185,129,0.15)',
            }}>
              <CheckCircle size={28} color="var(--accent-success)" />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '10px' }}>
              Your first loop is live
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.7, maxWidth: '360px', margin: '0 auto' }}>
              Halvex is running a gap analysis on your deal. Check Slack — you should have a message within seconds.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { icon: '💬', text: 'Slack connected — ask about deals anytime' },
              { icon: '🔗', text: 'Linear synced — issues matched automatically' },
              { icon: '🎯', text: 'Gap analysis running — check Slack now' },
            ].map(item => (
              <div key={item.text} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)',
                fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'left',
              }}>
                <span>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push('/dashboard?onboarded=1')}
            style={{ ...primaryBtn, fontSize: '14px', padding: '13px' }}
          >
            Go to dashboard <ArrowRight size={14} />
          </button>
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
