'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Cookie, X } from 'lucide-react'

type Consent = {
  necessary: true
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
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true)
    } catch {
      setShow(true)
    }
  }, [])

  function save(consentFunctional: boolean, consentAnalytics: boolean) {
    const consent: Consent = {
      necessary: true,
      functional: consentFunctional,
      analytics: consentAnalytics,
      decidedAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent))
    } catch {}
    setShow(false)
  }

  if (!show) return null

  return (
    <aside className={`cookie-card ${showDetails ? 'expanded' : ''}`} aria-label="Cookie preferences">
      <div className="cookie-card-icon"><Cookie size={14} /></div>
      <div className="cookie-card-copy">
        <strong>Cookies</strong>
        <span>Essential by default. Optional analytics are off until accepted.</span>
        {showDetails ? (
          <div className="cookie-preferences">
            <Preference label="Functional" checked={functional} onChange={() => setFunctional(value => !value)} />
            <Preference label="Analytics" checked={analytics} onChange={() => setAnalytics(value => !value)} />
            <Link href="/privacy">Privacy policy</Link>
          </div>
        ) : null}
      </div>
      <div className="cookie-card-actions">
        <button type="button" className="ghost" onClick={() => setShowDetails(value => !value)}>
          {showDetails ? 'Hide' : 'Options'}
        </button>
        {showDetails ? (
          <button type="button" className="primary" onClick={() => save(functional, analytics)}>
            <Check size={13} /> Save
          </button>
        ) : (
          <button type="button" className="primary" onClick={() => save(true, true)}>Accept</button>
        )}
        <button type="button" className="icon" aria-label="Use necessary cookies only" onClick={() => save(false, false)}>
          <X size={14} />
        </button>
      </div>
    </aside>
  )
}

function Preference({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label>
      <span>{label}</span>
      <button type="button" className={checked ? 'on' : ''} role="switch" aria-checked={checked} onClick={onChange}>
        <i />
      </button>
    </label>
  )
}
