/**
 * Mixpanel analytics wrapper.
 * Safe to call before Mixpanel loads — calls are silently dropped.
 */

declare global {
  interface Window {
    mixpanel: any
  }
}

let _ready = false

function mp() {
  if (typeof window === 'undefined') return null
  if (!_ready && window.mixpanel && typeof window.mixpanel.track === 'function') {
    _ready = true
  }
  return _ready ? window.mixpanel : null
}

export function identify(userId: string, traits?: Record<string, any>) {
  try { mp()?.identify(userId) } catch {}
  try { if (traits) mp()?.people?.set(traits) } catch {}
}

export function track(event: string, properties?: Record<string, any>) {
  try { mp()?.track(event, properties) } catch {}
}

export function reset() {
  try { mp()?.reset() } catch {}
  _ready = false
}

// Pre-defined event names for consistency
export const Events = {
  SIGNED_IN: 'Signed In',
  SIGNED_OUT: 'Signed Out',
  DEAL_CREATED: 'Deal Created',
  DEAL_UPDATED: 'Deal Updated',
  DEAL_CLOSED: 'Deal Closed',
  DEAL_VIEWED: 'Deal Viewed',
  AI_CHAT_SENT: 'AI Chat Sent',
  AI_BRIEFING_GENERATED: 'AI Briefing Generated',
  AI_MEETING_PREP: 'AI Meeting Prep',
  AI_COLLATERAL_GENERATED: 'AI Collateral Generated',
  AI_NOTE_ANALYZED: 'AI Note Analyzed',
  PAGE_VIEWED: 'Page Viewed',
  DEAL_DRAGGED: 'Deal Dragged',
  BRAIN_REBUILT: 'Brain Rebuilt',
  HUBSPOT_CONNECTED: 'HubSpot Connected',
  HUBSPOT_SYNCED: 'HubSpot Synced',
  EMAIL_FORWARDED: 'Email Forwarded',
} as const
