'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import useSWR from 'swr'
import { BarChart2, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/format'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function PipelinePage() {
  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data

  const competitivePatterns: any[] = brain?.competitivePatterns ?? []
  const productGaps: any[] = (brain?.productGapPriority ?? []).slice(0, 5)

  const card: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '20px 22px',
  }

  function SkeletonLine({ h = '14px' }: { h?: string }) {
    return <div style={{ width: '100%', height: h, borderRadius: '4px' }} className="skeleton" />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Competitive Landscape */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={15} style={{ color: 'var(--accent-info)' }} />
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
              const color = wr != null ? (wr >= 60 ? 'var(--accent-success)' : wr >= 40 ? 'var(--accent-warning)' : 'var(--accent-danger)') : 'var(--text-tertiary)'
              return (
                <Link key={i} href={`/intelligence/competitors/${encodeURIComponent(p.competitor ?? '')}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                    transition: 'background var(--transition-fast)',
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-glass)'}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>vs {p.competitor}</div>
                    {wr != null ? (
                      <div style={{ fontSize: '18px', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{wr}%</div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No data yet</div>
                    )}
                    {p.dealCount != null && (
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{p.dealCount} deal{p.dealCount !== 1 ? 's' : ''}</div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0, padding: '20px 0', textAlign: 'center' }}>
            Competitor data appears as you log deals with competition fields.
          </p>
        )}
      </div>

      {/* Revenue at Risk by Feature Gap */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={15} style={{ color: 'var(--accent-warning)' }} />
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
                  <th key={h} style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left', padding: '0 12px 8px 0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productGaps.map((gap: any, i: number) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 12px 10px 0', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {gap.title ?? gap.feature ?? gap.pattern ?? 'Gap'}
                  </td>
                  <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {gap.dealsBlocked ?? gap.dealCount ?? gap.count ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px 10px 0', fontSize: '12px', fontWeight: 600, color: 'var(--accent-danger)', fontVariantNumeric: 'tabular-nums' }}>
                    {gap.revenueAtRisk ? formatCurrency(Math.round(gap.revenueAtRisk)) : '—'}
                  </td>
                  <td style={{ padding: '10px 0' }}>
                    {gap.linkedIssues || gap.linearIssue || gap.status === 'on_roadmap' || gap.status === 'shipped' ? (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-success)', display: 'inline-block' }} />
                        Linked
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-tertiary)', display: 'inline-block' }} />
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
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '0 0 6px' }}>
              Feature gap signals appear from deal notes analysis.
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
              Upload meeting notes on any deal to surface gaps automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
