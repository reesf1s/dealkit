import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  BorderStyle,
  Packer,
  WidthType,
  ShadingType,
  convertInchesToTwip,
} from 'docx'
import type {
  CollateralContent,
  BattlecardContent,
  CaseStudyDocContent,
  OnePagerContent,
  ObjectionHandlerContent,
  TalkTrackContent,
  EmailSequenceContent,
} from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FONT = 'Arial'
const BODY_SIZE = 22 // half-points (11pt)
const H1_SIZE = 32 // 16pt
const H2_SIZE = 26 // 13pt
const MARGIN = convertInchesToTwip(1)

const BORDER_THIN = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared paragraph helpers
// ─────────────────────────────────────────────────────────────────────────────

function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200, before: 400 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: H1_SIZE,
        font: FONT,
        color: '111111',
      }),
    ],
  })
}

function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { after: 120, before: 320 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: H2_SIZE,
        font: FONT,
        color: '222222',
      }),
    ],
  })
}

function body(text: string, opts?: { bold?: boolean; italic?: boolean; color?: string }): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        size: BODY_SIZE,
        font: FONT,
        bold: opts?.bold,
        italics: opts?.italic,
        color: opts?.color ?? '333333',
      }),
    ],
  })
}

function bullet(text: string, level = 0): Paragraph {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 80 },
    children: [
      new TextRun({
        text,
        size: BODY_SIZE,
        font: FONT,
        color: '333333',
      }),
    ],
  })
}

function numberedItem(text: string, num: number): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text: `${num}. ${text}`,
        size: BODY_SIZE,
        font: FONT,
        color: '333333',
      }),
    ],
  })
}

function spacer(): Paragraph {
  return new Paragraph({ spacing: { after: 200 } })
}

function divider(): Paragraph {
  return new Paragraph({
    spacing: { after: 200, before: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
    },
    children: [],
  })
}

function labelledText(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: BODY_SIZE, font: FONT, color: '111111' }),
      new TextRun({ text: value, size: BODY_SIZE, font: FONT, color: '444444' }),
    ],
  })
}

function headerCell(text: string): TableCell {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: '2D2D2D', fill: '2D2D2D' },
    borders: BORDER_THIN,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            size: BODY_SIZE,
            font: FONT,
            color: 'FFFFFF',
          }),
        ],
      }),
    ],
  })
}

function dataCell(text: string, shade?: string): TableCell {
  return new TableCell({
    shading: shade ? { type: ShadingType.SOLID, color: shade, fill: shade } : undefined,
    borders: BORDER_THIN,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: BODY_SIZE, font: FONT, color: '333333' })],
      }),
    ],
  })
}

function makeDoc(children: Paragraph[] | (Paragraph | Table)[]): Document {
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
              right: MARGIN,
            },
          },
        },
        children: children as Paragraph[],
      },
    ],
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Battlecard
// ─────────────────────────────────────────────────────────────────────────────

