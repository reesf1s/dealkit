'use client'

import { CheckCircle, Circle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface KBHealthBarProps {
  hasCompanyProfile: boolean
  competitorCount: number
  caseStudyCount: number
  dealCount: number
}

interface CheckItem {
  label: string
  done: boolean
  ctaLabel: string
  ctaHref: string
}

export function KBHealthBar({
  hasCompanyProfile,
  competitorCount,
  caseStudyCount,
  dealCount,
}: KBHealthBarProps) {
  const items: CheckItem[] = [
    {
      label: 'Company profile',
      done: hasCompanyProfile,
      ctaLabel: 'Set up your company profile',
      ctaHref: '/company',
    },
    {
      label: `Competitors (${competitorCount})`,
      done: competitorCount > 0,
      ctaLabel: 'Add your first competitor',
      ctaHref: '/competitors',
    },
    {
      label: `Case studies (${caseStudyCount})`,
      done: caseStudyCount > 0,
      ctaLabel: 'Add your first case study',
      ctaHref: '/case-studies',
    },
    {
      label: `Deals logged (${dealCount})`,
      done: dealCount > 0,
      ctaLabel: 'Log your first deal',
      ctaHref: '/deals',
    },
  ]

  const completedCount = items.filter((i) => i.done).length
  const percentage = Math.round((completedCount / items.length) * 100)

  const barColor =
    percentage === 100 ? '#0f7b6c' : percentage >= 50 ? '#5e6ad2' : '#cb6c2c'

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
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#37352f' }}>
          Knowledge base health
        </span>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: barColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: '4px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(55,53,47,0.09)',
          marginBottom: '16px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            borderRadius: '9999px',
            backgroundColor: barColor,
            transition: 'width 600ms ease',
          }}
        />
      </div>

      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            {item.done ? (
              <CheckCircle
                size={15}
                strokeWidth={2}
                style={{ color: '#0f7b6c', flexShrink: 0 }}
              />
            ) : (
              <Circle
                size={15}
                strokeWidth={2}
                style={{ color: '#9b9a97', flexShrink: 0 }}
              />
            )}

            {item.done ? (
              <span style={{ fontSize: '13px', color: '#787774' }}>{item.label}</span>
            ) : (
              <Link
                href={item.ctaHref}
                style={{
                  fontSize: '13px',
                  color: '#5e6ad2',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'color 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#37352f'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#5e6ad2'
                }}
              >
                {item.ctaLabel}
                <ArrowRight size={12} strokeWidth={2} />
              </Link>
            )}
          </div>
        ))}
      </div>

      {percentage === 100 && (
        <p
          style={{
            fontSize: '12px',
            color: '#0f7b6c',
            marginTop: '12px',
            marginBottom: 0,
          }}
        >
          Your knowledge base is complete. AI output will be at its best.
        </p>
      )}
    </div>
  )
}
