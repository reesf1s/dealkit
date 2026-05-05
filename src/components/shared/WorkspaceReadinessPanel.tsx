'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { ArrowRight, CheckCircle2, CircleDashed, ShieldAlert } from 'lucide-react'
import SetupBanner from '@/components/shared/SetupBanner'
import { fetcher, isDbNotConfigured } from '@/lib/fetcher'

type ReadinessItem = {
  id: string
  label: string
  href: string
  done: boolean
  degraded: boolean
  description: string
}

type WorkspaceReadinessResponse = {
  data: {
    workspaceName: string
    role: 'owner' | 'admin' | 'member'
    score: number
    completed: number
    total: number
    degradedCount: number
    summary: {
      dealCount: number
      openDealCount: number
      competitorCount: number
      caseStudyCount: number
      linearIssueCount: number
    }
    items: ReadinessItem[]
    nextAction: {
      title: string
      description: string
      href: string
      ctaLabel: string
    } | null
  }
}

interface WorkspaceReadinessPanelProps {
  compact?: boolean
  hideWhenComplete?: boolean
  title?: string
  description?: string
}

function tone(item: ReadinessItem): { color: string; background: string; border: string; label: string } {
  if (item.degraded) {
    return {
      color: 'var(--color-amber)',
      background: 'var(--color-amber-bg)',
      border: '1px solid rgba(245,158,11,0.22)',
      label: 'Needs attention',
    }
  }

  if (item.done) {
    return {
      color: 'var(--color-green)',
      background: 'var(--color-green-bg)',
      border: '1px solid rgba(16,185,129,0.20)',
      label: 'Ready',
    }
  }

  return {
    color: 'var(--text-tertiary)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border-default)',
    label: 'Not set up',
  }
}

export default function WorkspaceReadinessPanel({
  compact,
  hideWhenComplete,
  title,
  description,
}: WorkspaceReadinessPanelProps) {
  const { data, error, isLoading } = useSWR<WorkspaceReadinessResponse>('/api/workspace/readiness', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })

  const readiness = data?.data
  const dbError = isDbNotConfigured(error)

  if (dbError) {
    return (
      <div style={{ marginBottom: compact ? 0 : '4px' }}>
        <SetupBanner inline={compact} context="Add a DATABASE_URL so Halvex can measure workspace readiness from live company, deal, and integration data." />
      </div>
    )
  }

  if (error || (!isLoading && !readiness)) return null
  if (hideWhenComplete && readiness?.score === 100 && readiness.degradedCount === 0) return null

  const panelTitle = title ?? 'Workspace readiness'
  const panelDescription = description ?? 'One live view of how ready Halvex is for reliable enterprise deal intelligence.'

  if (isLoading || !readiness) {
    return (
      <div style={{
        padding: compact ? '16px 18px' : '22px',
        borderRadius: '8px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border-default)',
      }}>
        <div className="skeleton" style={{ height: '12px', width: '140px', borderRadius: '999px', marginBottom: '12px' }} />
        <div className="skeleton" style={{ height: '8px', width: '100%', borderRadius: '999px', marginBottom: '14px' }} />
        <div style={{ display: 'grid', gap: '10px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: compact ? '38px' : '48px', borderRadius: '8px' }} />
          ))}
        </div>
      </div>
    )
  }

  const readyText =
    readiness.score === 100 && readiness.degradedCount === 0
      ? 'Enterprise-ready foundation'
      : readiness.nextAction
        ? readiness.nextAction.title
        : 'Workspace needs attention'

  return (
    <div style={{
      padding: compact ? '18px 20px' : '24px',
      borderRadius: '8px',
      background: 'var(--surface-1)',
      border: '1px solid var(--border-default)',
      boxShadow: compact ? 'none' : 'var(--shadow-card)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap', marginBottom: compact ? '14px' : '18px' }}>
        <div>
          <div className="operator-eyebrow" style={{ marginBottom: '8px' }}>
            {panelTitle}
          </div>
          <div style={{ fontSize: compact ? '18px' : '24px', lineHeight: 1.08, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0, marginBottom: '8px' }}>
            {readyText}
          </div>
          <div style={{ fontSize: compact ? '12px' : '14px', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: compact ? '540px' : '640px' }}>
            {readiness.nextAction?.description ?? panelDescription}
          </div>
        </div>

        <div style={{ minWidth: compact ? '160px' : '180px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', justifyContent: compact ? 'flex-start' : 'flex-end', marginBottom: '8px' }}>
            <span style={{ fontSize: compact ? '28px' : '34px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0 }}>
              {readiness.score}%
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              {readiness.completed}/{readiness.total} complete
            </span>
          </div>
          <div style={{ height: '8px', borderRadius: '999px', background: 'var(--surface-3)', overflow: 'hidden' }}>
            <div style={{
              width: `${readiness.score}%`,
              height: '100%',
              borderRadius: '999px',
              background: readiness.degradedCount > 0 ? 'var(--color-amber)' : 'var(--brand)',
            }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: compact ? '14px' : '18px' }}>
        {[
          { label: `${readiness.summary.openDealCount} open deals`, value: readiness.summary.openDealCount },
          { label: `${readiness.summary.competitorCount} competitors`, value: readiness.summary.competitorCount },
          { label: `${readiness.summary.caseStudyCount} case studies`, value: readiness.summary.caseStudyCount },
          { label: `${readiness.summary.linearIssueCount} Linear issues`, value: readiness.summary.linearIssueCount },
        ].map(metric => (
          <div
            key={metric.label}
            style={{
              padding: '8px 10px',
              borderRadius: '999px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-default)',
              fontSize: '11px',
              color: metric.value > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: 700,
            }}
          >
            {metric.label}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: compact ? '10px' : '12px' }}>
        {readiness.items.map(item => {
          const styles = tone(item)
          return (
            <Link
              key={item.id}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: compact ? '12px 13px' : '14px 15px',
                borderRadius: '8px',
                background: styles.background,
                border: styles.border,
                textDecoration: 'none',
              }}
            >
              <div style={{ marginTop: '1px', flexShrink: 0 }}>
                {item.degraded ? (
                  <ShieldAlert size={15} color="var(--color-amber)" />
                ) : item.done ? (
                  <CheckCircle2 size={15} color="var(--color-green)" />
                ) : (
                  <CircleDashed size={15} color="var(--text-tertiary)" />
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: styles.color, whiteSpace: 'nowrap' }}>
                    {styles.label}
                  </div>
                </div>
                <div style={{ fontSize: compact ? '11px' : '12px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  {item.description}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {readiness.nextAction && (
        <Link
          href={readiness.nextAction.href}
          style={{
            marginTop: compact ? '14px' : '18px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--brand)',
            textDecoration: 'none',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          {readiness.nextAction.ctaLabel}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  )
}
