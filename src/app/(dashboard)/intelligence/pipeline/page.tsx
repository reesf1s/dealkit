'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import useSWR from 'swr'
import { BarChart2, DollarSign, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/format'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function PipelinePage() {
  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data

  const competitivePatterns: any[] = brain?.competitivePatterns ?? []
  const staleDeals: any[] = brain?.staleDeals ?? []
  const productGaps: any[] = (brain?.productGapPriority ?? []).slice(0, 5)

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

  function getRiskColor(score: number | null): string {
    if (score === null) return 'rgba(255,255,255,0.4)'
    if (score >= 70) return '#10b981'
    if (score >= 40) return '#f59e0b'
    return '#ef4444'
  }

  function getRiskLabel(score: number | null): string {
    if (score === null) return 'Unknown'
    if (score >= 70) return 'Low'
    if (score >= 40) return 'Medium'
    return 'High'
  }

  return (
    <div style={{ maxWidth: '1040px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Deal Risk Heatmap */}
      {staleDeals.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <AlertTriangle size={15} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Deal Risk Heatmap</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Deal', 'Stage', 'Days stale', 'Value', 'Risk'].map(h => (
                  <th key={h} style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left', padding: '0 12px 8px 0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staleDeals.slice(0, 8).map((deal: any, i: number) => {
                const riskScore = deal.riskScore ?? (deal.daysSinceActivity > 30 ? 80 : deal.daysSinceActivity > 14 ? 60 : 40)
                return (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: '13px', fontWeight: 500, color: 'white' }}>
                      {deal.dealName ?? deal.name ?? 'Deal'}
                    </td>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                      {deal.stage ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums' }}>
                      {deal.daysSinceUpdate ?? deal.daysSinceActivity ?? '—'}d
                    </td>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums' }}>
                      {deal.value ? formatCurrency(Math.round(deal.value)) : '—'}
                    </td>
                    <td style={{ padding: '10px 0' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 600, color: getRiskColor(riskScore),
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 8px', borderRadius: '6px',
                        background: `${getRiskColor(riskScore)}20`,
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: getRiskColor(riskScore), display: 'inline-block' }} />
                        {getRiskLabel(riskScore)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Competitive Landscape */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={15} style={{ color: 'rgba(255,255,255,0.90)' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Competitive Landscape</span>
          </div>
        </div>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1,2,3].map(i => <SkeletonLine key={i} h="60px" />)}
          </div>
        ) : competitivePatterns.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {competitivePatterns.map((p: any, i: number) => {
              const wr = typeof p.winRate === 'number' ? p.winRate : null
              const color = wr != null ? (wr >= 60 ? '#10b981' : wr >= 40 ? '#f59e0b' : '#ef4444') : 'rgba(255,255,255,0.4)'
              return (
                <Link key={i} href={`/intelligence/pipeline`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '12px 14px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    transition: 'background 0.2s ease',
                    cursor: 'pointer',
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>vs {p.competitor}</div>
                    {wr != null ? (
                      <div style={{ fontSize: '18px', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{wr}%</div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>No data yet</div>
                    )}
                    {p.dealCount != null && (
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{p.dealCount} deal{p.dealCount !== 1 ? 's' : ''}</div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0, padding: '20px 0', textAlign: 'center' }}>
            Competitor data appears as you log deals with competition fields.
          </p>
        )}
      </div>

      {/* Revenue at Risk by Feature Gap */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={15} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Revenue at Risk by Feature Gap</span>
          </div>
        </div>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1,2,3].map(i => <SkeletonLine key={i} h="36px" />)}
          </div>
        ) : productGaps.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Gap', 'Deals blocked', 'Revenue at risk', 'Status'].map(h => (
                  <th key={h} style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left', padding: '0 12px 8px 0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productGaps.map((gap: any, i: number) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <td style={{ padding: '10px 12px 10px 0', fontSize: '13px', fontWeight: 500, color: 'white' }}>
                    {gap.title ?? gap.feature ?? gap.pattern ?? 'Gap'}
                  </td>
                  <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums' }}>
                    {gap.dealsBlocked ?? gap.dealCount ?? gap.count ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', fontWeight: 600, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                    {gap.revenueAtRisk ? formatCurrency(Math.round(gap.revenueAtRisk)) : '—'}
                  </td>
                  <td style={{ padding: '10px 0' }}>
                    {gap.linkedIssues || gap.linearIssue || gap.status === 'on_roadmap' || gap.status === 'shipped' ? (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                        Linked
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.4)', display: 'inline-block' }} />
                        No issue
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '0 0 6px' }}>
              Feature gap signals appear from deal notes analysis.
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              Upload meeting notes on any deal to surface gaps automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
