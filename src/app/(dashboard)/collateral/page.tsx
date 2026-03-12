'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, RefreshCw } from 'lucide-react'
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
]

const TYPE_META: Record<CollateralType, { label: string; description: string }> = {
  battlecard: {
    label: 'Battlecard',
    description: 'Counter competitors on live calls — strengths, weaknesses, win themes',
  },
  case_study_doc: {
    label: 'Case Study Doc',
    description: 'Prove ROI against a prospect\'s risk or blocker using real customer evidence',
  },
  one_pager: {
    label: 'One-Pager',
    description: 'Executive summary of your product for quick sharing with stakeholders',
  },
  objection_handler: {
    label: 'Objection Handler',
    description: 'Q&A from recurring sales call objections — confident, ready-to-use answers',
  },
  talk_track: {
    label: 'Talk Track',
    description: 'Structured narrative for discovery and demo calls with key questions',
  },
  email_sequence: {
    label: 'Email Sequence',
    description: 'Multi-touch follow-up emails for prospects post-meeting',
  },
}

export default function CollateralPage() {
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

  const { data: collRes, isLoading, mutate } = useSWR<{ data: Collateral[] }>('/api/collateral', fetcher)
  const { data: compRes } = useSWR<{ data: Competitor[] }>('/api/competitors', fetcher)
  const { data: csRes } = useSWR<{ data: CaseStudy[] }>('/api/case-studies', fetcher)
  const { data: profileRes } = useSWR<{ data: CompanyProfile }>('/api/company', fetcher)

  const collateral = collRes?.data ?? []
  const competitors = compRes?.data ?? []
  const caseStudies = csRes?.data ?? []
  const products = profileRes?.data?.products ?? []

  // Auto-poll every 4s while any item is generating
  const hasGenerating = collateral.some(c => c.status === 'generating')
  useEffect(() => {
    if (!hasGenerating) return
    const t = setInterval(() => mutate(), 4000)
    return () => clearInterval(t)
  }, [hasGenerating, mutate])

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
      if (customPrompt.trim()) {
        body.customPrompt = customPrompt.trim()
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

  return (
    <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#EBEBEB', letterSpacing: '-0.03em', margin: 0, marginBottom: '4px' }}>
            Collateral
          </h1>
          <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
            {collateral.length} pieces • AI-generated sales materials
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {staleCount > 0 && (
            <button
              onClick={handleRegenAll}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer', transition: 'all 150ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.18)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.1)' }}
            >
              <RefreshCw size={13} strokeWidth={2.5} />
              Regen All Stale ({staleCount})
            </button>
          )}
          <button
            onClick={() => setGenerateOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#fff', backgroundColor: '#6366F1', border: 'none', cursor: 'pointer', transition: 'background-color 150ms ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4F46E5' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#6366F1' }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Generate New
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Type filter */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setTypeFilter('all')}
            style={{ height: '28px', padding: '0 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: typeFilter === 'all' ? '#EBEBEB' : '#888', backgroundColor: typeFilter === 'all' ? 'rgba(255,255,255,0.08)' : 'transparent', border: typeFilter === 'all' ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent', cursor: 'pointer' }}
          >
            All types
          </button>
          {ALL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              style={{ height: '28px', padding: '0 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: typeFilter === type ? '#EBEBEB' : '#888', backgroundColor: typeFilter === type ? 'rgba(255,255,255,0.08)' : 'transparent', border: typeFilter === type ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent', cursor: 'pointer' }}
            >
              {TYPE_META[type].label}
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

        {/* Status filter */}
        {['all', 'ready', 'stale', 'generating'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            style={{ height: '28px', padding: '0 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: statusFilter === status ? '#EBEBEB' : '#888', backgroundColor: statusFilter === status ? 'rgba(255,255,255,0.08)' : 'transparent', border: statusFilter === status ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent', cursor: 'pointer', textTransform: 'capitalize' }}
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
        />
      )}

      {/* Generate modal */}
      <Dialog.Root open={generateOpen} onOpenChange={(open) => { setGenerateOpen(open); if (!open) { setSelectedProduct(''); setBuyerRole(''); setCustomPrompt('') } }}>
        <Dialog.Portal>
          <Dialog.Overlay style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 500 }} />
          <Dialog.Content style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 501, width: '100%', maxWidth: '520px', backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', boxShadow: '0 16px 48px rgba(0,0,0,0.8)', outline: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <Dialog.Title style={{ fontSize: '16px', fontWeight: 600, color: '#EBEBEB', margin: 0 }}>
                Generate collateral
              </Dialog.Title>
              <Dialog.Close asChild>
                <button style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#888' }}>
                  <X size={14} strokeWidth={2} />
                </button>
              </Dialog.Close>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Type selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '8px' }}>
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
                        backgroundColor: selectedType === type ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${selectedType === type ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedType !== type) {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedType !== type) {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                        }
                      }}
                    >
                      <CollateralTypeBadge type={type} />
                      <span style={{ fontSize: '11px', color: '#666', lineHeight: 1.4 }}>
                        {TYPE_META[type].description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Battlecard source */}
              {selectedType === 'battlecard' && competitors.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Competitor (optional)
                  </label>
                  <select
                    value={selectedCompetitor}
                    onChange={(e) => setSelectedCompetitor(e.target.value)}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', color: '#EBEBEB', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Select a competitor…</option>
                    {competitors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {/* Case study source */}
              {selectedType === 'case_study_doc' && caseStudies.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Case study (optional)
                  </label>
                  <select
                    value={selectedCaseStudy}
                    onChange={(e) => setSelectedCaseStudy(e.target.value)}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', color: '#EBEBEB', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Select a case study…</option>
                    {caseStudies.map((cs) => <option key={cs.id} value={cs.id}>{cs.customerName}</option>)}
                  </select>
                </div>
              )}

              {/* Product selector for one-pager */}
              {selectedType === 'one_pager' && products.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Product (optional)
                  </label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', color: '#EBEBEB', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Use first product ({products[0]?.name ?? '—'})</option>
                    {products.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Buyer role for talk track / email sequence */}
              {(selectedType === 'talk_track' || selectedType === 'email_sequence') && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Target buyer role (optional)
                  </label>
                  <input
                    type="text"
                    value={buyerRole}
                    onChange={(e) => setBuyerRole(e.target.value)}
                    placeholder="e.g. VP of Operations, CTO, Head of Finance"
                    style={{ width: '100%', height: '34px', padding: '0 10px', borderRadius: '6px', backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', color: '#EBEBEB', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              {/* Custom prompt */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#888', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Additional context <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. Focus on enterprise deals, highlight our integration capabilities, tone should be formal…"
                  rows={3}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', color: '#EBEBEB', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                <Dialog.Close asChild>
                  <button style={{ height: '34px', padding: '0 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: '#888', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ height: '34px', padding: '0 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#fff', backgroundColor: generating ? '#333' : '#6366F1', border: 'none', cursor: generating ? 'not-allowed' : 'pointer', transition: 'background-color 150ms ease' }}
                  onMouseEnter={(e) => { if (!generating) e.currentTarget.style.backgroundColor = '#4F46E5' }}
                  onMouseLeave={(e) => { if (!generating) e.currentTarget.style.backgroundColor = '#6366F1' }}
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
