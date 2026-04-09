'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Cookie, X, Check, Shield } from 'lucide-react'

type Consent = {
  necessary: true     // always true
  functional: boolean
  analytics: boolean
  decidedAt: string
}

const STORAGE_KEY = 'dk_cookie_consent'

export default function CookieBanner() {
  const [show, setShow] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [functional, setFunctional] = useState(true)
  const [analytics, setAnalytics] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) setShow(true)
    } catch {
      setShow(true)
    }
  }, [])

  const save = (consentFunctional: boolean, consentAnalytics: boolean) => {
    const consent: Consent = {
      necessary: true,
      functional: consentFunctional,
      analytics: consentAnalytics,
      decidedAt: new Date().toISOString(),
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)) } catch {}
    setShow(false)
  }

  const acceptAll = () => save(true, true)
  const acceptNecessary = () => save(false, false)
  const savePreferences = () => save(functional, analytics)

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: '24px', left: '24px',
      zIndex: 9999, maxWidth: '420px', width: 'calc(100vw - 48px)',
    }}>
      <div style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
        padding: '20px',
        boxShadow: '0 8px 32px #dddddd, 0 2px 8px #f0f0f0',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '9px',
              background: 'rgba(29, 184, 106, 0.10)', border: '1px solid rgba(29, 184, 106, 0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Cookie size={15} color="#1DB86A" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Cookie preferences</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>We respect your privacy</div>
            </div>
          </div>
          <button onClick={acceptNecessary} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}>
            <X size={15} />
          </button>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '14px' }}>
          We use cookies to keep you signed in and remember your preferences.{' '}
          <Link href="/privacy" style={{ color: '#1DB86A' }}>Privacy Policy</Link>
        </p>

        {/* Detailed preferences */}
        {showDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px', padding: '12px', background: 'rgba(26,26,26,0.03)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
            {[
              { key: 'necessary', label: 'Strictly necessary', desc: 'Authentication & security. Cannot be disabled.', value: true, locked: true, onChange: undefined },
              { key: 'functional', label: 'Functional', desc: 'UI preferences (sidebar state, etc.)', value: functional, locked: false, onChange: () => setFunctional(p => !p) },
              { key: 'analytics', label: 'Analytics', desc: 'Usage stats to improve the product.', value: analytics, locked: false, onChange: () => setAnalytics(p => !p) },
            ].map(({ key, label, desc, value, locked, onChange }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{desc}</div>
                </div>
                <button
                  disabled={locked}
                  onClick={onChange}
                  style={{
                    width: '38px', height: '22px', borderRadius: '100px',
                    background: value ? '#1DB86A' : '#eeeeee',
                    border: 'none', cursor: locked ? 'not-allowed' : 'pointer',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '3px',
                    left: value ? '19px' : '3px',
                    width: '16px', height: '16px', borderRadius: '50%',
                    background: 'var(--surface-1)', transition: 'left 0.2s',
                    boxShadow: '0 1px 3px #dddddd',
                  }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowDetails(p => !p)}
            style={{
              flex: 1, padding: '9px', borderRadius: '8px',
              background: 'var(--surface-2)', border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500', cursor: 'pointer',
            }}
          >
            {showDetails ? 'Hide' : 'Customise'}
          </button>
          {showDetails ? (
            <button onClick={savePreferences} style={{
              flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '9px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: '#1a1a1a',
              color: '#ffffff', fontSize: '12px', fontWeight: '600',
            }}>
              <Check size={12} /> Save preferences
            </button>
          ) : (
            <>
              <button onClick={acceptNecessary} style={{
                flex: 1, padding: '9px', borderRadius: '8px',
                background: 'var(--surface-2)', border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500', cursor: 'pointer',
              }}>
                Necessary only
              </button>
              <button onClick={acceptAll} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '9px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: '#1a1a1a',
                color: '#ffffff', fontSize: '12px', fontWeight: '600',
              }}>
                Accept all
              </button>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '10px', justifyContent: 'center' }}>
          <Shield size={10} color="#9b9a97" />
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>GDPR & CCPA compliant · <Link href="/privacy" style={{ color: 'var(--text-tertiary)' }}>Privacy Policy</Link> · <Link href="/terms" style={{ color: 'var(--text-tertiary)' }}>Terms</Link></span>
        </div>
      </div>
    </div>
  )
}
