import React from 'react'
import Link from 'next/link'
import { ArrowRight, Zap, Shield, CheckCircle, FileText, Users, Target, BookOpen, Mail, ChevronRight, TrendingUp, Lock, Brain, BarChart3, MessageSquare, AlertTriangle, Layers } from 'lucide-react'
import ROICalc from '@/components/marketing/ROICalc'
import FeaturesTab from '@/components/marketing/FeaturesTab'

const NAV: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 40px', height: '56px',
  background: 'rgba(7,5,15,0.85)', backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  borderBottom: '1px solid rgba(139,92,246,0.12)',
}

const COLLATERAL_TYPES = [
  { icon: Shield, label: 'Battlecard', desc: 'Win every competitive deal with real intel on every rival — updated automatically as your pipeline shifts.' },
  { icon: BookOpen, label: 'Case Study', desc: 'Turn closed-won deals into compelling proof stories that close the next one.' },
  { icon: FileText, label: 'One-Pager', desc: 'Product overviews that sell the outcome, not the feature list.' },
  { icon: Target, label: 'Objection Handler', desc: 'Every pushback your team will face, with responses grounded in what actually worked.' },
  { icon: Users, label: 'Talk Track', desc: 'Tailored messaging for every buyer persona — CTO, CFO, Head of Ops.' },
  { icon: Mail, label: 'Email Sequence', desc: 'Follow-up sequences grounded in real deal outcomes and proven responses from your pipeline.' },
]

const PRICING = [
  {
    name: 'Free', price: '£0', period: '',
    features: ['1 product', '2 competitors', '5 case studies', '10 deal logs', '5 collateral items'],
    cta: 'Get started', highlight: false,
  },
  {
    name: 'Starter', price: '£79', period: '/mo',
    features: ['3 products', '10 competitors', 'Unlimited case studies', 'Unlimited deals', 'Unlimited collateral', '.docx export', 'No watermark'],
    cta: 'Start free trial', highlight: true,
  },
  {
    name: 'Pro', price: '£149', period: '/mo',
    features: ['Everything in Starter', 'Unlimited products', 'Batch regenerate', 'Email sequences', 'AI meeting prep', 'Team features'],
    cta: 'Start free trial', highlight: false,
  },
]

