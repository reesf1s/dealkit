import { SignUp } from '@clerk/nextjs'
import { FileText, Sparkles, BarChart3, Zap } from 'lucide-react'

const features = [
  { icon: Sparkles, label: 'AI-generated battlecards', desc: 'Beat any competitor with real-time intel' },
  { icon: BarChart3, label: 'Deal win tracking', desc: 'Understand why you win and lose' },
  { icon: Zap, label: 'Instant collateral', desc: 'One-pagers, emails & exec briefs in seconds' },
]

export default function SignUpPage() {
  return (
    <main style={{ minHeight: '100dvh', backgroundColor: '#0A0A0A', display: 'flex' }}>
      {/* Left panel - branding */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px', borderRight: '1px solid rgba(255,255,255,0.05)',
        background: 'linear-gradient(135deg, #0A0A0A 0%, #0D0D0D 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '60px' }}>
          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(99,102,241,0.5)' }}>
            <FileText size={17} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: '700', fontSize: '18px', letterSpacing: '-0.03em', color: '#EBEBEB' }}>DealKit</span>
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: '36px', fontWeight: '800', letterSpacing: '-0.04em', color: '#EBEBEB', marginBottom: '16px', lineHeight: '1.1', background: 'linear-gradient(135deg, #EBEBEB 0%, #888 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Close more deals<br />with AI sales intel
        </h1>
        <p style={{ fontSize: '15px', color: '#555', marginBottom: '48px', lineHeight: '1.7', maxWidth: '360px' }}>
          Turn every competitor insight, case study, and deal outcome into polished sales collateral in seconds.
        </p>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '360px' }}>
          {features.map(({ icon: Icon, label, desc }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ width: '34px', height: '34px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                <Icon size={15} color="#818CF8" />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#EBEBEB', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '12px', color: '#555', lineHeight: '1.5' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div style={{ marginTop: '48px', padding: '16px 20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', maxWidth: '360px' }}>
          <div style={{ fontSize: '13px', color: '#888', fontStyle: 'italic', lineHeight: '1.6', marginBottom: '10px' }}>
            "DealKit cut our battlecard update time from hours to minutes."
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: '#fff' }}>S</div>
            <span style={{ fontSize: '12px', color: '#555' }}>Sarah K. · Head of Sales</span>
          </div>
        </div>
      </div>

      {/* Right panel - sign up form */}
      <div style={{ width: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ marginBottom: '28px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.03em', color: '#EBEBEB', marginBottom: '6px' }}>Create your account</h2>
            <p style={{ fontSize: '13px', color: '#555' }}>Start closing more deals today</p>
          </div>
          <SignUp
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
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#EBEBEB',
                  borderRadius: '8px',
                  height: '42px',
                  fontSize: '13px',
                  fontWeight: '500',
                },
                socialButtonsBlockButton__google: {},
                dividerLine: { background: 'rgba(255,255,255,0.07)' },
                dividerText: { color: '#444', fontSize: '12px' },
                formFieldInput: {
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#EBEBEB',
                  borderRadius: '8px',
                  height: '42px',
                  fontSize: '13px',
                },
                formButtonPrimary: {
                  background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
                  borderRadius: '8px',
                  height: '42px',
                  fontSize: '13px',
                  fontWeight: '600',
                  boxShadow: '0 0 20px rgba(99,102,241,0.35)',
                },
                footerActionLink: { color: '#818CF8' },
                formFieldLabel: { color: '#888', fontSize: '12px' },
                identityPreviewText: { color: '#EBEBEB' },
                formFieldInputShowPasswordButton: { color: '#555' },
              },
              variables: {
                colorBackground: '#141414',
                colorText: '#EBEBEB',
                colorTextSecondary: '#888',
                colorInputBackground: 'rgba(255,255,255,0.04)',
                colorInputText: '#EBEBEB',
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
