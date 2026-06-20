import type { Plan, PlanDefinition, PlanLimits } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Plan limits
// null means unlimited
// ─────────────────────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    workspaces: 1,
    members: 3,
    companies: 50,
    people: 250,
    deals: 100,
    tasks: 500,
    exports: true,
  },
  starter: {
    workspaces: 1,
    members: 10,
    companies: null,
    people: null,
    deals: null,
    tasks: null,
    exports: true,
  },
  pro: {
    workspaces: null,
    members: null,
    companies: null,
    people: null,
    deals: null,
    tasks: null,
    exports: true,
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
      '1 workspace',
      'Up to 3 members',
      'Up to 50 companies',
      'Up to 250 contacts',
      'Up to 100 leads',
      'Leads, notes, messages, and tasks',
      'Community support',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'For SME sales teams ready to centralise follow-up.',
    priceMonthly: 79,
    priceId: process.env.STRIPE_STARTER_PRICE_ID ?? null,
    limits: PLAN_LIMITS.starter,
    features: [
      '1 workspace',
      'Up to 10 members',
      'Unlimited companies',
      'Unlimited contacts',
      'Unlimited leads',
      'Markdown lead canvas',
      'Unified inbox workspace',
      'Stripe billing portal',
      'Email support',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For high-velocity sales teams running AI-assisted pipeline work.',
    priceMonthly: 149,
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    limits: PLAN_LIMITS.pro,
    features: [
      'Unlimited workspaces',
      'Unlimited members',
      'Unlimited companies',
      'Unlimited contacts',
      'Unlimited leads',
      'Advanced workspace administration',
      'Priority support',
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
