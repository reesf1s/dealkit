/**
 * /deal-share/[token] — public, unauthenticated read-only deal view.
 * Shows key deal info that a rep chooses to share with a prospect or stakeholder.
 * No sensitive internal data (scores, risks, notes) is exposed.
 */
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

interface Props {
  params: Promise<{ token: string }>
}

function fmt(v: number | null | undefined) {
  if (!v) return null
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const STAGE_LABELS: Record<string, string> = {
  prospecting: 'Prospecting',
  discovery: 'Discovery',
  demo: 'Demo',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

export default async function DealSharePage({ params }: Props) {
  const { token } = await params

  const [deal] = await db
    .select({
      dealName: dealLogs.dealName,
      prospectCompany: dealLogs.prospectCompany,
      prospectName: dealLogs.prospectName,
      prospectTitle: dealLogs.prospectTitle,
      description: dealLogs.description,
      dealValue: dealLogs.dealValue,
      stage: dealLogs.stage,
      successCriteria: dealLogs.successCriteria,
      nextSteps: dealLogs.nextSteps,
      closeDate: dealLogs.closeDate,
      dealIsShared: dealLogs.dealIsShared,
      dealShareToken: dealLogs.dealShareToken,
    })
    .from(dealLogs)
    .where(eq(dealLogs.dealShareToken, token))
    .limit(1)

  if (!deal || !deal.dealIsShared) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '48px', margin: '0 0 16px', color: '#334155' }}>404</p>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#e2e8f0', margin: '0 0 8px' }}>This link is not available</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>This deal overview may have been unshared or does not exist.</p>
        </div>
      </div>
    )
  }

  const stageLabel = STAGE_LABELS[deal.stage] ?? deal.stage

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', color: '#e2e8f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '56px 24px' }}>

        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '56px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.03em', color: '#e2e8f0' }}>Halvex</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '2px 10px' }}>
            Shared overview
          </span>
        </div>

        {/* Deal title */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{
              fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.70)',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '4px', padding: '2px 8px',
            }}>
              {stageLabel}
            </span>
            {fmt(deal.dealValue) && (
              <span style={{ fontSize: '12px', color: '#64748b' }}>{fmt(deal.dealValue)}</span>
            )}
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px', letterSpacing: '-0.04em', lineHeight: 1.15 }}>
            {deal.dealName}
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            {deal.prospectCompany}
            {deal.prospectName ? ` · ${deal.prospectName}` : ''}
            {deal.prospectTitle ? `, ${deal.prospectTitle}` : ''}
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '40px' }} />

        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '40px' }}>
          {fmtDate(deal.closeDate) && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '16px 20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>Target close</p>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{fmtDate(deal.closeDate)}</p>
            </div>
          )}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '16px 20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>Stage</p>
            <p style={{ fontSize: '15px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{stageLabel}</p>
          </div>
        </div>

        {/* Description */}
        {deal.description && (
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>About this engagement</h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{deal.description}</p>
          </div>
        )}

        {/* Success criteria */}
        {deal.successCriteria && (
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Success criteria</h2>
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px 20px' }}>
              <p style={{ fontSize: '14px', color: '#c7d2fe', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{deal.successCriteria}</p>
            </div>
          </div>
        )}

        {/* Next steps */}
        {deal.nextSteps && (
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Next steps</h2>
            <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: '10px', padding: '16px 20px' }}>
              <p style={{ fontSize: '14px', color: '#6ee7b7', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{deal.nextSteps}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: '64px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#334155', margin: 0 }}>
            Powered by{' '}
            <span style={{ color: 'rgba(255,255,255,0.80)', fontWeight: 600 }}>Halvex</span>
            {' '}· AI-powered sales intelligence
          </p>
        </div>
      </div>
    </div>
  )
}
