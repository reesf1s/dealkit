'use client'

import Link from 'next/link'
import { Zap, X } from 'lucide-react'
import { useState } from 'react'

interface Props {
  message: string
  plan?: 'starter' | 'pro'
  dismissKey?: string
}

export function UpgradeBanner({ message, plan = 'starter', dismissKey }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissKey) return false
    try { return localStorage.getItem(dismissKey) === '1' } catch { return false }
  })

  if (dismissed) return null

  const dismiss = () => {
    if (dismissKey) { try { localStorage.setItem(dismissKey, '1') } catch {} }
    setDismissed(true)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 16px',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: '8px', marginBottom: '16px',
    }}>
      <div style={{
        width: '30px', height: '30px', borderRadius: '8px',
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Zap size={14} color="rgba(255,255,255,0.70)" />
      </div>
      <div style={{ flex: 1, fontSize: '13px', color: 'rgba(255,255,255,0.70)', lineHeight: '1.5' }}>
        {message}
      </div>
      <Link href="/settings#billing" style={{
        padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '700',
        background: 'rgba(255,255,255,0.90)',
        boxShadow: '0 0 14px rgba(0,0,0,0.25)',
        color: '#0a0b0f', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        Upgrade to {plan === 'pro' ? 'Pro' : 'Starter'} →
      </Link>
      {dismissKey && (
        <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '2px', display: 'flex' }}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}
