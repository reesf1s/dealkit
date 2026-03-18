'use client'
export const dynamic = 'force-dynamic'

import useSWR from 'swr'
import Link from 'next/link'
import { BookOpen, TrendingUp, Target, AlertTriangle, ArrowUpRight, Users, Clock, Award } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ color: 'var(--accent)' }}>{icon}</div>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</h2>
          {subtitle && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function FactorRow({ rank, label, value, direction, detail }: { rank: number; label: string; value?: string | number; direction: 'positive' | 'negative' | 'neutral'; detail?: string }) {
  const rankColor = rank <= 2 ? 'var(--accent)' : 'var(--text-tertiary)'
  const lineColor = direction === 'positive' ? 'var(--success)' : direction === 'negative' ? 'var(--danger)' : 'var(--text-secondary)'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
      <div style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '6px', background: `color-mix(in srgb, ${rankColor} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${rankColor} 25%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: rankColor }}>
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: detail ? '4px' : 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{label}</div>
          {value != null && (
            <span style={{ fontSize: '11px', fontWeight: '700', color: lineColor, background: `color-mix(in srgb, ${lineColor} 10%, transparent)`, padding: '2px 7px', borderRadius: '100px' }}>
              {typeof value === 'number' ? `${value}%` : value}
            </span>
          )}
        </div>
        {detail && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{detail}</div>}
      </div>
    </div>
  )
}

export default function PlaybookPage() {
  const { data: brainRes, isLoading } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const brain = brainRes?.data

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '120px', borderRadius: '12px', background: 'var(--skeleton-from)' }} />
        ))}
      </div>
    )
  }

  const wl = brain?.winLossIntel
  const ml = brain?.mlModel
  const patterns: any[] = brain?.competitivePatterns ?? []
  const archetypes: any[] = brain?.dealArchetypes ?? []
  const objectionMap: any[] = brain?.objectionWinMap ?? []
  const stageVel = brain?.stageVelocityIntel
  const mlTrends = brain?.mlTrends

  // Feature importance — the "winning formula"
  const features: any[] = ml?.featureImportance
    ? [...ml.featureImportance].sort((a: any, b: any) => b.importance - a.importance)
    : []
  const winFactors = features.filter((f: any) => f.direction === 'helps').slice(0, 5)
  const lossFactors = features.filter((f: any) => f.direction === 'hurts').slice(0, 5)

  const totalDeals = (wl?.winCount ?? 0) + (wl?.lossCount ?? 0)
  const hasEnoughData = totalDeals >= 10 || winFactors.length > 0

  if (!hasEnoughData) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <BookOpen size={48} style={{ margin: '0 auto 16px', display: 'block', color: 'var(--text-tertiary)' }} />
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }} className="text-display">
          Your Playbook is Building
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 8px', lineHeight: 1.7 }}>
          The Win Playbook auto-generates from your closed deal history. Close at least 10 deals (wins + losses) to unlock your personalised playbook.
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', maxWidth: '400px', margin: '0 auto 28px' }}>
          Currently: {totalDeals} closed deals. {Math.max(0, 10 - totalDeals)} more needed.
        </p>
        <Link href="/pipeline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '10px', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
          Add Deals <ArrowUpRight size={14} />
        </Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', maxWidth: '800px' }}>

      {/* ── Header ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'color-mix(in srgb, var(--success) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={20} style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.1 }} className="text-display">
              Win Playbook
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Auto-generated from {totalDeals} closed deals · {wl?.winRate ?? 0}% win rate · Updates automatically
            </p>
          </div>
        </div>
      </div>

      {/* ── Win Stats Strip ── */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {[
          { label: 'Win rate', value: `${wl?.winRate ?? 0}%`, color: 'var(--success)' },
          { label: 'Avg close time', value: wl?.avgDaysToClose ? `${Math.round(wl.avgDaysToClose)}d` : '—', color: 'var(--data-accent)' },
          { label: 'Avg won value', value: wl?.avgWonValue ? `£${Math.round(wl.avgWonValue).toLocaleString()}` : '—', color: 'var(--accent)' },
          { label: 'Closed deals', value: String(totalDeals), color: 'var(--text-secondary)' },
        ].map(s => (
          <div key={s.label} style={{ padding: '12px 16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '10px', minWidth: '100px' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: s.color, lineHeight: 1 }} className="font-mono">{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Winning Formula ── */}
      {winFactors.length > 0 && (
        <Section
          icon={<TrendingUp size={18} />}
          title="Your Winning Formula"
          subtitle="Top signals that predict a won deal in your pipeline, ranked by ML feature importance"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {winFactors.map((f: any, i: number) => (
              <FactorRow
                key={i}
                rank={i + 1}
                label={f.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                value={`${(f.importance * 100).toFixed(1)}% weight`}
                direction="positive"
                detail={`When present, this factor strongly predicts a win. Importance: ${(f.importance * 100).toFixed(1)}% of model weight.`}
              />
            ))}
          </div>
        </Section>
      )}

      {/* ── Loss Pattern ── */}
      {lossFactors.length > 0 && (
        <Section
          icon={<AlertTriangle size={18} />}
          title="Loss Pattern"
          subtitle="Signals that most consistently predict a lost deal — watch for these as early warning signs"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lossFactors.map((f: any, i: number) => (
              <FactorRow
                key={i}
                rank={i + 1}
                label={f.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                value={`${(f.importance * 100).toFixed(1)}% weight`}
                direction="negative"
                detail={`When present, this factor increases loss probability. Importance: ${(f.importance * 100).toFixed(1)}% of model weight.`}
              />
            ))}
          </div>
          {wl?.topLossReasons && wl.topLossReasons.length > 0 && (
            <div style={{ padding: '14px 16px', background: 'color-mix(in srgb, var(--danger) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--danger)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top loss reasons from your deals</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {wl.topLossReasons.slice(0, 6).map((r: string, i: number) => (
                  <span key={i} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '100px', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)' }}>
                    {String(r)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── Per-Competitor Playbook ── */}
      {patterns.length > 0 && (
        <Section
          icon={<Target size={18} />}
          title="Competitive Playbook"
          subtitle="Specific conditions under which you win or lose against each competitor — derived from ML analysis"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {patterns.map((p: any, i: number) => {
              const winColor = p.winRate >= 60 ? 'var(--success)' : p.winRate >= 40 ? 'var(--warning)' : 'var(--danger)'
              return (
                <div key={i} style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>vs {p.competitor}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{p.totalDeals} deals</div>
                      <div style={{ fontSize: '22px', fontWeight: '800', color: winColor }} className="font-mono">{p.winRate}%</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ padding: '10px 12px', background: 'color-mix(in srgb, var(--success) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 15%, transparent)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>You win when</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{String(p.topWinCondition)}</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'color-mix(in srgb, var(--danger) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>You lose when</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{String(p.topLossRisk)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ textAlign: 'right' }}>
            <Link href="/competitors" style={{ fontSize: '12px', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
              View full competitive intel <ArrowUpRight size={11} />
            </Link>
          </div>
        </Section>
      )}

      {/* ── Deal Archetypes ── */}
      {archetypes.length > 0 && (
        <Section
          icon={<Award size={18} />}
          title="Deal Archetypes"
          subtitle="Natural deal patterns discovered by ML — each type has distinct close velocity and win conditions"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {archetypes.sort((a: any, b: any) => b.winRate - a.winRate).map((a: any, i: number) => {
              const winColor = a.winRate >= 60 ? 'var(--success)' : a.winRate >= 40 ? 'var(--warning)' : 'var(--danger)'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                  <div style={{ flexShrink: 0, width: '48px', height: '48px', borderRadius: '10px', background: `color-mix(in srgb, ${winColor} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${winColor} 20%, transparent)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: winColor, lineHeight: 1 }} className="font-mono">{a.winRate}%</div>
                    <div style={{ fontSize: '9px', color: winColor, marginTop: '1px' }}>win</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>{a.label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{String(a.winningCharacteristic)}</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--border)', padding: '2px 7px', borderRadius: '4px' }}>{a.dealCount} closed deals</span>
                      {a.openDealIds?.length > 0 && <span style={{ fontSize: '10px', color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '2px 7px', borderRadius: '4px' }}>{a.openDealIds.length} active</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* ── Objection Intelligence ── */}
      {objectionMap.length > 0 && (
        <Section
          icon={<Users size={18} />}
          title="Objection Response Effectiveness"
          subtitle="Risk themes your team handles well — objections that appeared in deals you still won"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {objectionMap.slice(0, 6).map((o: any, i: number) => {
              const winColor = (o.winRateWithTheme ?? o.winRate ?? 0) >= 60 ? 'var(--success)' : (o.winRateWithTheme ?? o.winRate ?? 0) >= 40 ? 'var(--warning)' : 'var(--danger)'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{String(o.theme ?? o.risk ?? o.objection ?? `Objection ${i + 1}`)}</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: winColor }} className="font-mono">{o.winRateWithTheme ?? o.winRate ?? 0}% win rate</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{o.dealsWithTheme ?? o.count ?? o.dealCount ?? '—'} deals</div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* ── Optimal Velocity ── */}
      {(stageVel || mlTrends?.dealVelocity) && (
        <Section
          icon={<Clock size={18} />}
          title="Optimal Deal Velocity"
          subtitle="Stage-by-stage timing benchmarks derived from your won deals"
        >
          <div style={{ padding: '16px 20px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px' }}>
            {stageVel && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {mlTrends?.dealVelocity && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Median days to close</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Based on your win history</div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--data-accent)' }} className="font-mono">
                      {Math.round(stageVel.medianDaysToClose ?? mlTrends.dealVelocity.recentAvgDays)}d
                    </div>
                  </div>
                )}
                {stageVel.stageAlerts?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Deals currently outside the optimal window:</div>
                    {stageVel.stageAlerts.slice(0, 3).map((a: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                        <AlertTriangle size={12} style={{ color: a.severity === 'critical' ? 'var(--danger)' : 'var(--warning)', flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)' }}>{a.company}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{a.stage} · {a.currentAgeDays}d / {a.expectedMaxDays}d max</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

    </div>
  )
}