function generateBattlecardDocx(content: BattlecardContent): Document {
  const children: (Paragraph | Table)[] = []

  children.push(h1(`Battlecard: vs ${content.competitor}`))
  children.push(body(content.summary, { italic: true, color: '555555' }))
  children.push(spacer())

  // Key differences — 3-column comparison table
  children.push(h2('Competitive Comparison'))

  if (content.ourStrengths.length > 0 || content.theirStrengths.length > 0) {
    const maxRows = Math.max(content.ourStrengths.length, content.theirStrengths.length, content.ourWeaknesses.length)
    const compRows: TableRow[] = [
      new TableRow({
        children: [
          headerCell('Our Strengths'),
          headerCell(`${content.competitor} Strengths`),
          headerCell('Our Weaknesses (& Mitigation)'),
        ],
      }),
    ]

    for (let i = 0; i < maxRows; i++) {
      const ours = content.ourStrengths[i]
      const theirs = content.theirStrengths[i]
      const weak = content.ourWeaknesses[i]

      compRows.push(
        new TableRow({
          children: [
            dataCell(ours ? `${ours.point} — ${ours.detail}` : ''),
            dataCell(theirs ? `${theirs.point} — ${theirs.detail}` : '', 'FEF9EE'),
            dataCell(weak ? `${weak.point} — ${weak.detail}` : ''),
          ],
        }),
      )
    }

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: compRows,
      }),
    )
    children.push(spacer())
  }

  // Win themes
  children.push(h2('Win Themes'))
  content.winThemes.forEach((t) => children.push(bullet(t)))
  children.push(spacer())

  // Landmines
  children.push(h2('Landmine Questions'))
  children.push(body('Ask these to expose competitor weaknesses:', { italic: true }))
  content.landmines.forEach((l, i) => children.push(numberedItem(l, i + 1)))
  children.push(spacer())

  // Discovery questions
  children.push(h2('Discovery Questions (that set us up to win)'))
  content.discoveryQuestions.forEach((q) => children.push(bullet(q)))
  children.push(spacer())

  // Objection responses — 2-column table
  children.push(h2('Objection Responses'))

  if (content.objectionResponses.length > 0) {
    const objRows: TableRow[] = [
      new TableRow({
        children: [headerCell('Objection'), headerCell('Response & Proof Point')],
      }),
    ]

    content.objectionResponses.forEach((o) => {
      const responseText = o.proofPoint ? `${o.response}\n\nProof: ${o.proofPoint}` : o.response
      objRows.push(
        new TableRow({
          children: [dataCell(o.objection, 'F9F9F9'), dataCell(responseText)],
        }),
      )
    })

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: objRows,
      }),
    )
    children.push(spacer())
  }

  // Proof points
  children.push(h2('Proof Points'))
  content.proofPoints.forEach((p) => children.push(bullet(p)))

  return makeDoc(children)
}

// ─────────────────────────────────────────────────────────────────────────────
// Case Study
// ─────────────────────────────────────────────────────────────────────────────

function generateCaseStudyDocx(content: CaseStudyDocContent): Document {
  const children: (Paragraph | Table)[] = []

  children.push(h1(content.headline))
  children.push(body(content.subheadline, { italic: true, color: '555555' }))
  children.push(spacer())

  children.push(h2('Client Profile'))
  children.push(body(`${content.customerName} — ${content.customerDescription}`))
  children.push(spacer())

  // Results metrics table
  if (content.metrics.length > 0) {
    children.push(h2('Results at a Glance'))
    const metricRows: TableRow[] = [
      new TableRow({
        children: [headerCell('Metric'), headerCell('Result'), headerCell('Context')],
      }),
      ...content.metrics.map(
        (m) =>
          new TableRow({
            children: [
              dataCell(m.label),
              dataCell(m.value, 'F0FDF4'),
              dataCell(m.description ?? ''),
            ],
          }),
      ),
    ]
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: metricRows,
      }),
    )
    children.push(spacer())
  }

  children.push(h2(content.challengeSection.heading))
  content.challengeSection.body.split('\n\n').forEach((para) => {
    if (para.trim()) children.push(body(para.trim()))
  })
  children.push(spacer())

  children.push(h2(content.solutionSection.heading))
  content.solutionSection.body.split('\n\n').forEach((para) => {
    if (para.trim()) children.push(body(para.trim()))
  })
  children.push(spacer())

  children.push(h2(content.resultsSection.heading))
  content.resultsSection.body.split('\n\n').forEach((para) => {
    if (para.trim()) children.push(body(para.trim()))
  })
  children.push(spacer())

  // Testimonial quote block
  if (content.quote) {
    const q = content.quote
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 120 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 8, color: '6366F1' },
        },
        indent: { left: 360 },
        children: [
          new TextRun({
            text: `"${q.text}"`,
            italics: true,
            size: BODY_SIZE,
            font: FONT,
            color: '444444',
          }),
        ],
      }),
    )
    children.push(
      new Paragraph({
        indent: { left: 360 },
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: `— ${q.author}, ${q.title}, ${q.company}`,
            bold: true,
            size: BODY_SIZE - 2,
            font: FONT,
            color: '666666',
          }),
        ],
      }),
    )
    children.push(spacer())
  }

  children.push(divider())
  children.push(body(content.callToAction, { bold: true }))

  return makeDoc(children)
}

// ─────────────────────────────────────────────────────────────────────────────
// One-Pager
// ─────────────────────────────────────────────────────────────────────────────

