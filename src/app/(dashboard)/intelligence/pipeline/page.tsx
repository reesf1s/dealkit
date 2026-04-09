'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import useSWR from 'swr'
import { BarChart2, DollarSign, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { fetcher } from '@/lib/fetcher'

export default function PipelinePage() {
  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data

  const competitivePatterns: any[] = brain?.competitivePatterns ?? []
  const staleDeals: any[] = brain?.staleDeals ?? []
  const productGaps: any[] = (brain?.productGapPriority ?? []).slice(0, 5)

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

  function getRiskColor(score: number | null): string {
    if (score === null) return '#9b9a97'
    if (score >= 70) return '#0f7b6c'
    if (score >= 40) return '#cb6c2c'
    return '#e03e3e'
  }

  function getRiskLabel(score: number | null): string {
    if (score === null) return 'Unknown'
    if (score >= 70) return 'Low'
    if (score >= 40) return 'Medium'
    return 'High'
  }

  function getRiskBg(score: number | null): string {
    if (score === null) return 'rgba(55,53,47,0.06)'
    if (score >= 70) return 'rgba(15,123,108,0.08)'
    if (score >= 40) return 'rgba(203,108,44,0.08)'
    return 'rgba(224,62,62,0.08)'
  }

  return (
    <div style={{ maxWidth: '1040px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Deal Risk Heatmap */}
      {staleDeals.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <AlertTriangle size={15} style={{ color: '#e03e3e' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Deal Risk Heatmap</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Deal', 'Stage', 'Days stale', 'Value', 'Risk'].map(h => (
                  <th key={h} style={{ fontSize: '10px', fontWeight: 600, color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left', padding: '0 12px 8px 0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staleDeals.slice(0, 8).map((deal: any, i: number) => {
                const riskScore = deal.riskScore ?? (deal.daysSinceActivity > 30 ? 80 : deal.daysSinceActivity > 14 ? 60 : 40)
                return (
                  <tr key={i} style={{ borderTop: '1px solid rgba(55,53,47,0.09)' }}>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {deal.dealName ?? deal.name ?? 'Deal'}
                    </td>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', color: '#787774' }}>
                      {deal.stage ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', color: '#787774', fontVariantNumeric: 'tabular-nums' }}>
                      {deal.daysSinceUpdate ?? deal.daysSinceActivity ?? '—'}d
                    </td>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {deal.value ? formatCurrency(Math.round(deal.value)) : '—'}
                    </td>
                    <td style={{ padding: '10px 0' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 600, color: getRiskColor(riskScore),
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 8px', borderRadius: '6px',
                        background: getRiskBg(riskScore),
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
            <BarChart2 size={15} style={{ color: 'var(--text-primary)' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Competitive Landscape</span>
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
              const color = wr != null ? (wr >= 60 ? '#0f7b6c' : wr >= 40 ? '#cb6c2c' : '#e03e3e') : '#9b9a97'
              const bg = wr != null ? (wr >= 60 ? 'rgba(15,123,108,0.08)' : wr >= 40 ? 'rgba(203,108,44,0.08)' : 'rgba(224,62,62,0.08)') : '#f7f6f3'
              const border = wr != null ? (wr >= 60 ? 'rgba(15,123,108,0.20)' : wr >= 40 ? 'rgba(203,108,44,0.20)' : 'rgba(224,62,62,0.20)') : 'rgba(55,53,47,0.09)'
              return (
                <Link key={i} href={`/intelligence/pipeline`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '12px 14px', borderRadius: '8px',
                    background: bg, border: `1px solid ${border}`,
                    transition: 'background 0.15s ease',
                    cursor: 'pointer',
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.filter = 'brightness(0.97)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.filter = 'none'}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>vs {p.competitor}</div>
                    {wr != null ? (
                      <div style={{ fontSize: '18px', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{wr}%</div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#9b9a97' }}>No data yet</div>
                    )}
                    {p.dealCount != null && (
                      <div style={{ fontSize: '11px', color: '#9b9a97', marginTop: '2px' }}>{p.dealCount} deal{p.dealCount !== 1 ? 's' : ''}</div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: '#9b9a97', margin: 0, padding: '20px 0', textAlign: 'center' }}>
            Competitor data appears as you log deals with competition fields.
          </p>
        )}
      </div>

      {/* Revenue at Risk by Feature Gap */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={15} style={{ color: '#cb6c2c' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Revenue at Risk by Feature Gap</span>
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
                  <th key={h} style={{ fontSize: '10px', fontWeight: 600, color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left', padding: '0 12px 8px 0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productGaps.map((gap: any, i: number) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(55,53,47,0.09)' }}>
                  <td style={{ padding: '10px 12px 10px 0', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {gap.title ?? gap.feature ?? gap.pattern ?? 'Gap'}
                  </td>
                  <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', color: '#787774', fontVariantNumeric: 'tabular-nums' }}>
                    {gap.dealsBlocked ?? gap.dealCount ?? gap.count ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', fontWeight: 600, color: '#e03e3e', fontVariantNumeric: 'tabular-nums' }}>
                    {gap.revenueAtRisk ? formatCurrency(Math.round(gap.revenueAtRisk)) : '—'}
                  </td>
                  <td style={{ padding: '10px 0' }}>
                    {gap.linkedIssues || gap.linearIssue || gap.status === 'on_roadmap' || gap.status === 'shipped' ? (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#0f7b6c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0f7b6c', display: 'inline-block' }} />
                        Linked
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#9b9a97', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#9b9a97', display: 'inline-block' }} />
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
            <p style={{ fontSize: '12px', color: '#9b9a97', margin: '0 0 6px' }}>
              Feature gap signals appear from deal notes analysis.
            </p>
            <p style={{ fontSize: '12px', color: '#9b9a97', margin: 0 }}>
              Upload meeting notes on any deal to surface gaps automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
