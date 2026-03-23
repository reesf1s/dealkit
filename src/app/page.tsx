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

/* ── Design tokens ─────────────────────────────────────────── */
const bg = '#09090B'
const textPrimary = 'rgba(255,255,255,0.93)'
const textSecondary = 'rgba(255,255,255,0.55)'
const textTertiary = 'rgba(255,255,255,0.32)'
const accent = '#5B5BD6'
const green = '#3CCB7F'
const amber = '#F59E0B'
const maxW = '960px'

export default async function LandingPage() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <div
      style={{
        background: bg,
        color: textPrimary,
        fontFamily: 'var(--ds-font)',
        minHeight: '100vh',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── Global styles + responsive + animations ──────────── */}
      <style>{`
        @supports (backdrop-filter: blur(1px)) {
          .glass-card {
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
          }
          .glass-card-hero {
            backdrop-filter: blur(40px);
            -webkit-backdrop-filter: blur(40px);
          }
          .glass-nav {
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
          }
        }
        @supports not (backdrop-filter: blur(1px)) {
          .glass-card {
            background: rgba(20,20,22,0.95) !important;
          }
          .glass-card-hero {
            background: rgba(20,20,22,0.95) !important;
          }
          .glass-nav {
            background: rgba(9,9,11,0.95) !important;
          }
        }

        .glass-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          position: relative;
          overflow: hidden;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .glass-card:hover {
          border-color: rgba(255,255,255,0.12);
          box-shadow: 0 0 40px rgba(91,91,214,0.08);
        }

        .glow-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
          z-index: 0;
        }

        .gradient-text {
          background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.6));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        @keyframes pulse-line {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.4; }
        }
        .arch-line-pulse {
          animation: pulse-line 3s ease-in-out infinite;
        }

        @keyframes float-orb {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(15px, -10px); }
        }
        .float-orb-slow {
          animation: float-orb 12s ease-in-out infinite;
        }
        .float-orb-med {
          animation: float-orb 8s ease-in-out infinite reverse;
        }

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
          [data-step-arrow] { display: none !important; }
          .glow-orb { filter: blur(80px) !important; opacity: 0.7 !important; }
          [data-stagger-grid] { grid-template-columns: 1fr !important; }
          [data-starter-elevate] { transform: none !important; }
        }
      `}</style>

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav
        className="glass-nav"
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
          background: 'rgba(9,9,11,0.7)',
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
              boxShadow: '0 0 20px rgba(91,91,214,0.2)',
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
            position: 'relative',
          }}
        >
          {/* Hero gradient orbs */}
          <div
            className="glow-orb float-orb-slow"
            style={{
              width: '600px',
              height: '600px',
              background: 'radial-gradient(circle, rgba(91,91,214,0.20) 0%, transparent 70%)',
              top: '-100px',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
          <div
            className="glow-orb float-orb-med"
            style={{
              width: '500px',
              height: '500px',
              background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)',
              top: '0px',
              right: '-200px',
            }}
          />

          <div
            className="font-brand-wordmark"
            style={{
              color: 'rgba(255,255,255,0.35)',
              marginBottom: '32px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            HALVEX
          </div>

          <h1
            data-hero-headline=""
            className="gradient-text"
            style={{
              fontFamily: 'var(--ds-font-brand)',
              fontSize: '52px',
              fontWeight: 400,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              marginBottom: '24px',
              maxWidth: '720px',
              position: 'relative',
              zIndex: 1,
              textShadow: '0 0 80px rgba(91,91,214,0.3)',
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
              position: 'relative',
              zIndex: 1,
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
              position: 'relative',
              zIndex: 1,
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
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                boxShadow: '0 0 30px rgba(91,91,214,0.3), 0 0 60px rgba(91,91,214,0.1)',
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
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.10)',
                color: textPrimary,
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              See how it works &darr;
            </a>
          </div>

          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.30)', position: 'relative', zIndex: 1 }}>
            Trusted by teams managing &pound;1M+ pipelines
          </p>

          {/* Hero bottom gradient divider */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: '-50vw',
              right: '-50vw',
              height: '1px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 50%, transparent 100%)',
            }}
          />
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 2 — THE PROBLEM
        ══════════════════════════════════════════════════════════ */}
        <section data-section="" style={{ paddingTop: '0', paddingBottom: '120px', position: 'relative' }}>
          <h2
            className="gradient-text"
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

          <div style={{ position: 'relative' }}>
            {/* Background glow behind compare card */}
            <div
              className="glow-orb"
              style={{
                width: '400px',
                height: '400px',
                background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)',
                top: '-50px',
                right: '-100px',
              }}
            />

            <div
              data-compare-card=""
              className="glass-card"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1px 1fr',
                position: 'relative',
                zIndex: 1,
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
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  {/* Green glow behind 82 */}
                  <div
                    style={{
                      position: 'absolute',
                      width: '80px',
                      height: '80px',
                      background: 'radial-gradient(circle, rgba(34,197,94,0.25) 0%, transparent 70%)',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      filter: 'blur(20px)',
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '36px',
                      fontWeight: 700,
                      color: '#22c55e',
                      marginBottom: '12px',
                      position: 'relative',
                    }}
                  >
                    82
                  </div>
                </div>
                <div style={{ fontSize: '14px', color: textSecondary, lineHeight: 1.7 }}>
                  &ldquo;Deal is on track. Close date next month. Rep says champion is engaged.&rdquo;
                </div>
              </div>

              {/* Gradient divider */}
              <div
                data-compare-divider=""
                style={{
                  background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
                }}
              />
              <div
                data-compare-mobile-divider=""
                style={{
                  display: 'none',
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
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
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  {/* Red glow behind 38 */}
                  <div
                    style={{
                      position: 'absolute',
                      width: '80px',
                      height: '80px',
                      background: 'radial-gradient(circle, rgba(239,68,68,0.25) 0%, transparent 70%)',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      filter: 'blur(20px)',
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '36px',
                      fontWeight: 700,
                      color: '#ef4444',
                      marginBottom: '12px',
                      position: 'relative',
                    }}
                  >
                    38
                  </div>
                </div>
                <div style={{ fontSize: '14px', color: textSecondary, lineHeight: 1.7 }}>
                  &ldquo;Champion went silent 18 days ago. No technical validation. Budget
                  conversation stalled. Deals like this close 12% of the time.&rdquo;
                </div>
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
          style={{ paddingTop: '0', paddingBottom: '120px', position: 'relative' }}
        >
          <h2
            className="gradient-text"
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
              position: 'relative',
            }}
          >
            {[
              {
                num: '1',
                title: 'CONNECT',
                desc: 'Add your deals and conversations. Halvex extracts signals automatically — champion status, budget, risks, competitive mentions, product gaps.',
                glowColor: 'rgba(91,91,214,0.18)',
                accentColor: accent,
              },
              {
                num: '2',
                title: 'SCORE',
                desc: 'Private ML trained on your closed deals calculates win probability. Every score is pure math from your own history — never hallucinated.',
                glowColor: 'rgba(60,203,127,0.18)',
                accentColor: green,
              },
              {
                num: '3',
                title: 'ACT',
                desc: 'Morning briefings with specific actions for each deal. Which deals need attention, what changed, and exactly what to do next.',
                glowColor: 'rgba(245,158,11,0.18)',
                accentColor: amber,
              },
            ].map(({ num, title, desc, glowColor, accentColor }, i) => (
              <div key={num} style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
                {/* Glow behind card */}
                <div
                  className="glow-orb"
                  style={{
                    width: '200px',
                    height: '200px',
                    background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
                    top: '20%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}
                />

                <div
                  className="glass-card"
                  style={{
                    padding: '28px',
                    position: 'relative',
                    zIndex: 1,
                    flex: 1,
                  }}
                >
                  {/* Watermark number */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '16px',
                      fontSize: '60px',
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.04)',
                      lineHeight: 1,
                      pointerEvents: 'none',
                    }}
                  >
                    {num}
                  </div>

                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      background: `rgba(${accentColor === accent ? '91,91,214' : accentColor === green ? '60,203,127' : '245,158,11'},0.12)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: accentColor,
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

                {/* Arrow connector */}
                {i < 2 && (
                  <div
                    data-step-arrow=""
                    style={{
                      position: 'absolute',
                      right: '-14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 2,
                      color: 'rgba(255,255,255,0.15)',
                      fontSize: '18px',
                      fontWeight: 300,
                    }}
                  >
                    &rarr;
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 4 — WHY NOT HUBSPOT?
        ══════════════════════════════════════════════════════════ */}
        <section data-section="" style={{ paddingTop: '0', paddingBottom: '120px', position: 'relative' }}>
          <h2
            className="gradient-text"
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

          <div style={{ position: 'relative' }}>
            {/* Purple glow behind Halvex side */}
            <div
              className="glow-orb"
              style={{
                width: '350px',
                height: '350px',
                background: 'radial-gradient(circle, rgba(91,91,214,0.12) 0%, transparent 70%)',
                top: '-50px',
                right: '0px',
              }}
            />

            <div
              data-two-col=""
              className="glass-card"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                position: 'relative',
                zIndex: 1,
                border: 'none',
              }}
            >
              {/* HubSpot side — dimmed with red/grey tint */}
              <div
                style={{
                  padding: '32px',
                  borderRadius: '16px 0 0 16px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Subtle red/grey background tint */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(135deg, rgba(127,29,29,0.06) 0%, transparent 60%)',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '1px',
                    color: textTertiary,
                    textTransform: 'uppercase',
                    marginBottom: '20px',
                    position: 'relative',
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
                    color: 'rgba(255,255,255,0.38)',
                    lineHeight: 1.7,
                    position: 'relative',
                  }}
                >
                  <div>Scores on metadata: stage, amount, close date</div>
                  <div>Generic model trained on industry averages</div>
                  <div>No signal extraction from conversations</div>
                  <div>Forecast based on rep self-reporting</div>
                  <div>No specific daily actions</div>
                </div>
              </div>

              {/* Halvex side — bright, gradient left border */}
              <div
                style={{
                  padding: '32px',
                  borderRadius: '0 16px 16px 0',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderLeft: 'none',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Gradient left border */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    background: `linear-gradient(180deg, ${accent} 0%, transparent 100%)`,
                  }}
                />
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
        <section data-section="" style={{ paddingTop: '0', paddingBottom: '120px', position: 'relative' }}>
          <h2
            className="gradient-text"
            style={{
              fontSize: '32px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              marginBottom: '48px',
            }}
          >
            Intelligence that compounds.
          </h2>

          {/* Ambient glow */}
          <div
            className="glow-orb float-orb-slow"
            style={{
              width: '400px',
              height: '400px',
              background: 'radial-gradient(circle, rgba(91,91,214,0.10) 0%, transparent 70%)',
              top: '100px',
              left: '-100px',
            }}
          />

          <div
            data-stagger-grid=""
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              maxWidth: '720px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {[
              {
                icon: '\u2600',
                title: 'Morning Briefing',
                desc: 'Every deal that needs attention, what changed, and exactly what to do about it. Delivered before your first call.',
                accentGrad: `linear-gradient(90deg, ${amber}, ${amber}88)`,
                glowColor: 'rgba(245,158,11,0.08)',
                span: false,
              },
              {
                icon: '\u{1F3AF}',
                title: 'Deal Intelligence',
                desc: 'Win probability, risk signals, competitive threats, and champion health — for every deal, updated with every interaction.',
                accentGrad: `linear-gradient(90deg, ${accent}, ${accent}88)`,
                glowColor: 'rgba(91,91,214,0.08)',
                span: false,
              },
              {
                icon: '\u{1F9E0}',
                title: 'Private ML',
                desc: 'A model trained only on your data. What winning looks like for your team, your market, your deal shape. No generic benchmarks.',
                accentGrad: `linear-gradient(90deg, ${green}, ${green}88)`,
                glowColor: 'rgba(60,203,127,0.08)',
                span: true,
              },
              {
                icon: '\u{1F50D}',
                title: 'Product Gap Detection',
                desc: 'Automatically surfaces feature requests and missing capabilities mentioned across your pipeline. Ranked by revenue impact.',
                accentGrad: `linear-gradient(90deg, #ef4444, #ef444488)`,
                glowColor: 'rgba(239,68,68,0.08)',
                span: false,
              },
              {
                icon: '\u2694',
                title: 'Collateral Engine',
                desc: 'Generates deal-specific battlecards, objection handlers, and case study recommendations based on live competitive intelligence.',
                accentGrad: `linear-gradient(90deg, ${accent}, ${amber})`,
                glowColor: 'rgba(91,91,214,0.08)',
                span: false,
              },
            ].map(({ icon, title, desc, accentGrad, glowColor, span }) => (
              <div
                key={title}
                className="glass-card"
                style={{
                  padding: '24px 28px',
                  gridColumn: span ? '1 / -1' : undefined,
                }}
              >
                {/* Colored accent line on top */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '24px',
                    right: '24px',
                    height: '2px',
                    background: accentGrad,
                    borderRadius: '0 0 2px 2px',
                    opacity: 0.6,
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px' }}>{icon}</span>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: textPrimary,
                    }}
                  >
                    {title}
                  </div>
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
        <section data-section="" style={{ paddingTop: '0', paddingBottom: '120px', position: 'relative' }}>
          <h2
            className="gradient-text"
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
              position: 'relative',
            }}
          >
            {[
              {
                label: 'Layer 1',
                title: 'Signal Extraction',
                desc: 'AI reads every conversation and extracts structured signals — champion status, budget indicators, risk markers, competitive mentions, and product gaps.',
                dotColor: '#5B8DEF',
                glowColor: 'rgba(91,141,239,0.15)',
                lineColor: 'rgba(91,141,239,0.4)',
              },
              {
                label: 'Layer 2',
                title: 'Private ML Engine',
                desc: 'A model trained exclusively on your closed deals. Win probability calculated from real patterns in your data. No industry averages. No hallucinated scores.',
                dotColor: green,
                glowColor: 'rgba(60,203,127,0.15)',
                lineColor: 'rgba(60,203,127,0.4)',
              },
              {
                label: 'Layer 3',
                title: 'AI Narration',
                desc: 'AI explains every score in plain language. Why is this deal at risk? What changed? What should you do next? Specific, actionable, grounded in evidence.',
                dotColor: accent,
                glowColor: 'rgba(91,91,214,0.15)',
                lineColor: 'rgba(91,91,214,0.4)',
              },
            ].map(({ label, title, desc, dotColor, glowColor, lineColor }, i) => (
              <div
                key={title}
                data-arch-row=""
                style={{
                  display: 'flex',
                  gap: '24px',
                  alignItems: 'flex-start',
                  position: 'relative',
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
                  {/* Glowing dot */}
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        filter: 'blur(6px)',
                      }}
                    />
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: dotColor,
                        position: 'relative',
                        boxShadow: `0 0 12px ${lineColor}`,
                      }}
                    />
                  </div>
                  {i < 2 && (
                    <div
                      className="arch-line-pulse"
                      style={{
                        width: '1px',
                        height: '60px',
                        background: `linear-gradient(180deg, ${lineColor} 0%, transparent 100%)`,
                        marginTop: '4px',
                      }}
                    />
                  )}
                </div>

                {/* Right: glass card */}
                <div
                  className="glass-card"
                  style={{
                    padding: '24px 28px',
                    flex: 1,
                    position: 'relative',
                  }}
                >
                  {/* Subtle glow inside card */}
                  <div
                    className="glow-orb"
                    style={{
                      width: '150px',
                      height: '150px',
                      background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
                      top: '-30px',
                      left: '-30px',
                      filter: 'blur(60px)',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '1.5px',
                      color: textTertiary,
                      textTransform: 'uppercase',
                      marginBottom: '4px',
                      position: 'relative',
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
                      position: 'relative',
                    }}
                  >
                    {title}
                  </div>
                  <div style={{ fontSize: '14px', color: textSecondary, lineHeight: 1.7, position: 'relative' }}>
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p
            style={{
              fontSize: '15px',
              lineHeight: 1.7,
              marginTop: '32px',
              maxWidth: '720px',
            }}
          >
            <span
              style={{
                background: `linear-gradient(135deg, ${accent}, ${green}, ${amber})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: 600,
              }}
            >
              AI extracts. ML predicts. AI explains.
            </span>
            <span style={{ color: textSecondary }}> No score is ever hallucinated.</span>
          </p>
        </section>

        {/* ══════════════════════════════════════════════════════════
            SECTION 7 — PRICING
        ══════════════════════════════════════════════════════════ */}
        <section data-section="" style={{ paddingTop: '0', paddingBottom: '120px', position: 'relative' }}>
          <h2
            className="gradient-text"
            style={{
              fontSize: '32px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              marginBottom: '48px',
            }}
          >
            Start free. Pay when it&apos;s useful.
          </h2>

          {/* Ambient glow behind pricing */}
          <div
            className="glow-orb"
            style={{
              width: '500px',
              height: '500px',
              background: 'radial-gradient(circle, rgba(91,91,214,0.10) 0%, transparent 70%)',
              top: '50px',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />

          <div
            data-pricing-grid=""
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              position: 'relative',
              zIndex: 1,
              alignItems: 'start',
            }}
          >
            {/* Free */}
            <div
              className="glass-card"
              style={{
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
                  borderRadius: '8px',
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

            {/* Starter — highlighted & elevated */}
            <div
              data-starter-elevate=""
              className="glass-card"
              style={{
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid rgba(91,91,214,0.4)`,
                position: 'relative',
                transform: 'translateY(-8px)',
                boxShadow: '0 0 50px rgba(91,91,214,0.12), 0 20px 60px rgba(0,0,0,0.3)',
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              {/* Stronger glow behind starter */}
              <div
                className="glow-orb"
                style={{
                  width: '250px',
                  height: '250px',
                  background: 'radial-gradient(circle, rgba(91,91,214,0.15) 0%, transparent 70%)',
                  top: '-60px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  filter: 'blur(80px)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '24px',
                  background: `linear-gradient(135deg, ${accent}, #7B7BD8)`,
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 12px',
                  borderRadius: '100px',
                  zIndex: 2,
                }}
              >
                Most popular
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: textSecondary, position: 'relative' }}>
                Starter
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px', position: 'relative' }}>
                <span style={{ fontSize: '36px', fontWeight: 600, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.95)' }}>&pound;79</span>
                <span style={{ fontSize: '14px', color: textTertiary }}>/mo</span>
              </div>
              <div style={{ fontSize: '13px', color: textTertiary, marginBottom: '28px', position: 'relative' }}>
                For growing teams
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', flex: 1, position: 'relative' }}>
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
                  borderRadius: '8px',
                  background: accent,
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  boxShadow: '0 0 20px rgba(91,91,214,0.25)',
                  position: 'relative',
                }}
              >
                Start free &rarr;
              </Link>
            </div>

            {/* Pro */}
            <div
              className="glass-card"
              style={{
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
                  borderRadius: '8px',
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
          position: 'relative',
        }}
      >
        {/* Ambient glow */}
        <div
          className="glow-orb"
          style={{
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(91,91,214,0.08) 0%, transparent 70%)',
            top: '-100px',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />

        <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
          <h2
            className="gradient-text"
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
              borderRadius: '8px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 500,
              textDecoration: 'none',
              boxShadow: '0 0 30px rgba(91,91,214,0.3), 0 0 60px rgba(91,91,214,0.1)',
            }}
          >
            Start free &rarr;
          </Link>
        </div>
      </section>

      <footer
        style={{
          position: 'relative',
          padding: '48px 24px 64px',
          textAlign: 'center',
        }}
      >
        {/* Gradient line separator */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
          }}
        />
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
