'use client'
export const dynamic = 'force-dynamic'

import useSWR, { mutate as globalMutate } from 'swr'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowLeft, Sparkles, CheckSquare, Square, Plus, Target, Loader2,
  FileText, Clipboard, ChevronDown, TrendingUp, DollarSign, Calendar,
  Building2, User, Edit, Trash2, MoreHorizontal, CheckCircle, X, Link2, Check
} from 'lucide-react'
import type { DealContact } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const STAGE_COLORS: Record<string, string> = {
  prospecting: '#6B7280', qualification: '#3B82F6', discovery: '#8B5CF6',
  proposal: '#F59E0B', negotiation: '#EF4444', closed_won: '#22C55E', closed_lost: '#6B7280',
}

function MeetingNotesTab({ dealId, deal, onUpdate }: { dealId: string; deal: any; onUpdate: () => void }) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [historyExpanded, setHistoryExpanded] = useState(false)

  const analyze = async () => {
    if (!notes.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/analyze-notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingNotes: notes }),
      })
      const data = await res.json()
      setResult(data.data)
      setNotes('')
      setHistoryExpanded(true) // auto-show updated history
      onUpdate()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Previous meeting history */}
      {deal?.meetingNotes && (() => {
        // Parse compact entries: lines starting with [date] are individual meetings
        const lines = (deal.meetingNotes as string).split('\n').filter((l: string) => l.trim())
        const entries = lines.filter((l: string) => /^\[\d/.test(l))
        const legacy = lines.filter((l: string) => !/^\[\d/.test(l))
        return (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px' }}>
            <button
              onClick={() => setHistoryExpanded(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clipboard size={13} color="#888" />
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#888' }}>Meeting History</span>
                <span style={{ fontSize: '11px', color: '#444', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '1px 6px' }}>
                  {entries.length > 0 ? `${entries.length} meeting${entries.length > 1 ? 's' : ''}` : 'legacy notes'}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#555' }}>{historyExpanded ? 'Hide ↑' : 'Show ↓'}</span>
            </button>
            {historyExpanded && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
                {entries.length > 0 ? entries.map((entry: string, i: number) => {
                  const dateMatch = entry.match(/^\[([^\]]+)\]/)
                  const date = dateMatch?.[1] ?? ''
                  const body = entry.slice(dateMatch?.[0].length ?? 0).trim()
                  return (
                    <div key={i} style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#555', letterSpacing: '0.04em', marginBottom: '4px', textTransform: 'uppercase' }}>{date}</div>
                      <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.6 }}>{body}</div>
                    </div>
                  )
                }) : (
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12px', color: '#666', lineHeight: '1.7', margin: 0 }}>
                    {legacy.join('\n')}
                  </pre>
                )}
              </div>
            )}
          </div>
        )
      })()}

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clipboard size={14} color="#818CF8" />
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#EBEBEB' }}>
              {deal?.meetingNotes ? 'New Meeting Notes' : 'Meeting Notes'}
            </span>
          </div>
          <button onClick={analyze} disabled={loading || !notes.trim()} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
            background: loading ? 'rgba(99,102,241,0.2)' : 'linear-gradient(135deg, #6366F1, #7C3AED)',
            boxShadow: loading ? 'none' : '0 0 16px rgba(99,102,241,0.3)',
            border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600',
            cursor: loading || !notes.trim() ? 'not-allowed' : 'pointer',
          }}>
            {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
            {loading ? 'Analyzing...' : 'Analyze with AI'}
          </button>
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={deal?.meetingNotes
            ? 'Paste notes from your latest meeting — AI will analyze these in context of all previous meetings...'
            : 'Paste your meeting notes here — AI will extract action items, score conversion probability, and identify product gaps...'}
          rows={10}
          style={{
            width: '100%', resize: 'vertical', background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px',
            color: '#EBEBEB', fontSize: '13px', lineHeight: '1.6', padding: '12px',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
          onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)'}
          onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}
        />
      </div>

      {/* AI Results */}
      {(result || deal?.aiSummary) && (
        <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Sparkles size={14} color="#818CF8" />
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#818CF8' }}>AI Analysis</span>
            {deal?.conversionScore != null && (
              <span style={{ marginLeft: 'auto', fontSize: '20px', fontWeight: '800', color: deal.conversionScore >= 70 ? '#22C55E' : deal.conversionScore >= 40 ? '#F59E0B' : '#EF4444' }}>
                {deal.conversionScore}%
              </span>
            )}
          </div>
          {deal?.aiSummary && (
            <p style={{ fontSize: '13px', color: '#888', lineHeight: '1.6', margin: '0 0 12px' }}>{deal.aiSummary}</p>
          )}
          {deal?.conversionInsights?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(deal.conversionInsights as string[]).map((insight: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: '#888' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6366F1', flexShrink: 0, marginTop: '5px' }} />
                  {insight}
                </div>
              ))}
            </div>
          )}
          {/* Deal Risks — use freshest source: result.deal first, fall back to SWR deal */}
          {(() => {
            const risks: string[] = result?.deal?.dealRisks ?? deal?.dealRisks ?? []
            if (!risks.length) return null
            return (
              <div style={{ marginTop: '12px', padding: '12px 14px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#F59E0B', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ⚠ Deal Risks
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {risks.map((risk: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: '#C9820A' }}>
                      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0, marginTop: '5px' }} />
                      {risk}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {result?.productGaps?.length > 0 && (
            <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#EF4444', fontWeight: '600', marginBottom: '4px' }}>
                {result.productGaps.length} product gap{result.productGaps.length > 1 ? 's' : ''} detected
              </div>
              {result.productGaps.map((g: any) => (
                <div key={g.id} style={{ fontSize: '12px', color: '#888', marginTop: '3px' }}>• {g.title}</div>
              ))}
              <Link href="/product-gaps" style={{ fontSize: '11px', color: '#EF4444', textDecoration: 'none', display: 'inline-block', marginTop: '6px' }}>
                View in Product Gaps →
              </Link>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const STAGE_PLAYBOOK: Record<string, string[]> = {
  prospecting: [
    'Research recent news, funding rounds, and pain signals for this prospect',
    'Personalise your opening to their specific role and company context',
    'Focus on creating curiosity — avoid feature-dumping',
    'Goal: qualify fit and book a discovery call',
  ],
  qualification: [
    'Validate BANT: Budget, Authority, Need, and Timeline',
    'Ask who else is involved in the decision',
    'Identify current solution and what\'s driving them to look now',
    'Disqualify early and gracefully if not a genuine fit',
  ],
  discovery: [
    'Lead with open-ended questions — let them talk 70% of the time',
    'Map stakeholders, champions, and blockers',
    'Uncover the emotional cost of their problem, not just the functional one',
    'Confirm budget range and decision timeline before closing the call',
  ],
  proposal: [
    'Open by recapping their stated pains — show you were listening',
    'Lead with outcomes and ROI, then features as proof points',
    'Pre-handle likely objections before they surface',
    'Include a relevant win story or case study as social proof',
    'End with a clear mutual success plan and next step',
  ],
  negotiation: [
    'Know your walk-away point before entering',
    'Anchor on business value, not product features',
    'Lead concessions with non-monetary value (onboarding, success hours)',
    'Create urgency with a mutual close plan tied to their deadline',
    'Never discount without getting something in return',
  ],
  closed_won: [
    'Kick off with a success handoff to CS / implementation',
    'Confirm agreed outcomes and success metrics in writing',
    'Set a 30/60/90 day check-in cadence',
    'Ask for a referral or case study while goodwill is high',
  ],
}

function MeetingPrepTab({ dealId, deal }: { dealId: string; deal: any }) {
  const [prep, setPrep] = useState('')
  const [loading, setLoading] = useState(false)
  const [fullBriefShown, setFullBriefShown] = useState(false)

  const { data: compRes } = useSWR('/api/competitors', fetcher)
  const { data: csRes } = useSWR('/api/case-studies', fetcher)
  const { data: profileRes } = useSWR('/api/company', fetcher)

  const allCompetitors: any[] = compRes?.data ?? []
  const allCaseStudies: any[] = csRes?.data ?? []
  const profile: any = profileRes?.data

  const dealCompNames: string[] = deal?.competitors ?? []
  const matchedCompetitors = allCompetitors.filter(c =>
    dealCompNames.some((n: string) =>
      c.name.toLowerCase().includes(n.toLowerCase()) ||
      n.toLowerCase().includes(c.name.toLowerCase()),
    ),
  )

  const dealRisks: string[] = deal?.dealRisks ?? []
  const commonObjections: string[] = profile?.commonObjections ?? []
  const stage: string = deal?.stage ?? 'discovery'
  const playbook = STAGE_PLAYBOOK[stage] ?? STAGE_PLAYBOOK.discovery

  const generateFullBrief = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/meeting-prep`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      const data = await res.json()
      setPrep(data.data?.prep ?? '')
      setFullBriefShown(true)
    } finally {
      setLoading(false)
    }
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px',
  }
  const sectionTitle = (label: string, color = '#888') => (
    <div style={{ fontSize: '11px', fontWeight: 700, color, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '10px' }}>
      {label}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Stage playbook */}
      <div style={cardStyle}>
        {sectionTitle(`${stage.replace('_', ' ')} Playbook`, '#6366F1')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {playbook.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '10px', fontWeight: 700, color: '#6366F1', marginTop: '1px' }}>
                {i + 1}
              </div>
              <span style={{ fontSize: '13px', color: '#B0B0B8', lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Competitive intel */}
      {matchedCompetitors.length > 0 && (
        <div style={cardStyle}>
          {sectionTitle('Competitive Intel', '#F59E0B')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {matchedCompetitors.map(comp => (
              <div key={comp.id}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#EBEBEB', marginBottom: '6px' }}>
                  vs {comp.name}
                </div>
                {(comp.weaknesses as string[])?.length > 0 && (
                  <div style={{ marginBottom: '5px' }}>
                    <span style={{ fontSize: '11px', color: '#22C55E', fontWeight: 600 }}>Their weaknesses: </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                      {(comp.weaknesses as string[]).slice(0, 3).map((w: string, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: '#888' }}>
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#22C55E', flexShrink: 0, marginTop: '5px' }} />
                          {w}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(comp.differentiators as string[])?.length > 0 && (
                  <div>
                    <span style={{ fontSize: '11px', color: '#818CF8', fontWeight: 600 }}>Your differentiators: </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                      {(comp.differentiators as string[]).slice(0, 3).map((d: string, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: '#888' }}>
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#6366F1', flexShrink: 0, marginTop: '5px' }} />
                          {d}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expected objections */}
      {(dealRisks.length > 0 || commonObjections.length > 0) && (
        <div style={cardStyle}>
          {sectionTitle('Likely Objections to Address', '#EF4444')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {dealRisks.map((risk, i) => (
              <div key={`risk-${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '8px 10px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '7px' }}>
                <span style={{ fontSize: '11px' }}>⚠</span>
                <span style={{ fontSize: '12px', color: '#C9820A', lineHeight: 1.5 }}>{risk}</span>
              </div>
            ))}
            {commonObjections.slice(0, 3).map((obj, i) => (
              <div key={`obj-${i}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: '#888' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#EF4444', flexShrink: 0, marginTop: '5px' }} />
                {obj}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relevant win stories */}
      {allCaseStudies.length > 0 && (
        <div style={cardStyle}>
          {sectionTitle('Win Stories to Reference', '#22C55E')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allCaseStudies.slice(0, 2).map((cs: any) => (
              <div key={cs.id} style={{ padding: '10px 12px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#EBEBEB', marginBottom: '3px' }}>{cs.customerName}</div>
                {cs.customerIndustry && <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>{cs.customerIndustry}{cs.customerSize ? ` · ${cs.customerSize}` : ''}</div>}
                <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.5 }}>{cs.results?.slice(0, 120)}{cs.results?.length > 120 ? '…' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI full brief */}
      {!fullBriefShown ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4px' }}>
          <button onClick={generateFullBrief} disabled={loading} style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px',
            background: loading ? 'rgba(99,102,241,0.15)' : 'linear-gradient(135deg, #6366F1, #7C3AED)',
            boxShadow: loading ? 'none' : '0 0 20px rgba(99,102,241,0.25)',
            border: loading ? '1px solid rgba(99,102,241,0.3)' : 'none',
            borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating full brief…</>
              : <><Sparkles size={14} /> Generate AI Full Brief</>}
          </button>
        </div>
      ) : (
        <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={14} color="#818CF8" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#EBEBEB' }}>AI Full Brief</span>
            </div>
            <button onClick={generateFullBrief} disabled={loading} style={{ fontSize: '12px', color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}>
              {loading ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>
          <div style={{ fontSize: '13px', color: '#888', lineHeight: '1.8' }}>
            {prep.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <div key={i} style={{ fontSize: '11px', fontWeight: 700, color: '#818CF8', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: i === 0 ? 0 : '16px', marginBottom: '6px' }}>{line.slice(3)}</div>
              if (line.startsWith('- ')) return <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '4px' }}><span style={{ color: '#6366F1', flexShrink: 0, marginTop: '2px' }}>·</span><span>{line.slice(2)}</span></div>
              if (line.trim() === '') return <div key={i} style={{ height: '4px' }} />
              return <div key={i} style={{ marginBottom: '4px' }}>{line}</div>
            })}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function TodosTab({ dealId, deal, onUpdate }: { dealId: string; deal: any; onUpdate: () => void }) {
  const [newTodo, setNewTodo] = useState('')
  const [doneExpanded, setDoneExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const todos: any[] = deal?.todos ?? []
  const pending = todos.filter((t: any) => !t.done)
  const done = todos.filter((t: any) => t.done)

  const copyPending = () => {
    const text = `Open to-dos for ${deal?.dealName ?? 'deal'}:\n${pending.map((t: any, i: number) => `${i + 1}. ${t.text}`).join('\n')}`
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const saveTodos = async (updated: any[]) => {
    await fetch(`/api/deals/${dealId}/todos`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todos: updated }),
    })
    onUpdate()
  }

  const toggleTodo = (id: string) => {
    saveTodos(todos.map((t: any) => t.id === id ? { ...t, done: !t.done } : t))
  }

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodo.trim()) return
    await saveTodos([...todos, { id: crypto.randomUUID(), text: newTodo.trim(), done: false, createdAt: new Date().toISOString() }])
    setNewTodo('')
  }

  const deleteTodo = (id: string) => saveTodos(todos.filter((t: any) => t.id !== id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: '#555' }}>{pending.length} open action{pending.length !== 1 ? 's' : ''}</span>
        {pending.length > 0 && (
          <button onClick={copyPending} style={{
            fontSize: '11px', color: copied ? '#22C55E' : '#555', background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0',
          }}>
            {copied ? '✓ Copied' : '⎘ Copy list'}
          </button>
        )}
      </div>
      <form onSubmit={addTodo} style={{ display: 'flex', gap: '8px' }}>
        <input
          value={newTodo}
          onChange={e => setNewTodo(e.target.value)}
          placeholder="Add action item..."
          style={{
            flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', padding: '9px 12px', color: '#EBEBEB', fontSize: '13px', outline: 'none',
          }}
          onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)'}
          onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}
        />
        <button type="submit" disabled={!newTodo.trim()} style={{
          padding: '0 14px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: '8px', color: '#818CF8', cursor: 'pointer', display: 'flex', alignItems: 'center',
        }}>
          <Plus size={14} />
        </button>
      </form>

      {/* Pending todos */}
      {pending.length === 0 && done.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#444', fontSize: '13px' }}>
          No action items yet. Analyze meeting notes to auto-generate them.
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {pending.map((todo: any) => (
                <div key={todo.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px',
                }}>
                  <button onClick={() => toggleTodo(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    <Square size={15} color="#444" />
                  </button>
                  <span style={{ flex: 1, fontSize: '13px', color: '#EBEBEB' }}>{todo.text}</span>
                  <button onClick={() => deleteTodo(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: '2px', display: 'flex', borderRadius: '4px' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#EF4444'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#333'}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Completed todos — collapsed by default */}
          {done.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              <button
                onClick={() => setDoneExpanded(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', color: '#444', fontSize: '11px' }}
              >
                <CheckCircle size={11} color="#22C55E" />
                <span style={{ color: '#22C55E', fontWeight: '600' }}>{done.length} completed</span>
                <span style={{ color: '#333' }}>{doneExpanded ? '↑' : '↓'}</span>
              </button>
              {doneExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                  {done.map((todo: any) => (
                    <div key={todo.id} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
                      background: 'rgba(34,197,94,0.03)', border: '1px solid rgba(34,197,94,0.08)', borderRadius: '6px',
                    }}>
                      <button onClick={() => toggleTodo(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
                        <CheckCircle size={13} color="#22C55E" />
                      </button>
                      <span style={{ flex: 1, fontSize: '12px', color: '#444', textDecoration: 'line-through' }}>{todo.text}</span>
                      <button onClick={() => deleteTodo(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2A2A2A', padding: '1px', display: 'flex', borderRadius: '3px' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#EF4444'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#2A2A2A'}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const STAGES_OPTS = ['prospecting','qualification','discovery','proposal','negotiation','closed_won','closed_lost'] as const

function EditDealModal({ deal, dealId, open, onOpenChange, onSaved, onWon }: {
  deal: any; dealId: string; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void; onWon?: (deal: any) => void
}) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [contacts, setContacts] = useState<DealContact[]>([{ name: '', title: '', email: '' }])
  const [saving, setSaving] = useState(false)

  // sync form state when deal or open changes
  useEffect(() => {
    if (open && deal) {
      setForm({
        dealName: deal.dealName ?? '',
        prospectCompany: deal.prospectCompany ?? '',
        description: deal.description ?? '',
        dealValue: deal.dealValue != null ? String(deal.dealValue) : '',
        stage: deal.stage ?? 'proposal',
        dealType: deal.dealType ?? 'one_off',
        recurringInterval: deal.recurringInterval ?? 'annual',
        competitors: Array.isArray(deal.competitors) ? deal.competitors.join(', ') : '',
        notes: deal.notes ?? '',
        nextSteps: deal.nextSteps ?? '',
        lostReason: deal.lostReason ?? '',
      })
      // Initialise contacts from saved array, fall back to legacy prospectName/Title
      const existing: DealContact[] = Array.isArray(deal.contacts) && deal.contacts.length > 0
        ? deal.contacts
        : deal.prospectName ? [{ name: deal.prospectName, title: deal.prospectTitle ?? '', email: '' }] : [{ name: '', title: '', email: '' }]
      setContacts(existing.map(c => ({ name: c.name ?? '', title: c.title ?? '', email: c.email ?? '' })))
    }
  }, [open, deal])

  const updateContact = (i: number, field: keyof DealContact, value: string) =>
    setContacts(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  const addContact = () => setContacts(prev => [...prev, { name: '', title: '', email: '' }])
  const removeContact = (i: number) => setContacts(prev => prev.filter((_, idx) => idx !== i))

  const u = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inputStyle: React.CSSProperties = {
    width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px',
    background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)',
    color: '#EBEBEB', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, color: '#666',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px',
  }

  const save = async () => {
    setSaving(true)
    try {
      const wasWon = deal?.stage !== 'closed_won' && form.stage === 'closed_won'
      const cleanContacts = contacts
        .map(c => ({ name: c.name.trim(), title: c.title?.trim() || undefined, email: c.email?.trim() || undefined }))
        .filter(c => c.name)
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealName: form.dealName,
          prospectCompany: form.prospectCompany,
          description: form.description || null,
          prospectName: cleanContacts[0]?.name ?? null,
          prospectTitle: cleanContacts[0]?.title ?? null,
          contacts: cleanContacts,
          dealValue: form.dealValue ? Number(form.dealValue) : null,
          stage: form.stage,
          dealType: form.dealType ?? 'one_off',
          recurringInterval: form.dealType === 'recurring' ? (form.recurringInterval ?? 'annual') : null,
          competitors: form.competitors.split(',').map((s: string) => s.trim()).filter(Boolean),
          notes: form.notes || null,
          nextSteps: form.nextSteps || null,
          lostReason: form.lostReason || null,
        }),
      })
      onSaved()
      onOpenChange(false)
      if (wasWon) onWon?.({ ...form, dealId })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 500 }} />
        <Dialog.Content style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 501, width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto',
          background: 'rgba(14,10,26,0.98)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '14px', padding: '24px', outline: 'none',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <Dialog.Title style={{ fontSize: '15px', fontWeight: 700, color: '#F1F1F3', margin: 0 }}>Edit deal</Dialog.Title>
            <Dialog.Close asChild>
              <button style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '5px' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EBEBEB')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Deal name</label>
                <input style={inputStyle} value={form.dealName ?? ''} onChange={e => u('dealName', e.target.value)}
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
              </div>
              <div>
                <label style={labelStyle}>Company</label>
                <input style={inputStyle} value={form.prospectCompany ?? ''} onChange={e => u('prospectCompany', e.target.value)}
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
              </div>
            </div>
            {/* Description */}
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }}
                rows={2}
                value={form.description ?? ''}
                onChange={e => u('description', e.target.value)}
                placeholder="Overview of the opportunity, context, or key details…"
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
            </div>

            {/* Contacts */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={labelStyle}>Contacts</label>
                <button
                  type="button"
                  onClick={addContact}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#818CF8' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#6366F1' }}
                >
                  <Plus size={11} /> Add contact
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {contacts.map((contact, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '10px', position: 'relative' }}>
                    {contacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContact(i)}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#444', display: 'flex', padding: '2px', borderRadius: '4px' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#EF4444' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#444' }}
                      >
                        <X size={12} />
                      </button>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ ...labelStyle, fontSize: '10px' }}>Name</label>
                        <input style={inputStyle} value={contact.name} onChange={e => updateContact(i, 'name', e.target.value)} placeholder="Jane Smith"
                          onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: '10px' }}>Title</label>
                        <input style={inputStyle} value={contact.title ?? ''} onChange={e => updateContact(i, 'title', e.target.value)} placeholder="VP of Engineering"
                          onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                      </div>
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '10px' }}>Email</label>
                      <input style={inputStyle} type="email" value={contact.email ?? ''} onChange={e => updateContact(i, 'email', e.target.value)} placeholder="jane@acme.com"
                        onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Deal type</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: form.dealType === 'recurring' ? '8px' : '0' }}>
                {(['one_off', 'recurring'] as const).map(type => (
                  <button key={type} type="button" onClick={() => u('dealType', type)} style={{
                    flex: 1, height: '32px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                    color: form.dealType === type ? '#EBEBEB' : '#555',
                    backgroundColor: form.dealType === type ? 'rgba(99,102,241,0.15)' : 'transparent',
                    border: `1px solid ${form.dealType === type ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer', transition: 'all 150ms ease',
                  }}>
                    {type === 'one_off' ? 'One-off' : 'Recurring'}
                  </button>
                ))}
              </div>
              {form.dealType === 'recurring' && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['monthly', 'quarterly', 'annual'] as const).map(interval => (
                    <button key={interval} type="button" onClick={() => u('recurringInterval', interval)} style={{
                      flex: 1, height: '26px', borderRadius: '5px', fontSize: '11px', fontWeight: 500, textTransform: 'capitalize',
                      color: form.recurringInterval === interval ? '#EBEBEB' : '#555',
                      backgroundColor: form.recurringInterval === interval ? 'rgba(255,255,255,0.08)' : 'transparent',
                      border: `1px solid ${form.recurringInterval === interval ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
                      cursor: 'pointer', transition: 'all 150ms ease',
                    }}>
                      {interval}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>
                  {form.dealType === 'recurring'
                    ? `Value (${form.recurringInterval === 'monthly' ? 'MRR' : form.recurringInterval === 'quarterly' ? 'QRR' : 'ARR'} $)`
                    : 'Deal value ($)'}
                </label>
                <input style={inputStyle} type="number" value={form.dealValue ?? ''} onChange={e => u('dealValue', e.target.value)} placeholder="50000"
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
              </div>
              <div>
                <label style={labelStyle}>Stage</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.stage ?? ''} onChange={e => u('stage', e.target.value)}>
                  {STAGES_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Competitors (comma-separated)</label>
              <input style={inputStyle} value={form.competitors ?? ''} onChange={e => u('competitors', e.target.value)} placeholder="Competitor A, Competitor B"
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
            </div>
            {form.stage === 'closed_lost' && (
              <div>
                <label style={labelStyle}>Lost reason</label>
                <input style={inputStyle} value={form.lostReason ?? ''} onChange={e => u('lostReason', e.target.value)} placeholder="e.g. Price too high"
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }}
                rows={3} value={form.notes ?? ''} onChange={e => u('notes', e.target.value)}
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
            </div>
            <div>
              <label style={labelStyle}>Next steps</label>
              <input style={inputStyle} value={form.nextSteps ?? ''} onChange={e => u('nextSteps', e.target.value)} placeholder="Schedule follow-up call"
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
              <Dialog.Close asChild>
                <button style={{ height: '34px', padding: '0 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 500, color: '#888', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </Dialog.Close>
              <button onClick={save} disabled={saving} style={{
                height: '34px', padding: '0 18px', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                color: '#fff', background: saving ? '#333' : 'linear-gradient(135deg, #6366F1, #7C3AED)',
                border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function WinStoryPromptModal({ wonDeal, open, onOpenChange }: {
  wonDeal: any; open: boolean; onOpenChange: (v: boolean) => void
}) {
  const [form, setForm] = useState({ customerName: '', customerIndustry: '', customerSize: '', challenge: '', solution: '', results: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open && wonDeal) {
      setForm({
        customerName: wonDeal.prospectCompany ?? '',
        customerIndustry: '',
        customerSize: '',
        challenge: wonDeal.notes ? `${wonDeal.notes.slice(0, 300)}` : '',
        solution: '',
        results: wonDeal.dealValue ? `Closed at $${Number(wonDeal.dealValue).toLocaleString()}` : '',
      })
      setSaved(false)
    }
  }, [open, wonDeal])

  const u = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px',
    background: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)',
    color: '#EBEBEB', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, color: '#666',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px',
  }
  const textareaStyle: React.CSSProperties = {
    ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical',
    fontFamily: 'inherit', lineHeight: '1.5',
  }

  const submit = async () => {
    if (!form.customerName || !form.challenge || !form.solution || !form.results) return
    setSaving(true)
    try {
      const res = await fetch('/api/case-studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, metrics: [] }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => onOpenChange(false), 1400)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 600 }} />
        <Dialog.Content style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 601, width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto',
          background: 'rgba(12,10,28,0.99)', border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: '14px', padding: '24px', outline: 'none',
          boxShadow: '0 24px 64px rgba(0,0,0,0.9), 0 0 32px rgba(99,102,241,0.15)',
        }}>
          {saved ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🏆</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#22C55E', marginBottom: '4px' }}>Win story saved!</div>
              <div style={{ fontSize: '13px', color: '#555' }}>Added to your case study library for future collateral.</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '18px' }}>🏆</span>
                    <Dialog.Title style={{ fontSize: '15px', fontWeight: 700, color: '#F1F1F3', margin: 0 }}>
                      Turn this win into a case study
                    </Dialog.Title>
                  </div>
                  <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>
                    Capture the story now — it&apos;ll strengthen every future proposal and collateral piece.
                  </p>
                </div>
                <Dialog.Close asChild>
                  <button style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', display: 'flex', padding: '4px', flexShrink: 0 }}>
                    <X size={15} />
                  </button>
                </Dialog.Close>
              </div>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '14px 0' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Customer name *</label>
                    <input style={inputStyle} value={form.customerName} onChange={e => u('customerName', e.target.value)}
                      onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  </div>
                  <div>
                    <label style={labelStyle}>Industry</label>
                    <input style={inputStyle} value={form.customerIndustry} onChange={e => u('customerIndustry', e.target.value)} placeholder="e.g. SaaS, Retail"
                      onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Company size</label>
                  <input style={inputStyle} value={form.customerSize} onChange={e => u('customerSize', e.target.value)} placeholder="e.g. 50-200 employees, Series B"
                    onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                </div>
                <div>
                  <label style={labelStyle}>Their challenge *</label>
                  <textarea style={textareaStyle} rows={3} value={form.challenge} onChange={e => u('challenge', e.target.value)}
                    placeholder="What problem were they trying to solve?"
                    onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                </div>
                <div>
                  <label style={labelStyle}>How you solved it *</label>
                  <textarea style={textareaStyle} rows={2} value={form.solution} onChange={e => u('solution', e.target.value)}
                    placeholder="What did you implement or deliver?"
                    onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                </div>
                <div>
                  <label style={labelStyle}>Measurable results *</label>
                  <textarea style={textareaStyle} rows={2} value={form.results} onChange={e => u('results', e.target.value)}
                    placeholder="e.g. Reduced onboarding time by 40%, saved 10h/week"
                    onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                  <Dialog.Close asChild>
                    <button style={{ height: '34px', padding: '0 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 500, color: '#555', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                      Skip for now
                    </button>
                  </Dialog.Close>
                  <button
                    onClick={submit}
                    disabled={saving || !form.customerName || !form.challenge || !form.solution || !form.results}
                    style={{
                      height: '34px', padding: '0 18px', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                      color: '#fff', background: saving ? '#333' : 'linear-gradient(135deg, #22C55E, #16A34A)',
                      border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {saving ? 'Saving…' : 'Save Win Story'}
                  </button>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ActivityLog({ dealId, deal, onUpdate }: { dealId: string; deal: any; onUpdate: () => void }) {
  const [entry, setEntry] = useState('')
  const [saving, setSaving] = useState(false)

  // Parse date-stamped entries from accumulated notes
  const entries: string[] = deal?.notes
    ? deal.notes.split('\n').filter((l: string) => l.trim().length > 0)
    : []

  const logActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entry.trim()) return
    setSaving(true)
    try {
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      const newEntry = `[${dateStr}] ${entry.trim()}`
      const updatedNotes = deal?.notes ? `${deal.notes}\n${newEntry}` : newEntry
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: updatedNotes }),
      })
      setEntry('')
      onUpdate()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Clipboard size={13} color="#818CF8" />
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#EBEBEB' }}>Activity Log</span>
        <span style={{ fontSize: '11px', color: '#444' }}>· manual entries + meeting summaries</span>
      </div>

      {/* Quick log input */}
      <form onSubmit={logActivity} style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderBottom: entries.length > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
        <input
          value={entry}
          onChange={e => setEntry(e.target.value)}
          placeholder="Log an activity… e.g. 'Sent account access email to john@acme.com'"
          style={{
            flex: 1, height: '34px', padding: '0 10px', borderRadius: '7px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#EBEBEB', fontSize: '12px', outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
        />
        <button type="submit" disabled={saving || !entry.trim()} style={{
          height: '34px', padding: '0 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600',
          color: '#fff', background: saving || !entry.trim() ? '#1A1A1A' : 'rgba(99,102,241,0.8)',
          border: '1px solid rgba(99,102,241,0.3)', cursor: saving || !entry.trim() ? 'not-allowed' : 'pointer',
          transition: 'background 150ms', whiteSpace: 'nowrap',
        }}>
          {saving ? '…' : 'Log'}
        </button>
      </form>

      {/* Timeline */}
      {entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', maxHeight: '240px', overflowY: 'auto' }}>
          {[...entries].reverse().map((e, i) => {
            const isDateStamped = e.startsWith('[')
            const dateMatch = e.match(/^\[([^\]]+)\]\s*(.*)/)
            const date = dateMatch?.[1] ?? ''
            const text = dateMatch?.[2] ?? e
            return (
              <div key={i} style={{
                display: 'flex', gap: '12px', padding: '9px 16px',
                borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
              }}>
                <div style={{ flexShrink: 0, marginTop: '4px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(99,102,241,0.6)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isDateStamped && <div style={{ fontSize: '10px', color: '#444', marginBottom: '2px' }}>{date}</div>}
                  <div style={{ fontSize: '12px', color: '#888', lineHeight: '1.5' }}>{text}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {entries.length === 0 && (
        <div style={{ padding: '20px 16px', fontSize: '12px', color: '#333', textAlign: 'center' }}>
          No activity logged yet. Log meetings via the AI tab or add manual entries above.
        </div>
      )}
    </div>
  )
}

function SuccessCriteriaTab({ dealId, deal, onUpdate }: { dealId: string; deal: any; onUpdate: () => void }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const isShared: boolean = deal?.successCriteriaIsShared ?? false
  const shareToken: string | null = deal?.successCriteriaShareToken ?? null
  const criteria: any[] = deal?.successCriteriaTodos ?? []

  const categories = [...new Set(criteria.map((c: any) => c.category ?? 'General'))]
  const achieved = criteria.filter((c: any) => c.achieved).length

  const extract = async () => {
    if (!text.trim()) return
    setLoading(true)
    setExtractError(null)
    try {
      const res = await fetch(`/api/deals/${dealId}/success-criteria`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setExtractError(data.error ?? 'Failed to extract criteria')
        return
      }
      setText('')
      onUpdate()
    } finally { setLoading(false) }
  }

  const toggle = async (criterionId: string, achieved: boolean) => {
    await fetch(`/api/deals/${dealId}/success-criteria`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criterionId, achieved }),
    })
    onUpdate()
  }

  const saveNote = async (criterionId: string) => {
    await fetch(`/api/deals/${dealId}/success-criteria`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criterionId, note: noteText }),
    })
    setEditingNote(null)
    onUpdate()
  }

  const remove = async (criterionId: string) => {
    await fetch(`/api/deals/${dealId}/success-criteria`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criterionId }),
    })
    onUpdate()
  }

  const toggleShare = async () => {
    setShareLoading(true)
    try {
      await fetch(`/api/deals/${dealId}/success-criteria/share`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: !isShared }),
      })
      onUpdate()
    } finally { setShareLoading(false) }
  }

  const copyLink = async () => {
    if (!shareToken) return
    await navigator.clipboard.writeText(`${window.location.origin}/share/criteria/${shareToken}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Progress bar */}
      {criteria.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#888' }}>Progress</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: achieved === criteria.length ? '#22C55E' : '#EBEBEB' }}>
              {achieved}/{criteria.length} met
            </span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${criteria.length ? (achieved / criteria.length) * 100 : 0}%`, background: 'linear-gradient(90deg, #6366F1, #22C55E)', borderRadius: '3px', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Share controls */}
      {criteria.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={toggleShare}
            disabled={shareLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: isShared ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isShared ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '7px', color: isShared ? '#818CF8' : '#888', fontSize: '12px', fontWeight: 600, cursor: shareLoading ? 'not-allowed' : 'pointer' }}
          >
            {shareLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Link2 size={12} />}
            {isShared ? 'Shared' : 'Share'}
          </button>
          {isShared && shareToken && (
            <button
              onClick={copyLink}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '7px', color: copied ? '#22C55E' : '#888', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              {copied ? <Check size={12} /> : <Clipboard size={12} />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          )}
        </div>
      )}

      {/* Criteria list grouped by category */}
      {categories.map(cat => (
        <div key={cat} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#555', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>{cat}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {criteria.filter((c: any) => (c.category ?? 'General') === cat).map((c: any) => (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <button
                    onClick={() => toggle(c.id, !c.achieved)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '1px', flexShrink: 0, color: c.achieved ? '#22C55E' : '#444' }}
                  >
                    {c.achieved
                      ? <CheckCircle size={16} />
                      : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #444' }} />}
                  </button>
                  <span style={{ flex: 1, fontSize: '13px', color: c.achieved ? '#555' : '#C0C0C8', lineHeight: 1.5, textDecoration: c.achieved ? 'line-through' : 'none' }}>
                    {c.text}
                  </span>
                  <button onClick={() => { setEditingNote(c.id); setNoteText(c.note ?? '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: '11px', color: c.note ? '#818CF8' : '#333' }}>
                    {c.note ? '✎' : '+ note'}
                  </button>
                  <button onClick={() => remove(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: '#333' }}>
                    <X size={12} />
                  </button>
                </div>
                {c.note && editingNote !== c.id && (
                  <div style={{ marginLeft: '26px', fontSize: '11px', color: '#818CF8', background: 'rgba(99,102,241,0.06)', borderRadius: '6px', padding: '5px 8px' }}>
                    {c.note}
                  </div>
                )}
                {editingNote === c.id && (
                  <div style={{ marginLeft: '26px', display: 'flex', gap: '6px' }}>
                    <input
                      autoFocus
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveNote(c.id); if (e.key === 'Escape') setEditingNote(null) }}
                      placeholder="How was this achieved?"
                      style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', padding: '5px 8px', color: '#EBEBEB', fontSize: '12px', outline: 'none' }}
                    />
                    <button onClick={() => saveNote(c.id)} style={{ padding: '5px 10px', background: 'rgba(99,102,241,0.2)', border: 'none', borderRadius: '6px', color: '#818CF8', fontSize: '11px', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingNote(null)} style={{ padding: '5px 8px', background: 'none', border: 'none', color: '#555', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Paste new criteria */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#555', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>
          {criteria.length > 0 ? 'Add More Criteria' : 'Paste Success Criteria'}
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste the success criteria from your proposal, RFP, or stakeholder requirements — AI will extract individual testable items..."
          rows={5}
          style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 12px', color: '#EBEBEB', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={extract}
            disabled={loading || !text.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 18px', background: loading ? 'rgba(99,102,241,0.15)' : 'linear-gradient(135deg, #6366F1, #7C3AED)', border: loading ? '1px solid rgba(99,102,241,0.3)' : 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: loading || !text.trim() ? 'not-allowed' : 'pointer' }}
          >
            {loading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Extracting…</> : <><Sparkles size={13} /> Extract Criteria</>}
          </button>
          {extractError && (
            <span style={{ fontSize: '12px', color: '#EF4444' }}>{extractError}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DealDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const { data, mutate } = useSWR(id ? `/api/deals/${id}` : null, fetcher)
  const deal = data?.data ?? data
  const { data: gapsData } = useSWR('/api/product-gaps', fetcher)
  const dealGaps: any[] = (gapsData?.data ?? []).filter((g: any) => (g.sourceDeals as string[] ?? []).includes(id))

  const [activeTab, setActiveTab] = useState<'overview' | 'meeting-notes' | 'prep' | 'todos' | 'success'>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [winStoryOpen, setWinStoryOpen] = useState(false)
  const [wonDeal, setWonDeal] = useState<any>(null)

  if (!deal && data !== undefined) {
    return (
      <div style={{ textAlign: 'center', padding: '80px', color: '#555' }}>
        Deal not found. <Link href="/deals" style={{ color: '#6366F1' }}>Back to deals</Link>
      </div>
    )
  }

  const stageColor = STAGE_COLORS[deal?.stage] ?? '#6B7280'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Back + header */}
      <div>
        <Link href="/deals" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#555', fontSize: '13px', textDecoration: 'none', marginBottom: '14px' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#EBEBEB'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#555'}
        >
          <ArrowLeft size={13} /> Back to deals
        </Link>

        {deal ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.03em', color: '#F1F1F3', margin: 0 }}>
                  {deal.prospectCompany}
                </h1>
                <span style={{
                  fontSize: '11px', padding: '3px 10px', borderRadius: '100px', fontWeight: '600',
                  background: `${stageColor}18`, color: stageColor, border: `1px solid ${stageColor}35`,
                }}>
                  {deal.stage?.replace('_', ' ')}
                </span>
                {deal.conversionScore != null && (
                  <span style={{
                    fontSize: '12px', padding: '3px 10px', borderRadius: '100px', fontWeight: '700',
                    background: deal.conversionScore >= 70 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                    color: deal.conversionScore >= 70 ? '#22C55E' : '#F59E0B',
                    border: `1px solid ${deal.conversionScore >= 70 ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    <Target size={10} /> {deal.conversionScore}% conversion
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#555' }}>
                {deal.prospectName && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={11} />{deal.prospectName}</span>}
                {deal.dealValue && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#22C55E', fontWeight: '600' }}><DollarSign size={11} />${deal.dealValue.toLocaleString()}</span>}
                {deal.closeDate && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} />Close {new Date(deal.closeDate).toLocaleDateString()}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditOpen(true)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', color: '#EBEBEB', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              }}>
                <Edit size={13} /> Edit
              </button>
              <Link href={`/collateral?dealId=${id}`} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                background: 'linear-gradient(135deg, #6366F1, #7C3AED)', boxShadow: '0 0 16px rgba(99,102,241,0.3)',
                border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none',
              }}>
                <Sparkles size={13} /> Generate Collateral
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ height: '40px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', width: '300px', animation: 'pulse 1.5s infinite' }} />
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0' }}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'meeting-notes', label: 'Meeting Notes + AI' },
          { id: 'prep', label: 'Meeting Prep' },
          { id: 'todos', label: `To-Dos ${deal?.todos?.length > 0 ? `(${deal.todos.filter((t: any) => !t.done).length})` : ''}` },
          { id: 'success', label: `Success Criteria${(deal?.successCriteriaTodos as any[])?.length > 0 ? ` (${(deal.successCriteriaTodos as any[]).filter((c: any) => !c.achieved).length} open)` : ''}` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{
            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
            color: activeTab === tab.id ? '#EBEBEB' : '#555',
            borderBottom: activeTab === tab.id ? '2px solid #6366F1' : '2px solid transparent',
            marginBottom: '-1px', transition: 'color 0.1s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Edit deal modal */}
      <EditDealModal
        deal={deal} dealId={id} open={editOpen} onOpenChange={setEditOpen}
        onSaved={() => mutate()}
        onWon={(data) => { setWonDeal(data); setWinStoryOpen(true) }}
      />
      {/* Win story capture */}
      <WinStoryPromptModal wonDeal={wonDeal} open={winStoryOpen} onOpenChange={setWinStoryOpen} />

      {/* Tab content */}
      {!deal ? (
        <div style={{ height: '200px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }} />
      ) : (
        <div>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Deal risks banner — only shown when AI has identified risks */}
              {(deal.dealRisks as string[])?.length > 0 && (
                <div style={{ padding: '14px 16px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#F59E0B', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ⚠ AI-Identified Deal Risks
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {(deal.dealRisks as string[]).map((risk: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: '#C9820A' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0, marginTop: '6px' }} />
                        {risk}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setActiveTab('meeting-notes')}
                    style={{ marginTop: '10px', fontSize: '11px', color: '#F59E0B', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    View full AI analysis →
                  </button>
                </div>
              )}
              {dealGaps.length > 0 && (
                <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#EF4444', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Product Gaps ({dealGaps.length})
                    </div>
                    <Link href="/product-gaps" style={{ fontSize: '11px', color: '#EF4444', textDecoration: 'none', opacity: 0.7 }}>View all →</Link>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {dealGaps.map((g: any) => (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: g.priority === 'critical' ? '#EF4444' : g.priority === 'high' ? '#F59E0B' : '#6366F1', flexShrink: 0 }} />
                        <span style={{ color: '#C0C0C8', flex: 1 }}>{g.title}</span>
                        {g.roadmap && <span style={{ fontSize: '10px', color: '#555', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', padding: '1px 5px' }}>{g.roadmap}</span>}
                        <span style={{ fontSize: '10px', color: '#555' }}>{g.priority}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {[
                  { label: 'Deal Name', value: deal.dealName },
                  { label: 'Company', value: deal.prospectCompany },
                  { label: 'Contact', value: deal.prospectName },
                  { label: 'Title', value: deal.prospectTitle },
                  { label: 'Stage', value: deal.stage?.replace('_', ' ') },
                  { label: 'Deal Value', value: deal.dealValue ? `$${deal.dealValue.toLocaleString()}` : null },
                  { label: 'Competitors', value: (deal.competitors as string[])?.join(', ') },
                  { label: 'Notes', value: deal.notes },
                  { label: 'Next Steps', value: deal.nextSteps },
                ].filter(f => f.value).map(({ label, value }) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                    <div style={{ fontSize: '13px', color: '#EBEBEB', fontWeight: '500' }}>{value}</div>
                  </div>
                ))}
              </div>
              <ActivityLog dealId={id} deal={deal} onUpdate={() => mutate()} />
            </div>
          )}
          {activeTab === 'meeting-notes' && (
            <MeetingNotesTab dealId={id} deal={deal} onUpdate={() => mutate()} />
          )}
          {activeTab === 'prep' && <MeetingPrepTab dealId={id} deal={deal} />}
          {activeTab === 'todos' && (
            <TodosTab dealId={id} deal={deal} onUpdate={() => mutate()} />
          )}
          {activeTab === 'success' && (
            <SuccessCriteriaTab dealId={id} deal={deal} onUpdate={() => mutate()} />
          )}
        </div>
      )}
    </div>
  )
}
