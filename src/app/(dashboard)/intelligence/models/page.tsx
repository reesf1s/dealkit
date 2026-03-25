'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import { BarChart2, TrendingUp, Zap } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function ModelsPage() {
  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data

  const ml = brain?.mlModel
  const mlAccuracy: number | null = ml?.looAccuracy ?? null
  const mlDealCount: number | null = ml?.trainingSize ?? null
  const forecastAccuracy: number | null = ml?.forecastAccuracy ?? null
  const features: any[] = ml?.featureImportance ?? []

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
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
          <BarChart2 size={15} style={{ color: 'rgba(255,255,255,0.80)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Win Probability Model</span>
        </div>
        {isLoading ? (
          <div style={{ height: '100px', borderRadius: '8px' }} className="skeleton" />
        ) : (
          <div style={{
            padding: '24px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}>
            {mlAccuracy != null ? (
              <div>
                <div style={{ fontSize: '48px', fontWeight: 700, color: 'rgba(255,255,255,0.80)', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(mlAccuracy * 100)}%
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '12px', lineHeight: 1.6 }}>
                  Leave-one-out accuracy · trained on {mlDealCount ?? '?'} deal{(mlDealCount ?? 0) !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>
                  Model retrains automatically as you close more deals.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                The AI model improves as you log more deals. Close 5+ deals to enable predictive scoring.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Forecast Accuracy */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <TrendingUp size={15} style={{ color: '#10b981' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Forecast Accuracy</span>
        </div>
        {isLoading ? (
          <div style={{ height: '100px', borderRadius: '8px' }} className="skeleton" />
        ) : forecastAccuracy != null ? (
          <div style={{
            padding: '24px', borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.1) 100%)',
            border: '1px solid rgba(16,185,129,0.3)',
          }}>
            <div style={{ fontSize: '48px', fontWeight: 700, color: '#10b981', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(forecastAccuracy * 100)}%
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '12px', lineHeight: 1.6 }}>
              Historical revenue forecast accuracy (90-day rolling)
            </div>
          </div>
        ) : (
          <div style={{
            padding: '24px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
              Not enough closed deals yet. Forecast accuracy is computed once you have a meaningful history of closed deals.
            </div>
          </div>
        )}
      </div>

      {/* Model Configuration */}
      {features.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Zap size={15} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Model Configuration</span>
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
            Top features weighted by importance:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {features.slice(0, 8).map((f: any, i: number) => {
              const importance = f.importance ?? 0
              const pct = Math.min(100, importance * 100 * 5)
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>{f.name ?? f.label ?? f.feature}</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.80)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{(importance * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'rgba(255,255,255,0.80)', borderRadius: '2px' }} />
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
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'white', marginBottom: '12px' }}>Model Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Algorithm', value: ml.algorithm ?? 'Random Forest' },
              { label: 'Training deals', value: mlDealCount != null ? String(mlDealCount) : '—' },
              { label: 'Features used', value: ml.featureImportance?.length != null ? String(ml.featureImportance.length) : '—' },
              { label: 'Last trained', value: ml.trainedAt ? new Date(ml.trainedAt).toLocaleDateString() : '—' },
              { label: 'Status', value: ml.status ?? 'Active' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{row.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
