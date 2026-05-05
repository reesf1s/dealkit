'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, RefreshCw, Target, FileText } from 'lucide-react'
import { CollateralGrid } from '@/components/collateral/CollateralGrid'
import { CollateralTypeBadge } from '@/components/collateral/CollateralTypeBadge'
import { SkeletonGrid } from '@/components/shared/SkeletonCard'
import { useToast } from '@/components/shared/Toast'
import type { Collateral, CollateralType, Competitor, CaseStudy, CompanyProfile } from '@/types'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch')
    return r.json()
  })

const ALL_TYPES: CollateralType[] = [
  'battlecard',
  'case_study_doc',
  'one_pager',
  'objection_handler',
  'talk_track',
  'email_sequence',
  'custom',
]

const TYPE_META: Record<CollateralType, { label: string; description: string }> = {
  battlecard: {
    label: 'Battlecard',
    description: 'Brain-generated competitive intelligence — auto-updated as your deals evolve',
  },
  case_study_doc: {
    label: 'Case Study Doc',
    description: 'Autonomously built from your wins — proves ROI with real customer evidence',
  },
  one_pager: {
    label: 'One-Pager',
    description: 'Executive summary the brain writes from your company profile and win data',
  },
  objection_handler: {
    label: 'Objection Handler',
    description: 'The brain identifies recurring objections and writes the winning responses',
  },
  talk_track: {
    label: 'Talk Track',
    description: 'Structured call narrative built from your best-performing deal patterns',
  },
  email_sequence: {
    label: 'Email Sequence',
    description: 'Multi-touch sequences the brain drafts based on your prospect context',
  },
  custom: {
    label: 'Custom',
    description: 'Ask the brain to generate any document from your intelligence base',
  },
}

