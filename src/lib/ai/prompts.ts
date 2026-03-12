import type { CompanyProfile, Competitor, CaseStudy, DealLog } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Shared context builder — keep it tight, no filler
// ─────────────────────────────────────────────────────────────────────────────

function companyBrief(c: CompanyProfile): string {
  const vp = (c.valuePropositions ?? []).slice(0, 3).join(', ')
  const diff = (c.differentiators ?? []).slice(0, 2).join(', ')
  const prodLines = (c.products ?? []).slice(0, 2).map(p => {
    const features = (p.keyFeatures as unknown as string[] | null)?.slice(0, 3).join(', ')
    return [p.name, p.description, features ? `Features: ${features}` : ''].filter(Boolean).join(' — ')
  }).join(' | ')
  return [
    `Company: ${c.companyName}`,
    c.industry ? `Industry: ${c.industry}` : '',
    c.targetMarket ? `Market: ${c.targetMarket}` : '',
    vp ? `Value props: ${vp}` : '',
    diff ? `Differentiators: ${diff}` : '',
    prodLines ? `Products: ${prodLines}` : '',
    c.competitiveAdvantage ? `Advantage: ${c.competitiveAdvantage}` : '',
  ].filter(Boolean).join('\n')
}

const SYSTEM = `You are a sales strategist. Generate concise, actionable sales collateral as valid JSON only — no markdown, no explanation. UK English. Be specific, not generic.`

// ─────────────────────────────────────────────────────────────────────────────
// Battlecard
// ─────────────────────────────────────────────────────────────────────────────

export function battlecardPrompt(
  company: CompanyProfile,
  competitor: Competitor,
  deals: DealLog[],
  _caseStudies: CaseStudy[],
  workspaceContext = '',
): { system: string; messages: Array<{ role: 'user'; content: string }> } {
  const wonAgainst = deals.filter(d => d.stage === 'closed_won' && (d.competitors as string[]).some(c => c.toLowerCase().includes(competitor.name.toLowerCase()))).length
  const lostTo = deals.filter(d => d.stage === 'closed_lost' && (d.competitors as string[]).some(c => c.toLowerCase().includes(competitor.name.toLowerCase()))).length

  const context = [
    companyBrief(company),
    '',
    `Competitor: ${competitor.name}`,
    competitor.description ? `About: ${competitor.description}` : '',
    (competitor.strengths as string[])?.length ? `Their strengths: ${(competitor.strengths as string[]).join(', ')}` : '',
    (competitor.weaknesses as string[])?.length ? `Their weaknesses: ${(competitor.weaknesses as string[]).join(', ')}` : '',
    competitor.pricing ? `Pricing: ${competitor.pricing}` : '',
    (wonAgainst + lostTo) > 0 ? `Deal history vs ${competitor.name}: ${wonAgainst} won, ${lostTo} lost` : '',
  ].filter(Boolean).join('\n')

  const schema = `{
  "type": "battlecard",
  "competitor": "${competitor.name}",
  "summary": "2 sentences: competitive situation + our main advantage",
  "ourStrengths": [{"point": "short label", "detail": "1 sentence why it matters vs ${competitor.name}"}],
  "theirStrengths": [{"point": "short label", "detail": "honest 1-sentence assessment"}],
  "ourWeaknesses": [{"point": "short label", "detail": "1 sentence + how to handle it"}],
  "winThemes": ["short phrase"],
  "objectionResponses": [{"objection": "exact prospect phrase", "response": "2-3 sentence scripted reply", "proofPoint": "specific evidence or null"}],
  "landmines": ["question to ask that exposes ${competitor.name} weakness"],
  "discoveryQuestions": ["question that sets us up to win"],
  "proofPoints": ["specific metric or outcome"]
}`

  return {
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Generate a battlecard JSON for competing against ${competitor.name}.

CONTEXT:
${context}

Return ONLY this JSON (3 ourStrengths, 2 theirStrengths, 1 ourWeakness, 3 winThemes, 2 objectionResponses, 3 landmines, 3 discoveryQuestions, 3 proofPoints). Keep all strings concise — max 1 sentence each.
${workspaceContext ? `\nWORKSPACE INTEL (use to sharpen positioning):\n${workspaceContext}` : ''}
${schema}`,
    }],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Case Study Doc
// ─────────────────────────────────────────────────────────────────────────────

export function caseStudyDocPrompt(
  company: CompanyProfile,
  caseStudy: CaseStudy,
  workspaceContext = '',
): { system: string; messages: Array<{ role: 'user'; content: string }> } {
  const metricsText = (caseStudy.metrics ?? []).map(m => `${m.value} ${m.label}`).join(', ')

  const schema = `{
  "type": "case_study_doc",
  "headline": "outcome-led headline, max 10 words",
  "subheadline": "supporting context, max 15 words",
  "customerName": "${caseStudy.customerName}",
  "customerDescription": "1 sentence who they are",
  "challengeSection": {"heading": "short heading", "body": "2-3 sentences on the challenge"},
  "solutionSection": {"heading": "short heading", "body": "2-3 sentences on the solution"},
  "resultsSection": {"heading": "short heading", "body": "2-3 sentences on outcomes"},
  "metrics": [{"value": "e.g. 3x", "label": "e.g. ROI", "description": "1 sentence"}],
  "quote": {"text": "credible quote", "author": "Name", "title": "Title", "company": "${caseStudy.customerName}"},
  "callToAction": "specific CTA sentence"
}`

  return {
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Write a case study doc JSON for ${company.companyName}.

${companyBrief(company)}

Customer: ${caseStudy.customerName}${caseStudy.customerIndustry ? ` (${caseStudy.customerIndustry})` : ''}
Challenge: ${caseStudy.challenge}
Solution: ${caseStudy.solution}
Results: ${caseStudy.results}
${metricsText ? `Metrics: ${metricsText}` : ''}

Return ONLY this JSON (2-3 metrics). Keep body sections to 2-3 sentences each.
${workspaceContext ? `\nWORKSPACE INTEL (use to add relevant context):\n${workspaceContext}` : ''}
${schema}`,
    }],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// One-Pager
