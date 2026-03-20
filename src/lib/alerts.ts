import type { DealContext } from './deal-context'

export interface ProactiveAlert {
  dealId: string
  dealName: string
  company: string
  severity: 'critical' | 'warning' | 'info'
  type: string
  message: string
  action: string
}

export function generateAlerts(deals: DealContext[]): ProactiveAlert[] {
  const alerts: ProactiveAlert[] = []

  for (const deal of deals) {
    if (deal.isClosed) continue

    // Stale deal
    if (deal.daysSinceLastNote >= 14) {
      alerts.push({
        dealId: deal.id,
        dealName: deal.name,
        company: deal.company,
        severity: deal.daysSinceLastNote >= 21 ? 'critical' : 'warning',
        type: 'stale',
        message: `No activity on ${deal.name} in ${deal.daysSinceLastNote} days.`,
        action: `Re-engage ${deal.contacts[0]?.name || 'your contact'} — schedule a follow-up.`,
      })
    }

    // Missing signals for late-stage deals
    const lateStages = ['proposal', 'negotiation', 'trial', 'verbal', 'poc', 'closing', 'contract']
    const isLateStage = lateStages.some(s => deal.stage.toLowerCase().includes(s))

    if (isLateStage) {
      if (!deal.championIdentified) {
        alerts.push({
          dealId: deal.id,
          dealName: deal.name,
          company: deal.company,
          severity: 'warning',
          type: 'missing_champion',
          message: `${deal.name} is in ${deal.stage} with no champion identified.`,
          action: deal.contacts[0]
            ? `Ask ${deal.contacts[0].name} who owns the decision internally.`
            : `Identify your internal advocate before pushing toward close.`,
        })
      }
      if (!deal.budgetConfirmed && deal.dealValue > 0) {
        alerts.push({
          dealId: deal.id,
          dealName: deal.name,
          company: deal.company,
          severity: 'warning',
          type: 'missing_budget',
          message: `Budget not confirmed on ${deal.name} (£${Math.round(deal.dealValue / 1000)}k).`,
          action: deal.contacts[0]
            ? `Raise budget in your next call with ${deal.contacts[0].name}.`
            : `Raise budget with your prospect contact.`,
        })
      }
    }

    // Close date approaching
    if (deal.closeDate) {
      const daysUntilClose = Math.ceil((new Date(deal.closeDate).getTime() - Date.now()) / 86400000)
      if (daysUntilClose <= 7 && daysUntilClose > 0) {
        alerts.push({
          dealId: deal.id,
          dealName: deal.name,
          company: deal.company,
          severity: 'critical',
          type: 'close_approaching',
          message: `${deal.name} expected to close in ${daysUntilClose} day${daysUntilClose === 1 ? '' : 's'}.`,
          action: `Confirm contract/approval status and remove remaining blockers.`,
        })
      }
    }
  }

  // Dedup: max ONE alert per deal (highest severity)
  const byDeal = new Map<string, ProactiveAlert[]>()
  for (const alert of alerts) {
    if (!byDeal.has(alert.dealId)) byDeal.set(alert.dealId, [])
    byDeal.get(alert.dealId)!.push(alert)
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 }
  const deduped: ProactiveAlert[] = []
  for (const dealAlerts of byDeal.values()) {
    dealAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    deduped.push(dealAlerts[0])
  }

  return deduped.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
}
