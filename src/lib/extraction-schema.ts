import { z } from 'zod'

export const NoteExtractionSchema = z.object({
  champion_signal: z.boolean().default(false),
  budget_signal: z.enum(['confirmed', 'discussed', 'concern', 'not_mentioned']).default('not_mentioned'),
  decision_timeline: z.string().nullable().default(null),
  next_step: z.string().nullable().default(null),
  competitors_mentioned: z.array(z.string()).default([]),
  objections: z.array(z.object({
    theme: z.string(),
    text: z.string(),
    severity: z.enum(['high', 'medium', 'low']).default('medium'),
  })).default([]),
  positive_signals: z.array(z.string()).default([]),
  negative_signals: z.array(z.string()).default([]),
  stakeholders_mentioned: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
    functional_area: z.string().optional()
  })).default([]),
  product_gaps: z.array(z.object({
    gap: z.string(),
    severity: z.enum(['high', 'medium', 'low']).default('medium'),
    quote: z.string().optional()
  })).default([]),
  sentiment_score: z.number().min(0).max(1).default(0.5),
  urgency_signals: z.array(z.string()).default([]),
  user_verified: z.boolean().default(false),
  scheduled_events: z.array(z.object({
    type: z.enum(['meeting', 'follow_up', 'demo', 'deadline', 'decision', 'other']).default('meeting'),
    description: z.string(),
    date: z.string().nullable().default(null),
    time: z.string().nullable().default(null),
    source_text: z.string().optional()
  })).default([])
})

export type NoteExtraction = z.infer<typeof NoteExtractionSchema>

// Correction prompt for retry when Zod validation fails
export function buildCorrectionPrompt(originalOutput: string, errors: string): string {
  return `The previous extraction output had validation errors: ${errors}

Original output:
${originalOutput}

Please return a corrected JSON object that exactly matches this schema:
{
  "champion_signal": boolean,
  "budget_signal": "confirmed" | "discussed" | "concern" | "not_mentioned",
  "decision_timeline": string | null,
  "next_step": string | null,
  "competitors_mentioned": string[],
  "objections": [{"theme": string, "text": string, "severity": "high"|"medium"|"low"}],
  "positive_signals": string[],
  "negative_signals": string[],
  "stakeholders_mentioned": [{"name": string, "role"?: string, "functional_area"?: string}],
  "product_gaps": [{"gap": string, "severity": "high"|"medium"|"low", "quote"?: string}],
  "sentiment_score": number (0-1),
  "urgency_signals": string[],
  "user_verified": false,
  "scheduled_events": [{"type": "meeting"|"follow_up"|"demo"|"deadline"|"decision"|"other", "description": string, "date": "YYYY-MM-DD"|null, "time": "HH:MM"|null, "source_text"?: string}]
}

Return ONLY the JSON object, no other text.`
}
