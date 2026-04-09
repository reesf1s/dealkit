export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { eq, and, notInArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dealLogs } from '@/lib/db/schema'
import { getWorkspaceContext } from '@/lib/workspace'
import { dbErrResponse } from '@/lib/api-helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AlertType =
  | 'stale'
  | 'at_risk'
  | 'missing_next_steps'
  | 'single_threaded'
  | 'overdue_close'
  | 'follow_up_due'

type Severity = 'critical' | 'warning' | 'info'

interface Alert {
  dealId: string
  dealName: string
  company: string
  type: AlertType
  severity: Severity
  message: string
  suggestedAction: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000

function daysSince(date: Date | string | null): number {
  if (!date) return Infinity
  const d = typeof date === 'string' ? new Date(date) : date
  return Math.floor((Date.now() - d.getTime()) / DAY_MS)
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/deals/monitor
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await getWorkspaceContext(userId)

    // Fetch all active deals (not closed_won or closed_lost)
    const activeDeals = await db
      .select()
      .from(dealLogs)
      .where(
        and(
          eq(dealLogs.workspaceId, workspaceId),
          notInArray(dealLogs.stage, ['closed_won', 'closed_lost']),
        ),
      )

    const alerts: Alert[] = []

    for (const deal of activeDeals) {
      const base = {
        dealId: deal.id,
        dealName: deal.dealName,
        company: deal.prospectCompany,
      }

      // 1. Stale deals — no update in 7+ days
      const staleDays = daysSince(deal.updatedAt)
      if (staleDays >= 7) {
        alerts.push({
          ...base,
          type: 'stale',
          severity: staleDays >= 14 ? 'critical' : 'warning',
          message: `No activity in ${staleDays} days`,
          suggestedAction: 'Review the deal status and add a note or update the stage.',
        })
      }

      // 2. At-risk deals — conversion score below 40
      if (deal.conversionScore !== null && deal.conversionScore < 40) {
        alerts.push({
          ...base,
          type: 'at_risk',
          severity: deal.conversionScore < 20 ? 'critical' : 'warning',
          message: `Conversion score is ${deal.conversionScore}/100`,
          suggestedAction: 'Run deal analysis to identify blockers and update your strategy.',
        })
      }

      // 3. Missing next steps
      if (!deal.nextSteps || deal.nextSteps.trim().length === 0) {
        alerts.push({
          ...base,
          type: 'missing_next_steps',
          severity: 'warning',
          message: 'No next steps defined',
          suggestedAction: 'Add concrete next steps to keep this deal moving forward.',
        })
      }

      // 4. Single-threaded — only 0-1 contacts in mid-to-late stages
      const multiThreadStages = new Set(['discovery', 'proposal', 'negotiation'])
      const contacts = deal.contacts as unknown[]
      if (
        multiThreadStages.has(deal.stage) &&
        (!Array.isArray(contacts) || contacts.length <= 1)
      ) {
        alerts.push({
          ...base,
          type: 'single_threaded',
          severity: deal.stage === 'negotiation' ? 'critical' : 'warning',
          message: `Only ${Array.isArray(contacts) ? contacts.length : 0} contact(s) in ${deal.stage} stage`,
          suggestedAction: 'Identify and engage additional stakeholders to reduce single-thread risk.',
        })
      }

      // 5. Overdue close — close date is in the past
      if (deal.closeDate && new Date(deal.closeDate) < new Date()) {
        const overdueDays = daysSince(deal.closeDate)
        alerts.push({
          ...base,
          type: 'overdue_close',
          severity: overdueDays >= 14 ? 'critical' : 'warning',
          message: `Close date was ${overdueDays} day(s) ago`,
          suggestedAction: 'Update the close date or reassess whether this deal is still viable.',
        })
      }

      // 6. Follow-up due — qualification/discovery with no activity in 3+ days
      const followUpStages = new Set(['qualification', 'discovery'])
      if (followUpStages.has(deal.stage) && daysSince(deal.updatedAt) >= 3) {
        alerts.push({
          ...base,
          type: 'follow_up_due',
          severity: 'info',
          message: `No activity in ${daysSince(deal.updatedAt)} days during ${deal.stage}`,
          suggestedAction: 'Send a follow-up to maintain momentum in early-stage engagement.',
        })
      }
    }

    // Sort: critical first, then warning, then info
    const severityOrder: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    const criticalCount = alerts.filter((a) => a.severity === 'critical').length
    const warningCount = alerts.filter((a) => a.severity === 'warning').length
    const dealsWithAlerts = new Set(alerts.map((a) => a.dealId)).size
    const healthyCount = activeDeals.length - dealsWithAlerts

    return NextResponse.json({
      data: {
        alerts,
        summary: {
          totalActive: activeDeals.length,
          criticalCount,
          warningCount,
          healthyCount,
        },
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    return dbErrResponse(err)
  }
}
