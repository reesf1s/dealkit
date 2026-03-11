import Link from 'next/link'
import { ArrowRight, Zap, Shield, TrendingUp, CheckCircle, FileText, Users, Target, BookOpen, Mail, ChevronRight } from 'lucide-react'
import ROICalc from '@/components/marketing/ROICalc'

const NAV: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 40px', height: '56px',
  background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(12px)',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
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
    name: 'Free', price: '$0', period: '',
    features: ['1 product', '2 competitors', '5 case studies', '10 deal logs', '5 collateral items'],
    cta: 'Get started', highlight: false,
  },
  {
    name: 'Starter', price: '$79', period: '/mo',
    features: ['3 products', '10 competitors', 'Unlimited case studies', 'Unlimited deals', 'Unlimited collateral', '.docx export', 'No watermark'],
    cta: 'Start free trial', highlight: true,
  },
  {
    name: 'Pro', price: '$149', period: '/mo',
    features: ['Everything in Starter', 'Unlimited products', 'Batch regenerate', 'Email sequences', 'AI meeting prep', 'Team features'],
    cta: 'Start free trial', highlight: false,
  },
]

export default function LandingPage() {
  return (
    <div style={{ background: '#0A0A0A', minHeight: '100vh', color: '#EBEBEB', fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif' }}>

      {/* Nav */}
      <nav style={NAV}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '24px', height: '24px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '6px' }} />
          <span style={{ fontWeight: '700', fontSize: '15px', letterSpacing: '-0.02em' }}>DealKit</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link href="/sign-in" style={{ padding: '6px 14px', borderRadius: '6px', color: '#888', fontSize: '13px', textDecoration: 'none', transition: 'color 0.1s' }}>Sign in</Link>
          <Link href="/sign-up" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#6366F1', borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
            Start Free <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ paddingTop: '160px', paddingBottom: '100px', textAlign: 'center', maxWidth: '720px', margin: '0 auto', padding: '160px 32px 100px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '100px', fontSize: '12px', color: '#818CF8', fontWeight: '500', marginBottom: '28px' }}>
          <Zap size={11} />
          AI-powered sales collateral
        </div>
        <h1 style={{ fontSize: '52px', fontWeight: '700', letterSpacing: '-0.04em', lineHeight: '1.1', marginBottom: '20px', background: 'linear-gradient(180deg, #EBEBEB 60%, #666)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Your sales team&apos;s<br />unfair advantage
        </h1>
        <p style={{ fontSize: '17px', color: '#888', lineHeight: '1.65', marginBottom: '36px', maxWidth: '520px', margin: '0 auto 36px' }}>
          A living knowledge base that turns every deal outcome into better collateral. Battlecards, case studies, objection handlers — always accurate, always up to date.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/sign-up" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: '#6366F1', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}>
            Start Free <ArrowRight size={14} />
          </Link>
          <a href="#how-it-works" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#EBEBEB', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}>
            See how it works
          </a>
        </div>
        <p style={{ marginTop: '20px', fontSize: '12px', color: '#555' }}>Free forever • No credit card required</p>
      </section>

      {/* App Preview */}
      <section style={{ maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
          {/* Fake titlebar */}
          <div style={{ padding: '10px 16px', background: '#0F0F0F', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3a3a3a' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3a3a3a' }} />
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3a3a3a' }} />
          </div>
          {/* Fake dashboard */}
          <div style={{ display: 'flex', height: '400px' }}>
            {/* Sidebar */}
            <div style={{ width: '200px', padding: '16px 8px', borderRight: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <div style={{ padding: '6px 8px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '6px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '700' }}>DealKit</span>
              </div>
              {['Dashboard', 'Company Profile', 'Competitors', 'Case Studies', 'Deal Log', 'Collateral'].map((item, i) => (
                <div key={item} style={{ padding: '7px 10px', borderRadius: '6px', fontSize: '12.5px', color: i === 0 ? '#EBEBEB' : '#666', background: i === 0 ? 'rgba(255,255,255,0.07)' : 'transparent', display: 'flex', alignItems: 'center', gap: '8px', borderLeft: i === 0 ? '2px solid #6366F1' : '2px solid transparent', cursor: 'pointer', marginBottom: '1px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: i === 0 ? '#6366F1' : '#333', flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
            {/* Main content */}
            <div style={{ flex: 1, padding: '20px 24px', overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '16px', color: '#EBEBEB' }}>Knowledge Base Health</div>
              <div style={{ background: '#0F0F0F', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#888' }}>75% complete</span>
                  <span style={{ fontSize: '12px', color: '#6366F1' }}>3 items to go</span>
                </div>
                <div style={{ height: '4px', background: '#222', borderRadius: '2px' }}>
                  <div style={{ width: '75%', height: '100%', background: 'linear-gradient(90deg, #6366F1, #818CF8)', borderRadius: '2px' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                {[['Competitors', '4', '#6366F1'], ['Case Studies', '7', '#22C55E'], ['Win Rate', '68%', '#EAB308']].map(([label, val, color]) => (
                  <div key={label} style={{ background: '#0F0F0F', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '22px', fontWeight: '700', color }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '14px', background: '#0F0F0F', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent Collateral</div>
                {['Battlecard: vs Salesforce', 'Talk Track — VP of Sales', 'Objection Handler'].map((item, i) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span style={{ fontSize: '12px', color: '#EBEBEB' }}>{item}</span>
                    <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '100px', background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}>Ready</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.03em', marginBottom: '12px' }}>How it works</h2>
          <p style={{ color: '#888', fontSize: '15px' }}>Set up in minutes. Gets smarter every day.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          {[
            { n: '01', title: 'Build your knowledge base', desc: 'Add your company profile, products, competitors, and value propositions. Takes 10 minutes.' },
            { n: '02', title: 'Log deals and competitors', desc: 'Record every win, loss, and objection. Add competitor intel as it comes in.' },
            { n: '03', title: 'Get collateral that writes itself', desc: 'AI generates battlecards, case studies, and talk tracks grounded in your actual data — and regenerates them automatically when things change.' },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#6366F1', fontFamily: 'monospace', marginBottom: '12px', letterSpacing: '0.05em' }}>{n}</div>
              <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px', letterSpacing: '-0.01em' }}>{title}</div>
              <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.6' }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ROI Calculator */}
      <ROICalc />

      {/* Collateral types */}
      <section style={{ maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.03em', marginBottom: '12px' }}>Everything your team needs</h2>
          <p style={{ color: '#888', fontSize: '15px' }}>Six types of collateral, all grounded in your real data.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          {COLLATERAL_TYPES.map(({ icon: Icon, label, desc }) => (
            <div key={label} style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '20px', transition: 'border-color 0.15s' }}>
              <div style={{ width: '32px', height: '32px', background: 'rgba(99,102,241,0.12)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Icon size={15} color="#818CF8" />
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '6px' }}>{label}</div>
              <div style={{ fontSize: '12.5px', color: '#666', lineHeight: '1.55' }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Before/After */}
      <section style={{ maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.03em', marginBottom: '12px' }}>Before and after</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: '#141414', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#EF4444', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Before DealKit</div>
            {['Outdated Google Docs no one updates', 'Battlecards that contradict your pitch', 'Objections caught cold in demos', 'New reps take 6 months to ramp', 'Win/loss data lives in sales calls'].map(p => (
              <div key={p} style={{ display: 'flex', gap: '8px', marginBottom: '10px', fontSize: '13px', color: '#888', alignItems: 'flex-start' }}>
                <span style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px' }}>×</span> {p}
              </div>
            ))}
          </div>
          <div style={{ background: '#141414', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', padding: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#22C55E', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>After DealKit</div>
            {['One source of truth, always current', 'Battlecards that regenerate on new intel', 'Every objection mapped with a tested response', 'New reps productive in week one', 'Every deal outcome compounds your knowledge'].map(p => (
              <div key={p} style={{ display: 'flex', gap: '8px', marginBottom: '10px', fontSize: '13px', color: '#888', alignItems: 'flex-start' }}>
                <CheckCircle size={13} color="#22C55E" style={{ flexShrink: 0, marginTop: '2px' }} /> {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.03em', marginBottom: '12px' }}>Simple pricing</h2>
          <p style={{ color: '#888', fontSize: '15px' }}>Start free. Upgrade when your team is ready.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          {PRICING.map(({ name, price, period, features, cta, highlight }) => (
            <div key={name} style={{ background: highlight ? 'rgba(99,102,241,0.06)' : '#141414', border: `1px solid ${highlight ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '10px', padding: '24px', position: 'relative' }}>
              {highlight && <div style={{ position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)', background: '#6366F1', padding: '2px 12px', borderRadius: '0 0 6px 6px', fontSize: '11px', fontWeight: '600', color: '#fff', letterSpacing: '0.03em' }}>MOST POPULAR</div>}
              <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>{name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '20px' }}>
                <span style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.03em' }}>{price}</span>
                <span style={{ fontSize: '13px', color: '#666' }}>{period}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                {features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: '7px', fontSize: '13px', color: '#EBEBEB', alignItems: 'flex-start' }}>
                    <CheckCircle size={13} color={highlight ? '#818CF8' : '#555'} style={{ flexShrink: 0, marginTop: '2px' }} />
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/sign-up" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '9px', background: highlight ? '#6366F1' : 'rgba(255,255,255,0.06)', border: `1px solid ${highlight ? 'transparent' : 'rgba(255,255,255,0.08)'}`, borderRadius: '7px', color: '#fff', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
                {cta} <ChevronRight size={12} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Credibility */}
      <section style={{ maxWidth: '640px', margin: '0 auto', padding: '0 32px 100px', textAlign: 'center' }}>
        <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '40px' }}>
          <div style={{ fontSize: '32px', color: '#333', marginBottom: '12px' }}>"</div>
          <p style={{ fontSize: '16px', lineHeight: '1.7', color: '#EBEBEB', fontStyle: 'italic', marginBottom: '20px' }}>
            Built by a product leader who collapsed a 12-month enterprise sales cycle to under 30 days.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }} />
            <span style={{ fontSize: '12px', color: '#666' }}>Founder, DealKit</span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ textAlign: 'center', padding: '0 32px 120px' }}>
        <h2 style={{ fontSize: '36px', fontWeight: '700', letterSpacing: '-0.03em', marginBottom: '16px' }}>Ready to close more deals?</h2>
        <p style={{ color: '#888', marginBottom: '28px', fontSize: '15px' }}>Join sales teams who use DealKit to turn every loss into a future win.</p>
        <Link href="/sign-up" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#6366F1', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}>
          Start for free <ArrowRight size={14} />
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '20px', height: '20px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '5px' }} />
          <span style={{ fontWeight: '700', fontSize: '13px' }}>DealKit</span>
        </div>
        <span style={{ fontSize: '12px', color: '#555' }}>© 2025 DealKit. All rights reserved.</span>
      </footer>
    </div>
  )
}
