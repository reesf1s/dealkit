'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useState } from 'react'

interface StaleAlertProps {
  staleCount: number
  onRegenerateAll: () => Promise<void>
}

export function StaleAlert({ staleCount, onRegenerateAll }: StaleAlertProps) {
  const [loading, setLoading] = useState(false)

  if (staleCount === 0) return null

  const handleClick = async () => {
    setLoading(true)
    try {
      await onRegenerateAll()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
      }}
    >
      <AlertTriangle
        size={16}
        strokeWidth={2}
        style={{ color: '#F59E0B', flexShrink: 0 }}
      />

      <p style={{ flex: 1, fontSize: '13px', color: '#F59E0B', margin: 0 }}>
        <span style={{ fontWeight: 600 }}>
          {staleCount} {staleCount === 1 ? 'item needs' : 'items need'} regenerating
        </span>
        {' '}— your company profile or source data has changed.
      </p>

      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: '28px',
          padding: '0 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          whiteSpace: 'nowrap',
          transition: 'background-color 150ms ease',
        }}
        onMouseEnter={(e) => {
          if (!loading) e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.2)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.12)'
        }}
      >
        <RefreshCw
          size={12}
          strokeWidth={2.5}
          style={{
            animation: loading ? 'spin 1s linear infinite' : 'none',
          }}
        />
        {loading ? 'Regenerating…' : 'Regenerate All'}
      </button>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
