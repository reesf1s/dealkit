'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import { AlertTriangle, CheckCircle, Clock, Package, ChevronDown, ChevronUp } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function WinRateDeltaBar({ withGap, withoutGap }: { withGap: number; withoutGap: number }) {
  const maxVal = Math.max(withGap, withoutGap, 80)
  const delta = withoutGap - withGap
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', width: '60px', flexShrink: 0 }}>Without gap</div>
        <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(withoutGap / maxVal) * 100}%`, background: 'var(--success)', borderRadius: '3px', transition: 'width 0.5s' }} />
        </div>
        <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--success)', width: '28px' }}>{Math.round(withoutGap)}%</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', width: '60px', flexShrink: 0 }}>With gap</div>
        <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(withGap / maxVal) * 100}%`, background: delta >= 20 ? 'var(--danger)' : delta >= 10 ? 'var(--warning)' : 'var(--text-tertiary)', borderRadius: '3px', transition: 'width 0.5s' }} />
        </div>
        <div style={{ fontSize: '10px', fontWeight: '700', color: delta >= 20 ? 'var(--danger)' : delta >= 10 ? 'var(--warning)' : 'var(--text-secondary)', width: '28px' }}>{Math.round(withGap)}%</div>
      </div>
    </div>
  )
}

type GapStatus = 'open' | 'on_roadmap' | 'shipped'

const statusConfig: Record<GapStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  open:       { label: 'Open',        color: 'var(--danger)',  bg: 'color-mix(in srgb, var(--danger) 10%, transparent)',   icon: <AlertTriangle size={10} /> },
  on_roadmap: { label: 'On Roadmap',  color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 10%, transparent)', icon: <Clock size={10} /> },
  shipped:    { label: 'Shipped',     color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 10%, transparent)', icon: <CheckCircle size={10} /> },
}

