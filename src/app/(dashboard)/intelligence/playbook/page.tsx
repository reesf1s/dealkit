'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import { TrendingUp, TrendingDown, BookOpen, BarChart2, Lock } from 'lucide-react'
import { formatCurrency } from '@/lib/format'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function FactorBar({ label, importance, direction }: { label: string; importance: number; direction: string }) {
  const color = direction === 'helps' ? '#10b981' : '#ef4444'
  const pct = Math.min(100, importance * 100 * 5)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
        <span style={{ fontSize: '11px', color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{(importance * 100).toFixed(1)}%</span>
      </div>
      <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px' }} />
      </div>
    </div>
  )
}

export default function PlaybookPage() {
  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const { data: dealsRes } = useSWR('/api/deals', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data

  const wl = brain?.winLossIntel
  const ml = brain?.mlModel
  const objectionMap: any[] = brain?.objectionWinMap ?? []
  const competitivePatterns: any[] = brain?.competitivePatterns ?? []

  // Deduplicate feature importance by name before splitting into win/loss factors
  const seen = new Set<string>()
  const uniqueFeatures = (ml?.featureImportance ?? []).filter((f: any) => {
    const key = f.name ?? f.label ?? f.feature ?? ''
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const features: any[] = [...uniqueFeatures].sort((a: any, b: any) => b.importance - a.importance)
  const winFactors = features.filter((f: any) => f.direction === 'helps').slice(0, 5)
  const lossFactors = features.filter((f: any) => f.direction === 'hurts').slice(0, 5)

  const deals: any[] = dealsRes?.data ?? []
  const closedDeals = deals.filter((d: any) => d.stage === 'closed_won' || d.stage === 'closed_lost')
  const wonDeals = deals.filter((d: any) => d.stage === 'closed_won')
  const totalDeals = (wl?.winCount ?? 0) + (wl?.lossCount ?? 0)
  const hasEnoughData = totalDeals >= 10 || winFactors.length > 0

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    padding: '24px',
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[1, 2, 3].map(i => <div key={i} style={{ height: '80px', borderRadius: '10px' }} className="skeleton" />)}
      </div>
    )
  }

  if (!hasEnoughData) {
    const needed = Math.max(0, 10 - totalDeals)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Building your playbook…</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#7c3aed' }}>{totalDeals} / 10</span>
          </div>
          <div style={{ width: '100%', height: '6px', borderRadius: '100px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (totalDeals / 10) * 100)}%`, background: '#7c3aed', borderRadius: '100px' }} />
          </div>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '8px', lineHeight: 1.6 }}>
            {needed > 0 ? `${needed} more closed deal${needed !== 1 ? 's' : ''} needed to activate.` : 'Almost there — close more deals to unlock.'}
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {[
            { title: 'Your Winning Formula', desc: 'Top 5 signals that predict a won deal.', color: '#10b981' },
            { title: 'Your Losing Pattern', desc: 'Top 5 signals that predict a lost deal.', color: '#ef4444' },
            { title: 'Per-Competitor Playbook', desc: 'Win conditions vs each rival.', color: '#f59e0b' },
            { title: 'Objection Effectiveness', desc: 'Which objections your team handles well.', color: '#7c3aed' },
          ].map(item => (
            <div key={item.title} style={{ ...card, opacity: 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{item.title}</span>
                <Lock size={13} style={{ color: item.color, flexShrink: 0, marginTop: '2px' }} />
              </div>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Mini stats */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {[
          { label: 'Win rate', value: `${wl?.winRate ?? 0}%`, color: '#10b981' },
          { label: 'Avg close time', value: wl?.avgDaysToClose ? `${Math.round(wl.avgDaysToClose)}d` : '—', color: '#7c3aed' },
          { label: 'Avg won value', value: wl?.avgWonValue ? formatCurrency(Math.round(wl.avgWonValue)) : '—', color: 'white' },
          { label: 'Closed deals', value: String(totalDeals), color: 'rgba(255,255,255,0.6)' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '12px 16px', minWidth: '110px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Feature importance + objection handling */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        {winFactors.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <TrendingUp size={15} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Your Winning Formula</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {winFactors.map((f: any, i: number) => (
                <FactorBar key={i} label={f.name ?? f.label ?? f.feature} importance={f.importance} direction="helps" />
              ))}
            </div>
          </div>
        )}
        {lossFactors.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <TrendingDown size={15} style={{ color: '#ef4444' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Your Losing Pattern</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lossFactors.map((f: any, i: number) => (
                <FactorBar key={i} label={f.name ?? f.label ?? f.feature} importance={f.importance} direction="hurts" />
              ))}
            </div>
          </div>
        )}
        {objectionMap.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <BookOpen size={15} style={{ color: '#7c3aed' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Objection Effectiveness</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {objectionMap.slice(0, 5).map((obj: any, i: number) => {
                const wr = typeof obj.winRateWithTheme === 'number' ? Math.round(obj.winRateWithTheme) : null
                const color = wr != null ? (wr >= 60 ? '#10b981' : wr >= 40 ? '#f59e0b' : '#ef4444') : 'rgba(255,255,255,0.4)'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ flex: 1, fontSize: '12px', color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {obj.theme ?? `Objection ${i + 1}`}
                    </span>
                    {wr != null && <span style={{ fontSize: '11px', fontWeight: 700, color, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{wr}%</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {competitivePatterns.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <BarChart2 size={15} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Competitive Win Rates</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {competitivePatterns.slice(0, 5).map((p: any, i: number) => {
                const wr = typeof p.winRate === 'number' ? p.winRate : null
                const color = wr != null ? (wr >= 60 ? '#10b981' : wr >= 40 ? '#f59e0b' : '#ef4444') : 'rgba(255,255,255,0.4)'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ flex: 1, fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>vs {p.competitor}</span>
                    {wr != null && <span style={{ fontSize: '11px', fontWeight: 700, color, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{wr}% win</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
