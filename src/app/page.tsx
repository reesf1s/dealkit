import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Halvex — AI Deal Intelligence',
  description: 'Halvex turns your deal updates into AI-powered intelligence. Daily briefings, risk scoring, meeting extraction, and pipeline analytics that help you close more revenue.',
  openGraph: {
    title: 'Halvex — AI Deal Intelligence',
    description: 'AI that reads every deal update and tells you exactly what to do next. Daily briefings, live scoring, and pipeline intelligence for revenue teams.',
    type: 'website',
    url: 'https://halvex.ai',
    siteName: 'Halvex',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Halvex — AI Deal Intelligence',
    description: 'AI that reads every deal update and tells you exactly what to do next.',
  },
}

export default async function LandingPage() {
  try {
    const { userId } = await auth()
    if (userId) redirect('/dashboard')
  } catch {
    // Clerk not configured — show landing page
  }

  return (
    <div className="landing-surface" style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: '14px',
      lineHeight: '1.6',
      minHeight: '100vh',
      overflowX: 'hidden',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    }}>
      <style>{`
        .landing-surface {
          --page-bg: #f6f8fb;
          --surface-1: #ffffff;
          --surface-2: #f3f5f8;
          --surface-hover: #eef3f8;
          --border-subtle: #edf1f6;
          --border-default: #e1e7ef;
          --border-strong: #d2dae5;
          --text-primary: #101828;
          --text-secondary: #475467;
          --text-tertiary: #667085;
          --text-muted: #98a2b3;
          --brand: #1DB86A;
          --brand-light: #22c55e;
          --brand-bg: #f0fdf4;
          --brand-border: rgba(29, 184, 106, 0.24);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        a { color: inherit; text-decoration: none; }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .lp-nav-link { color: var(--text-secondary); transition: color 0.15s; }
        .lp-nav-link:hover { color: var(--text-primary); }
        .lp-cta-primary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 28px; border-radius: 8px; border: 1px solid var(--brand);
          background: var(--brand); color: var(--surface-1);
          font-size: 15px; font-weight: 700; font-family: inherit;
          cursor: pointer; transition: all 0.2s; text-decoration: none;
        }
        .lp-cta-primary:hover { background: var(--brand-light); border-color: var(--brand-light); }
        .lp-cta-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 28px; border-radius: 8px;
          border: 1px solid var(--border-default);
          background: var(--surface-1); color: var(--text-primary);
          font-size: 15px; font-weight: 600; font-family: inherit;
          cursor: pointer; transition: all 0.2s; text-decoration: none;
        }
        .lp-cta-secondary:hover { background: var(--surface-hover); border-color: var(--border-strong); }
        .lp-cta-dark {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 32px; border-radius: 8px; border: 1px solid var(--text-primary);
          background: var(--text-primary); color: var(--surface-1);
          font-size: 15px; font-weight: 700; font-family: inherit;
          cursor: pointer; transition: all 0.2s; text-decoration: none;
        }
        .lp-cta-dark:hover { opacity: 0.88; }
        .lp-feature-card {
          background: var(--surface-1); border: 1px solid var(--border-default);
          border-radius: 8px; padding: 28px;
          transition: all 0.25s;
        }
        .lp-feature-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-card-hover); }
        .lp-step-card {
          background: var(--surface-1); border: 1px solid var(--border-default);
          border-radius: 8px; padding: 24px;
          text-align: center; transition: all 0.25s;
        }
        .lp-step-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-card); }

        @media (max-width: 768px) {
          .lp-hero-h1 { font-size: 36px !important; }
          .lp-hero-sub { font-size: 16px !important; }
          .lp-feature-grid { grid-template-columns: 1fr !important; }
          .lp-step-grid { grid-template-columns: 1fr !important; }
          .lp-hero-ctas { flex-direction: column !important; }
          .lp-nav-links { display: none !important; }
          .lp-footer-inner { flex-direction: column !important; gap: 16px !important; text-align: center !important; }
          .lp-briefing-mockup { display: none !important; }
          .lp-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--topnav-bg)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 32px', height: '60px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: 'var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 800, color: 'var(--surface-1)',
            }}>H</div>
            <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: 0, color: 'var(--text-primary)' }}>HALVEX</span>
          </Link>
          <div className="lp-nav-links" style={{ display: 'flex', gap: '28px' }}>
            {['Features', 'How it works', 'Pricing'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s/g, '-')}`} className="lp-nav-link"
                style={{ fontSize: '13px', fontWeight: 500 }}>
                {item}
              </a>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/sign-in" className="lp-nav-link" style={{ fontSize: '13px', fontWeight: 500, padding: '8px 16px' }}>
            Sign in
          </Link>
          <Link href="/sign-up" className="lp-cta-primary" style={{ padding: '9px 20px', fontSize: '13px' }}>
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        background: 'var(--page-bg)',
        color: 'var(--text-primary)',
        paddingTop: '112px', paddingBottom: '76px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '0 32px', textAlign: 'left', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 16px', borderRadius: '999px',
            background: 'var(--brand-bg)', border: '1px solid var(--brand-border)',
            fontSize: '12px', fontWeight: 600, color: 'var(--brand)',
            marginBottom: '20px',
            animation: 'fade-in 0.6s ease-out',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand)', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            AI-powered deal intelligence
          </div>

          <h1 className="lp-hero-h1" style={{
            fontSize: '52px', fontWeight: 800, letterSpacing: 0,
            lineHeight: 1.08, marginBottom: '20px', maxWidth: 780,
            animation: 'fade-in 0.6s ease-out 0.1s both',
          }}>
            Your AI knows every deal.<br />
            <span style={{ color: 'var(--text-secondary)' }}>You just decide what to close.</span>
          </h1>

          <p className="lp-hero-sub" style={{
            fontSize: '17px', color: 'var(--text-secondary)',
            lineHeight: 1.65, maxWidth: '640px', margin: '0 0 32px',
            animation: 'fade-in 0.6s ease-out 0.2s both',
          }}>
            Halvex reads your meeting notes, scores every deal, and generates a daily briefing telling you exactly who to call, what to say, and which deals need saving.
          </p>

          <div className="lp-hero-ctas" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '12px',
            animation: 'fade-in 0.6s ease-out 0.3s both',
          }}>
            <Link href="/sign-up" className="lp-cta-primary" style={{ padding: '16px 32px', fontSize: '15px' }}>
              Start for free
            </Link>
            <a href="#how-it-works" className="lp-cta-secondary">
              See how it works
            </a>
          </div>
        </div>

        {/* Briefing mockup */}
        <div className="lp-briefing-mockup" style={{
          maxWidth: '1040px', margin: '42px auto 0', padding: '0 32px',
          animation: 'fade-in 0.8s ease-out 0.5s both',
        }}>
          <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px', padding: '20px 22px',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
                Daily Focus
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>generated 2 min ago</span>
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.9, color: 'var(--text-secondary)' }}>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ color: '#ef4444' }}>&#x1F534;</span> <strong style={{ color: 'var(--text-primary)' }}>Urgent</strong>
              </div>
              <div style={{ paddingLeft: '8px', marginBottom: '6px' }}>
                1. <strong style={{ color: 'var(--text-primary)' }}>Acme Corp</strong> (£180k) — Chase Sarah on the stalled security review; contract expires Friday.
              </div>
              <div style={{ paddingLeft: '8px', marginBottom: '16px' }}>
                2. <strong style={{ color: 'var(--text-primary)' }}>GlobalTech</strong> (£95k) — Re-engage Mike after his budget objection; offer the phased rollout.
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ color: '#f59e0b' }}>&#x1F7E1;</span> <strong style={{ color: 'var(--text-primary)' }}>Push Forward</strong>
              </div>
              <div style={{ paddingLeft: '8px' }}>
                3. <strong style={{ color: 'var(--text-primary)' }}>DataFlow Inc</strong> (£220k) — Send the updated proposal to James; he needs it before Thursday board meeting.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Logos / Trust ────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--page-bg)', borderBottom: '1px solid var(--border-default)', padding: '32px 32px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '20px' }}>
            Built on
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '48px', flexWrap: 'wrap', opacity: 0.5 }}>
            {['Next.js', 'Claude AI', 'Supabase', 'Vercel', 'HubSpot'].map(name => (
              <span key={name} style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" style={{ background: 'var(--surface-1)', padding: '100px 32px' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
              Features
            </p>
            <h2 style={{ fontSize: '38px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0, marginBottom: '16px' }}>
              Everything your pipeline needs
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '540px', margin: '0 auto', lineHeight: 1.7 }}>
              From the first meeting note to closed-won, Halvex extracts intelligence and turns it into action.
            </p>
          </div>

          <div className="lp-feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {[
              {
                icon: '&#x1F4CA;',
                title: 'AI Deal Scoring',
                desc: 'Every deal gets a live conversion score based on engagement, risks, stage velocity, and historical patterns. Scores update automatically as new information comes in.',
                color: '#3b82f6',
              },
              {
                icon: '&#x2728;',
                title: 'Daily Focus Briefing',
                desc: 'AI reads your entire pipeline every morning and generates a prioritised action list. Names, values, and specific next steps — not generic advice.',
                color: '#8b5cf6',
              },
              {
                icon: '&#x1F399;',
                title: 'Meeting Intelligence',
                desc: 'Paste your call notes and AI extracts objections, competitors, product gaps, and next steps. Deal records update automatically.',
                color: 'var(--brand)',
              },
              {
                icon: '&#x1F6A8;',
                title: 'Risk Detection',
                desc: 'Stale deals, declining scores, missed follow-ups — Halvex flags problems before they become lost deals. Get coached on exactly how to recover.',
                color: '#ef4444',
              },
              {
                icon: '&#x1F3AF;',
                title: 'Win/Loss Intelligence',
                desc: 'ML models trained on your closed deals identify what winning patterns look like and where current deals are diverging from the path to closed-won.',
                color: '#f59e0b',
              },
              {
                icon: '&#x1F50D;',
                title: 'Competitive Intel',
                desc: 'Track competitor mentions across every deal. See win rates against each competitor, their strengths and weaknesses, and battlecard-ready talking points.',
                color: '#06b6d4',
              },
            ].map(f => (
              <div key={f.title} className="lp-feature-card">
                <div style={{
                  width: '44px', height: '44px', borderRadius: '11px',
                  background: `${f.color}10`, border: `1px solid ${f.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px', marginBottom: '20px',
                }} dangerouslySetInnerHTML={{ __html: f.icon }} />
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ background: 'var(--page-bg)', padding: '100px 32px', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
              How it works
            </p>
            <h2 style={{ fontSize: '38px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0, marginBottom: '16px' }}>
              Three steps to pipeline intelligence
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto', lineHeight: 1.7 }}>
              Set up in under five minutes. No integrations required to start.
            </p>
          </div>

          <div className="lp-step-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            {[
              {
                num: '01',
                title: 'Add your deals',
                desc: 'Enter your pipeline manually or import from HubSpot. Each deal gets a company, value, stage, and context.',
                color: '#3b82f6',
              },
              {
                num: '02',
                title: 'Update with notes',
                desc: 'After every call, paste your notes. AI extracts objections, risks, competitors, and next steps automatically.',
                color: 'var(--brand)',
              },
              {
                num: '03',
                title: 'Get intelligence',
                desc: 'Your AI brain learns your pipeline and generates daily briefings, deal scores, risk alerts, and coaching.',
                color: '#8b5cf6',
              },
            ].map(s => (
              <div key={s.num} className="lp-step-card">
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: `${s.color}10`, border: `1.5px solid ${s.color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: 800, color: s.color,
                  margin: '0 auto 20px',
                }}>
                  {s.num}
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Intelligence showcase ────────────────────────────────────────── */}
      <section style={{ background: 'var(--surface-1)', padding: '100px 32px' }}>
        <div className="lp-two-col" style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
              The brain
            </p>
            <h2 style={{ fontSize: '34px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0, marginBottom: '16px', lineHeight: 1.2 }}>
              AI that actually knows your deals
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '28px' }}>
              Every deal update, meeting note, and stage change feeds into your workspace brain. It learns what winning looks like for your team and applies that intelligence across your entire pipeline.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                'ML models trained on your win/loss history',
                'Deal scoring calibrated to your actual close rates',
                'Pattern detection across objections and competitors',
                'Forecast accuracy tracking with confidence intervals',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--brand)15', border: '1px solid var(--brand)30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ color: 'var(--brand)', fontSize: '11px', fontWeight: 800 }}>&#x2713;</div>
                  </div>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{
            background: 'var(--page-bg)', border: '1px solid var(--border-default)', borderRadius: '16px',
            padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand)' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Intelligence</span>
            </div>
            {[
              { label: 'Win Rate', value: '34%', delta: '+6% vs last quarter', positive: true },
              { label: 'Avg Deal Cycle', value: '42 days', delta: '-8 days vs benchmark', positive: true },
              { label: 'Pipeline Health', value: '£1.2M', delta: '12 deals active', positive: true },
              { label: 'At Risk', value: '3 deals', delta: '£340k exposure', positive: false },
            ].map(m => (
              <div key={m.label} style={{
                background: 'var(--surface-1)', border: '1px solid var(--border-default)', borderRadius: '10px',
                padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>{m.value}</div>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: m.positive ? 'var(--brand)' : '#ef4444', textAlign: 'right' }}>
                  {m.delta}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For Sales / For Product ──────────────────────────────────────── */}
      <section style={{ background: 'var(--page-bg)', padding: '100px 32px', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
        <div className="lp-two-col" style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {[
            {
              title: 'For sales teams',
              color: 'var(--brand)',
              items: [
                'Daily AI briefing with exact names and actions',
                'Deal scoring that predicts close probability',
                'Risk alerts before deals go dark',
                'Meeting intelligence from every call',
                'Stakeholder mapping and coaching',
              ],
            },
            {
              title: 'For revenue leaders',
              color: '#3b82f6',
              items: [
                'Pipeline analytics with stage velocity',
                'Win/loss patterns across the team',
                'Forecast accuracy with ML confidence',
                'Competitive win rates and trends',
                'Product gap impact on revenue',
              ],
            },
          ].map(col => (
            <div key={col.title} className="lp-feature-card" style={{ padding: '36px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '20px' }}>
                {col.title}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {col.items.map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ background: 'var(--surface-1)', padding: '100px 32px' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
            Pricing
          </p>
          <h2 style={{ fontSize: '38px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0, marginBottom: '16px' }}>
            Simple, transparent pricing
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '40px' }}>
            Start free. Upgrade when Halvex is closing deals for you.
          </p>

          <div style={{
            background: 'var(--surface-1)', border: '2px solid var(--brand)', borderRadius: '16px',
            padding: '40px 32px', textAlign: 'center',
            boxShadow: '0 0 0 4px rgba(29,184,106,0.08)',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
              Pro
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px', marginBottom: '8px' }}>
              <span style={{ fontSize: '48px', fontWeight: 800, color: 'var(--text-primary)' }}>£79</span>
              <span style={{ fontSize: '16px', color: 'var(--text-tertiary)', fontWeight: 500 }}>/month</span>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '28px' }}>per workspace</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', marginBottom: '32px' }}>
              {[
                'Unlimited deals and contacts',
                'AI deal scoring and daily briefings',
                'Meeting intelligence extraction',
                'Pipeline analytics and forecasting',
                'Win/loss ML models',
                'HubSpot integration',
                'MCP server for Claude',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--brand)', fontWeight: 700 }}>&#x2713;</span>
                  {f}
                </div>
              ))}
            </div>

            <Link href="/sign-up" className="lp-cta-primary" style={{ width: '100%', justifyContent: 'center', padding: '16px' }}>
              Start free trial
            </Link>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '12px' }}>14-day free trial. No credit card required.</p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section style={{
        background: 'var(--surface-1)',
        borderTop: '1px solid var(--border-default)',
        padding: '88px 32px', textAlign: 'center', color: 'var(--text-primary)',
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: 0, marginBottom: '16px', lineHeight: 1.2 }}>
            Stop guessing.<br />Start closing.
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '32px' }}>
            Join revenue teams using Halvex to turn pipeline chaos into closed deals.
          </p>
          <Link href="/sign-up" className="lp-cta-primary" style={{ padding: '16px 36px', fontSize: '16px' }}>
            Get started free
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--page-bg)', borderTop: '1px solid var(--border-default)', padding: '32px' }}>
        <div className="lp-footer-inner" style={{
          maxWidth: '1080px', margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '6px', background: 'var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 800, color: '#fff',
            }}>H</div>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              &copy; {new Date().getFullYear()} Halvex
            </span>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            {[
              { label: 'Privacy', href: '/privacy' },
              { label: 'Terms', href: '/terms' },
              { label: 'Sign in', href: '/sign-in' },
            ].map(l => (
              <Link key={l.label} href={l.href} style={{ fontSize: '12px', color: 'var(--text-tertiary)', transition: 'color 0.15s' }}
                className="lp-nav-link">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
