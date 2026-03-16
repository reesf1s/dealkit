import { SignIn } from '@clerk/nextjs'
import { FileText } from 'lucide-react'

export default function SignInPage() {
  return (
    <main style={{ minHeight: '100dvh', backgroundColor: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse, rgba(99,102,241,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '400px', padding: '24px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '32px' }}>
          <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #6366F1, #7C3AED)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(99,102,241,0.45)' }}>
            <FileText size={15} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: '700', fontSize: '17px', letterSpacing: '-0.03em', color: '#EBEBEB' }}>DealKit</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.03em', color: '#EBEBEB', marginBottom: '6px' }}>Welcome back</h1>
          <p style={{ fontSize: '13px', color: '#555' }}>Sign in to your sales hub</p>
        </div>

        <SignIn
          fallbackRedirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: { width: '100%' },
              card: {
                background: 'rgba(20,20,20,0.8)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '14px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                padding: '28px',
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
    </main>
  )
}