function CollateralPageInner() {
  const { toast } = useToast()
  const [generateOpen, setGenerateOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<CollateralType>('battlecard')
  const [selectedCompetitor, setSelectedCompetitor] = useState('')
  const [selectedCaseStudy, setSelectedCaseStudy] = useState('')
  const [generating, setGenerating] = useState(false)
  const [typeFilter, setTypeFilter] = useState<CollateralType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [buyerRole, setBuyerRole] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [specificObjections, setSpecificObjections] = useState('')
  const [selectedDealId, setSelectedDealId] = useState('')

  const searchParams = useSearchParams()
  const dealIdParam = searchParams.get('dealId')

  const { data: collRes, isLoading, mutate } = useSWR<{ data: Collateral[] }>('/api/collateral', fetcher)
  const { data: compRes } = useSWR<{ data: Competitor[] }>('/api/competitors', fetcher)
  const { data: csRes } = useSWR<{ data: CaseStudy[] }>('/api/case-studies', fetcher)
  const { data: profileRes } = useSWR<{ data: CompanyProfile }>('/api/company', fetcher)
  const { data: dealsRes } = useSWR<{ data: any[] }>('/api/deals', fetcher)
  const effectiveDealId = dealIdParam || selectedDealId
  const { data: dealCtxRes } = useSWR(effectiveDealId ? `/api/deals/${effectiveDealId}` : null, fetcher)

  const collateral = collRes?.data ?? []
  const competitors = compRes?.data ?? []
  const caseStudies = csRes?.data ?? []
  const products = profileRes?.data?.products ?? []
  const deals: any[] = dealsRes?.data ?? []
  const contextDeal = dealCtxRes?.data ?? dealCtxRes

  // Build deal name map for collateral cards
  const dealNameMap: Record<string, string> = {}
  for (const d of deals) {
    dealNameMap[d.id] = d.dealName || d.prospectCompany || 'Deal'
  }

  // Auto-poll every 4s while any item is generating
  const hasGenerating = collateral.some(c => c.status === 'generating')
  useEffect(() => {
    if (!hasGenerating) return
    const t = setInterval(() => mutate(), 4000)
    return () => clearInterval(t)
  }, [hasGenerating, mutate])

  // Auto-select competitor from deal context when modal opens on battlecard
  useEffect(() => {
    if (!contextDeal || !generateOpen || selectedType !== 'battlecard' || selectedCompetitor) return
    const dealCompNames: string[] = (contextDeal.competitors as string[]) ?? []
    if (!dealCompNames.length) return
    const match = competitors.find(c =>
      dealCompNames.some(n =>
        c.name.toLowerCase().includes(n.toLowerCase()) ||
        n.toLowerCase().includes(c.name.toLowerCase()),
      ),
    )
    if (match) setSelectedCompetitor(match.id)
  }, [contextDeal, generateOpen, selectedType, competitors, selectedCompetitor])

  const staleCount = collateral.filter(c => c.status === 'stale').length

  const filtered = collateral.filter((c) => {
    const typeOk = typeFilter === 'all' || c.type === typeFilter
    const statusOk = statusFilter === 'all' || c.status === statusFilter
    return typeOk && statusOk
  })

  async function handleGenerate() {
    setGenerating(true)
    try {
      const body: Record<string, string> = { type: selectedType }
      if (selectedType === 'battlecard' && selectedCompetitor) {
        body.competitorId = selectedCompetitor
      }
      if (selectedType === 'case_study_doc' && selectedCaseStudy) {
        body.caseStudyId = selectedCaseStudy
      }
      if (selectedType === 'one_pager' && selectedProduct) {
        body.productName = selectedProduct
      }
      if ((selectedType === 'talk_track' || selectedType === 'email_sequence') && buyerRole.trim()) {
        body.buyerRole = buyerRole.trim()
      }
      if (specificObjections.trim()) {
        body.customPrompt = `Must include responses to these specific objections: ${specificObjections.trim()}${customPrompt.trim() ? `\n\n${customPrompt.trim()}` : ''}`
      } else if (customPrompt.trim()) {
        body.customPrompt = customPrompt.trim()
      }
      if (effectiveDealId) {
        body.dealId = effectiveDealId
      }

      const res = await fetch('/api/collateral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        toast(json.error ?? 'Failed to generate', 'error')
        return
      }
      await mutate()
      setGenerateOpen(false)
      setSelectedProduct('')
      setBuyerRole('')
      setCustomPrompt('')
      toast('Generation started — check back in a moment', 'success')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenAll() {
    try {
      const res = await fetch('/api/collateral/regenerate-stale', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'Failed', 'error'); return }
      await mutate()
      toast(`Regenerating ${json.data?.queued ?? staleCount} items — refreshing automatically`, 'success')
    } catch {
      toast('Failed to start bulk regeneration', 'error')
    }
  }

  async function handleRegenerate(id: string) {
    try {
      const res = await fetch(`/api/collateral/${id}`, { method: 'PATCH' })
      if (!res.ok) {
        const json = await res.json()
        toast(json.error ?? 'Failed to regenerate', 'error')
        return
      }
      await mutate()
      toast('Regenerating — check back in a moment', 'success')
    } catch {
      toast('Failed to regenerate', 'error')
    }
  }

  function handleExport(id: string) {
    window.open(`/api/export/${id}`, '_blank')
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/collateral/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        toast(json.error ?? 'Failed to delete', 'error')
        return
      }
      await mutate()
      toast('Deleted', 'success')
    } catch {
      toast('Failed to delete', 'error')
    }
  }

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    height: '28px',
    padding: '0 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 500,
    color: active ? '#37352f' : '#9b9a97',
    backgroundColor: active ? '#f7f6f3' : 'transparent',
    border: active ? '1px solid rgba(55,53,47,0.16)' : '1px solid transparent',
    cursor: 'pointer',
  })

  return (
    <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto', background: 'var(--surface-1)', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ width: '32px', height: '32px', background: 'rgba(203,108,44,0.08)', border: '1px solid rgba(203,108,44,0.20)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={15} color="#cb6c2c" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Collateral
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0, paddingLeft: '42px' }}>
            {collateral.length} pieces • AI-generated sales materials
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {staleCount > 0 && (
            <button
              onClick={handleRegenAll}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: '#cb6c2c', backgroundColor: 'rgba(203,108,44,0.08)', border: '1px solid rgba(203,108,44,0.20)', cursor: 'pointer', transition: 'background 0.1s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(203,108,44,0.14)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(203,108,44,0.08)' }}
            >
              <RefreshCw size={13} strokeWidth={2.5} />
              Regen All Stale ({staleCount})
            </button>
          )}
          <button
            onClick={() => setGenerateOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#ffffff', background: '#37352f', border: 'none', cursor: 'pointer', transition: 'opacity 0.1s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Generate New
          </button>
        </div>
      </div>

      {/* Deal context banner */}
      {dealIdParam && contextDeal && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', marginBottom: '16px', background: 'rgba(46,120,198,0.08)', border: '1px solid rgba(46,120,198,0.20)', borderRadius: '8px' }}>
          <Target size={14} color="#2e78c6" strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#2e78c6' }}>Tailoring for deal: </span>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{contextDeal.dealName ?? contextDeal.prospectCompany}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>
              — collateral will be customised to this deal&apos;s context, risks, and competitors
            </span>
          </div>
          <button
            onClick={() => { setSelectedType('battlecard'); setGenerateOpen(true) }}
            style={{ flexShrink: 0, height: '30px', padding: '0 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: '#2e78c6', backgroundColor: 'rgba(46,120,198,0.08)', border: '1px solid rgba(46,120,198,0.20)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Quick Generate
          </button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Type filter */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button onClick={() => setTypeFilter('all')} style={filterBtnStyle(typeFilter === 'all')}>
            All types
          </button>
          {ALL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              style={filterBtnStyle(typeFilter === type)}
            >
              {TYPE_META[type].label}
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(55,53,47,0.09)', margin: '0 4px' }} />

        {/* Status filter */}
        {['all', 'ready', 'stale', 'generating'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            style={{ ...filterBtnStyle(statusFilter === status), textTransform: 'capitalize' }}
          >
            {status === 'all' ? 'All status' : status}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonGrid count={6} cols={3} />
      ) : (
        <CollateralGrid
          collateral={filtered}
          onGenerate={() => setGenerateOpen(true)}
          onExport={handleExport}
          onDelete={handleDelete}
          onRegenerate={handleRegenerate}
          dealNameMap={dealNameMap}
        />
      )}

      {/* Generate modal */}
      <Dialog.Root open={generateOpen} onOpenChange={(open) => { setGenerateOpen(open); if (!open) { setSelectedProduct(''); setBuyerRole(''); setCustomPrompt(''); setSpecificObjections(''); setSelectedDealId('') } }}>
        <Dialog.Portal>
          <Dialog.Overlay style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(55,53,47,0.4)', zIndex: 500 }} />
          <Dialog.Content style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 501, width: '100%', maxWidth: '520px', background: 'var(--surface-1)', border: '1px solid rgba(55,53,47,0.12)', borderRadius: '8px', padding: '24px', boxShadow: '0 8px 32px rgba(55,53,47,0.12)', outline: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <Dialog.Title style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Generate collateral
              </Dialog.Title>
              <Dialog.Close asChild>
                <button style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                  <X size={14} strokeWidth={2} />
                </button>
              </Dialog.Close>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Type selector */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {ALL_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '6px',
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: selectedType === type ? 'var(--brand-bg)' : '#f7f6f3',
                        border: selectedType === type ? '1px solid var(--brand-border)' : '1px solid rgba(55,53,47,0.09)',
                        cursor: 'pointer',
                        transition: 'background 0.1s ease',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedType !== type) {
                          e.currentTarget.style.backgroundColor = '#f0eeeb'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedType !== type) {
                          e.currentTarget.style.backgroundColor = '#f7f6f3'
                        }
                      }}
                    >
                      <CollateralTypeBadge type={type} />
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {TYPE_META[type].description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Battlecard source */}
              {selectedType === 'battlecard' && competitors.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Competitor (optional)
                  </label>
                  <select
                    value={selectedCompetitor}
                    onChange={(e) => setSelectedCompetitor(e.target.value)}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.16)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Select a competitor…</option>
                    {competitors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {/* Case study source */}
              {selectedType === 'case_study_doc' && caseStudies.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Case study (optional)
                  </label>
                  <select
                    value={selectedCaseStudy}
                    onChange={(e) => setSelectedCaseStudy(e.target.value)}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.16)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Select a case study…</option>
                    {caseStudies.map((cs) => <option key={cs.id} value={cs.id}>{cs.customerName}</option>)}
                  </select>
                </div>
              )}

              {/* Product selector for one-pager */}
              {selectedType === 'one_pager' && products.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Product (optional)
                  </label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.16)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Use first product ({products[0]?.name ?? '—'})</option>
                    {products.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Buyer role for talk track / email sequence */}
              {(selectedType === 'talk_track' || selectedType === 'email_sequence') && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Target buyer role (optional)
                  </label>
                  <input
                    type="text"
                    value={buyerRole}
                    onChange={(e) => setBuyerRole(e.target.value)}
                    placeholder="e.g. VP of Operations, CTO, Head of Finance"
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.16)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              {/* Specific objections for objection handler */}
              {selectedType === 'objection_handler' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Objections to include <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                  </label>
                  <textarea
                    value={specificObjections}
                    onChange={(e) => setSpecificObjections(e.target.value)}
                    placeholder={`e.g. "Your price is 3x what we pay today"\n"We already use Salesforce for this"\n"We need SSO before we can consider you"`}
                    rows={3}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.16)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5', boxSizing: 'border-box' }}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>One objection per line — the AI will write scripted responses for each.</p>
                </div>
              )}

              {/* Deal selector */}
              {!dealIdParam && deals.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Tailor for a deal <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                  </label>
                  <select
                    value={selectedDealId}
                    onChange={(e) => setSelectedDealId(e.target.value)}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.16)', color: selectedDealId ? '#37352f' : '#9b9a97', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">No deal — generic output</option>
                    {deals.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.dealName} — {d.prospectCompany}</option>
                    ))}
                  </select>
                  {selectedDealId && (
                    <p style={{ fontSize: '11px', color: 'var(--brand)', margin: '4px 0 0' }}>
                      AI will use this deal&apos;s context, risks, and competitors to tailor the output.
                    </p>
                  )}
                </div>
              )}

              {/* Custom prompt */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Instructions for the AI <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. Focus on security and compliance angle, use a formal tone, include NHS reference, emphasise ROI…"
                  rows={3}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.16)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                <Dialog.Close asChild>
                  <button style={{ height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', backgroundColor: 'rgba(55,53,47,0.06)', border: '1px solid rgba(55,53,47,0.12)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ height: '34px', padding: '0 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#fff', backgroundColor: generating ? '#9b9a97' : '#37352f', border: 'none', cursor: generating ? 'not-allowed' : 'pointer', transition: 'background-color 0.1s ease' }}
                >
                  {generating ? 'Starting…' : 'Generate'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

export default function CollateralPage() {
  return (
    <Suspense fallback={null}>
      <CollateralPageInner />
    </Suspense>
  )
}
