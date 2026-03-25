'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import { BarChart2, TrendingUp } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function ModelsPage() {
  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data

  const ml = brain?.mlModel
  const mlAccuracy: number | null = ml?.looAccuracy ?? null
  const mlDealCount: number | null = ml?.trainingSize ?? null
  const forecastAccuracy: number | null = ml?.forecastAccuracy ?? null

  const card: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '20px 22px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Win Probability Model */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <BarChart2 size={15} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Win Probability Model</span>
        </div>
        {isLoading ? (
          <div style={{ height: '56px', borderRadius: '8px' }} className="skeleton" />
        ) : (
          <div style={{
            padding: '16px 18px', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-hero)', border: '1px solid rgba(99,102,241,0.15)',
          }}>
            {mlAccuracy != null ? (
              <div>
                <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(mlAccuracy * 100)}%
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                  Leave-one-out accuracy · trained on {mlDealCount ?? '?'} deal{(mlDealCount ?? 0) !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Model retrains automatically as you close more deals.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                The AI model improves as you log more deals. Close 5+ deals to enable predictive scoring.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Forecast Accuracy */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <TrendingUp size={15} style={{ color: 'var(--accent-success)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Forecast Accuracy</span>
        </div>
        {isLoading ? (
          <div style={{ height: '56px', borderRadius: '8px' }} className="skeleton" />
        ) : forecastAccuracy != null ? (
          <div style={{
            padding: '16px 18px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)',
          }}>
            <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--accent-success)', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(forecastAccuracy * 100)}%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
              Historical revenue forecast accuracy
            </div>
          </div>
        ) : (
          <div style={{
            padding: '16px 18px', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              Not enough closed deals yet. Forecast accuracy is computed once you have a meaningful history of closed deals.
            </div>
          </div>
        )}
      </div>

      {/* Model details */}
      {ml && (
        <div style={card}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Model Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Algorithm', value: ml.algorithm ?? 'Random Forest' },
              { label: 'Training deals', value: mlDealCount != null ? String(mlDealCount) : '—' },
              { label: 'Features used', value: ml.featureImportance?.length != null ? String(ml.featureImportance.length) : '—' },
              { label: 'Last trained', value: ml.trainedAt ? new Date(ml.trainedAt).toLocaleDateString() : '—' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{row.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
