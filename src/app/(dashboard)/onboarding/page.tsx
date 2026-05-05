'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  Building2,
  CheckCircle,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'

type Step = 'welcome' | 'deal' | 'ready'

const STAGE_OPTIONS = [
  { value: 'prospecting', label: 'Prospecting', score: 15 },
  { value: 'qualification', label: 'Qualification', score: 30 },
  { value: 'discovery', label: 'Discovery', score: 45 },
  { value: 'proposal', label: 'Proposal', score: 65 },
  { value: 'negotiation', label: 'Negotiation', score: 80 },
]

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Request failed')
  return json
}

function OnboardingInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialStep = parseInt(searchParams.get('step') ?? '1', 10)
  const stepMap: Record<number, Step> = { 1: 'welcome', 2: 'deal', 3: 'ready' }
  const step0 = stepMap[isNaN(initialStep) ? 1 : Math.min(Math.max(initialStep, 1), 3)] ?? 'welcome'

  const [step, setStep] = useState<Step>(step0)

  // Welcome
  const [companyName, setCompanyName] = useState('')
  const [teamSize, setTeamSize] = useState('solo')

  // Deal
  const [prospect, setProspect] = useState('')
  const [dealValue, setDealValue] = useState('')
  const [stage, setStage] = useState('discovery')
  const [context, setContext] = useState('')
  const [dealSaving, setDealSaving] = useState(false)
  const [dealError, setDealError] = useState<string | null>(null)

  // Ready
  const [savedDealId, setSavedDealId] = useState<string | null>(null)
  const [dealScore, setDealScore] = useState<number | null>(null)
  const [brainStatus, setBrainStatus] = useState<'polling' | 'live' | 'pending'>('polling')
  const [brainPatterns, setBrainPatterns] = useState<string[]>([])
  const [extractionResult, setExtractionResult] = useState<string | null>(null)

  // Update company profile when advancing from welcome
  async function handleWelcome() {
    if (!companyName.trim()) return
    try {
      await fetchJson('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: companyName.trim(), teamSize }),
      })
    } catch { /* non-blocking — company save is optional */ }
    setStep('deal')
  }

  async function handleDealSave() {
    if (!prospect.trim() || dealSaving) return
    setDealError(null)
    setDealSaving(true)
    try {
      const data = await fetchJson('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealName: `${prospect.trim()} — New deal`,
          prospectCompany: prospect.trim(),
          dealValue: dealValue ? Number(dealValue.replace(/[^0-9.]/g, '')) : null,
          stage,
        }),
      })

      const dealId = data.data?.id
      setSavedDealId(dealId)
      const stageObj = STAGE_OPTIONS.find(s => s.value === stage)
      setDealScore(stageObj?.score ?? 40)
      setStep('ready')

      // Save context as meeting notes (non-blocking)
      if (dealId && context.trim()) {
        fetchJson(`/api/deals/${dealId}/meeting-notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: context.trim() }),
        }).then(result => {
          if (result.message) setExtractionResult(result.message)
        }).catch(() => {})
      }

      // Poll brain for patterns
      if (dealId) {
        setBrainStatus('polling')
        ;(async () => {
          for (let i = 0; i < 6; i++) {
            await new Promise(r => setTimeout(r, 3000))
            try {
              const brainData = await fetchJson('/api/brain')
              const patterns: Array<{ label: string }> = brainData?.data?.keyPatterns ?? []
              if (patterns.length > 0) {
                setBrainPatterns(patterns.slice(0, 3).map(p => p.label))
                setBrainStatus('live')
                return
              }
            } catch { /* silent */ }
          }
          setBrainStatus('pending')
        })()
      }
    } catch (err) {
      setDealError(err instanceof Error ? err.message : 'Could not save deal')
    } finally {
      setDealSaving(false)
    }
  }

  // Auto-advance brain status after timeout
  useEffect(() => {
    if (step === 'ready' && brainStatus === 'polling') {
      const timeout = setTimeout(() => setBrainStatus('pending'), 20000)
      return () => clearTimeout(timeout)
    }
  }, [step, brainStatus])

  const stepNum = step === 'welcome' ? 1 : step === 'deal' ? 2 : 3
  const steps = ['Your team', 'First deal', 'Ready']

  return (
    <div style={{
      maxWidth: '560px', margin: '0 auto', padding: '20px 24px 60px',
      minHeight: '100%', display: 'flex', flexDirection: 'column', gap: '28px',
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(29,184,106,0.3); } 70% { box-shadow: 0 0 0 8px rgba(29,184,106,0); } 100% { box-shadow: 0 0 0 0 rgba(29,184,106,0); } }
      `}</style>

      {/* ── Progress ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0' }}>
        {steps.map((label, i) => {
          const num = i + 1
          const active = num === stepNum
          const done = num < stepNum
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700, flexShrink: 0,
                  background: done ? 'var(--brand)' : active ? 'var(--surface-2, #f5f5f5)' : 'var(--surface-2, #f5f5f5)',
                  border: done ? 'none' : active ? '2px solid var(--brand)' : '1px solid var(--border-default, var(--border-default))',
                  color: done ? '#fff' : active ? 'var(--brand)' : 'var(--text-tertiary, #aaa)',
                  transition: 'all 0.3s',
                }}>
                  {done ? <CheckCircle size={14} /> : num}
                </div>
                <span style={{
                  fontSize: '12px', fontWeight: active ? 700 : 500,
                  color: active ? 'var(--text-primary, #1a1a1a)' : done ? 'var(--text-secondary, #777)' : 'var(--text-tertiary, #aaa)',
                }}>
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  width: '32px', height: '2px', margin: '0 12px',
                  background: done ? 'var(--brand)' : 'var(--border-default, var(--border-default))',
                  borderRadius: '1px', transition: 'background 0.3s',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Welcome ──────────────────────────────────────────────── */}
      {step === 'welcome' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fade-up 0.4s ease-out' }}>
          <div style={{ textAlign: 'center', paddingTop: '12px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              background: 'var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 4px 16px rgba(29,184,106,0.25)',
            }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#fff' }}>H</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: 0, color: 'var(--text-primary, #1a1a1a)', marginBottom: '10px' }}>
              Welcome to Halvex
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary, #777)', lineHeight: 1.7, maxWidth: '420px', margin: '0 auto' }}>
              AI deal intelligence that learns your pipeline and tells you exactly what to do next. Let&apos;s get you set up.
            </p>
          </div>

          <div style={{
            background: 'var(--surface-1, #fff)', border: '1px solid var(--border-default, var(--border-default))',
            borderRadius: '14px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary, #aaa)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Your company name *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleWelcome()}
                placeholder="e.g. Acme Corp"
                autoFocus
                style={{
                  width: '100%', height: '46px', padding: '0 16px',
                  background: 'var(--surface-2, #f5f5f5)', border: '1px solid var(--border-default, var(--border-default))',
                  borderRadius: '10px', color: 'var(--text-primary, #1a1a1a)',
                  fontSize: '14px', outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--brand)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-default, var(--border-default))'}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary, #aaa)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Team size
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { value: 'solo', label: 'Just me' },
                  { value: 'small', label: '2–10' },
                  { value: 'large', label: '10+' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTeamSize(opt.value)}
                    style={{
                      padding: '12px', borderRadius: '10px', cursor: 'pointer',
                      background: teamSize === opt.value ? 'var(--brand)10' : 'var(--surface-2, #f5f5f5)',
                      border: teamSize === opt.value ? '2px solid var(--brand)' : '1px solid var(--border-default, var(--border-default))',
                      color: teamSize === opt.value ? 'var(--brand)' : 'var(--text-secondary, #777)',
                      fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* What you'll get */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px',
          }}>
            {[
              { icon: <Target size={16} />, label: 'Deal scoring', color: '#3b82f6' },
              { icon: <Sparkles size={16} />, label: 'AI briefings', color: '#8b5cf6' },
              { icon: <TrendingUp size={16} />, label: 'Pipeline intel', color: 'var(--brand)' },
            ].map(f => (
              <div key={f.label} style={{
                padding: '14px 12px', borderRadius: '10px', textAlign: 'center',
                background: 'var(--surface-1, #fff)', border: '1px solid var(--border-default, var(--border-default))',
              }}>
                <div style={{ color: f.color, marginBottom: '6px', display: 'flex', justifyContent: 'center' }}>{f.icon}</div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #777)' }}>{f.label}</div>
              </div>
            ))}
          </div>

          <button
            onClick={handleWelcome}
            disabled={!companyName.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
              background: companyName.trim() ? 'var(--brand)' : 'var(--surface-2, #f5f5f5)',
              color: companyName.trim() ? '#fff' : 'var(--text-tertiary, #aaa)',
              fontSize: '15px', fontWeight: 700, fontFamily: 'inherit',
              cursor: companyName.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            Continue
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* ── Step 2: First Deal ────────────────────────────────────────────── */}
      {step === 'deal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fade-up 0.4s ease-out' }}>
          <div style={{ textAlign: 'center', paddingTop: '8px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: '#3b82f610', border: '1px solid #3b82f620',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Building2 size={22} color="#3b82f6" />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: 0, color: 'var(--text-primary, #1a1a1a)', marginBottom: '10px' }}>
              Add your first deal
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary, #777)', lineHeight: 1.7, maxWidth: '420px', margin: '0 auto' }}>
              Start with a real opportunity. Halvex will score it, track it, and start learning your pipeline patterns.
            </p>
          </div>

          <div style={{
            background: 'var(--surface-1, #fff)', border: '1px solid var(--border-default, var(--border-default))',
            borderRadius: '14px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            {dealError && (
              <div style={{
                padding: '12px 16px', background: 'var(--color-red-bg, #fef2f2)',
                border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px',
                fontSize: '13px', color: '#ef4444', lineHeight: 1.6,
              }}>
                {dealError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary, #aaa)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Prospect company *
              </label>
              <input
                type="text"
                value={prospect}
                onChange={e => setProspect(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDealSave()}
                placeholder="e.g. Bank of England"
                autoFocus
                style={{
                  width: '100%', height: '46px', padding: '0 16px',
                  background: 'var(--surface-2, #f5f5f5)', border: '1px solid var(--border-default, var(--border-default))',
                  borderRadius: '10px', color: 'var(--text-primary, #1a1a1a)',
                  fontSize: '14px', outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--brand)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-default, var(--border-default))'}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary, #aaa)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Deal value (£)
                </label>
                <input
                  type="text"
                  value={dealValue}
                  onChange={e => setDealValue(e.target.value)}
                  placeholder="e.g. 50000"
                  style={{
                    width: '100%', height: '46px', padding: '0 16px',
                    background: 'var(--surface-2, #f5f5f5)', border: '1px solid var(--border-default, var(--border-default))',
                    borderRadius: '10px', color: 'var(--text-primary, #1a1a1a)',
                    fontSize: '14px', outline: 'none', fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--brand)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-default, var(--border-default))'}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary, #aaa)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Stage
                </label>
                <select
                  value={stage}
                  onChange={e => setStage(e.target.value)}
                  style={{
                    width: '100%', height: '46px', padding: '0 16px',
                    background: 'var(--surface-2, #f5f5f5)', border: '1px solid var(--border-default, var(--border-default))',
                    borderRadius: '10px', color: 'var(--text-primary, #1a1a1a)',
                    fontSize: '14px', outline: 'none', fontFamily: 'inherit',
                    cursor: 'pointer', transition: 'border-color 0.15s',
                  }}
                >
                  {STAGE_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary, #aaa)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Latest context
              </label>
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="Paste your latest call notes, email thread, or deal context here. AI will extract risks, next steps, and objections automatically."
                style={{
                  width: '100%', padding: '14px 16px',
                  background: 'var(--surface-2, #f5f5f5)', border: '1px solid var(--border-default, var(--border-default))',
                  borderRadius: '10px', color: 'var(--text-primary, #1a1a1a)',
                  fontSize: '13px', outline: 'none', fontFamily: 'inherit',
                  resize: 'vertical', minHeight: '100px', lineHeight: 1.7,
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--brand)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-default, var(--border-default))'}
              />
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted, #ccc)', lineHeight: 1.5 }}>
                This becomes the intelligence Halvex uses to score, brief, and coach you on this deal.
              </p>
            </div>
          </div>

          <button
            onClick={handleDealSave}
            disabled={!prospect.trim() || dealSaving}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
              background: !prospect.trim() ? 'var(--surface-2, #f5f5f5)' : 'var(--brand)',
              color: !prospect.trim() ? 'var(--text-tertiary, #aaa)' : '#fff',
              fontSize: '15px', fontWeight: 700, fontFamily: 'inherit',
              cursor: !prospect.trim() || dealSaving ? 'not-allowed' : 'pointer',
              opacity: dealSaving ? 0.8 : 1,
              transition: 'all 0.2s',
            }}
          >
            {dealSaving ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Analysing deal...
              </>
            ) : (
              <>
                Save and analyse
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <button
            onClick={() => setStep('welcome')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '13px', color: 'var(--text-tertiary, #aaa)', fontFamily: 'inherit',
              padding: '4px', textAlign: 'center',
            }}
          >
            ← Back
          </button>
        </div>
      )}

      {/* ── Step 3: Ready ────────────────────────────────────────────────── */}
      {step === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fade-up 0.4s ease-out' }}>
          <div style={{ textAlign: 'center', paddingTop: '12px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              animation: 'pulse-ring 2s ease-out 1',
            }}>
              <CheckCircle size={28} color="#fff" />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: 0, color: 'var(--text-primary, #1a1a1a)', marginBottom: '10px' }}>
              You&apos;re all set
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary, #777)', lineHeight: 1.7, maxWidth: '420px', margin: '0 auto' }}>
              {prospect} has been added to your pipeline. Halvex is now learning your deal patterns.
            </p>
          </div>

          {/* Deal score card */}
          {dealScore != null && (
            <div style={{
              background: 'var(--surface-1, #fff)', border: '1px solid var(--border-default, var(--border-default))',
              borderRadius: '14px', padding: '22px 24px',
              display: 'flex', alignItems: 'center', gap: '18px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '14px',
                background: dealScore >= 60 ? 'var(--brand)' : dealScore >= 40 ? '#f59e0b' : '#3b82f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>
                {dealScore}
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary, #1a1a1a)' }}>
                  Initial deal score
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary, #aaa)', marginTop: '3px' }}>
                  Based on {STAGE_OPTIONS.find(s => s.value === stage)?.label ?? stage} stage. Updates as you add more context.
                </div>
              </div>
            </div>
          )}

          {/* Extraction result */}
          {extractionResult && (
            <div style={{
              background: 'var(--brand)08', border: '1px solid var(--brand)20',
              borderRadius: '12px', padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: '10px',
              fontSize: '13px', color: 'var(--brand)', fontWeight: 600,
            }}>
              <Sparkles size={15} />
              {extractionResult}
            </div>
          )}

          {/* Brain status */}
          <div style={{
            background: 'var(--surface-1, #fff)', border: '1px solid var(--border-default, var(--border-default))',
            borderRadius: '14px', padding: '20px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: brainPatterns.length > 0 ? '14px' : 0 }}>
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                background: brainStatus === 'live' ? 'var(--brand)' : brainStatus === 'polling' ? '#f59e0b' : '#ddd',
                transition: 'background 0.3s',
              }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #1a1a1a)' }}>
                {brainStatus === 'live'
                  ? 'Intelligence is live'
                  : brainStatus === 'polling'
                    ? 'Building your deal intelligence...'
                    : 'Intelligence will activate shortly'}
              </span>
              {brainStatus === 'polling' && (
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#f59e0b', marginLeft: 'auto' }} />
              )}
            </div>
            {brainPatterns.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '20px' }}>
                {brainPatterns.map((p, i) => (
                  <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary, #777)', lineHeight: 1.5 }}>
                    · {p}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* What's next */}
          <div style={{
            background: 'var(--surface-1, #fff)', border: '1px solid var(--border-default, var(--border-default))',
            borderRadius: '14px', padding: '20px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary, #aaa)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
              What happens next
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Add more deals to build pipeline intelligence', done: false },
                { label: 'Paste meeting notes after every call', done: false },
                { label: 'Check your Daily Focus briefing each morning', done: false },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary, #777)' }}>
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%',
                    border: '1.5px solid var(--border-default, #ddd)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-default, #ddd)' }} />
                  </div>
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {savedDealId && (
              <button
                onClick={() => router.push(`/deals/${savedDealId}`)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '14px', borderRadius: '10px',
                  border: '1px solid var(--border-default, var(--border-default))',
                  background: 'var(--surface-1, #fff)', color: 'var(--text-primary, #1a1a1a)',
                  fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                View deal
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '14px', borderRadius: '10px', border: 'none',
                background: 'var(--brand)', color: '#fff',
                fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              Go to dashboard
              <ArrowRight size={16} />
            </button>
          </div>
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
