// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export type CollateralType =
  | 'battlecard'
  | 'case_study_doc'
  | 'one_pager'
  | 'objection_handler'
  | 'talk_track'
  | 'email_sequence'
  | 'custom'

export type CollateralStatus = 'generating' | 'ready' | 'stale' | 'archived'

export type Plan = 'free' | 'starter' | 'pro'

// ─────────────────────────────────────────────────────────────────────────────
// Core domain types
// ─────────────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  stripeCustomerId: string | null
  plan: Plan
  createdAt: Date
  updatedAt: Date
}

export interface Product {
  id: string
  name: string
  description: string
  keyFeatures: string[]
  targetPersonas: string[]
  pricingModel: string | null
  pricingDetails: string | null
}

export interface CompanyProfile {
  id: string
  userId: string
  companyName: string
  website: string | null
  industry: string | null
  description: string | null
  products: Product[]
  valuePropositions: string[]
  differentiators: string[]
  commonObjections: string[]
  targetMarket: string | null
  competitiveAdvantage: string | null
  founded: number | null
  employeeCount: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Competitor {
  id: string
  userId: string
  name: string
  website: string | null
  description: string | null
  strengths: string[]
  weaknesses: string[]
  pricing: string | null
  targetMarket: string | null
  keyFeatures: string[]
  differentiators: string[]
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CaseStudy {
  id: string
  userId: string
  customerName: string
  customerIndustry: string | null
  customerSize: string | null
  challenge: string
  solution: string
  results: string
  metrics: CaseStudyMetric[]
  generatedNarrative: string | null
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CaseStudyMetric {
  label: string
  value: string
  unit?: string
}

export interface DealContact {
  name: string
  title?: string
  email?: string
}

export type DealLinkType =
  | 'proposal' | 'contract' | 'deck' | 'document'
  | 'sharepoint' | 'google' | 'salesforce' | 'notion' | 'figma' | 'github'
  | 'other'

export interface DealLink {
  id: string
  url: string
  label: string
  type: DealLinkType
  addedAt: string   // ISO date
  addedBy?: string  // user email or name
}

export type EngagementType = 'POC' | 'Pilot' | 'Live' | 'Expansion' | 'Renewal' | 'Upsell' | string

export interface DealLog {
  id: string
  userId: string
  dealName: string
  prospectCompany: string
  prospectName: string | null
  prospectTitle: string | null
  contacts: DealContact[]
  description: string | null
  dealValue: number | null
  stage: DealStage
  competitors: string[]
  notes: string | null
  nextSteps: string | null
  closeDate: Date | null
  wonDate: Date | null
  lostDate: Date | null
  lostReason: string | null
  dealType: 'one_off' | 'recurring'
  recurringInterval: 'monthly' | 'quarterly' | 'annual' | null
  engagementType?: string | null   // 'POC' | 'Pilot' | 'Live' | 'Expansion' | 'Renewal' | 'Upsell' | custom
  links: DealLink[]
  contractStartDate?: Date | string | null
  contractEndDate?: Date | string | null
  parentDealId?: string | null
  expansionType?: ExpansionType | null
  projectPlan?: ProjectPlan | null
  conversionScore?: number | null
  assignedRepId?: string | null
  createdAt: Date
  updatedAt: Date
}

export type ExpansionType = 'upsell' | 'cross_sell' | 'renewal' | 'expansion'

export type DealStage =
  | 'prospecting'
  | 'qualification'
  | 'discovery'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost'

export interface Collateral {
  id: string
  userId: string
  type: CollateralType
  title: string
  status: CollateralStatus
  // The source inputs used to generate this piece
  sourceCompetitorId: string | null
  sourceCaseStudyId: string | null
  sourceDealLogId: string | null
  customTypeName?: string | null
  generationSource?: string | null
  // Generated content — shape depends on type
  content: CollateralContent | null
  // Raw LLM response stored for debugging / regeneration
  rawResponse: unknown | null
  generatedAt: Date | null
  shareToken: string | null
  isShared: boolean
  createdAt: Date
  updatedAt: Date
}

export type CollateralContent =
  | BattlecardContent
  | CaseStudyDocContent
  | OnePagerContent
  | ObjectionHandlerContent
  | TalkTrackContent
  | EmailSequenceContent
  | FreeformCollateralContent

export interface FreeformCollateralContent {
  format: 'markdown'
  title: string
  sections: { heading: string; content: string }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Collateral content types
// ─────────────────────────────────────────────────────────────────────────────

export interface BattlecardContent {
  type: 'battlecard'
  competitor: string
  summary: string
  ourStrengths: BattlecardPoint[]
  theirStrengths: BattlecardPoint[]
  ourWeaknesses: BattlecardPoint[]
  winThemes: string[]
  objectionResponses: ObjectionResponse[]
  landmines: string[]
  discoveryQuestions: string[]
  proofPoints: string[]
}

export interface BattlecardPoint {
  point: string
  detail: string
}

export interface ObjectionResponse {
  objection: string
  response: string
  proofPoint?: string
}

export interface CaseStudyDocContent {
  type: 'case_study_doc'
  headline: string
  subheadline: string
  customerName: string
  customerDescription: string
  challengeSection: ContentSection
  solutionSection: ContentSection
  resultsSection: ContentSection
  metrics: DisplayMetric[]
  quote: CustomerQuote | null
  callToAction: string
  prospectRelevanceNote?: string | null
}

export interface ContentSection {
  heading: string
  body: string
}

export interface DisplayMetric {
  value: string
  label: string
  description?: string
}

export interface CustomerQuote {
  text: string
  author: string
  title: string
  company: string
}

export interface OnePagerContent {
  type: 'one_pager'
  headline: string
  subheadline: string
  problemStatement: string
  solution: string
  keyBenefits: Benefit[]
  howItWorks: HowItWorksStep[]
  socialProof: SocialProofItem[]
  pricing: PricingSection | null
  callToAction: string
  contactInfo: string | null
}

export interface Benefit {
  icon?: string
  title: string
  description: string
}

export interface HowItWorksStep {
  step: number
  title: string
  description: string
}

export interface SocialProofItem {
  type: 'metric' | 'quote' | 'logo'
  content: string
  attribution?: string
}

export interface PricingSection {
  intro: string
  tiers: PricingTier[]
}

export interface PricingTier {
  name: string
  price: string
  features: string[]
  highlighted?: boolean
}

export interface ObjectionHandlerContent {
  type: 'objection_handler'
  intro: string
  objections: HandledObjection[]
  closingTips: string[]
}

export interface HandledObjection {
  objection: string
  category: ObjectionCategory
  response: string
  followUpQuestion: string
  proofPoints: string[]
}

export type ObjectionCategory =
  | 'price'
  | 'competitor'
  | 'timing'
  | 'authority'
  | 'need'
  | 'trust'
  | 'other'

export interface TalkTrackContent {
  type: 'talk_track'
  purpose: string
  targetPersona: string
  opener: TalkTrackSection
  discovery: TalkTrackSection
  pitchSection: TalkTrackSection
  objectionHandling: TalkTrackSection
  close: TalkTrackSection
  tipsAndNotes: string[]
}

export interface TalkTrackSection {
  title: string
  script: string
  keyPoints: string[]
  transitionPhrase: string
}

export interface EmailSequenceContent {
  type: 'email_sequence'
  sequenceName: string
  targetPersona: string
  goal: string
  emails: EmailStep[]
}

export interface EmailStep {
  stepNumber: number
  dayOffset: number
  subject: string
  previewText: string
  body: string
  callToAction: string
  sendingTips: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Plans
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectPlan {
  title: string
  createdAt: string                     // ISO date
  updatedAt: string
  sourceText?: string                   // original pasted text
  phases: ProjectPhase[]
}

export interface ProjectPhase {
  id: string
  name: string
  description: string
  order: number
  targetDate?: string                   // ISO date
  tasks: ProjectTask[]
}

export interface ProjectTask {
  id: string
  text: string
  status: 'not_started' | 'in_progress' | 'complete'
  owner?: string                        // responsible person
  assignee?: string                     // assigned member email or custom name
  dueDate?: string                      // ISO date
  linkedTodoId?: string                 // link to deal todo
  notes?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Todo items (stored as JSONB on dealLogs.todos)
// ─────────────────────────────────────────────────────────────────────────────

export interface TodoItem {
  id: string
  text: string
  done: boolean
  assignee?: string                     // assigned member email or custom name
  createdAt: string
  source?: 'manual' | 'ai'             // 'manual' = user-created, 'ai' = AI-extracted from notes
  reordered?: boolean                   // true if user manually reordered this item
}

// ─────────────────────────────────────────────────────────────────────────────
// Success criteria items (stored as JSONB on dealLogs.successCriteriaTodos)
// ─────────────────────────────────────────────────────────────────────────────

export interface SuccessCriterionItem {
  id: string
  text: string
  category: string
  achieved: boolean
  assignee?: string                     // assigned member email or custom name
  note?: string
  createdAt: string
}

// DealLink is defined above (near DealContact) with full type detection support

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineConfig {
  stages: PipelineStageConfig[]
  industryPreset?: string               // e.g. 'saas', 'agency', 'consulting', 'ecommerce', 'real_estate', 'manufacturing'
  updatedAt: string
}

export interface PipelineStageConfig {
  id: string                            // matches dealStageEnum value OR custom slug
  label: string                         // display name (user can rename)
  color: string                         // hex color
  order: number
  isDefault: boolean                    // true for the 7 built-in stages
  isHidden?: boolean                    // hide from pipeline view
}

export interface PipelineRecommendation {
  dealId: string
  dealName: string
  company: string
  recommendation: string
  priority: 'high' | 'medium' | 'low'
  action?: string                       // suggested action text
  actionType?: 'stage_change' | 'follow_up' | 'collateral' | 'meeting' | 'custom'
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity feed / event
// ─────────────────────────────────────────────────────────────────────────────

export type EventType =
  | 'collateral.generated'
  | 'collateral.archived'
  | 'competitor.created'
  | 'competitor.updated'
  | 'competitor.deleted'
  | 'case_study.created'
  | 'case_study.updated'
  | 'case_study.deleted'
  | 'deal_log.created'
  | 'deal_log.updated'
  | 'deal_log.closed_won'
  | 'deal_log.closed_lost'
  | 'company_profile.updated'
  | 'plan.upgraded'
  | 'plan.downgraded'

export interface EventMetadata {
  // Generic bag; specific events extend this
  [key: string]: unknown
}

export interface CollateralGeneratedMetadata extends EventMetadata {
  collateralId: string
  collateralType: CollateralType
  title: string
}

export interface DealClosedMetadata extends EventMetadata {
  dealLogId: string
  dealName: string
  dealValue: number | null
  stage: DealStage
  lostReason?: string
}

export interface PlanChangedMetadata extends EventMetadata {
  fromPlan: Plan
  toPlan: Plan
}

export interface Event {
  id: string
  userId: string
  type: EventType
  metadata: EventMetadata
  createdAt: Date
}

// ─────────────────────────────────────────────────────────────────────────────
// API / request types
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number
  perPage?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface ApiError {
  error: string
  code?: string
  details?: unknown
}

export type ApiResponse<T> = { data: T; error?: never } | { data?: never; error: ApiError }

// ─────────────────────────────────────────────────────────────────────────────
// Plan / billing
// ─────────────────────────────────────────────────────────────────────────────

export interface PlanLimits {
  products: number | null        // null = unlimited
  competitors: number | null
  caseStudies: number | null
  dealLogs: number | null
  collateral: number | null
}

export interface PlanDefinition {
  id: Plan
  name: string
  description: string
  priceMonthly: number
  priceId: string | null
  limits: PlanLimits
  features: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// UI helper types
// ─────────────────────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc'

export interface SortConfig<T> {
  field: keyof T
  direction: SortDirection
}

export interface FilterConfig {
  [key: string]: string | number | boolean | null | undefined
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  data: T | null
  state: LoadingState
  error: string | null
}
