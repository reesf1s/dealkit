'use client'

import { useState } from 'react'
import { Shield, TrendingUp, Sparkles, Brain } from 'lucide-react'

const TABS = [
  {
    id: 'collateral',
    label: 'AI Collateral',
    icon: Sparkles,
    headline: 'Sales docs that write themselves',
    subline: 'Six types of collateral generated from your actual deal data — not templates.',
    color: '#5e6ad2',
    accentBg: 'rgba(94,106,210,0.06)',
    accentBorder: 'rgba(94,106,210,0.20)',
    preview: {
      title: 'Battlecard: vs Salesforce',
      badge: 'Ready',
      badgeColor: '#0f7b6c',
      items: [
        { label: 'Win angle', value: 'Faster implementation — 6 weeks vs 6 months', color: '#0f7b6c' },
        { label: 'Top objection', value: '"We already use Salesforce" → highlight integration cost', color: '#cb6c2c' },
        { label: 'Landmine', value: 'Ask about their data migration history', color: '#e03e3e' },
        { label: 'Proof point', value: 'Acme Corp: 40% reduction in admin time after switch', color: '#787774' },
      ],
    },
  },
  {
    id: 'pipeline',
    label: 'Pipeline View',
    icon: TrendingUp,
    headline: 'Every deal, every stage, in one place',
    subline: 'Track deals from first contact to close. AI scores win probability and flags stale deals.',
    color: '#0f7b6c',
    accentBg: 'rgba(15,123,108,0.06)',
    accentBorder: 'rgba(15,123,108,0.2)',
    preview: {
      title: 'Pipeline',
      badge: '6 open',
      badgeColor: '#0f7b6c',
      items: [
        { label: 'Acme Corp', value: '£32k · Negotiation · Score: 82', color: '#e03e3e' },
        { label: 'Stripe', value: '£18k · Discovery · Score: 61', color: '#5e6ad2' },
        { label: 'Issue link', value: '£12k · Proposal · Score: 55', color: '#cb6c2c' },
        { label: 'Vercel', value: '£9k · Qualification · Score: 40', color: '#2e78c6' },
      ],
    },
  },
  {
    id: 'intel',
    label: 'Competitive Intel',
    icon: Shield,
    headline: 'Know every competitor inside out',
    subline: 'Track their strengths, weaknesses, and pricing. AI generates a battlecard the moment you add them.',
    color: '#cb6c2c',
    accentBg: 'rgba(203,108,44,0.06)',
    accentBorder: 'rgba(203,108,44,0.2)',
    preview: {
      title: 'Competitor: HubSpot',
      badge: 'Battlecard ready',
      badgeColor: '#cb6c2c',
      items: [
        { label: 'Their strength', value: 'Brand recognition + marketing suite bundling', color: '#e03e3e' },
        { label: 'Their weakness', value: 'Sales-only teams overpay for unused features', color: '#0f7b6c' },
        { label: 'Win rate vs them', value: '71% (9 wins, 4 losses)', color: '#787774' },
        { label: 'Key differentiator', value: 'Halvex costs 4x less for sales-only teams', color: '#0f7b6c' },
      ],
    },
  },
  {
    id: 'knowledge',
    label: 'Win Intelligence',
    icon: Brain,
    headline: 'Every loss makes you stronger',
    subline: 'Log case studies from wins. Track product gaps from losses. The AI gets smarter with every deal.',
    color: '#5e6ad2',
    accentBg: 'rgba(94,106,210,0.06)',
    accentBorder: 'rgba(94,106,210,0.2)',
    preview: {
      title: 'Win Intelligence',
      badge: 'Updated today',
      badgeColor: '#5e6ad2',
      items: [
        { label: 'Win rate', value: '68% (up from 41% at launch)', color: '#0f7b6c' },
        { label: 'Top loss reason', value: 'Pricing objection (7 deals) — objection handler ready', color: '#e03e3e' },
        { label: 'Top win factor', value: 'Fast implementation beats enterprise alternatives', color: '#0f7b6c' },
        { label: 'Revenue at risk', value: '£24k blocked by 3 product gaps in roadmap', color: '#cb6c2c' },
      ],
    },
  },
]

