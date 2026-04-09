'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import { TrendingUp, TrendingDown, BookOpen, BarChart2, Lock } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { fetcher } from '@/lib/fetcher'

function FactorBar({ label, importance, direction }: { label: string; importance: number; direction: string }) {
  const color = direction === 'helps' ? '#0f7b6c' : '#e03e3e'
  const pct = Math.min(100, importance * 100 * 5)
  const trackBg = direction === 'helps' ? 'rgba(15,123,108,0.12)' : 'rgba(224,62,62,0.12)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#787774' }}>{label}</span>
        <span style={{ fontSize: '11px', color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{(importance * 100).toFixed(1)}%</span>
      </div>
      <div style={{ height: '3px', borderRadius: '2px', background: trackBg, overflow: 'hidden' }}>
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
  const hasEnoughData = totalDeals >= 3 || winFactors.length > 0

  const card: React.CSSProperties = {
    background: 'var(--surface-1)',
    border: '1px solid rgba(55,53,47,0.12)',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(55,53,47,0.06)',
    padding: '24px',
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[1, 2, 3].map(i => <div key={i} style={{ height: '80px', borderRadius: '8px' }} className="skeleton" />)}
      </div>
    )
  }

  if (!hasEnoughData) {
    const needed = Math.max(0, 3 - totalDeals)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Building your playbook…</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1DB86A' }}>{totalDeals} / 3</span>
          </div>
          <div style={{ width: '100%', height: '6px', borderRadius: '100px', background: 'rgba(55,53,47,0.09)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (totalDeals / 3) * 100)}%`, background: '#1DB86A', borderRadius: '100px' }} />
          </div>
          <p style={{ fontSize: '12px', color: '#9b9a97', marginTop: '8px', lineHeight: 1.6 }}>
            {needed > 0 ? `${needed} more closed deal${needed !== 1 ? 's' : ''} needed to activate your playbook.` : 'Almost there — close more deals to unlock full analysis.'}
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {[
            { title: 'Your Winning Formula', desc: 'Top 5 signals that predict a won deal.', color: '#0f7b6c' },
            { title: 'Your Losing Pattern', desc: 'Top 5 signals that predict a lost deal.', color: '#e03e3e' },
            { title: 'Per-Competitor Playbook', desc: 'Win conditions vs each rival.', color: '#cb6c2c' },
            { title: 'Objection Effectiveness', desc: 'Which objections your team handles well.', color: '#5e6ad2' },
          ].map(item => (
            <div key={item.title} style={{ ...card, opacity: 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>
                <Lock size={13} style={{ color: item.color, flexShrink: 0, marginTop: '2px' }} />
              </div>
              <p style={{ fontSize: '12px', color: '#9b9a97', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
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
          { label: 'Win rate', value: `${Math.round((wl?.winRate ?? 0) * 100)}%`, color: '#0f7b6c' },
          { label: 'Avg close time', value: wl?.avgDaysToClose ? `${Math.round(wl.avgDaysToClose)}d` : '—', color: '#5e6ad2' },
          { label: 'Avg won value', value: wl?.avgWonValue ? formatCurrency(Math.round(wl.avgWonValue)) : '—', color: 'var(--text-primary)' },
          { label: 'Closed deals', value: String(totalDeals), color: '#787774' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '12px 16px', minWidth: '110px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: s.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: '#9b9a97', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Feature importance + objection handling */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        {winFactors.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <TrendingUp size={15} style={{ color: '#0f7b6c' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Your Winning Formula</span>
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
              <TrendingDown size={15} style={{ color: '#e03e3e' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Your Losing Pattern</span>
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
              <BookOpen size={15} style={{ color: '#5e6ad2' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Objection Effectiveness</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {objectionMap.slice(0, 5).map((obj: any, i: number) => {
                const wr = typeof obj.winRateWithTheme === 'number' ? Math.round(obj.winRateWithTheme) : null
                const color = wr != null ? (wr >= 60 ? '#0f7b6c' : wr >= 40 ? '#cb6c2c' : '#e03e3e') : '#9b9a97'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ flex: 1, fontSize: '12px', color: '#787774', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              <BarChart2 size={15} style={{ color: '#cb6c2c' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Competitive Win Rates</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {competitivePatterns.slice(0, 5).map((p: any, i: number) => {
                const wr = typeof p.winRate === 'number' ? p.winRate : null
                const color = wr != null ? (wr >= 60 ? '#0f7b6c' : wr >= 40 ? '#cb6c2c' : '#e03e3e') : '#9b9a97'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ flex: 1, fontSize: '12px', color: '#787774' }}>vs {p.competitor}</span>
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
