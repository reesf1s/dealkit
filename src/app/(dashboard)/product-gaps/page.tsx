'use client'
export const dynamic = 'force-dynamic'

import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { useState } from 'react'
import { AlertTriangle, TrendingUp, CheckCircle, Circle, Clock, Zap, DollarSign, Trash2, X, Swords, BookOpen } from 'lucide-react'
import { PageTabs } from '@/components/shared/PageTabs'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: 'var(--danger)', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', label: 'Critical' },
  high:     { color: 'var(--warning)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', label: 'High' },
  medium:   { color: 'var(--accent)', bg: 'var(--accent-subtle)', border: 'rgba(99,102,241,0.2)', label: 'Medium' },
  low:      { color: 'var(--text-tertiary)', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', label: 'Low' },
}

const ROADMAP_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  now:  { color: 'var(--success)', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)',  label: 'Now' },
  next: { color: 'var(--accent)', bg: 'var(--accent-subtle)', border: 'rgba(99,102,241,0.2)', label: 'Next' },
  later:{ color: 'var(--text-tertiary)', bg: 'rgba(107,114,128,0.08)',border: 'rgba(107,114,128,0.2)',label: 'Later' },
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  open:        { color: 'var(--danger)', icon: Circle, label: 'Open' },
  in_review:   { color: 'var(--warning)', icon: Clock, label: 'In Review' },
  on_roadmap:  { color: 'var(--accent)', icon: TrendingUp, label: 'On Roadmap' },
  wont_fix:    { color: 'var(--text-tertiary)', icon: CheckCircle, label: "Won't Fix" },
  shipped:     { color: 'var(--success)', icon: CheckCircle, label: 'Shipped' },
}

