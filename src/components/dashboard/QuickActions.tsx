'use client'

import Link from 'next/link'
import { FileText, Users, Sparkles } from 'lucide-react'

interface ActionButtonProps {
  href: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>
  label: string
  description: string
  color: string
  bg: string
  hoverBg: string
}

function ActionButton({ href, icon: Icon, label, description, color, bg, hoverBg }: ActionButtonProps) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        borderRadius: '8px',
        backgroundColor: bg,
        border: '1px solid rgba(55,53,47,0.09)',
        textDecoration: 'none',
        transition: 'background-color 150ms ease, border-color 150ms ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = hoverBg
        e.currentTarget.style.borderColor = `${color}55`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = bg
        e.currentTarget.style.borderColor = `${color}33`
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: `${color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={16} strokeWidth={2} style={{ color }} />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#37352f', marginBottom: '2px' }}>
          {label}
        </div>
        <div style={{ fontSize: '12px', color: '#787774' }}>{description}</div>
      </div>
    </Link>
  )
}

export function QuickActions() {
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid rgba(55,53,47,0.09)',
        borderRadius: '10px',
        padding: '16px',
        boxShadow: '0 1px 3px rgba(55,53,47,0.06)',
      }}
    >
      <p
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#37352f',
          marginBottom: '12px',
          marginTop: 0,
        }}
      >
        Quick actions
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <ActionButton
          href="/deals"
          icon={FileText}
          label="Log a Deal"
          description="Record a won or lost deal with insights"
          color="#5e6ad2"
          bg="rgba(94, 106, 210, 0.06)"
          hoverBg="#f7f6f3"
        />
        <ActionButton
          href="/competitors"
          icon={Users}
          label="Add Competitor"
          description="Track a new competitor and their positioning"
          color="#cb6c2c"
          bg="rgba(203, 108, 44, 0.06)"
          hoverBg="#f7f6f3"
        />
        <ActionButton
          href="/collateral"
          icon={Sparkles}
          label="Generate Collateral"
          description="AI-powered battlecards, one-pagers, and more"
          color="#0f7b6c"
          bg="rgba(15, 123, 108, 0.06)"
          hoverBg="#f7f6f3"
        />
      </div>
    </div>
  )
}
