'use client'
export const dynamic = 'force-dynamic'

import { useParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Shield, Target, Swords, BarChart2, AlertTriangle } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'

const card: React.CSSProperties = {
  background: 'var(--surface-1)',
  border: '1px solid rgba(55,53,47,0.12)',
  borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(55,53,47,0.06)',
  padding: '20px 24px',
}

function WinRateBadge({ winRate }: { winRate: number }) {
  const color = winRate >= 60 ? '#0f7b6c' : winRate >= 40 ? '#cb6c2c' : '#e03e3e'
  const bg = winRate >= 60 ? 'rgba(15,123,108,0.08)' : winRate >= 40 ? 'rgba(203,108,44,0.08)' : 'rgba(224,62,62,0.08)'
  const border = winRate >= 60 ? 'rgba(15,123,108,0.20)' : winRate >= 40 ? 'rgba(203,108,44,0.20)' : 'rgba(224,62,62,0.20)'
  return (
    <span style={{ fontSize: '13px', fontWeight: 700, color, background: bg, border: `1px solid ${border}`, borderRadius: '6px', padding: '3px 10px' }}>
      {Math.round(winRate)}% win rate
    </span>
  )
}

export default function CompetitorBattlecardPage() {
  const { slug } = useParams<{ slug: string }>()
  const competitorName = decodeURIComponent(slug).replace(/-/g, ' ')

  const { data: brainRes, isLoading: brainLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const { data: compListRes, isLoading: compLoading } = useSWR('/api/competitors', fetcher, { revalidateOnFocus: false })
  const { data: dealsRes } = useSWR('/api/deals', fetcher, { revalidateOnFocus: false })

  const brain = brainRes?.data
  const isLoading = brainLoading || compLoading

  // Find competitive pattern from brain
  const pattern = (brain?.competitivePatterns ?? []).find(
    (p: any) => p.competitor.toLowerCase() === competitorName.toLowerCase()
  )

  // Find competitor profile
  const compProfile = (compListRes?.data ?? []).find(
    (c: any) => c.name.toLowerCase() === competitorName.toLowerCase()
  )

  // Find deals where this competitor was mentioned
  const allDeals: any[] = dealsRes?.data ?? []
  const linkedDeals = allDeals.filter((d: any) =>
    (d.competitors as string[] ?? []).some((c: string) => c.toLowerCase() === competitorName.toLowerCase())
  )
  const wonDeals = linkedDeals.filter((d: any) => d.stage === 'closed_won')
  const lostDeals = linkedDeals.filter((d: any) => d.stage === 'closed_lost')

  const displayName = compProfile?.name ?? competitorName

  if (isLoading) {
    return (
      <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ height: '40px', borderRadius: '8px', background: '#f7f6f3' }} className="skeleton" />
        {[1, 2, 3].map(i => <div key={i} style={{ height: '120px', borderRadius: '8px' }} className="skeleton" />)}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Back link */}
      <div>
        <Link href="/competitors" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#787774', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> All competitors
        </Link>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              background: 'rgba(224,62,62,0.08)', border: '1px solid rgba(224,62,62,0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Swords size={17} color="#e03e3e" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>
              vs {displayName}
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: '#787774', margin: 0 }}>
            Competitive battlecard · {linkedDeals.length} deal{linkedDeals.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        {pattern && <WinRateBadge winRate={pattern.winRate} />}
      </div>

      {/* No data fallback */}
      {!pattern && linkedDeals.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
          <Swords size={28} style={{ color: '#9b9a97', marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', color: '#787774', margin: 0 }}>
            No competitive data yet for {displayName}. Log deals where you compete against them to build a battlecard.
          </p>
        </div>
      )}

      {/* Stats row */}
      {linkedDeals.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { label: 'Deals tracked', value: String(linkedDeals.length), color: 'var(--text-primary)' },
            { label: 'Won', value: String(wonDeals.length), color: '#0f7b6c' },
            { label: 'Lost', value: String(lostDeals.length), color: '#e03e3e' },
            { label: 'Win rate', value: linkedDeals.length > 0 ? `${Math.round((wonDeals.length / linkedDeals.length) * 100)}%` : '—', color: wonDeals.length > lostDeals.length ? '#0f7b6c' : '#e03e3e' },
          ].map(s => (
            <div key={s.label} style={{ ...card, padding: '12px 18px', minWidth: '100px' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: '#9b9a97', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ML-derived battlecard sections */}
      {pattern && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>

          {/* When we win */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <TrendingUp size={15} style={{ color: '#0f7b6c' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>When we win</span>
            </div>
            <div style={{ background: 'rgba(15,123,108,0.08)', border: '1px solid rgba(15,123,108,0.20)', borderRadius: '8px', padding: '12px 14px' }}>
              <p style={{ fontSize: '13px', color: '#0f7b6c', lineHeight: 1.6, margin: 0 }}>
                {pattern.topWinCondition || 'Not enough data yet.'}
              </p>
            </div>
            {wonDeals.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ fontSize: '11px', color: '#9b9a97', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Won deals ({wonDeals.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {wonDeals.slice(0, 4).map((d: any) => (
                    <Link key={d.id} href={`/deals/${d.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                      <span style={{ fontSize: '12px', color: '#787774', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.dealName}</span>
                      <span style={{ fontSize: '10px', color: '#9b9a97', flexShrink: 0 }}>{d.prospectCompany}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Watch out for */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <AlertTriangle size={15} style={{ color: '#e03e3e' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Watch out for</span>
            </div>
            <div style={{ background: 'rgba(224,62,62,0.08)', border: '1px solid rgba(224,62,62,0.20)', borderRadius: '8px', padding: '12px 14px' }}>
              <p style={{ fontSize: '13px', color: '#e03e3e', lineHeight: 1.6, margin: 0 }}>
                {pattern.topLossRisk || 'Not enough data yet.'}
              </p>
            </div>
            {lostDeals.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ fontSize: '11px', color: '#9b9a97', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lost deals ({lostDeals.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {lostDeals.slice(0, 4).map((d: any) => (
                    <Link key={d.id} href={`/deals/${d.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                      <span style={{ fontSize: '12px', color: '#787774', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.dealName}</span>
                      <span style={{ fontSize: '10px', color: '#9b9a97', flexShrink: 0 }}>{d.prospectCompany}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Competitor profile from database */}
      {compProfile && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={15} style={{ color: '#787774' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Profile</span>
            </div>
            <Link href={`/competitors/${compProfile.id}`} style={{ fontSize: '11px', color: '#5e6ad2', textDecoration: 'none', fontWeight: 500 }}>
              Edit profile →
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {compProfile.strengths?.length > 0 && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Their strengths</p>
                <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {compProfile.strengths.slice(0, 4).map((s: string, i: number) => (
                    <li key={i} style={{ fontSize: '12px', color: '#787774', lineHeight: 1.5 }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {compProfile.weaknesses?.length > 0 && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Their weaknesses</p>
                <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {compProfile.weaknesses.slice(0, 4).map((s: string, i: number) => (
                    <li key={i} style={{ fontSize: '12px', color: '#787774', lineHeight: 1.5 }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {compProfile.differentiators?.length > 0 && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Our differentiators</p>
                <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {compProfile.differentiators.slice(0, 4).map((s: string, i: number) => (
                    <li key={i} style={{ fontSize: '12px', color: '#0f7b6c', lineHeight: 1.5 }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active deals */}
      {linkedDeals.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Target size={15} style={{ color: '#cb6c2c' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Active deals with this competitor</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {linkedDeals
              .filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
              .slice(0, 6)
              .map((d: any) => (
                <Link key={d.id} href={`/deals/${d.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', padding: '10px 12px', borderRadius: '6px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.09)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.dealName}</p>
                    <p style={{ fontSize: '11px', color: '#9b9a97', margin: 0 }}>{d.prospectCompany} · {d.stage?.replace(/_/g, ' ')}</p>
                  </div>
                  {d.conversionScore != null && (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: d.conversionScore >= 60 ? '#0f7b6c' : d.conversionScore >= 40 ? '#cb6c2c' : '#e03e3e', flexShrink: 0 }}>
                      {d.conversionScore}%
                    </span>
                  )}
                  <BarChart2 size={13} style={{ color: '#9b9a97', flexShrink: 0 }} />
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
