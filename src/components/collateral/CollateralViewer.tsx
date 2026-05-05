'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type {
  CollateralContent,
  BattlecardContent,
  CaseStudyDocContent,
  OnePagerContent,
  ObjectionHandlerContent,
  TalkTrackContent,
  EmailSequenceContent,
  FreeformCollateralContent,
  TalkTrackSection,
  ObjectionCategory,
} from '@/types'

interface CollateralViewerProps {
  content: CollateralContent
}

// ─── Shared primitives ─────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#787774', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>
      {children}
    </h3>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(55,53,47,0.12)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(55,53,47,0.06)', padding: '16px', ...style }}>
      {children}
    </div>
  )
}

function BulletList({ items, color = '#37352f' }: { items: string[]; color?: string }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', color, lineHeight: 1.5 }}>
          <span style={{ color: '#9b9a97', flexShrink: 0 }}>•</span>
          {item}
        </li>
      ))}
    </ul>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid rgba(55,53,47,0.09)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f7f6f3' }}>
            {headers.map((h) => (
              <th key={h} style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: '#787774', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid rgba(55,53,47,0.09)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(55,53,47,0.09)' : 'none' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '10px 12px', fontSize: '13px', color: '#37352f', lineHeight: 1.5 }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Battlecard ────────────────────────────────────────────────────────────────

function BattlecardViewer({ content }: { content: BattlecardContent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Summary */}
      <Card>
        <SectionHeading>Executive summary</SectionHeading>
        <p style={{ fontSize: '14px', color: '#37352f', lineHeight: 1.7, margin: 0 }}>{content.summary}</p>
      </Card>

      {/* Strengths grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Card>
          <SectionHeading>Our strengths</SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {content.ourStrengths.map((p, i) => (
              <div key={i}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f7b6c', margin: '0 0 2px' }}>{p.point}</p>
                <p style={{ fontSize: '12px', color: '#787774', margin: 0 }}>{p.detail}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionHeading>Their strengths</SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {content.theirStrengths.map((p, i) => (
              <div key={i}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#cb6c2c', margin: '0 0 2px' }}>{p.point}</p>
                <p style={{ fontSize: '12px', color: '#787774', margin: 0 }}>{p.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Win themes */}
      <Card>
        <SectionHeading>Win themes</SectionHeading>
        <BulletList items={content.winThemes} color="#0f7b6c" />
      </Card>

      {/* Objection responses */}
      <Card>
        <SectionHeading>Objection responses</SectionHeading>
        <Table
          headers={['Objection', 'Response', 'Proof Point']}
          rows={content.objectionResponses.map((o) => [o.objection, o.response, o.proofPoint ?? '—'])}
        />
      </Card>

      {/* Landmines */}
      <Card>
        <SectionHeading>Landmines to plant</SectionHeading>
        <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {content.landmines.map((l, i) => (
            <li key={i} style={{ fontSize: '13px', color: '#37352f', lineHeight: 1.5 }}>{l}</li>
          ))}
        </ol>
      </Card>

      {/* Discovery questions */}
      {content.discoveryQuestions.length > 0 && (
        <Card>
          <SectionHeading>Discovery questions</SectionHeading>
          <BulletList items={content.discoveryQuestions} />
        </Card>
      )}

      {/* Proof points */}
      {content.proofPoints.length > 0 && (
        <Card>
          <SectionHeading>Proof points</SectionHeading>
          <BulletList items={content.proofPoints} />
        </Card>
      )}
    </div>
  )
}

// ─── Case study doc ────────────────────────────────────────────────────────────

function CaseStudyDocViewer({ content }: { content: CaseStudyDocContent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hero */}
      <Card style={{ backgroundColor: '#f7f6f3', borderColor: 'rgba(55,53,47,0.12)' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#37352f', letterSpacing: 0, margin: '0 0 6px' }}>{content.headline}</h1>
        <p style={{ fontSize: '15px', color: '#787774', margin: '0 0 12px', lineHeight: 1.5 }}>{content.subheadline}</p>
        <p style={{ fontSize: '13px', color: '#37352f', margin: 0, fontWeight: 500 }}>{content.customerName} — {content.customerDescription}</p>
      </Card>

      {/* Metrics */}
      {content.metrics.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {content.metrics.map((m, i) => (
            <Card key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f7b6c', letterSpacing: 0 }}>{m.value}</div>
              <div style={{ fontSize: '12px', color: '#787774', marginTop: '4px' }}>{m.label}</div>
              {m.description && <div style={{ fontSize: '11px', color: '#9b9a97', marginTop: '2px' }}>{m.description}</div>}
            </Card>
          ))}
        </div>
      )}

      {/* Sections */}
      {[content.challengeSection, content.solutionSection, content.resultsSection].map((section) => (
        <Card key={section.heading}>
          <SectionHeading>{section.heading}</SectionHeading>
          <p style={{ fontSize: '14px', color: '#37352f', lineHeight: 1.7, margin: 0 }}>{section.body}</p>
        </Card>
      ))}

      {/* Quote */}
      {content.quote && (
        <Card style={{ backgroundColor: 'rgba(15,123,108,0.05)', borderColor: 'rgba(15,123,108,0.20)' }}>
          <blockquote style={{ margin: 0 }}>
            <p style={{ fontSize: '16px', color: '#37352f', fontStyle: 'italic', lineHeight: 1.6, margin: '0 0 12px' }}>
              &ldquo;{content.quote.text}&rdquo;
            </p>
            <footer style={{ fontSize: '12px', color: '#787774' }}>
              <strong style={{ color: '#37352f' }}>{content.quote.author}</strong>
              {', '}{content.quote.title}{', '}{content.quote.company}
            </footer>
          </blockquote>
        </Card>
      )}

      {/* CTA */}
      <Card>
        <p style={{ fontSize: '15px', fontWeight: 600, color: '#37352f', margin: 0 }}>{content.callToAction}</p>
      </Card>
    </div>
  )
}

// ─── One-pager ─────────────────────────────────────────────────────────────────

function OnePagerViewer({ content }: { content: OnePagerContent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Card style={{ backgroundColor: '#f7f6f3', borderColor: 'rgba(55,53,47,0.12)' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#37352f', letterSpacing: 0, margin: '0 0 6px' }}>{content.headline}</h1>
        <p style={{ fontSize: '15px', color: '#787774', margin: 0 }}>{content.subheadline}</p>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Card>
          <SectionHeading>The problem</SectionHeading>
          <p style={{ fontSize: '13px', color: '#37352f', lineHeight: 1.6, margin: 0 }}>{content.problemStatement}</p>
        </Card>
        <Card>
          <SectionHeading>Our solution</SectionHeading>
          <p style={{ fontSize: '13px', color: '#37352f', lineHeight: 1.6, margin: 0 }}>{content.solution}</p>
        </Card>
      </div>

      <Card>
        <SectionHeading>Key benefits</SectionHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          {content.keyBenefits.map((b, i) => (
            <div key={i} style={{ padding: '12px', backgroundColor: '#f7f6f3', borderRadius: '6px', border: '1px solid rgba(55,53,47,0.09)' }}>
              {b.icon && <span style={{ fontSize: '20px', display: 'block', marginBottom: '6px' }}>{b.icon}</span>}
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#37352f', margin: '0 0 4px' }}>{b.title}</p>
              <p style={{ fontSize: '12px', color: '#787774', margin: 0, lineHeight: 1.5 }}>{b.description}</p>
            </div>
          ))}
        </div>
      </Card>

      {content.howItWorks.length > 0 && (
        <Card>
          <SectionHeading>How it works</SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {content.howItWorks.map((step) => (
              <div key={step.step} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'rgba(55,53,47,0.08)', color: '#37352f', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {step.step}
                </span>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#37352f', margin: '0 0 2px' }}>{step.title}</p>
                  <p style={{ fontSize: '12px', color: '#787774', margin: 0 }}>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {content.socialProof.length > 0 && (
        <Card>
          <SectionHeading>Social proof</SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {content.socialProof.map((item, i) => (
              <div key={i} style={{ fontSize: '13px', color: '#787774' }}>
                {item.type === 'quote' ? `"${item.content}"` : item.content}
                {item.attribution && <span style={{ color: '#9b9a97', fontSize: '12px' }}> — {item.attribution}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ backgroundColor: '#f7f6f3', borderColor: 'rgba(55,53,47,0.12)' }}>
        <p style={{ fontSize: '15px', fontWeight: 600, color: '#37352f', margin: 0 }}>{content.callToAction}</p>
        {content.contactInfo && <p style={{ fontSize: '13px', color: '#787774', margin: '6px 0 0' }}>{content.contactInfo}</p>}
      </Card>
    </div>
  )
}

// ─── Objection handler ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<ObjectionCategory, { color: string; bg: string }> = {
  price: { color: '#e03e3e', bg: 'rgba(224,62,62,0.08)' },
  competitor: { color: '#cb6c2c', bg: 'rgba(203,108,44,0.08)' },
  timing: { color: '#0f7b6c', bg: 'rgba(15,123,108,0.08)' },
  authority: { color: 'var(--brand)', bg: 'var(--brand-bg)' },
  need: { color: '#0f7b6c', bg: 'rgba(15,123,108,0.08)' },
  trust: { color: 'var(--brand)', bg: 'var(--brand-bg)' },
  other: { color: '#787774', bg: 'rgba(55,53,47,0.06)' },
}

function ObjectionHandlerViewer({ content }: { content: ObjectionHandlerContent }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Card>
        <p style={{ fontSize: '14px', color: '#37352f', lineHeight: 1.7, margin: 0 }}>{content.intro}</p>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {content.objections.map((obj, i) => {
          const catConfig = CATEGORY_COLORS[obj.category]
          const isOpen = openIdx === i
          return (
            <div key={i} style={{ background: 'var(--surface-1)', border: '1px solid rgba(55,53,47,0.12)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(55,53,47,0.06)', overflow: 'hidden' }}>
              <button
                onClick={() => setOpenIdx(isOpen ? null : i)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ height: '20px', padding: '0 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: catConfig.color, backgroundColor: catConfig.bg, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  {obj.category}
                </span>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: '#37352f' }}>{obj.objection}</span>
                {isOpen ? <ChevronUp size={14} style={{ color: '#787774', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: '#787774', flexShrink: 0 }} />}
              </button>

              {isOpen && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(55,53,47,0.09)' }}>
                  <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 600, color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Response</p>
                      <p style={{ fontSize: '13px', color: '#37352f', lineHeight: 1.6, margin: 0 }}>{obj.response}</p>
                    </div>
                    {obj.followUpQuestion && (
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Follow-up question</p>
                        <p style={{ fontSize: '13px', color: '#787774', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>&quot;{obj.followUpQuestion}&quot;</p>
                      </div>
                    )}
                    {obj.proofPoints.length > 0 && (
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Proof points</p>
                        <BulletList items={obj.proofPoints} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {content.closingTips.length > 0 && (
        <Card>
          <SectionHeading>Closing tips</SectionHeading>
          <BulletList items={content.closingTips} />
        </Card>
      )}
    </div>
  )
}

// ─── Talk track ────────────────────────────────────────────────────────────────

function TalkTrackSectionCard({ section, title }: { section: TalkTrackSection; title: string }) {
  const [open, setOpen] = useState(true)

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(55,53,47,0.12)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(55,53,47,0.06)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#37352f' }}>{title}: {section.title}</span>
        {open ? <ChevronUp size={14} style={{ color: '#787774' }} /> : <ChevronDown size={14} style={{ color: '#787774' }} />}
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(55,53,47,0.09)' }}>
          <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Script</p>
              <p style={{ fontSize: '13px', color: '#37352f', lineHeight: 1.7, margin: 0 }}>{section.script}</p>
            </div>
            {section.keyPoints.length > 0 && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Key points</p>
                <BulletList items={section.keyPoints} />
              </div>
            )}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Transition</p>
              <p style={{ fontSize: '13px', color: '#787774', fontStyle: 'italic', margin: 0 }}>&quot;{section.transitionPhrase}&quot;</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TalkTrackViewer({ content }: { content: TalkTrackContent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '11px', color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Purpose</p>
            <p style={{ fontSize: '13px', color: '#37352f', margin: 0 }}>{content.purpose}</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Target persona</p>
            <p style={{ fontSize: '13px', color: '#37352f', margin: 0 }}>{content.targetPersona}</p>
          </div>
        </div>
      </Card>

      {[
        { section: content.opener, title: '1. Opener' },
        { section: content.discovery, title: '2. Discovery' },
        { section: content.pitchSection, title: '3. Pitch' },
        { section: content.objectionHandling, title: '4. Objection handling' },
        { section: content.close, title: '5. Close' },
      ].map(({ section, title }) => (
        <TalkTrackSectionCard key={title} section={section} title={title} />
      ))}

      {content.tipsAndNotes.length > 0 && (
        <Card>
          <SectionHeading>Tips & notes</SectionHeading>
          <BulletList items={content.tipsAndNotes} color="#787774" />
        </Card>
      )}
    </div>
  )
}

// ─── Email sequence ────────────────────────────────────────────────────────────

function EmailSequenceViewer({ content }: { content: EmailSequenceContent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '11px', color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Sequence</p>
            <p style={{ fontSize: '13px', color: '#37352f', margin: 0 }}>{content.sequenceName}</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Target persona</p>
            <p style={{ fontSize: '13px', color: '#37352f', margin: 0 }}>{content.targetPersona}</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Goal</p>
            <p style={{ fontSize: '13px', color: '#37352f', margin: 0 }}>{content.goal}</p>
          </div>
        </div>
      </Card>

      {content.emails.map((email) => (
        <div key={email.stepNumber} style={{ background: 'var(--surface-1)', border: '1px solid rgba(55,53,47,0.12)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(55,53,47,0.06)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid rgba(55,53,47,0.09)', backgroundColor: '#f7f6f3' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--brand-bg)', color: 'var(--brand)', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {email.stepNumber}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#37352f', margin: 0 }}>Day {email.dayOffset}: {email.subject}</p>
              <p style={{ fontSize: '11px', color: '#787774', margin: '2px 0 0' }}>{email.previewText}</p>
            </div>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <p style={{ fontSize: '11px', color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Email body</p>
              <p style={{ fontSize: '13px', color: '#37352f', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{email.body}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ fontSize: '11px', color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>CTA</p>
                <p style={{ fontSize: '13px', color: '#37352f', fontWeight: 500, margin: 0 }}>{email.callToAction}</p>
              </div>
              {email.sendingTips.length > 0 && (
                <div>
                  <p style={{ fontSize: '11px', color: '#9b9a97', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Sending tips</p>
                  <BulletList items={email.sendingTips} color="#787774" />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Freeform / Markdown viewer ─────────────────────────────────────────────

function FreeformViewer({ content }: { content: FreeformCollateralContent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {content.sections.map((section, i) => (
        <Card key={i}>
          <SectionHeading>{section.heading}</SectionHeading>
          <div
            style={{ fontSize: '13px', color: '#37352f', lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: markdownToHtml(section.content) }}
          />
        </Card>
      ))}
    </div>
  )
}

/** Lightweight markdown → HTML for section content (bold, italic, bullets, headings) */
function markdownToHtml(md: string): string {
  return md
    .replace(/^#### (.+)$/gm, '<h4 style="font-size:13px;font-weight:700;color:#37352f;margin:12px 0 6px">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;color:#37352f;margin:14px 0 6px">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#37352f">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-•] (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#9b9a97;flex-shrink:0">•</span><span>$1</span></div>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

// ─── Router ────────────────────────────────────────────────────────────────────

function isFreeform(content: CollateralContent): content is FreeformCollateralContent {
  return 'format' in content && (content as FreeformCollateralContent).format === 'markdown'
}

export function CollateralViewer({ content }: CollateralViewerProps) {
  // Check freeform first (custom type uses format: 'markdown')
  if (isFreeform(content)) return <FreeformViewer content={content} />

  switch ((content as { type?: string }).type) {
    case 'battlecard':
      return <BattlecardViewer content={content as BattlecardContent} />
    case 'case_study_doc':
      return <CaseStudyDocViewer content={content as CaseStudyDocContent} />
    case 'one_pager':
      return <OnePagerViewer content={content as OnePagerContent} />
    case 'objection_handler':
      return <ObjectionHandlerViewer content={content as ObjectionHandlerContent} />
    case 'talk_track':
      return <TalkTrackViewer content={content as TalkTrackContent} />
    case 'email_sequence':
      return <EmailSequenceViewer content={content as EmailSequenceContent} />
    default:
      return (
        <div style={{ padding: '24px', textAlign: 'center', color: '#787774', fontSize: '13px' }}>
          Unknown collateral type.
        </div>
      )
  }
}
