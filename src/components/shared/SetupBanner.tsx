'use client'

import { Database, ExternalLink } from 'lucide-react'

interface SetupBannerProps {
  /** If true shows only the compact inline variant (for cards), not the full-page overlay */
  inline?: boolean
  context?: string
}

export default function SetupBanner({ inline, context }: SetupBannerProps) {
  const neonUrl = 'https://neon.tech'

  if (inline) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '40px 24px', textAlign: 'center', gap: '12px',
      }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Database size={20} color="#6366F1" />
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#EBEBEB', marginBottom: '4px' }}>
            Database not connected
          </div>
          <div style={{ fontSize: '12px', color: '#555', lineHeight: '1.6', maxWidth: '260px' }}>
            {context ?? 'Add a DATABASE_URL to store your data'}
          </div>
        </div>
        <a
          href={neonUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '7px 14px', borderRadius: '7px',
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
            color: '#818CF8', fontSize: '12px', fontWeight: '500', textDecoration: 'none',
          }}
        >
          Get free database <ExternalLink size={11} />
        </a>
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(99,102,241,0.05)',
      border: '1px solid rgba(99,102,241,0.18)',
      borderRadius: '12px', padding: '20px 24px',
      display: 'flex', alignItems: 'flex-start', gap: '16px',
    }}>
      <div style={{
        width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Database size={17} color="#818CF8" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#EBEBEB', marginBottom: '4px' }}>
          Connect your database to unlock the app
        </div>
        <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.7', marginBottom: '14px' }}>
          SellSight needs a PostgreSQL database to save your data. Get a <strong style={{ color: '#888' }}>free database</strong> from Neon in 60 seconds — no credit card needed.
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a
            href={neonUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
              color: '#fff', fontSize: '12px', fontWeight: '600', textDecoration: 'none',
              boxShadow: '0 0 16px rgba(99,102,241,0.3)',
            }}
          >
            Get free Neon database <ExternalLink size={11} />
          </a>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            fontSize: '12px', color: '#888',
          }}>
            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6366F1' }}>DATABASE_URL</span>
            <span>→ Vercel env vars → Redeploy</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Compact one-line banner for the top of dashboard */
export function SetupAlert() {
  return (
    <a
      href="https://neon.tech"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 16px', borderRadius: '10px',
        background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
        textDecoration: 'none', transition: 'border-color 0.15s',
      }}
    >
      <div style={{ width: '26px', height: '26px', background: 'rgba(99,102,241,0.12)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Database size={13} color="#818CF8" />
      </div>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: '13px', color: '#EBEBEB', fontWeight: '500' }}>Database not connected — </span>
        <span style={{ fontSize: '13px', color: '#818CF8' }}>get a free Neon database to enable all features</span>
      </div>
      <ExternalLink size={13} color="#6366F1" />
    </a>
  )
}
