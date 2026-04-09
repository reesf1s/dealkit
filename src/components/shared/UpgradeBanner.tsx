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
      background: 'rgba(29, 184, 106, 0.05)',
      border: '1px solid rgba(29, 184, 106, 0.16)',
      borderRadius: '8px', marginBottom: '16px',
    }}>
      <div style={{
        width: '30px', height: '30px', borderRadius: '8px',
        background: 'rgba(29, 184, 106, 0.10)', border: '1px solid rgba(29, 184, 106, 0.20)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Zap size={14} color="#1DB86A" />
      </div>
      <div style={{ flex: 1, fontSize: '13px', color: '#787774', lineHeight: '1.5' }}>
        {message}
      </div>
      <Link href="/settings#billing" style={{
        padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '700',
        background: '#1a1a1a',
        color: '#ffffff', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        Upgrade to {plan === 'pro' ? 'Pro' : 'Starter'} →
      </Link>
      {dismissKey && (
        <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#9b9a97', cursor: 'pointer', padding: '2px', display: 'flex' }}>
          <X size={14} />
        </button>
      )}
    </div>
  )
}
