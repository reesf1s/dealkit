'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, ArrowRight, CheckCircle, Building2, Users, Loader2, ClipboardPaste, Zap, Target, FileText, ClipboardList, LogIn } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<'paste' | 'review' | 'saving' | 'generating' | 'done' | 'join'>('paste')
  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState('')

  async function handleJoin() {
    if (!joinCode.trim()) return
    setJoinLoading(true)
    setJoinError('')
    try {
      const res = await fetch('/api/workspaces/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to join workspace')
      router.push('/dashboard')
    } catch (e: unknown) {
      setJoinError(e instanceof Error ? e.message : 'Failed to join. Try again.')
    } finally {
      setJoinLoading(false)
    }
  }
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatingProgress, setGeneratingProgress] = useState<{ name: string; done: boolean }[]>([])

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

      // Save competitors + collect their IDs
      const createdCompetitors: { id: string; name: string }[] = []
      for (const comp of (parsed.competitors ?? [])) {
        const res = await fetch('/api/competitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(comp),
        })
        const data = await res.json()
        if (data.data?.id) {
          createdCompetitors.push({ id: data.data.id, name: comp.name })
        }
      }

      // If we have competitors, generate battlecards for each
      if (createdCompetitors.length > 0) {
        setStep('generating')
        setGeneratingProgress(createdCompetitors.map(c => ({ name: c.name, done: false })))

        await Promise.all(createdCompetitors.map(async (comp, idx) => {
          try {
            await fetch('/api/collateral/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'battlecard', competitorId: comp.id }),
            })
          } catch { /* best effort */ }
          setGeneratingProgress(prev =>
            prev.map((p, i) => i === idx ? { ...p, done: true } : p)
          )
        }))

        setStep('done')
      } else {
        router.push('/dashboard?onboarded=1')
      }
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
          Paste anything — a pitch deck, company page, or notes — and AI will fill in your profile <em>and</em> generate your first battlecards automatically
        </p>
      </div>

      {step === 'paste' && (
        <>
          <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

          {/* What AI creates */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: '4px' }}>What AI creates automatically</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { icon: Building2, label: 'Company profile', desc: 'Name, industry, description, products', color: '#818CF8' },
                { icon: Users, label: 'Competitors', desc: 'Any competitors mentioned in text', color: '#A78BFA' },
                { icon: Sparkles, label: 'Value props & differentiators', desc: 'Key advantages and objections', color: '#6366F1' },
                { icon: FileText, label: 'Battlecards (auto-generated)', desc: 'Full AI battlecard per competitor found', color: '#22C55E' },
              ].map(({ icon: Icon, label, desc, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' }}>
                  <div style={{ width: '28px', height: '28px', background: `${color}14`, border: `1px solid ${color}22`, borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={13} color={color} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#EBEBEB', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontSize: '11px', color: '#555' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI workflows preview */}
          <div style={{ background: 'rgba(99,102,241,0.05)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <Zap size={13} color="#818CF8" />
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#818CF8' }}>After setup, you'll be able to:</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                '📋 Paste call notes → AI extracts todos, blockers & opportunities',
                '🎯 Get AI conversion score (0-100) + specific next steps per deal',
                '⚔️ Ask AI to create battlecards: "Create battlecard for Salesforce"',
                '🔍 AI auto-identifies product gaps from lost deals',
              ].map(item => (
                <div key={item} style={{ fontSize: '12px', color: '#9CA3AF', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => setStep('join')}
              style={{ background: 'none', border: 'none', color: '#6366F1', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}
            >
              <LogIn size={12} />
              Joining a team? Enter your invite code instead
            </button>
            <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#444', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
              Skip — set up manually
            </button>
          </div>
        </>
      )}

      {step === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LogIn size={15} color="#818CF8" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#EBEBEB' }}>Join your team's workspace</span>
            </div>
            <p style={{ fontSize: '13px', color: '#888', margin: 0, lineHeight: '1.6' }}>
              Ask your team admin for the workspace invite code (visible in their Settings → Team section). It looks like <code style={{ color: '#818CF8', background: 'rgba(99,102,241,0.1)', padding: '1px 6px', borderRadius: '4px', fontSize: '12px' }}>crane-47</code>.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="e.g. crane-47"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  color: '#EBEBEB',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  letterSpacing: '0.05em',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
              {joinError && <div style={{ fontSize: '12px', color: '#EF4444' }}>{joinError}</div>}
            </div>
            <button
              onClick={handleJoin}
              disabled={!joinCode.trim() || joinLoading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px', borderRadius: '10px', border: 'none',
                cursor: joinLoading || !joinCode.trim() ? 'not-allowed' : 'pointer',
                background: joinLoading || !joinCode.trim() ? 'rgba(99,102,241,0.2)' : 'linear-gradient(135deg, #6366F1, #7C3AED)',
                color: '#fff', fontSize: '14px', fontWeight: '600',
                boxShadow: joinLoading || !joinCode.trim() ? 'none' : '0 0 24px rgba(99,102,241,0.4)',
                transition: 'all 0.2s',
              }}
            >
              {joinLoading ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Joining...</> : <>Join workspace <ArrowRight size={14} /></>}
            </button>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button onClick={() => setStep('paste')} style={{ background: 'none', border: 'none', color: '#555', fontSize: '12px', cursor: 'pointer' }}>
              ← Back to create a new workspace instead
            </button>
          </div>
        </div>
      )}

      {step === 'review' && parsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={14} color="#22C55E" />
            <span style={{ fontSize: '13px', color: '#22C55E', fontWeight: '500' }}>AI extracted your company info — review before saving</span>
          </div>

          {/* Company preview */}
          <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
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
            <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Users size={14} color="#818CF8" />
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#EBEBEB' }}>{parsed.competitors.length} Competitors Found</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', padding: '8px 10px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: '8px' }}>
                <Sparkles size={11} color="#22C55E" />
                <span style={{ fontSize: '11px', color: '#22C55E' }}>AI will automatically generate a battlecard for each competitor after saving</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {parsed.competitors.map((c: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <div style={{ width: '28px', height: '28px', background: 'rgba(99,102,241,0.1)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px', fontWeight: '700', color: '#818CF8' }}>
                      {c.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#EBEBEB' }}>{c.name}</div>
                      {c.description && <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>{c.description.slice(0, 80)}{c.description.length > 80 ? '...' : ''}</div>}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6366F1', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '2px 7px', borderRadius: '100px', fontWeight: '600', flexShrink: 0 }}>
                      + Battlecard
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
              Save & generate battlecards <ArrowRight size={14} />
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

      {step === 'generating' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
              <Sparkles size={18} color="#818CF8" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#F0EEFF' }}>Generating your battlecards...</span>
            </div>
            <p style={{ fontSize: '13px', color: '#555' }}>AI is building competitive intelligence for each competitor</p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {generatingProgress.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <div style={{ width: '28px', height: '28px', background: item.done ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.done
                    ? <CheckCircle size={14} color="#22C55E" />
                    : <Loader2 size={14} color="#818CF8" style={{ animation: 'spin 1s linear infinite' }} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#EBEBEB' }}>{item.name}</div>
                  <div style={{ fontSize: '11px', color: item.done ? '#22C55E' : '#555', marginTop: '1px' }}>
                    {item.done ? 'Battlecard generated ✓' : 'Generating battlecard...'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 24px rgba(34,197,94,0.15)' }}>
              <CheckCircle size={24} color="#22C55E" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#F0EEFF', marginBottom: '8px', letterSpacing: '-0.03em' }}>You're all set!</h2>
            <p style={{ fontSize: '13px', color: '#555', lineHeight: '1.6' }}>
              Your company profile, competitors, and battlecards are ready.<br />Here's what to do next:
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { icon: ClipboardList, label: 'Log your first deal', desc: 'Track a prospect and get AI deal scoring', href: '/deals', color: '#F59E0B' },
              { icon: FileText, label: 'View your battlecards', desc: 'AI-generated competitive intel is ready', href: '/collateral?type=battlecard', color: '#6366F1' },
              { icon: Target, label: 'Open AI chat', desc: 'Ask AI to create more collateral or analyze deals', href: '/chat', color: '#A78BFA' },
            ].map(({ icon: Icon, label, desc, href, color }) => (
              <a key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px', background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '10px', textDecoration: 'none',
                transition: 'border-color 0.1s, background 0.1s',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.borderColor = `${color}33`
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'
              }}
              >
                <div style={{ width: '32px', height: '32px', background: `${color}14`, border: `1px solid ${color}22`, borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#F0EEFF' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{desc}</div>
                </div>
                <ArrowRight size={14} color="#444" />
              </a>
            ))}
          </div>

          <button onClick={() => router.push('/dashboard?onboarded=1')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
            color: '#fff', fontSize: '14px', fontWeight: '600',
            boxShadow: '0 0 24px rgba(99,102,241,0.4)',
          }}>
            Go to Dashboard <ArrowRight size={15} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
      `}</style>
    </div>
  )
}
