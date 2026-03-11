import type { Plan, PlanDefinition, PlanLimits } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Plan limits
// null means unlimited
// ─────────────────────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    products: 1,
    competitors: 2,
    caseStudies: 5,
    dealLogs: 10,
    collateral: 5,
  },
  starter: {
    products: 3,
    competitors: 10,
    caseStudies: null,   // unlimited
    dealLogs: null,      // unlimited
    collateral: null,    // unlimited
  },
  pro: {
    products: null,      // unlimited
    competitors: null,   // unlimited
    caseStudies: null,   // unlimited
    dealLogs: null,      // unlimited
    collateral: null,    // unlimited
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan definitions
// ─────────────────────────────────────────────────────────────────────────────

export const PLANS: Record<Plan, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Get started with the essentials. No credit card required.',
    priceMonthly: 0,
    priceId: null,
    limits: PLAN_LIMITS.free,
    features: [
      '1 product',
      '2 competitors',
      'Up to 5 case studies',
      'Up to 10 deal logs',
      'Up to 5 AI-generated collateral pieces',
      'Battlecards, one-pagers, objection handlers',
      'Community support',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'For growing sales teams that need more firepower.',
    priceMonthly: 49,
    priceId: process.env.STRIPE_STARTER_PRICE_ID ?? null,
    limits: PLAN_LIMITS.starter,
    features: [
      '3 products',
      'Up to 10 competitors',
      'Unlimited case studies',
      'Unlimited deal logs',
      'Unlimited AI-generated collateral',
      'All collateral types (incl. talk tracks & email sequences)',
      'Export to DOCX',
      'Email support',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For high-velocity teams that need everything, unlimited.',
    priceMonthly: 149,
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    limits: PLAN_LIMITS.pro,
    features: [
      'Unlimited products',
      'Unlimited competitors',
      'Unlimited case studies',
      'Unlimited deal logs',
      'Unlimited AI-generated collateral',
      'All collateral types',
      'Export to DOCX & PDF',
      'Priority AI generation',
      'Dedicated Slack support',
      'Early access to new features',
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the plan definition for a given plan ID.
 */
export function getPlan(plan: Plan): PlanDefinition {
  return PLANS[plan]
}

/**
 * Get the limits for a given plan ID.
 */
export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan]
}

/**
 * Check whether a value is within the plan limit.
 * Returns true if the limit is null (unlimited) or the current count < limit.
 */
export function isWithinLimit(current: number, limit: number | null): boolean {
  if (limit === null) return true
  return current < limit
}

/**
 * Return a human-readable string for a limit value.
 */
export function formatLimit(limit: number | null): string {
  return limit === null ? 'Unlimited' : limit.toString()
}

/**
 * Determine whether a plan upgrade is required to reach a target plan.
 */
export function requiresUpgrade(currentPlan: Plan, targetPlan: Plan): boolean {
  const order: Plan[] = ['free', 'starter', 'pro']
  return order.indexOf(targetPlan) > order.indexOf(currentPlan)
}

/**
 * Get all plans in ascending price order.
 */
export function getAllPlans(): PlanDefinition[] {
  return [PLANS.free, PLANS.starter, PLANS.pro]
}

/**
 * Map a Stripe price ID back to a Plan.
 * Returns null if the price ID doesn't match any known plan.
 */
export function planFromPriceId(priceId: string): Plan | null {
  for (const plan of Object.values(PLANS)) {
    if (plan.priceId === priceId) return plan.id
  }
  return null
}