function generateOnePagerDocx(content: OnePagerContent): Document {
  const children: (Paragraph | Table)[] = []

  children.push(h1(content.headline))
  children.push(body(content.subheadline, { italic: true, color: '555555' }))
  children.push(spacer())

  children.push(h2('The Problem'))
  children.push(body(content.problemStatement))

  children.push(h2('The Solution'))
  children.push(body(content.solution))
  children.push(spacer())

  // Features table
  if (content.keyBenefits.length > 0) {
    children.push(h2('Key Benefits'))
    const benefitRows: TableRow[] = [
      new TableRow({
        children: [headerCell('Benefit'), headerCell('What It Means for You')],
      }),
      ...content.keyBenefits.map(
        (b) =>
          new TableRow({
            children: [dataCell(b.title, 'F9F9F9'), dataCell(b.description)],
          }),
      ),
    ]
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: benefitRows,
      }),
    )
    children.push(spacer())
  }

  if (content.howItWorks.length > 0) {
    children.push(h2('How It Works'))
    content.howItWorks
      .sort((a, b) => a.step - b.step)
      .forEach((step) => {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: `Step ${step.step}: ${step.title} — `,
                bold: true,
                size: BODY_SIZE,
                font: FONT,
                color: '111111',
              }),
              new TextRun({ text: step.description, size: BODY_SIZE, font: FONT, color: '444444' }),
            ],
          }),
        )
      })
    children.push(spacer())
  }

  if (content.socialProof.length > 0) {
    children.push(h2('Social Proof'))
    content.socialProof.forEach((sp) => {
      const text = sp.attribution ? `${sp.content} — ${sp.attribution}` : sp.content
      children.push(bullet(text))
    })
    children.push(spacer())
  }

  children.push(divider())
  children.push(body(content.callToAction, { bold: true }))

  return makeDoc(children)
}

// ─────────────────────────────────────────────────────────────────────────────
// Objection Handler
// ─────────────────────────────────────────────────────────────────────────────

function generateObjectionHandlerDocx(content: ObjectionHandlerContent): Document {
  const children: (Paragraph | Table)[] = []

  children.push(h1('Objection Handler'))
  children.push(body(content.intro, { italic: true, color: '555555' }))
  children.push(spacer())

  // Group by category
  const categorised: Record<string, typeof content.objections> = {}
  content.objections.forEach((o) => {
    if (!categorised[o.category]) categorised[o.category] = []
    categorised[o.category].push(o)
  })

  const categoryLabels: Record<string, string> = {
    price: 'Price & Budget',
    competitor: 'Competitor Comparisons',
    timing: 'Timing & Urgency',
    authority: 'Authority & Stakeholders',
    need: 'Need & Priority',
    trust: 'Trust & Risk',
    other: 'Other',
  }

  Object.entries(categorised).forEach(([cat, objections]) => {
    children.push(h2(categoryLabels[cat] ?? cat))

    const objRows: TableRow[] = [
      new TableRow({
        children: [
          headerCell('Objection'),
          headerCell('Response'),
          headerCell('Follow-Up Question'),
        ],
      }),
      ...objections.map(
        (o) =>
          new TableRow({
            children: [
              dataCell(o.objection, 'FEF2F2'),
              dataCell(o.response),
              dataCell(o.followUpQuestion, 'F0FDF4'),
            ],
          }),
      ),
    ]

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: objRows,
      }),
    )

    // Proof points per objection
    objections.forEach((o) => {
      if (o.proofPoints && o.proofPoints.length > 0) {
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: `Proof points for: "${o.objection.slice(0, 50)}..."`,
                bold: true,
                size: BODY_SIZE - 2,
                font: FONT,
                color: '666666',
              }),
            ],
          }),
        )
        o.proofPoints.forEach((pp) => children.push(bullet(pp)))
      }
    })

    children.push(spacer())
  })

  children.push(divider())
  children.push(h2('Closing Tips'))
  content.closingTips.forEach((t, i) => children.push(numberedItem(t, i + 1)))

  return makeDoc(children)
}

// ─────────────────────────────────────────────────────────────────────────────
// Talk Track
// ─────────────────────────────────────────────────────────────────────────────