export default function LandingPage() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #07050F 0%, #0B0716 40%, #080512 100%)',
      minHeight: '100vh', color: '#EBEBEB',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* Background blobs */}
      <div style={{ position: 'fixed', top: '-120px', left: '-80px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-120px', right: '-80px', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Nav */}
      <nav style={NAV}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '26px', height: '26px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={13} color="#fff" />
          </div>
          <span style={{ fontWeight: '700', fontSize: '15px', letterSpacing: '-0.02em', color: '#F0EEFF' }}>DealKit</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a href="#how-it-works" style={{ padding: '6px 14px', borderRadius: '6px', color: '#888', fontSize: '13px', textDecoration: 'none' }}>How it works</a>
          <a href="#intelligence" style={{ padding: '6px 14px', borderRadius: '6px', color: '#888', fontSize: '13px', textDecoration: 'none' }}>Intelligence</a>
          <a href="#pricing" style={{ padding: '6px 14px', borderRadius: '6px', color: '#888', fontSize: '13px', textDecoration: 'none' }}>Pricing</a>
          <Link href="/sign-in" style={{ padding: '6px 14px', borderRadius: '6px', color: '#888', fontSize: '13px', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/sign-up" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', boxShadow: '0 0 14px rgba(99,102,241,0.35)', borderRadius: '7px', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
            Start Free <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, paddingTop: '160px', paddingBottom: '100px', textAlign: 'center', maxWidth: '760px', margin: '0 auto', padding: '160px 32px 80px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '100px', fontSize: '12px', color: '#A78BFA', fontWeight: '600', marginBottom: '28px' }}>
          <Zap size={11} />
          Your pipeline · your history · industry context
        </div>
        <h1 style={{ fontSize: '58px', fontWeight: '800', letterSpacing: '-0.05em', lineHeight: '1.06', marginBottom: '22px', background: 'linear-gradient(180deg, #F0EEFF 50%, #8B6FD4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Know which deals<br />to chase. Today.
        </h1>
        <p style={{ fontSize: '18px', color: '#7E7A9A', lineHeight: '1.7', marginBottom: '36px', maxWidth: '560px', margin: '0 auto 36px' }}>
          DealKit scores every open deal against your own win history, surfaces what needs attention each morning, and benchmarks your performance against hundreds of similar deals across the industry.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/sign-up" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '12px 24px', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', boxShadow: '0 0 24px rgba(99,102,241,0.4), 0 4px 16px rgba(0,0,0,0.3)', borderRadius: '9px', color: '#fff', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
            Start for free <ArrowRight size={14} />
          </Link>
          <a href="#how-it-works" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '12px 24px', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', color: '#C4B5FD', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}>
            See how it works
          </a>
        </div>
        <p style={{ marginTop: '18px', fontSize: '12px', color: '#4B4565' }}>Free forever · No credit card required · Set up in under 10 minutes</p>
      </section>

      {/* ── APP PREVIEW ─────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '1000px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ background: 'rgba(9,6,18,0.9)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.08)' }}>
          <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ marginLeft: '8px', fontSize: '11px', color: '#4B4565' }}>dealkit.app/dashboard</div>
          </div>
          <div style={{ display: 'flex', height: '500px' }}>
            {/* Sidebar */}
            <div style={{ width: '188px', padding: '12px 8px', borderRight: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ padding: '6px 10px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '22px', height: '22px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '6px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#F0EEFF', letterSpacing: '-0.02em' }}>DealKit</span>
              </div>
              {[['Dashboard', true], ['Pipeline', false], ['Deals', false], ['AI Chat', false], ['Case Studies', false], ['Competitors', false], ['Collateral', false], ['Product Gaps', false]].map(([label, active]) => (
                <div key={String(label)} style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '12px', color: active ? '#C4B5FD' : '#4A4A5A', background: active ? 'rgba(99,102,241,0.12)' : 'transparent', border: active ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: active ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
                  {String(label)}
                </div>
              ))}
            </div>

            {/* Main */}
            <div style={{ flex: 1, padding: '16px 20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0EEFF', letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #F0EEFF, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Good morning, Rees</div>
                  <div style={{ fontSize: '10px', color: '#555', marginTop: '1px' }}>6 open deals · 3 need attention today</div>
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <div style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '600', color: '#fff', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', boxShadow: '0 0 10px rgba(99,102,241,0.3)' }}>✦ AI Briefing</div>
                </div>
              </div>

              {/* AI Briefing */}
              <div style={{ background: 'linear-gradient(135deg, rgba(18,12,38,0.95), rgba(22,12,44,0.95))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '10px', padding: '12px 14px', boxShadow: '0 0 20px rgba(99,102,241,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>✦</div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#F0EEFF' }}>Today&apos;s briefing</span>
                  <span style={{ fontSize: '9px', color: '#6366F1', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '1px 6px', borderRadius: '100px' }}>ML-scored · updated nightly</span>
                </div>
                <div style={{ fontSize: '11px', color: '#C4B5FD', lineHeight: '1.55', marginBottom: '8px' }}>
                  Pipeline healthy at £148k ARR across 6 deals. Acme Corp (score 71) is your highest-value opportunity — send the proposal today. Notion has gone quiet for 14 days; follow up or mark at risk.
                </div>
                <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: '7px', padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '9px', color: '#818CF8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>⚡ Priority actions</div>
                  {['Send proposal to Acme Corp (£32k · score 71 · Negotiation)', 'Follow up Notion — 14 days silent, score dropped to 38', 'Stripe discovery call booked Thu — review battlecard vs Salesforce'].map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                      <div style={{ width: '9px', height: '9px', borderRadius: '50%', border: '1px solid rgba(99,102,241,0.5)', flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ fontSize: '10px', color: '#D4CCFF', lineHeight: '1.4' }}>{a}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* KPIs + deal strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
                {[['Pipeline', '£148k ARR', '#8B5CF6', true], ['Won (90d)', '£89k', '#22C55E', false], ['Win Rate', '68%', '#6366F1', false], ['Avg Close', '38 days', '#F59E0B', false]].map(([label, val, color, feat]) => (
                  <div key={String(label)} style={{ background: feat ? 'rgba(18,12,32,0.8)' : 'rgba(255,255,255,0.025)', border: `1px solid ${feat ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', padding: '10px 11px', boxShadow: feat ? '0 0 16px rgba(99,102,241,0.15)' : 'none' }}>
                    <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px' }}>{String(label)}</div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: String(color), letterSpacing: '-0.03em', lineHeight: 1 }}>{String(val)}</div>
                  </div>
                ))}
              </div>

              {/* Deal list */}
              <div style={{ background: 'rgba(18,12,32,0.7)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '8px', overflow: 'hidden', flex: 1 }}>
                <div style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '10px', fontWeight: '600', color: '#888' }}>Open deals — sorted by AI score</div>
                {[
                  ['Acme Corp', '£32k', 71, '#22C55E', 'Negotiation', '↑ Strong'],
                  ['Stripe', '£18k', 58, '#F59E0B', 'Discovery', '→ Steady'],
                  ['Notion', '£24k', 38, '#EF4444', 'Proposal', '↓ Stalling'],
                ].map(([co, val, score, color, stage, trend], i) => (
                  <div key={String(co)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 12px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: `${String(color)}15`, border: `1px solid ${String(color)}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: String(color), flexShrink: 0 }}>{Number(score)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#EBEBEB', fontWeight: '600' }}>{String(co)}</div>
                      <div style={{ fontSize: '9px', color: '#555' }}>{String(stage)}</div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#C4B5FD', fontWeight: '700' }}>{String(val)}</div>
                    <span style={{ fontSize: '9px', color: String(color), background: `${String(color)}12`, padding: '2px 6px', borderRadius: '100px', flexShrink: 0 }}>{String(trend)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS (3 plain steps) ──────────────────────────────────────── */}
      <section id="how-it-works" style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <h2 style={{ fontSize: '34px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '12px', color: '#F0EEFF' }}>Set up in a morning.<br />Value from day one.</h2>
          <p style={{ color: '#7E7A9A', fontSize: '15px', maxWidth: '500px', margin: '0 auto', lineHeight: '1.65' }}>Most tools take months to show ROI. DealKit generates useful collateral from the moment you add your product and first competitor.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          {[
            {
              n: '01', icon: '🏢', title: 'Tell it about your business',
              desc: 'Add your product, value props, known capabilities, and competitors. Takes 10 minutes. DealKit immediately generates tailored battlecards, objection handlers, and talk tracks.',
              detail: 'You\'re already useful from day one — no historical data required.',
            },
            {
              n: '02', icon: '📋', title: 'Log deals and paste your notes',
              desc: 'After each meeting, paste in your notes. DealKit extracts todos, risks, product gaps, and competitor mentions automatically — then scores the deal.',
              detail: 'No CRM sync needed. Works with any notes you already write.',
            },
            {
              n: '03', icon: '🧠', title: 'The system learns as you close',
              desc: 'Every closed deal trains your private ML model. Win probability, forecast accuracy, competitive patterns, and collateral relevance all improve with every outcome you log.',
              detail: 'After 10+ closed deals, scores are driven by your own data. Opt in and your win rates also benchmark against the industry — zero PII ever leaves your workspace.',
            },
          ].map(({ n, icon, title, desc, detail }) => (
            <div key={n} style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '26px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
                <div style={{ fontSize: '22px', lineHeight: 1 }}>{icon}</div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#4B4568', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{n}</span>
              </div>
              <div style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '-0.02em', color: '#F0EEFF' }}>{title}</div>
              <div style={{ fontSize: '13px', color: '#7E7A9A', lineHeight: '1.65' }}>{desc}</div>
              <div style={{ fontSize: '11.5px', color: '#6366F1', padding: '7px 10px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '7px', lineHeight: '1.5' }}>{detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── THE DEAL VIEW ─────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center' }}>
          {/* Left: copy */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '100px', fontSize: '11px', color: '#A78BFA', fontWeight: '600', marginBottom: '20px' }}>
              <Target size={10} />
              Every deal, intelligently scored
            </div>
            <h2 style={{ fontSize: '30px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '16px', color: '#F0EEFF', lineHeight: '1.15' }}>
              Paste your notes.<br />Get a scored deal back.
            </h2>
            <p style={{ fontSize: '14px', color: '#7E7A9A', lineHeight: '1.7', marginBottom: '20px' }}>
              After every meeting, paste your notes into DealKit. Within seconds it extracts action items, surfaces risks, identifies product gaps, and scores the deal — using a model trained on your own win history.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { icon: '🎯', label: 'Deal score', desc: 'Win probability trained on your closed deals — not industry benchmarks' },
                { icon: '⚡', label: 'Action items extracted', desc: 'Todos auto-pulled from notes and added to your deal' },
                { icon: '⚠️', label: 'Risk flags', desc: 'Observable signals from this meeting only — no hallucinated assumptions' },
                { icon: '🏁', label: 'Competitor tracking', desc: 'Competitors mentioned in notes logged automatically to your W/L record' },
              ].map(({ icon, label, desc }) => (
                <div key={label} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#F0EEFF', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontSize: '12px', color: '#7E7A9A', lineHeight: '1.5' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: deal card mockup */}
          <div style={{ background: 'rgba(9,6,18,0.9)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Deal header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#F0EEFF', marginBottom: '2px' }}>Acme Corp</div>
                <div style={{ fontSize: '10px', color: '#555' }}>Sarah Chen · VP Product · £32,000</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '26px', fontWeight: '800', color: '#22C55E', letterSpacing: '-0.04em', lineHeight: 1 }}>71</div>
                <div style={{ fontSize: '8px', color: '#4ADE80', marginTop: '1px' }}>Win probability</div>
              </div>
            </div>

            {/* Score insights */}
            <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontSize: '9px', color: '#4ADE80', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>AI Score Insights</div>
              {['Champion confirmed: Sarah advocating internally for DealKit', 'Budget approved — finance sign-off confirmed in last call', 'Evaluating Salesforce: our win rate vs Salesforce is 70%'].map((ins, i) => (
                <div key={i} style={{ fontSize: '10px', color: '#C4B5FD', lineHeight: '1.4', marginBottom: i < 2 ? '4px' : 0 }}>• {ins}</div>
              ))}
            </div>

            {/* Risks */}
            <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontSize: '9px', color: '#F59E0B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Risk Signals</div>
              {['No formal close date set', 'Legal review not yet started'].map((r, i) => (
                <div key={i} style={{ fontSize: '10px', color: '#FDE68A', lineHeight: '1.4', marginBottom: i < 1 ? '3px' : 0 }}>⚠ {r}</div>
              ))}
            </div>

            {/* Todos */}
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontSize: '9px', color: '#888', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Auto-extracted actions</div>
              {['Send pricing deck with enterprise tier breakdown', 'Schedule legal review intro call', 'Share Acme case study with Sarah before Friday'].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: i < 2 ? '4px' : 0 }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1px solid rgba(99,102,241,0.5)', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '10px', color: '#D4CCFF', lineHeight: '1.4' }}>{t}</span>
                </div>
              ))}
            </div>

            {/* Stage badge */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '3px 9px', borderRadius: '100px', fontWeight: '600' }}>Negotiation</span>
              <span style={{ fontSize: '10px', color: '#A78BFA', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', padding: '3px 9px', borderRadius: '100px' }}>Similar to 3 won deals</span>
              <span style={{ fontSize: '10px', color: '#22C55E', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', padding: '3px 9px', borderRadius: '100px' }}>Close: ~12 days</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE INTELLIGENCE ENGINE ────────────────────────────────────────────── */}
      <section id="intelligence" style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 120px' }}>

        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '100px', fontSize: '12px', color: '#C4B5FD', fontWeight: '600', marginBottom: '20px' }}>
            <Brain size={11} />
            Three layers, fully private
          </div>
          <h2 style={{ fontSize: '36px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '16px', color: '#F0EEFF' }}>
            How DealKit figures out<br />which deals will close
          </h2>
          <p style={{ color: '#7E7A9A', fontSize: '16px', lineHeight: '1.7', maxWidth: '560px', margin: '0 auto' }}>
            No black-box AI guesses. Three distinct layers work together — each grounded in data, none dependent on generic models.
          </p>
        </div>

        {/* Three layer cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '40px' }}>
          {[
            {
              num: '1', icon: '📡', color: '#6366F1',
              title: 'Reads every note automatically',
              badge: 'No manual tagging',
              desc: 'Every meeting note is scanned for buying signals, risks, stall signs, and competitor mentions — automatically. No forms to fill in, no tagging. Just paste your notes and it extracts what matters.',
              outputs: ['Champion and budget status', 'Next step defined?', 'Objection category', 'Engagement direction (rising or falling)'],
            },
            {
              num: '2', icon: '🤖', color: '#8B5CF6',
              title: 'Learns from every deal you close',
              badge: 'Gets smarter over time',
              desc: 'Every time a deal closes, your model updates. Win probability, stage stall detection, close-date prediction, and competitive win conditions all improve as your history grows. All private — your data never trains anyone else\'s model.',
              outputs: ['Win probability per open deal', 'Which deals are stalling', 'Predicted close date', 'What beats each competitor'],
            },
            {
              num: '3', icon: '✦', color: '#A78BFA',
              title: 'Tells you what to do next',
              badge: 'Plain English, every morning',
              desc: 'Claude never generates a score. It reads the output of your ML model and explains it in plain English — which deals need action today, what the risks are, and what to do next. Scores come from your data; the explanation comes from the AI.',
              outputs: ['Daily pipeline briefing', 'Top deal to action now', 'Risk explanation per deal', 'Recommended single action'],
            },
          ].map(({ num, icon, color, title, badge, desc, outputs }) => (
            <div key={num} style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${color}25`, borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${color}80, transparent)` }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{icon}</div>
                <span style={{ fontSize: '9px', fontWeight: '700', color, background: `${color}14`, border: `1px solid ${color}25`, padding: '2px 8px', borderRadius: '100px' }}>{badge}</span>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#F0EEFF', marginBottom: '6px', letterSpacing: '-0.02em' }}>Layer {num}: {title}</div>
                <div style={{ fontSize: '12px', color: '#7E7A9A', lineHeight: '1.65' }}>{desc}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Outputs</div>
                {outputs.map((o, i) => (
                  <div key={i} style={{ fontSize: '10.5px', color: '#A78BFA', marginBottom: i < outputs.length - 1 ? '3px' : 0 }}>→ {o}</div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Composite scoring explanation */}
        <div style={{ background: 'linear-gradient(135deg, rgba(14,10,32,0.98), rgba(18,12,38,0.98))', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '14px', padding: '28px 32px', display: 'flex', gap: '28px', alignItems: 'flex-start', marginBottom: '48px' }}>
          <div style={{ flexShrink: 0, width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>⚖️</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#F0EEFF', letterSpacing: '-0.02em', marginBottom: '8px' }}>How the score works — and why it gets more accurate every month</div>
            <div style={{ fontSize: '13px', color: '#7E7A9A', lineHeight: '1.7', maxWidth: '680px', marginBottom: '12px' }}>
              At first, scores lean on observable signals from your notes. As you close deals, your own ML model takes over — automatically scaling from 0% to 70% weight as your training set grows. Opt into Industry Intelligence and your score also benchmarks against the industry from day one.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['4 deals → ML activates (14% weight)', '10 deals → ML at 33%', '30+ deals → ML at 70%', 'Your data, your model, private', 'Industry benchmarks from day one (opt-in)'].map(tag => (
                <div key={tag} style={{ fontSize: '11px', color: '#A78BFA', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', padding: '3px 10px', borderRadius: '100px', fontWeight: '600' }}>{tag}</div>
              ))}
            </div>
          </div>
        </div>

        {/* The data moat flywheel */}
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '36px', marginBottom: '48px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#818CF8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>The compounding moat</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#F0EEFF', letterSpacing: '-0.03em' }}>The longer you use it, the harder you are to beat</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0' }}>
            {[
              { milestone: 'Day 1', deals: '0 deals closed', desc: 'Battlecards, objection handlers, and talk tracks generated immediately from your product and competitor profiles.', color: '#4B4565' },
              { milestone: '1 month', deals: '4–10 deals', desc: 'ML activates. Win probability, weighted forecast, and competitive win/loss record all start accumulating.', color: '#6366F1' },
              { milestone: '3 months', deals: '20–50 deals', desc: 'Deal archetypes form. Per-competitor models emerge. Stage velocity baselines set. Scores now 33%+ ML-driven.', color: '#8B5CF6' },
              { milestone: '6 months', deals: '50+ deals', desc: 'You have logistic regression weights, KNN similarity search, trend detection, and calibrated forecasts — unique to your sales motion. And you can see exactly how you compare to the industry without exposing a single deal name.', color: '#A78BFA' },
            ].map(({ milestone, deals, desc, color }, i) => (
              <div key={milestone} style={{ padding: '20px', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, marginBottom: '12px', boxShadow: `0 0 8px ${color}60` }} />
                <div style={{ fontSize: '13px', fontWeight: '800', color, marginBottom: '2px', letterSpacing: '-0.02em' }}>{milestone}</div>
                <div style={{ fontSize: '10px', color: '#555', marginBottom: '8px' }}>{deals}</div>
                <div style={{ fontSize: '12px', color: '#7E7A9A', lineHeight: '1.55' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Nine ML models */}
        <div style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: '16px', padding: '36px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '20px', padding: '4px 12px', marginBottom: '14px' }}>
              <Brain size={11} color="#818CF8" />
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Proprietary ML engine</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#F0EEFF', letterSpacing: '-0.03em', marginBottom: '8px' }}>Nine models. All trained on your data. None replicable.</div>
            <div style={{ fontSize: '13px', color: '#7E7A9A', maxWidth: '520px', margin: '0 auto' }}>No shared infrastructure. Every model runs in your workspace, trained exclusively on your closed deal history.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { num: '01', title: 'Win probability — per deal, per morning', detail: 'Every open deal gets a 0–100 score each night. Trained on your closed deal history — not generic benchmarks. Tells you which deal to call first.' },
              { num: '02', title: 'Honest accuracy check', detail: 'The model tests itself every rebuild. It trains with one deal held out, checks its prediction, repeats for every deal. You always know how reliable your scores actually are.' },
              { num: '03', title: 'Finds your most similar past wins', detail: 'For each open deal, finds the 3 closest historical matches by deal shape, size, and signals. Shows you what happened last time you were in this situation.' },
              { num: '04', title: 'Groups your pipeline into deal types', detail: 'Clusters your deals into natural patterns — fast SMB, slow enterprise, competitive displacement. Each type has its own typical win rate and timeline.' },
              { num: '05', title: 'Per-competitor win conditions', detail: 'A separate model per competitor. Learns what signals predict beating Salesforce vs. HubSpot vs. Pipedrive. Your battlecards get smarter as the record grows.' },
              { num: '06', title: 'Trend detection across months', detail: 'Is your win rate improving? Getting slower to close? Winning more against a specific rival? Trend detection runs across monthly cohorts and tells you before it shows up in a missed quarter.' },
              { num: '07', title: 'Stage stall alerts', detail: 'Knows how long deals normally spend in each stage from your own history. Flags every deal that is taking longer than normal before it slips off your radar.' },
              { num: '08', title: 'Score calibration tracking', detail: 'Tracks the gap between scores on deals that won vs. those that lost over time. Tells you month-by-month whether your model is getting more predictive or drifting.' },
              { num: '09', title: 'Close-date prediction', detail: 'Trained on your won deals, predicts days to close for every open deal. Drives probability-weighted revenue forecasts for each month.' },
            ].map(({ num, title, detail }) => (
              <div key={num} style={{ display: 'flex', gap: '12px', padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#4B4565', fontVariantNumeric: 'tabular-nums', flexShrink: 0, paddingTop: '2px' }}>{num}</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#C4B5FD', marginBottom: '4px', letterSpacing: '-0.01em' }}>{title}</div>
                  <div style={{ fontSize: '12px', color: '#7E7A9A', lineHeight: '1.55' }}>{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* ── PIPELINE INTELLIGENCE ─────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '12px', color: '#F0EEFF' }}>
            What you see across your whole pipeline
          </h2>
          <p style={{ color: '#7E7A9A', fontSize: '15px', maxWidth: '500px', margin: '0 auto', lineHeight: '1.65' }}>
            Not just deal-level scores — DealKit surfaces patterns across your entire pipeline that would take hours to spot manually.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          {[
            { icon: '📊', title: 'Revenue forecast that earns its numbers', desc: 'Your pipeline value, multiplied by your actual win probability per deal — not a made-up 30% multiplier. Updates every night as deals move and close.', badge: 'Probability-weighted', badgeColor: '#8B5CF6' },
            { icon: '🧑‍💼', title: 'Rep coaching, without a manager doing the maths', desc: 'Win rate, to-do completion, deals with a next step, and days since last note — per rep. Every morning, automatically. Spot who needs support before the quarter ends.', badge: 'Per-rep stats', badgeColor: '#6366F1' },
            { icon: '⏰', title: 'Knows your safe follow-up window', desc: 'Learns how long deals in each stage can go without a note before they go cold — based on your own won deals. Alerts you before the silence becomes a problem.', badge: 'Cadence intelligence', badgeColor: '#22C55E' },
            { icon: '🏆', title: 'Objections you\'ve beaten before', desc: 'Budget concern on this deal? Legal blocker? DealKit shows you every time you\'ve faced that objection in the past — and whether you closed it anyway. Now with industry comparison.', badge: 'Objection Win Map', badgeColor: '#F59E0B' },
            { icon: '⚠️', title: 'Catches deals going cold', desc: 'Sentiment arc analysis compares how recent notes sound vs. earlier ones — flags deals that have gone quiet or where engagement is dropping before they ghost you.', badge: 'Deterioration alerts', badgeColor: '#EF4444' },
            { icon: '💬', title: 'Ask anything about your pipeline', desc: '"Which deals have budget concerns?" "Show me our win rate vs Salesforce this quarter." "Which reps have deals with no next step?" Answers grounded in your actual data.', badge: 'AI Chat', badgeColor: '#A78BFA' },
          ].map(({ icon, title, desc, badge, badgeColor }) => (
            <div key={title} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ fontSize: '22px', lineHeight: 1 }}>{icon}</div>
                <div style={{ fontSize: '9px', fontWeight: '700', color: badgeColor, background: `${badgeColor}14`, border: `1px solid ${badgeColor}30`, padding: '2px 7px', borderRadius: '100px', whiteSpace: 'nowrap' }}>{badge}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#F0EEFF', letterSpacing: '-0.02em' }}>{title}</div>
              <div style={{ fontSize: '12px', color: '#7E7A9A', lineHeight: '1.6', flex: 1 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── INDUSTRY INTELLIGENCE ─────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '100px', fontSize: '11px', color: '#A78BFA', fontWeight: '600', marginBottom: '20px' }}>
              <Brain size={10} />
              Industry Intelligence
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '14px', color: '#F0EEFF', lineHeight: '1.2' }}>
              See how you stack up<br />against the industry
            </h2>
            <p style={{ fontSize: '14px', color: '#7E7A9A', lineHeight: '1.7', marginBottom: '20px' }}>
              Opt in and your performance benchmarks anonymously against similar deals across the platform — giving you an industry win rate, close-speed comparison, and per-objection benchmark to measure against. Zero identifying information ever leaves your workspace.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {[
                'New workspace? Get ML predictions from day one based on industry patterns',
                'See your win rate vs. industry median — and exactly how far above or below',
                'Compare your close speed to the industry median and 75th percentile',
                'Per-objection benchmarks: is your budget-concern win rate above or below average?',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '9px', fontSize: '13px', color: '#C4B5FD', alignItems: 'flex-start' }}>
                  <CheckCircle size={13} color="#6366F1" style={{ flexShrink: 0, marginTop: '2px' }} />
                  {item}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['Opt-in only', 'Zero PII', 'GDPR Art.17 erasure', 'One-way anonymisation'].map(tag => (
                <div key={tag} style={{ fontSize: '11px', color: '#818CF8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '3px 9px', borderRadius: '100px' }}>{tag}</div>
              ))}
            </div>
          </div>

          {/* Industry benchmark mockup */}
          <div style={{ background: 'rgba(9,6,18,0.9)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>vs Industry</div>

            {/* Win rate comparison */}
            <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ fontSize: '9px', color: '#555', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Win rate</div>
              <div style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '10px', color: '#9CA3AF' }}>Your team</span>
                  <span style={{ fontSize: '11px', color: '#22C55E', fontWeight: '700' }}>68%</span>
                </div>
                <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{ height: '100%', width: '68%', background: '#22C55E', borderRadius: '3px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '10px', color: '#9CA3AF' }}>Industry median</span>
                  <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: '600' }}>52%</span>
                </div>
                <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '52%', background: '#6366F1', borderRadius: '3px' }} />
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#22C55E', fontWeight: '600' }}>▲ 16pts above industry median</div>
            </div>

            {/* Objection benchmarks */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ fontSize: '9px', color: '#555', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Objection Win Map vs Industry</div>
              {[
                { theme: 'budget concerns', yours: 61, industry: 48, delta: 13 },
                { theme: 'competitor pressure', yours: 55, industry: 51, delta: 4 },
                { theme: 'timeline slippage', yours: 38, industry: 44, delta: -6 },
              ].map(({ theme, yours, industry, delta }) => {
                const deltaColor = delta >= 5 ? '#22C55E' : delta <= -5 ? '#EF4444' : '#9CA3AF'
                return (
                  <div key={theme} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                    <span style={{ fontSize: '10px', color: '#9CA3AF', flex: 1, textTransform: 'capitalize' }}>{theme}</span>
                    <span style={{ fontSize: '11px', color: '#E5E7EB', fontWeight: '700', width: '28px', textAlign: 'right' }}>{yours}%</span>
                    <span style={{ fontSize: '10px', color: deltaColor, fontWeight: '600', width: '44px', textAlign: 'right' }}>
                      {delta >= 5 ? `▲ +${delta}` : delta <= -5 ? `▼ ${delta}` : `≈ ${industry}%`}
                    </span>
                  </div>
                )
              })}
            </div>

            <div style={{ fontSize: '10px', color: '#374151', textAlign: 'center' }}>Based on 2,400+ anonymised industry deals · Updated nightly</div>
          </div>
        </div>
      </section>

      {/* ── COMPETITIVE INTELLIGENCE ─────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '100px', fontSize: '11px', color: '#4ADE80', fontWeight: '600', marginBottom: '20px' }}>
              <Shield size={10} />
              Competitive intelligence
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '14px', color: '#F0EEFF', lineHeight: '1.2' }}>
              Know why you&apos;re winning —<br />and why you&apos;re losing
            </h2>
            <p style={{ fontSize: '14px', color: '#7E7A9A', lineHeight: '1.7', marginBottom: '20px' }}>
              Every deal note that mentions a competitor automatically updates your win/loss record. After a few deals, you&apos;ll know whether you beat Salesforce on budget, on features, or on speed — and your battlecards will say exactly that.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                'Live W/L record updated automatically from meeting notes',
                'Per-competitor ML model — what signals predict beating each rival',
                'Battlecards auto-regenerate when competitive patterns shift',
                'Losing streak alerts — flag when the same competitor beats you twice',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '9px', fontSize: '13px', color: '#C4B5FD', alignItems: 'flex-start' }}>
                  <CheckCircle size={13} color="#22C55E" style={{ flexShrink: 0, marginTop: '2px' }} />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Competitor record mockup */}
          <div style={{ background: 'rgba(9,6,18,0.9)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#4ADE80', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Competitor win/loss record</div>
            {[
              { name: 'Salesforce', w: 7, l: 3, winCondition: 'You win on speed + price. Lead with ROI.' },
              { name: 'HubSpot', w: 4, l: 4, winCondition: 'Even record. Champion presence key differentiator.' },
              { name: 'Pipedrive', w: 5, l: 1, winCondition: 'Strong lead. Win on reporting + intelligence.' },
            ].map(({ name, w, l, winCondition }) => {
              const pct = Math.round((w / (w + l)) * 100)
              const color = pct >= 60 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444'
              return (
                <div key={name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#EBEBEB', flex: 1 }}>{name}</div>
                    <div style={{ fontSize: '11px', color: '#4ADE80', fontWeight: '700', fontFamily: 'monospace' }}>{w}W</div>
                    <div style={{ fontSize: '9px', color: '#555' }}>·</div>
                    <div style={{ fontSize: '11px', color: '#F87171', fontWeight: '700', fontFamily: 'monospace' }}>{l}L</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color, minWidth: '36px', textAlign: 'right' }}>{pct}%</div>
                  </div>
                  <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '100px', marginBottom: '6px' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '100px' }} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#7E7A9A', lineHeight: '1.4' }}>📌 {winCondition}</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── PRODUCT GAPS ─────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center' }}>
          {/* Product gap mockup */}
          <div style={{ background: 'rgba(9,6,18,0.9)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Product gaps — auto-extracted from deals</div>
            {[
              { title: 'HubSpot native sync', freq: 4, revenue: '£89k', priority: 'critical', priorityColor: '#EF4444' },
              { title: 'Custom reporting builder', freq: 3, revenue: '£62k', priority: 'high', priorityColor: '#F59E0B' },
              { title: 'Mobile app', freq: 2, revenue: '£41k', priority: 'medium', priorityColor: '#8B5CF6' },
            ].map(({ title, freq, revenue, priority, priorityColor }) => (
              <div key={title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '9px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#EBEBEB' }}>{title}</div>
                  <span style={{ fontSize: '9px', color: priorityColor, background: `${priorityColor}14`, border: `1px solid ${priorityColor}30`, padding: '2px 7px', borderRadius: '100px', fontWeight: '700' }}>{priority}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: '#555' }}>
                  <span>{freq} deals mentioning this</span>
                  <span style={{ color: '#F59E0B' }}>{revenue} affected revenue</span>
                </div>
              </div>
            ))}
            <div style={{ fontSize: '10px', color: '#555', textAlign: 'center', paddingTop: '4px' }}>Pulled automatically from meeting notes · Updated per deal</div>
          </div>

          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '100px', fontSize: '11px', color: '#F59E0B', fontWeight: '600', marginBottom: '20px' }}>
              <AlertTriangle size={10} />
              Product gap intelligence
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '14px', color: '#F0EEFF', lineHeight: '1.2' }}>
              Turn lost deals into<br />your product roadmap
            </h2>
            <p style={{ fontSize: '14px', color: '#7E7A9A', lineHeight: '1.7', marginBottom: '20px' }}>
              Every time a prospect says your product is missing something, DealKit extracts and tracks it automatically. You get a prioritised list of product gaps — ranked by how many deals they appear in and how much revenue they put at risk.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                'Auto-extracted from meeting notes — no manual tagging needed',
                'Ranked by frequency × affected revenue',
                'Links back to source deals so you can talk to the prospects',
                'Status workflow: open → in review → on roadmap → shipped',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '9px', fontSize: '13px', color: '#C4B5FD', alignItems: 'flex-start' }}>
                  <CheckCircle size={13} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES TAB ─────────────────────────────────────────────────────── */}
      <FeaturesTab />

      {/* ── ROI CALCULATOR ───────────────────────────────────────────────────── */}
      <ROICalc />

      {/* ── COLLATERAL TYPES ─────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '12px', color: '#F0EEFF' }}>
            Everything your team needs to sell
          </h2>
          <p style={{ color: '#7E7A9A', fontSize: '15px', maxWidth: '480px', margin: '0 auto' }}>Six types of collateral — all grounded in your deal data, all regenerating automatically when the picture changes.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          {COLLATERAL_TYPES.map(({ icon: Icon, label, desc }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '22px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
              <div style={{ width: '34px', height: '34px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                <Icon size={15} color="#A78BFA" />
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '6px', color: '#F0EEFF', letterSpacing: '-0.02em' }}>{label}</div>
              <div style={{ fontSize: '12.5px', color: '#7E7A9A', lineHeight: '1.6' }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BEFORE / AFTER ───────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '12px', color: '#F0EEFF' }}>Before and after</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '28px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#EF4444', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Without DealKit</div>
            {[
              'Battlecards in a Google Doc no one updates',
              'No idea which deals are about to go cold',
              'Pipeline forecast based on gut feel',
              'Rep walks into a call cold on competitor objections',
              'Lost deal knowledge disappears with the rep',
              'Product gaps scattered across Slack and Notion',
              'New rep takes 3–6 months to ramp',
              'No idea how your win rate compares to similar companies',
              'Rep coaching happens quarterly in a spreadsheet, if at all',
              'New team doesn\'t get ML predictions until months of deals are closed',
            ].map(p => (
              <div key={p} style={{ display: 'flex', gap: '8px', marginBottom: '11px', fontSize: '13px', color: '#7E7A9A', alignItems: 'flex-start' }}>
                <span style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px', fontWeight: '700' }}>×</span> {p}
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '12px', padding: '28px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#22C55E', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>With DealKit</div>
            {[
              'Battlecards that regenerate when competitive patterns shift',
              'Every morning: which deals need you, and why',
              'Probability-adjusted forecast from your real conversion data',
              'Rep walks in knowing the last 3 risks, competitor record, and open actions',
              'Every closed deal trains the model and lives in the knowledge base',
              'Product gaps auto-extracted, prioritised by affected revenue',
              'New rep kit ready day one — playbooks, objections, proof stories',
              'Your win rate benchmarked against the industry — every morning',
              'Rep stats calculated automatically — win rate, to-do rate, cadence quality',
              'New workspace gets ML predictions from day one via industry context',
            ].map(p => (
              <div key={p} style={{ display: 'flex', gap: '8px', marginBottom: '11px', fontSize: '13px', color: '#7E7A9A', alignItems: 'flex-start' }}>
                <CheckCircle size={13} color="#22C55E" style={{ flexShrink: 0, marginTop: '2px' }} /> {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '12px', color: '#F0EEFF' }}>Simple pricing</h2>
          <p style={{ color: '#7E7A9A', fontSize: '15px' }}>Start free. Upgrade when your team is ready.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          {PRICING.map(({ name, price, period, features, cta, highlight }) => (
            <div key={name} style={{ background: highlight ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${highlight ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '12px', padding: '24px', position: 'relative', boxShadow: highlight ? '0 0 32px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.08)' : 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
              {highlight && <div style={{ position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', padding: '3px 14px', borderRadius: '0 0 8px 8px', fontSize: '10px', fontWeight: '700', color: '#fff', letterSpacing: '0.06em' }}>MOST POPULAR</div>}
              <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px', color: '#F0EEFF' }}>{name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '20px' }}>
                <span style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.04em', color: '#F0EEFF' }}>{price}</span>
                <span style={{ fontSize: '13px', color: '#7E7A9A' }}>{period}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '24px' }}>
                {features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: '#C4B5FD', alignItems: 'flex-start' }}>
                    <CheckCircle size={13} color={highlight ? '#A78BFA' : '#555'} style={{ flexShrink: 0, marginTop: '2px' }} />
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/sign-up" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '10px', background: highlight ? 'linear-gradient(135deg, #6366F1, #7C3AED)' : 'rgba(255,255,255,0.06)', boxShadow: highlight ? '0 0 16px rgba(99,102,241,0.35)' : 'none', border: `1px solid ${highlight ? 'transparent' : 'rgba(255,255,255,0.08)'}`, borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
                {cta} <ChevronRight size={12} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOUNDER QUOTE ────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '640px', margin: '0 auto', padding: '0 32px 100px', textAlign: 'center' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: '16px', padding: '40px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '36px', color: 'rgba(139,92,246,0.4)', marginBottom: '12px', lineHeight: 1 }}>&ldquo;</div>
          <p style={{ fontSize: '16px', lineHeight: '1.7', color: '#C4B5FD', fontStyle: 'italic', marginBottom: '20px' }}>
            I built DealKit after watching us lose deals we should have won — because our battlecards were outdated and nobody could tell which deals were genuinely at risk until it was too late. The insight was simple: our institutional knowledge was the asset. DealKit makes it work.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: '2px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#fff' }}>R</div>
            <span style={{ fontSize: '12px', color: '#7E7A9A' }}>Rees Foulkes, Founder · DealKit</span>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 32px 120px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '100px', fontSize: '12px', color: '#C4B5FD', fontWeight: '600', marginBottom: '20px' }}>
          <Brain size={11} />
          Every deal you close makes the next one easier
        </div>
        <h2 style={{ fontSize: '38px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '16px', color: '#F0EEFF' }}>
          Start building your data advantage today
        </h2>
        <p style={{ color: '#7E7A9A', marginBottom: '32px', fontSize: '15px', maxWidth: '480px', margin: '0 auto 32px' }}>
          Free to start. No credit card. Your first battlecard generates in under 5 minutes.
        </p>
        <Link href="/sign-up" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '13px 28px', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', boxShadow: '0 0 32px rgba(99,102,241,0.4), 0 8px 24px rgba(0,0,0,0.4)', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', textDecoration: 'none' }}>
          Start for free <ArrowRight size={15} />
        </Link>
        <p style={{ marginTop: '14px', fontSize: '12px', color: '#4B4565' }}>Free forever · No credit card · Set up in 10 minutes</p>
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(139,92,246,0.1)', padding: '24px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '22px', height: '22px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={11} color="#fff" />
          </div>
          <span style={{ fontWeight: '700', fontSize: '13px', color: '#F0EEFF' }}>DealKit</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontSize: '12px', color: '#4B4565' }}>© 2026 DealKit. All rights reserved.</span>
          <a href="/privacy" style={{ fontSize: '12px', color: '#4B4565', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms" style={{ fontSize: '12px', color: '#4B4565', textDecoration: 'none' }}>Terms of Service</a>
        </div>
      </footer>
    </div>
  )
}
