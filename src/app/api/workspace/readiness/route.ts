export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { count, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  caseStudies,
  companyProfiles,
  competitors,
  dealLogs,
  hubspotIntegrations,
  linearIntegrations,
  linearIssuesCache,
  slackConnections,
  workspaces,
} from '@/lib/db/schema'
import { dbErrResponse } from '@/lib/api-helpers'
import { getWorkspaceContext } from '@/lib/workspace'

function isSlackConfigured() {
  return Boolean(
    process.env.SLACK_CLIENT_ID &&
    process.env.SLACK_CLIENT_SECRET &&
    process.env.SLACK_SIGNING_SECRET
  )
}

type ReadinessItemId =
  | 'company'
  | 'crm'
  | 'linear'
  | 'mcp'
  | 'slack'
  | 'deals'
  | 'competitors'
  | 'caseStudies'

type ReadinessItem = {
  id: ReadinessItemId
  label: string
  href: string
  done: boolean
  degraded: boolean
  description: string
}

type NextAction = {
  title: string
  description: string
  href: string
  ctaLabel: string
}

function buildNextAction(items: ReadinessItem[]): NextAction | null {
  const missing = new Set(items.filter(item => !item.done).map(item => item.id))
  const degraded = items.find(item => item.degraded)

  if (missing.has('company')) {
    return {
      title: 'Set your company brain',
      description: 'Add your positioning, differentiators, and objections so every AI workflow starts from your actual product context.',
      href: '/company',
      ctaLabel: 'Open company profile',
    }
  }

  if (missing.has('crm')) {
    return {
      title: 'Connect your CRM',
      description: 'Live pipeline data is the foundation for accurate revenue visibility, alerts, and AI review.',
      href: '/connections',
      ctaLabel: 'Connect CRM',
    }
  }

  if (missing.has('linear')) {
    return {
      title: 'Connect Linear',
      description: 'Give Halvex a live issue inventory so Claude can save blockers back into deals against real product work.',
      href: '/connections',
      ctaLabel: 'Connect Linear',
    }
  }

  if (missing.has('mcp')) {
    return {
      title: 'Finish Claude setup',
      description: 'Add the Halvex MCP endpoint and workspace key once so Claude can review the pipeline and write issue context back.',
      href: '/connections',
      ctaLabel: 'Set up MCP',
    }
  }

  if (missing.has('deals')) {
    return {
      title: 'Log the first live deal',
      description: 'The dashboard becomes useful once real revenue context, notes, and blockers are flowing through the workspace.',
      href: '/deals',
      ctaLabel: 'Add a deal',
    }
  }

  if (missing.has('competitors')) {
    return {
      title: 'Capture your competitors',
      description: 'Competitor context sharpens deal reviews, battlecards, and product gap visibility.',
      href: '/competitors',
      ctaLabel: 'Add competitors',
    }
  }

  if (missing.has('caseStudies')) {
    return {
      title: 'Add proof from wins',
      description: 'Case studies turn raw deal history into reusable proof for collateral and enterprise conversations.',
      href: '/case-studies',
      ctaLabel: 'Add a case study',
    }
  }

  if (missing.has('slack')) {
    return {
      title: 'Bring Halvex into Slack',
      description: 'Slack is optional, but it shortens the loop between signal, alert, and rep action.',
      href: '/connections',
      ctaLabel: 'Connect Slack',
    }
  }

  if (degraded) {
    return {
      title: `${degraded.label} needs attention`,
      description: degraded.description,
      href: degraded.href,
      ctaLabel: 'Review integration',
    }
  }

  return null
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId, role, workspace } = await getWorkspaceContext(userId)

    const [
      [workspaceRow],
      [companyCountRow],
      [competitorCountRow],
      [caseStudyCountRow],
      [dealCountRow],
      [openDealCountRow],
      [slackRow],
      [linearRow],
      [linearIssueCountRow],
      [hubspotRow],
    ] = await Promise.all([
      db
        .select({
          mcpApiKey: workspaces.mcpApiKey,
        })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1),
      db.select({ value: count() }).from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId)),
      db.select({ value: count() }).from(competitors).where(eq(competitors.workspaceId, workspaceId)),
      db.select({ value: count() }).from(caseStudies).where(eq(caseStudies.workspaceId, workspaceId)),
      db.select({ value: count() }).from(dealLogs).where(eq(dealLogs.workspaceId, workspaceId)),
      db
        .select({ value: count() })
        .from(dealLogs)
        .where(
          sql`${dealLogs.workspaceId} = ${workspaceId} AND ${dealLogs.stage} NOT IN ('closed_won', 'closed_lost')`
        ),
      db
        .select({
          slackTeamName: slackConnections.slackTeamName,
          createdAt: slackConnections.createdAt,
        })
        .from(slackConnections)
        .where(eq(slackConnections.workspaceId, workspaceId))
        .limit(1),
      db
        .select({
          teamName: linearIntegrations.teamName,
          lastSyncAt: linearIntegrations.lastSyncAt,
          syncError: linearIntegrations.syncError,
        })
        .from(linearIntegrations)
        .where(eq(linearIntegrations.workspaceId, workspaceId))
        .limit(1),
      db
        .select({ value: count() })
        .from(linearIssuesCache)
        .where(eq(linearIssuesCache.workspaceId, workspaceId)),
      db
        .select({
          portalId: hubspotIntegrations.portalId,
          dealsImported: hubspotIntegrations.dealsImported,
          lastSyncAt: hubspotIntegrations.lastSyncAt,
          syncError: hubspotIntegrations.syncError,
        })
        .from(hubspotIntegrations)
        .where(eq(hubspotIntegrations.workspaceId, workspaceId))
        .limit(1),
    ])

    const hasCompanyProfile = Number(companyCountRow?.value ?? 0) > 0
    const competitorCount = Number(competitorCountRow?.value ?? 0)
    const caseStudyCount = Number(caseStudyCountRow?.value ?? 0)
    const dealCount = Number(dealCountRow?.value ?? 0)
    const openDealCount = Number(openDealCountRow?.value ?? 0)
    const hasMcpKey = Boolean(workspaceRow?.mcpApiKey)
    const slackConnected = Boolean(slackRow)
    const linearConnected = Boolean(linearRow)
    const hubspotConnected = Boolean(hubspotRow)
    const linearIssueCount = Number(linearIssueCountRow?.value ?? 0)

    const items: ReadinessItem[] = [
      {
        id: 'company',
        label: 'Company brain',
        href: '/company',
        done: hasCompanyProfile,
        degraded: false,
        description: hasCompanyProfile
          ? 'Company positioning and product context are stored in Halvex.'
          : 'Add your positioning, differentiators, and objections to improve AI output.',
      },
      {
        id: 'crm',
        label: 'CRM sync',
        href: '/connections',
        done: hubspotConnected,
        degraded: Boolean(hubspotRow?.syncError),
        description: hubspotConnected
          ? hubspotRow?.syncError
            ? 'HubSpot is connected, but the latest sync needs attention.'
            : `HubSpot is connected${hubspotRow?.dealsImported ? ` with ${hubspotRow.dealsImported} imported deals` : ''}.`
          : 'Connect HubSpot so Halvex reflects live pipeline data instead of manual updates.',
      },
      {
        id: 'linear',
        label: 'Linear sync',
        href: '/connections',
        done: linearConnected,
        degraded: Boolean(linearRow?.syncError),
        description: linearConnected
          ? linearRow?.syncError
            ? 'Linear is connected, but issue sync needs attention.'
            : `Linear is connected${linearIssueCount > 0 ? ` with ${linearIssueCount} synced issues` : ''}.`
          : 'Connect Linear so saved issue links point to live product work.',
      },
      {
        id: 'mcp',
        label: 'Claude MCP',
        href: '/connections',
        done: hasMcpKey,
        degraded: false,
        description: hasMcpKey
          ? 'Claude can authenticate into Halvex MCP with a workspace-scoped key.'
          : 'Generate and install an MCP key so Claude can review deals and write context back.',
      },
      {
        id: 'slack',
        label: 'Slack workspace',
        href: '/connections',
        done: slackConnected,
        degraded: false,
        description: slackConnected
          ? `Slack is connected${slackRow?.slackTeamName ? ` to ${slackRow.slackTeamName}` : ''}.`
          : isSlackConfigured()
            ? 'Slack is available but not connected for this workspace.'
            : 'Slack is optional and not configured in this environment yet.',
      },
      {
        id: 'deals',
        label: 'Live deals',
        href: '/deals',
        done: dealCount > 0,
        degraded: false,
        description: dealCount > 0
          ? `${dealCount} deal${dealCount === 1 ? '' : 's'} logged${openDealCount > 0 ? `, ${openDealCount} open` : ''}.`
          : 'Log the first deal so Halvex can start tracking revenue risk and product blockers.',
      },
      {
        id: 'competitors',
        label: 'Competitors',
        href: '/competitors',
        done: competitorCount > 0,
        degraded: false,
        description: competitorCount > 0
          ? `${competitorCount} competitor${competitorCount === 1 ? '' : 's'} tracked.`
          : 'Add competitors to improve battlecards and blocker context.',
      },
      {
        id: 'caseStudies',
        label: 'Case studies',
        href: '/case-studies',
        done: caseStudyCount > 0,
        degraded: false,
        description: caseStudyCount > 0
          ? `${caseStudyCount} case stud${caseStudyCount === 1 ? 'y' : 'ies'} ready for proof and collateral.`
          : 'Add customer proof so enterprise collateral and reviews have evidence behind them.',
      },
    ]

    const completed = items.filter(item => item.done).length
    const total = items.length
    const score = Math.round((completed / total) * 100)
    const degradedCount = items.filter(item => item.degraded).length
    const nextAction = buildNextAction(items)

    return NextResponse.json({
      data: {
        workspaceName: workspace.name,
        role,
        score,
        completed,
        total,
        degradedCount,
        summary: {
          dealCount,
          openDealCount,
          competitorCount,
          caseStudyCount,
          linearIssueCount,
        },
        items,
        nextAction,
      },
    })
  } catch (err) {
    return dbErrResponse(err)
  }
}
