import { describe, expect, it } from 'vitest'
import { formatLimit, getAllPlans, getPlan, isWithinLimit, requiresUpgrade } from './plans'

describe('billing plans', () => {
  it('exposes sales CRM plans in price order', () => {
    expect(getAllPlans().map(plan => plan.id)).toEqual(['free', 'starter', 'pro'])
    expect(getPlan('free').features.join(' ')).toContain('companies')
    expect(getPlan('starter').features.join(' ')).toContain('Unified inbox')
  })

  it('checks limits and upgrade paths', () => {
    expect(isWithinLimit(2, 3)).toBe(true)
    expect(isWithinLimit(3, 3)).toBe(false)
    expect(formatLimit(null)).toBe('Unlimited')
    expect(requiresUpgrade('free', 'pro')).toBe(true)
    expect(requiresUpgrade('pro', 'starter')).toBe(false)
  })
})
