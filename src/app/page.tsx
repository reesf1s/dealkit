import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Halvex — Deal Intelligence CRM',
  description: 'Halvex is a deal intelligence CRM that connects sales context, product outcomes, and AI review so teams can understand what is blocking revenue and act faster.',
  openGraph: {
    title: 'Halvex — Deal Intelligence CRM',
    description: 'Stop losing deals to product blockers. Halvex gives your team shared deal intelligence, CRM context, and AI-assisted issue review.',
    type: 'website',
    url: 'https://halvex.ai',
    siteName: 'Halvex',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Halvex — Deal Intelligence CRM',
    description: 'Stop losing deals to product blockers.',
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
    <div style={{
      background: '#080a12',
      color: '#f1f5f9',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: '14px',
      lineHeight: '1.6',
      minHeight: '100vh',
      overflowX: 'hidden',
      WebkitFontSmoothing: 'antialiased',
    }}>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        a { color: inherit; text-decoration: none; }
        @keyframes pulse-slow { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes flow-right {
          0% { stroke-dashoffset: 100; opacity: 0; }
          20% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0.6; }
        }
        .nav-link:hover { color: #f1f5f9 !important; }
        .cta-primary:hover { background: rgba(255,255,255,0.90) !important; }
        .cta-secondary:hover { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.16) !important; }
        .loop-card:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.14) !important; }
        .pricing-card:hover { border-color: rgba(255,255,255,0.14) !important; }
        @media (max-width: 768px) {
          .hero-h1 { font-size: 32px !important; }
          .loop-grid { grid-template-columns: 1fr !important; }
          .for-grid { grid-template-columns: 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .nav-links { display: none !important; }
          .int-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      {/* ── Nav ───────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(8,10,18,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 24px',
        height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.80) 0%, rgba(255,255,255,0.70) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 800, color: '#fff',
            }}>H</div>
            <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f1f5f9' }}>HALVEX</span>
          </Link>
          <div className="nav-links" style={{ display: 'flex', gap: '24px' }}>
            {['Product', 'Integrations'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="nav-link"
                style={{ fontSize: '13px', color: 'rgba(241,245,249,0.55)', transition: 'color 0.15s' }}>
                {item}
              </a>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link href="/sign-in" style={{ fontSize: '13px', color: 'rgba(241,245,249,0.55)', padding: '6px 14px' }}
            className="nav-link">
            Sign in
          </Link>
          <Link href="/sign-up"
            className="cta-primary"
            style={{
              fontSize: '13px', fontWeight: 600, color: '#0a0b0f',
              background: 'rgba(255,255,255,0.80)', padding: '7px 16px', borderRadius: '8px',
              transition: 'background 0.15s',
            }}>
            Get started →
          </Link>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '96px 24px 80px', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '4px 14px', borderRadius: '100px',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
          fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.70)', letterSpacing: '0.06em',
          textTransform: 'uppercase', marginBottom: '28px',
        }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(255,255,255,0.70)', animation: 'pulse-slow 2s infinite' }} />
          Deal Intelligence CRM
        </div>

        <h1 className="hero-h1" style={{
          fontSize: '52px', fontWeight: 800, lineHeight: 1.08,
          letterSpacing: '-0.03em', color: '#f1f5f9',
          marginBottom: '20px',
        }}>
          Stop losing deals to features{' '}
          <span style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.80), rgba(255,255,255,0.70))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>you haven&apos;t built yet</span>
        </h1>

        <p style={{
          fontSize: '17px', lineHeight: 1.7,
          color: 'rgba(241,245,249,0.60)', maxWidth: '580px', margin: '0 auto 36px',
        }}>
          Halvex gives sales and product one shared source of truth. Sync your revenue context, review relevant product work with AI, and track which issues are actually blocking deals.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/sign-up"
            className="cta-primary"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '12px 28px', borderRadius: '10px', fontWeight: 700,
              fontSize: '15px', color: '#0a0b0f', background: 'rgba(255,255,255,0.80)',
              transition: 'background 0.15s',
            }}>
            Start for free
          </Link>
          <a href="#product"
            className="cta-secondary"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '12px 28px', borderRadius: '10px', fontWeight: 600,
              fontSize: '15px', color: 'rgba(241,245,249,0.75)',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)',
              transition: 'all 0.15s',
            }}>
            See how it works ↓
          </a>
        </div>

        {/* Loop diagram hero illustration */}
        <div id="product" style={{ marginTop: '64px', display: 'flex', justifyContent: 'center', gap: '0', alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
          {[
            { label: 'Deal logged', sub: 'Win/loss patterns', color: '#10b981', icon: '📊' },
            { label: 'Gap detected', sub: 'Ranked by revenue', color: 'rgba(255,255,255,0.80)', icon: '🎯' },
            { label: 'AI-reviewed links', sub: 'High-confidence issues only', color: '#3b82f6', icon: '🔗' },
            { label: 'Rep notified', sub: 'Re-engagement email', color: '#f59e0b', icon: '✉️' },
          ].map((node, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                padding: '16px 20px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                textAlign: 'center', minWidth: '130px',
                backdropFilter: 'blur(16px)',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>{node.icon}</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: node.color, marginBottom: '3px' }}>{node.label}</div>
                <div style={{ fontSize: '11px', color: 'rgba(241,245,249,0.40)' }}>{node.sub}</div>
              </div>
              {i < 3 && (
                <div style={{
                  width: '28px', height: '2px', background: 'linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                  flexShrink: 0, position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', right: '-3px', top: '-4px',
                    width: '8px', height: '8px', border: '2px solid rgba(255,255,255,0.15)',
                    borderLeft: 'none', borderBottom: 'none',
                    transform: 'rotate(45deg)',
                  }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Product Intelligence Section ─────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', color: '#f1f5f9', marginBottom: '12px' }}>
              Deal intelligence that keeps sales and product aligned
            </h2>
            <p style={{ fontSize: '16px', color: 'rgba(241,245,249,0.55)', maxWidth: '480px', margin: '0 auto' }}>
              Four live steps that turn deal context into prioritised product visibility your team can act on.
            </p>
          </div>

          <div className="loop-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              {
                step: '01', title: 'Log deal outcomes', body: 'Every meeting note, win reason, and objection feeds the intelligence engine.',
                color: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.14)',
              },
              {
                step: '02', title: 'Halvex surfaces blockers', body: 'Halvex ranks product blockers by revenue at stake. If SSO is putting £240k at risk, your team sees it fast.',
                color: 'rgba(255,255,255,0.80)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.06)',
              },
              {
                step: '03', title: 'Claude reviews externally', body: 'Claude uses Halvex MCP plus its own tool access to review the deal and save only the genuinely relevant issue links back into Halvex.',
                color: '#3b82f6', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.14)',
              },
              {
                step: '04', title: 'Teams act with context', body: 'Sales sees what is blocked, product sees why it matters, and everyone can follow progress from deal to shipped work.',
                color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.14)',
              },
            ].map(card => (
              <div key={card.step} className="loop-card" style={{
                padding: '24px', borderRadius: '12px',
                background: card.bg, border: `1px solid ${card.border}`,
                transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: card.color, letterSpacing: '0.08em', marginBottom: '12px' }}>{card.step}</div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px', letterSpacing: '-0.01em' }}>{card.title}</h3>
                <p style={{ fontSize: '13px', color: 'rgba(241,245,249,0.55)', lineHeight: 1.6 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For Sales / For Product ───────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div className="for-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {[
              {
                audience: 'For sales teams',
                color: 'rgba(255,255,255,0.80)',
                headline: 'Know which deals are at risk before it\'s too late',
                points: [
                  'Deal health ring shows win probability at a glance',
                  'Competitive battlecards built from your actual wins',
                  'Ask anything in Slack: "What\'s blocking Acme?"',
                  'Review saved issue links on the deal itself',
                  'Use Ask AI or Claude MCP to inspect blockers quickly',
                ],
              },
              {
                audience: 'For product teams',
                color: '#10b981',
                headline: 'Build what actually moves revenue',
                points: [
                  'See which features are blocking the most ARR',
                  'Every saved issue link carries deal context back into Halvex',
                  'Prioritise by revenue impact, not gut feel',
                  'When work ships, reps can follow up with live product context',
                  'Win/loss data feeds directly into your roadmap',
                ],
              },
            ].map(col => (
              <div key={col.audience} style={{
                padding: '32px', borderRadius: '14px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{
                  display: 'inline-flex', padding: '3px 12px', borderRadius: '100px',
                  background: `${col.color}15`, border: `1px solid ${col.color}30`,
                  fontSize: '11px', fontWeight: 600, color: col.color, marginBottom: '16px',
                  letterSpacing: '0.04em',
                }}>
                  {col.audience}
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em', marginBottom: '20px', lineHeight: 1.3 }}>
                  {col.headline}
                </h3>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {col.points.map((point, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'rgba(241,245,249,0.65)' }}>
                      <span style={{ color: col.color, flexShrink: 0, marginTop: '2px', fontSize: '12px' }}>✓</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations ─────────────────────────────────────────────────────── */}
      <section id="integrations" style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: '#f1f5f9', marginBottom: '10px' }}>
            Integrations
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(241,245,249,0.45)', marginBottom: '40px' }}>
            Live integrations available in the product today.
          </p>
          <div className="int-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', maxWidth: '720px', margin: '0 auto' }}>
            {[
              { name: 'HubSpot', color: '#ff7a59' },
              { name: 'Claude', color: '#5e6ad2' },
              { name: 'Slack', color: '#4a154b' },
              { name: 'Claude MCP', color: 'rgba(255,255,255,0.80)' },
            ].map(int => (
              <div key={int.name} style={{
                padding: '14px 10px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                textAlign: 'center',
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: `${int.color}20`, border: `1px solid ${int.color}30`,
                  margin: '0 auto 8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700, color: int.color,
                }}>
                  {int.name[0]}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(241,245,249,0.65)' }}>{int.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product Focus ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', color: '#f1f5f9', marginBottom: '10px' }}>Built for the real operating workflow</h2>
            <p style={{ fontSize: '15px', color: 'rgba(241,245,249,0.50)' }}>Halvex is strongest when revenue context, product context, and AI review all stay in sync.</p>
          </div>

          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', alignItems: 'start' }}>
            {[
              {
                name: 'Revenue context', featured: false,
                features: ['Log deals, notes, and blockers', 'Keep sales context tied to every account', 'Use Ask AI to inspect risk and momentum'],
              },
              {
                name: 'Product review', featured: true,
                features: ['Use Claude MCP to review deal blockers', 'Save high-confidence issue links back into the deal', 'Keep issue visibility inside the CRM, not in side workflows'],
              },
              {
                name: 'Shared execution', featured: false,
                features: ['Track confirmed links over time', 'Give sales and product one shared view', 'Follow blocker progress from deal to shipped work'],
              },
            ].map(tier => (
              <div key={tier.name} className="pricing-card" style={{
                padding: '28px 24px', borderRadius: '14px',
                background: tier.featured ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                border: tier.featured ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.08)',
                transition: 'border-color 0.15s',
                position: 'relative',
              }}>
                {tier.featured && (
                  <div style={{
                    position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)',
                    padding: '2px 16px', borderRadius: '100px',
                    background: 'rgba(255,255,255,0.80)', fontSize: '11px', fontWeight: 700, color: '#0a0b0f',
                    letterSpacing: '0.04em',
                  }}>Core workflow</div>
                )}
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', marginBottom: '10px' }}>{tier.name}</div>
                <div style={{ marginBottom: '20px', fontSize: '13px', color: 'rgba(241,245,249,0.55)', lineHeight: 1.7 }}>
                  {tier.featured ? 'Where Halvex makes product review trustworthy with shared context.' : 'A live part of the current product experience.'}
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                  {tier.features.map((f, i) => (
                    <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'rgba(241,245,249,0.65)', alignItems: 'flex-start' }}>
                      <span style={{ color: tier.featured ? 'rgba(255,255,255,0.70)' : '#10b981', flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'rgba(241,245,249,0.40)' }}>
            Want access? <a href="mailto:hello@halvex.io" style={{ color: 'rgba(255,255,255,0.70)' }}>Contact the team</a>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', color: '#f1f5f9', marginBottom: '12px' }}>
            Start using shared revenue context today
          </h2>
          <p style={{ fontSize: '15px', color: 'rgba(241,245,249,0.50)', marginBottom: '28px' }}>
            Connect Slack, your CRM, and Claude MCP to see the full Halvex workflow in action.
          </p>
          <Link href="/sign-up"
            className="cta-primary"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '13px 32px', borderRadius: '10px', fontWeight: 700,
              fontSize: '15px', color: '#0a0b0f', background: 'rgba(255,255,255,0.80)',
              transition: 'background 0.15s',
            }}>
            Get started free →
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '32px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '12px',
        maxWidth: '960px', margin: '0 auto',
      }}>
        <div style={{ fontSize: '12px', color: 'rgba(241,245,249,0.35)' }}>
          Halvex — The deal intelligence CRM
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          {[
            { label: 'Privacy', href: '/privacy' },
            { label: 'Terms', href: '/terms' },
            { label: 'Sign in', href: '/sign-in' },
          ].map(l => (
            <Link key={l.label} href={l.href} className="nav-link"
              style={{ fontSize: '12px', color: 'rgba(241,245,249,0.35)', transition: 'color 0.15s' }}>
              {l.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  )
}
