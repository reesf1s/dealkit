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
  TalkTrackSection,
  ObjectionCategory,
} from '@/types'

interface CollateralViewerProps {
  content: CollateralContent
}

// ─── Shared primitives ─────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#6366F1', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>
      {children}
    </h3>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px', ...style }}>
      {children}
    </div>
  )
}

function BulletList({ items, color = '#EBEBEB' }: { items: string[]; color?: string }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', color, lineHeight: 1.5 }}>
          <span style={{ color: '#6366F1', flexShrink: 0 }}>•</span>
          {item}
        </li>
      ))}
    </ul>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
            {headers.map((h) => (
              <th key={h} style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: '#555', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '10px 12px', fontSize: '13px', color: '#EBEBEB', lineHeight: 1.5 }}>
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
        <p style={{ fontSize: '14px', color: '#EBEBEB', lineHeight: 1.7, margin: 0 }}>{content.summary}</p>
      </Card>

      {/* Strengths grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Card>
          <SectionHeading>Our strengths</SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {content.ourStrengths.map((p, i) => (
              <div key={i}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#22C55E', margin: '0 0 2px' }}>{p.point}</p>
                <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>{p.detail}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionHeading>Their strengths</SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {content.theirStrengths.map((p, i) => (
              <div key={i}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#F59E0B', margin: '0 0 2px' }}>{p.point}</p>
                <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>{p.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Win themes */}
      <Card>
        <SectionHeading>Win themes</SectionHeading>
        <BulletList items={content.winThemes} color="#22C55E" />
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
            <li key={i} style={{ fontSize: '13px', color: '#EBEBEB', lineHeight: 1.5 }}>{l}</li>
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
      <Card style={{ backgroundColor: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#EBEBEB', letterSpacing: '-0.03em', margin: '0 0 6px' }}>{content.headline}</h1>
        <p style={{ fontSize: '15px', color: '#888', margin: '0 0 12px', lineHeight: 1.5 }}>{content.subheadline}</p>
        <p style={{ fontSize: '13px', color: '#6366F1', margin: 0, fontWeight: 500 }}>{content.customerName} — {content.customerDescription}</p>
      </Card>

      {/* Metrics */}
      {content.metrics.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {content.metrics.map((m, i) => (
            <Card key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#22C55E', letterSpacing: '-0.04em' }}>{m.value}</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{m.label}</div>
              {m.description && <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{m.description}</div>}
            </Card>
          ))}
        </div>
      )}

      {/* Sections */}
      {[content.challengeSection, content.solutionSection, content.resultsSection].map((section) => (
        <Card key={section.heading}>
          <SectionHeading>{section.heading}</SectionHeading>
          <p style={{ fontSize: '14px', color: '#EBEBEB', lineHeight: 1.7, margin: 0 }}>{section.body}</p>
        </Card>
      ))}

      {/* Quote */}
      {content.quote && (
        <Card style={{ backgroundColor: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.2)' }}>
          <blockquote style={{ margin: 0 }}>
            <p style={{ fontSize: '16px', color: '#EBEBEB', fontStyle: 'italic', lineHeight: 1.6, margin: '0 0 12px' }}>
              "{content.quote.text}"
            </p>
            <footer style={{ fontSize: '12px', color: '#888' }}>
              <strong style={{ color: '#EBEBEB' }}>{content.quote.author}</strong>
              {', '}{content.quote.title}{', '}{content.quote.company}
            </footer>
          </blockquote>
        </Card>
      )}

      {/* CTA */}
      <Card>
        <p style={{ fontSize: '15px', fontWeight: 600, color: '#6366F1', margin: 0 }}>{content.callToAction}</p>
      </Card>
    </div>
  )
}

// ─── One-pager ─────────────────────────────────────────────────────────────────

function OnePagerViewer({ content }: { content: OnePagerContent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Card style={{ backgroundColor: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#EBEBEB', letterSpacing: '-0.03em', margin: '0 0 6px' }}>{content.headline}</h1>
        <p style={{ fontSize: '15px', color: '#888', margin: 0 }}>{content.subheadline}</p>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Card>
          <SectionHeading>The problem</SectionHeading>
          <p style={{ fontSize: '13px', color: '#EBEBEB', lineHeight: 1.6, margin: 0 }}>{content.problemStatement}</p>
        </Card>
        <Card>
          <SectionHeading>Our solution</SectionHeading>
          <p style={{ fontSize: '13px', color: '#EBEBEB', lineHeight: 1.6, margin: 0 }}>{content.solution}</p>
        </Card>
      </div>

      <Card>
        <SectionHeading>Key benefits</SectionHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          {content.keyBenefits.map((b, i) => (
            <div key={i} style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
              {b.icon && <span style={{ fontSize: '20px', display: 'block', marginBottom: '6px' }}>{b.icon}</span>}
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#EBEBEB', margin: '0 0 4px' }}>{b.title}</p>
              <p style={{ fontSize: '12px', color: '#888', margin: 0, lineHeight: 1.5 }}>{b.description}</p>
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
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'rgba(99,102,241,0.2)', color: '#6366F1', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {step.step}
                </span>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#EBEBEB', margin: '0 0 2px' }}>{step.title}</p>
                  <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>{step.description}</p>
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
              <div key={i} style={{ fontSize: '13px', color: '#888' }}>
                {item.type === 'quote' ? `"${item.content}"` : item.content}
                {item.attribution && <span style={{ color: '#555', fontSize: '12px' }}> — {item.attribution}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ backgroundColor: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}>
        <p style={{ fontSize: '15px', fontWeight: 600, color: '#6366F1', margin: 0 }}>{content.callToAction}</p>
        {content.contactInfo && <p style={{ fontSize: '13px', color: '#888', margin: '6px 0 0' }}>{content.contactInfo}</p>}
      </Card>
    </div>
  )
}

// ─── Objection handler ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<ObjectionCategory, { color: string; bg: string }> = {
  price: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  competitor: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  timing: { color: '#06B6D4', bg: 'rgba(6,182,212,0.1)' },
  authority: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  need: { color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  trust: { color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
  other: { color: '#888', bg: 'rgba(136,136,136,0.1)' },
}

function ObjectionHandlerViewer({ content }: { content: ObjectionHandlerContent }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Card>
        <p style={{ fontSize: '14px', color: '#EBEBEB', lineHeight: 1.7, margin: 0 }}>{content.intro}</p>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {content.objections.map((obj, i) => {
          const catConfig = CATEGORY_COLORS[obj.category]
          const isOpen = openIdx === i
          return (
            <div key={i} style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setOpenIdx(isOpen ? null : i)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ height: '20px', padding: '0 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: catConfig.color, backgroundColor: catConfig.bg, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  {obj.category}
                </span>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: '#EBEBEB' }}>{obj.objection}</span>
                {isOpen ? <ChevronUp size={14} style={{ color: '#888', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: '#888', flexShrink: 0 }} />}
              </button>

              {isOpen && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Response</p>
                      <p style={{ fontSize: '13px', color: '#EBEBEB', lineHeight: 1.6, margin: 0 }}>{obj.response}</p>
                    </div>
                    {obj.followUpQuestion && (
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Follow-up question</p>
                        <p style={{ fontSize: '13px', color: '#888', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>"{obj.followUpQuestion}"</p>
                      </div>
                    )}
                    {obj.proofPoints.length > 0 && (
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Proof points</p>
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
    <div style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#EBEBEB' }}>{title}: {section.title}</span>
        {open ? <ChevronUp size={14} style={{ color: '#888' }} /> : <ChevronDown size={14} style={{ color: '#888' }} />}
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Script</p>
              <p style={{ fontSize: '13px', color: '#EBEBEB', lineHeight: 1.7, margin: 0 }}>{section.script}</p>
            </div>
            {section.keyPoints.length > 0 && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Key points</p>
                <BulletList items={section.keyPoints} />
              </div>
            )}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Transition</p>
              <p style={{ fontSize: '13px', color: '#6366F1', fontStyle: 'italic', margin: 0 }}>"{section.transitionPhrase}"</p>
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
            <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Purpose</p>
            <p style={{ fontSize: '13px', color: '#EBEBEB', margin: 0 }}>{content.purpose}</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Target persona</p>
            <p style={{ fontSize: '13px', color: '#EBEBEB', margin: 0 }}>{content.targetPersona}</p>
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
          <BulletList items={content.tipsAndNotes} color="#888" />
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
            <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Sequence</p>
            <p style={{ fontSize: '13px', color: '#EBEBEB', margin: 0 }}>{content.sequenceName}</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Target persona</p>
            <p style={{ fontSize: '13px', color: '#EBEBEB', margin: 0 }}>{content.targetPersona}</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Goal</p>
            <p style={{ fontSize: '13px', color: '#EBEBEB', margin: 0 }}>{content.goal}</p>
          </div>
        </div>
      </Card>

      {content.emails.map((email) => (
        <div key={email.stepNumber} style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'rgba(139,92,246,0.2)', color: '#8B5CF6', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {email.stepNumber}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#EBEBEB', margin: 0 }}>Day {email.dayOffset}: {email.subject}</p>
              <p style={{ fontSize: '11px', color: '#555', margin: '2px 0 0' }}>{email.previewText}</p>
            </div>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Email body</p>
              <p style={{ fontSize: '13px', color: '#EBEBEB', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{email.body}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>CTA</p>
                <p style={{ fontSize: '13px', color: '#6366F1', fontWeight: 500, margin: 0 }}>{email.callToAction}</p>
              </div>
              {email.sendingTips.length > 0 && (
                <div>
                  <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Sending tips</p>
                  <BulletList items={email.sendingTips} color="#888" />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Router ────────────────────────────────────────────────────────────────────

export function CollateralViewer({ content }: CollateralViewerProps) {
  switch (content.type) {
    case 'battlecard':
      return <BattlecardViewer content={content} />
    case 'case_study_doc':
      return <CaseStudyDocViewer content={content} />
    case 'one_pager':
      return <OnePagerViewer content={content} />
    case 'objection_handler':
      return <ObjectionHandlerViewer content={content} />
    case 'talk_track':
      return <TalkTrackViewer content={content} />
    case 'email_sequence':
      return <EmailSequenceViewer content={content} />
    default:
      return (
        <div style={{ padding: '24px', textAlign: 'center', color: '#555', fontSize: '13px' }}>
          Unknown collateral type.
        </div>
      )
  }
}