export default function FeaturesTab() {
  const [active, setActive] = useState('collateral')
  const tab = TABS.find(t => t.id === active) ?? TABS[0]

  return (
    <section id="features" style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '0 32px 100px' }}>
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h2 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.04em', marginBottom: '12px', color: '#37352f' }}>
          Everything in one place
        </h2>
        <p style={{ color: '#787774', fontSize: '15px' }}>
          From first call to closed deal — Halvex has the context you need at every stage.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.09)', borderRadius: '10px', padding: '4px', marginBottom: '20px' }}>
        {TABS.map(t => {
          const Icon = t.icon
          const isActive = t.id === active
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '9px 12px', borderRadius: '7px', fontSize: '13px', fontWeight: '600',
                cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                background: isActive ? '#ffffff' : 'transparent',
                color: isActive ? '#37352f' : '#9b9a97',
                boxShadow: isActive ? '0 1px 3px rgba(55,53,47,0.06)' : 'none',
              }}
            >
              <Icon size={13} color={isActive ? t.color : '#9b9a97'} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'center' }}>
        {/* Left: description */}
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 12px', background: tab.accentBg, border: `1px solid ${tab.accentBorder}`, borderRadius: '100px', fontSize: '12px', color: tab.color, fontWeight: '600', marginBottom: '20px' }}>
            <tab.icon size={11} />
            {tab.label}
          </div>
          <h3 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.04em', color: '#37352f', marginBottom: '14px', lineHeight: '1.15' }}>
            {tab.headline}
          </h3>
          <p style={{ fontSize: '15px', color: '#787774', lineHeight: '1.7', marginBottom: '28px' }}>
            {tab.subline}
          </p>

          {/* Feature bullet points per tab */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tab.id === 'collateral' && [
              'Battlecards, one-pagers, talk tracks, email sequences',
              'Grounded in your real competitors and case studies',
              'Regenerates automatically when deal intel changes',
              'Export to .docx for sharing with your team',
            ].map(f => (
              <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(55,53,47,0.06)', border: '1px solid rgba(55,53,47,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: tab.color }} />
                </div>
                <span style={{ fontSize: '13px', color: '#787774', lineHeight: '1.5' }}>{f}</span>
              </div>
            ))}
            {tab.id === 'pipeline' && [
              'Kanban view sorted by stage and urgency',
              'AI win probability score for every deal',
              'Pending todos pulled into dashboard priority list',
              'Meeting prep generated from deal notes in seconds',
            ].map(f => (
              <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(15,123,108,0.10)', border: '1px solid rgba(15,123,108,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: tab.color }} />
                </div>
                <span style={{ fontSize: '13px', color: '#787774', lineHeight: '1.5' }}>{f}</span>
              </div>
            ))}
            {tab.id === 'intel' && [
              'Track strengths, weaknesses, pricing, and key features',
              'Battlecard auto-generated on competitor creation',
              'Win/loss rates tracked per competitor',
              'Cross-deal alerts when same competitor appears in multiple deals',
            ].map(f => (
              <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(203,108,44,0.10)', border: '1px solid rgba(203,108,44,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: tab.color }} />
                </div>
                <span style={{ fontSize: '13px', color: '#787774', lineHeight: '1.5' }}>{f}</span>
              </div>
            ))}
            {tab.id === 'knowledge' && [
              'Case studies auto-turned into proof points for collateral',
              'Product gaps tracked by frequency and blocked revenue',
              'Loss reason patterns surface across your pipeline',
              'Daily AI overview summarises pipeline every morning',
            ].map(f => (
              <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(94,106,210,0.10)', border: '1px solid rgba(94,106,210,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: tab.color }} />
                </div>
                <span style={{ fontSize: '13px', color: '#787774', lineHeight: '1.5' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: mini UI preview */}
        <div style={{ background: '#ffffff', border: `1px solid ${tab.accentBorder}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(55,53,47,0.08), 0 1px 3px rgba(55,53,47,0.06)' }}>
          {/* Mini title bar */}
          <div style={{ padding: '8px 14px', background: '#f7f6f3', borderBottom: '1px solid rgba(55,53,47,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {[1, 2, 3].map(i => <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(55,53,47,0.12)' }} />)}
            </div>
            <span style={{ fontSize: '10px', color: '#9b9a97', fontWeight: '500' }}>{tab.preview.title}</span>
            <span style={{ fontSize: '9px', color: tab.preview.badgeColor, background: `${tab.preview.badgeColor}18`, border: `1px solid ${tab.preview.badgeColor}30`, padding: '2px 8px', borderRadius: '100px', fontWeight: '600' }}>
              {tab.preview.badge}
            </span>
          </div>

          {/* Preview content */}
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tab.preview.items.map((item, i) => (
                <div key={i} style={{ background: '#f7f6f3', border: '1px solid rgba(55,53,47,0.09)', borderRadius: '8px', padding: '10px 12px', borderLeft: `3px solid ${item.color}` }}>
                  <div style={{ fontSize: '10px', color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600', marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontSize: '12px', color: '#37352f', lineHeight: '1.5' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
