import Link from 'next/link'
import { ArrowRight, Zap, Shield, CheckCircle, FileText, Users, Target, BookOpen, Mail, ChevronRight } from 'lucide-react'
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
          AI-powered sales collateral
        </div>
        <h1 style={{ fontSize: '54px', fontWeight: '800', letterSpacing: '-0.05em', lineHeight: '1.08', marginBottom: '20px', background: 'linear-gradient(180deg, #F0EEFF 50%, #8B6FD4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Your sales team&apos;s<br />unfair advantage
        </h1>
        <p style={{ fontSize: '17px', color: '#7E7A9A', lineHeight: '1.7', marginBottom: '36px', maxWidth: '520px', margin: '0 auto 36px' }}>
          A living knowledge base that turns every deal outcome into better collateral. Battlecards, case studies, objection handlers — always accurate, always up to date.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/sign-up" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '11px 22px', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', boxShadow: '0 0 24px rgba(99,102,241,0.4), 0 4px 16px rgba(0,0,0,0.3)', borderRadius: '9px', color: '#fff', fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>
            Start Free <ArrowRight size={14} />
          </Link>
          <a href="#how-it-works" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '11px 22px', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px', color: '#C4B5FD', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}>
            See how it works
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
            {['Outdated Google Docs no one updates', 'Battlecards that contradict your pitch', 'Objections caught cold in demos', 'New reps take 6 months to ramp', 'Win/loss data lives in sales calls'].map(p => (
              <div key={p} style={{ display: 'flex', gap: '8px', marginBottom: '11px', fontSize: '13px', color: '#7E7A9A', alignItems: 'flex-start' }}>
                <span style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px', fontWeight: '700' }}>×</span> {p}
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(34,197,94,0.04)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '12px', padding: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#22C55E', marginBottom: '18px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>After DealKit</div>
            {['One source of truth, always current', 'Battlecards that regenerate on new intel', 'Every objection mapped with a tested response', 'New reps productive in week one', 'Every deal outcome compounds your knowledge'].map(p => (
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
            I built DealKit after watching our team lose deals we should have won — because our battlecards were outdated and our case studies lived in a shared drive no one opened. We collapsed a 12-month sales cycle to under 30 days once the knowledge was actually usable.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: '2px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#fff' }}>R</div>
            <span style={{ fontSize: '12px', color: '#7E7A9A' }}>Rees Foulkes, Founder · DealKit</span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 32px 120px' }}>
        <h2 style={{ fontSize: '36px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '16px', color: '#F0EEFF' }}>Ready to close more deals?</h2>
        <p style={{ color: '#7E7A9A', marginBottom: '32px', fontSize: '15px' }}>Join sales teams who use DealKit to turn every loss into a future win.</p>
        <Link href="/sign-up" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '13px 28px', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', boxShadow: '0 0 32px rgba(99,102,241,0.4), 0 8px 24px rgba(0,0,0,0.4)', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', textDecoration: 'none' }}>
          Start for free <ArrowRight size={15} />
        </Link>
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
          <span style={{ fontSize: '12px', color: '#4B4565' }}>© 2025 DealKit. All rights reserved.</span>
          <a href="/privacy" style={{ fontSize: '12px', color: '#4B4565', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms" style={{ fontSize: '12px', color: '#4B4565', textDecoration: 'none' }}>Terms of Service</a>
        </div>
      </footer>
    </div>
  )
}
