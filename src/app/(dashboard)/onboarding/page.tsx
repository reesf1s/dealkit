'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle, Building2, Loader2, MessageSquare, Database, Zap, Plus, Sparkles } from 'lucide-react'

type Step = 'workspace' | 'deals' | 'integrations' | 'done'
type CrmTab = 'hubspot' | 'slack'

const STAGE_OPTIONS = [
  { value: 'prospecting', label: 'Prospecting' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
]

interface MiniDeal {
  company: string
  value: string
  stage: string
  saved: boolean
  saving: boolean
}

const emptyDeal = (): MiniDeal => ({ company: '', value: '', stage: 'discovery', saved: false, saving: false })

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('workspace')
  const [workspaceName, setWorkspaceName] = useState('')

  // Step 2: 3 deals
  const [deals, setDeals] = useState<MiniDeal[]>([emptyDeal(), emptyDeal(), emptyDeal()])
  const savedCount = deals.filter(d => d.saved).length

  // Step 3: integrations
  const [crmTab, setCrmTab] = useState<CrmTab>('hubspot')
  const [hubspotToken, setHubspotToken] = useState('')
  const [crmLoading, setCrmLoading] = useState(false)
  const [crmError, setCrmError] = useState('')
  const [crmConnected, setCrmConnected] = useState(false)

  // Step 4: aha
  const [brainBuilding, setBrainBuilding] = useState(false)
  const [brainReady, setBrainReady] = useState(false)

  const stepIndex: Record<Step, number> = { workspace: 1, deals: 2, integrations: 3, done: 4 }
  const steps = ['Workspace', 'Add deals', 'Connect', 'Done']

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleWorkspaceContinue() {
    if (workspaceName.trim()) {
      try {
        await fetch('/api/company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyName: workspaceName.trim() }),
        })
      } catch { /* best effort */ }
    }
    setStep('deals')
  }

  async function saveDeal(index: number) {
    const d = deals[index]
    if (!d.company.trim() || d.saving || d.saved) return
    setDeals(prev => prev.map((x, i) => i === index ? { ...x, saving: true } : x))
    try {
      await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealName: `${d.company.trim()} — New deal`,
          prospectCompany: d.company.trim(),
          dealValue: d.value ? Number(d.value.replace(/[^0-9.]/g, '')) : null,
          stage: d.stage,
        }),
      })
      setDeals(prev => prev.map((x, i) => i === index ? { ...x, saving: false, saved: true } : x))
    } catch {
      setDeals(prev => prev.map((x, i) => i === index ? { ...x, saving: false } : x))
    }
  }

  function updateDeal(index: number, field: keyof MiniDeal, value: string) {
    setDeals(prev => prev.map((x, i) => i === index ? { ...x, [field]: value, saved: false } : x))
  }

  async function handleDealsContinue() {
    // Save any unsaved deals with a company name
    const unsaved = deals.map((d, i) => ({ d, i })).filter(({ d }) => d.company.trim() && !d.saved)
    await Promise.all(unsaved.map(({ i }) => saveDeal(i)))
    setStep('integrations')
  }

  async function handleHubSpotConnect() {
    if (!hubspotToken.trim()) return
    setCrmLoading(true)
    setCrmError('')
    try {
      const res = await fetch('/api/integrations/hubspot/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: hubspotToken.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to connect')
      fetch('/api/integrations/hubspot/sync', { method: 'POST' }).catch(() => {})
      setCrmConnected(true)
    } catch (e: unknown) {
      setCrmError(e instanceof Error ? e.message : 'Connection failed. Check your token and try again.')
    } finally {
      setCrmLoading(false)
    }
  }

  async function handleIntegrationsContinue() {
    setStep('done')
    setBrainBuilding(true)
    // Trigger brain rebuild in background
    try {
      await fetch('/api/workspace/brain/refresh')
    } catch { /* best effort */ }
    setBrainBuilding(false)
    setBrainReady(true)
  }

  function handleFinish() {
    router.push('/dashboard?onboarded=1')
  }

  // ── Layout helpers ───────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: 'var(--bg-glass)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '20px',
  }

  const input: React.CSSProperties = {
    width: '100%',
    height: '40px',
    padding: '0 12px',
    background: 'var(--bg-surface)',
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
    padding: '11px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, var(--accent-primary), #7C3AED)',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 0 20px rgba(99,102,241,0.25)',
    fontFamily: 'inherit',
    transition: 'opacity 0.1s',
  }

  const ghostBtn: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--text-tertiary)',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }

  const currentStep = stepIndex[step]

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingTop: '8px' }}>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0' }}>
        {steps.map((label, i) => {
          const num = i + 1
          const active = num === currentStep
          const done = num < currentStep
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700, flexShrink: 0,
                  background: done ? 'rgba(16,185,129,0.15)' : active ? 'rgba(99,102,241,0.2)' : 'var(--bg-glass)',
                  border: done ? '1px solid rgba(16,185,129,0.35)' : active ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border-subtle)',
                  color: done ? 'var(--accent-success)' : active ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                }}>
                  {done ? '✓' : num}
                </div>
                <span style={{ fontSize: '12px', fontWeight: active ? 500 : 400, color: active ? 'var(--text-primary)' : done ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: '28px', height: '1px', background: 'var(--border-subtle)', margin: '0 8px' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Workspace ──────────────────────────────────────────── */}
      {step === 'workspace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
              border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Building2 size={22} color="var(--accent-primary)" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Name your workspace
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              Usually your company or team name.
            </p>
          </div>

          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Workspace name
            </label>
            <input
              type="text"
              value={workspaceName}
              onChange={e => setWorkspaceName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleWorkspaceContinue()}
              placeholder="e.g. Acme Sales Team"
              autoFocus
              style={input}
              onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border-default)')}
            />
            <button onClick={handleWorkspaceContinue} style={primaryBtn}>
              Continue <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button onClick={() => setStep('deals')} style={ghostBtn}>
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Add 3 deals ────────────────────────────────────────── */}
      {step === 'deals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(99,102,241,0.1))',
              border: '1px solid rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Sparkles size={22} color="var(--accent-success)" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Add your first 3 deals
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: '4px' }}>
              Intelligence unlocks after 3 deals — this is how we find your patterns.
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', fontWeight: 600,
              color: savedCount === 3 ? 'var(--accent-success)' : 'var(--accent-primary)',
              background: savedCount === 3 ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
              border: `1px solid ${savedCount === 3 ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`,
              padding: '4px 12px', borderRadius: '100px',
            }}>
              {savedCount === 3 ? '✓ 3 / 3 deals added' : `${savedCount} / 3 deals added`}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {deals.map((deal, i) => (
              <div key={i} style={{
                ...card,
                border: deal.saved
                  ? '1px solid rgba(16,185,129,0.3)'
                  : '1px solid var(--border-subtle)',
                background: deal.saved ? 'rgba(16,185,129,0.05)' : 'var(--bg-glass)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700,
                    background: deal.saved ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                    color: deal.saved ? 'var(--accent-success)' : 'var(--accent-primary)',
                    flexShrink: 0,
                  }}>
                    {deal.saved ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: deal.saved ? 'var(--accent-success)' : 'var(--text-secondary)' }}>
                    {deal.saved ? deal.company : `Deal ${i + 1}`}
                  </span>
                </div>

                {!deal.saved && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      type="text"
                      value={deal.company}
                      onChange={e => updateDeal(i, 'company', e.target.value)}
                      placeholder="Company name *"
                      style={{ ...input, height: '36px' }}
                      onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border-default)')}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input
                        type="text"
                        value={deal.value}
                        onChange={e => updateDeal(i, 'value', e.target.value)}
                        placeholder="Deal value (optional)"
                        style={{ ...input, height: '36px' }}
                        onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--border-default)')}
                      />
                      <select
                        value={deal.stage}
                        onChange={e => updateDeal(i, 'stage', e.target.value)}
                        style={{ ...input, height: '36px', cursor: 'pointer' }}
                      >
                        {STAGE_OPTIONS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => saveDeal(i)}
                      disabled={!deal.company.trim() || deal.saving}
                      style={{
                        ...primaryBtn,
                        background: !deal.company.trim() ? 'rgba(99,102,241,0.2)' : primaryBtn.background,
                        boxShadow: !deal.company.trim() ? 'none' : primaryBtn.boxShadow,
                        cursor: !deal.company.trim() ? 'not-allowed' : 'pointer',
                        padding: '8px',
                        fontSize: '12px',
                      }}
                    >
                      {deal.saving
                        ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
                        : <><Plus size={12} /> Add deal</>}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleDealsContinue}
            disabled={savedCount < 3}
            style={{
              ...primaryBtn,
              background: savedCount < 3 ? 'rgba(99,102,241,0.2)' : primaryBtn.background,
              boxShadow: savedCount < 3 ? 'none' : primaryBtn.boxShadow,
              cursor: savedCount < 3 ? 'not-allowed' : 'pointer',
              opacity: savedCount < 3 ? 0.6 : 1,
            }}
          >
            {savedCount < 3
              ? `Add ${3 - savedCount} more deal${3 - savedCount !== 1 ? 's' : ''} to continue`
              : <>Continue to integrations <ArrowRight size={14} /></>}
          </button>
        </div>
      )}

      {/* ── Step 3: Integrations ───────────────────────────────────────── */}
      {step === 'integrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(255,122,89,0.2), rgba(245,158,11,0.1))',
              border: '1px solid rgba(255,122,89,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Database size={22} color="#ff7a59" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Connect your tools
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              Optional — you can add integrations any time from settings.
            </p>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', background: 'var(--bg-glass)',
            borderRadius: 'var(--radius-sm)', padding: '4px', gap: '2px',
            border: '1px solid var(--border-subtle)',
          }}>
            {(['hubspot', 'slack'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setCrmTab(tab as CrmTab)}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 'calc(var(--radius-sm) - 2px)',
                  border: 'none', cursor: 'pointer',
                  background: crmTab === tab ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: crmTab === tab ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                  fontSize: '13px', fontWeight: 500, transition: 'all 0.1s',
                  fontFamily: 'inherit',
                }}
              >
                {tab === 'hubspot' ? '🟠  HubSpot' : '💬  Slack'}
              </button>
            ))}
          </div>

          {crmTab === 'hubspot' && (
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                In HubSpot, go to <strong style={{ color: 'var(--text-primary)' }}>Settings → Private Apps</strong>, create an app with{' '}
                <code style={{ color: 'var(--accent-primary)', background: 'rgba(99,102,241,0.1)', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>
                  crm.objects.deals.read
                </code>{' '}
                scope, then paste the token below.
              </p>
              <input
                type="password"
                value={hubspotToken}
                onChange={e => setHubspotToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleHubSpotConnect()}
                placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                style={{ ...input, fontFamily: 'monospace', fontSize: '12px' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-default)')}
              />
              {crmError && <div style={{ fontSize: '12px', color: 'var(--accent-danger)' }}>{crmError}</div>}
              {crmConnected ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--accent-success)' }}>
                  <CheckCircle size={13} /> Connected — deals syncing in the background
                </div>
              ) : (
                <button
                  onClick={handleHubSpotConnect}
                  disabled={!hubspotToken.trim() || crmLoading}
                  style={{
                    ...primaryBtn,
                    background: crmLoading || !hubspotToken.trim() ? 'rgba(99,102,241,0.2)' : primaryBtn.background,
                    boxShadow: crmLoading || !hubspotToken.trim() ? 'none' : primaryBtn.boxShadow,
                    cursor: crmLoading || !hubspotToken.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {crmLoading
                    ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Connecting...</>
                    : <>Connect HubSpot <ArrowRight size={14} /></>}
                </button>
              )}
            </div>
          )}

          {crmTab === 'slack' && (
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  What you can ask
                </div>
                {[
                  "@halvex what's the status of Acme Corp?",
                  '@halvex which deals need attention today?',
                  '@halvex scope a Linear issue for the SSO request',
                ].map(ex => (
                  <div key={ex} style={{
                    padding: '9px 12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)',
                    fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)',
                    borderLeft: '2px solid rgba(99,102,241,0.3)',
                  }}>
                    {ex}
                  </div>
                ))}
              </div>
              <a
                href="/api/integrations/slack/install"
                style={{
                  ...primaryBtn,
                  textDecoration: 'none',
                  display: 'flex',
                }}
              >
                <Zap size={14} /> Add to Slack
              </a>
            </div>
          )}

          <button onClick={handleIntegrationsContinue} style={primaryBtn}>
            {crmConnected ? 'Continue' : 'Skip for now'} <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* ── Step 4: Aha moment ─────────────────────────────────────────── */}
      {step === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'center' }}>
          <div>
            <div style={{
              width: '64px', height: '64px', borderRadius: '18px',
              background: 'var(--bg-hero)',
              border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 32px rgba(99,102,241,0.2)',
            }}>
              {brainBuilding
                ? <Loader2 size={28} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                : <Sparkles size={28} color="var(--accent-primary)" />}
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '10px' }}>
              {brainBuilding ? 'Building your intelligence…' : 'Your workspace is ready'}
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              {brainBuilding
                ? 'Halvex is analysing your deals to find win patterns, blockers, and revenue intelligence.'
                : 'Intelligence is live. Head to the dashboard to see your revenue at risk, win conditions, and top actions.'}
            </p>
          </div>

          {brainReady && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { icon: '🎯', text: 'Win patterns extracted from your deals' },
                { icon: '⚠️', text: 'Revenue at risk calculated' },
                { icon: '🔗', text: 'Product gap map ready' },
              ].map(item => (
                <div key={item.text} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
                  fontSize: '13px', color: 'var(--text-secondary)',
                }}>
                  <span>{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>
          )}

          {!brainBuilding && (
            <button onClick={handleFinish} style={{ ...primaryBtn, fontSize: '14px', padding: '13px' }}>
              Go to dashboard <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
