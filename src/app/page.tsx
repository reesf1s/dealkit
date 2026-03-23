import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Halvex — The intelligence layer for B2B sales',
  description:
    'Private ML trained on your closed deals scores every opportunity, surfaces risk, and tells you exactly what to do. Start free.',
  openGraph: {
    title: 'Halvex — Every deal scored. Every risk surfaced.',
    description:
      'Private ML trained on your closed deals — not industry averages. Halvex tells you exactly what to do, who to call, and which deals are dying.',
    type: 'website',
    url: 'https://halvex.com',
    siteName: 'Halvex',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Halvex — Every deal scored. Every risk surfaced.',
    description:
      'Private ML trained on your closed deals — not industry averages. Halvex tells you exactly what to do, who to call, and which deals are dying.',
  },
}

/* ── Design tokens (inline) ─────────────────────────────────── */
const bg = '#09090B'
const card = '#141416'
const textPrimary = 'rgba(255,255,255,0.93)'
const textSecondary = 'rgba(255,255,255,0.55)'
const textTertiary = 'rgba(255,255,255,0.32)'
const accent = '#5B5BD6'
const maxW = '960px'
const cardRadius = '8px'

export default async function LandingPage() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <div
      style={{
        background: bg,
        color: textPrimary,
        fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Inter", sans-serif',
        minHeight: '100vh',
        overflowX: 'hidden',
      }}
    >
      {/* ── Responsive styles ──────────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          [data-hero-headline] { font-size: 32px !important; }
          [data-section] { padding-top: 64px !important; padding-bottom: 64px !important; }
          [data-hero-section] { padding-top: 120px !important; padding-bottom: 64px !important; }
          [data-two-col] { grid-template-columns: 1fr !important; }
          [data-three-col] { grid-template-columns: 1fr !important; }
          [data-pricing-grid] { grid-template-columns: 1fr !important; }
          [data-hero-buttons] { flex-direction: column !important; width: 100% !important; }
          [data-hero-buttons] a { width: 100% !important; min-height: 48px !important; justify-content: center !important; }
          [data-cta-button] { width: 100% !important; min-height: 48px !important; justify-content: center !important; }
          [data-content-wrap] { padding: 0 20px !important; }
          [data-compare-card] { grid-template-columns: 1fr !important; }
          [data-compare-divider] { display: none !important; }
          [data-compare-mobile-divider] { display: block !important; }
          [data-arch-row] { flex-direction: column !important; }
        }
      `}</style>

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: '56px',
          background: 'rgba(9,9,11,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span
          className="font-brand-wordmark"
          style={{
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          HALVEX
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link
            href="/sign-in"
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              color: textSecondary,
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 18px',
              height: '36px',
              background: accent,
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Start free &rarr;
          </Link>
        </div>
      </nav>

      <div data-content-wrap="" style={{ maxWidth: maxW, margin: '0 auto', padding: '0 24px' }}>
        {/* ══════════════════════════════════════════════════════════
            SECTION 1 — HERO
        ══════════════════════════════════════════════════════════ */}
        <section
          data-hero-section=""
          data-section=""
          style={{
            paddingTop: '160px',
            paddingBottom: '120px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            className="font-brand-wordmark"
            style={{
              color: 'rgba(255,255,255,0.35)',
              marginBottom: '32px',
            }}
          >
            HALVEX
          </div>

          <h1
            data-hero-headline=""
            className="font-brand"
            style={{
              fontSize: '52px',
              fontWeight: 400,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              marginBottom: '24px',
              maxWidth: '720px',
            }}
          >
            Every deal scored.
            <br />
            Every risk surfaced.
            <br />
            Every morning.
          </h1>

          <p
            style={{
              fontSize: '18px',
              color: 'rgba(255,255,255,0.60)',
              lineHeight: 1.7,
              marginBottom: '40px',
              maxWidth: '640px',
            }}
          >
            Private ML trained on your closed deals &mdash; not industry averages. Halvex tells you
            exactly what to do, who to call, and which deals are dying.
          </p>

          <div
            data-hero-buttons=""
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '40px',
            }}
          >
            <Link
              href="/sign-up"
              data-cta-button=""
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '0 28px',
                height: '44px',
                background: accent,
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Start free &rarr;
            </Link>
            <a
              href="#how-it-works"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '0 28px',
                height: '44px',
                background: 'transparent',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.15)',
                color: textPrimary,
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              See how it works &darr;
            </a>
          </div>

          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.30)' }}>
            Trusted by teams managing &pound;1M+ pipelines
          </p>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 2 — THE PROBLEM
        ══════════════════════════════════════════════════════════ */}
        <section data-section="" style={{ paddingTop: '0', paddingBottom: '120px' }}>
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              marginBottom: '48px',
              lineHeight: 1.2,
            }}
          >
            Your CRM knows what happened.
            <br />
            It has no idea what&apos;s about to.
          </h2>

          <div
            data-compare-card=""
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1px 1fr',
              background: card,
              borderRadius: cardRadius,
              overflow: 'hidden',
            }}
          >
            {/* CRM side */}
            <div style={{ padding: '32px' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  color: textTertiary,
                  textTransform: 'uppercase',
                  marginBottom: '20px',
                }}
              >
                Your CRM says
              </div>
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: 700,
                  color: '#22c55e',
                  marginBottom: '12px',
                }}
              >
                82
              </div>
              <div style={{ fontSize: '14px', color: textSecondary, lineHeight: 1.7 }}>
                &ldquo;Deal is on track. Close date next month. Rep says champion is engaged.&rdquo;
              </div>
            </div>

            {/* Divider */}
            <div
              data-compare-divider=""
              style={{ background: 'rgba(255,255,255,0.06)' }}
            />
            <div
              data-compare-mobile-divider=""
              style={{
                display: 'none',
                height: '1px',
                background: 'rgba(255,255,255,0.06)',
                gridColumn: '1 / -1',
              }}
            />

            {/* Halvex side */}
            <div style={{ padding: '32px' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  color: textTertiary,
                  textTransform: 'uppercase',
                  marginBottom: '20px',
                }}
              >
                Halvex says
              </div>
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: 700,
                  color: '#ef4444',
                  marginBottom: '12px',
                }}
              >
                38
              </div>
              <div style={{ fontSize: '14px', color: textSecondary, lineHeight: 1.7 }}>
                &ldquo;Champion went silent 18 days ago. No technical validation. Budget
                conversation stalled. Deals like this close 12% of the time.&rdquo;
              </div>
            </div>
          </div>

          <p
            style={{
              fontSize: '15px',
              color: textSecondary,
              lineHeight: 1.7,
              marginTop: '24px',
              maxWidth: '720px',
            }}
          >
            CRM scores use metadata &mdash; stage, close date, deal size. Halvex reads what actually
            happened in every conversation, matches it against your closed-won and closed-lost
            history, and gives you a score grounded in reality.
          </p>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 3 — HOW IT WORKS
        ══════════════════════════════════════════════════════════ */}
        <section
          id="how-it-works"
          data-section=""
          style={{ paddingTop: '0', paddingBottom: '120px' }}
        >
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              marginBottom: '48px',
            }}
          >
            From raw pipeline to scored intelligence in seconds.
          </h2>

          <div
            data-three-col=""
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px',
            }}
          >
            {[
              {
                num: '1',
                title: 'CONNECT',
                desc: 'Add your deals and conversations. Halvex extracts signals automatically — champion status, budget, risks, competitive mentions, product gaps.',
              },
              {
                num: '2',
                title: 'SCORE',
                desc: 'Private ML trained on your closed deals calculates win probability. Every score is pure math from your own history — never hallucinated.',
              },
              {
                num: '3',
                title: 'ACT',
                desc: 'Morning briefings with specific actions for each deal. Which deals need attention, what changed, and exactly what to do next.',
              },
            ].map(({ num, title, desc }) => (
              <div
                key={num}
                style={{
                  background: card,
                  borderRadius: cardRadius,
                  padding: '28px',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(91,91,214,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: accent,
                    marginBottom: '16px',
                  }}
                >
                  {num}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '1.5px',
                    color: textPrimary,
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                  }}
                >
                  {title}
                </div>
                <div style={{ fontSize: '14px', color: textSecondary, lineHeight: 1.7 }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 4 — WHY NOT HUBSPOT?
        ══════════════════════════════════════════════════════════ */}
        <section data-section="" style={{ paddingTop: '0', paddingBottom: '120px' }}>
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              marginBottom: '48px',
              lineHeight: 1.2,
            }}
          >
            &ldquo;We already have HubSpot forecasting.
            <br />
            Why would we need this?&rdquo;
          </h2>

          <div
            data-two-col=""
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}
          >
            {/* HubSpot side — dimmed */}
            <div
              style={{
                background: card,
                borderRadius: cardRadius,
                padding: '28px',
                opacity: 0.55,
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  color: textTertiary,
                  textTransform: 'uppercase',
                  marginBottom: '20px',
                }}
              >
                HubSpot
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  fontSize: '14px',
                  color: textSecondary,
                  lineHeight: 1.7,
                }}
              >
                <div>Scores on metadata: stage, amount, close date</div>
                <div>Generic model trained on industry averages</div>
                <div>No signal extraction from conversations</div>
                <div>Forecast based on rep self-reporting</div>
                <div>No specific daily actions</div>
              </div>
            </div>

            {/* Halvex side — bright, accent border */}
            <div
              style={{
                background: card,
                borderRadius: cardRadius,
                padding: '28px',
                borderLeft: `3px solid ${accent}`,
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  color: accent,
                  textTransform: 'uppercase',
                  marginBottom: '20px',
                }}
              >
                Halvex
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  fontSize: '14px',
                  color: textSecondary,
                  lineHeight: 1.7,
                }}
              >
                <div>Scores on what actually happened in every interaction</div>
                <div>Private ML trained on your own win/loss data</div>
                <div>Extracts signals, risks, and gaps from conversations</div>
                <div>Forecast based on behavioural evidence</div>
                <div>Daily briefing with specific next actions</div>
              </div>
            </div>
          </div>

          <p
            style={{
              fontSize: '15px',
              color: textSecondary,
              lineHeight: 1.7,
              marginTop: '24px',
              maxWidth: '720px',
            }}
          >
            HubSpot sees that a deal moved from &ldquo;Discovery&rdquo; to &ldquo;Proposal.&rdquo;
            Halvex reads every conversation and knows the champion hasn&apos;t mentioned budget in
            three interactions, the technical evaluation stalled, and a competitor was named twice
            last week.
          </p>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 5 — WHAT YOU GET
        ══════════════════════════════════════════════════════════ */}
        <section data-section="" style={{ paddingTop: '0', paddingBottom: '120px' }}>
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              marginBottom: '48px',
            }}
          >
            Intelligence that compounds.
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '720px' }}>
            {[
              {
                title: 'Morning Briefing',
                desc: 'Every deal that needs attention, what changed, and exactly what to do about it. Delivered before your first call.',
              },
              {
                title: 'Deal Intelligence',
                desc: 'Win probability, risk signals, competitive threats, and champion health — for every deal, updated with every interaction.',
              },
              {
                title: 'Private ML',
                desc: 'A model trained only on your data. What winning looks like for your team, your market, your deal shape. No generic benchmarks.',
              },
              {
                title: 'Product Gap Detection',
                desc: 'Automatically surfaces feature requests and missing capabilities mentioned across your pipeline. Ranked by revenue impact.',
              },
              {
                title: 'Collateral Engine',
                desc: 'Generates deal-specific battlecards, objection handlers, and case study recommendations based on live competitive intelligence.',
              },
            ].map(({ title, desc }) => (
              <div
                key={title}
                style={{
                  background: card,
                  borderRadius: cardRadius,
                  padding: '24px 28px',
                }}
              >
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: textPrimary,
                    marginBottom: '6px',
                  }}
                >
                  {title}
                </div>
                <div style={{ fontSize: '14px', color: textSecondary, lineHeight: 1.7 }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 6 — THE ARCHITECTURE
        ══════════════════════════════════════════════════════════ */}
        <section data-section="" style={{ paddingTop: '0', paddingBottom: '120px' }}>
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              marginBottom: '48px',
            }}
          >
            Three layers. No shortcuts.
          </h2>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              maxWidth: '720px',
            }}
          >
            {[
              {
                label: 'Layer 1',
                title: 'Signal Extraction',
                desc: 'AI reads every conversation and extracts structured signals — champion status, budget indicators, risk markers, competitive mentions, and product gaps.',
              },
              {
                label: 'Layer 2',
                title: 'Private ML Engine',
                desc: 'A model trained exclusively on your closed deals. Win probability calculated from real patterns in your data. No industry averages. No hallucinated scores.',
              },
              {
                label: 'Layer 3',
                title: 'AI Narration',
                desc: 'AI explains every score in plain language. Why is this deal at risk? What changed? What should you do next? Specific, actionable, grounded in evidence.',
              },
            ].map(({ label, title, desc }, i) => (
              <div
                key={title}
                data-arch-row=""
                style={{
                  display: 'flex',
                  gap: '24px',
                  alignItems: 'flex-start',
                }}
              >
                {/* Left: flow indicator */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flexShrink: 0,
                    width: '40px',
                    paddingTop: '28px',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: accent,
                    }}
                  />
                  {i < 2 && (
                    <div
                      style={{
                        width: '1px',
                        height: '60px',
                        background: 'rgba(255,255,255,0.08)',
                        marginTop: '4px',
                      }}
                    />
                  )}
                </div>

                {/* Right: card */}
                <div
                  style={{
                    background: card,
                    borderRadius: cardRadius,
                    padding: '24px 28px',
                    flex: 1,
                    marginBottom: i < 2 ? '0' : '0',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '1.5px',
                      color: textTertiary,
                      textTransform: 'uppercase',
                      marginBottom: '4px',
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: textPrimary,
                      marginBottom: '6px',
                    }}
                  >
                    {title}
                  </div>
                  <div style={{ fontSize: '14px', color: textSecondary, lineHeight: 1.7 }}>
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p
            style={{
              fontSize: '15px',
              color: textSecondary,
              lineHeight: 1.7,
              marginTop: '32px',
              maxWidth: '720px',
            }}
          >
            AI extracts. ML predicts. AI explains. No score is ever hallucinated.
          </p>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 7 — PRICING
        ══════════════════════════════════════════════════════════ */}
        <section data-section="" style={{ paddingTop: '0', paddingBottom: '120px' }}>
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              marginBottom: '48px',
            }}
          >
            Start free. Pay when it&apos;s useful.
          </h2>

          <div
            data-pricing-grid=""
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
            }}
          >
            {/* Free */}
            <div
              style={{
                background: card,
                borderRadius: cardRadius,
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: textSecondary }}>
                Free
              </div>
              <div style={{ fontSize: '36px', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: '4px' }}>
                &pound;0
              </div>
              <div style={{ fontSize: '13px', color: textTertiary, marginBottom: '28px' }}>
                For getting started
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', flex: 1 }}>
                {[
                  '5 deals',
                  'Signal extraction',
                  'Manual deal scoring',
                  'Basic pipeline view',
                ].map((f) => (
                  <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ color: accent, fontSize: '14px', lineHeight: '20px', flexShrink: 0 }}>&#10003;</span>
                    <span style={{ fontSize: '13px', color: textSecondary, lineHeight: '20px' }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/sign-up"
                data-cta-button=""
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '44px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: textPrimary,
                  fontSize: '13px',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Start free
              </Link>
            </div>

            {/* Starter — highlighted */}
            <div
              style={{
                background: card,
                borderRadius: cardRadius,
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${accent}`,
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '24px',
                  background: accent,
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 12px',
                  borderRadius: '100px',
                }}
              >
                Most popular
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: textSecondary }}>
                Starter
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '36px', fontWeight: 600, letterSpacing: '-0.03em' }}>&pound;79</span>
                <span style={{ fontSize: '14px', color: textTertiary }}>/mo</span>
              </div>
              <div style={{ fontSize: '13px', color: textTertiary, marginBottom: '28px' }}>
                For growing teams
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', flex: 1 }}>
                {[
                  'Unlimited deals',
                  'ML deal scoring',
                  'Daily AI briefing',
                  'Score simulator',
                  'Conversation intelligence',
                  'Risk & stall detection',
                ].map((f) => (
                  <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ color: accent, fontSize: '14px', lineHeight: '20px', flexShrink: 0 }}>&#10003;</span>
                    <span style={{ fontSize: '13px', color: textSecondary, lineHeight: '20px' }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/sign-up"
                data-cta-button=""
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '44px',
                  borderRadius: '6px',
                  background: accent,
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Start free &rarr;
              </Link>
            </div>

            {/* Pro */}
            <div
              style={{
                background: card,
                borderRadius: cardRadius,
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: textSecondary }}>
                Pro
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '36px', fontWeight: 600, letterSpacing: '-0.03em' }}>&pound;149</span>
                <span style={{ fontSize: '14px', color: textTertiary }}>/mo</span>
              </div>
              <div style={{ fontSize: '13px', color: textTertiary, marginBottom: '28px' }}>
                For scaling revenue teams
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', flex: 1 }}>
                {[
                  'Everything in Starter',
                  'Collateral generation',
                  'HubSpot sync',
                  'Battlecards & case studies',
                  'Priority support',
                  'Team analytics',
                ].map((f) => (
                  <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ color: accent, fontSize: '14px', lineHeight: '20px', flexShrink: 0 }}>&#10003;</span>
                    <span style={{ fontSize: '13px', color: textSecondary, lineHeight: '20px' }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/sign-up"
                data-cta-button=""
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '44px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: textPrimary,
                  fontSize: '13px',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Start free
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 8 — CTA + FOOTER
      ══════════════════════════════════════════════════════════ */}
      <section
        data-section=""
        style={{
          paddingTop: '0',
          paddingBottom: '80px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 24px' }}>
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              marginBottom: '12px',
            }}
          >
            Your pipeline has risks you&apos;re not seeing.
          </h2>
          <p
            style={{
              fontSize: '18px',
              color: textSecondary,
              marginBottom: '32px',
            }}
          >
            Add your first deal. See what Halvex finds.
          </p>
          <Link
            href="/sign-up"
            data-cta-button=""
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '0 32px',
              height: '48px',
              background: accent,
              borderRadius: '6px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Start free &rarr;
          </Link>
        </div>
      </section>

      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '48px 24px 64px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: '15px',
            color: textSecondary,
            lineHeight: 1.7,
            maxWidth: '520px',
            margin: '0 auto 16px',
          }}
        >
          Halvex &mdash; The intelligence layer for B2B sales.
        </p>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.30)' }}>
          London, UK &middot; Halvex Ltd
        </p>
      </footer>
    </div>
  )
}
