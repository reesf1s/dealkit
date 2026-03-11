'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, ArrowRight, CheckCircle, Building2, Users, Loader2, ClipboardPaste } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<'paste' | 'review' | 'saving'>('paste')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleParse = async () => {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setParsed(data)
      setStep('review')
    } catch (e: any) {
      setError(e.message ?? 'Failed to parse. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setStep('saving')
    try {
      // Save company profile
      await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.company),
      })
      // Save competitors
      for (const comp of (parsed.competitors ?? [])) {
        await fetch('/api/competitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(comp),
        })
      }
      router.push('/dashboard?onboarded=1')
    } catch (e) {
      setStep('review')
      setError('Failed to save. Please try again.')
    }
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
          border: '1px solid rgba(99,102,241,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          boxShadow: '0 0 32px rgba(99,102,241,0.2)',
        }}>
          <Sparkles size={24} color="#818CF8" />
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.04em', color: '#F1F1F3', marginBottom: '8px' }}>
          Set up DealKit in 30 seconds
        </h1>
        <p style={{ fontSize: '14px', color: '#555', lineHeight: '1.6' }}>
          Paste anything — a pitch deck, company page, or notes — and AI will fill in your profile automatically
        </p>
      </div>

      {step === 'paste' && (
        <>
          <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardPaste size={15} color="#818CF8" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#EBEBEB' }}>Paste your content</span>
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste your pitch deck text, company website copy, LinkedIn about section, sales deck, or any text describing your company and competitors..."
              rows={10}
              style={{
                width: '100%', resize: 'vertical', background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
                color: '#EBEBEB', fontSize: '13px', lineHeight: '1.6', padding: '14px',
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
              onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)'}
              onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}
            />
            {error && <div style={{ fontSize: '12px', color: '#EF4444' }}>{error}</div>}
            <button
              onClick={handleParse}
              disabled={!text.trim() || loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px', borderRadius: '10px', border: 'none', cursor: loading || !text.trim() ? 'not-allowed' : 'pointer',
                background: loading || !text.trim() ? 'rgba(99,102,241,0.2)' : 'linear-gradient(135deg, #6366F1, #7C3AED)',
                color: '#fff', fontSize: '14px', fontWeight: '600',
                boxShadow: loading || !text.trim() ? 'none' : '0 0 24px rgba(99,102,241,0.4)',
                transition: 'all 0.2s',
              }}
            >
              {loading ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing with AI...</> : <><Sparkles size={15} /> Auto-fill my profile</>}
            </button>
          </div>

          {/* What gets filled */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { icon: Building2, label: 'Company profile', desc: 'Name, industry, description, products' },
              { icon: Users, label: 'Competitors', desc: 'Any competitors mentioned in text' },
              { icon: Sparkles, label: 'Value props', desc: 'Key differentiators and advantages' },
              { icon: CheckCircle, label: 'Target market', desc: 'ICP and target customer info' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                <div style={{ width: '28px', height: '28px', background: 'rgba(99,102,241,0.1)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={13} color="#818CF8" />
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#EBEBEB', marginBottom: '2px' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: '#555' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 'review' && parsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={14} color="#22C55E" />
            <span style={{ fontSize: '13px', color: '#22C55E', fontWeight: '500' }}>AI extracted your company info — review before saving</span>
          </div>

          {/* Company preview */}
          <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Building2 size={14} color="#818CF8" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#EBEBEB' }}>Company Profile</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { label: 'Company', value: parsed.company?.companyName },
                { label: 'Industry', value: parsed.company?.industry },
                { label: 'Website', value: parsed.company?.website },
                { label: 'Target Market', value: parsed.company?.targetMarket },
              ].map(({ label, value }) => value ? (
                <div key={label}>
                  <div style={{ fontSize: '11px', color: '#555', marginBottom: '2px' }}>{label}</div>
                  <div style={{ fontSize: '13px', color: '#EBEBEB', fontWeight: '500' }}>{value}</div>
                </div>
              ) : null)}
            </div>
            {parsed.company?.description && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Description</div>
                <div style={{ fontSize: '13px', color: '#888', lineHeight: '1.6' }}>{parsed.company.description}</div>
              </div>
            )}
          </div>

          {/* Competitors preview */}
          {parsed.competitors?.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Users size={14} color="#818CF8" />
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#EBEBEB' }}>{parsed.competitors.length} Competitors Found</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {parsed.competitors.map((c: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <div style={{ width: '28px', height: '28px', background: 'rgba(99,102,241,0.1)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px', fontWeight: '700', color: '#818CF8' }}>
                      {c.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#EBEBEB' }}>{c.name}</div>
                      {c.description && <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>{c.description.slice(0, 80)}{c.description.length > 80 ? '...' : ''}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div style={{ fontSize: '12px', color: '#EF4444' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep('paste')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#888', fontSize: '13px', cursor: 'pointer' }}>
              ← Edit paste
            </button>
            <button onClick={handleSave} style={{
              flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
              color: '#fff', fontSize: '13px', fontWeight: '600',
              boxShadow: '0 0 24px rgba(99,102,241,0.3)',
            }}>
              Save & go to dashboard <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {step === 'saving' && (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#818CF8', marginBottom: '12px' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '16px', fontWeight: '500' }}>Saving your profile...</span>
          </div>
          <p style={{ fontSize: '13px', color: '#555' }}>Setting up your workspace</p>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
