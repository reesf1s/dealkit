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

  if (!showDetails) {
    return (
      <div style={{
        position: 'fixed', bottom: '14px', right: '18px',
        zIndex: 9999, width: 'min(620px, calc(100vw - 36px))',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(255,255,251,.92)',
          border: '1px solid rgba(28,34,28,.10)',
          borderRadius: '12px',
          padding: '10px',
          boxShadow: '0 18px 48px rgba(12,17,13,.16), inset 0 1px 0 rgba(255,255,255,.72)',
          backdropFilter: 'blur(18px) saturate(1.08)',
        }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'rgba(31,122,77,.10)', border: '1px solid rgba(31,122,77,.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Cookie size={14} color="#1f7a4d" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: '760', color: '#172119' }}>Cookie preferences</div>
            <div style={{ fontSize: '11px', color: 'rgba(23,28,24,.58)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              We use essential cookies for sign-in and preferences. <Link href="/privacy" style={{ color: '#1f7a4d' }}>Privacy Policy</Link>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={() => setShowDetails(true)} style={{
              padding: '7px 10px', borderRadius: '8px',
              background: 'rgba(255,255,255,.62)', border: '1px solid rgba(28,34,28,.10)',
              color: 'rgba(23,28,24,.72)', fontSize: '12px', fontWeight: '650', cursor: 'pointer',
            }}>
              Customise
            </button>
            <button onClick={acceptNecessary} style={{
              padding: '7px 10px', borderRadius: '8px',
              background: 'rgba(255,255,255,.62)', border: '1px solid rgba(28,34,28,.10)',
              color: 'rgba(23,28,24,.72)', fontSize: '12px', fontWeight: '650', cursor: 'pointer',
            }}>
              Necessary
            </button>
            <button onClick={acceptAll} style={{
              padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: '#172119', color: '#ffffff', fontSize: '12px', fontWeight: '700',
            }}>
              Accept
            </button>
            <button aria-label="Close cookie preferences" onClick={acceptNecessary} style={{ background: 'none', border: 'none', color: 'rgba(23,28,24,.48)', cursor: 'pointer', padding: '2px' }}>
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: '18px', right: '18px',
      zIndex: 9999, maxWidth: '360px', width: 'calc(100vw - 36px)',
    }}>
      <div style={{
        background: 'rgba(255,255,251,.92)',
        border: '1px solid rgba(28,34,28,.10)',
        borderRadius: '12px',
        padding: '14px',
        boxShadow: '0 18px 48px rgba(12,17,13,.16), inset 0 1px 0 rgba(255,255,255,.72)',
        backdropFilter: 'blur(18px) saturate(1.08)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'rgba(31,122,77,.10)', border: '1px solid rgba(31,122,77,.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Cookie size={14} color="#1f7a4d" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '750', color: '#172119' }}>Cookie preferences</div>
              <div style={{ fontSize: '11px', color: 'rgba(23,28,24,.52)', marginTop: '1px' }}>Only needed preferences by default</div>
            </div>
          </div>
          <button onClick={acceptNecessary} style={{ background: 'none', border: 'none', color: 'rgba(23,28,24,.48)', cursor: 'pointer', padding: '2px' }}>
            <X size={15} />
          </button>
        </div>

        <p style={{ fontSize: '12px', color: 'rgba(23,28,24,.62)', lineHeight: '1.55', marginBottom: '12px' }}>
          We use cookies to keep you signed in and remember your preferences.{' '}
          <Link href="/privacy" style={{ color: '#1f7a4d' }}>Privacy Policy</Link>
        </p>

        {/* Detailed preferences */}
        {showDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', padding: '10px', background: 'rgba(23,28,24,.035)', borderRadius: '8px', border: '1px solid rgba(28,34,28,.08)' }}>
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
                    background: value ? '#1f7a4d' : '#eeeeee',
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
        <div style={{ display: 'flex', gap: '7px' }}>
          <button
            onClick={() => setShowDetails(p => !p)}
            style={{
              flex: 1, padding: '8px', borderRadius: '8px',
              background: 'rgba(255,255,255,.62)', border: '1px solid rgba(28,34,28,.10)',
              color: 'rgba(23,28,24,.72)', fontSize: '12px', fontWeight: '650', cursor: 'pointer',
            }}
          >
            {showDetails ? 'Hide' : 'Customise'}
          </button>
          {showDetails ? (
            <button onClick={savePreferences} style={{
              flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: '#172119',
              color: '#ffffff', fontSize: '12px', fontWeight: '600',
            }}>
              <Check size={12} /> Save preferences
            </button>
          ) : (
            <>
              <button onClick={acceptNecessary} style={{
                flex: 1, padding: '8px', borderRadius: '8px',
                background: 'rgba(255,255,255,.62)', border: '1px solid rgba(28,34,28,.10)',
                color: 'rgba(23,28,24,.72)', fontSize: '12px', fontWeight: '650', cursor: 'pointer',
              }}>
                Necessary only
              </button>
              <button onClick={acceptAll} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: '#172119',
                color: '#ffffff', fontSize: '12px', fontWeight: '600',
              }}>
                Accept all
              </button>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '8px', justifyContent: 'center' }}>
          <Shield size={10} color="#9b9a97" />
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>GDPR & CCPA compliant · <Link href="/privacy" style={{ color: 'var(--text-tertiary)' }}>Privacy Policy</Link> · <Link href="/terms" style={{ color: 'var(--text-tertiary)' }}>Terms</Link></span>
        </div>
      </div>
    </div>
  )
}
