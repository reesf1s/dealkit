'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowLeft, Mail, Check, X, ChevronDown, Search } from 'lucide-react'
import { useToast } from '@/components/shared/Toast'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type SuggestedDeal = {
  id: string
  dealName: string
  prospectCompany: string
}

type UnmatchedEmail = {
  id: string
  fromEmail: string
  fromName: string | null
  subject: string | null
  body: string | null
  receivedAt: string
  suggestedDeals: SuggestedDeal[]
}

export default function UnmatchedEmailsPage() {
  const { toast } = useToast()
  const { data, mutate, isLoading } = useSWR<{ data: UnmatchedEmail[]; pendingCount: number }>(
    '/api/ingest/email/unmatched',
    fetcher,
  )
  const { data: allDealsRes } = useSWR<{ data: { id: string; dealName: string; prospectCompany: string }[] }>(
    '/api/deals?fields=id,dealName,prospectCompany&limit=100',
    fetcher,
  )

  const emails = data?.data ?? []
  const allDeals = allDealsRes?.data ?? []
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [dealSearch, setDealSearch] = useState('')

  async function handleAssign(emailId: string, dealId: string) {
    setAssigningId(emailId)
    try {
      const res = await fetch('/api/ingest/email/unmatched', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId, dealId }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to assign')
      }
      toast('Email assigned to deal', 'success')
      mutate()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to assign', 'error')
    } finally {
      setAssigningId(null)
      setOpenDropdown(null)
    }
  }

  async function handleDismiss(emailId: string) {
    setDismissingId(emailId)
    try {
      const res = await fetch('/api/ingest/email/unmatched', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId }),
      })
      if (!res.ok) throw new Error('Failed to dismiss')
      toast('Email dismissed', 'success')
      mutate()
    } catch {
      toast('Failed to dismiss email', 'error')
    } finally {
      setDismissingId(null)
    }
  }

  const filteredDeals = dealSearch.trim()
    ? allDeals.filter(d =>
        d.dealName.toLowerCase().includes(dealSearch.toLowerCase()) ||
        d.prospectCompany.toLowerCase().includes(dealSearch.toLowerCase())
      )
    : allDeals.slice(0, 10)

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <Link
          href="/settings"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '12px', color: 'var(--ds-text-3)', textDecoration: 'none',
            marginBottom: '12px',
          }}
        >
          <ArrowLeft size={12} />
          Back to Settings
        </Link>
        <h1 style={{
          fontSize: '20px', fontWeight: 800, letterSpacing: '-0.04em', margin: 0, marginBottom: '4px',
          background: 'linear-gradient(135deg, var(--ds-text-1) 0%, var(--ds-text-2) 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>Unmatched Emails</h1>
        <p style={{ fontSize: '12px', color: 'var(--ds-text-2)', margin: 0 }}>
          Emails that could not be automatically matched to a deal. Assign them manually or dismiss.
        </p>
      </div>

      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ds-text-3)', fontSize: '13px' }}>
          Loading...
        </div>
      ) : emails.length === 0 ? (
        <div style={{
          padding: '40px', textAlign: 'center', borderRadius: '12px',
          background: 'var(--ds-bg-card)', border: '1px solid var(--ds-border)',
        }}>
          <Mail size={24} style={{ color: 'var(--ds-text-3)', marginBottom: '8px' }} />
          <p style={{ fontSize: '13px', color: 'var(--ds-text-2)', margin: 0, marginBottom: '4px' }}>No unmatched emails</p>
          <p style={{ fontSize: '11px', color: 'var(--ds-text-3)', margin: 0 }}>
            All forwarded emails have been matched to deals or reviewed.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {emails.map(email => (
            <div
              key={email.id}
              style={{
                padding: '14px 16px', borderRadius: '10px',
                background: 'var(--ds-bg-card)', border: '1px solid var(--ds-border)',
              }}
            >
              {/* Email header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-text-1)' }}>
                      {email.fromName ?? email.fromEmail}
                    </span>
                    {email.fromName && (
                      <span style={{ fontSize: '11px', color: 'var(--ds-text-3)' }}>
                        &lt;{email.fromEmail}&gt;
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ds-text-2)', margin: 0 }}>
                    {email.subject ?? '(no subject)'}
                  </p>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--ds-text-3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {new Date(email.receivedAt).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>

              {/* Preview */}
              {email.body && (
                <p style={{
                  fontSize: '11px', color: 'var(--ds-text-3)', margin: '0 0 10px',
                  lineHeight: 1.5, maxHeight: '42px', overflow: 'hidden',
                  textOverflow: 'ellipsis', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {email.body}
                </p>
              )}

              {/* Suggested deals */}
              {email.suggestedDeals.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--ds-text-3)', lineHeight: '22px' }}>Suggested:</span>
                  {email.suggestedDeals.map(deal => (
                    <button
                      key={deal.id}
                      onClick={() => handleAssign(email.id, deal.id)}
                      disabled={assigningId === email.id}
                      style={{
                        height: '22px', padding: '0 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 500,
                        color: 'var(--ds-accent)', background: 'var(--ds-accent-soft)',
                        border: '1px solid rgba(91,91,214,0.2)', cursor: 'pointer',
                        opacity: assigningId === email.id ? 0.6 : 1,
                      }}
                    >
                      {deal.dealName}
                    </button>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {/* Assign dropdown */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => {
                      setOpenDropdown(openDropdown === email.id ? null : email.id)
                      setDealSearch('')
                    }}
                    disabled={assigningId === email.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      height: '28px', padding: '0 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                      color: 'var(--ds-text-1)', background: 'var(--ds-bg-active)',
                      border: '1px solid var(--ds-border)', cursor: 'pointer',
                    }}
                  >
                    <Check size={11} />
                    Assign to deal
                    <ChevronDown size={10} />
                  </button>

                  {openDropdown === email.id && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                      width: '280px', maxHeight: '240px',
                      background: 'var(--ds-bg-card)', border: '1px solid var(--ds-border)',
                      borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      zIndex: 50, overflow: 'hidden',
                    }}>
                      <div style={{ padding: '6px', borderBottom: '1px solid var(--ds-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 6px', height: '28px', borderRadius: '5px', background: 'var(--ds-bg-hover)' }}>
                          <Search size={11} style={{ color: 'var(--ds-text-3)', flexShrink: 0 }} />
                          <input
                            autoFocus
                            value={dealSearch}
                            onChange={e => setDealSearch(e.target.value)}
                            placeholder="Search deals..."
                            style={{
                              flex: 1, border: 'none', background: 'transparent', outline: 'none',
                              fontSize: '11px', color: 'var(--ds-text-1)',
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ maxHeight: '190px', overflowY: 'auto' }}>
                        {filteredDeals.length === 0 ? (
                          <div style={{ padding: '12px', fontSize: '11px', color: 'var(--ds-text-3)', textAlign: 'center' }}>
                            No deals found
                          </div>
                        ) : (
                          filteredDeals.map(deal => (
                            <button
                              key={deal.id}
                              onClick={() => handleAssign(email.id, deal.id)}
                              style={{
                                display: 'block', width: '100%', textAlign: 'left',
                                padding: '8px 10px', border: 'none', background: 'transparent',
                                cursor: 'pointer', fontSize: '12px', color: 'var(--ds-text-1)',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-bg-hover)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div style={{ fontWeight: 500 }}>{deal.dealName}</div>
                              <div style={{ fontSize: '10px', color: 'var(--ds-text-3)' }}>{deal.prospectCompany}</div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Dismiss */}
                <button
                  onClick={() => handleDismiss(email.id)}
                  disabled={dismissingId === email.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    height: '28px', padding: '0 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                    color: 'var(--ds-text-3)', background: 'transparent',
                    border: '1px solid var(--ds-border)', cursor: 'pointer',
                    opacity: dismissingId === email.id ? 0.6 : 1,
                  }}
                >
                  <X size={11} />
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
