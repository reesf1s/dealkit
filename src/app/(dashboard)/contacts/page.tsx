'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Users, Search, Mail, Phone, Building2, ArrowUpRight,
  UserCircle, Pencil, X, Check,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'

interface Contact {
  id: string
  name: string
  title: string | null
  company: string
  dealId: string
  dealName: string
  dealStage: string
  dealValue: number | null
  email: string | null
  phone: string | null
  source: 'primary' | 'secondary'
  updatedAt: string
}

function stageFmt(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function stageColor(stage: string): string {
  switch (stage) {
    case 'negotiation':   return '#8b5cf6'
    case 'closed_won':    return '#1DB86A'
    case 'proposal':      return '#f59e0b'
    case 'closed_lost':   return '#ef4444'
    case 'discovery':     return '#3b82f6'
    case 'qualification': return '#06b6d4'
    default: return '#aaa'
  }
}

function getInitials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

function Skeleton({ h = 56 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 8 }} />
}

/* ── Edit contact modal ── */

function EditContactModal({
  contact,
  onClose,
  onSaved,
}: {
  contact: Contact
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(contact.name)
  const [title, setTitle] = useState(contact.title ?? '')
  const [email, setEmail] = useState(contact.email ?? '')
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      // Step 1: fetch the current deal to read the live contacts array
      const dealRes = await fetch(`/api/deals/${contact.dealId}`, { credentials: 'include' })
      if (!dealRes.ok) {
        const j = await dealRes.json().catch(() => ({}))
        throw new Error(j.error ?? `Failed to load deal (${dealRes.status})`)
      }
      const dealJson = await dealRes.json()
      const deal = dealJson.data ?? dealJson

      const updatedEntry = {
        name:  name.trim(),
        title: title.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      }

      // Build the PATCH body
      const body: Record<string, unknown> = {}

      if (contact.source === 'primary') {
        // Primary fields live on the deal row itself
        body.prospectName  = updatedEntry.name
        body.prospectTitle = updatedEntry.title

        // If email or phone provided, also upsert into contacts JSONB so they appear in the list
        if (updatedEntry.email || updatedEntry.phone) {
          const arr: any[] = Array.isArray(deal.contacts) ? [...deal.contacts] : []
          // Replace any existing entry for the original name, else prepend
          const origLower = contact.name.toLowerCase()
          const idx = arr.findIndex((c: any) => c.name?.toLowerCase() === origLower)
          if (idx >= 0) {
            arr[idx] = updatedEntry
          } else {
            arr.unshift(updatedEntry)
          }
          body.contacts = arr
        }
      } else {
        // Secondary contact lives entirely in the contacts JSONB array
        const arr: any[] = Array.isArray(deal.contacts) ? [...deal.contacts] : []
        const origLower = contact.name.toLowerCase()
        const idx = arr.findIndex((c: any) => c.name?.toLowerCase() === origLower)
        if (idx >= 0) {
          arr[idx] = updatedEntry
        } else {
          // Fallback: append if not found (shouldn't normally happen)
          arr.push(updatedEntry)
        }
        body.contacts = arr
      }

      // Step 2: PATCH the deal with the constructed body
      const patchRes = await fetch(`/api/deals/${contact.dealId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!patchRes.ok) {
        const j = await patchRes.json().catch(() => ({}))
        throw new Error(j.error ?? `Save failed (${patchRes.status})`)
      }

      onSaved()
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.18)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border-default)',
        borderRadius: 12, padding: 24, width: 380, boxShadow: 'var(--shadow-modal)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Edit contact
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 2 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Full name', value: name, onChange: setName, placeholder: 'Jane Smith', required: true },
            { label: 'Job title', value: title, onChange: setTitle, placeholder: 'Head of Operations' },
            { label: 'Email', value: email, onChange: setEmail, placeholder: 'jane@company.com', type: 'email' },
            { label: 'Phone', value: phone, onChange: setPhone, placeholder: '+44 7700 900000', type: 'tel' },
          ].map(field => (
            <div key={field.label}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {field.label}{field.required && <span style={{ color: 'var(--color-red)', marginLeft: 2 }}>*</span>}
              </label>
              <input
                value={field.value}
                onChange={e => field.onChange(e.target.value)}
                placeholder={field.placeholder}
                type={(field as any).type ?? 'text'}
                style={{
                  width: '100%', height: 36, padding: '0 12px',
                  border: '1px solid var(--border-default)', borderRadius: 7,
                  background: 'var(--surface-2)', color: 'var(--text-primary)',
                  fontSize: 13, outline: 'none', fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
              />
            </div>
          ))}
        </div>

        {error && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-red)', background: 'var(--color-red-bg)', borderRadius: 6, padding: '8px 10px' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              height: 34, padding: '0 16px', borderRadius: 7,
              background: 'var(--surface-2)', border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            style={{
              height: 34, padding: '0 16px', borderRadius: 7,
              background: saving || !name.trim() ? 'var(--surface-3)' : 'var(--text-primary)',
              border: 'none', color: saving || !name.trim() ? 'var(--text-tertiary)' : '#fff',
              fontSize: 13, fontWeight: 500, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'opacity 100ms',
            }}
          >
            {saving ? 'Saving…' : <><Check size={13} /> Save changes</>}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Contact row ── */

function ContactRow({
  contact: c,
  isLast,
  onEdit,
}: {
  contact: Contact
  isLast: boolean
  onEdit: (c: Contact) => void
}) {
  const initials = getInitials(c.name)
  const colors = ['#1DB86A', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']
  const colorIndex = c.name.charCodeAt(0) % colors.length
  const avatarColor = colors[colorIndex]
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '40px 1fr auto',
        gap: 12, padding: '12px 16px',
        alignItems: 'center',
        borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
        background: hovered ? 'var(--surface-hover)' : 'transparent',
        transition: 'background 80ms',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: `${avatarColor}18`,
        border: `1.5px solid ${avatarColor}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: avatarColor,
      }}>
        {initials || <UserCircle size={16} style={{ color: avatarColor }} />}
      </div>

      {/* Info */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {c.name}
          </span>
          {c.title && (
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{c.title}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
          {c.email ? (
            <a href={`mailto:${c.email}`} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11.5, color: 'var(--text-tertiary)', textDecoration: 'none',
            }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--brand)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
              onClick={e => e.stopPropagation()}
            >
              <Mail size={10} /> {c.email}
            </a>
          ) : (
            <button
              onClick={() => onEdit(c)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <Mail size={10} /> <span style={{ fontStyle: 'italic' }}>Add email</span>
            </button>
          )}
          {c.phone ? (
            <a href={`tel:${c.phone}`} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11.5, color: 'var(--text-tertiary)', textDecoration: 'none',
            }}
              onClick={e => e.stopPropagation()}
            >
              <Phone size={10} /> {c.phone}
            </a>
          ) : null}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 10.5, color: stageColor(c.dealStage),
            background: `${stageColor(c.dealStage)}12`,
            borderRadius: 99, padding: '1px 6px',
          }}>
            {stageFmt(c.dealStage)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {/* Edit button — visible on hover */}
        <button
          onClick={() => onEdit(c)}
          title="Edit contact"
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: hovered ? 'var(--surface-3)' : 'transparent',
            border: hovered ? '1px solid var(--border-default)' : '1px solid transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-tertiary)', transition: 'all 80ms',
            opacity: hovered ? 1 : 0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)' }}
        >
          <Pencil size={11} />
        </button>

        {/* Deal link */}
        <Link
          href={`/deals/${c.dealId}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11.5, fontWeight: 500, color: 'var(--brand)',
            textDecoration: 'none', padding: '4px 9px',
            background: 'var(--brand-bg)', border: '1px solid var(--brand-border)',
            borderRadius: 6, whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--brand-bg-hover)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--brand-bg)'}
        >
          {c.dealName.length > 18 ? c.dealName.slice(0, 18) + '…' : c.dealName}
          <ArrowUpRight size={10} />
        </Link>
      </div>
    </div>
  )
}

/* ── Main page ── */

export default function ContactsPage() {
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [editContact, setEditContact] = useState<Contact | null>(null)

  const { data, isLoading, mutate } = useSWR('/api/contacts', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })
  const contacts: Contact[] = data?.data ?? []

  // Build unique company list
  const companies = Array.from(new Set(contacts.map(c => c.company))).sort()

  const filtered = contacts.filter(c => {
    if (companyFilter !== 'all' && c.company !== companyFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        (c.title ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  // Group by company
  const grouped: Record<string, Contact[]> = {}
  for (const c of filtered) {
    if (!grouped[c.company]) grouped[c.company] = []
    grouped[c.company].push(c)
  }

  return (
    <div style={{ paddingTop: 8 }}>

      {/* Edit modal */}
      {editContact && (
        <EditContactModal
          contact={editContact}
          onClose={() => setEditContact(null)}
          onSaved={() => {
            setEditContact(null)
            mutate()
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: 0 }}>
            Contacts
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '3px 0 0' }}>
            Everyone across your pipeline.
          </p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Stats strip */}
      {!isLoading && contacts.length > 0 && (() => {
        const withEmail = contacts.filter(c => c.email).length
        const uniqueCompanies = new Set(contacts.map(c => c.company)).size
        const uniqueDeals = new Set(contacts.map(c => c.dealId)).size
        const avgPerDeal = uniqueDeals > 0 ? (contacts.length / uniqueDeals).toFixed(1) : '—'
        const activeContacts = contacts.filter(c => c.dealStage !== 'closed_won' && c.dealStage !== 'closed_lost').length
        return (
          <div style={{
            display: 'flex', gap: 0, marginBottom: 16, padding: '10px 16px',
            background: 'var(--surface-1)', border: '1px solid var(--border-default)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            {[
              { label: 'Total', value: String(contacts.length), color: 'var(--text-primary)' },
              { label: 'Active deals', value: String(activeContacts), color: '#1DB86A' },
              { label: 'With email', value: String(withEmail), color: '#3b82f6' },
              { label: 'Companies', value: String(uniqueCompanies), color: '#8b5cf6' },
              { label: 'Avg per deal', value: String(avgPerDeal), color: 'var(--text-secondary)' },
            ].map((stat, i) => (
              <div key={stat.label} style={{
                flex: 1, padding: '4px 14px',
                borderRight: i < 4 ? '1px solid var(--border-subtle)' : 'none',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: stat.color, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface-2)', border: '1px solid var(--border-default)', borderRadius: 8,
          padding: '0 12px', height: 36,
        }}>
          <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts, companies, titles…"
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 13, color: 'var(--text-primary)',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
            >
              <X size={13} />
            </button>
          )}
        </div>
        {companies.length > 1 && (
          <select
            value={companyFilter}
            onChange={e => setCompanyFilter(e.target.value)}
            style={{
              height: 36, padding: '0 10px', borderRadius: 8,
              background: 'var(--surface-2)', border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="all">All companies</option>
            {companies.map(co => (
              <option key={co} value={co}>{co}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(6)].map((_, i) => <Skeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 0',
          border: '1px solid var(--border-subtle)', borderRadius: 12,
          background: 'var(--surface-2)',
        }}>
          <Users size={28} style={{ color: 'var(--border-strong)', display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {search ? 'No matching contacts' : 'No contacts yet'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 16 }}>
            {search ? 'Try a different search' : 'Add contacts to your deals to see them here'}
          </div>
          {!search && (
            <Link href="/deals" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12.5, fontWeight: 500, color: 'var(--brand)', textDecoration: 'none',
              padding: '7px 16px', background: 'var(--brand-bg)',
              border: '1px solid var(--brand-border)', borderRadius: 8,
            }}>
              Go to Deals →
            </Link>
          )}
        </div>
      ) : companyFilter === 'all' ? (
        // Grouped view
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(grouped).map(([company, people]) => (
            <div key={company} style={{
              background: 'var(--surface-1)', border: '1px solid var(--border-default)',
              borderRadius: 10, overflow: 'hidden',
            }}>
              {/* Company header */}
              <div style={{
                padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--surface-2)',
              }}>
                <Building2 size={12} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {company}
                </span>
                <span style={{
                  fontSize: 10.5, fontWeight: 500, color: 'var(--text-tertiary)',
                  background: 'var(--surface-3)', borderRadius: 99, padding: '1px 6px',
                }}>
                  {people.length}
                </span>
              </div>
              {/* Contacts in this company */}
              {people.map((c, i) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  isLast={i === people.length - 1}
                  onEdit={setEditContact}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        // Flat list when filtered by company
        <div style={{
          background: 'var(--surface-1)', border: '1px solid var(--border-default)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          {filtered.map((c, i) => (
            <ContactRow
              key={c.id}
              contact={c}
              isLast={i === filtered.length - 1}
              onEdit={setEditContact}
            />
          ))}
        </div>
      )}
    </div>
  )
}
