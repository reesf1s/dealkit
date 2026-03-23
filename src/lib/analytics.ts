/**
 * Mixpanel analytics wrapper.
 * All tracking calls go through this module.
 */

declare global {
  interface Window {
    mixpanel: any
  }
}

function mp() {
  if (typeof window !== 'undefined' && window.mixpanel) return window.mixpanel
  return null
}

export function identify(userId: string, traits?: Record<string, any>) {
  mp()?.identify(userId)
  if (traits) mp()?.people.set(traits)
}

export function track(event: string, properties?: Record<string, any>) {
  mp()?.track(event, properties)
}

export function reset() {
  mp()?.reset()
}

// Pre-defined event names for consistency
export const Events = {
  // Auth
  SIGNED_IN: 'Signed In',
  SIGNED_OUT: 'Signed Out',

  // Deals
  DEAL_CREATED: 'Deal Created',
  DEAL_UPDATED: 'Deal Updated',
  DEAL_CLOSED: 'Deal Closed',
  DEAL_VIEWED: 'Deal Viewed',

  // AI
  AI_CHAT_SENT: 'AI Chat Sent',
  AI_BRIEFING_GENERATED: 'AI Briefing Generated',
  AI_MEETING_PREP: 'AI Meeting Prep',
  AI_COLLATERAL_GENERATED: 'AI Collateral Generated',
  AI_NOTE_ANALYZED: 'AI Note Analyzed',

  // Navigation
  PAGE_VIEWED: 'Page Viewed',

  // Pipeline
  DEAL_DRAGGED: 'Deal Dragged',
  BRAIN_REBUILT: 'Brain Rebuilt',

  // Integrations
  HUBSPOT_CONNECTED: 'HubSpot Connected',
  HUBSPOT_SYNCED: 'HubSpot Synced',
  EMAIL_FORWARDED: 'Email Forwarded',
} as const
