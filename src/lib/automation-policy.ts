export type AutomationCategory = 'intelligence' | 'alerts' | 'automation'

export interface AutomationTemplate {
  id: string
  name: string
  description: string
  category: AutomationCategory
  alwaysOn: boolean
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'deal_scoring',
    name: 'AI Deal Scoring',
    description: 'Score all deals using ML pipeline',
    category: 'intelligence',
    alwaysOn: true,
  },
  {
    id: 'stale_alerts',
    name: 'Stale Deal Alerts',
    description: 'Flag deals with no activity in 14+ days',
    category: 'alerts',
    alwaysOn: false,
  },
  {
    id: 'risk_detection',
    name: 'Risk Signal Detection',
    description: 'Detect objections, competitor mentions from notes',
    category: 'intelligence',
    alwaysOn: false,
  },
  {
    id: 'email_ingestion',
    name: 'Email-to-Deal Matching',
    description: 'Auto-match incoming emails to deals',
    category: 'automation',
    alwaysOn: false,
  },
  {
    id: 'follow_up_reminders',
    name: 'Follow-up Reminders',
    description: 'Surface deals needing follow-up in daily briefing',
    category: 'alerts',
    alwaysOn: false,
  },
  {
    id: 'auto_stage_suggestions',
    name: 'Stage Progression Hints',
    description: 'Suggest stage changes based on activity patterns',
    category: 'intelligence',
    alwaysOn: false,
  },
  {
    id: 'champion_tracking',
    name: 'Champion Tracking',
    description: 'Alert when champion contact goes quiet',
    category: 'alerts',
    alwaysOn: false,
  },
  {
    id: 'deal_decay_alerts',
    name: 'Deal Decay Monitoring',
    description: 'Warn when deal score drops significantly',
    category: 'alerts',
    alwaysOn: false,
  },
  {
    id: 'competitor_alerts',
    name: 'Competitor Intelligence',
    description: 'Track competitor mentions across deals',
    category: 'intelligence',
    alwaysOn: false,
  },
  {
    id: 'close_date_monitoring',
    name: 'Close Date Monitoring',
    description: 'Alert on approaching/overdue close dates',
    category: 'alerts',
    alwaysOn: false,
  },
]

export const VALID_AUTOMATION_IDS = new Set(AUTOMATION_TEMPLATES.map(template => template.id))
const ALWAYS_ON_IDS = new Set(
  AUTOMATION_TEMPLATES.filter(template => template.alwaysOn).map(template => template.id),
)

export function getEnabledAutomations(pipelineConfig: unknown): string[] {
  const stored = (pipelineConfig as { enabledAutomations?: unknown } | null | undefined)?.enabledAutomations
  if (Array.isArray(stored)) {
    const enabled = stored.filter((id): id is string => typeof id === 'string' && VALID_AUTOMATION_IDS.has(id))
    for (const alwaysOnId of ALWAYS_ON_IDS) {
      if (!enabled.includes(alwaysOnId)) enabled.push(alwaysOnId)
    }
    return enabled
  }
  return [...ALWAYS_ON_IDS]
}

export function isAutomationEnabled(pipelineConfig: unknown, automationId: string): boolean {
  if (ALWAYS_ON_IDS.has(automationId)) return true
  return getEnabledAutomations(pipelineConfig).includes(automationId)
}

