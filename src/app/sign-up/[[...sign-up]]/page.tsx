import { SignUp } from '@clerk/nextjs'
import { FileText, Sparkles, BarChart3, Zap } from 'lucide-react'

const features = [
  { icon: Sparkles, label: 'AI-native pipeline', desc: 'See what changed, what slipped, and what needs attention' },
  { icon: BarChart3, label: 'Self-updating CRM', desc: 'Deals, contacts, tasks, and activity in one clean workspace' },
  { icon: Zap, label: 'Next best actions', desc: 'Follow-ups and priorities ready when the day starts' },
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

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '60px' }}>
          <div style={{ width: '36px', height: '36px', background: '#37352f', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={17} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: '700', fontSize: '18px', letterSpacing: 0, color: 'var(--text-primary)' }}>Halvex CRM</span>
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: '36px', fontWeight: '800', letterSpacing: 0, color: 'var(--text-primary)', marginBottom: '16px', lineHeight: '1.1' }}>
          Your CRM should<br />do the admin
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-tertiary)', marginBottom: '48px', lineHeight: '1.7', maxWidth: '360px' }}>
          Halvex keeps your pipeline current, spots risk, and tells small sales teams what to do next.
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
            &ldquo;Halvex is for teams who need the discipline of a CRM without hiring a RevOps function just to keep it useful.&rdquo;
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--brand)', border: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: '#fff' }}>R</div>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Rees Foulkes · Founder, Halvex</span>
          </div>
        </div>
      </div>

      {/* Right panel - sign up form */}
      <div style={{ width: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ marginBottom: '28px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: 0, color: 'var(--text-primary)', marginBottom: '6px' }}>Create your account</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Start with a CRM that tells you what matters</p>
          </div>
          <SignUp
            fallbackRedirectUrl="/home"
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
                  background: '#37352f',
                  borderRadius: '8px',
                  height: '42px',
                  fontSize: '13px',
                  fontWeight: '600',
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
                colorPrimary: 'var(--brand)',
                colorDanger: '#e03e3e',
              },
            }}
          />
        </div>
      </div>
    </main>
  )
}
