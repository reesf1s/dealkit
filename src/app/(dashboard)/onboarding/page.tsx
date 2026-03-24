'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle, Building2, Loader2, MessageSquare, Database, Zap } from 'lucide-react'

type Step = 'workspace' | 'crm' | 'slack'
type CrmTab = 'hubspot' | 'manual'

async function seedDemoDeals() {
  try {
    await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealName: 'Acme Corp — Platform evaluation',
        prospectCompany: 'Acme Corp',
        prospectName: 'Sarah Chen',
        prospectTitle: 'VP of Engineering',
        dealValue: 48000,
        stage: 'demo',
        description:
          'Evaluating Halvex for their 12-person product-engineering team. Budget approved Q2. Decision by end of month.',
        notes:
          'Champion is Sarah Chen. CTO attended the demo. Competing with Notion and Linear native integrations.',
      }),
    })
  } catch {
    /* best effort */
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('workspace')
  const [workspaceName, setWorkspaceName] = useState('')
  const [crmTab, setCrmTab] = useState<CrmTab>('hubspot')
  const [hubspotToken, setHubspotToken] = useState('')
  const [crmLoading, setCrmLoading] = useState(false)
  const [crmError, setCrmError] = useState('')
  const [crmConnected, setCrmConnected] = useState(false)
  const [demoSeeded, setDemoSeeded] = useState(false)

  const stepIndex = step === 'workspace' ? 1 : step === 'crm' ? 2 : 3

  async function handleWorkspaceContinue() {
    if (workspaceName.trim()) {
      try {
        await fetch('/api/company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyName: workspaceName.trim() }),
        })
      } catch {
        /* best effort */
      }
    }
    setStep('crm')
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
      // Kick off sync in background
      fetch('/api/integrations/hubspot/sync', { method: 'POST' }).catch(() => {})
      setCrmConnected(true)
      setStep('slack')
    } catch (e: unknown) {
      setCrmError(e instanceof Error ? e.message : 'Connection failed. Check your token and try again.')
    } finally {
      setCrmLoading(false)
    }
  }

  async function handleSkipCrm() {
    if (!demoSeeded) {
      await seedDemoDeals()
      setDemoSeeded(true)
    }
    setStep('slack')
  }

  async function handleFinish() {
    if (!crmConnected && !demoSeeded) {
      await seedDemoDeals()
    }
    router.push('/dashboard?onboarded=1')
  }

  const steps = ['Workspace', 'Connect data', 'Slack']

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingTop: '8px' }}>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', justifyContent: 'center' }}>
        {steps.map((label, i) => {
          const num = i + 1
          const active = num === stepIndex
          const done = num < stepIndex
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: '700',
                  background: done
                    ? 'rgba(52,211,153,0.15)'
                    : active ? 'rgba(99,102,241,0.2)' : 'var(--surface)',
                  border: done
                    ? '1px solid rgba(52,211,153,0.35)'
                    : active ? '1px solid rgba(99,102,241,0.5)' : '1px solid var(--border)',
                  color: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--text-tertiary)',
                  flexShrink: 0,
                }}>
                  {done ? '✓' : num}
                </div>
                <span style={{
                  fontSize: '12px', fontWeight: active ? '500' : '400',
                  color: active ? 'var(--text-primary)' : done ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                }}>
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div style={{ width: '32px', height: '1px', background: 'var(--border)', margin: '0 8px' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Workspace name ─────────────────────────── */}
      {step === 'workspace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
              border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 0 24px rgba(99,102,241,0.15)',
            }}>
              <Building2 size={22} color="var(--accent)" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Name your workspace
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
              Usually your company or team name. You can change this later.
            </p>
          </div>

          <div style={{
            background: 'var(--card-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Workspace name
            </label>
            <input
              type="text"
              value={workspaceName}
              onChange={e => setWorkspaceName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleWorkspaceContinue()}
              placeholder="e.g. Acme Sales Team"
              autoFocus
              style={{
                width: '100%', height: '44px', padding: '0 14px',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px',
                color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
            <button
              onClick={handleWorkspaceContinue}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--accent), #7C3AED)',
                color: '#fff', fontSize: '14px', fontWeight: '600',
                boxShadow: '0 0 20px rgba(99,102,241,0.3)',
                transition: 'opacity 0.1s',
              }}
            >
              Continue <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => setStep('crm')}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '12px', cursor: 'pointer' }}
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Connect CRM ────────────────────────────── */}
      {step === 'crm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(255,122,89,0.2), rgba(245,158,11,0.15))',
              border: '1px solid rgba(255,122,89,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 0 24px rgba(255,122,89,0.12)',
            }}>
              <Database size={22} color="#ff7a59" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Connect your pipeline data
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
              Import deals from HubSpot, or start with sample data and add your own later.
            </p>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', background: 'var(--surface)',
            borderRadius: '8px', padding: '4px', gap: '2px',
          }}>
            {(['hubspot', 'manual'] as CrmTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setCrmTab(tab)}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: crmTab === tab ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: crmTab === tab ? 'var(--accent)' : 'var(--text-tertiary)',
                  fontSize: '13px', fontWeight: '500',
                  transition: 'all 0.1s',
                }}
              >
                {tab === 'hubspot' ? '🟠  HubSpot' : '✏️  Manual'}
              </button>
            ))}
          </div>

          {crmTab === 'hubspot' && (
            <div style={{
              background: 'var(--card-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px',
            }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', margin: 0 }}>
                In HubSpot, go to <strong style={{ color: 'var(--text-primary)' }}>Settings → Integrations → Private Apps</strong>,
                create an app with <code style={{
                  color: 'var(--accent)', background: 'var(--accent-subtle)',
                  padding: '1px 6px', borderRadius: '4px', fontSize: '11px',
                }}>crm.objects.deals.read</code> scope, then paste the token below.
              </p>
              <input
                type="password"
                value={hubspotToken}
                onChange={e => setHubspotToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleHubSpotConnect()}
                placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                style={{
                  width: '100%', height: '42px', padding: '0 14px',
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px',
                  color: 'var(--text-primary)', fontSize: '12px', outline: 'none',
                  fontFamily: 'monospace', boxSizing: 'border-box', letterSpacing: '0.03em',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
              {crmError && <div style={{ fontSize: '12px', color: 'var(--danger)' }}>{crmError}</div>}
              <button
                onClick={handleHubSpotConnect}
                disabled={!hubspotToken.trim() || crmLoading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '12px', borderRadius: '8px', border: 'none',
                  cursor: crmLoading || !hubspotToken.trim() ? 'not-allowed' : 'pointer',
                  background: crmLoading || !hubspotToken.trim()
                    ? 'rgba(99,102,241,0.2)'
                    : 'linear-gradient(135deg, var(--accent), #7C3AED)',
                  color: '#fff', fontSize: '13px', fontWeight: '600',
                  boxShadow: crmLoading || !hubspotToken.trim() ? 'none' : '0 0 20px rgba(99,102,241,0.3)',
                  transition: 'all 0.1s',
                }}
              >
                {crmLoading
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Connecting...</>
                  : <>Connect HubSpot <ArrowRight size={14} /></>}
              </button>

              {crmConnected && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--success)' }}>
                  <CheckCircle size={13} />
                  Connected — deals syncing in the background
                </div>
              )}
            </div>
          )}

          {crmTab === 'manual' && (
            <div style={{
              background: 'var(--card-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', margin: 0 }}>
                We&apos;ll load a sample deal so the dashboard isn&apos;t empty. You can add your real deals
                from the <strong style={{ color: 'var(--text-primary)' }}>Deals</strong> page any time.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', background: 'var(--surface)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sample deal</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>Acme Corp — Platform evaluation</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>£48,000 · Demo stage · Sarah Chen, VP Engineering</div>
              </div>
              <button
                onClick={handleSkipCrm}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, var(--accent), #7C3AED)',
                  color: '#fff', fontSize: '13px', fontWeight: '600',
                  boxShadow: '0 0 20px rgba(99,102,241,0.3)',
                }}
              >
                Start with sample data <ArrowRight size={14} />
              </button>
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleSkipCrm}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '12px', cursor: 'pointer' }}
            >
              Skip for now — I&apos;ll connect later
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Slack ──────────────────────────────────── */}
      {step === 'slack' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(99,102,241,0.1))',
              border: '1px solid rgba(52,211,153,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 0 24px rgba(52,211,153,0.15)',
            }}>
              <MessageSquare size={22} color="var(--success)" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Add the Slack bot
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
              Ask about deals, scope issues, and get notified when features ship — right in Slack.
            </p>
          </div>

          <div style={{
            background: 'var(--card-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                What you can ask
              </div>
              {[
                '@halvex what\'s the status of Acme Corp?',
                '@halvex which deals need attention today?',
                '@halvex scope a Linear issue for the SSO request',
              ].map(ex => (
                <div key={ex} style={{
                  padding: '10px 12px', background: 'var(--surface)', borderRadius: '6px',
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
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px', borderRadius: '8px', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--accent), #7C3AED)',
                color: '#fff', fontSize: '13px', fontWeight: '600',
                textDecoration: 'none',
                boxShadow: '0 0 20px rgba(99,102,241,0.3)',
              }}
            >
              <Zap size={14} /> Add to Slack
            </a>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleFinish}
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '12px', cursor: 'pointer' }}
            >
              Skip for now — go to dashboard →
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
