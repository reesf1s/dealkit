import type { CompanyProfile, Competitor, CaseStudy, DealLog } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(company: CompanyProfile): string {
  const products = (company.products ?? [])
    .map((p) => `${p.name}: ${p.description}`)
    .join('; ') || 'Not specified'

  const valueProps = (company.valuePropositions ?? []).join(', ') || 'Not specified'
  const differentiators = (company.differentiators ?? []).join(', ') || 'Not specified'

  return `You are a senior sales strategist and copywriter. You generate sales collateral that is:
1. SPECIFIC — references actual company data, real competitor details, real case study outcomes. Never generic.
2. HONEST — acknowledges competitor strengths. Sales teams lose credibility when collateral pretends competitors don't exist or have no merits.
3. ACTIONABLE — every section tells the salesperson exactly what to say or do. No filler.
4. CONCISE — sales reps don't read long documents. Be punchy. Use bullet points for scanability.
5. GROUNDED IN DATA — reference win/loss data, deal outcomes, and real metrics wherever possible.

Use UK English spelling throughout. Write in a tone that is: confident, clear, and direct — not salesy or corporate.

COMPANY CONTEXT:
Company: ${company.companyName}
Industry: ${company.industry ?? 'Not specified'}
Size: ${company.employeeCount ?? 'Not specified'}
Products: ${products}
Value Propositions: ${valueProps}
Differentiators: ${differentiators}
Target Market: ${company.targetMarket ?? 'Not specified'}
Competitive Advantage: ${company.competitiveAdvantage ?? 'Not specified'}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Battlecard
// ─────────────────────────────────────────────────────────────────────────────

export function battlecardPrompt(
  company: CompanyProfile,
  competitor: Competitor,
  deals: DealLog[],
  caseStudies: CaseStudy[],
): { system: string; messages: Array<{ role: 'user'; content: string }> } {
  const system = buildSystemPrompt(company)

  const dealContext = deals.length > 0
    ? deals
        .slice(0, 20)
        .map(
          (d) =>
            `- ${d.dealName} (${d.stage})${d.lostReason ? ` — lost reason: ${d.lostReason}` : ''}${d.notes ? ` — notes: ${d.notes}` : ''}`,
        )
        .join('\n')
    : 'No deal history available.'

  const caseStudyContext = caseStudies.length > 0
    ? caseStudies
        .slice(0, 5)
        .map(
          (cs) =>
            `- ${cs.customerName} (${cs.customerIndustry ?? 'unknown industry'}, ${cs.customerSize ?? 'unknown size'}): ${cs.results}`,
        )
        .join('\n')
    : 'No case studies available.'

  const competitorContext = `
Name: ${competitor.name}
Description: ${competitor.description ?? 'No description'}
Their Strengths: ${(competitor.strengths ?? []).join(', ') || 'Unknown'}
Their Weaknesses: ${(competitor.weaknesses ?? []).join(', ') || 'Unknown'}
Their Pricing: ${competitor.pricing ?? 'Unknown'}
Their Target Market: ${competitor.targetMarket ?? 'Unknown'}
Their Key Features: ${(competitor.keyFeatures ?? []).join(', ') || 'Unknown'}
Their Differentiators: ${(competitor.differentiators ?? []).join(', ') || 'Unknown'}
Notes: ${competitor.notes ?? 'None'}`

  const schema = `{
  "type": "battlecard",
  "competitor": "string — competitor name",
  "summary": "string — 2-3 sentence executive summary of the competitive situation",
  "ourStrengths": [{ "point": "string", "detail": "string — one sentence elaboration" }],
  "theirStrengths": [{ "point": "string", "detail": "string — honest assessment, 1 sentence" }],
  "ourWeaknesses": [{ "point": "string", "detail": "string — and how to address it" }],
  "winThemes": ["string — top 3-5 themes when we win"],
  "objectionResponses": [
    {
      "objection": "string — exact objection text",
      "response": "string — scripted response",
      "proofPoint": "string or null — specific evidence"
    }
  ],
  "landmines": ["string — questions to ask that expose competitor weaknesses"],
  "discoveryQuestions": ["string — discovery questions that set us up to win"],
  "proofPoints": ["string — specific metrics or outcomes from real customer stories"]
}`

  const userMessage = `Generate a battlecard for our sales team to use when competing against ${competitor.name}.

COMPETITOR INTELLIGENCE:
${competitorContext}

RELEVANT DEALS (including wins/losses against this competitor):
${dealContext}

PROOF POINTS FROM CASE STUDIES:
${caseStudyContext}

Return ONLY valid JSON matching this exact schema:
${schema}

Generate at least 4 ourStrengths, 3 theirStrengths (be honest), 2 ourWeaknesses with mitigations, 5 winThemes, 5 objectionResponses, 5 landmines, 5 discoveryQuestions, and 5 proofPoints. Make everything specific to ${competitor.name}, not generic.`

  return {
    system,
    messages: [{ role: 'user', content: userMessage }],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Case Study Doc
// ─────────────────────────────────────────────────────────────────────────────

export function caseStudyDocPrompt(
  company: CompanyProfile,
  caseStudy: CaseStudy,
): { system: string; messages: Array<{ role: 'user'; content: string }> } {
  const system = buildSystemPrompt(company)

  const metricsContext = (caseStudy.metrics ?? [])
    .map((m) => `${m.label}: ${m.value}${m.unit ? ' ' + m.unit : ''}`)
    .join(', ')

  const schema = `{
  "type": "case_study_doc",
  "headline": "string — punchy outcome-led headline, max 12 words",
  "subheadline": "string — supporting context, max 20 words",
  "customerName": "string",
  "customerDescription": "string — 1-2 sentences on who this customer is",
  "challengeSection": {
    "heading": "string",
    "body": "string — 2-3 paragraphs describing the challenge in the customer's language"
  },
  "solutionSection": {
    "heading": "string",
    "body": "string — 2-3 paragraphs on what was implemented and why it mattered"
  },
  "resultsSection": {
    "heading": "string",
    "body": "string — 2-3 paragraphs on measurable business outcomes"
  },
  "metrics": [
    {
      "value": "string — e.g. 3x, 40%, £250k",
      "label": "string — e.g. ROI increase",
      "description": "string — one sentence context"
    }
  ],
  "quote": {
    "text": "string — a credible, specific quote (can be illustrative if real quote unavailable)",
    "author": "string",
    "title": "string",
    "company": "string"
  },
  "callToAction": "string — specific CTA for end of document"
}`

  const userMessage = `Write a professional case study document for ${company.companyName} based on this customer success story.

CUSTOMER: ${caseStudy.customerName}
INDUSTRY: ${caseStudy.customerIndustry ?? 'Not specified'}
SIZE: ${caseStudy.customerSize ?? 'Not specified'}

CHALLENGE (raw notes):
${caseStudy.challenge}

SOLUTION (raw notes):
${caseStudy.solution}

RESULTS (raw notes):
${caseStudy.results}

KEY METRICS:
${metricsContext || 'None specified — infer from results text'}

Transform these raw notes into a polished, narrative case study. Make the challenge feel real and urgent. Show the solution without being a product brochure. Lead the results section with the most impressive outcome first. Generate 3-5 metrics objects from the data above.

Return ONLY valid JSON matching this exact schema:
${schema}`

  return {
    system,
    messages: [{ role: 'user', content: userMessage }],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// One-Pager
// ─────────────────────────────────────────────────────────────────────────────

export function onePagerPrompt(
  company: CompanyProfile,
  product: { name: string; description: string; keyFeatures: string[] },
  caseStudies: CaseStudy[],
): { system: string; messages: Array<{ role: 'user'; content: string }> } {
  const system = buildSystemPrompt(company)

  const socialProofContext = caseStudies
    .slice(0, 4)
    .map(
      (cs) =>
        `${cs.customerName}: ${cs.results}${(cs.metrics ?? []).length > 0 ? ' Metrics: ' + cs.metrics.map((m) => `${m.value} ${m.label}`).join(', ') : ''}`,
    )
    .join('\n')

  const schema = `{
  "type": "one_pager",
  "headline": "string — outcome-led, max 10 words",
  "subheadline": "string — supporting detail, max 18 words",
  "problemStatement": "string — 2-3 sentences describing the pain this product solves",
  "solution": "string — 2-3 sentences on how this product solves it",
  "keyBenefits": [
    {
      "title": "string — 2-4 word benefit title",
      "description": "string — 1-2 sentence elaboration"
    }
  ],
  "howItWorks": [
    {
      "step": 1,
      "title": "string",
      "description": "string"
    }
  ],
  "socialProof": [
    {
      "type": "metric",
      "content": "string — specific metric or quote",
      "attribution": "string or null"
    }
  ],
  "pricing": null,
  "callToAction": "string — specific CTA",
  "contactInfo": null
}`

  const userMessage = `Create a one-pager for ${company.companyName}'s product: ${product.name}.

PRODUCT DESCRIPTION: ${product.description}
KEY FEATURES: ${product.keyFeatures.join(', ')}

CUSTOMER PROOF POINTS:
${socialProofContext || 'No case studies available — use general value proposition language.'}

Generate 4 keyBenefits, 3 howItWorks steps, and 3-4 socialProof items drawn from the customer data above. Every claim should be credible and specific. Avoid generic marketing language.

Return ONLY valid JSON matching this exact schema:
${schema}`

  return {
    system,
    messages: [{ role: 'user', content: userMessage }],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Objection Handler
// ─────────────────────────────────────────────────────────────────────────────

export function objectionHandlerPrompt(
  company: CompanyProfile,
  deals: DealLog[],
): { system: string; messages: Array<{ role: 'user'; content: string }> } {
  const system = buildSystemPrompt(company)

  // Aggregate objection signals from lost deals and deal notes
  const lostDeals = deals.filter((d) => d.stage === 'closed_lost')
  const dealsContext = deals
    .slice(0, 30)
    .map(
      (d) =>
        `[${d.stage}] ${d.dealName} — ${d.prospectTitle ?? 'Unknown title'} at ${d.prospectCompany}${
          d.lostReason ? ` — LOST REASON: ${d.lostReason}` : ''
        }${d.notes ? ` — NOTES: ${d.notes}` : ''}`,
    )
    .join('\n')

  const commonObjections = (company.commonObjections ?? []).join('\n- ')

  const schema = `{
  "type": "objection_handler",
  "intro": "string — 1-2 sentences on how to use this document",
  "objections": [
    {
      "objection": "string — exact objection as a prospect would say it",
      "category": "price | competitor | timing | authority | need | trust | other",
      "response": "string — scripted response, 3-5 sentences, uses feel-felt-found or similar framework",
      "followUpQuestion": "string — question to ask after the response to regain control",
      "proofPoints": ["string — specific evidence or metric to back up the response"]
    }
  ],
  "closingTips": ["string — 3-5 general tips for closing despite objections"]
}`

  const userMessage = `Create a comprehensive objection handler for ${company.companyName}'s sales team.

KNOWN COMMON OBJECTIONS (from company profile):
- ${commonObjections || 'None specified'}

DEAL HISTORY (${deals.length} deals, ${lostDeals.length} lost):
${dealsContext || 'No deal history available.'}

Identify the top 8-10 objections from the deal notes and lost reasons above. For each:
- Write the objection as a prospect would actually say it
- Classify it into the correct category
- Write a scripted, empathetic response that acknowledges the concern then reframes
- Include a follow-up question that re-engages the prospect
- Include 2-3 specific proof points

Also include 5 closingTips.

Return ONLY valid JSON matching this exact schema:
${schema}`

  return {
    system,
    messages: [{ role: 'user', content: userMessage }],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Talk Track
// ─────────────────────────────────────────────────────────────────────────────

export function talkTrackPrompt(
  company: CompanyProfile,
  buyerRole: string,
  deals: DealLog[],
): { system: string; messages: Array<{ role: 'user'; content: string }> } {
  const system = buildSystemPrompt(company)

  const relevantDeals = deals
    .filter(
      (d) =>
        d.prospectTitle?.toLowerCase().includes(buyerRole.toLowerCase()) ||
        buyerRole.toLowerCase().includes('all'),
    )
    .slice(0, 15)

  const dealsContext = relevantDeals.length > 0
    ? relevantDeals
        .map(
          (d) =>
            `- ${d.dealName} (${d.stage}) — ${d.prospectTitle ?? 'Unknown title'} at ${d.prospectCompany}${d.notes ? ` — ${d.notes}` : ''}`,
        )
        .join('\n')
    : deals
        .slice(0, 10)
        .map(
          (d) =>
            `- ${d.dealName} (${d.stage}) — ${d.prospectTitle ?? 'Unknown'} at ${d.prospectCompany}`,
        )
        .join('\n')

  const schema = `{
  "type": "talk_track",
  "purpose": "string — what call/meeting this is for",
  "targetPersona": "string — the buyer role",
  "opener": {
    "title": "string",
    "script": "string — word-for-word opener, 3-5 sentences",
    "keyPoints": ["string"],
    "transitionPhrase": "string — exact phrase to move to next section"
  },
  "discovery": {
    "title": "string",
    "script": "string — discovery framework and sample questions",
    "keyPoints": ["string — 4-6 key things to uncover"],
    "transitionPhrase": "string"
  },
  "pitchSection": {
    "title": "string",
    "script": "string — value pitch tailored to this persona",
    "keyPoints": ["string"],
    "transitionPhrase": "string"
  },
  "objectionHandling": {
    "title": "string",
    "script": "string — how to handle the top 2-3 objections from this persona",
    "keyPoints": ["string"],
    "transitionPhrase": "string"
  },
  "close": {
    "title": "string",
    "script": "string — closing approach with trial close and next step",
    "keyPoints": ["string"],
    "transitionPhrase": "string"
  },
  "tipsAndNotes": ["string — 4-6 practical tips specific to this persona"]
}`

  const userMessage = `Create a complete talk track for ${company.companyName}'s sales team for conversations with ${buyerRole} personas.

RELEVANT DEAL HISTORY:
${dealsContext || 'No deal history available.'}

Tailor the entire talk track to what a ${buyerRole} cares about: their KPIs, their language, their typical objections. Make the scripts feel natural and conversational, not like a script. Include specific questions in the discovery section. Reference real customer outcomes in the pitch where possible.

Return ONLY valid JSON matching this exact schema:
${schema}`

  return {
    system,
    messages: [{ role: 'user', content: userMessage }],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email Sequence
// ─────────────────────────────────────────────────────────────────────────────

export function emailSequencePrompt(
  company: CompanyProfile,
  targetPersona: string,
  caseStudies: CaseStudy[],
): { system: string; messages: Array<{ role: 'user'; content: string }> } {
  const system = buildSystemPrompt(company)

  const proofContext = caseStudies
    .slice(0, 4)
    .map(
      (cs) =>
        `- ${cs.customerName} (${cs.customerIndustry ?? 'unknown'}): ${cs.results}`,
    )
    .join('\n')

  const schema = `{
  "type": "email_sequence",
  "sequenceName": "string",
  "targetPersona": "string",
  "goal": "string — the goal of this sequence",
  "emails": [
    {
      "stepNumber": 1,
      "dayOffset": 0,
      "subject": "string — compelling subject line, max 50 chars",
      "previewText": "string — preview text, max 90 chars",
      "body": "string — full email body. Use {{first_name}} for personalisation. Plain text, no HTML. 100-150 words max.",
      "callToAction": "string — specific CTA",
      "sendingTips": ["string — 1-2 practical tips for this specific email"]
    }
  ]
}`

  const userMessage = `Create a 5-email outbound sequence for ${company.companyName} targeting ${targetPersona} personas.

CUSTOMER PROOF POINTS:
${proofContext || 'No case studies — use value proposition language.'}

Sequence structure:
- Email 1 (Day 0): Pattern interrupt opener. Reference something specific about their role/industry. End with one low-friction CTA.
- Email 2 (Day 3): Share a relevant customer story or insight. Don't beg for a meeting.
- Email 3 (Day 7): Offer specific value (framework, tip, or benchmark data).
- Email 4 (Day 14): Challenge email — point out a gap or risk they might be missing.
- Email 5 (Day 21): Break-up email. Make it human and easy to respond to.

Rules: Every email must have a distinct hook. No "just following up". Subject lines should not start with "Re:". Use {{first_name}} for personalisation placeholders. Keep bodies under 150 words each.

Return ONLY valid JSON matching this exact schema:
${schema}`

  return {
    system,
    messages: [{ role: 'user', content: userMessage }],
  }
}