function generateTalkTrackDocx(content: TalkTrackContent): Document {
  const children: (Paragraph | Table)[] = []

  children.push(h1(`Talk Track: ${content.targetPersona}`))
  children.push(labelledText('Purpose', content.purpose))
  children.push(spacer())

  const sections = [
    content.opener,
    content.discovery,
    content.pitchSection,
    content.objectionHandling,
    content.close,
  ]

  sections.forEach((section) => {
    children.push(h2(section.title))
    children.push(
      new Paragraph({
        spacing: { after: 80, before: 80 },
        shading: { type: ShadingType.SOLID, color: 'F9F9F9', fill: 'F9F9F9' },
        border: {
          left: { style: BorderStyle.SINGLE, size: 6, color: '6366F1' },
        },
        indent: { left: 240 },
        children: [
          new TextRun({
            text: section.script,
            italics: true,
            size: BODY_SIZE,
            font: FONT,
            color: '333333',
          }),
        ],
      }),
    )

    if (section.keyPoints.length > 0) {
      children.push(body('Key points:', { bold: true }))
      section.keyPoints.forEach((kp) => children.push(bullet(kp)))
    }

    children.push(
      new Paragraph({
        spacing: { after: 120, before: 80 },
        children: [
          new TextRun({ text: 'Transition: ', bold: true, size: BODY_SIZE, font: FONT, color: '6366F1' }),
          new TextRun({ text: `"${section.transitionPhrase}"`, italics: true, size: BODY_SIZE, font: FONT, color: '555555' }),
        ],
      }),
    )
    children.push(spacer())
  })

  children.push(divider())
  children.push(h2('Tips & Notes'))
  content.tipsAndNotes.forEach((t, i) => children.push(numberedItem(t, i + 1)))

  return makeDoc(children)
}

// ─────────────────────────────────────────────────────────────────────────────
// Email Sequence
// ─────────────────────────────────────────────────────────────────────────────

function generateEmailSequenceDocx(content: EmailSequenceContent): Document {
  const children: (Paragraph | Table)[] = []

  children.push(h1(content.sequenceName))
  children.push(labelledText('Target Persona', content.targetPersona))
  children.push(labelledText('Goal', content.goal))
  children.push(spacer())

  content.emails
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .forEach((email) => {
      children.push(
        new Paragraph({
          spacing: { before: 320, after: 120 },
          children: [
            new TextRun({
              text: `Email ${email.stepNumber} `,
              bold: true,
              size: H2_SIZE,
              font: FONT,
              color: '111111',
            }),
            new TextRun({
              text: `(Day ${email.dayOffset})`,
              size: BODY_SIZE,
              font: FONT,
              color: '888888',
            }),
          ],
        }),
      )

      children.push(labelledText('Subject', email.subject))
      children.push(labelledText('Preview text', email.previewText))

      // Email body in a bordered box
      email.body.split('\n').forEach((line) => {
        children.push(
          new Paragraph({
            spacing: { after: line.trim() === '' ? 80 : 40 },
            shading: { type: ShadingType.SOLID, color: 'F9FAFB', fill: 'F9FAFB' },
            indent: { left: 240, right: 240 },
            children: [
              new TextRun({
                text: line || ' ',
                size: BODY_SIZE,
                font: FONT,
                color: '333333',
              }),
            ],
          }),
        )
      })

      children.push(labelledText('CTA', email.callToAction))

      if (email.sendingTips && email.sendingTips.length > 0) {
        children.push(body('Sending tips:', { bold: true, color: '6366F1' }))
        email.sendingTips.forEach((tip) => children.push(bullet(tip)))
      }

      children.push(spacer())
    })

  return makeDoc(children)
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

export async function generateDocx(
  title: string,
  content: CollateralContent,
): Promise<Buffer> {
  let doc: Document

  switch (content.type) {
    case 'battlecard':
      doc = generateBattlecardDocx(content as BattlecardContent)
      break
    case 'case_study_doc':
      doc = generateCaseStudyDocx(content as CaseStudyDocContent)
      break
    case 'one_pager':
      doc = generateOnePagerDocx(content as OnePagerContent)
      break
    case 'objection_handler':
      doc = generateObjectionHandlerDocx(content as ObjectionHandlerContent)
      break
    case 'talk_track':
      doc = generateTalkTrackDocx(content as TalkTrackContent)
      break
    case 'email_sequence':
      doc = generateEmailSequenceDocx(content as EmailSequenceContent)
      break
    default:
      throw new Error(`Unknown collateral type for docx generation`)
  }

  const buffer = await Packer.toBuffer(doc)
  return Buffer.from(buffer)
}
