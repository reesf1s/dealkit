'use client'
export const dynamic = 'force-dynamic'

import { useParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Shield, Target, Swords, BarChart2, AlertTriangle } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const card: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(59,130,246,0.04), transparent)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '1rem',
  padding: '20px 24px',
  boxShadow: '0 2px 20px rgba(0,0,0,0.35)',
}

function WinRateBadge({ winRate }: { winRate: number }) {
  const color = winRate >= 60 ? '#34d399' : winRate >= 40 ? '#fbbf24' : '#f87171'
  const bg = winRate >= 60 ? 'rgba(52,211,153,0.12)' : winRate >= 40 ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)'
  const border = winRate >= 60 ? 'rgba(52,211,153,0.25)' : winRate >= 40 ? 'rgba(251,191,36,0.25)' : 'rgba(248,113,113,0.25)'
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
        <div style={{ height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)' }} className="skeleton" />
        {[1, 2, 3].map(i => <div key={i} style={{ height: '120px', borderRadius: '16px' }} className="skeleton" />)}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Back link */}
      <div>
        <Link href="/competitors" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> All competitors
        </Link>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Swords size={17} color="#f87171" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e8f0', margin: 0, letterSpacing: '-0.03em' }}>
              vs {displayName}
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
            Competitive battlecard · {linkedDeals.length} deal{linkedDeals.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        {pattern && <WinRateBadge winRate={pattern.winRate} />}
      </div>

      {/* No data fallback */}
      {!pattern && linkedDeals.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
          <Swords size={28} style={{ color: '#334155', marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            No competitive data yet for {displayName}. Log deals where you compete against them to build a battlecard.
          </p>
        </div>
      )}

      {/* Stats row */}
      {linkedDeals.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { label: 'Deals tracked', value: String(linkedDeals.length), color: '#818cf8' },
            { label: 'Won', value: String(wonDeals.length), color: '#34d399' },
            { label: 'Lost', value: String(lostDeals.length), color: '#f87171' },
            { label: 'Win rate', value: linkedDeals.length > 0 ? `${Math.round((wonDeals.length / linkedDeals.length) * 100)}%` : '—', color: wonDeals.length > lostDeals.length ? '#34d399' : '#f87171' },
          ].map(s => (
            <div key={s.label} style={{ ...card, padding: '12px 18px', minWidth: '100px' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
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
              <TrendingUp size={15} style={{ color: '#34d399' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>When we win</span>
            </div>
            <div style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: '8px', padding: '12px 14px' }}>
              <p style={{ fontSize: '13px', color: '#6ee7b7', lineHeight: 1.6, margin: 0 }}>
                {pattern.topWinCondition || 'Not enough data yet.'}
              </p>
            </div>
            {wonDeals.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ fontSize: '11px', color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Won deals ({wonDeals.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {wonDeals.slice(0, 4).map((d: any) => (
                    <Link key={d.id} href={`/deals/${d.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.dealName}</span>
                      <span style={{ fontSize: '10px', color: '#475569', flexShrink: 0 }}>{d.prospectCompany}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Watch out for */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <AlertTriangle size={15} style={{ color: '#f87171' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Watch out for</span>
            </div>
            <div style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: '8px', padding: '12px 14px' }}>
              <p style={{ fontSize: '13px', color: '#fca5a5', lineHeight: 1.6, margin: 0 }}>
                {pattern.topLossRisk || 'Not enough data yet.'}
              </p>
            </div>
            {lostDeals.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ fontSize: '11px', color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lost deals ({lostDeals.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {lostDeals.slice(0, 4).map((d: any) => (
                    <Link key={d.id} href={`/deals/${d.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.dealName}</span>
                      <span style={{ fontSize: '10px', color: '#475569', flexShrink: 0 }}>{d.prospectCompany}</span>
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
              <Shield size={15} style={{ color: '#818cf8' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Profile</span>
            </div>
            <Link href={`/competitors/${compProfile.id}`} style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none', fontWeight: 500 }}>
              Edit profile →
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {compProfile.strengths?.length > 0 && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Their strengths</p>
                <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {compProfile.strengths.slice(0, 4).map((s: string, i: number) => (
                    <li key={i} style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {compProfile.weaknesses?.length > 0 && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Their weaknesses</p>
                <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {compProfile.weaknesses.slice(0, 4).map((s: string, i: number) => (
                    <li key={i} style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {compProfile.differentiators?.length > 0 && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Our differentiators</p>
                <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {compProfile.differentiators.slice(0, 4).map((s: string, i: number) => (
                    <li key={i} style={{ fontSize: '12px', color: '#6ee7b7', lineHeight: 1.5 }}>{s}</li>
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
            <Target size={15} style={{ color: '#fbbf24' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Active deals with this competitor</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {linkedDeals
              .filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
              .slice(0, 6)
              .map((d: any) => (
                <Link key={d.id} href={`/deals/${d.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.dealName}</p>
                    <p style={{ fontSize: '11px', color: '#475569', margin: 0 }}>{d.prospectCompany} · {d.stage?.replace(/_/g, ' ')}</p>
                  </div>
                  {d.conversionScore != null && (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: d.conversionScore >= 60 ? '#34d399' : d.conversionScore >= 40 ? '#fbbf24' : '#f87171', flexShrink: 0 }}>
                      {d.conversionScore}%
                    </span>
                  )}
                  <BarChart2 size={13} style={{ color: '#334155', flexShrink: 0 }} />
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
