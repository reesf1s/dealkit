import React from 'react'
import Link from 'next/link'
import { ArrowRight, Zap, Shield, CheckCircle, FileText, Users, Target, BookOpen, Mail, ChevronRight, TrendingUp, Lock, Brain, BarChart3 } from 'lucide-react'
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
  { icon: Shield, label: 'Battlecard', desc: 'Win every competitive deal with honest, researched intel on every rival.' },
  { icon: BookOpen, label: 'Case Study', desc: 'Turn closed-won deals into compelling stories that close the next one.' },
  { icon: FileText, label: 'One-Pager', desc: 'Product overviews that sell the outcome, not the feature list.' },
  { icon: Target, label: 'Objection Handler', desc: 'Every pushback your team will face, with proven responses backed by deal data.' },
  { icon: Users, label: 'Talk Track', desc: 'Tailored messaging for every buyer persona — CTO, CFO, Head of Ops.' },
  { icon: Mail, label: 'Email Sequence', desc: 'Cold outreach and follow-up sequences grounded in real case studies.' },
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

const MOAT_STATS = [
  { label: 'Win rate tracked', value: '68%', sub: 'Real win/loss from your deals', color: '#22C55E' },
  { label: 'Weighted forecast', value: '£148k', sub: 'Probability-adjusted pipeline', color: '#8B5CF6' },
  { label: 'Score calibration', value: '91%', sub: 'AI scores predict outcomes', color: '#6366F1' },
  { label: 'Days faster close', value: '3.2×', sub: 'vs. teams without intel', color: '#F59E0B' },
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
          <a href="#features" style={{ padding: '6px 14px', borderRadius: '6px', color: '#888', fontSize: '13px', textDecoration: 'none' }}>Features</a>
          <a href="#intelligence" style={{ padding: '6px 14px', borderRadius: '6px', color: '#888', fontSize: '13px', textDecoration: 'none' }}>Intelligence</a>
          <a href="#pricing" style={{ padding: '6px 14px', borderRadius: '6px', color: '#888', fontSize: '13px', textDecoration: 'none' }}>Pricing</a>
          <Link href="/sign-in" style={{ padding: '6px 14px', borderRadius: '6px', color: '#888', fontSize: '13px', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/sign-up" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', boxShadow: '0 0 14px rgba(99,102,241,0.35)', borderRadius: '7px', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
            Start Free <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: 'relative', zIndex: 1, paddingTop: '160px', paddingBottom: '100px', textAlign: 'center', maxWidth: '720px', margin: '0 auto', padding: '160px 32px 100px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '100px', fontSize: '12px', color: '#A78BFA', fontWeight: '600', marginBottom: '28px' }}>
          <Zap size={11} />
          AI that gets smarter with every deal you close
        </div>
        <h1 style={{ fontSize: '54px', fontWeight: '800', letterSpacing: '-0.05em', lineHeight: '1.08', marginBottom: '20px', background: 'linear-gradient(180deg, #F0EEFF 50%, #8B6FD4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Your sales team&apos;s<br />unfair advantage
        </h1>
        <p style={{ fontSize: '17px', color: '#7E7A9A', lineHeight: '1.7', marginBottom: '36px', maxWidth: '520px', margin: '0 auto 36px' }}>
          A living knowledge base that turns every deal outcome into better collateral — and builds institutional intelligence no competitor can replicate.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/sign-up" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '11px 22px', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', boxShadow: '0 0 24px rgba(99,102,241,0.4), 0 4px 16px rgba(0,0,0,0.3)', borderRadius: '9px', color: '#fff', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
            Start Free <ArrowRight size={14} />
          </Link>
          <a href="#intelligence" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '11px 22px', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', color: '#C4B5FD', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}>
            See the intelligence engine
          </a>
        </div>
        <p style={{ marginTop: '20px', fontSize: '12px', color: '#4B4565' }}>Free forever • No credit card required</p>
      </section>

      {/* App Preview */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ background: 'rgba(9,6,18,0.9)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.08)' }}>
          {/* Fake titlebar */}
          <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          </div>
          {/* Real dashboard UI mockup */}
          <div style={{ display: 'flex', height: '460px' }}>
            {/* Sidebar */}
            <div style={{ width: '188px', padding: '12px 8px', borderRight: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ padding: '6px 10px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '22px', height: '22px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '6px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#F0EEFF', letterSpacing: '-0.02em' }}>DealKit</span>
              </div>
              {[
                ['Dashboard', true], ['Pipeline', false], ['Deals', false], ['AI Chat', false],
                ['Case Studies', false], ['Competitors', false], ['Collateral', false], ['Product Gaps', false],
              ].map(([label, active]) => (
                <div key={String(label)} style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '12px', color: active ? '#C4B5FD' : '#4A4A5A', background: active ? 'rgba(99,102,241,0.12)' : 'transparent', border: active ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: active ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
                  {String(label)}
                </div>
              ))}
            </div>

            {/* Main content */}
            <div style={{ flex: 1, padding: '16px 18px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0EEFF', letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #F0EEFF, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Good morning, Rees</div>
                  <div style={{ fontSize: '10px', color: '#555', marginTop: '1px' }}>AI-powered deal conversion · 6 open deals in pipeline</div>
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {['Pipeline', 'Log Deal'].map(btn => (
                    <div key={btn} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '500', color: '#888', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>{btn}</div>
                  ))}
                  <div style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '600', color: '#fff', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', boxShadow: '0 0 10px rgba(99,102,241,0.3)' }}>✦ Generate</div>
                </div>
              </div>

              {/* AI Overview card */}
              <div style={{ background: 'linear-gradient(135deg, rgba(18,12,38,0.95), rgba(22,12,44,0.95))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '10px', padding: '10px 12px', boxShadow: '0 0 20px rgba(99,102,241,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>✦</div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#F0EEFF' }}>AI Overview</span>
                    <span style={{ fontSize: '9px', color: '#6366F1', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '1px 6px', borderRadius: '100px' }}>refreshes daily</span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#555' }}>Updated just now</div>
                </div>
                <div style={{ fontSize: '10.5px', color: '#C4B5FD', lineHeight: '1.55', marginBottom: '7px' }}>
                  Pipeline is healthy — £148k across 6 active deals with 2 in late stage. Win rate at 68%. Acme Corp and Notion are stalled; follow up this week.
                </div>
                <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: '7px', padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '9px', color: '#818CF8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>⚡ Actions for today</div>
                  {['Send proposal to Acme Corp (£32k, Negotiation)', 'Refresh Salesforce battlecard before Thursday call', 'Chase Notion follow-up — 12 days since last contact'].map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                      <div style={{ width: '9px', height: '9px', borderRadius: '50%', border: '1px solid rgba(99,102,241,0.5)', flexShrink: 0, marginTop: '1px' }} />
                      <span style={{ fontSize: '10px', color: '#D4CCFF', lineHeight: '1.4' }}>{a}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* KPI row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
                {[['Open Deals', '6', '#8B5CF6', true], ['Deals Won', '11', '#22C55E', false], ['Win Rate', '68%', '#6366F1', false], ['Collateral', '14', '#F59E0B', false]].map(([label, val, color, feat]) => (
                  <div key={String(label)} style={{ background: feat ? 'rgba(18,12,32,0.8)' : 'rgba(255,255,255,0.025)', border: `1px solid ${feat ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', padding: '10px 11px', boxShadow: feat ? '0 0 16px rgba(99,102,241,0.15)' : 'none' }}>
                    <div style={{ fontSize: '9px', color: '#555', marginBottom: '5px' }}>{String(label)}</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: String(color), letterSpacing: '-0.03em', lineHeight: 1 }}>{String(val)}</div>
                  </div>
                ))}
              </div>

              {/* Priority Actions */}
              <div style={{ background: 'rgba(18,12,32,0.7)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '8px', overflow: 'hidden', flex: 1 }}>
                <div style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '16px', height: '16px', background: 'rgba(99,102,241,0.12)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '1px', background: '#818CF8' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#F0EEFF' }}>Priority Actions</span>
                  <span style={{ fontSize: '9px', color: '#818CF8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '1px 5px', borderRadius: '100px' }}>5</span>
                </div>
                {[
                  ['Send Acme pricing deck', 'Acme Corp', '#EF4444', 'Negotiation'],
                  ['Schedule discovery — Stripe', 'Stripe', '#8B5CF6', 'Discovery'],
                  ['Follow up after demo', 'Linear', '#F59E0B', 'Proposal'],
                ].map(([todo, company, color, stage], i) => (
                  <div key={String(todo)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 12px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: String(color), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10px', color: '#EBEBEB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(todo)}</div>
                      <div style={{ fontSize: '9px', color: '#444' }}>{String(company)}</div>
                    </div>
                    <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '100px', color: String(color), background: `${String(color)}14`, border: `1px solid ${String(color)}30`, flexShrink: 0 }}>{String(stage)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '12px', color: '#F0EEFF' }}>How it works</h2>
          <p style={{ color: '#7E7A9A', fontSize: '15px' }}>Set up in minutes. Gets smarter every day.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          {[
            { n: '01', title: 'Build your knowledge base', desc: 'Add your company profile, products, competitors, and value propositions. Takes 10 minutes.' },
            { n: '02', title: 'Log deals and competitors', desc: 'Record every win, loss, and objection. Add competitor intel as it comes in.' },
            { n: '03', title: 'Get collateral that writes itself', desc: 'AI generates battlecards, case studies, and talk tracks grounded in your actual data — and regenerates them automatically when things change.' },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '24px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#818CF8', fontFamily: 'monospace', marginBottom: '14px', letterSpacing: '0.05em' }}>{n}</div>
              <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px', letterSpacing: '-0.02em', color: '#F0EEFF' }}>{title}</div>
              <div style={{ fontSize: '13px', color: '#7E7A9A', lineHeight: '1.65' }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* === COMPOUNDING INTELLIGENCE / DATA MOAT SECTION === */}
      <section id="intelligence" style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 120px' }}>

        {/* Section header */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '100px', fontSize: '12px', color: '#C4B5FD', fontWeight: '600', marginBottom: '20px' }}>
            <Brain size={11} />
            The intelligence no competitor can copy
          </div>
          <h2 style={{ fontSize: '36px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '16px', color: '#F0EEFF' }}>
            DealKit gets smarter<br />every time you close a deal
          </h2>
          <p style={{ color: '#7E7A9A', fontSize: '16px', lineHeight: '1.7', maxWidth: '560px', margin: '0 auto' }}>
            Unlike generic AI tools, DealKit builds a compounding data advantage unique to your business. Every win and loss trains the system to score deals more accurately, forecast more honestly, and generate collateral that actually reflects how you sell.
          </p>
        </div>

        {/* The flywheel diagram */}
        <div style={{ background: 'linear-gradient(135deg, rgba(18,10,40,0.95), rgba(12,8,28,0.98))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '20px', padding: '48px', marginBottom: '48px', boxShadow: '0 0 60px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center', position: 'relative', zIndex: 1 }}>
            {/* Left: flywheel steps */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '24px' }}>The compounding flywheel</div>
              {[
                { icon: '📊', title: 'Log every deal outcome', desc: 'Win, lose, value, timeline, competitors faced — all captured automatically as you work.' },
                { icon: '🧠', title: 'ML models train on your data', desc: 'Logistic regression learns which signals predict wins. K-means clusters your deals into archetypes. OLS regression detects win-rate trends. All trained on your closed deals, nobody else\'s.' },
                { icon: '📈', title: 'Predictions get sharper every cycle', desc: 'Composite scores blend Claude\'s meeting analysis with your ML model — the ML weight grows from 0% to 70% as training data accumulates.' },
                { icon: '🎯', title: 'Collateral grounds itself in outcomes', desc: 'Every battlecard, case study, and objection handler pulls from real deals you\'ve won and the competitive patterns your models detected.' },
                { icon: '🔒', title: 'A model no one can replicate', desc: 'After 50+ deals, you have logistic regression weights, k-means centroids, per-competitor mini-models, and stage velocity baselines — all unique to your sales motion.' },
              ].map(({ icon, title, desc }, i) => (
                <div key={i} style={{ display: 'flex', gap: '14px', marginBottom: i < 4 ? '20px' : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>{icon}</div>
                    {i < 4 && <div style={{ width: '1px', flex: 1, background: 'rgba(99,102,241,0.15)', marginTop: '4px', minHeight: '16px' }} />}
                  </div>
                  <div style={{ paddingBottom: i < 4 ? '4px' : 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#F0EEFF', marginBottom: '3px', letterSpacing: '-0.01em' }}>{title}</div>
                    <div style={{ fontSize: '12px', color: '#7E7A9A', lineHeight: '1.5' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: live intelligence dashboard mockup */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Live intelligence dashboard</div>

              {/* Weighted forecast */}
              <div style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '9px', color: '#A78BFA', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Weighted Pipeline Forecast</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '26px', fontWeight: '800', color: '#C4B5FD', letterSpacing: '-0.04em' }}>£91,200</span>
                  <span style={{ fontSize: '11px', color: '#7E7A9A' }}>probability-adjusted</span>
                </div>
                <div style={{ fontSize: '10px', color: '#555' }}>vs £148k raw pipeline — accounts for real win probability per deal</div>
              </div>

              {/* Win rate */}
              <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '9px', color: '#4ADE80', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Win/Loss Intelligence</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {[['Win Rate', '68%', '#22C55E'], ['Avg Deal', '£14.8k', '#A78BFA'], ['Avg Close', '38 days', '#6366F1']].map(([label, val, color]) => (
                    <div key={String(label)}>
                      <div style={{ fontSize: '17px', fontWeight: '800', color: String(color), letterSpacing: '-0.03em' }}>{String(val)}</div>
                      <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{String(label)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Score calibration */}
              <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '9px', color: '#818CF8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>AI Score Calibration</div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
                  <div style={{ flex: 1, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '7px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#4ADE80' }}>74</div>
                    <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>Avg score on wins</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '7px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#F87171' }}>41</div>
                    <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>Avg score on losses</div>
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: '#7E7A9A' }}>High-confidence deals (70%+) converted at <span style={{ color: '#A78BFA', fontWeight: '700' }}>89%</span> — your scores predict reality</div>
              </div>

              {/* Competitor record */}
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '9px', color: '#888', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Competitor W/L Record</div>
                {[['Salesforce', 7, 3, '#22C55E'], ['HubSpot', 4, 4, '#F59E0B'], ['Pipedrive', 5, 1, '#22C55E']].map(([name, w, l, color]) => (
                  <div key={String(name)} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#EBEBEB', flex: 1 }}>{String(name)}</div>
                    <div style={{ fontSize: '10px', color: '#4ADE80', fontWeight: '700', fontFamily: 'monospace', minWidth: '24px', textAlign: 'right' }}>{String(w)}W</div>
                    <div style={{ width: '1px', height: '10px', background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ fontSize: '10px', color: '#F87171', fontWeight: '700', fontFamily: 'monospace', minWidth: '24px' }}>{String(l)}L</div>
                    <div style={{ fontSize: '9px', color: String(color), fontWeight: '700', minWidth: '32px', textAlign: 'right' }}>{Math.round((Number(w) / (Number(w) + Number(l))) * 100)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 4 moat pillars */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '48px' }}>
          {[
            {
              icon: Lock,
              color: '#6366F1',
              title: 'Data that can\'t be copied',
              desc: 'Your win/loss history, competitor record, and deal patterns are unique to your business. A competitor can build the same software tomorrow — but they cannot replicate 200 deals of institutional knowledge.',
            },
            {
              icon: TrendingUp,
              color: '#22C55E',
              title: 'Forecasts that get more accurate over time',
              desc: 'The weighted pipeline forecast uses your actual historical conversion rates per deal stage. After 20+ deals, it\'s provably more accurate than any static multiplier or gut estimate.',
            },
            {
              icon: BarChart3,
              color: '#8B5CF6',
              title: 'ML models, not just AI prompts',
              desc: 'Eight distinct models run on your closed deal history: logistic regression for win probability, k-nearest neighbours for deal similarity, k-means for pipeline archetypes, OLS regression for trend detection, per-competitor mini-models, stage velocity quantiles, LOO cross-validation, and monthly score calibration. All computed in your workspace.',
            },
            {
              icon: Brain,
              color: '#F59E0B',
              title: 'Collateral grounded in outcomes',
              desc: 'Case studies are generated from actual closed-won deals. Objection handlers reference real pushbacks from your pipeline. Battlecards update as competitive patterns shift. Nothing generic — everything trained on what has actually worked for you.',
            },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '24px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <Icon size={17} color={color} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0EEFF', marginBottom: '8px', letterSpacing: '-0.02em' }}>{title}</div>
              <div style={{ fontSize: '13px', color: '#7E7A9A', lineHeight: '1.65' }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* The moat timeline */}
        <div style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '36px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#818CF8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>How the moat grows</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#F0EEFF', letterSpacing: '-0.03em' }}>The longer you use DealKit, the harder you are to beat</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0' }}>
            {[
              { milestone: 'Day 1', deals: '0 deals', desc: 'Knowledge base live. Claude generates collateral grounded in your product, competitors, and case studies from day one.', color: '#4B4565', borderColor: 'rgba(255,255,255,0.08)' },
              { milestone: '1 month', deals: '6–20 deals', desc: 'ML training begins. Logistic regression activates on 6+ closed deals. Win/loss record, weighted forecast, and competitor patterns all start accumulating.', color: '#6366F1', borderColor: 'rgba(99,102,241,0.25)' },
              { milestone: '3 months', deals: '20–50 deals', desc: 'K-means archetypes form. Per-competitor mini-models emerge. Stage velocity baselines are set. Composite scores now blend Claude + your model at up to 70% ML weight.', color: '#8B5CF6', borderColor: 'rgba(139,92,246,0.35)' },
              { milestone: '6 months', deals: '50+ deals', desc: 'Your model has trained LOO cross-validation accuracy, calibration timelines, KNN similarity search, and OLS trend slopes. No tool launched today can replicate this.', color: '#A78BFA', borderColor: 'rgba(167,139,250,0.4)' },
            ].map(({ milestone, deals, desc, color, borderColor }, i) => (
              <div key={milestone} style={{ padding: '20px', borderLeft: i > 0 ? `1px solid rgba(255,255,255,0.06)` : 'none', position: 'relative' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, border: `2px solid ${borderColor}`, marginBottom: '12px', boxShadow: `0 0 8px ${color}60` }} />
                <div style={{ fontSize: '13px', fontWeight: '800', color, marginBottom: '2px', letterSpacing: '-0.02em' }}>{milestone}</div>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>{deals}</div>
                <div style={{ fontSize: '12px', color: '#7E7A9A', lineHeight: '1.55' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Moat stat bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginTop: '16px' }}>
          {MOAT_STATS.map(({ label, value, sub, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color, letterSpacing: '-0.04em', marginBottom: '4px' }}>{value}</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#EBEBEB', marginBottom: '3px' }}>{label}</div>
              <div style={{ fontSize: '11px', color: '#555' }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ML model breakdown — the real IP */}
        <div style={{ marginTop: '48px', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: '16px', padding: '36px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '20px', padding: '4px 12px', marginBottom: '14px' }}>
              <Brain size={11} color="#818CF8" />
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Proprietary ML engine</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#F0EEFF', letterSpacing: '-0.03em', marginBottom: '8px' }}>Eight models. All trained on your data. None replicable.</div>
            <div style={{ fontSize: '13px', color: '#7E7A9A', maxWidth: '520px', margin: '0 auto' }}>No external ML infrastructure. Every model runs in your workspace, trained exclusively on your closed deal history.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { num: '01', title: 'Logistic regression', detail: 'Gradient descent with L2 regularisation on 7 deal features. Outputs win probability [0–1] per open deal.' },
              { num: '02', title: 'Leave-one-out cross-validation', detail: 'Honest accuracy estimate — trains N times, leaving one deal out each pass. Shows you exactly how predictive your model is.' },
              { num: '03', title: 'K-nearest neighbours', detail: 'Finds the most similar historical deals by Euclidean distance in feature space. Shows what deals like this one actually resulted in.' },
              { num: '04', title: 'K-means clustering', detail: 'Deterministic maximin initialisation groups your pipeline into deal archetypes with distinct win rates, values, and characteristics.' },
              { num: '05', title: 'Per-competitor mini-LR', detail: 'A separate logistic regression per competitor identifies which signals predict wins and losses specifically against each rival.' },
              { num: '06', title: 'OLS trend regression', detail: 'Ordinary least-squares slope estimation on monthly cohorts detects whether win rate, deal velocity, and competitive threats are improving or declining.' },
              { num: '07', title: 'Stage velocity quantiles', detail: 'Computes P50/P75 days-to-close from your own won deals, then flags deals that have exceeded normal stage duration for your team.' },
              { num: '08', title: 'Score calibration timeline', detail: 'Monthly tracking of ML discrimination — the gap between average ML score on winners vs. losers. Measures how predictive your model is becoming.' },
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
          <div style={{ marginTop: '20px', padding: '14px 18px', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '10px', fontSize: '12px', color: '#A78BFA', textAlign: 'center' }}>
            <strong>LLM + ML composite scoring:</strong> Claude scores each meeting independently. The ML model weights the prediction. As your training set grows, ML weight scales from 0% → 70% automatically — the system becomes more accurate as you use it.
          </div>
        </div>
      </section>

      {/* Features tab */}
      <FeaturesTab />

      {/* ROI Calculator */}
      <ROICalc />

      {/* Collateral types */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '12px', color: '#F0EEFF' }}>Everything your team needs</h2>
          <p style={{ color: '#7E7A9A', fontSize: '15px' }}>Six types of collateral, all grounded in your real data.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          {COLLATERAL_TYPES.map(({ icon: Icon, label, desc }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
              <div style={{ width: '34px', height: '34px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                <Icon size={15} color="#A78BFA" />
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '6px', color: '#F0EEFF', letterSpacing: '-0.02em' }}>{label}</div>
              <div style={{ fontSize: '12.5px', color: '#7E7A9A', lineHeight: '1.6' }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Before/After */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '12px', color: '#F0EEFF' }}>Before and after</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: 'rgba(239,68,68,0.04)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#EF4444', marginBottom: '18px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Before DealKit</div>
            {['Outdated Google Docs no one updates', 'Battlecards that contradict your pitch', 'Objections caught cold in demos', 'New reps take 6 months to ramp', 'Win/loss data lives in sales calls', 'Pipeline forecast based on gut feel', 'No idea which competitors you beat or lose to'].map(p => (
              <div key={p} style={{ display: 'flex', gap: '8px', marginBottom: '11px', fontSize: '13px', color: '#7E7A9A', alignItems: 'flex-start' }}>
                <span style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px', fontWeight: '700' }}>×</span> {p}
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(34,197,94,0.04)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '12px', padding: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#22C55E', marginBottom: '18px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>After DealKit</div>
            {['One source of truth, always current', 'Battlecards that regenerate on new intel', 'Every objection mapped with a tested response', 'New rep kit ready from day one — battlecards, objections, proof stories', 'Every deal outcome compounds your knowledge', 'Probability-adjusted forecast from real conversion data', 'Live competitor W/L record updated per deal'].map(p => (
              <div key={p} style={{ display: 'flex', gap: '8px', marginBottom: '11px', fontSize: '13px', color: '#7E7A9A', alignItems: 'flex-start' }}>
                <CheckCircle size={13} color="#22C55E" style={{ flexShrink: 0, marginTop: '2px' }} /> {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
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

      {/* Credibility */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '640px', margin: '0 auto', padding: '0 32px 100px', textAlign: 'center' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: '16px', padding: '40px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '36px', color: 'rgba(139,92,246,0.4)', marginBottom: '12px', lineHeight: 1 }}>&ldquo;</div>
          <p style={{ fontSize: '16px', lineHeight: '1.7', color: '#C4B5FD', fontStyle: 'italic', marginBottom: '20px' }}>
            I built DealKit after watching our team lose deals we should have won — because our battlecards were outdated and our case studies lived in a shared drive no one opened. The insight was that our institutional knowledge was the asset, not the documents. DealKit makes that knowledge work.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: '2px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#fff' }}>R</div>
            <span style={{ fontSize: '12px', color: '#7E7A9A' }}>Rees Foulkes, Founder · DealKit</span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 32px 120px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '100px', fontSize: '12px', color: '#C4B5FD', fontWeight: '600', marginBottom: '20px' }}>
          <Brain size={11} />
          The longer you use it, the smarter it gets
        </div>
        <h2 style={{ fontSize: '36px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '16px', color: '#F0EEFF' }}>Start building your data moat today</h2>
        <p style={{ color: '#7E7A9A', marginBottom: '32px', fontSize: '15px', maxWidth: '480px', margin: '0 auto 32px' }}>Every deal you log makes DealKit more valuable to your team — and harder for competitors to replicate.</p>
        <Link href="/sign-up" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '13px 28px', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', boxShadow: '0 0 32px rgba(99,102,241,0.4), 0 8px 24px rgba(0,0,0,0.4)', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', textDecoration: 'none' }}>
          Start for free <ArrowRight size={15} />
        </Link>
        <p style={{ marginTop: '14px', fontSize: '12px', color: '#4B4565' }}>Free forever • No credit card required</p>
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