export default function ProductGapsPage() {
  const { data: gapsRaw, isLoading } = useSWR('/api/product-gaps', fetcher)
  const gaps: any[] = Array.isArray(gapsRaw) ? gapsRaw : (Array.isArray(gapsRaw?.data) ? gapsRaw.data : [])
  const [statusFilter, setStatusFilter] = useState<string>('open')
  // delete flow: { [gapId]: 'idle' | 'confirming' | 'deleting' }
  const [deleteState, setDeleteState] = useState<Record<string, string>>({})
  const [deleteReasons, setDeleteReasons] = useState<Record<string, string>>({})

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/product-gaps/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    mutate('/api/product-gaps')
  }

  const updateRoadmap = async (id: string, roadmap: string | null) => {
    await fetch(`/api/product-gaps/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roadmap }),
    })
    mutate('/api/product-gaps')
  }

  const startDelete = (id: string) => {
    setDeleteState(s => ({ ...s, [id]: 'confirming' }))
  }

  const cancelDelete = (id: string) => {
    setDeleteState(s => ({ ...s, [id]: 'idle' }))
    setDeleteReasons(r => ({ ...r, [id]: '' }))
  }

  const confirmDelete = async (id: string) => {
    setDeleteState(s => ({ ...s, [id]: 'deleting' }))
    const reason = deleteReasons[id]?.trim() || undefined
    await fetch(`/api/product-gaps/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    mutate('/api/product-gaps')
  }

  const filtered = gaps.filter((g: any) => statusFilter === 'all' || g.status === statusFilter)
  const openCount = gaps.filter((g: any) => g.status === 'open').length
  const criticalCount = gaps.filter((g: any) => g.priority === 'critical' && g.status === 'open').length
  const totalRevAtRisk = gaps
    .filter((g: any) => g.status === 'open' && g.affectedRevenue)
    .reduce((s: number, g: any) => s + g.affectedRevenue, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Intelligence tabs */}
      <PageTabs tabs={[
        { label: 'Competitors',  href: '/competitors',  icon: Swords        },
        { label: 'Case Studies', href: '/case-studies', icon: BookOpen      },
        { label: 'Feature Gaps', href: '/product-gaps', icon: AlertTriangle },
      ]} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ width: '32px', height: '32px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={15} color="var(--warning)" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0 }}>
              Feature Gaps
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', paddingLeft: '42px' }}>
            From sales calls — share patterns with your product team
          </p>
        </div>
        <Link href="/deals" style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', textDecoration: 'none',
        }}>
          <Zap size={13} /> Auto-detect from deals
        </Link>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
        {[
          { label: 'Open Gaps', value: openCount, color: '#EF4444', icon: AlertTriangle },
          { label: 'Critical', value: criticalCount, color: '#F59E0B', icon: TrendingUp },
          { label: 'Revenue at Risk', value: totalRevAtRisk > 0 ? `$${(totalRevAtRisk/100).toLocaleString()}` : '—', color: '#6366F1', icon: DollarSign },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: 'var(--surface)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: `radial-gradient(circle at top right, ${color}15, transparent)`, pointerEvents: 'none' }} />
            <div style={{ width: '32px', height: '32px', background: `${color}15`, border: `1px solid ${color}25`, borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <Icon size={14} color={color} />
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'open', label: 'Open' },
          { id: 'in_review', label: 'In Review' },
          { id: 'on_roadmap', label: 'On Roadmap' },
          { id: 'shipped', label: 'Shipped' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setStatusFilter(tab.id)} style={{
            padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
            background: statusFilter === tab.id ? 'var(--accent-subtle)' : 'var(--surface)',
            color: statusFilter === tab.id ? 'var(--accent)' : 'var(--text-tertiary)',
            transition: 'all 0.1s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Gaps list */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)', fontSize: '13px' }}>Loading product gaps...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px' }}>
          <div style={{ width: '52px', height: '52px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <AlertTriangle size={20} color="var(--accent)" />
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
            {statusFilter === 'open' ? 'No open product gaps' : `No ${statusFilter.replace('_', ' ')} gaps`}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
            Gaps are automatically detected when you analyze meeting notes in a deal
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((gap: any) => {
            const pCfg = PRIORITY_CONFIG[gap.priority] ?? PRIORITY_CONFIG.medium
            const sCfg = STATUS_CONFIG[gap.status] ?? STATUS_CONFIG.open
            const StatusIcon = sCfg.icon
            return (
              <div key={gap.id} style={{
                background: 'var(--card-bg)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--card-border)',
                borderRadius: '12px', padding: '18px',
                borderLeft: `3px solid ${pCfg.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{gap.title}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '100px', background: pCfg.bg, color: pCfg.color, border: `1px solid ${pCfg.border}`, fontWeight: '600' }}>
                        {pCfg.label}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '2px 8px', borderRadius: '100px', background: 'var(--surface)', color: sCfg.color, border: '1px solid var(--border)' }}>
                        <StatusIcon size={10} />
                        {sCfg.label}
                      </span>
                      {gap.roadmap && ROADMAP_CONFIG[gap.roadmap] && (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '100px', background: ROADMAP_CONFIG[gap.roadmap].bg, color: ROADMAP_CONFIG[gap.roadmap].color, border: `1px solid ${ROADMAP_CONFIG[gap.roadmap].border}`, fontWeight: '600' }}>
                          {ROADMAP_CONFIG[gap.roadmap].label}
                        </span>
                      )}
                      {gap.frequency > 1 && (
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <TrendingUp size={10} /> {gap.frequency} deals
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>{gap.description}</p>
                    {gap.suggestedFix && (
                      <div style={{ marginTop: '10px', padding: '10px 12px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: '8px', display: 'flex', gap: '8px' }}>
                        <Zap size={12} color="var(--accent)" style={{ flexShrink: 0, marginTop: '1px' }} />
                        <span style={{ fontSize: '12px', color: 'var(--accent)', lineHeight: '1.5' }}>
                          <strong>Suggested fix:</strong> {gap.suggestedFix}
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {gap.affectedRevenue > 0 && (
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <DollarSign size={12} />{(gap.affectedRevenue / 100).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status actions + delete */}
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                  {deleteState[gap.id] !== 'confirming' && deleteState[gap.id] !== 'deleting' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Roadmap position */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>Roadmap:</span>
                        {(['now', 'next', 'later'] as const).map(r => {
                          const cfg = ROADMAP_CONFIG[r]
                          const active = gap.roadmap === r
                          return (
                            <button key={r} onClick={() => updateRoadmap(gap.id, active ? null : r)} style={{
                              padding: '3px 10px', borderRadius: '6px', border: `1px solid ${active ? cfg.border : 'var(--border)'}`,
                              background: active ? cfg.bg : 'var(--surface)',
                              color: active ? cfg.color : 'var(--text-tertiary)', fontSize: '11px', cursor: 'pointer', fontWeight: active ? '600' : '500',
                              transition: 'all 0.1s',
                            }}>
                              {cfg.label}
                            </button>
                          )
                        })}
                      </div>
                      {/* Status transitions */}
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {Object.entries(STATUS_CONFIG).map(([sid, cfg]) => sid !== gap.status && (
                        <button key={sid} onClick={() => updateStatus(gap.id, sid)} style={{
                          padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)',
                          background: 'var(--surface)', color: 'var(--text-tertiary)', fontSize: '11px', cursor: 'pointer', fontWeight: '500',
                          transition: 'all 0.1s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = cfg.color; (e.currentTarget as HTMLElement).style.borderColor = cfg.color + '40' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                        >
                          → {cfg.label}
                        </button>
                      ))}
                      <button
                        onClick={() => startDelete(gap.id)}
                        title="Delete gap"
                        style={{ marginLeft: 'auto', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-tertiary)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.1s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.3)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Why is this not a real gap? <span style={{ color: 'var(--text-tertiary)' }}>(optional — helps the AI learn)</span>
                      </div>
                      <input
                        autoFocus
                        type="text"
                        value={deleteReasons[gap.id] ?? ''}
                        onChange={e => setDeleteReasons(r => ({ ...r, [gap.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') confirmDelete(gap.id); if (e.key === 'Escape') cancelDelete(gap.id) }}
                        placeholder="e.g. We support CAD import natively — prospect was unaware"
                        style={{
                          width: '100%', height: '34px', padding: '0 10px', borderRadius: '7px', boxSizing: 'border-box',
                          background: 'var(--surface)', border: '1px solid var(--border-strong)',
                          color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'inherit',
                        }}
                        onFocus={e => (e.target.style.borderColor = 'rgba(239,68,68,0.4)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => confirmDelete(gap.id)}
                          disabled={deleteState[gap.id] === 'deleting'}
                          style={{ padding: '5px 14px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' } as React.CSSProperties}
                        >
                          {deleteState[gap.id] === 'deleting' ? 'Deleting…' : 'Confirm delete'}
                        </button>
                        <button
                          onClick={() => cancelDelete(gap.id)}
                          style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-tertiary)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <X size={11} /> Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