// ─────────────────────────────────────────────────────────────────────────────

export function onePagerPrompt(
  company: CompanyProfile,
  product: { name: string; description: string; keyFeatures: string[] },
  caseStudies: CaseStudy[],
  workspaceContext = '',
): { system: string; messages: Array<{ role: 'user'; content: string }> } {
  const proof = caseStudies.slice(0, 2).map(cs => `${cs.customerName}: ${cs.results}`).join(' | ')

  const schema = `{
  "type": "one_pager",
  "headline": "outcome-led, max 8 words",
  "subheadline": "supporting detail, max 12 words",
  "problemStatement": "2 sentences on the pain this solves",
  "solution": "2 sentences on how it solves it",
  "keyBenefits": [{"title": "2-3 word benefit", "description": "1-2 sentences"}],
  "howItWorks": [{"step": 1, "title": "short title", "description": "1 sentence"}],
  "socialProof": [{"type": "metric", "content": "specific stat or outcome", "attribution": "company or null"}],
  "pricing": null,
  "callToAction": "specific CTA",
  "contactInfo": null
}`

  return {
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Write a one-pager JSON for ${company.companyName} — product: ${product.name}.

${companyBrief(company)}
Product description: ${product.description}
Key features: ${product.keyFeatures.slice(0, 4).join(', ')}
${proof ? `Customer proof: ${proof}` : ''}

Return ONLY this JSON (3 keyBenefits, 3 howItWorks steps, 2-3 socialProof items). Keep all strings concise.
${workspaceContext ? `\nWORKSPACE INTEL (use to sharpen positioning vs competitors, ground proof points):\n${workspaceContext}` : ''}
${schema}`,
    }],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Objection Handler
// ─────────────────────────────────────────────────────────────────────────────

export function objectionHandlerPrompt(
  company: CompanyProfile,
  deals: DealLog[],
  workspaceContext = '',
): { system: string; messages: Array<{ role: 'user'; content: string }> } {
  const lostReasons = deals
    .filter(d => d.stage === 'closed_lost' && d.lostReason)
    .slice(0, 5)
    .map(d => d.lostReason)
    .join(', ')

  const knownObjections = (company.commonObjections ?? []).slice(0, 4).join('; ')

  const schema = `{
  "type": "objection_handler",
  "intro": "1 sentence on how to use this",
  "objections": [{
    "objection": "exact prospect phrase",
    "category": "price|competitor|timing|authority|need|trust|other",
    "response": "2-3 sentence empathetic reply",
    "followUpQuestion": "1 follow-up question",
    "proofPoints": ["specific evidence"]
  }],
  "closingTips": ["short actionable tip"]
}`

  return {
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Write an objection handler JSON for ${company.companyName}'s sales team.

${companyBrief(company)}
${knownObjections ? `Known objections: ${knownObjections}` : ''}
${lostReasons ? `Lost deal reasons: ${lostReasons}` : ''}

Return ONLY this JSON (6 objections covering price, competitor, timing, need, trust + 1 other; 3 closingTips). Keep responses to 2-3 sentences each.
${workspaceContext ? `\nWORKSPACE INTEL (use to add specific proof points and competitor-aware responses):\n${workspaceContext}` : ''}
${schema}`,
    }],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Talk Track