export default function ProductGapsPage() {
  const { data: brainRes } = useSWR('/api/brain', fetcher, { revalidateOnFocus: false })
  const { data: gapsRes, mutate: mutateGaps } = useSWR('/api/product-gaps', fetcher)
  const brain = brainRes?.data
  const [sortBy, setSortBy] = useState<'revenue' | 'frequency' | 'delta'>('revenue')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Normalise stored gaps — API may return array or { data: array }
  const storedGaps: any[] = Array.isArray(gapsRes) ? gapsRes : (Array.isArray(gapsRes?.data) ? gapsRes.data : [])
  const brainGaps: any[] = brain?.productGapPriority ?? []

  // Build enriched gap list combining stored gaps with brain analytics
  const enrichedGaps = storedGaps.map((gap: any) => {
    const brainGap = brainGaps.find((bg: any) => bg.gapId === gap.id || bg.title === gap.title)
    return {
      ...gap,
      revenueAtRisk:    brainGap?.revenueAtRisk    ?? gap.revenueAtRisk    ?? 0,
      frequency:        brainGap?.dealsBlocked      ?? gap.frequency        ?? 0,
      winRateWithGap:   brainGap?.winRateWithGap    ?? null,
      winRateWithoutGap:brainGap?.winRateWithoutGap ?? null,
      delta: (brainGap?.winRateWithoutGap ?? 0) - (brainGap?.winRateWithGap ?? 0),
    }
  })

  // Also surface brain-only gaps that have no stored counterpart
  for (const bg of brainGaps) {
    const alreadyPresent = enrichedGaps.some((g: any) => g.id === bg.gapId || g.title === bg.title)
    if (!alreadyPresent && bg.title) {
      enrichedGaps.push({
        id:               bg.gapId ?? `brain-${bg.title}`,
        title:            bg.title,
        description:      bg.description ?? '',
        status:           bg.status ?? 'open',
        revenueAtRisk:    bg.revenueAtRisk    ?? 0,
        frequency:        bg.dealsBlocked     ?? 0,
        winRateWithGap:   bg.winRateWithGap   ?? null,
        winRateWithoutGap:bg.winRateWithoutGap ?? null,
        delta: (bg.winRateWithoutGap ?? 0) - (bg.winRateWithGap ?? 0),
      })
    }
  }

  const sorted = [...enrichedGaps].sort((a, b) => {
    if (sortBy === 'revenue')    return b.revenueAtRisk - a.revenueAtRisk
    if (sortBy === 'frequency')  return b.frequency - a.frequency
    return b.delta - a.delta
  })

  const totalRevRisk = enrichedGaps.reduce((s, g) => s + (g.revenueAtRisk ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '960px' }}>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'color-mix(in srgb, var(--warning) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={18} style={{ color: 'var(--warning)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '700', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
              Product Gaps
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Feature gaps extracted from deal notes — ranked by revenue at risk
            </p>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      {totalRevRisk > 0 && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ padding: '12px 16px', background: 'color-mix(in srgb, var(--danger) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)', borderRadius: '10px' }}>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--danger)', lineHeight: 1 }}>£{Math.round(totalRevRisk / 1000)}k</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>Total revenue at risk</div>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '10px' }}>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>{enrichedGaps.filter(g => g.status === 'open').length}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>Open gaps</div>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '10px' }}>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--warning)', lineHeight: 1 }}>{enrichedGaps.filter(g => g.status === 'on_roadmap').length}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>On roadmap</div>
          </div>
        </div>
      )}

      {/* Sort controls */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginRight: '4px' }}>Sort by:</div>
        {(['revenue', 'Revenue at risk'] as const).map ? null : null}
        {(
          [
            ['revenue',   'Revenue at risk'] as const,
            ['delta',     'Win rate impact'] as const,
            ['frequency', 'Frequency']       as const,
          ] as Array<['revenue' | 'frequency' | 'delta', string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            style={{
              padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', cursor: 'pointer',
              border: '1px solid', transition: 'all 0.12s',
              background:   sortBy === key ? 'var(--accent)'          : 'var(--surface)',
              color:        sortBy === key ? '#fff'                   : 'var(--text-secondary)',
              borderColor:  sortBy === key ? 'var(--accent)'          : 'var(--border)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Gap list */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
          <Package size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
          <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>No product gaps tracked yet</div>
          <div style={{ fontSize: '13px' }}>Gaps are auto-extracted from deal meeting notes as you log conversations.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sorted.map((gap: any, idx: number) => {
            const statusKey = (gap.status ?? 'open') as GapStatus
            const status = statusConfig[statusKey] ?? statusConfig.open
            const isExpanded = expandedId === gap.id
            const hasWinRateData = gap.winRateWithGap != null && gap.winRateWithoutGap != null
            const revRisk = gap.revenueAtRisk ?? 0

            return (
              <div
                key={gap.id}
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', overflow: 'hidden', transition: 'box-shadow 0.15s' }}
              >
                {/* Main row */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : gap.id)}
                >
                  {/* Rank */}
                  <div style={{
                    flexShrink: 0, width: '28px', height: '28px', borderRadius: '7px',
                    background: idx < 3 ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : 'var(--surface)',
                    border: `1px solid ${idx < 3 ? 'color-mix(in srgb, var(--danger) 20%, transparent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: '700',
                    color: idx < 3 ? 'var(--danger)' : 'var(--text-tertiary)',
                  }}>
                    {idx + 1}
                  </div>

                  {/* Title + status badge */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {gap.title ?? 'Unnamed gap'}
                      </div>
                      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '100px', color: status.color, background: status.bg }}>
                        {status.icon} {status.label}
                      </div>
                    </div>
                    {gap.description && !isExpanded && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {gap.description}
                      </div>
                    )}
                  </div>

                  {/* Win rate delta visual */}
                  {hasWinRateData && (
                    <div style={{ flexShrink: 0 }}>
                      <WinRateDeltaBar withGap={gap.winRateWithGap} withoutGap={gap.winRateWithoutGap} />
                    </div>
                  )}

                  {/* Revenue at risk + frequency */}
                  <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '70px' }}>
                    {revRisk > 0 && (
                      <>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--danger)', lineHeight: 1 }}>
                          £{revRisk >= 1000 ? `${(revRisk / 1000).toFixed(0)}k` : revRisk}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>at risk</div>
                      </>
                    )}
                    {gap.frequency > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: revRisk > 0 ? '4px' : 0 }}>{gap.frequency}× mentioned</div>
                    )}
                  </div>

                  {/* Expand arrow */}
                  <div style={{ flexShrink: 0, color: 'var(--text-tertiary)' }}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ paddingTop: '12px' }}>
                      {gap.description && (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
                          {gap.description}
                        </div>
                      )}
                      {hasWinRateData && (
                        <div style={{ padding: '12px 14px', background: 'color-mix(in srgb, var(--danger) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 15%, transparent)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--danger)', marginBottom: '4px' }}>
                            Win rate drops {Math.round(gap.delta)}pp when this gap is present
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {Math.round(gap.winRateWithoutGap)}% win rate on deals without this gap → {Math.round(gap.winRateWithGap)}% with this gap
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status change buttons — only for gaps that exist in the DB (have a real id) */}
                    {!String(gap.id).startsWith('brain-') && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', alignSelf: 'center' }}>Status:</div>
                        {(['open', 'on_roadmap', 'shipped'] as GapStatus[]).map(s => (
                          <button
                            key={s}
                            onClick={async (e) => {
                              e.stopPropagation()
                              await fetch(`/api/product-gaps/${gap.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: s }),
                              })
                              mutateGaps()
                            }}
                            style={{
                              padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer',
                              border: '1px solid', transition: 'all 0.12s',
                              background:   (gap.status ?? 'open') === s ? statusConfig[s].bg      : 'var(--surface)',
                              color:        (gap.status ?? 'open') === s ? statusConfig[s].color   : 'var(--text-secondary)',
                              borderColor:  (gap.status ?? 'open') === s ? statusConfig[s].color   : 'var(--border)',
                            }}
                          >
                            {statusConfig[s].label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
