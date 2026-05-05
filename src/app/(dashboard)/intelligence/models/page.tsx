'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import { BarChart2, TrendingUp, Zap } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'

export default function ModelsPage() {
  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data

  const ml = brain?.mlModel
  const mlAccuracy: number | null = ml?.looAccuracy ?? null
  const mlDealCount: number | null = ml?.trainingSize ?? null
  const forecastAccuracy: number | null = ml?.forecastAccuracy ?? null
  const features: any[] = ml?.featureImportance ?? []

  const card: React.CSSProperties = {
    background: 'var(--surface-1)',
    border: '1px solid rgba(55,53,47,0.12)',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(55,53,47,0.06)',
    padding: '24px',
  }

  function SkeletonLine({ h = '14px' }: { h?: string }) {
    return <div style={{ width: '100%', height: h, borderRadius: '4px' }} className="skeleton" />
  }

  return (
    <div style={{ maxWidth: '1040px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Win Probability Model */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <BarChart2 size={15} style={{ color: 'var(--brand)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Win Probability Model</span>
        </div>
        {isLoading ? (
          <div style={{ height: '100px', borderRadius: '8px' }} className="skeleton" />
        ) : (
          <div style={{
            padding: '24px', borderRadius: '8px',
            background: '#f7f6f3',
            border: '1px solid rgba(55,53,47,0.09)',
          }}>
            {mlAccuracy != null ? (
              <div>
                <div style={{ fontSize: '48px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(mlAccuracy * 100)}%
                </div>
                <div style={{ fontSize: '13px', color: '#787774', marginTop: '12px', lineHeight: 1.6 }}>
                  Leave-one-out accuracy · trained on {mlDealCount ?? '?'} deal{(mlDealCount ?? 0) !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: '12px', color: '#9b9a97', marginTop: '6px' }}>
                  Model retrains automatically as you close more deals.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#9b9a97', lineHeight: 1.6 }}>
                The AI model improves as you log more deals. Close 5+ deals to enable predictive scoring.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Forecast Accuracy */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <TrendingUp size={15} style={{ color: '#0f7b6c' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Forecast Accuracy</span>
        </div>
        {isLoading ? (
          <div style={{ height: '100px', borderRadius: '8px' }} className="skeleton" />
        ) : forecastAccuracy != null ? (
          <div style={{
            padding: '24px', borderRadius: '8px',
            background: 'rgba(15,123,108,0.08)',
            border: '1px solid rgba(15,123,108,0.20)',
          }}>
            <div style={{ fontSize: '48px', fontWeight: 700, color: '#0f7b6c', letterSpacing: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(forecastAccuracy * 100)}%
            </div>
            <div style={{ fontSize: '13px', color: '#787774', marginTop: '12px', lineHeight: 1.6 }}>
              Historical revenue forecast accuracy (90-day rolling)
            </div>
          </div>
        ) : (
          <div style={{
            padding: '24px', borderRadius: '8px',
            background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.09)',
          }}>
            <div style={{ fontSize: '13px', color: '#9b9a97', lineHeight: 1.6 }}>
              Not enough closed deals yet. Forecast accuracy is computed once you have a meaningful history of closed deals.
            </div>
          </div>
        )}
      </div>

      {/* Model Configuration */}
      {features.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Zap size={15} style={{ color: '#cb6c2c' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Model Configuration</span>
          </div>
          <div style={{ fontSize: '12px', color: '#9b9a97', marginBottom: '12px' }}>
            Top features weighted by importance:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {features.slice(0, 8).map((f: any, i: number) => {
              const importance = f.importance ?? 0
              const pct = Math.min(100, importance * 100 * 5)
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#787774' }}>{f.name ?? f.label ?? f.feature}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{(importance * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(55,53,47,0.09)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand)', borderRadius: '2px' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Model Details */}
      {ml && (
        <div style={card}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Model Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Algorithm', value: ml.algorithm ?? 'Random Forest' },
              { label: 'Training deals', value: mlDealCount != null ? String(mlDealCount) : '—' },
              { label: 'Features used', value: ml.featureImportance?.length != null ? String(ml.featureImportance.length) : '—' },
              { label: 'Last trained', value: ml.trainedAt ? new Date(ml.trainedAt).toLocaleDateString() : '—' },
              { label: 'Status', value: ml.status ?? 'Active' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(55,53,47,0.09)' }}>
                <span style={{ fontSize: '12px', color: '#9b9a97' }}>{row.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#787774', fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
