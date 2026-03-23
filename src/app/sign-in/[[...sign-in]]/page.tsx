import { SignIn } from '@clerk/nextjs'
import { FileText } from 'lucide-react'

export default function SignInPage() {
  return (
    <main style={{ minHeight: '100dvh', backgroundColor: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse, var(--accent-subtle) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '400px', padding: '24px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '32px' }}>
          <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, var(--accent), #7C3AED)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px var(--accent-subtle)' }}>
            <FileText size={15} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: '700', fontSize: '17px', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>Halvex</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: '6px' }}>Welcome back</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Sign in to your sales hub</p>
        </div>

        <SignIn
          fallbackRedirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: { width: '100%' },
              card: {
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '14px',
                boxShadow: 'var(--shadow-lg)',
                padding: '28px',
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
    </main>
  )
}