// ─────────────────────────────────────────────────────────────────────────────

export function talkTrackPrompt(
  company: CompanyProfile,
  buyerRole: string,
  deals: DealLog[],
  workspaceContext = '',
): { system: string; messages: Array<{ role: 'user'; content: string }> } {
  const relevantNotes = deals
    .filter(d => d.prospectTitle?.toLowerCase().includes(buyerRole.toLowerCase()))
    .slice(0, 3)
    .map(d => d.notes)
    .filter(Boolean)
    .join(' | ')

  const objections = (company.commonObjections ?? []).slice(0, 4).join('; ')

  const schema = `{
  "type": "talk_track",
  "purpose": "short description of call type",
  "targetPersona": "${buyerRole}",
  "opener": {"title": "Opener", "script": "2 sentence opener", "keyPoints": ["point1", "point2"]},
  "discovery": {"title": "Discovery", "script": "2-3 focused discovery questions", "keyPoints": ["what to uncover 1", "what to uncover 2"]},
  "pitchSection": {"title": "Pitch", "script": "2 sentences tailored to ${buyerRole}", "keyPoints": ["key point 1", "key point 2"]},
  "objectionHandling": {"title": "Objections", "script": "handle top objection from this persona in 2 sentences", "keyPoints": ["objection + response"]},
  "close": {"title": "Close", "script": "1-2 sentences + next step ask", "keyPoints": ["closing point"]},
  "tipsAndNotes": ["tip1", "tip2"]
}`

  return {
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Write a talk track JSON for ${company.companyName} — persona: ${buyerRole}.

${companyBrief(company)}
${objections ? `Known objections from this persona: ${objections}` : ''}
${relevantNotes ? `Notes from similar deals: ${relevantNotes}` : ''}

Return ONLY this JSON (2 keyPoints per section, 2 tipsAndNotes). Keep scripts short and natural.
${workspaceContext ? `\nWORKSPACE INTEL (use to reference real competitors, wins, and proof points in the script):\n${workspaceContext}` : ''}
${schema}`,
    }],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email Sequence
// ─────────────────────────────────────────────────────────────────────────────

export function emailSequencePrompt(
  company: CompanyProfile,
  targetPersona: string,
  caseStudies: CaseStudy[],
  workspaceContext = '',
): { system: string; messages: Array<{ role: 'user'; content: string }> } {
  const proof = caseStudies.slice(0, 2).map(cs => `${cs.customerName}: ${cs.results}`).join(' | ')
  const objections = (company.commonObjections ?? []).slice(0, 3).join('; ')

  const schema = `{
  "type": "email_sequence",
  "sequenceName": "sequence name",
  "targetPersona": "${targetPersona}",
  "goal": "goal of this sequence",
  "emails": [{
    "stepNumber": 1,
    "dayOffset": 0,
    "subject": "subject line max 50 chars",
    "previewText": "preview text max 80 chars",
    "body": "email body — use {{first_name}} and {{company_name}} placeholders, plain text, 80-120 words",
    "callToAction": "specific CTA",
    "sendingTips": ["1 tip"]
  }]
}`

  return {
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Write a 4-email outbound sequence JSON for ${company.companyName} targeting ${targetPersona}.

${companyBrief(company)}
${proof ? `Customer proof: ${proof}` : ''}
${objections ? `Common objections to address: ${objections}` : ''}

Email structure: Day 0 pattern-interrupt opener, Day 3 customer story, Day 10 value/insight, Day 21 break-up.
Rules: No "just following up". Subjects must be curiosity-driven. Bodies 60-80 words each. Use {{first_name}} and {{company_name}} placeholders.

Return ONLY this JSON (4 emails, 1 sendingTip each).
${workspaceContext ? `\nWORKSPACE INTEL (use to name competitors, reference real wins, address known objections):\n${workspaceContext}` : ''}
${schema}`,
    }],
  }
}
