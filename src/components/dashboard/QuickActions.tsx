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
        border: `1px solid ${color}33`,
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
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#EBEBEB', marginBottom: '2px' }}>
          {label}
        </div>
        <div style={{ fontSize: '12px', color: '#888888' }}>{description}</div>
      </div>
    </Link>
  )
}

export function QuickActions() {
  return (
    <div
      style={{
        backgroundColor: '#141414',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '8px',
        padding: '16px',
      }}
    >
      <p
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#EBEBEB',
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
          color="#6366F1"
          bg="rgba(99, 102, 241, 0.06)"
          hoverBg="rgba(99, 102, 241, 0.1)"
        />
        <ActionButton
          href="/competitors"
          icon={Users}
          label="Add Competitor"
          description="Track a new competitor and their positioning"
          color="#F59E0B"
          bg="rgba(245, 158, 11, 0.06)"
          hoverBg="rgba(245, 158, 11, 0.1)"
        />
        <ActionButton
          href="/collateral"
          icon={Sparkles}
          label="Generate Collateral"
          description="AI-powered battlecards, one-pagers, and more"
          color="#22C55E"
          bg="rgba(34, 197, 94, 0.06)"
          hoverBg="rgba(34, 197, 94, 0.1)"
        />
      </div>
    </div>
  )
}
