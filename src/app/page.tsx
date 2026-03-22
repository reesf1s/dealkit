import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function LandingPage() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <div style={{
      background: '#09090B',
      color: 'rgba(255,255,255,0.93)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
      minHeight: '100vh',
    }}>
      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: '56px',
        background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontWeight: 600, fontSize: '15px', letterSpacing: '-0.02em' }}>SellSight</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link href="/sign-in" style={{
            padding: '8px 16px', borderRadius: '6px',
            color: 'rgba(255,255,255,0.56)', fontSize: '13px', fontWeight: 500,
            textDecoration: 'none',
          }}>Sign in</Link>
          <Link href="/sign-up" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '0 18px', height: '36px', background: '#5B5BD6',
            borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: 500,
            textDecoration: 'none',
          }}>Start free &rarr;</Link>
        </div>
      </nav>

      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '0 24px' }}>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <section style={{ paddingTop: '160px', paddingBottom: '120px', maxWidth: '720px' }}>
          <h1 style={{
            fontSize: '48px', fontWeight: 600, letterSpacing: '-0.035em',
            lineHeight: 1.1, marginBottom: '24px',
          }}>Your CRM stores data.<br />We read it.</h1>
          <p style={{
            fontSize: '17px', color: 'rgba(255,255,255,0.56)',
            lineHeight: 1.7, marginBottom: '16px', maxWidth: '600px',
          }}>
            Every meeting note your team writes contains buying signals, risk patterns, and competitive intelligence. SellSight extracts them, scores every deal against your own win/loss history, and tells you exactly what to do about it.
          </p>
          <p style={{
            fontSize: '15px', color: 'rgba(255,255,255,0.40)',
            lineHeight: 1.7, marginBottom: '40px', maxWidth: '600px',
          }}>
            Not industry benchmarks. Not generic AI. Intelligence trained on what winning looks like for your team.
          </p>
          <Link href="/sign-up" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '0 24px', height: '44px', background: '#5B5BD6',
            borderRadius: '6px', color: '#fff', fontSize: '14px', fontWeight: 500,
            textDecoration: 'none',
          }}>Start free &rarr;</Link>
        </section>

        {/* ── The Problem ──────────────────────────────────────── */}
        <section style={{ paddingBottom: '120px' }}>
          <h2 style={{
            fontSize: '32px', fontWeight: 600, letterSpacing: '-0.03em',
            marginBottom: '40px',
          }}>The Problem</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
            {[
              'Your forecast is a spreadsheet of optimism.',
              'Your reps self-report deal status.',
              'Nobody reads the meeting notes except the rep who wrote them.',
            ].map((line) => (
              <div key={line} style={{
                background: '#141416', borderRadius: '8px',
                padding: '20px 24px', fontSize: '16px',
                color: 'rgba(255,255,255,0.56)', lineHeight: 1.6,
              }}>{line}</div>
            ))}
          </div>
        </section>

        {/* ── How It Works ─────────────────────────────────────── */}
        <section style={{ paddingBottom: '120px' }}>
          <h2 style={{
            fontSize: '32px', fontWeight: 600, letterSpacing: '-0.03em',
            marginBottom: '48px',
          }}>How It Works</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '720px' }}>
            {[
              {
                num: '1',
                title: 'Paste meeting notes',
                desc: 'Signals extracted automatically — champion identified, budget status, risks, competitive mentions, product gaps.',
              },
              {
                num: '2',
                title: 'ML scores every deal',
                desc: 'Win probability trained on your closed deals, not industry data. Every score is pure math from your own history.',
              },
              {
                num: '3',
                title: 'Morning briefing',
                desc: 'Specific actions for each deal, every day. Which deals need attention, what changed overnight, and exactly what to do next.',
              },
            ].map(({ num, title, desc }) => (
              <div key={num} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: '#141416', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '14px', fontWeight: 600,
                  color: '#5B5BD6', flexShrink: 0,
                }}>{num}</div>
                <div>
                  <div style={{
                    fontSize: '16px', fontWeight: 600, marginBottom: '6px',
                    color: 'rgba(255,255,255,0.93)',
                  }}>{title}</div>
                  <div style={{
                    fontSize: '14px', color: 'rgba(255,255,255,0.56)', lineHeight: 1.7,
                  }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: '48px', background: '#141416', borderRadius: '8px',
            padding: '20px 24px', maxWidth: '720px',
          }}>
            <p style={{
              fontSize: '15px', color: 'rgba(255,255,255,0.56)',
              lineHeight: 1.7, marginBottom: '8px',
            }}>
              The LLM extracts. The ML predicts. The LLM explains.
            </p>
            <p style={{
              fontSize: '14px', color: 'rgba(255,255,255,0.40)', lineHeight: 1.6,
            }}>
              No score is ever generated by AI — it&apos;s pure math from your own data.
            </p>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────────────────── */}
        <section style={{ paddingBottom: '120px' }}>
          <h2 style={{
            fontSize: '32px', fontWeight: 600, letterSpacing: '-0.03em',
            marginBottom: '48px',
          }}>Pricing</h2>

          <div data-pricing-grid="" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
          }}>
            {/* Free */}
            <div style={{
              background: '#141416', borderRadius: '8px', padding: '32px 28px',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: 'rgba(255,255,255,0.56)' }}>Free</div>
              <div style={{ fontSize: '36px', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: '4px' }}>&pound;0</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)', marginBottom: '28px' }}>For getting started</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', flex: 1 }}>
                {[
                  '5 deals',
                  'Text signal extraction',
                  'Manual deal scoring',
                  'Basic pipeline view',
                ].map((f) => (
                  <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#5B5BD6', fontSize: '14px', lineHeight: '20px', flexShrink: 0 }}>&check;</span>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.56)', lineHeight: '20px' }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/sign-up" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '44px', borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.93)',
                fontSize: '13px', fontWeight: 500, textDecoration: 'none',
              }}>Get started</Link>
            </div>

            {/* Starter — highlighted */}
            <div style={{
              background: '#141416', borderRadius: '8px', padding: '32px 28px',
              display: 'flex', flexDirection: 'column',
              border: '1px solid #5B5BD6',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: '-12px', left: '24px',
                background: '#5B5BD6', color: '#fff',
                fontSize: '11px', fontWeight: 600,
                padding: '4px 12px', borderRadius: '100px',
              }}>Most popular</div>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: 'rgba(255,255,255,0.56)' }}>Starter</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '36px', fontWeight: 600, letterSpacing: '-0.03em' }}>&pound;79</span>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.40)' }}>/mo</span>
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)', marginBottom: '28px' }}>For growing teams</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', flex: 1 }}>
                {[
                  'Unlimited deals',
                  'ML deal scoring',
                  'Daily AI briefing',
                  'Score simulator',
                  'Meeting note extraction',
                  'Risk & stall detection',
                ].map((f) => (
                  <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#5B5BD6', fontSize: '14px', lineHeight: '20px', flexShrink: 0 }}>&check;</span>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.56)', lineHeight: '20px' }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/sign-up" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '44px', borderRadius: '6px',
                background: '#5B5BD6', color: '#fff',
                fontSize: '13px', fontWeight: 500, textDecoration: 'none',
              }}>Start free &rarr;</Link>
            </div>

            {/* Pro */}
            <div style={{
              background: '#141416', borderRadius: '8px', padding: '32px 28px',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: 'rgba(255,255,255,0.56)' }}>Pro</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '36px', fontWeight: 600, letterSpacing: '-0.03em' }}>&pound;149</span>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.40)' }}>/mo</span>
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)', marginBottom: '28px' }}>For scaling revenue teams</div>
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
                    <span style={{ color: '#5B5BD6', fontSize: '14px', lineHeight: '20px', flexShrink: 0 }}>&check;</span>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.56)', lineHeight: '20px' }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/sign-up" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '44px', borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.93)',
                fontSize: '13px', fontWeight: 500, textDecoration: 'none',
              }}>Start free &rarr;</Link>
            </div>
          </div>

          {/* Responsive overrides for mobile */}
          <style>{`
            @media (max-width: 768px) {
              h1 { font-size: 32px !important; }
              section { padding-bottom: 80px !important; }
              [data-pricing-grid] { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </section>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '48px 24px 64px',
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: '15px', color: 'rgba(255,255,255,0.56)',
          lineHeight: 1.7, maxWidth: '520px', margin: '0 auto 16px',
        }}>
          Built by a PM who collapsed a 12-month enterprise sales cycle to 30 days.
        </p>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.30)' }}>
          London, UK &middot; SellSight Ltd
        </p>
      </footer>
    </div>
  )
}
