'use client'

import Link from 'next/link'
import { BookOpen, Sparkles, Building2, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import type { CaseStudy } from '@/types'

interface CaseStudyGridProps {
  caseStudies: CaseStudy[]
  onAdd?: () => void
}

function CaseStudyCard({ caseStudy }: { caseStudy: CaseStudy }) {
  const hasGenerated = !!caseStudy.generatedNarrative

  return (
    <Link
      href={`/case-studies/${caseStudy.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          cursor: 'pointer',
          transition: 'border-color 150ms ease, background 150ms ease',
          height: '100%',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
          e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
        }}
      >
        {/* Icon + generated badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(34,197,94,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BookOpen size={16} strokeWidth={1.5} style={{ color: '#22C55E' }} />
          </div>

          {hasGenerated && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                height: '20px',
                padding: '0 8px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.80)',
                backgroundColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <Sparkles size={10} strokeWidth={2} />
              Generated
            </span>
          )}
        </div>

        {/* Customer name */}
        <div>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#EBEBEB',
              margin: 0,
              marginBottom: '4px',
              letterSpacing: '-0.01em',
            }}
          >
            {caseStudy.customerName}
          </h3>

          {/* Meta */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {caseStudy.customerIndustry && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#555' }}>
                <Building2 size={11} />
                {caseStudy.customerIndustry}
              </span>
            )}
            {caseStudy.customerSize && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#555' }}>
                <Users size={11} />
                {caseStudy.customerSize}
              </span>
            )}
          </div>
        </div>

        {/* Challenge snippet */}
        <p
          style={{
            fontSize: '12px',
            color: '#888',
            margin: 0,
            lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {caseStudy.challenge}
        </p>

        {/* Metrics tags */}
        {caseStudy.metrics.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {caseStudy.metrics.slice(0, 3).map((metric, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: '20px',
                  padding: '0 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#22C55E',
                  backgroundColor: 'rgba(34,197,94,0.1)',
                }}
              >
                {metric.value}{metric.unit ?? ''} {metric.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

export function CaseStudyGrid({ caseStudies, onAdd }: CaseStudyGridProps) {
  if (caseStudies.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No case studies yet"
        description="Add your first customer success story to use in AI-generated collateral."
        action={onAdd ? { label: 'Add case study', onClick: onAdd } : undefined}
      />
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '12px',
      }}
    >
      {caseStudies.map((cs) => (
        <CaseStudyCard key={cs.id} caseStudy={cs} />
      ))}
    </div>
  )
}
