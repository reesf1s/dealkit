import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Battlecard
// ─────────────────────────────────────────────────────────────────────────────

export const BattlecardSchema = z.object({
  type: z.literal('battlecard'),
  competitor: z.string(),
  summary: z.string(),
  ourStrengths: z.array(
    z.object({
      point: z.string(),
      detail: z.string(),
    }),
  ),
  theirStrengths: z.array(
    z.object({
      point: z.string(),
      detail: z.string(),
    }),
  ),
  ourWeaknesses: z.array(
    z.object({
      point: z.string(),
      detail: z.string(),
    }),
  ),
  winThemes: z.array(z.string()),
  objectionResponses: z.array(
    z.object({
      objection: z.string(),
      response: z.string(),
      proofPoint: z.string().nullable().optional(),
    }),
  ),
  landmines: z.array(z.string()),
  discoveryQuestions: z.array(z.string()),
  proofPoints: z.array(z.string()),
})

// ─────────────────────────────────────────────────────────────────────────────
// Case Study Doc
// ─────────────────────────────────────────────────────────────────────────────

export const CaseStudyDocSchema = z.object({
  type: z.literal('case_study_doc'),
  headline: z.string(),
  subheadline: z.string(),
  customerName: z.string(),
  customerDescription: z.string(),
  challengeSection: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  solutionSection: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  resultsSection: z.object({
    heading: z.string(),
    body: z.string(),
  }),
  metrics: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      description: z.string().optional(),
    }),
  ),
  quote: z
    .object({
      text: z.string(),
      author: z.string(),
      title: z.string(),
      company: z.string(),
    })
    .nullable(),
  callToAction: z.string(),
  prospectRelevanceNote: z.string().optional().nullable(),
})

// ─────────────────────────────────────────────────────────────────────────────
// One-Pager
// ─────────────────────────────────────────────────────────────────────────────

export const OnePagerSchema = z.object({
  type: z.literal('one_pager'),
  headline: z.string(),
  subheadline: z.string(),
  problemStatement: z.string(),
  solution: z.string(),
  keyBenefits: z.array(
    z.object({
      icon: z.string().optional(),
      title: z.string(),
      description: z.string(),
    }),
  ),
  howItWorks: z.array(
    z.object({
      step: z.number(),
      title: z.string(),
      description: z.string(),
    }),
  ),
  socialProof: z.array(
    z.object({
      type: z.enum(['metric', 'quote', 'logo']),
      content: z.string(),
      attribution: z.string().optional(),
    }),
  ),
  pricing: z
    .object({
      intro: z.string(),
      tiers: z.array(
        z.object({
          name: z.string(),
          price: z.string(),
          features: z.array(z.string()),
          highlighted: z.boolean().optional(),
        }),
      ),
    })
    .nullable(),
  callToAction: z.string(),
  contactInfo: z.string().nullable(),
})

// ─────────────────────────────────────────────────────────────────────────────
// Objection Handler
// ─────────────────────────────────────────────────────────────────────────────

export const ObjectionHandlerSchema = z.object({
  type: z.literal('objection_handler'),
  intro: z.string(),
  objections: z.array(
    z.object({
      objection: z.string(),
      category: z.enum(['price', 'competitor', 'timing', 'authority', 'need', 'trust', 'other']),
      response: z.string(),
      followUpQuestion: z.string(),
      proofPoints: z.array(z.string()),
    }),
  ),
  closingTips: z.array(z.string()),
})

// ─────────────────────────────────────────────────────────────────────────────
// Talk Track
// ─────────────────────────────────────────────────────────────────────────────

const TalkTrackSectionSchema = z.object({
  title: z.string(),
  script: z.string(),
  keyPoints: z.array(z.string()),
  transitionPhrase: z.string(),
})

export const TalkTrackSchema = z.object({
  type: z.literal('talk_track'),
  purpose: z.string(),
  targetPersona: z.string(),
  opener: TalkTrackSectionSchema,
  discovery: TalkTrackSectionSchema,
  pitchSection: TalkTrackSectionSchema,
  objectionHandling: TalkTrackSectionSchema,
  close: TalkTrackSectionSchema,
  tipsAndNotes: z.array(z.string()),
})

// ─────────────────────────────────────────────────────────────────────────────
// Email Sequence
// ─────────────────────────────────────────────────────────────────────────────

export const EmailSequenceSchema = z.object({
  type: z.literal('email_sequence'),
  sequenceName: z.string(),
  targetPersona: z.string(),
  goal: z.string(),
  emails: z.array(
    z.object({
      stepNumber: z.number(),
      dayOffset: z.number(),
      subject: z.string(),
      previewText: z.string(),
      body: z.string(),
      callToAction: z.string(),
      sendingTips: z.array(z.string()),
    }),
  ),
})

// ─────────────────────────────────────────────────────────────────────────────
// Union type for runtime validation routing
// ─────────────────────────────────────────────────────────────────────────────

export type ValidatedBattlecard = z.infer<typeof BattlecardSchema>
export type ValidatedCaseStudyDoc = z.infer<typeof CaseStudyDocSchema>
export type ValidatedOnePager = z.infer<typeof OnePagerSchema>
export type ValidatedObjectionHandler = z.infer<typeof ObjectionHandlerSchema>
export type ValidatedTalkTrack = z.infer<typeof TalkTrackSchema>
export type ValidatedEmailSequence = z.infer<typeof EmailSequenceSchema>
