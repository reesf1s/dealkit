import { SignUp } from '@clerk/nextjs'
import { FileText, Sparkles, BarChart3, Zap } from 'lucide-react'

const features = [
  { icon: Sparkles, label: 'AI-generated battlecards', desc: 'Beat any competitor with real-time intel' },
  { icon: BarChart3, label: 'Deal win tracking', desc: 'Understand why you win and lose' },
  { icon: Zap, label: 'Instant collateral', desc: 'One-pagers, emails & exec briefs in seconds' },
]

export default function SignUpPage() {
  return (
    <main style={{ minHeight: '100dvh', backgroundColor: 'var(--bg)', display: 'flex' }}>
      {/* Left panel - branding */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px', borderRight: '1px solid var(--border)',
        background: 'var(--bg)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, var(--accent-subtle) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '60px' }}>
          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, var(--accent), #7C3AED)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px var(--accent-subtle)' }}>
            <FileText size={17} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: '700', fontSize: '18px', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>SellSight</span>
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: '36px', fontWeight: '800', letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: '16px', lineHeight: '1.1' }}>
          Close more deals<br />with AI sales intel
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-tertiary)', marginBottom: '48px', lineHeight: '1.7', maxWidth: '360px' }}>
          Turn every competitor insight, case study, and deal outcome into polished sales collateral in seconds.
        </p>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '360px' }}>
          {features.map(({ icon: Icon, label, desc }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ width: '34px', height: '34px', background: 'var(--accent-subtle)', border: '1px solid var(--border)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                <Icon size={15} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: '1.5' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Founder note */}
        <div style={{ marginTop: '48px', padding: '16px 20px', background: 'var(--accent-subtle)', border: '1px solid var(--border)', borderRadius: '10px', maxWidth: '360px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.6', marginBottom: '10px' }}>
            &ldquo;I built SellSight because we kept losing deals to competitors we couldn&apos;t track. Two hours of prep per call. I wanted that time back.&rdquo;
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #8B5CF6)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: '#fff' }}>R</div>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Rees Foulkes · Founder, SellSight</span>
          </div>
        </div>
      </div>

      {/* Right panel - sign up form */}
      <div style={{ width: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ marginBottom: '28px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '6px' }}>Create your account</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Start closing more deals today</p>
          </div>
          <SignUp
            fallbackRedirectUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: { width: '100%' },
                card: {
                  background: 'transparent',
                  boxShadow: 'none',
                  border: 'none',
                  padding: 0,
                },
                headerTitle: { display: 'none' },
                headerSubtitle: { display: 'none' },
                socialButtonsBlockButton: {
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  borderRadius: '8px',
                  height: '42px',
                  fontSize: '13px',
                  fontWeight: '500',
                },
                socialButtonsBlockButton__google: {},
                dividerLine: { background: 'var(--border)' },
                dividerText: { color: 'var(--text-tertiary)', fontSize: '12px' },
                formFieldInput: {
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  borderRadius: '8px',
                  height: '42px',
                  fontSize: '13px',
                },
                formButtonPrimary: {
                  background: 'linear-gradient(135deg, var(--accent), #7C3AED)',
                  borderRadius: '8px',
                  height: '42px',
                  fontSize: '13px',
                  fontWeight: '600',
                  boxShadow: '0 0 20px var(--accent-subtle)',
                },
                footerActionLink: { color: 'var(--accent)' },
                formFieldLabel: { color: 'var(--text-tertiary)', fontSize: '12px' },
                identityPreviewText: { color: 'var(--text-primary)' },
                formFieldInputShowPasswordButton: { color: 'var(--text-tertiary)' },
              },
              variables: {
                colorBackground: 'var(--bg-secondary)',
                colorText: 'var(--text-primary)',
                colorTextSecondary: 'var(--text-tertiary)',
                colorInputBackground: 'var(--input-bg)',
                colorInputText: 'var(--text-primary)',
                borderRadius: '8px',
                colorPrimary: '#6366F1',
                colorDanger: '#EF4444',
              },
            }}
          />
        </div>
      </div>
    </main>
  )
}
